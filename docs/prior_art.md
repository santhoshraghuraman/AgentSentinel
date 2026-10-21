# AgentSentinel — Phase 2: Prior-Art and Research-Gap Investigation

**Investigation Date:** 2026-10-17  
**Investigator:** Antigravity AI (read-only; no application source code modifications)  
**Status:** Draft — For Author Review Before Implementation  
**Scope:** Research literature, deployed systems, and patent landscape relevant to AgentSentinel M1–M12 architecture.

---

## 1. Executive Summary

AgentSentinel is a model-agnostic runtime behavioral-governance middleware for autonomous AI agents. It intercepts tool calls, performs multi-dimensional behavioral risk assessment (heuristic + Random Forest), applies task-context authorization, fuses policy decisions, enforces governance, and produces a correlated immutable audit trail.

This investigation identifies nine directly relevant prior-art works verified from primary or near-primary sources, situates them against AgentSentinel's architecture, and evaluates three candidate research directions.

**Candidate A — Risk-Bounded Trajectory Governance (RBTG):** A scoring formula combining per-action behavioral evidence, task-scope deviation, and trajectory-level risk. ProbGuard (arXiv:2508.00500) already operationalizes probabilistic trajectory risk with DTMC-based safety prediction and PAC-style bounds. The RBTG hypothesis is neither derived from a principled statistical model nor validated against established baselines. **This direction cannot be recommended in its current form.**

**Candidate B — Evidence-Linked Authorization and Verified Audit:** Binding authorized arguments to actual execution with a correlated reconstructable audit trail. TraceGrant (arXiv:2608.21126) is the most directly overlapping prior art. AgentSentinel's combination of model-agnostic callable interception, frozen pre-governance argument verification, and a shared `interception_id` linking pre-decision audit records to post-execution outcomes has no precise equivalent in the surveyed literature — but a Candidate B novelty claim requires reading TraceGrant in full before it can be made.

**Candidate C — False-Block Calibration on Benign Workloads:** Measuring and characterizing the false-block rate (FBR) of the trained Random Forest on ATBench's labeled safe partition. This is the most tractable direction. The dataset (503 benign / 497 unsafe trajectories), the 22-feature pipeline, and the existing RF model are all present in the repository. A statistically defensible FBR report under threshold variation and feature-group ablation is currently absent from the survey.

**Recommended direction:** Candidate C-i (FBR calibration), which can be executed within the existing M1–M12 architecture without any source code changes.

---

## 2. Verified Source Bibliography

Sources accessed 2026-10-17 unless noted. Entries are ordered alphabetically by system name.

### 2.1 AgentDoG

- **Full title:** *AgentDoG: A Diagnostic Guardrail Framework for AI Agent Safety and Security*; follow-up: *AgentDoG 1.5: A Lightweight and Scalable Alignment Framework for AI Agent Safety and Security*
- **Authors:** Dongrui Liu et al. (large consortium, ~30+ named authors across multiple institutions)
- **arXiv status:** Confirmed as existing; single canonical arXiv ID not resolved in this search — **mark as partially verified lead; verify at arxiv.org before citing in a paper**
- **Note:** AgentDoG introduces the three-dimensional risk taxonomy (Source, Failure Mode, Consequence) and is developed by the same research group that produced ATBench. The systems are described together in multiple sources.
- **Source type:** Academic preprint / multi-institutional consortium

### 2.2 AgentSpec

- **Full title:** *AgentSpec: Customizable Runtime Enforcement for Safe and Reliable LLM Agents*
- **Authors:** Haoyu Wang, Christopher M. Poskitt, Jun Sun
- **arXiv ID:** arXiv:2503.18666
- **URL:** https://arxiv.org/abs/2503.18666
- **Source type:** Academic preprint (March 2025)

### 2.3 Anderson 1972 (Reference Monitor)

- **Full title:** *Computer Security Technology Planning Study*
- **Author:** James P. Anderson
- **Year:** 1972
- **Publisher:** U.S. Air Force Electronic Systems Division, Technical Report ESD-TR-73-51
- **Source type:** U.S. DoD technical report (foundational prior art)

### 2.4 ATBench

