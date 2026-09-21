"""
LangChain Integration (Milestone 12).

Provides an adapter and a tool wrapper for integrating LangChain agents
with AgentSentinel. The module gracefully handles the absence of the
optional langchain-core dependency.
"""

from typing import Any, Optional, Dict, Tuple, Type
import json

try:
    from langchain_core.tools import BaseTool
except ImportError:
    # Optional dependency; define a dummy so typing passes but runtime
    # instantiation fails if langchain is missing.
    class BaseTool: # type: ignore
        def __init__(self, *args, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)

from src.agentsentinel.models.normalized import (
    ActionCategory,
    NormalizedAction,
)
from src.agentsentinel.runtime.adapters.base import BaseFrameworkAdapter
from src.agentsentinel.runtime.interceptor import InterceptionResult
from src.agentsentinel.runtime.state import ValidatedInvocation
from src.agentsentinel.integrations.context import get_sentinel_context


class LangChainAdapter(BaseFrameworkAdapter):
    """
    Adapter for LangChain tools.
    """

    def normalize(self, invocation: ValidatedInvocation) -> Optional[NormalizedAction]:
        if not invocation.tool_name:
            return None

        name = invocation.tool_name.lower()
        is_mutating = any(k in name for k in ("write", "create", "delete", "remove", "update", "put"))
        is_destructive = any(k in name for k in ("delete", "remove", "drop", "destroy", "truncate"))
        
        category = ActionCategory.UNKNOWN
        if "read" in name or "get" in name:
            category = ActionCategory.FILE_SYSTEM_READ
        elif is_mutating and not is_destructive:
            category = ActionCategory.FILE_SYSTEM_WRITE
        elif "exec" in name or "run" in name or "shell" in name:
            category = ActionCategory.CODE_EXECUTION

        operation = None
        for op in ("read", "write", "create", "delete", "execute", "list", "get", "put"):
            if op in name:
                operation = op
                break

        resource = None
        args = dict(invocation.frozen_arguments)
        for key in ("path", "file", "url", "command", "query"):
            if key in args and isinstance(args[key], str):
                resource = args[key]
                break

        return NormalizedAction(
            normalized_name=name,
            category=category,
            provider="langchain",
            operation=operation,
            resource=resource,
            is_mutating=is_mutating,
            is_destructive=is_destructive,
            original_tool_name=invocation.tool_name,
            source_dataset="runtime_langchain",
        )

    def handle_block(self, result: InterceptionResult) -> Any:
        return f"Action blocked by AgentSentinel: {result.error_message or 'Policy violation'}"


class SentinelLangChainTool(BaseTool): # type: ignore
    """
    Wrapper for LangChain BaseTool that applies AgentSentinel governance.
    """
    name: str = ""
    description: str = ""
    _inner_tool: BaseTool = None # type: ignore

    def __init__(self, inner_tool: BaseTool, **kwargs: Any):
        super().__init__(
            name=inner_tool.name,
            description=inner_tool.description,
            **kwargs
        )
        self._inner_tool = inner_tool
        
    @property
    def args_schema(self) -> Optional[Type]:
        return self._inner_tool.args_schema

    def _run(self, *args: Any, **kwargs: Any) -> Any:
        service, session_id, task_id = get_sentinel_context()
        if not service or not session_id or not task_id:
            # Bypass if no context is set
            return self._inner_tool._run(*args, **kwargs)
            
        # Map positional arguments to kwargs
        mapped_kwargs = dict(kwargs)
        if args:
            # For a single string input, many simple langchain tools use it
            if len(args) == 1 and isinstance(args[0], str) and not mapped_kwargs:
                # We map it to a generic key so it can be passed via kwargs to execution
                # wait, ValidatedInvocation.execute() calls callable(**kwargs).
                # If inner_tool._run requires a positional argument, callable(**kwargs) might fail
                # if the signature doesn't match. But we can bind args.
                pass
            
            import inspect
            sig = inspect.signature(self._inner_tool._run)
            bound_args = sig.bind(*args, **kwargs)
            bound_args.apply_defaults()
            mapped_kwargs = bound_args.arguments

        frozen_args = tuple(sorted(mapped_kwargs.items()))

        invocation = ValidatedInvocation(
            tool_name=self.name,
            frozen_arguments=frozen_args,
            callable_ref=self._inner_tool._run,
        )

        adapter = LangChainAdapter(service._interceptor)
        return service.execute_tool(adapter, session_id, task_id, invocation)
