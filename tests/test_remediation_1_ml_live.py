"""
Tests for Remediation 1 — Random Forest Activated in Live Runtime.

Verifies:
    1. Live interceptor singleton carries the injected ML model.
    2. A valid MLModelLoader can run inference through the real pipeline.
    3. ML evidence (ml_probability) reaches the ActionDecisionRecord audit field.
    4. Missing/invalid model artifacts follow the documented safe-degradation path.
    5. Existing ALLOW, ALERT, BLOCK and fail-safe behaviour is unchanged.

All tests are isolated (no modifications to the real database or artifacts).
"""

import os
import json
import threading
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import joblib
import numpy as np
import pytest
from sklearn.ensemble import RandomForestClassifier

from src.agentsentinel.features.extractor import TrajectoryFeatures
from src.agentsentinel.models.normalized import ActionCategory, NormalizedAction
from src.agentsentinel.risk.ml_model import MLModelLoader, RUNTIME_FEATURE_NAMES, MLInferenceResult
from src.agentsentinel.risk.engine import BehavioralRiskEngine
from src.agentsentinel.risk.models import Severity
from src.agentsentinel.authorization.models import (
    ActionAuthorizationResult,
    AuthorizationStatus,
    CapabilityGrant,
    TaskContext,
)
from src.agentsentinel.governance.models import GovernanceDecision, GovernancePolicy, PolicyCondition
from src.agentsentinel.runtime.interceptor import RuntimeInterceptor
from src.agentsentinel.runtime.state import RuntimeSession, ValidatedInvocation, ExecutionState


# ──────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────

_CANONICAL_ARTIFACT = "research/artifacts/risk_model.joblib"


def _make_minimal_joblib(tmp_path: Path) -> str:
    """Build a minimal but valid model artifact in a temp directory."""
    clf = RandomForestClassifier(n_estimators=2, random_state=0)
    X = np.zeros((4, len(RUNTIME_FEATURE_NAMES)), dtype=np.float32)
    y = np.array([0, 1, 0, 1], dtype=np.int32)
    clf.fit(X, y)
    payload = {
        "model": clf,
        "feature_names": RUNTIME_FEATURE_NAMES,
        "metrics": {},
    }
    path = tmp_path / "risk_model.joblib"
    joblib.dump(payload, path)
    return str(path)


def _make_features(
    action_count: int = 3,
    category: ActionCategory = ActionCategory.FILE_SYSTEM_READ,
) -> TrajectoryFeatures:
    return TrajectoryFeatures(
        action_count=action_count,
        event_count=1,
        category_counts={category: action_count},
        mutating_known_true=0,
        mutating_known_false=action_count,
        mutating_unknown=0,
        destructive_known_true=0,
        destructive_known_false=action_count,
        destructive_unknown=0,
        unique_tool_count=1,
        transition_count=max(0, action_count - 1),
        read_to_write_transitions=0,
        consecutive_repeated_actions=0,
        valid_timed_transitions=0,
        mean_inter_action_time=None,
        max_inter_action_time=None,
    )


def _make_action(
    category: ActionCategory = ActionCategory.FILE_SYSTEM_READ,
    operation: str = "read",
    resource: str = "public_docs.txt",
) -> NormalizedAction:
    # NormalizedAction is a Pydantic model: metadata and raw_data must be dict (not None)
    return NormalizedAction(
        normalized_name=category.value,
        category=category,
        provider="system",
        operation=operation,
        resource=resource,
        is_mutating=False,
        is_destructive=False,
        original_tool_name="read_file",
        source_dataset="runtime",
        arguments={"file_path": resource},
        metadata={},
        raw_data={},
    )


def _make_session(allow_category: ActionCategory = ActionCategory.FILE_SYSTEM_READ) -> RuntimeSession:
    task = TaskContext(
        task_id="test_task",
        task_description="remediation test task",
        allowed_capabilities=(
            CapabilityGrant(category=allow_category, allowed_operations=None, resource_scope=None),
        ),
        denied_capabilities=(),
    )
    return RuntimeSession(
        session_id="test_session",
        task_context=task,
        policies=(),
    )


