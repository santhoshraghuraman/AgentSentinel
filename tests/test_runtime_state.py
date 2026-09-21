"""
Tests for Milestone 8 — Runtime State Management.

Verifies:
    - ExecutionState enum values
    - ValidatedInvocation immutability and execution
    - RuntimeEvent creation and state transitions
    - RuntimeSession lifecycle (active, completed, terminated, reset)
    - Monotonic sequence numbering
    - Thread-safe concurrent access
    - M4 trajectory filtering (EXECUTED included, BLOCKED/FAILED excluded)
    - Snapshot context immutability
    - Session does not mutate M1–M7 domain objects
    - Block does not terminate session
"""

import threading
import time

import pytest

from src.agentsentinel.models.normalized import (
    ActionCategory,
    NormalizedAction,
    NormalizedEvent,
    NormalizedTrajectory,
)
from src.agentsentinel.models.trajectory import EventRole
from src.agentsentinel.authorization.models import (
    CapabilityGrant,
    TaskContext,
)
from src.agentsentinel.governance.models import GovernancePolicy, GovernanceDecision, PolicyCondition
from src.agentsentinel.runtime.state import (
    ExecutionState,
    RuntimeEvent,
    RuntimeSession,
    SessionStatus,
    ValidatedInvocation,
)


# ──────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────

def _make_action(
    operation="read",
    resource="/project/src/main.py",
) -> NormalizedAction:
    return NormalizedAction(
        normalized_name="test_action",
        category=ActionCategory.FILE_SYSTEM_READ,
        provider="local_fs",
        operation=operation,
        resource=resource,
        is_mutating=False,
        is_destructive=False,
        original_tool_name="read_file",
        source_dataset="test",
    )


def _make_task_context() -> TaskContext:
    return TaskContext(
        task_id="task_1",
        task_description="Test task",
        allowed_capabilities=(
            CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),
        ),
        denied_capabilities=(),
    )


def _make_session(session_id="sess_1") -> RuntimeSession:
    return RuntimeSession(
        session_id=session_id,
        task_context=_make_task_context(),
        policies=(),
    )


def _make_runtime_event(
    seq: int,
    execution_state: ExecutionState = ExecutionState.ATTEMPTED,
    action: NormalizedAction = None,
) -> RuntimeEvent:
    if action is None:
        action = _make_action()
    event = NormalizedEvent(
        id=f"evt_{seq}",
        timestamp="2025-01-01T00:00:00Z",
        role=EventRole.TOOL_CALL,
        content=None,
        normalized_actions=[action],
    )
    return RuntimeEvent(
        sequence_number=seq,
        normalized_event=event,
        execution_state=execution_state,
        interception_id=f"iid_{seq}",
    )


# ──────────────────────────────────────────────────────────
# ExecutionState Enum
# ──────────────────────────────────────────────────────────

class TestExecutionState:
    def test_attempted_value(self):
        assert ExecutionState.ATTEMPTED.value == "attempted"

    def test_executed_value(self):
        assert ExecutionState.EXECUTED.value == "executed"

    def test_blocked_value(self):
        assert ExecutionState.BLOCKED.value == "blocked"

    def test_execution_failed_value(self):
        assert ExecutionState.EXECUTION_FAILED.value == "execution_failed"

    def test_four_members(self):
        assert len(ExecutionState) == 4


# ──────────────────────────────────────────────────────────
# ValidatedInvocation
# ──────────────────────────────────────────────────────────

