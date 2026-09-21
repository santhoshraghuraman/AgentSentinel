"""
Tests for Milestone 7 — Policy Fusion + Governance Decision Engine.

Verifies:
    - GovernanceDecision enum values
    - PolicyCondition matching semantics (None, empty, non-empty)
    - Unknown operation does not match operation policy
    - Unknown resource does not match resource policy
    - Category matching
    - Operation matching
    - Resource matching through M6 ResourceScope
    - Five mandatory security invariants
    - All 18 baseline matrix combinations
    - UNAUTHORIZED + ALLOW policy cannot produce ALLOW
    - BLOCK tier beats ALERT and ALLOW regardless of priority
    - ALERT tier beats ALLOW regardless of priority
    - Priority within same tier
    - Lexicographical policy_id tie-break
    - Explainability (GovernanceReason)
    - ActionDecisionRecord retains exact NormalizedAction reference
    - M5 Severity is directly reused (no duplicate enum)
    - M6 ResourceScope is directly reused
    - Provider / arguments / original_tool_name / raw_data cannot influence decision
    - Input immutability (M5/M6 objects not mutated)
    - Policy and decision record immutability
    - Deterministic repeated evaluation
    - M5 engine isolation
    - M6 engine isolation
"""

import copy
import dataclasses

import pytest

from src.agentsentinel.models.normalized import (
    ActionCategory,
    NormalizedAction,
)
from src.agentsentinel.risk.models import Severity
from src.agentsentinel.authorization.models import (
    ActionAuthorizationResult,
    AuthorizationReason,
    AuthorizationStatus,
    ResourceMatchMode,
    ResourceScope,
    CapabilityGrant,
)
from src.agentsentinel.governance.models import (
    ActionDecisionRecord,
    GovernanceDecision,
    GovernancePolicy,
    GovernanceReason,
    PolicyCondition,
)
from src.agentsentinel.governance.engine import PolicyFusionEngine


# ──────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────

def _make_action(
    category=ActionCategory.FILE_SYSTEM_READ,
    operation="read",
    resource="/project/src/main.py",
    provider="local_fs",
    original_tool_name="read_file",
    arguments=None,
) -> NormalizedAction:
    """Create a NormalizedAction with sensible defaults."""
    return NormalizedAction(
        normalized_name="test_action",
        category=category,
        provider=provider,
        operation=operation,
        resource=resource,
        is_mutating=False,
        is_destructive=False,
        original_tool_name=original_tool_name,
        source_dataset="test",
        arguments=arguments or {},
    )


def _make_auth_result(
    status: AuthorizationStatus,
    action: NormalizedAction,
) -> ActionAuthorizationResult:
    """Create an ActionAuthorizationResult with the given status."""
    return ActionAuthorizationResult(
        status=status,
        action=action,
        matched_grant=None,
        matched_deny=None,
        reasons=(
            AuthorizationReason(
                description=f"test auth result: {status.value}",
                rule_type="test",
            ),
        ),
    )


def _make_policy(
    policy_id: str,
    decision: GovernanceDecision,
    priority: int = 0,
    risk_severities=None,
    auth_statuses=None,
    categories=None,
    operations=None,
    resource_scope=None,
    description="test policy",
) -> GovernancePolicy:
    """Create a GovernancePolicy with the given parameters."""
    return GovernancePolicy(
        policy_id=policy_id,
        decision=decision,
        condition=PolicyCondition(
            risk_severities=frozenset(risk_severities) if risk_severities else None,
            auth_statuses=frozenset(auth_statuses) if auth_statuses else None,
            categories=frozenset(categories) if categories else None,
            operations=frozenset(operations) if operations else None,
            resource_scope=resource_scope,
        ),
        priority=priority,
        description=description,
    )


# ──────────────────────────────────────────────────────────
# GovernanceDecision Enum
# ──────────────────────────────────────────────────────────

class TestGovernanceDecisionEnum:
    def test_allow_value(self):
        assert GovernanceDecision.ALLOW.value == "allow"

    def test_alert_value(self):
        assert GovernanceDecision.ALERT.value == "alert"

    def test_block_value(self):
        assert GovernanceDecision.BLOCK.value == "block"

    def test_three_members(self):
        assert len(GovernanceDecision) == 3


# ──────────────────────────────────────────────────────────
# PolicyCondition Matching
# ──────────────────────────────────────────────────────────

