"""
Policy Fusion + Governance Decision Engine — Models (Milestone 7).

Defines the data contracts for the governance decision layer that fuses
M5 behavioral risk assessment and M6 task-context authorization with
configurable governance policies to produce deterministic ALLOW / ALERT / BLOCK
decisions.

Separation of concerns:
    Observation      (M1–M4) -> TrajectoryFeatures
    Interpretation   (M5)    -> RiskAssessment
    Authorization    (M6)    -> TrajectoryAuthorizationAssessment
    Decision         (M7)    -> ActionDecisionRecord (ALLOW / ALERT / BLOCK)

Key design principles:
    - M7 consumes M5 Severity directly; no duplicate severity enum.
    - M7 consumes M6 ResourceScope directly; no duplicate resource matching.
    - All M7-owned dataclasses are frozen=True.
    - All M7-owned collection fields use immutable tuples/frozensets.
    - M7 never mutates M5 or M6 objects.
    - HIGH risk != BLOCK. LOW risk != ALLOW. AUTHORIZED != ALLOW.
    - Policy decisions are governed by explicit governance policies,
      mandatory security invariants, and a deterministic baseline matrix.
    - UNKNOWN != SAFE. UNEVALUABLE != ALLOW.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, FrozenSet, Optional, Tuple

from src.agentsentinel.models.normalized import ActionCategory, NormalizedAction
from src.agentsentinel.risk.models import Severity
from src.agentsentinel.authorization.models import (
    ActionAuthorizationResult,
    AuthorizationStatus,
    ResourceScope,
)


# ──────────────────────────────────────────────────────────
# Governance Decision
# ──────────────────────────────────────────────────────────

class GovernanceDecision(Enum):
    """Final governance outcome for an evaluated action."""
    ALLOW = "allow"
    ALERT = "alert"
    BLOCK = "block"


# ──────────────────────────────────────────────────────────
# Policy Model
# ──────────────────────────────────────────────────────────

@dataclass(frozen=True)
class PolicyCondition:
    """
    Conditions that must all be true (AND) for a policy to match.

    Matching semantics for each optional field:
        None             -> unrestricted (no constraint on that field).
        Empty FrozenSet  -> matches nothing for that field.
        Non-empty set    -> action value must belong to the set.

    Unknown value handling:
        If operations is specified and action.operation is None -> no match.
        If resource_scope is specified and action.resource is None -> no match.

    Input authority:
        Only category, operation, and resource are consulted.
        provider, arguments, original_tool_name, source_dataset, and
        raw_data are NEVER consulted for policy matching.
    """
    risk_severities: Optional[FrozenSet[Severity]] = None
    auth_statuses: Optional[FrozenSet[AuthorizationStatus]] = None
    categories: Optional[FrozenSet[ActionCategory]] = None
    operations: Optional[FrozenSet[str]] = None
    resource_scope: Optional[ResourceScope] = None


@dataclass(frozen=True)
class GovernancePolicy:
    """
    A governance policy rule mapping conditions to a decision.

    priority:
        Lower number = higher precedence within the same decision tier.
        Priority ONLY resolves conflicts within the same tier.
        Cross-tier precedence is always: BLOCK > ALERT > ALLOW.

    policy_id:
        Must be unique across the policy set.
        Used as a deterministic lexicographical tie-breaker when
        two policies have the same priority within the same tier.
    """
    policy_id: str
    decision: GovernanceDecision
    condition: PolicyCondition
    priority: int
    description: str


# ──────────────────────────────────────────────────────────
# Explainability
# ──────────────────────────────────────────────────────────

@dataclass(frozen=True)
class GovernanceReason:
    """
    Explainable evidence for a governance decision.

    rule_type values:
        "mandatory_invariant"  — triggered by a mandatory security invariant.
        "explicit_policy"      — triggered by a matching governance policy.
        "baseline_matrix"      — triggered by the deterministic baseline matrix.
        "default_deny"         — fail-safe BLOCK when no other rule matched.

    Reasons are grounded in actual evaluated inputs.
    No fabricated explanations.
    """
    rule_type: str
    description: str
    matched_policy_id: Optional[str] = None
    policy_priority: Optional[int] = None


# ──────────────────────────────────────────────────────────
# Decision Record
# ──────────────────────────────────────────────────────────

@dataclass(frozen=True)
class ActionDecisionRecord:
    """
    Complete governance decision for a single NormalizedAction.

    Contains the final decision, the exact evaluated action reference,
    the M5 risk severity, the M6 authorization status, the matched
    policy (if any), and human-readable reasons.

    The action field retains the exact NormalizedAction reference from
    the evaluated ActionAuthorizationResult for deterministic auditing.

    NormalizedAction is an M2 external dependency. M7 never mutates it.
    """
    decision: GovernanceDecision
    action: NormalizedAction
    risk_severity: Optional[Severity]
    auth_status: AuthorizationStatus
    matched_policy: Optional[GovernancePolicy]
    reasons: Tuple[GovernanceReason, ...]
    ml_probability: Optional[float] = None
    risk_score: Optional[float] = None
    features: Optional[Dict[str, Any]] = None
