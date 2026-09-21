import os
import json
from pathlib import Path
import pytest
import numpy as np
import joblib

from src.agentsentinel.research.model import train_and_evaluate, build_research_dataset
from src.agentsentinel.data_loaders.atbench import ATBenchLoader
from src.agentsentinel.data_loaders.syfi import SyFILoader
from src.agentsentinel.risk.ml_model import MLModelLoader, RUNTIME_FEATURE_NAMES
from src.agentsentinel.features.extractor import TrajectoryFeatures

# ──────────────────────────────────────────────────────────
# Dataset Parsing & Label Parsing
# ──────────────────────────────────────────────────────────

def test_atbench_parsing_and_labels():
    dataset_path = "datasets/TraceLab/ATBench/test.json"
    if not Path(dataset_path).exists():
        pytest.skip("ATBench test.json not found")
        
    loader = ATBenchLoader(dataset_path)
    trajectories = list(loader.load())
    assert len(trajectories) == 1000, "ATBench should have exactly 1000 records"
    
    # Check class distribution
    labels = [t.metadata.get("label") for t in trajectories if t.metadata.get("label") is not None]
    assert len(labels) == 1000, "All ATBench records should have labels"
    safe_count = sum(1 for l in labels if l == 0)
    unsafe_count = sum(1 for l in labels if l == 1)
    
    # Based on our audit, safe=503, unsafe=497
    assert safe_count == 503
    assert unsafe_count == 497

def test_syfi_unlabeled_handling():
    dataset_path = "datasets/TraceLab/syfi_coding_trace.jsonl.gz"
    if not Path(dataset_path).exists():
        pytest.skip("SyFI dataset not found")
        
    loader = SyFILoader(dataset_path)
    # Just load first few to verify they don't have labels
    count = 0
    for t in loader.load():
        assert "label" not in t.metadata or t.metadata["label"] is None, "SyFI should be treated as unlabeled"
        count += 1
        if count >= 10:
            break

# ──────────────────────────────────────────────────────────
# Feature Ordering & Runtime Parity
# ──────────────────────────────────────────────────────────

def test_feature_ordering_parity():
    # Research model features MUST exactly match M5 runtime features
    from src.agentsentinel.research.model import FEATURE_NAMES as RESEARCH_FEATURES
    
    assert list(RESEARCH_FEATURES) == list(RUNTIME_FEATURE_NAMES), \
        "Data Leakage / Drift: Research features do not match runtime M5 features!"
        
    # Check that lengths are exactly 22
    assert len(RESEARCH_FEATURES) == 22

# ──────────────────────────────────────────────────────────
# Training / Evaluation Separation
# ──────────────────────────────────────────────────────────

def test_training_evaluation_separation():
    dataset_path = "datasets/TraceLab/ATBench/test.json"
    if not Path(dataset_path).exists():
        pytest.skip("ATBench test.json not found")
        
    X, y, feature_names = build_research_dataset(dataset_path)
    
    from sklearn.model_selection import train_test_split
    X_train, X_test, y_train, y_test, idx_train, idx_test = train_test_split(
        X, y, np.arange(len(y)), test_size=0.25, random_state=42, stratify=y
    )
    
    # Ensure no index overlaps
    assert len(set(idx_train).intersection(set(idx_test))) == 0, "DATA LEAKAGE: Train and test sets overlap!"
    assert len(idx_train) == 750
    assert len(idx_test) == 250

# ──────────────────────────────────────────────────────────
# Deterministic Evaluation & Metric Correctness
# ──────────────────────────────────────────────────────────

def test_deterministic_evaluation(tmp_path):
    dataset_path = "datasets/TraceLab/ATBench/test.json"
    if not Path(dataset_path).exists():
        pytest.skip("ATBench test.json not found")
        
    art_path = str(tmp_path / "model.joblib")
    met_path = str(tmp_path / "metrics.json")
    
    metrics1 = train_and_evaluate(dataset_path, artifact_path=art_path, metrics_path=met_path, random_state=42)
    metrics2 = train_and_evaluate(dataset_path, artifact_path=art_path, metrics_path=met_path, random_state=42)
    
    assert metrics1["accuracy"] == metrics2["accuracy"]
    assert metrics1["roc_auc"] == metrics2["roc_auc"]
    assert metrics1["confusion_matrix"]["true_positive"] == metrics2["confusion_matrix"]["true_positive"]

# ──────────────────────────────────────────────────────────
# Corrupted Model Handling & Missing Dataset
# ──────────────────────────────────────────────────────────

def test_corrupted_model_handling(tmp_path):
    corrupted_path = tmp_path / "corrupt.joblib"
    corrupted_path.write_bytes(b"not a valid joblib file")
    
    # MLModelLoader should handle this gracefully and disable ML inference without crashing
    import logging
    logger = logging.getLogger("src.agentsentinel.risk.ml_model")
    
    # It might log an error, but shouldn't raise exception
    loader = MLModelLoader(artifact_path=str(corrupted_path))
    assert loader.is_loaded is False
    
    # Inference should return fail-safe
    from src.agentsentinel.features.extractor import TrajectoryFeatures
    empty_feat = TrajectoryFeatures(
        action_count=0, event_count=0, category_counts={},
        mutating_known_true=0, mutating_known_false=0, mutating_unknown=0,
        destructive_known_true=0, destructive_known_false=0, destructive_unknown=0,
        unique_tool_count=0, transition_count=0, read_to_write_transitions=0,
        consecutive_repeated_actions=0, valid_timed_transitions=0,
        mean_inter_action_time=0.0, max_inter_action_time=0.0
    )
    result = loader.predict(empty_feat)
    
    assert result is None

def test_missing_dataset_handling():
    with pytest.raises(FileNotFoundError):
        build_research_dataset("datasets/TraceLab/ATBench/nonexistent.json")
