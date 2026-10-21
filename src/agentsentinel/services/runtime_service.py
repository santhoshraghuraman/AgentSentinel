"""
Runtime Service (Milestone 9).

Orchestrates the full runtime interception lifecycle through M8.
This service is NOT a governance engine — it delegates all governance
decisions to the M8 RuntimeInterceptor.

Responsibilities:
    - Resolve task_id → concrete TaskContext via TaskRepository
    - Retrieve live policies from PolicyRepository
    - Create/retrieve RuntimeSession with snapshotted config
    - Construct ValidatedInvocation and NormalizedAction
    - Delegate to M8 RuntimeInterceptor
    - Translate M8 InterceptionResult to safe API response
    - Never fabricate governance decisions
    - Never expose stack traces

TOCTOU preservation:
    The ValidatedInvocation is constructed ONCE from the API request.
    The exact same invocation is what M8 governs and the adapter executes.
    No reconstruction, re-reading, or substitution occurs after binding.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

from datetime import datetime, timezone

from src.agentsentinel.models.normalized import (
    ActionCategory,
    NormalizedAction,
    NormalizedEvent,
)
from src.agentsentinel.models.trajectory import EventRole
from src.agentsentinel.authorization.models import (
    CapabilityDeny,
    CapabilityGrant,
    TaskContext,
)
from src.agentsentinel.governance.models import GovernanceDecision
from src.agentsentinel.runtime.interceptor import InterceptionResult, RuntimeInterceptor
from src.agentsentinel.runtime.state import (
    ExecutionState,
    RuntimeEvent,
    RuntimeSession,
    ValidatedInvocation,
)
from src.agentsentinel.runtime.adapters.base import BaseFrameworkAdapter
from src.agentsentinel.repositories.base import (
    BaseAuditRepository,
    BasePolicyRepository,
    BaseTaskRepository,
    BaseSessionRepository,
)
from src.agentsentinel.api.schemas import (
    InterceptRequest,
    InterceptResponse,
    SafeActionDecisionRecordResponse,
    SafeActionResponse,
    SafeGovernanceReasonResponse,
)


logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────
# API Framework Adapter
# ──────────────────────────────────────────────────────────

class ApiFrameworkAdapter(BaseFrameworkAdapter):
    """
    M9 API-specific framework adapter.

    Normalizes API tool call requests into NormalizedActions
    and provides safe BLOCK responses for the API layer.
    """

    def normalize(self, invocation: ValidatedInvocation) -> Optional[NormalizedAction]:
        """
        Normalize a ValidatedInvocation from the API into a NormalizedAction.

        Uses simple heuristic-based normalization for API tool calls.
        Returns None if the tool_name is empty or invalid.
        """
        if not invocation.tool_name or not invocation.tool_name.strip():
            return None

        tool_name = invocation.tool_name.strip().lower()

        # Determine category from tool name heuristics
        category = self._infer_category(tool_name)
        is_mutating = self._infer_mutating(tool_name)
        is_destructive = self._infer_destructive(tool_name)
        operation = self._infer_operation(tool_name)
        resource = self._extract_resource(invocation)

        return NormalizedAction(
            normalized_name=tool_name,
            category=category,
            provider="api",
            operation=operation,
            resource=resource,
            is_mutating=is_mutating,
            is_destructive=is_destructive,
            original_tool_name=invocation.tool_name,
            source_dataset="runtime_api",
            arguments=dict(invocation.frozen_arguments) if invocation.frozen_arguments else {},
        )

    def handle_block(self, result: InterceptionResult) -> InterceptionResult:
        """Return the InterceptionResult directly; API layer handles response."""
        return result

    @staticmethod
    def _infer_category(tool_name: str) -> ActionCategory:
        """Simple heuristic category inference."""
        if any(k in tool_name for k in ("read", "get", "list", "view", "cat")):
            return ActionCategory.FILE_SYSTEM_READ
        if any(k in tool_name for k in ("write", "create", "edit", "save", "put")):
            return ActionCategory.FILE_SYSTEM_WRITE
        if any(k in tool_name for k in ("exec", "run", "shell", "bash", "python")):
            return ActionCategory.CODE_EXECUTION
        if any(k in tool_name for k in ("http", "fetch", "curl", "request", "web")):
            return ActionCategory.WEB_REQUEST
        if any(k in tool_name for k in ("api", "call", "invoke")):
            return ActionCategory.API_CALL
        return ActionCategory.UNKNOWN

    @staticmethod
    def _infer_mutating(tool_name: str) -> bool:
        return any(k in tool_name for k in ("write", "create", "edit", "delete", "remove", "save", "put"))

    @staticmethod
    def _infer_destructive(tool_name: str) -> bool:
        return any(k in tool_name for k in ("delete", "remove", "drop", "destroy", "truncate"))

    @staticmethod
    def _infer_operation(tool_name: str) -> Optional[str]:
        for op in ("read", "write", "create", "delete", "execute", "list", "get", "put"):
            if op in tool_name:
                return op
        return None

    @staticmethod
    def _extract_resource(invocation: ValidatedInvocation) -> Optional[str]:
        args = dict(invocation.frozen_arguments)
        for key in ("path", "file", "resource", "url", "target"):
            if key in args and isinstance(args[key], str):
                return args[key]
        return None


# ──────────────────────────────────────────────────────────
# Runtime Service
# ──────────────────────────────────────────────────────────

class RuntimeService:
    """
    Orchestrates runtime interception through M8.

    This service is NOT a governance engine.
    All governance decisions come from M8.
    """

    def __init__(
        self,
        interceptor: RuntimeInterceptor,
        task_repo: BaseTaskRepository,
        policy_repo: BasePolicyRepository,
        audit_repo: BaseAuditRepository,
        session_repo: BaseSessionRepository,
    ):
        self._interceptor = interceptor
        self._task_repo = task_repo
        self._policy_repo = policy_repo
        self._audit_repo = audit_repo
        self._session_repo = session_repo
        self._adapter = ApiFrameworkAdapter(interceptor)

    def intercept(self, request: InterceptRequest) -> InterceptResponse:
        """
        Execute the full interception lifecycle.

        Flow:
            1. Resolve task_id → TaskContext
            2. Retrieve current policies
            3. Get or create RuntimeSession
            4. Construct ValidatedInvocation (immutable binding)
            5. Normalize via adapter
            6. Submit to M8 RuntimeInterceptor
            7. Translate result to safe API response

        Returns InterceptResponse with HTTP 200 semantics.
        Raises ValueError for task_id resolution failure.
        """
        # Step 1: Resolve TaskContext
        task_context = self._task_repo.get(request.task_id)
        if task_context is None:
            raise ValueError(f"Unknown task_id: {request.task_id}")

        # Step 2: Retrieve current policies (live collection)
        policies = self._policy_repo.get_all()

        # Step 3: Get or create RuntimeSession
        session_data = self._session_repo.get(request.session_id)
        if session_data is None:
            self._session_repo.add({
                "session_id": request.session_id,
                "task_id": request.task_id,
                "created_at": datetime.now(timezone.utc),
                "status": "active"
            })
            
        session = RuntimeSession(
            session_id=request.session_id,
            task_context=task_context,
            policies=tuple(policies),
        )

        # Hydrate historical events from audit log
        historical_events = self._audit_repo.get_by_session(request.session_id)
        max_seq = 0
        seen_ids = set()
        sorted_events = sorted(historical_events, key=lambda e: e.sequence_number or 0)

        with session.acquire_lock():
            for evt in sorted_events:
                if not evt.action:
                    continue
                if evt.interception_id in seen_ids:
                    continue
                seen_ids.add(evt.interception_id)

                if isinstance(evt.timestamp, datetime):
                    if evt.timestamp.tzinfo is None:
                        ts_str = evt.timestamp.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
                    else:
                        ts_str = evt.timestamp.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
                elif hasattr(evt.timestamp, "isoformat"):
                    ts_str = evt.timestamp.isoformat()
                    if not ts_str.endswith("Z") and "+" not in ts_str:
                        ts_str += "Z"
                else:
                    ts_str = str(evt.timestamp)
                normalized_event = NormalizedEvent(
                    id=f"runtime_{evt.interception_id}",
                    timestamp=ts_str,
                    role=EventRole.TOOL_CALL,
                    content=None,
                    normalized_actions=[evt.action],
                )
                runtime_event = RuntimeEvent(
                    sequence_number=evt.sequence_number,
                    normalized_event=normalized_event,
                    execution_state=evt.execution_state,
                    interception_id=evt.interception_id,
                )
                session.append_event(runtime_event)
                if evt.sequence_number and evt.sequence_number > max_seq:
                    max_seq = evt.sequence_number

            session._sequence_counter = max_seq

        # Step 4: Construct ValidatedInvocation — immutable binding
        # Arguments are frozen at this point; no re-reading occurs.
        frozen_args = tuple(sorted(request.arguments.items()))
        invocation = ValidatedInvocation(
            tool_name=request.tool_name,
            frozen_arguments=frozen_args,
            callable_ref=self._noop_callable,
        )

        # Step 5+6: Normalize + M8 interception via adapter
        action = self._adapter.normalize(invocation)

        if action is None:
            # Normalization failure → fail-safe BLOCK
            # No M8 evaluation occurred
            return InterceptResponse(
                interception_id="normalization_failure",
                sequence_number=0,
                decision=GovernanceDecision.BLOCK.value,
                is_fail_safe=True,
                action=None,
                action_record=None,
                error_message="Normalization failure: unable to normalize tool call",
            )

        # Submit to M8 — M8 is the single authoritative governance path
        result, audit_event = self._interceptor.intercept(session, action)

        # Step 7: Record audit event in repository
        self._audit_repo.append(audit_event)

        # Translate to safe response
        return self._to_response(result)

    @staticmethod
    def _noop_callable(**kwargs) -> None:
        """
        No-op callable for API-originated tool calls.

        In the API context, the actual tool execution is not performed
        server-side — the API evaluates governance only.
        The agent framework executes the tool based on the decision.
        """
        return None

    @staticmethod
    def _to_response(result: InterceptionResult) -> InterceptResponse:
        """Translate M8 InterceptionResult to safe API response."""
        safe_action = None
        if result.action is not None:
            safe_action = SafeActionResponse(
                normalized_name=result.action.normalized_name,
                category=result.action.category.value,
                provider=result.action.provider,
                operation=result.action.operation,
                resource=result.action.resource,
                is_mutating=result.action.is_mutating,
                is_destructive=result.action.is_destructive,
                source_dataset=result.action.source_dataset,
            )

        safe_record = None
        if result.action_record is not None:
            reasons = [
                SafeGovernanceReasonResponse(
                    rule_type=r.rule_type,
                    description=r.description,
                    matched_policy_id=r.matched_policy_id,
                    policy_priority=r.policy_priority,
                )
                for r in result.action_record.reasons
            ]
            safe_record = SafeActionDecisionRecordResponse(
                decision=result.action_record.decision.value,
                risk_severity=(
                    result.action_record.risk_severity.name
                    if result.action_record.risk_severity is not None
                    else None
                ),
                auth_status=result.action_record.auth_status.value,
                matched_policy_id=(
                    result.action_record.matched_policy.policy_id
                    if result.action_record.matched_policy is not None
                    else None
                ),
                ml_probability=result.action_record.ml_probability,
                risk_score=result.action_record.risk_score,
                features=result.action_record.features,
                reasons=reasons,
            )

        is_fail_safe = (
            result.decision == GovernanceDecision.BLOCK
            and result.action_record is None
            and result.error_message is not None
        )

        return InterceptResponse(
            interception_id=result.interception_id,
            sequence_number=result.sequence_number,
            decision=result.decision.value,
            is_fail_safe=is_fail_safe,
            action=safe_action,
            action_record=safe_record,
            error_message=result.error_message,
        )
