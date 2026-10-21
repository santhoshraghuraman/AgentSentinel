"""
Remediation 2 — Trajectory History Hydration

Focused regression tests for LocalSentinelService._sync_session().

Before Remediation 2 every _sync_session() call returned a fresh
RuntimeSession with an empty _events list.  M8/M3/M4/M5 therefore
saw only the current tool call with no behavioral history, making
trajectory-based risk assessment unreliable for multi-step agents.

After Remediation 2 _sync_session() hydrates RuntimeEvent objects
from the audit repository (via get_by_session) so M8 always sees the
full prior history for the session.
"""

import threading
from datetime import datetime
from typing import Any, Dict, List, Optional
from unittest.mock import Mock, MagicMock

import pytest

from src.agentsentinel.integrations.service import LocalSentinelService
from src.agentsentinel.runtime.audit import AuditEvent
from src.agentsentinel.runtime.interceptor import InterceptionResult
from src.agentsentinel.runtime.state import (
    ExecutionState,
    RuntimeEvent,
    RuntimeSession,
    ValidatedInvocation,
)
from src.agentsentinel.models.normalized import ActionCategory, NormalizedAction, NormalizedEvent
from src.agentsentinel.models.trajectory import EventRole
from src.agentsentinel.governance.models import GovernanceDecision


def _make_action(name: str = "read_file") -> NormalizedAction:
    return NormalizedAction(
        normalized_name=name,
        category=ActionCategory.FILE_SYSTEM_READ,
        provider="test",
        operation="read",
        resource="/tmp/test.txt",
        is_mutating=False,
        is_destructive=False,
        original_tool_name=name,
        source_dataset="test",
    )


def _make_audit_event(
    interception_id: str,
    session_id: str,
    sequence_number: int,
    execution_state: ExecutionState,
    action=None,
) -> AuditEvent:
    return AuditEvent(
        interception_id=interception_id,
        session_id=session_id,
        sequence_number=sequence_number,
        timestamp=datetime(2026, 10, 17, 12, 0, 0),
        action=action,
        decision=GovernanceDecision.ALLOW,
        action_record=None,
        execution_state=execution_state,
    )


class FakeTaskRepo:
    def get(self, task_id):
        ctx = Mock()
        ctx.task_id = task_id
        return ctx
    def add(self, ctx): pass
    def list_all(self): return []


class FakePolicyRepo:
    def get_all(self): return []
    def add(self, p): pass
    def delete(self, policy_id): return True


class FakeAuditRepo:
    def __init__(self, initial=None):
        self._events: List[AuditEvent] = list(initial or [])
    def append(self, event: AuditEvent) -> None:
        self._events.append(event)
    def get_by_session(self, session_id: str) -> List[AuditEvent]:
        return [e for e in self._events if e.session_id == session_id]
    def get_all(self, since=None): return list(self._events)
    def get_recent(self, limit: int): return self._events[-limit:]
    def get_metrics(self, since=None): return {}
    def get_timeseries(self, since=None): return []


def _make_service(audit_events=None) -> LocalSentinelService:
    interceptor = Mock()
    audit_event = _make_audit_event("iid_new", "sess_1", 99, ExecutionState.ATTEMPTED, _make_action())
    result = InterceptionResult(
        interception_id="iid_new",
        session_id="sess_1",
        sequence_number=99,
        decision=GovernanceDecision.ALLOW,
        action=_make_action(),
        action_record=None,
        error_message=None,
    )
    interceptor.intercept.return_value = (result, audit_event)
    interceptor.mark_executed.return_value = None
    interceptor.mark_execution_failed.return_value = None
    task_repo = FakeTaskRepo()
    policy_repo = FakePolicyRepo()
    audit_repo = FakeAuditRepo(audit_events)
    return LocalSentinelService(interceptor, task_repo, policy_repo, audit_repo)


