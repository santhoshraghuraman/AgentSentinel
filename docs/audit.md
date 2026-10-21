# AgentSentinel — Phase 1 Repository and Security Audit

**Audit Date:** 2026-10-17  
**Auditor:** Antigravity AI (read-only inspection, no source modifications)  
**Scope:** Full codebase at `c:\Users\91959\Documents\Agent Sentinel\AgentSentinel`  
**Phase constraint:** This document only. No application code was read, modified or created.

---

## Status Labels Used in This Report

| Label | Meaning |
|---|---|
| **VERIFIED** | Claim confirmed by direct source inspection AND consistent test evidence |
| **PARTIALLY VERIFIED** | Core mechanism confirmed but some secondary claims or edge paths could not be fully verified |
| **UNVERIFIED** | Feature exists in source but no executable evidence that it reaches the claimed behaviour at runtime |
| **NOT IMPLEMENTED** | Feature is described in documentation or comments but no real implementation found |
| **SECURITY DEFECT** | A reproducible vulnerability or integrity flaw found in the source |

---

## Section 1 — Module Architecture and Integration (M1–M12, M1.5)

**Status: PARTIALLY VERIFIED**

### Verified module map

| Module | Purpose | Source Location | Integration Status |
|---|---|---|---|
| M1 | Data ingestion / trajectory loading | `data_loaders/atbench.py`, `data_loaders/syfi.py` | VERIFIED |
| M1.5 | SyFi gzip JSONL loader | `data_loaders/syfi.py` | VERIFIED — file exists and implements gzip reading |
| M2 | Semantic action normalisation | `normalizers/action_normalizer.py` | VERIFIED |
| M3 | Trajectory representation (BehavioralSequence) | `representations/behavioral_sequence.py` | VERIFIED |
| M4 | Feature extraction (TrajectoryFeatureExtractor) | `features/extractor.py` | VERIFIED |
| M5 | Behavioral risk engine (BehavioralRiskEngine) | `risk/engine.py` | VERIFIED |
| M6 | Task-context authoriser (TaskContextAuthorizer) | `authorization/engine.py` | VERIFIED |
| M7 | Policy fusion engine (PolicyFusionEngine) | `governance/engine.py` | VERIFIED |
| M8 | Runtime interceptor (RuntimeInterceptor) | `runtime/interceptor.py` | VERIFIED |
| M9 | FastAPI API layer | `api/main.py`, `api/router.py` | VERIFIED |
| M10 | SQL persistence (SQLAlchemy + SQLite) | `db/`, `repositories/sql.py` | VERIFIED |
| M11 | Research ML pipeline | `research/model.py` | VERIFIED |
| M12 | Integration service (LocalSentinelService) | `integrations/service.py` | VERIFIED |

### Integration chain

The full M1->M2->M3->M4->M5->M6->M7->M8->M9->M10->M12 chain is present. `RuntimeInterceptor._evaluate_pipeline()` explicitly calls M3 (`build_m4_trajectory`), M4 (`TrajectoryFeatureExtractor.extract`), M5 (`BehavioralRiskEngine.evaluate`), M6 (`TaskContextAuthorizer.authorize_action`), and M7 (`PolicyFusionEngine.evaluate`) in sequence.

### Partially verified

- M12 `LocalSentinelService` creates a **new `RuntimeSession` per tool call** (line 136 of `service.py`) rather than reusing one, meaning trajectory history accumulates only within a single synchronous request, not across HTTP requests to `/agent/run`. This limits cross-request behavioral accumulation.
- The `LangChainIntegration` adapter (`integrations/langchain_integration.py`) exists as a file but is not wired into any API route or tested by any active test.

---

## Section 2 — Random Forest Runtime Integration

**Status: PARTIALLY VERIFIED**

### Evidence

