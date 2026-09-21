"""
Tests for Milestone 4 - Behavioral Feature Extraction.
"""

import pytest
from dataclasses import FrozenInstanceError

from src.agentsentinel.models.normalized import (
    NormalizedTrajectory, NormalizedEvent, NormalizedAction, ActionCategory
)
from src.agentsentinel.models.trajectory import EventRole
from src.agentsentinel.representations.behavioral_sequence import BehavioralSequence
from src.agentsentinel.features.extractor import TrajectoryFeatureExtractor, TrajectoryFeatures


# ──────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────

def _make_action(name: str, 
                 orig: str = None, 
                 mutating: bool = None, 
                 destructive: bool = None,
                 cat: ActionCategory = ActionCategory.UNKNOWN) -> NormalizedAction:
    return NormalizedAction(
        normalized_name=name,
        category=cat,
        original_tool_name=orig or name,
        source_dataset="test",
        is_mutating=mutating,
        is_destructive=destructive,
        arguments={},
        metadata={}
    )

def _make_event(id: str, timestamp: str = None, actions=None) -> NormalizedEvent:
    return NormalizedEvent(
        id=id,
        timestamp=timestamp,
        role=EventRole.TOOL_CALL,
        content="",
        normalized_actions=actions or []
    )

def _make_trajectory(events=None) -> NormalizedTrajectory:
    return NormalizedTrajectory(
        trajectory_id="t1",
        source_dataset="test",
        events=events or [],
    )


# ──────────────────────────────────────────────────────────
# Feature Tests
# ──────────────────────────────────────────────────────────

