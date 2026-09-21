"""
ML Model Loader for Runtime Inference (Phase 2).

Loads the trained research model artifact and provides deterministic
inference on TrajectoryFeatures vectors.

Architecture:
    - Model is loaded ONCE at initialization, not per-call.
    - Feature dimension and ordering are validated at load time.
    - If the model is missing, corrupt, or incompatible, the loader
      reports a clear diagnostic and inference returns None (fail-safe).
    - The loader does NOT make governance decisions. It returns a
      probability score that M5 interprets.

This module is the ONLY place where the .joblib artifact is loaded
for runtime purposes.
"""

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np

from src.agentsentinel.features.extractor import TrajectoryFeatures
from src.agentsentinel.models.normalized import ActionCategory

logger = logging.getLogger(__name__)

# Canonical feature ordering — must match research/training/pipeline.py
RUNTIME_FEATURE_NAMES = [
    "action_count",
    "event_count",
    "cat_file_system_read",
    "cat_file_system_write",
    "cat_code_execution",
    "cat_web_request",
    "cat_api_call",
    "cat_agent_control",
    "cat_unknown",
    "mutating_known_true",
    "mutating_known_false",
    "mutating_unknown",
    "destructive_known_true",
    "destructive_known_false",
    "destructive_unknown",
    "unique_tool_count",
    "transition_count",
    "read_to_write_transitions",
    "consecutive_repeated_actions",
    "valid_timed_transitions",
    "mean_inter_action_time",
    "max_inter_action_time",
]


@dataclass(frozen=True)
class ModelMetadata:
    """Machine-readable metadata record for the loaded model."""
    model_type: str
    model_version: str
    feature_version: str
    training_dataset: str
    training_sample_count: int
    test_sample_count: int
    metrics: Dict[str, Any]
    random_seed: int
    artifact_path: str
    feature_count: int
    feature_names: Tuple[str, ...]


@dataclass(frozen=True)
class MLInferenceResult:
    """Result of a single ML inference call."""
    unsafe_probability: float  # P(unsafe | features), class 1
    safe_probability: float    # P(safe | features), class 0
    predicted_class: int       # 0 = safe, 1 = unsafe
    is_available: bool         # True if inference succeeded


def features_to_vector(feat: TrajectoryFeatures) -> List[float]:
    """
    Convert TrajectoryFeatures to the canonical flat vector.

    This MUST produce the same ordering as the training pipeline.
    """
    cats = feat.category_counts
    return [
        float(feat.action_count),
        float(feat.event_count),
        float(cats.get(ActionCategory.FILE_SYSTEM_READ, 0)),
        float(cats.get(ActionCategory.FILE_SYSTEM_WRITE, 0)),
        float(cats.get(ActionCategory.CODE_EXECUTION, 0)),
        float(cats.get(ActionCategory.WEB_REQUEST, 0)),
        float(cats.get(ActionCategory.API_CALL, 0)),
        float(cats.get(ActionCategory.AGENT_CONTROL, 0)),
        float(cats.get(ActionCategory.UNKNOWN, 0)),
        float(feat.mutating_known_true),
        float(feat.mutating_known_false),
        float(feat.mutating_unknown),
        float(feat.destructive_known_true),
        float(feat.destructive_known_false),
        float(feat.destructive_unknown),
        float(feat.unique_tool_count),
        float(feat.transition_count),
        float(feat.read_to_write_transitions),
        float(feat.consecutive_repeated_actions),
        float(feat.valid_timed_transitions),
        float(feat.mean_inter_action_time if feat.mean_inter_action_time is not None else 0.0),
        float(feat.max_inter_action_time if feat.max_inter_action_time is not None else 0.0),
    ]


