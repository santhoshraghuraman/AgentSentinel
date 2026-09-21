"""
API Routes (Milestone 9).

FastAPI routers exposing the AgentSentinel M8 RuntimeInterceptor.
No governance logic exists here. All governance is delegated to
the Service Layer and M8.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException

from src.agentsentinel.api.schemas import (
    CreatePolicyRequest,
    CreateTaskRequest,
    InterceptRequest,
    InterceptResponse,
    SafeAuditEventResponse,
    SafePolicyResponse,
    SafeTaskResponse,
)
from src.agentsentinel.services.audit_service import AuditService
from src.agentsentinel.services.policy_service import PolicyService
from src.agentsentinel.services.runtime_service import RuntimeService
from src.agentsentinel.services.task_service import TaskService
from src.agentsentinel.api.dependencies import (
    get_audit_service,
    get_policy_service,
    get_runtime_service,
    get_task_service,
)


router = APIRouter()


# ──────────────────────────────────────────────────────────
# Runtime Interception
# ──────────────────────────────────────────────────────────

@router.post("/runtime/intercept", response_model=InterceptResponse)
def intercept_tool_call(
    request: InterceptRequest,
    runtime_service: RuntimeService = Depends(get_runtime_service),
) -> InterceptResponse:
    """
    Evaluate a tool call through the AgentSentinel M8 governance pipeline.

    Returns HTTP 200 with the governance decision in the response body.
    If M8 triggers a fail-safe BLOCK (e.g. M5/M6/M7 internal error),
    this also returns HTTP 200 with `is_fail_safe=True`.
    """
    try:
        return runtime_service.intercept(request)
    except ValueError as e:
        # e.g., Unknown task_id
        raise HTTPException(status_code=400, detail=str(e))


# ──────────────────────────────────────────────────────────
# Audit Logs
# ──────────────────────────────────────────────────────────

from typing import List, Optional
from datetime import datetime

@router.get("/audit", response_model=List[SafeAuditEventResponse])
def get_all_audit_logs(
    since: Optional[float] = None,
    audit_service: AuditService = Depends(get_audit_service),
) -> List[SafeAuditEventResponse]:
    """Retrieve all safe audit events in descending order."""
    since_dt = datetime.fromtimestamp(since / 1000.0) if since else None
    return audit_service.get_all(since=since_dt)[::-1]

@router.get("/audit/{session_id}", response_model=List[SafeAuditEventResponse])
def get_audit_logs(
    session_id: str,
    audit_service: AuditService = Depends(get_audit_service),
) -> List[SafeAuditEventResponse]:
    """Retrieve safe audit events for a session."""
    return audit_service.get_by_session(session_id)

@router.get("/events/live", response_model=List[SafeAuditEventResponse])
def get_live_events(
    limit: int = 20,
    audit_service: AuditService = Depends(get_audit_service),
):
    """Retrieve the latest N events for short-polling live monitor."""
    return audit_service.get_recent(limit)[::-1]


# ──────────────────────────────────────────────────────────
# Tasks
# ──────────────────────────────────────────────────────────

@router.post("/tasks", response_model=SafeTaskResponse)
def create_task(
    request: CreateTaskRequest,
    task_service: TaskService = Depends(get_task_service),
) -> SafeTaskResponse:
    """Seed a TaskContext into the in-memory repository."""
    task_context = task_service.create_task(request)
    return task_service.get_task(task_context.task_id)


@router.get("/tasks", response_model=List[SafeTaskResponse])
def list_tasks(
    task_service: TaskService = Depends(get_task_service),
) -> List[SafeTaskResponse]:
    """List all seeded tasks safely."""
    return task_service.list_tasks()


# ──────────────────────────────────────────────────────────
# Policies
# ──────────────────────────────────────────────────────────

@router.post("/policies", response_model=SafePolicyResponse)
def create_policy(
    request: CreatePolicyRequest,
    policy_service: PolicyService = Depends(get_policy_service),
) -> SafePolicyResponse:
    """Create a GovernancePolicy in the in-memory repository."""
    policy = policy_service.create_policy(request)
    return SafePolicyResponse(
        policy_id=policy.policy_id,
        decision=policy.decision.value,
        priority=policy.priority,
        description=policy.description,
    )


@router.get("/policies", response_model=List[SafePolicyResponse])
def list_policies(
    policy_service: PolicyService = Depends(get_policy_service),
) -> List[SafePolicyResponse]:
    """List all active policies safely."""
    return policy_service.list_policies()


# ──────────────────────────────────────────────────────────
# Sessions
# ──────────────────────────────────────────────────────────
from src.agentsentinel.services.session_service import SessionService
from src.agentsentinel.api.dependencies import get_session_service
from src.agentsentinel.api.schemas import SafeSessionResponse
from pydantic import BaseModel

class CreateSessionRequest(BaseModel):
    session_id: str
    task_id: str
    agent_id: str = "default"

@router.post("/sessions", response_model=SafeSessionResponse)
def create_session(
    request: CreateSessionRequest,
    session_service: SessionService = Depends(get_session_service),
) -> SafeSessionResponse:
    """Create a new agent session."""
    return session_service.create_session(request.session_id, request.task_id, request.agent_id)

@router.get("/sessions", response_model=List[SafeSessionResponse])
def list_sessions(
    session_service: SessionService = Depends(get_session_service),
) -> List[SafeSessionResponse]:
    """List all agent sessions."""
    return session_service.list_sessions()


# ──────────────────────────────────────────────────────────
# Agent Runner
# ──────────────────────────────────────────────────────────
from src.agentsentinel.llm.agent import AgentRunner
from src.agentsentinel.llm.provider import get_llm_provider
from src.agentsentinel.llm.tools import ToolRegistry
from src.agentsentinel.integrations.service import LocalSentinelService
from src.agentsentinel.api.dependencies import get_task_repo, get_policy_repo, get_audit_repo
from src.agentsentinel.api.dependencies import _interceptor

class AgentRunRequest(BaseModel):
    session_id: str
    task_id: str
    prompt: str

@router.post("/agent/run")
def run_agent(
    request: AgentRunRequest,
    task_repo = Depends(get_task_repo),
    policy_repo = Depends(get_policy_repo),
    audit_repo = Depends(get_audit_repo),
    session_service: SessionService = Depends(get_session_service)
):
    """Run an LLM agent that goes through AgentSentinel governance."""
    # Ensure session exists
    if not session_service.get_session(request.session_id):
        session_service.create_session(request.session_id, request.task_id)

    service = LocalSentinelService(
        interceptor=_interceptor,
        task_repo=task_repo,
        policy_repo=policy_repo,
        audit_repo=audit_repo
    )
    
    # Initialize workspace for tool registry
    registry = ToolRegistry(workspace_dir="./sandbox")
    
    runner = AgentRunner(
        provider=get_llm_provider(),
        registry=registry,
        service=service,
        session_id=request.session_id,
        task_id=request.task_id
    )
    
    try:
        result = runner.run(request.prompt)
        session_service.update_status(request.session_id, "completed")
        return result
    except Exception as e:
        session_service.update_status(request.session_id, "failed")
        raise e

# ──────────────────────────────────────────────────────────
# System Health & Metrics
# ──────────────────────────────────────────────────────────
from src.agentsentinel.api.schemas import HealthResponse

@router.get("/metrics")
def get_metrics(
    since: Optional[float] = None,
    audit_service: AuditService = Depends(get_audit_service)
):
    since_dt = datetime.fromtimestamp(since / 1000.0) if since else None
    return audit_service.get_metrics(since=since_dt)

@router.get("/metrics/timeseries")
def get_timeseries(
    since: Optional[float] = None,
    bucket_size: int = 60,
    audit_service: AuditService = Depends(get_audit_service)
):
    since_dt = datetime.fromtimestamp(since / 1000.0) if since else None
    return audit_service.get_timeseries(since=since_dt, bucket_seconds=bucket_size)

@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse()

from src.agentsentinel.api.schemas import SystemDiagnosticsResponse

@router.get("/system/diagnostics", response_model=SystemDiagnosticsResponse)
def get_system_diagnostics(
    policy_service: PolicyService = Depends(get_policy_service),
) -> SystemDiagnosticsResponse:
    import os
    from src.agentsentinel.llm.provider import OllamaProvider
    
    health = {
        "status": "HEALTHY",
        "version": "0.9.0",
        "milestone": "M9"
    }

    provider_name = "Development" if os.environ.get("AGENTSENTINEL_TEST_MODE") == "1" else "Ollama"
    llm_model = os.environ.get("OLLAMA_MODEL", "qwen3:4b")
    llm_host = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")
    
    if os.environ.get("LLM_API_KEY") and not os.environ.get("OLLAMA_HOST") and provider_name != "Development":
        provider_name = "OpenAI Compatible"
        llm_model = os.environ.get("LLM_MODEL", "gpt-4o")
        llm_host = os.environ.get("LLM_BASE_URL", "default")
    
    ollama_status = "UNKNOWN"
    if provider_name == "Ollama":
        try:
            provider = OllamaProvider(host=llm_host, model=llm_model)
            ollama_status = provider.check_availability()
        except Exception:
            ollama_status = "OLLAMA_UNAVAILABLE"
    elif provider_name == "Development":
        ollama_status = "MOCK_ACTIVE"
    else:
        ollama_status = "REMOTE_CONFIGURED"

    policies = policy_service.list_policies()

    return SystemDiagnosticsResponse(
        health=health,
        database={
            "type": "SQLite",
            "status": "HEALTHY"
        },
        llm={
            "provider": provider_name,
            "model": llm_model,
            "host": llm_host,
            "status": ollama_status
        },
        governance={
            "active_policies": len(policies),
            "fail_safe_enabled": True
        }
    )


# ──────────────────────────────────────────────────────────
# Research & Evaluation
# ──────────────────────────────────────────────────────────
import json

@router.get("/research/evaluation")
def get_research_evaluation():
    """Retrieve empirical evaluation metrics from the trained research baseline."""
    try:
        with open("datasets/evaluation_metrics.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        from src.agentsentinel.research.model import train_and_evaluate
        return train_and_evaluate()

@router.post("/research/train")
def train_research_model(model_type: str = "random_forest"):
    """Trigger a reproducible research model training run on ATBench features."""
    from src.agentsentinel.research.model import train_and_evaluate
    return train_and_evaluate(model_type=model_type)

@router.get("/research/datasets")
def list_research_datasets():
    """List verified metadata for ATBench and SyFi datasets."""
    from src.agentsentinel.research.datasets import get_dataset_metadata
    return get_dataset_metadata()


# ──────────────────────────────────────────────────────────
# Reports Engine
# ──────────────────────────────────────────────────────────
from fastapi.responses import PlainTextResponse, JSONResponse

@router.get("/reports/compliance")
def get_compliance_report(
    audit_service: AuditService = Depends(get_audit_service),
    policy_service: PolicyService = Depends(get_policy_service),
    session_service: SessionService = Depends(get_session_service),
):
    """Generate live compliance & security posture summary."""
    from src.agentsentinel.research.reports import generate_compliance_summary
    return generate_compliance_summary(audit_service, policy_service, session_service)

@router.get("/reports/export")
def export_report_data(
    format: str = "json",
    audit_service: AuditService = Depends(get_audit_service),
    policy_service: PolicyService = Depends(get_policy_service),
    session_service: SessionService = Depends(get_session_service),
):
    """Export audit events as CSV or compliance report as JSON."""
    from src.agentsentinel.research.reports import export_audit_csv, generate_compliance_summary
    if format == "csv":
        csv_data = export_audit_csv(audit_service)
        return PlainTextResponse(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=agentsentinel_audit_export.csv"}
        )
    else:
        summary = generate_compliance_summary(audit_service, policy_service, session_service)
        return JSONResponse(
            content=summary,
            headers={"Content-Disposition": "attachment; filename=agentsentinel_compliance_report.json"}
        )

