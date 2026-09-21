"""
Tests for SQL Repositories (Milestone 10).
"""

import pytest
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.agentsentinel.db.database import Base
from src.agentsentinel.repositories.sql import SQLTaskRepository, SQLPolicyRepository, SQLAuditRepository
from src.agentsentinel.authorization.models import TaskContext, CapabilityGrant, ActionCategory
from src.agentsentinel.governance.models import GovernancePolicy, GovernanceDecision, PolicyCondition
from src.agentsentinel.runtime.audit import AuditEvent
from src.agentsentinel.runtime.state import ExecutionState


@pytest.fixture(scope="function")
def db_session():
    """Provides a fresh in-memory SQLite database per test."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    yield session
    session.close()


def test_task_repository_crud(db_session):
    repo = SQLTaskRepository(db_session)
    
    # Add
    task = TaskContext(
        task_id="task_1",
        task_description="DB Test Task",
        allowed_capabilities=(CapabilityGrant(category=ActionCategory.CODE_EXECUTION),),
        denied_capabilities=()
    )
    repo.add(task)
    
    # Get
    retrieved = repo.get("task_1")
    assert retrieved is not None
    assert retrieved.task_id == "task_1"
    assert retrieved.task_description == "DB Test Task"
    assert len(retrieved.allowed_capabilities) == 1
    assert retrieved.allowed_capabilities[0].category == ActionCategory.CODE_EXECUTION
    
    # List all
    tasks = repo.list_all()
    assert len(tasks) == 1
    
    # Update (Merge)
    updated_task = TaskContext(
        task_id="task_1",
        task_description="Updated Task",
        allowed_capabilities=(),
        denied_capabilities=()
    )
    repo.add(updated_task)
    
    retrieved_updated = repo.get("task_1")
    assert retrieved_updated.task_description == "Updated Task"
    assert len(retrieved_updated.allowed_capabilities) == 0


def test_policy_repository_crud(db_session):
    repo = SQLPolicyRepository(db_session)
    
    # Add
    policy = GovernancePolicy(
        policy_id="policy_1",
        decision=GovernanceDecision.BLOCK,
        condition=PolicyCondition(categories=frozenset([ActionCategory.API_CALL])),
        priority=100,
        description="Block API"
    )
    repo.add(policy)
    
    # Get all
    policies = repo.get_all()
    assert len(policies) == 1
    assert policies[0].policy_id == "policy_1"
    assert policies[0].decision == GovernanceDecision.BLOCK
    assert ActionCategory.API_CALL in policies[0].condition.categories
    
    # Delete
    deleted = repo.delete("policy_1")
    assert deleted is True
    
    policies_after = repo.get_all()
    assert len(policies_after) == 0


def test_audit_repository_append(db_session):
    repo = SQLAuditRepository(db_session)
    
    event = AuditEvent(
        interception_id="intercept_1",
        session_id="session_1",
        sequence_number=1,
        timestamp=datetime.now(timezone.utc),
        decision=GovernanceDecision.ALLOW,
        execution_state=ExecutionState.ATTEMPTED,
        action=None,
        action_record=None,
        error_message=None
    )
    
    repo.append(event)
    
    # Retrieve
    events = repo.get_by_session("session_1")
    assert len(events) == 1
    assert events[0].interception_id == "intercept_1"
    assert events[0].decision == GovernanceDecision.ALLOW
    
    # Ensure sequence number ordering is preserved
    event2 = AuditEvent(
        interception_id="intercept_2",
        session_id="session_1",
        sequence_number=2,
        timestamp=datetime.now(timezone.utc),
        decision=GovernanceDecision.BLOCK,
        execution_state=ExecutionState.BLOCKED,
        action=None,
        action_record=None,
        error_message="Blocked by policy"
    )
    repo.append(event2)
    
    events_all = repo.get_all()
    assert len(events_all) == 2
    assert events_all[0].sequence_number == 1
    assert events_all[1].sequence_number == 2