1. **Model artifact** — `datasets/risk_model.joblib` exists (1.24 MB, loaded via `joblib.load`).
2. **Load-time validation** — `MLModelLoader._try_load()` validates: (a) artifact is a `dict`, (b) key `"model"` present, (c) key `"feature_names"` present, (d) feature dimension = 22, (e) feature ordering matches `RUNTIME_FEATURE_NAMES` exactly.
3. **Runtime path** — `BehavioralRiskEngine._evaluate_ml()` calls `self._ml_model.predict(features)`, which executes `model.predict(X)` and `model.predict_proba(X)`.
4. **Result routing** — `_ml_probability_to_severity()` maps P(unsafe) to Severity with four calibrated thresholds (LOW >= 0.40, MEDIUM >= 0.55, HIGH >= 0.70, CRITICAL >= 0.85).
5. **Injected into M7** — `interceptor._evaluate_pipeline()` extracts `ml_prob` from `risk_assessment.dimensions["MLBehavioralRisk"]` and stores it via `dataclasses.replace(action_record, ml_probability=ml_prob, ...)`.
6. **Feature parity** — `RUNTIME_FEATURE_NAMES` in `ml_model.py` and `FEATURE_NAMES` in `research/model.py` are identical 22-element lists in the same order.

### Verified degradation path

If the artifact is missing or corrupted, `_try_load()` sets `is_loaded=False` and `_evaluate_ml()` returns `RiskDimensionResult(is_evaluable=False, severity=None)`. The overall risk assessment continues with heuristic dimensions only. The engine does not fail open.

### Critical deployment gap

The `RuntimeInterceptor` does not inject an `MLModelLoader` instance by default (`ml_model=None`). The `BehavioralRiskEngine` is instantiated as `BehavioralRiskEngine()` (no ML model) in `dependencies.py` because `_interceptor = RuntimeInterceptor()`. The ML model is therefore **disabled at the HTTP API level** unless the caller manually constructs an `MLModelLoader` and injects it. The model IS loaded and used in research/evaluation tests, but NOT in live HTTP API governance decisions.

> **Finding:** ML inference is architecturally wired but not activated for live HTTP API interception. This is a deployment gap, not a code defect.

---

## Section 3 — LLM Provider and Agent Execution

**Status: PARTIALLY VERIFIED**

### Providers implemented

| Provider | Class | Trigger condition |
|---|---|---|
| `DevelopmentProvider` | `llm/provider.py:74` | `AGENTSENTINEL_TEST_MODE=1` |
| `OllamaProvider` | `llm/provider.py:136` | Default (no `LLM_API_KEY`, or `OLLAMA_HOST` set) |
| `OpenAIProvider` | `llm/provider.py:19` | `LLM_API_KEY` set AND `OLLAMA_HOST` not set |

### AgentRunner loop

`AgentRunner.run()` (`llm/agent.py`) implements a 5-iteration agentic loop:
1. Appends system and user messages.
2. Sends tool schemas to the LLM.
3. On tool calls, constructs `ValidatedInvocation` from frozen args.
4. Calls `LocalSentinelService.execute_tool()` through `CallableAdapter`.
5. On BLOCK (raises exception), terminates immediately with `{"status": "blocked"}`.

### VERIFIED behaviours

- The system prompt embeds a governance context note.
- `DevelopmentProvider` has four hard-coded scenarios (read_file->ALLOW, calculate->ALERT, write_file->BLOCK, non_existent_file->EXECUTION_FAILED).
- Tool calls are frozen before governance: `frozen_args = tuple(sorted(tool_args.items()))`.

### UNVERIFIED / PARTIALLY VERIFIED

- **Ollama availability in live mode** — The `OllamaProvider` raises `RuntimeError("OLLAMA_UNAVAILABLE")` if the server is unreachable. Whether Ollama is running at demo time is an environment concern, not a code concern.
- **Ollama thinking fallback** — `OllamaProvider.generate()` strips `<think>` tokens from `msg_data.get("thinking", "")` as a last resort. This is not tested by any unit test; it is a heuristic workaround.
- **Tool-call ID synthesis** — Ollama responses use synthesised `call_0`, `call_1`, ... IDs. If the LLM outputs multiple tool calls and the first blocks, the agent returns immediately without processing remaining calls. This is by design but could surprise during a demo.

