# GPU timing receipts

`QualityPerformance` retains the existing constructor, `begin/end/measure/dispose` methods and final-measured-frame promise boundary. Existing `gpuMs` and `latest.gpuMs` remain latched display values for compatibility. **Do not use that field to compare GPU distributions.**

Use `gpuUniqueMs` with `gpuTiming` schema 2:

- Every query belongs to its issuing frame and measurement epoch. Ready batches contribute each result once.
- Warm-up and previous-arm tickets never enter the new arm's distribution.
- `requested`, `issued`, `resolved`, `pending`, `skipped`, `disjoint`, `lost` and `coverage` describe missing results. `samples` contains unique `{frame,ms}` pairs; offsets start at `firstFrame`.
- The receipt snapshots available results at the original measurement boundary. Pending tails remain explicit; later polls cannot mutate the receipt. No extra gameplay, sound or drain frames are added.
- No blocking availability wait. The query pool is bounded at eight. A foreign active elapsed query causes a skipped sample rather than nesting or ending another owner's query.
- Disjoint status is checked after collecting ready results, invalidating both those results and pending queries. Context loss never produces a cached replacement measurement.

`GpuFrameTimer` is the existing crowd timing mechanism extracted to a neutral rendering module. `CrowdGpuTimer` and `CrowdGpuFrame` remain compatibility exports from their existing path; `CrowdCpuScopes` is unchanged. This is one mechanism, not a second GPU clock.

Timer elapsed time does not establish OS scheduling, browser/compositor time or GPU queue wait. High coverage alone does not prove an unbiased sample: retain missing frame IDs and compare their callback times when those observations exist. Never silently substitute deprecated latched figures for missing unique data.

Tests cover batched completion, warm-up and epoch isolation, immutable receipts, unavailable results, bounded pending queries, disjoint transitions, context loss, foreign/current queries, unsupported extensions and compatibility exports.
