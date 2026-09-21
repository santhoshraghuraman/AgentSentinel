import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

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
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

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

def load_and_extract_features(dataset_path: str) -> Tuple[np.ndarray, np.ndarray, List[str]]:
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

def train_pipeline(
    dataset_path: str = "datasets/TraceLab/ATBench/test.json",
    model_type: str = "random_forest",
    random_state: int = 42,
    output_dir: str = "research/artifacts"
) -> Dict[str, Any]:
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    if not Path(dataset_path).exists():
        raise FileNotFoundError(f"DATASET BLOCKER: {dataset_path}")

    X, y, feature_names = load_and_extract_features(dataset_path)

    total_records = len(y)

    # Stratified split to preserve class separation (Phase 1F rules 3, 4, 5)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=random_state, stratify=y
    )

    # Pipeline with scaling and model
    # Random Forest is a strong baseline for non-linear behavioral features
    if model_type == "logistic_regression":
        classifier = LogisticRegression(random_state=random_state, max_iter=1000)
    else:
        classifier = RandomForestClassifier(n_estimators=100, random_state=random_state)
        
    model = Pipeline([
        ('scaler', StandardScaler()),
        ('classifier', classifier)
    ])

    # Fit only on training data (Phase 1F rule 6)
    model.fit(X_train, y_train)

    # Evaluate on held-out test data (Phase 1G)
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

    metrics = {
        "model_version": "1.0.0",
        "dataset_version": dataset_path,
        "feature_version": "v1",
        "algorithm": model_type,
        "split_information": {
            "test_size": 0.20,
            "random_seed": random_state,
        },
        "total_dataset_records": total_records,
        "test_samples": len(y_test),
        "class_distribution": {
            "test_positive_class": int(np.sum(y_test == 1)),
            "test_negative_class": int(np.sum(y_test == 0)),
        },
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "roc_auc": round(roc_auc, 4),
        "confusion_matrix": {
            "true_negative": tn,
            "false_positive": fp,
            "false_negative": fn,
            "true_positive": tp,
        },
        "trained_at": datetime.utcnow().isoformat(),
    }

    # Save artifact (Phase 1F rule 7 & Phase 1H)
    artifact_path = output_path / "risk_model.joblib"
    metrics_path = output_path / "evaluation_metrics.json"
    
    joblib.dump({
        "model": model, 
        "feature_names": feature_names, 
        "metrics": metrics,
        "metadata": {
            "model_version": "1.0.0",
            "dataset": dataset_path,
            "training_config": {"algorithm": model_type, "random_seed": random_state}
        }
    }, artifact_path)

    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    return metrics

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    try:
        metrics = train_pipeline()
        print(f"Training completed. Metrics: {json.dumps(metrics, indent=2)}")
    except Exception as e:
        print(f"Training failed: {e}")