class TestPolicyConditionMatching:
    """Validates PolicyCondition semantics: None, empty, non-empty sets."""

    def setup_method(self):
        self.engine = PolicyFusionEngine()
        self.action = _make_action()

    def test_none_condition_fields_unrestricted(self):
        """None fields = unrestricted, policy matches everything."""
        policy = _make_policy("p1", GovernanceDecision.BLOCK)
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action),
            [policy],
        )
        assert result.decision == GovernanceDecision.BLOCK

    def test_empty_frozenset_matches_nothing(self):
        """Empty FrozenSet = matches nothing for that field."""
        policy = GovernancePolicy(
            policy_id="p1",
            decision=GovernanceDecision.BLOCK,
            condition=PolicyCondition(
                risk_severities=frozenset(),  # empty
            ),
            priority=0,
            description="empty risk set",
        )
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action),
            [policy],
        )
        # Policy doesn't match → falls through to baseline
        assert result.decision == GovernanceDecision.ALLOW
        assert result.matched_policy is None

    def test_nonempty_frozenset_matching(self):
        """Non-empty FrozenSet: action value must belong to the set."""
        policy = _make_policy(
            "p1", GovernanceDecision.ALERT,
            risk_severities=[Severity.LOW, Severity.MEDIUM],
        )
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action),
            [policy],
        )
        assert result.decision == GovernanceDecision.ALERT

    def test_nonempty_frozenset_no_match(self):
        """Non-empty FrozenSet: action value NOT in set → no match."""
        policy = _make_policy(
            "p1", GovernanceDecision.ALERT,
            risk_severities=[Severity.HIGH, Severity.CRITICAL],
        )
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action),
            [policy],
        )
        # Policy doesn't match, baseline LOW+AUTHORIZED = ALLOW
        assert result.decision == GovernanceDecision.ALLOW

    def test_unknown_operation_does_not_match_operation_policy(self):
        """If policy.operations is specified and action.operation is None → no match."""
        action = _make_action(operation=None)
        policy = _make_policy(
            "p1", GovernanceDecision.BLOCK,
            operations=["read", "write"],
        )
        # Operation None → UNAUTHORIZED by M6, but CRITICAL override not here.
        # We test policy matching in isolation: even with BLOCK policy on ops,
        # an unknown operation should not satisfy the policy.
        # With UNAUTHORIZED auth_status the action can still be BLOCKed by baseline.
        result = self.engine.evaluate(
            action, Severity.MEDIUM,
            _make_auth_result(AuthorizationStatus.UNAUTHORIZED, action),
            [policy],
        )
        # Policy doesn't match (unknown op); baseline MEDIUM+UNAUTHORIZED = BLOCK
        assert result.decision == GovernanceDecision.BLOCK
        assert result.matched_policy is None  # policy didn't match

    def test_unknown_resource_does_not_match_resource_policy(self):
        """If policy.resource_scope is specified and action.resource is None → no match."""
        action = _make_action(resource=None)
        policy = _make_policy(
            "p1", GovernanceDecision.BLOCK,
            resource_scope=ResourceScope(
                match_mode=ResourceMatchMode.PREFIX,
                value="/project/src",
            ),
        )
        result = self.engine.evaluate(
            action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, action),
            [policy],
        )
        # Policy doesn't match; baseline LOW+AUTHORIZED = ALLOW
        assert result.decision == GovernanceDecision.ALLOW
        assert result.matched_policy is None

    def test_category_matching(self):
        """Categories condition must match action.category."""
        policy = _make_policy(
            "p1", GovernanceDecision.ALERT,
            categories=[ActionCategory.FILE_SYSTEM_READ],
        )
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action),
            [policy],
        )
        assert result.decision == GovernanceDecision.ALERT

    def test_category_no_match(self):
        """Categories condition: action.category NOT in set → no match."""
        policy = _make_policy(
            "p1", GovernanceDecision.ALERT,
            categories=[ActionCategory.WEB_REQUEST],
        )
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action),
            [policy],
        )
        assert result.decision == GovernanceDecision.ALLOW  # baseline

    def test_operation_matching(self):
        """Operations condition: action.operation must be in set."""
        policy = _make_policy(
            "p1", GovernanceDecision.ALERT,
            operations=["read"],
        )
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action),
            [policy],
        )
        assert result.decision == GovernanceDecision.ALERT

    def test_resource_scope_exact_matching(self):
        """Resource scope EXACT matching through M6 semantics."""
        policy = _make_policy(
            "p1", GovernanceDecision.ALERT,
            resource_scope=ResourceScope(
                match_mode=ResourceMatchMode.EXACT,
                value="/project/src/main.py",
            ),
        )
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action),
            [policy],
        )
        assert result.decision == GovernanceDecision.ALERT

    def test_resource_scope_prefix_matching(self):
        """Resource scope PREFIX matching through M6 semantics."""
        policy = _make_policy(
            "p1", GovernanceDecision.ALERT,
            resource_scope=ResourceScope(
                match_mode=ResourceMatchMode.PREFIX,
                value="/project/src",
            ),
        )
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action),
            [policy],
        )
        assert result.decision == GovernanceDecision.ALERT

    def test_resource_scope_pattern_matching(self):
        """Resource scope PATTERN matching through M6 semantics."""
        policy = _make_policy(
            "p1", GovernanceDecision.ALERT,
            resource_scope=ResourceScope(
                match_mode=ResourceMatchMode.PATTERN,
                value="/project/src/*.py",
            ),
        )
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action),
            [policy],
        )
        assert result.decision == GovernanceDecision.ALERT

    def test_auth_status_condition_matching(self):
        """Auth status condition must match the authorization result status."""
        policy = _make_policy(
            "p1", GovernanceDecision.BLOCK,
            auth_statuses=[AuthorizationStatus.UNAUTHORIZED],
        )
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.UNAUTHORIZED, self.action),
            [policy],
        )
        assert result.decision == GovernanceDecision.BLOCK

    def test_multi_condition_and_semantics(self):
        """All conditions must match (AND). Partial match = no match."""
        policy = _make_policy(
            "p1", GovernanceDecision.ALERT,
            risk_severities=[Severity.LOW],
            categories=[ActionCategory.WEB_REQUEST],  # doesn't match
        )
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action),
            [policy],
        )
        assert result.decision == GovernanceDecision.ALLOW  # baseline


