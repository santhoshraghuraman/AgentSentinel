"""
Generic Python Callable Integration (Milestone 12).

Provides an adapter and a decorator for integrating standard Python
functions with AgentSentinel.
"""

import functools
import inspect
from typing import Any, Callable, Optional

from src.agentsentinel.models.normalized import (
    ActionCategory,
    NormalizedAction,
)
from src.agentsentinel.runtime.adapters.base import BaseFrameworkAdapter
from src.agentsentinel.runtime.interceptor import InterceptionResult
from src.agentsentinel.runtime.state import ValidatedInvocation
from src.agentsentinel.integrations.context import get_sentinel_context


class SentinelBlockException(Exception):
    """Exception raised when an action is blocked by AgentSentinel."""
    pass


class CallableAdapter(BaseFrameworkAdapter):
    """
    Adapter for generic Python callables.
    """

    def normalize(self, invocation: ValidatedInvocation) -> Optional[NormalizedAction]:
        if not invocation.tool_name:
            return None

        # Simple heuristic normalization based on the function name
        name = invocation.tool_name.lower()
        is_mutating = any(k in name for k in ("write", "create", "delete", "remove", "update", "put"))
        is_destructive = any(k in name for k in ("delete", "remove", "drop", "destroy", "truncate"))
        
        category = ActionCategory.UNKNOWN
        if "read" in name or "get" in name:
            category = ActionCategory.FILE_SYSTEM_READ
        elif is_mutating and not is_destructive:
            category = ActionCategory.FILE_SYSTEM_WRITE
        elif "exec" in name or "run" in name or "calc" in name:
            category = ActionCategory.CODE_EXECUTION

        operation = None
        for op in ("read", "write", "create", "delete", "execute", "list", "get", "put"):
            if op in name:
                operation = op
                break

        resource = None
        args = dict(invocation.frozen_arguments)
        for key in ("path", "file", "file_path", "url", "command", "query"):
            if key in args and isinstance(args[key], str):
                resource = args[key]
                break

        return NormalizedAction(
            normalized_name=name,
            category=category,
            provider="python",
            operation=operation,
            resource=resource,
            is_mutating=is_mutating,
            is_destructive=is_destructive,
            original_tool_name=invocation.tool_name,
            source_dataset="runtime_callable",
            arguments=args,
        )

    def handle_block(self, result: InterceptionResult) -> Any:
        raise SentinelBlockException(f"Action blocked by AgentSentinel: {result.error_message or 'Policy violation'}")


def sentinel_tool(func: Callable[..., Any]) -> Callable[..., Any]:
    """
    Decorator for tracking and governing a Python function execution.
    """
    @functools.wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        service, session_id, task_id = get_sentinel_context()
        if not service or not session_id or not task_id:
            # Bypass if no context is set (framework not integrated for this run)
            return func(*args, **kwargs)

        # Map positional arguments to keyword arguments using inspect.signature
        sig = inspect.signature(func)
        bound_args = sig.bind(*args, **kwargs)
        bound_args.apply_defaults()
        mapped_kwargs = bound_args.arguments

        frozen_args = tuple(sorted(mapped_kwargs.items()))

        invocation = ValidatedInvocation(
            tool_name=func.__name__,
            frozen_arguments=frozen_args,
            callable_ref=func,
        )

        adapter = CallableAdapter(service._interceptor)
        return service.execute_tool(adapter, session_id, task_id, invocation)

    return wrapper
