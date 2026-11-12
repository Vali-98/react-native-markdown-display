# Isolated performance diagnostics

2026-11-12. Android arm64 emulator, development build, React Native 0.86.0. Current testText, 12-character chunks, 100 ms delay. Detailed probes and tree logging disabled. Warm initial render, Reset totals, then one stream per mode. Meters refresh every 250 ms. These are single-run diagnostics, not controlled release-device benchmarks.

| Measurement | New only | Original only | Both: new | Both: original |
|---|---:|---:|---:|---:|
| Completed operations | 181 | 180 | 181 | 180 |
| Native round-trip, total ms | 94.77 | — | 124.91 | — |
| Native parse/tree/ranges, total ms | 15.27 | — | 10.98 | — |
| Bridge remainder, total ms | 46.05 | — | 86.19 | — |
| markdown-it/plugins, total ms | — | 182.54 | — | 176.06 |
| Legacy cleanup, total ms | — | 71.50 | — | 62.06 |
| Legacy AST construction, total ms | — | 72.06 | — | 64.59 |
| Legacy element creation, total ms | — | 1175.04 | — | 914.16 |
| Legacy inclusive pipeline, total ms | — | 1520.43 | — | 1230.19 |
| Inclusive React Profiler, total ms | 2115.19 | 4112.23 | 1322.57 | 3476.11 |

No native coalescing, superseded operations or errors occurred in these runs. The original skipped parsing on the unchanged final input. React commits differ (362 native versus 181 original) because native source-prop commits and asynchronous snapshot commits are both counted. Parent-only commits are real React work and are not labeled as parsing.

Stages are nested: markdown-it is inside tokenization, tokenization/AST/element creation are inside the legacy pipeline, and that pipeline is inside the original's React Profiler time. Never add those totals together. Native stages are inside native round-trip; bridge remainder is delivery/waiting/unmeasured elapsed time, not measured serialization CPU time. Both-mode and isolated runs exhibit warmup and scheduling variation; their numbers do not establish a controlled speedup. Native parsing includes range mapping and builder callbacks. Feature differences (native repair, delimiters) remain.

The larger original stage in this sample is React-element creation, not markdown-it. Native latency changes with shared JS work despite short worker stages. The previously reported 1353 ms native total was not reproduced in this run; use the new controls to investigate the actual device/environment rather than attributing it to MD4C.

Detailed probes were separately smoke-tested: core/double_quote, syntax/latex_inline, syntax/latex_block_math and element-rule/fence all reported measurements without errors. Detailed probes add timer/callback overhead and should be used for attribution, not headline baseline timings.

Raw screen counters follow.

## native

```text
NEW MANAGED
181 inputs · 362 React commits · 181 operations · 0 errors
181 managed requests · 0 coalesced before processing · 0 completed but superseded · 0 reused
Final source → observed commit: 9.67 ms
React Profiler (inclusive): total 2115.19 · avg 5.843 · last 0.768 · p95 25.805 ms (362)
round-trip (all operations): total 94.77 · avg 0.524 · last 0.528 · p95 0.683 ms (181)
native/repairMs: total 1.81 · avg 0.010 · last 0.000 · p95 0.014 ms (181)
native/parseMs: total 15.27 · avg 0.084 · last 0.119 · p95 0.125 ms (181)
native/reconcileMs: total 9.84 · avg 0.054 · last 0.087 · p95 0.086 ms (181)
native/queueMs: total 11.48 · avg 0.063 · last 0.106 · p95 0.112 ms (181)
native/prepareMs: total 0.51 · avg 0.003 · last 0.000 · p95 0.006 ms (181)
JS queue: total 6.85 · avg 0.038 · last 0.025 · p95 0.047 ms (181)
JS store application: total 2.02 · avg 0.011 · last 0.010 · p95 0.016 ms (181)
bridge elapsed: total 84.95 · avg 0.469 · last 0.488 · p95 0.632 ms (181)
bridge remainder (delivery/wait/unmeasured): total 46.05 · avg 0.254 · last 0.175 · p95 0.331 ms (181)
source → observed commit: total 3741.64 · avg 20.672 · last 9.666 · p95 36.572 ms (181)
```

## original

