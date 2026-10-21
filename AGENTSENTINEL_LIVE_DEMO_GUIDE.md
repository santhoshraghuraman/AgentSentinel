# AgentSentinel — Live Demonstration & Evaluator Presentation Guide
*A Step-by-Step Practical Manual for College Project Defense & Live Evaluation*

---

## 1. Project Overview & Core Elevator Pitch

### What is AgentSentinel?
**AgentSentinel** is a **dual-kernel security governance and runtime interception supervisor** for autonomous AI agents. When modern autonomous agents (powered by Large Language Models like Qwen, Llama, or GPT) interact with databases, operating system shells, and file systems, they introduce severe security risks: prompt injection, unauthorized privilege escalation, and data exfiltration.

AgentSentinel sits directly between the AI agent and the host operating system. It treats the LLM as an **untrusted proposal engine**. The LLM proposes actions, but AgentSentinel inspects, verifies, authorizes, and enforces those actions before any byte is executed.

### The Golden Rule to Remember
> **"The AI proposes, but AgentSentinel disposes."**  
> The LLM never has direct execution authority. Stage **M7 (Governance Gate)** decides whether an action is safe, and Stage **M8 (Kernel Enforcement)** acts as the physical deadbolt that prevents dangerous code from running.

### System Architecture Summary
- **Backend**: Python 3.11+ / FastAPI (`api.main:app`) running on port `8000`.
- **Frontend**: Vite / React 18 / Tailwind CSS / Three.js 3D visualization running on port `5173`.
- **ML Engine**: Scikit-Learn Random Forest Classifier (`research/artifacts/risk_model.joblib`) calculating real-time behavioral anomaly risk probabilities.
- **Audit Ledger**: Durable SQLite relational ledger with interception-ID correlation and application-level append behavior.
- **LLM Runner**: Local Ollama instance serving `qwen3:4b` on port `11434` for autonomous task execution.

---

## 2. Core Execution Flow (How It Actually Works)

When an agent wants to do something, the request passes through the following pipeline:

```
[User Task] 
      │
      ▼
[Autonomous Agent (LLM)] ── Proposes Action Payload (e.g., delete_file, read_file)
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AGENTSENTINEL PIPELINE                       │
│                                                                 │
│  M1: Agent Identity Verification (Token, Role, Permissions)     │
│  M2: Task Contract Context (Scope constraints & boundaries)    │
│  M3: Behavioral Sequence Analysis (Temporal step history)       │
│  M4: Static Payload Analysis (Regex, sensitive paths, commands) │
│  M5: ML Risk Model (Random Forest anomaly score: 0.0 - 1.0)     │
│  M6: Heuristic Security Engine (Rule-based safety overrides)    │
│                                                                 │
│  M7: AUTHORITATIVE GOVERNANCE DECISION (ALLOW / ALERT / BLOCK)  │
│                               │                                 │
│  M8: KERNEL ENFORCEMENT GATE ─┴─ Physical Execution Sandbox     │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                 ┌────────────────┴────────────────┐
                 ▼                                 ▼
           [IF ALLOWED]                      [IF BLOCKED]
      Protected Callable Runs            Zero Invocations
     Tool Result Sent to Agent       Hard Exception Raised
                 │                                 │
                 └────────────────┬────────────────┘
                                  ▼
                        [SQLite Audit Ledger]
                     (Saved to SQLite DB & UI)
```

### The Four Crucial Verdicts (Do Not Confuse These!)
1. **ALLOW**:
   - The action satisfies all active security policies and has a low ML risk score.
   - The tool is executed, and its return value is sent back to the agent.
2. **ALERT**:
   - The action is permissible under base policy, but triggers an anomaly flag or warning threshold.
   - The action is allowed to run, but is flagged for heightened auditing or human-in-the-loop review.
3. **BLOCK**:
   - The action violates an active policy rule or exceeds the maximum acceptable risk threshold.
   - **Kernel Guarantees**: Exactly **zero invocations** of the protected callable occur. The operating system is never touched.
4. **EXECUTION_FAILED**:
   - **Important**: This is **NOT** a security block!
   - This occurs when an *authorized* action runs, but fails due to an environmental or runtime reason (e.g., trying to read a non-existent file or a network timeout). AgentSentinel records this honestly as an operational failure, not an interception.

---

## 3. Recommended 5–8 Minute Presentation Sequence