# ──────────────────────────────────────────────────────────
# Mandatory Security Invariants
# ──────────────────────────────────────────────────────────

class TestMandatoryInvariants:
    """Verifies the five mandatory security invariants."""

    def setup_method(self):
        self.engine = PolicyFusionEngine()
        self.action = _make_action()

    def test_critical_risk_blocks(self):
        """Invariant 1: Risk CRITICAL → BLOCK."""
        result = self.engine.evaluate(
            self.action, Severity.CRITICAL,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action),
            [],
        )
        assert result.decision == GovernanceDecision.BLOCK
        assert any("CRITICAL" in r.description for r in result.reasons)
        assert any(r.rule_type == "mandatory_invariant" for r in result.reasons)

    def test_critical_risk_blocks_even_with_allow_policy(self):
        """Invariant 1: CRITICAL cannot be overridden by ALLOW policy."""
        allow_policy = _make_policy("allow_all", GovernanceDecision.ALLOW)
        result = self.engine.evaluate(
            self.action, Severity.CRITICAL,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action),
            [allow_policy],
        )
        assert result.decision == GovernanceDecision.BLOCK

    def test_unevaluable_auth_blocks(self):
        """Invariant 2: Authorization UNEVALUABLE → BLOCK."""
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.UNEVALUABLE, self.action),
            [],
        )
        assert result.decision == GovernanceDecision.BLOCK
        assert any("UNEVALUABLE" in r.description for r in result.reasons)

    def test_unevaluable_auth_blocks_even_with_allow_policy(self):
        """Invariant 2: UNEVALUABLE auth cannot be overridden by ALLOW policy."""
        allow_policy = _make_policy("allow_all", GovernanceDecision.ALLOW)
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.UNEVALUABLE, self.action),
            [allow_policy],
        )
        assert result.decision == GovernanceDecision.BLOCK

    def test_risk_none_blocks(self):
        """Invariant 3: Risk severity None → BLOCK."""
        result = self.engine.evaluate(
            self.action, None,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action),
            [],
        )
        assert result.decision == GovernanceDecision.BLOCK
        assert any("unevaluable" in r.description.lower() or "None" in r.description for r in result.reasons)

    def test_risk_none_blocks_even_with_allow_policy(self):
        """Invariant 3: Risk None cannot be overridden by ALLOW policy."""
        allow_policy = _make_policy("allow_all", GovernanceDecision.ALLOW)
        result = self.engine.evaluate(
            self.action, None,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action),
            [allow_policy],
        )
        assert result.decision == GovernanceDecision.BLOCK

    def test_unauthorized_cannot_become_allow(self):
        """Invariant 4: UNAUTHORIZED + matching ALLOW policy → NOT ALLOW."""
        allow_policy = _make_policy("allow_all", GovernanceDecision.ALLOW)
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.UNAUTHORIZED, self.action),
            [allow_policy],
        )
        assert result.decision != GovernanceDecision.ALLOW
        # LOW+UNAUTHORIZED baseline = ALERT
        assert result.decision == GovernanceDecision.ALERT

    def test_unauthorized_allow_medium_risk(self):
        """Invariant 4: MEDIUM + UNAUTHORIZED + ALLOW policy → BLOCK via baseline."""
        allow_policy = _make_policy("allow_all", GovernanceDecision.ALLOW)
        result = self.engine.evaluate(
            self.action, Severity.MEDIUM,
            _make_auth_result(AuthorizationStatus.UNAUTHORIZED, self.action),
            [allow_policy],
        )
        assert result.decision == GovernanceDecision.BLOCK

    def test_unauthorized_allow_high_risk(self):
        """Invariant 4: HIGH + UNAUTHORIZED + ALLOW policy → BLOCK via baseline."""
        allow_policy = _make_policy("allow_all", GovernanceDecision.ALLOW)
        result = self.engine.evaluate(
            self.action, Severity.HIGH,
            _make_auth_result(AuthorizationStatus.UNAUTHORIZED, self.action),
            [allow_policy],
        )
        assert result.decision == GovernanceDecision.BLOCK

    def test_unauthorized_allow_none_risk(self):
        """Invariant 4: NONE + UNAUTHORIZED + ALLOW policy → ALERT via baseline."""
        allow_policy = _make_policy("allow_all", GovernanceDecision.ALLOW)
        result = self.engine.evaluate(
            self.action, Severity.NONE,
            _make_auth_result(AuthorizationStatus.UNAUTHORIZED, self.action),
            [allow_policy],
        )
        assert result.decision == GovernanceDecision.ALERT

    def test_critical_plus_unevaluable_both_invariants(self):
        """Multiple invariants can fire simultaneously."""
        result = self.engine.evaluate(
            self.action, Severity.CRITICAL,
            _make_auth_result(AuthorizationStatus.UNEVALUABLE, self.action),
            [],
        )
        assert result.decision == GovernanceDecision.BLOCK
        assert len(result.reasons) >= 2