```text
ORIGINAL
181 inputs · 181 React commits · 180 operations · 0 errors
0 managed requests · 0 coalesced before processing · 0 completed but superseded · 0 reused
Final source → observed commit: 4.99 ms
markdown-it + plugins: total 182.54 · avg 1.014 · last 1.638 · p95 1.884 ms (180)
pipeline/tokenizeMs: total 183.69 · avg 1.021 · last 1.643 · p95 1.891 ms (180)
pipeline/cleanupMs: total 71.50 · avg 0.397 · last 0.875 · p95 0.875 ms (180)
pipeline/groupMs: total 8.88 · avg 0.049 · last 0.078 · p95 0.065 ms (180)
pipeline/listTransformMs: total 9.04 · avg 0.050 · last 0.093 · p95 0.062 ms (180)
pipeline/astMs: total 72.06 · avg 0.400 · last 0.774 · p95 1.005 ms (180)
pipeline/elementsMs: total 1175.04 · avg 6.528 · last 3.587 · p95 13.047 ms (180)
pipeline/totalMs: total 1520.43 · avg 8.447 · last 7.050 · p95 16.224 ms (180)
React Profiler (inclusive): total 4112.23 · avg 22.720 · last 0.005 · p95 42.521 ms (181)
source → observed commit: total 5256.83 · avg 29.043 · last 4.990 · p95 49.784 ms (181)
```

## both

```text
ORIGINAL
181 inputs · 181 React commits · 180 operations · 0 errors
0 managed requests · 0 coalesced before processing · 0 completed but superseded · 0 reused
Final source → observed commit: 6.96 ms
markdown-it + plugins: total 176.06 · avg 0.978 · last 1.337 · p95 1.906 ms (180)
pipeline/tokenizeMs: total 177.11 · avg 0.984 · last 1.342 · p95 1.912 ms (180)
pipeline/cleanupMs: total 62.06 · avg 0.345 · last 0.697 · p95 0.754 ms (180)
pipeline/groupMs: total 6.35 · avg 0.035 · last 0.061 · p95 0.059 ms (180)
pipeline/listTransformMs: total 5.72 · avg 0.032 · last 0.059 · p95 0.056 ms (180)
pipeline/astMs: total 64.59 · avg 0.359 · last 1.003 · p95 0.730 ms (180)
pipeline/elementsMs: total 914.16 · avg 5.079 · last 12.837 · p95 12.052 ms (180)
pipeline/totalMs: total 1230.19 · avg 6.834 · last 16.001 · p95 15.025 ms (180)
React Profiler (inclusive): total 3476.11 · avg 19.205 · last 0.005 · p95 39.689 ms (181)
source → observed commit: total 4737.93 · avg 26.176 · last 6.962 · p95 48.013 ms (181)

NEW MANAGED
181 inputs · 362 React commits · 181 operations · 0 errors
181 managed requests · 0 coalesced before processing · 0 completed but superseded · 0 reused
Final source → observed commit: 8.74 ms
React Profiler (inclusive): total 1322.57 · avg 3.654 · last 0.524 · p95 18.740 ms (362)
round-trip (all operations): total 124.91 · avg 0.690 · last 0.353 · p95 2.911 ms (181)
native/repairMs: total 1.42 · avg 0.008 · last 0.000 · p95 0.014 ms (181)
native/parseMs: total 10.98 · avg 0.061 · last 0.089 · p95 0.102 ms (181)
native/reconcileMs: total 7.81 · avg 0.043 · last 0.070 · p95 0.094 ms (181)
native/queueMs: total 9.84 · avg 0.054 · last 0.036 · p95 0.096 ms (181)
native/prepareMs: total 0.40 · avg 0.002 · last 0.000 · p95 0.006 ms (181)
JS queue: total 6.02 · avg 0.033 · last 0.020 · p95 0.046 ms (181)
JS store application: total 1.52 · avg 0.008 · last 0.008 · p95 0.010 ms (181)
bridge elapsed: total 116.63 · avg 0.644 · last 0.322 · p95 2.855 ms (181)
bridge remainder (delivery/wait/unmeasured): total 86.19 · avg 0.476 · last 0.126 · p95 2.702 ms (181)
source → observed commit: total 7515.63 · avg 41.523 · last 8.735 · p95 83.999 ms (181)
```
