"""
Local Sentinel Service (Milestone 12).

Orchestrates the in-process interception lifecycle for M12 integrations.
Binds M10 repositories to the M8 RuntimeInterceptor without modifying
either contract.

Supports concurrent execution by precisely correlating M8 AuditEvents
with final M8 RuntimeEvents using the unique interception_id.
"""

import dataclasses
import logging
from datetime import datetime, timezone
from typing import Any, Optional, Dict

from src.agentsentinel.models.normalized import NormalizedEvent
from src.agentsentinel.models.trajectory import EventRole
from src.agentsentinel.runtime.interceptor import RuntimeInterceptor, InterceptionResult
from src.agentsentinel.runtime.state import RuntimeSession, ValidatedInvocation, RuntimeEvent
from src.agentsentinel.repositories.base import (
    BaseAuditRepository,
    BasePolicyRepository,
    BaseTaskRepository,
)
from src.agentsentinel.runtime.adapters.base import BaseFrameworkAdapter
from src.agentsentinel.runtime.audit import AuditEvent

logger = logging.getLogger(__name__)


class LocalSentinelService:
    """
    In-process orchestration service for AgentSentinel integrations.
    """

    def __init__(
        self,
        interceptor: RuntimeInterceptor,
        task_repo: BaseTaskRepository,
        policy_repo: BasePolicyRepository,
        audit_repo: BaseAuditRepository,
    ):
        self._interceptor = interceptor
        self._task_repo = task_repo
        self._policy_repo = policy_repo
        self._audit_repo = audit_repo
        # Track which audit events have been flushed to avoid duplicates.
        # This is safe because interceptor.audit_log is append-only.
        self._flushed_audit_count = 0

    def execute_tool(
        self,
        adapter: BaseFrameworkAdapter,
        session_id: str,
        task_id: str,
        invocation: ValidatedInvocation,
    ) -> Any:
        """
        Execute a tool call via the M8 adapter and persist to M10.
        """
        session = self._sync_session(session_id, task_id)
        
        # 1. Normalize
        action = adapter.normalize(invocation)
        if action is None:
            # Fake a block result for adapter to handle
            from src.agentsentinel.governance.models import GovernanceDecision
            from src.agentsentinel.runtime.interceptor import InterceptionResult
            result = InterceptionResult(
                interception_id="normalization_failure",
                session_id=session.session_id,
                sequence_number=0,
                decision=GovernanceDecision.BLOCK,
                action=None,
                action_record=None,
                error_message="Adapter normalization failure"
            )
            return adapter.handle_block(result)
            
        # 2. Intercept
        result, audit_event = self._interceptor.intercept(session, action)
        
        from src.agentsentinel.governance.models import GovernanceDecision
        from src.agentsentinel.runtime.state import ExecutionState
        import dataclasses
        
        # 3. Execution gate
        if result.decision == GovernanceDecision.BLOCK:
            blocked_audit = dataclasses.replace(audit_event, execution_state=ExecutionState.BLOCKED)
            self._flush_audit(
                blocked_audit,
                task_id=task_id,
                tool_name=invocation.tool_name,
                arguments=dict(invocation.frozen_arguments),
                execution_result="BLOCKED"
            )
            return adapter.handle_block(result)
            
        # 4. Execute
        try:
            tool_result = invocation.execute()
        except Exception as e:
            self._interceptor.mark_execution_failed(session, result.interception_id, str(e))
            failed_audit = dataclasses.replace(
                audit_event,
                execution_state=ExecutionState.EXECUTION_FAILED,
                execution_error=str(e)
            )
            self._flush_audit(
                failed_audit,
                task_id=task_id,
                tool_name=invocation.tool_name,
                arguments=dict(invocation.frozen_arguments),
                execution_result=str(e)
            )
            raise
            
        # 5. Mark executed
        self._interceptor.mark_executed(session, result.interception_id)
        executed_audit = dataclasses.replace(audit_event, execution_state=ExecutionState.EXECUTED)
        self._flush_audit(
            executed_audit,
            task_id=task_id,
            tool_name=invocation.tool_name,
            arguments=dict(invocation.frozen_arguments),
            execution_result=str(tool_result)
        )
        return tool_result

    def _sync_session(self, session_id: str, task_id: str) -> RuntimeSession:
        """Ensure the session exists, has live policies from M10, and hydrates historical trajectory."""
        task_context = self._task_repo.get(task_id)
        if task_context is None:
            raise ValueError(f"Unknown task_id: {task_id}")

        policies = self._policy_repo.get_all()

        session = RuntimeSession(
            session_id=session_id,
            task_context=task_context,
            policies=tuple(policies),
        )

        # Hydrate historical events from audit log belonging to this session
        historical_events = self._audit_repo.get_by_session(session_id)
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

        return session

    def _flush_audit(
        self, 
        audit_event,
        task_id: str = "",
        tool_name: str = "",
        arguments: Optional[Dict[str, Any]] = None,
        execution_result: Optional[str] = None
    ) -> None:
        """
        Flush audit event to the M10 repository.
        """
        if audit_event is None:
            return
            
        final_audit = dataclasses.replace(
            audit_event,
            task_id=task_id,
            tool_name=tool_name,
            arguments=arguments,
            execution_result=execution_result
        )
        self._audit_repo.append(final_audit)
