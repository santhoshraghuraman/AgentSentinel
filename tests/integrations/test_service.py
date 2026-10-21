import pytest
from datetime import datetime, timezone

from src.agentsentinel.runtime.interceptor import RuntimeInterceptor, InterceptionResult
from src.agentsentinel.runtime.state import ValidatedInvocation, RuntimeSession, ExecutionState
from src.agentsentinel.runtime.audit import AuditEvent
from src.agentsentinel.integrations.service import LocalSentinelService
from src.agentsentinel.integrations.callable_integration import CallableAdapter, SentinelBlockException
from src.agentsentinel.governance.models import GovernanceDecision, ActionDecisionRecord
from src.agentsentinel.models.normalized import NormalizedAction, ActionCategory


class DummyTaskRepo:
    def get(self, task_id):
        # We don't care about the real TaskContext for this test, just a mock
        return "mock_task_context"
    def add(self, ctx): pass
    def list_all(self): return []

class DummyPolicyRepo:
    def get_all(self): return []
    def add(self, p): pass
    def delete(self, id): return True

class DummyAuditRepo:
    def __init__(self):
        self.events = []
    def append(self, event):
        self.events.append(event)
    def get_by_session(self, session_id): return []
    def get_all(self): return []

from unittest.mock import Mock

def test_service_execution_flow():
    """Verify execution flow in LocalSentinelService: ALLOW executes tool, updates state, and flushes audit."""
    task_repo = DummyTaskRepo()
    policy_repo = DummyPolicyRepo()
    audit_repo = DummyAuditRepo()
    
    interceptor_mock = Mock(spec=RuntimeInterceptor)
    
    action = NormalizedAction(
        normalized_name="dummy_action",
        category=ActionCategory.FILE_SYSTEM_READ,
        operation="read",
        resource="/data/test.txt",
        is_mutating=False,
        is_destructive=False,
        original_tool_name="dummy",
        source_dataset="runtime",
    )
    
    result = InterceptionResult(
        interception_id="int_1",
        session_id="session_123",
        sequence_number=1,
        decision=GovernanceDecision.ALLOW,
        action=action,
        action_record=None,
        error_message=None,
    )
    audit_event = AuditEvent(
        interception_id="int_1",
        session_id="session_123",
        sequence_number=1,
        timestamp=datetime.now(timezone.utc),
        action=action,
        decision=GovernanceDecision.ALLOW,
        action_record=None,
        execution_state=ExecutionState.ATTEMPTED,
    )
    interceptor_mock.intercept.return_value = (result, audit_event)
    
    adapter_mock = Mock()
    adapter_mock.normalize.return_value = action
    
    called = False
    def my_tool(a):
        nonlocal called
        called = True
        return f"execution_success_{a}"
        
    invocation = ValidatedInvocation(
        tool_name="dummy",
        frozen_arguments=(("a", 1),),
        callable_ref=my_tool,
    )
    
    service = LocalSentinelService(interceptor_mock, task_repo, policy_repo, audit_repo)
    result_val = service.execute_tool(adapter_mock, "session_123", "task_1", invocation)
    
    assert result_val == "execution_success_1"
    assert called is True
    
    # Verify interception contract
    interceptor_mock.intercept.assert_called_once()
    session_arg, action_arg = interceptor_mock.intercept.call_args[0]
    assert isinstance(session_arg, RuntimeSession)
    assert session_arg.session_id == "session_123"
    assert action_arg == action
    
    interceptor_mock.mark_executed.assert_called_once_with(session_arg, "int_1")
    interceptor_mock.mark_execution_failed.assert_not_called()
    
    # Check audit persistence
    assert len(audit_repo.events) == 1
    persisted_event = audit_repo.events[0]
    
    assert persisted_event.interception_id == "int_1"
    assert persisted_event.decision == GovernanceDecision.ALLOW
    assert persisted_event.execution_state == ExecutionState.EXECUTED
    assert persisted_event.execution_result == "execution_success_1"
    assert persisted_event.tool_name == "dummy"
    assert persisted_event.task_id == "task_1"
    assert persisted_event.arguments == {"a": 1}


