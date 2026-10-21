"""
Phase 3 tests for OllamaProvider and LLM integration.
"""

import os
import json
import pytest
from unittest.mock import patch, MagicMock
from requests.exceptions import RequestException

from src.agentsentinel.llm.provider import (
    OllamaProvider,
    AgentMessage,
    get_llm_provider
)
from src.agentsentinel.llm.agent import AgentRunner
from src.agentsentinel.llm.tools import ToolRegistry, SafeTool
from src.agentsentinel.integrations.service import LocalSentinelService
from src.agentsentinel.runtime.interceptor import RuntimeInterceptor


# ──────────────────────────────────────────────────────────
# 1-4. Provider and Availability Tests
# ──────────────────────────────────────────────────────────

def test_ollama_provider_construction():
    """1. Ollama provider construction."""
    provider = OllamaProvider(host="http://test:11434", model="llama3")
    assert provider.host == "http://test:11434"
    assert provider.model == "llama3"

@patch('requests.get')
def test_connection_failure_handling(mock_get):
    """2 & 3. connection failure handling -> OLLAMA_UNAVAILABLE"""
    mock_get.side_effect = RequestException("Connection refused")
    provider = OllamaProvider()
    assert provider.check_availability() == "OLLAMA_UNAVAILABLE"

@patch('requests.get')
def test_model_missing_handling(mock_get):
    """4. model availability handling -> MODEL_MISSING"""
    mock_response = MagicMock()
    mock_response.json.return_value = {"models": [{"name": "llama3:latest"}]}
    mock_get.return_value = mock_response
    
    provider = OllamaProvider(model="qwen3")
    assert provider.check_availability() == "MODEL_MISSING"

@patch('requests.get')
def test_model_available_handling(mock_get):
    """4. model availability handling -> MODEL_AVAILABLE"""
    mock_response = MagicMock()
    mock_response.json.return_value = {"models": [{"name": "qwen3:4b"}]}
    mock_get.return_value = mock_response
    
    provider = OllamaProvider(model="qwen3:4b")
    assert provider.check_availability() == "MODEL_AVAILABLE"


# ──────────────────────────────────────────────────────────
# 5-7. Structured Tool Call Parsing
# ──────────────────────────────────────────────────────────

@patch('requests.post')
def test_structured_tool_call_parsing(mock_post):
    """5 & 6. structured tool call parsing and valid tool arguments."""
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "message": {
            "role": "assistant",
            "content": "",
            "tool_calls": [
                {
                    "function": {
                        "name": "read_file",
                        "arguments": {"file_path": "test.txt"}
                    }
                }
            ]
        }
    }
    mock_post.return_value = mock_response
    
    provider = OllamaProvider()
    response = provider.generate([], [])
    
    assert response.role == "assistant"
    assert len(response.tool_calls) == 1
    assert response.tool_calls[0]["name"] == "read_file"
    assert response.tool_calls[0]["arguments"] == {"file_path": "test.txt"}
    assert response.tool_calls[0]["id"] == "call_0"

@patch('requests.post')
def test_malformed_tool_arguments(mock_post):
    """7. malformed tool arguments."""
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "message": {
            "role": "assistant",
            "tool_calls": [
                {
                    "function": {
                        "name": "read_file",
                        "arguments": "this is not json"
                    }
                }
            ]
        }
    }
    mock_post.return_value = mock_response
    
    provider = OllamaProvider()
    response = provider.generate([], [])
    # Should safely capture the string as the argument (AgentRunner's tool invocation will fail validation)
    assert response.tool_calls[0]["arguments"] == "this is not json"


# ──────────────────────────────────────────────────────────
# 8-15. Multi-step Agent Loop & Safety
# ──────────────────────────────────────────────────────────

class MockProvider(OllamaProvider):
    """Mock provider to simulate LLM loop without actual network calls."""
    def __init__(self, steps):
        super().__init__()
        self.steps = steps
        self.call_count = 0

    def generate(self, messages, tools):
        if self.call_count < len(self.steps):
            resp = self.steps[self.call_count]
            self.call_count += 1
            return resp
        return AgentMessage(role="assistant", content="Finished.")

def _setup_test_env(tmp_path):
    registry = ToolRegistry(str(tmp_path))
    interceptor = RuntimeInterceptor()
    
    mock_task_repo = MagicMock()
    # Return a dummy task context so _sync_session succeeds
    from src.agentsentinel.authorization.models import TaskContext
    mock_task_repo.get.return_value = TaskContext(
        task_id="task_1", 
        task_description="Test",
        allowed_capabilities=(),
        denied_capabilities=()
    )
    
    mock_policy_repo = MagicMock()
    mock_policy_repo.get_all.return_value = []
    
    mock_audit_repo = MagicMock()
    
    service = LocalSentinelService(interceptor, mock_task_repo, mock_policy_repo, mock_audit_repo)
    return registry, service

def test_single_step_real_agent_flow(tmp_path):
    """8. single-step real-agent flow."""
    provider = MockProvider([
        AgentMessage(role="assistant", content="Here is your answer.")
    ])
    
    registry, service = _setup_test_env(tmp_path)
    
    runner = AgentRunner(
        provider=provider,
        registry=registry,
        service=service,
        session_id="sess_1",
        task_id="task_1"
    )
    
    result = runner.run("Hello")
    assert result["status"] == "completed"
    assert result["trace"][-1]["type"] == "agent_response"

