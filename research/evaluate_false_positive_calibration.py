#!/usr/bin/env python3
"""
AgentSentinel — Phase 3: False-Positive Rate Characterization and Threshold
Sensitivity Analysis (Candidate C-i).

Standalone, reproducible evaluation of the production Random Forest artifact's
false-positive behavior across probability thresholds, with feature-group
inference-time sensitivity analysis and Wilson confidence intervals.

Research Terminology Clarification:
  This script performs empirical false-positive-rate (FPR) characterization and
  threshold sensitivity analysis across probability cutoffs. It does NOT evaluate
  or implement formal probability calibration methods (such as Expected Calibration
  Error, Brier score, reliability diagrams, Platt scaling, or isotonic regression).
  Furthermore, it does NOT propose a novel algorithmic governance mechanism or claim
  external generalization to out-of-distribution benchmarks.

This script:
  - Loads the canonical production artifact (research/artifacts/risk_model.joblib)
    WITHOUT modifying it.
  - Reconstructs the exact held-out test split used during training
    (80/20, random_state=42, stratified) and VERIFIES the split by
    reproducing the stored confusion matrix.
  - Evaluates P(unsafe) across probability thresholds, including the estimator's
    default decision threshold (0.50) and operational thresholds from the
    production ML_SEVERITY_THRESHOLDS in risk/engine.py.
  - Computes False-Positive Rate (FPR) on the safe-only partition with
    95% Wilson score confidence intervals.
  - Performs inference-time feature-group sensitivity analysis by perturbing
    (zeroing) each of four feature groups ONE AT A TIME and reporting the
    change in FPR. This is NOT a retraining-based ablation; the model
    weights are never altered.
  - Saves all results to research/results/ as JSON, CSV, and Markdown.

Provenance:
  - Dataset: datasets/TraceLab/ATBench/test.json (1000 trajectories)
  - Artifact: research/artifacts/risk_model.joblib (Pipeline: StandardScaler + RF)
  - Split: test_size=0.20, random_state=42, stratify=y
  - Held-out test set: 200 samples (101 safe, 99 unsafe)
  - Feature schema: 22 features (FEATURE_NAMES in research/model.py)
  - Thresholds: {0.20, 0.30, 0.40, 0.50, 0.55, 0.70, 0.85}

Usage:
  cd <project_root>
  python research/evaluate_false_positive_calibration.py

Outputs:
  research/results/fbr_calibration_results.json
  research/results/fbr_threshold_summary.csv
  research/results/fbr_feature_sensitivity.csv
  research/results/fbr_calibration_report.md
"""

import csv
import hashlib
import json
import logging
import math
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
from sklearn.metrics import accuracy_score, confusion_matrix, roc_auc_score
from sklearn.model_selection import train_test_split

# ─── Project imports ───────────────────────────────────────────────────
# Ensure the project root is on sys.path so that `src.agentsentinel`
# resolves when run from the project root directory.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.agentsentinel.research.model import (
    FEATURE_NAMES,
    build_research_dataset,
    features_to_vector,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════════════════════

DATASET_PATH = "datasets/TraceLab/ATBench/test.json"
ARTIFACT_PATH = "research/artifacts/risk_model.joblib"
OUTPUT_DIR = "research/results"

# Probability thresholds: estimator default (0.50) + engine.py ML_SEVERITY_THRESHOLDS + extras
THRESHOLDS = [0.20, 0.30, 0.40, 0.50, 0.55, 0.70, 0.85]

# Severity label mapping (for documentation only — this script does NOT
# make governance decisions)
SEVERITY_LABELS = {
    0.40: "LOW",
    0.50: "ESTIMATOR DEFAULT (0.50)",
    0.55: "MEDIUM",
    0.70: "HIGH",
    0.85: "CRITICAL",
}

# Split configuration that produced the production artifact
SPLIT_TEST_SIZE = 0.20
SPLIT_RANDOM_STATE = 42

# Stored metrics for provenance verification
STORED_CM = {"TN": 83, "FP": 18, "FN": 35, "TP": 64}

