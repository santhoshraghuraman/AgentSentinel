import pytest
from src.agentsentinel.models.trajectory import Trajectory, Event, EventRole, ToolCall

def test_tool_call_model():
    tc = ToolCall(
        name="search", 
        arguments={"query": "test"}, 
        metadata={"tool_call_id": "123"},
        raw_data={"source": "abc"}
    )
    assert tc.name == "search"
    assert tc.arguments == {"query": "test"}
    assert tc.metadata == {"tool_call_id": "123"}
    assert tc.result is None
    
    dump = tc.model_dump()
    assert "metadata" in dump
    assert "raw_data" not in dump

def test_event_model():
    e = Event(role=EventRole.USER, content="Hello")
    assert e.role == EventRole.USER
    assert e.content == "Hello"
    assert len(e.tool_calls) == 0

def test_trajectory_model():
    tc = ToolCall(name="search", arguments={"query": "test"})
    e1 = Event(role=EventRole.USER, content="Can you search for test?")
    e2 = Event(role=EventRole.AGENT, content="", tool_calls=[tc])
    
    traj = Trajectory(
        trajectory_id="t123",
        events=[e1, e2],
        metadata={"label": 1},
        raw_data={"original_key": "value"}
    )
    
    assert traj.trajectory_id == "t123"
    assert len(traj.events) == 2
    assert traj.metadata["label"] == 1
    
    # Test exclusion of raw_data from dump
    dump = traj.model_dump()
    assert "raw_data" not in dump
    assert "metadata" in dump
