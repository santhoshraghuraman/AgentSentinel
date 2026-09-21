"""
Agent Sentinel Integrations (Milestone 12).
"""

from .context import (
    set_sentinel_context,
    get_sentinel_context,
)
from .service import LocalSentinelService
from .callable_integration import sentinel_tool, CallableAdapter

__all__ = [
    "set_sentinel_context",
    "get_sentinel_context",
    "LocalSentinelService",
    "sentinel_tool",
    "CallableAdapter",
]
