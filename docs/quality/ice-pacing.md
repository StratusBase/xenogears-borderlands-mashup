# Ice pacing follow-up

**GPU accounting, cold scene upload asymmetry and frozen review redraw waste are fixed. The original 41.5 ms frame gap is not fixed or assigned a native cause. Main-game integration remains on hold.**

Work continued with literal `claude-opus-5-5`. Only aggregate observations and API descriptions were shared; tools, source access, MCP and session persistence were disabled. Claude did not run the game. Review packets and reported model/result receipts are in `artifacts/ice-pacing/opus-*` and `artifacts/ice-pacing-v3/opus-*`.

## Changes

- Corrected GPU accounting uses the existing crowd timer, extracted with compatibility exports. Every completed query is credited once to its issuing frame/epoch. Warm-up and prior-arm results are excluded. See [GPU timing contract](gpu-timing.md). Old `gpuMs` figures remain display latches and are unsuitable for GPU distributions.
- Frozen review frames retain their pixels instead of submitting the whole comic pipeline every animation callback. Setup, snapshots, aftermath, resize and context restoration invalidate the frame. Preparation, live gameplay, hands-on control, recording and every benchmark frame always draw. Native callbacks/clock/HUD continue; no FPS cap or simulation clock change.
- A loading test exposed that shader preparation still needs drawing while compilation is pending. Preparation is explicitly admitted until complete; frozen demand resumes afterward.
- Initial owner-labelled traces found 30 first-reference uploads in measured frames 270, 304 and 450: small world meshes, `mesa-cap-7`, supporting glove/thumb geometry. Those frames were retained. They were not shader or frost-program churn, and were not the frames with the largest gaps.
- `prepareIceRendering(..., includeSceneGeometry=false)` adds an opt-in that primes ordinary scene meshes as well as effect meshes using the existing private offscreen proxies. The final harness invokes the same current preparation helper for both arms. It performs no Game steps; borrowed instance/color/morph handles remain owned by the live meshes. Existing callers keep the original default.
- Standard follow-up receipts now contain callback/renderer CPU scopes, rAF timestamps, queued-job delivery and a diagnostic 20 ms worker. Full tracing additionally intercepts GL calls and records upload owners. The legacy profiler `instrumented` boolean denotes GL interception; **both final modes are instrumented**. `delivery-only` in the lightweight receipt also includes public renderer CPU scopes.

No shader math, materials, geometry contents, sizing, secondary falloff, particle limits, motion, audio recipes, damage, statuses, collision, muzzle or equipment ownership changed. No combat-owned or production registry file was edited.

## Matched gameplay

Frozen final build: `artifacts/ice-pacing-v3/build`, review on port **5322**. Earlier `ice-pacing` and `ice-pacing-v2` builds/evidence remain intact. The current compiled shared Game/render/audio code is common to both arms; actual transformed module hashes and emitted bundle hashes are retained. Other work continued concurrently and was not stopped.

Reference is retained `f613d74` Ice. Plates, response, frost and sizing modules match byte-for-byte. The current adapter also contains a separately committed MIRV-only delivery hook, which immediately returns for these rifle/sticky paths. Both arms use identical current loading preparation. This is an effective rendering control for the tested paths, not a claim that every source file is identical or that MIRV was tested here.

Final comparisons use actual Game shots against six raised-health clothed/armored humans and a raised surface, standard firing/reload/heat/status behavior, 120 warm-up + **2,160 measured frames per arm**, fixed 1/60 simulation. All 2,280 frames draw in every arm; no frozen skips. Complete bodies, shot/hit/contact records, targets, audio requests and peak plate/flake/rime counts match. Both audio buses unlock; recording is off during timing. Resize/hidden counters are zero.

Timed render: **1440 × 900, DPR 1**. Stable browser window: **1680 × 1245**. Final proof frames and native captures use 1680 × 1245. Earlier runs had a 1440 × 900 browser window, so their absolute CPU figures are not a speedup baseline for the final runs.

Frame interval **median / p95 / max**, ms; GPU columns are unique-query medians:

| Final block | First arm | Middle arm | Repeat arm | GPU medians, ms |
| --- | --- | --- | --- | --- |
| Full GL/CPU tracing, reference/current/reference | 14.1 / 23.4 / 32.7 | 15.6 / 21.8 / 29.5 | 17.1 / 26.2 / **50.6** | 1.866 / 1.953 / 1.849 |
| Render scopes + delivery probes, current/reference/current | 16.1 / 23.8 / **45.1** | 15.8 / 20.5 / 34.8 | 13.9 / 22.9 / 33.9 | 1.991 / 2.227 / 2.024 |

GPU coverage is **99.77% in all six arms**, with five explicitly pending tail queries per arm and no middle omissions, skipped/disjoint/lost queries. Raw tail callback times are 7.0–14.6 ms; their intervals are 9.3–22.8 ms. None exceeds 25 ms in these observations. This does not establish universal missing-sample independence.

Full tracing reports **zero** source-buffer uploads, program creation/deletion, shader compile/link and shader/program info-log reads in every arm, including warm-up. Maximum callbacks are 20.4 / 19.7 / 22.1 ms in the full trace and 19.3 / 22.0 / 21.4 ms in the lightweight trace.

