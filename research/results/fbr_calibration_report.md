# AgentSentinel — Phase 3: False-Positive Rate Characterization and Threshold Sensitivity Report

**Execution Date:** 2026-10-17T17:11:36.091974Z
**Script:** `research/evaluate_false_positive_calibration.py`
**Status:** Exploratory Internal Evaluation (NOT External Held-Out)

---

## 1. Provenance and Split Verification

| Property | Value |
|---|---|
| Dataset | `datasets/TraceLab/ATBench/test.json` |
| Dataset SHA-256 | `80c534b5f3517c87…` |
| Total trajectories | 1000 |
| Safe (label=0) | 503 |
| Unsafe (label=1) | 497 |
| Artifact | `research/artifacts/risk_model.joblib` |
| Artifact SHA-256 | `41b8774b7ff458c2…` |
| Model type | Pipeline |
| Split | test_size=0.2, random_state=42, stratified |
| Test samples | 200 (101 safe, 99 unsafe) |
| CM verification | **PASS** — exact match |
| ROC-AUC (threshold-independent) | 0.7813 |

> [!IMPORTANT]
> **Internal Development Evaluation.** The model was trained on a 80% split
> of the same ATBench file (`test.json`). The 20% held-out partition shares
> the same source distribution. These results reflect internal validation
> performance and should NOT be cited as evidence of external generalization.
> See `research/METHODOLOGY.md` for the planned external evaluation protocol.

---

## 2. Majority-Class Baseline

| Metric | Value |
|---|---|
| Strategy | Always predict safe (class 0) |
| FPR (safe partition) | 0.0000 |
| FNR (unsafe partition) | 1.0000 |
| Accuracy | 0.5050 |
| Interpretation | FPR=0% is free but FNR=100% means zero threat detection |

---

## 3. Threshold Sweep Results

Each row classifies P(unsafe) ≥ threshold as 'flagged' (predicted unsafe).
This is a **probability-threshold classification**, not an AgentSentinel
governance decision. The live system applies additional heuristic dimensions,
task-context authorization, and policy fusion before reaching ALLOW/ALERT/BLOCK.

| Threshold | Severity | FP | TN | FN | TP | FPR (safe) | 95% Wilson CI | FNR (unsafe) | Accuracy |
|---|---|---|---|---|---|---|---|---|---|
| 0.20 | below LOW | 75 | 26 | 5 | 94 | 0.7426 | [0.6495, 0.8178] | 0.0505 | 0.6000 |
| 0.30 | below LOW | 48 | 53 | 20 | 79 | 0.4752 | [0.3806, 0.5718] | 0.2020 | 0.6600 |
| 0.40 | LOW | 30 | 71 | 32 | 67 | 0.2970 | [0.2167, 0.3923] | 0.3232 | 0.6900 |
| 0.50 | ESTIMATOR DEFAULT (0.50) | 18 | 83 | 35 | 64 | 0.1782 | [0.1158, 0.2642] | 0.3535 | 0.7350 |
| 0.55 | MEDIUM | 18 | 83 | 37 | 62 | 0.1782 | [0.1158, 0.2642] | 0.3737 | 0.7250 |
| 0.70 | HIGH | 10 | 91 | 48 | 51 | 0.0990 | [0.0547, 0.1727] | 0.4848 | 0.7100 |
| 0.85 | CRITICAL | 7 | 94 | 55 | 44 | 0.0693 | [0.0340, 0.1362] | 0.5556 | 0.6900 |

### 3.1 Relationship to Live Severity Mapping

The production `risk/engine.py` maps P(unsafe) to severity as follows:

| P(unsafe) range | Severity | Interpretation |
|---|---|---|
| < 0.40 | NONE | ML dimension does not contribute to risk |
| [0.40, 0.55) | LOW | Informational signal |
| [0.55, 0.70) | MEDIUM | Elevated behavioral concern |
| [0.70, 0.85) | HIGH | Significant behavioral risk |
| ≥ 0.85 | CRITICAL | Highest ML-indicated risk |

A trajectory with P(unsafe) ≥ 0.40 receives at least `Severity.LOW` from
the ML dimension. Whether this leads to ALERT or BLOCK depends on heuristic
dimensions, task authorization, and policy fusion — NOT on P(unsafe) alone.

### 3.2 Resolution of Confusion-Matrix Discrepancy: Estimator Default (0.50) vs Production MEDIUM (0.55)

A apparent discrepancy exists between the stored model metrics and threshold 0.55:
- **Stored artifact metrics:** `TN=83, FP=18, FN=35, TP=64, Accuracy=0.7350`
- **Threshold 0.55 row:** `TN=83, FP=18, FN=37, TP=62, Accuracy=0.7250`

This difference is fully explained by the decision threshold:
1. **Estimator Default Threshold (0.50):** The stored artifact metrics in `research/artifacts/risk_model.joblib`
   were computed in `research/training/pipeline.py` using `model.predict(X_test)`. In scikit-learn,
   `RandomForestClassifier.predict()` evaluates `argmax(predict_proba)`, which corresponds to threshold `0.50`.
   Evaluating at threshold `0.50` produces `TN=83, FP=18, FN=35, TP=64, Accuracy=0.7350`, reproducing
   the stored metrics exactly.
2. **Production Severity Threshold (0.55):** Threshold `0.55` corresponds to the `Severity.MEDIUM`
   boundary in `ML_SEVERITY_THRESHOLDS`. In the held-out test set, exactly two unsafe trajectories
   (test sample indices 0 and 66) have predicted unsafe probabilities in `[0.50, 0.55)`:
   - Index 0: `y_true=1`, `P(unsafe)=0.5482`
   - Index 66: `y_true=1`, `P(unsafe)=0.5308`
   At threshold `0.50`, both are predicted unsafe (True Positives, `TP=64`). At threshold `0.55`,
   both fall below the threshold and become False Negatives (`TP=62`, `FN=37`).