| Timeline | Screen / Feature | Primary Goal | What to Show |
| :--- | :--- | :--- | :--- |
| **0:00 - 1:15** | **Overview Dashboard** (`/`) | Set the scene & architecture | Show 2D radar, switch to 3D Command Centre, explain M1–M8 pipeline. |
| **1:15 - 3:00** | **Runtime Playground** (`/playground`) | Live Proof of Protection | Run safe `read_file` (ALLOW), then run malicious `delete_file` (BLOCK). Show zero callable invocations. |
| **3:00 - 4:15** | **Decision Explorer** (`/decision-explorer`) | Explain explainability | Pick the blocked event, inspect M5 ML probability vs M7 policy rule, show decision lineage. |
| **4:15 - 5:15** | **Security Trajectories** (`/trajectories`) | Behavioral session monitoring | Show how multiple actions form a timeline/trajectory graph of agent behavior. |
| **5:15 - 6:30** | **Policies & Fleet Governance** (`/policies`, `/agents`) | Show administrative controls | Show declarative RBAC policies and registered agent capabilities. |
| **6:30 - 7:30** | **ML Evaluation & Diagnostics** (`/evaluation`, `/system/diagnostics`) | Scientific rigor & reliability | Show empirical evaluation metrics (72.4% accuracy, 77.8% ROC-AUC), confusion matrix, and system health. |
| **7:30 - 8:00** | **Conclusion & Questions** | Conclude confidently | Restate the thesis: deterministic governance for probabilistic LLMs. |

---

## 4. Screen-by-Screen Walkthrough & Script

### Screen 1: Overview Dashboard
- **Route**: `http://localhost:5173/`
- **Menu Label**: `Overview` (Top item in sidebar)
- **What this screen is for**: Provides a high-level operational command centre showing live telemetry, total interceptions, block rates, active agents, and the 8-stage inspection pipeline.
- **What to click**:
  1. Observe the top KPI cards: `TOTAL INTERCEPTIONS`, `ALLOWED`, `BLOCKED`, `ACTIVE SESSIONS`.
  2. Click the view toggle button `[3D VIEW] / [2D RADAR]` in the top right of the visualizer card.
  3. In 3D view, click on the **M7 (Governance)** card or button, then the **M8 (Enforcement)** card.
- **What you will see**:
  - The 3D interactive particle ring and node hierarchy smoothly rotate.
  - Clicking M7 displays: *"Stage M7: Authoritative Policy & Governance Decision Engine"*.
  - Clicking M8 displays: *"Stage M8: Dual-Kernel Isolation & Enforcement Gate"*.
- **What happened during the walkthrough**: Both 2D radar and 3D WebGL scenes rendered at 60 FPS with responsive tooltips and zero layout clipping.
- **Note on Status Indicators**: Header badges such as `SYSTEM: OPERATIONAL` or `ACTIVE RUNTIME INGESTION` in the UI are static layout indicators. Authoritative live subsystem health is verified via `/api/v1/health` and Screen 14 (Diagnostics).
- **What to say to your evaluator**:
  > *"Ma'am, this is our Overview Dashboard. Here we see live telemetry from all agent activities across the system. The 3D view visualizes our dual-kernel architecture. Notice stages M1 through M6, which handle identity, contract boundaries, sequence tracking, and machine learning risk scoring. Stages M7 and M8 are our dual-kernel core: M7 makes the authoritative policy verdict, and M8 physically enforces that verdict at the runtime boundary."*
- **If something looks unexpected**: If the 3D scene appears black or slow on low-power hardware, simply click the `[2D RADAR]` toggle to return to the lightweight vector visualization.

---

### Screen 2: Live Monitor
- **Route**: `http://localhost:5173/live`
- **Menu Label**: `Live Monitor`
- **What this screen is for**: Real-time event stream showing telemetry packets as they arrive from executing agent processes.
- **What to click**: Notice the incoming events, timestamps, agent identifiers, action types, and color-coded status badges (`ALLOW` in green, `BLOCK` in red).
- **What happened during the walkthrough**: Events loaded instantly with live timestamps and verified WebSocket/polling connectivity.
- **What to say to your evaluator**:
  > *"This screen gives security operators real-time observability. Every single tool call attempted by any agent in the fleet appears here within milliseconds. If an attacker tries to inject prompts into an agent, operators can see the interception trigger immediately."*

---