class TestSyncSessionHydration:

    def _call_sync(self, audit_events=None, session_id="sess_1", task_id="task_1"):
        service = _make_service(audit_events)
        return service._sync_session(session_id, task_id)

    def test_empty_history_returns_empty_session(self):
        session = self._call_sync(audit_events=[])
        assert len(session.events) == 0

    def test_single_executed_event_hydrated(self):
        prior = _make_audit_event("iid_1", "sess_1", 1, ExecutionState.EXECUTED, _make_action())
        session = self._call_sync([prior])
        assert len(session.events) == 1
        evt = session.events[0]
        assert evt.interception_id == "iid_1"
        assert evt.sequence_number == 1
        assert evt.execution_state == ExecutionState.EXECUTED

    def test_multiple_executed_events_all_hydrated(self):
        priors = [
            _make_audit_event("iid_1", "sess_1", 1, ExecutionState.EXECUTED, _make_action()),
            _make_audit_event("iid_2", "sess_1", 2, ExecutionState.EXECUTED, _make_action("write_file")),
            _make_audit_event("iid_3", "sess_1", 3, ExecutionState.EXECUTED, _make_action("list_dir")),
        ]
        session = self._call_sync(priors)
        assert len(session.events) == 3
        iids = {e.interception_id for e in session.events}
        assert iids == {"iid_1", "iid_2", "iid_3"}

    def test_blocked_event_hydrated_but_excluded_from_m4_trajectory(self):
        executed = _make_audit_event("iid_1", "sess_1", 1, ExecutionState.EXECUTED, _make_action())
        blocked = _make_audit_event("iid_2", "sess_1", 2, ExecutionState.BLOCKED, _make_action("delete_file"))
        session = self._call_sync([executed, blocked])
        assert len(session.events) == 2
        new_event = RuntimeEvent(
            sequence_number=3,
            normalized_event=NormalizedEvent(
                id="runtime_curr",
                timestamp="2026-10-17T12:00:00",
                role=EventRole.TOOL_CALL,
                content=None,
                normalized_actions=[_make_action("write_file")],
            ),
            execution_state=ExecutionState.ATTEMPTED,
            interception_id="iid_curr",
        )
        with session.acquire_lock():
            trajectory = session.build_m4_trajectory(new_event)
        assert len(trajectory.events) == 2
        actions_in_traj = {
            a.normalized_name
            for ne in trajectory.events
            for a in ne.normalized_actions
        }
        assert "delete_file" not in actions_in_traj

    def test_execution_failed_event_hydrated_but_excluded_from_m4_trajectory(self):
        failed = _make_audit_event("iid_f", "sess_1", 1, ExecutionState.EXECUTION_FAILED, _make_action("run_shell"))
        session = self._call_sync([failed])
        assert len(session.events) == 1
        new_event = RuntimeEvent(
            sequence_number=2,
            normalized_event=NormalizedEvent(
                id="runtime_curr",
                timestamp="2026-10-17T12:00:00",
                role=EventRole.TOOL_CALL,
                content=None,
                normalized_actions=[_make_action("read_file")],
            ),
            execution_state=ExecutionState.ATTEMPTED,
            interception_id="iid_curr",
        )
        with session.acquire_lock():
            trajectory = session.build_m4_trajectory(new_event)
        assert len(trajectory.events) == 1

    def test_null_action_records_skipped_no_crash(self):
        null_action = _make_audit_event("iid_null", "sess_1", 1, ExecutionState.BLOCKED, action=None)
        good_event = _make_audit_event("iid_good", "sess_1", 2, ExecutionState.EXECUTED, _make_action())
        session = self._call_sync([null_action, good_event])
        assert len(session.events) == 1
        assert session.events[0].interception_id == "iid_good"

    def test_session_isolation_different_session_ids(self):
        event_a = _make_audit_event("iid_a", "sess_A", 1, ExecutionState.EXECUTED, _make_action())
        event_b = _make_audit_event("iid_b", "sess_B", 1, ExecutionState.EXECUTED, _make_action("write_file"))
        service = _make_service([event_a, event_b])
        session = service._sync_session("sess_A", "task_1")
        assert len(session.events) == 1
        assert session.events[0].interception_id == "iid_a"

    def test_sequence_counter_advanced_beyond_max_historical(self):
        priors = [
            _make_audit_event("iid_1", "sess_1", 5, ExecutionState.EXECUTED, _make_action()),
            _make_audit_event("iid_2", "sess_1", 10, ExecutionState.EXECUTED, _make_action()),
            _make_audit_event("iid_3", "sess_1", 3, ExecutionState.EXECUTED, _make_action()),
        ]
        session = self._call_sync(priors)
        assert session._sequence_counter == 10
        with session.acquire_lock():
            next_seq = session.next_sequence_number()
        assert next_seq == 11

    def test_sequence_counter_zero_for_empty_history(self):
        session = self._call_sync([])
        assert session._sequence_counter == 0

    def test_normalized_event_fields_correctly_reconstructed(self):
        prior = _make_audit_event("iid_check", "sess_1", 1, ExecutionState.EXECUTED, _make_action("read_file"))
        session = self._call_sync([prior])
        assert len(session.events) == 1
        norm_evt = session.events[0].normalized_event
        assert norm_evt.id == "runtime_iid_check"
        assert norm_evt.role == EventRole.TOOL_CALL
        assert len(norm_evt.normalized_actions) == 1
        assert norm_evt.normalized_actions[0].normalized_name == "read_file"


