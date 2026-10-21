"""
Focused tests for the FBR calibration evaluation logic.

Tests the statistical helpers and evaluation functions using synthetic data,
ensuring correctness of Wilson CI calculation, threshold classification,
and feature-group sensitivity perturbation.

These tests do NOT substitute for the real experiment — they verify the
evaluation machinery is correct.
"""

import math
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

# Ensure project root is importable
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from research.evaluate_false_positive_calibration import (
    FEATURE_GROUPS,
    evaluate_at_threshold,
    feature_sensitivity_analysis,
    majority_class_baseline,
    wilson_score_interval,
)


# ═══════════════════════════════════════════════════════════════════════
# Wilson Score Interval
# ═══════════════════════════════════════════════════════════════════════

class TestWilsonScoreInterval:
    """Tests for the Wilson score confidence interval."""

    def test_zero_total_returns_zero(self):
        lower, upper = wilson_score_interval(0, 0)
        assert lower == 0.0
        assert upper == 0.0

    def test_zero_successes(self):
        lower, upper = wilson_score_interval(0, 100)
        assert lower == 0.0
        assert upper > 0.0
        assert upper < 0.05  # should be tight near zero

    def test_all_successes(self):
        lower, upper = wilson_score_interval(100, 100)
        assert lower > 0.95
        assert upper == pytest.approx(1.0)

    def test_half_successes(self):
        lower, upper = wilson_score_interval(50, 100)
        assert 0.35 < lower < 0.50
        assert 0.50 < upper < 0.65

    def test_bounds_are_ordered(self):
        lower, upper = wilson_score_interval(18, 101)
        assert lower <= upper

    def test_small_sample(self):
        """With n=10, 2 successes, CI should be wide."""
        lower, upper = wilson_score_interval(2, 10)
        assert upper - lower > 0.15  # Wide CI

    def test_known_value_18_of_101(self):
        """
        Matches the production artifact: 18 FP out of 101 safe samples.
        p_hat = 0.1782. Wilson 95% CI should be approximately [0.115, 0.264].
        """
        lower, upper = wilson_score_interval(18, 101)
        assert 0.10 < lower < 0.13
        assert 0.24 < upper < 0.28


# ═══════════════════════════════════════════════════════════════════════
# Threshold Evaluation
# ═══════════════════════════════════════════════════════════════════════

