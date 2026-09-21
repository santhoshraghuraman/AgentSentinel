"""
Dataset Registry and Metadata Provider (Milestone 10 & 13).

Provides verified metadata, SHA-256 hashes, record counts, and schema
characteristics for the research datasets: ATBench and SyFi.
"""

import gzip
import hashlib
import json
import os
from pathlib import Path
from typing import Any, Dict, List
from functools import lru_cache


def get_file_sha256(filepath: Path) -> str:
    """Computes SHA-256 checksum for a file."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


@lru_cache(maxsize=1)
def get_dataset_metadata() -> List[Dict[str, Any]]:
    """Returns verified metadata for all available datasets."""
    datasets = []

    # 1. ATBench
    atbench_path = Path("datasets/TraceLab/ATBench/test.json")
    if atbench_path.exists():
        stat = atbench_path.stat()
        sha256 = get_file_sha256(atbench_path)
        with open(atbench_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            total_records = len(data)
            safe_count = sum(1 for r in data if r.get("label") == 0)
            unsafe_count = sum(1 for r in data if r.get("label") == 1)

        datasets.append({
            "id": "atbench_test",
            "name": "ATBench (Agent Trajectory Benchmark)",
            "role": "Internal Development / Validation Evaluation",
            "source_path": str(atbench_path).replace("\\", "/"),
            "format": "JSON",
            "size_bytes": stat.st_size,
            "sha256": sha256,
            "trajectory_count": total_records,
            "label_distribution": {
                "safe (0)": safe_count,
                "unsafe (1)": unsafe_count,
            },
            "description": "Ground-truth benchmark containing benign and adversarial multi-turn agent trajectories across disparate tool environments.",
            "ml_model_target": "Trajectory Risk Classifier",
        })

    # 2. SyFi / TraceLab
    syfi_path = Path("datasets/TraceLab/syfi_coding_trace.jsonl.gz")
    if syfi_path.exists():
        stat = syfi_path.stat()
        sha256 = get_file_sha256(syfi_path)
        # Fast count of lines in gzip
        count = 0
        with gzip.open(syfi_path, "rt", encoding="utf-8") as f:
            for _ in f:
                count += 1

        datasets.append({
            "id": "syfi_coding_trace",
            "name": "SyFi Coding Traces (TraceLab)",
            "role": "Real-World Behavioral Trajectory Dataset",
            "source_path": str(syfi_path).replace("\\", "/"),
            "format": "JSONL (Gzip)",
            "size_bytes": stat.st_size,
            "sha256": sha256,
            "trajectory_count": count,
            "label_distribution": {
                "unlabeled_observational": count,
            },
            "description": "Authentic developer and autonomous coding agent interaction sequences for temporal and behavioral transition analysis.",
            "ml_model_target": "Behavioral Sequence Mining",
        })

    return datasets
