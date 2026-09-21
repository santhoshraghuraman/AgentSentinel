"""
Tests for Audit API (Milestone 9).
"""

from fastapi.testclient import TestClient

from src.agentsentinel.api.main import app

client = TestClient(app)


def test_audit_retrieval():
    session_id = "audit_test_session"
    
    # 0. Seed task
    client.post("/api/v1/tasks", json={
        "task_id": "test_task",
        "allowed_capabilities": [{"category": "file_system_read"}],
        "denied_capabilities": []
    })
    
    # 1. First trigger an interception to generate audit
    client.post("/api/v1/runtime/intercept", json={
        "session_id": session_id,
        "task_id": "test_task",
        "tool_name": "read_file",
        "arguments": {"file": "test.txt"}
    })
    
    # 2. Retrieve audit
    response = client.get(f"/api/v1/audit/{session_id}")
    assert response.status_code == 200
    
    data = response.json()
    assert len(data) >= 1
    
    audit_event = data[0]
    assert audit_event["session_id"] == session_id
    assert audit_event["sequence_number"] == 1
    assert "interception_id" in audit_event
    
    # Ensure safe action response
    assert audit_event["action"]["normalized_name"] == "read_file"
    assert "raw_data" not in audit_event["action"]
    assert "error_message" in audit_event

def test_metrics_timeseries():
    import time
    
    # 0. Seed task
    client.post("/api/v1/tasks", json={
        "task_id": "test_task",
        "allowed_capabilities": [{"category": "file_system_read"}],
        "denied_capabilities": []
    })
    
    client.post("/api/v1/runtime/intercept", json={
        "session_id": "ts_session",
        "task_id": "test_task",
        "tool_name": "read_file",
        "arguments": {"file": "ts.txt"}
    })
    
    # 3. Retrieve timeseries
    now = int(time.time() * 1000)
    response = client.get(f"/api/v1/metrics/timeseries?since={now - 60000}&bucket_size=10")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        bucket = data[-1]
        assert "time" in bucket
        assert "allow" in bucket
        assert "alert" in bucket
        assert "block" in bucket
        assert bucket["allow"] >= 0
