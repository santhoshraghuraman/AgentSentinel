"""
Comprehensive tests for Action Normalization (Milestone 2).

Covers:
    - ATBench heuristic verb parsing (provider/operation/resource patterns)
    - SyFi static vocabulary mapping
    - State effects (is_mutating, is_destructive)
    - Unknown / ambiguous tools
    - Provenance preservation (original_tool_name, metadata, raw_data)
    - Deterministic normalization
    - Streaming / lazy behavior
    - Error handling (missing/empty/invalid tool names)
    - NormalizedEvent ID and timestamp inheritance
    - Multiple actions ordering
"""

import pytest
from pathlib import Path
from typing import Iterator

from src.agentsentinel.models.trajectory import (
    Trajectory, Event, EventRole, ToolCall,
)
from src.agentsentinel.models.normalized import (
    ActionCategory, NormalizedAction, NormalizedEvent, NormalizedTrajectory,
)
from src.agentsentinel.normalizers.action_normalizer import (
    _parse_atbench_tool_name,
    _normalize_syfi_tool,
    _normalize_tool_call,
    normalize_stream,
)


# ──────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────

def _make_tool_call(name: str, arguments=None, metadata=None, raw_data=None):
    return ToolCall(
        name=name,
        arguments=arguments or {},
        metadata=metadata or {},
        raw_data=raw_data or {},
    )


def _make_trajectory(trajectory_id, tool_calls, metadata=None):
    events = []
    for tc in tool_calls:
        events.append(Event(
            role=EventRole.TOOL_CALL,
            content="",
            tool_calls=[tc],
            timestamp="2024-01-01T00:00:00Z",
        ))
    return Trajectory(
        trajectory_id=trajectory_id,
        events=events,
        metadata=metadata or {},
    )


# ══════════════════════════════════════════════════════════
# ATBench Heuristic Parsing Tests
# ══════════════════════════════════════════════════════════

class TestATBenchParsing:
    """Tests for ATBench deterministic structural verb parsing."""

    def test_provider_verb_resource(self):
        """google_drive_delete_file_revision → provider=google_drive, op=delete, resource=file_revision"""
        provider, op, resource, mutating, destructive = _parse_atbench_tool_name(
            "google_drive_delete_file_revision"
        )
        assert provider == "google_drive"
        assert op == "delete"
        assert resource == "file_revision"
        assert mutating is True
        assert destructive is True

    def test_verb_resource_no_provider(self):
        """delete_all_sessions → provider=None, op=delete, resource=all_sessions"""
        provider, op, resource, mutating, destructive = _parse_atbench_tool_name(
            "delete_all_sessions"
        )
        assert provider is None
        assert op == "delete"
        assert resource == "all_sessions"
        assert mutating is True
        assert destructive is True

    def test_transfer_no_provider(self):
        """transfer_ethereum_tokens → provider=None, op=transfer, resource=ethereum_tokens"""
        provider, op, resource, mutating, destructive = _parse_atbench_tool_name(
            "transfer_ethereum_tokens"
        )
        assert provider is None
        assert op == "transfer"
        assert resource == "ethereum_tokens"
        assert mutating is True
        assert destructive is None  # transfer is context-dependent

    def test_ambiguous_no_verb(self):
        """finquo_real_time_price_info → all None"""
        provider, op, resource, mutating, destructive = _parse_atbench_tool_name(
            "finquo_real_time_price_info"
        )
        assert provider is None
        assert op is None
        assert resource is None
        assert mutating is None
        assert destructive is None

    def test_create_action(self):
        """gmail_create_filter → provider=gmail, op=create, resource=filter"""
        provider, op, resource, mutating, destructive = _parse_atbench_tool_name(
            "gmail_create_filter"
        )
        assert provider == "gmail"
        assert op == "create"
        assert resource == "filter"
        assert mutating is True
        assert destructive is False  # create is NOT destructive

    def test_update_action(self):
        """dropbox_business_update_team_member_profile"""
        provider, op, resource, mutating, destructive = _parse_atbench_tool_name(
            "dropbox_business_update_team_member_profile"
        )
        assert provider == "dropbox_business"
        assert op == "update"
        assert resource == "team_member_profile"
        assert mutating is True
        assert destructive is None  # update is context-dependent

    def test_get_action(self):
        """get_user_report → read-only"""
        provider, op, resource, mutating, destructive = _parse_atbench_tool_name(
            "get_user_report"
        )
        assert provider is None
        assert op == "get"
        assert resource == "user_report"
        assert mutating is False
        assert destructive is False

    def test_remove_action(self):
        """dropbox_remove_folder_member"""
        provider, op, resource, mutating, destructive = _parse_atbench_tool_name(
            "dropbox_remove_folder_member"
        )
        assert provider == "dropbox"
        assert op == "remove"
        assert resource == "folder_member"
        assert mutating is True
        assert destructive is True


