import os
import json
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class AgentMessage:
    def __init__(self, role: str, content: str = "", tool_calls: Optional[List[Dict[str, Any]]] = None, tool_call_id: Optional[str] = None):
        self.role = role
        self.content = content
        self.tool_calls = tool_calls or []
        self.tool_call_id = tool_call_id

class LLMProvider(ABC):
    @abstractmethod
    def generate(self, messages: List[AgentMessage], tools: List[Dict[str, Any]]) -> AgentMessage:
        """Generates a response or tool call from the LLM."""
        pass

class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "gpt-4o", base_url: Optional[str] = None):
        import openai
        self.client = openai.OpenAI(api_key=api_key, base_url=base_url)
        self.model = model

    def generate(self, messages: List[AgentMessage], tools: List[Dict[str, Any]]) -> AgentMessage:
        formatted_messages = []
        for m in messages:
            msg: Dict[str, Any] = {"role": m.role}
            if m.content:
                msg["content"] = m.content
            if m.tool_calls:
                msg["tool_calls"] = []
                for tc in m.tool_calls:
                    msg["tool_calls"].append({
                        "id": tc["id"],
                        "type": "function",
                        "function": {
                            "name": tc["name"],
                            "arguments": json.dumps(tc["arguments"]) if isinstance(tc["arguments"], dict) else tc["arguments"]
                        }
                    })
            if m.tool_call_id:
                msg["tool_call_id"] = m.tool_call_id
            formatted_messages.append(msg)

        formatted_tools = tools

        kwargs = {
            "model": self.model,
            "messages": formatted_messages,
        }
        if formatted_tools:
            kwargs["tools"] = formatted_tools
            
        response = self.client.chat.completions.create(**kwargs)
        
        choice = response.choices[0].message
        
        tool_calls = []
        if choice.tool_calls:
            for tc in choice.tool_calls:
                tool_calls.append({
                    "id": tc.id,
                    "name": tc.function.name,
                    "arguments": json.loads(tc.function.arguments)
                })
                
        return AgentMessage(
            role="assistant",
            content=choice.content or "",
            tool_calls=tool_calls
        )

class DevelopmentProvider(LLMProvider):
    """
    A deterministic development provider that simulates an LLM response.
    Used ONLY for isolated unit tests. Not used in production.
    """
    def __init__(self):
        self.call_count = 0

    def generate(self, messages: List[AgentMessage], tools: List[Dict[str, Any]]) -> AgentMessage:
        self.call_count += 1
        user_msg = next((m.content for m in messages if m.role == "user"), "").lower()

        # If we already have tool results, conclude the task
        if any(m.role == "tool" for m in messages):
            tool_res = next((m.content for m in reversed(messages) if m.role == "tool"), "")
            if "blocked" in tool_res.lower():
                return AgentMessage(
                    role="assistant",
                    content="Operation halted: Action was intercepted and BLOCKED by AgentSentinel runtime governance."
                )
            elif "error" in tool_res.lower() or "not found" in tool_res.lower():
                return AgentMessage(
                    role="assistant",
                    content=f"Operation failed during tool execution: {tool_res}"
                )
            return AgentMessage(
                role="assistant",
                content=f"Task completed successfully. Tool execution output: {tool_res}"
            )

        # Scenario 4: Missing file execution failure
        if ("missing" in user_msg or "non_existent" in user_msg or "fail" in user_msg) and self.call_count == 1:
            return AgentMessage(
                role="assistant",
                tool_calls=[{"id": "call_fail", "name": "read_file", "arguments": {"file_path": "non_existent_file.txt"}}]
            )

        # Scenario 3: Malicious attack / unauthorized write (BLOCK)
        if ("write" in user_msg or "passwd" in user_msg or "delete" in user_msg or "exfiltrate" in user_msg or "attack" in user_msg) and self.call_count == 1:
            return AgentMessage(
                role="assistant",
                tool_calls=[{"id": "call_block", "name": "write_file", "arguments": {"file_path": "/etc/passwd", "content": "malicious_override"}}]
            )

        # Scenario 2: Calculate math (ALERT / ALLOW)
        if ("calculate" in user_msg or "alert" in user_msg or "math" in user_msg) and self.call_count == 1:
            return AgentMessage(
                role="assistant",
                tool_calls=[{"id": "call_alert", "name": "calculate", "arguments": {"expression": "42 * 1337"}}]
            )

        # Scenario 1 (Default): Read public docs (ALLOW)
        if self.call_count == 1:
            return AgentMessage(
                role="assistant",
                tool_calls=[{"id": "call_allow", "name": "read_file", "arguments": {"file_path": "public_docs.txt"}}]
            )

        return AgentMessage(role="assistant", content="I could not determine a tool to run for that task.")

