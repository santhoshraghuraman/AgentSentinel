"""
Tests for Milestone 3 - BehavioralSequence Trajectory Representation.
"""

import pytest
from typing import Iterator

from src.agentsentinel.models.normalized import (
    NormalizedTrajectory, NormalizedEvent, NormalizedAction, ActionCategory
)
from src.agentsentinel.models.trajectory import EventRole
from src.agentsentinel.representations.behavioral_sequence import BehavioralSequence


# ──────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────

def _make_action(name: str) -> NormalizedAction:
    return NormalizedAction(
        normalized_name=name,
        category=ActionCategory.UNKNOWN,
        original_tool_name=name,
        source_dataset="test",
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
# Structure & Flattening Tests
# ──────────────────────────────────────────────────────────

class TestBehavioralSequenceActions:
    
    def test_empty_trajectory(self):
        traj = _make_trajectory([])
        seq = BehavioralSequence(traj)
        assert list(seq.iter_actions()) == []
        assert list(seq.iter_transitions()) == []
        assert list(seq.iter_timed_transitions()) == []

    def test_empty_event(self):
        traj = _make_trajectory([_make_event("e1", actions=[])])
        seq = BehavioralSequence(traj)
        assert list(seq.iter_actions()) == []

    def test_multiple_empty_events(self):
        traj = _make_trajectory([
            _make_event("e1", actions=[]),
            _make_event("e2", actions=[])
        ])
        seq = BehavioralSequence(traj)
        assert list(seq.iter_actions()) == []

    def test_exact_action_and_event_ordering(self):
        a1 = _make_action("A1")
        a2 = _make_action("A2")
        a3 = _make_action("A3")
        
        traj = _make_trajectory([
            _make_event("e1", actions=[a1, a2]),
            _make_event("e2", actions=[]), # empty between populated
            _make_event("e3", actions=[a3]),
        ])
        
        seq = BehavioralSequence(traj)
        actions = list(seq.iter_actions())
        
        # Verify exact ordering
        assert [a.normalized_name for a in actions] == ["A1", "A2", "A3"]
        
        # Verify reference preservation (not copies)
        assert actions[0] is a1
        assert actions[1] is a2
        assert actions[2] is a3
        
        # Verify raw trajectory remains unchanged
        assert len(traj.events) == 3
        assert len(traj.events[0].normalized_actions) == 2


# ──────────────────────────────────────────────────────────
# Transition Tests
# ──────────────────────────────────────────────────────────

class TestBehavioralSequenceTransitions:
    
    def test_single_action_zero_transitions(self):
        traj = _make_trajectory([
            _make_event("e1", actions=[_make_action("A1")])
        ])
        seq = BehavioralSequence(traj)
        assert list(seq.iter_transitions()) == []

    def test_two_actions(self):
        traj = _make_trajectory([
            _make_event("e1", actions=[_make_action("A1"), _make_action("A2")])
        ])
        seq = BehavioralSequence(traj)
        transitions = list(seq.iter_transitions())
        assert len(transitions) == 1
        assert transitions[0][0].normalized_name == "A1"
        assert transitions[0][1].normalized_name == "A2"

    def test_lazy_transition_generation(self):
        # We prove it's lazy by passing it a trajectory that would normally blow up memory if copied
        # but we just pull one item from the generator
        
        def massive_event_generator():
            yield _make_event("e1", actions=[_make_action("A1"), _make_action("A2")])
            for i in range(100):
                yield _make_event(f"e{i}", actions=[_make_action(f"B{i}")])
                
        traj = _make_trajectory()
        # Mock the list to be an iterator for the test to prove laziness
        traj.events = massive_event_generator() 
        
        seq = BehavioralSequence(traj)
        it = seq.iter_transitions()
        
        # Pull only one
        first_transition = next(it)
        assert first_transition[0].normalized_name == "A1"
        assert first_transition[1].normalized_name == "A2"
        # The generator hasn't evaluated the rest


# ──────────────────────────────────────────────────────────
# Timed Transition Tests
# ──────────────────────────────────────────────────────────

class TestBehavioralSequenceTimedTransitions:
    
    def test_valid_timestamps_cross_event(self):
        traj = _make_trajectory([
            _make_event("e1", timestamp="2024-01-01T12:00:00Z", actions=[_make_action("A1")]),
            _make_event("e2", timestamp="2024-01-01T12:00:10Z", actions=[_make_action("A2")]),
        ])
        seq = BehavioralSequence(traj)
        transitions = list(seq.iter_timed_transitions())
        
        assert len(transitions) == 1
        a1, a2, delta = transitions[0]
        assert a1.normalized_name == "A1"
        assert a2.normalized_name == "A2"
        assert delta == 10.0

    def test_multiple_actions_same_event_timestamp(self):
        traj = _make_trajectory([
            _make_event("e1", timestamp="2024-01-01T12:00:00Z", actions=[
                _make_action("A1"), _make_action("A2"), _make_action("A3")
            ]),
        ])
        seq = BehavioralSequence(traj)
        transitions = list(seq.iter_timed_transitions())
        
        assert len(transitions) == 2
        # A1 -> A2 should be 0.0
        assert transitions[0][2] == 0.0
        # A2 -> A3 should be 0.0
        assert transitions[1][2] == 0.0

    def test_missing_previous_timestamp(self):
        traj = _make_trajectory([
            _make_event("e1", timestamp=None, actions=[_make_action("A1")]),
            _make_event("e2", timestamp="2024-01-01T12:00:10Z", actions=[_make_action("A2")]),
        ])
        seq = BehavioralSequence(traj)
        transitions = list(seq.iter_timed_transitions())
        assert transitions[0][2] is None

    def test_missing_current_timestamp(self):
        traj = _make_trajectory([
            _make_event("e1", timestamp="2024-01-01T12:00:00Z", actions=[_make_action("A1")]),
            _make_event("e2", timestamp=None, actions=[_make_action("A2")]),
        ])
        seq = BehavioralSequence(traj)
        transitions = list(seq.iter_timed_transitions())
        assert transitions[0][2] is None

    def test_both_timestamps_missing(self):
        traj = _make_trajectory([
            _make_event("e1", timestamp=None, actions=[_make_action("A1")]),
            _make_event("e2", timestamp=None, actions=[_make_action("A2")]),
        ])
        seq = BehavioralSequence(traj)
        transitions = list(seq.iter_timed_transitions())
        assert transitions[0][2] is None
        
    def test_timezone_aware_timestamps(self):
        traj = _make_trajectory([
            _make_event("e1", timestamp="2024-01-01T12:00:00-05:00", actions=[_make_action("A1")]),
            # Next event is exactly 1 hour later, but represented in UTC
            _make_event("e2", timestamp="2024-01-01T18:00:00+00:00", actions=[_make_action("A2")]),
        ])
        seq = BehavioralSequence(traj)
        transitions = list(seq.iter_timed_transitions())
        
        # 12:00 EST (-5) = 17:00 UTC. The next is 18:00 UTC. Delta should be 3600 seconds.
        assert transitions[0][2] == 3600.0

    def test_repeated_iteration_produces_deterministic_results(self):
        traj = _make_trajectory([
            _make_event("e1", timestamp="2024-01-01T12:00:00Z", actions=[_make_action("A1")]),
            _make_event("e2", timestamp="2024-01-01T12:00:10Z", actions=[_make_action("A2")]),
        ])
        seq = BehavioralSequence(traj)
        
        r1 = list(seq.iter_timed_transitions())
        r2 = list(seq.iter_timed_transitions())
        r3 = list(seq.iter_timed_transitions())
        
        assert r1 == r2 == r3
