"""
Tests for Research & Reports API Endpoints (Milestones 11-14).
"""

import pytest
from fastapi.testclient import TestClient

from src.agentsentinel.api.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_research_evaluation_endpoint():
    response = client.get("/api/v1/research/evaluation")
    assert response.status_code == 200
    data = response.json()
    assert "accuracy" in data
    assert "precision" in data
    assert "recall" in data
    assert "f1_score" in data
    assert "confusion_matrix" in data
    assert "total_dataset_records" in data
    assert data["total_dataset_records"] == 1000


def test_research_datasets_endpoint():
    response = client.get("/api/v1/research/datasets")
    assert response.status_code == 200
    datasets = response.json()
    assert isinstance(datasets, list)
    assert len(datasets) >= 2
    ids = [d["id"] for d in datasets]
    assert "atbench_test" in ids
    assert "syfi_coding_trace" in ids


def test_compliance_report_endpoint():
    response = client.get("/api/v1/reports/compliance")
    assert response.status_code == 200
    data = response.json()
    assert "posture" in data
    assert "governance" in data
    assert "compliance_status" in data


def test_report_export_csv():
    response = client.get("/api/v1/reports/export?format=csv")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "interception_id" in response.text


def test_report_export_json():
    response = client.get("/api/v1/reports/export?format=json")
    assert response.status_code == 200
    assert response.json()["platform"] == "AgentSentinel Enterprise AI Governance"
