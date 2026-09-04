# Dataset card: Edge AI Benchmark Suite demo snapshot

Date accessed: 2026-09-04

## Source

Local source repository: `../edge-ai-benchmark-suite/README.md`

Public source: <https://github.com/Ikteder/edge-ai-benchmark-suite>

## Values used

| Model | Accuracy | Latency (ms) | Model size (MB) |
| --- | ---: | ---: | ---: |
| MobileNetV3 | 0.860 | 18.829 | 16.911 |
| EfficientNet-B0 | 0.890 | 31.252 | 16.133 |
| ConvNeXt-Tiny | 0.940 | 84.127 | 111.343 |

These are vision results from the documented CIFAR-10 subset demo. The showcase does not combine them with the tabular or text workloads.

## Quality and use limitations

- Timing and memory are environment-specific.
- The workload is a compact demonstration, not a universal device benchmark.
- The website's recommendation slider and decision game are explanatory interfaces, not independent experiments.
- Model and dataset licenses remain separate from the source repository's MIT-licensed code.
