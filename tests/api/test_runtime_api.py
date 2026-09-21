"""
Tests for Runtime Interception API (Milestone 9).
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from src.agentsentinel.api.main import app
from src.agentsentinel.api.dependencies import get_task_service, get_policy_service, _interceptor
from src.agentsentinel.runtime.state import RuntimeSession
from src.agentsentinel.governance.models import GovernanceDecision

client = TestClient(app, raise_server_exceptions=False)


def setup_module():
    """Setup dependencies for tests."""
    task_service = get_task_service()
    # Seed a task
    client.post("/api/v1/tasks", json={
        "task_id": "test_task",
        "allowed_capabilities": [{"category": "file_system_read"}],
        "denied_capabilities": []
    })
    
    # Seed a policy
    client.post("/api/v1/policies", json={
        "policy_id": "test_policy",
        "decision": "allow",
        "condition": {"categories": ["file_system_read"]},
        "priority": 1,
        "description": "Allow read"
    })


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_invalid_dto_returns_422():
    # Missing task_id
    response = client.post("/api/v1/runtime/intercept", json={
        "session_id": "session1",
        "tool_name": "read_file"
    })
    assert response.status_code == 422
    assert response.json()["error"] == "Unprocessable Entity"


def test_unknown_task_returns_400():
    response = client.post("/api/v1/runtime/intercept", json={
        "session_id": "session1",
        "task_id": "unknown_task",
        "tool_name": "read_file"
    })
    assert response.status_code == 400
    assert "Unknown task_id" in response.json()["detail"]


def test_normalization_failure_fail_safe_block():
    response = client.post("/api/v1/runtime/intercept", json={
        "session_id": "session1",
        "task_id": "test_task",
        "tool_name": "   ",  # Blank tool name fails normalization in ApiFrameworkAdapter
        "arguments": {}
    })
    assert response.status_code == 200
    data = response.json()
    assert data["decision"] == "block"
    assert data["is_fail_safe"] is True
    assert data["action"] is None
    assert data["action_record"] is None
    assert "Normalization failure" in data["error_message"]


def test_valid_allow_response():
    response = client.post("/api/v1/runtime/intercept", json={
        "session_id": "session2",
        "task_id": "test_task",
        "tool_name": "read_file",
        "arguments": {"file": "test.txt"}
    })
    assert response.status_code == 200
    data = response.json()
    assert data["decision"] == "allow"
    assert data["is_fail_safe"] is False
    assert data["action"]["normalized_name"] == "read_file"
    assert data["action"]["category"] == "file_system_read"
    assert "raw_data" not in data["action"]
    assert data["action_record"] is not None
    assert data["action_record"]["decision"] == "allow"


def test_valid_block_response():
    # Write is not allowed in test_task
    response = client.post("/api/v1/runtime/intercept", json={
        "session_id": "session3",
        "task_id": "test_task",
        "tool_name": "write_file",
        "arguments": {"file": "test.txt"}
    })
    assert response.status_code == 200
    data = response.json()
    assert data["decision"] in ["block", "alert"]
    assert data["is_fail_safe"] is False
    assert data["action"]["category"] == "file_system_write"
    assert data["action_record"]["decision"] in ["block", "alert"]


def test_pipeline_failure_returns_fail_safe_block():
    # Force a failure inside M5 by patching the risk engine evaluating
    with patch.object(_interceptor._risk_engine, 'evaluate', side_effect=Exception("Fake risk engine crash")):
        response = client.post("/api/v1/runtime/intercept", json={
            "session_id": "session_fail",
            "task_id": "test_task",
            "tool_name": "read_file",
            "arguments": {}
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["decision"] == "block"
        assert data["is_fail_safe"] is True
        assert data["action"] is not None  # Normalization succeeded
        assert data["action_record"] is None  # Never fabricated
        assert "Pipeline failure" in data["error_message"]
        assert "Fake risk engine crash" in data["error_message"]


def test_infrastructure_failure_before_m8_returns_500():
    # Force a failure in the service layer before interceptor is called
    with patch('src.agentsentinel.repositories.sql.SQLTaskRepository.get', side_effect=Exception("Database timeout")):
        response = client.post("/api/v1/runtime/intercept", json={
            "session_id": "session4",
            "task_id": "test_task",
            "tool_name": "read_file"
        })
        
        assert response.status_code == 500
        data = response.json()
        assert data["error"] == "Internal Server Error"
        assert "Redis timeout" not in data["detail"]  # Do not leak internal errors