def test_service_execution_failure_propagation():
    """Verify tool failure propagation in LocalSentinelService: exception propagated and EXECUTION_FAILED flushed."""
    task_repo = DummyTaskRepo()
    policy_repo = DummyPolicyRepo()
    audit_repo = DummyAuditRepo()
    
    interceptor_mock = Mock(spec=RuntimeInterceptor)
    
    action = NormalizedAction(
        normalized_name="dummy_action",
        category=ActionCategory.FILE_SYSTEM_READ,
        operation="read",
        resource="/data/test.txt",
        is_mutating=False,
        is_destructive=False,
        original_tool_name="dummy",
        source_dataset="runtime",
    )
    
    result = InterceptionResult(
        interception_id="int_fail",
        session_id="session_123",
        sequence_number=1,
        decision=GovernanceDecision.ALLOW,
        action=action,
        action_record=None,
        error_message=None,
    )
    audit_event = AuditEvent(
        interception_id="int_fail",
        session_id="session_123",
        sequence_number=1,
        timestamp=datetime.now(timezone.utc),
        action=action,
        decision=GovernanceDecision.ALLOW,
        action_record=None,
        execution_state=ExecutionState.ATTEMPTED,
    )
    interceptor_mock.intercept.return_value = (result, audit_event)
    
    adapter_mock = Mock()
    adapter_mock.normalize.return_value = action
    
    def failing_tool():
        raise ValueError("Tool crashed")
        
    invocation = ValidatedInvocation(
        tool_name="dummy",
        frozen_arguments=(),
        callable_ref=failing_tool,
    )
    
    service = LocalSentinelService(interceptor_mock, task_repo, policy_repo, audit_repo)
    
    with pytest.raises(ValueError, match="Tool crashed"):
        service.execute_tool(adapter_mock, "session_123", "task_1", invocation)
        
    # Verify interceptor methods
    interceptor_mock.intercept.assert_called_once()
    session_arg = interceptor_mock.intercept.call_args[0][0]
    interceptor_mock.mark_execution_failed.assert_called_once_with(session_arg, "int_fail", "Tool crashed")
    interceptor_mock.mark_executed.assert_not_called()
    
    # Finally block MUST still have flushed the audit with EXECUTION_FAILED
    assert len(audit_repo.events) == 1
    persisted_event = audit_repo.events[0]
    assert persisted_event.interception_id == "int_fail"
    assert persisted_event.decision == GovernanceDecision.ALLOW
    assert persisted_event.execution_state == ExecutionState.EXECUTION_FAILED
    assert persisted_event.execution_error == "Tool crashed"
    assert persisted_event.execution_result == "Tool crashed"
    assert persisted_event.tool_name == "dummy"
    assert persisted_event.task_id == "task_1"


def test_service_execution_block_zero_invocations():
    """Verify BLOCK in LocalSentinelService: protected callable invoked zero times and BLOCKED state flushed."""
    task_repo = DummyTaskRepo()
    policy_repo = DummyPolicyRepo()
    audit_repo = DummyAuditRepo()
    
    interceptor_mock = Mock(spec=RuntimeInterceptor)
    
    action = NormalizedAction(
        normalized_name="forbidden_action",
        category=ActionCategory.FILE_SYSTEM_WRITE,
        operation="delete",
        resource="/system/critical.db",
        is_mutating=True,
        is_destructive=True,
        original_tool_name="delete_tool",
        source_dataset="runtime",
    )
    
    result = InterceptionResult(
        interception_id="int_block",
        session_id="session_123",
        sequence_number=1,
        decision=GovernanceDecision.BLOCK,
        action=action,
        action_record=None,
        error_message="Action blocked by security policy",
    )
    audit_event = AuditEvent(
        interception_id="int_block",
        session_id="session_123",
        sequence_number=1,
        timestamp=datetime.now(timezone.utc),
        action=action,
        decision=GovernanceDecision.BLOCK,
        action_record=None,
        execution_state=ExecutionState.ATTEMPTED,
        error_message="Action blocked by security policy",
    )
    interceptor_mock.intercept.return_value = (result, audit_event)
    
    call_count = 0
    def forbidden_tool():
        nonlocal call_count
        call_count += 1
        return "should_not_run"
        
    invocation = ValidatedInvocation(
        tool_name="delete_tool",
        frozen_arguments=(),
        callable_ref=forbidden_tool,
    )
    
    adapter_mock = Mock()
    adapter_mock.normalize.return_value = action
    adapter_mock.handle_block.return_value = "BLOCKED_RESPONSE"
    
    service = LocalSentinelService(interceptor_mock, task_repo, policy_repo, audit_repo)
    result_val = service.execute_tool(adapter_mock, "session_123", "task_1", invocation)
    
    assert result_val == "BLOCKED_RESPONSE"
    assert call_count == 0
    adapter_mock.handle_block.assert_called_once_with(result)
    interceptor_mock.mark_executed.assert_not_called()
    interceptor_mock.mark_execution_failed.assert_not_called()
    
    assert len(audit_repo.events) == 1
    persisted_event = audit_repo.events[0]
    assert persisted_event.interception_id == "int_block"
    assert persisted_event.decision == GovernanceDecision.BLOCK
    assert persisted_event.execution_state == ExecutionState.BLOCKED
    assert persisted_event.execution_result == "BLOCKED"
    assert persisted_event.tool_name == "delete_tool"
    assert persisted_event.task_id == "task_1"