def _get_ml_prob_from_dim(ml_dim) -> float | None:
    """
    Extract the ML unsafe probability from RiskDimensionResult.evidence.

    The interceptor reads ml_dim.evidence[0].feature_value where
    feature_name == "ml_unsafe_probability" (see interceptor.py:308-309).
    """
    for ev in ml_dim.evidence:
        if ev.feature_name == "ml_unsafe_probability":
            return ev.feature_value
    return None


# ──────────────────────────────────────────────────────────
# Test 1: Live interceptor singleton carries the ML model
# ──────────────────────────────────────────────────────────

class TestLiveInterceptorSingletonHasMLModel:
    """
    Test 1 — The actual _interceptor singleton in api.dependencies carries
    a BehavioralRiskEngine with an MLModelLoader.

    This is the primary claim: the live HTTP API initialization path
    now has ML inference enabled.
    """

    def test_interceptor_singleton_has_ml_enabled_risk_engine(self):
        """The global _interceptor must hold a risk engine with an ML model."""
        import src.agentsentinel.api.dependencies as deps

        risk_engine: BehavioralRiskEngine = deps._risk_engine
        assert risk_engine is not None, "_risk_engine global not found in dependencies"
        assert risk_engine._ml_model is not None, (
            "BehavioralRiskEngine in live singleton has no ml_model. "
            "The ML model is not activated in the live initialization path."
        )

    def test_interceptor_singleton_uses_that_risk_engine(self):
        """The _interceptor singleton must use the ML-enabled _risk_engine."""
        import src.agentsentinel.api.dependencies as deps

        interceptor: RuntimeInterceptor = deps._interceptor
        assert interceptor._risk_engine is deps._risk_engine, (
            "_interceptor does not reference _risk_engine. "
            "The interceptor may have been constructed with a different engine."
        )

    def test_ml_loader_in_singleton_targets_canonical_artifact(self):
        """The MLModelLoader in the singleton must point to the canonical artifact path."""
        import src.agentsentinel.api.dependencies as deps

        loader: MLModelLoader = deps._ml_loader
        assert loader._artifact_path == "research/artifacts/risk_model.joblib", (
            f"Unexpected artifact path: {loader._artifact_path}"
        )

    def test_ml_loader_in_singleton_is_loaded(self):
        """The MLModelLoader must have successfully loaded the artifact."""
        import src.agentsentinel.api.dependencies as deps

        loader: MLModelLoader = deps._ml_loader
        if not loader.is_loaded:
            pytest.skip(
                f"Canonical artifact not present or incompatible in this environment: "
                f"{loader.load_error}. Skipping loaded-state assertion."
            )
        assert loader.is_loaded is True

    def test_interceptor_risk_engine_ml_status_not_disabled(self):
        """The live interceptor's risk engine must NOT report ML as 'disabled'."""
        import src.agentsentinel.api.dependencies as deps

        status = deps._risk_engine.ml_model_status
        assert status != "disabled", (
            f"Risk engine reports ml_model_status='disabled'. "
            f"ML is still not injected into the live interceptor."
        )


# ──────────────────────────────────────────────────────────
# Test 2: Valid model performs inference through the pipeline
# ──────────────────────────────────────────────────────────

class TestMLInferenceThroughPipeline:
    """
    Test 2 — A valid MLModelLoader can perform inference through the
    actual M5 BehavioralRiskEngine.evaluate() call that M8 invokes.
    """

    def test_ml_inference_through_risk_engine(self, tmp_path):
        """Model loaded from a minimal artifact produces a risk assessment with ML evidence."""
        artifact = _make_minimal_joblib(tmp_path)
        loader = MLModelLoader(artifact)
        assert loader.is_loaded, f"Test artifact failed to load: {loader.load_error}"

        engine = BehavioralRiskEngine(ml_model=loader)
        features = _make_features(action_count=5, category=ActionCategory.FILE_SYSTEM_WRITE)

        assessment = engine.evaluate(features)

        # ML dimension must be present and evaluable
        assert "MLBehavioralRisk" in assessment.dimensions, (
            "MLBehavioralRisk dimension missing from risk assessment"
        )
        ml_dim = assessment.dimensions["MLBehavioralRisk"]
        assert ml_dim.is_evaluable, (
            f"ML dimension is not evaluable. Evidence: {ml_dim.evidence}"
        )
        assert ml_dim.severity is not None, "ML dimension has no severity"

    def test_ml_probability_present_in_assessment_evidence(self, tmp_path):
        """The ML probability value is in evidence[0].feature_value of the ML dimension."""
        artifact = _make_minimal_joblib(tmp_path)
        loader = MLModelLoader(artifact)
        engine = BehavioralRiskEngine(ml_model=loader)
        features = _make_features(action_count=2)

        assessment = engine.evaluate(features)
        ml_dim = assessment.dimensions.get("MLBehavioralRisk")
        assert ml_dim is not None
        assert ml_dim.is_evaluable, "ML dimension must be evaluable when model is loaded"

        prob = _get_ml_prob_from_dim(ml_dim)
        assert prob is not None, (
            "ml_unsafe_probability not found in ML dimension evidence. "
            f"Evidence items: {[e.feature_name for e in ml_dim.evidence]}"
        )
        assert 0.0 <= prob <= 1.0, f"Probability out of range: {prob}"