import requests

class OllamaProvider(LLMProvider):
    def __init__(self, host: str = "http://localhost:11434", model: str = "qwen3:4b"):
        self.host = host.rstrip("/")
        self.model = model

    def check_availability(self) -> str:
        """Returns 'OLLAMA_UNAVAILABLE', 'MODEL_MISSING', or 'MODEL_AVAILABLE'"""
        try:
            resp = requests.get(f"{self.host}/api/tags", timeout=2.0)
            resp.raise_for_status()
            data = resp.json()
            models = [m.get("name", "") for m in data.get("models", [])]
            # Exact model name match only — no fuzzy prefix matching.
            # The model sent to /api/chat must exactly match a pulled model tag.
            if self.model in models:
                return "MODEL_AVAILABLE"
            return "MODEL_MISSING"
        except requests.exceptions.RequestException:
            return "OLLAMA_UNAVAILABLE"

    def generate(self, messages: List[AgentMessage], tools: List[Dict[str, Any]]) -> AgentMessage:
        formatted_messages = []
        for m in messages:
            msg: Dict[str, Any] = {"role": m.role}
            if m.content:
                msg["content"] = m.content
            if m.tool_calls:
                msg["tool_calls"] = []
                for tc in m.tool_calls:
                    msg["tool_calls"].append({
                        "function": {
                            "name": tc["name"],
                            "arguments": tc["arguments"]
                        }
                    })
            formatted_messages.append(msg)

        formatted_tools = tools

        # Detect whether this is a follow-up call (after tool results)
        # vs. an initial call (where the model needs to generate tool calls).
        # Follow-up calls only need text output, so we can disable thinking
        # and use a tighter output bound.
        has_tool_results = any(m.role == "tool" for m in messages)

        if has_tool_results:
            formatted_messages.append({
                "role": "assistant",
                "content": "<think>\n</think>\n"
            })

        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": formatted_messages,
            "stream": False
        }
        if formatted_tools and not has_tool_results:
            payload["tools"] = formatted_tools

        if has_tool_results:
            # Follow-up: text-only response after tool execution.
            payload["options"] = {"num_predict": 256, "temperature": 0.0}
        else:
            # Initial call: model needs thinking to decide on tool calls.
            # Bound total output to force a fast deterministic tool call.
            payload["options"] = {"num_predict": 1024, "temperature": 0.0}

        try:
            resp = requests.post(f"{self.host}/api/chat", json=payload, timeout=120.0)
            resp.raise_for_status()
            data = resp.json()
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Ollama API error: {e}")

        msg_data = data.get("message", {})
        
        tool_calls = []
        if "tool_calls" in msg_data and msg_data["tool_calls"]:
            for i, tc in enumerate(msg_data["tool_calls"]):
                func = tc.get("function", {})
                tool_calls.append({
                    "id": f"call_{i}",
                    "name": func.get("name"),
                    "arguments": func.get("arguments", {})
                })

        return AgentMessage(
            role="assistant",
            content=msg_data.get("content", ""),
            tool_calls=tool_calls
        )

def get_llm_provider() -> LLMProvider:
    # Check for explicit DEV mode (used strictly for isolated tests)
    if os.environ.get("AGENTSENTINEL_TEST_MODE") == "1":
        return DevelopmentProvider()

    api_key = os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")
    # Only use OpenAI if specifically requested and OLLAMA is not explicitly requested
    if api_key and not os.environ.get("OLLAMA_HOST"):
        print("[LLM] Initializing real OpenAI-compatible provider.")
        model = os.environ.get("LLM_MODEL", "gpt-4o")
        base_url = os.environ.get("LLM_BASE_URL", None)
        return OpenAIProvider(api_key=api_key, model=model, base_url=base_url)
    
    # Enforce Ollama as the REAL local runtime (Phase 3 Requirement)
    host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
    model = os.environ.get("OLLAMA_MODEL", "qwen3:4b")
    
    print(f"[LLM] Initializing explicit real Ollama provider (host={host}, model={model}).")
    provider = OllamaProvider(host=host, model=model)
    status = provider.check_availability()
    
    if status == "OLLAMA_UNAVAILABLE":
        raise RuntimeError("OLLAMA_UNAVAILABLE: Could not connect to Ollama server.")
    elif status == "MODEL_MISSING":
        raise RuntimeError(f"MODEL_MISSING: Ollama is running, but model '{model}' is not pulled.")
    
    print("[LLM] Ollama is AVAILABLE and model is READY.")
    return provider
