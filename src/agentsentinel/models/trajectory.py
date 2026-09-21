from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from enum import Enum

class EventRole(str, Enum):
    USER = "user"
    AGENT = "agent"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    SYSTEM = "system"

class ToolCall(BaseModel):
    name: str
    arguments: Dict[str, Any]
    metadata: Dict[str, Any] = Field(default_factory=dict)
    raw_data: Dict[str, Any] = Field(default_factory=dict, exclude=True)
    result: Optional[str] = None

class Event(BaseModel):
    role: EventRole
    content: str
    tool_calls: List[ToolCall] = Field(default_factory=list)
    timestamp: Optional[str] = None

class Trajectory(BaseModel):
    trajectory_id: str
    events: List[Event]
    metadata: Dict[str, Any] = Field(default_factory=dict)
    raw_data: Dict[str, Any] = Field(default_factory=dict, exclude=True)
