"""
Tests for Milestone 5 — Behavioral Risk Engine.

Verifies:
    - Threshold validation (monotonic ordering)
    - Threshold mapping (HIGHER/LOWER_IS_MORE_SEVERE boundaries)
    - All four behavioral dimensions
    - EvidenceQuality computation and precedence
    - Unevaluable dimension semantics (severity=None != Severity.NONE)
    - Overall severity aggregation (excludes EvidenceQuality and unevaluable dims)
    - Explainable EvidenceItem correctness
    - Determinism
    - Input immutability
"""

import pytest

from src.agentsentinel.features.extractor import TrajectoryFeatures
from src.agentsentinel.models.normalized import ActionCategory
from src.agentsentinel.risk.models import (
    EvidenceQuality,
    RiskDimensionResult,
    Severity,
    SeverityThresholds,
    ThresholdDirection,
)
from src.agentsentinel.risk.engine import (
    BehavioralRiskConfig,
    BehavioralRiskEngine,
    default_config,
)


# ──────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────

def _make_features(**overrides) -> TrajectoryFeatures:
    """Create a TrajectoryFeatures with sensible zero-defaults, overridable."""
    defaults = dict(
        action_count=0,
        event_count=0,
        category_counts={},
        mutating_known_true=0,
        mutating_known_false=0,
        mutating_unknown=0,
        destructive_known_true=0,
        destructive_known_false=0,
        destructive_unknown=0,
        unique_tool_count=0,
        transition_count=0,
        read_to_write_transitions=0,
        consecutive_repeated_actions=0,
        valid_timed_transitions=0,
        mean_inter_action_time=None,
        max_inter_action_time=None,
    )
    defaults.update(overrides)
    return TrajectoryFeatures(**defaults)


# ──────────────────────────────────────────────────────────
# Threshold Validation
# ──────────────────────────────────────────────────────────

class TestThresholdValidation:

    def test_valid_higher_is_more_severe(self):
        t = SeverityThresholds(
            direction=ThresholdDirection.HIGHER_IS_MORE_SEVERE,
            low=1, medium=2, high=3, critical=5,
        )
        assert t.low == 1

    def test_valid_lower_is_more_severe(self):
        t = SeverityThresholds(
            direction=ThresholdDirection.LOWER_IS_MORE_SEVERE,
            low=5.0, medium=2.0, high=1.0, critical=0.5,
        )
        assert t.low == 5.0

    def test_invalid_higher_ordering_rejected(self):
        with pytest.raises(ValueError, match="HIGHER_IS_MORE_SEVERE"):
            SeverityThresholds(
                direction=ThresholdDirection.HIGHER_IS_MORE_SEVERE,
                low=10, medium=5, high=3, critical=1,
            )

    def test_invalid_lower_ordering_rejected(self):
        with pytest.raises(ValueError, match="LOWER_IS_MORE_SEVERE"):
            SeverityThresholds(
                direction=ThresholdDirection.LOWER_IS_MORE_SEVERE,
                low=0.5, medium=1.0, high=2.0, critical=5.0,
            )

    def test_equal_thresholds_valid_higher(self):
        t = SeverityThresholds(
            direction=ThresholdDirection.HIGHER_IS_MORE_SEVERE,
            low=1, medium=1, high=1, critical=1,
        )
        assert t.evaluate(1) == Severity.CRITICAL

    def test_equal_thresholds_valid_lower(self):
        t = SeverityThresholds(
            direction=ThresholdDirection.LOWER_IS_MORE_SEVERE,
            low=1.0, medium=1.0, high=1.0, critical=1.0,
        )
        assert t.evaluate(1.0) == Severity.CRITICAL


# ──────────────────────────────────────────────────────────
# Threshold Mapping — HIGHER_IS_MORE_SEVERE
# ──────────────────────────────────────────────────────────