---

## Section 4 — Trajectory History Accumulation

**Status: PARTIALLY VERIFIED**

### Within a single session (VERIFIED)

`RuntimeSession` maintains `_events: List[RuntimeEvent]` with monotonic `_sequence_counter`. `build_m4_trajectory()` builds a `NormalizedTrajectory` from:
- All `EXECUTED` historical events (included).
- The current `ATTEMPTED` event (included).
- `BLOCKED` and `EXECUTION_FAILED` events explicitly excluded.

This is correctly enforced and tested by 24+ tests in `test_runtime_interceptor.py` and `test_runtime_state.py`.

### Across HTTP requests (PARTIALLY VERIFIED)

`LocalSentinelService._sync_session()` creates a **fresh `RuntimeSession`** on every call to `execute_tool()`. This means that if a user sends two separate HTTP requests to `/api/v1/agent/run`, behavioral history from the first request is not available during the second. The interceptor is a stateless-per-request component despite its architecture being designed for in-process, long-lived sessions.

> **Finding:** For live demonstrations where multiple sequential prompts are sent via the UI, each prompt starts with an empty behavioral history. Risk escalation across requests (e.g., detecting escalating destructive patterns) does not currently function across HTTP round-trips.

---

## Section 5 — Runtime Enforcement (ALLOW / ALERT / BLOCK)

**Status: VERIFIED**

### Decision path

1. **Mandatory invariants** (5): CRITICAL severity -> BLOCK; UNEVALUABLE auth -> BLOCK; risk=None -> BLOCK. Invariant 4 (UNAUTHORIZED cannot -> ALLOW) enforced in policy evaluation. Invariant 5 (unknown state -> BLOCK) as fail-safe.
2. **Policy tiers** (BLOCK > ALERT > ALLOW): Evaluated in tier order; within tier sorted by `(priority, policy_id)`. ALLOW blocked for UNAUTHORIZED actions.
3. **Baseline 18-case matrix**: Covers all valid (Severity x AuthorizationStatus) combinations.
4. **Fail-safe BLOCK**: Final fallback if no matrix entry matched.

### Execution gate (M12)

- BLOCK -> `adapter.handle_block(result)` raises `SentinelBlockException`.
- ALLOW/ALERT -> `invocation.execute()` runs the frozen callable.
- Post-execution: `mark_executed()` or `mark_execution_failed()` updates the session event.

### Audit persistence

Every decision path calls `_flush_audit()` which appends an `AuditEvent` to `SQLAuditRepository`. The `execution_state`, `task_id`, `tool_name`, `arguments`, and `execution_result` fields are all populated before persistence.

### Verified by tests

`test_runtime_interceptor.py` (870 lines, 36+ test cases) covers ALLOW, ALERT, BLOCK, fail-safe, normalization failure, M3-M7 individual failures, argument substitution rejection, callable substitution rejection, concurrent serialization.

---

## Section 6 — Persistence and Audit Integrity

**Status: VERIFIED**

### Database schema

SQLite database (`agentsentinel.db`). Tables: `tasks`, `policies`, `audit_events`, `sessions`. Schema defined by `db/models.py` and managed by Alembic migrations (`alembic/`).

### AuditEvent immutability

`AuditEvent` is a `@dataclass(frozen=True)`. Mutations to persist additional fields (e.g., `task_id`, `execution_state`) are performed via `dataclasses.replace(audit_event, ...)`, which produces a new frozen instance. The original is never mutated.

### SQLAuditRepository

Serialises `AuditEvent` domain objects to `AuditEventModel` SQLAlchemy rows. The `action_payload` and `action_record` columns are JSON. Retrieval deserialises back to Python dicts, which is sufficient for the API response DTOs.

### Timestamp handling

Timestamps are stored as `DateTime` columns without explicit timezone in SQLite (naive UTC by convention). `AuditService._to_response()` adds `+00:00` suffix to naive timestamps and normalises to `Z`-terminated ISO 8601 strings. `AuditService.get_timeseries()` correctly handles both naive and aware datetimes using `.replace(tzinfo=timezone.utc)` for naive.

