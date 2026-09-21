"""
Task-Context Authorization Engine (Milestone 6).

Evaluates NormalizedActions against a TaskContext to determine
whether observed behavior is authorized by the declared task scope.

Separation of concerns:
    Observation      (M1-M4) -> TrajectoryFeatures
    Interpretation   (M5)    -> RiskAssessment
    Authorization    (M6)    -> TrajectoryAuthorizationAssessment
    Decision         (M7+)   -> ALLOW / ALERT / BLOCK

This engine does NOT:
    - Consume M5 RiskAssessment.
    - Make policy decisions (ALLOW / ALERT / BLOCK).
    - Mutate NormalizedAction or TaskContext inputs.
    - Consult provider, arguments, original_tool_name, source_dataset, or raw_data.
    - Implement a second normalization layer.

Authorization evaluation is deterministic and side-effect free.

Authoritative fields (from NormalizedAction):
    - category   (always)
    - operation   (when grant/deny specifies operations)
    - resource    (when grant/deny specifies resource scope)

Complexity:
    Action-level:      O(D + G) per action
    Trajectory-level:  O(A * (D + G))
    Memory:            O(A) for per-action results
"""

import fnmatch
import posixpath
from typing import List, Optional

from src.agentsentinel.models.normalized import (
    ActionCategory,
    NormalizedAction,
    NormalizedTrajectory,
)
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