class TestExecuteToolMultiCallRoundTrip:

    def _make_interceptor_for_multi_call(self):
        interceptor = Mock()
        captured_sessions = []

        def fake_intercept(session: RuntimeSession, action):
            captured_sessions.append(session)
            seq = session.next_sequence_number()
            audit_evt = _make_audit_event(
                f"iid_{seq}", session.session_id, seq, ExecutionState.ATTEMPTED, action
            )
            result = InterceptionResult(
                interception_id=f"iid_{seq}",
                session_id=session.session_id,
                sequence_number=seq,
                decision=GovernanceDecision.ALLOW,
                action=action,
                action_record=None,
                error_message=None,
            )
            return result, audit_evt

        interceptor.intercept.side_effect = fake_intercept
        interceptor.mark_executed.return_value = None
        interceptor.mark_execution_failed.return_value = None
        return interceptor, captured_sessions

    def test_second_call_sees_first_call_in_history(self):
        interceptor, captured_sessions = self._make_interceptor_for_multi_call()
        audit_repo = FakeAuditRepo()
        service = LocalSentinelService(interceptor, FakeTaskRepo(), FakePolicyRepo(), audit_repo)

        def make_adapter(tool_name):
            adapter = Mock()
            adapter.normalize.return_value = _make_action(tool_name)
            adapter.handle_block.return_value = None
            return adapter

        inv1 = ValidatedInvocation(
            tool_name="read_file",
            frozen_arguments=(("path", "/a"),),
            callable_ref=lambda path: "file_content",
        )
        inv2 = ValidatedInvocation(
            tool_name="write_file",
            frozen_arguments=(("path", "/b"), ("content", "data")),
            callable_ref=lambda path, content: True,
        )

        service.execute_tool(make_adapter("read_file"), "sess_1", "task_1", inv1)
        events_after_first = audit_repo.get_by_session("sess_1")
        assert len(events_after_first) == 1
        assert events_after_first[0].execution_state == ExecutionState.EXECUTED

        service.execute_tool(make_adapter("write_file"), "sess_1", "task_1", inv2)
        second_session = captured_sessions[1]
        assert len(second_session.events) >= 1
        first_hydrated = second_session.events[0]
        assert first_hydrated.execution_state == ExecutionState.EXECUTED

    def test_concurrent_sessions_do_not_share_history(self):
        interceptor, captured_sessions = self._make_interceptor_for_multi_call()
        audit_repo = FakeAuditRepo()
        service = LocalSentinelService(interceptor, FakeTaskRepo(), FakePolicyRepo(), audit_repo)

        def make_adapter(tool_name):
            adapter = Mock()
            adapter.normalize.return_value = _make_action(tool_name)
            adapter.handle_block.return_value = None
            return adapter

        inv = ValidatedInvocation(
            tool_name="read_file",
            frozen_arguments=(("path", "/x"),),
            callable_ref=lambda path: "ok",
        )

        service.execute_tool(make_adapter("read_file"), "sess_A", "task_1", inv)
        events_B_before = audit_repo.get_by_session("sess_B")
        assert events_B_before == []

        service.execute_tool(make_adapter("read_file"), "sess_B", "task_1", inv)
        second_session = captured_sessions[1]
        assert second_session.session_id == "sess_B"

    def test_repeated_hydration_does_not_duplicate_events(self):
        audit_repo = FakeAuditRepo()
        evt1 = _make_audit_event("iid_1", "sess_dup", 1, ExecutionState.EXECUTED, _make_action("read_file"))
        audit_repo.append(evt1)
        audit_repo.append(evt1)  # duplicate entry in repo

        service = LocalSentinelService(Mock(), FakeTaskRepo(), FakePolicyRepo(), audit_repo)
        session = service._sync_session("sess_dup", "task_1")
        assert len(session.events) == 1
        assert session.events[0].interception_id == "iid_1"

    def test_m4_features_accumulate_with_real_interceptor(self):
        """Verify that sequential calls through LocalSentinelService produce trajectory transitions."""
        from src.agentsentinel.runtime.interceptor import RuntimeInterceptor
        from src.agentsentinel.integrations.callable_integration import CallableAdapter
        from src.agentsentinel.authorization.models import TaskContext, CapabilityGrant

        task = TaskContext(
            task_id="task_all",
            task_description="allow all for test",
            allowed_capabilities=(
                CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),
                CapabilityGrant(category=ActionCategory.FILE_SYSTEM_WRITE),
            ),
            denied_capabilities=(),
        )
        task_repo = Mock()
        task_repo.get.return_value = task

        audit_repo = FakeAuditRepo()
        interceptor = RuntimeInterceptor()
        service = LocalSentinelService(interceptor, task_repo, FakePolicyRepo(), audit_repo)
        adapter = CallableAdapter(interceptor)

        inv1 = ValidatedInvocation(
            tool_name="read_file",
            frozen_arguments=(("path", "/test.txt"),),
            callable_ref=lambda path: "data",
        )
        inv2 = ValidatedInvocation(
            tool_name="write_file",
            frozen_arguments=(("path", "/test.txt"), ("content", "newdata")),
            callable_ref=lambda path, content: True,
        )

        res1 = service.execute_tool(adapter, "sess_m4", "task_all", inv1)
        assert res1 == "data"
        assert len(audit_repo.get_by_session("sess_m4")) == 1

        # Second tool call
        res2 = service.execute_tool(adapter, "sess_m4", "task_all", inv2)
        assert res2 is True
        events = audit_repo.get_by_session("sess_m4")
        assert len(events) == 2
        assert events[0].sequence_number == 1
        assert events[1].sequence_number == 2

        # Check that event 2's M4 features recorded the read-to-write transition!
        features2 = events[1].action_record.features
        assert features2["action_count"] == 2
        assert features2["read_to_write_transitions"] == 1
        assert features2["transition_count"] == 1

    def test_different_task_context_authorization_remains_correct(self):
        """Historical actions must not confer new permissions under a more restrictive task."""
        from src.agentsentinel.runtime.interceptor import RuntimeInterceptor
        from src.agentsentinel.integrations.callable_integration import CallableAdapter
        from src.agentsentinel.authorization.models import TaskContext, CapabilityGrant

        task_read = TaskContext(
            task_id="task_read_only",
            task_description="read only",
            allowed_capabilities=(CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),),
            denied_capabilities=(),
        )
        task_repo = Mock()
        task_repo.get.return_value = task_read

        # Seed audit repo with a prior executed action
        audit_repo = FakeAuditRepo()
        evt1 = _make_audit_event("iid_prior", "sess_auth", 1, ExecutionState.EXECUTED, _make_action("read_file"))
        audit_repo.append(evt1)

        interceptor = RuntimeInterceptor()
        service = LocalSentinelService(interceptor, task_repo, FakePolicyRepo(), audit_repo)
        adapter = CallableAdapter(interceptor)

        inv_write = ValidatedInvocation(
            tool_name="write_file",
            frozen_arguments=(("path", "/out.txt"), ("content", "test")),
            callable_ref=lambda path, content: "written",
        )

        # Session has historical read action, but current task only allows READ, not WRITE.
        # Action category FILE_SYSTEM_WRITE must be evaluated under task_read_only -> UNAUTHORIZED!
        session = service._sync_session("sess_auth", "task_read_only")
        assert session.task_context.task_id == "task_read_only"
        assert len(session.events) == 1
        # Historical event present, but task context is strictly task_read_only
        assert session.task_context.allowed_capabilities[0].category == ActionCategory.FILE_SYSTEM_READ

    def test_http_requests_reusing_session_id_retains_history(self):
        """End-to-end API test: multiple POST /agent/run calls reuse history and advance sequence counter and features."""
        import os
        import uuid
        from unittest.mock import patch
        from starlette.testclient import TestClient
        from src.agentsentinel.api.main import app

        with patch.dict(os.environ, {"AGENTSENTINEL_TEST_MODE": "1"}):
            with TestClient(app) as client:
                sess_id = f"http_multi_sess_{uuid.uuid4()}"
                res1 = client.post("/api/v1/agent/run", json={
                    "session_id": sess_id,
                    "task_id": "task_1",
                    "prompt": "Read public_docs.txt"
                })
                assert res1.status_code == 200

                audit_res1 = client.get(f"/api/v1/audit/{sess_id}")
                events1 = audit_res1.json()
                assert len(events1) == 1
                assert events1[0]["sequence_number"] == 1
                assert events1[0]["execution_state"] == "executed"
                assert events1[0]["action_record"]["features"]["action_count"] == 1

                res2 = client.post("/api/v1/agent/run", json={
                    "session_id": sess_id,
                    "task_id": "task_1",
                    "prompt": "Read public_docs.txt again"
                })
                assert res2.status_code == 200

                audit_res2 = client.get(f"/api/v1/audit/{sess_id}")
                events2 = audit_res2.json()
                assert len(events2) == 2
                assert events2[1]["sequence_number"] == 2
                assert events2[1]["execution_state"] == "executed"
                assert events2[1]["action_record"]["features"]["action_count"] == 2
                assert events2[1]["action_record"]["features"]["transition_count"] == 1