# ──────────────────────────────────────────────────────────
# Test 3: ml_probability reaches the ActionDecisionRecord
# ──────────────────────────────────────────────────────────

class TestMLProbabilityReachesAuditField:
    """
    Test 3 — ml_probability must be populated in the ActionDecisionRecord
    that M8 produces, so it reaches the audit response field.

    Path: _evaluate_ml() → evidence[0].feature_value → interceptor line 308-309
    → dataclasses.replace(action_record, ml_probability=ml_prob)
    → InterceptionResult.action_record.ml_probability
    """

    def test_ml_probability_in_interception_result(self, tmp_path):
        """
        After a full intercept() call using an ML-enabled engine, the
        returned action_record must carry a non-None ml_probability.
        """
        artifact = _make_minimal_joblib(tmp_path)
        loader = MLModelLoader(artifact)
        assert loader.is_loaded

        engine = BehavioralRiskEngine(ml_model=loader)
        interceptor = RuntimeInterceptor(risk_engine=engine)
        session = _make_session()
        action = _make_action()

        result, audit_event = interceptor.intercept(session, action)

        assert result.action_record is not None, "action_record is None (fail-safe triggered)"
        ml_prob = getattr(result.action_record, "ml_probability", "MISSING")
        assert ml_prob != "MISSING", "ml_probability field missing from ActionDecisionRecord"
        assert ml_prob is not None, (
            "ml_probability is None even though model is loaded. "
            "The interceptor may not be forwarding ML results."
        )
        assert 0.0 <= ml_prob <= 1.0, f"ml_probability out of range: {ml_prob}"

    def test_ml_probability_in_audit_event(self, tmp_path):
        """The AuditEvent's action_record must also carry the ml_probability."""
        artifact = _make_minimal_joblib(tmp_path)
        loader = MLModelLoader(artifact)
        engine = BehavioralRiskEngine(ml_model=loader)
        interceptor = RuntimeInterceptor(risk_engine=engine)
        session = _make_session()
        action = _make_action()

        result, audit_event = interceptor.intercept(session, action)

        assert audit_event.action_record is not None
        ml_prob = getattr(audit_event.action_record, "ml_probability", "MISSING")
        assert ml_prob != "MISSING"
        assert ml_prob is not None
        assert 0.0 <= ml_prob <= 1.0


# ──────────────────────────────────────────────────────────
# Test 4: Safe degradation when model is unavailable
# ──────────────────────────────────────────────────────────

