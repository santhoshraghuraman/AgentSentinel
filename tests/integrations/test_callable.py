import pytest
from src.agentsentinel.integrations.context import set_sentinel_context, _sentinel_service_ctx
from src.agentsentinel.integrations.callable_integration import sentinel_tool, SentinelBlockException

@pytest.fixture(autouse=True)
def cleanup_context():
    # ContextVar resets
    token = _sentinel_service_ctx.set(None)
    yield
    _sentinel_service_ctx.reset(token)

def test_sentinel_tool_bypass_without_context():
    @sentinel_tool
    def dummy_action(a: int, b: int) -> int:
        return a + b

    # Context is not set, should bypass and execute
    assert dummy_action(1, 2) == 3

from unittest.mock import Mock

def test_sentinel_tool_arg_mapping():
    # Mock service
    service_mock = Mock()
    service_mock.execute_tool.return_value = 42

    set_sentinel_context(service_mock, "session_123", "task_123")

    @sentinel_tool
    def dummy_action(a: int, b: int = 10) -> int:
        return a + b

    # Call with positional args
    assert dummy_action(5) == 42

    # Check invocation
    invocation = service_mock.execute_tool.call_args[0][3]
    assert invocation.tool_name == "dummy_action"
    # Mapping converted positional `5` to keyword `a`, and applied default `b=10`
    assert dict(invocation.frozen_arguments) == {"a": 5, "b": 10}
