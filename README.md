# AgentSentinel

AgentSentinel is a runtime behavioral governance and fail-safe proxy for autonomous LLM agents. It intercepts tool-call execution requests, evaluating them through a hybrid deterministic and machine-learning pipeline to prevent destructive or unauthorized actions.

## Overview

Unlike traditional LLM safety guardrails that rely on analyzing natural language prompts or deploying a secondary "policy LLM" to authorize actions, AgentSentinel operates directly at the deterministic tool-execution boundary.

It tracks the behavioral trajectory of the agent over time, extracting temporal features (e.g., transition velocities, sequential mutations) and evaluating them via a Random Forest model. This risk assessment is fused with deterministic authorization constraints to enforce zero-execution safety policies with sub-100ms latency.

## Architecture Summary

AgentSentinel implements a 12-stage architecture (M1-M12):
- **M1-M4:** Data Normalization and Temporal Feature Extraction
- **M5:** Machine Learning Behavioral Risk Assessment
- **M6:** Task Authorization
- **M7:** Deterministic Policy Fusion
- **M8:** Runtime Interception & Execution Gate
- **M9-M11:** FastAPI Backend, SQLite Persistence, and React/Vite UI Observability
- **M12:** LLM Integration (Qwen3:4b acting as the agent)

For comprehensive technical details, see [`docs/architecture.md`](./docs/architecture.md).

## Repository Structure

- `src/agentsentinel/`: Core M1-M10 Backend Pipeline
- `ui/`: React/Vite Frontend Dashboard
- `tests/`: Pytest suite (431+ tests)
- `ui/tests/`: Playwright E2E suite
- `research/`: ATBench feature extraction and model training
- `datasets/`: Storage for ATBench and TraceLab data
- `reports/`: Acceptance testing and manual verification logs
- `docs/`: Architecture diagrams and documentation

## Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **Ollama** installed locally
- Windows PowerShell (for startup scripts)

## Installation & Setup

1. **Install Ollama and pull the required model:**
   ```powershell
   # Ensure Ollama is running, then pull the local agent model
   ollama pull qwen3:4b
   ```

2. **Initialize Configuration:**
   Copy the example environment variables:
   ```powershell
   Copy-Item .env.example -Destination .env
   ```

## Production Startup

To run the complete system (Backend, Frontend, and SQLite database migrations) in production mode, use the provided script. This script automatically handles Python virtual environments and Node dependencies.

```powershell
.\start_production.ps1
```

Access the UI at: `http://localhost:4173/`

## Manual Run (Development Mode)

If you prefer to start the components manually for debugging or active development:

1. **Start the Backend (FastAPI):**
   ```powershell
   # Activate the virtual environment
   .\.venv\Scripts\activate
   # Run the server
   python -m uvicorn src.agentsentinel.api.main:app --host 127.0.0.1 --port 8000 --reload
   ```

2. **Start the Frontend (React/Vite):**
   Open a second terminal window:
   ```powershell
   cd ui
   npm install
   npm run dev
   ```

Access the development UI at: `http://localhost:5173/` (Vite's default development port).

## Development & Testing

**Backend API Specs:** Available at `http://localhost:8000/docs` when running.

**Run Backend Tests (Pytest):**
```powershell
.venv\Scripts\activate
pytest tests/ -v
```

**Run Frontend E2E Tests (Playwright):**
```powershell
cd ui
npm run test
```

## Project Status

- **Software Implementation:** 100% Complete (M1-M12 fully verified)
- **UI & Observability:** 100% Complete
- **Performance:** Optimized (React memoization, <100ms governance overhead)
- **Research Methodology:** 80% (Pipeline built; formal ablation/SOTA comparison missing)

## Limitations

- The ML model is heavily fitted to the categorical distribution of the `ATBench` dataset. External generalizability against unseen agent topologies remains unverified.
- Live telemetry is achieved via HTTP polling, not WebSockets.
- Qwen3:4b is used exclusively as the agent generating tool calls; AgentSentinel does not currently intercept arbitrary external API agents (e.g., OpenAI API) out of the box without an M12 adapter.

## Documentation & Evidence

Please review the `reports/` directory for verified execution traces, UI screenshots, and Playwright acceptance evidence. All stated capabilities (Runtime ALLOW/ALERT/BLOCK/FAULT, Policies, Audit Logs) have been verified.