def test_multi_step_agent_flow_with_allow(tmp_path):
    """9. multi-step agent flow & 11. ALLOW path & 10. tool result returned."""
    # Create test file
    test_file = tmp_path / "test.txt"
    test_file.write_text("Hello World")
    
    provider = MockProvider([
        AgentMessage(role="assistant", tool_calls=[
            {"id": "c1", "name": "read_file", "arguments": {"file_path": "test.txt"}}
        ]),
        AgentMessage(role="assistant", content="The file says Hello World")
    ])
    
    registry, service = _setup_test_env(tmp_path)
    
    runner = AgentRunner(
        provider=provider,
        registry=registry,
        service=service,
        session_id="sess_1",
        task_id="task_1"
    )
    
    result = runner.run("Read test.txt")
    
    # Verify traces
    traces = result["trace"]
    assert traces[0]["type"] == "tool_call"
    assert traces[0]["tool"] == "read_file"
    assert traces[1]["type"] == "execution_result"
    assert traces[1]["state"] == "EXECUTED"
    assert "Hello World" in traces[1]["output"]
    assert traces[2]["type"] == "agent_response"

def test_block_path(tmp_path):
    """13. BLOCK path via real M6/M7/M8 pipeline and zero-invocation verification."""
    callable_calls = 0
    def spy_write(file_path: str, content: str) -> str:
        nonlocal callable_calls
        callable_calls += 1
        return "written"

    provider = MockProvider([
        AgentMessage(role="assistant", tool_calls=[
            {"id": "c1", "name": "write_file", "arguments": {"file_path": "output.txt", "content": "hack"}}
        ]),
        AgentMessage(role="assistant", content="I cannot do that.")
    ])
    
    registry, service = _setup_test_env(tmp_path)
    registry.tools["write_file"].callable_func = spy_write

    # Configure real M7 BLOCK policy for file system write
    from src.agentsentinel.governance.models import GovernancePolicy, GovernanceDecision, PolicyCondition
    from src.agentsentinel.models.normalized import ActionCategory
    service._policy_repo.get_all.return_value = [
        GovernancePolicy(
            policy_id="pol_block_delete",
            decision=GovernanceDecision.BLOCK,
            priority=30,
            description="Block sensitive writes",
            condition=PolicyCondition(
                categories=frozenset([ActionCategory.FILE_SYSTEM_WRITE]),
            )
        )
    ]
    
    runner = AgentRunner(
        provider=provider,
        registry=registry,
        service=service,
        session_id="sess_1",
        task_id="task_1"
    )
    
    result = runner.run("Hack system")
    
    traces = result["trace"]
    assert traces[0]["type"] == "tool_call"
    assert traces[0]["tool"] == "write_file"
    assert traces[1]["type"] == "execution_result"
    assert traces[1]["state"] == "BLOCKED"
    assert "blocked by AgentSentinel" in traces[1]["output"]
    # Verify zero invocations of the protected callable
    assert callable_calls == 0

def test_execution_failure_path(tmp_path):
    """14. execution failure path."""
    provider = MockProvider([
        AgentMessage(role="assistant", tool_calls=[
            {"id": "c1", "name": "read_file", "arguments": {"file_path": "doesnotexist.txt"}}
        ]),
        AgentMessage(role="assistant", content="Failed.")
    ])
    
    registry, service = _setup_test_env(tmp_path)
    
    runner = AgentRunner(
        provider=provider,
        registry=registry,
        service=service,
        session_id="sess_1",
        task_id="task_1"
    )
    
    result = runner.run("Read file")
    
    traces = result["trace"]
    assert traces[1]["type"] == "execution_result"
    assert traces[1]["state"] == "EXECUTION_FAILED"

def test_max_iteration_safety(tmp_path):
    """15. max-iteration safety."""
    # Provider always returns a tool call -> infinite loop simulation
    class InfiniteMockProvider(OllamaProvider):
        def generate(self, messages, tools):
            return AgentMessage(role="assistant", tool_calls=[
                {"id": "c1", "name": "calculate", "arguments": {"expression": "1+1"}}
            ])

    registry, service = _setup_test_env(tmp_path)


    
    runner = AgentRunner(
        provider=InfiniteMockProvider(),
        registry=registry,
        service=service,
        session_id="sess_1",
        task_id="task_1"
    )
    
    result = runner.run("Infinite loop")
    
    # Should cap at 5 iterations
    tool_calls = [t for t in result["trace"] if t["type"] == "tool_call"]
    assert len(tool_calls) == 5


# ──────────────────────────────────────────────────────────
# Configuration Tests
# ──────────────────────────────────────────────────────────

@patch.dict(os.environ, {"OLLAMA_HOST": "http://test", "OLLAMA_MODEL": "testmodel", "AGENTSENTINEL_TEST_MODE": "0"})
@patch('requests.get')
def test_environment_configuration(mock_get):
    """2. environment configuration and strict fallback prevention."""
    mock_response = MagicMock()
    mock_response.json.return_value = {"models": [{"name": "testmodel"}]}
    mock_get.return_value = mock_response
    
    provider = get_llm_provider()
    assert isinstance(provider, OllamaProvider)
    assert provider.host == "http://test"
    assert provider.model == "testmodel"

@patch.dict(os.environ, {"AGENTSENTINEL_TEST_MODE": "0"})
@patch('requests.get')
def test_no_silent_fallback(mock_get):
    """Prevent silent fallback if Ollama is unavailable in production."""
    mock_get.side_effect = RequestException()
    
    with pytest.raises(RuntimeError, match="OLLAMA_UNAVAILABLE"):
        get_llm_provider()