- **Full title:** *ATBench: A Diverse and Realistic Agent Trajectory Benchmark for Safety Evaluation and Diagnosis*
- **arXiv IDs:** arXiv:2604.02022 (main paper); arXiv:2604.14858 (ATBench-Claw and ATBench-Codex extensions)
- **URL:** https://arxiv.org/abs/2604.02022
- **Source type:** Academic preprint benchmark paper (2026)
- **Repository presence:** `datasets/TraceLab/ATBench/test.json` confirmed present (1,000 trajectories; 503 safe / 497 unsafe; verified by `src/agentsentinel/research/datasets.py`)

### 2.5 Meta LlamaFirewall / AlignmentCheck

- **System name:** LlamaFirewall (suite); AlignmentCheck (component)
- **Organization:** Meta AI (Fundamental AI Research)
- **Release date:** April 2025
- **URL:** https://llama.meta.com/docs/llamafirewall (official documentation); https://github.com/meta-llama/llama-firewall (open source)
- **Source type:** Industry technical blog + open-source release (not a peer-reviewed academic paper)

### 2.6 Microsoft FIDES

- **Full title:** *Securing AI Agents with Information-Flow Control*
- **Authors:** Manuel Costa, Boris Köpf, Aashish Kolluri, Andrew Paverd, Mark Russinovich, Ahmed Salem, Shruti Tople, Lukas Wutschitz, Santiago Zanella-Béguelin
- **arXiv ID:** arXiv:2505.23643
- **URL:** https://arxiv.org/abs/2505.23643
- **GitHub:** https://github.com/microsoft/fides
- **Source type:** Academic preprint / Microsoft Research (May 2025)

### 2.7 ProbGuard

- **Full title:** *ProbGuard: Proactive Runtime Monitoring for LLM Agent Safety via Probabilistic Prediction* (also referenced as *Pro²Guard: Proactive Runtime Enforcement of LLM Agent Safety via Probabilistic Model Checking*)
- **Authors:** Haoyu Wang, Christopher M. Poskitt, Jiali Wei, Jun Sun
- **arXiv ID:** arXiv:2508.00500
- **URL:** https://arxiv.org/abs/2508.00500
- **Source type:** Academic preprint (August 2025)

### 2.8 Progent

- **Full title:** *Progent: Programmable Privilege Control for LLM Agents*
- **Authors:** Tianneng Shi, Jingxuan He, Zhun Wang, Linyu Wu, Hongwei Li, Wenbo Guo, Dawn Song
- **Institutions:** UC Berkeley and collaborators
- **arXiv ID:** arXiv:2504.11703
- **URL:** https://arxiv.org/abs/2504.11703
- **Source type:** Academic preprint (April 2025)

### 2.9 TRACES

- **Full title:** *TRACES: Proactive Safety Auditing for Multi-Turn LLM Agents via Trajectory-State Modeling*
- **Authors:** Jiaqian Li, Yanshu Li, Boxuan Zhang, Ruixiang Tang, Kuan-Hao Huang
- **Venue:** EMNLP (exact year and proceedings volume should be verified at aclanthology.org or arxiv.org before citation)
- **arXiv ID:** arXiv:2605.27690
- **URL:** https://arxiv.org/abs/2605.27690
- **Source type:** Academic conference paper (2025/2026)

### 2.10 TraceGrant

- **Full title:** *TraceGrant: A Contract-Governed Security Framework for the Task-Effect Lifecycle of Networked LLM Agents*
- **Authors:** Bohao Liao, Jingchao Wang, Qipeng Song, Jin Cao, Jieling Wang, Boyu Deng
- **arXiv ID:** arXiv:2608.21126
- **URL:** https://arxiv.org/abs/2608.21126
- **Source type:** Academic preprint (2026)

---

## 3. Prior-Art Comparison Matrix

