"""
Behavioral Risk Engine (Milestone 5).

Evaluates TrajectoryFeatures against configurable, uncalibrated baseline
heuristics to produce a multidimensional RiskAssessment.

Phase 2 Enhancement: Integrates trained ML model inference as a new
dimension (MLBehavioralRisk) alongside existing heuristic safety guardrails.

Architecture:
    ML behavioral score (from trained Random Forest)
    +
    Existing deterministic safety constraints (heuristic dimensions)
    =
    Final M5 risk signal (max severity across all evaluable dimensions)

ML contribution:
    The trained model produces P(unsafe | features). This probability is
    mapped to Severity via calibrated thresholds. It adds a new dimension
    "MLBehavioralRisk" to the RiskAssessment.

Deterministic safety contribution:
    The four heuristic dimensions (DestructiveIntensity, MutationIntensity,
    TemporalBurst, RepetitionAnomaly) remain as complementary safety
    guardrails. They can escalate severity independently of ML.

Fallback behavior:
    If the ML model is unavailable (missing, corrupt, incompatible),
    the engine falls back to heuristic-only mode. The MLBehavioralRisk
    dimension is marked as unevaluable (is_evaluable=False, severity=None).
    The system does NOT fail open.

Separation of concerns:
    Observation  (Milestone 4) -> TrajectoryFeatures
    Interpretation (Milestone 5) -> RiskAssessment
    Decision     (Milestone 7+) -> ALLOW / ALERT / BLOCK

This engine does NOT:
    - Assign arbitrary weighted numeric risk scores.
    - Claim probability of malice or threat.
    - Make authorization decisions.
    - Iterate over trajectories (it consumes pre-computed O(1) features).

Time Complexity:  O(1) — direct threshold comparisons + single model inference.
Memory Complexity: O(1) — flat output with a small number of EvidenceItems.
"""

import logging
from dataclasses import dataclass
from typing import List, Optional

from src.agentsentinel.features.extractor import TrajectoryFeatures
from src.agentsentinel.risk.models import (
    EvidenceItem,
    EvidenceQuality,
    RiskAssessment,
    RiskDimensionResult,
    Severity,
    SeverityThresholds,
    ThresholdDirection,
)
from src.agentsentinel.risk.ml_model import MLModelLoader, MLInferenceResult

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────
# ML Probability → Severity Mapping
# ──────────────────────────────────────────────────────────
# These thresholds map the ML model's P(unsafe) to Severity levels.
# They are derived from the model's operating characteristics:
#   - Precision: 0.7805, Recall: 0.6465 at the default 0.5 threshold
#   - ROC-AUC: 0.7813
# Conservative calibration: higher thresholds avoid false escalation.

ML_SEVERITY_THRESHOLDS = {
    Severity.LOW: 0.40,       # P(unsafe) >= 0.40 → LOW
    Severity.MEDIUM: 0.55,    # P(unsafe) >= 0.55 → MEDIUM
    Severity.HIGH: 0.70,      # P(unsafe) >= 0.70 → HIGH
    Severity.CRITICAL: 0.85,  # P(unsafe) >= 0.85 → CRITICAL
}


def _ml_probability_to_severity(unsafe_prob: float) -> Severity:
    """
    Map P(unsafe) to a Severity level using calibrated thresholds.

    Higher probability → higher severity.
    Below the LOW threshold → Severity.NONE.
    """
    if unsafe_prob >= ML_SEVERITY_THRESHOLDS[Severity.CRITICAL]:
        return Severity.CRITICAL
    elif unsafe_prob >= ML_SEVERITY_THRESHOLDS[Severity.HIGH]:
        return Severity.HIGH
    elif unsafe_prob >= ML_SEVERITY_THRESHOLDS[Severity.MEDIUM]:
        return Severity.MEDIUM
    elif unsafe_prob >= ML_SEVERITY_THRESHOLDS[Severity.LOW]:
        return Severity.LOW
    else:
        return Severity.NONE


