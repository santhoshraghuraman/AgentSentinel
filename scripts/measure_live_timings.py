"""
measure_live_timings.py

Measures genuine, un-fabricated runtime performance across both:
1. Lightweight Interception Pipeline (M2 -> M5 -> M6 -> M7 -> M8 -> SQLite)
2. Full Autonomous Agent Lifecycle with Ollama Qwen3:4b (Prompt -> LLM -> Tool Call -> Governance -> Execution -> Concluding Response -> SQLite)
"""

import time
import json
import urllib.request
import sqlite3

def measure_lightweight_interception():
    print("=" * 60)
    print("SCENARIO 1: LIGHTWEIGHT DIRECT INTERCEPTION PERFORMANCE")
    print("=" * 60)
    
    url = "http://127.0.0.1:8000/api/v1/runtime/intercept"
    payload = {
        "session_id": f"perf-interp-{int(time.time())}",
        "task_id": "task_1",
        "tool_name": "read_file",
        "arguments": {"path": "public_docs.txt"}
    }
    data = json.dumps(payload).encode('utf-8')
    headers = {"Content-Type": "application/json"}
    
    # Run 5 iterations to capture mean and variance
    timings = []
    for i in range(5):
        t_start = time.perf_counter()
        req = urllib.request.Request(url, data=data, headers=headers)
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read().decode('utf-8'))
        t_end = time.perf_counter()
        elapsed_ms = (t_end - t_start) * 1000.0
        timings.append(elapsed_ms)
        print(f"  Iteration {i+1}: {elapsed_ms:.2f} ms (Decision: {body.get('decision')}, ID: {body.get('interception_id')[:8]})")
    
    steady_state = timings[1:]  # Exclude cold start if any
    mean_steady_ms = sum(steady_state) / len(steady_state)
    min_ms = min(timings)
    max_ms = max(timings)
    print(f"\n  Steady-state Mean (iters 2-5): {mean_steady_ms:.2f} ms, Min = {min_ms:.2f} ms, Max = {max_ms:.2f} ms")
    return {
        "scenario": "Direct M8 Interception (Lightweight)",
        "steady_state_mean_ms": round(mean_steady_ms, 2),
        "overall_mean_ms": round(sum(timings)/len(timings), 2),
        "min_ms": round(min_ms, 2),
        "max_ms": round(max_ms, 2),
        "sample_size": 5,
        "iterations_ms": [round(t, 2) for t in timings]
    }

def measure_agent_task_lifecycle():
    print("\n" + "=" * 60)
    print("SCENARIO 2: FULL AUTONOMOUS AGENT TASK WITH OLLAMA QWEN3:4B")
    print("=" * 60)
    
    url = "http://127.0.0.1:8000/api/v1/agent/run"
    session_id = f"perf-agent-{int(time.time())}"
    payload = {
        "session_id": session_id,
        "task_id": "task_1",
        "prompt": "Please read the contents of 'public_docs.txt' to learn about the system."
    }
    data = json.dumps(payload).encode('utf-8')
    headers = {"Content-Type": "application/json"}
    
    print("  Dispatching task to live Ollama Qwen3:4b...")
    t0_dispatch = time.perf_counter()
    
    req = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
    t_complete = time.perf_counter()
    total_latency_s = t_complete - t0_dispatch
    
    print(f"  Total Task Roundtrip: {total_latency_s:.2f} s")
    print(f"  Status: {res.get('status')}")
    print(f"  Trace steps count: {len(res.get('trace', []))}")
    for idx, step in enumerate(res.get('trace', [])):
        step_type = step.get('type')
        if step_type == 'tool_call':
            print(f"    Step {idx+1}: [Tool Call] {step.get('tool')}({step.get('arguments')})")
        elif step_type == 'execution_result':
            print(f"    Step {idx+1}: [Execution Result] State: {step.get('state')}")
        elif step_type == 'agent_response':
            content = step.get('content', '')
            print(f"    Step {idx+1}: [Agent Response] Length: {len(content)} chars")
            print(f"      Snippet: {content[:100]}...")

    # Check persistence in SQLite
    conn = sqlite3.connect('agentsentinel.db')
    cur = conn.cursor()
    audit_rows = cur.execute('SELECT interception_id, decision, execution_state, timestamp FROM audit_events WHERE session_id = ?', (session_id,)).fetchall()
    print(f"\n  Persisted SQLite Audit Records for {session_id}:")
    for row in audit_rows:
        print(f"    Interception {row[0]}: Decision={row[1]}, State={row[2]}, Timestamp={row[3]}")
    conn.close()

    return {
        "scenario": "Live Agent Task (Qwen3:4b)",
        "total_latency_s": round(total_latency_s, 2),
        "status": res.get('status'),
        "trace_steps": len(res.get('trace', [])),
        "audit_events_count": len(audit_rows)
    }

if __name__ == "__main__":
    results = {}
    results["lightweight"] = measure_lightweight_interception()
    results["agent_task"] = measure_agent_task_lifecycle()
    with open("reports/real_runtime_measurements.json", "w") as f:
        json.dump(results, f, indent=2)
    print("\nSaved genuine measurements to reports/real_runtime_measurements.json")