### Screen 3: Runtime Playground (The Most Important Demo Screen!)
- **Route**: `http://localhost:5173/playground`
- **Menu Label**: `Playground`
- **What this screen is for**: The interactive testing ground where you demonstrate real-time interception to the evaluator.
- **Two Demonstration Options Available**:
  - **Option A: Direct Intercept Simulator (Recommended — Fast & Deterministic)**:
    1. Click the **`Direct Intercept Simulator`** tab at the top right of the workspace.
    2. **Safe ALLOW Demonstration**:
       - Click the visible preset button **`Read /etc/passwd`** (or enter Tool Name: `read_file`, Arguments: `{"path": "/etc/passwd"}`).
       - Click the blue button: **`Intercept Tool Call`**.
       - Outcome: The right panel displays **`ACTION AUTHORIZED (ALLOW)`** in green with the **`PERMITTED`** badge. The tool execution is authorized to proceed.
    3. **Threat BLOCK Demonstration**:
       - Click the attack preset button: **`Write /etc/passwd (Attack)`** (or enter Tool Name: `write_file`, Arguments: `{"file_path": "/etc/passwd", "content": "root::0:0:::"}`).
       - Click the blue button: **`Intercept Tool Call`**.
       - Outcome: The right panel displays **`M8 ENFORCEMENT GATE: HARD BLOCK`** in red with the **`DENIED`** badge and Risk Severity `CRITICAL`.
       - Enforcement Guarantee: Execution is aborted before invocation with **zero callable invocations**.
  - **Option B: Autonomous Agent Runner (Task Workspace)**:
    1. Click the **`Task Workspace`** tab.
    2. Click the **`Examples`** dropdown in the top bar.
    3. Choose **`1. ALLOW (Benign) - Read docs`** or **`3. BLOCK (Attack) - Write root`**.
    4. Click the blue **`Run Task`** button to observe live LLM tool proposal, M7 governance interception, and M8 enforcement.
- **What to say to your evaluator**:
  > *"Now I will demonstrate the core security guarantee of AgentSentinel. First, I test a benign tool call: reading a file. M7 evaluates it, detects no policy violation, calculates a low ML anomaly probability, and M8 authorizes the call.*  
  > *Now, watch what happens when an agent proposes a destructive action: modifying or overwriting critical system files. Stage M7 identifies an invariant violation and elevated risk. Stage M8 steps in as the kernel deadbolt. It completely aborts execution, guaranteeing zero invocations of the protected callable."*
- **If something looks unexpected**: If Ollama is offline or slow, use **Option A (Direct Intercept Simulator)**, which runs 100% deterministically and instantaneously through M8 without requiring LLM inference.

---

### Screen 4: Decision Explorer
- **Route**: `http://localhost:5173/decision-explorer`
- **Menu Label**: `Decision Explorer`
- **What this screen is for**: Deep forensic audit and explainability for any single decision made by the system.
- **What to click**:
  1. Click the **Interception Event** dropdown at the top.
  2. Select the latest interception event (the one you just ran in the Playground).
  3. Scroll down through the three panels:
     - **Decision Lineage**: Shows the timestamp, Agent ID, Task ID, and M7 verdict.
     - **Risk & ML Signals**: Shows the exact feature vector breakdown (payload entropy, path depth, behavioral sequence risk).
     - **Policy Rationale**: Shows exactly which rule triggered the decision.
- **What happened during the walkthrough**: The dropdown contains over 260 real historical events from our automated tests; selecting an event populated the complete risk radar, feature table, and JSON artifact.
- **What to say to your evaluator**:
  > *"One of the main requirements of AI governance is explainability. In Decision Explorer, we can inspect any past decision down to the exact millisecond. We see not just that it was blocked, but why: the policy rule name, the exact feature values fed into our Random Forest classifier, and the full decision lineage for compliance reporting."*

---

### Screen 5: Security Trajectories
- **Route**: `http://localhost:5173/trajectories`
- **Menu Label**: `Trajectories`
- **What this screen is for**: Analyzes multi-step behavioral sequences over time. Rather than evaluating actions in isolation, AgentSentinel monitors the *trajectory* of an agent session.
- **What to click**: Look at the session history list on the left and the step graph on the right.
- **What happened during the walkthrough**: Walkthrough session events appeared in chronological order showing how safe initial steps can escalate toward risky behavior.
- **What to say to your evaluator**:
  > *"Attackers often don't launch an attack in a single step; they start with innocent queries and gradually escalate privileges. The Security Trajectories screen monitors multi-turn sessions. If an agent begins behaving anomalously compared to its baseline trajectory, our M3 and M5 stages detect the drift before the malicious payload executes."*

---

