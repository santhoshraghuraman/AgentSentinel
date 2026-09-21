import pytest
import json
import gzip
from pathlib import Path
from src.agentsentinel.data_loaders.syfi import SyFILoader
from src.agentsentinel.models.trajectory import Trajectory, EventRole

DATASET_PATH = Path("datasets/TraceLab/syfi_coding_trace.jsonl.gz")

def test_syfi_loader():
    loader = SyFILoader(str(DATASET_PATH))
    it = loader.load()
    first_record = next(it)
    
    assert isinstance(first_record, Trajectory)
    assert first_record.trajectory_id != ""
    assert first_record.metadata.get("provider") == "claude"
    
    # Check ordering preservation
    timestamps = [e.timestamp for e in first_record.events if e.timestamp]
    assert timestamps == sorted(timestamps)
    
    # Check Raw Data preservation
    assert "provider" in first_record.raw_data
    
    # Exhaust iterator to find at least one tool call
    found_tool_call = False
    for rec in it:
        for e in rec.events:
            if e.tool_calls:
                found_tool_call = True
                assert e.role == EventRole.TOOL_CALL
                assert len(e.tool_calls[0].arguments) == 0, "arguments must be empty for SyFI trace telemetry"
                assert "tool_call_id" not in e.tool_calls[0].arguments
                assert "tool_call_id" in e.tool_calls[0].metadata, "tool_call_id should be in metadata"
                assert "tool_call_id" in e.tool_calls[0].raw_data, "raw_data must preserve original keys"
                break
        if found_tool_call:
            break
            
    assert found_tool_call, "Failed to extract any ToolCall from SyFI"

def test_malformed_jsonl(tmp_path):
    bad_file = tmp_path / "bad.jsonl.gz"
    with gzip.open(bad_file, 'wt', encoding='utf-8') as f:
        f.write("{ broken json\n")
        f.write(json.dumps({"session_id": "ok", "timing_events": []}) + "\n")
        f.write('"not a dict"\n')
        f.write(json.dumps({"session_id": "missing_events"}) + "\n")
    
    loader = SyFILoader(str(bad_file))
    results = list(loader.load())
    assert len(results) == 1
    assert results[0].trajectory_id == "ok"