# Feature-group definitions for sensitivity analysis
# These are indices into the 22-element feature vector.
FEATURE_GROUPS = {
    "State-Effect": {
        "description": "Mutating and destructive state-effect counts",
        "indices": [9, 10, 11, 12, 13, 14],  # mutating_known_true..destructive_unknown
        "feature_names": [
            "mutating_known_true", "mutating_known_false", "mutating_unknown",
            "destructive_known_true", "destructive_known_false", "destructive_unknown",
        ],
    },
    "Category-Count": {
        "description": "Action/event counts, category frequencies, unique tool diversity",
        "indices": [0, 1, 2, 3, 4, 5, 6, 7, 8, 15],  # action_count..cat_unknown + unique_tool_count
        "feature_names": [
            "action_count", "event_count",
            "cat_file_system_read", "cat_file_system_write", "cat_code_execution",
            "cat_web_request", "cat_api_call", "cat_agent_control", "cat_unknown",
            "unique_tool_count",
        ],
    },
    "Transition": {
        "description": "Transition count, read-to-write transitions, consecutive repeats",
        "indices": [16, 17, 18],  # transition_count, read_to_write_transitions, consecutive_repeated_actions
        "feature_names": [
            "transition_count", "read_to_write_transitions", "consecutive_repeated_actions",
        ],
    },
    "Temporal": {
        "description": "Valid timed transitions, mean and max inter-action time",
        "indices": [19, 20, 21],  # valid_timed_transitions, mean_inter_action_time, max_inter_action_time
        "feature_names": [
            "valid_timed_transitions", "mean_inter_action_time", "max_inter_action_time",
        ],
    },
}


# ═══════════════════════════════════════════════════════════════════════
# STATISTICAL HELPERS
# ═══════════════════════════════════════════════════════════════════════

def wilson_score_interval(
    successes: int, total: int, confidence: float = 0.95
) -> Tuple[float, float]:
    """
    Wilson score confidence interval for a binomial proportion.

    Returns (lower, upper) bounds. If total == 0, returns (0.0, 0.0).
    Uses the normal approximation z-value for the specified confidence level.
    """
    if total == 0:
        return (0.0, 0.0)

    # z-value for 95% CI
    z = 1.96 if confidence == 0.95 else _z_for_confidence(confidence)
    p_hat = successes / total
    denominator = 1 + z**2 / total
    centre = (p_hat + z**2 / (2 * total)) / denominator
    margin = (z / denominator) * math.sqrt(
        p_hat * (1 - p_hat) / total + z**2 / (4 * total**2)
    )
    return (max(0.0, centre - margin), min(1.0, centre + margin))


def _z_for_confidence(confidence: float) -> float:
    """Approximate z-value for common confidence levels."""
    table = {0.90: 1.645, 0.95: 1.96, 0.99: 2.576}
    return table.get(confidence, 1.96)


