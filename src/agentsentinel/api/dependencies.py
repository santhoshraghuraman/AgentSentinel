"""
API Dependencies (Milestone 10).

Dependency injection container for FastAPI.
Provides request-scoped database sessions and service instances
while keeping the M8 RuntimeInterceptor as a global singleton.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from src.agentsentinel.db.database import get_db, Base, engine
from src.agentsentinel.runtime.interceptor import RuntimeInterceptor
from src.agentsentinel.repositories.sql import (
    SQLAuditRepository,
    SQLPolicyRepository,
    SQLTaskRepository,
    SQLSessionRepository,
)
from src.agentsentinel.services.audit_service import AuditService
from src.agentsentinel.services.policy_service import PolicyService
from src.agentsentinel.services.runtime_service import RuntimeService
from src.agentsentinel.services.task_service import TaskService


# Auto-create tables for SQLite testing if they don't exist
# In production, Alembic handles migrations.
Base.metadata.create_all(bind=engine)


# ──────────────────────────────────────────────────────────
# Global Singletons
# ──────────────────────────────────────────────────────────

# The M8 Engine is inherently stateful (maintains monotonic counters)
# and MUST be a global singleton.
_interceptor = RuntimeInterceptor()


# ──────────────────────────────────────────────────────────
# Dependency Providers
# ──────────────────────────────────────────────────────────

def get_task_repo(db: Session = Depends(get_db)) -> SQLTaskRepository:
    return SQLTaskRepository(db)

def get_policy_repo(db: Session = Depends(get_db)) -> SQLPolicyRepository:
    return SQLPolicyRepository(db)

def get_audit_repo(db: Session = Depends(get_db)) -> SQLAuditRepository:
    return SQLAuditRepository(db)

def get_session_repo(db: Session = Depends(get_db)) -> SQLSessionRepository:
    return SQLSessionRepository(db)


def get_runtime_service(
    task_repo: SQLTaskRepository = Depends(get_task_repo),
    policy_repo: SQLPolicyRepository = Depends(get_policy_repo),
    audit_repo: SQLAuditRepository = Depends(get_audit_repo),
    session_repo: SQLSessionRepository = Depends(get_session_repo),
) -> RuntimeService:
    """Dependency provider for request-scoped RuntimeService."""
    return RuntimeService(
        interceptor=_interceptor,
        task_repo=task_repo,
        policy_repo=policy_repo,
        audit_repo=audit_repo,
        session_repo=session_repo,
    )


def get_audit_service(
    audit_repo: SQLAuditRepository = Depends(get_audit_repo)
) -> AuditService:
    """Dependency provider for request-scoped AuditService."""
    return AuditService(audit_repo=audit_repo)


def get_policy_service(
    policy_repo: SQLPolicyRepository = Depends(get_policy_repo)
) -> PolicyService:
    """Dependency provider for request-scoped PolicyService."""
    return PolicyService(policy_repo=policy_repo)


def get_task_service(
    task_repo: SQLTaskRepository = Depends(get_task_repo)
) -> TaskService:
    """Dependency provider for request-scoped TaskService."""
    return TaskService(task_repo=task_repo)

from src.agentsentinel.services.session_service import SessionService

def get_session_service(
    session_repo: SQLSessionRepository = Depends(get_session_repo),
    audit_repo: SQLAuditRepository = Depends(get_audit_repo)
) -> SessionService:
    return SessionService(session_repo=session_repo, audit_repo=audit_repo)
