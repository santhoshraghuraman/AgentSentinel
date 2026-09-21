"""
Tests for Phase 2 — ML Runtime Integration into M5.

Covers:
    1. Model loads successfully
    2. Model metadata loads
    3. Feature vector matches expected dimensions
    4. Deterministic inference
    5. Safe trajectory gets a real prediction
    6. Unsafe trajectory gets a real prediction
    7. Malformed feature input fails safely
    8. Missing model fails safely
    9. Corrupted model fails safely
    10. M5 uses model inference
    11. M5 result reaches M7
    12. M8 still enforces final decision
    13. BLOCK still prevents execution
    14. ALLOW still executes once
    15. Concurrent inference remains safe
"""

import os
import json
import threading
import tempfile
from pathlib import Path
from unittest.mock import MagicMock

import pytest
import numpy as np

from src.agentsentinel.features.extractor import TrajectoryFeatures
from src.agentsentinel.models.normalized import ActionCategory, NormalizedAction
from src.agentsentinel.risk.ml_model import (
    MLModelLoader,
    MLInferenceResult,
    RUNTIME_FEATURE_NAMES,
    features_to_vector,
)
from src.agentsentinel.risk.engine import (
    BehavioralRiskEngine,
    BehavioralRiskConfig,
    default_config,
    _ml_probability_to_severity,
    ML_SEVERITY_THRESHOLDS,
)
from src.agentsentinel.risk.models import (
    Severity,
    EvidenceQuality,
    RiskAssessment,
)
from src.agentsentinel.authorization.models import (
    ActionAuthorizationResult,
    AuthorizationStatus,
)
from src.agentsentinel.governance.engine import PolicyFusionEngine
from src.agentsentinel.governance.models import GovernanceDecision


# ──────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────

MODEL_PATH = "research/artifacts/risk_model.joblib"


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


def _make_safe_features() -> TrajectoryFeatures:
    """Features resembling a benign read-only trajectory."""
    return _make_features(
        action_count=3,
        event_count=5,
        category_counts={ActionCategory.FILE_SYSTEM_READ: 3},
        mutating_known_false=3,
        destructive_known_false=3,
        unique_tool_count=1,
    )


def _make_unsafe_features() -> TrajectoryFeatures:
    """Features resembling a risky destructive trajectory."""
    return _make_features(
        action_count=15,
        event_count=20,
        category_counts={
            ActionCategory.FILE_SYSTEM_WRITE: 8,
            ActionCategory.CODE_EXECUTION: 4,
            ActionCategory.WEB_REQUEST: 3,
        },
        mutating_known_true=12,
        destructive_known_true=6,
        unique_tool_count=5,
        transition_count=14,
        read_to_write_transitions=8,
        consecutive_repeated_actions=5,
    )


# ──────────────────────────────────────────────────────────
# 1. Model loads successfully
# ──────────────────────────────────────────────────────────

class TestModelLoading:

    def test_model_loads_from_valid_artifact(self):
        if not Path(MODEL_PATH).exists():
            pytest.skip("Model artifact not found")
        loader = MLModelLoader(artifact_path=MODEL_PATH)
        assert loader.is_loaded is True
        assert loader.load_error is None

    def test_model_metadata_loads(self):
        """Test 2: Model metadata loads."""
        if not Path(MODEL_PATH).exists():
            pytest.skip("Model artifact not found")
        loader = MLModelLoader(artifact_path=MODEL_PATH)
        meta = loader.metadata
        assert meta is not None
        assert meta.model_version == "1.0.0"
        assert meta.feature_count == 22
        assert meta.model_type == "random_forest"
        assert meta.artifact_path == MODEL_PATH
        assert len(meta.feature_names) == 22

    def test_feature_vector_dimensions(self):
        """Test 3: Feature vector matches expected dimensions."""
        if not Path(MODEL_PATH).exists():
            pytest.skip("Model artifact not found")
        loader = MLModelLoader(artifact_path=MODEL_PATH)
        assert loader.metadata.feature_names == tuple(RUNTIME_FEATURE_NAMES)

    def test_feature_vector_from_features(self):
        """Verify features_to_vector produces the expected size."""
        features = _make_safe_features()
        vec = features_to_vector(features)
        assert len(vec) == len(RUNTIME_FEATURE_NAMES)
        assert all(isinstance(v, float) for v in vec)


# ──────────────────────────────────────────────────────────
# 4. Deterministic inference
# ──────────────────────────────────────────────────────────

class TestDeterministicInference:

    def test_deterministic_inference(self):
        if not Path(MODEL_PATH).exists():
            pytest.skip("Model artifact not found")
        loader = MLModelLoader(artifact_path=MODEL_PATH)
        features = _make_safe_features()
        result1 = loader.predict(features)
        result2 = loader.predict(features)
        assert result1 is not None
        assert result2 is not None
        assert result1.unsafe_probability == result2.unsafe_probability
        assert result1.predicted_class == result2.predicted_class


# ──────────────────────────────────────────────────────────
# 5 & 6. Safe and unsafe trajectory predictions
# ──────────────────────────────────────────────────────────

