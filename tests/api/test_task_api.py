"""
Tests for Task and Policy API (Milestone 9).
"""

from fastapi.testclient import TestClient

from src.agentsentinel.api.main import app

client = TestClient(app)


def test_task_creation_and_retrieval():
    # Create task
    response = client.post("/api/v1/tasks", json={
        "task_id": "test_creation_task",
        "task_description": "A new task",
        "allowed_capabilities": [
            {
                "category": "file_system_write",
                "allowed_operations": ["write"],
                "resource_scope": {"match_mode": "exact", "value": "file.txt"}
            }
        ],
        "denied_capabilities": []
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == "test_creation_task"
    assert data["allowed_capability_count"] == 1
    
    # Retrieve tasks
    response = client.get("/api/v1/tasks")
    assert response.status_code == 200
    tasks = response.json()
    assert any(t["task_id"] == "test_creation_task" for t in tasks)


def test_policy_creation_and_retrieval():
    # Create policy
    response = client.post("/api/v1/policies", json={
        "policy_id": "test_creation_policy",
        "decision": "alert",
        "condition": {"operations": ["delete"]},
        "priority": 10,
        "description": "Alert on delete"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["policy_id"] == "test_creation_policy"
    assert data["decision"] == "alert"
    
    # Retrieve policies
    response = client.get("/api/v1/policies")
    assert response.status_code == 200
    policies = response.json()
    assert any(p["policy_id"] == "test_creation_policy" for p in policies)
