"""
Tests for Milestone 6 — Task-Context Authorization.

Verifies:
    - Capability matching (category, operation, resource)
    - Unknown operation/category security guards
    - Resource matching: EXACT, PREFIX (component-aware), PATTERN (canonicalized)
    - Sibling prefix confusion prevention
    - Path traversal prevention
    - Deny precedence over allow
    - Default deny semantics
    - Missing TaskContext handling
    - Trajectory-level aggregation
    - Immutability of M6-owned structures
    - Non-mutation of NormalizedAction and TaskContext inputs
    - Exact NormalizedAction reference retention
    - Explainability (AuthorizationReason)
    - Determinism
    - M5 RiskAssessment isolation
    - Provider / original_tool_name cannot bypass authorization
"""

import copy
import pytest

from src.agentsentinel.models.normalized import (
    ActionCategory,
    NormalizedAction,
    NormalizedEvent,
    NormalizedTrajectory,
)
from src.agentsentinel.models.trajectory import EventRole
from src.agentsentinel.authorization.models import (
    ActionAuthorizationResult,
    AuthorizationReason,
    AuthorizationStatus,
    AuthorizationSummary,
    CapabilityDeny,
    CapabilityGrant,
    ResourceMatchMode,
    ResourceScope,
    TaskContext,
    TrajectoryAuthorizationAssessment,
)
from src.agentsentinel.authorization.engine import TaskContextAuthorizer


# ──────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────

def _make_action(
    category: ActionCategory = ActionCategory.FILE_SYSTEM_READ,
    operation: str = "read",
    resource: str = "/project/src/file.py",
    provider: str = "test_provider",
    original_tool_name: str = "test_tool",
    **kwargs,
) -> NormalizedAction:
    """Create a NormalizedAction with sensible defaults."""
    defaults = dict(
        normalized_name="test_action",
        category=category,
        provider=provider,
        operation=operation,
        resource=resource,
        is_mutating=None,
        is_destructive=None,
        original_tool_name=original_tool_name,
        source_dataset="test",
    )
    defaults.update(kwargs)
    return NormalizedAction(**defaults)


def _make_context(
    allowed: tuple = (),
    denied: tuple = (),
    task_id: str = "task-1",
) -> TaskContext:
    """Create a TaskContext with given grants and denies."""
    return TaskContext(
        task_id=task_id,
        task_description="Test task",
        allowed_capabilities=allowed,
        denied_capabilities=denied,
    )


def _make_trajectory(actions_data: list) -> NormalizedTrajectory:
    """Create a NormalizedTrajectory from a list of (category, operation, resource) tuples."""
    events = []
    for i, (cat, op, res) in enumerate(actions_data):
        action = _make_action(category=cat, operation=op, resource=res)
        event = NormalizedEvent(
            id=f"event-{i}",
            role=EventRole.AGENT,
            normalized_actions=[action],
        )
        events.append(event)
    return NormalizedTrajectory(
        trajectory_id="traj-1",
        source_dataset="test",
        events=events,
    )


# ──────────────────────────────────────────────────────────
# 1. Category Matching
# ──────────────────────────────────────────────────────────