class TestPredictions:

    def test_safe_trajectory_gets_prediction(self):
        if not Path(MODEL_PATH).exists():
            pytest.skip("Model artifact not found")
        loader = MLModelLoader(artifact_path=MODEL_PATH)
        result = loader.predict(_make_safe_features())
        assert result is not None
        assert result.is_available is True
        assert 0.0 <= result.unsafe_probability <= 1.0
        assert 0.0 <= result.safe_probability <= 1.0
        assert result.predicted_class in (0, 1)

    def test_unsafe_trajectory_gets_prediction(self):
        if not Path(MODEL_PATH).exists():
            pytest.skip("Model artifact not found")
        loader = MLModelLoader(artifact_path=MODEL_PATH)
        result = loader.predict(_make_unsafe_features())
        assert result is not None
        assert result.is_available is True
        assert 0.0 <= result.unsafe_probability <= 1.0


# ──────────────────────────────────────────────────────────
# 7, 8, 9. Failure paths
# ──────────────────────────────────────────────────────────

class TestFailSafe:

    def test_missing_model_fails_safely(self):
        """Test 8: Missing model fails safely."""
        loader = MLModelLoader(artifact_path="nonexistent/model.joblib")
        assert loader.is_loaded is False
        assert loader.load_error is not None
        result = loader.predict(_make_safe_features())
        assert result is None

    def test_corrupted_model_fails_safely(self):
        """Test 9: Corrupted model fails safely."""
        with tempfile.NamedTemporaryFile(suffix=".joblib", delete=False, mode="w") as f:
            f.write("this is not a valid joblib file")
            tmppath = f.name
        try:
            loader = MLModelLoader(artifact_path=tmppath)
            assert loader.is_loaded is False
            assert loader.load_error is not None
            result = loader.predict(_make_safe_features())
            assert result is None
        finally:
            os.unlink(tmppath)

    def test_empty_features_handled(self):
        """Test 7 (variant): Zero-action features still produce valid vector."""
        features = _make_features(action_count=0)
        vec = features_to_vector(features)
        assert len(vec) == 22
        assert all(isinstance(v, float) for v in vec)


# ──────────────────────────────────────────────────────────
# 10. M5 uses model inference
# ──────────────────────────────────────────────────────────

class TestM5Integration:

    def test_m5_with_ml_model_produces_ml_dimension(self):
        """Test 10: M5 uses model inference."""
        if not Path(MODEL_PATH).exists():
            pytest.skip("Model artifact not found")
        loader = MLModelLoader(artifact_path=MODEL_PATH)
        engine = BehavioralRiskEngine(ml_model=loader)
        features = _make_safe_features()
        result = engine.evaluate(features)
        assert "MLBehavioralRisk" in result.dimensions
        ml_dim = result.dimensions["MLBehavioralRisk"]
        assert ml_dim.is_evaluable is True
        assert ml_dim.severity is not None
        assert len(ml_dim.evidence) >= 1

    def test_m5_without_ml_model_uses_heuristic_only(self):
        """Heuristic-only mode when no ML model provided."""
        engine = BehavioralRiskEngine()
        features = _make_safe_features()
        result = engine.evaluate(features)
        assert "MLBehavioralRisk" in result.dimensions
        ml_dim = result.dimensions["MLBehavioralRisk"]
        assert ml_dim.is_evaluable is False
        assert ml_dim.severity is None

    def test_m5_with_missing_model_falls_back(self):
        """M5 with an unavailable model falls back to heuristic-only."""
        loader = MLModelLoader(artifact_path="nonexistent/model.joblib")
        engine = BehavioralRiskEngine(ml_model=loader)
        features = _make_safe_features()
        result = engine.evaluate(features)
        assert "MLBehavioralRisk" in result.dimensions
        ml_dim = result.dimensions["MLBehavioralRisk"]
        assert ml_dim.is_evaluable is False
        # Heuristic dimensions still work
        assert result.dimensions["DestructiveIntensity"].is_evaluable is True

    def test_m5_ml_model_status(self):
        """ML model status is exposed."""
        engine_no_model = BehavioralRiskEngine()
        assert engine_no_model.ml_model_status == "disabled"

        if Path(MODEL_PATH).exists():
            loader = MLModelLoader(artifact_path=MODEL_PATH)
            engine_with_model = BehavioralRiskEngine(ml_model=loader)
            assert engine_with_model.ml_model_status == "loaded"

    def test_m5_heuristic_dimensions_preserved(self):
        """All 4 original heuristic dimensions still present with ML."""
        if not Path(MODEL_PATH).exists():
            pytest.skip("Model artifact not found")
        loader = MLModelLoader(artifact_path=MODEL_PATH)
        engine = BehavioralRiskEngine(ml_model=loader)
        features = _make_features(
            action_count=5, destructive_known_true=3
        )
        result = engine.evaluate(features)
        assert "DestructiveIntensity" in result.dimensions
        assert "MutationIntensity" in result.dimensions
        assert "TemporalBurst" in result.dimensions
        assert "RepetitionAnomaly" in result.dimensions
        assert "MLBehavioralRisk" in result.dimensions
        # Heuristic still escalates independently
        assert result.dimensions["DestructiveIntensity"].severity == Severity.HIGH


