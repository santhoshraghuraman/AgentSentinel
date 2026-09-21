from typing import List, Optional, Dict
import datetime

from src.agentsentinel.repositories.base import BaseSessionRepository, BaseAuditRepository
from src.agentsentinel.api.schemas import SafeSessionResponse

class SessionService:
    """Service for managing AgentSessions."""

    def __init__(self, session_repo: BaseSessionRepository, audit_repo: Optional[BaseAuditRepository] = None):
        self._session_repo = session_repo
        self._audit_repo = audit_repo

    def create_session(self, session_id: str, task_id: str, agent_id: str = "default") -> SafeSessionResponse:
        session_data = {
            "session_id": session_id,
            "task_id": task_id,
            "agent_id": agent_id,
            "created_at": datetime.datetime.now(datetime.UTC),
            "status": "active"
        }
        self._session_repo.add(session_data)
        
        return SafeSessionResponse(
            session_id=session_id,
            task_id=task_id,
            agent_id=agent_id,
            created_at=session_data["created_at"].isoformat(),
            status=session_data["status"],
            verdict_counts={"ALLOW": 0, "BLOCK": 0, "ALERT": 0},
            total_events=0
        )

    def update_status(self, session_id: str, status: str) -> bool:
        return self._session_repo.update_status(session_id, status)

    def _get_verdict_counts(self, session_id: str) -> tuple[Dict[str, int], int]:
        if not self._audit_repo:
            return {"ALLOW": 0, "BLOCK": 0, "ALERT": 0}, 0
            
        events = self._audit_repo.get_by_session(session_id)
        counts = {"ALLOW": 0, "BLOCK": 0, "ALERT": 0}
        for event in events:
            if event.decision and event.decision.value in counts:
                counts[event.decision.value] += 1
                
        return counts, len(events)

    def get_session(self, session_id: str) -> Optional[SafeSessionResponse]:
        data = self._session_repo.get(session_id)
        if not data:
            return None
            
        verdict_counts, total_events = self._get_verdict_counts(session_id)
            
        return SafeSessionResponse(
            session_id=data["session_id"],
            task_id=data["task_id"],
            agent_id=data["agent_id"],
            created_at=data["created_at"].isoformat() if isinstance(data["created_at"], datetime.datetime) else data["created_at"],
            status=data["status"],
            verdict_counts=verdict_counts,
            total_events=total_events
        )

    def list_sessions(self) -> List[SafeSessionResponse]:
        sessions = self._session_repo.get_all()
        result = []
        for d in sessions:
            verdict_counts, total_events = self._get_verdict_counts(d["session_id"])
            result.append(
                SafeSessionResponse(
                    session_id=d["session_id"],
                    task_id=d["task_id"],
                    agent_id=d["agent_id"],
                    created_at=d["created_at"].isoformat() if isinstance(d["created_at"], datetime.datetime) else d["created_at"],
                    status=d["status"],
                    verdict_counts=verdict_counts,
                    total_events=total_events
                )
            )
        return result