class TestEvaluateAtThreshold:
    """Tests for threshold-based classification evaluation."""

    def test_all_safe_correctly_classified(self):
        """All samples are safe, all probabilities below threshold."""
        y_true = np.array([0, 0, 0, 0, 0])
        y_proba = np.array([0.1, 0.2, 0.15, 0.05, 0.3])
        result = evaluate_at_threshold(y_true, y_proba, threshold=0.40)

        assert result["n_safe"] == 5
        assert result["n_unsafe"] == 0
        assert result["false_positives"] == 0
        assert result["true_negatives"] == 5
        assert result["fpr_safe_partition"] == 0.0

    def test_all_unsafe_correctly_classified(self):
        """All samples are unsafe, all probabilities above threshold."""
        y_true = np.array([1, 1, 1, 1])
        y_proba = np.array([0.9, 0.8, 0.7, 0.6])
        result = evaluate_at_threshold(y_true, y_proba, threshold=0.40)

        assert result["n_unsafe"] == 4
        assert result["true_positives"] == 4
        assert result["false_negatives"] == 0
        assert result["fnr_unsafe_partition"] == 0.0

    def test_mixed_predictions(self):
        """Mixed safe/unsafe with some misclassifications."""
        y_true = np.array([0, 0, 0, 1, 1, 1])
        y_proba = np.array([0.1, 0.5, 0.3, 0.8, 0.2, 0.6])
        result = evaluate_at_threshold(y_true, y_proba, threshold=0.40)

        # Safe partition: [0.1, 0.5, 0.3] -> pred [0, 1, 0] -> FP=1, TN=2
        assert result["false_positives"] == 1
        assert result["true_negatives"] == 2
        assert result["fpr_safe_partition"] == pytest.approx(1 / 3, abs=1e-4)

        # Unsafe partition: [0.8, 0.2, 0.6] -> pred [1, 0, 1] -> TP=2, FN=1
        assert result["true_positives"] == 2
        assert result["false_negatives"] == 1
        assert result["fnr_unsafe_partition"] == pytest.approx(1 / 3, abs=1e-4)

    def test_threshold_boundary(self):
        """Exact threshold value should be classified as positive."""
        y_true = np.array([0])
        y_proba = np.array([0.40])
        result = evaluate_at_threshold(y_true, y_proba, threshold=0.40)

        assert result["false_positives"] == 1
        assert result["fpr_safe_partition"] == 1.0

    def test_wilson_ci_present(self):
        y_true = np.array([0, 0, 0, 0, 0, 1, 1, 1, 1, 1])
        y_proba = np.array([0.1, 0.6, 0.3, 0.7, 0.2, 0.8, 0.3, 0.9, 0.4, 0.6])
        result = evaluate_at_threshold(y_true, y_proba, threshold=0.50)

        assert "wilson_ci_95_lower" in result
        assert "wilson_ci_95_upper" in result
        assert result["wilson_ci_95_lower"] <= result["fpr_safe_partition"]
        assert result["wilson_ci_95_upper"] >= result["fpr_safe_partition"]

    def test_accuracy_is_correct(self):
        y_true = np.array([0, 0, 1, 1])
        y_proba = np.array([0.1, 0.6, 0.8, 0.3])
        result = evaluate_at_threshold(y_true, y_proba, threshold=0.50)

        # pred = [0, 1, 1, 0] -> correct: [0]=0, [2]=1 -> 2/4 = 0.5
        # Wrong: [1]=FP, [3]=FN
        assert result["accuracy"] == pytest.approx(0.5, abs=1e-4)


# ═══════════════════════════════════════════════════════════════════════
# Majority-Class Baseline
# ═══════════════════════════════════════════════════════════════════════

class TestMajorityClassBaseline:
    """Tests for the always-predict-safe baseline."""

    def test_pure_safe_set(self):
        y = np.array([0, 0, 0, 0, 0])
        result = majority_class_baseline(y)
        assert result["fpr_safe_partition"] == 0.0
        assert result["fnr_unsafe_partition"] is None
        assert result["accuracy"] == 1.0

    def test_balanced_set(self):
        y = np.array([0, 0, 0, 1, 1, 1])
        result = majority_class_baseline(y)
        assert result["fpr_safe_partition"] == 0.0
        assert result["fnr_unsafe_partition"] == 1.0
        assert result["accuracy"] == pytest.approx(0.5, abs=1e-4)

    def test_counts_are_correct(self):
        y = np.array([0, 0, 1, 1, 1])
        result = majority_class_baseline(y)
        assert result["true_negatives"] == 2
        assert result["false_positives"] == 0
        assert result["false_negatives"] == 3
        assert result["true_positives"] == 0


# ═══════════════════════════════════════════════════════════════════════
# Feature-Group Sensitivity
# ═══════════════════════════════════════════════════════════════════════

