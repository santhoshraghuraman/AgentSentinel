"""
Action Normalizer for AgentSentinel.

Transforms raw ToolCall objects from any dataset into a unified
NormalizedAction representation using deterministic, source-aware
mapping rules.

Two normalization strategies:
    - SyFi: Static vocabulary map for system-level tools.
    - ATBench: Heuristic structural parsing for third-party API tool names.

Normalization is:
    - Deterministic: same input always produces same output.
    - Source-aware: different datasets use different mapping strategies.
    - Loss-minimizing: original_tool_name, arguments, metadata, raw_data preserved.
    - Streaming-compatible: operates as a lazy iterator.
"""

import logging
import hashlib
from typing import Iterator, Optional, Tuple

from src.agentsentinel.models.trajectory import Trajectory, Event, ToolCall
from src.agentsentinel.models.normalized import (
    ActionCategory,
    NormalizedAction,
    NormalizedEvent,
    NormalizedTrajectory,
)

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────
# SyFi Static Vocabulary Map
# ──────────────────────────────────────────────────────────

# Maps SyFi tool names to (category, provider, operation, resource,
#                           is_mutating, is_destructive, normalized_name)
_SYFI_CODE_EXECUTION = {
    "Bash", "exec_command", "exec", "shell_command", "shell",
    "run", "bash", "BashOutput", "KillBash", "KillShell",
}

_SYFI_FILE_READ = {
    "Read", "Grep", "Glob", "LS", "Explore",
}

_SYFI_FILE_WRITE = {
    "Edit", "Write", "apply_patch", "MultiEdit", "NotebookEdit",
    "TodoWrite",
}

_SYFI_WEB = {
    "WebFetch", "WebSearch", "browser_navigate",
    "browser_console_messages", "browser_resize",
    "browser_snapshot", "browser_take_screenshot",
}

_SYFI_AGENT_CONTROL = {
    "TaskCreate", "TaskUpdate", "TaskStop", "TaskGet", "TaskList",
    "TaskSearch", "TaskOutput", "wait", "wait_agent",
    "ScheduleWakeup", "Agent", "spawn_agent", "close_agent",
    "list_agents", "interrupt_agent", "resume_agent",
    "send_message", "SendMessage", "AskUserQuestion",
    "request_user_input", "Monitor", "update_plan",
    "EnterPlanMode", "ExitPlanMode", "EnterWorktree",
    "ExitWorktree", "ToolSearch", "Skill", "Workflow", "Task",
    "Artifact", "StructuredOutput", "ReportFindings",
    "PushNotification", "SendUserFile", "followup_task",
    "send_input", "get_goal", "update_goal", "create_goal",
    "CronCreate", "CronDelete", "CronList",
    "list_mcp_resources", "list_mcp_resource_templates",
    "read_mcp_resource", "set_project_property",
    "list_projects", "TeamCreate",
    "create_thread", "read_thread", "list_threads",
    "wait_threads", "read_thread_terminal",
    "write_stdin", "LSP",
}


def _normalize_syfi_tool(tool_name: str) -> Tuple[
    ActionCategory, str, str, Optional[str],
    Optional[bool], Optional[bool]
]:
    """
    Returns (category, provider, operation, resource, is_mutating, is_destructive)
    for a SyFi tool name using the static vocabulary map.
    """
    if tool_name in _SYFI_CODE_EXECUTION:
        return (ActionCategory.CODE_EXECUTION, "system", "execute", "shell",
                None, None)
    if tool_name in _SYFI_FILE_READ:
        return (ActionCategory.FILE_SYSTEM_READ, "system", "read", "file",
                False, False)
    if tool_name in _SYFI_FILE_WRITE:
        return (ActionCategory.FILE_SYSTEM_WRITE, "system", "write", "file",
                True, None)
    if tool_name in _SYFI_WEB:
        return (ActionCategory.WEB_REQUEST, "system", "web_request", None,
                None, None)
    if tool_name in _SYFI_AGENT_CONTROL:
        return (ActionCategory.AGENT_CONTROL, "agent", tool_name, None,
                None, None)
    # Unknown SyFi tool
    return (ActionCategory.UNKNOWN, None, None, None, None, None)


# ──────────────────────────────────────────────────────────
# ATBench Heuristic Verb Parser
# ──────────────────────────────────────────────────────────

# Verbs ordered longest-first to avoid partial matches
_KNOWN_VERBS = [
    "search", "create", "delete", "update", "remove",
    "transfer", "suspend", "get", "list", "query",
    "void", "clear", "add", "set",
]

# State-effect lookup by verb
_VERB_EFFECTS: dict[str, Tuple[Optional[bool], Optional[bool]]] = {
    # (is_mutating, is_destructive)
    "get": (False, False),
    "list": (False, False),
    "search": (False, False),
    "query": (False, False),
    "create": (True, False),
    "add": (True, False),
    "set": (True, False),
    "update": (True, None),
    "delete": (True, True),
    "remove": (True, True),
    "suspend": (True, True),
    "void": (True, True),
    "clear": (True, True),
    "transfer": (True, None),
}