| # | System | Source Type | Primary Mechanism | Action / Task / Trajectory Level | Authorization and Policy | Runtime Interception | Evaluation Methods and Datasets | Overlap with AgentSentinel | Potential Differences (Require Verification) | Limitations / Unanswered Questions | Relevance to Candidates |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **AgentDoG** | Academic preprint | LLM-as-judge trajectory monitor with 3D risk taxonomy (Source, Failure Mode, Consequence) | Trajectory | No explicit authorization model; focuses on goal-deviation diagnosis | Post-hoc trajectory audit; online variant available | ATBench, R-Judge; SFT/RL training loops | Shares 3D risk categorization; uses the same ATBench benchmark | AgentSentinel uses ML + heuristic scoring; AgentDoG uses LLM-as-judge | Requires LLM inference per trajectory; high computational cost; no FBR analysis reported | A (trajectory risk), C (evaluation baseline) |
| 2 | **AgentSpec** | Preprint arXiv:2503.18666 | DSL: Trigger-Predicate-Enforce runtime rules over tool calls | Action | Symbolic rules only; no probabilistic risk scoring | Pre-execution tool-call interception | Embodied, code-execution, driving agents | Both intercept tool calls pre-execution; both support ALLOW/BLOCK | AgentSentinel adds 22-feature ML-scored behavioral risk; AgentSpec uses symbolic predicates without trajectory history | No cross-action behavioral patterns; no ML model; no probabilistic output | B (policy enforcement comparison) |
| 3 | **Anderson 1972** | DoD Technical Report | Reference Monitor: tamper-proof, always-invoked, evaluable, with audit trail | System call / action | Access control policy | Complete mediation of all access requests | Formal proof; OS security certification | All agent governance systems are instances of this abstract model | AgentSentinel extends the model to probabilistic LLM-agent contexts with ML risk scoring | No formal proofs for AgentSentinel completeness | B (foundational prior art for all enforcement claims) |
| 4 | **ATBench** | Benchmark paper arXiv:2604.02022 | 1,000 trajectory dataset with binary safe/unsafe labels | Trajectory | Ground-truth labels (not a system) | N/A | 9.01 avg turns, 1,954 tools, human-audited | AgentSentinel trains RF on ATBench; holds out 250 trajectories | FBR on the safe partition not yet reported | Binary labels; does not distinguish clearly-benign from near-boundary trajectories | C (primary evaluation dataset) |
| 5 | **Meta LlamaFirewall / AlignmentCheck** | Industry release (April 2025) | CoT-level runtime auditor detecting goal drift and prompt injection via few-shot LLM prompting | Trajectory (chain-of-thought) | No symbolic authorization model | Online per-turn reasoning audit | AgentDojo; attack success ~17% → <2% | Both audit trajectory-level behavior to detect misalignment | AgentSentinel uses structured ML features + symbolic policy; LlamaFirewall uses LLM reasoning | Depends on LLM availability; no formal guarantees; high inference cost | A (trajectory monitoring), B (no correlated execution binding) |
| 6 | **Microsoft FIDES** | Preprint arXiv:2505.23643 | Information-flow control with taint labels (trusted/untrusted × public/private) across tool calls | Action | Formal IFC policy; label-based; not task-scoped capability grants | Pre-execution taint label propagation and policy check | AgentDojo; formal guarantees | Both intercept tool calls pre-execution; both produce audit evidence | FIDES: data provenance (taint tracking); AgentSentinel: behavioral risk (trajectory features + policy fusion); different threat models | No trajectory-level behavioral patterns; no ML risk model; no FBR analysis | B (contrasting authorization model) |
| 7 | **ProbGuard** | Preprint arXiv:2508.00500 | DTMC learned from execution traces; proactive safety probability prediction with PAC bounds | Trajectory | No explicit authorization model | Proactive intervention when predicted safety probability falls below threshold | Autonomous driving, household embodied agents | Both model trajectory risk probabilistically; both intervene pre-execution | ProbGuard: DTMC from execution traces; AgentSentinel: Random Forest on handcrafted features; different modeling assumptions, domains, and input representations | Evaluated only on embodied / driving domains (not tool-using LLM agents); DTMC needs sufficient training traces; no FBR analysis on benign workloads | A (closest prior art for probabilistic trajectory risk scoring) |
| 8 | **Progent** | Preprint arXiv:2504.11703 | Symbolic DSL + SMT solver; monotonic confinement (policy can only shrink) | Action | Least-privilege; SMT-verified policy updates | Pre-execution privilege check | AgentDojo, ASB, AgentPoison; attack success near zero | Both block unauthorized tool calls pre-execution; both support framework-agnostic integration | Progent: privilege expansion prevention; AgentSentinel: behavioral risk + capability authorization; complementary | No behavioral trajectory modeling; no ML risk score; no correlated audit trail; no post-execution outcome verification | B (least-privilege authorization contrast) |
| 9 | **TRACES** | Conference paper arXiv:2605.27690 | Observer LLM monitors latent hidden states over trajectory for emerging risk | Trajectory | No symbolic authorization model | Online monitoring of hidden state features from observer LLM | Multi-turn agent tasks; EMNLP evaluation | Both monitor temporal evolution of agent behavior; both proactive | TRACES: LLM hidden state embeddings; AgentSentinel: hand-engineered behavioral features; no shared feature space | Requires access to observer LLM internals; not model-agnostic; high compute cost | A (trajectory-level proactive monitoring comparison) |
| 10 | **TraceGrant** | Preprint arXiv:2608.21126 | POEC contract (Permission, Obligation, Evidence, Completion) lifecycle governance; evidence-bounded execution; completion verification | Task (contract lifecycle) | Contract-defined permissions; runtime evidence can only instantiate pre-reserved dynamic argument slots | Pre-execution authorization against contract and obligation ledger | Networked LLM agent scenarios (email, cloud storage, banking) | Closest prior art for evidence-linked authorization; TraceGrant also binds execution outcomes to user intent | TraceGrant: semantic contract compilation; AgentSentinel: explicit capability grants and policy tags; TraceGrant verifies completion against contract obligations; AgentSentinel records execution state with correlated `interception_id` | No probabilistic risk scoring; no ML model; no trajectory feature extraction; unclear FBR characterization | B (most direct prior art for evidence-linked authorization) |

