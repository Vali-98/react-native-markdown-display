# Block-update smoke benchmark

2026-11-12. Android arm64 emulator, React Native 0.86.0, development build, `example/custom/testText.ts`, 12-character chunks, 0 ms chunk delay. Single run, both renderers mounted together, 181 committed updates each. Original uses its key patch, both reference plugins, shared custom styles and RaTeX. Native uses preview repair and block deltas.

| Accumulated measurement | Original | New custom |
|---|---:|---:|
| Parse / native round-trip | 144.65 ms | 457.84 ms |
| React excluding measured parse | 1909.73 ms | 362.46 ms |
| Parse calls | 180 | 181 |
| Skipped parse updates | 1 | 0 |

The parse columns cover different scopes: original is markdown-it plus plugins; native is the asynchronous round-trip including repair, tree/range construction, reconciliation, conversion, scheduling, and JS store application. These are not isolated parser CPU comparisons. React Profiler excludes native layout/drawing. Both displays affect the same commit. Do not interpret these values as release performance or a controlled before/after speedup.

Latest native `finish` stages in this run: queue 0.179 ms; repair 0.001 ms; parse/tree/ranges 0.114 ms; reconcile 0.057 ms; result preparation rounded to 0.000 ms. Latest full round-trip: 0.675 ms. No changed blocks are delivered by finish when exact parsing matches the preview.

Verified invariants in automated tests: an update to the last of 101 paragraphs sends one changed block; unchanged JS block objects survive updates and finish; formatting-only changes do not replay text reveal; reconstructed chunked deltas match final snapshot parsing, including tables, nested blocks, Unicode and reference definitions.
