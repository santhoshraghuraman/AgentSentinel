"""
Chapter 3: Technical Specification for AgentSentinel M.Tech Dissertation.
"""

import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from scripts.doc_helpers import (
    add_heading_1, add_heading_2, add_heading_3,
    add_body_p, add_bullet_p, add_table_caption,
    set_cell_background, set_cell_margins, set_table_borders
)

def build_chapter_3(doc):
    add_heading_1(doc, "CHAPTER 3\nTECHNICAL SPECIFICATION")

    # Introductory lead paragraph
    add_body_p(doc,
        "A rigorous software engineering dissertation requires comprehensive technical specifications that establish "
        "system requirements, operational constraints, data provenance, threat assumptions, and traceability. This chapter "
        "defines the functional and non-functional requirements governing AgentSentinel, specifies the operational "
        "environment and data schemas, establishes the formal threat model, and provides an end-to-end Requirements "
        "Traceability Matrix (RTM) mapped to verified repository implementations.",
        first_line_indent=0
    )

    # 3.1 Overview of Requirements
    add_heading_2(doc, "3.1 Overview of Requirements")
    add_body_p(doc,
        "AgentSentinel is specified as an out-of-band runtime reference monitor operating in user space. It enforces access "
        "control and behavioral safety across autonomous software agents proposing tool invocations. The requirements are "
        "structured to ensure complete mediation, tamper resistance, minimal latency overhead, and comprehensive observability.",
        first_line_indent=0
    )

    # 3.2 Functional Requirements
    add_heading_2(doc, "3.2 Functional Requirements (FR1–FR12)")
    add_body_p(doc,
        "The functional capabilities of AgentSentinel are specified across twelve core requirements corresponding directly "
        "to architectural modules M1 through M12:",
        first_line_indent=0
    )

    fr_specs = [
        ("FR1: Action Normalization", "The system shall ingest heterogeneous, raw tool call JSON payloads submitted by autonomous agents and map them into standardized semantic action categories (file_system_read, file_system_write, code_execution, web_request, api_call, agent_control, unknown) and canonical mutation flags (is_mutating, is_destructive)."),
        ("FR2: Trajectory Sequence Tracking", "The system shall maintain an in-memory, temporal sliding window of the current agent interaction session, recording ordered action sequences, invocation parameters, and Unix epoch timestamps."),
        ("FR3: Continuous Behavioral Feature Extraction", "The system shall extract exactly 22 continuous mathematical features from the trajectory sliding window, computing category frequency distributions, mutation counts, transition dynamics (such as read-to-write sequences), and inter-action time deltas."),
        ("FR4: Statistical Behavioral Risk Estimation", "The system shall evaluate the 22-dimensional feature vector using a serialized StandardScaler and RandomForestClassifier (100 estimators) to produce a continuous risk probability score R_ML in [0.0, 1.0], augmented with heuristic guardrails."),
        ("FR5: Task-Context Capability Authorization", "The system shall validate proposed tool actions against an active Task Contract, verifying whether the requested capability primitive belongs to C_allowed and is disjoint from C_denied, outputting status D_auth in {PASS, DENY} under a strict default-deny policy."),
        ("FR6: Invariant-Driven Policy Fusion", "The system shall fuse statistical risk scores, task authorization status, and registered policy rules under five mandatory security invariants, outputting an authoritative governance verdict D_final in {ALLOW, ALERT, BLOCK} with strict cross-tier precedence (BLOCK > ALERT > ALLOW)."),
        ("FR7: Pre-Execution Interception & Enforcement", "The system shall intercept every proposed tool call prior to execution using a pre-execution lock. If D_final == BLOCK, the system shall strictly bypass callable execution (guaranteeing 0 host calls) and return a synthetic error message to the agent."),
        ("FR8: Physical Execution Monitoring", "If D_final in {ALLOW, ALERT}, the system shall invoke the target callable, monitor its execution lifecycle, and record the exact physical execution state in {attempted, executed, execution_failed, blocked}."),
        ("FR9: Correlated Relational Audit Persistence", "The system shall persist an immutable, non-repudiable audit event in an SQLite relational database for every intercepted action, indexing the event with a unique UUIDv4 interception_id that correlates the agent's intent, risk metrics, policy decision, and execution outcome."),
        ("FR10: Backend API Gateway", "The system shall expose a high-performance RESTful API via FastAPI, providing authenticated endpoints for tool interception (/api/v1/intercept), audit querying (/api/v1/audit), policy management (/api/v1/policies), task registration (/api/v1/tasks), and research evaluation (/api/v1/evaluation)."),
        ("FR11: Real-Time Observability Dashboard", "The system shall provide a multi-screen web user interface built in React 19, TypeScript, and TailwindCSS, rendering real-time telemetry (via 3-second HTTP polling), interactive 2D/3D system topologies, decision exploration radars, and audit log inspectors across 14 dedicated screens."),
        ("FR12: Integration SDK & Local Agent Harness", "The system shall provide a Python integration wrapper (CallableIntegrationService) enabling seamless instrumentation of external agent frameworks (LangChain, AutoGPT) and include a local autonomous agent harness powered by Ollama running Qwen3:4b.")
    ]

    for title, desc in fr_specs:
        add_bullet_p(doc, f" {desc}", f"{title}:")

    # 3.3 Non-Functional Requirements
    add_heading_2(doc, "3.3 Non-Functional Requirements (NFR1–NFR6)")
    add_body_p(doc,
        "In addition to functional capabilities, AgentSentinel must satisfy stringent software quality attributes defined "
        "in accordance with ISO/IEC 25010 standards:",
        first_line_indent=0
    )

    nfr_specs = [
        ("NFR1: Performance and Low Latency", "The total in-process mediation overhead—encompassing payload normalization, feature extraction, Random Forest inference, policy fusion, and SQLite audit commit—must execute with a median latency under 15 milliseconds and a P95 latency under 30 milliseconds, ensuring zero perceptible lag in interactive human-agent sessions."),
        ("NFR2: Reliability and Fail-Closed Default", "In the event of an internal unhandled exception, model inference timeout, missing configuration schema, or database lock, the Runtime Interceptor must fail closed, automatically forcing D_final = BLOCK to prevent unvalidated actions from reaching the host environment."),
        ("NFR3: Audit Correlation and Non-Repudiation", "Every audit record must preserve exact invocation parameters and correlate across all pipeline stages via an immutable UUIDv4 interception_id, guaranteeing forensic reconstructability without credential leakage."),
        ("NFR4: Framework and Model Agnosticism", "The middleware must govern tool execution externally via standard JSON/Python callable contracts, functioning identically regardless of whether the agent is driven by OpenAI GPT-4, Anthropic Claude, Meta Llama 3, or a local Ollama model."),
        ("NFR5: Operational Isolation and Security", "The reference monitor and its persistence store must execute in an isolated process boundary separate from the agent's prompting context, preventing adversarial agents from modifying policy rules or clearing audit logs."),
        ("NFR6: Maintainability and Test Coverage", "The codebase must adhere to strict type annotations (Python typing and TypeScript interfaces), modular separation of concerns, and maintain 100% pass rates across an automated regression test suite covering unit, integration, and security invariant tests.")
    ]

    for title, desc in nfr_specs:
        add_bullet_p(doc, f" {desc}", f"{title}:")

    # 3.4 Software and Hardware Requirements
    add_heading_2(doc, "3.4 Software and Hardware Requirements")
    add_body_p(doc,
        "The verified operational environment and dependency stack for AgentSentinel is specified as follows:",
        first_line_indent=0
    )

    add_bullet_p(doc, " Python 3.11.x or 3.14.x running in a dedicated virtual environment (.venv). Core packages: FastAPI 0.129.0, Uvicorn 0.40.0, Pydantic 2.12.5, SQLAlchemy 2.0.46, scikit-learn 1.9.1, NumPy 2.5.3, Pandas 3.0.3, Joblib 1.6.0.", "• Backend Runtime:")
    add_bullet_p(doc, " Node.js v22.19.0, npm 10.9.3, Vite 6.x, React 19.x, TypeScript 5.7.x, TailwindCSS 3.4.x, Lucide React icons.", "• Frontend Runtime:")
    add_bullet_p(doc, " Ollama v0.5+ local inference engine hosting Qwen3:4b (qwen3:latest) on localhost:11434 with a 4,096-token context window.", "• LLM Agent Engine:")
    add_bullet_p(doc, " SQLite 3.x with SQLAlchemy ORM (file: agentsentinel.db) using WAL (Write-Ahead Logging) mode.", "• Persistence Database:")
    add_bullet_p(doc, " Pytest 9.1.1 test runner with automated test suites in tests/.", "• Verification Stack:")
    add_bullet_p(doc, " Minimum: Quad-core x86_64 CPU, 8 GB RAM, 10 GB disk space. Recommended for local Ollama inference: 8-core CPU or NVIDIA RTX GPU with 6+ GB VRAM, 16 GB system RAM.", "• Hardware Specifications:")

    # 3.5 Data Requirements & Benchmark Provenance
    add_heading_2(doc, "3.5 Data Requirements & Benchmark Provenance")
    add_body_p(doc,
        "Empirical research and validation rely on two distinct trajectory datasets stored within the repository:",
        first_line_indent=0
    )

    add_body_p(doc,
        "1. ATBench Benchmark Dataset (datasets/TraceLab/ATBench/test.json): ATBench is an established, peer-reviewed agent "
        "trajectory benchmark containing exactly 1,000 JSON-formatted interaction trajectories. Each trajectory represents a complete "
        "agent session annotated with a verified ground-truth binary label: 503 Safe trajectories (benign task fulfillment) and "
        "497 Unsafe trajectories (adversarial attacks, unauthorized file operations, destructive commands, or privilege escalations). "
        "The dataset is partitioned using a stratified 75% training split (750 trajectories) and a 25% held-out test split "
        "(250 trajectories) with random_state=42, ensuring balanced class distributions across splits."
    )

    add_body_p(doc,
        "2. SyFI / TraceLab Telemetry Corpus (datasets/TraceLab/SyFI/): The SyFI corpus provides an extensive observational dataset "
        "comprising 8,058 agent sessions, 665,453 discrete interaction steps, and 743,819 tool calls. In strict accordance with "
        "academic integrity, SyFI consists of unlabelled telemetry traces and is used exclusively for schema stress-testing, feature "
        "distribution exploration, and pipeline throughput profiling, rather than ground-truth benchmark classification."
    )

    # 3.6 Threat Model and Safety Assumptions
    add_heading_2(doc, "3.6 Threat Model and Safety Assumptions")
    add_body_p(doc,
        "AgentSentinel adopts an adversarial threat model focused on securing host execution environments against rogue or compromised AI agents:",
        first_line_indent=0
    )

    add_bullet_p(doc, " The adversary may be an external attacker submitting malicious prompts, an untrusted third party embedding indirect prompt injections into web documents, or an autonomous agent experiencing goal drift. The attacker can induce the LLM to generate arbitrary tool-calling requests with arbitrary argument payloads.", "• Attacker Capabilities:")
    add_bullet_p(doc, " The agent proposes actions with full host process permissions. The threat vector includes: unauthorized file system reads (e.g., /etc/passwd), destructive file writes, shell command execution (rm -rf, curl exfiltration), database drops, and unauthorized API calls.", "• Threat Vectors:")
    add_bullet_p(doc, " The AgentSentinel reference monitor, its memory space, configuration files, and the underlying SQLite audit store are assumed to reside within a trusted boundary that the untrusted agent cannot directly tamper with.", "• Trust Boundaries:")

    add_body_p(doc,
        "To counter these threats, the system enforces five mandatory Security Invariants (I1 through I5):",
        first_line_indent=0.5
    )

    add_bullet_p(doc, " If Task Authorization returns DENY, the final verdict must be BLOCK regardless of ML risk.", "Invariant I1 (Denial Dominance):")
    add_bullet_p(doc, " If estimated ML risk R_ML >= 0.85 (theta_critical), the final verdict must be BLOCK.", "Invariant I2 (Severe Risk Override):")
    add_bullet_p(doc, " Destructive actions not explicitly whitelisted in the active contract must be BLOCKED.", "Invariant I3 (Destructive Prohibition):")
    add_bullet_p(doc, " If verdict is BLOCK, physical host callable execution is guaranteed to be strictly ZERO.", "Invariant I4 (Zero Host Execution):")
    add_bullet_p(doc, " Any internal error, timeout, or schema fault forces an immediate fail-closed BLOCK.", "Invariant I5 (Fail-Closed Default):")

    # 3.7 Assumptions and Dependencies
    add_heading_2(doc, "3.7 Assumptions and Dependencies")
    add_body_p(doc,
        "The design assumes that all tool invocations made by the agent pass through the AgentSentinel SDK wrapper or API "
        "gateway. Direct invocation of host binaries outside the intercepted Python process boundary is prevented by operating "
        "system user-level permissions.",
        first_line_indent=0
    )

    # 3.8 Logical Data Model & Schema Architecture
    add_heading_2(doc, "3.8 Logical Data Model & Schema Architecture")
    add_body_p(doc,
        "The relational persistence schema is implemented in SQLAlchemy (src/agentsentinel/db/models.py) and mapped to SQLite. "
        "The primary entity is `AuditEvent`, which records: `interception_id` (UUIDv4 Primary Key), `session_id` (VARCHAR), "
        "`agent_id` (VARCHAR), `tool_name` (VARCHAR), `arguments` (JSON/TEXT), `decision` (VARCHAR: ALLOW/ALERT/BLOCK), "
        "`risk_score` (FLOAT), `risk_band` (VARCHAR: LOW/MEDIUM/HIGH), `matched_policy_id` (VARCHAR, Nullable), "
        "`task_context_id` (VARCHAR, Nullable), `execution_state` (VARCHAR: attempted/executed/execution_failed/blocked), "
        "`execution_output` (TEXT, Nullable), and `timestamp` (DATETIME).",
        first_line_indent=0
    )

    # 3.9 Requirements Traceability Matrix
    add_heading_2(doc, "3.9 Requirements Traceability Matrix (RTM)")
    add_body_p(doc,
        "Table 3.1 establishes complete bidirectional traceability between functional requirements, implementing source files, "
        "automated test suites, and empirical verification status.",
        first_line_indent=0
    )

    add_table_caption(doc, "3.1", "Requirements Traceability Matrix (RTM)")
    
    t_rtm = doc.add_table(rows=1, cols=5)
    t_rtm.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_rtm)

    rtm_hdrs = ["Req. ID", "Requirement Description", "Implementing Module & File", "Automated Test Suite", "Status"]
    for i, h in enumerate(rtm_hdrs):
        cell = t_rtm.rows[0].cells[i]
        set_cell_background(cell, "1E293B")
        set_cell_margins(cell, top=60, bottom=60, left=40, right=40)
        p = cell.paragraphs[0]
        p.text = h
        p.runs[0].font.name = "Times New Roman"
        p.runs[0].font.size = Pt(9)
        p.runs[0].font.bold = True
        p.runs[0].font.color.rgb = RGBColor(255, 255, 255)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    rtm_data = [
        ("FR1", "Action Normalization", "M2: normalizers/action_normalizer.py", "tests/test_action_normalizer.py", "VERIFIED"),
        ("FR2", "Sequence Tracking", "M3: representations/behavioral_sequence.py", "tests/test_behavioral_sequence.py", "VERIFIED"),
        ("FR3", "22 Feature Extraction", "M4: features/extractor.py", "tests/test_feature_extractor.py", "VERIFIED"),
        ("FR4", "Risk Scoring Engine", "M5: risk/engine.py", "tests/test_risk_engine.py", "VERIFIED"),
        ("FR5", "Task Authorization", "M6: authorization/engine.py", "tests/test_authorization_engine.py", "VERIFIED"),
        ("FR6", "Policy Fusion (5 Invariants)", "M7: governance/engine.py", "tests/test_governance_engine.py", "VERIFIED"),
        ("FR7", "Pre-Execution Gate", "M8: runtime/interceptor.py", "tests/test_interceptor.py", "VERIFIED"),
        ("FR8", "Execution State Tracking", "M8/M12: integrations/service.py", "tests/test_audit_integrity.py", "VERIFIED"),
        ("FR9", "Correlated Relational Audit", "M10: db/models.py, repositories/sql.py", "tests/db/test_sql_repositories.py", "VERIFIED"),
        ("FR10", "FastAPI Service Layer", "M9: api/main.py, api/router.py", "tests/api/test_router.py", "VERIFIED"),
        ("FR11", "React Observability UI", "M11: ui/src/ (14 Screens)", "Vite build & Playwright E2E", "VERIFIED"),
        ("FR12", "LLM Agent SDK Harness", "M12: integrations/service.py, llm/agent.py", "tests/test_llm_agent.py", "VERIFIED"),
        ("NFR1", "Latency < 30ms P95", "Pipeline in-process execution", "tests/test_performance_baseline.py", "VERIFIED"),
        ("NFR2", "Fail-Closed on Fault", "M8: runtime/interceptor.py:183-200", "tests/test_interceptor_failsafe.py", "VERIFIED"),
        ("NFR4", "Model Agnosticism", "Universal JSON callable interception", "tests/test_model_agnostic.py", "VERIFIED")
    ]

    for row_idx, r in enumerate(rtm_data):
        row_cells = t_rtm.add_row().cells
        bg_color = "F1F5F9" if row_idx % 2 == 1 else "FFFFFF"
        for col_idx, val in enumerate(r):
            set_cell_background(row_cells[col_idx], bg_color)
            set_cell_margins(row_cells[col_idx], top=35, bottom=35, left=40, right=40)
            p = row_cells[col_idx].paragraphs[0]
            p.text = val
            p.runs[0].font.name = "Times New Roman"
            p.runs[0].font.size = Pt(8.5)
            if col_idx in [0, 4]:
                p.runs[0].font.bold = True
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                if val == "VERIFIED":
                    p.runs[0].font.color.rgb = RGBColor(22, 101, 52)
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT

    # 3.10 Acceptance Criteria
    add_heading_2(doc, "3.10 Acceptance Criteria")
    add_body_p(doc,
        "System acceptance is contingent upon meeting four verification gates: (1) 100% of unit and integration tests passing "
        "without failure; (2) verified 0 physical executions on all blocked test cases; (3) held-out ATBench evaluation exceeding "
        "70% accuracy; and (4) complete audit traceability across all 14 UI dashboard screens. All four criteria were fully "
        "satisfied in the final test audit.",
        first_line_indent=0
    )

    doc.add_page_break()
    print("Chapter 3 generated successfully.")