class TestFeatureExtraction:

    def test_empty_trajectory(self):
        traj = _make_trajectory([])
        seq = BehavioralSequence(traj)
        extractor = TrajectoryFeatureExtractor()
        
        feats = extractor.extract(seq)
        assert feats.action_count == 0
        assert feats.event_count == 0
        assert feats.transition_count == 0
        assert feats.valid_timed_transitions == 0
        assert feats.mean_inter_action_time is None
        assert feats.category_counts == {}

    def test_single_action_trajectory(self):
        traj = _make_trajectory([
            _make_event("e1", timestamp="2024-01-01T12:00:00Z", actions=[
                _make_action("A1", mutating=True)
            ])
        ])
        seq = BehavioralSequence(traj)
        extractor = TrajectoryFeatureExtractor()
        
        feats = extractor.extract(seq)
        assert feats.action_count == 1
        assert feats.event_count == 1
        assert feats.transition_count == 0
        assert feats.mutating_known_true == 1
        assert feats.unique_tool_count == 1
        assert feats.mean_inter_action_time is None

    def test_unique_tool_cardinality_by_original_name(self):
        # Two actions have the same normalized name, but different original tools
        traj = _make_trajectory([
            _make_event("e1", actions=[
                _make_action("search", orig="grep"),
                _make_action("search", orig="find"),
                _make_action("search", orig="grep") # repeated
            ])
        ])
        seq = BehavioralSequence(traj)
        extractor = TrajectoryFeatureExtractor()
        
        feats = extractor.extract(seq)
        # 'grep' and 'find' -> 2 unique tools
        assert feats.unique_tool_count == 2
        # 'grep' to 'grep' did not happen consecutively (grep -> find -> grep), so consecutive repeat is 0
        assert feats.consecutive_repeated_actions == 0

    def test_consecutive_repeated_actions(self):
        traj = _make_trajectory([
            _make_event("e1", actions=[
                _make_action("A", orig="ls"),
                _make_action("B", orig="ls"), # B has orig 'ls' -> repeat
                _make_action("C", orig="cat") # C has orig 'cat' -> not a repeat
            ])
        ])
        seq = BehavioralSequence(traj)
        extractor = TrajectoryFeatureExtractor()
        
        feats = extractor.extract(seq)
        assert feats.consecutive_repeated_actions == 1

    def test_state_effect_distinction(self):
        # Known True, Known False, Unknown
        traj = _make_trajectory([
            _make_event("e1", actions=[
                _make_action("A", mutating=True, destructive=True),
                _make_action("B", mutating=False, destructive=False),
                _make_action("C", mutating=None, destructive=None),
            ])
        ])
        seq = BehavioralSequence(traj)
        extractor = TrajectoryFeatureExtractor()
        
        feats = extractor.extract(seq)
        assert feats.mutating_known_true == 1
        assert feats.mutating_known_false == 1
        assert feats.mutating_unknown == 1
        
        assert feats.destructive_known_true == 1
        assert feats.destructive_known_false == 1
        assert feats.destructive_unknown == 1

    def test_read_to_write_transitions(self):
        traj = _make_trajectory([
            _make_event("e1", actions=[
                _make_action("R1", mutating=False),
                _make_action("W1", mutating=True),  # R -> W (Count 1)
                _make_action("U1", mutating=None),  # W -> U
                _make_action("W2", mutating=True),  # U -> W
                _make_action("R2", mutating=False), # W -> R
                _make_action("W3", mutating=True),  # R -> W (Count 2)
            ])
        ])
        seq = BehavioralSequence(traj)
        extractor = TrajectoryFeatureExtractor()
        
        feats = extractor.extract(seq)
        assert feats.read_to_write_transitions == 2

    def test_non_monotonic_temporal_suppression(self):
        traj = _make_trajectory([
            _make_event("e1", timestamp="2024-01-01T12:00:10Z", actions=[_make_action("A1")]), # 12:00:10
            _make_event("e2", timestamp="2024-01-01T12:00:00Z", actions=[_make_action("A2")]), # 12:00:00 (Negative 10s delta)
            _make_event("e3", timestamp="2024-01-01T12:00:20Z", actions=[_make_action("A3")]), # Positive 20s delta from e2
        ])
        seq = BehavioralSequence(traj)
        extractor = TrajectoryFeatureExtractor()
        
        feats = extractor.extract(seq)
        
        assert feats.transition_count == 2
        # The transition A1 -> A2 should be ignored due to negative delta (-10s)
        # The transition A2 -> A3 should be counted (20s)
        assert feats.valid_timed_transitions == 1
        assert feats.mean_inter_action_time == 20.0
        assert feats.max_inter_action_time == 20.0

    def test_exact_manual_math(self):
        traj = _make_trajectory([
            _make_event("e1", timestamp="2024-01-01T00:00:00Z", actions=[_make_action("A1", cat=ActionCategory.FILE_SYSTEM_READ)]),
            _make_event("e2", timestamp="2024-01-01T00:00:05Z", actions=[_make_action("A2", cat=ActionCategory.FILE_SYSTEM_WRITE)]), # 5s
            _make_event("e3", timestamp="2024-01-01T00:00:15Z", actions=[_make_action("A3", cat=ActionCategory.CODE_EXECUTION)]),   # 10s
        ])
        seq = BehavioralSequence(traj)
        extractor = TrajectoryFeatureExtractor()
        
        feats = extractor.extract(seq)
        
        assert feats.action_count == 3
        assert feats.event_count == 3
        assert feats.transition_count == 2
        assert feats.valid_timed_transitions == 2
        assert feats.mean_inter_action_time == 7.5 # (5 + 10) / 2
        assert feats.max_inter_action_time == 10.0
        assert feats.category_counts[ActionCategory.FILE_SYSTEM_READ] == 1
        assert feats.category_counts[ActionCategory.FILE_SYSTEM_WRITE] == 1
        assert feats.category_counts[ActionCategory.CODE_EXECUTION] == 1

    def test_field_frozen_immutability(self):
        traj = _make_trajectory([
            _make_event("e1", actions=[_make_action("A1")])
        ])
        seq = BehavioralSequence(traj)
        extractor = TrajectoryFeatureExtractor()
        
        feats = extractor.extract(seq)
        
        with pytest.raises(FrozenInstanceError):
            feats.action_count = 99

    def test_explicit_missing_timestamps(self):
        traj = _make_trajectory([
            _make_event("e1", timestamp=None, actions=[_make_action("A1")]),
            _make_event("e2", timestamp=None, actions=[_make_action("A2")]),
            _make_event("e3", timestamp=None, actions=[_make_action("A3")])
        ])
        seq = BehavioralSequence(traj)
        extractor = TrajectoryFeatureExtractor()
        
        feats = extractor.extract(seq)
        
        assert feats.valid_timed_transitions == 0
        assert feats.mean_inter_action_time is None
        assert feats.max_inter_action_time is None

    def test_deterministic_repeated_extraction(self):
        traj = _make_trajectory([
            _make_event("e1", timestamp="2024-01-01T12:00:00Z", actions=[
                _make_action("A1", mutating=True)
            ]),
            _make_event("e2", timestamp="2024-01-01T12:00:10Z", actions=[
                _make_action("A2", mutating=False)
            ])
        ])
        seq = BehavioralSequence(traj)
        extractor = TrajectoryFeatureExtractor()
        
        result_1 = extractor.extract(seq)
        result_2 = extractor.extract(seq)
        
        assert result_1 == result_2
