import json
import gzip
import logging
from pathlib import Path
from typing import Iterator

from src.agentsentinel.data_loaders.base import BaseDataLoader
from src.agentsentinel.models.trajectory import Trajectory, Event, EventRole, ToolCall

logger = logging.getLogger(__name__)

class SyFILoader(BaseDataLoader):
    def __init__(self, filepath: str):
        self.filepath = Path(filepath)
    
    def load(self) -> Iterator[Trajectory]:
        if not self.filepath.exists():
            raise FileNotFoundError(f"SyFI dataset not found at {self.filepath}")
            
        with gzip.open(self.filepath, 'rt', encoding='utf-8') as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    record = json.loads(line)
                except json.JSONDecodeError as e:
                    logger.warning(f"Malformed JSON: {e}")
                    continue
                
                if not isinstance(record, dict):
                    logger.warning("Skipping malformed record (not a dictionary).")
                    continue
                
                if "timing_events" not in record:
                    logger.warning(f"Record {record.get('session_id')} missing 'timing_events', skipping.")
                    continue
                    
                events = []
                for event_record in record["timing_events"]:
                    event_type = event_record.get("event_type", "")
                    content = event_record.get("content", "")
                    tool_calls = []
                    
                    if "user" in event_type:
                        role = EventRole.USER
                    elif "assistant" in event_type or event_type == "text":
                        role = EventRole.AGENT
                    elif "tool_call" in event_type or "tool" in event_type:
                        role = EventRole.TOOL_CALL
                        name = event_record.get("tool_name", "unknown")
                        meta = {k: v for k, v in event_record.items() if k not in ["event_type", "timestamp", "source", "tool_name", "content"]}
                        tool_calls.append(ToolCall(name=name, arguments={}, metadata=meta, raw_data=event_record))
                    elif "system" in event_type:
                        role = EventRole.SYSTEM
                    else:
                        role = EventRole.AGENT
                        
                    event = Event(
                        role=role, 
                        content=str(content),
                        tool_calls=tool_calls,
                        timestamp=event_record.get("timestamp")
                    )
                    events.append(event)
                
                metadata = {
                    "provider": record.get("provider"),
                    "project": record.get("project"),
                    "model": record.get("model"),
                    "input_tokens_total": record.get("input_tokens_total"),
                    "output_tokens": record.get("output_tokens"),
                    "round_index": record.get("round_index"),
                    "round_id": record.get("round_id")
                }
                
                yield Trajectory(
                    trajectory_id=str(record.get("session_id", record.get("trace_key", ""))),
                    events=events,
                    metadata=metadata,
                    raw_data=record
                )