class TestHigherIsMoreSevereMapping:

    @pytest.fixture
    def thresholds(self):
        return SeverityThresholds(
            direction=ThresholdDirection.HIGHER_IS_MORE_SEVERE,
            low=1, medium=3, high=5, critical=10,
        )

    def test_none_boundary(self, thresholds):
        assert thresholds.evaluate(0) == Severity.NONE

    def test_low_boundary(self, thresholds):
        assert thresholds.evaluate(1) == Severity.LOW

    def test_between_low_and_medium(self, thresholds):
        assert thresholds.evaluate(2) == Severity.LOW

    def test_medium_boundary(self, thresholds):
        assert thresholds.evaluate(3) == Severity.MEDIUM

    def test_between_medium_and_high(self, thresholds):
        assert thresholds.evaluate(4) == Severity.MEDIUM

    def test_high_boundary(self, thresholds):
        assert thresholds.evaluate(5) == Severity.HIGH

    def test_between_high_and_critical(self, thresholds):
        assert thresholds.evaluate(9) == Severity.HIGH

    def test_critical_boundary(self, thresholds):
        assert thresholds.evaluate(10) == Severity.CRITICAL

    def test_above_critical(self, thresholds):
        assert thresholds.evaluate(100) == Severity.CRITICAL


# ──────────────────────────────────────────────────────────
# Threshold Mapping — LOWER_IS_MORE_SEVERE
# ──────────────────────────────────────────────────────────

class TestLowerIsMoreSevereMapping:

    @pytest.fixture
    def thresholds(self):
        return SeverityThresholds(
            direction=ThresholdDirection.LOWER_IS_MORE_SEVERE,
            low=5.0, medium=2.0, high=1.0, critical=0.5,
        )

    def test_none_boundary(self, thresholds):
        assert thresholds.evaluate(10.0) == Severity.NONE

    def test_above_low(self, thresholds):
        assert thresholds.evaluate(5.1) == Severity.NONE

    def test_low_boundary(self, thresholds):
        assert thresholds.evaluate(5.0) == Severity.LOW

    def test_between_low_and_medium(self, thresholds):
        assert thresholds.evaluate(3.0) == Severity.LOW

    def test_medium_boundary(self, thresholds):
        assert thresholds.evaluate(2.0) == Severity.MEDIUM

    def test_between_medium_and_high(self, thresholds):
        assert thresholds.evaluate(1.5) == Severity.MEDIUM

    def test_high_boundary(self, thresholds):
        assert thresholds.evaluate(1.0) == Severity.HIGH

    def test_between_high_and_critical(self, thresholds):
        assert thresholds.evaluate(0.7) == Severity.HIGH

    def test_critical_boundary(self, thresholds):
        assert thresholds.evaluate(0.5) == Severity.CRITICAL

    def test_below_critical(self, thresholds):
        assert thresholds.evaluate(0.1) == Severity.CRITICAL


# ──────────────────────────────────────────────────────────
# DestructiveIntensity
# ──────────────────────────────────────────────────────────

class TestDestructiveIntensity:

    def test_zero_destructive(self):
        engine = BehavioralRiskEngine()
        features = _make_features(action_count=5, destructive_known_true=0)
        result = engine.evaluate(features)
        dim = result.dimensions["DestructiveIntensity"]
        assert dim.is_evaluable is True
        assert dim.severity == Severity.NONE
        assert dim.evidence == []

    def test_high_destructive(self):
        engine = BehavioralRiskEngine()
        features = _make_features(action_count=5, destructive_known_true=3)
        result = engine.evaluate(features)
        dim = result.dimensions["DestructiveIntensity"]
        assert dim.is_evaluable is True
        assert dim.severity == Severity.HIGH
        assert len(dim.evidence) == 1
        assert dim.evidence[0].feature_name == "destructive_known_true"
        assert dim.evidence[0].feature_value == 3


# ──────────────────────────────────────────────────────────
# MutationIntensity
# ──────────────────────────────────────────────────────────

