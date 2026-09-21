"""
Audit Service (Milestone 9).

Read-only access to M8 audit events through the repository layer.
This service does NOT mutate authoritative M8 audit semantics.
"""

from typing import List

from src.agentsentinel.repositories.base import BaseAuditRepository
from src.agentsentinel.api.schemas import (
    SafeActionResponse,
    SafeAuditEventResponse,
    SafeActionDecisionRecordResponse,
    SafeGovernanceReasonResponse,
)


class AuditService:
    """
    Read-only audit event access.

    Translates AuditEvent domain objects into safe API DTOs.
    """

    def __init__(self, audit_repo: BaseAuditRepository):
        self._audit_repo = audit_repo

    def get_by_session(self, session_id: str) -> List[SafeAuditEventResponse]:
        """Return safe audit DTOs for a given session."""
        events = self._audit_repo.get_by_session(session_id)
        return [self._to_response(e) for e in events]

    def get_all(self, since=None) -> List[SafeAuditEventResponse]:
        """Return all audit events as safe DTOs, optionally filtered by timestamp."""
        events = self._audit_repo.get_all(since=since)
        return [self._to_response(e) for e in events]

    def get_recent(self, limit: int = 20) -> List[SafeAuditEventResponse]:
        """Return the most recent audit events as safe DTOs."""
        events = self._audit_repo.get_recent(limit=limit)
        return [self._to_response(e) for e in events]

    def get_metrics(self, since=None) -> dict:
        """Return aggregated metrics directly from the repository."""
        return self._audit_repo.get_metrics(since=since)

    def get_timeseries(self, since=None, bucket_seconds: int = 60) -> List[dict]:
        """Return time-series aggregated metrics with zero-filled empty buckets."""
        events = self._audit_repo.get_timeseries(since=since)
        
        if not events and not since:
            return []

        import math
        from datetime import datetime

        buckets = {}
        for ts, decision in events:
            # Use timestamp math for reliable bucketing regardless of naive/aware
            ts_epoch = ts.timestamp()
            bucket_epoch = math.floor(ts_epoch / bucket_seconds) * bucket_seconds
            bucket_dt = datetime.fromtimestamp(bucket_epoch)
            bucket_str = bucket_dt.isoformat()
            
            if bucket_str not in buckets:
                buckets[bucket_str] = {"time": bucket_str, "allow": 0, "alert": 0, "block": 0}
            
            d = decision.lower() if decision else "unknown"
            if d in buckets[bucket_str]:
                buckets[bucket_str][d] += 1

        if since:
            start_ts = since.timestamp()
        elif buckets:
            start_ts = min(datetime.fromisoformat(b).timestamp() for b in buckets.keys())
        else:
            return []

        # End time should be now to show the full selected window up to present
        end_ts = datetime.utcnow().timestamp()
        
        start_epoch = math.floor(start_ts / bucket_seconds) * bucket_seconds
        end_epoch = math.floor(end_ts / bucket_seconds) * bucket_seconds
        
        current_epoch = start_epoch
        result = []
        while current_epoch <= end_epoch:
            bucket_dt = datetime.fromtimestamp(current_epoch)
            bucket_str = bucket_dt.isoformat()
            if bucket_str in buckets:
                result.append(buckets[bucket_str])
            else:
                result.append({"time": bucket_str, "allow": 0, "alert": 0, "block": 0})
            current_epoch += bucket_seconds
            
        return result

    @staticmethod
    def _to_response(event) -> SafeAuditEventResponse:
        """Translate AuditEvent to safe API response."""
        safe_action = None
        if event.action is not None:
            safe_action = SafeActionResponse(
                normalized_name=event.action.normalized_name,
                category=event.action.category.value,
                provider=event.action.provider,
                operation=event.action.operation,
                resource=event.action.resource,
                is_mutating=event.action.is_mutating,
                is_destructive=event.action.is_destructive,
                source_dataset=event.action.source_dataset,
            )

        safe_record = None
        if hasattr(event, 'action_record') and event.action_record is not None:
            reasons = []
            if hasattr(event.action_record, 'reasons') and event.action_record.reasons:
                reasons = [
                    SafeGovernanceReasonResponse(
                        rule_type=r.rule_type,
                        description=r.description,
                        matched_policy_id=getattr(r, 'matched_policy_id', None),
                        policy_priority=getattr(r, 'policy_priority', None),
                    )
                    for r in event.action_record.reasons
                ]
            
            risk_severity = None
            if hasattr(event.action_record, 'risk_severity') and event.action_record.risk_severity:
                risk_severity = getattr(event.action_record.risk_severity, 'name', None)
                
            auth_status = ""
            if hasattr(event.action_record, 'auth_status') and event.action_record.auth_status:
                auth_status = getattr(event.action_record.auth_status, 'value', "")
                
            matched_policy_id = None
            if hasattr(event.action_record, 'matched_policy') and event.action_record.matched_policy:
                matched_policy_id = getattr(event.action_record.matched_policy, 'policy_id', None)
                
            # These are the new explainability fields
            ml_probability = getattr(event.action_record, 'ml_probability', None)
            risk_score = getattr(event.action_record, 'risk_score', None)
            features = getattr(event.action_record, 'features', None)
            
            decision = ""
            if hasattr(event.action_record, 'decision') and event.action_record.decision:
                decision = getattr(event.action_record.decision, 'value', "")

            safe_record = SafeActionDecisionRecordResponse(
                decision=decision,
                risk_severity=risk_severity,
                auth_status=auth_status,
                matched_policy_id=matched_policy_id,
                ml_probability=ml_probability,
                risk_score=risk_score,
                features=features,
                reasons=reasons,
            )

        return SafeAuditEventResponse(
            interception_id=event.interception_id,
            session_id=event.session_id,
            task_id=event.task_id,
            sequence_number=event.sequence_number,
            timestamp=event.timestamp.isoformat() if hasattr(event.timestamp, 'isoformat') else str(event.timestamp),
            tool_name=event.tool_name,
            arguments=event.arguments or {},
            decision=event.decision.value,
            execution_state=event.execution_state.value if hasattr(event.execution_state, 'value') else event.execution_state,
            execution_result=event.execution_result,
            action=safe_action,
            action_record=safe_record,
            error_message=event.error_message,
        )
