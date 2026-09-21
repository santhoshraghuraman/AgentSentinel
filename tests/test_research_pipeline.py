import os
import json
from pathlib import Path
import pytest
import numpy as np

from research.training.pipeline import load_and_extract_features, train_pipeline

def test_pipeline_missing_dataset_failure_path():
    """Phase 1I rule 12: Missing dataset failure path"""
    with pytest.raises(FileNotFoundError, match="DATASET BLOCKER"):
        train_pipeline(dataset_path="nonexistent/path/to/dataset.json", output_dir="sandbox/test_artifacts")

def test_pipeline_reproducibility():
    """Phase 1I rule 10 & 1: Dataset loading, reproducibility"""
    dataset_path = "datasets/TraceLab/ATBench/test.json"
    if not Path(dataset_path).exists():
        pytest.skip(f"Test dataset not found at {dataset_path}")
        
    metrics1 = train_pipeline(dataset_path=dataset_path, random_state=42, output_dir="sandbox/test_artifacts1")
    metrics2 = train_pipeline(dataset_path=dataset_path, random_state=42, output_dir="sandbox/test_artifacts2")
    
    assert metrics1["accuracy"] == metrics2["accuracy"]
    assert metrics1["f1_score"] == metrics2["f1_score"]
    
def test_pipeline_shape_and_features():
    """Phase 1I rule 4 & 8: Feature extraction and Prediction shape"""
    dataset_path = "datasets/TraceLab/ATBench/test.json"
    if not Path(dataset_path).exists():
        pytest.skip(f"Test dataset not found at {dataset_path}")
        
    X, y, feature_names = load_and_extract_features(dataset_path)
    assert len(X) == len(y)
    assert len(X) > 0
    assert X.shape[1] == len(feature_names)
    assert "action_count" in feature_names

def test_pipeline_eval_metrics():
    """Phase 1I rule 9: Evaluation metric calculation"""
    dataset_path = "datasets/TraceLab/ATBench/test.json"
    if not Path(dataset_path).exists():
        pytest.skip(f"Test dataset not found at {dataset_path}")
        
    metrics = train_pipeline(dataset_path=dataset_path, random_state=42, output_dir="sandbox/test_artifacts3")
    assert "accuracy" in metrics
    assert "precision" in metrics
    assert "recall" in metrics
    assert "f1_score" in metrics
    assert "roc_auc" in metrics
    assert "confusion_matrix" in metrics
    
    assert metrics["accuracy"] >= 0.0 and metrics["accuracy"] <= 1.0
