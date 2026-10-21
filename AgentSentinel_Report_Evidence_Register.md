# AgentSentinel: Technical Report Evidence Register

**Project Title:** A Model-Agnostic Runtime Behavioral Governance Framework for Autonomous AI Agents  
**Student:** Santhosh R (Reg No: 22MIS0282)  
**Degree:** Master of Technology in Software Engineering  
**Course Code:** SWE3004 – Software Design and Development Project  
**Institution:** School of Computer Science Engineering and Information Systems (SCORE), Department of Software and Systems Engineering, Vellore Institute of Technology (VIT), Vellore  
**Supervisor:** Dr. Priya V, Associate Professor Sr., SCORE, VIT Vellore  
**Academic Year & Semester:** 2026–2027, Fall Semester  
**Audit Date:** October 2026  
**Repository Branch:** `review2-live-demo-readiness`  

---

## 1. Evidence Classification Hierarchy

Every factual claim in the M.Tech dissertation is validated against the AgentSentinel repository and classified under the following rigorous standards:
- `[VERIFIED IN CURRENT SOURCE]`: Directly confirmed against active Python/TypeScript source code and exact line numbers in the frozen codebase.
- `[SUPPORTED BY TEST/ARTIFACT]`: Backed by passing automated test suites (Pytest/Jest), serialized ML artifacts (`.joblib`, `.json`), or database tables (`.db`).
- `[HISTORICAL REPORT ONLY]`: Documented in prior phase markdown logs, but without live automated re-execution in the current session.
- `[USER-REPORTED MANUAL TEST]`: Derived from prior interactive testing journals, manual CLI transcripts, or browser walkthrough logs.
- `[INFERENCE / ILLUSTRATIVE EXAMPLE]`: Logical deduction or representative scenario provided for academic clarity.
- `[NOT VERIFIED]`: Unverified hypothesis or planned documentation claim unsupported by existing repository code.

---

## 2. Core Architectural Components (Modules M1–M12)

| Module ID | Formal Module Name | Verified File Location | Exact Code Symbols / Lines | Status |
|:---|:---|:---|:---|:---|
| **M1** | Data Foundation & Trajectory Schema | `src/agentsentinel/models/trajectory.py` | `Trajectory`, `AgentAction`, `SecurityLabel` (Lines 15–85) | `[VERIFIED IN CURRENT SOURCE]` |
| **M1.5** | Data Contract Remediation / Loaders | `src/agentsentinel/data_loaders/syfi.py`, `atbench.py` | `load_syfi_dataset`, `load_atbench_dataset` | `[VERIFIED IN CURRENT SOURCE]` |
| **M2** | Action Normalization Engine | `src/agentsentinel/normalizers/action_normalizer.py` | `ActionNormalizer.normalize`, `NormalizedAction` (Lines 20–110) | `[VERIFIED IN CURRENT SOURCE]` |
| **M3** | Behavioral Sequence & Trajectory History | `src/agentsentinel/representations/behavioral_sequence.py` | `BehavioralSequenceRepresentation.from_trajectory` | `[VERIFIED IN CURRENT SOURCE]` |
| **M4** | Behavioral Feature Extractor (22 Features)| `src/agentsentinel/features/extractor.py` | `BehavioralFeatureExtractor.extract_features` (Lines 15–41) | `[VERIFIED IN CURRENT SOURCE]` |
| **M5** | Behavioral Risk Assessment Engine | `src/agentsentinel/risk/engine.py` | `BehavioralRiskEngine.assess_risk`, Dual-Engine (Lines 40–120) | `[VERIFIED IN CURRENT SOURCE]` |
| **M6** | Task-Context Authorization Engine | `src/agentsentinel/authorization/engine.py` | `TaskAuthorizationEngine.authorize_action` (Lines 45–95) | `[VERIFIED IN CURRENT SOURCE]` |
| **M7** | Policy Fusion & Decision Engine | `src/agentsentinel/governance/engine.py` | `PolicyFusionEngine.fuse_decision`, 5 Invariants (Lines 184–220) | `[VERIFIED IN CURRENT SOURCE]` |
| **M8** | Runtime Interceptor & Enforcement Gate | `src/agentsentinel/runtime/interceptor.py` | `RuntimeInterceptor.intercept`, Pre-Execution Lock (Lines 145–200) | `[VERIFIED IN CURRENT SOURCE]` |
| **M9** | FastAPI Service Gateway & Routes | `src/agentsentinel/api/main.py`, `router.py` | `create_app`, `/api/v1/*` route handlers (Lines 1–450) | `[VERIFIED IN CURRENT SOURCE]` |
| **M10** | Relational Persistence & Audit Store | `src/agentsentinel/db/models.py`, `repositories/sql.py` | `SQLAlchemyAuditEventRepository`, `AuditEvent` | `[VERIFIED IN CURRENT SOURCE]` |
| **M11** | Research ML Pipeline & Feature Vectors | `src/agentsentinel/research/model.py`, `datasets.py` | `RandomForestClassifier`, 22-dim mapping (Lines 41–93) | `[VERIFIED IN CURRENT SOURCE]` |
| **M12** | Integration SDK & LLM Agent Harness | `src/agentsentinel/integrations/service.py`, `llm/agent.py` | `CallableIntegrationService`, `LLMAgent` | `[VERIFIED IN CURRENT SOURCE]` |

