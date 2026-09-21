"""
Repository Interfaces (Milestone 9).

Abstract Base Classes defining the persistence boundary for M9.
These interfaces decouple the Service Layer from any specific storage
implementation. M9 provides in-memory implementations; M10 will
replace them with persistent database storage.

These repositories are NOT governance engines. They are storage
abstraction boundaries only.
"""

import abc
from typing import List, Optional, Sequence

from src.agentsentinel.authorization.models import TaskContext
from src.agentsentinel.governance.models import GovernancePolicy
from src.agentsentinel.runtime.audit import AuditEvent
from src.agentsentinel.runtime.state import RuntimeSession


class BaseTaskRepository(abc.ABC):
    """
    Abstract repository for TaskContext management.

    task_id → concrete TaskContext resolution.
    """

    @abc.abstractmethod
    def get(self, task_id: str) -> Optional[TaskContext]:
        """Retrieve a TaskContext by task_id. Returns None if not found."""
        ...

    @abc.abstractmethod
    def add(self, task_context: TaskContext) -> None:
        """Store a TaskContext. Overwrites if task_id already exists."""
        ...

    @abc.abstractmethod
    def list_all(self) -> List[TaskContext]:
        """Return all stored TaskContexts."""
        ...


class BasePolicyRepository(abc.ABC):
    """
    Abstract repository for GovernancePolicy management.

    Policies stored here are the live, mutable collection.
    The RuntimeSession snapshots them immutably at interception time.
    """

    @abc.abstractmethod
    def get_all(self) -> List[GovernancePolicy]:
        """Return all stored policies."""
        ...

    @abc.abstractmethod
    def add(self, policy: GovernancePolicy) -> None:
        """Store a policy. Overwrites if policy_id already exists."""
        ...

    @abc.abstractmethod
    def delete(self, policy_id: str) -> bool:
        """Delete a policy by ID. Returns True if deleted, False if not found."""
        ...


class BaseAuditRepository(abc.ABC):
    """
    Abstract repository for AuditEvent storage.

    Append-oriented. M9 does not guarantee tamper-resistance;
    that is a future persistence/security concern.
    """

    @abc.abstractmethod
    def append(self, event: AuditEvent) -> None:
        """Append an audit event."""
        ...

    @abc.abstractmethod
    def get_by_session(self, session_id: str) -> List[AuditEvent]:
        """Return all audit events for a given session."""
        ...

    @abc.abstractmethod
    def get_all(self, since=None) -> List[AuditEvent]:
        """Return all audit events, optionally filtered by timestamp."""
        ...

    @abc.abstractmethod
    def get_recent(self, limit: int) -> List[AuditEvent]:
        """Return the most recent audit events."""
        ...

    @abc.abstractmethod
    def get_metrics(self, since=None) -> dict:
        """Return aggregated metrics directly from the database."""
        ...

    @abc.abstractmethod
    def get_timeseries(self, since=None) -> List[tuple]:
        """Return raw timestamp and decision tuples for time-series aggregation."""
        ...

class BaseSessionRepository(abc.ABC):
    """
    Abstract repository for AgentSession storage.
    """
    
    @abc.abstractmethod
    def add(self, session_data: dict) -> None:
        """Store a session."""
        ...

    @abc.abstractmethod
    def get(self, session_id: str) -> Optional[dict]:
        """Retrieve a session by ID."""
        ...

    @abc.abstractmethod
    def get_all(self) -> List[dict]:
        """Return all sessions."""
        ...

    @abc.abstractmethod
    def update_status(self, session_id: str, status: str) -> bool:
        """Update the status of a session."""
        ...