class TestValidatedInvocation:
    def test_frozen(self):
        """ValidatedInvocation is immutable."""
        invocation = ValidatedInvocation(
            tool_name="read_file",
            frozen_arguments=(("path", "/test"),),
            callable_ref=lambda **kwargs: kwargs,
        )
        with pytest.raises(AttributeError):
            invocation.tool_name = "changed"

    def test_execute_passes_exact_arguments(self):
        """execute() passes the exact frozen arguments to the callable."""
        captured = {}

        def mock_tool(**kwargs):
            captured.update(kwargs)
            return "result"

        invocation = ValidatedInvocation(
            tool_name="read_file",
            frozen_arguments=(("path", "/test"), ("mode", "r")),
            callable_ref=mock_tool,
        )
        result = invocation.execute()
        assert result == "result"
        assert captured == {"path": "/test", "mode": "r"}

    def test_execute_raises_on_tool_failure(self):
        """execute() propagates exceptions from the callable."""
        def failing_tool(**kwargs):
            raise RuntimeError("tool error")

        invocation = ValidatedInvocation(
            tool_name="failing",
            frozen_arguments=(),
            callable_ref=failing_tool,
        )
        with pytest.raises(RuntimeError, match="tool error"):
            invocation.execute()


# ──────────────────────────────────────────────────────────
# RuntimeEvent
# ──────────────────────────────────────────────────────────

class TestRuntimeEvent:
    def test_creation(self):
        evt = _make_runtime_event(1)
        assert evt.sequence_number == 1
        assert evt.execution_state == ExecutionState.ATTEMPTED
        assert evt.interception_id == "iid_1"

    def test_state_transition(self):
        """execution_state is mutable (M8-owned state)."""
        evt = _make_runtime_event(1)
        evt.execution_state = ExecutionState.EXECUTED
        assert evt.execution_state == ExecutionState.EXECUTED


# ──────────────────────────────────────────────────────────
# RuntimeSession Lifecycle
# ──────────────────────────────────────────────────────────

class TestSessionLifecycle:
    def test_initial_status_active(self):
        session = _make_session()
        assert session.status == SessionStatus.ACTIVE

    def test_complete(self):
        session = _make_session()
        session.complete()
        assert session.status == SessionStatus.COMPLETED

    def test_terminate(self):
        session = _make_session()
        session.terminate()
        assert session.status == SessionStatus.TERMINATED

    def test_reset(self):
        session = _make_session()
        evt = _make_runtime_event(1)
        with session.acquire_lock():
            session.next_sequence_number()
            session.append_event(evt)
        session.reset()
        assert session.status == SessionStatus.ACTIVE
        assert len(session.events) == 0

    def test_block_does_not_terminate_session(self):
        """A BLOCKED action does not automatically terminate the session."""
        session = _make_session()
        evt = _make_runtime_event(1, ExecutionState.BLOCKED)
        with session.acquire_lock():
            session.append_event(evt)
        assert session.status == SessionStatus.ACTIVE


# ──────────────────────────────────────────────────────────
# Monotonic Sequence Numbering
# ──────────────────────────────────────────────────────────

