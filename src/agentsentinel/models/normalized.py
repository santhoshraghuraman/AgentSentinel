"""
Normalized models for Action Normalization layer.

These models represent the output of the ActionNormalizer,
providing a semantically clean, deterministic, source-aware
representation of agent actions across datasets.

Architecture:
    Trajectory -> ActionNormalizer -> NormalizedTrajectory
                                        -> NormalizedEvent
                                            -> NormalizedAction
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from enum import Enum
from datetime import datetime

from src.agentsentinel.models.trajectory import EventRole


class ActionCategory(str, Enum):
    """Broad semantic category for a normalized action."""
    FILE_SYSTEM_READ = "file_system_read"
    FILE_SYSTEM_WRITE = "file_system_write"
    CODE_EXECUTION = "code_execution"
    WEB_REQUEST = "web_request"
    API_CALL = "api_call"
    AGENT_CONTROL = "agent_control"
    UNKNOWN = "unknown"


class NormalizedAction(BaseModel):
    """
    A semantically normalized representation of a ToolCall.

    Separates concerns:
        - normalized_name / category: high-level classification
        - provider / operation / resource: granular API semantics (None if ambiguous)
        - is_mutating / is_destructive: state-effect classification (None if unknown)
        - original_tool_name / source_dataset / arguments / metadata / raw_data: provenance
    """
    # Core Semantics
    normalized_name: str
    category: ActionCategory

    # Granular Semantics (extracted via heuristic, None if ambiguous)
    provider: Optional[str] = None
    operation: Optional[str] = None
    resource: Optional[str] = None

    # State Effects (semantic classification, NOT risk scoring)
    is_mutating: Optional[bool] = None
    is_destructive: Optional[bool] = None

    # Provenance Preservation
    original_tool_name: str
    source_dataset: str
    arguments: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    raw_data: Dict[str, Any] = Field(default_factory=dict, exclude=True)


class NormalizedEvent(BaseModel):
    """
    A normalized event within a trajectory.

    The id and timestamp are inherited directly from the source Event
    to guarantee deterministic normalization. No random UUIDs are
    generated during normalization.
    """
    id: str
    timestamp: Optional[str] = None
    role: EventRole
    content: Optional[str] = None
    normalized_actions: List[NormalizedAction] = Field(default_factory=list)


class NormalizedTrajectory(BaseModel):
    """
    A trajectory containing normalized events and actions.

    Structurally mirrors Trajectory but parameterized with
    NormalizedEvent instead of raw Event, cleanly isolating
    downstream consumers from raw data shapes.
    """
    trajectory_id: str
    source_dataset: str
    events: List[NormalizedEvent] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
