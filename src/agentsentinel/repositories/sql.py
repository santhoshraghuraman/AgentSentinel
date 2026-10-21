"""
SQL Repository Implementations (Milestone 10).

SQLAlchemy implementations of the repository interfaces.
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional, Any, Dict
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from src.agentsentinel.authorization.models import TaskContext, CapabilityGrant, CapabilityDeny, ActionCategory, ResourceScope, ResourceMatchMode
from src.agentsentinel.governance.models import GovernancePolicy, GovernanceDecision, PolicyCondition
from src.agentsentinel.risk.models import Severity
from src.agentsentinel.authorization.models import AuthorizationStatus
from src.agentsentinel.runtime.audit import AuditEvent
from src.agentsentinel.models.normalized import NormalizedAction
from src.agentsentinel.runtime.state import ExecutionState
from src.agentsentinel.repositories.base import (
    BaseAuditRepository,
    BasePolicyRepository,
    BaseTaskRepository,
)
from src.agentsentinel.db.models import TaskContextModel, GovernancePolicyModel, AuditEventModel

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────
# SQL Task Repository
# ──────────────────────────────────────────────────────────

class SQLTaskRepository(BaseTaskRepository):
    """SQLAlchemy implementation of TaskContext storage."""

    def __init__(self, session: Session):
        self._session = session

    def get(self, task_id: str) -> Optional[TaskContext]:
        model = self._session.query(TaskContextModel).filter(TaskContextModel.task_id == task_id).first()
        if not model:
            return None
        return self._to_domain(model)

    def add(self, task_context: TaskContext) -> None:
        model = TaskContextModel(
            task_id=task_context.task_id,
            description=task_context.task_description,
            allowed_capabilities=[self._serialize_grant(c) for c in task_context.allowed_capabilities],
            denied_capabilities=[self._serialize_deny(c) for c in task_context.denied_capabilities],
        )
        self._session.merge(model)
        self._session.commit()

    def list_all(self) -> List[TaskContext]:
        models = self._session.query(TaskContextModel).all()
        return [self._to_domain(m) for m in models]

    # --- Serialization Helpers ---

    @staticmethod
    def _serialize_grant(grant: CapabilityGrant) -> dict:
        return {
            "category": grant.category.value,
            "allowed_operations": list(grant.allowed_operations) if grant.allowed_operations else None,
            "resource_scope": {
                "match_mode": grant.resource_scope.match_mode.value,
                "value": grant.resource_scope.value
            } if grant.resource_scope else None
        }

    @staticmethod
    def _serialize_deny(deny: CapabilityDeny) -> dict:
        return {
            "category": deny.category.value,
            "denied_operations": list(deny.denied_operations) if deny.denied_operations else None,
            "resource_scope": {
                "match_mode": deny.resource_scope.match_mode.value,
                "value": deny.resource_scope.value
            } if deny.resource_scope else None
        }

    @staticmethod
    def _to_domain(model: TaskContextModel) -> TaskContext:
        allowed = []
        for cap in model.allowed_capabilities:
            rs = cap.get("resource_scope")
            allowed.append(CapabilityGrant(
                category=ActionCategory(cap["category"]),
                allowed_operations=tuple(cap["allowed_operations"]) if cap.get("allowed_operations") else None,
                resource_scope=ResourceScope(
                    match_mode=ResourceMatchMode(rs["match_mode"]),
                    value=rs["value"]
                ) if rs else None
            ))
            
        denied = []
        for cap in model.denied_capabilities:
            rs = cap.get("resource_scope")
            denied.append(CapabilityDeny(
                category=ActionCategory(cap["category"]),
                denied_operations=tuple(cap["denied_operations"]) if cap.get("denied_operations") else None,
                resource_scope=ResourceScope(
                    match_mode=ResourceMatchMode(rs["match_mode"]),
                    value=rs["value"]
                ) if rs else None
            ))

        return TaskContext(
            task_id=model.task_id,
            task_description=model.description,
            allowed_capabilities=tuple(allowed),
            denied_capabilities=tuple(denied)
        )


# ──────────────────────────────────────────────────────────
# SQL Policy Repository
# ──────────────────────────────────────────────────────────

class SQLPolicyRepository(BasePolicyRepository):
    """SQLAlchemy implementation of GovernancePolicy storage."""

    def __init__(self, session: Session):
        self._session = session

    def get_all(self) -> List[GovernancePolicy]:
        models = self._session.query(GovernancePolicyModel).all()
        return [self._to_domain(m) for m in models]

    def add(self, policy: GovernancePolicy) -> None:
        model = GovernancePolicyModel(
            policy_id=policy.policy_id,
            decision=policy.decision.value,
            priority=policy.priority,
            description=policy.description,
            condition=self._serialize_condition(policy.condition)
        )
        self._session.merge(model)
        self._session.commit()

    def delete(self, policy_id: str) -> bool:
        model = self._session.query(GovernancePolicyModel).filter(GovernancePolicyModel.policy_id == policy_id).first()
        if model:
            self._session.delete(model)
            self._session.commit()
            return True
        return False

    @staticmethod
    def _serialize_condition(cond: PolicyCondition) -> dict:
        return {
            "risk_severities": [s.name for s in cond.risk_severities] if cond.risk_severities else None,
            "auth_statuses": [s.value for s in cond.auth_statuses] if cond.auth_statuses else None,
            "categories": [c.value for c in cond.categories] if cond.categories else None,
            "operations": list(cond.operations) if cond.operations else None,
            "resource_scope": {
                "match_mode": cond.resource_scope.match_mode.value,
                "value": cond.resource_scope.value
            } if cond.resource_scope else None
        }

    @staticmethod
    def _to_domain(model: GovernancePolicyModel) -> GovernancePolicy:
        cond_data = model.condition
        rs = cond_data.get("resource_scope")
        
        condition = PolicyCondition(
            risk_severities=frozenset(Severity[s] for s in cond_data["risk_severities"]) if cond_data.get("risk_severities") else None,
            auth_statuses=frozenset(AuthorizationStatus(s) for s in cond_data["auth_statuses"]) if cond_data.get("auth_statuses") else None,
            categories=frozenset(ActionCategory(c) for c in cond_data["categories"]) if cond_data.get("categories") else None,
            operations=frozenset(cond_data["operations"]) if cond_data.get("operations") else None,
            resource_scope=ResourceScope(
                match_mode=ResourceMatchMode(rs["match_mode"]),
                value=rs["value"]
            ) if rs else None
        )
        
        return GovernancePolicy(
            policy_id=model.policy_id,
            decision=GovernanceDecision(model.decision),
            condition=condition,
            priority=model.priority,
            description=model.description
        )


# ──────────────────────────────────────────────────────────
# SQL Audit Repository
# ──────────────────────────────────────────────────────────

class SQLAuditRepository(BaseAuditRepository):
    """
    SQLAlchemy implementation of AuditEvent storage.
    Append-only repository.
    """

    def __init__(self, session: Session):
        self._session = session

    def append(self, event: AuditEvent) -> None:
        """
        Append an audit event.
        If this fails, it raises an exception which MUST be caught by the API
        to fulfill the fail-safe contract (logging and returning 500 without
        blocking execution that already occurred in M8).
        """
        try:
            ts = event.timestamp
            if ts is not None and hasattr(ts, "tzinfo") and ts.tzinfo is not None:
                ts = ts.astimezone(timezone.utc).replace(tzinfo=None)
            model = AuditEventModel(
                interception_id=event.interception_id,
                session_id=event.session_id,
                sequence_number=event.sequence_number,
                timestamp=ts,
                decision=event.decision.value,
                execution_state=event.execution_state.value,
                action_payload=self._serialize_action(event.action) if event.action else None,
                action_record=self._serialize_action_record(event.action_record) if event.action_record else None,
                error_message=event.error_message,
                task_id=event.task_id,
                tool_name=event.tool_name or (event.action.original_tool_name if event.action and hasattr(event.action, 'original_tool_name') and event.action.original_tool_name else (event.action.normalized_name if event.action else "")),
                arguments=event.arguments if event.arguments is not None else (event.action.arguments if event.action and hasattr(event.action, 'arguments') else {}),
                execution_result=event.execution_result
            )
            self._session.add(model)
            self._session.commit()
        except SQLAlchemyError as e:
            self._session.rollback()
            logger.critical("Failed to persist audit event %s: %s", event.interception_id, e)
            raise  # Let the API catch and return 500

    def get_by_session(self, session_id: str) -> List[AuditEvent]:
        models = self._session.query(AuditEventModel).filter(AuditEventModel.session_id == session_id).order_by(AuditEventModel.sequence_number).all()
        return [self._to_domain(m) for m in models]

    def get_all(self, since=None) -> List[AuditEvent]:
        query = self._session.query(AuditEventModel).order_by(AuditEventModel.sequence_number)
        if since:
            if hasattr(since, "tzinfo") and since.tzinfo is not None:
                since = since.astimezone(timezone.utc).replace(tzinfo=None)
            query = query.filter(AuditEventModel.timestamp >= since)
        models = query.all()
        return [self._to_domain(m) for m in models]

    def get_recent(self, limit: int) -> List[AuditEvent]:
        models = self._session.query(AuditEventModel).order_by(AuditEventModel.sequence_number.desc()).limit(limit).all()
        return [self._to_domain(m) for m in reversed(models)]

    def get_metrics(self, since=None) -> dict:
        query = self._session.query(AuditEventModel.decision, AuditEventModel.action_payload)
        if since:
            if hasattr(since, "tzinfo") and since.tzinfo is not None:
                since = since.astimezone(timezone.utc).replace(tzinfo=None)
            query = query.filter(AuditEventModel.timestamp >= since)
            
        results = query.all()
        total_events = len(results)
        
        decisions = {"allow": 0, "block": 0, "alert": 0, "unknown": 0}
        actions = {}
        
        for decision_val, payload in results:
            d = decision_val.lower() if decision_val else "unknown"
            if d in decisions:
                decisions[d] += 1
            else:
                decisions["unknown"] += 1
                
            if payload and "category" in payload:
                cat = payload["category"]
                actions[cat] = actions.get(cat, 0) + 1
                
        return {
            "total_interceptions": total_events,
            "decisions": decisions,
            "actions_by_category": actions
        }

    def get_timeseries(self, since=None) -> List[tuple]:
        query = self._session.query(AuditEventModel.timestamp, AuditEventModel.decision)
        if since:
            if hasattr(since, "tzinfo") and since.tzinfo is not None:
                since = since.astimezone(timezone.utc).replace(tzinfo=None)
            query = query.filter(AuditEventModel.timestamp >= since)
        return query.all()

    # --- Serialization Helpers ---
    # We serialize the action and action_record loosely, as this is an audit log.

    @staticmethod
    def _serialize_action(action: NormalizedAction) -> dict:
        return {
            "normalized_name": action.normalized_name,
            "category": action.category.value,
            "provider": action.provider,
            "operation": action.operation,
            "resource": action.resource,
            "is_mutating": action.is_mutating,
            "is_destructive": action.is_destructive,
            "source_dataset": action.source_dataset,
        }

    @staticmethod
    def _serialize_action_record(record) -> dict:
        # We only need enough representation for audit/HTTP responses
        # The true structure is `ActionDecisionRecord`.
        reasons = []
        for r in record.reasons:
            reasons.append({
                "rule_type": r.rule_type,
                "description": r.description,
                "matched_policy_id": r.matched_policy_id,
                "policy_priority": r.policy_priority
            })
            
        return {
            "decision": record.decision.value,
            "risk_severity": record.risk_severity.name if record.risk_severity else None,
            "auth_status": record.auth_status.value,
            "matched_policy_id": record.matched_policy.policy_id if record.matched_policy else None,
            "ml_probability": getattr(record, 'ml_probability', None),
            "risk_score": getattr(record, 'risk_score', None),
            "features": getattr(record, 'features', None),
            "reasons": reasons
        }

    @staticmethod
    def _to_domain(model: AuditEventModel) -> AuditEvent:
        # Reconstruct the NormalizedAction if present.
        # Since this is read-only for audit, we can instantiate simple objects.
        # However, the Domain AuditEvent requires true objects.
        # Let's reconstruct them minimally.
        
        action = None
        if model.action_payload:
            payload = model.action_payload
            action = NormalizedAction(
                normalized_name=payload.get("normalized_name", "unknown"),
                category=ActionCategory(payload.get("category", "unknown")),
                provider=payload.get("provider"),
                operation=payload.get("operation"),
                resource=payload.get("resource"),
                is_mutating=payload.get("is_mutating"),
                is_destructive=payload.get("is_destructive"),
                original_tool_name=payload.get("normalized_name", "unknown"),
                source_dataset=payload.get("source_dataset", "")
            )

        # To avoid importing ActionDecisionRecord and trying to mock all its internal fields,
        # we can use a mock/fake for the read path, or just let it be None if the API only uses specific fields.
        # Wait, the API AuditService uses specific fields. But AuditEvent type hints ActionDecisionRecord.
        # Since this is an Audit Event from a DB, the ActionDecisionRecord is reconstructed best-effort.
        # The user only requested M9 API read paths for audit. I'll mock it via a namedtuple or simple class.
        class MockRecord:
            pass
            
        action_record = None
        if model.action_record:
            rec = model.action_record
            action_record = MockRecord()
            action_record.decision = GovernanceDecision(rec["decision"])
            
            # Use getattr on Severity/AuthorizationStatus safely
            action_record.risk_severity = Severity[rec["risk_severity"]] if rec["risk_severity"] else None
            action_record.auth_status = AuthorizationStatus(rec["auth_status"]) if rec["auth_status"] else AuthorizationStatus.UNAUTHORIZED_CATEGORY
            
            class MockPolicy:
                def __init__(self, pid):
                    self.policy_id = pid
            action_record.matched_policy = MockPolicy(rec["matched_policy_id"]) if rec.get("matched_policy_id") else None
            
            class MockReason:
                def __init__(self, **kwargs):
                    self.rule_type = kwargs.get("rule_type")
                    self.description = kwargs.get("description")
                    self.matched_policy_id = kwargs.get("matched_policy_id")
                    self.policy_priority = kwargs.get("policy_priority")
            
            action_record.reasons = [MockReason(**r) for r in rec.get("reasons", [])]
            action_record.ml_probability = rec.get("ml_probability")
            action_record.risk_score = rec.get("risk_score")
            action_record.features = rec.get("features")

        return AuditEvent(
            interception_id=model.interception_id,
            session_id=model.session_id,
            sequence_number=model.sequence_number,
            timestamp=model.timestamp,
            decision=GovernanceDecision(model.decision),
            execution_state=ExecutionState(model.execution_state),
            action=action,
            action_record=action_record,
            error_message=model.error_message,
            task_id=model.task_id or "",
            tool_name=model.tool_name or (action.original_tool_name if action and hasattr(action, 'original_tool_name') and action.original_tool_name else (action.normalized_name if action else "")),
            arguments=model.arguments if model.arguments is not None else (action.arguments if action and hasattr(action, 'arguments') else {}),
            execution_result=model.execution_result
        )

# ──────────────────────────────────────────────────────────
# SQL Session Repository
# ──────────────────────────────────────────────────────────

from src.agentsentinel.db.models import AgentSessionModel
from src.agentsentinel.repositories.base import BaseSessionRepository

class SQLSessionRepository(BaseSessionRepository):
    """SQLAlchemy implementation of AgentSession storage."""

    def __init__(self, session: Session):
        self._session = session

    def add(self, session_data: dict) -> None:
        created_at = session_data["created_at"]
        if hasattr(created_at, "tzinfo") and created_at.tzinfo is not None:
            created_at = created_at.astimezone(timezone.utc).replace(tzinfo=None)
        model = AgentSessionModel(
            session_id=session_data["session_id"],
            task_id=session_data["task_id"],
            agent_id=session_data.get("agent_id", "default"),
            created_at=created_at,
            status=session_data["status"],
        )
        self._session.merge(model)
        self._session.commit()

    def get(self, session_id: str) -> Optional[dict]:
        model = self._session.query(AgentSessionModel).filter(AgentSessionModel.session_id == session_id).first()
        if not model:
            return None
        return {
            "session_id": model.session_id,
            "task_id": model.task_id,
            "agent_id": model.agent_id,
            "created_at": model.created_at,
            "status": model.status,
        }

    def get_all(self) -> List[dict]:
        models = self._session.query(AgentSessionModel).order_by(AgentSessionModel.created_at.desc()).all()
        return [
            {
                "session_id": m.session_id,
                "task_id": m.task_id,
                "agent_id": m.agent_id,
                "created_at": m.created_at,
                "status": m.status,
            }
            for m in models
        ]

    def update_status(self, session_id: str, status: str) -> bool:
        model = self._session.query(AgentSessionModel).filter(AgentSessionModel.session_id == session_id).first()
        if model:
            model.status = status
            self._session.commit()
            return True
        return False