class TestMutationIntensity:

    def test_mutation_count_only(self):
        engine = BehavioralRiskEngine()
        features = _make_features(action_count=10, mutating_known_true=10)
        result = engine.evaluate(features)
        dim = result.dimensions["MutationIntensity"]
        assert dim.is_evaluable is True
        assert dim.severity == Severity.MEDIUM
        assert any(e.feature_name == "mutating_known_true" for e in dim.evidence)

    def test_r2w_only(self):
        engine = BehavioralRiskEngine()
        features = _make_features(action_count=10, read_to_write_transitions=10)
        result = engine.evaluate(features)
        dim = result.dimensions["MutationIntensity"]
        assert dim.is_evaluable is True
        assert dim.severity == Severity.HIGH
        assert any(e.feature_name == "read_to_write_transitions" for e in dim.evidence)

    def test_max_combination(self):
        """MutationIntensity = max(severity_count, severity_r2w)."""
        engine = BehavioralRiskEngine()
        # mutation count → MEDIUM (10), r2w → HIGH (10)
        features = _make_features(
            action_count=20,
            mutating_known_true=10,
            read_to_write_transitions=10,
        )
        result = engine.evaluate(features)
        dim = result.dimensions["MutationIntensity"]
        assert dim.severity == Severity.HIGH
        # Both signals should appear in evidence
        feature_names = {e.feature_name for e in dim.evidence}
        assert "mutating_known_true" in feature_names
        assert "read_to_write_transitions" in feature_names

    def test_zero_mutation(self):
        engine = BehavioralRiskEngine()
        features = _make_features(action_count=5)
        result = engine.evaluate(features)
        dim = result.dimensions["MutationIntensity"]
        assert dim.severity == Severity.NONE
        assert dim.evidence == []


# ──────────────────────────────────────────────────────────
# TemporalBurst
# ──────────────────────────────────────────────────────────

class TestTemporalBurst:

    def test_sufficient_timestamps_none_severity(self):
        """Sufficient temporal evidence but slow execution → NONE."""
        engine = BehavioralRiskEngine()
        features = _make_features(
            action_count=10,
            valid_timed_transitions=5,
            mean_inter_action_time=30.0,
        )
        result = engine.evaluate(features)
        dim = result.dimensions["TemporalBurst"]
        assert dim.is_evaluable is True
        assert dim.severity == Severity.NONE

    def test_sufficient_timestamps_high_burst(self):
        """Fast execution triggers severity."""
        engine = BehavioralRiskEngine()
        features = _make_features(
            action_count=10,
            valid_timed_transitions=5,
            mean_inter_action_time=0.8,
        )
        result = engine.evaluate(features)
        dim = result.dimensions["TemporalBurst"]
        assert dim.is_evaluable is True
        assert dim.severity == Severity.HIGH
        assert len(dim.evidence) == 1
        assert dim.evidence[0].feature_name == "mean_inter_action_time"

    def test_insufficient_timed_transitions(self):
        """Too few valid timed transitions → unevaluable."""
        engine = BehavioralRiskEngine()
        features = _make_features(
            action_count=10,
            valid_timed_transitions=1,
            mean_inter_action_time=0.1,
        )
        result = engine.evaluate(features)
        dim = result.dimensions["TemporalBurst"]
        assert dim.is_evaluable is False
        assert dim.severity is None
        assert dim.evidence == []

    def test_mean_inter_action_time_none(self):
        """Missing mean_inter_action_time → unevaluable."""
        engine = BehavioralRiskEngine()
        features = _make_features(
            action_count=10,
            valid_timed_transitions=0,
            mean_inter_action_time=None,
        )
        result = engine.evaluate(features)
        dim = result.dimensions["TemporalBurst"]
        assert dim.is_evaluable is False
        assert dim.severity is None

    def test_unevaluable_is_not_severity_none(self):
        """severity=None is strictly distinct from Severity.NONE."""
        engine = BehavioralRiskEngine()
        features = _make_features(action_count=5, valid_timed_transitions=0)
        result = engine.evaluate(features)
        dim = result.dimensions["TemporalBurst"]
        assert dim.severity is None
        assert dim.severity != Severity.NONE


# ──────────────────────────────────────────────────────────
# RepetitionAnomaly
# ──────────────────────────────────────────────────────────

