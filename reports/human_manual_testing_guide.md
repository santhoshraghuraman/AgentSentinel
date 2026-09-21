# AgentSentinel: Human Manual Testing Guide

This guide provides a straightforward, screen-by-screen testing sequence for a human operator to verify the AgentSentinel AI Runtime Security Dashboard. Follow these steps sequentially to confirm that all 14 routes and the core governance engine are functioning correctly.

---

## 1. Preparation & System Health

### Diagnostics Screen (`/system/diagnostics`)
1. **What this screen is for:** Verifies that all underlying services (Database, Qwen3 LLM, Policy Engine) are online before you begin.
2. **Important Controls:** None required; it auto-loads.
3. **What you should do:** Navigate to `/system/diagnostics` in the sidebar.
4. **Expected Output:** You should see green "HEALTHY" status indicators for AgentSentinel Core, Database, LLM Provider (Qwen3), and Governance Engine.
5. **Proof:** This proves the backend API (`/api/v1/system/diagnostics`) is communicating properly with the SQLite database and the Ollama service.

---

## 2. Core Dashboard & Telemetry

### Overview Dashboard (`/`)
1. **What this screen is for:** High-level metrics view of total interceptions and active sessions.
2. **Important Controls:** **Sync Pipeline** button, time-range filters (**15m**, **1h**, **24h**, **Live**), and **Export Audit** button.
3. **What you should do:** Click the **Sync Pipeline** button.
4. **Expected Output:** The UI will briefly indicate a sync, and metrics (like Total Interceptions) will refresh.
5. **Proof:** Confirms the UI can successfully pull aggregated data from `/api/v1/metrics/dashboard`.

### Live Monitor (`/live`)
1. **What this screen is for:** Real-time scrolling feed of agent interceptions.
2. **Important Controls:** **Pause Stream**, **High-Risk Only**, **Clear Buffer**, and **Export Stream** buttons.
3. **What you should do:** Click **Clear Buffer**.
4. **Expected Output:** The scrolling terminal window empties. 
5. **Proof:** Proves the local React state for the event buffer can be managed and is responsive, while pulling from `/api/v1/events/live`.

---

## 3. Data Entities & Configuration

### Tasks (`/tasks`) & Policies (`/policies`)
1. **What this screen is for:** Configuring M6 Zero-Trust task boundaries and M7 governance rules.
2. **Important Controls:** **Register Task Context**, **Create New Policy**, and **Register Policy Rule** buttons.
3. **What you should do:** 
   - On `/tasks`, click **Register Task Context** with the default pre-filled data.
   - On `/policies`, click **Register Policy Rule** with the default pre-filled data.
4. **Expected Output:** The UI will submit the form and refresh the lists below the forms to include your new entry (or silently succeed if updating an existing ID).
5. **Proof:** Confirms the backend SQLite database accepts `POST` requests and persists new rules via `/api/v1/tasks` and `/api/v1/policies`.

### Agents (`/agents`) & Datasets (`/datasets`)
1. **What this screen is for:** Viewing the fleet overview, active sessions, and ML research corpus.
2. **Important Controls:** Expandable table rows, Search input ("Search by session ID, task, or agent...").
3. **What you should do:** Type "test" into the Search box on `/agents`.
4. **Expected Output:** The table instantly filters to matching rows. 
5. **Proof:** Confirms client-side data fetching (`/api/v1/sessions`) and React state filtering are operational.

---

## 4. Deep Analytical Tools

### Trajectories (`/trajectories`) & Decision Explorer (`/decision-explorer`)
1. **What this screen is for:** Archival viewing of sessions and deep-dive analysis of *why* M7 made a specific decision.
2. **Important Controls:** **Deep Dive in Decision Explorer** links in Trajectories; the **-- Select an Event --** dropdown in Decision Explorer.
3. **What you should do:** 
   - Go to `/trajectories`, find any session, and click **Deep Dive in Decision Explorer**.
   - You are taken to `/decision-explorer`. Select an event from the dropdown.
4. **Expected Output:** The UI populates charts showing the 22 ML features and the behavioral risk score.
5. **Proof:** Proves the UI can successfully query detailed feature extraction metrics (`M4`) for a specific historical event.