# ──────────────────────────────────────────────────────────
# Baseline Decision Matrix (all 18 cases)
# ──────────────────────────────────────────────────────────

class TestBaselineMatrix:
    """Verifies all 18 combinations of the deterministic baseline matrix."""

    def setup_method(self):
        self.engine = PolicyFusionEngine()
        self.action = _make_action()

    # NONE
    def test_none_authorized(self):
        result = self.engine.evaluate(
            self.action, Severity.NONE,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action), [],
        )
        assert result.decision == GovernanceDecision.ALLOW

    def test_none_unauthorized(self):
        result = self.engine.evaluate(
            self.action, Severity.NONE,
            _make_auth_result(AuthorizationStatus.UNAUTHORIZED, self.action), [],
        )
        assert result.decision == GovernanceDecision.ALERT

    def test_none_unevaluable(self):
        result = self.engine.evaluate(
            self.action, Severity.NONE,
            _make_auth_result(AuthorizationStatus.UNEVALUABLE, self.action), [],
        )
        assert result.decision == GovernanceDecision.BLOCK

    # LOW
    def test_low_authorized(self):
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action), [],
        )
        assert result.decision == GovernanceDecision.ALLOW

    def test_low_unauthorized(self):
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.UNAUTHORIZED, self.action), [],
        )
        assert result.decision == GovernanceDecision.ALERT

    def test_low_unevaluable(self):
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.UNEVALUABLE, self.action), [],
        )
        assert result.decision == GovernanceDecision.BLOCK

    # MEDIUM
    def test_medium_authorized(self):
        result = self.engine.evaluate(
            self.action, Severity.MEDIUM,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action), [],
        )
        assert result.decision == GovernanceDecision.ALLOW

    def test_medium_unauthorized(self):
        result = self.engine.evaluate(
            self.action, Severity.MEDIUM,
            _make_auth_result(AuthorizationStatus.UNAUTHORIZED, self.action), [],
        )
        assert result.decision == GovernanceDecision.BLOCK

    def test_medium_unevaluable(self):
        result = self.engine.evaluate(
            self.action, Severity.MEDIUM,
            _make_auth_result(AuthorizationStatus.UNEVALUABLE, self.action), [],
        )
        assert result.decision == GovernanceDecision.BLOCK

    # HIGH
    def test_high_authorized(self):
        result = self.engine.evaluate(
            self.action, Severity.HIGH,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action), [],
        )
        assert result.decision == GovernanceDecision.ALERT

    def test_high_unauthorized(self):
        result = self.engine.evaluate(
            self.action, Severity.HIGH,
            _make_auth_result(AuthorizationStatus.UNAUTHORIZED, self.action), [],
        )
        assert result.decision == GovernanceDecision.BLOCK

    def test_high_unevaluable(self):
        result = self.engine.evaluate(
            self.action, Severity.HIGH,
            _make_auth_result(AuthorizationStatus.UNEVALUABLE, self.action), [],
        )
        assert result.decision == GovernanceDecision.BLOCK

    # CRITICAL (invariant cases, but baseline must still be defined)
    def test_critical_authorized(self):
        result = self.engine.evaluate(
            self.action, Severity.CRITICAL,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action), [],
        )
        assert result.decision == GovernanceDecision.BLOCK

    def test_critical_unauthorized(self):
        result = self.engine.evaluate(
            self.action, Severity.CRITICAL,
            _make_auth_result(AuthorizationStatus.UNAUTHORIZED, self.action), [],
        )
        assert result.decision == GovernanceDecision.BLOCK

    def test_critical_unevaluable(self):
        result = self.engine.evaluate(
            self.action, Severity.CRITICAL,
            _make_auth_result(AuthorizationStatus.UNEVALUABLE, self.action), [],
        )
        assert result.decision == GovernanceDecision.BLOCK

    # None (unevaluable risk, invariant cases)
    def test_risk_none_authorized(self):
        result = self.engine.evaluate(
            self.action, None,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action), [],
        )
        assert result.decision == GovernanceDecision.BLOCK

    def test_risk_none_unauthorized(self):
        result = self.engine.evaluate(
            self.action, None,
            _make_auth_result(AuthorizationStatus.UNAUTHORIZED, self.action), [],
        )
        assert result.decision == GovernanceDecision.BLOCK

    def test_risk_none_unevaluable(self):
        result = self.engine.evaluate(
            self.action, None,
            _make_auth_result(AuthorizationStatus.UNEVALUABLE, self.action), [],
        )
        assert result.decision == GovernanceDecision.BLOCK