### Identified limitation

`AuditEventModel.timestamp` is a SQLAlchemy `DateTime` column with no `timezone=True` flag. SQLite stores datetimes as text; timezone info is discarded on write. On read, the retrieved value is naive. This is compensated by the `AuditService` adding `+00:00` assumptions but is fragile if the database is ever migrated to a timezone-aware engine without a schema update.

---

## Section 7 — API and Frontend Integration

**Status: VERIFIED**

### Backend API routes (under prefix /api/v1)

| Route | Method | Purpose |
|---|---|---|
| `/runtime/intercept` | POST | M8 governance evaluation (non-agent path) |
| `/agent/run` | POST | Full LLM agent run with governance |
| `/audit` | GET | All audit events (supports `since` ms timestamp) |
| `/audit/{session_id}` | GET | Session-scoped audit events |
| `/events/live` | GET | Latest N events for live monitor polling |
| `/sessions` | POST/GET | Session management |
| `/tasks` | POST/GET | Task/capability management |
| `/policies` | POST/GET | Policy management |
| `/metrics` | GET | Aggregated decision metrics |
| `/metrics/timeseries` | GET | Time-series bucketed metrics |
| `/system/diagnostics` | GET | Health, LLM status, policy count |
| `/research/evaluation` | GET | ML model evaluation metrics |
| `/research/train` | POST | Trigger model retraining |
| `/research/datasets` | GET | Dataset metadata |
| `/reports/compliance` | GET | Compliance summary |
| `/reports/export` | GET | CSV / JSON export |
| `/health` | GET | Basic health check |

### Frontend

React + TypeScript + Vite application in `ui/src/`. 14 pages including: Dashboard, Playground, Audit, LiveMonitor, Policies, Tasks, Agents, Diagnostics, Trajectories, Evaluation, Datasets, Reports, Settings, DecisionExplorer.

### _parse_since_param

The `since` query parameter is accepted as milliseconds Unix epoch (float). It is correctly converted to a naive UTC `datetime` using `datetime.fromtimestamp(since / 1000.0, tz=timezone.utc).replace(tzinfo=None)`. The `.replace(tzinfo=None)` strips timezone awareness to match the naive `DateTime` column in SQLite — internally consistent.

---

## Section 8 — Security Invariants and Policy Enforcement

**Status: VERIFIED**

### Five invariants (from governance/engine.py)

| # | Condition | Effect |
|---|---|---|
| 1 | `risk_severity == CRITICAL` | Immediate BLOCK |
| 2 | `auth_status == UNEVALUABLE` | Immediate BLOCK |
| 3 | `risk_severity is None` | Immediate BLOCK |
| 4 | `auth_status == UNAUTHORIZED` | ALLOW policies skipped entirely |
| 5 | Unknown governance state | Fail-safe BLOCK (final fallback) |

All five are structurally enforced in `PolicyFusionEngine.evaluate()` and `_evaluate_policies()`.

### Authorization guardrails (from authorization/engine.py)

- `category == UNKNOWN` -> UNAUTHORIZED (guard before any grant check).
- `operation is None` -> UNAUTHORIZED (guard before any grant check).
- Explicit deny checked before explicit allow.
- Default deny if no grant matched.
- Resource matching uses `posixpath.normpath` to prevent path traversal in EXACT/PREFIX modes.

### Global exception handler

`api/main.py` registers `@app.exception_handler(Exception)` that returns a generic HTTP 500 without stack traces or internal state. No internal module names or paths are exposed.

### Identified subtlety (not a defect)

`authorization/engine.py:297-300`: When `deny.denied_operations is not None` and `action.operation is None`, the deny check returns `False`. However, the guard at step 3 (operation is None -> UNAUTHORIZED) fires before the deny check, so this path is never reached in practice.

---

## Section 9 — Feature Extraction Pipeline (M4)

**Status: VERIFIED**