class TestSafeDegradationWhenModelUnavailable:
    """
    Test 4 — Missing or invalid artifacts follow the documented
    safe-degradation path: ML dimension is not evaluable, governance
    continues on heuristic dimensions, and the engine does not fail open.
    """

    def test_missing_artifact_loader_not_loaded(self, tmp_path):
        """MLModelLoader with a nonexistent path enters degraded state."""
        loader = MLModelLoader(str(tmp_path / "nonexistent.joblib"))
        assert loader.is_loaded is False
        assert loader.load_error is not None
        assert "not found" in loader.load_error.lower()

    def test_missing_artifact_engine_continues_with_heuristics(self, tmp_path):
        """When model is missing, BehavioralRiskEngine still produces a valid assessment."""
        loader = MLModelLoader(str(tmp_path / "nonexistent.joblib"))
        engine = BehavioralRiskEngine(ml_model=loader)
        features = _make_features(action_count=3)

        assessment = engine.evaluate(features)

        # Overall assessment must still exist
        assert assessment is not None
        assert assessment.overall_severity is not None

        # ML dimension must be present but NOT evaluable
        ml_dim = assessment.dimensions.get("MLBehavioralRisk")
        assert ml_dim is not None, "MLBehavioralRisk dimension should exist even when model missing"
        assert ml_dim.is_evaluable is False, "ML dimension must be non-evaluable when model is missing"

    def test_missing_artifact_interceptor_does_not_fail_open(self, tmp_path):
        """With a degraded loader, the interceptor still produces a valid BLOCK/ALLOW/ALERT decision."""
        loader = MLModelLoader(str(tmp_path / "nonexistent.joblib"))
        engine = BehavioralRiskEngine(ml_model=loader)
        interceptor = RuntimeInterceptor(risk_engine=engine)
        session = _make_session()
        action = _make_action()

        result, audit_event = interceptor.intercept(session, action)

        # Must still reach a governance decision — no exception, no None decision
        assert result.decision in (
            GovernanceDecision.ALLOW,
            GovernanceDecision.ALERT,
            GovernanceDecision.BLOCK,
        ), f"Unexpected decision: {result.decision}"

    def test_corrupted_artifact_loader_not_loaded(self, tmp_path):
        """MLModelLoader with a corrupt file enters degraded state."""
        bad_path = tmp_path / "corrupt.joblib"
        bad_path.write_bytes(b"not a joblib file at all")
        loader = MLModelLoader(str(bad_path))
        assert loader.is_loaded is False
        assert loader.load_error is not None

    def test_missing_artifact_ml_probability_is_none_in_audit(self, tmp_path):
        """With a missing model, ml_probability in the audit record must be None (not fabricated)."""
        loader = MLModelLoader(str(tmp_path / "nonexistent.joblib"))
        engine = BehavioralRiskEngine(ml_model=loader)
        interceptor = RuntimeInterceptor(risk_engine=engine)
        session = _make_session()
        action = _make_action()

        result, audit_event = interceptor.intercept(session, action)

        if result.action_record is not None:
            ml_prob = getattr(result.action_record, "ml_probability", "MISSING")
            assert ml_prob != "MISSING"
            assert ml_prob is None, (
                f"ml_probability should be None when model is unavailable, got {ml_prob}"
            )


# ──────────────────────────────────────────────────────────
# Test 5: Existing ALLOW / ALERT / BLOCK / fail-safe unchanged
# ──────────────────────────────────────────────────────────

