from typing import List, Dict, Any
import json
import logging

from src.agentsentinel.llm.provider import LLMProvider, AgentMessage
from src.agentsentinel.llm.tools import ToolRegistry
from src.agentsentinel.runtime.state import ValidatedInvocation
from src.agentsentinel.integrations.callable_integration import CallableAdapter
from src.agentsentinel.integrations.service import LocalSentinelService

logger = logging.getLogger(__name__)

class AgentRunner:
    def __init__(
        self,
        provider: LLMProvider,
        registry: ToolRegistry,
        service: LocalSentinelService,
        session_id: str,
        task_id: str
    ):
        self.provider = provider
        self.registry = registry
        self.service = service
        self.session_id = session_id
        self.task_id = task_id
        self.messages: List[AgentMessage] = []

    def run(self, task_prompt: str) -> Dict[str, Any]:
        """Runs the agent loop until task completion or error."""
        self.messages.append(AgentMessage(
            role="system", 
            content="You are a helpful AI assistant. Be extremely concise. Output your tool call immediately without any reasoning or thinking. When given tool results, simply provide the final answer immediately."
        ))
        self.messages.append(AgentMessage(role="user", content=task_prompt))
        self.messages.append(AgentMessage(role="assistant", content="<think>\n</think>\n"))

        
        # Build tool schemas for the LLM
        llm_tools = []
        for name, tool in self.registry.tools.items():
            llm_tools.append({
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.schema
                }
            })

        max_iterations = 5
        iteration = 0
        trace = []

        adapter = CallableAdapter(self.service._interceptor)

        while iteration < max_iterations:
            iteration += 1
            
            # 1. LLM Generation
            try:
                response = self.provider.generate(self.messages, llm_tools)
            except Exception as e:
                logger.error(f"Provider generation failed: {e}")
                trace.append({"type": "execution_result", "state": "EXECUTION_FAILED", "output": f"LLM error: {e}"})
                return {"status": "error", "trace": trace}

            self.messages.append(response)

            if not response.tool_calls:
                # Task finished
                trace.append({"type": "agent_response", "content": response.content})
                return {"status": "completed", "trace": trace}

            # 2. Tool Execution Loop
            for tool_call in response.tool_calls:
                tool_name = tool_call["name"]
                tool_args = tool_call.get("arguments", {})
                tool_id = tool_call.get("id", "unknown_id")
                
                trace.append({
                    "type": "tool_call",
                    "tool": tool_name,
                    "arguments": tool_args
                })

                try:
                    tool = self.registry.get_tool(tool_name)
                    
                    # Construct frozen invocation args
                    frozen_args = tuple(sorted(tool_args.items()))
                    
                    invocation = ValidatedInvocation(
                        tool_name=tool_name,
                        frozen_arguments=frozen_args,
                        callable_ref=tool.callable_func
                    )
                    
                    # 3. Intercept & Execute via AgentSentinel M12 integration
                    try:
                        result = self.service.execute_tool(adapter, self.session_id, self.task_id, invocation)
                        
                        self.messages.append(AgentMessage(
                            role="tool",
                            content=str(result),
                            tool_call_id=tool_id
                        ))
                        trace.append({
                            "type": "execution_result",
                            "state": "EXECUTED",
                            "output": str(result)
                        })
                    except Exception as e:
                        # Could be SentinelBlockException or tool failure
                        msg = str(e)
                        is_blocked = "blocked by AgentSentinel" in msg
                        
                        self.messages.append(AgentMessage(
                            role="tool",
                            content=msg,
                            tool_call_id=tool_id
                        ))
                        
                        trace.append({
                            "type": "execution_result",
                            "state": "BLOCKED" if is_blocked else "EXECUTION_FAILED",
                            "output": msg
                        })
                        
                        # Immediately terminate without another LLM roundtrip
                        return {"status": "blocked" if is_blocked else "failed", "trace": trace}

                except Exception as e:
                    logger.error(f"Failed to process tool {tool_name}: {e}")
                    self.messages.append(AgentMessage(
                        role="tool",
                        content=f"Error finding tool {tool_name}: {e}",
                        tool_call_id=tool_id
                    ))
                    trace.append({
                        "type": "execution_result",
                        "state": "EXECUTION_FAILED",
                        "output": f"Error finding tool {tool_name}: {e}"
                    })
                    return {"status": "failed", "trace": trace}
        
        return {"status": "completed", "trace": trace}