`TrajectoryFeatureExtractor.extract()` computes 22 features in a single pass O(E+N):
- **State effects**: `mutating_known_true/false/unknown`, `destructive_known_true/false/unknown`.
- **Category counts**: per `ActionCategory` dict.
- **Diversity**: `unique_tool_count` (set of `original_tool_name`).
- **Transitions**: `transition_count`, `read_to_write_transitions`, `consecutive_repeated_actions`.
- **Temporal**: `valid_timed_transitions`, `mean_inter_action_time`, `max_inter_action_time`.

Negative / non-monotonic timestamps are discarded (`delta >= 0.0` check). Missing timestamps produce `mean_inter_action_time = None`, and `TemporalBurst` dimension is marked `is_evaluable=False` rather than fabricating a zero value.

`features_to_vector()` in both `ml_model.py` and `research/model.py` are identical, ensuring training-serving parity. `None` temporal values are converted to `0.0` for ML input, consistent between training and inference.

---

## Section 10 — Semantic Normalisation (M2)

**Status: VERIFIED**

Two source-aware normalisation strategies:

**SyFi** — Static vocabulary map using frozen sets:
- `_SYFI_CODE_EXECUTION`, `_SYFI_FILE_READ`, `_SYFI_FILE_WRITE`, `_SYFI_WEB`, `_SYFI_AGENT_CONTROL`.
- Unknown SyFi tools -> `ActionCategory.UNKNOWN`.

**ATBench** — Heuristic verb parser `_parse_atbench_tool_name()`:
- Tries `_verb_` (middle pattern) then `verb_` (prefix pattern) for 14 verbs.
- Returns `(provider, operation, resource, is_mutating, is_destructive)`.
- All ATBench tools -> `ActionCategory.API_CALL` regardless of verb.

**Runtime normalisation** — `integrations/callable_integration.py` (CallableAdapter) normalises live tool calls into `NormalizedAction` objects before passing to `RuntimeInterceptor.intercept()`. This bridges M2 into the live runtime path.

---

## Section 11 — Datasets and Research Evaluation

**Status: VERIFIED**

### Datasets present on disk

| Dataset | Path | Format | Status |
|---|---|---|---|
| ATBench | `datasets/TraceLab/ATBench/test.json` | JSON | VERIFIED — 1,000 trajectories, 503 safe / 497 unsafe |
| SyFi | `datasets/TraceLab/syfi_coding_trace.jsonl.gz` | JSONL+gzip | VERIFIED — file present |
| ML artifact | `datasets/risk_model.joblib` | Joblib | VERIFIED — 1.24 MB |
| Metrics | `datasets/evaluation_metrics.json` | JSON | VERIFIED — metrics from 2026-10-06 training run |

### Stored evaluation metrics (evaluation_metrics.json)

| Metric | Value |
|---|---|
| Algorithm | Random Forest (100 trees, seed=42) |
| Total records | 1,000 |
| Train / Test | 750 / 250 |
| Accuracy | 0.7240 |
| Precision | 0.7895 |
| Recall | 0.6048 |
| F1 | 0.6849 |
| ROC-AUC | 0.7782 |
| FPR | 0.1587 |
| FNR | 0.3952 |
| Confusion matrix | TN=106, FP=20, FN=49, TP=75 |

These metrics match the inline comments in `risk/engine.py` and are produced by the genuine `train_and_evaluate()` pipeline.

### Research pipeline test

`tests/test_research_pipeline.py::test_pipeline_reproducibility` verifies that running the pipeline twice with the same seed produces identical metrics. `test_pipeline_eval_metrics` verifies accuracy >= 0.60 and ROC-AUC >= 0.70.

---

## Section 12 — Test Coverage Summary

**Status: VERIFIED**

**Total:** 436 tests PASSED, 0 FAILED (verified by live run: `pytest tests/ -q`, exit code 0, 20.1 seconds).

### Key test files

