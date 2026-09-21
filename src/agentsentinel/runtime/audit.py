"""
Runtime Audit Model (Milestone 8).

Defines the in-memory audit event contract for intercepted tool calls.
Provides synchronous, domain-level auditing without external persistence.

AuditEvent shares the same interception_id and sequence_number as
the InterceptionResult for identity consistency.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Dict, Any

from src.agentsentinel.models.normalized import NormalizedAction
from src.agentsentinel.governance.models import (
    ActionDecisionRecord,
    GovernanceDecision,
)
from src.agentsentinel.runtime.state import ExecutionState


@dataclass(frozen=True)
class AuditEvent:
    """
    Immutable audit record for a single intercepted tool call.

    Fields:
        interception_id: Unique ID for this interception attempt (matches InterceptionResult).
        session_id: The runtime session this call belongs to.
        sequence_number: Authoritative runtime ordering (matches InterceptionResult).
        timestamp: Observational wall-clock time (NOT used for ordering).
        action: The NormalizedAction evaluated (None if normalization failed).
        decision: The governance decision (ALLOW/ALERT/BLOCK).
        action_record: The M7 decision record (None if fail-safe triggered).
        execution_state: Final execution state after the execution gate.
        execution_error: Error description if tool execution failed.
        error_message: Interception-level error (normalization failure, M3-M7 failure).
    """
    interception_id: str
    session_id: str
    sequence_number: int
    timestamp: datetime
    action: Optional[NormalizedAction]
    decision: GovernanceDecision
    action_record: Optional[ActionDecisionRecord]
    execution_state: ExecutionState
    execution_error: Optional[str] = None
    error_message: Optional[str] = None
    task_id: str = ""
    tool_name: str = ""
    arguments: Optional[Dict[str, Any]] = None
    execution_result: Optional[str] = None
