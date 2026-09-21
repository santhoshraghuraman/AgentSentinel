# AgentSentinel Architecture Documentation

## A. SYSTEM OVERVIEW
**AgentSentinel** is a runtime behavioral governance and fail-safe proxy for autonomous LLM agents. 

**Technical Problem Addressed:** Autonomous agents generate and execute tool calls (e.g., file system writes, shell commands) dynamically. Existing security guardrails largely rely on analyzing the LLM's natural language prompt or generating policies via an LLM. This introduces latency, hallucination risks, and is vulnerable to prompt injection bypasses.

**System Objective:** To intercept autonomous tool execution requests *after* generation but *before* system execution, evaluating them against a hybrid deterministic and machine-learning governance pipeline to prevent destructive or unauthorized actions.

**High-Level Execution Lifecycle:**
1. Agent generates a JSON tool call.
2. Interceptor halts execution.
3. Pipeline evaluates tool call context and temporal behavior.
4. If unauthorized, returns a zero-execution "blocked" error back to the agent.
5. If authorized, allows execution and audits the result.

## B. COMPLETE M1-M12 ARCHITECTURE

### M1: Data Foundation
- **Purpose:** Standardizes inbound telemetry structure.
- **Inputs:** Raw agent tool calls (payloads).
- **Processing:** Parses and validates the raw JSON schema.
- **Outputs:** `EventRecord` containing standardized tool identifiers.
- **Security Role:** Prevents malformed or intentionally obfuscated JSON injection.

### M2: Action Normalization
- **Purpose:** Abstract diverse tool APIs into a common ontology.
- **Inputs:** Standardized tool calls.
- **Processing:** Maps functions (e.g., `bash`, `python`, `fs_read`) into `ActionCategory` enums (e.g., `CODE_EXECUTION`, `FILE_SYSTEM_READ`).
- **Outputs:** `NormalizedAction`.

### M3: Behavioral Sequence
- **Purpose:** Maintains temporal sequence context.
- **Inputs:** `NormalizedAction`.
- **Processing:** Appends the action to a sliding window of historical agent actions.
- **Outputs:** `BehavioralSequence`.
- **Security Role:** Required for detecting context-dependent attacks (e.g., rapid directory enumeration followed by an exfiltration attempt).

### M4: Feature Extraction
- **Purpose:** Translates sequences into ML-ready numerical vectors.
- **Inputs:** `BehavioralSequence`.
- **Processing:** Calculates 22 behavioral features, such as transition velocities, categorical counts, and mutation patterns.
- **Outputs:** 22-dimensional Float Vector.

### M5: Behavioral Risk
- **Purpose:** Probabilistic risk anomaly scoring.
- **Inputs:** 22-D Float Vector.
- **Processing:** Applies `StandardScaler` and inference via a `RandomForestClassifier`.
- **Outputs:** Risk Severity (e.g., `HIGH`, `LOW`).

### M6: Task Authorization
- **Purpose:** Deterministic constraint validation.
- **Inputs:** `NormalizedAction` and current Session `TaskContext`.
- **Processing:** Checks if the requested tool falls within the explicitly authorized boundaries of the active task.
- **Outputs:** Authorization Status (e.g., `PASS`, `DENY`).

### M7: Policy Fusion
- **Purpose:** Final decision synthesis.
- **Inputs:** M5 Risk Severity, M6 Auth Status, Explicit Policies.
- **Processing:** Evaluates a deterministic rule matrix (`_BASELINE_MATRIX`). 
- **Outputs:** Governance Decision (`ALLOW`, `ALERT`, `BLOCK`).
- **Security Role:** The absolute source of truth for the interceptor.

### M8: Runtime Interceptor
- **Purpose:** The execution gate boundary.
- **Inputs:** M7 Decision, original Tool Call.
- **Processing:** Enforces zero-execution if `BLOCK`, injecting a failure schema back to the agent. Otherwise delegates to execution.
- **Outputs:** Interception Result.

### M9: Backend API Services
- **Purpose:** Application business logic boundary.
- **Processing:** FastAPI routes for UI interaction and data ingestion.

### M10: Persistence
- **Purpose:** Durable state storage.
- **Processing:** SQLAlchemy ORM managing SQLite databases (`agentsentinel.db`). Stores audit logs, policies, and tasks.

### M11: UI Observability
- **Purpose:** Operator oversight interface.
- **Processing:** React/Vite dashboard using HTTP Polling (`useQuery`) to visualize M1-M10 state.

### M12: Integrations
- **Purpose:** Adapters for external agent frameworks.
- **Processing:** Translates specific framework tool execution protocols (e.g., OpenAI function calling) into M1 payloads.

## C. ACTUAL QWEN3 ROLE
In the current implementation, **Qwen3:4b** (served via Ollama) operates **exclusively as the M12 Agent LLM**. 

- **Tool-Call Generation:** Qwen3 acts as the autonomous agent attempting to solve tasks and generate JSON tool calls.
- **Governance Role:** Qwen3 is **NOT** used in M7 policy fusion, nor anywhere within the M1-M8 governance pipeline. Governance is purely deterministic Python logic combined with the Random Forest model.