# ══════════════════════════════════════════════════════════
# SyFi Static Mapping Tests
# ══════════════════════════════════════════════════════════

class TestSyFiMapping:
    """Tests for SyFi static vocabulary lookup."""

    def test_bash_code_execution(self):
        """Bash → CODE_EXECUTION, is_mutating=None (cannot determine from name alone)"""
        cat, provider, op, resource, mutating, destructive = _normalize_syfi_tool("Bash")
        assert cat == ActionCategory.CODE_EXECUTION
        assert provider == "system"
        assert op == "execute"
        assert resource == "shell"
        assert mutating is None
        assert destructive is None

    def test_exec_command(self):
        cat, _, _, _, mutating, destructive = _normalize_syfi_tool("exec_command")
        assert cat == ActionCategory.CODE_EXECUTION
        assert mutating is None
        assert destructive is None

    def test_read_file_system_read(self):
        """Read → FILE_SYSTEM_READ, non-mutating, non-destructive"""
        cat, provider, op, resource, mutating, destructive = _normalize_syfi_tool("Read")
        assert cat == ActionCategory.FILE_SYSTEM_READ
        assert provider == "system"
        assert op == "read"
        assert mutating is False
        assert destructive is False

    def test_grep_file_system_read(self):
        cat, _, _, _, mutating, destructive = _normalize_syfi_tool("Grep")
        assert cat == ActionCategory.FILE_SYSTEM_READ
        assert mutating is False

    def test_edit_file_system_write(self):
        """Edit → FILE_SYSTEM_WRITE, mutating, destructive unknown"""
        cat, provider, op, resource, mutating, destructive = _normalize_syfi_tool("Edit")
        assert cat == ActionCategory.FILE_SYSTEM_WRITE
        assert provider == "system"
        assert op == "write"
        assert mutating is True
        assert destructive is None

    def test_apply_patch(self):
        cat, _, _, _, mutating, _ = _normalize_syfi_tool("apply_patch")
        assert cat == ActionCategory.FILE_SYSTEM_WRITE
        assert mutating is True

    def test_task_create_agent_control(self):
        """TaskCreate → AGENT_CONTROL"""
        cat, provider, op, _, mutating, destructive = _normalize_syfi_tool("TaskCreate")
        assert cat == ActionCategory.AGENT_CONTROL
        assert provider == "agent"
        assert op == "TaskCreate"
        assert mutating is None
        assert destructive is None

    def test_wait_agent_control(self):
        cat, _, _, _, _, _ = _normalize_syfi_tool("wait")
        assert cat == ActionCategory.AGENT_CONTROL

    def test_web_fetch(self):
        cat, _, _, _, _, _ = _normalize_syfi_tool("WebFetch")
        assert cat == ActionCategory.WEB_REQUEST

    def test_unknown_syfi_tool(self):
        """An unmapped SyFi tool → UNKNOWN, all fields None"""
        cat, provider, op, resource, mutating, destructive = _normalize_syfi_tool(
            "completely_novel_tool_xyz"
        )
        assert cat == ActionCategory.UNKNOWN
        assert provider is None
        assert op is None
        assert resource is None
        assert mutating is None
        assert destructive is None


# ══════════════════════════════════════════════════════════
# Full ToolCall Normalization Tests
# ══════════════════════════════════════════════════════════

class TestNormalizeToolCall:
    """Tests for _normalize_tool_call integration."""

    def test_atbench_full_normalization(self):
        tc = _make_tool_call(
            "google_drive_delete_file_revision",
            arguments={"file_id": "abc123"},
            metadata={"trace": "x"},
            raw_data={"original": "data"},
        )
        action = _normalize_tool_call(tc, "atbench")

        assert action.normalized_name == "api_request"
        assert action.category == ActionCategory.API_CALL
        assert action.provider == "google_drive"
        assert action.operation == "delete"
        assert action.resource == "file_revision"
        assert action.is_mutating is True
        assert action.is_destructive is True
        assert action.original_tool_name == "google_drive_delete_file_revision"
        assert action.source_dataset == "atbench"
        assert action.arguments == {"file_id": "abc123"}
        assert action.metadata == {"trace": "x"}
        assert action.raw_data == {"original": "data"}

    def test_syfi_full_normalization(self):
        tc = _make_tool_call(
            "Bash",
            metadata={"tool_call_id": "call_123"},
            raw_data={"event_type": "tool_call", "tool_name": "Bash"},
        )
        action = _normalize_tool_call(tc, "syfi")

        assert action.normalized_name == "code_execution"
        assert action.category == ActionCategory.CODE_EXECUTION
        assert action.provider == "system"
        assert action.operation == "execute"
        assert action.is_mutating is None
        assert action.is_destructive is None
        assert action.original_tool_name == "Bash"
        assert action.source_dataset == "syfi"
        assert action.metadata == {"tool_call_id": "call_123"}

    def test_unsupported_source_dataset(self):
        tc = _make_tool_call("some_tool")
        action = _normalize_tool_call(tc, "unknown_dataset")
        assert action.category == ActionCategory.UNKNOWN
        assert action.normalized_name == "unknown"
        assert action.original_tool_name == "some_tool"
        assert action.source_dataset == "unknown_dataset"


