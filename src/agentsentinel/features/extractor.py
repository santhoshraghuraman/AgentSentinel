"""
Behavioral Feature Extraction Layer (Milestone 4).

Transforms a BehavioralSequence into a measurable, deterministic TrajectoryFeatures object.
Strictly separates known states from unknown states. Does not calculate risk.
"""

from dataclasses import dataclass
from typing import Dict, Optional, Set
from src.agentsentinel.models.normalized import ActionCategory
from src.agentsentinel.representations.behavioral_sequence import BehavioralSequence


@dataclass(frozen=True)
class TrajectoryFeatures:
    """
    A flat, field-frozen representation of observable behavioral characteristics.
    """
    action_count: int
    event_count: int
    category_counts: Dict[ActionCategory, int]

    # State Effects
    mutating_known_true: int
    mutating_known_false: int
    mutating_unknown: int
    destructive_known_true: int
    destructive_known_false: int
    destructive_unknown: int

    # Diversity & Transitions
    unique_tool_count: int
    transition_count: int
    read_to_write_transitions: int
    consecutive_repeated_actions: int

    # Temporal
    valid_timed_transitions: int
    mean_inter_action_time: Optional[float]
    max_inter_action_time: Optional[float]


class TrajectoryFeatureExtractor:
    """
    Computes TrajectoryFeatures in exactly one pass over the underlying actions,
    preserving O(E + N) time and O(U) space overhead.
    """

    def extract(self, sequence: BehavioralSequence) -> TrajectoryFeatures:
        event_count = len(sequence.trajectory.events)
        
        # 1. Find the very first action (O(E) worst-case search over empty events)
        first_action = None
        for event in sequence.trajectory.events:
            if event.normalized_actions:
                first_action = event.normalized_actions[0]
                break

        if first_action is None:
            # Trajectory with 0 actions
            return TrajectoryFeatures(
                action_count=0,
                event_count=event_count,
                category_counts={},
                mutating_known_true=0,
                mutating_known_false=0,
                mutating_unknown=0,
                destructive_known_true=0,
                destructive_known_false=0,
                destructive_unknown=0,
                unique_tool_count=0,
                transition_count=0,
                read_to_write_transitions=0,
                consecutive_repeated_actions=0,
                valid_timed_transitions=0,
                mean_inter_action_time=None,
                max_inter_action_time=None
            )

        # 2. Initialize accumulators
        action_count = 1
        category_counts: Dict[ActionCategory, int] = {}
        mutating_known_true = 0
        mutating_known_false = 0
        mutating_unknown = 0
        destructive_known_true = 0
        destructive_known_false = 0
        destructive_unknown = 0
        unique_tools: Set[str] = set()

        transition_count = 0
        read_to_write_transitions = 0
        consecutive_repeated_actions = 0

        valid_timed_transitions = 0
        total_valid_time = 0.0
        max_valid_time: Optional[float] = None

        # Inline helper to process action properties (avoids code duplication)
        def process_action(action):
            nonlocal mutating_known_true, mutating_known_false, mutating_unknown
            nonlocal destructive_known_true, destructive_known_false, destructive_unknown
            
            # Category Frequency
            cat = action.category
            category_counts[cat] = category_counts.get(cat, 0) + 1
            
            # Diversity (using original_tool_name as required)
            if action.original_tool_name:
                unique_tools.add(action.original_tool_name)
                
            # State Effects
            if action.is_mutating is True:
                mutating_known_true += 1
            elif action.is_mutating is False:
                mutating_known_false += 1
            else:
                mutating_unknown += 1
                
            if action.is_destructive is True:
                destructive_known_true += 1
            elif action.is_destructive is False:
                destructive_known_false += 1
            else:
                destructive_unknown += 1

        # Process the first action we discovered
        process_action(first_action)

        # 3. Transition Traversal O(N)
        # Guarantees processing each subsequent action exactly once via `curr`.
        for prev, curr, delta in sequence.iter_timed_transitions():
            process_action(curr)
            action_count += 1
            transition_count += 1
            
            # Transition Patterns
            if prev.is_mutating is False and curr.is_mutating is True:
                read_to_write_transitions += 1
                
            if prev.original_tool_name == curr.original_tool_name and curr.original_tool_name is not None:
                consecutive_repeated_actions += 1

            # Temporal Patterns (Discard negative / non-monotonic timestamps)
            if delta is not None and delta >= 0.0:
                valid_timed_transitions += 1
                total_valid_time += delta
                if max_valid_time is None or delta > max_valid_time:
                    max_valid_time = delta

        # Averages
        mean_inter_action_time = None
        if valid_timed_transitions > 0:
            mean_inter_action_time = total_valid_time / valid_timed_transitions

        return TrajectoryFeatures(
            action_count=action_count,
            event_count=event_count,
            category_counts=category_counts,
            mutating_known_true=mutating_known_true,
            mutating_known_false=mutating_known_false,
            mutating_unknown=mutating_unknown,
            destructive_known_true=destructive_known_true,
            destructive_known_false=destructive_known_false,
            destructive_unknown=destructive_unknown,
            unique_tool_count=len(unique_tools),
            transition_count=transition_count,
            read_to_write_transitions=read_to_write_transitions,
            consecutive_repeated_actions=consecutive_repeated_actions,
            valid_timed_transitions=valid_timed_transitions,
            mean_inter_action_time=mean_inter_action_time,
            max_inter_action_time=max_valid_time
        )
