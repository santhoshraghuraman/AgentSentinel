# AgentSentinel: Technical Report Gap & Unknowns Register

**Project Title:** A Model-Agnostic Runtime Behavioral Governance Framework for Autonomous AI Agents  
**Student:** Santhosh R (Reg No: 22MIS0282)  
**Degree:** Master of Technology in Software Engineering  
**Course Code:** SWE3004 – Software Design and Development Project  
**Institution:** School of Computer Science Engineering and Information Systems (SCORE), Department of Software and Systems Engineering, Vellore Institute of Technology (VIT), Vellore  
**Document Purpose:** Academic rigor and transparency register tracking all known discrepancies, non-claims, unverified assumptions, and student-confirmed items.  

---

## 1. Discrepancy Reconciliation & Historical Artifact Gaps

| Item / Claim | Historical Documentation State | Active Code & Empirical Reality | Resolution / Report Policy |
|:---|:---|:---|:---|
| **Module Naming & Hierarchy** | Early notes (`AGENTSENTINEL_LIVE_DEMO_GUIDE.md`) titled M1 as "Agent Identity Verification" and M2 as "Task Contract Context". | Active, tested architecture (`docs/architecture.md`, `src/agentsentinel/`) designates M1 as Data Foundation, M2 as Action Normalizer, and Task Authorization as M6. | **Use Active Code Standard:** Report strictly documents M1 through M12 as defined in the source code. Historical draft names are noted in the appendix as architectural evolution. |
| **ATBench Test Holdout Size** | Some early markdown notes mentioned a 200-sample holdout (80/20 split). | `datasets/evaluation_metrics.json` records 250 test observations (TN=106, FP=20, FN=49, TP=75; 106+20+49+75=250), representing a 75/25 stratified split of 1,000 records. | **Authoritative Reality:** The 250-observation holdout is authoritative and mathematically consistent with the confusion matrix. The report explicitly clarifies the 75/25 split with `random_state=42`. |
| **SyFI Dataset Labeling** | Some early draft proposals implied SyFI might serve as a secondary evaluation benchmark. | `src/agentsentinel/research/datasets.py:60-84` confirms SyFI (8,058 sessions, 665,453 steps) consists of unlabelled observational interaction traces. | **Honest Scoping:** SyFI is presented strictly as an unlabelled telemetry corpus for schema stress-testing and distribution exploration, not as ground-truth benchmark data. |
| **Audit Ledger Hashing** | Conceptual designs discussed SHA-256 Merkle tree chaining or blockchain immutability. | `src/agentsentinel/db/models.py` implements a standard relational SQLite database schema with foreign key constraints. | **Honest Architecture:** Report describes audit persistence as an append-only relational ledger enforced by application-level service constraints, with cryptographic chaining identified as future work. |
| **Live Telemetry Mechanism** | Some presentation slides loosely referred to "real-time streaming". | `ui/src/pages/LiveMonitorPage.tsx:43` configures React Query HTTP polling with `refetchInterval: 3000` (3 seconds). | **Precise Terminology:** Report states telemetry is refreshed via 3-second HTTP polling; WebSockets/SSE are listed as planned operational enhancements. |

---

## 2. Model Performance Transparency & Boundary Non-Claims

| Boundary Dimension | Experimental Observation | Scientific Interpretation & Dissertation Positioning |
|:---|:---|:---|
| **Standalone ML Accuracy** | 72.40% on ATBench held-out test split. | Must **never** be conflated with "72.4% attacks prevented". It indicates that in 72.4% of held-out trajectories, the Random Forest correctly predicted the binary security label based purely on behavioral features. |
| **False Negative Rate (FNR)** | 39.52% (49 false negatives out of 124 unsafe trajectories). | A standalone statistical model that misses 39.52% of attacks is unacceptable as a solitary security control. **This directly substantiates the core thesis of AgentSentinel:** behavioral ML cannot stand alone and must be combined with deterministic task capabilities (M6) and policy invariants (M7). |
| **Top Feature Dependency** | `event_count` (35.65%) and `action_count` (24.11%) account for ~60% of Gini importance. | Trajectory length is a significant statistical predictor in ATBench. The report transparently discusses this potential bias and emphasizes the need for length-normalized benchmark evaluations in future work. |
| **Cross-Domain Generalization** | Evaluation conducted on ATBench benchmark suite. | Does not imply verified zero-shot generalization across unseen LLM agent platforms (e.g., AutoGPT, Devin, or custom robotics stacks). Scoped as benchmark validation. |
| **Formal Security Invariant Proofs**| Invariants I1–I5 tested and passing in automated test suite (`tests/test_audit_integrity.py`). | Tested software invariants implemented in Python middleware, not mathematically verified formal kernel proofs (e.g., via Coq or TLA+). |

---

## 3. Institutional Details Requiring Student Confirmation

| Field / Section | Default Academic Value Inserted | Confirmation Required From Student |
|:---|:---|:---|
| **Faculty Guide Name & Title** | Dr. Priya V, Associate Professor Sr., SCORE, VIT Vellore (verified from `Review 1.pdf`). | Confirm whether any additional designations or co-guides should be listed on the final cover. |
| **Final Dissertation Date** | October 2026 / November 2026 (matching template period: 06.07.2026 to 03.11.2026). | Confirm the official date of final viva-voce or submission prescribed by the SCORE project committee. |
| **Off-Campus Internship Guide** | Marked as `<N/A - Internal Capstone Project>` in certificate page. | Confirm whether this was purely an on-campus capstone project or affiliated with an industry partner. |
| **Declaration & Signatures** | Institutional wording preserved exactly from `MTECH_SE Final Project Report.docx`. | Physical or digital signatures must be applied by student and guide upon printing/final submission. |
| **Word Table of Contents Update** | Word field codes inserted for TOC, List of Figures, and List of Tables. | In Microsoft Word, the student must press `Ctrl+A` then `F9` (or right-click $\to$ *Update Field* $\to$ *Update entire table*) to refresh page numbers before printing. |
