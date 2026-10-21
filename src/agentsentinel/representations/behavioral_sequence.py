"""
Trajectory Representation Layer (Milestone 3).

Provides a read-only, lazy, O(1) memory view over a NormalizedTrajectory
to support behavioral feature extraction without duplicating data or
fabricating timestamps.
"""

from typing import Iterator, Tuple, Optional
from datetime import datetime, timezone
import logging

from src.agentsentinel.models.normalized import NormalizedTrajectory, NormalizedAction

logger = logging.getLogger(__name__)


class BehavioralSequence:
    """
    A lazy representation of agent behavior across a sequence of normalized events.
    Preserves exact source ordering and relies on parent event timestamps for
    temporal calculations. Does not load all actions into memory.
    """

    def __init__(self, trajectory: NormalizedTrajectory):
        self.trajectory = trajectory

    def iter_actions(self) -> Iterator[NormalizedAction]:
        """
        Lazily yields all NormalizedActions in the trajectory in their exact
        chronological/source order. Flattens actions from events without sorting.
        """
        for event in self.trajectory.events:
            for action in event.normalized_actions:
                yield action

    def iter_transitions(self) -> Iterator[Tuple[NormalizedAction, NormalizedAction]]:
        """
        Lazily yields (previous_action, current_action) pairs.
        Yields nothing for empty or single-action trajectories.
        """
        prev_action = None
        for action in self.iter_actions():
            if prev_action is not None:
                yield (prev_action, action)
            prev_action = action

    def iter_timed_transitions(self) -> Iterator[Tuple[NormalizedAction, NormalizedAction, Optional[float]]]:
        """
        Lazily yields (previous_action, current_action, delta_seconds).

        The delta_seconds is calculated using the parent event timestamps:
        - If multiple actions share the same parent event, delta is 0.0.
        - If an action transitions across events, delta is (curr_event_time - prev_event_time).
        - If either timestamp is None (or malformed), delta is None.
        """
        prev_action = None
        prev_time = None

        for event in self.trajectory.events:
            curr_time_str = event.timestamp
            curr_time = None
            if curr_time_str:
                try:
                    # python fromisoformat handles standard ISO 8601 strings.
                    # Handle trailing Z for timezone awareness robustness.
                    curr_time = datetime.fromisoformat(curr_time_str.replace("Z", "+00:00"))
                    if curr_time.tzinfo is None:
                        curr_time = curr_time.replace(tzinfo=timezone.utc)
                except ValueError:
                    logger.warning(f"Malformed timestamp in event {event.id}: {curr_time_str}")
                    curr_time = None

            for action in event.normalized_actions:
                if prev_action is not None:
                    delta = None
                    if prev_time is not None and curr_time is not None:
                        delta = (curr_time - prev_time).total_seconds()
                    yield (prev_action, action, delta)

                prev_action = action
                prev_time = curr_time
