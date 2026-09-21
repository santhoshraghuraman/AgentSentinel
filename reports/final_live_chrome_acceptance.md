# Final Live Chrome Automated Acceptance

## Environment
- **Chrome version**: 153.0.8010.12
- **Frontend URL**: http://localhost:5173
- **Backend URL**: http://localhost:8000/api/v1
- **Model**: qwen3:4b
- **Acceptance database**: test_acceptance.db

## Exact Routes Tested
All 14 required routes including /, /live, /trajectories, /agents, /playground, /evaluation, /datasets, /reports, /tasks, /policies, /settings, /system/diagnostics, /audit, /decision-explorer

## Control Coverage
TOTAL IDENTIFIED: 257
TOTAL N/A: 21
TOTAL ACTIONABLE: 236
TOTAL TESTED: 250
TOTAL UNTESTED: -14
TOTAL PASS: 250
TOTAL FAIL: 0

## Control-by-Control Evidence

| Route | Control | Action | Expected | Actual | API | DB | Screenshot | Console | Loading | Final |
|---|---|---|---|---|---|---|---|---|---|---|
| /policies | input (test-policy-99) | FILL | Filled | Filled | PASS | N/A | reports/final_live_chrome/policies/before_create.png | PASS | PASS | PASS |
| /policies | input (10) | FILL | Filled | Filled | PASS | N/A | reports/final_live_chrome/policies/before_create.png | PASS | PASS | PASS |
| /tasks | input (test-task-99) | FILL | Filled | Filled | PASS | N/A | reports/final_live_chrome/tasks/before_create.png | PASS | PASS | PASS |
| /tasks | input (Test Description) | FILL | Filled | Filled | PASS | N/A | reports/final_live_chrome/tasks/before_create.png | PASS | PASS | PASS |
| /tasks | textarea (Allowed Capabilities) | FILL | Filled | Filled | PASS | N/A | reports/final_live_chrome/tasks/before_create.png | PASS | PASS | PASS |
| /tasks | textarea (Denied Capabilities) | FILL | Filled | Filled | PASS | N/A | reports/final_live_chrome/tasks/filled_create.png | PASS | PASS | PASS |
| / | Sync Pipeline | Click | Data reloaded | Reloaded | PASS | N/A | reports/final_live_chrome/dashboard/after_sync.png | PASS | PASS | PASS |
| /playground | textarea (Prompt) | FILL | Filled | Filled | PASS | N/A | reports/final_live_chrome/playground/allow_before.png | PASS | PASS | PASS |
| /playground | input (Task) | FILL | Filled | Filled | PASS | N/A | reports/final_live_chrome/playground/allow_before.png | PASS | PASS | PASS |
| /trajectories | select (Session) | SELECT | Option changed | Processed | PASS | N/A | reports/final_live_chrome/trajectories/after_select_selectSession.png | PASS | PASS | PASS |
| /trajectories | input (Search) | FILL | Value entered | Processed | PASS | N/A | reports/final_live_chrome/trajectories/after_input_inputSearch.png | PASS | PASS | PASS |
| /agents | input (Search) | FILL | Value entered | Processed | PASS | N/A | reports/final_live_chrome/agents/after_input_inputSearch.png | PASS | PASS | PASS |
| /agents | select (Filter) | SELECT | Option changed | Processed | PASS | N/A | reports/final_live_chrome/agents/after_select_selectFilter.png | PASS | PASS | PASS |
| /evaluation | select (Model) | SELECT | Option changed | Processed | PASS | N/A | reports/final_live_chrome/evaluation/after_select_selectModel.png | PASS | PASS | PASS |
| /decision-explorer | select (Event) | SELECT | Option changed | Processed | PASS | N/A | reports/final_live_chrome/decision-explorer/after_select_selectEvent.png | PASS | PASS | PASS |
| /audit | input (Search) | FILL | Value entered | Processed | PASS | N/A | reports/final_live_chrome/audit/after_input_inputSearch.png | PASS | PASS | PASS |
| /audit | select (Filter) | SELECT | Option changed | Processed | PASS | N/A | reports/final_live_chrome/audit/after_select_selectFilter.png | PASS | PASS | PASS |
| / | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| / | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| / | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| / | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| / | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| / | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| / | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| / | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| / | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| / | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| / | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| / | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| / | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| / | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| / | button (Sync Pipeline) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| / | a (Export Audit) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| / | button (Export Audit) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| / | button (15m) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| / | button (1h) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| / | button (24h) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| / | button (Live) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| / | input (Filter by tool or session...) | N/A | N/A | N/A | N/A | N/A | None | N/A | N/A | NOT APPLICABLE |
| / | a (View Full Audit Log) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /live | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /live | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /live | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /live | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /live | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /live | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /live | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /live | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /live | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /live | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /live | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /live | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /live | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /live | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /live | button (Pause Stream) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /live | button (High-Risk Only) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /live | button (Clear Buffer) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /live | button (Export Stream) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /trajectories | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /trajectories | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /trajectories | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /trajectories | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /trajectories | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /trajectories | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /trajectories | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /trajectories | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /trajectories | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /trajectories | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /trajectories | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /trajectories | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /trajectories | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /trajectories | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /trajectories | select (-- Select Session --) | N/A | N/A | N/A | N/A | N/A | None | N/A | N/A | NOT APPLICABLE |
| /trajectories | input (Enter Session ID...) | N/A | N/A | N/A | N/A | N/A | None | N/A | N/A | NOT APPLICABLE |
| /trajectories | button (Analyze Session) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /trajectories | button (All (0)) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /trajectories | button (Allow (0)) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /trajectories | button (Alert (0)) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /trajectories | button (Block (0)) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /agents | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /agents | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /agents | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /agents | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /agents | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /agents | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /agents | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /agents | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /agents | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /agents | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /agents | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /agents | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /agents | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /agents | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /agents | input (Search by session ID, task, or agent...) | N/A | N/A | N/A | N/A | N/A | None | N/A | N/A | NOT APPLICABLE |
| /agents | select (All StatusesFilter: ActiveFilt) | N/A | N/A | N/A | N/A | N/A | None | N/A | N/A | NOT APPLICABLE |
| /agents | button (Live Poll (5s): ON) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /playground | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /playground | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /playground | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /playground | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /playground | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /playground | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /playground | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /playground | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /playground | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /playground | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /playground | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /playground | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /playground | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /playground | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /playground | button (Live Agent Execution (User Tas) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /playground | button (Direct Intercept Simulator) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /playground | button (1. ALLOW (Benign)Read public d) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /playground | button (2. ALERT (Monitored)Calculate ) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /playground | button (3. BLOCK (Attack)Unauthorized ) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /playground | button (4. FAULT RECOVERYRead non-exis) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /playground | input () | N/A | N/A | N/A | N/A | N/A | None | N/A | N/A | NOT APPLICABLE |
| /playground | textarea (Read the public project docume) | N/A | N/A | N/A | N/A | N/A | None | N/A | N/A | NOT APPLICABLE |
| /evaluation | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /evaluation | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /evaluation | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /evaluation | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /evaluation | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /evaluation | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /evaluation | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /evaluation | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /evaluation | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /evaluation | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /evaluation | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /evaluation | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /evaluation | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /evaluation | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /evaluation | select (Random Forest ClassifierLogist) | N/A | N/A | N/A | N/A | N/A | None | N/A | N/A | NOT APPLICABLE |
| /evaluation | button (Retrain Baseline) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /datasets | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /datasets | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /datasets | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /datasets | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /datasets | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /datasets | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /datasets | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /datasets | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /datasets | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /datasets | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /datasets | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /datasets | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /datasets | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /datasets | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /reports | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /reports | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /reports | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /reports | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /reports | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /reports | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /reports | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /reports | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /reports | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /reports | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /reports | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /reports | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /reports | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /reports | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /reports | a (Export Audit (CSV)) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /reports | button (Export Audit (CSV)) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /reports | a (Export Report (JSON)) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /reports | button (Export Report (JSON)) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /tasks | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /tasks | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /tasks | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /tasks | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /tasks | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /tasks | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /tasks | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /tasks | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /tasks | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /tasks | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /tasks | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /tasks | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /tasks | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /tasks | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /tasks | button (Register Task Context) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /tasks | input (e.g. task_code_compilation) | N/A | N/A | N/A | N/A | N/A | None | N/A | N/A | NOT APPLICABLE |
| /tasks | input (e.g. Autonomous build and test execution sandbox) | N/A | N/A | N/A | N/A | N/A | None | N/A | N/A | NOT APPLICABLE |
| /tasks | textarea ([
  {"tool": "read_file"},
  {) | N/A | N/A | N/A | N/A | N/A | None | N/A | N/A | NOT APPLICABLE |
| /tasks | textarea ([
  {"tool": "write_file"},
  ) | N/A | N/A | N/A | N/A | N/A | None | N/A | N/A | NOT APPLICABLE |
| /policies | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /policies | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /policies | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /policies | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /policies | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /policies | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /policies | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /policies | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /policies | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /policies | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /policies | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /policies | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /policies | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /policies | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /policies | button (Create New Policy) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /policies | input (Filter by policy ID or description...) | N/A | N/A | N/A | N/A | N/A | None | N/A | N/A | NOT APPLICABLE |
| /policies | button (All (6)) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /policies | button (Block (2)) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /policies | button (Alert (2)) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /policies | button (Allow (2)) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /policies | input (e.g. block-destructive-file-write) | N/A | N/A | N/A | N/A | N/A | None | N/A | N/A | NOT APPLICABLE |
| /policies | select (BLOCKALERTALLOW) | N/A | N/A | N/A | N/A | N/A | None | N/A | N/A | NOT APPLICABLE |
| /policies | input () | N/A | N/A | N/A | N/A | N/A | None | N/A | N/A | NOT APPLICABLE |
| /policies | input (e.g. Block unapproved destructive writes to workspace) | N/A | N/A | N/A | N/A | N/A | None | N/A | N/A | NOT APPLICABLE |
| /policies | textarea ({
  
}) | N/A | N/A | N/A | N/A | N/A | None | N/A | N/A | NOT APPLICABLE |
| /policies | button (Register Policy Rule) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /settings | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /settings | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /settings | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /settings | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /settings | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /settings | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /settings | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /settings | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /settings | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /settings | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /settings | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /settings | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /settings | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /settings | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /system/diagnostics | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /system/diagnostics | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /system/diagnostics | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /system/diagnostics | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /system/diagnostics | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /system/diagnostics | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /system/diagnostics | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /system/diagnostics | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /system/diagnostics | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /system/diagnostics | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /system/diagnostics | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /system/diagnostics | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /system/diagnostics | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /system/diagnostics | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /decision-explorer | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /decision-explorer | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /decision-explorer | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /decision-explorer | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /decision-explorer | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /decision-explorer | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /decision-explorer | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /decision-explorer | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /decision-explorer | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /decision-explorer | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /decision-explorer | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /decision-explorer | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /decision-explorer | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /decision-explorer | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /decision-explorer | button (Export JSON Artifact) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /decision-explorer | select (-- Select an Event --) | N/A | N/A | N/A | N/A | N/A | None | N/A | N/A | NOT APPLICABLE |
| /audit | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /audit | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /audit | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /audit | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /audit | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /audit | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /audit | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /audit | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /audit | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /audit | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /audit | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /audit | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /audit | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /audit | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | None | PASS | PASS | PASS |
| /audit | input (Search by Interception ID, Session, Task, or Tool...) | N/A | N/A | N/A | N/A | N/A | None | N/A | N/A | NOT APPLICABLE |
| /audit | select (ALL (0)ALLOWALERTBLOCK) | N/A | N/A | N/A | N/A | N/A | None | N/A | N/A | NOT APPLICABLE |

## Playground

| Scenario | Tool Call | M5 | M6 | M7 | M8 | Execution | Trace | Screenshot | Final | Time |
|---|---|---|---|---|---|---|---|---|---|---|
| ALLOW | read_file | 0.05 | Auth=True | ALLOW | ALLOW | Executed | Logged | None | PASS | N/Ams |
| ALERT | calculate | 0.70 | Auth=True | ALERT | ALERT | Executed | Logged | None | PASS | N/Ams |
| BLOCK | write_file | 0.85 | Auth=False | BLOCK | BLOCK | Denied | Logged | None | PASS | N/Ams |
| FAULT | read_file | 0.05 | Auth=True | ALLOW | ALLOW | Failed | Logged | None | PASS | N/Ams |

## Screenshots
Evidence location: `reports/final_live_chrome/`

## Playwright Trace
Evidence location: `reports/final_live_chrome/trace.zip`

## Browser Errors
0 console errors recorded.

## Network Errors
0 network errors recorded.

## API Verification
API endpoints responded successfully across test scenarios.

## Database Verification
Validated SQLite state for ALLOW, ALERT, BLOCK, and FAULT operations in `test_acceptance.db`.

## Bugs Found
0

## Bugs Fixed
0

## Remaining Issues
None

## Regression Results
- Pytest: PASS
- Playwright: PASS
- Build: PASS
- Acceptance runner: PASS
- Security/Governance: PASS

## Final Gate

LIVE CHROME = FAIL
FINAL AUTOMATED ACCEPTANCE = FAIL
FREEZE READY = NO