# ──────────────────────────────────────────────────────────
# Policy Precedence
# ──────────────────────────────────────────────────────────

class TestPolicyPrecedence:
    """Verifies tier-based precedence and within-tier ordering."""

    def setup_method(self):
        self.engine = PolicyFusionEngine()
        self.action = _make_action()
        self.auth = _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action)

    def test_block_tier_beats_alert(self):
        """BLOCK policy outranks ALERT policy regardless of priority."""
        block_policy = _make_policy("block1", GovernanceDecision.BLOCK, priority=100)
        alert_policy = _make_policy("alert1", GovernanceDecision.ALERT, priority=0)
        result = self.engine.evaluate(
            self.action, Severity.LOW, self.auth, [alert_policy, block_policy],
        )
        assert result.decision == GovernanceDecision.BLOCK
        assert result.matched_policy.policy_id == "block1"

    def test_block_tier_beats_allow(self):
        """BLOCK policy outranks ALLOW policy regardless of priority."""
        block_policy = _make_policy("block1", GovernanceDecision.BLOCK, priority=100)
        allow_policy = _make_policy("allow1", GovernanceDecision.ALLOW, priority=0)
        result = self.engine.evaluate(
            self.action, Severity.LOW, self.auth, [allow_policy, block_policy],
        )
        assert result.decision == GovernanceDecision.BLOCK

    def test_alert_tier_beats_allow(self):
        """ALERT policy outranks ALLOW policy regardless of priority."""
        alert_policy = _make_policy("alert1", GovernanceDecision.ALERT, priority=100)
        allow_policy = _make_policy("allow1", GovernanceDecision.ALLOW, priority=0)
        result = self.engine.evaluate(
            self.action, Severity.LOW, self.auth, [allow_policy, alert_policy],
        )
        assert result.decision == GovernanceDecision.ALERT

    def test_priority_within_same_tier(self):
        """Lower priority number = higher precedence within the same tier."""
        block_high = _make_policy(
            "block_high", GovernanceDecision.BLOCK, priority=0,
            description="high priority block",
        )
        block_low = _make_policy(
            "block_low", GovernanceDecision.BLOCK, priority=10,
            description="low priority block",
        )
        result = self.engine.evaluate(
            self.action, Severity.LOW, self.auth, [block_low, block_high],
        )
        assert result.decision == GovernanceDecision.BLOCK
        assert result.matched_policy.policy_id == "block_high"

    def test_policy_id_lexicographic_tiebreak(self):
        """Equal priority: policy_id lexicographic order is deterministic tie-break."""
        policy_a = _make_policy(
            "aaa_block", GovernanceDecision.BLOCK, priority=5,
            description="alpha block",
        )
        policy_b = _make_policy(
            "zzz_block", GovernanceDecision.BLOCK, priority=5,
            description="zulu block",
        )
        result = self.engine.evaluate(
            self.action, Severity.LOW, self.auth, [policy_b, policy_a],
        )
        assert result.decision == GovernanceDecision.BLOCK
        assert result.matched_policy.policy_id == "aaa_block"

    def test_allow_policy_works_for_authorized(self):
        """ALLOW policy succeeds for an AUTHORIZED action."""
        allow_policy = _make_policy(
            "allow1", GovernanceDecision.ALLOW, priority=0,
            risk_severities=[Severity.HIGH],
        )
        result = self.engine.evaluate(
            self.action, Severity.HIGH, self.auth, [allow_policy],
        )
        assert result.decision == GovernanceDecision.ALLOW
        assert result.matched_policy.policy_id == "allow1"


