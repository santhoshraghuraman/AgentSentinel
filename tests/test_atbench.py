import pytest
import json
from pathlib import Path
from src.agentsentinel.data_loaders.atbench import ATBenchLoader
from src.agentsentinel.models.trajectory import Trajectory, EventRole

DATASET_PATH = Path("datasets/TraceLab/ATBench/test.json")

def test_atbench_loader():
    loader = ATBenchLoader(str(DATASET_PATH))
    it = loader.load()
    first_record = next(it)
    
    assert isinstance(first_record, Trajectory)
    assert first_record.trajectory_id == "1"
    assert first_record.metadata.get("label") == 1
    assert "real_world_harm" in first_record.metadata
    
    # Check if any event has a tool call
    tool_calls = [tc for e in first_record.events for tc in e.tool_calls]
    assert len(tool_calls) > 0, "Should have extracted at least one ToolCall"
    assert tool_calls[0].name == "extract_news_article_text"
    assert "url" in tool_calls[0].arguments

def test_malformed_json(tmp_path):
    # Mock a malformed JSON file
    bad_file = tmp_path / "bad.json"
    bad_file.write_text("{ broken json", encoding='utf-8')
    
    loader = ATBenchLoader(str(bad_file))
    # Should not crash, just yield nothing
    assert list(loader.load()) == []

def test_missing_fields_and_malformed_records(tmp_path):
    mock_data = [
        "not a dict",
        {"id": "2"}, # missing contents
        {"id": "3", "contents": [[{"role": "agent", "action": "not a json string"}]]}
    ]
    bad_file = tmp_path / "mock.json"
    bad_file.write_text(json.dumps(mock_data), encoding='utf-8')
    
    loader = ATBenchLoader(str(bad_file))
    results = list(loader.load())
    
    # The first two are skipped. The third is loaded but action parsing fails, so tool_calls is empty
    assert len(results) == 1
    assert results[0].trajectory_id == "3"
    assert len(results[0].events) == 1
    assert len(results[0].events[0].tool_calls) == 0
