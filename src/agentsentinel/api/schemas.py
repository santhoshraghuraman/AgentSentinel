"""
API Request/Response Schemas (Milestone 9).

Pydantic DTOs that define the HTTP API boundary.
These schemas ensure safe serialization and prevent accidental
exposure of internal domain objects.

Key design rules:
    - SafeActionResponse exposes only approved NormalizedAction fields.
    - InterceptResponse faithfully represents M8 results.
    - No raw_data, internal callables, or stack traces cross the HTTP boundary.
    - Governance decisions are in the response body, not HTTP status codes.
    - is_fail_safe distinguishes M8 fail-safe BLOCKs from normal governance.
"""

from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional, Tuple
from enum import Enum


# ──────────────────────────────────────────────────────────
# Request DTOs
# ──────────────────────────────────────────────────────────

class InterceptRequest(BaseModel):
    """Runtime interception request DTO."""
    session_id: str
    task_id: str
    tool_name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)


class CreateTaskRequest(BaseModel):
    """Task creation request DTO."""
    task_id: str
    task_description: Optional[str] = None
    allowed_capabilities: List[Dict[str, Any]] = Field(default_factory=list)
    denied_capabilities: List[Dict[str, Any]] = Field(default_factory=list)


class CreatePolicyRequest(BaseModel):
    """Policy creation request DTO."""
    policy_id: str
    decision: str  # "allow", "alert", "block"
    priority: int = 0
    description: str = ""
    condition: Dict[str, Any] = Field(default_factory=dict)


# ──────────────────────────────────────────────────────────
# Response DTOs — Safe Serialization
# ──────────────────────────────────────────────────────────

class SafeActionResponse(BaseModel):
    """
    Safe subset of NormalizedAction for HTTP responses.

    Exposed fields:
        normalized_name, category, provider, operation, resource,
        is_mutating, is_destructive, source_dataset

    NEVER exposed:
        raw_data, internal callables, unfiltered metadata,
        framework internals, sensitive arguments
    """
    normalized_name: str
    category: str
    provider: Optional[str] = None
    operation: Optional[str] = None
    resource: Optional[str] = None
    is_mutating: Optional[bool] = None
    is_destructive: Optional[bool] = None
    source_dataset: str = ""


class SafeGovernanceReasonResponse(BaseModel):
    """Safe subset of GovernanceReason for HTTP responses."""
    rule_type: str
    description: str
    matched_policy_id: Optional[str] = None
    policy_priority: Optional[int] = None


class SafeActionDecisionRecordResponse(BaseModel):
    """Safe subset of ActionDecisionRecord for HTTP responses."""
    decision: str
    risk_severity: Optional[str] = None
    auth_status: str = ""
    matched_policy_id: Optional[str] = None
    ml_probability: Optional[float] = None
    risk_score: Optional[float] = None
    features: Optional[Dict[str, Any]] = None
    reasons: List[SafeGovernanceReasonResponse] = Field(default_factory=list)


class InterceptResponse(BaseModel):
    """
    Runtime interception response DTO.

    HTTP status is always 200 for valid governance evaluations.
    The governance decision is in the response body.
    is_fail_safe=True means M8 produced a fail-safe BLOCK due to
    an internal pipeline failure — no fabricated records exist.
    """
    interception_id: str
    sequence_number: int
    decision: str  # "allow", "alert", "block"
    is_fail_safe: bool = False
    action: Optional[SafeActionResponse] = None
    action_record: Optional[SafeActionDecisionRecordResponse] = None
    error_message: Optional[str] = None


# ──────────────────────────────────────────────────────────
# Audit DTOs
# ──────────────────────────────────────────────────────────

class SafeAuditEventResponse(BaseModel):
    """Safe subset of AuditEvent for HTTP responses."""
    interception_id: str
    session_id: str
    task_id: str = ""
    sequence_number: int
    timestamp: str
    tool_name: str = ""
    arguments: Dict[str, Any] = Field(default_factory=dict)
    decision: str
    execution_state: str
    execution_result: Optional[str] = None
    action: Optional[SafeActionResponse] = None
    action_record: Optional[SafeActionDecisionRecordResponse] = None
    error_message: Optional[str] = None


# ──────────────────────────────────────────────────────────
# Task DTOs
# ──────────────────────────────────────────────────────────

class SafeTaskResponse(BaseModel):
    """Safe representation of a TaskContext."""
    task_id: str
    task_description: Optional[str] = None
    allowed_capability_count: int = 0
    denied_capability_count: int = 0


# ──────────────────────────────────────────────────────────
# Session DTOs
# ──────────────────────────────────────────────────────────

class SafeSessionResponse(BaseModel):
    """Safe representation of an AgentSession."""
    session_id: str
    task_id: str
    agent_id: str
    created_at: str
    status: str
    verdict_counts: Optional[Dict[str, int]] = None
    total_events: int = 0

# ──────────────────────────────────────────────────────────
# Policy DTOs
# ──────────────────────────────────────────────────────────

class SafePolicyResponse(BaseModel):
    """Safe representation of a GovernancePolicy."""
    policy_id: str
    decision: str
    priority: int
    description: str


# ──────────────────────────────────────────────────────────
# Health DTO
# ──────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    """System health response."""
    status: str = "ok"
    version: str = "0.9.0"
    milestone: str = "M9"


# ──────────────────────────────────────────────────────────
# Error DTO
# ──────────────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    """Safe error response — never exposes stack traces."""
    error: str
    detail: Optional[str] = None


# ──────────────────────────────────────────────────────────
# Diagnostics DTO
# ──────────────────────────────────────────────────────────

class DiagnosticHealthInfo(BaseModel):
    status: str
    version: str
    milestone: str

class DiagnosticDatabaseInfo(BaseModel):
    type: str
    status: str

class DiagnosticLLMInfo(BaseModel):
    provider: str
    model: str
    host: str
    status: str

class DiagnosticGovernanceInfo(BaseModel):
    active_policies: int
    fail_safe_enabled: bool

class SystemDiagnosticsResponse(BaseModel):
    """Safe system configuration and health summary."""
    health: DiagnosticHealthInfo
    database: DiagnosticDatabaseInfo
    llm: DiagnosticLLMInfo
    governance: DiagnosticGovernanceInfo
