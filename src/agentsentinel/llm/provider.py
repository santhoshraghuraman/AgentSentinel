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

        # Scenario 5: Document summarization (Conversational, zero tools)
        if ("summarize" in user_msg or "summary" in user_msg or "untrusted attached document" in user_msg) and not any(k in user_msg for k in ["read_file", "read the", "write to", "write_file", "/etc/passwd", "delete", "attack"]):
            if self.call_count == 1:
                return AgentMessage(
                    role="assistant",
                    content="Document Summary: The attached PDF was successfully analyzed under zero-trust boundary. Extracted text was processed as untrusted input data without triggering external tool actions."
                )

        # Scenario 3: Malicious attack / unauthorized write (BLOCK)
        if ("write" in user_msg or "passwd" in user_msg or "delete" in user_msg or "exfiltrate" in user_msg or "attack" in user_msg) and self.call_count == 1:
            file_path = "output.txt" if "output.txt" in user_msg else "/etc/passwd"
            content = "UNAUTHORIZED_OVERRIDE" if "unauthorized_override" in user_msg else "malicious_override"
            return AgentMessage(
                role="assistant",
                tool_calls=[{"id": "call_block", "name": "write_file", "arguments": {"file_path": file_path, "content": content}}]
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
    def __init__(self, host: str = "http://localhost:11434", model: str = "qwen3:4b", timeout: Optional[float] = None):
        self.host = host.rstrip("/")
        self.model = model
        if timeout is not None:
            self.timeout = float(timeout)
        else:
            self.timeout = float(os.environ.get("OLLAMA_TIMEOUT", "120.0"))

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
        # Follow-up calls only need text output, so we can use a tighter output bound.
        has_tool_results = any(m.role == "tool" for m in messages)

        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": formatted_messages,
            "stream": False
        }
        if formatted_tools and not has_tool_results:
            payload["tools"] = formatted_tools

        # Bounded generation strategy: default to 768 tokens (configurable via OLLAMA_NUM_PREDICT)
        # to ensure reasoning and response complete well within socket read timeout.
        num_predict = int(os.environ.get("OLLAMA_NUM_PREDICT", "768"))
        if has_tool_results:
            num_predict = min(num_predict, 512)

        payload["options"] = {"num_predict": num_predict, "temperature": 0.0}

        try:
            resp = requests.post(f"{self.host}/api/chat", json=payload, timeout=self.timeout)
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

        content = msg_data.get("content", "").strip()
        # Clean up any leaking thinking tags in content
        if "</think>" in content:
            content = content.split("</think>")[-1].strip()

        # If model exhausted token budget without completing response or tool call,
        # fail explicitly instead of fabricating an answer from internal thinking monologue
        if not content and not tool_calls:
            raise RuntimeError("Model generation failed: Model exhausted token budget without completing response or tool call.")

        return AgentMessage(
            role="assistant",
            content=content,
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
