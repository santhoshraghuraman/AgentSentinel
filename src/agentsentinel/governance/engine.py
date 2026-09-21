"""
Policy Fusion + Governance Decision Engine (Milestone 7).

Fuses M5 behavioral risk assessment and M6 task-context authorization
with configurable governance policies to produce deterministic
ALLOW / ALERT / BLOCK decisions.

This engine does NOT:
    - Recalculate behavioral risk (M5).
    - Re-evaluate authorization (M6).
    - Inspect arguments, provider, original_tool_name, source_dataset, or raw_data.
    - Create duplicate Severity or ResourceScope implementations.
    - Mutate any input objects.

Evaluation order per action:
    1. Mandatory Security Invariants (5 invariants, unconditional)
    2. Matching BLOCK policies (by priority, then policy_id)
    3. Matching ALERT policies (by priority, then policy_id)
    4. Matching ALLOW policies (by priority, then policy_id)
       — subject to Invariant #4: UNAUTHORIZED cannot become ALLOW
    5. Baseline Decision Matrix (18-case deterministic)
    6. Fail-safe BLOCK

Cross-tier precedence: BLOCK > ALERT > ALLOW (regardless of priority).

Complexity:
    Action-level:  O(P) per action, where P = number of policies.
    No trajectory rescanning. Uses pre-computed M5/M6 results.
"""

import fnmatch
import posixpath
from typing import List, Optional, Sequence, Tuple

from src.agentsentinel.models.normalized import NormalizedAction
from src.agentsentinel.risk.models import Severity
from src.agentsentinel.authorization.models import (
    ActionAuthorizationResult,
    AuthorizationStatus,
    ResourceMatchMode,
    ResourceScope,
)
from src.agentsentinel.governance.models import (
    ActionDecisionRecord,
    GovernanceDecision,
    GovernancePolicy,
    GovernanceReason,
    PolicyCondition,
)


# ──────────────────────────────────────────────────────────
# Baseline Decision Matrix (18-case, deterministic)
# ──────────────────────────────────────────────────────────

# Key: (Optional[Severity], AuthorizationStatus) -> GovernanceDecision
_BASELINE_MATRIX = {
    # NONE
    (Severity.NONE, AuthorizationStatus.AUTHORIZED): GovernanceDecision.ALLOW,
    (Severity.NONE, AuthorizationStatus.UNAUTHORIZED): GovernanceDecision.ALERT,
    (Severity.NONE, AuthorizationStatus.UNEVALUABLE): GovernanceDecision.BLOCK,
    # LOW
    (Severity.LOW, AuthorizationStatus.AUTHORIZED): GovernanceDecision.ALLOW,
    (Severity.LOW, AuthorizationStatus.UNAUTHORIZED): GovernanceDecision.ALERT,
    (Severity.LOW, AuthorizationStatus.UNEVALUABLE): GovernanceDecision.BLOCK,
    # MEDIUM
    (Severity.MEDIUM, AuthorizationStatus.AUTHORIZED): GovernanceDecision.ALLOW,
    (Severity.MEDIUM, AuthorizationStatus.UNAUTHORIZED): GovernanceDecision.BLOCK,
    (Severity.MEDIUM, AuthorizationStatus.UNEVALUABLE): GovernanceDecision.BLOCK,
    # HIGH
    (Severity.HIGH, AuthorizationStatus.AUTHORIZED): GovernanceDecision.ALERT,
    (Severity.HIGH, AuthorizationStatus.UNAUTHORIZED): GovernanceDecision.BLOCK,
    (Severity.HIGH, AuthorizationStatus.UNEVALUABLE): GovernanceDecision.BLOCK,
    # CRITICAL (normally intercepted by invariant, defined for completeness)
    (Severity.CRITICAL, AuthorizationStatus.AUTHORIZED): GovernanceDecision.BLOCK,
    (Severity.CRITICAL, AuthorizationStatus.UNAUTHORIZED): GovernanceDecision.BLOCK,
    (Severity.CRITICAL, AuthorizationStatus.UNEVALUABLE): GovernanceDecision.BLOCK,
    # None / unevaluable risk (normally intercepted by invariant)
    (None, AuthorizationStatus.AUTHORIZED): GovernanceDecision.BLOCK,
    (None, AuthorizationStatus.UNAUTHORIZED): GovernanceDecision.BLOCK,
    (None, AuthorizationStatus.UNEVALUABLE): GovernanceDecision.BLOCK,
}