---

## 4. Candidate A / B / C Assessment

### 4.1 Candidate A — Risk-Bounded Trajectory Governance (RBTG)

**Claim:** Combining per-action behavioral evidence, deviations from task scope, and trajectory-level risk into a scalar governance score offers a measurable benefit over existing approaches.

**Closest prior art:** ProbGuard (arXiv:2508.00500) already operationalizes probabilistic trajectory safety prediction using DTMC models learned from execution traces, with PAC-style sample complexity bounds and interventions triggered when predicted safety probability falls below a threshold. TRACES (arXiv:2605.27690) monitors latent hidden-state trajectories. AgentDoG uses an LLM-as-judge with a three-dimensional risk taxonomy.

**Assessment — NOT CURRENTLY DEFENSIBLE:**

1. **The RBTG formula is an unvalidated hypothesis.** No derivation from a statistical model, no calibration on a dataset, and no comparison against ProbGuard or any established baseline exists.
2. **ProbGuard already operationalizes probabilistic trajectory risk** in a principled, evaluated framework. Claiming novelty over ProbGuard requires a precise technical distinction that has not been established.
3. **AgentSentinel's existing RF model** produces P(unsafe) per trajectory — closer to a per-trajectory classifier than to the real-time trajectory risk aggregation that RBTG implies.
4. **What is required to make Candidate A defensible:** (a) A formal definition of the RBTG score with provable or empirically validated properties; (b) a comparison against ProbGuard and TRACES on a shared dataset; (c) evidence that combining scope deviation with ML risk provides a measurable benefit beyond using either alone.

**Verdict: Do not implement. Requires substantial theoretical development first.**

---

### 4.2 Candidate B — Evidence-Linked Authorization and Verified Runtime Enforcement

**Claim:** Binding authorized action arguments to actual execution, combined with correlated and reconstructable audit evidence, addresses a gap beyond established security practices.

**Closest prior art:** TraceGrant (arXiv:2608.21126) compiles POEC contracts pre-execution and enforces evidence-bounded execution. FIDES (arXiv:2505.23643) provides formal IFC guarantees. Anderson 1972 established audit trails as a core requirement. Progent and AgentSpec both intercept pre-execution.

**Assessment — PARTIALLY DEFENSIBLE, with important caveats:**

1. **AgentSentinel's distinguishing elements:** The combination of (a) model-agnostic callable interception decoupled from any specific LLM provider or agent framework, (b) frozen pre-governance argument verification (arguments cannot be substituted after normalization), and (c) a shared `interception_id` linking the pre-decision ML risk score and policy decision to the post-execution state change in a queryable SQL audit store — this exact combination does not appear in any of the nine surveyed works.
2. **What requires verification before any novelty claim:** Whether TraceGrant's evidence-bounded execution is functionally equivalent to frozen-argument binding; whether TraceGrant's completion verification subsumes the correlated audit record mechanism; whether FIDES's taint labels provide equivalent audit correlation.
3. **What is not novel:** Pre-execution interception (Anderson 1972; AgentSpec; Progent; FIDES). Audit trails (Anderson 1972). Task-scoped authorization (TraceGrant). Policy fusion (standard security engineering).