class TaskContextAuthorizer:
    """
    Evaluates NormalizedActions against a TaskContext.

    Authorization order per action:
        1. Guard: TaskContext is None      -> UNEVALUABLE
        2. Guard: category == UNKNOWN      -> UNAUTHORIZED
        3. Guard: operation is None        -> UNAUTHORIZED
        4. Explicit deny check             -> UNAUTHORIZED
        5. Explicit allow check            -> AUTHORIZED
        6. Default deny                    -> UNAUTHORIZED

    Deny always overrides allow. Default is deny.
    """

    # ──────────────────────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────────────────────

    def authorize_action(
        self,
        action: NormalizedAction,
        context: Optional[TaskContext],
    ) -> ActionAuthorizationResult:
        """
        Evaluate a single NormalizedAction against a TaskContext.

        The supplied NormalizedAction and TaskContext are never mutated.
        The returned ActionAuthorizationResult retains the exact
        evaluated NormalizedAction reference.
        """
        # 1. Guard: missing context
        if context is None:
            return ActionAuthorizationResult(
                status=AuthorizationStatus.UNEVALUABLE,
                action=action,
                matched_grant=None,
                matched_deny=None,
                reasons=(
                    AuthorizationReason(
                        description="TaskContext is None — cannot evaluate authorization",
                        rule_type="missing_context",
                    ),
                ),
            )

        # 2. Guard: unknown category
        if action.category == ActionCategory.UNKNOWN:
            return ActionAuthorizationResult(
                status=AuthorizationStatus.UNAUTHORIZED,
                action=action,
                matched_grant=None,
                matched_deny=None,
                reasons=(
                    AuthorizationReason(
                        description=(
                            "category UNKNOWN has no matching capability grant "
                            "— unknown actions are unauthorized"
                        ),
                        rule_type="unknown_category",
                        action_field="category",
                        action_value="UNKNOWN",
                    ),
                ),
            )

        # 3. Guard: unknown operation
        if action.operation is None:
            return ActionAuthorizationResult(
                status=AuthorizationStatus.UNAUTHORIZED,
                action=action,
                matched_grant=None,
                matched_deny=None,
                reasons=(
                    AuthorizationReason(
                        description=(
                            "operation None is unknown — cannot confirm "
                            "authorization (UNKNOWN ≠ SAFE)"
                        ),
                        rule_type="unknown_operation",
                        action_field="operation",
                        action_value="None",
                    ),
                ),
            )

        # 4. Explicit deny check
        for deny in context.denied_capabilities:
            if self._deny_matches(deny, action):
                return ActionAuthorizationResult(
                    status=AuthorizationStatus.UNAUTHORIZED,
                    action=action,
                    matched_grant=None,
                    matched_deny=deny,
                    reasons=(
                        AuthorizationReason(
                            description=(
                                f"category {action.category.value} matched explicit "
                                f"deny rule for {deny.category.value}"
                            ),
                            rule_type="explicit_deny",
                            action_field="category",
                            action_value=action.category.value,
                            matched_value=deny.category.value,
                        ),
                    ),
                )

        # 5. Explicit allow check
        for grant in context.allowed_capabilities:
            if self._grant_matches(grant, action):
                desc_parts = [
                    f"category {action.category.value} matched grant "
                    f"for {grant.category.value}"
                ]
                if grant.resource_scope is not None:
                    desc_parts.append(
                        f"with {grant.resource_scope.match_mode.value} "
                        f"scope {grant.resource_scope.value}"
                    )
                return ActionAuthorizationResult(
                    status=AuthorizationStatus.AUTHORIZED,
                    action=action,
                    matched_grant=grant,
                    matched_deny=None,
                    reasons=(
                        AuthorizationReason(
                            description=" ".join(desc_parts),
                            rule_type="explicit_allow",
                            action_field="category",
                            action_value=action.category.value,
                            matched_value=grant.category.value,
                        ),
                    ),
                )

        # 6. Default deny
        return ActionAuthorizationResult(
            status=AuthorizationStatus.UNAUTHORIZED,
            action=action,
            matched_grant=None,
            matched_deny=None,
            reasons=(
                AuthorizationReason(
                    description=(
                        f"category {action.category.value} has no matching "
                        f"capability grant — default deny"
                    ),
                    rule_type="default_deny",
                    action_field="category",
                    action_value=action.category.value,
                ),
            ),
        )

    def authorize_trajectory(
        self,
        trajectory: NormalizedTrajectory,
        context: Optional[TaskContext],
    ) -> TrajectoryAuthorizationAssessment:
        """
        Evaluate all actions in a NormalizedTrajectory against a TaskContext.

        The supplied NormalizedTrajectory and TaskContext are never mutated.
        Action ordering is preserved.
        """
        # Guard: missing context (trajectory-level)
        if context is None:
            # Still evaluate each action to produce per-action evidence
            all_actions = self._extract_actions(trajectory)
            action_results: List[ActionAuthorizationResult] = []
            for action in all_actions:
                action_results.append(self.authorize_action(action, None))

            return TrajectoryAuthorizationAssessment(
                task_id="",
                trajectory_id=trajectory.trajectory_id,
                overall_status=AuthorizationStatus.UNEVALUABLE,
                action_results=tuple(action_results),
                summary=self._compute_summary(action_results),
            )

        # Evaluate each action
        all_actions = self._extract_actions(trajectory)
        action_results = []
        for action in all_actions:
            action_results.append(self.authorize_action(action, context))

        # Conservative aggregation
        overall_status = self._aggregate_status(action_results)

        return TrajectoryAuthorizationAssessment(
            task_id=context.task_id,
            trajectory_id=trajectory.trajectory_id,
            overall_status=overall_status,
            action_results=tuple(action_results),
            summary=self._compute_summary(action_results),
        )

    # ──────────────────────────────────────────────────────────
    # Matching Logic
    # ──────────────────────────────────────────────────────────

    def _grant_matches(self, grant: CapabilityGrant, action: NormalizedAction) -> bool:
        """
        Check if a CapabilityGrant matches the action.

        grant.category must == action.category
        AND (grant.allowed_operations is None OR action.operation in grant.allowed_operations)
        AND (grant.resource_scope is None OR resource scope matches action.resource)
        """
        if grant.category != action.category:
            return False

        # Operation matching
        if grant.allowed_operations is not None:
            if action.operation not in grant.allowed_operations:
                return False

        # Resource matching
        if grant.resource_scope is not None:
            if not self._resource_matches(grant.resource_scope, action.resource):
                return False

        return True

    def _deny_matches(self, deny: CapabilityDeny, action: NormalizedAction) -> bool:
        """
        Check if a CapabilityDeny matches the action.

        deny.category must == action.category
        AND (deny.denied_operations is None OR action.operation in deny.denied_operations)
        AND (deny.resource_scope is None OR resource scope matches action.resource)
        """
        if deny.category != action.category:
            return False

        # Operation matching
        if deny.denied_operations is not None:
            if action.operation is None:
                # Unknown operation does not match specific deny operations.
                # But note: if denied_operations is None (all ops denied),
                # we skip this branch entirely and the deny applies.
                return False
            if action.operation not in deny.denied_operations:
                return False

        # Resource matching
        if deny.resource_scope is not None:
            if not self._resource_matches(deny.resource_scope, action.resource):
                return False

        return True

    # ──────────────────────────────────────────────────────────
    # Resource Matching
    # ──────────────────────────────────────────────────────────

    @staticmethod
    def _canonicalize_path(path: str) -> str:
        """
        Canonicalize a resource path using posixpath.normpath.

        Collapses '..', '.', and redundant separators.
        """
        return posixpath.normpath(path)

    def _resource_matches(self, scope: ResourceScope, action_resource: Optional[str]) -> bool:
        """
        Check if an action resource matches a ResourceScope.

        If action_resource is None, the match always fails (cannot
        confirm resource authorization without evidence).

        EXACT:   canonicalize both, exact string comparison.
        PREFIX:  canonicalize both, path-component-aware prefix match.
        PATTERN: canonicalize action resource, preserve scope as glob, fnmatch.
        """
        if action_resource is None:
            return False

        canonical_resource = self._canonicalize_path(action_resource)

        if scope.match_mode == ResourceMatchMode.EXACT:
            canonical_scope = self._canonicalize_path(scope.value)
            return canonical_resource == canonical_scope

        elif scope.match_mode == ResourceMatchMode.PREFIX:
            canonical_scope = self._canonicalize_path(scope.value)
            # Path-component-aware: resource must equal scope
            # OR start with scope + "/"
            if canonical_resource == canonical_scope:
                return True
            return canonical_resource.startswith(canonical_scope + "/")

        elif scope.match_mode == ResourceMatchMode.PATTERN:
            # Canonicalize only the action resource, preserve the glob pattern
            return fnmatch.fnmatch(canonical_resource, scope.value)

        return False

    # ──────────────────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────────────────

    @staticmethod
    def _extract_actions(trajectory: NormalizedTrajectory) -> List[NormalizedAction]:
        """Extract all NormalizedActions from a trajectory, preserving order."""
        actions: List[NormalizedAction] = []
        for event in trajectory.events:
            for action in event.normalized_actions:
                actions.append(action)
        return actions

    @staticmethod
    def _aggregate_status(
        results: List[ActionAuthorizationResult],
    ) -> AuthorizationStatus:
        """
        Conservative status aggregation:
            - Any UNAUTHORIZED -> UNAUTHORIZED
            - All AUTHORIZED   -> AUTHORIZED
            - Mix of AUTHORIZED + UNEVALUABLE (no UNAUTHORIZED) -> UNEVALUABLE
        """
        if not results:
            return AuthorizationStatus.AUTHORIZED

        has_unauthorized = False
        has_unevaluable = False

        for result in results:
            if result.status == AuthorizationStatus.UNAUTHORIZED:
                has_unauthorized = True
            elif result.status == AuthorizationStatus.UNEVALUABLE:
                has_unevaluable = True

        if has_unauthorized:
            return AuthorizationStatus.UNAUTHORIZED
        if has_unevaluable:
            return AuthorizationStatus.UNEVALUABLE
        return AuthorizationStatus.AUTHORIZED

    @staticmethod
    def _compute_summary(
        results: List[ActionAuthorizationResult],
    ) -> AuthorizationSummary:
        """Compute aggregate counts from per-action results."""
        authorized = 0
        unauthorized = 0
        unevaluable = 0

        for result in results:
            if result.status == AuthorizationStatus.AUTHORIZED:
                authorized += 1
            elif result.status == AuthorizationStatus.UNAUTHORIZED:
                unauthorized += 1
            elif result.status == AuthorizationStatus.UNEVALUABLE:
                unevaluable += 1

        return AuthorizationSummary(
            total_actions=len(results),
            authorized_count=authorized,
            unauthorized_count=unauthorized,
            unevaluable_count=unevaluable,
        )