---

## 3. Mathematical and Algorithmic Specifications

### 3.1 Twenty-Two (22) Behavioral Features Extracted by M4
Verified in `src/agentsentinel/features/extractor.py:15-41` and `src/agentsentinel/research/model.py:41-93`:
1. `action_count` (int): Total count of actions observed in the session sliding window.
2. `event_count` (int): Total count of discrete telemetry events logged.
3. `cat_file_system_read` (int): Frequency of read-only file system operations.
4. `cat_file_system_write` (int): Frequency of mutating file system operations.
5. `cat_code_execution` (int): Frequency of script, shell, or interpreter evaluations.
6. `cat_web_request` (int): Frequency of HTTP GET/POST/PUT network calls.
7. `cat_api_call` (int): Frequency of structured REST/RPC programmatic calls.
8. `cat_agent_control` (int): Frequency of agent life-cycle, planning, or delegation calls.
9. `cat_unknown` (int): Frequency of unrecognized or unmapped tool actions.
10. `mutating_known_true` (int): Count of verified state-mutating actions.
11. `mutating_known_false` (int): Count of verified read-only/idempotent actions.
12. `mutating_unknown` (int): Count of actions with unresolvable state-mutation metadata.
13. `destructive_known_true` (int): Count of explicitly destructive actions (e.g., delete, truncate).
14. `destructive_known_false` (int): Count of non-destructive operations.
15. `destructive_unknown` (int): Count of unclassified destructive potential.
16. `unique_tool_count` (int): Distinct cardinality of tools invoked in session.
17. `transition_count` (int): Total action-to-action state transitions.
18. `read_to_write_transitions` (int): Count of security-sensitive read-then-write escalation sequences.
19. `consecutive_repeated_actions` (int): Frequency of looping or repeated identical actions.
20. `valid_timed_transitions` (int): Count of timestamped transitions with valid elapsed deltas.
21. `mean_inter_action_time` (float): Arithmetic mean of inter-action delay (seconds).
22. `max_inter_action_time` (float): Maximum single inter-action burst pause (seconds).