class TestRepetitionAnomaly:

    def test_no_repetition(self):
        engine = BehavioralRiskEngine()
        features = _make_features(action_count=5, consecutive_repeated_actions=0)
        result = engine.evaluate(features)
        dim = result.dimensions["RepetitionAnomaly"]
        assert dim.is_evaluable is True
        assert dim.severity == Severity.NONE

    def test_high_repetition(self):
        engine = BehavioralRiskEngine()
        features = _make_features(action_count=20, consecutive_repeated_actions=10)
        result = engine.evaluate(features)
        dim = result.dimensions["RepetitionAnomaly"]
        assert dim.is_evaluable is True
        assert dim.severity == Severity.HIGH


# ──────────────────────────────────────────────────────────
# EvidenceQuality
# ──────────────────────────────────────────────────────────

class TestEvidenceQuality:

    def test_complete(self):
        """All evidence available: state known, temporal present."""
        engine = BehavioralRiskEngine()
        features = _make_features(
            action_count=10,
            mutating_unknown=0,
            destructive_unknown=0,
            valid_timed_transitions=5,
        )
        result = engine.evaluate(features)
        assert result.evidence_quality == EvidenceQuality.COMPLETE

    def test_partial_missing_temporal(self):
        """State fully observed but no timestamps → PARTIAL."""
        engine = BehavioralRiskEngine()
        features = _make_features(
            action_count=10,
            mutating_unknown=0,
            destructive_unknown=0,
            valid_timed_transitions=0,
        )
        result = engine.evaluate(features)
        assert result.evidence_quality == EvidenceQuality.PARTIAL

    def test_partial_degraded_state(self):
        """Temporal present but state degraded → PARTIAL."""
        engine = BehavioralRiskEngine()
        features = _make_features(
            action_count=10,
            mutating_unknown=2,
            destructive_unknown=0,
            valid_timed_transitions=5,
        )
        result = engine.evaluate(features)
        # state_ratio = 1.0 - (2+0)/(2*10) = 1.0 - 0.1 = 0.9 (not < 0.9)
        # So this is actually COMPLETE because 0.9 is NOT < 0.9
        assert result.evidence_quality == EvidenceQuality.COMPLETE

    def test_partial_slightly_degraded_state(self):
        """State ratio just below 0.9 with temporal present → PARTIAL."""
        engine = BehavioralRiskEngine()
        features = _make_features(
            action_count=10,
            mutating_unknown=2,
            destructive_unknown=1,
            valid_timed_transitions=5,
        )
        result = engine.evaluate(features)
        # state_ratio = 1.0 - (2+1)/(2*10) = 1.0 - 0.15 = 0.85 (< 0.9)
        assert result.evidence_quality == EvidenceQuality.PARTIAL

    def test_limited(self):
        """State heavily degraded AND no temporal → LIMITED."""
        engine = BehavioralRiskEngine()
        features = _make_features(
            action_count=10,
            mutating_unknown=5,
            destructive_unknown=5,
            valid_timed_transitions=0,
        )
        result = engine.evaluate(features)
        # state_ratio = 1.0 - 10/20 = 0.5 (< 0.9), temporal = 0.0
        assert result.evidence_quality == EvidenceQuality.LIMITED

    def test_unavailable(self):
        """State completely unknown AND no temporal → UNAVAILABLE."""
        engine = BehavioralRiskEngine()
        features = _make_features(
            action_count=10,
            mutating_unknown=10,
            destructive_unknown=10,
            valid_timed_transitions=0,
        )
        result = engine.evaluate(features)
        # state_ratio = 1.0 - 20/20 = 0.0, temporal = 0.0
        assert result.evidence_quality == EvidenceQuality.UNAVAILABLE

    def test_unavailable_precedence(self):
        """UNAVAILABLE has highest precedence over LIMITED."""
        engine = BehavioralRiskEngine()
        features = _make_features(
            action_count=5,
            mutating_unknown=5,
            destructive_unknown=5,
            valid_timed_transitions=0,
        )
        result = engine.evaluate(features)
        # state_ratio = 1.0 - 10/10 = 0.0, temporal = 0.0
        assert result.evidence_quality == EvidenceQuality.UNAVAILABLE

    def test_evidence_quality_does_not_inflate_severity(self):
        """High uncertainty must NOT inflate overall_severity."""
        engine = BehavioralRiskEngine()
        features = _make_features(
            action_count=10,
            mutating_unknown=10,
            destructive_unknown=10,
            destructive_known_true=0,
            mutating_known_true=0,
            valid_timed_transitions=0,
        )
        result = engine.evaluate(features)
        assert result.evidence_quality == EvidenceQuality.UNAVAILABLE
        # Despite terrible evidence, behavioral severity must remain NONE
        # (no known destructive/mutating/repetition evidence was observed)
        assert result.overall_severity == Severity.NONE