Earlier uninstrumented rifle/sticky/mixed ABA plus mixed BAB runs, GPU block-resampling descriptions and all outliers remain at `artifacts/ice-pacing/verification.json`, review port 5320. Their small GPU deltas did not repeat consistently on order reversal. One mixed block exceeded the proposed 0.1 ms / 5% gate; it was not discarded. Resampling under changing host load is descriptive, not formal causal confidence. The corrected data does **not** establish a clean GPU performance sign-off.

## What the gaps show

- Original prior-build interval: **41.5 ms**, Game render scope 8.2 ms, maximum callback 15.3 ms. These bounds are preserved; its exact native cause is unassigned.
- Initial new reference trace: 29.7 ms interval, preceding callback 9.3 ms, 20.4 ms between callbacks; queued job delayed 20.2 ms and worker-to-page delivery 21.9 ms. Page delivery was delayed outside Game callbacks. Heap showed no observable drop; that does not rule out GC.
- A later lightweight pre-equalization run caught a **45.9 ms callback**, simulation 1.3 ms and same-frame GPU 1.963 ms. Render subphases were not yet available for that instance. It remains an unassigned within-callback stall; it must not be labelled external or fixed by loading changes.
- Final full trace, reference-repeat frame 235: profiler interval 50.0 ms, preceding callback 11.6 ms, **38.4 ms between callbacks**. Worker messages were delivered to the page in 0 ms twice during that gap; the preceding queued job took 1 ms. Native rAF timestamp interval was 50.1 ms.
- Final lightweight trace, current frame 529: profiler interval 45.0 ms, preceding callback 11.3 ms, **33.7 ms between callbacks**. A worker message arrived in 0.2 ms inside that gap; preceding queued job took 0.4 ms. Native rAF timestamp jumped 50.6 ms.

The last two cases show responsive page delivery while the next animation callback was delayed. Installed Three's animation loop invokes the callback and then requests the next native rAF; no application FPS cap was found. These cases isolate an animation-frame delivery gap, not a particular compositor/GPU queue/OS mechanism. They do not retrospectively explain every earlier stall. Parallel CPU/GPU work is a confound, not an established cause.

The browser tool rejected internal Chrome tracing navigation. No alternative privileged browser surface or raw browser protocol was used. Application-owned public probes cannot replace the missing native scheduler/compositor trace.

## Visual, sound and correctness evidence

- **12 exact SHA256 framebuffer pairs** on the final build: clothed/armored human peak + aftermath and raised/slope/ceiling/finite-ledge onset + settled frost. Full proof objects, including effect counts and time, match.
- Eight actual gameplay screenshots plus five fresh final-build clips: clothed pilot, armored pilot, armored mech, sustained crowd + surface and raised-surface shot. Original recordings and playable MP4s are retained; both real audio buses are captured, with no replacement or normalization. Native stereo PCM is nonzero and unclipped in each channel; MP4s decode cleanly. One padding row is added for even-height MP4 encoding; native captures are unchanged.
- Frozen final check: **240 callbacks skipped redundant draws**, draw counter 3271 → 3271, Game time and instance-matrix hash unchanged. Snapshot/aftermath requests still redraw. The helper is scoped to this procedural review; generic adoption still needs callers to invalidate on any asynchronous resource completion.
- Final full suite: **1,030 passed**, typecheck passed. Added tests exercise unique GPU accounting, compatibility exports, pending/disjoint/lost/foreign queries, frozen redraw admission and opt-in ordinary-geometry preparation/ownership.

The evidence packager reads actual receipts and media, verifies full replay equality and coverage, and creates the review. It does not drive a browser or synthesize gameplay results.

## Handoff and remaining gate

Main-game integration is **not approved by this performance result**. Native callback-delivery gaps, the older unassigned within-callback stall and an adequate GPU noise calibration remain open. A quiet coordinated run and/or a native scheduler/compositor capture is the smallest useful next step; do not change art or combat to hide the intervals. Keep all current outliers. Further controlled runs should use identical preflight, raw frame/GPU receipts, randomized interleaved null controls and predeclared gates.

Production uses the common `gameElements.ts` registry with Fire/Radiation/Shock. Do not replace that factory with `IcePresentation`. After the gate closes, adapt the existing Ice response and recipe to the existing `ElementModule` contract and preserve all other registrations; the combat lead owns any `game.ts`, `world.ts` or `ui.ts` integration. The standalone Ice adapter remains usable for review.

Reproduce in a **new** evidence root, preserving delivered builds:

```sh
ICE_PACING_ROOT=artifacts/ice-pacing-next npx vite build --config vite.ice-pacing.config.ts
ICE_PACING_ROOT=artifacts/ice-pacing-next npx vite preview --config vite.ice-pacing.config.ts --host 127.0.0.1 --port 5323 --strictPort
```

Use `?profile=1` for full probes, `?endurance=1` for 2,160 measured frames, `?reverse=1` for BAB and a unique `tag`. Default follow-up uses lightweight render/delivery scopes; it is not uninstrumented. Native-HUD diagnostic switches are optional experiments and are not the default protocol or a claimed frame-gap fix.