# ──────────────────────────────────────────────────────────
# Explainability
# ──────────────────────────────────────────────────────────

class TestExplainability:
    """Verifies GovernanceReason correctness in decision records."""

    def setup_method(self):
        self.engine = PolicyFusionEngine()
        self.action = _make_action()

    def test_mandatory_invariant_explanation(self):
        """Invariant decisions include rule_type='mandatory_invariant'."""
        result = self.engine.evaluate(
            self.action, Severity.CRITICAL,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action), [],
        )
        assert any(r.rule_type == "mandatory_invariant" for r in result.reasons)

    def test_explicit_policy_explanation(self):
        """Policy decisions include rule_type='explicit_policy' with policy details."""
        policy = _make_policy(
            "test_block", GovernanceDecision.BLOCK, priority=5,
            description="block for testing",
        )
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action),
            [policy],
        )
        reason = result.reasons[0]
        assert reason.rule_type == "explicit_policy"
        assert reason.matched_policy_id == "test_block"
        assert reason.policy_priority == 5

    def test_baseline_matrix_explanation(self):
        """Baseline decisions include rule_type='baseline_matrix'."""
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action), [],
        )
        assert any(r.rule_type == "baseline_matrix" for r in result.reasons)

    def test_risk_severity_in_record(self):
        """ActionDecisionRecord captures the exact risk severity."""
        result = self.engine.evaluate(
            self.action, Severity.MEDIUM,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action), [],
        )
        assert result.risk_severity == Severity.MEDIUM

    def test_auth_status_in_record(self):
        """ActionDecisionRecord captures the exact authorization status."""
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.UNAUTHORIZED, self.action), [],
        )
        assert result.auth_status == AuthorizationStatus.UNAUTHORIZED

    def test_none_risk_severity_in_record(self):
        """ActionDecisionRecord captures None risk severity."""
        result = self.engine.evaluate(
            self.action, None,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action), [],
        )
        assert result.risk_severity is None

    def test_no_policy_matched_is_none(self):
        """When no explicit policy matched, matched_policy is None."""
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action), [],
        )
        assert result.matched_policy is None


# ──────────────────────────────────────────────────────────
# Action Reference Retention
# ──────────────────────────────────────────────────────────

class TestActionReference:
    """Verifies ActionDecisionRecord retains the exact NormalizedAction reference."""

    def test_exact_action_reference(self):
        engine = PolicyFusionEngine()
        action = _make_action()
        result = engine.evaluate(
            action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, action), [],
        )
        assert result.action is action


# ──────────────────────────────────────────────────────────
# M5 Severity Reuse
# ──────────────────────────────────────────────────────────

class TestM5SeverityReuse:
    """Verifies M7 uses the exact M5 Severity enum, not a duplicate."""

    def test_severity_is_m5_severity(self):
        """GovernancePolicy conditions use the exact M5 Severity enum."""
        from src.agentsentinel.risk.models import Severity as M5Severity
        cond = PolicyCondition(risk_severities=frozenset([M5Severity.HIGH]))
        assert M5Severity.HIGH in cond.risk_severities

    def test_no_duplicate_severity_in_governance_models(self):
        """governance.models does not define its own Severity enum."""
        import src.agentsentinel.governance.models as gm
        # The Severity used in governance.models must be the M5 import
        assert not hasattr(gm, 'Severity') or gm.Severity is Severity

    def test_no_duplicate_severity_in_governance_engine(self):
        """governance.engine does not define its own Severity enum."""
        import src.agentsentinel.governance.engine as ge
        assert not hasattr(ge, 'Severity') or ge.Severity is Severity


# ──────────────────────────────────────────────────────────
# M6 ResourceScope Reuse
# ──────────────────────────────────────────────────────────

