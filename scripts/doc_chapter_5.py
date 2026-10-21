"""
Chapter 5: Schedule, Tasks and Milestones for AgentSentinel M.Tech Dissertation.
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

def build_chapter_5(doc):
    add_heading_1(doc, "CHAPTER 5\nSCHEDULE, TASKS AND MILESTONES")

    # Introductory lead paragraph
    add_body_p(doc,
        "Delivering a complex software engineering dissertation spanning architectural design, statistical machine learning, "
        "low-level interception middleware, relational database engineering, and interactive web visualization demands "
        "rigorous project management, disciplined version control, and verifiable quality assurance practices. This chapter "
        "outlines the project execution timeline, presents the detailed Work Breakdown Structure (WBS), provides the schedule "
        "milestone chart, and describes the Gravitas reliability practices employed to ensure reproducibility.",
        first_line_indent=0
    )

    # 5.1 Project Period and Planning Approach
    add_heading_2(doc, "5.1 Project Period and Planning Approach")
    add_body_p(doc,
        "The AgentSentinel research and development project was executed over an 18-week academic period during the Fall Semester "
        "2026–2027, spanning from July 6, 2026 to November 3, 2026. The project followed an incremental, test-driven software "
        "engineering methodology. Development was divided into four cohesive, sequential phases:",
        first_line_indent=0
    )

    add_bullet_p(doc, " Problem formulation, systematic literature review of 15 research papers, foundational reference monitor theoretical modeling, and architecture specification.", "• Phase 1 (Weeks 1–4): Literature Survey & Architectural Specification:")
    add_bullet_p(doc, " Engineering the core Python reference monitor (Modules M1 through M10), implementing action normalization, sliding-window trajectory representation, 22-dimensional feature extraction, and pre-execution interception locks.", "• Phase 2 (Weeks 5–9): Core Middleware Implementation & Invariant Logic:")
    add_bullet_p(doc, " Benchmarking on ATBench (1,000 trajectories) and SyFI corpus, training the Random Forest classifier (100 estimators), evaluating confusion matrices and ROC-AUC, and engineering task authorization contracts.", "• Phase 3 (Weeks 10–13): Research Evaluation & Machine Learning Pipeline:")
    add_bullet_p(doc, " Developing the 14-screen React 19 observability dashboard, integrating local Ollama Qwen3:4b LLM agent harness, executing end-to-end integration test suites, and preparing guide review demonstrations.", "• Phase 4 (Weeks 14–18): UI Observability, End-to-End Testing & Review Readiness:")

    # 5.2 Work Breakdown Structure (WBS)
    add_heading_2(doc, "5.2 Work Breakdown Structure (WBS)")
    add_body_p(doc,
        "The project was decomposed into discrete work packages (WPs) to guarantee clear ownership and verification boundaries:",
        first_line_indent=0
    )

    add_bullet_p(doc, " Survey 15 relevant research publications across agent safety and runtime verification; define formal problem statement; establish threat model and five security invariants.", "WP 1.1: Literature Survey & Threat Modeling:")
    add_bullet_p(doc, " Formalize canonical trajectory schema (M1), action normalization categories (M2), and behavioral sequence graph representation (M3).", "WP 2.1: Data Modeling & Normalization Engine:")
    add_bullet_p(doc, " Implement temporal sliding window extractor computing 22 continuous features; verify feature vector alignment against scikit-learn standard scaler.", "WP 2.2: Feature Engineering Pipeline (M4):")
    add_bullet_p(doc, " Implement Task Authorization Engine (M6) enforcing default-deny set-theoretic capability matching.", "WP 2.3: Task Context Authorization (M6):")
    add_bullet_p(doc, " Engineer the authoritative Policy Fusion Engine (M7) enforcing cross-tier precedence (BLOCK > ALERT > ALLOW) and five security invariants.", "WP 2.4: Policy Fusion Engine (M7):")
    add_bullet_p(doc, " Implement thread-safe pre-execution interception gate (M8) guaranteeing zero host callable invocation on BLOCK; establish fail-safe closed exception trap.", "WP 2.5: Runtime Interceptor & Enforcement Gate (M8):")
    add_bullet_p(doc, " Engineer SQLAlchemy relational schema and SQLite persistence layer indexing all events by UUIDv4 interception_id.", "WP 2.6: Relational Persistence Store (M10):")
    add_bullet_p(doc, " Stratified train/test split of ATBench dataset (75/25, seed 42); train Random Forest; serialize risk_model.joblib; evaluate performance metrics and Gini feature importances.", "WP 3.1: Model Training & Benchmark Evaluation (M11):")
    add_bullet_p(doc, " Develop high-throughput FastAPI REST service layer (/api/v1/*) with OpenAPI documentation.", "WP 3.2: FastAPI Gateway Service (M9):")
    add_bullet_p(doc, " Build 14-screen interactive web dashboard in React 19, TypeScript, and Vite; implement 3-second HTTP polling telemetry, 3D architecture topologies, and decision explorer radar charts.", "WP 4.1: UI Observability Dashboard (M11):")
    add_bullet_p(doc, " Instrument Python CallableIntegrationService decorator; integrate Ollama local Qwen3:4b model; author 152 automated Pytest suites and Playwright E2E browser walkthroughs.", "WP 4.2: SDK Integration & Validation (M12):")

    # 5.3 Schedule Chart and Timeline
    add_heading_2(doc, "5.3 Schedule Chart and Timeline")
    add_body_p(doc,
        "Table 5.1 presents the project schedule chart detailing task allocations, start and completion dates, key deliverables, "
        "and institutional review milestones.",
        first_line_indent=0
    )

    add_table_caption(doc, "5.1", "Project Schedule, Tasks and Milestone Checkpoints")
    
    t_sch = doc.add_table(rows=1, cols=5)
    t_sch.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_sch)

    s_hdrs = ["Phase / Task", "Start Date", "End Date", "Key Deliverables", "Milestone / Checkpoint"]
    for i, h in enumerate(s_hdrs):
        cell = t_sch.rows[0].cells[i]
        set_cell_background(cell, "1E293B")
        set_cell_margins(cell, top=50, bottom=50, left=35, right=35)
        p = cell.paragraphs[0]
        p.text = h
        p.runs[0].font.name = "Times New Roman"
        p.runs[0].font.size = Pt(9)
        p.runs[0].font.bold = True
        p.runs[0].font.color.rgb = RGBColor(255, 255, 255)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    schedule_data = [
        ("Phase 1: Prior Art & Spec", "06.07.2026", "31.07.2026", "Threat Model, Prior Art Document, Architecture Draft", "Architecture Sign-off"),
        ("Review 1 Preparation", "01.08.2026", "11.08.2026", "Review 1 Presentation Slides, Preliminary Report", "Review 1 Checkpoint (12.08.2026)"),
        ("Phase 2: Core Middleware (M1-M7)", "13.08.2026", "15.09.2026", "M1-M7 Engines, 22 Features, Policy Fusion Logic", "Core Pipeline Green"),
        ("Phase 2: Gate & Persistence (M8-M10)", "16.09.2026", "30.09.2026", "Pre-Execution Gate, SQLite Store, FastAPI Routes", "Zero-Execution Verified"),
        ("Review 2 Preparation", "01.10.2026", "06.10.2026", "Live Demo Runbook, 14 Dashboard Walkthroughs", "Review 2 Checkpoint (07.10.2026)"),
        ("Phase 3: Research Evaluation (M11)", "08.10.2026", "18.10.2026", "ATBench Training, Confusion Matrix, Metrics JSON", "Model Freeze (Seed 42)"),
        ("Phase 4: UI & End-to-End Freeze", "19.10.2026", "26.10.2026", "14 Screens Completed, 152 Pytest Tests Passing", "System Freeze & Audit"),
        ("Final Dissertation & Viva Prep", "27.10.2026", "03.11.2026", "Final Dissertation Document, Evidence Register", "Final Submission")
    ]

    for s_idx, (s_ph, s_st, s_en, s_del, s_chk) in enumerate(schedule_data):
        row_cells = t_sch.add_row().cells
        bg = "F1F5F9" if s_idx % 2 == 1 else "FFFFFF"
        for c_idx, val in enumerate([s_ph, s_st, s_en, s_del, s_chk]):
            set_cell_background(row_cells[c_idx], bg)
            set_cell_margins(row_cells[c_idx], top=35, bottom=35, left=35, right=35)
            p = row_cells[c_idx].paragraphs[0]
            p.text = val
            p.runs[0].font.name = "Times New Roman"
            p.runs[0].font.size = Pt(8.5)
            if c_idx == 0:
                p.runs[0].font.bold = True
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            elif c_idx in [1, 2]:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            elif c_idx == 4:
                p.runs[0].font.bold = True
                p.runs[0].font.color.rgb = RGBColor(30, 58, 138)
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT

    # 5.4 Version Control and Gravitas Reliability Practices
    add_heading_2(doc, "5.4 Version Control and Gravitas Reliability Practices")
    add_body_p(doc,
        "The project was managed under Git version control on branch `review2-live-demo-readiness`. To guarantee academic "
        "rigor, all engineering activities adhered to the Gravitas Reliability Framework, which enforces three mandatory invariants:",
        first_line_indent=0
    )

    add_bullet_p(doc, " No source file is mutated without first inspecting its implementation, unit test harness, and dependent callers.", "1. Scoped Reconnaissance Before Mutation:")
    add_bullet_p(doc, " A technical claim is accepted as completed only when verified by an automated test passing after the last code change. Stale test outputs and self-review are rejected.", "2. Deterministic Verification Gate:")
    add_bullet_p(doc, " Claims of novelty, security guarantees, or benchmark accuracy must be explicitly supported by source artifacts. If an assumption or metric cannot be reproduced, it must be declared in an open gap register rather than fabricated.", "3. Zero Fabricated Certainty:")

    # 5.5 Milestone Review Deliverables
    add_heading_2(doc, "5.5 Milestone Review Deliverables")
    add_body_p(doc,
        "The project underwent formal scrutiny at two institutional checkpoints conducted by the Department of Software and "
        "Systems Engineering, SCORE, VIT Vellore:",
        first_line_indent=0
    )

    add_body_p(doc,
        "Review 1 (August 12, 2026): Chaired by internal faculty examiners, Review 1 evaluated project feasibility, theoretical "
        "foundations, the survey of 15 research papers, and preliminary trajectory schemas. The examiners commended the choice of "
        "the classical reference monitor paradigm and approved the project scope and Work Breakdown Structure."
    )

    add_body_p(doc,
        "Review 2 (October 7, 2026): Focused on implementation progress, demonstration readiness, and empirical results. "
        "The student demonstrated live pre-execution interception, presented the 14-screen React dashboard, proved zero host "
        "execution on blocked adversarial actions, and reviewed the 72.40% classification accuracy on ATBench. The project was "
        "approved for final report compilation and dissertation defense."
    )

    doc.add_page_break()
    print("Chapter 5 generated successfully.")