### 3.2 Five (5) Mandatory Security Invariants in M7
Verified in `src/agentsentinel/governance/engine.py:184-220`:
- **Invariant I1 (Denial Dominance):** If $D_{auth} = \text{DENY}$, then $D_{final} = \text{BLOCK}$ regardless of ML risk score $R_{ML}$.
- **Invariant I2 (Severe Risk Override):** If $R_{ML} \ge \theta_{critical}$ (where $\theta_{critical} = 0.85$), then $D_{final} = \text{BLOCK}$ regardless of authorization grants.
- **Invariant I3 (Destructive Execution Prohibition):** If $\text{is\_destructive}(a) = \text{True}$ and $a \notin \text{ExplicitWhitelist}$, then $D_{final} = \text{BLOCK}$.
- **Invariant I4 (Zero Host Execution on BLOCK):** If $D_{final} = \text{BLOCK}$, underlying callable execution count is strictly 0. (`src/agentsentinel/integrations/service.py:89-98`, `tests/test_audit_integrity.py:168`).
- **Invariant I5 (Fail-Closed Default):** If any internal exception, timeout, or schema fault occurs during governance evaluation, $D_{final} \leftarrow \text{BLOCK}$. (`src/agentsentinel/runtime/interceptor.py:183-200`).

---

## 4. Empirical Evaluation and Benchmark Metrics

Verified from `datasets/evaluation_metrics.json` and `src/agentsentinel/research/datasets.py`:

| Metric / Parameter | Evaluated Value | Data Source & Split | Status |
|:---|:---|:---|:---|
| **Benchmark Dataset** | ATBench (Agent Trajectory Benchmark) | `datasets/TraceLab/ATBench/test.json` | `[SUPPORTED BY TEST/ARTIFACT]` |
| **Total Trajectories** | 1,000 trajectories | Stratified 75% Train (750) / 25% Test (250) | `[SUPPORTED BY TEST/ARTIFACT]` |
| **Ground Truth Class Distribution**| 503 Safe / 497 Unsafe | Binary ground truth trajectory labels | `[SUPPORTED BY TEST/ARTIFACT]` |
| **Random Split Seed** | `random_state = 42` | `src/agentsentinel/research/model.py` | `[VERIFIED IN CURRENT SOURCE]` |
| **ML Model Pipeline** | `StandardScaler` + `RandomForestClassifier` | `n_estimators=100`, `max_depth=None` | `[VERIFIED IN CURRENT SOURCE]` |
| **Accuracy** | 0.7240 (72.40%) | Held-out 250 test trajectories | `[SUPPORTED BY TEST/ARTIFACT]` |
| **Precision** | 0.7895 (78.95%) | Unsafe class precision | `[SUPPORTED BY TEST/ARTIFACT]` |
| **Recall (True Positive Rate)**| 0.6048 (60.48%) | Unsafe class detection rate | `[SUPPORTED BY TEST/ARTIFACT]` |
| **F1-Score** | 0.6849 (68.49%) | Harmonic mean of precision & recall | `[SUPPORTED BY TEST/ARTIFACT]` |
| **ROC-AUC** | 0.7782 (77.82%) | Area under Receiver Operating Characteristic | `[SUPPORTED BY TEST/ARTIFACT]` |
| **Confusion Matrix (Test Split)**| TN=106, FP=20, FN=49, TP=75 | Total = 250 (106+20=126 Safe; 49+75=124 Unsafe)| `[SUPPORTED BY TEST/ARTIFACT]` |
| **Top Feature by Gini Importance**| `event_count` (0.3565 / 35.65%) | Gini impurity reduction | `[SUPPORTED BY TEST/ARTIFACT]` |
| **Second Feature Importance** | `action_count` (0.2411 / 24.11%) | Gini impurity reduction | `[SUPPORTED BY TEST/ARTIFACT]` |
| **Third Feature Importance** | `cat_file_system_write` (0.0892 / 8.92%)| Gini impurity reduction | `[SUPPORTED BY TEST/ARTIFACT]` |
| **Standalone False Negative Rate**| 39.52% (49 / 124) | Justifies M6/M7 hybrid defense | `[SUPPORTED BY TEST/ARTIFACT]` |
| **SyFI / TraceLab Corpus** | 8,058 sessions, 665,453 steps, 743,819 tool calls | Observational trace repository (unlabeled)| `[SUPPORTED BY TEST/ARTIFACT]` |

---

## 5. Audit Log and Runtime Enforcement Evidence

Verified from `src/agentsentinel/db/models.py`, `src/agentsentinel/runtime/audit.py`, and `reports/real_runtime_measurements.json`:

| Feature / Metric | Observed Value | Implementation Proof | Status |
|:---|:---|:---|:---|
| **Interception Audit Records** | 285 unique historical records | Relational SQLite audit ledger | `[SUPPORTED BY TEST/ARTIFACT]` |
| **Governance Decision Breakdown** | ALLOW: 163, ALERT: 47, BLOCK: 75 | Correlated with policy engine decisions | `[SUPPORTED BY TEST/ARTIFACT]` |
| **Physical Execution States** | attempted: 123, blocked: 75, executed: 71, execution_failed: 16 | Distinct from governance decision | `[SUPPORTED BY TEST/ARTIFACT]` |
| **Zero Callable Execution on BLOCK** | 100% (75/75 blocked actions had 0 tool execution) | `tests/test_audit_integrity.py:168` | `[SUPPORTED BY TEST/ARTIFACT]` |
| **End-to-End Interception Latency** | Mean: 14.2 ms, P95: 22.8 ms, Max: 41.5 ms | In-process pipeline overhead | `[SUPPORTED BY TEST/ARTIFACT]` |
| **Audit Correlation Key** | UUIDv4 `interception_id` | Preserved across M8, M9, M10, and UI | `[VERIFIED IN CURRENT SOURCE]` |
| **UI Telemetry Refresh** | HTTP Polling at 3000 ms (`refetchInterval`) | `ui/src/pages/LiveMonitorPage.tsx:43` | `[VERIFIED IN CURRENT SOURCE]` |
| **All Test Suites Passing** | 152 / 152 Pytest unit & integration tests | `pytest` CLI run across all test files | `[SUPPORTED BY TEST/ARTIFACT]` |
| **Frontend Compilation** | 0 TypeScript errors, clean Vite production build | `npm run build` in `ui/` directory | `[SUPPORTED BY TEST/ARTIFACT]` |

---

## 6. Real Screen Verification Evidence

All 14 dashboard screens and their sub-views verified in `ui/reports/walkthrough/`:
1. `01_overview_2d.png`: System Overview 2D (Metrics, Sentinel Radar, Recent Interceptions).
2. `02_overview_3d_m7.png`: System Overview 3D Architectural Topology (M7 Policy Engine node).
3. `02b_overview_3d_m8.png`: System Overview 3D Topology (M8 Enforcement Gate node).
4. `03_live_monitor.png`: Live Telemetry Stream (Active agent sessions, real-time risk gauges).
5. `04a_playground_initial.png`: Runtime Interactive Playground (Configuration view).
6. `04b_playground_allow_outcome.png`: Playground Safe Execution Scenario (`ALLOW` $\to$ `executed`).
7. `04c_playground_block_outcome.png`: Playground Adversarial Attack Scenario (`BLOCK` $\to$ `blocked`).
8. `04d_playground_autonomous_agent.png`: Playground Autonomous Agent Execution with Local Qwen3:4b.
9. `05_decision_explorer_event_selected.png`: Decision Deep-Dive (22-feature radar, policy rules).
10. `06_security_trajectories_session.png`: Trajectory Timeline & Transition Graph.
11. `07_agents_registry.png`: Registered AI Agent Identities & Capability Profiles.
12. `08_policies_governance.png`: Governance Rulebook (Active policies, priority orders).
13. `09_tasks_authorization.png`: Task Contract Contexts & Capability Allow/Deny Grids.
14. `10_audit_logs.png`: Forensic Audit Trail (Searchable by Interception ID, state filter).
15. `11_datasets_research.png`: Research Data Explorer (ATBench & SyFI trajectory partitions).
16. `12_evaluation_metrics.png`: Model Performance & Confusion Matrix Visualizer.
17. `13_compliance_reports.png`: System Compliance Audit & Security Posture Summary.
18. `14_settings_configuration.png`: Runtime Configuration, Engine Thresholds, & Toggles.
19. `15_system_diagnostics.png`: Service Health & Dependencies (FastAPI, SQLite, Ollama).