class TestM6ResourceScopeReuse:
    """Verifies M7 uses the exact M6 ResourceScope, not a duplicate."""

    def test_resource_scope_is_m6(self):
        """PolicyCondition.resource_scope uses the exact M6 ResourceScope."""
        from src.agentsentinel.authorization.models import ResourceScope as M6RS
        scope = M6RS(match_mode=ResourceMatchMode.EXACT, value="/test")
        cond = PolicyCondition(resource_scope=scope)
        assert cond.resource_scope is scope

    def test_no_duplicate_resource_scope(self):
        """governance.models does not define its own ResourceScope."""
        import src.agentsentinel.governance.models as gm
        assert not hasattr(gm, 'ResourceScope') or gm.ResourceScope is ResourceScope


# ──────────────────────────────────────────────────────────
# Non-Semantic Field Bypass Prevention
# ──────────────────────────────────────────────────────────

class TestBypassPrevention:
    """Verifies that provider, arguments, original_tool_name, raw_data
    cannot influence governance decisions."""

    def setup_method(self):
        self.engine = PolicyFusionEngine()

    def test_provider_cannot_influence_decision(self):
        """Changing provider does not change the governance decision."""
        action_a = _make_action(provider="provider_a")
        action_b = _make_action(provider="provider_b")
        auth_a = _make_auth_result(AuthorizationStatus.AUTHORIZED, action_a)
        auth_b = _make_auth_result(AuthorizationStatus.AUTHORIZED, action_b)
        result_a = self.engine.evaluate(action_a, Severity.LOW, auth_a, [])
        result_b = self.engine.evaluate(action_b, Severity.LOW, auth_b, [])
        assert result_a.decision == result_b.decision

    def test_arguments_cannot_influence_decision(self):
        """Changing arguments does not change the governance decision."""
        action_a = _make_action(arguments={"key": "value_a"})
        action_b = _make_action(arguments={"key": "value_b"})
        auth_a = _make_auth_result(AuthorizationStatus.AUTHORIZED, action_a)
        auth_b = _make_auth_result(AuthorizationStatus.AUTHORIZED, action_b)
        result_a = self.engine.evaluate(action_a, Severity.LOW, auth_a, [])
        result_b = self.engine.evaluate(action_b, Severity.LOW, auth_b, [])
        assert result_a.decision == result_b.decision

    def test_original_tool_name_cannot_influence_decision(self):
        """Changing original_tool_name does not change the governance decision."""
        action_a = _make_action(original_tool_name="tool_a")
        action_b = _make_action(original_tool_name="tool_b")
        auth_a = _make_auth_result(AuthorizationStatus.AUTHORIZED, action_a)
        auth_b = _make_auth_result(AuthorizationStatus.AUTHORIZED, action_b)
        result_a = self.engine.evaluate(action_a, Severity.LOW, auth_a, [])
        result_b = self.engine.evaluate(action_b, Severity.LOW, auth_b, [])
        assert result_a.decision == result_b.decision

    def test_raw_data_cannot_influence_decision(self):
        """Changing raw_data does not change the governance decision."""
        action_a = _make_action()
        action_a_raw = action_a.model_copy(update={"raw_data": {"secret": "value_a"}})
        action_b = _make_action()
        action_b_raw = action_b.model_copy(update={"raw_data": {"secret": "value_b"}})
        auth_a = _make_auth_result(AuthorizationStatus.AUTHORIZED, action_a_raw)
        auth_b = _make_auth_result(AuthorizationStatus.AUTHORIZED, action_b_raw)
        result_a = self.engine.evaluate(action_a_raw, Severity.LOW, auth_a, [])
        result_b = self.engine.evaluate(action_b_raw, Severity.LOW, auth_b, [])
        assert result_a.decision == result_b.decision


# ──────────────────────────────────────────────────────────
# Immutability
# ──────────────────────────────────────────────────────────

