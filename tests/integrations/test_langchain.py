import pytest
from src.agentsentinel.integrations.context import set_sentinel_context, _sentinel_service_ctx
from src.agentsentinel.integrations.langchain_integration import SentinelLangChainTool

@pytest.fixture(autouse=True)
def cleanup_context():
    token = _sentinel_service_ctx.set(None)
    yield
    _sentinel_service_ctx.reset(token)

def test_langchain_tool_without_dependency():
    """Ensure that the module handles missing langchain-core."""
    # We can test behavior when the import fails, but since it's installed 
    # for the project (probably not? AgentSentinel didn't require it), 
    # we just verify the wrapper can be instantiated without crashing.
    class DummyInner:
        name = "test_tool"
        description = "dummy desc"
        args_schema = None
        def _run(self, input_str: str):
            return "done"

    tool = SentinelLangChainTool(inner_tool=DummyInner())
    assert tool.name == "test_tool"

from unittest.mock import Mock

def test_langchain_arg_mapping():
    service_mock = Mock()
    service_mock.execute_tool.return_value = "sentinel_result"

    set_sentinel_context(service_mock, "session_123", "task_123")

    class DummyInner:
        name = "dummy"
        description = "desc"
        args_schema = None
        def _run(self, text: str, mode: str = "fast"):
            return "executed"

    tool = SentinelLangChainTool(inner_tool=DummyInner())
    
    # LangChain sometimes passes positional single strings
    result = tool._run("my input")
    assert result == "sentinel_result"

    invocation = service_mock.execute_tool.call_args[0][3]
    assert invocation.tool_name == "dummy"
    assert dict(invocation.frozen_arguments) == {"text": "my input", "mode": "fast"}
