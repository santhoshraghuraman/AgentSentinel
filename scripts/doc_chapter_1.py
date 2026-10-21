"""
Chapter 1: Introduction for AgentSentinel M.Tech Dissertation.
"""

import docx
from docx.shared import Inches, Pt
from scripts.doc_helpers import (
    add_heading_1, add_heading_2, add_heading_3,
    add_body_p, add_bullet_p, add_equation
)

def build_chapter_1(doc):
    add_heading_1(doc, "CHAPTER 1\nINTRODUCTION")

    # Introductory lead paragraph
    add_body_p(doc, 
        "The rapid evolution of Artificial Intelligence (AI) over the past decade has transitioned machine learning "
        "from isolated predictive models into highly autonomous, generative decision-making agents. Powered by Large "
        "Language Models (LLMs) and advanced cognitive prompting frameworks such as ReAct (Reasoning and Acting), "
        "modern AI agents no longer merely generate passive natural language responses. Instead, they are increasingly "
        "endowed with active agency: the computational authority to formulate multi-step execution plans, invoke external "
        "software tools, issue shell commands, interact with production databases, make HTTP requests to third-party "
        "APIs, and directly manipulate host file systems. This paradigm shift—termed agentic AI—promises unprecedented "
        "productivity gains across automated software engineering, autonomous IT operations, enterprise workflow "
        "orchestration, and scientific discovery.",
        first_line_indent=0
    )

    add_body_p(doc,
        "However, this emergent autonomy introduces profound software engineering, reliability, and security vulnerabilities. "
        "Because LLMs operate probabilistically rather than deterministically, their runtime behavior cannot be bounded "
        "by conventional static compile-time verification. When an autonomous agent is given real execution authority "
        "over an underlying operating system, any deviation in its cognitive reasoning—whether triggered by adversarial "
        "prompt injection, accidental hallucinations, ambiguous instructions, or multi-turn goal drift—can translate "
        "instantaneously into destructive or unauthorized physical actions. In security-sensitive enterprise environments, "
        "an autonomous agent executing an unvalidated command can overwrite critical configuration files, drop production "
        "database tables, exfiltrate sensitive credentials, or execute arbitrary remote scripts."
    )

    add_body_p(doc,
        "This dissertation investigates the design, implementation, and empirical validation of AgentSentinel: a novel, "
        "model-agnostic runtime behavioral governance framework for autonomous AI agents. Drawing foundational inspiration "
        "from James P. Anderson’s classical 1972 Reference Monitor concept, AgentSentinel mediates every tool call proposed "
        "by an AI agent prior to host execution, providing low-latency behavioral risk assessment, deterministic task "
        "capability verification, policy fusion under rigorous security invariants, guaranteed zero host execution on "
        "policy violations, and immutable, non-repudiable audit logging."
    )

    # 1.1 Objective
    add_heading_2(doc, "1.1 Objective")
    add_body_p(doc,
        "The primary objective of this research is to design, develop, and empirically evaluate AgentSentinel—an external, "
        "out-of-band runtime reference monitor that provides robust behavioral governance for autonomous AI agents without "
        "requiring internal model retraining, parameter fine-tuning, or proprietary agent framework dependencies. "
        "The specific research and engineering objectives include:",
        first_line_indent=0
    )

    add_bullet_p(doc, " To design a universal, model-agnostic interception boundary that intercepts proposed tool calls prior to physical execution on the underlying host operating system.", "1. Pre-Execution Interception Architecture:")
    add_bullet_p(doc, " To construct an automated feature engineering pipeline that transforms raw agent interaction trajectories into a 22-dimensional continuous behavioral feature vector capturing action categories, state mutations, transition dynamics, and inter-action time deltas.", "2. Temporal Behavioral Feature Extraction:")
    add_bullet_p(doc, " To train and integrate a supervised Random Forest classification engine capable of inferring behavioral anomaly risk from continuous trajectory features with low computational overhead.", "3. Dual-Engine Risk Modeling:")
    add_bullet_p(doc, " To implement a deterministic capability authorization engine that enforces fine-grained, task-specific allow/deny constraints across tool primitives.", "4. Task-Context Authorization:")
    add_bullet_p(doc, " To develop an authoritative Policy Fusion Engine that reconciles statistical ML risk scores and deterministic task constraints under five mandatory security invariants, outputting explicit ALLOW, ALERT, or BLOCK verdicts.", "5. Authoritative Policy Fusion:")
    add_bullet_p(doc, " To guarantee that whenever an action is blocked, physical callable execution on the host machine is strictly ZERO, and to record a correlated, non-repudiable audit event in an SQLite persistence ledger.", "6. Zero-Execution Enforcement and Auditability:")
    add_bullet_p(doc, " To validate the framework against the established ATBench benchmark dataset and demonstrate end-to-end operation across 14 interactive observability dashboard screens.", "7. Empirical Benchmarking and Observability:")

    # 1.2 Motivation
    add_heading_2(doc, "1.2 Motivation")
    add_body_p(doc,
        "The motivation for this research stems from three critical vulnerabilities currently undermining the safe deployment "
        "of autonomous AI agents in software engineering and enterprise environments:",
        first_line_indent=0
    )

    add_body_p(doc,
        "First, Large Language Models are inherently susceptible to Prompt Injection vulnerabilities (classified as LLM01 "
        "in the OWASP Top 10 for LLM Applications). Both direct prompt injections (where a user crafts an adversarial input) "
        "and indirect prompt injections (where untrusted external data retrieved by the agent—such as a webpage, email, or "
        "code snippet—contains embedded instructions) can hijack the agent's goal structure. Once hijacked, the agent "
        "proposes malicious tool calls using its legitimate execution privileges. Traditional perimeter firewalls and input "
        "sanitizers cannot reliably detect indirect injections embedded deep within complex, multi-modal context windows."
    )

    add_body_p(doc,
        "Second, existing agent safety solutions suffer from a dangerous architectural dichotomy. On one hand, static pre-prompt "
        "filters (such as Meta’s Llama-Guard or OpenAI Moderation API) evaluate only the user's initial prompt in isolation, "
        "completely blind to the emergent multi-step execution trajectory. On the other hand, post-execution log analyzers "
        "(such as standard SIEMs) operate post-mortem: they record the security breach only after the destructive payload "
        "has already executed on the host system. What is urgently needed is an out-of-band supervisor that operates at runtime, "
        "evaluating actions before they touch the host environment."
    )

    add_body_p(doc,
        "Third, asking an LLM to evaluate its own safety at runtime (self-supervision) introduces severe latency and reliability "
        "failures. Querying an LLM guardrail on every agent step adds between 25 and 35 seconds of round-trip latency, rendering "
        "interactive agent systems completely unusable. Furthermore, an LLM guardrail shares the exact same cognitive "
        "vulnerabilities and jailbreak susceptibilities as the agent it is tasked with monitoring. AgentSentinel solves "
        "this by deploying a lightweight, statistical machine learning model (Random Forest) combined with deterministic "
        "policy logic, achieving comprehensive behavioral governance in under 15 milliseconds of median latency."
    )

    # 1.3 Background and Context
    add_heading_2(doc, "1.3 Background and Context")
    add_body_p(doc,
        "To ground this investigation, it is necessary to examine how autonomous agents interact with computing environments. "
        "In a canonical ReAct paradigm, an agent maintains a conversational state consisting of thoughts, actions, and observations. "
        "When an agent decides to invoke an external tool, it outputs a structured JSON object specifying the target function "
        "and its invocation arguments. For example, a code-assistant agent might propose:",
        first_line_indent=0
    )

    add_body_p(doc,
        "{\"tool\": \"write_file\", \"arguments\": {\"path\": \"/var/log/audit.log\", \"content\": \"\"}}",
        first_line_indent=0.5
    )

    add_body_p(doc,
        "In un-governed agent architectures (such as native LangChain, AutoGPT, or raw OpenAI function calling), this JSON "
        "payload is passed directly to Python's `eval()`, `subprocess.run()`, or a native OS API. If the action is malicious, "
        "the operating system executes it with the full privileges of the host process. The core technical problem is that "
        "the host operating system cannot distinguish between a legitimate action proposed by an agent fulfilling a user's task "
        "and an adversarial action resulting from a prompt injection jailbreak."
    )

    # 1.4 Runtime Reference Monitor Concepts
    add_heading_2(doc, "1.4 Runtime Reference Monitor Concepts")
    add_body_p(doc,
        "In 1972, James P. Anderson published his seminal Air Force technical report, 'Computer Security Technology Planning Study', "
        "which established the theoretical foundation of modern computer security: the Reference Monitor. Anderson posited "
        "that any mechanism responsible for enforcing access control and operational safety across computing subjects and "
        "objects must satisfy three immutable properties:",
        first_line_indent=0
    )

    add_bullet_p(doc, " The reference monitor must intercept every access request made by every subject to every object. No operation can bypass the mediation boundary through alternative invocation channels.", "1. Complete Mediation:")
    add_bullet_p(doc, " The reference monitor must be protected from unauthorized modification or subversion by untrusted subjects, maintaining self-contained execution integrity.", "2. Tamper Resistance:")
    add_bullet_p(doc, " The reference monitor must be small, simple, and transparent enough to be subjected to systematic mathematical analysis, testing, and formal verification.", "3. Verifiability:")

    add_body_p(doc,
        "AgentSentinel operationalizes these three classical principles for generative AI agent systems. It achieves Complete "
        "Mediation by wrapping all host callable tools in a pre-execution interceptor (M8). It maintains Tamper Resistance "
        "by executing as an out-of-band Python middleware completely decoupled from the LLM’s context memory. It ensures "
        "Verifiability by implementing transparent, 22-dimensional feature extraction, deterministic task contracts, and "
        "formally auditable policy fusion invariants."
    )

    # 1.5 Significance of the Work
    add_heading_2(doc, "1.5 Significance of the Work")
    add_body_p(doc,
        "The significance of AgentSentinel lies in resolving the fundamental conflict between agent autonomy and system "
        "safety. By providing model-agnostic governance, AgentSentinel decouples safety verification from model training. "
        "Organizations can freely upgrade, substitute, or fine-tune their underlying LLMs (e.g., swapping from GPT-4 to Claude 3.5, "
        "Llama 3, or a local Qwen3 model) without re-architecting their safety guardrails or re-auditing compliance rules. "
        "Furthermore, by enforcing guaranteed zero host execution on violations, AgentSentinel provides a definitive defensive "
        "backstop that prevents untrusted agent actions from corrupting host files, leaking secrets, or executing unauthorized code.",
        first_line_indent=0
    )

    # 1.6 Contributions
    add_heading_2(doc, "1.6 Contributions")
    add_body_p(doc,
        "This dissertation delivers the following specific engineering and research contributions:",
        first_line_indent=0
    )

    add_bullet_p(doc, " The architectural design and implementation of an integrated, 12-module (M1–M12) runtime behavioral governance framework in Python/FastAPI that intercepts agent tool calls prior to execution.", "1. Integrated Reference Monitor Architecture:")
    add_bullet_p(doc, " A formal feature engineering pipeline that transforms streaming agent trajectories into a 22-dimensional feature vector capturing categorical distributions, state mutations, transition dynamics, and temporal deltas.", "2. Twenty-Two Dimensional Feature Vector:")
    add_bullet_p(doc, " A hybrid decision engine that combines statistical machine learning (Random Forest with 100 estimators) and deterministic task-context capabilities, reconciled under five mandatory security invariants with strict cross-tier precedence (BLOCK > ALERT > ALLOW).", "3. Invariant-Driven Policy Fusion:")
    add_bullet_p(doc, " Rigorous empirical proof that blocked actions experience strictly ZERO host callable executions, with end-to-end evidence preserved in an append-only relational audit ledger.", "4. Guaranteed Zero Host Execution:")
    add_bullet_p(doc, " Comprehensive evaluation on 1,000 ATBench trajectories (72.40% accuracy, 78.95% precision, 0.7782 ROC-AUC) demonstrating the necessity of hybrid defense over standalone ML (which exhibits a 39.52% false negative rate).", "5. Empirical Research Benchmarking:")
    add_bullet_p(doc, " A full-featured React 19/TypeScript observability dashboard comprising 14 interactive screens for live telemetry, scenario playground execution, decision exploration, and forensic audit investigation.", "6. Production Observability Dashboard:")

    # 1.7 Organization of the Report
    add_heading_2(doc, "1.7 Organization of the Report")
    add_body_p(doc,
        "The remainder of this dissertation is organized as follows: Chapter 2 presents a comprehensive literature review "
        "surveying 15 relevant research works, formalizes the research problem, defines success criteria, and scopes the research gap. "
        "Chapter 3 establishes the technical specifications, functional and non-functional requirements, data provenance, and "
        "threat model. Chapter 4 provides the deep architectural deconstruction of Modules M1 to M12, feature mathematical definitions, "
        "policy fusion algorithms, and design tradeoffs. Chapter 5 outlines the project schedule, work breakdown structure, and "
        "Gravitas engineering quality practices. Chapter 6 presents the system demonstration across all 14 dashboard screens and "
        "playground scenarios. Chapter 7 analyzes experimental results, confusion matrices, feature importances, latency overheads, "
        "and threats to validity. Chapter 8 summarizes key findings, discusses limitations, and outlines future research directions.",
        first_line_indent=0
    )

    doc.add_page_break()
    print("Chapter 1 generated successfully.")
