import os
import subprocess

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
OUTPUT_DIR = os.path.abspath("reports/dissertation_figures")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def render_html_to_png(html_content, output_png_path, width=1200, height=750):
    temp_html = os.path.abspath("temp_render.html")
    with open(temp_html, "w", encoding="utf-8") as f:
        f.write(html_content)
    
    cmd = [
        EDGE_PATH,
        "--headless",
        "--disable-gpu",
        f"--screenshot={output_png_path}",
        f"--window-size={width},{height}",
        f"file:///{temp_html}"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(temp_html):
        os.remove(temp_html)
    if os.path.exists(output_png_path):
        print(f"Generated: {os.path.basename(output_png_path)} ({os.path.getsize(output_png_path):,} bytes)")
    else:
        print(f"Failed to generate: {output_png_path}. Error: {res.stderr}")

# 1. Overall System Architecture (Fig 4.1)
fig_4_1_html = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0; padding: 24px; background: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b;
  }
  .header { text-align: center; margin-bottom: 20px; }
  .header h2 { margin: 0; font-size: 22px; color: #0f172a; }
  .header p { margin: 4px 0 0 0; font-size: 13px; color: #64748b; }
  .container { display: flex; flex-direction: column; gap: 16px; max-width: 1150px; margin: 0 auto; }
  
  .tier {
    border: 2px solid #cbd5e1; border-radius: 8px; padding: 14px; position: relative; background: #f8fafc;
  }
  .tier-label {
    position: absolute; top: -12px; left: 20px; background: #ffffff; padding: 2px 10px;
    font-size: 12px; font-weight: bold; color: #3b82f6; border: 1px solid #cbd5e1; border-radius: 4px;
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 14px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  
  .box {
    background: #ffffff; border: 1px solid #94a3b8; border-radius: 6px; padding: 10px 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .box-title { font-weight: bold; font-size: 13px; color: #0f172a; margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between; }
  .box-badge { font-size: 10px; background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 3px; font-weight: 600; }
  .box-desc { font-size: 11px; color: #475569; line-height: 1.35; }
  
  .flow-arrow { text-align: center; font-size: 18px; color: #3b82f6; font-weight: bold; margin: -4px 0; }
  
  .decision-row { display: flex; justify-content: center; gap: 20px; margin-top: 6px; }
  .badge-allow { background: #dcfce7; color: #166534; border: 1px solid #86efac; padding: 6px 14px; border-radius: 6px; font-weight: bold; font-size: 12px; }
  .badge-alert { background: #fef9c3; color: #854d0e; border: 1px solid #fde047; padding: 6px 14px; border-radius: 6px; font-weight: bold; font-size: 12px; }
  .badge-block { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; padding: 6px 14px; border-radius: 6px; font-weight: bold; font-size: 12px; }
</style>
</head>
<body>
  <div class="header">
    <h2>Figure 4.1: AgentSentinel End-to-End Governance Architecture</h2>
    <p>Runtime behavioral reference monitor bridging autonomous AI agent proposals and host execution</p>
  </div>
  
  <div class="container">
    <!-- Tier 1: Agent & Proposal -->
    <div class="tier">
      <div class="tier-label">1. Autonomous Agent & Action Proposal Layer</div>
      <div class="grid-3">
        <div class="box">
          <div class="box-title">User Goal / Task Specification <span class="box-badge">Input</span></div>
          <div class="box-desc">Natural language instructions, declared task context, and allowed capability scope.</div>
        </div>
        <div class="box">
          <div class="box-title">M12: Integration SDK & LLM Agent <span class="box-badge">Actor</span></div>
          <div class="box-desc">Ollama local engine running <b>Qwen3:4b</b>. Proposes tool calls as structured JSON payloads.</div>
        </div>
        <div class="box">
          <div class="box-title">Protected Host Callables <span class="box-badge">Target</span></div>
          <div class="box-desc">File system read/write, shell code execution, HTTP web requests, and external APIs.</div>
        </div>
      </div>
    </div>

    <div class="flow-arrow">▼ Intercepted Prior to Invocation (Pre-Execution Boundary) ▼</div>

    <!-- Tier 2: Governance Pipeline -->
    <div class="tier" style="background: #f1f5f9; border-color: #3b82f6;">
      <div class="tier-label" style="color: #1d4ed8; border-color: #3b82f6;">2. AgentSentinel Core Governance Pipeline (M1 – M7)</div>
      
      <div class="grid-4" style="margin-bottom: 12px;">
        <div class="box">
          <div class="box-title">M1: Data Foundation <span class="box-badge">M1</span></div>
          <div class="box-desc">Trajectory schema, telemetry models, and ground truth validation contracts.</div>
        </div>
        <div class="box">
          <div class="box-title">M2: Action Normalizer <span class="box-badge">M2</span></div>
          <div class="box-desc">Normalizes heterogeneous tool calls into canonical categories and mutation flags.</div>
        </div>
        <div class="box">
          <div class="box-title">M3: Behavioral Sequence <span class="box-badge">M3</span></div>
          <div class="box-desc">Session sliding window, transition graphs, and temporal inter-action deltas.</div>
        </div>
        <div class="box">
          <div class="box-title">M4: Feature Extractor <span class="box-badge">M4</span></div>
          <div class="box-desc">Extracts exactly <b>22 continuous behavioral features</b> from trajectory window.</div>
        </div>
      </div>

      <div class="grid-2" style="margin-bottom: 12px;">
        <div class="box" style="border-left: 4px solid #f59e0b;">
          <div class="box-title">M5: Behavioral Risk Engine <span class="box-badge">ML + Rules</span></div>
          <div class="box-desc">Trained <b>RandomForestClassifier</b> (100 estimators) + heuristic guardrails. Computes continuous risk probability [0.0, 1.0].</div>
        </div>
        <div class="box" style="border-left: 4px solid #10b981;">
          <div class="box-title">M6: Task Authorization Engine <span class="box-badge">Deterministic</span></div>
          <div class="box-desc">Validates action against task capability contract. Evaluates scope matching and returns <code>PASS</code> or <code>DENY</code>.</div>
        </div>
      </div>

      <div class="box" style="border: 2px solid #3b82f6; background: #ffffff;">
        <div class="box-title" style="color: #1d4ed8; font-size: 14px;">M7: Policy Fusion & Governance Decision Engine <span class="box-badge" style="background:#dbeafe; color:#1e40af;">Authority</span></div>
        <div class="box-desc" style="font-size: 12px; margin-bottom: 6px;">
          Enforces <b>5 Mandatory Security Invariants</b> and 18-case baseline matrix. Strict cross-tier precedence: <code>BLOCK &gt; ALERT &gt; ALLOW</code>.
        </div>
        <div class="decision-row">
          <span class="badge-allow">ALLOW: Risk &lt; 0.50 &amp; Auth = PASS</span>
          <span class="badge-alert">ALERT: 0.50 &le; Risk &lt; 0.85 &amp; Auth = PASS</span>
          <span class="badge-block">BLOCK: Risk &ge; 0.85 OR Auth = DENY (Zero Execution)</span>
        </div>
      </div>
    </div>

    <div class="flow-arrow">▼ Authoritative Governance Verdict ▼</div>

    <!-- Tier 3: Enforcement & Observability -->
    <div class="tier">
      <div class="tier-label">3. Enforcement Gate, Persistence & Observability</div>
      <div class="grid-3">
        <div class="box" style="border-left: 4px solid #ef4444;">
          <div class="box-title">M8: Runtime Interceptor <span class="box-badge">Gate</span></div>
          <div class="box-desc">Pre-execution lock. If BLOCK: returns error to LLM; <b>host callable execution is strictly ZERO</b>.</div>
        </div>
        <div class="box" style="border-left: 4px solid #8b5cf6;">
          <div class="box-title">M9 &amp; M10: Persistence Ledger <span class="box-badge">SQLite</span></div>
          <div class="box-desc">Non-repudiable audit events linked by UUIDv4 <code>interception_id</code>, capturing intent, decision, and execution state.</div>
        </div>
        <div class="box" style="border-left: 4px solid #06b6d4;">
          <div class="box-title">M11: React UI Observability <span class="box-badge">14 Screens</span></div>
          <div class="box-desc">Live Monitor (3s polling), Decision Explorer, Playground, Audit Trail, Evaluation Visualizer.</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
"""

# 2. Runtime Interception Sequence Diagram (Fig 4.2)
fig_4_2_html = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; padding: 24px; background: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; }
  .header { text-align: center; margin-bottom: 20px; }
  .header h2 { margin: 0; font-size: 22px; color: #0f172a; }
  .header p { margin: 4px 0 0 0; font-size: 13px; color: #64748b; }
  .seq-table { width: 100%; max-width: 1100px; margin: 0 auto; border-collapse: collapse; }
  .seq-actor { background: #1e293b; color: #f8fafc; font-weight: bold; font-size: 13px; text-align: center; padding: 10px; border-radius: 6px; }
  .timeline { width: 100%; border-left: 2px dashed #cbd5e1; height: 100%; margin: 0 auto; }
  .step-row { border-bottom: 1px solid #e2e8f0; }
  .step-col { padding: 8px 12px; font-size: 12px; vertical-align: middle; }
  .step-num { font-weight: bold; color: #3b82f6; width: 50px; text-align: center; }
  .step-arrow { font-size: 13px; font-weight: 600; color: #0f172a; }
  .step-desc { font-size: 11px; color: #64748b; }
  .badge-block { background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
  .badge-exec { background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
</style>
</head>
<body>
  <div class="header">
    <h2>Figure 4.2: Runtime Pre-Execution Interception & Enforcement Sequence</h2>
    <p>Zero-execution enforcement lifecycle across autonomous agent, reference monitor, and operating system</p>
  </div>
  <table class="seq-table">
    <thead>
      <tr>
        <th style="width: 80px;">Phase</th>
        <th style="width: 200px;"><div class="seq-actor">M12: Agent LLM (Qwen3)</div></th>
        <th style="width: 320px;"><div class="seq-actor" style="background:#1d4ed8;">M8: Runtime Interceptor &amp; Gate</div></th>
        <th style="width: 320px;"><div class="seq-actor" style="background:#047857;">M1–M7: Governance Pipeline</div></th>
        <th style="width: 180px;"><div class="seq-actor" style="background:#b91c1c;">Host OS / Tool Callable</div></th>
      </tr>
    </thead>
    <tbody>
      <tr class="step-row">
        <td class="step-num">Step 1</td>
        <td class="step-col"><b>Proposes Tool Call</b><br><span class="step-desc">JSON: <code>{"tool": "write_file", ...}</code></span></td>
        <td class="step-col">⟶ <b>Intercepts Call</b> (Acquires Pre-Execution Lock)</td>
        <td class="step-col" style="color:#94a3b8;">Waiting</td>
        <td class="step-col" style="color:#94a3b8;">Untouched</td>
      </tr>
      <tr class="step-row" style="background: #f8fafc;">
        <td class="step-num">Step 2</td>
        <td class="step-col" style="color:#94a3b8;">Suspended in awaiting response</td>
        <td class="step-col">⟶ <b>Dispatches Payload</b> to M1–M7</td>
        <td class="step-col"><b>M1–M4:</b> Normalizes &amp; Extracts 22 Features<br><b>M5:</b> Random Forest Risk Scoring<br><b>M6:</b> Task Contract Authorization<br><b>M7:</b> Policy Fusion (5 Invariants)</td>
        <td class="step-col" style="color:#94a3b8;">Untouched</td>
      </tr>
      <tr class="step-row">
        <td class="step-num">Step 3</td>
        <td class="step-col" style="color:#94a3b8;">Suspended</td>
        <td class="step-col">⟵ <b>Returns Decision:</b> ALLOW / ALERT / BLOCK</td>
        <td class="step-col">Sends authoritative tuple:<br><code>(decision, risk_score, policy_id)</code></td>
        <td class="step-col" style="color:#94a3b8;">Untouched</td>
      </tr>
      <tr class="step-row" style="background: #fef2f2;">
        <td class="step-num" style="color:#dc2626;">Case A<br><span class="badge-block">BLOCK</span></td>
        <td class="step-col">⟵ <b>Returns Error Response:</b><br><code>"Action BLOCKED by Sentinel Policy"</code><br><span class="step-desc">Agent must re-plan trajectory</span></td>
        <td class="step-col"><b>Zero-Execution Enforced:</b> Callable invocation bypassed entirely. Persists audit: <code>state = 'blocked'</code></td>
        <td class="step-col">Audit Event Logged to M10 SQLite</td>
        <td class="step-col" style="font-weight:bold; color:#dc2626; text-align:center;">ZERO EXECUTION<br>(0 Calls Made)</td>
      </tr>
      <tr class="step-row" style="background: #f0fdf4;">
        <td class="step-num" style="color:#16a34a;">Case B<br><span class="badge-exec">ALLOW</span></td>
        <td class="step-col">⟵ <b>Receives Execution Result</b><br><span class="step-desc">Tool output returned cleanly</span></td>
        <td class="step-col"><b>Executes Tool Callable</b><br>Captures return code, stdout, stderr. Persists audit: <code>state = 'executed'</code></td>
        <td class="step-col">Audit Event Logged to M10 SQLite</td>
        <td class="step-col" style="font-weight:bold; color:#16a34a; text-align:center;">HOST TOOL RUNS<br>(Output Captured)</td>
      </tr>
    </tbody>
  </table>
</body>
</html>
"""

# 3. Policy Fusion Decision Matrix (Fig 4.3)
fig_4_3_html = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; padding: 24px; background: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; }
  .header { text-align: center; margin-bottom: 20px; }
  .header h2 { margin: 0; font-size: 22px; color: #0f172a; }
  .header p { margin: 4px 0 0 0; font-size: 13px; color: #64748b; }
  .grid-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 1100px; margin: 0 auto; }
  .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; background: #f8fafc; }
  .card h3 { margin: 0 0 10px 0; font-size: 15px; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
  .matrix-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
  .matrix-table th { background: #334155; color: #ffffff; padding: 6px 8px; text-align: left; }
  .matrix-table td { padding: 6px 8px; border-bottom: 1px solid #cbd5e1; }
  .b-allow { background: #dcfce7; color: #166534; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
  .b-alert { background: #fef9c3; color: #854d0e; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
  .b-block { background: #fee2e2; color: #991b1b; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
  .rule-item { font-size: 12px; margin-bottom: 8px; padding: 8px; background: #ffffff; border-left: 3px solid #3b82f6; border-radius: 3px; }
</style>
</head>
<body>
  <div class="header">
    <h2>Figure 4.3: Policy Fusion Logic &amp; Decision Matrix</h2>
    <p>Reconciling statistical ML risk and deterministic task authorization under 5 security invariants</p>
  </div>
  <div class="grid-container">
    <div class="card">
      <h3>Five Mandatory Security Invariants</h3>
      <div class="rule-item"><b>Invariant I1 (Denial Dominance):</b> If Task Authorization = <code>DENY</code>, the final governance verdict is unconditionally <b>BLOCK</b>.</div>
      <div class="rule-item"><b>Invariant I2 (Severe Risk Override):</b> If ML Risk Score $R_{ML} \ge 0.85$, the verdict is unconditionally <b>BLOCK</b> regardless of task grants.</div>
      <div class="rule-item"><b>Invariant I3 (Destructive Execution Prohibition):</b> If action is destructive and not explicitly whitelisted, verdict is <b>BLOCK</b>.</div>
      <div class="rule-item"><b>Invariant I4 (Zero Host Execution):</b> When verdict is <b>BLOCK</b>, tool callable execution is strictly zero.</div>
      <div class="rule-item"><b>Invariant I5 (Fail-Closed Default):</b> Any exception, timeout, or missing context forces an immediate fail-safe <b>BLOCK</b>.</div>
    </div>
    <div class="card">
      <h3>18-Case Baseline Decision Matrix</h3>
      <table class="matrix-table">
        <thead>
          <tr><th>Risk Band (M5)</th><th>Task Auth (M6)</th><th>Policy Match (M7)</th><th>Final Decision</th></tr>
        </thead>
        <tbody>
          <tr><td>LOW (&lt; 0.50)</td><td>PASS</td><td>ALLOW</td><td><span class="b-allow">ALLOW</span></td></tr>
          <tr><td>LOW (&lt; 0.50)</td><td>PASS</td><td>None</td><td><span class="b-allow">ALLOW</span></td></tr>
          <tr><td>LOW (&lt; 0.50)</td><td>DENY</td><td>Any</td><td><span class="b-block">BLOCK</span></td></tr>
          <tr><td>MEDIUM (0.50–0.84)</td><td>PASS</td><td>ALLOW</td><td><span class="b-alert">ALERT</span></td></tr>
          <tr><td>MEDIUM (0.50–0.84)</td><td>PASS</td><td>None</td><td><span class="b-alert">ALERT</span></td></tr>
          <tr><td>MEDIUM (0.50–0.84)</td><td>DENY</td><td>Any</td><td><span class="b-block">BLOCK</span></td></tr>
          <tr><td>HIGH (&ge; 0.85)</td><td>Any</td><td>Any</td><td><span class="b-block">BLOCK</span></td></tr>
          <tr><td>Fault / Exception</td><td>Any</td><td>Any</td><td><span class="b-block">BLOCK (Fail-Safe)</span></td></tr>
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
"""

# 4. Research ML Pipeline (Fig 4.4)
fig_4_4_html = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; padding: 24px; background: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; }
  .header { text-align: center; margin-bottom: 20px; }
  .header h2 { margin: 0; font-size: 22px; color: #0f172a; }
  .header p { margin: 4px 0 0 0; font-size: 13px; color: #64748b; }
  .pipeline { display: flex; align-items: center; justify-content: space-between; max-width: 1100px; margin: 0 auto; gap: 12px; }
  .pipe-box { background: #f8fafc; border: 2px solid #cbd5e1; border-radius: 8px; padding: 14px; flex: 1; min-height: 160px; }
  .pipe-box h3 { margin: 0 0 8px 0; font-size: 14px; color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; }
  .pipe-box p { font-size: 11px; color: #475569; margin: 4px 0; line-height: 1.35; }
  .arrow { font-size: 24px; color: #3b82f6; font-weight: bold; }
  .metric-badge { background: #dbeafe; color: #1e40af; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
</style>
</head>
<body>
  <div class="header">
    <h2>Figure 4.4: Research Machine Learning Pipeline &amp; Artifact Serialization</h2>
    <p>From raw benchmark trajectories to continuous runtime risk estimation</p>
  </div>
  <div class="pipeline">
    <div class="pipe-box">
      <h3>1. Benchmark Data</h3>
      <p><b>ATBench Trajectories:</b> 1,000 JSON records (503 Safe / 497 Unsafe).</p>
      <p><b>SyFI Observational:</b> 8,058 sessions, 665k steps (unlabeled corpus).</p>
      <p><b>Split Protocol:</b> Stratified 75% Train (750) / 25% Test (250), Seed 42.</p>
    </div>
    <div class="arrow">⟶</div>
    <div class="pipe-box">
      <h3>2. Feature Extractor</h3>
      <p><b>22 Behavioral Features:</b></p>
      <p>• Action counts &amp; categories (file, code, web, API, control)</p>
      <p>• Mutation &amp; destructive flags</p>
      <p>• State transitions (read-to-write)</p>
      <p>• Inter-action time statistics</p>
    </div>
    <div class="arrow">⟶</div>
    <div class="pipe-box">
      <h3>3. Model Training</h3>
      <p><b>Scaler:</b> <code>StandardScaler</code></p>
      <p><b>Classifier:</b> <code>RandomForestClassifier</code></p>
      <p>• $n=100$ estimators</p>
      <p>• Gini Impurity Criterion</p>
      <p>• Out-of-bag validation</p>
    </div>
    <div class="arrow">⟶</div>
    <div class="pipe-box">
      <h3>4. Model Artifact</h3>
      <p><b>Serialized File:</b> <code>risk_model.joblib</code></p>
      <p><b>Evaluation on Test (250):</b></p>
      <p>• Accuracy: <span class="metric-badge">72.40%</span></p>
      <p>• Precision: <span class="metric-badge">78.95%</span></p>
      <p>• Recall: <span class="metric-badge">60.48%</span></p>
      <p>• ROC-AUC: <span class="metric-badge">0.7782</span></p>
    </div>
  </div>
</body>
</html>
"""

# 5. Confusion Matrix (Fig 7.1)
fig_7_1_html = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; padding: 24px; background: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; }
  .header { text-align: center; margin-bottom: 20px; }
  .header h2 { margin: 0; font-size: 22px; color: #0f172a; }
  .header p { margin: 4px 0 0 0; font-size: 13px; color: #64748b; }
  .container { display: flex; justify-content: center; align-items: center; gap: 40px; max-width: 1000px; margin: 0 auto; }
  .cm-table { border-collapse: collapse; width: 440px; height: 320px; }
  .cm-table th { background: #334155; color: #ffffff; padding: 8px; font-size: 12px; }
  .cm-table td { width: 50%; height: 50%; text-align: center; border: 2px solid #ffffff; vertical-align: middle; }
  .cell-tn { background: #dcfce7; color: #166534; }
  .cell-fp { background: #fee2e2; color: #991b1b; }
  .cell-fn { background: #fee2e2; color: #991b1b; }
  .cell-tp { background: #dcfce7; color: #166534; }
  .val { font-size: 32px; font-weight: bold; margin: 0; }
  .lbl { font-size: 12px; text-transform: uppercase; font-weight: 600; margin-top: 4px; }
  .stats-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; width: 340px; }
  .stats-card h3 { margin: 0 0 12px 0; font-size: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 6px; }
  .stat-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px; }
  .stat-val { font-weight: bold; color: #0f172a; }
</style>
</head>
<body>
  <div class="header">
    <h2>Figure 7.1: Held-Out ATBench Confusion Matrix (N = 250)</h2>
    <p>Empirical evaluation of Random Forest risk classifier on held-out test split (Seed 42)</p>
  </div>
  <div class="container">
    <div>
      <div style="text-align: center; font-weight: bold; font-size: 13px; margin-bottom: 6px; color: #475569;">PREDICTED CLASS</div>
      <table class="cm-table">
        <thead>
          <tr>
            <th style="width: 80px; background: #1e293b;">ACTUAL</th>
            <th>Predicted Safe (0)</th>
            <th>Predicted Unsafe (1)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th style="background: #334155;">Actual Safe (0)</th>
            <td class="cell-tn">
              <div class="val">106</div>
              <div class="lbl">True Negative (TN)</div>
            </td>
            <td class="cell-fp">
              <div class="val">20</div>
              <div class="lbl">False Positive (FP)</div>
            </td>
          </tr>
          <tr>
            <th style="background: #334155;">Actual Unsafe (1)</th>
            <td class="cell-fn">
              <div class="val">49</div>
              <div class="lbl">False Negative (FN)</div>
            </td>
            <td class="cell-tp">
              <div class="val">75</div>
              <div class="lbl">True Positive (TP)</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <div class="stats-card">
      <h3>Primary Performance Metrics</h3>
      <div class="stat-row"><span>Accuracy:</span><span class="stat-val">72.40% (181 / 250)</span></div>
      <div class="stat-row"><span>Precision (Unsafe):</span><span class="stat-val">78.95% (75 / 95)</span></div>
      <div class="stat-row"><span>Recall / TPR:</span><span class="stat-val">60.48% (75 / 124)</span></div>
      <div class="stat-row"><span>Specificity / TNR:</span><span class="stat-val">84.13% (106 / 126)</span></div>
      <div class="stat-row"><span>F1-Score:</span><span class="stat-val">68.49%</span></div>
      <div class="stat-row"><span>ROC-AUC:</span><span class="stat-val">0.7782</span></div>
      <div class="stat-row" style="color: #dc2626;"><span>False Negative Rate:</span><span class="stat-val" style="color:#dc2626;">39.52% (49 / 124)</span></div>
      <div style="font-size: 11px; color: #64748b; margin-top: 10px; line-height: 1.35;">
        *Note: The 39.52% standalone FNR empirically substantiates why ML risk must be fused with M6 task authorizations and M7 invariants.
      </div>
    </div>
  </div>
</body>
</html>
"""

# 6. Feature Importance Bar Chart (Fig 7.2)
fig_7_2_html = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; padding: 24px; background: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; }
  .header { text-align: center; margin-bottom: 20px; }
  .header h2 { margin: 0; font-size: 22px; color: #0f172a; }
  .header p { margin: 4px 0 0 0; font-size: 13px; color: #64748b; }
  .chart-container { max-width: 900px; margin: 0 auto; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; }
  .bar-row { display: flex; align-items: center; margin-bottom: 10px; font-size: 12px; }
  .bar-label { width: 220px; font-weight: 600; color: #1e293b; text-align: right; padding-right: 14px; }
  .bar-track { flex: 1; background: #e2e8f0; height: 22px; border-radius: 4px; overflow: hidden; position: relative; }
  .bar-fill { background: linear-gradient(90deg, #3b82f6, #1d4ed8); height: 100%; border-radius: 4px; }
  .bar-val { width: 70px; padding-left: 10px; font-weight: bold; color: #0f172a; font-size: 12px; }
</style>
</head>
<body>
  <div class="header">
    <h2>Figure 7.2: Random Forest Top Feature Importance (Gini Impurity)</h2>
    <p>Relative importance of behavioral features extracted across ATBench trajectories</p>
  </div>
  <div class="chart-container">
    <div class="bar-row">
      <div class="bar-label">event_count</div>
      <div class="bar-track"><div class="bar-fill" style="width: 100%;"></div></div>
      <div class="bar-val">35.65%</div>
    </div>
    <div class="bar-row">
      <div class="bar-label">action_count</div>
      <div class="bar-track"><div class="bar-fill" style="width: 67.6%;"></div></div>
      <div class="bar-val">24.11%</div>
    </div>
    <div class="bar-row">
      <div class="bar-label">cat_file_system_write</div>
      <div class="bar-track"><div class="bar-fill" style="width: 25.0%;"></div></div>
      <div class="bar-val">8.92%</div>
    </div>
    <div class="bar-row">
      <div class="bar-label">cat_code_execution</div>
      <div class="bar-track"><div class="bar-fill" style="width: 18.0%;"></div></div>
      <div class="bar-val">6.43%</div>
    </div>
    <div class="bar-row">
      <div class="bar-label">read_to_write_transitions</div>
      <div class="bar-track"><div class="bar-fill" style="width: 14.5%;"></div></div>
      <div class="bar-val">5.18%</div>
    </div>
    <div class="bar-row">
      <div class="bar-label">unique_tool_count</div>
      <div class="bar-track"><div class="bar-fill" style="width: 12.8%;"></div></div>
      <div class="bar-val">4.56%</div>
    </div>
    <div class="bar-row">
      <div class="bar-label">mean_inter_action_time</div>
      <div class="bar-track"><div class="bar-fill" style="width: 10.2%;"></div></div>
      <div class="bar-val">3.64%</div>
    </div>
    <div class="bar-row">
      <div class="bar-label">mutating_known_true</div>
      <div class="bar-track"><div class="bar-fill" style="width: 8.8%;"></div></div>
      <div class="bar-val">3.12%</div>
    </div>
    <div class="bar-row">
      <div class="bar-label">Remaining 14 Features (Combined)</div>
      <div class="bar-track"><div class="bar-fill" style="width: 23.5%; background: #64748b;"></div></div>
      <div class="bar-val">8.39%</div>
    </div>
  </div>
</body>
</html>
"""

# Render all
render_html_to_png(fig_4_1_html, os.path.join(OUTPUT_DIR, "fig_4_1_overall_architecture.png"), 1200, 780)
render_html_to_png(fig_4_2_html, os.path.join(OUTPUT_DIR, "fig_4_2_runtime_interception_sequence.png"), 1200, 680)
render_html_to_png(fig_4_3_html, os.path.join(OUTPUT_DIR, "fig_4_3_governance_decision_flow.png"), 1200, 680)
render_html_to_png(fig_4_4_html, os.path.join(OUTPUT_DIR, "fig_4_4_research_ml_pipeline.png"), 1200, 550)
render_html_to_png(fig_7_1_html, os.path.join(OUTPUT_DIR, "fig_7_1_confusion_matrix.png"), 1100, 600)
render_html_to_png(fig_7_2_html, os.path.join(OUTPUT_DIR, "fig_7_2_feature_importance.png"), 1100, 600)