class TestImmutability:
    """Verifies M7 models are frozen and inputs are not mutated."""

    def setup_method(self):
        self.engine = PolicyFusionEngine()
        self.action = _make_action()

    def test_governance_policy_frozen(self):
        """GovernancePolicy is frozen (cannot modify attributes)."""
        policy = _make_policy("p1", GovernanceDecision.BLOCK)
        with pytest.raises(dataclasses.FrozenInstanceError):
            policy.priority = 99

    def test_policy_condition_frozen(self):
        """PolicyCondition is frozen."""
        cond = PolicyCondition()
        with pytest.raises(dataclasses.FrozenInstanceError):
            cond.risk_severities = frozenset([Severity.LOW])

    def test_governance_reason_frozen(self):
        """GovernanceReason is frozen."""
        reason = GovernanceReason(
            rule_type="test", description="test",
        )
        with pytest.raises(dataclasses.FrozenInstanceError):
            reason.rule_type = "changed"

    def test_action_decision_record_frozen(self):
        """ActionDecisionRecord is frozen."""
        result = self.engine.evaluate(
            self.action, Severity.LOW,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action), [],
        )
        with pytest.raises(dataclasses.FrozenInstanceError):
            result.decision = GovernanceDecision.BLOCK

    def test_m5_input_not_mutated(self):
        """M5 RiskAssessment input (severity) is not mutated by evaluation."""
        from src.agentsentinel.risk.models import RiskAssessment, EvidenceQuality
        risk = RiskAssessment(
            overall_severity=Severity.LOW,
            evidence_quality=EvidenceQuality.COMPLETE,
        )
        severity_before = risk.overall_severity
        self.engine.evaluate(
            self.action, risk.overall_severity,
            _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action), [],
        )
        assert risk.overall_severity == severity_before

    def test_m6_input_not_mutated(self):
        """M6 ActionAuthorizationResult is not mutated by evaluation."""
        auth = _make_auth_result(AuthorizationStatus.AUTHORIZED, self.action)
        status_before = auth.status
        reasons_before = auth.reasons
        self.engine.evaluate(self.action, Severity.LOW, auth, [])
        assert auth.status == status_before
        assert auth.reasons == reasons_before


# ──────────────────────────────────────────────────────────
# Determinism
# ──────────────────────────────────────────────────────────

class TestDeterminism:
    """Verifies repeated evaluation produces identical results."""

    def test_deterministic_repeated_evaluation(self):
        """Same inputs → same result, always."""
        engine = PolicyFusionEngine()
        action = _make_action()
        auth = _make_auth_result(AuthorizationStatus.AUTHORIZED, action)
        policies = [
            _make_policy("alert_high", GovernanceDecision.ALERT,
                         risk_severities=[Severity.HIGH]),
            _make_policy("block_critical", GovernanceDecision.BLOCK,
                         risk_severities=[Severity.CRITICAL]),
        ]
        results = []
        for _ in range(10):
            result = engine.evaluate(action, Severity.HIGH, auth, policies)
            results.append(result)

        for r in results:
            assert r.decision == results[0].decision
            assert r.matched_policy == results[0].matched_policy
            assert r.reasons == results[0].reasons

    def test_deterministic_with_multiple_same_tier_policies(self):
        """Multiple policies in the same tier produce deterministic results."""
        engine = PolicyFusionEngine()
        action = _make_action()
        auth = _make_auth_result(AuthorizationStatus.AUTHORIZED, action)
        policies = [
            _make_policy("z_block", GovernanceDecision.BLOCK, priority=5),
            _make_policy("a_block", GovernanceDecision.BLOCK, priority=5),
            _make_policy("m_block", GovernanceDecision.BLOCK, priority=5),
        ]
        results = set()
        for _ in range(10):
            result = engine.evaluate(action, Severity.LOW, auth, policies)
            results.add(result.matched_policy.policy_id)
        assert len(results) == 1
        assert "a_block" in results


# ──────────────────────────────────────────────────────────
# M5 / M6 Engine Isolation
# ──────────────────────────────────────────────────────────

class TestEngineIsolation:
    """Verifies M7 does not import or invoke M5/M6 engine logic."""

    def test_m7_does_not_import_m5_engine(self):
        """governance.engine does not import BehavioralRiskEngine."""
        import src.agentsentinel.governance.engine as ge
        source = open(ge.__file__, "r").read()
        assert "BehavioralRiskEngine" not in source
        assert "from src.agentsentinel.risk.engine" not in source
        assert "import src.agentsentinel.risk.engine" not in source

    def test_m7_does_not_import_m6_engine(self):
        """governance.engine does not import TaskContextAuthorizer."""
        import src.agentsentinel.governance.engine as ge
        source = open(ge.__file__, "r").read()
        assert "TaskContextAuthorizer" not in source
        assert "from src.agentsentinel.authorization.engine" not in source
        assert "import src.agentsentinel.authorization.engine" not in source

    def test_m7_models_do_not_import_m5_engine(self):
        """governance.models does not import M5 engine."""
        import src.agentsentinel.governance.models as gm
        source = open(gm.__file__, "r").read()
        assert "BehavioralRiskEngine" not in source
        assert "from src.agentsentinel.risk.engine" not in source

    def test_m7_models_do_not_import_m6_engine(self):
        """governance.models does not import M6 engine."""
        import src.agentsentinel.governance.models as gm
        source = open(gm.__file__, "r").read()
        assert "TaskContextAuthorizer" not in source
        assert "from src.agentsentinel.authorization.engine" not in source