@dataclass
class BehavioralRiskConfig:
    """
    Configuration for the Behavioral Risk Engine.

    IMPORTANT: All thresholds are UNCALIBRATED BASELINE HEURISTICS.
    They are NOT scientifically validated. Future calibration will use:
        - Benign validation distributions
        - Anomalous examples
        - Percentile-based calibration
        - Controlled experiments
        - Precision, Recall, F1, FPR, FNR
        - Cross-dataset validation

    Attributes:
        destructive_thresholds: Thresholds for DestructiveIntensity
            (feature: destructive_known_true, HIGHER_IS_MORE_SEVERE).
        mutation_count_thresholds: Thresholds for MutationIntensity
            based on mutating_known_true (HIGHER_IS_MORE_SEVERE).
        mutation_r2w_thresholds: Thresholds for MutationIntensity
            based on read_to_write_transitions (HIGHER_IS_MORE_SEVERE).
        temporal_burst_thresholds: Thresholds for TemporalBurst
            based on mean_inter_action_time (LOWER_IS_MORE_SEVERE).
        repetition_thresholds: Thresholds for RepetitionAnomaly
            (feature: consecutive_repeated_actions, HIGHER_IS_MORE_SEVERE).
        min_timed_transitions: Minimum number of valid timed transitions
            required before TemporalBurst can be evaluated.
    """
    destructive_thresholds: SeverityThresholds
    mutation_count_thresholds: SeverityThresholds
    mutation_r2w_thresholds: SeverityThresholds
    temporal_burst_thresholds: SeverityThresholds
    repetition_thresholds: SeverityThresholds
    min_timed_transitions: int


