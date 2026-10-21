# AgentSentinel Live Chrome System Walkthrough

This report validates the **AgentSentinel AI Runtime Security Dashboard** frontend across all 14 active application routes using a real, headed Google Chrome session connected to the local development environment (`http://localhost:5173`).

---

## 1. Route Verification & Visual Walkthrough

### Overview Dashboard (`/`, `/dashboard`)
**Status: PASS**
- Validated active session metrics, pipeline status, ML threat classifier metrics, and policy decision distribution breakdown.
- Confirmed interactive filtering and pipeline synchronization controls respond appropriately.

### Live Monitor (`/live`, `/monitor`)
**Status: PASS**
- Validated real-time event streaming ticker.
- Validated live telemetry feed of active tool executions, pause/resume controls, and 'High-Risk Only' toggles.

### Trajectories (`/trajectories`)
**Status: PASS**
- Validated complete trajectory archive.
- Confirmed filtering by decision outcome (ALLOW, ALERT, BLOCK) and inspected step count breakdowns.

### Agents & Sessions (`/agents`)
**Status: PASS**
- Validated fleet overview and active session store listing.
- Successfully expanded individual agent session inspectors (verifying agent model info `qwen3:4b`).

### Governance Policies (`/policies`)
**Status: PASS**
- Validated M7 Policy Fusion Engine status.
- Inspected loaded rule lists (`pol_allow_read`, `pol_alert_calc`, `pol_block_delete`), priority levels, and the Policy Authoring Sandbox form.

### Task Authorization Contexts (`/tasks`)
**Status: PASS**
- Validated M6 Zero-Trust task context boundaries.
- Confirmed permitted/prohibited invariants and verification pipeline representation.

### Audit Logs (`/audit`)
**Status: PASS**
- Validated durable SQLite audit ledger with interception-ID correlation.
- Demonstrated expandable audit log items with full invocation details and normalized semantic payloads.

### Decision Explorer (`/decision-explorer`)
**Status: PASS**
- Validated interactive interface for deep dives into sub-millisecond multi-stage pipeline breakdowns and policy lineage.

### Datasets & Benchmark Corpus (`/datasets`)
**Status: PASS**
- Validated research corpus details for ATBench and SyFi Coding Traces.
- Confirmed rendering of file paths, sizes, SHA-256 hashes, and ML class distributions.

### Model Evaluation (`/evaluation`)
**Status: PASS**
- Validated Research Model Evaluation view with accuracy metrics (72.4%), precision, recall, and AUC measurements.
- Verified confusion matrix and model provenance configuration are presented correctly.

### Compliance & Governance Reports (`/reports`)
**Status: PASS**
- Validated regulatory compliance posture summary.
- Inspected governance decision distribution, execution outcome integrity metrics, and baseline measurements.

### System Settings (`/settings`)
**Status: PASS**
- Validated core API status configuration, persistence layer (SQLite), runtime intelligence provider (Ollama / `qwen3:4b`), and fail-safe security settings.

### System Diagnostics (`/system/diagnostics`)
**Status: PASS**
- Validated real-time component health checks for AgentSentinel Core, Database, LLM Provider, and Governance Engine.


---

## 2. Runtime Playground Security Validations (`/playground`)

The following core scenarios were executed interactively in the **Runtime Playground** to visually confirm interception gates (M8) and policy evaluations.

### ALLOW Scenario Validation
**Status: PASS**
- Executed `walkthrough-allow-verify`.
- Visualized full interception trace confirming authorized execution path.
- UI reflected successful invocation.

### ALERT Scenario Validation
**Status: PASS**
- Executed `walkthrough-alert-verify`.
- Visualized execution trace confirming that the action was permitted but flagged with a high-priority alert.
- Audit ledger accurately reflected alert context.

### BLOCK Scenario & Direct Intercept
**Status: PASS**
- Executed `walkthrough-block-verify`.
- Validated that the M8 interception gate successfully blocked the malicious action.
- Direct Intercept Simulator correctly processed the raw payload, identified the policy violation, and rendered the block decision.

### FAULT Scenario Validation
**Status: PASS**
- Executed `4. FAULT RECOVERY` scenario (`walkthrough-fault-verify`).
- Generated tool call `read_file` targeting a missing file in the sandbox.
- Visualized Interception Trace capturing `STATUS: FAILED` / `FAULT ENCOUNTERED (MONITORED)`.
- Final state accurately reflected `EXECUTION_FAILED` without crashing the runtime.

---

*(Note: Full visual evidence, including the browser interaction recording and route screenshots, have been captured and saved as an Artifact in the Antigravity IDE for review).*