**Verdict: Partially defensible, contingent on full reading of TraceGrant (arXiv:2608.21126) and FIDES (arXiv:2505.23643). Do not claim novelty until this verification is complete.**

---

### 4.3 Candidate C — Evaluation or Calibration Contribution

**Claim:** A statistically defensible false-block rate characterization on ATBench's safe partition, with threshold-sensitivity analysis and feature-group ablation, is a concrete, measurable, currently absent contribution.

**Closest prior art:** No surveyed paper reports a false-block rate on a labeled benign workload partition for a trained Random Forest behavioral risk scorer used in LLM agent governance. AgentDoG uses ATBench for guardrail classification (goal-deviation diagnosis), not for FBR calibration of a Random Forest. ProbGuard evaluates intervention rates only on embodied / driving domains.

**Assessment — MOST TRACTABLE AND IMMEDIATELY DEFENSIBLE:**

1. **Clear problem statement:** Given the RF trained on 750 ATBench trajectories, what is the FBR on the 250-test-set's safe trajectories at the current threshold (P(unsafe) ≥ 0.40), and how does FBR vary across thresholds and feature-group ablations?
2. **Available resources:** ATBench test.json is present in the repository. The existing pipeline (M1–M4, `research/model.py`, `research/artifacts/risk_model.joblib`) already implements all required components. The stored FPR of 0.1587 is on the **mixed** 250-test partition; FBR on the **safe-only** partition is a distinct, currently unreported measurement.
3. **No new algorithm, no model retraining, and no application source code changes are required.** Only a standalone research evaluation script in `research/`.
4. **Baseline:** The current model at default threshold is the baseline. A majority-class (always predict safe) baseline is trivially constructable.
5. **Gap:** Threshold-sensitivity FBR analysis for this specific feature class (structured behavioral features + lightweight RF) on a labeled safe trajectory partition is absent from the survey.

**Verdict: Candidate C-i is recommended. Begin with Stage 1 data verification (described in Section 6) before any experimental claims.**

**Candidate C-ii (adaptive multi-step attack evaluation suite using SyFI):** Not recommended at this stage. SyFI has no attack-success labels; any labeling method requires independent defensibility justification. This is substantial additional work that should be planned separately.

---

## 5. Recommended Research Gap

### 5.1 Recommended Direction

**Candidate C-i: Statistically Defensible False-Block Rate Characterization and Threshold Calibration for Behavioral ML Risk Scoring in LLM Agent Governance**

### 5.2 Precise Problem Statement

> *Given a Random Forest classifier trained on the ATBench behavioral trajectory dataset using 22 hand-engineered sequential action features, what false-block rate does the classifier produce on the safe partition of ATBench's held-out test set, and how does this rate vary across (a) decision thresholds, (b) feature-group ablations, and (c) severity-mapping configurations currently implemented in `risk/engine.py`?*

### 5.3 Closest Prior Art and Technical Distinction

- **Closest prior art:** ATBench (arXiv:2604.02022) defines the dataset and evaluation protocol. AgentDoG uses ATBench for guardrail classification. ProbGuard evaluates intervention rates in embodied domains.
- **Potential distinction:** FBR under threshold variation for a handcrafted-feature RF classifier (M4 features: mutation rate, destructive operations, category mix, temporal burst, read-to-write transition count) on a labeled safe trajectory partition, with statistical confidence intervals and feature-group ablation, fills a gap specific to the "structured behavioral features + lightweight ML model" design pattern used in AgentSentinel.

### 5.4 Threat Model and Assumptions

- **Scope:** Calibration study, not a security claim. Measures how often the classifier incorrectly flags legitimate behavior as risky under the current default threshold.
- **Assumptions:**
  - ATBench binary labels (safe = 0) are ground truth for benign trajectory identification.
  - The trained model (`research/artifacts/risk_model.joblib`) was trained on the 750-trajectory training partition only. **Verify:** `train_test_split(data, test_size=0.25, random_state=42)` in `research/training/pipeline.py`.
  - The 250-test-set trajectories were not used during training.

### 5.5 Required Implementation Changes

**None to application source code.** All capabilities exist:

1. Load ATBench test.json from `datasets/TraceLab/ATBench/test.json`.
2. Filter to safe trajectories (label == 0).
3. Run through M1 → M2 → M3 → M4 → `features_to_vector()`.
4. Apply the trained RF model's `predict_proba()` at multiple thresholds.
5. Compute FBR, TNR, and 95% confidence intervals per threshold.
6. Perform feature-group ablation (zero out each of the 4 groups).

Implement as a standalone script in `research/` without modifying `src/`.

### 5.6 Datasets and Ground-Truth Labels

| Dataset | Use | Note |
|---|---|---|
| ATBench test.json (safe partition, label == 0) | Primary FBR evaluation | Present in repo; human-audited labels |
| ATBench test.json (unsafe partition, label == 1) | Complementary FNR evaluation | Present in repo |
| SyFI / TraceLab | NOT usable for FBR | No attack-success labels; do not assign labels without a defensible method |

### 5.7 Baselines and Ablation Studies

| Baseline / Ablation | Description |
|---|---|
| **Current model at default threshold** | P(unsafe) ≥ 0.40 → LOW severity. Primary baseline. |
| **Majority-class (always predict safe)** | FBR = 0%; FNR = 100%. Shows FBR is not free. |
| **Threshold sweep** | P ∈ {0.20, 0.30, 0.40, 0.55, 0.70, 0.85} (severity boundaries from `risk/engine.py`) |
| **Feature-group ablation** | Zero out each of 4 groups; report ΔFBRg per group |
| **Full-feature vs. temporal-removed** | Report FBR with and without temporal features (addresses missing-timestamp scenarios) |

### 5.8 Metrics

| Metric | Definition | Justification |
|---|---|---|
| **FBR** | FP / (FP + TN) on safe partition | Primary metric; governance over-blocking |
| **FNR** | FN / (FN + TP) on unsafe partition | Complementary; governance under-blocking |
| **Accuracy** | Standard metric on full 250-test set | Comparable to stored value (0.7240) |
| **ROC-AUC** | Threshold-independent performance | Currently stored at 0.7782 |
| **95% CI for FBR** | Wilson score interval on FP count | Required; test set is small (~125 safe trajectories) |
| **Severity-threshold sensitivity** | FBR at each of 4 severity thresholds | Directly actionable for deployment calibration |

### 5.9 Leakage Risks and Distribution-Shift Limitations

1. **Data leakage:** Verify the training/test split with `random_state=42` matches the model artifact before reporting results.
2. **Distribution shift:** ATBench trajectories are curated; production tool-use distributions may differ. FBR on ATBench is potentially a lower bound on production FBR. This limitation must be explicitly stated in any write-up.
3. **Label quality:** Binary ATBench labels are human-audited but coarse. Near-boundary benign trajectories may be structurally similar to unsafe ones. Results are conditional on ATBench label quality.
4. **SyFI:** Cannot be used for FBR claims without defensible labeling.

### 5.10 Feasibility Within Existing M1–M12 Architecture

All pipeline components are already implemented and tested (476 passing tests). The evaluation requires only a standalone `research/` script calling the existing pipeline. No architecture, source, model, threshold, or database changes are needed.

### 5.11 Proposed Acceptance Criteria

| Criterion | Status |
|---|---|
| FBR at default threshold (0.40) reported with 95% CI | Required |
| FBR at all four severity thresholds reported | Required |
| Feature-group ablation complete (4 groups) | Required |
| No test-set retraining | Hard constraint |
| Results reproducible with `random_state=42` | Required |
| Explicit limitation statement (distribution shift, label quality) | Required |
| Majority-class baseline included | Required |

### 5.12 Remaining Uncertainties

1. The exact number of safe trajectories in the 250-test set is not yet confirmed (estimated ~125; requires direct count).
2. Whether the stored FPR of 0.1587 is on the mixed 250-set or the safe-only partition — these are different values; safe-only FBR is typically higher.
3. Whether ATBench's benign trajectories structurally resemble the production use cases AgentSentinel targets (production traces use SyFI-style tool patterns not present in ATBench).
4. Whether FBR meaningfully differs from competing systems — no other surveyed system reports FBR on ATBench, making direct external comparison impossible with current data.
5. **TraceGrant (arXiv:2608.21126) should be read in full** before any Candidate B novelty claim.

---

## 6. Proposed Experiment Plan

### Stage 1 — Data Verification (Before Any Experiment)