### Screen 6: Agents & Fleet Registry
- **Route**: `http://localhost:5173/agents`
- **Menu Label**: `Agents`
- **What this screen is for**: Inventory of all authorized autonomous agents, their roles, assigned permission tiers, and active status.
- **What to say to your evaluator**:
  > *"Here we manage the identities of our agent fleet. Each agent has an authorized identity token, an assigned role, and strict boundary scopes. An unauthorized agent cannot execute any tools."*

---

### Screen 7: Governance Policies
- **Route**: `http://localhost:5173/policies`
- **Menu Label**: `Policies`
- **What this screen is for**: Management of declarative security policies (e.g., blocking file deletions, restricting network egress, enforcing rate limits).
- **What to say to your evaluator**:
  > *"This is our policy rulebook. Policies are written declaratively. Even if the ML model is uncertain, deterministic policies provide a hard safety net that can never be bypassed by prompt jailbreaks."*

---

### Screen 8: Task Contracts
- **Route**: `http://localhost:5173/tasks`
- **Menu Label**: `Tasks`
- **What this screen is for**: Defines scope boundaries for specific user assignments. If an agent is assigned a 'Summarize Document' task, it is strictly forbidden from executing shell commands outside that scope.
- **What to say to your evaluator**:
  > *"Task Contracts implement the Principle of Least Privilege. When a user asks an agent to perform a specific task, the contract binds the agent to only the tools needed for that assignment."*

---

### Screen 9: Audit Ledger
- **Route**: `http://localhost:5173/audit`
- **Menu Label**: `Audit Logs`
- **What this screen is for**: Durable relational security ledger storing every interception event, timestamp, sequence number, governance verdict, and runtime outcome.
- **What to say to your evaluator**:
  > *"Every single tool interception is correlated by a unique UUID interception ID and recorded in our durable SQLite audit ledger with application-level append semantics. This provides detailed event lineage for enterprise compliance and post-incident forensics."*

---

### Screen 10: Research Datasets
- **Route**: `http://localhost:5173/datasets`
- **Menu Label**: `Datasets`
- **What this screen is for**: Displays the datasets used to train and validate our behavioral risk models, showing benign vs attack distribution.
- **What to say to your evaluator**:
  > *"For our machine learning component, we curated behavioral datasets containing thousands of benign and adversarial agent tool trajectories to train our anomaly detector."*

---

### Screen 11: Model Evaluation & Metrics
- **Route**: `http://localhost:5173/evaluation`
- **Menu Label**: `Evaluation`
- **What this screen is for**: Scientific validation metrics for the learned research baseline evaluated on empirical benchmark trajectories (ATBench).
- **What to click**: Point out the empirical evaluation metrics and Confusion Matrix from `datasets/evaluation_metrics.json`:
  - **Accuracy**: **`72.4%`** (`0.724`)
  - **Precision**: **`79.0%`** (`0.7895`)
  - **Recall**: **`60.5%`** (`0.6048`)
  - **F1-Score**: **`68.5%`** (`0.6849`)
  - **ROC-AUC**: **`0.778` (77.8%)** (`0.7782`)
  - **Confusion Matrix**: True Negatives: 106, False Positives: 20, False Negatives: 49, True Positives: 75.
- **What to say to your evaluator**:
  > *"Here are the empirical evaluation metrics for our Stage M5 baseline model evaluated on 250 held-out ATBench trajectories. Our Random Forest classifier achieves 72.4% accuracy, 79.0% precision, 60.5% recall, and an ROC-AUC of 0.778. These metrics represent honest baseline trajectory classification on empirical benchmark data. Our runtime risk scoring runs separately in Stage M5, ensuring research benchmarks remain untainted by runtime drift."*

---

### Screen 12: Compliance Reports
- **Route**: `http://localhost:5173/reports`
- **Menu Label**: `Reports`
- **What this screen is for**: Automated architectural compliance mapping against frameworks like OWASP Top 10 for LLMs and NIST AI RMF.
- **Compliance Scope**: This provides an automated internal architectural posture mapping to assist compliance evaluation and defense-in-depth posture analysis. It is not an external third-party certification.
- **What to say to your evaluator**:
  > *"AgentSentinel maps runtime interceptions directly to established standards such as the OWASP Top 10 for LLMs and NIST AI Risk Management Framework, generating audit-ready compliance posture reports for enterprise review. This is an internal architectural posture alignment tool rather than a third-party regulatory certification."*

---

### Screen 13: System Settings
- **Route**: `http://localhost:5173/settings`
- **Menu Label**: `Settings`
- **What this screen is for**: Configures system-wide enforcement thresholds, risk tolerances, notification webhooks, and debug logging.

---

