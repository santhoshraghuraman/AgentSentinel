"""
Behavioral Risk Engine — Models (Milestone 5).

Defines the output contract for behavioral risk assessment.
These models represent the INTERPRETATION layer between
observable TrajectoryFeatures (Milestone 4) and future
policy/authorization DECISION layers (Milestone 7+).

Key design principles:
    - Severity represents behavioral intensity, NOT probability of malice.
    - EvidenceQuality represents observability completeness, NOT behavioral risk.
    - severity=None (unevaluable) is strictly distinct from Severity.NONE (evaluated, no risk found).
    - All thresholds are UNCALIBRATED BASELINE HEURISTICS until empirically validated.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class Severity(Enum):
    """
    Qualitative ordinal severity scale for behavioral intensity.

    NONE means the dimension was fully evaluated and no evidence
    meeting the risk criteria was observed.

    This is NOT a probability of threat.
    """
    NONE = 0
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4


class EvidenceQuality(Enum):
    """
    Quality/completeness of observable evidence available to the Risk Engine.

    This does NOT inflate behavioral severity.
    It describes how complete the supplied trajectory data is.

    COMPLETE:   All relevant evidence required by evaluated dimensions is present.
    PARTIAL:    Some relevant evidence is unavailable (e.g., timestamps missing
                but state effects are well-observed, or vice versa).
    LIMITED:    A substantial portion of relevant evidence is unavailable
                (both state and temporal observability are degraded).
    UNAVAILABLE: Insufficient evidence to meaningfully assess observability.
    """
    UNAVAILABLE = 0
    LIMITED = 1
    PARTIAL = 2
    COMPLETE = 3


class ThresholdDirection(Enum):
    """
    Defines whether higher or lower feature values indicate more severe behavior.

    HIGHER_IS_MORE_SEVERE: e.g., destructive_known_true count
    LOWER_IS_MORE_SEVERE:  e.g., mean_inter_action_time (faster = more severe)
    """
    HIGHER_IS_MORE_SEVERE = "higher_is_more_severe"
    LOWER_IS_MORE_SEVERE = "lower_is_more_severe"


@dataclass
class SeverityThresholds:
    """
    Deterministic boundary configuration mapping a feature value to a Severity.

    All thresholds are UNCALIBRATED BASELINE HEURISTICS.
    They are NOT scientifically validated and require future empirical calibration.

    Threshold validation enforces monotonic ordering:
        HIGHER_IS_MORE_SEVERE: low <= medium <= high <= critical
        LOWER_IS_MORE_SEVERE:  low >= medium >= high >= critical
    """
    direction: ThresholdDirection
    low: float
    medium: float
    high: float
    critical: float

    def __post_init__(self):
        if self.direction == ThresholdDirection.HIGHER_IS_MORE_SEVERE:
            if not (self.low <= self.medium <= self.high <= self.critical):
                raise ValueError(
                    f"HIGHER_IS_MORE_SEVERE thresholds must satisfy "
                    f"low <= medium <= high <= critical, "
                    f"got: {self.low} <= {self.medium} <= {self.high} <= {self.critical}"
                )
        elif self.direction == ThresholdDirection.LOWER_IS_MORE_SEVERE:
            if not (self.low >= self.medium >= self.high >= self.critical):
                raise ValueError(
                    f"LOWER_IS_MORE_SEVERE thresholds must satisfy "
                    f"low >= medium >= high >= critical, "
                    f"got: {self.low} >= {self.medium} >= {self.high} >= {self.critical}"
                )

    def evaluate(self, value: float) -> Severity:
        """
        Deterministic inclusive boundary mapping.

        For HIGHER_IS_MORE_SEVERE:
            value < low          -> NONE
            low <= value < medium -> LOW
            medium <= value < high -> MEDIUM
            high <= value < critical -> HIGH
            value >= critical    -> CRITICAL

        For LOWER_IS_MORE_SEVERE:
            value > low          -> NONE
            medium < value <= low -> LOW
            high < value <= medium -> MEDIUM
            critical < value <= high -> HIGH
            value <= critical    -> CRITICAL
        """
        if self.direction == ThresholdDirection.HIGHER_IS_MORE_SEVERE:
            if value >= self.critical:
                return Severity.CRITICAL
            elif value >= self.high:
                return Severity.HIGH
            elif value >= self.medium:
                return Severity.MEDIUM
            elif value >= self.low:
                return Severity.LOW
            else:
                return Severity.NONE
        else:  # LOWER_IS_MORE_SEVERE
            if value <= self.critical:
                return Severity.CRITICAL
            elif value <= self.high:
                return Severity.HIGH
            elif value <= self.medium:
                return Severity.MEDIUM
            elif value <= self.low:
                return Severity.LOW
            else:
                return Severity.NONE


@dataclass
class EvidenceItem:
    """
    An explainable piece of evidence linking a risk severity
    directly to the triggering TrajectoryFeatures field.

    Descriptions must remain grounded in actual feature values.
    No hallucinated interpretation.
    """
    description: str
    feature_name: str
    feature_value: Any
    threshold_applied: Optional[float] = None


@dataclass
class RiskDimensionResult:
    """
    Result for a single behavioral risk dimension.

    is_evaluable=True, severity=Severity.NONE:
        The dimension was fully evaluated and no risk evidence was observed.

    is_evaluable=False, severity=None:
        The dimension could not be evaluated because required evidence
        was unavailable. This is NOT equivalent to Severity.NONE.
    """
    dimension_name: str
    is_evaluable: bool
    severity: Optional[Severity]
    evidence: List[EvidenceItem] = field(default_factory=list)


@dataclass
class RiskAssessment:
    """
    Complete behavioral risk assessment output.

    overall_severity:
        Maximum observed behavioral severity across EVALUABLE risk dimensions.
        If no dimensions are evaluable, this is None.
        EvidenceQuality does NOT participate in this aggregation.

    evidence_quality:
        Quality/completeness of observable evidence. Does NOT inflate severity.

    dimensions:
        Per-dimension results with explainable evidence.
    """
    overall_severity: Optional[Severity]
    evidence_quality: EvidenceQuality
    dimensions: Dict[str, RiskDimensionResult] = field(default_factory=dict)
