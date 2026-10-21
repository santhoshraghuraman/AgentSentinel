"""
Regression tests for Timestamp, Timezone Conversion, and Dashboard Time-Filter boundaries.

Covers:
1. Timezone conversion and UTC ISO serialization with 'Z' suffix.
2. Recent-event filtering and UTC vs local time boundary correctness.
3. All four dashboard filter windows: Live (5m), 15-minute (15m), 1-hour (1h), and 24-hour (24h).
4. Zero-filled time-series bucket generation and UTC consistency.
"""

import time
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.agentsentinel.api.main import app
from src.agentsentinel.api.router import _parse_since_param
from src.agentsentinel.services.audit_service import AuditService
from src.agentsentinel.services.session_service import SessionService
from src.agentsentinel.repositories.sql import SQLAuditRepository, SQLSessionRepository
from src.agentsentinel.db.models import Base, AuditEventModel, AgentSessionModel

client = TestClient(app)


def test_parse_since_param_utc_conversion():
    """Verify that epoch milliseconds are parsed into UTC naive datetimes."""
    # Current epoch
    now_ts = 1760444328.0  # arbitrary epoch seconds
    now_ms = now_ts * 1000.0
    
    parsed = _parse_since_param(now_ms)
    assert parsed is not None
    assert parsed.tzinfo is None  # Naive for SQLite compatibility
    
    # Check that it matches exact UTC representation
    expected_utc = datetime.fromtimestamp(now_ts, tz=timezone.utc).replace(tzinfo=None)
    assert parsed == expected_utc
    assert _parse_since_param(None) is None


def test_audit_to_response_utc_z_suffix():
    """Verify that AuditService._to_response serializes naive and aware datetimes with Z."""
    class MockRecord:
        decision = "ALLOW"
        risk_severity = None
        auth_status = "AUTHORIZED"
        matched_policy = None
        reasons = []

    class MockEvent:
        interception_id = "test-int-001"
        session_id = "test-sess-001"
        task_id = "test-task-001"
        sequence_number = 1
        timestamp = datetime(2026, 10, 14, 12, 5, 37, 123456)  # naive UTC
        tool_name = "calculator"
        arguments = {}
        class decision:
            value = "ALLOW"
        class execution_state:
            value = "EXECUTED"
        execution_result = "42"
        action = None
        action_record = None
        error_message = None

    response = AuditService._to_response(MockEvent)
    assert response.timestamp == "2026-10-14T12:05:37.123456Z"

    # With timezone-aware datetime
    MockEvent.timestamp = datetime(2026, 10, 14, 12, 5, 37, 123456, tzinfo=timezone.utc)
    response_aware = AuditService._to_response(MockEvent)
    assert response_aware.timestamp == "2026-10-14T12:05:37.123456Z"


