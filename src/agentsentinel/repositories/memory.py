"""
In-Memory Repository Implementations (Milestone 9).

Thread-safe in-memory implementations of the repository interfaces.
These are intended for M9 development and testing only.
M10 will replace them with persistent database implementations.
"""

import threading
from typing import Dict, List, Optional

from src.agentsentinel.authorization.models import TaskContext
from src.agentsentinel.governance.models import GovernancePolicy
from src.agentsentinel.runtime.audit import AuditEvent
from src.agentsentinel.repositories.base import (
    BaseAuditRepository,
    BasePolicyRepository,
    BaseTaskRepository,
)


class InMemoryTaskRepository(BaseTaskRepository):
    """Thread-safe in-memory TaskContext storage."""

    def __init__(self):
        self._store: Dict[str, TaskContext] = {}
        self._lock = threading.Lock()

    def get(self, task_id: str) -> Optional[TaskContext]:
        with self._lock:
            return self._store.get(task_id)

    def add(self, task_context: TaskContext) -> None:
        with self._lock:
            self._store[task_context.task_id] = task_context

    def list_all(self) -> List[TaskContext]:
        with self._lock:
            return list(self._store.values())


class InMemoryPolicyRepository(BasePolicyRepository):
    """Thread-safe in-memory GovernancePolicy storage."""

    def __init__(self):
        self._store: Dict[str, GovernancePolicy] = {}
        self._lock = threading.Lock()

    def get_all(self) -> List[GovernancePolicy]:
        with self._lock:
            return list(self._store.values())

    def add(self, policy: GovernancePolicy) -> None:
        with self._lock:
            self._store[policy.policy_id] = policy

    def delete(self, policy_id: str) -> bool:
        with self._lock:
            if policy_id in self._store:
                del self._store[policy_id]
                return True
            return False


class InMemoryAuditRepository(BaseAuditRepository):
    """Thread-safe in-memory AuditEvent storage."""

    def __init__(self):
        self._events: List[AuditEvent] = []
        self._lock = threading.Lock()

    def append(self, event: AuditEvent) -> None:
        with self._lock:
            self._events.append(event)

    def get_by_session(self, session_id: str) -> List[AuditEvent]:
        with self._lock:
            return [e for e in self._events if e.session_id == session_id]

    def get_all(self, since=None) -> List[AuditEvent]:
        with self._lock:
            if since:
                return [e for e in self._events if e.timestamp >= since]
            return list(self._events)

    def get_recent(self, limit: int) -> List[AuditEvent]:
        with self._lock:
            return self._events[-limit:]

    def get_metrics(self, since=None) -> dict:
        with self._lock:
            events = [e for e in self._events if (not since or e.timestamp >= since)]
            
        total_events = len(events)
        decisions = {"allow": 0, "block": 0, "alert": 0, "unknown": 0}
        actions = {}
        
        for e in events:
            decision = e.decision.value.lower() if e.decision else "unknown"
            if decision in decisions:
                decisions[decision] += 1
            else:
                decisions["unknown"] += 1
                
            if e.action:
                cat = e.action.category.value if hasattr(e.action.category, 'value') else e.action.category
                actions[cat] = actions.get(cat, 0) + 1
                
        return {
            "total_interceptions": total_events,
            "decisions": decisions,
            "actions_by_category": actions
        }
