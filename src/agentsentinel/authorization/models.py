"""
Task-Context Authorization — Models (Milestone 6).

Defines the data contracts for task-context authorization assessment.
These models represent the AUTHORIZATION layer that determines whether
observed actions are permitted by the declared task context.

Separation of concerns:
    Observation      (M1–M4) -> TrajectoryFeatures
    Interpretation   (M5)    -> RiskAssessment
    Authorization    (M6)    -> TrajectoryAuthorizationAssessment
    Decision         (M7+)   -> ALLOW / ALERT / BLOCK

Key design principles:
    - Authorization is distinct from risk severity.
    - High risk != unauthorized. Low risk != authorized.
    - UNKNOWN != SAFE: unknown operations/categories cannot satisfy authorization.
    - Explicit deny overrides explicit allow. Default is deny.
    - M6-owned structures are frozen and tuple-based.
    - M6 never mutates externally supplied NormalizedAction or TaskContext.
    - NormalizedAction is an M2 external dependency, NOT an M6 frozen dataclass.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional, Tuple

from src.agentsentinel.models.normalized import ActionCategory, NormalizedAction


# ──────────────────────────────────────────────────────────
# Resource Matching
# ──────────────────────────────────────────────────────────

class ResourceMatchMode(Enum):
    """How a resource scope value is compared against an action resource."""
    EXACT = "exact"
    PREFIX = "prefix"
    PATTERN = "pattern"


@dataclass(frozen=True)
class ResourceScope:
    """
    Defines where an action may operate.

    match_mode:
        EXACT   — canonicalize both, compare exact strings.
        PREFIX  — canonicalize both, path-component-aware prefix match.
        PATTERN — canonicalize action resource, preserve scope as glob, fnmatch.
    value:
        The scope value (exact path, prefix, or glob pattern).
    """
    match_mode: ResourceMatchMode
    value: str


# ──────────────────────────────────────────────────────────
# Capability Model
# ──────────────────────────────────────────────────────────

@dataclass(frozen=True)
class CapabilityGrant:
    """
    Declares what category/operations/resources are permitted.

    allowed_operations=None means any KNOWN operation in the category.
    An unknown operation (None) never satisfies any grant.

    resource_scope=None means unrestricted within the category.
    """
    category: ActionCategory
    allowed_operations: Optional[Tuple[str, ...]] = None
    resource_scope: Optional[ResourceScope] = None


@dataclass(frozen=True)
class CapabilityDeny:
    """
    Declares an explicit denial that overrides any matching grant.

    denied_operations=None means deny ALL operations (including unknown).
    resource_scope=None means deny across ALL resources.
    """
    category: ActionCategory
    denied_operations: Optional[Tuple[str, ...]] = None
    resource_scope: Optional[ResourceScope] = None


# ──────────────────────────────────────────────────────────
# Task Context
# ──────────────────────────────────────────────────────────

@dataclass(frozen=True)
class TaskContext:
    """
    Declares what an agent is permitted to do for a specific task.

    Immutable contract between the task owner and the authorization engine.
    Uses tuples (not lists) for structural immutability.
    """
    task_id: str
    task_description: Optional[str]
    allowed_capabilities: Tuple[CapabilityGrant, ...]
    denied_capabilities: Tuple[CapabilityDeny, ...]


# ──────────────────────────────────────────────────────────
# Authorization Results
# ──────────────────────────────────────────────────────────

class AuthorizationStatus(Enum):
    """Three-state authorization outcome."""
    AUTHORIZED = "authorized"
    UNAUTHORIZED = "unauthorized"
    UNEVALUABLE = "unevaluable"


@dataclass(frozen=True)
class AuthorizationReason:
    """
    Explainable evidence for an authorization decision.

    rule_type values:
        "explicit_deny", "explicit_allow", "default_deny",
        "missing_context", "unknown_category", "unknown_operation"
    """
    description: str
    rule_type: str
    action_field: Optional[str] = None
    action_value: Optional[str] = None
    matched_value: Optional[str] = None


@dataclass(frozen=True)
class ActionAuthorizationResult:
    """
    Authorization result for a single NormalizedAction.

    The action field retains the exact evaluated NormalizedAction
    reference for deterministic auditing and traceability.

    NormalizedAction is an M2 external input dependency.
    M6 never mutates it. The immutability guarantee applies to
    M6-owned authorization structures, not to the internal
    mutability characteristics of the external NormalizedAction.
    """
    status: AuthorizationStatus
    action: NormalizedAction
    matched_grant: Optional[CapabilityGrant]
    matched_deny: Optional[CapabilityDeny]
    reasons: Tuple[AuthorizationReason, ...]


@dataclass(frozen=True)
class AuthorizationSummary:
    """Aggregate counts for trajectory-level authorization."""
    total_actions: int
    authorized_count: int
    unauthorized_count: int
    unevaluable_count: int


@dataclass(frozen=True)
class TrajectoryAuthorizationAssessment:
    """
    Complete authorization assessment for an entire trajectory.

    overall_status aggregation (conservative):
        - TaskContext is None        -> UNEVALUABLE
        - Any action UNAUTHORIZED    -> UNAUTHORIZED
        - All actions AUTHORIZED     -> AUTHORIZED
        - AUTHORIZED + UNEVALUABLE   -> UNEVALUABLE
    """
    task_id: str
    trajectory_id: str
    overall_status: AuthorizationStatus
    action_results: Tuple[ActionAuthorizationResult, ...]
    summary: AuthorizationSummary