1. Load `datasets/TraceLab/ATBench/test.json` and count safe (label == 0) and unsafe (label == 1) trajectories.
2. Verify `train_and_evaluate()` in `research/training/pipeline.py` uses `random_state=42` and 75/25 split.
3. Confirm test set is derived reproducibly and has no overlap with training data.
4. Confirm model artifact path: `research/artifacts/risk_model.joblib`.

### Stage 2 — Baseline Measurement

1. Load the saved model.
2. Run all 250 test trajectories through M1 → M2 → M3 → M4 → `features_to_vector()`.
3. Apply `model.predict_proba()` to obtain P(unsafe) for each trajectory.
4. Compute metrics at default threshold (0.40): FBR on safe partition, FNR on unsafe partition, accuracy, ROC-AUC.
5. Compute 95% CI (Wilson interval) for FBR.

### Stage 3 — Threshold Sensitivity Analysis

1. Sweep thresholds: 0.20, 0.30, 0.40, 0.55, 0.70, 0.85.
2. Report FBR and FNR at each threshold.
3. Record exact FP, TN, FN, TP counts per threshold.

### Stage 4 — Feature-Group Ablation

1. Zero out the 6 state-effect features and re-evaluate at default threshold.
2. Zero out the 7 category-count / diversity features and re-evaluate.
3. Zero out the 4 transition features and re-evaluate.
4. Zero out the 5 temporal features (substitute 0.0 for None, consistent with `features_to_vector()`) and re-evaluate.
5. Report ΔFBR for each group.

### Stage 5 — Limitation Documentation

1. Record exact counts (not just percentages).
2. State distribution-shift limitation.
3. State training/test split provenance.
4. Include majority-class baseline comparison.

### Stage 6 — Author Review Gate (STOP)

> **Stop here. Present results to the author/supervisor before any novelty claim, before committing to a research paper structure, and before making any changes to the production system.** Results may support or refute the research direction.

---

## 7. Limitations and Unresolved Questions

### 7.1 Sources Not Verified to Full Paper Level

- **AgentDoG arXiv ID:** Canonical single arXiv ID not confirmed; verify at arxiv.org before citing.
- **TRACES venue:** Referenced as EMNLP; confirm year, proceedings volume at aclanthology.org or the arXiv landing page.
- **Meta LlamaFirewall:** An industry blog post and open-source release, not a peer-reviewed paper. Treat its AgentDojo evaluation as engineering evidence, not peer-reviewed research.

### 7.2 Source Name Ambiguities Resolved

- **"TRACES"**: Multiple unrelated papers use "TRACE" acronyms. The system investigated here is specifically *TRACES: Proactive Safety Auditing for Multi-Turn LLM Agents via Trajectory-State Modeling* (arXiv:2605.27690, Jiaqian Li et al.), which matches the description in the investigation request.
- **"Meta AlignmentCheck"**: This is a named component within the LlamaFirewall suite (Meta AI, April 2025), not a standalone academic publication with its own arXiv ID. Described as an online chain-of-thought reasoning auditor.
- **"AgentDoG"**: A large consortium paper producing the ATBench benchmark. Not a single-lab paper. Full arXiv ID requires verification.

### 7.3 Systems Outside Scope or Not Found

- No standalone system named "**Meta AlignmentCheck**" with its own arXiv paper was found independently of LlamaFirewall. It is treated as a LlamaFirewall component.
- No additional patent documents matching the surveyed systems were located in this search. Patent landscape search would require USPTO and EPO database access, which was not performed.

### 7.4 Research-Gap Uncertainty

The primary uncertainty is whether a FBR calibration study is a sufficient contribution for the intended publication venue. If the venue expects a new algorithm, Candidate C alone is insufficient. The author should confirm the expected contribution type with the supervising committee before proceeding.

### 7.5 Experimental Integrity Constraints

- Do not evaluate on the training partition.
- Do not retrain the model on test data.
- Do not change any thresholds in the production system.
- Do not assign attack-success labels to SyFI traces without a defensible, peer-reviewed labeling methodology.
- Do not cite any paper from this investigation without first reading the primary source directly.

---

*Document created by Antigravity AI as part of Phase 2 read-only prior-art investigation. No application source code, datasets, model artifacts, database records, or test thresholds were modified. All sources accessed 2026-10-17.*