class MLModelLoader:
    """
    Loads and validates the trained ML model artifact for runtime inference.

    The model is loaded once at construction time. All subsequent calls
    to predict() reuse the loaded model without reloading.

    If loading fails for any reason, the loader enters a degraded state
    where predict() always returns None with a diagnostic message.
    """

    def __init__(self, artifact_path: str = "research/artifacts/risk_model.joblib"):
        self._artifact_path = artifact_path
        self._model = None
        self._feature_names: Optional[List[str]] = None
        self._metadata: Optional[ModelMetadata] = None
        self._load_error: Optional[str] = None
        self._is_loaded = False

        self._try_load()

    @property
    def is_loaded(self) -> bool:
        return self._is_loaded

    @property
    def load_error(self) -> Optional[str]:
        return self._load_error

    @property
    def metadata(self) -> Optional[ModelMetadata]:
        return self._metadata

    def _try_load(self) -> None:
        """Attempt to load and validate the model artifact."""
        path = Path(self._artifact_path)

        if not path.exists():
            self._load_error = f"Model artifact not found at {self._artifact_path}"
            logger.warning("MLModelLoader: %s", self._load_error)
            return

        try:
            artifact = joblib.load(path)
        except Exception as e:
            self._load_error = f"Failed to deserialize model artifact: {e}"
            logger.error("MLModelLoader: %s", self._load_error)
            return

        if not isinstance(artifact, dict):
            self._load_error = f"Model artifact is not a dictionary (got {type(artifact).__name__})"
            logger.error("MLModelLoader: %s", self._load_error)
            return

        model = artifact.get("model")
        feature_names = artifact.get("feature_names")
        metrics = artifact.get("metrics", {})
        meta = artifact.get("metadata", {})

        if model is None:
            self._load_error = "Model artifact missing 'model' key"
            logger.error("MLModelLoader: %s", self._load_error)
            return

        if feature_names is None:
            self._load_error = "Model artifact missing 'feature_names' key"
            logger.error("MLModelLoader: %s", self._load_error)
            return

        # Validate feature dimension compatibility
        if len(feature_names) != len(RUNTIME_FEATURE_NAMES):
            self._load_error = (
                f"Feature dimension mismatch: model expects {len(feature_names)} features, "
                f"runtime provides {len(RUNTIME_FEATURE_NAMES)}"
            )
            logger.error("MLModelLoader: %s", self._load_error)
            return

        # Validate feature ordering
        if list(feature_names) != RUNTIME_FEATURE_NAMES:
            self._load_error = (
                f"Feature ordering mismatch: model features {feature_names} "
                f"do not match runtime features {RUNTIME_FEATURE_NAMES}"
            )
            logger.error("MLModelLoader: %s", self._load_error)
            return

        # Validate model has predict and predict_proba
        if not hasattr(model, "predict"):
            self._load_error = "Loaded model does not have a predict() method"
            logger.error("MLModelLoader: %s", self._load_error)
            return

        self._model = model
        self._feature_names = list(feature_names)

        # Build metadata from actual artifact values
        training_config = meta.get("training_config", {})
        self._metadata = ModelMetadata(
            model_type=metrics.get("algorithm", "unknown"),
            model_version=metrics.get("model_version", meta.get("model_version", "unknown")),
            feature_version=metrics.get("feature_version", "v1"),
            training_dataset=metrics.get("dataset_version", meta.get("dataset", "unknown")),
            training_sample_count=metrics.get("total_dataset_records", 0) - metrics.get("test_samples", 0),
            test_sample_count=metrics.get("test_samples", 0),
            metrics={
                k: v for k, v in metrics.items()
                if k in ("accuracy", "precision", "recall", "f1_score", "roc_auc", "confusion_matrix")
            },
            random_seed=training_config.get("random_seed", metrics.get("split_information", {}).get("random_seed", 0)),
            artifact_path=self._artifact_path,
            feature_count=len(feature_names),
            feature_names=tuple(feature_names),
        )

        self._is_loaded = True
        logger.info(
            "MLModelLoader: Successfully loaded model v%s (%s) from %s",
            self._metadata.model_version,
            self._metadata.model_type,
            self._artifact_path,
        )

    def predict(self, features: TrajectoryFeatures) -> Optional[MLInferenceResult]:
        """
        Run inference on a TrajectoryFeatures instance.

        Returns:
            MLInferenceResult if the model is loaded and inference succeeds.
            None if the model is unavailable or inference fails.

        The model's class 1 = unsafe (high-risk), class 0 = safe.
        """
        if not self._is_loaded or self._model is None:
            logger.debug(
                "MLModelLoader.predict: Model unavailable. Error: %s",
                self._load_error,
            )
            return None

        try:
            vec = features_to_vector(features)
            X = np.array([vec], dtype=np.float32)

            predicted_class = int(self._model.predict(X)[0])

            if hasattr(self._model, "predict_proba"):
                probas = self._model.predict_proba(X)[0]
                safe_prob = float(probas[0])
                unsafe_prob = float(probas[1])
            else:
                safe_prob = 1.0 - float(predicted_class)
                unsafe_prob = float(predicted_class)

            return MLInferenceResult(
                unsafe_probability=unsafe_prob,
                safe_probability=safe_prob,
                predicted_class=predicted_class,
                is_available=True,
            )
        except Exception as e:
            logger.error("MLModelLoader.predict: Inference failed: %s", e, exc_info=True)
            return None