def test_session_service_created_at_utc_z():
    """Verify that session created_at is serialized with Z suffix."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db_session = Session()

    repo = SQLSessionRepository(db_session)
    service = SessionService(session_repo=repo)

    sess = service.create_session("sess_tz_1", "task_tz_1")
    assert sess.created_at.endswith("Z")

    retrieved = service.get_session("sess_tz_1")
    assert retrieved is not None
    assert retrieved.created_at.endswith("Z")
    db_session.close()


def test_dashboard_all_four_filter_windows():
    """
    Test all four dashboard filter windows (Live, 15m, 1h, 24h).
    Ensures that an event created now is visible across all windows.
    """
    session_id = f"test_filter_{int(time.time())}"
    task_id = f"task_{session_id}"

    # Seed task
    task_res = client.post("/api/v1/tasks", json={
        "task_id": task_id,
        "allowed_capabilities": [{"category": "file_system_read"}],
        "denied_capabilities": []
    })
    assert task_res.status_code == 200

    # Intercept tool call to create an event at current time
    intercept_res = client.post("/api/v1/runtime/intercept", json={
        "session_id": session_id,
        "task_id": task_id,
        "tool_name": "read_file",
        "arguments": {"file": "sample.txt"}
    })
    assert intercept_res.status_code == 200

    now_ms = int(time.time() * 1000)

    # 1. Live Filter (5-minute window, bucket_size=10s)
    since_live = now_ms - (5 * 60 * 1000)
    res_live = client.get(f"/api/v1/metrics/timeseries?since={since_live}&bucket_size=10")
    assert res_live.status_code == 200
    data_live = res_live.json()
    assert len(data_live) > 0
    total_live_events = sum(b["allow"] + b["alert"] + b["block"] for b in data_live)
    assert total_live_events >= 1
    # Check that all buckets have UTC Z formatting
    assert all(b["time"].endswith("Z") for b in data_live)

    # Also check /api/v1/audit?since=
    audit_live = client.get(f"/api/v1/audit?since={since_live}").json()
    assert any(e["session_id"] == session_id for e in audit_live)

    # 2. 15-minute Filter (15m window, bucket_size=60s)
    since_15m = now_ms - (15 * 60 * 1000)
    res_15m = client.get(f"/api/v1/metrics/timeseries?since={since_15m}&bucket_size=60")
    assert res_15m.status_code == 200
    data_15m = res_15m.json()
    assert len(data_15m) > 0
    total_15m_events = sum(b["allow"] + b["alert"] + b["block"] for b in data_15m)
    assert total_15m_events >= 1

    audit_15m = client.get(f"/api/v1/audit?since={since_15m}").json()
    assert any(e["session_id"] == session_id for e in audit_15m)

    # 3. 1-hour Filter (1h window, bucket_size=300s)
    since_1h = now_ms - (60 * 60 * 1000)
    res_1h = client.get(f"/api/v1/metrics/timeseries?since={since_1h}&bucket_size=300")
    assert res_1h.status_code == 200
    data_1h = res_1h.json()
    assert len(data_1h) > 0
    total_1h_events = sum(b["allow"] + b["alert"] + b["block"] for b in data_1h)
    assert total_1h_events >= 1

    audit_1h = client.get(f"/api/v1/audit?since={since_1h}").json()
    assert any(e["session_id"] == session_id for e in audit_1h)

    # 4. 24-hour Filter (24h window, bucket_size=1800s)
    since_24h = now_ms - (24 * 60 * 60 * 1000)
    res_24h = client.get(f"/api/v1/metrics/timeseries?since={since_24h}&bucket_size=1800")
    assert res_24h.status_code == 200
    data_24h = res_24h.json()
    assert len(data_24h) > 0
    total_24h_events = sum(b["allow"] + b["alert"] + b["block"] for b in data_24h)
    assert total_24h_events >= 1

    audit_24h = client.get(f"/api/v1/audit?since={since_24h}").json()
    assert any(e["session_id"] == session_id for e in audit_24h)


def test_timeseries_bucketing_utc_consistency():
    """Verify timeseries bucketing logic with explicit timestamps."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db_session = Session()

    repo = SQLAuditRepository(db_session)
    service = AuditService(repo)

    # Insert events at specific UTC times
    base_utc = datetime(2026, 10, 14, 12, 0, 0)
    for i, dec in enumerate(["ALLOW", "ALERT", "BLOCK"]):
        model = AuditEventModel(
            interception_id=f"int-{i}",
            session_id=f"sess-{i}",
            sequence_number=i + 1,
            timestamp=base_utc + timedelta(seconds=i * 30),
            decision=dec,
            execution_state="EXECUTED",
        )
        db_session.add(model)
    db_session.commit()

    # Query with since as base_utc
    ts = service.get_timeseries(since=base_utc, bucket_seconds=60)
    assert len(ts) >= 1
    # Check that events within the first minute are counted
    first_bucket = ts[0]
    assert first_bucket["time"].endswith("Z")
    assert first_bucket["allow"] == 1
    assert first_bucket["alert"] == 1
    db_session.close()


def test_runtime_event_default_timestamp_is_utc_aware():
    """Verify that RuntimeEvent default timestamp is timezone-aware UTC."""
    from src.agentsentinel.runtime.state import RuntimeEvent, ExecutionState
    from src.agentsentinel.models.normalized import NormalizedEvent, EventRole

    evt = NormalizedEvent(
        id="evt_test",
        timestamp=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        role=EventRole.TOOL_CALL,
        normalized_actions=[]
    )
    re = RuntimeEvent(
        sequence_number=1,
        normalized_event=evt,
        execution_state=ExecutionState.ATTEMPTED,
        interception_id="int_test"
    )
    assert re.timestamp is not None
    assert re.timestamp.tzinfo is not None
    assert re.timestamp.tzinfo == timezone.utc