def default_config() -> BehavioralRiskConfig:
    """
    Returns an uncalibrated baseline heuristic configuration.

    WARNING: These thresholds are placeholders for deterministic testing.
    They have NOT been empirically calibrated against real-world data.
    """
    return BehavioralRiskConfig(
        destructive_thresholds=SeverityThresholds(
            direction=ThresholdDirection.HIGHER_IS_MORE_SEVERE,
            low=1, medium=2, high=3, critical=5,
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


class BehavioralRiskEngine:
    """
    Evaluates TrajectoryFeatures to produce a RiskAssessment.

    Consumes pre-computed TrajectoryFeatures in O(1) time.
    Does NOT iterate over trajectories or re-extract features.

    Phase 2: Optionally augmented with ML model inference.
    The ML model is loaded once at initialization and reused for all calls.
    If the model is unavailable, the engine operates in heuristic-only mode.
    """

    def __init__(
        self,
        config: Optional[BehavioralRiskConfig] = None,
        ml_model: Optional[MLModelLoader] = None,
    ):
        self._config = config or default_config()
        self._ml_model = ml_model

    @property
    def ml_model_status(self) -> str:
        """Return human-readable ML model status."""
        if self._ml_model is None:
            return "disabled"
        if self._ml_model.is_loaded:
            return "loaded"
        return f"unavailable: {self._ml_model.load_error}"

    @property
    def ml_model_metadata(self):
        """Return model metadata if available."""
        if self._ml_model is not None and self._ml_model.is_loaded:
            return self._ml_model.metadata
        return None

    def evaluate(self, features: TrajectoryFeatures) -> RiskAssessment:
        """
        Produce a deterministic, explainable RiskAssessment from features.

        The input TrajectoryFeatures is NOT mutated.

        Evaluation order:
            1. Heuristic dimensions (DestructiveIntensity, MutationIntensity,
               TemporalBurst, RepetitionAnomaly)
            2. ML dimension (MLBehavioralRisk) — if model is available
            3. Overall severity = max of all evaluable dimensions
        """
        dimensions = {}

        # 1. DestructiveIntensity
        dimensions["DestructiveIntensity"] = self._evaluate_destructive(features)

        # 2. MutationIntensity
        dimensions["MutationIntensity"] = self._evaluate_mutation(features)

        # 3. TemporalBurst
        dimensions["TemporalBurst"] = self._evaluate_temporal_burst(features)

        # 4. RepetitionAnomaly
        dimensions["RepetitionAnomaly"] = self._evaluate_repetition(features)

        # 5. MLBehavioralRisk (Phase 2)
        dimensions["MLBehavioralRisk"] = self._evaluate_ml(features)

        # Overall severity: max of evaluable dimensions only.
        # EvidenceQuality does NOT participate.
        evaluable_severities = [
            dim.severity for dim in dimensions.values()
            if dim.is_evaluable and dim.severity is not None
        ]

        if evaluable_severities:
            overall_severity = max(evaluable_severities, key=lambda s: s.value)
        else:
            # No behavioral dimensions are evaluable.
            # Do NOT default to Severity.NONE — that would fabricate safety.
            overall_severity = None

        # Evidence quality (separate from severity)
        evidence_quality = self._compute_evidence_quality(features)

        return RiskAssessment(
            overall_severity=overall_severity,
            evidence_quality=evidence_quality,
            dimensions=dimensions,
        )

    # ──────────────────────────────────────────────────────────
    # Dimension Evaluators
    # ──────────────────────────────────────────────────────────

    def _evaluate_destructive(self, features: TrajectoryFeatures) -> RiskDimensionResult:
        """Evaluate DestructiveIntensity from destructive_known_true."""
        value = features.destructive_known_true
        severity = self._config.destructive_thresholds.evaluate(value)

        evidence: List[EvidenceItem] = []
        if severity != Severity.NONE:
            threshold = self._threshold_for_severity(
                self._config.destructive_thresholds, severity
            )
            evidence.append(EvidenceItem(
                description=f"observed {value} destructive_known_true actions >= threshold {threshold}",
                feature_name="destructive_known_true",
                feature_value=value,
                threshold_applied=threshold,
            ))

        return RiskDimensionResult(
            dimension_name="DestructiveIntensity",
            is_evaluable=True,
            severity=severity,
            evidence=evidence,
        )

    def _evaluate_mutation(self, features: TrajectoryFeatures) -> RiskDimensionResult:
        """
        Evaluate MutationIntensity from two independent signals.

        mutating_known_true and read_to_write_transitions are evaluated
        independently against their own SeverityThresholds.
        MutationIntensity severity = max(severity_count, severity_r2w).
        They are NOT added, averaged, weighted, or blended.
        """
        count_val = features.mutating_known_true
        r2w_val = features.read_to_write_transitions

        severity_count = self._config.mutation_count_thresholds.evaluate(count_val)
        severity_r2w = self._config.mutation_r2w_thresholds.evaluate(r2w_val)

        combined_severity = max(severity_count, severity_r2w, key=lambda s: s.value)

        evidence: List[EvidenceItem] = []
        if severity_count != Severity.NONE:
            threshold = self._threshold_for_severity(
                self._config.mutation_count_thresholds, severity_count
            )
            evidence.append(EvidenceItem(
                description=f"observed {count_val} mutating_known_true actions >= threshold {threshold}",
                feature_name="mutating_known_true",
                feature_value=count_val,
                threshold_applied=threshold,
            ))
        if severity_r2w != Severity.NONE:
            threshold = self._threshold_for_severity(
                self._config.mutation_r2w_thresholds, severity_r2w
            )
            evidence.append(EvidenceItem(
                description=f"observed {r2w_val} read_to_write_transitions >= threshold {threshold}",
                feature_name="read_to_write_transitions",
                feature_value=r2w_val,
                threshold_applied=threshold,
            ))

        return RiskDimensionResult(
            dimension_name="MutationIntensity",
            is_evaluable=True,
            severity=combined_severity,
            evidence=evidence,
        )

    def _evaluate_temporal_burst(self, features: TrajectoryFeatures) -> RiskDimensionResult:
        """
        Evaluate TemporalBurst from mean_inter_action_time.

        TemporalBurst is evaluable ONLY if:
            - valid_timed_transitions >= config.min_timed_transitions
            - mean_inter_action_time is not None

        Otherwise: is_evaluable=False, severity=None.
        Missing temporal evidence does NOT fabricate Severity.NONE.

        Uses LOWER_IS_MORE_SEVERE threshold direction:
        lower mean_inter_action_time = faster execution = more severe.
        """
        if (features.valid_timed_transitions < self._config.min_timed_transitions
                or features.mean_inter_action_time is None):
            return RiskDimensionResult(
                dimension_name="TemporalBurst",
                is_evaluable=False,
                severity=None,
                evidence=[],
            )

        value = features.mean_inter_action_time
        severity = self._config.temporal_burst_thresholds.evaluate(value)

        evidence: List[EvidenceItem] = []
        if severity != Severity.NONE:
            threshold = self._threshold_for_severity(
                self._config.temporal_burst_thresholds, severity
            )
            evidence.append(EvidenceItem(
                description=(
                    f"mean_inter_action_time {value}s <= threshold {threshold}s "
                    f"(lower is more severe, {features.valid_timed_transitions} valid transitions)"
                ),
                feature_name="mean_inter_action_time",
                feature_value=value,
                threshold_applied=threshold,
            ))

        return RiskDimensionResult(
            dimension_name="TemporalBurst",
            is_evaluable=True,
            severity=severity,
            evidence=evidence,
        )

    def _evaluate_repetition(self, features: TrajectoryFeatures) -> RiskDimensionResult:
        """Evaluate RepetitionAnomaly from consecutive_repeated_actions."""
        value = features.consecutive_repeated_actions
        severity = self._config.repetition_thresholds.evaluate(value)

        evidence: List[EvidenceItem] = []
        if severity != Severity.NONE:
            threshold = self._threshold_for_severity(
                self._config.repetition_thresholds, severity
            )
            evidence.append(EvidenceItem(
                description=f"observed {value} consecutive_repeated_actions >= threshold {threshold}",
                feature_name="consecutive_repeated_actions",
                feature_value=value,
                threshold_applied=threshold,
            ))

        return RiskDimensionResult(
            dimension_name="RepetitionAnomaly",
            is_evaluable=True,
            severity=severity,
            evidence=evidence,
        )

    def _evaluate_ml(self, features: TrajectoryFeatures) -> RiskDimensionResult:
        """
        Evaluate MLBehavioralRisk from trained model inference (Phase 2).

        If the ML model is unavailable or inference fails:
            is_evaluable=False, severity=None.
            This is NOT equivalent to Severity.NONE.
            The system does NOT fail open — heuristic dimensions still provide
            safety coverage.

        If inference succeeds:
            P(unsafe) is mapped to Severity via calibrated thresholds.
            The evidence includes the exact probability and threshold applied.
        """
        if self._ml_model is None or not self._ml_model.is_loaded:
            return RiskDimensionResult(
                dimension_name="MLBehavioralRisk",
                is_evaluable=False,
                severity=None,
                evidence=[],
            )

        inference_result = self._ml_model.predict(features)

        if inference_result is None:
            # Inference failed — record diagnostic, do not fail open
            return RiskDimensionResult(
                dimension_name="MLBehavioralRisk",
                is_evaluable=False,
                severity=None,
                evidence=[EvidenceItem(
                    description="ML inference failed — falling back to heuristic-only mode",
                    feature_name="ml_inference_status",
                    feature_value="failed",
                )],
            )

        unsafe_prob = inference_result.unsafe_probability
        severity = _ml_probability_to_severity(unsafe_prob)

        evidence: List[EvidenceItem] = []
        evidence.append(EvidenceItem(
            description=(
                f"ML model P(unsafe)={unsafe_prob:.4f}, "
                f"predicted_class={inference_result.predicted_class} "
                f"(0=safe, 1=unsafe)"
            ),
            feature_name="ml_unsafe_probability",
            feature_value=unsafe_prob,
        ))

        if severity != Severity.NONE:
            threshold = ML_SEVERITY_THRESHOLDS.get(severity, 0.0)
            evidence.append(EvidenceItem(
                description=(
                    f"P(unsafe) {unsafe_prob:.4f} >= severity threshold "
                    f"{threshold} for {severity.name}"
                ),
                feature_name="ml_severity_threshold",
                feature_value=unsafe_prob,
                threshold_applied=threshold,
            ))

        return RiskDimensionResult(
            dimension_name="MLBehavioralRisk",
            is_evaluable=True,
            severity=severity,
            evidence=evidence,
        )

    # ──────────────────────────────────────────────────────────
    # Evidence Quality
    # ──────────────────────────────────────────────────────────

    def _compute_evidence_quality(self, features: TrajectoryFeatures) -> EvidenceQuality:
        """
        Compute evidence quality from state and temporal observability.

        State Observability:
            action_count == 0 → 1.0
            else → 1.0 - ((mutating_unknown + destructive_unknown) / (2.0 * action_count))

        Temporal Observability:
            valid_timed_transitions > 0  → 1.0
            action_count <= 1            → 1.0  (no interval required, NOT "timestamps available")
            else                         → 0.0

        Precedence (UNAVAILABLE has highest precedence):
            state == 0.0 AND temporal == 0.0 → UNAVAILABLE
            state < 0.9  AND temporal == 0.0 → LIMITED
            state < 0.9  OR  temporal == 0.0 → PARTIAL
            else                             → COMPLETE

        EvidenceQuality does NOT inflate behavioral severity.
        """
        # State observability
        if features.action_count == 0:
            state_ratio = 1.0
        else:
            unknown_total = features.mutating_unknown + features.destructive_unknown
            state_ratio = 1.0 - (unknown_total / (2.0 * features.action_count))

        # Temporal observability
        if features.valid_timed_transitions > 0:
            temporal_observability = 1.0
        elif features.action_count <= 1:
            # Temporal evidence is not required (no inter-action interval).
            # This is distinct from "timestamps are available".
            temporal_observability = 1.0
        else:
            temporal_observability = 0.0

        # Deterministic precedence
        if state_ratio == 0.0 and temporal_observability == 0.0:
            return EvidenceQuality.UNAVAILABLE
        elif state_ratio < 0.9 and temporal_observability == 0.0:
            return EvidenceQuality.LIMITED
        elif state_ratio < 0.9 or temporal_observability == 0.0:
            return EvidenceQuality.PARTIAL
        else:
            return EvidenceQuality.COMPLETE

    # ──────────────────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────────────────

    @staticmethod
    def _threshold_for_severity(thresholds: SeverityThresholds, severity: Severity) -> float:
        """Return the threshold value that corresponds to the given severity level."""
        mapping = {
            Severity.LOW: thresholds.low,
            Severity.MEDIUM: thresholds.medium,
            Severity.HIGH: thresholds.high,
            Severity.CRITICAL: thresholds.critical,
        }
        return mapping.get(severity, 0.0)