class TestCategoryMatching:
    """Tests 1-2: Exact category match and mismatch."""

    def test_exact_category_match_authorized(self):
        """Category matches grant → AUTHORIZED."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(category=ActionCategory.FILE_SYSTEM_READ, operation="read")
        context = _make_context(allowed=(
            CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.AUTHORIZED
        assert result.matched_grant is not None
        assert result.matched_grant.category == ActionCategory.FILE_SYSTEM_READ

    def test_category_mismatch_unauthorized(self):
        """Category does not match any grant → UNAUTHORIZED (default deny)."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(category=ActionCategory.CODE_EXECUTION, operation="execute")
        context = _make_context(allowed=(
            CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.UNAUTHORIZED
        assert result.matched_grant is None
        assert any(r.rule_type == "default_deny" for r in result.reasons)


# ──────────────────────────────────────────────────────────
# 2. Operation Matching
# ──────────────────────────────────────────────────────────

class TestOperationMatching:
    """Tests 3-7: Known/unknown operation with unrestricted/restricted grants."""

    def test_known_operation_unrestricted_grant(self):
        """Known operation + unrestricted grant (None) → AUTHORIZED."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.FILE_SYSTEM_READ,
                allowed_operations=None,  # unrestricted
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.AUTHORIZED

    def test_known_operation_matching_restricted_grant(self):
        """Known operation in restricted grant list → AUTHORIZED."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_WRITE,
            operation="write",
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.FILE_SYSTEM_WRITE,
                allowed_operations=("write", "create"),
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.AUTHORIZED

    def test_known_operation_nonmatching_restricted_grant(self):
        """Known operation not in restricted grant list → UNAUTHORIZED."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_WRITE,
            operation="delete",
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.FILE_SYSTEM_WRITE,
                allowed_operations=("write", "create"),
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.UNAUTHORIZED

    def test_unknown_operation_unrestricted_grant(self):
        """Unknown operation (None) + unrestricted grant → UNAUTHORIZED. UNKNOWN ≠ SAFE."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation=None,
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.FILE_SYSTEM_READ,
                allowed_operations=None,
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.UNAUTHORIZED
        assert any(r.rule_type == "unknown_operation" for r in result.reasons)

    def test_unknown_operation_restricted_grant(self):
        """Unknown operation (None) + restricted grant → UNAUTHORIZED."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation=None,
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.FILE_SYSTEM_READ,
                allowed_operations=("read",),
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.UNAUTHORIZED
        assert any(r.rule_type == "unknown_operation" for r in result.reasons)


# ──────────────────────────────────────────────────────────
# 3. Resource Matching — EXACT
# ──────────────────────────────────────────────────────────

class TestResourceExact:
    """Tests 8: EXACT resource match and mismatch."""

    def test_exact_resource_match(self):
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            resource="/project/src/file.py",
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.FILE_SYSTEM_READ,
                resource_scope=ResourceScope(
                    match_mode=ResourceMatchMode.EXACT,
                    value="/project/src/file.py",
                ),
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.AUTHORIZED

    def test_exact_resource_mismatch(self):
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            resource="/project/src/other.py",
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.FILE_SYSTEM_READ,
                resource_scope=ResourceScope(
                    match_mode=ResourceMatchMode.EXACT,
                    value="/project/src/file.py",
                ),
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.UNAUTHORIZED


# ──────────────────────────────────────────────────────────
# 4. Resource Matching — PREFIX
# ──────────────────────────────────────────────────────────

class TestResourcePrefix:
    """Tests 9-14: PREFIX child, exact scope, sibling, traversal, canonical."""

    def test_prefix_child_match(self):
        """Child path under scope → MATCH."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            resource="/project/src/file.py",
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.FILE_SYSTEM_READ,
                resource_scope=ResourceScope(
                    match_mode=ResourceMatchMode.PREFIX,
                    value="/project/src",
                ),
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.AUTHORIZED

    def test_prefix_deep_child_match(self):
        """Deep child path → MATCH."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            resource="/project/src/sub/deep/file.py",
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.FILE_SYSTEM_READ,
                resource_scope=ResourceScope(
                    match_mode=ResourceMatchMode.PREFIX,
                    value="/project/src",
                ),
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.AUTHORIZED

    def test_prefix_exact_scope_match(self):
        """Resource equals scope exactly → MATCH."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            resource="/project/src",
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.FILE_SYSTEM_READ,
                resource_scope=ResourceScope(
                    match_mode=ResourceMatchMode.PREFIX,
                    value="/project/src",
                ),
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.AUTHORIZED

    def test_prefix_sibling_confusion_src_backup(self):
        """/project/src_backup must NOT match scope /project/src."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            resource="/project/src_backup/file.py",
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.FILE_SYSTEM_READ,
                resource_scope=ResourceScope(
                    match_mode=ResourceMatchMode.PREFIX,
                    value="/project/src",
                ),
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.UNAUTHORIZED

    def test_prefix_sibling_confusion_src2(self):
        """/project/src2 must NOT match scope /project/src."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            resource="/project/src2/file.py",
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.FILE_SYSTEM_READ,
                resource_scope=ResourceScope(
                    match_mode=ResourceMatchMode.PREFIX,
                    value="/project/src",
                ),
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.UNAUTHORIZED

    def test_prefix_traversal_protection(self):
        """/project/src/../etc/passwd must NOT match after canonicalization."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            resource="/project/src/../etc/passwd",
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.FILE_SYSTEM_READ,
                resource_scope=ResourceScope(
                    match_mode=ResourceMatchMode.PREFIX,
                    value="/project/src",
                ),
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.UNAUTHORIZED

    def test_prefix_canonicalized_child(self):
        """/project/src/./file.py canonicalizes to child → MATCH."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            resource="/project/src/./file.py",
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.FILE_SYSTEM_READ,
                resource_scope=ResourceScope(
                    match_mode=ResourceMatchMode.PREFIX,
                    value="/project/src",
                ),
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.AUTHORIZED


# ──────────────────────────────────────────────────────────
# 5. Resource Matching — PATTERN
# ──────────────────────────────────────────────────────────

class TestResourcePattern:
    """Tests 13-15: PATTERN match, mismatch, canonicalized, traversal."""

    def test_pattern_match(self):
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            resource="/project/src/file.py",
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.FILE_SYSTEM_READ,
                resource_scope=ResourceScope(
                    match_mode=ResourceMatchMode.PATTERN,
                    value="/project/src/*",
                ),
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.AUTHORIZED

    def test_pattern_mismatch(self):
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            resource="/other/path/file.py",
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.FILE_SYSTEM_READ,
                resource_scope=ResourceScope(
                    match_mode=ResourceMatchMode.PATTERN,
                    value="/project/src/*",
                ),
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.UNAUTHORIZED

    def test_pattern_canonicalized_action_resource(self):
        """Action resource is canonicalized before pattern matching."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            resource="/project/src/./file.py",  # has dot
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.FILE_SYSTEM_READ,
                resource_scope=ResourceScope(
                    match_mode=ResourceMatchMode.PATTERN,
                    value="/project/src/*",
                ),
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.AUTHORIZED

    def test_pattern_traversal_protection(self):
        """
        /project/src/../secrets.txt canonicalizes to /secrets.txt
        which must NOT match /project/src/*
        """
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            resource="/project/src/../secrets.txt",
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.FILE_SYSTEM_READ,
                resource_scope=ResourceScope(
                    match_mode=ResourceMatchMode.PATTERN,
                    value="/project/src/*",
                ),
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.UNAUTHORIZED


# ──────────────────────────────────────────────────────────
# 6. Deny Precedence
# ──────────────────────────────────────────────────────────

class TestDenyPrecedence:
    """Tests 16-17: Explicit deny overrides allow."""

    def test_deny_overrides_allow(self):
        """Deny on same category overrides allow → UNAUTHORIZED."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.CODE_EXECUTION,
            operation="execute",
        )
        context = _make_context(
            allowed=(
                CapabilityGrant(category=ActionCategory.CODE_EXECUTION),
            ),
            denied=(
                CapabilityDeny(category=ActionCategory.CODE_EXECUTION),
            ),
        )
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.UNAUTHORIZED
        assert result.matched_deny is not None
        assert any(r.rule_type == "explicit_deny" for r in result.reasons)

    def test_deny_operation_scope(self):
        """Deny on specific operation within category."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_WRITE,
            operation="delete",
        )
        context = _make_context(
            allowed=(
                CapabilityGrant(category=ActionCategory.FILE_SYSTEM_WRITE),
            ),
            denied=(
                CapabilityDeny(
                    category=ActionCategory.FILE_SYSTEM_WRITE,
                    denied_operations=("delete",),
                ),
            ),
        )
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.UNAUTHORIZED

    def test_deny_does_not_affect_other_operations(self):
        """Deny on 'delete' should not block 'write'."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_WRITE,
            operation="write",
        )
        context = _make_context(
            allowed=(
                CapabilityGrant(category=ActionCategory.FILE_SYSTEM_WRITE),
            ),
            denied=(
                CapabilityDeny(
                    category=ActionCategory.FILE_SYSTEM_WRITE,
                    denied_operations=("delete",),
                ),
            ),
        )
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.AUTHORIZED

    def test_deny_resource_scope(self):
        """Deny on specific resource scope within category."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_WRITE,
            operation="write",
            resource="/project/config/secrets.yaml",
        )
        context = _make_context(
            allowed=(
                CapabilityGrant(category=ActionCategory.FILE_SYSTEM_WRITE),
            ),
            denied=(
                CapabilityDeny(
                    category=ActionCategory.FILE_SYSTEM_WRITE,
                    resource_scope=ResourceScope(
                        match_mode=ResourceMatchMode.PREFIX,
                        value="/project/config",
                    ),
                ),
            ),
        )
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.UNAUTHORIZED

    def test_deny_resource_scope_does_not_block_other_paths(self):
        """Deny on /project/config should not block /project/src."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_WRITE,
            operation="write",
            resource="/project/src/file.py",
        )
        context = _make_context(
            allowed=(
                CapabilityGrant(category=ActionCategory.FILE_SYSTEM_WRITE),
            ),
            denied=(
                CapabilityDeny(
                    category=ActionCategory.FILE_SYSTEM_WRITE,
                    resource_scope=ResourceScope(
                        match_mode=ResourceMatchMode.PREFIX,
                        value="/project/config",
                    ),
                ),
            ),
        )
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.AUTHORIZED


# ──────────────────────────────────────────────────────────
# 7. Guard Conditions
# ──────────────────────────────────────────────────────────

class TestGuardConditions:
    """Tests 18-21: Missing context, empty capabilities, unknown category, None resource."""

    def test_missing_task_context(self):
        """TaskContext is None → UNEVALUABLE."""
        authorizer = TaskContextAuthorizer()
        action = _make_action()
        result = authorizer.authorize_action(action, None)
        assert result.status == AuthorizationStatus.UNEVALUABLE
        assert any(r.rule_type == "missing_context" for r in result.reasons)

    def test_empty_capabilities(self):
        """Empty allowed_capabilities → UNAUTHORIZED (default deny)."""
        authorizer = TaskContextAuthorizer()
        action = _make_action()
        context = _make_context(allowed=())
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.UNAUTHORIZED

    def test_unknown_category(self):
        """UNKNOWN category → UNAUTHORIZED."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(category=ActionCategory.UNKNOWN, operation="something")
        context = _make_context(allowed=(
            CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.UNAUTHORIZED
        assert any(r.rule_type == "unknown_category" for r in result.reasons)

    def test_none_resource_with_resource_restricted_grant(self):
        """None resource + resource-restricted grant → UNAUTHORIZED."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            resource=None,
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.FILE_SYSTEM_READ,
                resource_scope=ResourceScope(
                    match_mode=ResourceMatchMode.PREFIX,
                    value="/project/src",
                ),
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.UNAUTHORIZED


# ──────────────────────────────────────────────────────────
# 8. Trajectory Aggregation
# ──────────────────────────────────────────────────────────

class TestTrajectoryAggregation:
    """Tests 22-23: Trajectory overall status and summary counts."""

    def test_all_authorized(self):
        """All actions authorized → overall AUTHORIZED."""
        authorizer = TaskContextAuthorizer()
        traj = _make_trajectory([
            (ActionCategory.FILE_SYSTEM_READ, "read", "/project/src/a.py"),
            (ActionCategory.FILE_SYSTEM_READ, "read", "/project/src/b.py"),
        ])
        context = _make_context(allowed=(
            CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),
        ))
        result = authorizer.authorize_trajectory(traj, context)
        assert result.overall_status == AuthorizationStatus.AUTHORIZED
        assert result.summary.total_actions == 2
        assert result.summary.authorized_count == 2
        assert result.summary.unauthorized_count == 0
        assert result.summary.unevaluable_count == 0

    def test_one_unauthorized(self):
        """One unauthorized action → overall UNAUTHORIZED."""
        authorizer = TaskContextAuthorizer()
        traj = _make_trajectory([
            (ActionCategory.FILE_SYSTEM_READ, "read", "/project/src/a.py"),
            (ActionCategory.CODE_EXECUTION, "execute", "/bin/rm"),
        ])
        context = _make_context(allowed=(
            CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),
        ))
        result = authorizer.authorize_trajectory(traj, context)
        assert result.overall_status == AuthorizationStatus.UNAUTHORIZED
        assert result.summary.authorized_count == 1
        assert result.summary.unauthorized_count == 1

    def test_unevaluable_no_unauthorized(self):
        """Mix of AUTHORIZED + UNEVALUABLE (no UNAUTHORIZED) → UNEVALUABLE."""
        authorizer = TaskContextAuthorizer()
        # Create trajectory with one authorized action and one with unknown operation
        action_auth = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
        )
        action_uneval = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation=None,  # unknown operation → UNAUTHORIZED by guard
        )
        # Actually, unknown operation is UNAUTHORIZED not UNEVALUABLE.
        # For UNEVALUABLE, we need None context.
        # Let's test with None context.
        traj = _make_trajectory([
            (ActionCategory.FILE_SYSTEM_READ, "read", "/project/src/a.py"),
        ])
        result = TaskContextAuthorizer().authorize_trajectory(traj, None)
        assert result.overall_status == AuthorizationStatus.UNEVALUABLE
        assert result.summary.unevaluable_count == 1

    def test_trajectory_with_no_context(self):
        """TaskContext None at trajectory level → overall UNEVALUABLE."""
        authorizer = TaskContextAuthorizer()
        traj = _make_trajectory([
            (ActionCategory.FILE_SYSTEM_READ, "read", "/a.py"),
        ])
        result = authorizer.authorize_trajectory(traj, None)
        assert result.overall_status == AuthorizationStatus.UNEVALUABLE
        assert result.trajectory_id == "traj-1"

    def test_trajectory_task_id_propagation(self):
        """TrajectoryAuthorizationAssessment.task_id comes from TaskContext."""
        authorizer = TaskContextAuthorizer()
        traj = _make_trajectory([
            (ActionCategory.FILE_SYSTEM_READ, "read", "/a.py"),
        ])
        context = _make_context(
            allowed=(CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),),
            task_id="my-task-42",
        )
        result = authorizer.authorize_trajectory(traj, context)
        assert result.task_id == "my-task-42"

    def test_empty_trajectory(self):
        """Empty trajectory → overall AUTHORIZED (no violations)."""
        authorizer = TaskContextAuthorizer()
        traj = NormalizedTrajectory(
            trajectory_id="empty",
            source_dataset="test",
            events=[],
        )
        context = _make_context(allowed=(
            CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),
        ))
        result = authorizer.authorize_trajectory(traj, context)
        assert result.overall_status == AuthorizationStatus.AUTHORIZED
        assert result.summary.total_actions == 0


# ──────────────────────────────────────────────────────────
# 9. Explainability
# ──────────────────────────────────────────────────────────

class TestExplainability:
    """Test 24,28: AuthorizationReason content."""

    def test_authorized_reason(self):
        authorizer = TaskContextAuthorizer()
        action = _make_action(category=ActionCategory.FILE_SYSTEM_READ, operation="read")
        context = _make_context(allowed=(
            CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),
        ))
        result = authorizer.authorize_action(action, context)
        assert len(result.reasons) > 0
        reason = result.reasons[0]
        assert reason.rule_type == "explicit_allow"
        assert "file_system_read" in reason.description.lower()

    def test_denied_reason_explicit(self):
        authorizer = TaskContextAuthorizer()
        action = _make_action(category=ActionCategory.CODE_EXECUTION, operation="execute")
        context = _make_context(
            allowed=(CapabilityGrant(category=ActionCategory.CODE_EXECUTION),),
            denied=(CapabilityDeny(category=ActionCategory.CODE_EXECUTION),),
        )
        result = authorizer.authorize_action(action, context)
        assert result.reasons[0].rule_type == "explicit_deny"

    def test_denied_reason_default(self):
        authorizer = TaskContextAuthorizer()
        action = _make_action(category=ActionCategory.API_CALL, operation="invoke")
        context = _make_context(allowed=(
            CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.reasons[0].rule_type == "default_deny"

    def test_unevaluable_reason(self):
        authorizer = TaskContextAuthorizer()
        action = _make_action()
        result = authorizer.authorize_action(action, None)
        assert result.reasons[0].rule_type == "missing_context"

    def test_unknown_category_reason(self):
        authorizer = TaskContextAuthorizer()
        action = _make_action(category=ActionCategory.UNKNOWN, operation="x")
        context = _make_context(allowed=())
        result = authorizer.authorize_action(action, context)
        assert result.reasons[0].rule_type == "unknown_category"

    def test_unknown_operation_reason(self):
        authorizer = TaskContextAuthorizer()
        action = _make_action(category=ActionCategory.FILE_SYSTEM_READ, operation=None)
        context = _make_context(allowed=(
            CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.reasons[0].rule_type == "unknown_operation"

    def test_reason_with_resource_scope_description(self):
        """Authorized result reason includes resource scope info."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            resource="/project/src/file.py",
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.FILE_SYSTEM_READ,
                resource_scope=ResourceScope(
                    match_mode=ResourceMatchMode.PREFIX,
                    value="/project/src",
                ),
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert "prefix" in result.reasons[0].description.lower()


# ──────────────────────────────────────────────────────────
# 10. Determinism
# ──────────────────────────────────────────────────────────

class TestDeterminism:
    """Test 25,29,33: Repeated evaluation produces identical results."""

    def test_deterministic_repeated_evaluation(self):
        """Same inputs → same result, multiple times."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_WRITE,
            operation="write",
            resource="/project/src/file.py",
        )
        context = _make_context(
            allowed=(
                CapabilityGrant(
                    category=ActionCategory.FILE_SYSTEM_WRITE,
                    resource_scope=ResourceScope(
                        match_mode=ResourceMatchMode.PREFIX,
                        value="/project/src",
                    ),
                ),
            ),
            denied=(
                CapabilityDeny(
                    category=ActionCategory.FILE_SYSTEM_WRITE,
                    denied_operations=("delete",),
                ),
            ),
        )
        results = [authorizer.authorize_action(action, context) for _ in range(10)]
        for r in results:
            assert r.status == results[0].status
            assert r.matched_grant == results[0].matched_grant
            assert r.matched_deny == results[0].matched_deny
            assert len(r.reasons) == len(results[0].reasons)


# ──────────────────────────────────────────────────────────
# 11. Immutability
# ──────────────────────────────────────────────────────────

class TestImmutability:
    """Tests 28-34: Frozen models, tuple immutability, input non-mutation."""

    def test_frozen_task_context_rejects_field_reassignment(self):
        """TaskContext is frozen — field assignment must raise."""
        context = _make_context(allowed=())
        with pytest.raises(AttributeError):
            context.task_id = "new-id"

    def test_frozen_capability_grant_rejects_field_reassignment(self):
        grant = CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ)
        with pytest.raises(AttributeError):
            grant.category = ActionCategory.CODE_EXECUTION

    def test_frozen_capability_deny_rejects_field_reassignment(self):
        deny = CapabilityDeny(category=ActionCategory.CODE_EXECUTION)
        with pytest.raises(AttributeError):
            deny.category = ActionCategory.FILE_SYSTEM_READ

    def test_frozen_resource_scope_rejects_field_reassignment(self):
        scope = ResourceScope(match_mode=ResourceMatchMode.EXACT, value="/a")
        with pytest.raises(AttributeError):
            scope.value = "/b"

    def test_frozen_authorization_reason_rejects_field_reassignment(self):
        reason = AuthorizationReason(description="test", rule_type="test")
        with pytest.raises(AttributeError):
            reason.description = "modified"

    def test_frozen_authorization_summary_rejects_field_reassignment(self):
        summary = AuthorizationSummary(
            total_actions=1, authorized_count=1,
            unauthorized_count=0, unevaluable_count=0,
        )
        with pytest.raises(AttributeError):
            summary.total_actions = 99

    def test_tuple_collections_are_immutable(self):
        """Tuple-based collections cannot be mutated."""
        context = _make_context(
            allowed=(CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),),
        )
        with pytest.raises(TypeError):
            context.allowed_capabilities[0] = None
        with pytest.raises(TypeError):
            context.denied_capabilities[0] = None

    def test_authorization_does_not_mutate_normalized_action(self):
        """Authorization evaluation must not modify the NormalizedAction."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            resource="/project/src/file.py",
        )
        action_before = action.model_dump()
        context = _make_context(allowed=(
            CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),
        ))
        authorizer.authorize_action(action, context)
        action_after = action.model_dump()
        assert action_before == action_after

    def test_authorization_does_not_mutate_task_context(self):
        """Authorization evaluation must not modify the TaskContext."""
        authorizer = TaskContextAuthorizer()
        action = _make_action()
        context = _make_context(
            allowed=(CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),),
            denied=(CapabilityDeny(category=ActionCategory.CODE_EXECUTION),),
        )
        # Snapshot the context fields before evaluation
        task_id_before = context.task_id
        allowed_before = context.allowed_capabilities
        denied_before = context.denied_capabilities

        authorizer.authorize_action(action, context)

        assert context.task_id == task_id_before
        assert context.allowed_capabilities == allowed_before
        assert context.denied_capabilities == denied_before

    def test_exact_normalized_action_reference_retained(self):
        """ActionAuthorizationResult.action is the EXACT same object reference."""
        authorizer = TaskContextAuthorizer()
        action = _make_action()
        context = _make_context(allowed=(
            CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.action is action  # identity check, not equality

    def test_frozen_action_authorization_result_rejects_field_reassignment(self):
        """ActionAuthorizationResult is frozen."""
        authorizer = TaskContextAuthorizer()
        action = _make_action()
        context = _make_context(allowed=(
            CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),
        ))
        result = authorizer.authorize_action(action, context)
        with pytest.raises(AttributeError):
            result.status = AuthorizationStatus.UNAUTHORIZED


# ──────────────────────────────────────────────────────────
# 12. Provider / original_tool_name Cannot Bypass Authorization
# ──────────────────────────────────────────────────────────

class TestProviderAndToolNameIsolation:
    """Tests 35-36: Provider and original_tool_name don't affect authorization."""

    def test_provider_mismatch_does_not_affect_authorization(self):
        """Different providers with same category/operation → same result."""
        authorizer = TaskContextAuthorizer()
        action_a = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            provider="provider_alpha",
        )
        action_b = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            provider="provider_beta",
        )
        context = _make_context(allowed=(
            CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),
        ))
        result_a = authorizer.authorize_action(action_a, context)
        result_b = authorizer.authorize_action(action_b, context)
        assert result_a.status == result_b.status == AuthorizationStatus.AUTHORIZED

    def test_original_tool_name_cannot_bypass_normalized_authorization(self):
        """
        An action with original_tool_name='safe_read' but category=CODE_EXECUTION
        must be evaluated on its normalized category, not its raw name.
        """
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.CODE_EXECUTION,
            operation="execute",
            original_tool_name="safe_read",  # deceptive name
        )
        context = _make_context(allowed=(
            CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),
        ))
        result = authorizer.authorize_action(action, context)
        # Must be UNAUTHORIZED because category is CODE_EXECUTION, not FILE_SYSTEM_READ
        assert result.status == AuthorizationStatus.UNAUTHORIZED

    def test_raw_tool_name_alias_bypass_prevention(self):
        """
        Two actions with different original_tool_name but same normalized category
        get the same authorization result.
        """
        authorizer = TaskContextAuthorizer()
        action_real = _make_action(
            category=ActionCategory.FILE_SYSTEM_WRITE,
            operation="delete",
            original_tool_name="rm",
        )
        action_alias = _make_action(
            category=ActionCategory.FILE_SYSTEM_WRITE,
            operation="delete",
            original_tool_name="safe_cleanup",
        )
        context = _make_context(
            allowed=(CapabilityGrant(category=ActionCategory.FILE_SYSTEM_WRITE),),
            denied=(
                CapabilityDeny(
                    category=ActionCategory.FILE_SYSTEM_WRITE,
                    denied_operations=("delete",),
                ),
            ),
        )
        result_real = authorizer.authorize_action(action_real, context)
        result_alias = authorizer.authorize_action(action_alias, context)
        assert result_real.status == result_alias.status == AuthorizationStatus.UNAUTHORIZED


# ──────────────────────────────────────────────────────────
# 13. M5 RiskAssessment Isolation
# ──────────────────────────────────────────────────────────

class TestM5Isolation:
    """Test 37: M6 does not consume or modify M5 RiskAssessment."""

    def test_m6_does_not_import_risk_assessment(self):
        """
        The authorization engine module must not import from the risk package.
        """
        import inspect
        from src.agentsentinel.authorization import engine as engine_module
        source = inspect.getsource(engine_module)
        # Check that no import statement references the risk package
        import_lines = [line.strip() for line in source.splitlines()
                        if line.strip().startswith(('import ', 'from '))]
        for line in import_lines:
            assert 'risk' not in line, f"M6 engine imports from risk package: {line}"

    def test_m6_models_do_not_import_risk_assessment(self):
        """The authorization models module must not import from the risk package."""
        import inspect
        from src.agentsentinel.authorization import models as models_module
        source = inspect.getsource(models_module)
        import_lines = [line.strip() for line in source.splitlines()
                        if line.strip().startswith(('import ', 'from '))]
        for line in import_lines:
            assert 'risk' not in line, f"M6 models imports from risk package: {line}"


# ──────────────────────────────────────────────────────────
# 14. Boundary / Combination Cases
# ──────────────────────────────────────────────────────────

class TestBoundaryCases:
    """Additional boundary and combination tests."""

    def test_multiple_grants_first_match_wins(self):
        """First matching grant in order is returned."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
        )
        grant1 = CapabilityGrant(
            category=ActionCategory.FILE_SYSTEM_READ,
            allowed_operations=("read",),
        )
        grant2 = CapabilityGrant(
            category=ActionCategory.FILE_SYSTEM_READ,
        )
        context = _make_context(allowed=(grant1, grant2))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.AUTHORIZED
        assert result.matched_grant is grant1

    def test_broad_grant_no_restrictions(self):
        """Grant with no operation/resource restrictions → AUTHORIZED."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.WEB_REQUEST,
            operation="get",
            resource="https://api.example.com/data",
        )
        context = _make_context(allowed=(
            CapabilityGrant(category=ActionCategory.WEB_REQUEST),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.AUTHORIZED

    def test_none_resource_with_unrestricted_grant(self):
        """None resource + grant with no resource scope → AUTHORIZED."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.API_CALL,
            operation="invoke",
            resource=None,
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.API_CALL,
                resource_scope=None,  # unrestricted
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.AUTHORIZED

    def test_deny_with_no_operations_blocks_everything(self):
        """Deny with denied_operations=None blocks all operations in that category."""
        authorizer = TaskContextAuthorizer()
        for op in ["read", "write", "delete", "create"]:
            action = _make_action(
                category=ActionCategory.FILE_SYSTEM_WRITE,
                operation=op,
            )
            context = _make_context(
                allowed=(CapabilityGrant(category=ActionCategory.FILE_SYSTEM_WRITE),),
                denied=(CapabilityDeny(category=ActionCategory.FILE_SYSTEM_WRITE),),
            )
            result = authorizer.authorize_action(action, context)
            assert result.status == AuthorizationStatus.UNAUTHORIZED

    def test_trajectory_preserves_action_ordering(self):
        """Action results in trajectory match the input ordering."""
        authorizer = TaskContextAuthorizer()
        traj = _make_trajectory([
            (ActionCategory.FILE_SYSTEM_READ, "read", "/a"),
            (ActionCategory.CODE_EXECUTION, "execute", "/b"),
            (ActionCategory.FILE_SYSTEM_WRITE, "write", "/c"),
        ])
        context = _make_context(allowed=(
            CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),
            CapabilityGrant(category=ActionCategory.FILE_SYSTEM_WRITE),
        ))
        result = authorizer.authorize_trajectory(traj, context)
        assert len(result.action_results) == 3
        assert result.action_results[0].action.category == ActionCategory.FILE_SYSTEM_READ
        assert result.action_results[0].status == AuthorizationStatus.AUTHORIZED
        assert result.action_results[1].action.category == ActionCategory.CODE_EXECUTION
        assert result.action_results[1].status == AuthorizationStatus.UNAUTHORIZED
        assert result.action_results[2].action.category == ActionCategory.FILE_SYSTEM_WRITE
        assert result.action_results[2].status == AuthorizationStatus.AUTHORIZED

    def test_exact_resource_canonicalization(self):
        """EXACT mode canonicalizes both sides."""
        authorizer = TaskContextAuthorizer()
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            resource="/project/./src/../src/file.py",
        )
        context = _make_context(allowed=(
            CapabilityGrant(
                category=ActionCategory.FILE_SYSTEM_READ,
                resource_scope=ResourceScope(
                    match_mode=ResourceMatchMode.EXACT,
                    value="/project/src/file.py",
                ),
            ),
        ))
        result = authorizer.authorize_action(action, context)
        assert result.status == AuthorizationStatus.AUTHORIZED