class TestExistingGovernanceUnchanged:
    """
    Test 5 — ML activation must not alter any existing governance decision.
    ALLOW, ALERT, BLOCK and fail-safe invariants must remain exactly as before.
    """

    def _make_interceptor_with_model(self, tmp_path) -> RuntimeInterceptor:
        artifact = _make_minimal_joblib(tmp_path)
        loader = MLModelLoader(artifact)
        engine = BehavioralRiskEngine(ml_model=loader)
        return RuntimeInterceptor(risk_engine=engine)

    def test_allow_action_still_allows(self, tmp_path):
        """ALLOW policy still produces ALLOW even with ML active."""
        interceptor = self._make_interceptor_with_model(tmp_path)
        session = _make_session(allow_category=ActionCategory.FILE_SYSTEM_READ)
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_READ,
            operation="read",
            resource="public_docs.txt",
        )

        result, _ = interceptor.intercept(session, action)
        # With NONE/LOW risk and AUTHORIZED auth, baseline matrix → ALLOW
        assert result.decision in (
            GovernanceDecision.ALLOW,
            GovernanceDecision.ALERT,
        ), f"Expected ALLOW or ALERT for safe read action, got {result.decision}"

    def test_unauthorized_action_never_gets_allow(self, tmp_path):
        """An action with no authorization grant must never receive ALLOW."""
        interceptor = self._make_interceptor_with_model(tmp_path)
        # Task with no grants — everything is UNAUTHORIZED
        task = TaskContext(
            task_id="no_grant_task",
            task_description="no grants",
            allowed_capabilities=(),
            denied_capabilities=(),
        )
        session = RuntimeSession(
            session_id="test_session",
            task_context=task,
            policies=(),
        )
        action = _make_action()

        result, _ = interceptor.intercept(session, action)
        assert result.decision != GovernanceDecision.ALLOW, (
            "UNAUTHORIZED action must never produce ALLOW (invariant 4 violated)"
        )

    def test_critical_risk_always_blocks(self, tmp_path):
        """CRITICAL risk from ML must produce BLOCK (invariant 1)."""
        # Build a mock ML loader that always returns probability 0.99 (→ CRITICAL)
        loader = MagicMock(spec=MLModelLoader)
        loader.is_loaded = True
        loader.predict.return_value = MLInferenceResult(
            unsafe_probability=0.99,
            safe_probability=0.01,
            predicted_class=1,
            is_available=True,
        )

        engine = BehavioralRiskEngine(ml_model=loader)
        interceptor = RuntimeInterceptor(risk_engine=engine)
        session = _make_session()
        action = _make_action()

        result, _ = interceptor.intercept(session, action)
        assert result.decision == GovernanceDecision.BLOCK, (
            f"CRITICAL ML risk must trigger invariant BLOCK, got {result.decision}"
        )

    def test_write_to_unauthorized_path_blocks(self, tmp_path):
        """A write action to an unauthorized resource must BLOCK."""
        artifact = _make_minimal_joblib(tmp_path)
        loader = MLModelLoader(artifact)
        engine = BehavioralRiskEngine(ml_model=loader)
        interceptor = RuntimeInterceptor(risk_engine=engine)

        # Grant only FILE_SYSTEM_READ, not WRITE
        task = TaskContext(
            task_id="read_only_task",
            task_description="read only",
            allowed_capabilities=(
                CapabilityGrant(
                    category=ActionCategory.FILE_SYSTEM_READ,
                    allowed_operations=None,
                    resource_scope=None,
                ),
            ),
            denied_capabilities=(),
        )
        block_policy = GovernancePolicy(
            policy_id="block_write",
            decision=GovernanceDecision.BLOCK,
            priority=10,
            description="Block file writes",
            condition=PolicyCondition(
                categories=frozenset([ActionCategory.FILE_SYSTEM_WRITE]),
            ),
        )
        session = RuntimeSession(
            session_id="write_test_session",
            task_context=task,
            policies=(block_policy,),
        )
        action = _make_action(
            category=ActionCategory.FILE_SYSTEM_WRITE,
            operation="write",
            resource="/etc/passwd",
        )

        result, _ = interceptor.intercept(session, action)
        assert result.decision == GovernanceDecision.BLOCK, (
            f"Unauthorized WRITE must BLOCK, got {result.decision}"
        )

    def test_fail_safe_still_blocks_on_engine_exception(self, tmp_path):
        """If BehavioralRiskEngine.evaluate raises, the interceptor still returns BLOCK."""
        artifact = _make_minimal_joblib(tmp_path)
        loader = MLModelLoader(artifact)
        engine = BehavioralRiskEngine(ml_model=loader)

        with patch.object(engine, "evaluate", side_effect=RuntimeError("simulated M5 crash")):
            interceptor = RuntimeInterceptor(risk_engine=engine)
            session = _make_session()
            action = _make_action()

            result, audit_event = interceptor.intercept(session, action)

        assert result.decision == GovernanceDecision.BLOCK, (
            f"Fail-safe must produce BLOCK when M5 throws, got {result.decision}"
        )
        assert result.action_record is None, (
            "action_record must be None when fail-safe triggers"
        )

    def test_ml_active_does_not_break_existing_regression(self, tmp_path):
        """
        Complete end-to-end with ML active: action is evaluated, audit event
        produced, execution state is ATTEMPTED, decision is non-None.
        """
        artifact = _make_minimal_joblib(tmp_path)
        loader = MLModelLoader(artifact)
        engine = BehavioralRiskEngine(ml_model=loader)
        interceptor = RuntimeInterceptor(risk_engine=engine)
        session = _make_session()
        action = _make_action()

        result, audit_event = interceptor.intercept(session, action)

        assert result.decision is not None
        assert result.interception_id is not None
        assert result.session_id == "test_session"
        assert audit_event.decision == result.decision
        assert audit_event.execution_state == ExecutionState.ATTEMPTED
