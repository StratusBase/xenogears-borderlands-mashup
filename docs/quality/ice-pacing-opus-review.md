# Ice pacing / Opus 5.5 review

Four aggregate-only CLI reviews in this follow-up reported literal model `claude-opus-5-5` and successful results. Tools, MCP, source access and session persistence were disabled. Prompts, visible responses and model/result receipts are preserved under `artifacts/ice-pacing/opus-*` and `artifacts/ice-pacing-v3/opus-*`. Opus did not inspect source or execute gameplay; local probes, tests and captures supplied the evidence.

## Review and corrections

1. Opus requested unique per-frame GPU query credit, epoch/warm-up separation, coverage accounting, immutable receipts and preservation of the original final-frame promise boundary. Those requirements are implemented and tested; deprecated latched figures remain compatible.
2. It rejected attributing the original gap to host load, garbage collection or GPU pressure without evidence. The observed host utilization and parallel VFX work remain confounds, not causes.
3. Source validation corrected an early claim that all six Ice files were identical: five matched at first, while the presentation adapter carried a separately committed MIRV-only hook. The hook returns immediately on all tested rifle/sticky paths. Final scene priming also changes the loading helper, shared by both arms; four effect modules remain byte-identical.
4. It flagged first-reference upload asymmetry. Owner-labelled traces found 30 ordinary world/hand uploads in measured frames, not warm-up. The final opt-in loading path primes ordinary scene meshes using the existing offscreen preparation mechanism. Full tracing then observed zero source uploads and zero shader/program setup in all three arms, including warm-up. Existing callers retain the old default.
5. It requested raw callback and GPU-tail observations. Final receipts include the complete frame timeline; all missing GPU results are the five contiguous pending tail tickets, with no >25 ms callback or interval in those final tails. Both final modes remain instrumented.
6. Final native rAF timestamps, callback boundaries and responsive worker-to-page delivery narrow two long intervals to late animation-frame delivery. They do not identify a native mechanism or retrospectively explain the original 41.5 ms interval or the earlier 45.9 ms within-callback stall.

The final reviewer supports the measurement/loading/frozen-redraw claims and retaining the integration hold. It explicitly rejects a claim that the original 41.5 ms problem is solved, that parallel work caused it, or that the arms demonstrate a speedup. A separate fresh final frozen-state receipt also reproduces 240 avoided submissions with fixed Game time/matrices and draw count 3271 → 3271.

## Remaining handoff

Capture a native scheduler/compositor/GPU-process timeline over at least one >40 ms frame interval, synchronized with the existing public probes. Determine when the next frame was requested and where delivery was delayed. Keep the exact final protocol and all outliers. Do not introduce a cap, synthetic gameplay clock, visual reduction or combat change to mask the intervals.

The approved browser tool rejected internal tracing navigation, so no alternate privileged browser surface or raw protocol was used. This limits current attribution. Full measurements, coverage, source boundaries and production composition handoff are in [the pacing report](ice-pacing.md).
