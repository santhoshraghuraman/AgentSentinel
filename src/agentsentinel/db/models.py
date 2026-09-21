"""
SQLAlchemy Models (Milestone 10).

Defines the database schema for M10.
The JSON columns are used to store capability objects, conditions,
and M8 output records in a schema-agnostic way that preserves
the M8 snapshot structures.
"""

from sqlalchemy import Column, String, Integer, DateTime, JSON
from src.agentsentinel.db.database import Base


class TaskContextModel(Base):
    """SQLAlchemy model for TaskContext."""
    __tablename__ = "tasks"

    task_id = Column(String, primary_key=True, index=True)
    description = Column(String, nullable=True)
    allowed_capabilities = Column(JSON, nullable=False, default=list)
    denied_capabilities = Column(JSON, nullable=False, default=list)


class GovernancePolicyModel(Base):
    """SQLAlchemy model for GovernancePolicy."""
    __tablename__ = "policies"

    policy_id = Column(String, primary_key=True, index=True)
    decision = Column(String, nullable=False)
    priority = Column(Integer, nullable=False, default=0)
    condition = Column(JSON, nullable=False, default=dict)
    description = Column(String, nullable=True)


class AuditEventModel(Base):
    """SQLAlchemy model for AuditEvent."""
    __tablename__ = "audit_events"

    interception_id = Column(String, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=False)
    sequence_number = Column(Integer, nullable=False)
    timestamp = Column(DateTime, nullable=False)
    decision = Column(String, nullable=False)
    execution_state = Column(String, nullable=False)
    action_payload = Column(JSON, nullable=True)
    action_record = Column(JSON, nullable=True)
    error_message = Column(String, nullable=True)
    task_id = Column(String, nullable=True)
    tool_name = Column(String, nullable=True)
    arguments = Column(JSON, nullable=True)
    execution_result = Column(String, nullable=True)

class AgentSessionModel(Base):
    """SQLAlchemy model for AgentSession."""
    __tablename__ = "sessions"

    session_id = Column(String, primary_key=True, index=True)
    task_id = Column(String, nullable=False, index=True)
    agent_id = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False)
    status = Column(String, nullable=False)