def test_sql_repository_boundary_converts_aware_to_naive_utc():
    """Verify SQLite persistence boundary explicitly normalizes aware timestamps to naive UTC."""
    from src.agentsentinel.runtime.audit import AuditEvent
    from src.agentsentinel.governance.models import GovernanceDecision
    from src.agentsentinel.runtime.state import ExecutionState

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db_session = Session()

    repo = SQLAuditRepository(db_session)
    aware_now = datetime.now(timezone.utc)

    event = AuditEvent(
        interception_id="int_aware_1",
        session_id="sess_aware",
        sequence_number=1,
        timestamp=aware_now,
        action=None,
        decision=GovernanceDecision.ALLOW,
        action_record=None,
        execution_state=ExecutionState.EXECUTED,
    )
    repo.append(event)

    # Verify model in DB has naive UTC timestamp for SQLite consistency
    raw_model = db_session.query(AuditEventModel).filter_by(interception_id="int_aware_1").first()
    assert raw_model is not None
    assert raw_model.timestamp.tzinfo is None
    # Value should match the aware timestamp's UTC values
    assert raw_model.timestamp.year == aware_now.year
    assert raw_model.timestamp.hour == aware_now.hour
    assert raw_model.timestamp.minute == aware_now.minute

    # Verify querying with timezone-aware `since` works seamlessly
    query_aware_since = aware_now - timedelta(minutes=5)
    results_aware = repo.get_all(since=query_aware_since)
    assert len(results_aware) == 1

    # Verify querying with naive `since` also works
    query_naive_since = query_aware_since.replace(tzinfo=None)
    results_naive = repo.get_all(since=query_naive_since)
    assert len(results_naive) == 1
    db_session.close()


def test_in_memory_repository_handles_mixed_aware_and_naive():
    """Verify InMemoryAuditRepository handles mixed aware/naive timestamps without TypeError."""
    from src.agentsentinel.repositories.memory import InMemoryAuditRepository
    from src.agentsentinel.runtime.audit import AuditEvent
    from src.agentsentinel.governance.models import GovernanceDecision
    from src.agentsentinel.runtime.state import ExecutionState

    repo = InMemoryAuditRepository()

    # Event 1: timezone-aware UTC
    t_aware = datetime.now(timezone.utc)
    event1 = AuditEvent(
        interception_id="mem_1",
        session_id="sess_mem",
        sequence_number=1,
        timestamp=t_aware,
        action=None,
        decision=GovernanceDecision.ALLOW,
        action_record=None,
        execution_state=ExecutionState.EXECUTED,
    )
    # Event 2: naive UTC
    t_naive = (t_aware + timedelta(seconds=10)).replace(tzinfo=None)
    event2 = AuditEvent(
        interception_id="mem_2",
        session_id="sess_mem",
        sequence_number=2,
        timestamp=t_naive,
        action=None,
        decision=GovernanceDecision.BLOCK,
        action_record=None,
        execution_state=ExecutionState.BLOCKED,
    )

    repo.append(event1)
    repo.append(event2)

    # Query with aware since
    since_aware = t_aware - timedelta(minutes=1)
    res_aware = repo.get_all(since=since_aware)
    assert len(res_aware) == 2

    # Query with naive since
    since_naive = since_aware.replace(tzinfo=None)
    res_naive = repo.get_all(since=since_naive)
    assert len(res_naive) == 2

    # Query metrics with aware and naive
    metrics_aware = repo.get_metrics(since=since_aware)
    assert metrics_aware["total_interceptions"] == 2
    metrics_naive = repo.get_metrics(since=since_naive)
    assert metrics_naive["total_interceptions"] == 2


def test_behavioral_sequence_mixed_aware_and_naive_timestamp_delta():
    """Verify BehavioralSequence handles mixed aware and naive timestamp strings without crashing."""
    from src.agentsentinel.models.normalized import NormalizedAction, NormalizedEvent, NormalizedTrajectory, ActionCategory
    from src.agentsentinel.models.trajectory import EventRole
    from src.agentsentinel.representations.behavioral_sequence import BehavioralSequence

    a1 = NormalizedAction(
        normalized_name="action1",
        category=ActionCategory.FILE_SYSTEM_READ,
        original_tool_name="tool1",
        source_dataset="test",
    )
    a2 = NormalizedAction(
        normalized_name="action2",
        category=ActionCategory.FILE_SYSTEM_WRITE,
        original_tool_name="tool2",
        source_dataset="test",
    )

    # e1 has no trailing Z (naive ISO string)
    e1 = NormalizedEvent(
        id="e1",
        timestamp="2026-10-17T12:00:00",
        role=EventRole.TOOL_CALL,
        normalized_actions=[a1],
    )
    # e2 has trailing Z (aware ISO string) 15 seconds later
    e2 = NormalizedEvent(
        id="e2",
        timestamp="2026-10-17T12:00:15Z",
        role=EventRole.TOOL_CALL,
        normalized_actions=[a2],
    )

    traj = NormalizedTrajectory(
        trajectory_id="traj_mixed",
        source_dataset="test",
        events=[e1, e2],
    )
    seq = BehavioralSequence(traj)
    transitions = list(seq.iter_timed_transitions())
    assert len(transitions) == 1
    _, _, delta = transitions[0]
    assert delta == 15.0