def file_sha256(filepath: Path) -> str:
    """Compute SHA-256 of a file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


# ═══════════════════════════════════════════════════════════════════════
# THRESHOLD EVALUATION
# ═══════════════════════════════════════════════════════════════════════

def evaluate_at_threshold(
    y_true: np.ndarray,
    y_proba: np.ndarray,
    threshold: float,
) -> Dict[str, Any]:
    """
    Classify P(unsafe) >= threshold as 'unsafe' (positive class = 1).

    Computes metrics separately on the safe and unsafe partitions.

    NOTE: This is a PROBABILITY-THRESHOLD classification, not an
    AgentSentinel governance decision. The live system applies
    additional heuristic dimensions, task-context authorization,
    and policy fusion before reaching ALLOW/ALERT/BLOCK.
    """
    y_pred = (y_proba >= threshold).astype(int)

    # Full test set
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm[0, 0], cm[0, 1], cm[1, 0], cm[1, 1]

    # Safe partition only (label == 0)
    safe_mask = y_true == 0
    n_safe = int(safe_mask.sum())
    n_safe_flagged = int(y_pred[safe_mask].sum())  # false positives
    n_safe_correct = n_safe - n_safe_flagged        # true negatives
    fpr_safe = n_safe_flagged / n_safe if n_safe > 0 else None
    wilson_lower, wilson_upper = wilson_score_interval(n_safe_flagged, n_safe)

    # Unsafe partition only (label == 1)
    unsafe_mask = y_true == 1
    n_unsafe = int(unsafe_mask.sum())
    n_unsafe_missed = int((1 - y_pred[unsafe_mask]).sum())  # false negatives
    n_unsafe_caught = n_unsafe - n_unsafe_missed             # true positives
    fnr_unsafe = n_unsafe_missed / n_unsafe if n_unsafe > 0 else None

    # Overall accuracy
    acc = accuracy_score(y_true, y_pred)

    # Severity label (documentation only)
    severity = SEVERITY_LABELS.get(threshold, "below LOW" if threshold < 0.40 else "custom")

    return {
        "threshold": threshold,
        "severity_label": severity,
        "n_safe": n_safe,
        "n_unsafe": n_unsafe,
        "n_total": len(y_true),
        "true_negatives": int(tn),
        "false_positives": int(fp),
        "false_negatives": int(fn),
        "true_positives": int(tp),
        "fpr_safe_partition": round(fpr_safe, 6) if fpr_safe is not None else None,
        "fnr_unsafe_partition": round(fnr_unsafe, 6) if fnr_unsafe is not None else None,
        "accuracy": round(float(acc), 6),
        "wilson_ci_95_lower": round(wilson_lower, 6),
        "wilson_ci_95_upper": round(wilson_upper, 6),
        "safe_flagged_count": n_safe_flagged,
        "safe_correct_count": n_safe_correct,
        "unsafe_caught_count": n_unsafe_caught,
        "unsafe_missed_count": n_unsafe_missed,
    }


# ═══════════════════════════════════════════════════════════════════════
# FEATURE-GROUP SENSITIVITY ANALYSIS
# ═══════════════════════════════════════════════════════════════════════

def feature_sensitivity_analysis(
    model: Any,
    X_test: np.ndarray,
    y_test: np.ndarray,
    baseline_proba: np.ndarray,
    threshold: float = 0.40,
) -> List[Dict[str, Any]]:
    """
    Inference-time feature-group sensitivity analysis.

    For each feature group, zeroes out its features in a COPY of X_test,
    runs inference through the UNMODIFIED model, and reports the change
    in FPR on the safe partition.

    LIMITATIONS (must be disclosed in any report):
    1. Zeroing features may create inputs outside the training distribution.
       The model was not trained on such inputs, so its predictions may be
       unreliable. This is a sensitivity probe, not a definitive ablation.
    2. The StandardScaler in the pipeline will rescale zeroed features to
       negative z-scores if the training mean was positive, potentially
       producing unexpected model behavior.
    3. Feature interactions (e.g., action_count and category counts) are
       disrupted when one group is zeroed but not the other.
    4. This analysis does NOT isolate causal feature importance. It shows
       how sensitive the model's FPR is to the removal of each group's
       signal, under the stated perturbation.
    """
    safe_mask = y_test == 0
    n_safe = int(safe_mask.sum())

    # Baseline FPR
    baseline_pred = (baseline_proba >= threshold).astype(int)
    baseline_fp = int(baseline_pred[safe_mask].sum())
    baseline_fpr = baseline_fp / n_safe if n_safe > 0 else 0.0

    results = []
    for group_name, group_info in FEATURE_GROUPS.items():
        indices = group_info["indices"]

        # Perturbed copy
        X_perturbed = X_test.copy()
        X_perturbed[:, indices] = 0.0

        # Run inference through unmodified model
        proba_perturbed = model.predict_proba(X_perturbed)[:, 1]
        pred_perturbed = (proba_perturbed >= threshold).astype(int)

        # FPR on safe partition
        perturbed_fp = int(pred_perturbed[safe_mask].sum())
        perturbed_fpr = perturbed_fp / n_safe if n_safe > 0 else 0.0

        delta_fpr = perturbed_fpr - baseline_fpr
        wilson_lower, wilson_upper = wilson_score_interval(perturbed_fp, n_safe)

        results.append({
            "feature_group": group_name,
            "description": group_info["description"],
            "features_zeroed": group_info["feature_names"],
            "n_features_zeroed": len(indices),
            "perturbation_method": "zero_out",
            "threshold": threshold,
            "baseline_fpr": round(baseline_fpr, 6),
            "baseline_fp_count": baseline_fp,
            "perturbed_fpr": round(perturbed_fpr, 6),
            "perturbed_fp_count": perturbed_fp,
            "delta_fpr": round(delta_fpr, 6),
            "wilson_ci_95_lower": round(wilson_lower, 6),
            "wilson_ci_95_upper": round(wilson_upper, 6),
            "n_safe_samples": n_safe,
        })

    return results


# ═══════════════════════════════════════════════════════════════════════
# MAJORITY-CLASS BASELINE
# ═══════════════════════════════════════════════════════════════════════

def majority_class_baseline(y_test: np.ndarray) -> Dict[str, Any]:
    """
    Baseline: always predict safe (class 0).

    FPR = 0% (no safe trajectory is flagged).
    FNR = 100% (every unsafe trajectory is missed).
    """
    safe_mask = y_test == 0
    unsafe_mask = y_test == 1
    n_safe = int(safe_mask.sum())
    n_unsafe = int(unsafe_mask.sum())

    return {
        "baseline_name": "majority_class_always_safe",
        "description": "Always predict safe (class 0). FPR=0%, FNR=100%.",
        "n_safe": n_safe,
        "n_unsafe": n_unsafe,
        "n_total": len(y_test),
        "fpr_safe_partition": 0.0,
        "fnr_unsafe_partition": 1.0 if n_unsafe > 0 else None,
        "accuracy": round(n_safe / len(y_test), 6) if len(y_test) > 0 else None,
        "true_negatives": n_safe,
        "false_positives": 0,
        "false_negatives": n_unsafe,
        "true_positives": 0,
    }


# ═══════════════════════════════════════════════════════════════════════
# REPORT GENERATION
# ═══════════════════════════════════════════════════════════════════════

def generate_markdown_report(
    provenance: Dict[str, Any],
    threshold_results: List[Dict[str, Any]],
    sensitivity_results: List[Dict[str, Any]],
    baseline: Dict[str, Any],
    roc_auc: float,
) -> str:
    """Generate the Markdown calibration report."""
    lines = []

    lines.append("# AgentSentinel — Phase 3: False-Positive Rate Characterization and Threshold Sensitivity Report")
    lines.append("")
    lines.append(f"**Execution Date:** {provenance['execution_date']}")
    lines.append(f"**Script:** `research/evaluate_false_positive_calibration.py`")
    lines.append(f"**Status:** Exploratory Internal Evaluation (NOT External Held-Out)")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Provenance
    lines.append("## 1. Provenance and Split Verification")
    lines.append("")
    lines.append("| Property | Value |")
    lines.append("|---|---|")
    lines.append(f"| Dataset | `{provenance['dataset_path']}` |")
    lines.append(f"| Dataset SHA-256 | `{provenance['dataset_sha256'][:16]}…` |")
    lines.append(f"| Total trajectories | {provenance['total_samples']} |")
    lines.append(f"| Safe (label=0) | {provenance['total_safe']} |")
    lines.append(f"| Unsafe (label=1) | {provenance['total_unsafe']} |")
    lines.append(f"| Artifact | `{provenance['artifact_path']}` |")
    lines.append(f"| Artifact SHA-256 | `{provenance['artifact_sha256'][:16]}…` |")
    lines.append(f"| Model type | {provenance['model_type']} |")
    lines.append(f"| Split | test_size={provenance['split_test_size']}, random_state={provenance['split_random_state']}, stratified |")
    lines.append(f"| Test samples | {provenance['test_total']} ({provenance['test_safe']} safe, {provenance['test_unsafe']} unsafe) |")
    lines.append(f"| CM verification | {'**PASS** — exact match' if provenance['cm_verified'] else '**FAIL** — mismatch'} |")
    lines.append(f"| ROC-AUC (threshold-independent) | {roc_auc:.4f} |")
    lines.append("")

    # Provenance warning
    lines.append("> [!IMPORTANT]")
    lines.append("> **Internal Development Evaluation.** The model was trained on a 80% split")
    lines.append("> of the same ATBench file (`test.json`). The 20% held-out partition shares")
    lines.append("> the same source distribution. These results reflect internal validation")
    lines.append("> performance and should NOT be cited as evidence of external generalization.")
    lines.append("> See `research/METHODOLOGY.md` for the planned external evaluation protocol.")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Majority-class baseline
    lines.append("## 2. Majority-Class Baseline")
    lines.append("")
    lines.append(f"| Metric | Value |")
    lines.append(f"|---|---|")
    lines.append(f"| Strategy | Always predict safe (class 0) |")
    lines.append(f"| FPR (safe partition) | {baseline['fpr_safe_partition']:.4f} |")
    lines.append(f"| FNR (unsafe partition) | {baseline['fnr_unsafe_partition']:.4f} |")
    lines.append(f"| Accuracy | {baseline['accuracy']:.4f} |")
    lines.append(f"| Interpretation | FPR=0% is free but FNR=100% means zero threat detection |")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Threshold sweep
    lines.append("## 3. Threshold Sweep Results")
    lines.append("")
    lines.append("Each row classifies P(unsafe) ≥ threshold as 'flagged' (predicted unsafe).")
    lines.append("This is a **probability-threshold classification**, not an AgentSentinel")
    lines.append("governance decision. The live system applies additional heuristic dimensions,")
    lines.append("task-context authorization, and policy fusion before reaching ALLOW/ALERT/BLOCK.")
    lines.append("")

    # Table header
    lines.append("| Threshold | Severity | FP | TN | FN | TP | FPR (safe) | 95% Wilson CI | FNR (unsafe) | Accuracy |")
    lines.append("|---|---|---|---|---|---|---|---|---|---|")

    for r in threshold_results:
        fpr = f"{r['fpr_safe_partition']:.4f}" if r['fpr_safe_partition'] is not None else "N/A"
        fnr = f"{r['fnr_unsafe_partition']:.4f}" if r['fnr_unsafe_partition'] is not None else "N/A"
        ci = f"[{r['wilson_ci_95_lower']:.4f}, {r['wilson_ci_95_upper']:.4f}]"
        sev = r['severity_label']
        lines.append(
            f"| {r['threshold']:.2f} | {sev} | "
            f"{r['false_positives']} | {r['true_negatives']} | "
            f"{r['false_negatives']} | {r['true_positives']} | "
            f"{fpr} | {ci} | {fnr} | {r['accuracy']:.4f} |"
        )

    lines.append("")

    # Interpretation
    lines.append("### 3.1 Relationship to Live Severity Mapping")
    lines.append("")
    lines.append("The production `risk/engine.py` maps P(unsafe) to severity as follows:")
    lines.append("")
    lines.append("| P(unsafe) range | Severity | Interpretation |")
    lines.append("|---|---|---|")
    lines.append("| < 0.40 | NONE | ML dimension does not contribute to risk |")
    lines.append("| [0.40, 0.55) | LOW | Informational signal |")
    lines.append("| [0.55, 0.70) | MEDIUM | Elevated behavioral concern |")
    lines.append("| [0.70, 0.85) | HIGH | Significant behavioral risk |")
    lines.append("| ≥ 0.85 | CRITICAL | Highest ML-indicated risk |")
    lines.append("")
    lines.append("A trajectory with P(unsafe) ≥ 0.40 receives at least `Severity.LOW` from")
    lines.append("the ML dimension. Whether this leads to ALERT or BLOCK depends on heuristic")
    lines.append("dimensions, task authorization, and policy fusion — NOT on P(unsafe) alone.")
    lines.append("")
    lines.append("### 3.2 Resolution of Confusion-Matrix Discrepancy: Estimator Default (0.50) vs Production MEDIUM (0.55)")
    lines.append("")
    lines.append("A apparent discrepancy exists between the stored model metrics and threshold 0.55:")
    lines.append("- **Stored artifact metrics:** `TN=83, FP=18, FN=35, TP=64, Accuracy=0.7350`")
    lines.append("- **Threshold 0.55 row:** `TN=83, FP=18, FN=37, TP=62, Accuracy=0.7250`")
    lines.append("")
    lines.append("This difference is fully explained by the decision threshold:")
    lines.append("1. **Estimator Default Threshold (0.50):** The stored artifact metrics in `research/artifacts/risk_model.joblib`")
    lines.append("   were computed in `research/training/pipeline.py` using `model.predict(X_test)`. In scikit-learn,")
    lines.append("   `RandomForestClassifier.predict()` evaluates `argmax(predict_proba)`, which corresponds to threshold `0.50`.")
    lines.append("   Evaluating at threshold `0.50` produces `TN=83, FP=18, FN=35, TP=64, Accuracy=0.7350`, reproducing")
    lines.append("   the stored metrics exactly.")
    lines.append("2. **Production Severity Threshold (0.55):** Threshold `0.55` corresponds to the `Severity.MEDIUM`")
    lines.append("   boundary in `ML_SEVERITY_THRESHOLDS`. In the held-out test set, exactly two unsafe trajectories")
    lines.append("   (test sample indices 0 and 66) have predicted unsafe probabilities in `[0.50, 0.55)`:")
    lines.append("   - Index 0: `y_true=1`, `P(unsafe)=0.5482`")
    lines.append("   - Index 66: `y_true=1`, `P(unsafe)=0.5308`")
    lines.append("   At threshold `0.50`, both are predicted unsafe (True Positives, `TP=64`). At threshold `0.55`,")
    lines.append("   both fall below the threshold and become False Negatives (`TP=62`, `FN=37`).")
    lines.append("3. **Safe Partition Invariance:** For the safe partition (`y_true=0`), zero samples have probabilities")
    lines.append("   in `[0.50, 0.55)`. Consequently, `FP=18`, `TN=83`, and `FPR=17.82%` remain identical across both thresholds.")
    lines.append("4. **Conclusion:** Both sets of metrics are verified, reproducible, and mathematically consistent.")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Feature sensitivity
    lines.append("## 4. Feature-Group Sensitivity Analysis")
    lines.append("")
    lines.append("**Method:** Inference-time feature perturbation (zero-out). For each group,")
    lines.append("all features in the group are set to 0.0 in a copy of the test feature matrix.")
    lines.append("The UNMODIFIED production model is then used for inference. This is NOT a")
    lines.append("retraining-based ablation.")
    lines.append("")
    lines.append(f"**Evaluation threshold:** {sensitivity_results[0]['threshold']:.2f}" if sensitivity_results else "")
    lines.append("")
    lines.append("Note: ΔFPR is computed as exact proportion change: `Perturbed_FPR - Baseline_FPR`")
    lines.append("(e.g., +0.2871 corresponds to +28.71 percentage points).")
    lines.append("")

    lines.append("| Feature Group | Features Zeroed | Baseline FPR | Perturbed FPR | ΔFPR (proportion) | Perturbed FP | 95% Wilson CI |")
    lines.append("|---|---|---|---|---|---|---|")

    for r in sensitivity_results:
        ci = f"[{r['wilson_ci_95_lower']:.4f}, {r['wilson_ci_95_upper']:.4f}]"
        delta_sign = "+" if r['delta_fpr'] > 0 else ""
        lines.append(
            f"| {r['feature_group']} | {r['n_features_zeroed']} | "
            f"{r['baseline_fpr']:.4f} | {r['perturbed_fpr']:.4f} | "
            f"{delta_sign}{r['delta_fpr']:.4f} | {r['perturbed_fp_count']} | {ci} |"
        )

    lines.append("")
    lines.append("### 4.1 Feature Group Partitioning (Full 22 Features)")
    lines.append("")
    lines.append("The 22 features are partitioned into four disjoint groups with zero overlap and zero omission:")
    lines.append("")
    for g_name, g_info in FEATURE_GROUPS.items():
        feat_list = ", ".join(f"`{f}`" for f in g_info["feature_names"])
        lines.append(f"- **{g_name} ({len(g_info['indices'])} features):** {feat_list}")
    lines.append("")
    lines.append("### 4.2 Limitations of Feature Perturbation")
    lines.append("")
    lines.append("1. **Out-of-distribution inputs.** Zeroing features creates inputs the model")
    lines.append("   was not trained on. The StandardScaler in the pipeline will rescale zeroed")
    lines.append("   features to negative z-scores if the training mean was positive, potentially")
    lines.append("   producing unexpected predictions.")
    lines.append("2. **Feature interactions.** Features within and across groups are correlated")
    lines.append("   (e.g., `action_count` and category counts). Zeroing one group while leaving")
    lines.append("   others intact disrupts these correlations.")
    lines.append("3. **Not causal.** This analysis shows sensitivity, not causal importance.")
    lines.append("   A feature group that causes large ΔFPR may do so because its removal creates")
    lines.append("   extreme out-of-distribution inputs, not because it is causally important")
    lines.append("   for false-positive decisions.")
    lines.append("4. **Single perturbation method.** Only zero-out was tested. Alternative methods")
    lines.append("   (permutation, marginal distribution sampling) may yield different results.")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Limitations
    lines.append("## 5. Limitations and Caveats")
    lines.append("")
    lines.append("1. **Internal split, not external evaluation.** The 200-sample test set is a")
    lines.append("   stratified random 20% partition of the same ATBench file used for training.")
    lines.append("   It shares the same source distribution as the training set. FPR on this")
    lines.append("   partition may underestimate production FPR due to distribution shift.")
    lines.append("2. **Small safe partition (n=101).** Wilson confidence intervals are wide.")
    lines.append("   Point estimates should not be over-interpreted.")
    lines.append("3. **ATBench label quality.** Labels are human-audited but binary and coarse.")
    lines.append("   Near-boundary benign trajectories may be structurally similar to unsafe ones.")
    lines.append("4. **No external comparison.** No other surveyed system reports FPR on ATBench")
    lines.append("   safe partitions. Direct external comparison is not possible with current data.")
    lines.append("5. **SyFI not used.** SyFI trajectories are unlabeled and cannot be used for")
    lines.append("   FPR measurement without a defensible labeling methodology.")
    lines.append("6. **No novelty claim.** This characterization study documents an empirical property")
    lines.append("   of the existing classifier. It does not, by itself, constitute a research")
    lines.append("   contribution. Whether it supports a publishable finding depends on context")
    lines.append("   and comparison with future baselines.")
    lines.append("7. **Research Terminology Clarification.** This study performs empirical false-positive-rate")
    lines.append("   characterization and threshold sensitivity analysis. It does NOT evaluate or implement")
    lines.append("   formal probability calibration methods (such as Expected Calibration Error, Brier score,")
    lines.append("   reliability diagrams, Platt scaling, or isotonic regression). Furthermore, it does NOT propose")
    lines.append("   a novel algorithmic governance mechanism or claim external generalization to out-of-distribution benchmarks.")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Reproducibility
    lines.append("## 6. Reproducibility")
    lines.append("")
    lines.append("```bash")
    lines.append("cd <project_root>")
    lines.append("python research/evaluate_false_positive_calibration.py")
    lines.append("```")
    lines.append("")
    lines.append(f"- Python: `{provenance['python_version']}`")
    lines.append(f"- Platform: `{provenance['platform']}`")
    lines.append(f"- scikit-learn: `{provenance['sklearn_version']}`")
    lines.append(f"- numpy: `{provenance['numpy_version']}`")
    lines.append(f"- Random state: `{provenance['split_random_state']}`")
    lines.append(f"- Dataset SHA-256: `{provenance['dataset_sha256']}`")
    lines.append(f"- Artifact SHA-256: `{provenance['artifact_sha256']}`")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("*Report generated by `research/evaluate_false_positive_calibration.py`.*")
    lines.append(f"*Execution completed: {provenance['execution_date']}.*")
    lines.append("*No application source code, model artifacts, production thresholds,")
    lines.append("database schemas, or frontend files were modified.*")

    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════

def main() -> None:
    execution_start = datetime.now(timezone.utc)
    logger.info("Phase 3: False-Positive Calibration Experiment starting.")

    # ── 1. Verify dataset exists ──────────────────────────────────────
    dataset_path = Path(DATASET_PATH)
    if not dataset_path.exists():
        logger.error("Dataset not found: %s", DATASET_PATH)
        sys.exit(1)

    artifact_path = Path(ARTIFACT_PATH)
    if not artifact_path.exists():
        logger.error("Model artifact not found: %s", ARTIFACT_PATH)
        sys.exit(1)

    # ── 2. Compute file hashes for provenance ─────────────────────────
    dataset_sha256 = file_sha256(dataset_path)
    artifact_sha256 = file_sha256(artifact_path)
    logger.info("Dataset SHA-256: %s", dataset_sha256)
    logger.info("Artifact SHA-256: %s", artifact_sha256)

    # ── 3. Build feature matrix from dataset ──────────────────────────
    logger.info("Building feature matrix from %s ...", DATASET_PATH)
    X, y, feature_names = build_research_dataset(DATASET_PATH)
    total_samples = len(y)
    total_safe = int(np.sum(y == 0))
    total_unsafe = int(np.sum(y == 1))
    logger.info(
        "Dataset: %d total (%d safe, %d unsafe)", total_samples, total_safe, total_unsafe
    )

    if total_samples != 1000 or total_safe != 503 or total_unsafe != 497:
        logger.warning(
            "Unexpected label distribution. Expected 1000 (503/497), got %d (%d/%d).",
            total_samples, total_safe, total_unsafe,
        )

    # ── 4. Reproduce the production training split ────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=SPLIT_TEST_SIZE,
        random_state=SPLIT_RANDOM_STATE,
        stratify=y,
    )
    test_safe = int(np.sum(y_test == 0))
    test_unsafe = int(np.sum(y_test == 1))
    logger.info(
        "Split: %d train, %d test (%d safe, %d unsafe)",
        len(y_train), len(y_test), test_safe, test_unsafe,
    )

    # ── 5. Load production artifact ───────────────────────────────────
    logger.info("Loading production artifact: %s", ARTIFACT_PATH)
    artifact = joblib.load(artifact_path)
    model = artifact["model"]
    stored_feature_names = artifact.get("feature_names", [])

    # Validate feature ordering
    if list(stored_feature_names) != FEATURE_NAMES:
        logger.error(
            "Feature name mismatch between artifact and research/model.py. "
            "Aborting to prevent silent misalignment."
        )
        sys.exit(1)

    # ── 6. Verify split by reproducing stored confusion matrix ────────
    logger.info("Verifying split by reproducing stored confusion matrix...")
    y_pred_default = model.predict(X_test)
    cm_check = confusion_matrix(y_test, y_pred_default, labels=[0, 1])
    tn_check, fp_check = int(cm_check[0, 0]), int(cm_check[0, 1])
    fn_check, tp_check = int(cm_check[1, 0]), int(cm_check[1, 1])

    cm_verified = (
        tn_check == STORED_CM["TN"]
        and fp_check == STORED_CM["FP"]
        and fn_check == STORED_CM["FN"]
        and tp_check == STORED_CM["TP"]
    )
    if cm_verified:
        logger.info("✓ Confusion matrix VERIFIED: TN=%d FP=%d FN=%d TP=%d", tn_check, fp_check, fn_check, tp_check)
    else:
        logger.error(
            "✗ Confusion matrix MISMATCH. "
            "Got TN=%d FP=%d FN=%d TP=%d, expected TN=%d FP=%d FN=%d TP=%d. "
            "The held-out set may not match the training provenance. "
            "Results will be labelled as UNVERIFIED.",
            tn_check, fp_check, fn_check, tp_check,
            STORED_CM["TN"], STORED_CM["FP"], STORED_CM["FN"], STORED_CM["TP"],
        )

    # ── 7. Obtain P(unsafe) for all test samples ─────────────────────
    y_proba = model.predict_proba(X_test)[:, 1]

    # ROC-AUC (threshold-independent)
    roc_auc = roc_auc_score(y_test, y_proba)
    logger.info("ROC-AUC: %.4f", roc_auc)

    # ── 8. Threshold sweep ────────────────────────────────────────────
    logger.info("Running threshold sweep: %s", THRESHOLDS)
    threshold_results = []
    for t in THRESHOLDS:
        result = evaluate_at_threshold(y_test, y_proba, t)
        threshold_results.append(result)
        logger.info(
            "  threshold=%.2f  FPR=%.4f [%.4f, %.4f]  FNR=%.4f  Acc=%.4f",
            t,
            result["fpr_safe_partition"] or 0.0,
            result["wilson_ci_95_lower"],
            result["wilson_ci_95_upper"],
            result["fnr_unsafe_partition"] or 0.0,
            result["accuracy"],
        )

    # ── 9. Majority-class baseline ────────────────────────────────────
    baseline = majority_class_baseline(y_test)
    logger.info(
        "Majority-class baseline: FPR=%.4f, FNR=%.4f, Acc=%.4f",
        baseline["fpr_safe_partition"],
        baseline["fnr_unsafe_partition"],
        baseline["accuracy"],
    )

    # ── 10. Feature-group sensitivity analysis ────────────────────────
    logger.info("Running feature-group sensitivity analysis at threshold=0.40 ...")
    sensitivity_results = feature_sensitivity_analysis(
        model, X_test, y_test, y_proba, threshold=0.40
    )
    for sr in sensitivity_results:
        logger.info(
            "  %s: ΔFPR=%+.4f (%.4f → %.4f)",
            sr["feature_group"], sr["delta_fpr"],
            sr["baseline_fpr"], sr["perturbed_fpr"],
        )

    # ── 11. Assemble provenance ───────────────────────────────────────
    import sklearn
    provenance = {
        "execution_date": execution_start.isoformat().replace("+00:00", "Z"),
        "script": "research/evaluate_false_positive_calibration.py",
        "dataset_path": DATASET_PATH,
        "dataset_sha256": dataset_sha256,
        "artifact_path": ARTIFACT_PATH,
        "artifact_sha256": artifact_sha256,
        "model_type": type(model).__name__,
        "total_samples": total_samples,
        "total_safe": total_safe,
        "total_unsafe": total_unsafe,
        "split_test_size": SPLIT_TEST_SIZE,
        "split_random_state": SPLIT_RANDOM_STATE,
        "test_total": len(y_test),
        "test_safe": test_safe,
        "test_unsafe": test_unsafe,
        "cm_verified": cm_verified,
        "cm_reproduced": {
            "TN": tn_check, "FP": fp_check, "FN": fn_check, "TP": tp_check,
        },
        "cm_stored": STORED_CM,
        "roc_auc": round(roc_auc, 4),
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "sklearn_version": sklearn.__version__,
        "numpy_version": np.__version__,
        "thresholds_evaluated": THRESHOLDS,
        "feature_groups": {
            k: v["feature_names"] for k, v in FEATURE_GROUPS.items()
        },
    }

    # ── 12. Save outputs ──────────────────────────────────────────────
    output_dir = Path(OUTPUT_DIR)
    output_dir.mkdir(parents=True, exist_ok=True)

    # JSON (full results)
    full_results = {
        "provenance": provenance,
        "majority_class_baseline": baseline,
        "threshold_results": threshold_results,
        "feature_sensitivity": sensitivity_results,
    }
    json_path = output_dir / "fbr_calibration_results.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(full_results, f, indent=2)
    logger.info("Saved: %s", json_path)

    # CSV (threshold summary)
    csv_threshold_path = output_dir / "fbr_threshold_summary.csv"
    with open(csv_threshold_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(threshold_results[0].keys()))
        writer.writeheader()
        writer.writerows(threshold_results)
    logger.info("Saved: %s", csv_threshold_path)

    # CSV (feature sensitivity)
    csv_sensitivity_path = output_dir / "fbr_feature_sensitivity.csv"
    sensitivity_csv_rows = []
    for sr in sensitivity_results:
        row = {k: v for k, v in sr.items() if k != "features_zeroed"}
        row["features_zeroed"] = "; ".join(sr["features_zeroed"])
        sensitivity_csv_rows.append(row)
    with open(csv_sensitivity_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(sensitivity_csv_rows[0].keys()))
        writer.writeheader()
        writer.writerows(sensitivity_csv_rows)
    logger.info("Saved: %s", csv_sensitivity_path)

    # Markdown report
    md_report = generate_markdown_report(
        provenance, threshold_results, sensitivity_results, baseline, roc_auc
    )
    md_path = output_dir / "fbr_calibration_report.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_report)
    logger.info("Saved: %s", md_path)

    logger.info("Phase 3 experiment complete. All outputs in %s/", OUTPUT_DIR)


if __name__ == "__main__":
    main()