## D. END-TO-END RUNTIME FLOW
Please refer to `docs/runtime-flow.mmd` and `docs/architecture.mmd` for visual diagrams.

1. **User Goal** defined.
2. **Qwen3 (Agent)** formulates a plan and issues a **Tool Call**.
3. **M8 Interception Boundary** halts the request.
4. **M1→M2→M3→M4** standardizes and extracts behavioral features.
5. **M5** evaluates the ML risk score.
6. **M6** evaluates task authorization constraints.
7. **M7** fuses risk, authorization, and explicit policies.
8. **M8 Enforcement** acts on the M7 decision.
9. **Tool Execution** occurs (if ALLOW/ALERT) OR **Zero-Execution Block** occurs.
10. **Result Returned to Agent**.
11. **Audit Persistence** via M10.
12. **UI Observability** via M11.

## E. SECURITY DECISION FLOW
Please refer to `docs/governance-decision-flow.mmd`.

- **ALLOW:** Execution proceeds normally.
- **ALERT:** Execution proceeds, but UI flags the event visually.
- **BLOCK:** Execution is prevented entirely. A fabricated error is returned.
- **Fail-Safe Behavior:** If any exception occurs within M3-M7 (e.g., missing ML model, malformed sequence), M8 automatically triggers a **BLOCK**.
- **Authorization Missing:** Triggers `Auth: DENY` -> M7 outputs `BLOCK`.

## F. MACHINE LEARNING FLOW
Please refer to `docs/research-ml-flow.mmd`.

- **Dataset:** `ATBench` (`test.json`).
- **Features:** 22 temporal/behavioral sequence features.
- **Preprocessing:** `StandardScaler()`.
- **Model:** `RandomForestClassifier(n_estimators=100, random_state=42)`.
- **Methodology:** 75/25 Stratified Split (750 Train, 250 Test). 
- **Metrics:** Accuracy ~0.724.
- **Artifact:** `risk_model.joblib`.
- **Limitations:** Trained exclusively on ATBench; external generalizability remains unverified.

## G. DATA FLOW
*(See `docs/research-ml-flow.mmd`)*
**ATBench:** Labeled dataset used for supervised feature extraction and Random Forest model training.
**SyFI TraceLab:** Observational trajectory dataset used for analysis and general behavioral study. They are separate datasets.

## H. BACKEND / PERSISTENCE ARCHITECTURE
- **Framework:** FastAPI running on Uvicorn.
- **Persistence:** SQLite (`agentsentinel.db`).
- **ORM:** SQLAlchemy with Alembic for migrations.
- **Layering:** Routers (`M9 API`) -> Services -> Repositories (`M10`).

## I. FRONTEND ARCHITECTURE
- **Framework:** React / Vite.
- **Key Views:** Dashboard, Live Monitor, Decision Explorer, Agents, Tasks, Policies, Audit Logs, Datasets, Evaluation, Reports, Settings, Diagnostics.
- **Telemetry Update Mechanism:** The UI relies on **HTTP Polling** via `@tanstack/react-query` (e.g., polling every 3000ms for Live Monitor events). WebSockets are not used in this implementation.

## J. DEPLOYMENT ARCHITECTURE
- **Environment:** Windows natively via `start_production.ps1` (or `.bat`).
- **Python:** Virtual Environment (`.venv`) hosting FastAPI and ML dependencies.
- **Node:** Local `npm run build` and Vite preview server.
- **Ollama:** Expected to run on `http://127.0.0.1:11434` hosting `qwen3:4b`.
- **Environment Variables:** Managed via `.env` (e.g., `OLLAMA_HOST`, `VITE_API_URL`).

## K. NOVELTY / TECHNICAL CONTRIBUTION
The following are technically defensible contributions of the AgentSentinel architecture:
1. **Hybrid Deterministic + Behavioral ML Governance:** A pipeline that synthesizes fast ML inference with hard authorization constraints without relying on LLM-based policy evaluation.
2. **Trajectory/Temporal Behavioral Feature Extraction:** Applying UEBA-style temporal analysis to autonomous agent tool sequences rather than NLP prompt analysis.
3. **Runtime Tool-Call Interception & Zero-Execution Enforcement:** Creating a dedicated out-of-band proxy layer that intercepts deterministic execution bindings.
4. **Fail-Safe Runtime Governance:** Ensuring that governance pipeline exceptions default to execution blocks, protecting the host system from unmonitored actions.

## L. RESEARCH LIMITATIONS
- **ATBench Scope:** The ML model is heavily fitted to the specific categorical distribution of the ATBench dataset.
- **Missing External Benchmarks:** Efficacy against alternative benchmarks (like AgentDoG) is unverified as the dataset is absent locally.
- **Internal Evaluation:** Lack of a formal ablation study comparing AgentSentinel against SOTA prompt-guard LLMs (e.g., Llama-Guard).
- **SyFI Role:** SyFI is utilized for data analysis but not fully integrated into the primary training pipeline.
