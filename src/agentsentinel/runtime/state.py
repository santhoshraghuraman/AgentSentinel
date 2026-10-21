"""
Runtime State Management (Milestone 8).

Defines the mutable runtime state that accumulates agent behavior
during a live session. This is M8-owned mutable state; all M1–M7
domain objects referenced within remain immutable.

Key design principles:
    - RuntimeSession is the ONLY mutable state container in M8.
    - sequence_number is the authoritative runtime ordering.
    - Timestamps are observational metadata; they never determine ordering.
    - threading.Lock serializes all state updates.
    - Concurrent scheduling order is runtime-dependent and is NOT
      claimed to be reproducible across independent executions.
    - EXECUTED events are included in future M4/M5 context.
    - BLOCKED and EXECUTION_FAILED events are excluded from future
      M4/M5 context (but retained for audit).
"""

import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

from src.agentsentinel.models.normalized import (
    NormalizedAction,
    NormalizedEvent,
    NormalizedTrajectory,
)
from src.agentsentinel.models.trajectory import EventRole
from src.agentsentinel.authorization.models import TaskContext
from src.agentsentinel.governance.models import GovernancePolicy


# ──────────────────────────────────────────────────────────
# Execution State
# ──────────────────────────────────────────────────────────

class ExecutionState(str, Enum):
    """
    Lifecycle state of a runtime-intercepted action.

    ATTEMPTED:        Currently being evaluated (before governance decision).
    EXECUTED:         ALLOW/ALERT decision AND tool execution succeeded.
    BLOCKED:          Governance or fail-safe rejected execution.
    EXECUTION_FAILED: Governance allowed execution but tool raised an exception.
    """
    ATTEMPTED = "attempted"
    EXECUTED = "executed"
    BLOCKED = "blocked"
    EXECUTION_FAILED = "execution_failed"


# ──────────────────────────────────────────────────────────
# Validated Invocation
# ──────────────────────────────────────────────────────────

@dataclass(frozen=True)
class ValidatedInvocation:
    """
    An immutable binding of the exact tool call that was normalized
    and governed. This is the ONLY invocation permitted to execute.

    The adapter freezes the tool identity, arguments, and callable
    reference BEFORE normalization. After governance, the same
    ValidatedInvocation is passed to the execution gate.

    Security rule:
        "The exact ValidatedInvocation that produced the governed
         NormalizedAction is the only invocation permitted to execute."

    The adapter MUST NOT:
        - reconstruct arguments later
        - re-read mutable arguments
        - substitute another callable
        - re-normalize different arguments
        - change tool identity
        - change execution context
    """
    tool_name: str
    frozen_arguments: Tuple[Tuple[str, Any], ...]
    callable_ref: Any  # The exact callable binding; framework-specific
    context: Dict[str, Any] = field(default_factory=dict)

    def execute(self) -> Any:
        """
        Execute the exact frozen invocation.

        Converts frozen_arguments back to a dict and passes to the
        bound callable.
        """
        kwargs = dict(self.frozen_arguments)
        return self.callable_ref(**kwargs)


# ──────────────────────────────────────────────────────────
# Runtime Event
# ──────────────────────────────────────────────────────────

class RuntimeEvent:
    """
    Wraps a NormalizedEvent with M8 runtime metadata.

    The normalized_event and its contents are M1–M7 domain objects
    and are never mutated by M8. Only execution_state is mutable.
    """

    def __init__(
        self,
        sequence_number: int,
        normalized_event: NormalizedEvent,
        execution_state: ExecutionState,
        interception_id: str,
        timestamp: Optional[datetime] = None,
    ):
        self.sequence_number = sequence_number
        self.normalized_event = normalized_event
        self.execution_state = execution_state
        self.interception_id = interception_id
        self.timestamp = timestamp or datetime.now(timezone.utc)


# ──────────────────────────────────────────────────────────
# Session Lifecycle
# ──────────────────────────────────────────────────────────

class SessionStatus(str, Enum):
    """Lifecycle status of a RuntimeSession."""
    ACTIVE = "active"
    COMPLETED = "completed"
    TERMINATED = "terminated"


# ──────────────────────────────────────────────────────────
# Runtime Session
# ──────────────────────────────────────────────────────────

class RuntimeSession:
    """
    Mutable runtime state for a single agent session.

    Maintains an ordered history of RuntimeEvents and a monotonic
    sequence counter. All updates are serialized via threading.Lock.

    sequence_number is the authoritative ordering mechanism.
    Timestamps are observational metadata only.
    """

    def __init__(
        self,
        session_id: str,
        task_context: TaskContext,
        policies: Sequence[GovernancePolicy],
    ):
        self.session_id = session_id
        self._task_context = task_context
        self._policies = tuple(policies)
        self._events: List[RuntimeEvent] = []
        self._sequence_counter = 0
        self._lock = threading.Lock()
        self._status = SessionStatus.ACTIVE

    @property
    def status(self) -> SessionStatus:
        return self._status

    @property
    def task_context(self) -> TaskContext:
        return self._task_context

    @property
    def policies(self) -> Tuple[GovernancePolicy, ...]:
        return self._policies

    @property
    def events(self) -> List[RuntimeEvent]:
        """Return the event list. Lock must be held externally for thread safety."""
        return self._events

    def snapshot_context(self) -> Tuple[TaskContext, Tuple[GovernancePolicy, ...]]:
        """
        Capture an immutable snapshot of the task context and policies
        for the lifetime of one interception evaluation.

        A policy or task-context change after this snapshot MUST NOT
        alter the decision already computed for the current interception.
        """
        return (self._task_context, self._policies)

    def next_sequence_number(self) -> int:
        """
        Atomically increment and return the next sequence number.
        Must be called within the session lock.
        """
        self._sequence_counter += 1
        return self._sequence_counter

    def append_event(self, event: RuntimeEvent) -> None:
        """
        Append a RuntimeEvent to the session history.
        Must be called within the session lock.
        """
        self._events.append(event)

    def build_m4_trajectory(self, current_event: RuntimeEvent) -> NormalizedTrajectory:
        """
        Build a transient NormalizedTrajectory for M3/M4/M5 evaluation.

        Includes:
            - Historical EXECUTED events (successful past behavior)
            - The current ATTEMPTED event (being evaluated now)

        Excludes:
            - Historical BLOCKED events
            - Historical EXECUTION_FAILED events

        Must be called within the session lock.
        """
        included_events: List[NormalizedEvent] = []

        for evt in self._events:
            if evt.execution_state == ExecutionState.EXECUTED:
                included_events.append(evt.normalized_event)

        # Include the current ATTEMPTED action
        included_events.append(current_event.normalized_event)

        return NormalizedTrajectory(
            trajectory_id=f"runtime_{self.session_id}",
            source_dataset="runtime",
            events=included_events,
        )

    def complete(self) -> None:
        """Mark session as completed."""
        with self._lock:
            self._status = SessionStatus.COMPLETED

    def terminate(self) -> None:
        """Mark session as terminated."""
        with self._lock:
            self._status = SessionStatus.TERMINATED

    def reset(self) -> None:
        """
        Reset session state: clears event history and resets sequence counter.
        Session returns to ACTIVE status.
        """
        with self._lock:
            self._events.clear()
            self._sequence_counter = 0
            self._status = SessionStatus.ACTIVE

    def acquire_lock(self) -> threading.Lock:
        """Return the session lock for external synchronized access."""
        return self._lock
