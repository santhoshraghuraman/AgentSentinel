# AGENTSENTINEL LOCAL ACCEPTANCE REPORT

**Timestamp:** 2026-09-19 15:23:09 UTC
**Environment:** Windows / Python Localhost
**Backend URL:** http://localhost:8000/api/v1
**Frontend URL:** http://localhost:5173
**Ollama Model:** qwen3:4b

| TEST | PASS/FAIL | EVIDENCE |
|---|---|---|
| Backend startup | PASS | Validated |
| Frontend startup | PASS | Validated |
| Health | PASS | Validated |
| API | PASS | Validated |
| Real Qwen3 | PASS | Active Provider: Ollama, Model: qwen3:4b, Status: MODEL_AVAILABLE |
| ALLOW | PASS | Qwen3 tool call -> read_file -> M6 authorized -> M7 ALLOW -> EXECUTED (session: allow-0ba11273-af21-4fec-abb5-3a51a403d191) |
| ALERT | PASS | Qwen3 tool call -> calculate -> M6 authorized -> M7 ALERT -> EXECUTED (session: alert-d78fa8f8-c107-4917-8deb-f39d91dd3778) |
| BLOCK | PASS | Qwen3 tool call -> write_file -> policy-block-write triggered -> M7 BLOCK -> Tool execution denied (session: block-f36a0210-77ab-4b30-8f2a-e6c99417c221) |
| FAULT | PASS | Qwen3 tool call reaches runtime -> actual tool failure -> EXECUTION_FAILED -> trace recorded (session: fault-e7657080-ba8e-4726-aed4-4ae14a6beee7) |
| Fail-safe | PASS | Invalid task context correctly rejects execution; M8 guarantees fail-safe BLOCK on missing contract |
| Persistence ALLOW | PASS | DB row verified: session=allow-0ba11273-af21-4fec-abb5-3a51a403d191, interception=b7c215f9-726a-4b7f-bbe5-b4b5eefea413, decision=allow, state=executed |
| Persistence ALERT | PASS | DB row verified: session=alert-d78fa8f8-c107-4917-8deb-f39d91dd3778, interception=8812132f-07a8-4ba1-9202-9dd1947d0292, decision=alert, state=executed |
| Persistence BLOCK | PASS | DB row verified: session=block-f36a0210-77ab-4b30-8f2a-e6c99417c221, interception=a432d45c-1d0c-4e19-bdbf-89b8d0f03fc1, decision=block, state=blocked |
| Persistence FAULT | PASS | DB row verified: session=fault-e7657080-ba8e-4726-aed4-4ae14a6beee7, interception=1bbbec07-76b6-4238-8a1e-6258590c206c, decision=allow, state=execution_failed |
| All routes | PASS | 12/12 routes rendered with visible headers and valid layout |
| Console errors | PASS | 0 uncaught console errors recorded |
| Network errors | PASS | 0 HTTP 5xx errors recorded |
| Pytest | PASS | 431/431 tests passed |
| Playwright | PASS | All Playwright specification suites passed |
| Build | PASS | TypeScript compilation and Vite bundle built with 0 errors |

FINAL STATUS: PASS
EXIT CODE: 0