# ──────────────────────────────────────────────────────────
# Overall Severity Aggregation
# ──────────────────────────────────────────────────────────

class TestOverallSeverity:

    def test_max_aggregation(self):
        """overall_severity = max of evaluable dimensions."""
        engine = BehavioralRiskEngine()
        features = _make_features(
            action_count=10,
            destructive_known_true=3,
            consecutive_repeated_actions=1,
        )
        result = engine.evaluate(features)
        # DestructiveIntensity → HIGH (3 >= high threshold 3)
        # RepetitionAnomaly → NONE (1 < low threshold 3)
        assert result.overall_severity == Severity.HIGH

    def test_all_dimensions_unevaluable(self):
        """If no dimensions are evaluable, overall_severity = None."""
        # Custom config where all dimensions require temporal data
        # We can achieve this by only relying on TemporalBurst
        # and ensuring other dimensions produce NONE while temporal is unevaluable.
        # Actually, the simplest test: action_count=0 gives temporal unevaluable.
        # But other dims are evaluable at 0. Let's construct properly:
        # We need ALL dimensions unevaluable, but currently only TemporalBurst
        # can be unevaluable. Other dims are always evaluable.
        # So "all unevaluable" can't happen with current architecture.
        # The overall_severity will always have at least 3 evaluable dims.
        # Test that when evaluable dims are all NONE, overall = NONE.
        engine = BehavioralRiskEngine()
        features = _make_features(action_count=0)
        result = engine.evaluate(features)
        assert result.overall_severity == Severity.NONE

    def test_unevaluable_dimensions_excluded(self):
        """Unevaluable TemporalBurst does not drag overall severity."""
        engine = BehavioralRiskEngine()
        features = _make_features(
            action_count=5,
            destructive_known_true=1,
            valid_timed_transitions=0,
        )
        result = engine.evaluate(features)
        # TemporalBurst is unevaluable (severity=None)
        assert result.dimensions["TemporalBurst"].is_evaluable is False
        # DestructiveIntensity → LOW (1)
        assert result.overall_severity == Severity.LOW


# ──────────────────────────────────────────────────────────
# Empty & Single-Action Trajectories
# ──────────────────────────────────────────────────────────

class TestEdgeCases:

    def test_empty_features(self):
        """Empty trajectory: evaluable dims NONE, temporal unevaluable, quality COMPLETE."""
        engine = BehavioralRiskEngine()
        features = _make_features(action_count=0, event_count=0)
        result = engine.evaluate(features)

        assert result.overall_severity == Severity.NONE
        assert result.evidence_quality == EvidenceQuality.COMPLETE

        assert result.dimensions["DestructiveIntensity"].severity == Severity.NONE
        assert result.dimensions["MutationIntensity"].severity == Severity.NONE
        assert result.dimensions["RepetitionAnomaly"].severity == Severity.NONE
        assert result.dimensions["TemporalBurst"].is_evaluable is False
        assert result.dimensions["TemporalBurst"].severity is None

    def test_single_action_features(self):
        """Single action: temporal unevaluable but quality COMPLETE."""
        engine = BehavioralRiskEngine()
        features = _make_features(action_count=1, event_count=1)
        result = engine.evaluate(features)

        assert result.evidence_quality == EvidenceQuality.COMPLETE
        assert result.dimensions["TemporalBurst"].is_evaluable is False

    def test_events_with_zero_actions(self):
        """event_count > 0 but action_count = 0."""
        engine = BehavioralRiskEngine()
        features = _make_features(action_count=0, event_count=5)
        result = engine.evaluate(features)

        assert result.overall_severity == Severity.NONE
        assert result.evidence_quality == EvidenceQuality.COMPLETE
        assert result.dimensions["TemporalBurst"].is_evaluable is False