# ══════════════════════════════════════════════════════════
# Empty / Missing / Invalid Tool Name Handling
# ══════════════════════════════════════════════════════════

class TestErrorHandling:
    """Tests for edge cases: empty, missing, or invalid tool names."""

    def test_empty_tool_name_atbench(self):
        tc = _make_tool_call("")
        action = _normalize_tool_call(tc, "atbench")
        assert action.category == ActionCategory.API_CALL
        assert action.original_tool_name == ""
        assert action.provider is None
        assert action.operation is None

    def test_empty_tool_name_syfi(self):
        tc = _make_tool_call("")
        action = _normalize_tool_call(tc, "syfi")
        assert action.category == ActionCategory.UNKNOWN
        assert action.original_tool_name == ""

    def test_empty_arguments(self):
        tc = _make_tool_call("Bash", arguments={})
        action = _normalize_tool_call(tc, "syfi")
        assert action.arguments == {}

    def test_none_tool_name_handled(self):
        """ToolCall with name=None should not crash."""
        tc = ToolCall(name="", arguments={})
        action = _normalize_tool_call(tc, "syfi")
        assert action.original_tool_name == ""


# ══════════════════════════════════════════════════════════
# Provenance Preservation Tests
# ══════════════════════════════════════════════════════════

class TestProvenance:
    """Tests verifying source data is never silently discarded."""

    def test_metadata_preserved(self):
        meta = {"tool_call_id": "abc", "tool_index": 0}
        tc = _make_tool_call("Edit", metadata=meta)
        action = _normalize_tool_call(tc, "syfi")
        assert action.metadata == meta

    def test_raw_data_preserved(self):
        raw = {"event_type": "tool_call", "tool_name": "Edit", "content": "x"}
        tc = _make_tool_call("Edit", raw_data=raw)
        action = _normalize_tool_call(tc, "syfi")
        assert action.raw_data == raw

    def test_raw_data_excluded_from_dump(self):
        raw = {"event_type": "tool_call"}
        tc = _make_tool_call("Edit", raw_data=raw)
        action = _normalize_tool_call(tc, "syfi")
        dump = action.model_dump()
        assert "raw_data" not in dump
        assert "metadata" in dump
        assert "original_tool_name" in dump

    def test_original_tool_name_preserved(self):
        tc = _make_tool_call("dropbox_business_suspend_member_from_team")
        action = _normalize_tool_call(tc, "atbench")
        assert action.original_tool_name == "dropbox_business_suspend_member_from_team"

    def test_source_dataset_preserved(self):
        tc = _make_tool_call("Read")
        action = _normalize_tool_call(tc, "syfi")
        assert action.source_dataset == "syfi"


# ══════════════════════════════════════════════════════════
# NormalizedEvent ID and Timestamp Tests
# ══════════════════════════════════════════════════════════

class TestNormalizedEventIdentity:
    """Tests verifying deterministic event ID and timestamp inheritance."""

    def test_event_id_deterministic_fallback(self):
        """When Event has no id, NormalizedEvent gets a deterministic one."""
        traj = _make_trajectory("traj-1", [_make_tool_call("Bash")])
        results = list(normalize_stream(iter([traj]), "syfi"))
        event_id_1 = results[0].events[0].id

        results2 = list(normalize_stream(iter([traj]), "syfi"))
        event_id_2 = results2[0].events[0].id

        assert event_id_1 == event_id_2, "Deterministic fallback must be stable"

    def test_event_timestamp_inherited(self):
        traj = _make_trajectory("traj-1", [_make_tool_call("Bash")])
        results = list(normalize_stream(iter([traj]), "syfi"))
        assert results[0].events[0].timestamp == "2024-01-01T00:00:00Z"

    def test_event_role_inherited(self):
        traj = _make_trajectory("traj-1", [_make_tool_call("Bash")])
        results = list(normalize_stream(iter([traj]), "syfi"))
        assert results[0].events[0].role == EventRole.TOOL_CALL


# ══════════════════════════════════════════════════════════
# Deterministic Normalization
# ══════════════════════════════════════════════════════════

