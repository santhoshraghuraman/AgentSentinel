"""
AgentSentinel API Entrypoint (Milestone 9).

Initializes the FastAPI application and mounts the API routers.
Global exception handlers ensure internal M8 errors never leak
stack traces to the API consumers.
"""

import logging
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from src.agentsentinel.api.router import router
from src.agentsentinel.api.schemas import HealthResponse


logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="AgentSentinel API",
        description="Runtime Behavioral Governance for LLM Agents.",
        version="0.9.0",
    )

    @app.on_event("startup")
    def startup_seed():
        from src.agentsentinel.db.database import SessionLocal
        from src.agentsentinel.repositories.sql import SQLTaskRepository
        from src.agentsentinel.authorization.models import TaskContext, CapabilityGrant, ActionCategory
        db = SessionLocal()
        try:
            repo = SQLTaskRepository(db)
            if not repo.get("task_1"):
                repo.add(TaskContext(
                    task_id="task_1",
                    task_description="Default Playground Task",
                    allowed_capabilities=(
                        CapabilityGrant(category=ActionCategory.FILE_SYSTEM_READ),
                        CapabilityGrant(category=ActionCategory.CODE_EXECUTION),
                        CapabilityGrant(category=ActionCategory.UNKNOWN),
                    ),
                    denied_capabilities=tuple()
                ))

            from src.agentsentinel.repositories.sql import SQLPolicyRepository
            from src.agentsentinel.governance.models import GovernancePolicy, GovernanceDecision, PolicyCondition
            from src.agentsentinel.risk.models import Severity
            from src.agentsentinel.authorization.models import AuthorizationStatus, ResourceScope, ResourceMatchMode
            
            policy_repo = SQLPolicyRepository(db)
            existing_policies = {p.policy_id for p in policy_repo.get_all()}
            if "pol_allow_read" not in existing_policies:
                policy_repo.add(GovernancePolicy(
                    policy_id="pol_allow_read",
                    decision=GovernanceDecision.ALLOW,
                    priority=10,
                    description="Allow reading public docs",
                    condition=PolicyCondition(
                        categories=frozenset([ActionCategory.FILE_SYSTEM_READ]),
                        resource_scope=ResourceScope(match_mode=ResourceMatchMode.PATTERN, value="*public_docs.txt")
                    )
                ))
            if "pol_alert_calc" not in existing_policies:
                policy_repo.add(GovernancePolicy(
                    policy_id="pol_alert_calc",
                    decision=GovernanceDecision.ALERT,
                    priority=20,
                    description="Alert on calculate",
                    condition=PolicyCondition(
                        categories=frozenset([ActionCategory.CODE_EXECUTION]),
                    )
                ))
            if "pol_block_delete" not in existing_policies:
                policy_repo.add(GovernancePolicy(
                    policy_id="pol_block_delete",
                    decision=GovernanceDecision.BLOCK,
                    priority=30,
                    description="Block sensitive deletions",
                    condition=PolicyCondition(
                        categories=frozenset([ActionCategory.FILE_SYSTEM_WRITE]),
                    )
                ))
        finally:
            db.close()


    # Mount API router
    app.include_router(router, prefix="/api/v1")

    # Global unhandled exception handler
    # Prevents infrastructure/service failures from exposing internals.
    @app.exception_handler(Exception)
    async def global_exception_handler(request, exc):
        logger.error("Unhandled infrastructure exception: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal Server Error",
                "detail": "An unexpected infrastructure failure occurred before or outside M8 evaluation.",
            },
        )

    # Validation exception handler
    # Ensures malformed requests are properly identified as HTTP 422
    # and NOT confused with an M8 governance BLOCK.
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request, exc):
        return JSONResponse(
            status_code=422,
            content={
                "error": "Unprocessable Entity",
                "detail": "The request payload failed API DTO schema validation.",
                "validation_errors": exc.errors(),
            },
        )

    # Health endpoint
    @app.get("/health", response_model=HealthResponse)
    def health_check():
        """Basic system health check."""
        return HealthResponse()

    return app


app = create_app()