# ──────────────────────────────────────────────────────────
# Evidence Correctness
# ──────────────────────────────────────────────────────────

class TestEvidenceItems:

    def test_evidence_item_correctness(self):
        engine = BehavioralRiskEngine()
        features = _make_features(action_count=5, destructive_known_true=5)
        result = engine.evaluate(features)
        dim = result.dimensions["DestructiveIntensity"]
        assert dim.severity == Severity.CRITICAL
        assert len(dim.evidence) == 1
        ev = dim.evidence[0]
        assert ev.feature_name == "destructive_known_true"
        assert ev.feature_value == 5
        assert ev.threshold_applied == 5
        assert "5" in ev.description
        assert "destructive_known_true" in ev.description

    def test_no_evidence_when_none_severity(self):
        engine = BehavioralRiskEngine()
        features = _make_features(action_count=5)
        result = engine.evaluate(features)
        for dim in result.dimensions.values():
            if dim.is_evaluable and dim.severity == Severity.NONE:
                assert dim.evidence == []


# ──────────────────────────────────────────────────────────
# Determinism & Immutability
# ──────────────────────────────────────────────────────────

class TestDeterminismAndImmutability:

    def test_deterministic_repeated_evaluation(self):
        engine = BehavioralRiskEngine()
        features = _make_features(
            action_count=10,
            destructive_known_true=3,
            mutating_known_true=10,
            read_to_write_transitions=5,
            consecutive_repeated_actions=5,
            valid_timed_transitions=5,
            mean_inter_action_time=1.5,
        )
        result_1 = engine.evaluate(features)
        result_2 = engine.evaluate(features)

        assert result_1.overall_severity == result_2.overall_severity
        assert result_1.evidence_quality == result_2.evidence_quality
        for key in result_1.dimensions:
            d1 = result_1.dimensions[key]
            d2 = result_2.dimensions[key]
            assert d1.is_evaluable == d2.is_evaluable
            assert d1.severity == d2.severity

    def test_input_features_not_mutated(self):
        engine = BehavioralRiskEngine()
        features = _make_features(
            action_count=10,
            destructive_known_true=3,
            mutating_known_true=5,
        )
        # Capture original values
        original_destructive = features.destructive_known_true
        original_mutating = features.mutating_known_true

        engine.evaluate(features)

        assert features.destructive_known_true == original_destructive
        assert features.mutating_known_true == original_mutating


# ──────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────

class TestConfiguration:

    def test_custom_config_changes_severity(self):
        """Changing thresholds changes severity mappings."""
        strict_config = BehavioralRiskConfig(
            destructive_thresholds=SeverityThresholds(
                direction=ThresholdDirection.HIGHER_IS_MORE_SEVERE,
                low=1, medium=1, high=1, critical=1,
            ),
            mutation_count_thresholds=SeverityThresholds(
                direction=ThresholdDirection.HIGHER_IS_MORE_SEVERE,
                low=5, medium=10, high=20, critical=50,
            ),
            mutation_r2w_thresholds=SeverityThresholds(
                direction=ThresholdDirection.HIGHER_IS_MORE_SEVERE,
                low=3, medium=5, high=10, critical=20,
            ),
            temporal_burst_thresholds=SeverityThresholds(
                direction=ThresholdDirection.LOWER_IS_MORE_SEVERE,
                low=5.0, medium=2.0, high=1.0, critical=0.5,
            ),
            repetition_thresholds=SeverityThresholds(
                direction=ThresholdDirection.HIGHER_IS_MORE_SEVERE,
                low=3, medium=5, high=10, critical=20,
            ),
            min_timed_transitions=3,
        )
        engine = BehavioralRiskEngine(config=strict_config)
        # With strict config, 1 destructive action → CRITICAL
        features = _make_features(action_count=5, destructive_known_true=1)
        result = engine.evaluate(features)
        assert result.dimensions["DestructiveIntensity"].severity == Severity.CRITICAL

    def test_default_config_creates_engine(self):
        config = default_config()
        engine = BehavioralRiskEngine(config=config)
        features = _make_features()
        result = engine.evaluate(features)
        assert result.overall_severity == Severity.NONE