class TestDeterminism:
    """Tests verifying normalize(input) == normalize(input)."""

    def test_same_input_same_output(self):
        tc = _make_tool_call(
            "google_drive_delete_file_revision",
            arguments={"id": "1"},
            metadata={"trace": "abc"},
        )
        a1 = _normalize_tool_call(tc, "atbench")
        a2 = _normalize_tool_call(tc, "atbench")

        assert a1.normalized_name == a2.normalized_name
        assert a1.category == a2.category
        assert a1.provider == a2.provider
        assert a1.operation == a2.operation
        assert a1.resource == a2.resource
        assert a1.is_mutating == a2.is_mutating
        assert a1.is_destructive == a2.is_destructive
        assert a1.arguments == a2.arguments
        assert a1.metadata == a2.metadata
        assert a1.original_tool_name == a2.original_tool_name

    def test_full_trajectory_determinism(self):
        traj = _make_trajectory("t-det", [
            _make_tool_call("Bash"),
            _make_tool_call("Read"),
            _make_tool_call("Edit"),
        ])
        r1 = list(normalize_stream(iter([traj]), "syfi"))
        r2 = list(normalize_stream(iter([traj]), "syfi"))

        for e1, e2 in zip(r1[0].events, r2[0].events):
            assert e1.id == e2.id
            assert e1.timestamp == e2.timestamp
            for a1, a2 in zip(e1.normalized_actions, e2.normalized_actions):
                assert a1.normalized_name == a2.normalized_name
                assert a1.category == a2.category


# ══════════════════════════════════════════════════════════
# Multiple Actions Ordering
# ══════════════════════════════════════════════════════════

class TestOrdering:
    """Tests verifying action ordering within a trajectory."""

    def test_multiple_actions_preserve_order(self):
        traj = _make_trajectory("t-order", [
            _make_tool_call("Bash"),
            _make_tool_call("Read"),
            _make_tool_call("Edit"),
        ])
        results = list(normalize_stream(iter([traj]), "syfi"))
        actions = [e.normalized_actions[0] for e in results[0].events]

        assert actions[0].original_tool_name == "Bash"
        assert actions[1].original_tool_name == "Read"
        assert actions[2].original_tool_name == "Edit"

        assert actions[0].category == ActionCategory.CODE_EXECUTION
        assert actions[1].category == ActionCategory.FILE_SYSTEM_READ
        assert actions[2].category == ActionCategory.FILE_SYSTEM_WRITE


# ══════════════════════════════════════════════════════════
# Streaming / Lazy Evaluation Tests
# ══════════════════════════════════════════════════════════

class TestStreaming:
    """Tests verifying that normalize_stream is lazy and does not eagerly consume."""

    def test_lazy_evaluation(self):
        """Consuming 1 item must not exhaust the upstream generator."""
        consumed_count = 0

        def counting_generator() -> Iterator[Trajectory]:
            nonlocal consumed_count
            for i in range(100):
                consumed_count += 1
                yield _make_trajectory(f"t-{i}", [_make_tool_call("Bash")])

        stream = normalize_stream(counting_generator(), "syfi")
        first = next(stream)

        assert isinstance(first, NormalizedTrajectory)
        assert first.trajectory_id == "t-0"
        assert consumed_count == 1, "Lazy stream must only consume 1 item"

    def test_stream_yields_correct_type(self):
        traj = _make_trajectory("t-type", [_make_tool_call("Read")])
        stream = normalize_stream(iter([traj]), "syfi")
        result = next(stream)
        assert isinstance(result, NormalizedTrajectory)
        assert isinstance(result.events[0], NormalizedEvent)
        assert isinstance(result.events[0].normalized_actions[0], NormalizedAction)

    def test_empty_stream(self):
        stream = normalize_stream(iter([]), "syfi")
        results = list(stream)
        assert results == []


# ══════════════════════════════════════════════════════════
# NormalizedTrajectory Contract Tests
# ══════════════════════════════════════════════════════════

class TestNormalizedTrajectoryContract:
    """Tests verifying the NormalizedTrajectory model shape."""

    def test_source_dataset_populated(self):
        traj = _make_trajectory("t-src", [_make_tool_call("Bash")])
        results = list(normalize_stream(iter([traj]), "syfi"))
        assert results[0].source_dataset == "syfi"

    def test_metadata_forwarded(self):
        traj = _make_trajectory(
            "t-meta",
            [_make_tool_call("Bash")],
            metadata={"provider": "claude", "model": "sonnet"},
        )
        results = list(normalize_stream(iter([traj]), "syfi"))
        assert results[0].metadata["provider"] == "claude"
        assert results[0].metadata["model"] == "sonnet"
