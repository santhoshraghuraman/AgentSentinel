"""
Policy Service (Milestone 9).

Manage GovernancePolicy records in the in-memory repository.
"""

from typing import List

from src.agentsentinel.governance.models import (
    GovernancePolicy,
    GovernanceDecision,
    PolicyCondition,
)
from src.agentsentinel.risk.models import Severity
from src.agentsentinel.authorization.models import AuthorizationStatus, ActionCategory, ResourceScope, ResourceMatchMode
from src.agentsentinel.repositories.base import BasePolicyRepository
from src.agentsentinel.api.schemas import CreatePolicyRequest, SafePolicyResponse


class PolicyService:
    """
    Manages in-memory GovernancePolicy records.
    """

    def __init__(self, policy_repo: BasePolicyRepository):
        self._policy_repo = policy_repo

    def create_policy(self, request: CreatePolicyRequest) -> GovernancePolicy:
        """Create and store a new GovernancePolicy."""
        try:
            decision = GovernanceDecision(request.decision.lower())
        except ValueError:
            decision = GovernanceDecision.BLOCK

        cond_dict = request.condition
        
        # Parse severities
        severities = None
        if "risk_severities" in cond_dict:
            severities = frozenset(
                Severity(s.upper()) for s in cond_dict["risk_severities"]
            )
            
        # Parse auth statuses
        auth_statuses = None
        if "auth_statuses" in cond_dict:
            auth_statuses = frozenset(
                AuthorizationStatus(s.lower()) for s in cond_dict["auth_statuses"]
            )
            
        # Parse categories
        categories = None
        if "categories" in cond_dict:
            categories = frozenset(
                ActionCategory(c.lower()) for c in cond_dict["categories"]
            )
            
        # Parse operations
        operations = None
        if "operations" in cond_dict:
            operations = frozenset(cond_dict["operations"])
            
        # Parse resource_scope
        resource_scope = None
        scope_dict = cond_dict.get("resource_scope")
        if scope_dict:
            mode = ResourceMatchMode(scope_dict.get("match_mode", "exact"))
            resource_scope = ResourceScope(match_mode=mode, value=scope_dict.get("value", ""))

        condition = PolicyCondition(
            risk_severities=severities,
            auth_statuses=auth_statuses,
            categories=categories,
            operations=operations,
            resource_scope=resource_scope
        )

        policy = GovernancePolicy(
            policy_id=request.policy_id,
            decision=decision,
            condition=condition,
            priority=request.priority,
            description=request.description
        )

        self._policy_repo.add(policy)
        return policy

    def list_policies(self) -> List[SafePolicyResponse]:
        """Return all policies safely."""
        policies = self._policy_repo.get_all()
        return [
            SafePolicyResponse(
                policy_id=p.policy_id,
                decision=p.decision.value,
                priority=p.priority,
                description=p.description
            ) for p in policies
        ]
