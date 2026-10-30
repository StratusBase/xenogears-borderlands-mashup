# Ice performance / Opus 5.5 review

See the [later pacing and GPU-accounting review](ice-pacing-opus-review.md) for the parallel-workload investigation and remaining native attribution gate. This document preserves the earlier shader-lifetime review.

Three CLI reviews used literal model `claude-opus-5-5`. Every assistant response reported that model and every result reported success. Tools, MCP servers, source inspection and session persistence were disabled. Only aggregate timings and API-level descriptions were supplied; no source files or assets were sent. Opus did not execute the game.

Prompts, assistant text, event receipts and metadata are retained under `artifacts/ice-performance/opus-*`. Hidden reasoning was not used in the handoff.

## Diagnosis and corrections

Opus ranked deferred program/pipeline completion, reference-count churn, late target variants, then allocation/upload/GC as falsifiable hypotheses. It recommended timing info-log/status reads rather than trusting cheap compile/link invocation times. Probes then confirmed deletion at frame 433 and recreation/stall at frame 493.

Its correctness review requested per-source uniform isolation, complete material-state checks, shader variants, lifetime ownership and borrowed-buffer cleanup. Tests and gameplay checks now cover those paths, including live instance/color/morph resource cleanup on failure.

An early description incorrectly characterized back/front rendering as two passes. Local inspection corrected it: installed Three r180 ShaderMaterial defaults to `forceSinglePass=true`; both accepted and candidate materials retain that default and `DoubleSide`. The final reviewer received this correction. No pass-count change is part of the patch.

## Final recommendation

A separate handoff of the specific VFX fix is reasonable, with these conditions retained:

- **Full-app 25 ms pacing gate fails.** Candidate intervals include 28.3 ms and a later 41.5 ms diagnostic interval.
- Later-session drift affects both arms: sticky baselines reached 78.2 / 79.6 ms and candidate 40.3 ms.
- A sticky GPU median of 1.96 versus about 1.60 ms, and a 5.42 ms maximum, remain unresolved variance signals.
- At least 26.2 ms of the residual interval lies outside the instrumented Game callback. Layout/paint, GC, scheduling and host load are not separated.
- Capture a browser-level trace under quiet and observed load before integration. Overall pacing signoff remains open.
- Fresh GPU/disk-cache/profile, context restoration, changed settings and alternate hardware are not validated.

Final response: `artifacts/ice-performance/opus-final-review.md`. Measurements and integration contract: [ice-performance.md](ice-performance.md).