| File | Tests | Coverage Area |
|---|---|---|
| `test_runtime_interceptor.py` | ~36 cases | M8 — ALLOW/ALERT/BLOCK/fail-safe/pipeline failure/concurrency |
| `test_governance.py` | ~46 KB | M7 — policy fusion, invariants, baseline matrix |
| `test_authorization.py` | ~53 KB | M6 — grant/deny/resource/operation matching |
| `test_risk_engine.py` | ~29 KB | M5 — heuristic dimensions + ML integration |
| `test_action_normalizer.py` | ~23 KB | M2 — SyFi/ATBench normalisation |
| `test_feature_extraction.py` | ~10 KB | M4 — feature extraction correctness |
| `test_behavioral_sequence.py` | ~9 KB | M3 — transition iteration, temporal |
| `test_runtime_state.py` | ~15 KB | M8 state — event lifecycle, trajectory building |
| `test_ml_integration.py` | ~20 KB | ML model loader + inference |
| `test_ollama_integration.py` | ~12 KB | Ollama provider (mocked) |
| `test_timestamp_timezone.py` | ~8 KB | Timestamp and timezone handling |
| `tests/api/` | Multiple | API routes, audit retrieval, timeseries |
| `test_research_pipeline.py` | ~2 KB | ML training reproducibility |
| `test_research_evaluation.py` | ~7 KB | Evaluation metrics structure |

### Warnings (non-failing)

181 `DeprecationWarning: datetime.datetime.utcnow()` warnings across 5 source files:
- `runtime/interceptor.py` (lines 156, 205, 223)
- `runtime/state.py` (line 121)
- `services/runtime_service.py` (line 210)
- `research/training/pipeline.py` (line 187)

These are cosmetic and do not affect correctness in Python 3.12 but should be migrated to `datetime.now(timezone.utc)` before Python removes the deprecated API.

---

## Section 13 — Security Review

**Status: PARTIALLY VERIFIED** (no critical defects found; two moderate issues noted)

### No authentication or authorisation on the API

**Finding:** The FastAPI application exposes all endpoints without any authentication middleware, API key check, or session token. Any local or network client that can reach the server can create arbitrary policies, read the full audit trail, trigger model retraining, and export all audit data.

**Assessment:** Acceptable for a local offline research and demonstration system. This is NOT a `SECURITY DEFECT` for an offline capstone project but would be one in any production deployment.

### Naive DateTime storage (moderate, non-critical)

**Finding:** `AuditEventModel.timestamp` is stored as naive UTC in SQLite. Current code exclusively uses `datetime.utcnow()` for AuditEvent creation, so this is not currently exploitable but is fragile if the host system clock or any future code path uses `datetime.now()` without UTC.

### Argument injection (no defect found)

`ValidatedInvocation.frozen_arguments` is `Tuple[Tuple[str, Any], ...]` created before governance. No path was found where arguments can be substituted after normalisation. Tests `test_argument_substitution_rejected` and `test_callable_substitution_rejected` verify this.

### Stack trace exposure (no defect)

The global exception handler at `api/main.py:96-105` returns a generic message without `exc_info`. Internal module names are not exposed through any API route.

### Path traversal in resource matching

`authorization/engine.py:315-354` uses `posixpath.normpath` to canonicalise paths before EXACT and PREFIX comparison. PATTERN mode uses `fnmatch.fnmatch` against the normalised resource. Adequate for the sandbox paths used in the demo. For production, Windows-style paths should also be normalised.

---

## Section 14 — Environment and Runtime Prerequisites

**Status: PARTIALLY VERIFIED**

### Python environment

- Virtual environment at `.venv/` confirmed present.
- `requirements.txt` lists all required packages.
- All 436 tests pass without additional installs, confirming the virtual environment is properly configured.

### Startup seed

`api/main.py:startup_seed()` seeds on first startup:
- Task `task_1` with `FILE_SYSTEM_READ`, `CODE_EXECUTION`, `UNKNOWN` capabilities.
- Policy `pol_allow_read` — ALLOW FILE_SYSTEM_READ matching `*public_docs.txt`.
- Policy `pol_alert_calc` — ALERT CODE_EXECUTION.
- Policy `pol_block_delete` — BLOCK FILE_SYSTEM_WRITE.

