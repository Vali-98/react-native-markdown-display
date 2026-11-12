# Full-render diagnostic benchmark

2026-11-12. Android arm64 emulator, React Native 0.86.0, development build, current example sample with both displays mounted together. One initial load and five subsequent Show complete presses. Timings in milliseconds.

| Metric | Initial load | Warm median (5 runs) | Warm range |
|---|---:|---:|---:|
| parse | 9.35 | 11.11 | 9.54–61.35 |
| basicRender | 29.10 | 4.42 | 3.79–6.30 |
| customRender | 35.60 | 4.69 | 4.43–5.53 |
| basicLayout | 403.25 | 23.05 | 22.81–37.75 |
| customLayout | 403.54 | 23.24 | 22.92–37.93 |

`parse` measures the async replace call including native parsing, scheduling, and Nitro conversion. Render durations come from React Profiler and exclude native layout/drawing. Layout latency starts when the snapshot is published and ends at each card’s first onLayout callback. Both cards share the same commit; these are not isolated end-to-end renderer benchmarks. Native RaTeX sizing may continue later. This is a small-sample diagnostic, not release/device performance.

The example shows these values on every Show complete press and logs them as `Markdown full-render timing`.