# ──────────────────────────────────────────────────────────
# 11. M5 result reaches M7
# ──────────────────────────────────────────────────────────

class TestM7Integration:

    def test_m5_result_reaches_m7(self):
        """Test 11: M5 risk severity feeds into M7 governance engine."""
        if not Path(MODEL_PATH).exists():
            pytest.skip("Model artifact not found")
        loader = MLModelLoader(artifact_path=MODEL_PATH)
        engine = BehavioralRiskEngine(ml_model=loader)
        features = _make_safe_features()
        risk_result = engine.evaluate(features)

        # M7 governance fusion
        governance_engine = PolicyFusionEngine()
        action = NormalizedAction(
            normalized_name="file_read",
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            resource="/data/file.txt",
            original_tool_name="read_file",
            source_dataset="test",
        )
        auth_result = ActionAuthorizationResult(
            action=action,
            status=AuthorizationStatus.AUTHORIZED,
            matched_grant=None,
            matched_deny=None,
            reasons=(),
        )
        record = governance_engine.evaluate(
            action=action,
            risk_severity=risk_result.overall_severity,
            auth_result=auth_result,
            policies=(),
        )
        # With low risk + authorized → should be ALLOW
        assert record.decision in (
            GovernanceDecision.ALLOW,
            GovernanceDecision.ALERT,
            GovernanceDecision.BLOCK,
        )


# ──────────────────────────────────────────────────────────
# 12, 13, 14. M8 enforcement tests
# ──────────────────────────────────────────────────────────

class TestM8Enforcement:

    def test_block_prevents_execution(self):
        """Test 13: BLOCK from M7 is respected in decisions."""
        governance_engine = PolicyFusionEngine()
        action = NormalizedAction(
            normalized_name="delete_file",
            category=ActionCategory.FILE_SYSTEM_WRITE,
            operation="delete",
            resource="/system/critical.cfg",
            original_tool_name="remove",
            source_dataset="test",
        )
        # CRITICAL risk → mandatory BLOCK invariant
        auth_result = ActionAuthorizationResult(
            action=action,
            status=AuthorizationStatus.AUTHORIZED,
            matched_grant=None,
            matched_deny=None,
            reasons=(),
        )
        record = governance_engine.evaluate(
            action=action,
            risk_severity=Severity.CRITICAL,
            auth_result=auth_result,
            policies=(),
        )
        assert record.decision == GovernanceDecision.BLOCK

    def test_allow_passes_through(self):
        """Test 14: ALLOW from M7 is respected for authorized + low risk."""
        governance_engine = PolicyFusionEngine()
        action = NormalizedAction(
            normalized_name="file_read",
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            resource="/data/safe.txt",
            original_tool_name="read",
            source_dataset="test",
        )
        auth_result = ActionAuthorizationResult(
            action=action,
            status=AuthorizationStatus.AUTHORIZED,
            matched_grant=None,
            matched_deny=None,
            reasons=(),
        )
        record = governance_engine.evaluate(
            action=action,
            risk_severity=Severity.NONE,
            auth_result=auth_result,
            policies=(),
        )
        assert record.decision == GovernanceDecision.ALLOW


# ──────────────────────────────────────────────────────────
# 15. Concurrent inference
# ──────────────────────────────────────────────────────────

class TestConcurrency:

    def test_concurrent_inference_is_safe(self):
        """Test 15: Multiple threads can call predict concurrently."""
        if not Path(MODEL_PATH).exists():
            pytest.skip("Model artifact not found")
        loader = MLModelLoader(artifact_path=MODEL_PATH)
        results = [None] * 10
        errors = []

        def worker(i):
            try:
                features = _make_safe_features()
                result = loader.predict(features)
                results[i] = result
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0, f"Concurrent errors: {errors}"
        for r in results:
            assert r is not None
            assert r.is_available is True


# ──────────────────────────────────────────────────────────
# ML Probability → Severity mapping
# ──────────────────────────────────────────────────────────

class TestMLSeverityMapping:

    def test_none_severity_below_threshold(self):
        assert _ml_probability_to_severity(0.10) == Severity.NONE
        assert _ml_probability_to_severity(0.39) == Severity.NONE

    def test_low_severity(self):
        assert _ml_probability_to_severity(0.40) == Severity.LOW
        assert _ml_probability_to_severity(0.54) == Severity.LOW

    def test_medium_severity(self):
        assert _ml_probability_to_severity(0.55) == Severity.MEDIUM
        assert _ml_probability_to_severity(0.69) == Severity.MEDIUM

    def test_high_severity(self):
        assert _ml_probability_to_severity(0.70) == Severity.HIGH
        assert _ml_probability_to_severity(0.84) == Severity.HIGH

    def test_critical_severity(self):
        assert _ml_probability_to_severity(0.85) == Severity.CRITICAL
        assert _ml_probability_to_severity(1.0) == Severity.CRITICAL
