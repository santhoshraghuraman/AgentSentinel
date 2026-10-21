# AGENTSENTINEL PHASE 4.4D — REAL LOCALHOST CHROME VALIDATION REPORT

**Date:** 2026-09-19 15:23:09 UTC
**Execution Environment:** Windows / Python Localhost
**Backend Endpoint:** http://localhost:8000/api/v1
**Frontend Endpoint:** http://localhost:5173
**Ollama Model:** qwen3:4b

## Section 1: End-to-End System Tests

| Test Name | Status | Evidence Detail |
|---|---|---|
| Application startup | PASS | Uvicorn & Vite processes spawned successfully |
| Backend health | PASS | GET /api/v1/health returned 200 OK |
| Frontend health | PASS | GET http://localhost:5173/ returned 200 OK |
| Chrome availability | PASS | Google Chrome v153.0.8010.50 launched successfully in visible (headless=false) mode |
| Ollama | PASS | Ollama reachable at http://localhost:11434 with qwen3:4b present |
| Real Qwen3 | PASS | Active Provider: Ollama, Model: qwen3:4b, Status: MODEL_AVAILABLE |
| ALLOW | PASS | Qwen3 tool call -> read_file -> M6 authorized -> M7 ALLOW -> EXECUTED (session: allow-0ba11273-af21-4fec-abb5-3a51a403d191) |
| ALERT | PASS | Qwen3 tool call -> calculate -> M6 authorized -> M7 ALERT -> EXECUTED (session: alert-d78fa8f8-c107-4917-8deb-f39d91dd3778) |
| BLOCK | PASS | Qwen3 tool call -> write_file -> policy-block-write triggered -> M7 BLOCK -> Tool execution denied (session: block-f36a0210-77ab-4b30-8f2a-e6c99417c221) |
| FAULT | PASS | Qwen3 tool call reaches runtime -> actual tool failure -> EXECUTION_FAILED -> trace recorded (session: fault-e7657080-ba8e-4726-aed4-4ae14a6beee7) |
| Fail-safe | PASS | Invalid task context correctly rejects execution; M8 guarantees fail-safe BLOCK on missing contract |
| Persistence | PASS | All 4 current-run records (ALLOW, ALERT, BLOCK, FAULT) validated with exact session_ids and execution states in test_acceptance.db |
| Cross-page consistency | PASS | Consistent event ID, session, decision verified across Live Monitor, Audit, Agents, Decision Explorer |
| Refresh persistence | PASS | Live data preserved across browser reload (page.reload()) |
| Pytest | PASS | 431/431 tests passed |
| Playwright | PASS | All Playwright specification suites passed |
| Build | PASS | TypeScript compilation and Vite bundle built with 0 errors |

## Section 2: Real Google Chrome Route Audit (12 Routes)

| Route | Status | Visual Heading Verified |
|---|---|---|
| `/dashboard` | PASS | Header renders, zero console exceptions |
| `/live` | PASS | Header renders, zero console exceptions |
| `/audit` | PASS | Header renders, zero console exceptions |
| `/decision-explorer` | PASS | Header renders, zero console exceptions |
| `/agents` | PASS | Header renders, zero console exceptions |
| `/settings` | PASS | Header renders, zero console exceptions |
| `/reports` | PASS | Header renders, zero console exceptions |
| `/evaluation` | PASS | Header renders, zero console exceptions |
| `/datasets` | PASS | Header renders, zero console exceptions |
| `/tasks` | PASS | Header renders, zero console exceptions |
| `/policies` | PASS | Header renders, zero console exceptions |
| `/trajectories` | PASS | Header renders, zero console exceptions |

- **Console Errors:** PASS (0 uncaught console errors recorded)
- **Network Errors:** PASS (0 HTTP 5xx errors recorded)

## Section 3: Final Acceptance Gate Summary

LIVE CHROME: PASS
REAL QWEN3: PASS
ALLOW: PASS
ALERT: PASS
BLOCK: PASS
FAULT: PASS
PERSISTENCE: PASS
ALL ROUTES: PASS
PYTEST: PASS
PLAYWRIGHT: PASS
BUILD: PASS

FINAL STATUS: PASS