class PolicyFusionEngine:
    """
    Governance decision engine that fuses M5 risk and M6 authorization
    with configurable policies to produce deterministic decisions.

    All evaluation is side-effect free. No inputs are mutated.
    """

    def evaluate(
        self,
        action: NormalizedAction,
        risk_severity: Optional[Severity],
        auth_result: ActionAuthorizationResult,
        policies: Sequence[GovernancePolicy],
    ) -> ActionDecisionRecord:
        """
        Evaluate a single action and produce a governance decision.

        Args:
            action: The NormalizedAction being evaluated.
            risk_severity: The M5 overall_severity for this action's trajectory.
                           None means risk was unevaluable.
            auth_result: The M6 authorization result for this specific action.
            policies: The governance policy set to evaluate against.

        Returns:
            A frozen ActionDecisionRecord containing the decision,
            matched policy (if any), and human-readable reasons.
        """
        auth_status = auth_result.status

        # ── Step 1: Mandatory Security Invariants ──────────────

        invariant = self._check_invariants(risk_severity, auth_status)
        if invariant is not None:
            return ActionDecisionRecord(
                decision=invariant[0],
                action=action,
                risk_severity=risk_severity,
                auth_status=auth_status,
                matched_policy=None,
                reasons=invariant[1],
            )

        # ── Step 2–4: Explicit Policies (BLOCK > ALERT > ALLOW) ──

        policy_decision = self._evaluate_policies(
            action, risk_severity, auth_status, policies,
        )
        if policy_decision is not None:
            return policy_decision

        # ── Step 5: Baseline Decision Matrix ───────────────────

        baseline_key = (risk_severity, auth_status)
        baseline_decision = _BASELINE_MATRIX.get(baseline_key)

        if baseline_decision is not None:
            return ActionDecisionRecord(
                decision=baseline_decision,
                action=action,
                risk_severity=risk_severity,
                auth_status=auth_status,
                matched_policy=None,
                reasons=(
                    GovernanceReason(
                        rule_type="baseline_matrix",
                        description=(
                            f"No policy matched; baseline matrix produced "
                            f"{baseline_decision.value} for risk={_severity_label(risk_severity)}, "
                            f"auth={auth_status.value}"
                        ),
                    ),
                ),
            )

        # ── Step 6: Fail-safe BLOCK ────────────────────────────

        return ActionDecisionRecord(
            decision=GovernanceDecision.BLOCK,
            action=action,
            risk_severity=risk_severity,
            auth_status=auth_status,
            matched_policy=None,
            reasons=(
                GovernanceReason(
                    rule_type="default_deny",
                    description=(
                        f"Unknown governance state for risk={_severity_label(risk_severity)}, "
                        f"auth={auth_status.value} — fail-safe BLOCK"
                    ),
                ),
            ),
        )

    # ──────────────────────────────────────────────────────────
    # Mandatory Security Invariants
    # ──────────────────────────────────────────────────────────

    @staticmethod
    def _check_invariants(
        risk_severity: Optional[Severity],
        auth_status: AuthorizationStatus,
    ) -> Optional[Tuple[GovernanceDecision, Tuple[GovernanceReason, ...]]]:
        """
        Check the five mandatory security invariants.

        Returns (decision, reasons) if an invariant triggers, else None.

        Invariants (evaluated in order):
            1. Risk severity == CRITICAL → BLOCK
            2. Authorization == UNEVALUABLE → BLOCK
            3. Risk severity == None → BLOCK
            4. Authorization == UNAUTHORIZED → cannot produce ALLOW
               (enforced in _evaluate_policies, not here as a standalone BLOCK)
            5. Unknown/unsupported governance state → BLOCK
               (enforced as the fail-safe fallback in evaluate())

        Invariants 1–3 produce immediate BLOCK decisions.
        Invariant 4 is enforced as a constraint in the policy evaluation step.
        Invariant 5 is enforced as the final fail-safe fallback.
        """
        reasons: List[GovernanceReason] = []

        # Invariant 1: CRITICAL risk → BLOCK
        if risk_severity == Severity.CRITICAL:
            reasons.append(GovernanceReason(
                rule_type="mandatory_invariant",
                description="Risk severity CRITICAL triggered mandatory BLOCK invariant",
            ))

        # Invariant 2: UNEVALUABLE authorization → BLOCK
        if auth_status == AuthorizationStatus.UNEVALUABLE:
            reasons.append(GovernanceReason(
                rule_type="mandatory_invariant",
                description="Authorization status UNEVALUABLE triggered mandatory BLOCK invariant",
            ))

        # Invariant 3: Risk None (unevaluable) → BLOCK
        if risk_severity is None:
            reasons.append(GovernanceReason(
                rule_type="mandatory_invariant",
                description="Risk severity unevaluable (None) triggered mandatory BLOCK invariant",
            ))

        if reasons:
            return (GovernanceDecision.BLOCK, tuple(reasons))

        return None

    # ──────────────────────────────────────────────────────────
    # Policy Evaluation
    # ──────────────────────────────────────────────────────────

    def _evaluate_policies(
        self,
        action: NormalizedAction,
        risk_severity: Optional[Severity],
        auth_status: AuthorizationStatus,
        policies: Sequence[GovernancePolicy],
    ) -> Optional[ActionDecisionRecord]:
        """
        Evaluate policies in tier order: BLOCK → ALERT → ALLOW.

        Within each tier, policies are sorted by (priority, policy_id)
        for deterministic resolution.

        Invariant #4 enforcement:
            If auth_status == UNAUTHORIZED, ALLOW policies are skipped entirely.
            An ALLOW policy MUST NOT convert an UNAUTHORIZED action into ALLOW.
        """
        # Partition policies by decision tier
        block_policies: List[GovernancePolicy] = []
        alert_policies: List[GovernancePolicy] = []
        allow_policies: List[GovernancePolicy] = []

        for policy in policies:
            if policy.decision == GovernanceDecision.BLOCK:
                block_policies.append(policy)
            elif policy.decision == GovernanceDecision.ALERT:
                alert_policies.append(policy)
            elif policy.decision == GovernanceDecision.ALLOW:
                allow_policies.append(policy)

        # Sort each tier by (priority, policy_id) for deterministic ordering
        block_policies.sort(key=lambda p: (p.priority, p.policy_id))
        alert_policies.sort(key=lambda p: (p.priority, p.policy_id))
        allow_policies.sort(key=lambda p: (p.priority, p.policy_id))

        # Tier 1: BLOCK policies
        for policy in block_policies:
            if self._policy_matches(policy, action, risk_severity, auth_status):
                return ActionDecisionRecord(
                    decision=GovernanceDecision.BLOCK,
                    action=action,
                    risk_severity=risk_severity,
                    auth_status=auth_status,
                    matched_policy=policy,
                    reasons=(
                        GovernanceReason(
                            rule_type="explicit_policy",
                            description=(
                                f"Matched explicit BLOCK policy '{policy.policy_id}': "
                                f"{policy.description}"
                            ),
                            matched_policy_id=policy.policy_id,
                            policy_priority=policy.priority,
                        ),
                    ),
                )

        # Tier 2: ALERT policies
        for policy in alert_policies:
            if self._policy_matches(policy, action, risk_severity, auth_status):
                return ActionDecisionRecord(
                    decision=GovernanceDecision.ALERT,
                    action=action,
                    risk_severity=risk_severity,
                    auth_status=auth_status,
                    matched_policy=policy,
                    reasons=(
                        GovernanceReason(
                            rule_type="explicit_policy",
                            description=(
                                f"Matched explicit ALERT policy '{policy.policy_id}': "
                                f"{policy.description}"
                            ),
                            matched_policy_id=policy.policy_id,
                            policy_priority=policy.priority,
                        ),
                    ),
                )

        # Tier 3: ALLOW policies — subject to Invariant #4
        if auth_status != AuthorizationStatus.UNAUTHORIZED:
            for policy in allow_policies:
                if self._policy_matches(policy, action, risk_severity, auth_status):
                    return ActionDecisionRecord(
                        decision=GovernanceDecision.ALLOW,
                        action=action,
                        risk_severity=risk_severity,
                        auth_status=auth_status,
                        matched_policy=policy,
                        reasons=(
                            GovernanceReason(
                                rule_type="explicit_policy",
                                description=(
                                    f"Matched explicit ALLOW policy '{policy.policy_id}': "
                                    f"{policy.description}"
                                ),
                                matched_policy_id=policy.policy_id,
                                policy_priority=policy.priority,
                            ),
                        ),
                    )

        # No policy matched (or ALLOW policies were skipped for UNAUTHORIZED)
        return None

    # ──────────────────────────────────────────────────────────
    # Policy Condition Matching
    # ──────────────────────────────────────────────────────────

    def _policy_matches(
        self,
        policy: GovernancePolicy,
        action: NormalizedAction,
        risk_severity: Optional[Severity],
        auth_status: AuthorizationStatus,
    ) -> bool:
        """
        Check if all conditions of a policy match the current evaluation context.

        All conditions are AND-combined. Any failing condition rejects the match.
        """
        cond = policy.condition

        # Risk severities
        if cond.risk_severities is not None:
            if risk_severity not in cond.risk_severities:
                return False

        # Authorization statuses
        if cond.auth_statuses is not None:
            if auth_status not in cond.auth_statuses:
                return False

        # Categories
        if cond.categories is not None:
            if action.category not in cond.categories:
                return False

        # Operations
        if cond.operations is not None:
            if action.operation is None:
                # Unknown operation must never satisfy an explicit operation policy
                return False
            if action.operation not in cond.operations:
                return False

        # Resource scope
        if cond.resource_scope is not None:
            if action.resource is None:
                # Unknown resource must never satisfy an explicit resource policy
                return False
            if not self._resource_matches(cond.resource_scope, action.resource):
                return False

        return True

    # ──────────────────────────────────────────────────────────
    # Resource Matching (delegates to M6 ResourceScope semantics)
    # ──────────────────────────────────────────────────────────

    @staticmethod
    def _canonicalize_path(path: str) -> str:
        """Canonicalize a resource path using posixpath.normpath."""
        return posixpath.normpath(path)

    @classmethod
    def _resource_matches(cls, scope: ResourceScope, action_resource: str) -> bool:
        """
        Check if an action resource matches a ResourceScope.

        Reuses M6 ResourceScope semantics:
            EXACT:   canonicalize both, exact string comparison.
            PREFIX:  canonicalize both, path-component-aware prefix match.
            PATTERN: canonicalize action resource, preserve scope as glob, fnmatch.
        """
        canonical_resource = cls._canonicalize_path(action_resource)

        if scope.match_mode == ResourceMatchMode.EXACT:
            canonical_scope = cls._canonicalize_path(scope.value)
            return canonical_resource == canonical_scope

        elif scope.match_mode == ResourceMatchMode.PREFIX:
            canonical_scope = cls._canonicalize_path(scope.value)
            if canonical_resource == canonical_scope:
                return True
            return canonical_resource.startswith(canonical_scope + "/")

        elif scope.match_mode == ResourceMatchMode.PATTERN:
            return fnmatch.fnmatch(canonical_resource, scope.value)

        return False


# ──────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────

def _severity_label(severity: Optional[Severity]) -> str:
    """Human-readable label for severity, handling None."""
    if severity is None:
        return "None (unevaluable)"
    return severity.name