def _parse_atbench_tool_name(tool_name: str) -> Tuple[
    Optional[str], Optional[str], Optional[str],
    Optional[bool], Optional[bool]
]:
    """
    Deterministically parses an ATBench tool name into
    (provider, operation, resource, is_mutating, is_destructive).

    Patterns:
        provider_verb_resource → provider, verb, resource
        verb_resource          → None, verb, resource
        no known verb          → None, None, None

    Returns None for any component that cannot be confidently derived.
    """
    for verb in _KNOWN_VERBS:
        # Pattern 1: _verb_ in the middle → provider_verb_resource
        marker = f"_{verb}_"
        idx = tool_name.find(marker)
        if idx > 0:
            provider = tool_name[:idx]
            resource = tool_name[idx + len(marker):]
            is_mutating, is_destructive = _VERB_EFFECTS[verb]
            return (provider, verb, resource or None, is_mutating, is_destructive)

        # Pattern 2: starts with verb_ → verb_resource (no provider)
        prefix = f"{verb}_"
        if tool_name.startswith(prefix):
            resource = tool_name[len(prefix):]
            is_mutating, is_destructive = _VERB_EFFECTS[verb]
            return (None, verb, resource or None, is_mutating, is_destructive)

    # Pattern 3/4: no known verb found
    return (None, None, None, None, None)


# ──────────────────────────────────────────────────────────
# Core Normalization Logic
# ──────────────────────────────────────────────────────────

def _normalize_tool_call(
    tool_call: ToolCall,
    source_dataset: str,
) -> NormalizedAction:
    """
    Normalizes a single ToolCall into a NormalizedAction.
    Deterministic: same input always produces same output.
    """
    original_name = tool_call.name or ""

    if source_dataset == "syfi":
        (category, provider, operation, resource,
         is_mutating, is_destructive) = _normalize_syfi_tool(original_name)
        normalized_name = category.value
    elif source_dataset == "atbench":
        (provider, operation, resource,
         is_mutating, is_destructive) = _parse_atbench_tool_name(original_name)
        category = ActionCategory.API_CALL
        normalized_name = "api_request"
    else:
        # Unsupported source: preserve everything, classify as unknown
        category = ActionCategory.UNKNOWN
        normalized_name = "unknown"
        provider = None
        operation = None
        resource = None
        is_mutating = None
        is_destructive = None

    return NormalizedAction(
        normalized_name=normalized_name,
        category=category,
        provider=provider,
        operation=operation,
        resource=resource,
        is_mutating=is_mutating,
        is_destructive=is_destructive,
        original_tool_name=original_name,
        source_dataset=source_dataset,
        arguments=tool_call.arguments,
        metadata=tool_call.metadata,
        raw_data=tool_call.raw_data,
    )


def _generate_deterministic_id(
    trajectory_id: str,
    event_index: int,
) -> str:
    """
    Generates a deterministic event ID based on stable source information.
    Used as a fallback only when the source Event has no ID.
    """
    data = f"{trajectory_id}:event:{event_index}"
    return hashlib.sha256(data.encode("utf-8")).hexdigest()[:16]


def _normalize_event(
    event: Event,
    source_dataset: str,
    trajectory_id: str,
    event_index: int,
) -> NormalizedEvent:
    """
    Normalizes a single Event into a NormalizedEvent.
    ID is inherited from the source Event when available.
    """
    # Inherit ID from source Event, or generate a deterministic fallback
    event_id = getattr(event, "id", None)
    if not event_id:
        event_id = _generate_deterministic_id(trajectory_id, event_index)

    normalized_actions = [
        _normalize_tool_call(tc, source_dataset)
        for tc in event.tool_calls
    ]

    return NormalizedEvent(
        id=event_id,
        timestamp=event.timestamp,
        role=event.role,
        content=event.content,
        normalized_actions=normalized_actions,
    )


def _normalize_trajectory(
    trajectory: Trajectory,
    source_dataset: str,
) -> NormalizedTrajectory:
    """Normalizes a single Trajectory into a NormalizedTrajectory."""
    normalized_events = [
        _normalize_event(event, source_dataset, trajectory.trajectory_id, i)
        for i, event in enumerate(trajectory.events)
    ]

    return NormalizedTrajectory(
        trajectory_id=trajectory.trajectory_id,
        source_dataset=source_dataset,
        events=normalized_events,
        metadata=trajectory.metadata,
    )


# ──────────────────────────────────────────────────────────
# Public API — Streaming Normalizer
# ──────────────────────────────────────────────────────────

def normalize_stream(
    trajectories: Iterator[Trajectory],
    source_dataset: str,
) -> Iterator[NormalizedTrajectory]:
    """
    Lazily normalizes a stream of Trajectories into NormalizedTrajectories.

    Processing overhead is O(1) per trajectory — the full SyFi dataset
    is never loaded into memory. Each trajectory is normalized and yielded
    immediately.

    Args:
        trajectories: An iterator of raw Trajectory objects from a data loader.
        source_dataset: The source identifier ("atbench" or "syfi").

    Yields:
        NormalizedTrajectory objects, one at a time.
    """
    for trajectory in trajectories:
        yield _normalize_trajectory(trajectory, source_dataset)