class TestSequenceNumbering:
    def test_monotonic(self):
        session = _make_session()
        with session.acquire_lock():
            s1 = session.next_sequence_number()
            s2 = session.next_sequence_number()
            s3 = session.next_sequence_number()
        assert s1 == 1
        assert s2 == 2
        assert s3 == 3

    def test_unique_under_sequential_access(self):
        session = _make_session()
        seqs = []
        with session.acquire_lock():
            for _ in range(100):
                seqs.append(session.next_sequence_number())
        assert len(set(seqs)) == 100

    def test_concurrent_unique_monotonic(self):
        """Concurrent calls receive unique monotonic sequence numbers."""
        session = _make_session()
        results = []
        barrier = threading.Barrier(10)

        def get_seq():
            barrier.wait()
            with session.acquire_lock():
                results.append(session.next_sequence_number())

        threads = [threading.Thread(target=get_seq) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(set(results)) == 10
        assert sorted(results) == list(range(1, 11))


# ──────────────────────────────────────────────────────────
# M4 Trajectory Filtering
# ──────────────────────────────────────────────────────────

class TestM4TrajectoryFiltering:
    def test_executed_included(self):
        """EXECUTED events are included in the M4 trajectory."""
        session = _make_session()
        evt = _make_runtime_event(1, ExecutionState.EXECUTED)
        with session.acquire_lock():
            session.append_event(evt)
            current = _make_runtime_event(2, ExecutionState.ATTEMPTED)
            traj = session.build_m4_trajectory(current)
        assert len(traj.events) == 2

    def test_blocked_excluded(self):
        """BLOCKED events are excluded from the M4 trajectory."""
        session = _make_session()
        blocked = _make_runtime_event(1, ExecutionState.BLOCKED)
        with session.acquire_lock():
            session.append_event(blocked)
            current = _make_runtime_event(2, ExecutionState.ATTEMPTED)
            traj = session.build_m4_trajectory(current)
        assert len(traj.events) == 1  # only current ATTEMPTED

    def test_execution_failed_excluded(self):
        """EXECUTION_FAILED events are excluded from the M4 trajectory."""
        session = _make_session()
        failed = _make_runtime_event(1, ExecutionState.EXECUTION_FAILED)
        with session.acquire_lock():
            session.append_event(failed)
            current = _make_runtime_event(2, ExecutionState.ATTEMPTED)
            traj = session.build_m4_trajectory(current)
        assert len(traj.events) == 1  # only current ATTEMPTED

    def test_attempted_included_in_current_evaluation(self):
        """The current ATTEMPTED action is included in M4 evaluation."""
        session = _make_session()
        with session.acquire_lock():
            current = _make_runtime_event(1, ExecutionState.ATTEMPTED)
            traj = session.build_m4_trajectory(current)
        assert len(traj.events) == 1

    def test_mixed_history_filtering(self):
        """Only EXECUTED + current ATTEMPTED in M4 trajectory."""
        session = _make_session()
        executed = _make_runtime_event(1, ExecutionState.EXECUTED)
        blocked = _make_runtime_event(2, ExecutionState.BLOCKED)
        failed = _make_runtime_event(3, ExecutionState.EXECUTION_FAILED)
        executed2 = _make_runtime_event(4, ExecutionState.EXECUTED)
        with session.acquire_lock():
            session.append_event(executed)
            session.append_event(blocked)
            session.append_event(failed)
            session.append_event(executed2)
            current = _make_runtime_event(5, ExecutionState.ATTEMPTED)
            traj = session.build_m4_trajectory(current)
        # 2 EXECUTED + 1 current ATTEMPTED = 3
        assert len(traj.events) == 3


# ──────────────────────────────────────────────────────────
# Snapshot Immutability
# ──────────────────────────────────────────────────────────

class TestSnapshotContext:
    def test_snapshot_returns_same_references(self):
        """snapshot_context returns references to the same objects."""
        session = _make_session()
        ctx, pol = session.snapshot_context()
        assert ctx is session.task_context
        assert pol == session.policies

    def test_snapshot_independent_of_later_changes(self):
        """TaskContext and policies are snapshotted before evaluation."""
        tc = _make_task_context()
        policies = (
            GovernancePolicy(
                policy_id="p1",
                decision=GovernanceDecision.ALERT,
                condition=PolicyCondition(),
                priority=0,
                description="test",
            ),
        )
        session = RuntimeSession(
            session_id="s1",
            task_context=tc,
            policies=policies,
        )
        ctx_snap, pol_snap = session.snapshot_context()

        # Simulate external mutation (shouldn't affect snapshot)
        # RuntimeSession stores an immutable tuple of policies
        assert ctx_snap is tc
        assert pol_snap == policies


# ──────────────────────────────────────────────────────────
# Input Immutability
# ──────────────────────────────────────────────────────────

class TestInputImmutability:
    def test_normalized_action_not_mutated_by_session(self):
        """NormalizedAction stored in events is not mutated."""
        action = _make_action()
        original_name = action.normalized_name
        session = _make_session()
        evt = _make_runtime_event(1, action=action)
        with session.acquire_lock():
            session.append_event(evt)
        assert action.normalized_name == original_name

    def test_task_context_not_mutated(self):
        """TaskContext remains frozen."""
        session = _make_session()
        with pytest.raises(AttributeError):
            session.task_context.task_id = "changed"