### Screen 14: System Diagnostics
- **Route**: `http://localhost:5173/system/diagnostics`
- **Menu Label**: `Diagnostics` (Bottom of sidebar)
- **What this screen is for**: Live health status of all subsystems (FastAPI backend, SQLite database, scikit-learn model artifacts, Ollama service).
- **What to say to your evaluator**:
  > *"This diagnostics panel verifies that all backend services, database connections, model weights, and local LLM runners are operational and healthy."*

---

## 5. Potential Questions from Your Evaluator & Exact Answers

### Q1: "Why can't we just ask the LLM to verify if its own action is safe using system prompts?"
**Your Answer**:  
*"Ma'am, prompt-based self-policing fails because of prompt injection and model jailbreaks. If an attacker injects malicious instructions inside an email or document the agent reads, the LLM's context window is compromised. An LLM cannot be its own security guard. Security must exist out-of-band as a separate, deterministic software layer that the LLM cannot modify."*

### Q2: "What is the difference between Stage M7 and Stage M8?"
**Your Answer**:  
*"Stage M7 is the brain; Stage M8 is the muscle. Stage M7 evaluates the evidence from M1 through M6 and reaches an authoritative policy decision (ALLOW, ALERT, or BLOCK). Stage M8 is the kernel enforcement gate that physically wraps the tool execution. If M7 decides BLOCK, M8 aborts execution before the system call is made, ensuring zero invocations."*

### Q3: "What Machine Learning model do you use, and why not another LLM?"
**Your Answer**:  
*"In Stage M5, we intentionally use a lightweight Scikit-Learn Random Forest Classifier rather than another heavy LLM. This provides two massive advantages: first, inference takes less than 3 milliseconds, avoiding latency bottlenecks; second, it produces deterministic numerical risk probabilities without hallucination."*

### Q4: "What happens if the ML model makes a mistake (False Negative)?"
**Your Answer**:  
*"AgentSentinel uses defense-in-depth. Even if the ML model produces a false negative score, our deterministic Stage M7 policies act as hard guardrails. For instance, any attempt to delete critical system files or access unauthorized paths is immediately blocked by policy, regardless of the ML model score."*

### Q5: "What are the current limitations of this project?"
**Your Answer (Honest & Academic)**:  
*"Currently, our implementation has been evaluated and verified in a single-node local environment using SQLite for persistence and local Ollama (`qwen3:4b`) for autonomous agent inference. We deliberately keep our academic claims grounded in what has been empirically verified:*

1. *Local vs Distributed: The system was tested on a single-node architecture with SQLite and local Ollama (`qwen3:4b`). Distributed multi-node clustering and external commercial LLM endpoints (e.g., OpenAI or Anthropic cloud endpoints) were not tested or verified in this release.*
2. *Compliance Mapping: Reports map runtime behavior against the OWASP Top 10 for LLMs and NIST AI RMF for internal architectural posture alignment; this is not a third-party commercial certification.*
3. *Health Monitoring: Static status pills in the UI header (such as `SYSTEM: OPERATIONAL` or `ACTIVE RUNTIME INGESTION`) are presentation layout elements; authoritative live subsystem health is verified via `/api/v1/health` and the System Diagnostics page.*
4. *ML Evaluation: Stage M5 achieves empirical benchmark metrics of 72.4% accuracy, 79.0% precision, 60.5% recall, and 0.778 ROC-AUC on ATBench. Stage M7 deterministic policies act as the authoritative hard guardrails, ensuring critical safety regardless of probabilistic model score."*

---

## 6. Pre-Demo Checklist (Run 10 Minutes Before Presentation)

1. **Verify Backend is Running**:
   - Open browser to `http://localhost:8000/api/v1/health`
   - Must return: `{"status": "ok", "version": "0.9.0", "milestone": "M9"}`
   - If not running: Open terminal at repository root and run:
     ```powershell
     python -m uvicorn api.main:app --reload --port 8000
     ```

2. **Verify Frontend is Running**:
   - Open browser to `http://localhost:5173/`
   - Must load the AgentSentinel interface cleanly.
   - If not running: Open terminal at `ui/` directory and run:
     ```powershell
     cd ui
     npm run dev
     ```

3. **Verify Local Ollama (Optional)**:
   - Check if Ollama is running: `http://localhost:11434/api/tags`
   - Model `qwen3:4b` is installed.
   - *Note: If Ollama is closed, the Direct Intercept Simulator in the Playground still works 100% reliably!*

4. **Browser Setup**:
   - Set zoom level to 100% or press `Ctrl + 0`.
   - Maximize the browser window for the best view of the 3D command centre.
