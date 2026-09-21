import json
import logging
from pathlib import Path
from typing import Iterator

from src.agentsentinel.data_loaders.base import BaseDataLoader
from src.agentsentinel.models.trajectory import Trajectory, Event, EventRole, ToolCall

logger = logging.getLogger(__name__)

class ATBenchLoader(BaseDataLoader):
    def __init__(self, filepath: str):
        self.filepath = Path(filepath)
    
    def load(self) -> Iterator[Trajectory]:
        if not self.filepath.exists():
            raise FileNotFoundError(f"ATBench dataset not found at {self.filepath}")
            
        with open(self.filepath, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to decode ATBench JSON: {e}")
                return
            
        for record in data:
            if not isinstance(record, dict):
                logger.warning("Skipping malformed record (not a dictionary).")
                continue
                
            if "contents" not in record:
                logger.warning(f"Record {record.get('id')} missing 'contents', skipping.")
                continue
                
            events = []
            for turn_group in record["contents"]:
                for turn in turn_group:
                    role_str = turn.get("role", "")
                    content = turn.get("content", turn.get("thought", ""))
                    
                    tool_calls = []
                    
                    if role_str == "user":
                        role = EventRole.USER
                    elif role_str == "agent":
                        role = EventRole.AGENT
                        action_str = turn.get("action")
                        if action_str:
                            try:
                                action_dict = json.loads(action_str)
                                name = action_dict.get("name", "unknown")
                                arguments = action_dict.get("arguments", {})
                                if isinstance(arguments, str):
                                    try:
                                        arguments = json.loads(arguments)
                                    except Exception:
                                        arguments = {"raw_arguments": arguments}
                                if not isinstance(arguments, dict):
                                    arguments = {"raw_arguments": str(arguments)}
                                tool_calls.append(ToolCall(name=name, arguments=arguments))
                            except json.JSONDecodeError:
                                logger.warning(f"Malformed action JSON in record {record.get('id')}")
                    elif role_str == "system":
                        role = EventRole.SYSTEM
                    elif role_str == "environment":
                        role = EventRole.TOOL_RESULT
                    else:
                        role = EventRole.AGENT
                    
                    event = Event(role=role, content=str(content), tool_calls=tool_calls)
                    events.append(event)
            
            metadata = {
                "label": record.get("label"),
                "risk_source": record.get("risk_source"),
                "failure_mode": record.get("failure_mode"),
                "reason": record.get("reason"),
                "real_world_harm": record.get("real_world_harm"),
                "tool_used": record.get("tool_used")
            }
            
            yield Trajectory(
                trajectory_id=str(record.get("id", "")),
                events=events,
                metadata=metadata,
                raw_data=record
            )
