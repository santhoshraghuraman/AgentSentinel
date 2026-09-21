# AgentSentinel Research Methodology

## 1. Current Training Data Source & Internal Split
The `risk_model.joblib` artifact integrated into the M5 Behavioral Risk Engine is currently trained using the dataset located at `datasets/TraceLab/ATBench/test.json`.
The pipeline loads this single 1,000-trajectory file and uses a randomized internal split (stratified, seed=42) to divide the records into:
- **750 samples** for supervised training.
- **250 samples** for internal validation and metrics calculation.

## 2. ATBench Classification: Internal Development / Validation Evaluation
Because the current model is trained on a split of the `ATBench` dataset, **ATBench cannot yet be claimed as an external final held-out benchmark.** 
Scientifically, the model has been optimized against the underlying distribution of that specific file. Reporting ATBench metrics as evidence of generalizable, real-world robustness would constitute data leakage. The current metrics accurately reflect *internal development and validation performance*, but lack external validity.

## 3. SyFI TraceLab's Role
The SyFI dataset (`syfi_coding_trace.jsonl.gz`) contains authentic developer and autonomous coding agent interaction sequences. However, **it is entirely unlabeled.**
Therefore, SyFI is strictly prohibited from being used for supervised training of the risk classifier. Its formal role in this research project is restricted to:
- Trajectory statistics and complexity mining.
- Unsupervised behavioral distribution analysis.
- Sequence transition analysis (Markov chains, motif discovery).

## 4. Requirement for Future Independent Training Data
To achieve true external generalization and scientific validity, the training pipeline must be decoupled from ATBench.
A genuine, independent labeled dataset (e.g., *AgentDoG1.0 Binary Safety Training Data*, containing 4,000 separate labeled trajectories) must be acquired.
Once acquired, the methodology will transition to:
1. **Train** entirely on the AgentDoG1.0 dataset.
2. **Evaluate** entirely on the ATBench dataset.
This future correction is required before publishing final numerical results for the AgentSentinel architecture.