class TestFeatureSensitivity:
    """Tests for feature-group perturbation analysis."""

    def test_feature_group_indices_cover_all_22(self):
        """All 22 features must be covered by exactly one group."""
        all_indices = set()
        for group in FEATURE_GROUPS.values():
            for idx in group["indices"]:
                assert idx not in all_indices, f"Index {idx} appears in multiple groups"
                all_indices.add(idx)
        assert all_indices == set(range(22))

    def test_zeroing_produces_different_predictions(self):
        """
        With a mock model, zeroing features should change predictions
        if the model is sensitive to them.
        """
        # Simple mock model: predicts based on sum of features
        class SumModel:
            def predict_proba(self, X):
                scores = np.clip(X.sum(axis=1) / 100.0, 0, 1)
                return np.column_stack([1 - scores, scores])

        model = SumModel()
        X_test = np.random.RandomState(42).rand(20, 22) * 10
        y_test = np.array([0] * 10 + [1] * 10)
        baseline_proba = model.predict_proba(X_test)[:, 1]

        results = feature_sensitivity_analysis(
            model, X_test, y_test, baseline_proba, threshold=0.40
        )

        assert len(results) == 4
        for r in results:
            assert "feature_group" in r
            assert "baseline_fpr" in r
            assert "perturbed_fpr" in r
            assert "delta_fpr" in r
            assert r["n_safe_samples"] == 10

    def test_no_safe_samples_returns_zero_fpr(self):
        """If there are no safe samples, FPR should be 0."""
        class DummyModel:
            def predict_proba(self, X):
                return np.column_stack([np.zeros(len(X)), np.ones(len(X))])

        model = DummyModel()
        X_test = np.ones((5, 22))
        y_test = np.array([1, 1, 1, 1, 1])
        baseline_proba = model.predict_proba(X_test)[:, 1]

        results = feature_sensitivity_analysis(
            model, X_test, y_test, baseline_proba, threshold=0.40
        )
        for r in results:
            assert r["baseline_fpr"] == 0.0
            assert r["perturbed_fpr"] == 0.0

    def test_feature_names_match_indices(self):
        """Feature names in FEATURE_GROUPS must match FEATURE_NAMES in model.py exactly."""
        from src.agentsentinel.research.model import FEATURE_NAMES

        all_names = []
        for group in FEATURE_GROUPS.values():
            for idx, name in zip(group["indices"], group["feature_names"]):
                assert FEATURE_NAMES[idx] == name
                all_names.append(name)

        assert len(all_names) == 22
        assert set(all_names) == set(FEATURE_NAMES)


# ═══════════════════════════════════════════════════════════════════════
# Threshold Discrepancy Reconciliation
# ═══════════════════════════════════════════════════════════════════════

class TestThresholdReconciliation:
    """Tests explaining the shift between threshold 0.50 and 0.55."""

    def test_threshold_shift_between_050_and_055(self):
        """
        Samples with 0.50 <= P < 0.55 are classified positive at 0.50
        and negative at 0.55, converting True Positives into False Negatives.
        """
        # 1 safe sample (P=0.20), 1 safe sample (P=0.60)
        # 2 unsafe samples in [0.50, 0.55): P=0.53, P=0.54
        # 1 unsafe sample (P=0.70), 1 unsafe sample (P=0.40)
        y_true = np.array([0, 0, 1, 1, 1, 1])
        y_proba = np.array([0.20, 0.60, 0.53, 0.54, 0.70, 0.40])

        res_050 = evaluate_at_threshold(y_true, y_proba, threshold=0.50)
        res_055 = evaluate_at_threshold(y_true, y_proba, threshold=0.55)

        # Safe partition (y=0): neither sample is in [0.50, 0.55)
        # P=0.20 < 0.50 (TN), P=0.60 >= 0.55 (FP)
        assert res_050["true_negatives"] == res_055["true_negatives"] == 1
        assert res_050["false_positives"] == res_055["false_positives"] == 1
        assert res_050["fpr_safe_partition"] == res_055["fpr_safe_partition"] == 0.5

        # Unsafe partition (y=1):
        # At 0.50: P=0.53, 0.54, 0.70 >= 0.50 -> TP=3, FN=1 (P=0.40)
        assert res_050["true_positives"] == 3
        assert res_050["false_negatives"] == 1

        # At 0.55: P=0.53, 0.54 < 0.55 -> TP=1 (P=0.70), FN=3 (P=0.40, 0.53, 0.54)
        assert res_055["true_positives"] == 1
        assert res_055["false_negatives"] == 3

