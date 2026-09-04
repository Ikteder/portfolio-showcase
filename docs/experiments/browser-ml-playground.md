# Browser ML playground

Date: 2026-09-04

## Purpose

Provide a compact, honest demonstration of binary classification, nonlinear decision boundaries, gradient descent, noise sensitivity, and metric interpretation.

## Implementation

- Architecture: two inputs, eight tanh hidden units, one sigmoid output.
- Optimizer: hand-written full-batch gradient descent.
- Training action: 200 epochs per click.
- Loss: binary cross-entropy.
- Datasets: deterministic synthetic linear split, XOR quadrants, and a sinusoidal wave boundary.
- Metrics: in-sample loss and accuracy, recalculated in the browser.

## Interpretation limits

- This is an educational visualization, not a benchmark or production training system.
- All metrics are in-sample results on small synthetic datasets.
- Hyperparameters are selected for visual demonstration rather than comparative model research.
- No claim is made about generalization, statistical significance, or real-world deployment performance.
