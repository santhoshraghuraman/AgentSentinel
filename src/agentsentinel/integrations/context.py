"""
Context management for M12 Integrations.

Provides ContextVars to safely pass the LocalSentinelService, session_id,
and task_id to stateless framework tools without polluting signatures
or risking cross-session state bleed in concurrent execution.
"""

from contextvars import ContextVar
from typing import Optional

# We use string names for debugging and isolation
_sentinel_service_ctx: ContextVar[Optional["LocalSentinelService"]] = ContextVar("sentinel_service", default=None)  # type: ignore
_sentinel_session_ctx: ContextVar[Optional[str]] = ContextVar("sentinel_session_id", default=None)
_sentinel_task_ctx: ContextVar[Optional[str]] = ContextVar("sentinel_task_id", default=None)

def set_sentinel_context(service: "LocalSentinelService", session_id: str, task_id: str) -> None: # type: ignore
    """Set the current AgentSentinel context variables."""
    _sentinel_service_ctx.set(service)
    _sentinel_session_ctx.set(session_id)
    _sentinel_task_ctx.set(task_id)

def get_sentinel_context() -> tuple[Optional["LocalSentinelService"], Optional[str], Optional[str]]: # type: ignore
    """Retrieve the current AgentSentinel context variables."""
    return (
        _sentinel_service_ctx.get(),
        _sentinel_session_ctx.get(),
        _sentinel_task_ctx.get(),
    )
