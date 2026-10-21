"""
Chapter 2: Dissertation Description and Goals (Literature Review) for AgentSentinel.
"""

import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from scripts.doc_helpers import (
    add_heading_1, add_heading_2, add_heading_3,
    add_body_p, add_bullet_p, add_table_caption, add_equation,
    set_cell_background, set_cell_margins, set_table_borders
)

def build_chapter_2(doc):
    add_heading_1(doc, "CHAPTER 2\nDISSERTATION DESCRIPTION AND GOALS")

    # Introductory lead paragraph
    add_body_p(doc,
        "Engineering reliable and secure runtime environments for autonomous AI agents requires a thorough investigation "
        "of existing literature across computer security, runtime verification, machine learning guardrails, and access control. "
        "This chapter formalizes the core research problem, delineates project goals and system boundaries, surveys 15 relevant "
        "prior-art systems, provides an empirical comparative matrix, defines the defensible research gap, and establishes "
        "the guiding research questions and hypotheses.",
        first_line_indent=0
    )

    # 2.1 Problem Statement
    add_heading_2(doc, "2.1 Problem Statement")
    add_body_p(doc,
        "Let an autonomous AI agent operate in an environment over a discrete interaction session. At each step $k$, the agent "
        "observes conversational and environmental state $s_k$, generates internal reasoning $\\rho_k$, and proposes a tool action $a_k$. "
        "The interaction history is represented as a temporal trajectory $\\mathcal{T}_k$:",
        first_line_indent=0
    )

    add_equation(doc, "\\mathcal{T}_k = \\{ (a_1, t_1), (a_2, t_2), \\dots, (a_k, t_k) \\}, \\quad a_i \\in \\mathcal{A}, \\; t_i \\in \\mathbb{R}^+", "2.1")

    add_body_p(doc,
        "where each action $a_i = (\\text{tool}_i, \\text{args}_i)$ defines an invocation of tool primitive $\\text{tool}_i$ with argument payload "
        "$\\text{args}_i$, and $t_i$ denotes the corresponding Unix epoch timestamp. In un-governed execution, the host operating system "
        "executes a mapping function $\\Phi: \\mathcal{A} \\to \\mathcal{S}_{env}$ where $\\mathcal{S}_{env}$ is the host system state."
    )

    add_body_p(doc,
        "The fundamental security problem arises because modern adversarial threats—such as multi-step prompt injection, "
        "data exfiltration, and privilege escalation—do not manifest as isolated, syntax-violating commands. Instead, an adversarial "
        "trajectory $\\mathcal{T}_{adv}$ is synthesized dynamically where every constituent action $a_i$ appears completely benign when "
        "evaluated in isolation. For instance, consider the three-step sequence:",
        first_line_indent=0.5
    )

    add_bullet_p(doc, " a_1 = (\\text{\"read_file\"}, \\{\\text{\"path\"}: \\text{\"/etc/shadow\"}\\}) — A standard read-only file access.", "Step 1:")
    add_bullet_p(doc, " a_2 = (\\text{\"base64_encode\"}, \\{\\text{\"data\"}: \\text{content}\\}) — An in-memory data transformation.", "Step 2:")
    add_bullet_p(doc, " a_3 = (\\text{\"http_post\"}, \\{\\text{\"url\"}: \\text{\"https://attacker.io/sink\"}, \\dots\\}) — A standard outbound web request.", "Step 3:")

    add_body_p(doc,
        "A static, single-action access control list (ACL) or prompt filter inspecting $a_1$, $a_2$, or $a_3$ independently will "
        "permit all three actions because read, encode, and post primitives are common developer tasks. However, the temporal "
        "composition $a_1 \\to a_2 \\to a_3$ constitutes an illegal credential exfiltration exploit. Therefore, the core research "
        "problem is: How can a lightweight, external reference monitor observe streaming agent trajectories, infer emergent behavioral "
        "risk, verify compliance against declared task capabilities, and enforce pre-execution blocking with sub-25 millisecond latency "
        "and guaranteed zero host execution?"
    )

    # 2.2 Description of the Project
    add_heading_2(doc, "2.2 Description of the Project")
    add_body_p(doc,
        "AgentSentinel is conceived as an out-of-band runtime reference monitor and behavioral governance framework. "
        "Positioned strictly between the agent's action proposal layer (e.g., an LLM such as Qwen3:4b running locally via Ollama) "
        "and the physical host execution environment, AgentSentinel provides end-to-end mediation. The framework is structured "
        "into 12 modular components (M1 through M12) executing in Python/FastAPI, coupled with an SQLite relational persistence "
        "ledger and an interactive React 19 observability dashboard.",
        first_line_indent=0
    )

    add_body_p(doc,
        "When an agent proposes an action, AgentSentinel's Runtime Interceptor (M8) intercepts the JSON payload before the target "
        "callable can be invoked. The action is normalized (M2) into standardized semantic categories and appended to an in-memory "
        "session history (M3). A behavioral feature extractor (M4) computes 22 continuous temporal and categorical features from the "
        "sliding window. These features are evaluated by a trained Random Forest model (M5) to yield an empirical risk score, while "
        "a deterministic Task Authorization Engine (M6) evaluates capability grants. The Policy Fusion Engine (M7) reconciles these "
        "evaluations under five mandatory security invariants. If approved (ALLOW), the action is executed and monitored; if denied "
        "(BLOCK), callable execution is strictly bypassed, an error is returned to the agent, and an immutable audit record is committed."
    )

    # 2.3 Goals and Success Criteria
    add_heading_2(doc, "2.3 Goals and Success Criteria")
    add_body_p(doc,
        "To ensure rigorous software engineering and scientific defensibility, AgentSentinel is evaluated against the following "
        "explicit quantitative success criteria:",
        first_line_indent=0
    )

    add_bullet_p(doc, " The total in-process mediation overhead (feature extraction, ML inference, policy fusion, and persistence) must maintain a median latency under 15 ms and a 95th-percentile (P95) latency under 30 ms.", "G1 — Low-Latency Overhead:")
    add_bullet_p(doc, " On any governance decision of BLOCK, the underlying physical callable invocation count must be exactly 0 (zero host execution).", "G2 — Absolute Zero-Execution on BLOCK:")
    add_bullet_p(doc, " The trained behavioral risk classifier must achieve an overall classification accuracy exceeding 70% and an ROC-AUC exceeding 0.75 on held-out benchmark evaluation splits.", "G3 — Benchmark Risk Detection:")
    add_bullet_p(doc, " 100% of intercepted actions must generate a correlated audit record in the persistence store sharing an identical UUIDv4 interception key linking intent, decision, and execution outcome.", "G4 — Audit Correlation Integrity:")
    add_bullet_p(doc, " The framework must operate completely out-of-band, governing tool calls without requiring access to internal LLM weights, attention matrices, or proprietary agent runtime internals.", "G5 — Model Agnosticism:")

    # 2.4 Scope and System Boundaries
    add_heading_2(doc, "2.4 Scope and System Boundaries")
    add_body_p(doc,
        "Establishing clear boundaries is essential for rigorous software verification. The scope of AgentSentinel encompasses:",
        first_line_indent=0
    )

    add_bullet_p(doc, " Pre-execution interception of tool calls submitted by local or remote AI agents.", "• In-Scope:")
    add_bullet_p(doc, " Feature engineering over discrete action trajectories up to session sliding windows.", "• In-Scope:")
    add_bullet_p(doc, " Hybrid risk estimation (Random Forest + heuristics) and fine-grained task authorization.", "• In-Scope:")
    add_bullet_p(doc, " Enforcement of 5 security invariants and persistence of relational audit records.", "• In-Scope:")
    add_bullet_p(doc, " UI visualization of active sessions, decision radars, telemetry, and compliance reports.", "• In-Scope:")

    add_body_p(doc,
        "Conversely, the following dimensions are explicitly out-of-scope:",
        first_line_indent=0
    )

    add_bullet_p(doc, " Internal model alignment, RLHF fine-tuning, or prompt optimization of the agent LLM.", "• Out-of-Scope:")
    add_bullet_p(doc, " Natural language intent verification of conversational free-text responses that do not invoke tools.", "• Out-of-Scope:")
    add_bullet_p(doc, " Low-level kernel syscall virtualization (e.g., eBPF or seccomp sandboxing at the OS ring-0 level).", "• Out-of-Scope:")
    add_bullet_p(doc, " Multi-node distributed consensus or Byzantine fault tolerance across untrusted clusters.", "• Out-of-Scope:")

    # 2.5 Literature Review
    add_heading_2(doc, "2.5 Literature Review")
    add_body_p(doc,
        "A systematic survey of 15 relevant primary and near-primary research publications was conducted to situate AgentSentinel "
        "within the state of the art in AI agent security, runtime monitoring, access control, and behavioral benchmarking. "
        "The surveyed literature is structured into four thematic paradigms:",
        first_line_indent=0
    )

    add_heading_3(doc, "2.5.1 Classical Reference Monitor Foundations")
    add_body_p(doc,
        "James P. Anderson’s foundational 1972 technical report established that robust access control requires an external, "
        "tamper-resistant reference monitor providing complete mediation. Over five decades, this principle was successfully "
        "implemented in operating systems (e.g., Linux Security Modules, BSD MAC) and virtual machine hypervisors. However, "
        "traditional reference monitors enforce static, identity-based permissions (e.g., DAC/RBAC). In agentic AI, the subject "
        "is a probabilistic reasoning model whose execution path changes dynamically based on stochastic sampling and environmental "
        "feedback. AgentSentinel extends Anderson's paradigm into generative AI by replacing static user credentials with "
        "temporal behavioral feature vectors and task contract contexts."
    )

    add_heading_3(doc, "2.5.2 Static Guardrails and Self-Evaluation")
    add_body_p(doc,
        "Early approaches to generative AI safety focused on prompt pre-filtering and model self-evaluation. Meta’s Llama-Guard "
        "and OpenAI’s Moderation API inspect input prompts to classify safety violations prior to generation. While effective "
        "for single-turn conversational chatbots, these filters fail in multi-turn tool-using agents because malicious trajectories "
        "arise through composition rather than toxic phrasing. More recently, Meta released LlamaFirewall (April 2025), which "
        "includes an AlignmentCheck component for monitoring tool-use alignment. However, AlignmentCheck relies heavily on "
        "repeated LLM reasoning to evaluate safety, introducing substantial latency (often exceeding 5 seconds) and suffering "
        "from vulnerability to jailbreaks."
    )

    add_body_p(doc,
        "Similarly, AgentDoG (Liu et al., 2025) introduces a diagnostic guardrail framework utilizing a three-dimensional "
        "risk taxonomy (Source, Failure Mode, Consequence). While AgentDoG establishes comprehensive risk taxonomies, its runtime "
        "enforcement relies on fine-tuning specialized alignment models rather than providing an external, model-agnostic middleware "
        "that enforces zero execution on arbitrary off-the-shelf agents."
    )

    add_heading_3(doc, "2.5.3 Runtime Verification and Formal Access Control")
    add_body_p(doc,
        "Several recent works explore programmatic privilege control for LLM agents. Progent (Shi et al., April 2025, arXiv:2504.11703) "
        "proposes programmable privilege control where tool privileges are declared using domain-specific policies. However, "
        "Progent evaluates privileges on an action-by-action basis, lacking temporal behavioral history modeling."
    )

    add_body_p(doc,
        "AgentSpec (Wang, Poskitt, and Sun, March 2025, arXiv:2503.18666) introduces customizable runtime enforcement where users "
        "specify safety properties as formal automata or temporal logic specifications. While formally rigorous, AgentSpec requires "
        "users to hand-craft detailed state-machine specifications for every task, which becomes intractable in dynamic enterprise environments. "
        "In follow-up work, ProbGuard (Wang et al., August 2025, arXiv:2508.00500) introduces proactive runtime monitoring using "
        "Discrete-Time Markov Chains (DTMC) and PAC-style bounds to predict safety violations ahead of time. However, ProbGuard's "
        "formal model checking incurs significant state-space exploration overhead that scales exponentially with trajectory length."
    )

    add_body_p(doc,
        "Microsoft FIDES (Costa et al., May 2025, arXiv:2505.23643) applies information-flow control (IFC) to AI agents, tracking "
        "taint propagation from untrusted inputs to sensitive sinks. While IFC provides strong data exfiltration guarantees, it "
        "does not assess behavioral anomaly risk or sequential tool-chain escalation. TraceGrant (August 2026, arXiv:2608.21126) "
        "and TRACES (Li et al., 2025) explore trace-based auditing and proactive safety auditing. TraceGrant represents the nearest "
        "prior art regarding trace-linked authorization; however, AgentSentinel uniquely integrates frozen pre-governance argument "
        "verification with dual-engine ML risk assessment and guaranteed zero execution."
    )

    add_heading_3(doc, "2.5.4 Agentic Trajectory Benchmarks")
    add_body_p(doc,
        "The emergence of trajectory-level benchmark datasets has enabled standardized empirical evaluation. The foremost benchmark "
        "is ATBench (arXiv:2604.02022), which provides 1,000 diverse, realistic agent interaction trajectories spanning benign "
        "and unsafe scenarios. Each trajectory is annotated with binary ground-truth security labels (503 Safe / 497 Unsafe), "
        "capturing complex tool-calling patterns across operating systems, web browsing, and code execution. Complementing ATBench "
        "is the SyFI (Systemic Fault Injection) / TraceLab corpus, which contains over 8,000 observational agent sessions comprising "
        "665,453 interaction steps. AgentSentinel leverages ATBench for supervised behavioral model training and validation, and "
        "SyFI for schema stress-testing."
    )

    # 2.6 Comparative Analysis of Relevant Systems
    add_heading_2(doc, "2.6 Comparative Analysis of Relevant Systems")
    add_body_p(doc,
        "To systematically evaluate the architectural differences between AgentSentinel and existing agent governance solutions, "
        "Table 2.1 presents a comparative feature matrix across eight critical dimensions: Interception Boundary, Model Agnosticism, "
        "Behavioral Trajectory Modeling, Zero Host Execution Guarantee, Hybrid Decision Fusion, Latency Overhead, Audit Immutability, "
        "and Empirical Benchmark Validation.",
        first_line_indent=0
    )

    add_table_caption(doc, "2.1", "Comparative Analysis of Relevant Agent Governance Frameworks")
    
    t_comp = doc.add_table(rows=1, cols=9)
    t_comp.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_comp)
    
    headers = ["Framework", "Boundary", "Model Agnostic", "Behavioral History", "Zero Exec Guarantee", "Hybrid Fusion", "Median Latency", "Audit Trail", "Benchmark"]
    hdr_cells = t_comp.rows[0].cells
    for i, h in enumerate(headers):
        set_cell_background(hdr_cells[i], "1E293B")
        set_cell_margins(hdr_cells[i], top=60, bottom=60, left=40, right=40)
        p = hdr_cells[i].paragraphs[0]
        p.text = h
        p.runs[0].font.name = "Times New Roman"
        p.runs[0].font.size = Pt(9)
        p.runs[0].font.bold = True
        p.runs[0].font.color.rgb = RGBColor(255, 255, 255)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    comp_data = [
        ("AgentSentinel (Proposed)", "Pre-Execution Gate", "Yes (Universal)", "Yes (22 Features)", "Yes (Strict Zero)", "Yes (ML + Contract)", "< 15 ms", "Relational UUID", "ATBench (N=1000)"),
        ("Anderson 1972 (Ref. Mon.)", "OS Syscall Boundary", "N/A (Static OS)", "No (Static ACL)", "Yes (Kernel Trap)", "No (Rule Only)", "< 1 ms", "Syslog", "None (Conceptual)"),
        ("Llama-Guard / Mod.", "Input Prompt Filter", "No (Meta Specific)", "No (Single Turn)", "No (Generates Text)", "No (LLM Classifier)", "> 800 ms", "None", "ToxicChat / Beaver"),
        ("LlamaFirewall (Meta)", "Tool-Use Gate", "Yes (via API)", "No (Context Text)", "Yes (Blocks Call)", "No (LLM Reasoning)", "> 3,500 ms", "App Logs", "Internal Meta Bench"),
        ("AgentDoG (Consortium)", "Internal Guardrail", "No (Model Specific)", "Yes (3D Taxonomy)", "Partial (Soft Halt)", "No (Fine-Tuned LLM)", "> 2,000 ms", "Trace Dumps", "ATBench"),
        ("AgentSpec (2025)", "Runtime Automata", "Yes (Middleware)", "Yes (Automata State)", "Yes (Automata Block)", "No (Formal Logic)", "> 45 ms", "Custom Trace", "Custom Cases"),
        ("ProbGuard (2025)", "Predictive Monitor", "Yes (Middleware)", "Yes (DTMC Model)", "Yes (Threshold Halt)", "No (Prob. Checking)", "> 120 ms", "Model Logs", "AgentBench"),
        ("Progent (UC Berkeley)", "Privilege Gateway", "Yes (SDK Hook)", "No (Per-Action ACL)", "Yes (Gatekeeper)", "No (Policy ACL)", "< 10 ms", "Audit Stream", "Custom Priv. Tests"),
        ("Microsoft FIDES", "Information Flow", "Yes (Language IFC)", "No (Taint Graph)", "Yes (Taint Sink Block)", "No (IFC Rules)", "< 20 ms", "Taint Traces", "Security Scenarios")
    ]

    for row_idx, r in enumerate(comp_data):
        row_cells = t_comp.add_row().cells
        bg_color = "F1F5F9" if row_idx == 0 else ("FFFFFF" if row_idx % 2 == 1 else "F8FAFC")
        for col_idx, val in enumerate(r):
            set_cell_background(row_cells[col_idx], bg_color)
            set_cell_margins(row_cells[col_idx], top=40, bottom=40, left=40, right=40)
            p = row_cells[col_idx].paragraphs[0]
            p.text = val
            p.runs[0].font.name = "Times New Roman"
            p.runs[0].font.size = Pt(8.5)
            if row_idx == 0:
                p.runs[0].font.bold = True
                p.runs[0].font.color.rgb = RGBColor(15, 23, 42)
            if col_idx == 0:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    add_body_p(doc,
        "As established in Table 2.1, AgentSentinel is the only framework that simultaneously achieves model agnosticism, "
        "22-dimensional continuous behavioral feature modeling, guaranteed zero host execution, sub-15 millisecond latency, "
        "and empirical validation on the 1,000-trajectory ATBench benchmark.",
        first_line_indent=0.5
    )

    # 2.7 Research Gap & Defensible Scoping
    add_heading_2(doc, "2.7 Research Gap & Defensible Scoping")
    add_body_p(doc,
        "Based on the literature survey, two major research gaps exist in the current state of the art:",
        first_line_indent=0
    )

    add_body_p(doc,
        "Research Gap 1 — The Latency-Accuracy Dilemma in Agent Monitoring: Existing solutions force an untenable tradeoff. "
        "Formal verification tools (such as AgentSpec and ProbGuard) provide strong mathematical guarantees but incur prohibitive "
        "state-space modeling overheads that scale exponentially with trajectory depth. Conversely, LLM-based guardrails (such as "
        "LlamaFirewall AlignmentCheck) introduce latency penalties exceeding 3,000 milliseconds per check and share the exact same "
        "adversarial jailbreak vulnerabilities as the agents they supervise. Fast rule-based firewalls (such as Progent) achieve low latency "
        "but evaluate actions in isolation, remaining completely blind to multi-step behavioral anomalies."
    )

    add_body_p(doc,
        "Research Gap 2 — Uncharacterized Standalone ML False-Negative Rates: While machine learning classifiers have been proposed "
        "to score agent actions, prior literature rarely characterizes the exact failure modes of standalone ML on benign vs. "
        "adversarial agent workloads. In particular, prior studies fail to recognize that even a well-trained Random Forest model "
        "exhibits a significant False Negative Rate (FNR) when detecting sophisticated, low-footprint attacks. There is a lack "
        "of research on how to architect a hybrid policy fusion layer where deterministic task capability contracts provide a "
        "fail-closed backstop for statistical classification gaps."
    )

    add_body_p(doc,
        "Defensible Research Scoping: In accordance with academic integrity, AgentSentinel does NOT claim to have invented the "
        "Random Forest algorithm, runtime reference monitors, or the concept of access control. Rather, AgentSentinel’s defensible "
        "contribution is the novel integration of an out-of-band pre-execution reference monitor that combines a 22-dimensional "
        "temporal behavioral feature extraction pipeline with deterministic task capability contracts under five mandatory security "
        "invariants, proving empirically that hybrid fusion achieves high-throughput, low-latency safety without sacrificing benign agent utility."
    )

    # 2.8 Research Questions
    add_heading_2(doc, "2.8 Research Questions")
    add_body_p(doc, "To guide this empirical investigation, four primary Research Questions (RQs) are formulated:", first_line_indent=0)

    add_bullet_p(doc, " Can an out-of-band reference monitor govern tool calls proposed by arbitrary, heterogeneous LLM agent architectures without requiring access to internal model weights, prompting templates, or proprietary frameworks?", "RQ1 (Model Agnosticism):")
    add_bullet_p(doc, " How effectively can a 22-dimensional continuous feature vector extracted from streaming interaction trajectories discriminate between benign task fulfillment and adversarial/unsafe trajectories in benchmark datasets?", "RQ2 (Behavioral Feature Efficacy):")
    add_bullet_p(doc, " Can an external interception middleware guarantee absolute zero host callable executions whenever an action violates task contracts or risk thresholds, while preserving non-repudiable audit evidence?", "RQ3 (Zero-Execution Enforcement):")
    add_bullet_p(doc, " What is the empirical latency and computational overhead imposed by runtime interception, feature extraction, ML inference, and relational persistence, and is it compatible with interactive agent deployment?", "RQ4 (Runtime Overhead & Usability):")

    # 2.9 Hypotheses
    add_heading_2(doc, "2.9 Hypotheses")
    add_body_p(doc, "Corresponding to the research questions, three testable academic hypotheses are established:", first_line_indent=0)

    add_bullet_p(doc, " A statistical classifier trained on 22 continuous behavioral trajectory features can achieve a statistically significant classification accuracy exceeding 70% and an ROC-AUC exceeding 0.75 on held-out ATBench trajectory data.", "H1 (Behavioral Risk Discriminiation):")
    add_bullet_p(doc, " A hybrid policy fusion engine combining statistical risk scoring with deterministic task capability contracts will eliminate false negative vulnerabilities inherent to standalone ML models, enforcing strict zero execution on all contract breaches.", "H2 (Hybrid Fusion Superiority):")
    add_bullet_p(doc, " An in-process pre-execution reference monitor implemented in Python/FastAPI can complete end-to-end mediation (interception through persistence) in a median latency under 20 milliseconds, adding less than 1% relative overhead to typical LLM generation cycles.", "H3 (Latency Feasibility):")

    # 2.10 Critical Synthesis of Prior Art
    add_heading_2(doc, "2.10 Critical Synthesis of Prior Art")
    add_body_p(doc,
        "In synthesis, the surveyed literature underscores that runtime governance is an essential, constitutive requirement "
        "for the safe deployment of autonomous AI agents. Purely static prompt pre-filters are structurally incapable of anticipating "
        "emergent multi-step attack trajectories, while post-hoc audit logs record catastrophe only after execution has occurred. "
        "By synthesizing James Anderson’s classical reference monitor principles with modern temporal feature engineering and "
        "hybrid policy fusion, AgentSentinel bridges the critical gap between academic formal verification and practical, "
        "low-latency software engineering.",
        first_line_indent=0
    )

    doc.add_page_break()
    print("Chapter 2 generated successfully.")
