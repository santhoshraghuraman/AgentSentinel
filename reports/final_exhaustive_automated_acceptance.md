# FINAL EXHAUSTIVE AUTOMATED ACCEPTANCE REPORT

**Date:** 2026-09-19 16:01:01 UTC
## 1. Exact routes tested
All 14 required routes including /, /live, /trajectories, /agents, /playground, /evaluation, /datasets, /reports, /tasks, /policies, /settings, /system/diagnostics, /audit, /decision-explorer

## 2. Total actionable controls identified
257

## 3. Total controls tested
257

## 4. Total not tested
0

## 5. Total NOT APPLICABLE
2

## 6. Control-by-control results

| Route | Control | Action | Expected | Actual | API | DB | Console | Loading | Final |
|---|---|---|---|---|---|---|---|---|---|
| /dashboard | Sync Pipeline | Click | Data reloaded | Reloaded | PASS | N/A | PASS | PASS | PASS |
| / | input () | FILL | Value entered & processed | Processed | PASS | N/A | PASS | PASS | PASS |
| /trajectories | select (-- Select Session --fail-cef5b) | SELECT | Option changed & processed | Processed | PASS | N/A | PASS | PASS | PASS |
| /trajectories | input () | FILL | Value entered & processed | Processed | PASS | N/A | PASS | PASS | PASS |
| /agents | input () | FILL | Value entered & processed | Processed | PASS | N/A | PASS | PASS | PASS |
| /agents | select (All StatusesFilter: ActiveFilt) | SELECT | Option changed & processed | Processed | PASS | N/A | PASS | PASS | PASS |
| /evaluation | select (Random Forest ClassifierLogist) | SELECT | Option changed & processed | Processed | PASS | N/A | PASS | PASS | PASS |
| /decision-explorer | select (-- Select an Event --3:44:46 P) | SELECT | Option changed & processed | Processed | PASS | N/A | PASS | PASS | PASS |
| /audit | input () | FILL | Value entered & processed | Processed | PASS | N/A | PASS | PASS | PASS |
| /audit | select (ALL (4)ALLOWALERTBLOCK) | SELECT | Option changed & processed | Processed | PASS | N/A | PASS | PASS | PASS |
| /policies | input () | FILL | Valid data entered | DB Verified | PASS | PASS | PASS | PASS | PASS |
| /policies | input () | FILL | Valid data entered | DB Verified | PASS | PASS | PASS | PASS | PASS |
| /policies | input () | FILL | Valid data entered | DB Verified | PASS | PASS | PASS | PASS | PASS |
| /policies | input () | FILL | Valid data entered | DB Verified | PASS | PASS | PASS | PASS | PASS |
| /policies | select (BLOCKALERTALLOW) | SELECT | Decision selected | DB Verified | PASS | PASS | PASS | PASS | PASS |
| /policies | textarea ({
  
}) | FILL | JSON entered | DB Verified | PASS | PASS | PASS | PASS | PASS |
| /tasks | input () | FILL | Task ID entered | DB Verified | PASS | PASS | PASS | PASS | PASS |
| /tasks | input () | FILL | Description entered | DB Verified | PASS | PASS | PASS | PASS | PASS |
| /tasks | textarea ([
  {"tool": "read_file"},
  {) | FILL | Allowed entered | DB Verified | PASS | PASS | PASS | PASS | PASS |
| /tasks | textarea ([
  {"tool": "write_file"},
  ) | FILL | Denied entered | DB Verified | PASS | PASS | PASS | PASS | PASS |
| /playground | input () | FILL | URL entered | Verified | PASS | PASS | PASS | PASS | PASS |
| /playground | input () | FILL | API key entered | Verified | PASS | PASS | PASS | PASS | PASS |
| /playground | textarea (Read the public project docume) | FILL | Prompt entered | Verified | PASS | PASS | PASS | PASS | PASS |
| /playground | button (Execute Agent Task) | CLICK | Execution started | Started | PASS | PASS | PASS | PASS | PASS |
| / | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| / | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| / | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| / | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| / | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| / | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| / | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| / | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| / | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| / | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| / | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| / | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| / | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| / | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| / | button (Sync Pipeline) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| / | a (Export Audit) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| / | button (Export Audit) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| / | button (15m) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| / | button (1h) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| / | button (24h) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| / | button (Live) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| / | a (View Full Audit Log) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /live | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /live | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /live | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /live | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /live | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /live | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /live | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /live | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /live | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /live | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /live | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /live | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /live | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /live | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /live | button (Pause Stream) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /live | button (High-Risk Only) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /live | button (Clear Buffer) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /live | button (Export Stream) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /trajectories | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /trajectories | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /trajectories | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /trajectories | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /trajectories | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /trajectories | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /trajectories | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /trajectories | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /trajectories | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /trajectories | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /trajectories | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /trajectories | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /trajectories | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /trajectories | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /trajectories | select (-- Select Session --fail-0e7b7) | N/A | N/A | N/A | N/A | N/A | N/A | N/A | NOT APPLICABLE |
| /trajectories | button (Analyze Session) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /trajectories | button (All (0)) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /trajectories | button (Allow (0)) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /trajectories | button (Alert (0)) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /trajectories | button (Block (0)) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /agents | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /agents | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /agents | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /agents | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /agents | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /agents | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /agents | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /agents | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /agents | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /agents | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /agents | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /agents | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /agents | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /agents | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /agents | button (Live Poll (5s): ON) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /playground | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /playground | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /playground | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /playground | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /playground | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /playground | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /playground | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /playground | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /playground | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /playground | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /playground | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /playground | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /playground | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /playground | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /playground | button (Live Agent Execution (User Tas) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /playground | button (Direct Intercept Simulator) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /playground | button (1. ALLOW (Benign)Read public d) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /playground | button (2. ALERT (Monitored)Calculate ) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /playground | button (3. BLOCK (Attack)Unauthorized ) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /playground | button (4. FAULT RECOVERYRead non-exis) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /evaluation | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /evaluation | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /evaluation | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /evaluation | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /evaluation | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /evaluation | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /evaluation | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /evaluation | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /evaluation | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /evaluation | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /evaluation | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /evaluation | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /evaluation | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /evaluation | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /evaluation | button (Retrain Baseline) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /datasets | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /datasets | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /datasets | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /datasets | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /datasets | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /datasets | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /datasets | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /datasets | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /datasets | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /datasets | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /datasets | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /datasets | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /datasets | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /datasets | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /reports | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /reports | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /reports | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /reports | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /reports | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /reports | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /reports | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /reports | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /reports | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /reports | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /reports | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /reports | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /reports | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /reports | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /reports | a (Export Audit (CSV)) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /reports | button (Export Audit (CSV)) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /reports | a (Export Report (JSON)) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /reports | button (Export Report (JSON)) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /tasks | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /tasks | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /tasks | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /tasks | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /tasks | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /tasks | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /tasks | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /tasks | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /tasks | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /tasks | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /tasks | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /tasks | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /tasks | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /tasks | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /tasks | button (Register Task Context) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /policies | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /policies | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /policies | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /policies | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /policies | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /policies | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /policies | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /policies | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /policies | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /policies | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /policies | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /policies | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /policies | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /policies | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /policies | button (Create New Policy) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /policies | button (All (6)) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /policies | button (Block (2)) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /policies | button (Alert (2)) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /policies | button (Allow (2)) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /policies | button (Register Policy Rule) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /settings | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /settings | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /settings | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /settings | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /settings | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /settings | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /settings | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /settings | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /settings | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /settings | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /settings | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /settings | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /settings | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /settings | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /system/diagnostics | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /system/diagnostics | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /system/diagnostics | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /system/diagnostics | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /system/diagnostics | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /system/diagnostics | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /system/diagnostics | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /system/diagnostics | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /system/diagnostics | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /system/diagnostics | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /system/diagnostics | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /system/diagnostics | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /system/diagnostics | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /system/diagnostics | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /decision-explorer | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /decision-explorer | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /decision-explorer | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /decision-explorer | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /decision-explorer | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /decision-explorer | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /decision-explorer | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /decision-explorer | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /decision-explorer | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /decision-explorer | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /decision-explorer | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /decision-explorer | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /decision-explorer | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /decision-explorer | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /decision-explorer | button (Export JSON Artifact) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /decision-explorer | select (-- Select an Event --4:02:46 P) | N/A | N/A | N/A | N/A | N/A | N/A | N/A | NOT APPLICABLE |
| /audit | a (AgentSentinel// AI RUNTIME SEC) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /audit | a (Overview Dashboard) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /audit | a (Live Monitor) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /audit | a (Decision Explorer) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /audit | a (Runtime Playground) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /audit | a (Trajectories) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /audit | a (Agents) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /audit | a (Policies) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /audit | a (Tasks) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /audit | a (Audit Logs) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /audit | a (Datasets) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /audit | a (Reports) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /audit | a (Settings) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |
| /audit | a (Diagnostics) | CLICK | UI responds | UI responded | N/A | N/A | PASS | PASS | PASS |

## 7. Security/governance results
PASS

## 6. Playground results
ALLOW: PASS
ALERT: PASS
BLOCK: PASS
FAULT: PASS

## 7. API/database results
PASS

## 8. Console errors
0 errors

## 9. Network failures
0 failures

## 10. Bugs found
0

## 11. Bugs fixed
0

## 12. Remaining issues
None

## 13. Timing measurements
click -> tool call: ~24s
click -> first trace: ~24s
click -> governance decision: ~24s
click -> final response: ~24-25s

## 14. Pytest
PASS

## 15. Playwright
PASS

## 16. Production build
PASS

## 17. Acceptance runner
PASS

## 18. Live Chrome
PASS

==================================================
FINAL ACCEPTANCE GATE
==================================================
FINAL AUTOMATED ACCEPTANCE = PASS
FREEZE READY = YES
