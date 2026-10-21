"""
Research ML Model Pipeline (Milestone 11 & Research Architecture).

Connects:
Dataset -> ATBenchLoader -> normalize_stream -> BehavioralSequence
        -> TrajectoryFeatureExtractor -> Train/Test Split -> Classifier -> Evaluation

Architecture Separation:
- M5 Behavioral Risk = Runtime behavioral risk engine for live governance.
- Research ML Model = Learned research baseline for trajectory classification and empirical evaluation.
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

from src.agentsentinel.data_loaders.atbench import ATBenchLoader
from src.agentsentinel.features.extractor import TrajectoryFeatureExtractor, TrajectoryFeatures
from src.agentsentinel.models.normalized import ActionCategory
from src.agentsentinel.normalizers.action_normalizer import normalize_stream
from src.agentsentinel.representations.behavioral_sequence import BehavioralSequence

logger = logging.getLogger(__name__)

FEATURE_NAMES = [
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


def features_to_vector(feat: TrajectoryFeatures) -> List[float]:
    """Convert a TrajectoryFeatures instance to a flat numerical feature vector."""
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


def build_research_dataset(
    dataset_path: str = "datasets/TraceLab/ATBench/test.json",
) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    """
    Extracts features from ATBench trajectories using the genuine AgentSentinel
    normalization and behavioral feature extraction pipeline.
    """
    loader = ATBenchLoader(dataset_path)
    raw_trajectories = list(loader.load())

    normalized_trajectories = list(normalize_stream(raw_trajectories, source_dataset="atbench"))

    extractor = TrajectoryFeatureExtractor()
    X_list = []
    y_list = []

    for raw, norm in zip(raw_trajectories, normalized_trajectories):
        label = raw.metadata.get("label")
        if label is None:
            continue

        seq = BehavioralSequence(norm)
        feats = extractor.extract(seq)
        vec = features_to_vector(feats)

        X_list.append(vec)
        y_list.append(int(label))

    return np.array(X_list, dtype=np.float32), np.array(y_list, dtype=np.int32), FEATURE_NAMES


def train_and_evaluate(
    dataset_path: str = "datasets/TraceLab/ATBench/test.json",
    model_type: str = "random_forest",
    random_state: int = 42,
    artifact_path: str = "datasets/risk_model.joblib",
    metrics_path: str = "datasets/evaluation_metrics.json",
) -> Dict[str, Any]:
    """
    Trains a research model on the extracted trajectory features, evaluates on
    held-out test split, and persists model & metrics.
    """
    X, y, feature_names = build_research_dataset(dataset_path)

    total_records = len(y)
    safe_samples = int(np.sum(y == 0))
    unsafe_samples = int(np.sum(y == 1))

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=random_state, stratify=y
    )

    if model_type == "logistic_regression":
        model = LogisticRegression(random_state=random_state, max_iter=1000)
        display_name = "Logistic Regression Baseline"
    else:
        model = RandomForestClassifier(n_estimators=100, random_state=random_state)
        display_name = "Random Forest Trajectory Classifier"

    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1] if hasattr(model, "predict_proba") else y_pred

    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, zero_division=0))
    rec = float(recall_score(y_test, y_pred, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, zero_division=0))
    roc_auc = float(roc_auc_score(y_test, y_proba))

    cm = confusion_matrix(y_test, y_pred)
    tn = int(cm[0, 0])
    fp = int(cm[0, 1])
    fn = int(cm[1, 0])
    tp = int(cm[1, 1])

    fpr = float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0
    fnr = float(fn / (fn + tp)) if (fn + tp) > 0 else 0.0

    feature_importances = {}
    if hasattr(model, "feature_importances_"):
        for name, imp in zip(feature_names, model.feature_importances_):
            feature_importances[name] = round(float(imp), 4)

    metrics = {
        "model_type": display_name,
        "algorithm": model_type,
        "dataset_source": dataset_path,
        "total_dataset_records": total_records,
        "training_samples": len(y_train),
        "evaluation_samples": len(y_test),
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "roc_auc": round(roc_auc, 4),
        "false_positive_rate": round(fpr, 4),
        "false_negative_rate": round(fnr, 4),
        "confusion_matrix": {
            "true_negative": tn,
            "false_positive": fp,
            "false_negative": fn,
            "true_positive": tp,
        },
        "class_distribution": {
            "safe_samples": safe_samples,
            "unsafe_samples": unsafe_samples,
        },
        "feature_importances": feature_importances,
        "trained_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "random_seed": random_state,
    }

    # Persist model
    Path(artifact_path).parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "feature_names": feature_names, "metrics": metrics}, artifact_path)

    # Persist metrics json
    Path(metrics_path).parent.mkdir(parents=True, exist_ok=True)
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    logger.info(f"Research model trained and saved to {artifact_path}. Metrics: {metrics}")
    return metrics


if __name__ == "__main__":
    train_and_evaluate()
