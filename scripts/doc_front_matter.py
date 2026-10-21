import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from scripts.doc_helpers import (
    format_paragraph, add_heading_1, add_heading_2, add_heading_3,
    add_body_p, add_bullet_p, set_cell_background, set_cell_margins, set_table_borders,
    FIG_DIR
)

def build_front_matter(doc):
    # 1. OUTER COVER PAGE
    p0 = doc.add_paragraph()
    format_paragraph(p0, space_before=14, space_after=8, line_spacing=1.15, align=WD_ALIGN_PARAGRAPH.CENTER)
    p0.text = ""
    r0 = p0.add_run("A MODEL-AGNOSTIC RUNTIME BEHAVIORAL GOVERNANCE FRAMEWORK FOR AUTONOMOUS AI AGENTS")
    r0.font.name = "Times New Roman"
    r0.font.size = Pt(15)
    r0.font.bold = True
    r0.font.color.rgb = RGBColor(0, 32, 96)

    p1 = doc.add_paragraph()
    format_paragraph(p1, space_before=10, space_after=12, line_spacing=1.15, align=WD_ALIGN_PARAGRAPH.CENTER)
    r1 = p1.add_run("SWE3004 – Software Design and Development Project\nFinal Project Report")
    r1.font.name = "Times New Roman"
    r1.font.size = Pt(13)
    r1.font.bold = True

    p2 = doc.add_paragraph()
    format_paragraph(p2, space_before=12, space_after=8, line_spacing=1.15, align=WD_ALIGN_PARAGRAPH.CENTER)
    r2 = p2.add_run("Submitted in partial fulfillment of the requirements for the degree of\n")
    r2.font.name = "Times New Roman"
    r2.font.size = Pt(12)
    r2_deg = p2.add_run("Master of Technology in Software Engineering")
    r2_deg.font.name = "Times New Roman"
    r2_deg.font.size = Pt(13)
    r2_deg.font.bold = True
    r2_in = p2.add_run("\nin\nDepartment of Software and Systems Engineering")
    r2_in.font.name = "Times New Roman"
    r2_in.font.size = Pt(12)

    p3 = doc.add_paragraph()
    format_paragraph(p3, space_before=14, space_after=6, line_spacing=1.15, align=WD_ALIGN_PARAGRAPH.CENTER)
    r3 = p3.add_run("by\n")
    r3.font.name = "Times New Roman"
    r3.font.size = Pt(12)
    r3_name = p3.add_run("SANTHOSH R")
    r3_name.font.name = "Times New Roman"
    r3_name.font.size = Pt(13)
    r3_name.font.bold = True
    r3_reg = p3.add_run("\n(Register Number: 22MIS0282)")
    r3_reg.font.name = "Times New Roman"
    r3_reg.font.size = Pt(12)
    r3_reg.font.bold = True

    p4 = doc.add_paragraph()
    format_paragraph(p4, space_before=14, space_after=10, line_spacing=1.15, align=WD_ALIGN_PARAGRAPH.CENTER)
    r4 = p4.add_run("Under the guidance of\n")
    r4.font.name = "Times New Roman"
    r4.font.size = Pt(12)
    r4_guide = p4.add_run("Dr. PRIYA V")
    r4_guide.font.name = "Times New Roman"
    r4_guide.font.size = Pt(13)
    r4_guide.font.bold = True
    r4_desig = p4.add_run("\nAssociate Professor Sr., SCORE\nSchool of Computer Science Engineering and Information Systems\nVellore Institute of Technology, Vellore")
    r4_desig.font.name = "Times New Roman"
    r4_desig.font.size = Pt(12)

    logo_path = os.path.join(FIG_DIR, "vit_logo.png")
    if os.path.exists(logo_path):
        p_logo = doc.add_paragraph()
        format_paragraph(p_logo, space_before=14, space_after=10, line_spacing=1.0, align=WD_ALIGN_PARAGRAPH.CENTER)
        p_logo.add_run().add_picture(logo_path, width=Inches(2.2))

    p5 = doc.add_paragraph()
    format_paragraph(p5, space_before=10, space_after=0, line_spacing=1.15, align=WD_ALIGN_PARAGRAPH.CENTER)
    r5 = p5.add_run("OCTOBER, 2026")
    r5.font.name = "Times New Roman"
    r5.font.size = Pt(12)
    r5.font.bold = True

    doc.add_page_break()

    # 2. INNER TITLE PAGE
    p_in0 = doc.add_paragraph()
    format_paragraph(p_in0, space_before=14, space_after=8, line_spacing=1.15, align=WD_ALIGN_PARAGRAPH.CENTER)
    r_in0 = p_in0.add_run("A MODEL-AGNOSTIC RUNTIME BEHAVIORAL GOVERNANCE FRAMEWORK FOR AUTONOMOUS AI AGENTS")
    r_in0.font.name = "Times New Roman"
    r_in0.font.size = Pt(15)
    r_in0.font.bold = True
    r_in0.font.color.rgb = RGBColor(0, 32, 96)

    p_in1 = doc.add_paragraph()
    format_paragraph(p_in1, space_before=10, space_after=12, line_spacing=1.15, align=WD_ALIGN_PARAGRAPH.CENTER)
    r_in1 = p_in1.add_run("SWE3004 – Software Design and Development Project\nFinal Project Report")
    r_in1.font.name = "Times New Roman"
    r_in1.font.size = Pt(13)
    r_in1.font.bold = True

    p_in2 = doc.add_paragraph()
    format_paragraph(p_in2, space_before=12, space_after=8, line_spacing=1.15, align=WD_ALIGN_PARAGRAPH.CENTER)
    r_in2 = p_in2.add_run("Submitted in partial fulfillment of the requirements for the degree of\n")
    r_in2.font.name = "Times New Roman"
    r_in2.font.size = Pt(12)
    r_in2_deg = p_in2.add_run("Master of Technology in Software Engineering")
    r_in2_deg.font.name = "Times New Roman"
    r_in2_deg.font.size = Pt(13)
    r_in2_deg.font.bold = True
    r_in2_in = p_in2.add_run("\nin\nDepartment of Software and Systems Engineering")
    r_in2_in.font.name = "Times New Roman"
    r_in2_in.font.size = Pt(12)

    p_in3 = doc.add_paragraph()
    format_paragraph(p_in3, space_before=14, space_after=6, line_spacing=1.15, align=WD_ALIGN_PARAGRAPH.CENTER)
    r_in3 = p_in3.add_run("by\n")
    r_in3.font.name = "Times New Roman"
    r_in3.font.size = Pt(12)
    r_in3_name = p_in3.add_run("SANTHOSH R")
    r_in3_name.font.name = "Times New Roman"
    r_in3_name.font.size = Pt(13)
    r_in3_name.font.bold = True
    r_in3_reg = p_in3.add_run("\n(Register Number: 22MIS0282)")
    r_in3_reg.font.name = "Times New Roman"
    r_in3_reg.font.size = Pt(12)
    r_in3_reg.font.bold = True

    p_in4 = doc.add_paragraph()
    format_paragraph(p_in4, space_before=14, space_after=10, line_spacing=1.15, align=WD_ALIGN_PARAGRAPH.CENTER)
    r_in4 = p_in4.add_run("Under the guidance of\n")
    r_in4.font.name = "Times New Roman"
    r_in4.font.size = Pt(12)
    r_in4_guide = p_in4.add_run("Dr. PRIYA V")
    r_in4_guide.font.name = "Times New Roman"
    r_in4_guide.font.size = Pt(13)
    r_in4_guide.font.bold = True
    r_in4_desig = p_in4.add_run("\nAssociate Professor Sr., SCORE\nSchool of Computer Science Engineering and Information Systems\nVellore Institute of Technology, Vellore")
    r_in4_desig.font.name = "Times New Roman"
    r_in4_desig.font.size = Pt(12)

    if os.path.exists(logo_path):
        p_in_logo = doc.add_paragraph()
        format_paragraph(p_in_logo, space_before=14, space_after=10, line_spacing=1.0, align=WD_ALIGN_PARAGRAPH.CENTER)
        p_in_logo.add_run().add_picture(logo_path, width=Inches(2.2))

    p_in5 = doc.add_paragraph()
    format_paragraph(p_in5, space_before=10, space_after=0, line_spacing=1.15, align=WD_ALIGN_PARAGRAPH.CENTER)
    r_in5 = p_in5.add_run("OCTOBER, 2026")
    r_in5.font.name = "Times New Roman"
    r_in5.font.size = Pt(12)
    r_in5.font.bold = True

    doc.add_page_break()

    # 3. DECLARATION
    add_heading_1(doc, "DECLARATION")
    
    p_dec1 = doc.add_paragraph()
    format_paragraph(p_dec1, space_before=12, space_after=12, line_spacing=1.5, align=WD_ALIGN_PARAGRAPH.JUSTIFY, first_line_indent=0.5)
    p_dec1.add_run(
        "I hereby declare that the SWE3004 – Software Design and Development Project entitled "
        "“A Model-Agnostic Runtime Behavioral Governance Framework for Autonomous AI Agents” "
        "submitted by me, for the award of the degree of Master of Technology in Software Engineering in "
        "the Department of Software and Systems Engineering, School of Computer Science Engineering and "
        "Information Systems to Vellore Institute of Technology (VIT), Vellore is a record of bonafide work "
        "carried out by me under the supervision and guidance of Dr. Priya V, Associate Professor Sr., SCORE, "
        "Vellore Institute of Technology, Vellore."
    )
    
    p_dec2 = doc.add_paragraph()
    format_paragraph(p_dec2, space_before=12, space_after=24, line_spacing=1.5, align=WD_ALIGN_PARAGRAPH.JUSTIFY, first_line_indent=0.5)
    p_dec2.add_run(
        "I further declare that the work reported in this project has not been submitted and will not be "
        "submitted, either in part or in full, for the award of any other degree or diploma in this institute "
        "or any other institute or university."
    )

    t_dec = doc.add_table(rows=2, cols=2)
    t_dec.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_dec, val="none")
    t_dec.rows[0].cells[0].paragraphs[0].text = "Place: Vellore\nDate: "
    t_dec.rows[0].cells[1].paragraphs[0].text = "\n\n___________________________________\nSignature of the Candidate\nSANTHOSH R (22MIS0282)"
    t_dec.rows[0].cells[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT

    doc.add_page_break()

    # 4. CERTIFICATE
    add_heading_1(doc, "CERTIFICATE")
    
    p_cert1 = doc.add_paragraph()
    format_paragraph(p_cert1, space_before=12, space_after=12, line_spacing=1.5, align=WD_ALIGN_PARAGRAPH.JUSTIFY, first_line_indent=0.5)
    p_cert1.add_run(
        "This is to certify that the SWE3004 – Software Design and Development Project entitled "
        "“A Model-Agnostic Runtime Behavioral Governance Framework for Autonomous AI Agents” submitted by "
        "SANTHOSH R (Register Number: 22MIS0282), School of Computer Science Engineering and Information Systems (SCORE), "
        "VIT Vellore, for the award of the degree of Master of Technology in Software Engineering in the "
        "Department of Software and Systems Engineering, is a record of bonafide work carried out by him under "
        "my supervision during the period from 06.07.2026 to 03.11.2026, as per the VIT code of academic and "
        "research ethics."
    )

    p_cert2 = doc.add_paragraph()
    format_paragraph(p_cert2, space_before=12, space_after=24, line_spacing=1.5, align=WD_ALIGN_PARAGRAPH.JUSTIFY, first_line_indent=0.5)
    p_cert2.add_run(
        "The contents of this report have not been submitted and will not be submitted either in part or in full, "
        "for the award of any other degree or diploma in this institute or any other institute or university. "
        "The project fulfills the requirements and regulations of the University and in my opinion meets the "
        "necessary academic and professional standards for submission."
    )

    t_cert = doc.add_table(rows=3, cols=2)
    t_cert.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_cert, val="none")
    t_cert.rows[0].cells[0].paragraphs[0].text = "Place: Vellore\nDate: "
    t_cert.rows[0].cells[1].paragraphs[0].text = "\n___________________________________\nSignature of the VIT-SCORE Guide\nDr. PRIYA V\nAssociate Professor Sr., SCORE"
    t_cert.rows[0].cells[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT

    t_cert.rows[1].cells[0].paragraphs[0].text = "\n\n_______________________\nInternal Examiner"
    t_cert.rows[1].cells[1].paragraphs[0].text = "\n\n_______________________\nExternal Examiner"
    t_cert.rows[1].cells[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT

    t_cert.rows[2].cells[0].paragraphs[0].text = "\n\n\n___________________________________\nHead of the Department\nDr. THANAPAL P\nDepartment of Software and Systems Engineering"

    doc.add_page_break()

    # 5. ACKNOWLEDGEMENT
    add_heading_1(doc, "ACKNOWLEDGEMENT")
    
    p_ack1 = doc.add_paragraph()
    format_paragraph(p_ack1, space_before=12, space_after=10, line_spacing=1.5, align=WD_ALIGN_PARAGRAPH.JUSTIFY, first_line_indent=0.5)
    p_ack1.add_run(
        "It is my distinct privilege and pleasure to express with a deep sense of gratitude to my Project Guide, "
        "Dr. Priya V, Associate Professor Sr., School of Computer Science Engineering and Information Systems, "
        "Vellore Institute of Technology, Vellore, for her invaluable guidance, constant encouragement, perceptive "
        "criticism, and meticulous feedback throughout this research endeavor. Her insightful expertise in software "
        "engineering methodologies, system architectures, and reliable computing has been an indispensable pillar "
        "in conceptualizing, implementing, and validating AgentSentinel."
    )

    p_ack2 = doc.add_paragraph()
    format_paragraph(p_ack2, space_before=8, space_after=10, line_spacing=1.5, align=WD_ALIGN_PARAGRAPH.JUSTIFY, first_line_indent=0.5)
    p_ack2.add_run(
        "I would like to express my heartfelt gratitude to our Honorable Chancellor Dr. G. Viswanathan; respected "
        "Vice Presidents Dr. Sankar Viswanathan and Dr. Sekar Viswanathan; Vice Chancellor Dr. V. S. Kanchana Bhaaskaran; "
        "Pro-Vice Chancellor Dr. Partha Sharathi Mallick; and Registrar Dr. Jayabarathi T, for providing world-class "
        "infrastructure, scholarly resources, and an inspiring academic environment that fosters cutting-edge research "
        "and technological innovation."
    )

    p_ack3 = doc.add_paragraph()
    format_paragraph(p_ack3, space_before=8, space_after=10, line_spacing=1.5, align=WD_ALIGN_PARAGRAPH.JUSTIFY, first_line_indent=0.5)
    p_ack3.add_run(
        "My whole-hearted thanks to Dean Dr. Daphne Lopez, School of Computer Science Engineering and Information Systems (SCORE); "
        "Head of the Department of Software and Systems Engineering Dr. Thanapal P; M.Tech Software Engineering Project Coordinators "
        "Dr. Thilagavathi M and Dr. Brijendra Singh; SCORE School Project Coordinator Dr. Karthikeyan P; and all faculty and staff "
        "members of the department for their continuous guidance, administrative support, and scholastic encouragement "
        "throughout my course of study."
    )

    p_ack4 = doc.add_paragraph()
    format_paragraph(p_ack4, space_before=8, space_after=20, line_spacing=1.5, align=WD_ALIGN_PARAGRAPH.JUSTIFY, first_line_indent=0.5)
    p_ack4.add_run(
        "It is indeed a profound pleasure to thank my parents, family members, and friends who unceasingly supported, "
        "persuaded, and encouraged me to undertake and complete my project successfully. Finally, I convey my sincere "
        "appreciation to all those who have contributed directly or indirectly toward the realization of this dissertation."
    )

    p_ack_sign = doc.add_paragraph()
    format_paragraph(p_ack_sign, space_before=12, space_after=0, line_spacing=1.15, align=WD_ALIGN_PARAGRAPH.RIGHT)
    p_ack_sign.add_run("SANTHOSH R\n(Reg. No: 22MIS0282)")

    doc.add_page_break()

    # 6. EXECUTIVE SUMMARY
    add_heading_1(doc, "EXECUTIVE SUMMARY")
    
    p_es1 = doc.add_paragraph()
    format_paragraph(p_es1, space_before=12, space_after=10, line_spacing=1.5, align=WD_ALIGN_PARAGRAPH.JUSTIFY, first_line_indent=0.5)
    p_es1.add_run(
        "Autonomous Artificial Intelligence (AI) agents powered by Large Language Models (LLMs) and equipped with "
        "function-calling or tool-use capabilities are increasingly deployed to execute complex, multi-step tasks across "
        "operating systems, databases, cloud APIs, and enterprise software ecosystems. However, granting execution autonomy "
        "to probabilistic language models introduces severe software engineering and security vulnerabilities: agents are "
        "inherently susceptible to direct and indirect prompt injection, adversarial goal drift, unconstrained privilege escalation, "
        "and accidental resource destruction. Existing security paradigms—such as static prompt pre-filtering (e.g., Llama-Guard) "
        "or post-execution log audits—fail because multi-step attack trajectories often consist of individually benign actions "
        "that only become malicious in sequence. Furthermore, employing an LLM as its own runtime guardrail introduces prohibitive "
        "inference latency (25–35 seconds per check) and remains susceptible to the same adversarial subversions."
    )

    p_es2 = doc.add_paragraph()
    format_paragraph(p_es2, space_before=8, space_after=10, line_spacing=1.5, align=WD_ALIGN_PARAGRAPH.JUSTIFY, first_line_indent=0.5)
    p_es2.add_run(
        "To solve this critical challenge, this dissertation presents AgentSentinel: an out-of-band, model-agnostic runtime "
        "behavioral governance framework that operationalizes James P. Anderson’s classical 1972 Reference Monitor concept "
        "for modern agentic AI systems. Mediating between the agent proposal engine (such as LangChain or a local Qwen3 model via "
        "Ollama) and underlying host callables, AgentSentinel intercepts every proposed tool invocation prior to execution. "
        "The intercepted action is normalized into canonical semantic primitives, appended to an in-memory temporal sliding window, "
        "and transformed into a 22-dimensional behavioral feature vector capturing action categories, mutation flags, transition dynamics "
        "(such as read-to-write escalations), and inter-action time deltas. A dual-engine evaluates the action: a trained Random Forest "
        "classifier (100 estimators) calculates a continuous behavioral risk score [0.0, 1.0], while a deterministic Task Authorization "
        "Engine verifies compliance against declared task capability grants. An authoritative Policy Fusion Engine reconciles these "
        "signals under five mandatory security invariants, outputting an authoritative verdict: ALLOW, ALERT, or BLOCK."
    )

    p_es3 = doc.add_paragraph()
    format_paragraph(p_es3, space_before=8, space_after=14, line_spacing=1.5, align=WD_ALIGN_PARAGRAPH.JUSTIFY, first_line_indent=0.5)
    p_es3.add_run(
        "Crucially, when AgentSentinel issues a BLOCK decision, physical tool execution is strictly ZERO—the underlying host "
        "callable is never invoked, and a synthetic error is returned to the agent to force safe replanning. Every interception is "
        "correlated through a unique UUIDv4 interception key and persisted into an append-only relational audit ledger. Evaluated on "
        "the held-out ATBench trajectory benchmark (1,000 trajectories, 503 safe / 497 unsafe, 75/25 stratified split), the Random Forest "
        "classifier achieves 72.40% accuracy, 78.95% precision, and an ROC-AUC of 0.7782 with an end-to-end mediation latency overhead "
        "of only 14.2 milliseconds. Crucially, the 39.52% false negative rate of standalone ML provides rigorous empirical justification "
        "for the hybrid fusion architecture, proving that statistical risk modeling must be anchored by deterministic task contracts "
        "and invariant enforcement. The complete system is verified across 152 automated unit/integration tests and visualized through "
        "a 14-screen interactive React observability dashboard."
    )

    doc.add_page_break()

    # 7. TABLE OF CONTENTS
    add_heading_1(doc, "TABLE OF CONTENTS")
    
    t_toc = doc.add_table(rows=1, cols=3)
    t_toc.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_toc, val="none")
    hdr = t_toc.rows[0].cells
    hdr[0].paragraphs[0].text = "Chapter"
    hdr[0].paragraphs[0].runs[0].font.bold = True
    hdr[1].paragraphs[0].text = "Title"
    hdr[1].paragraphs[0].runs[0].font.bold = True
    hdr[2].paragraphs[0].text = "Page No."
    hdr[2].paragraphs[0].runs[0].font.bold = True
    hdr[2].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT

    toc_items = [
        ("", "Declaration", "iii"),
        ("", "Certificate", "iv"),
        ("", "Acknowledgement", "v"),
        ("", "Executive Summary", "vi"),
        ("", "Table of Contents", "viii"),
        ("", "List of Figures", "xii"),
        ("", "List of Tables", "xiv"),
        ("", "List of Abbreviations", "xv"),
        ("", "Symbols and Notations", "xvi"),
        ("1", "INTRODUCTION", "1"),
        ("1.1", "Objective", "2"),
        ("1.2", "Motivation", "2"),
        ("1.3", "Background and Context", "3"),
        ("1.4", "Runtime Reference Monitor Concepts", "4"),
        ("1.5", "Significance of the Work", "4"),
        ("1.6", "Contributions", "5"),
        ("1.7", "Organization of the Report", "5"),
        ("2", "DISSERTATION DESCRIPTION AND GOALS", "7"),
        ("2.1", "Problem Statement", "7"),
        ("2.2", "Description of the Project", "8"),
        ("2.3", "Goals and Success Criteria", "8"),
        ("2.4", "Scope and System Boundaries", "9"),
        ("2.5", "Literature Review", "10"),
        ("2.6", "Comparative Analysis of Relevant Systems", "12"),
        ("2.7", "Research Gap & Defensible Scoping", "13"),
        ("2.8", "Research Questions", "13"),
        ("2.9", "Hypotheses", "14"),
        ("2.10", "Critical Synthesis of Prior Art", "14"),
        ("3", "TECHNICAL SPECIFICATION", "16"),
        ("3.1", "Overview of Requirements", "16"),
        ("3.2", "Functional Requirements (FR1–FR12)", "16"),
        ("3.3", "Non-Functional Requirements (NFR1–NFR6)", "17"),
        ("3.4", "Software and Hardware Requirements", "18"),
        ("3.5", "Data Requirements & Benchmark Provenance", "19"),
        ("3.6", "Threat Model and Safety Assumptions", "19"),
        ("3.7", "Assumptions and Dependencies", "20"),
        ("3.8", "Logical Data Model & Schema Architecture", "20"),
        ("3.9", "Requirements Traceability Matrix", "21"),
        ("3.10", "Acceptance Criteria", "21"),
        ("4", "DESIGN APPROACH AND DETAILS", "23"),
        ("4.1", "Architectural Overview", "23"),
        ("4.2", "Component Deconstruction (Modules M1 to M12)", "25"),
        ("4.3", "Runtime Pre-Execution Interception & Enforcement Gate", "27"),
        ("4.4", "Behavioral Feature Engineering Pipeline (22 Features)", "28"),
        ("4.5", "Dual-Engine Behavioral Risk Assessment", "29"),
        ("4.6", "Task-Context Authorization Engine", "30"),
        ("4.7", "Policy Fusion Engine & Decision Invariants", "30"),
        ("4.8", "Persistence & Correlated Audit Ledger", "31"),
        ("4.9", "Research ML Pipeline & Artifact Serialization", "32"),
        ("4.10", "Codes, Standards and Security Invariants", "32"),
        ("4.11", "Constraints, Alternatives and Tradeoffs", "33"),
        ("5", "SCHEDULE, TASKS AND MILESTONES", "34"),
        ("5.1", "Project Period and Planning Approach", "34"),
        ("5.2", "Work Breakdown Structure (WBS)", "34"),
        ("5.3", "Schedule Chart and Timeline", "35"),
        ("5.4", "Version Control and Gravitas Reliability Practices", "36"),
        ("5.5", "Milestone Review Deliverables", "36"),
        ("6", "DISSERTATION DEMONSTRATION", "38"),
        ("6.1", "Demonstration Environment and Launch Runbook", "38"),
        ("6.2", "System Overview (2D Metrics & 3D Topology)", "38"),
        ("6.3", "Live Telemetry Monitoring", "40"),
        ("6.4", "Runtime Playground Scenarios (Safe, Adversarial, Autonomous)", "41"),
        ("6.5", "Decision Explorer & Feature Radar", "45"),
        ("6.6", "Security Trajectories and Transition Graphs", "46"),
        ("6.7", "Governance Policies and Task Authorization Management", "47"),
        ("6.8", "Forensic Audit Trail & Evidence Provenance", "48"),
        ("6.9", "Datasets, Evaluation Metrics & Compliance Reports", "49"),
        ("6.10", "System Diagnostics and Service Health", "51"),
        ("7", "RESULT AND DISCUSSION", "53"),
        ("7.1", "Evaluation Questions and Benchmark Protocol", "53"),
        ("7.2", "Quantitative Model Results & Performance Metrics", "53"),
        ("7.3", "Confusion Matrix and Error Analysis", "54"),
        ("7.4", "Feature Importance Analysis (Gini Impurity)", "55"),
        ("7.5", "Runtime Latency Overheads and Throughput", "55"),
        ("7.6", "Verification of Invariants & Zero Host Execution Proof", "56"),
        ("7.7", "Error Analysis: Explaining the 39.52% Standalone FNR", "56"),
        ("7.8", "Threats to Validity", "57"),
        ("8", "SUMMARY AND CONCLUSION", "58"),
        ("8.1", "Summary of the Project", "58"),
        ("8.2", "Key Findings and Research Contributions", "58"),
        ("8.3", "Limitations Identified", "59"),
        ("8.4", "Future Research and Engineering Directions", "60"),
        ("8.5", "Final Conclusion", "60"),
        ("", "REFERENCES", "61"),
        ("A", "APPENDIX A – Sample Code and Interface Schemas", "63"),
        ("B", "APPENDIX B – System Verification Checklist & Test Evidence", "65"),
        ("C", "APPENDIX C – Glossary & Architectural Acronyms", "66")
    ]

    for num, title, page in toc_items:
        row = t_toc.add_row().cells
        set_cell_margins(row[0], top=40, bottom=40)
        set_cell_margins(row[1], top=40, bottom=40)
        set_cell_margins(row[2], top=40, bottom=40)
        row[0].paragraphs[0].text = num
        row[0].paragraphs[0].runs[0].font.size = Pt(11)
        row[1].paragraphs[0].text = title
        row[1].paragraphs[0].runs[0].font.size = Pt(11)
        if num in ["1", "2", "3", "4", "5", "6", "7", "8", ""]:
            row[1].paragraphs[0].runs[0].font.bold = True
            row[0].paragraphs[0].runs[0].font.bold = True
        row[2].paragraphs[0].text = page
        row[2].paragraphs[0].runs[0].font.size = Pt(11)
        row[2].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT

    doc.add_page_break()

    # 8. LIST OF FIGURES
    add_heading_1(doc, "LIST OF FIGURES")
    
    t_lof = doc.add_table(rows=1, cols=3)
    t_lof.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_lof, val="none")
    hdr_f = t_lof.rows[0].cells
    hdr_f[0].paragraphs[0].text = "Figure No."
    hdr_f[0].paragraphs[0].runs[0].font.bold = True
    hdr_f[1].paragraphs[0].text = "Title"
    hdr_f[1].paragraphs[0].runs[0].font.bold = True
    hdr_f[2].paragraphs[0].text = "Page No."
    hdr_f[2].paragraphs[0].runs[0].font.bold = True
    hdr_f[2].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT

    figures_list = [
        ("4.1", "AgentSentinel System Architecture and End-to-End Governance Data Flow", "24"),
        ("4.2", "Multi-Tier Reference Monitor Architecture and Component Topology", "25"),
        ("4.3", "Runtime Pre-Execution Interception & Enforcement Sequence", "28"),
        ("4.4", "Policy Fusion Logic & Decision Matrix", "31"),
        ("4.5", "Research Machine Learning Pipeline & Artifact Serialization", "32"),
        ("6.1", "Overview Dashboard (2D View with Sentinel Radar & Metrics)", "39"),
        ("6.2", "System Overview 3D Architectural Topology (Policy & Gate Nodes)", "40"),
        ("6.3", "Live Telemetry Stream with Real-Time Risk Gauges", "41"),
        ("6.4a", "Runtime Interactive Playground Configuration View", "42"),
        ("6.4b", "Playground Safe Tool Execution Scenario (ALLOW -> Executed)", "43"),
        ("6.4c", "Playground Adversarial Attack Scenario (BLOCK -> Zero Execution)", "44"),
        ("6.4d", "Autonomous Agent Execution Powered by Local Qwen3:4b LLM", "45"),
        ("6.5", "Decision Explorer Deep-Dive with 22-Feature Radar Chart", "46"),
        ("6.6", "Security Trajectory Timeline and State Transition Graph", "47"),
        ("6.7", "Active Governance Policy Rulebook and Priority Configuration", "48"),
        ("6.8", "Task Contract Registry & Capability Allow/Deny Grids", "48"),
        ("6.9", "Forensic Audit Log Trail Searchable by Interception UUID", "49"),
        ("6.10", "Research Dataset Explorer (ATBench and SyFI Partitions)", "50"),
        ("6.11", "Model Performance Visualizer and Confusion Matrix Display", "50"),
        ("6.12", "System Compliance Audit & Security Posture Summary", "51"),
        ("6.13", "Runtime Settings, Detection Thresholds and Feature Toggles", "52"),
        ("6.14", "System Diagnostics and Component Health Monitor", "52"),
        ("7.1", "Held-Out ATBench Confusion Matrix (N = 250)", "54"),
        ("7.2", "Random Forest Top Feature Importance (Gini Impurity)", "55")
    ]

    for f_num, f_title, f_page in figures_list:
        row = t_lof.add_row().cells
        set_cell_margins(row[0], top=30, bottom=30)
        set_cell_margins(row[1], top=30, bottom=30)
        set_cell_margins(row[2], top=30, bottom=30)
        row[0].paragraphs[0].text = f_num
        row[0].paragraphs[0].runs[0].font.size = Pt(11)
        row[1].paragraphs[0].text = f_title
        row[1].paragraphs[0].runs[0].font.size = Pt(11)
        row[2].paragraphs[0].text = f_page
        row[2].paragraphs[0].runs[0].font.size = Pt(11)
        row[2].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT

    doc.add_page_break()

    # 9. LIST OF TABLES
    add_heading_1(doc, "LIST OF TABLES")
    
    t_lot = doc.add_table(rows=1, cols=3)
    t_lot.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_lot, val="none")
    hdr_t = t_lot.rows[0].cells
    hdr_t[0].paragraphs[0].text = "Table No."
    hdr_t[0].paragraphs[0].runs[0].font.bold = True
    hdr_t[1].paragraphs[0].text = "Title"
    hdr_t[1].paragraphs[0].runs[0].font.bold = True
    hdr_t[2].paragraphs[0].text = "Page No."
    hdr_t[2].paragraphs[0].runs[0].font.bold = True
    hdr_t[2].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT

    tables_list = [
        ("2.1", "Comparative Analysis of Relevant Agent Governance Frameworks", "12"),
        ("3.1", "Requirements Traceability Matrix (RTM)", "21"),
        ("4.1", "Mathematical Specifications of 22 Behavioral Features", "28"),
        ("4.2", "18-Case Policy Fusion Baseline Decision Matrix", "31"),
        ("4.3", "Architectural Tradeoffs, Alternatives and Design Decisions", "33"),
        ("5.1", "Project Schedule, Tasks and Milestone Checkpoints", "35"),
        ("7.1", "Empirical Classification Performance on Held-Out ATBench (N=250)", "53"),
        ("7.2", "Runtime Interception Latency Overheads Across Pipeline Stages", "55"),
        ("B.1", "Automated Pytest Suite Verification Summary (152 Tests)", "65")
    ]

    for t_num, t_title, t_page in tables_list:
        row = t_lot.add_row().cells
        set_cell_margins(row[0], top=30, bottom=30)
        set_cell_margins(row[1], top=30, bottom=30)
        set_cell_margins(row[2], top=30, bottom=30)
        row[0].paragraphs[0].text = t_num
        row[0].paragraphs[0].runs[0].font.size = Pt(11)
        row[1].paragraphs[0].text = t_title
        row[1].paragraphs[0].runs[0].font.size = Pt(11)
        row[2].paragraphs[0].text = t_page
        row[2].paragraphs[0].runs[0].font.size = Pt(11)
        row[2].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT

    doc.add_page_break()

    # 10. LIST OF ABBREVIATIONS
    add_heading_1(doc, "LIST OF ABBREVIATIONS")
    
    t_abrv = doc.add_table(rows=1, cols=2)
    t_abrv.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_abrv, val="none")
    hdr_a = t_abrv.rows[0].cells
    hdr_a[0].paragraphs[0].text = "Abbreviation"
    hdr_a[0].paragraphs[0].runs[0].font.bold = True
    hdr_a[1].paragraphs[0].text = "Full Expansion"
    hdr_a[1].paragraphs[0].runs[0].font.bold = True

    abbreviations = [
        ("AI", "Artificial Intelligence"),
        ("API", "Application Programming Interface"),
        ("AST", "Abstract Syntax Tree"),
        ("ATBench", "Agent Trajectory Benchmark"),
        ("AUC", "Area Under the ROC Curve"),
        ("CRDT", "Conflict-Free Replicated Data Type"),
        ("DoD", "Department of Defense (United States)"),
        ("DTMC", "Discrete-Time Markov Chain"),
        ("FNR", "False Negative Rate"),
        ("FPR", "False Positive Rate"),
        ("HTTP", "Hypertext Transfer Protocol"),
        ("JSON", "JavaScript Object Notation"),
        ("LLM", "Large Language Model"),
        ("MCP", "Model Context Protocol"),
        ("ML", "Machine Learning"),
        ("NFR", "Non-Functional Requirement"),
        ("NIST", "National Institute of Standards and Technology"),
        ("ORM", "Object-Relational Mapping"),
        ("OS", "Operating System"),
        ("OWASP", "Open Web Application Security Project"),
        ("PAC", "Probably Approximately Correct"),
        ("ReAct", "Reasoning and Acting (Prompt Paradigm)"),
        ("REST", "Representational State Transfer"),
        ("ROC", "Receiver Operating Characteristic"),
        ("RTM", "Requirements Traceability Matrix"),
        ("SDK", "Software Development Kit"),
        ("SSE", "Server-Sent Events"),
        ("SyFI", "Systemic Fault Injection (Dataset Trace Repository)"),
        ("TNR", "True Negative Rate (Specificity)"),
        ("TPR", "True Positive Rate (Recall / Sensitivity)"),
        ("UI", "User Interface"),
        ("UUID", "Universally Unique Identifier"),
        ("VIT", "Vellore Institute of Technology"),
        ("WBS", "Work Breakdown Structure"),
        ("WCAG", "Web Content Accessibility Guidelines")
    ]

    for abrv, full in abbreviations:
        row = t_abrv.add_row().cells
        set_cell_margins(row[0], top=20, bottom=20)
        set_cell_margins(row[1], top=20, bottom=20)
        row[0].paragraphs[0].text = abrv
        row[0].paragraphs[0].runs[0].font.bold = True
        row[0].paragraphs[0].runs[0].font.size = Pt(11)
        row[1].paragraphs[0].text = full
        row[1].paragraphs[0].runs[0].font.size = Pt(11)

    doc.add_page_break()

    # 11. SYMBOLS AND NOTATIONS
    add_heading_1(doc, "SYMBOLS AND NOTATIONS")
    
    t_sym = doc.add_table(rows=1, cols=2)
    t_sym.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_sym, val="none")
    hdr_s = t_sym.rows[0].cells
    hdr_s[0].paragraphs[0].text = "Symbol"
    hdr_s[0].paragraphs[0].runs[0].font.bold = True
    hdr_s[1].paragraphs[0].text = "Mathematical Description / Definition"
    hdr_s[1].paragraphs[0].runs[0].font.bold = True

    symbols = [
        ("T", "Agent interaction trajectory sequence: T = {(a_1, t_1), ..., (a_k, t_k)}"),
        ("a_i", "Discrete agent tool action proposed at step i with tool name and arguments"),
        ("t_i", "Unix epoch timestamp corresponding to the submission of action a_i"),
        ("x_22", "22-dimensional continuous behavioral feature vector: x in R^22"),
        ("R_ML", "Estimated behavioral risk probability score output by M5: R_ML in [0.0, 1.0]"),
        ("D_auth", "Deterministic task capability authorization status: D_auth in {PASS, DENY}"),
        ("D_final", "Authoritative policy governance verdict output by M7: D_final in {ALLOW, ALERT, BLOCK}"),
        ("theta_crit", "Critical risk override threshold: theta_crit = 0.85 (forces BLOCK)"),
        ("theta_alert", "Medium risk warning threshold: theta_alert = 0.50 (triggers ALERT)"),
        ("C_allowed", "Set of permitted capability primitives declared in the active Task Contract"),
        ("C_denied", "Set of explicitly prohibited capability primitives in the Task Contract"),
        ("delta_t", "Inter-action latency delta: delta_t = t_i - t_{i-1} (seconds)"),
        ("N", "Total sample size of evaluation benchmark dataset (N = 1,000 trajectories)"),
        ("N_test", "Held-out test partition sample size (N_test = 250 trajectories)"),
        ("G_i", "Mean Gini impurity reduction score for feature i in Random Forest")
    ]

    for sym, desc in symbols:
        row = t_sym.add_row().cells
        set_cell_margins(row[0], top=20, bottom=20)
        set_cell_margins(row[1], top=20, bottom=20)
        row[0].paragraphs[0].text = sym
        row[0].paragraphs[0].runs[0].font.bold = True
        row[0].paragraphs[0].runs[0].font.size = Pt(11)
        row[1].paragraphs[0].text = desc
        row[1].paragraphs[0].runs[0].font.size = Pt(11)

    doc.add_page_break()
    print("Front matter generated successfully.")
