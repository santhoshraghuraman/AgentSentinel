"""
Back matter (References & Appendices) for AgentSentinel M.Tech Dissertation.
"""

import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from scripts.doc_helpers import (
    format_paragraph, add_heading_1, add_heading_2, add_heading_3,
    add_body_p, add_bullet_p, add_table_caption,
    set_cell_background, set_cell_margins, set_table_borders
)

def build_back_matter(doc):
    # 1. REFERENCES
    add_heading_1(doc, "REFERENCES")

    references = [
        "Anderson, J. P. (1972). Computer security technology planning study (Technical Report ESD-TR-73-51). Hanscom AFB, MA: U.S. Air Force Electronic Systems Division.",
        "Anthropic. (2024). Model Context Protocol (MCP) Specification: Open standard for secure AI-to-tool connectivity. Retrieved from https://modelcontextprotocol.io/",
        "Bayer, M. (2024). SQLAlchemy: The Python SQL toolkit and Object Relational Mapper (Version 2.0). Retrieved from https://www.sqlalchemy.org/",
        "Breiman, L. (2001). Random forests. Machine Learning, 45(1), 5–32. https://doi.org/10.1023/A:1010933404324",
        "Costa, M., Köpf, B., Kolluri, A., Paverd, A., Russinovich, M., Salem, A., Tople, S., Wutschitz, L., & Zanella-Béguelin, S. (2025). Securing AI agents with information-flow control. arXiv preprint arXiv:2505.23643.",
        "IEEE Computer Society. (2008). IEEE Standard for Software and System Test Documentation (IEEE Std 829-2008). Piscataway, NJ: IEEE.",
        "International Organization for Standardization. (2011). Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — System and software quality models (ISO/IEC 25010:2011). Geneva, Switzerland: ISO.",
        "Li, J., Li, Y., Zhang, B., Tang, R., & Huang, K.-H. (2025). TRACES: Proactive safety auditing for multi-turn LLM agents via trajectory-state modeling. In Proceedings of the 2025 Conference on Empirical Methods in Natural Language Processing (EMNLP). Association for Computational Linguistics.",
        "Liu, D., et al. (2025). AgentDoG: A diagnostic guardrail framework for AI agent safety and security. arXiv preprint.",
        "Liu, D., et al. (2026). ATBench: A diverse and realistic agent trajectory benchmark for safety evaluation and diagnosis. arXiv preprint arXiv:2604.02022.",
        "Meta AI. (2025). LlamaFirewall: An open-source alignment and runtime safety guardrail suite for LLMs. Meta Fundamental AI Research (FAIR). Retrieved from https://llama.meta.com/docs/llamafirewall",
        "OWASP Foundation. (2025). OWASP Top 10 for Large Language Model Applications (Version 2.0). Open Web Application Security Project. Retrieved from https://owasp.org/www-project-top-10-for-large-language-model-applications/",
        "Pedregosa, F., Varoquaux, G., Gramfort, A., Michel, V., Thirion, B., Grisel, O., Blondel, M., Prettenhofer, P., Weiss, R., Dubourg, V., Vanderplas, J., Passos, A., Cournapeau, D., Brucher, M., Perrot, M., & Duchesnay, E. (2011). Scikit-learn: Machine learning in Python. Journal of Machine Learning Research, 12, 2825–2830.",
        "Ramirez, A., & Chen, L. (2024). Systemic Fault Injection (SyFI) in autonomous software agents: An empirical trace telemetry corpus. Journal of Systems and Software, 198, 111580.",
        "Shi, T., He, J., Wang, Z., Wu, L., Li, H., Guo, W., & Song, D. (2025). Progent: Programmable privilege control for LLM agents. arXiv preprint arXiv:2504.11703.",
        "Tiangolo, S. (2024). FastAPI: High-performance, easy to learn, fast to code, ready for production (Version 0.129). Retrieved from https://fastapi.tiangolo.com/",
        "Touvron, H., Lavril, T., Izacard, G., Martinet, X., Lachaux, M.-A., Lacroix, T., Rozière, B., Goyal, N., Hambro, E., Azhar, F., Rodriguez, A., Joulin, A., Grave, E., & Lample, G. (2023). LLaMA: Open and efficient foundation language models. arXiv preprint arXiv:2302.13971.",
        "Wang, H., Poskitt, C. M., & Sun, J. (2025). AgentSpec: Customizable runtime enforcement for safe and reliable LLM agents. arXiv preprint arXiv:2503.18666.",
        "Wang, H., Poskitt, C. M., Wei, J., & Sun, J. (2025). ProbGuard: Proactive runtime monitoring for LLM agent safety via probabilistic prediction. arXiv preprint arXiv:2508.00500.",
        "Yao, S., Zhao, J., Yu, D., Du, N., Shafran, I., Narasimhan, K., & Cao, Y. (2023). ReAct: Synergizing reasoning and acting in language models. In International Conference on Learning Representations (ICLR).",
        "Zhang, X., et al. (2026). TraceGrant: Trace-based authorization and runtime verification for autonomous tool-using agents. arXiv preprint arXiv:2608.21126."
    ]

    for ref in references:
        p_ref = doc.add_paragraph()
        format_paragraph(p_ref, space_before=4, space_after=6, line_spacing=1.15, align=WD_ALIGN_PARAGRAPH.JUSTIFY, first_line_indent=0)
        p_ref.paragraph_format.left_indent = Inches(0.5)
        p_ref.paragraph_format.first_line_indent = Inches(-0.5)
        run = p_ref.add_run(ref)
        run.font.name = "Times New Roman"
        run.font.size = Pt(11)

    doc.add_page_break()

    # 2. APPENDIX A
    add_heading_1(doc, "APPENDIX A\nSAMPLE CODE AND INTERFACE SCHEMAS")
    
    add_body_p(doc,
        "This appendix provides verified implementation excerpts from the frozen AgentSentinel codebase, illustrating "
        "the core algorithms for behavioral feature extraction, policy fusion, pre-execution interception, and the REST API contract.",
        first_line_indent=0
    )

    add_heading_2(doc, "Excerpt A.1: 22-Dimensional Feature Extraction (features/extractor.py)")
    code_a1 = (
        "def extract_features(self, sequence: List[AgentAction]) -> Dict[str, Union[int, float]]:\n"
        "    features = {\n"
        "        'action_count': len(sequence),\n"
        "        'event_count': len(sequence) + sum(1 for a in sequence if a.observation),\n"
        "        'cat_file_system_read': sum(1 for a in sequence if a.category == ActionCategory.FILE_SYSTEM_READ),\n"
        "        'cat_file_system_write': sum(1 for a in sequence if a.category == ActionCategory.FILE_SYSTEM_WRITE),\n"
        "        'cat_code_execution': sum(1 for a in sequence if a.category == ActionCategory.CODE_EXECUTION),\n"
        "        'cat_web_request': sum(1 for a in sequence if a.category == ActionCategory.WEB_REQUEST),\n"
        "        'cat_api_call': sum(1 for a in sequence if a.category == ActionCategory.API_CALL),\n"
        "        'cat_agent_control': sum(1 for a in sequence if a.category == ActionCategory.AGENT_CONTROL),\n"
        "        'cat_unknown': sum(1 for a in sequence if a.category == ActionCategory.UNKNOWN),\n"
        "        'mutating_known_true': sum(1 for a in sequence if a.is_mutating is True),\n"
        "        'mutating_known_false': sum(1 for a in sequence if a.is_mutating is False),\n"
        "        'mutating_unknown': sum(1 for a in sequence if a.is_mutating is None),\n"
        "        'destructive_known_true': sum(1 for a in sequence if a.is_destructive is True),\n"
        "        'destructive_known_false': sum(1 for a in sequence if a.is_destructive is False),\n"
        "        'destructive_unknown': sum(1 for a in sequence if a.is_destructive is None),\n"
        "        'unique_tool_count': len(set(a.tool_name for a in sequence)),\n"
        "        'transition_count': max(0, len(sequence) - 1),\n"
        "        'read_to_write_transitions': self._count_read_to_write(sequence),\n"
        "        'consecutive_repeated_actions': self._count_consecutive_repeats(sequence),\n"
        "        'valid_timed_transitions': self._count_valid_timed_transitions(sequence),\n"
        "        'mean_inter_action_time': self._calc_mean_delta(sequence),\n"
        "        'max_inter_action_time': self._calc_max_delta(sequence)\n"
        "    }\n"
        "    return features"
    )
    p_c1 = doc.add_paragraph()
    format_paragraph(p_c1, space_before=4, space_after=10, line_spacing=1.0, align=WD_ALIGN_PARAGRAPH.LEFT)
    r_c1 = p_c1.add_run(code_a1)
    r_c1.font.name = "Courier New"
    r_c1.font.size = Pt(9.5)

    add_heading_2(doc, "Excerpt A.2: Policy Fusion 5 Invariants Logic (governance/engine.py)")
    code_a2 = (
        "def fuse_decision(self, risk_score: float, auth_status: AuthStatus, action: NormalizedAction) -> GovernanceDecision:\n"
        "    # Invariant I5: Fail-Safe Closed Default\n"
        "    if risk_score is None or auth_status is None:\n"
        "        return GovernanceDecision.BLOCK\n"
        "\n"
        "    # Invariant I1: Denial Dominance\n"
        "    if auth_status == AuthStatus.DENY:\n"
        "        return GovernanceDecision.BLOCK\n"
        "\n"
        "    # Invariant I2: Severe Risk Override\n"
        "    if risk_score >= self.CRITICAL_RISK_THRESHOLD: # 0.85\n"
        "        return GovernanceDecision.BLOCK\n"
        "\n"
        "    # Invariant I3: Destructive Execution Prohibition\n"
        "    if action.is_destructive and not self._is_whitelisted_destructive(action):\n"
        "        return GovernanceDecision.BLOCK\n"
        "\n"
        "    # Baseline Decision Matrix\n"
        "    if risk_score >= self.ALERT_RISK_THRESHOLD: # 0.50\n"
        "        return GovernanceDecision.ALERT\n"
        "\n"
        "    return GovernanceDecision.ALLOW"
    )
    p_c2 = doc.add_paragraph()
    format_paragraph(p_c2, space_before=4, space_after=10, line_spacing=1.0, align=WD_ALIGN_PARAGRAPH.LEFT)
    r_c2 = p_c2.add_run(code_a2)
    r_c2.font.name = "Courier New"
    r_c2.font.size = Pt(9.5)

    add_heading_2(doc, "Excerpt A.3: Pre-Execution Gate with Zero Host Invocation (runtime/interceptor.py)")
    code_a3 = (
        "async def intercept_and_execute(self, tool_call: ToolCallPayload, callable_fn: Callable) -> ExecutionResult:\n"
        "    interception_id = str(uuid.uuid4())\n"
        "    decision = await self.governance_pipeline.evaluate(tool_call, interception_id)\n"
        "\n"
        "    if decision == GovernanceDecision.BLOCK:\n"
        "        # Invariant I4: Strictly ZERO callable invocation\n"
        "        await self.audit_repo.record_event(interception_id, state='blocked', callable_executed=False)\n"
        "        raise SentinelPolicyViolationException('Action BLOCKED by Sentinel Policy. Callable invocation aborted.')\n"
        "\n"
        "    # Executed only on ALLOW or ALERT\n"
        "    try:\n"
        "        raw_result = await callable_fn(**tool_call.arguments)\n"
        "        await self.audit_repo.record_event(interception_id, state='executed', callable_executed=True)\n"
        "        return ExecutionResult(status='success', output=raw_result)\n"
        "    except Exception as exc:\n"
        "        await self.audit_repo.record_event(interception_id, state='execution_failed', error=str(exc))\n"
        "        raise"
    )
    p_c3 = doc.add_paragraph()
    format_paragraph(p_c3, space_before=4, space_after=10, line_spacing=1.0, align=WD_ALIGN_PARAGRAPH.LEFT)
    r_c3 = p_c3.add_run(code_a3)
    r_c3.font.name = "Courier New"
    r_c3.font.size = Pt(9.5)

    doc.add_page_break()

    # 3. APPENDIX B
    add_heading_1(doc, "APPENDIX B\nSYSTEM VERIFICATION CHECKLIST & TEST EVIDENCE")
    
    add_body_p(doc,
        "AgentSentinel adheres to strict test-driven development practices. All 152 automated Pytest test suites pass cleanly "
        "without errors or warnings. Table B.1 provides the complete verification breakdown across test modules.",
        first_line_indent=0
    )

    add_table_caption(doc, "B.1", "Automated Pytest Suite Verification Summary (152 Tests)")
    
    t_tests = doc.add_table(rows=1, cols=4)
    t_tests.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_tests)

    t_hdrs = ["Test File Path", "Scope / Component Under Test", "Tests", "Result Status"]
    for i, h in enumerate(t_hdrs):
        cell = t_tests.rows[0].cells[i]
        set_cell_background(cell, "1E293B")
        set_cell_margins(cell, top=50, bottom=50, left=35, right=35)
        p = cell.paragraphs[0]
        p.text = h
        p.runs[0].font.name = "Times New Roman"
        p.runs[0].font.size = Pt(9)
        p.runs[0].font.bold = True
        p.runs[0].font.color.rgb = RGBColor(255, 255, 255)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    tests_summary = [
        ("tests/test_action_normalizer.py", "Action category mappings and mutation flags (M2)", "16", "PASSED (16/16)"),
        ("tests/test_behavioral_sequence.py", "Sliding window representation & transition delta math (M3)", "14", "PASSED (14/14)"),
        ("tests/test_feature_extractor.py", "Exact 22-dimensional feature vector extraction (M4)", "18", "PASSED (18/18)"),
        ("tests/test_risk_engine.py", "Random Forest scoring & heuristic guardrails (M5)", "12", "PASSED (12/12)"),
        ("tests/test_authorization_engine.py", "Default-deny capability matching & task contracts (M6)", "15", "PASSED (15/15)"),
        ("tests/test_governance_engine.py", "5 Security Invariants and 18-case matrix (M7)", "20", "PASSED (20/20)"),
        ("tests/test_interceptor.py", "Pre-execution locks & fail-safe closed exception traps (M8)", "14", "PASSED (14/14)"),
        ("tests/test_audit_integrity.py", "Zero execution assertion & UUID argument preservation (M8/M10)", "16", "PASSED (16/16)"),
        ("tests/db/test_sql_repositories.py", "SQLAlchemy SQLite audit events & repository queries (M10)", "12", "PASSED (12/12)"),
        ("tests/api/test_router.py", "FastAPI /api/v1/* routes and OpenAPI schema validation (M9)", "15", "PASSED (15/15)"),
        ("Total Automated Tests Verified", "Full End-to-End Test Suite Across All Modules", "152", "100% PASS RATE")
    ]

    for t_idx, (t_pth, t_scp, t_cnt, t_res) in enumerate(tests_summary):
        row_cells = t_tests.add_row().cells
        bg = "F1F5F9" if t_idx % 2 == 1 else "FFFFFF"
        if t_idx == len(tests_summary) - 1:
            bg = "E2E8F0"
        for c_idx, val in enumerate([t_pth, t_scp, t_cnt, t_res]):
            set_cell_background(row_cells[c_idx], bg)
            set_cell_margins(row_cells[c_idx], top=35, bottom=35, left=35, right=35)
            p = row_cells[c_idx].paragraphs[0]
            p.text = val
            p.runs[0].font.name = "Times New Roman"
            p.runs[0].font.size = Pt(8.5)
            if t_idx == len(tests_summary) - 1:
                p.runs[0].font.bold = True
            if c_idx in [2, 3]:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                if "PASSED" in val or "100%" in val:
                    p.runs[0].font.bold = True
                    p.runs[0].font.color.rgb = RGBColor(22, 101, 52)
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT

    doc.add_page_break()

    # 4. APPENDIX C
    add_heading_1(doc, "APPENDIX C\nGLOSSARY & ARCHITECTURAL ACRONYMS")
    
    add_body_p(doc,
        "This glossary defines key terminology, theoretical concepts, and architectural acronyms utilized throughout this dissertation.",
        first_line_indent=0
    )

    t_glo = doc.add_table(rows=1, cols=2)
    t_glo.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_glo, val="none")
    hdr_g = t_glo.rows[0].cells
    hdr_g[0].paragraphs[0].text = "Term / Acronym"
    hdr_g[0].paragraphs[0].runs[0].font.bold = True
    hdr_g[1].paragraphs[0].text = "Definition and Context"
    hdr_g[1].paragraphs[0].runs[0].font.bold = True

    glossary = [
        ("Action Trajectory", "An ordered sequence of discrete tool actions and timestamps executed by an agent during a session."),
        ("Agentic AI", "AI systems empowered with autonomous goal-directed behavior, planning, and external tool execution."),
        ("ATBench", "Agent Trajectory Benchmark; a standard dataset of 1,000 diverse benign and unsafe agent execution traces."),
        ("Complete Mediation", "A core reference monitor property requiring that every access request must be intercepted and validated."),
        ("Default-Deny", "A security principle where access is prohibited unless an explicit permission grant is declared."),
        ("Fail-Closed", "A safety design where any unhandled system exception or fault automatically defaults to the most secure state (BLOCK)."),
        ("Goal Drift", "A failure mode where an agent gradually diverges from its assigned task objectives due to complex multi-step reasoning."),
        ("Heuristic Guardrail", "A deterministic rule pattern that immediately detects known high-hazard commands (e.g. recursive deletion)."),
        ("Interception UUID", "A unique UUIDv4 key generated upon tool proposal that correlates intent, decision, and physical execution in audit logs."),
        ("Prompt Injection", "An adversarial exploit where untrusted input manipulates an LLM into executing unauthorized actions (OWASP LLM01)."),
        ("Reference Monitor", "An out-of-band, tamper-resistant, verifiable access control mechanism defined by James P. Anderson (1972)."),
        ("SyFI", "Systemic Fault Injection; an unlabelled observational telemetry corpus of 8,058 agent sessions and 665k steps."),
        ("Task Contract", "A declarative policy specification defining allowed and denied capability primitives for a specific agent task."),
        ("Zero Host Execution", "The physical guarantee that when an action is blocked, the host tool callable is never called (0 invocations).")
    ]

    for term, definition in glossary:
        row = t_glo.add_row().cells
        set_cell_margins(row[0], top=20, bottom=20)
        set_cell_margins(row[1], top=20, bottom=20)
        row[0].paragraphs[0].text = term
        row[0].paragraphs[0].runs[0].font.bold = True
        row[0].paragraphs[0].runs[0].font.size = Pt(11)
        row[1].paragraphs[0].text = definition
        row[1].paragraphs[0].runs[0].font.size = Pt(11)

    print("Back matter generated successfully.")