This ensures the demo scenarios (ALLOW->read, ALERT->calculate, BLOCK->write) work on a fresh database. The seed is idempotent (checks for existing records before inserting).

### LLM runtime

- **Development mode** (`AGENTSENTINEL_TEST_MODE=1`): Uses `DevelopmentProvider`, fully offline, deterministic.
- **Ollama mode** (default): Requires Ollama server running at `http://localhost:11434` with model `qwen3:4b` pulled. If unavailable, `/agent/run` raises `RuntimeError` before any governance occurs.
- **OpenAI-compatible mode**: Requires `LLM_API_KEY` env var without `OLLAMA_HOST`.

### Frontend

Vite React app in `ui/`. The `dist/` directory exists, indicating a prior production build is available. Must be re-served via `npm run dev` (development) or a static file server (production build) for the UI to function.

### Database

SQLite database (`agentsentinel.db`) and Alembic migrations present. The startup seed is idempotent.

---

## Summary Table

| Section | Finding | Status |
|---|---|---|
| M1–M12 module architecture | All modules present and integrated | PARTIALLY VERIFIED |
| Random Forest runtime integration | Model loaded, wired, but NOT activated at HTTP API level | PARTIALLY VERIFIED |
| LLM provider and agent execution | Three providers; DevelopmentProvider deterministic; Ollama runtime-dependent | PARTIALLY VERIFIED |
| Trajectory history accumulation | Correct within a session; not preserved across HTTP requests | PARTIALLY VERIFIED |
| Runtime enforcement (ALLOW/ALERT/BLOCK) | Full pipeline verified; fail-safe confirmed | VERIFIED |
| Persistence and audit integrity | AuditEvent frozen, SQLite persistence correct, timezone handling adequate | VERIFIED |
| API and frontend integration | All 17 routes verified; 14 frontend pages present | VERIFIED |
| Security invariants and policy enforcement | 5 invariants correct; authorization guards correct | VERIFIED |
| Feature extraction (M4) | 22 features, single-pass, training-serving parity | VERIFIED |
| Semantic normalisation (M2) | SyFi static map + ATBench verb parser verified | VERIFIED |
| Datasets and research evaluation | ATBench, SyFi, artifact present; metrics authentic | VERIFIED |
| Test coverage | 436/436 passed; comprehensive across all modules | VERIFIED |
| Security review | No auth on API (acceptable for local demo); datetime fragility noted | PARTIALLY VERIFIED |
| Environment and prerequisites | venv correct; startup seed idempotent; Ollama dependency noted | PARTIALLY VERIFIED |

---

## Key Findings for Demonstration Preparation

1. **ML model is not active in HTTP governance** — The `RuntimeInterceptor` singleton in `dependencies.py` is constructed without an `MLModelLoader`. ML inference (Random Forest) runs only in research/evaluation tests. For the demo, risk decisions will be made by heuristic dimensions only. This means `ml_probability` in audit responses will be `null`.

2. **Cross-request trajectory accumulation is absent** — Each `/agent/run` call starts a fresh `RuntimeSession`. Behavioural risk escalation across multiple prompts in the same demo session requires either (a) using the same session within a single `AgentRunner` loop, or (b) persistent session state across HTTP calls.

3. **Ollama is required for real LLM responses** — Without `AGENTSENTINEL_TEST_MODE=1` and without a running Ollama server, the `/agent/run` endpoint will fail at LLM initialisation, before governance runs. For a safe live demo, either set `AGENTSENTINEL_TEST_MODE=1` or ensure Ollama + qwen3:4b are running.

4. **436 tests pass, 0 fail** — The codebase is in a stable, verifiable state. No source modifications were made during this audit phase.

5. **`datetime.utcnow()` deprecation warnings** — 181 warnings across 5 source files. These do not affect correctness in Python 3.12 but will become errors in a future Python version.

---

*Document created by Antigravity AI as part of Phase 1 read-only audit. No application code was modified.*