### Reports (`/reports`) & Evaluation (`/evaluation`)
1. **What this screen is for:** Regulatory compliance summaries and empirical ML model evaluation.
2. **Important Controls:** **Export Audit (CSV)**, **Export Report (JSON)**, and **Retrain Baseline** buttons.
3. **What you should do:** Click **Export Audit (CSV)** on the Reports page.
4. **Expected Output:** Your browser will download a `.csv` file.
5. **Proof:** Proves the backend can dynamically generate CSV blobs from the database and the frontend can process the download trigger via `/api/v1/reports/export`.

---

## 5. The Runtime Playground (`/playground`)

This is the most critical test. It verifies the entire end-to-end flow of the AgentSentinel architecture.

### How the Playground Flow Works:
When you click execute, the following sequence occurs:
1. **Qwen3 (The Actor):** Receives your prompt and generates a **Tool Call** JSON payload. (This takes ~20-30 seconds).
2. **M5 (ML Risk):** Extracts features from the tool call and calculates a behavioral risk score.
3. **M6 (Task Auth):** Checks if the tool is permitted by the active task ID.
4. **M7 (Policy Fusion):** Checks global rules and makes a final `ALLOW`, `ALERT`, or `BLOCK` decision.
5. **M8 (Enforcement):** Physically executes the tool, or drops it, recording the **Result**.

### The 4 Scenarios to Test

Go to the **Runtime Playground**, ensure the **Live Agent Execution (User Task)** tab is selected, and click the following Quick Scenario buttons one by one. Wait for each to finish completely before clicking the next.

#### 1. ALLOW (Benign)
1. **Action:** Click the **1. ALLOW (Benign)** button. Click **Execute Agent Task**.
2. **Expected Output:** Wait ~30 seconds. A green `ALLOW` badge will appear in the Interception Trace.
3. **Proof:** Qwen3 generated a safe `read_file` tool call. M6 and M7 permitted it via `/api/v1/agent/run`. The tool executed normally.

#### 2. ALERT (Monitored)
1. **Action:** Click the **2. ALERT (Monitored)** button. Click **Execute Agent Task**.
2. **Expected Output:** Wait ~30 seconds. A yellow `ALERT` badge will appear.
3. **Proof:** Qwen3 generated a `calculate` tool call. M7 flagged it against a monitoring policy but permitted execution. 

#### 3. BLOCK (Attack)
1. **Action:** Click the **3. BLOCK (Attack)** button. Click **Execute Agent Task**.
2. **Expected Output:** Wait ~30 seconds. A red `BLOCK` badge will appear. 
3. **Proof:** Qwen3 attempted to generate a malicious `write_file` tool call. M6/M7 intercepted it, and M8 physically stopped execution. The OS was protected. **Crucial:** A conversational refusal from Qwen3 ("I cannot do that") is a failure; a true pass *must* show the red `BLOCK` badge from the Interception Trace UI.

#### 4. FAULT RECOVERY (Error Handling)
1. **Action:** Click the **4. FAULT RECOVERY** button. Click **Execute Agent Task**.
2. **Expected Output:** Wait ~30 seconds. The state will resolve to a grey `EXECUTION_FAILED`.
3. **Proof:** Qwen3 requested `read_file` on a missing file (`non_existent_file.txt`). The system allowed the attempt, but the OS threw a `FileNotFoundError`. M8 safely caught the crash, prevented the API from going down, and recorded the failure.

---

## 6. Final Verification

### Audit Logs (`/audit`)
1. **What this screen is for:** Immutable cryptographic ledger of all interceptions.
2. **What you should do:** After running the 4 Playground scenarios, navigate to `/audit`.
3. **Expected Output:** You should see 4 new rows at the top of the table reflecting your ALLOW, ALERT, BLOCK, and FAULT tests.
4. **Proof:** Proves that M10 (Persistence) successfully committed the M8 execution results to the SQLite database via `/api/v1/audit`. 

**Testing is now complete. If all proofs pass, the AgentSentinel system is fully operational.**