3. **Safe Partition Invariance:** For the safe partition (`y_true=0`), zero samples have probabilities
   in `[0.50, 0.55)`. Consequently, `FP=18`, `TN=83`, and `FPR=17.82%` remain identical across both thresholds.
4. **Conclusion:** Both sets of metrics are verified, reproducible, and mathematically consistent.

---

## 4. Feature-Group Sensitivity Analysis

**Method:** Inference-time feature perturbation (zero-out). For each group,
all features in the group are set to 0.0 in a copy of the test feature matrix.
The UNMODIFIED production model is then used for inference. This is NOT a
retraining-based ablation.

**Evaluation threshold:** 0.40

Note: ΔFPR is computed as exact proportion change: `Perturbed_FPR - Baseline_FPR`
(e.g., +0.2871 corresponds to +28.71 percentage points).

| Feature Group | Features Zeroed | Baseline FPR | Perturbed FPR | ΔFPR (proportion) | Perturbed FP | 95% Wilson CI |
|---|---|---|---|---|---|---|
| State-Effect | 6 | 0.2970 | 0.5842 | +0.2871 | 59 | [0.4867, 0.6755] |
| Category-Count | 10 | 0.2970 | 0.4455 | +0.1485 | 45 | [0.3524, 0.5427] |
| Transition | 3 | 0.2970 | 0.4158 | +0.1188 | 42 | [0.3245, 0.5133] |
| Temporal | 3 | 0.2970 | 0.2970 | 0.0000 | 30 | [0.2167, 0.3923] |

### 4.1 Feature Group Partitioning (Full 22 Features)

The 22 features are partitioned into four disjoint groups with zero overlap and zero omission:

- **State-Effect (6 features):** `mutating_known_true`, `mutating_known_false`, `mutating_unknown`, `destructive_known_true`, `destructive_known_false`, `destructive_unknown`
- **Category-Count (10 features):** `action_count`, `event_count`, `cat_file_system_read`, `cat_file_system_write`, `cat_code_execution`, `cat_web_request`, `cat_api_call`, `cat_agent_control`, `cat_unknown`, `unique_tool_count`
- **Transition (3 features):** `transition_count`, `read_to_write_transitions`, `consecutive_repeated_actions`
- **Temporal (3 features):** `valid_timed_transitions`, `mean_inter_action_time`, `max_inter_action_time`

### 4.2 Limitations of Feature Perturbation

1. **Out-of-distribution inputs.** Zeroing features creates inputs the model
   was not trained on. The StandardScaler in the pipeline will rescale zeroed
   features to negative z-scores if the training mean was positive, potentially
   producing unexpected predictions.
2. **Feature interactions.** Features within and across groups are correlated
   (e.g., `action_count` and category counts). Zeroing one group while leaving
   others intact disrupts these correlations.
3. **Not causal.** This analysis shows sensitivity, not causal importance.
   A feature group that causes large ΔFPR may do so because its removal creates
   extreme out-of-distribution inputs, not because it is causally important
   for false-positive decisions.
4. **Single perturbation method.** Only zero-out was tested. Alternative methods
   (permutation, marginal distribution sampling) may yield different results.

---

## 5. Limitations and Caveats

1. **Internal split, not external evaluation.** The 200-sample test set is a
   stratified random 20% partition of the same ATBench file used for training.
   It shares the same source distribution as the training set. FPR on this
   partition may underestimate production FPR due to distribution shift.
2. **Small safe partition (n=101).** Wilson confidence intervals are wide.
   Point estimates should not be over-interpreted.
3. **ATBench label quality.** Labels are human-audited but binary and coarse.
   Near-boundary benign trajectories may be structurally similar to unsafe ones.
4. **No external comparison.** No other surveyed system reports FPR on ATBench
   safe partitions. Direct external comparison is not possible with current data.
5. **SyFI not used.** SyFI trajectories are unlabeled and cannot be used for
   FPR measurement without a defensible labeling methodology.
6. **No novelty claim.** This characterization study documents an empirical property
   of the existing classifier. It does not, by itself, constitute a research
   contribution. Whether it supports a publishable finding depends on context
   and comparison with future baselines.
7. **Research Terminology Clarification.** This study performs empirical false-positive-rate
   characterization and threshold sensitivity analysis. It does NOT evaluate or implement
   formal probability calibration methods (such as Expected Calibration Error, Brier score,
   reliability diagrams, Platt scaling, or isotonic regression). Furthermore, it does NOT propose
   a novel algorithmic governance mechanism or claim external generalization to out-of-distribution benchmarks.

---

## 6. Reproducibility

```bash
cd <project_root>
python research/evaluate_false_positive_calibration.py
```

- Python: `3.14.3`
- Platform: `Windows-11-10.0.26200-SP0`
- scikit-learn: `1.9.1`
- numpy: `2.5.1`
- Random state: `42`
- Dataset SHA-256: `80c534b5f3517c872b528a2e6b64e34495206968edd184f4aed563d39f0cca09`
- Artifact SHA-256: `41b8774b7ff458c26f690798777fd3d2981b5711a3933e990774996e38afc40d`

---

*Report generated by `research/evaluate_false_positive_calibration.py`.*
*Execution completed: 2026-10-17T17:11:36.091974Z.*
*No application source code, model artifacts, production thresholds,
database schemas, or frontend files were modified.*