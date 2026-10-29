# Crowd feedback verification

The crowd comparison uses an isolated `dist-crowd` build. Existing `dist-quality` and `dist-corrosive` artifacts remain available. Concurrent weapon changes in the shared workspace are excluded: root prepares the archived combat baseline plus crowd-only changes in a separate source directory, compiles there, and copies only its `dist-crowd` output back.

The new `crowd-pressure-fixed-aim-v2` lab runs the actual `Game`, with the existing three/twelve-target capacity positions, alternating enemy roles, live AI, elemental-pressure equipment, seed 19 and current balance. Target health is explicitly raised to 100,000, as in the existing capacity fixture. Each scripted input supplies the captured initial yaw/pitch so firing recoil does not move the readability scene away. This compensates aim through the ordinary input API; actual shot recoil/muzzle poses and combat remain unchanged. Player health, damage, ammo, heat, reload, healing and defeat behavior stay ordinary. The old 2.5-second test forwarded current aim instead: its numbers must not be pooled with this longer fixture.

| Phase | Simulation frames | Work |
| --- | --- | --- |
| Warmup | 1–60 | Normal fire/heal and the first six sticky shots |
| Sustained crowd | 61–840 | All seven statuses re-proc each 60 frames; remaining sticky volleys occur at 61 and 121 |
| Decay | 841–1200 | No added procs or player fire; AI, existing statuses/projectiles and ordinary recovery continue |

The eighteen synthetic sticky shots use actual ballistics, contact, attachment and detonation. They do not consume player ammo. This is capacity evidence, not an encounter-clear or balance result.

Each profile runs fresh classic → crowd → classic pages in the same compiled build:

- Three and twelve targets at 1440×900 CSS pixels, DPR 1.
- Three and twelve targets at the same viewport, DPR 1.75.
- Twelve targets, DPR 1, browser CPU throttled 4×.

CPU throttling is a browser main-thread pressure proxy. DPR changes drawing-buffer work. Neither represents a tested physical midrange device.

The lab owns its RAF loop and uses **60 Hz target deadline pacing**, skipping early native RAF callbacks. Each admitted callback performs one fixed 1/60 simulation step and one normal `renderEvaluation` draw; there is no multi-step catch-up. After a late callback, deadline alignment can admit an adjacent draw about 8 ms later. This is not a hard inter-frame interval cap. Under overload, simulation slows. Classic CSS/timer lifetimes use wall time while crowd lifetimes use simulation time; wall/simulation ratios remain in the report. Target-paced frame medians are not throughput measurements. The frozen lab banner's word “maximum” is imprecise and should be read as the requested pacing target; the measured build remains unchanged.

The render/HUD counter receives the actual admitted RAF interval (first frame 1/60, clamped to the public API's 250 ms maximum). This delta never advances simulation or feedback lifetimes and is excluded from combat-parity signatures. Any frames exceeding the clamp are counted. Use recorded RAF intervals, admitted frames/wall time and CPU/GPU distributions as primary evidence.

Whole Game/fixture/draw CPU, full handler CPU, multipass rendering submission CPU, asynchronous GPU queries, frame intervals and long-frame tails are recorded separately. Exclusive nested timers identify status work, HUD preparation, HUD DOM writes, number input and deferred number flushing. Query results belong to their originating frame. Missing/disjoint GPU results remain missing. Read-only CDP metrics also bracket browser task, script, layout and style work. Pose-cache counters cover cached operations, including damage anchors shared by both policies; they do not count classic recursive surface operations and must not be treated as total transform-operation counts.

Every actual `Game.measure` call after setup is counted against the uncapped callback array. The diagnostic recording flag stays armed through ordinary defeat so later actual calls remain visible. The harness never manufactures events. All player trajectories, synthetic and ordinary ballistic launches, ballistic hits, applied measurements, and per-frame body/target state must match exactly across the three arms.

Visual accounting is separate: accepted events/amounts equal rendered + unpresented + intentional reset cancellation. Explicit dummy/combat resets can cancel queued visual feedback without dropping a combat measurement. Those cancelled amounts/events stay cumulative in the report. The six-second quiet tail must drain pending rows. Same-record directional edge fallback counts and maximum queue delay (simulation seconds) are retained when exposed by the UI diagnostics.

DOM accounting includes both classic labels and crowd labels. The crowd pool's initial hidden nodes count as allocated nodes, separately from visible labels. Fresh capture pages run to matched simulation frames without interrupting timed arms. Capture-only DOM measurements decode visible label text and actual rectangles, then count pairwise overlap and reticle/head-zone obstruction.

Run only after the source/build freeze and after other recording/verification browsers have closed. The compiled URL is configurable through `CROWD_FEEDBACK_URL`. Browser runtime paths use the same `PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE` environment variables as the existing verification scripts.

```sh
npx vite build --config vite.crowd.config.ts # in root's isolated frozen source copy
npx vite preview --config vite.crowd.config.ts --host 127.0.0.1 --port 5210 --strictPort
node scripts/verify-crowd-feedback.mjs
```

`CROWD_FRAMES=180 CROWD_PROFILES=ordinary-dpr1,crowded-dpr1` runs a short fixture/parity smoke into a separate smoke folder. It does not replace the full result. `CROWD_CAPTURE=0` can omit separate capture pages when diagnosing a measured arm.

The runner requires `artifacts/crowd-feedback/build-source.json` (or `CROWD_SOURCE_MANIFEST`) for measured-source provenance. Optional `CROWD_SOURCE_ROOT` adds fingerprints from that exact frozen copy. It never fingerprints mutable workspace Game/core files as the measured source.

Results go to `artifacts/crowd-feedback/final/verification.json`, with raw per-frame traces compressed per arm and a short `report.md`. Short smokes use `artifacts/crowd-feedback/smoke/`. No result is claimed until the runner completes its exact-parity checks and build-hash check.

## Completed results — 2026-10-29

All five profiles and fifteen measured arms completed. Each arm contains 1,200 simulation frames, including 780 sustained active frames after warmup. Eight separate captures cover three/twelve targets and active/decayed feedback. Ten additional screenshots verify ordinary game controls, rather than relying only on the lab.

| Scene | Whole Game + draw CPU p95, ms: before / after / repeat | Active frame intervals >33.3 ms: before / after / repeat |
| --- | --- | --- |
| 3 targets, DPR 1 | 7.4 / 8.1 / 8.1 | 0 / 0 / 0 |
| 12 targets, DPR 1 | 15.6 / 14.4 / 15.2 | 6 / 0 / 7 |
| 3 targets, DPR 1.75 | 11.1 / 7.7 / 10.2 | 0 / 0 / 0 |
| 12 targets, DPR 1.75 | 15.8 / 15.1 / 19.6 | 6 / 2 / 15 |
| 12 targets, CPU 4× proxy | 87.1 / 75.9 / 66.1 | 780 / 780 / 778 |

The standard twelve-target scene has 5–8% lower CPU p95, with CPU p99 changing from 28.3–28.6 to 25.9 ms. Active frame intervals exceeding 25 ms fall from 64–71 to 8. Browser style work over the measured interval falls from 758–763 to 290 ms, and layout work from 265–269 to 173 ms. GPU p95 stays approximately 4.5–4.6 ms: this is a CPU/DOM improvement, not reduced rendering quality.

Ordinary DPR 1 does not establish a speedup; its new p95 lies inside the repeated baseline bracket. The CPU-throttled baseline drifts substantially from 87.1 to 66.1 ms, with the new result inside that bracket. No proxy or aggregate speedup claim is justified. The crowded DPR 1.75 repeat also drifts; all three observations remain visible. No physical second-device or midrange-GPU measurement is claimed.

### Readability and accounting

At ten simulation seconds in the twelve-target scene:

- Visible labels: **152 → 17**.
- Label overlap pairs: **573 → 0**.
- Actual head/critical-zone intersections: **51 → 0**.
- Reticle intersections: **10 → 0**; no active HUD/toast intersections after.

At three seconds, twelve-target visible labels fall from 117 to the fixed maximum of 40 and overlaps from 298 to zero. At ten seconds, the three-target scene falls from 27 labels to 6 and 133 overlaps to zero. By twenty seconds, both policies have no visible labels; the new policy retains its same forty hidden pooled nodes and has no pending feedback.

Every accepted damage amount and event reconciles as rendered + pending + explicitly reset-cancelled. All capacity queues drain, with zero reset cancellations in those runs. Directional edge placements are cumulative placements of the same accounting record, not unique hits or discarded amounts. The raw receipt retains queue delays and edge-placement counts rather than claiming every tick is displayed immediately.

Each three-target arm records 1,813 combat measurement calls; each twelve-target arm records 3,135. There are zero dropped callbacks. Player shot trajectories, eighteen extra real-ballistic sticky launches, projectile contacts, every measurement and each frame's player/target/status/camera state match exactly across classic/new/repeated arms. For each target count, combat hashes also match across DPR and CPU profiles. No effect meshes, materials, enemy counts, particles or combat work were removed to obtain the result.

### Normal game verification

`main-verification.json` records trusted Enter, workbench, equipment selection, mouse fire, aim, pause/resume and reload through the normal `/` entry point. A visible red critical response was captured. Fire/shock periodic damage forms compact totals, while exact raw values remain available in feedback data. Thirty-two observed events reconcile to 349.99685 raw damage and the dummy's rounded 350.00 display; eleven periodic events merge into existing status rows.

Pause hides and freezes feedback; resume and manual reload work. Reopening the workbench and choosing Equip & Test clears old feedback and resets the dummy. Fresh events use increasing IDs and do not merge into the previous test. The same forty DOM nodes survive throughout. This intentional reset cancellation is reported separately from combat measurements.

### Implementation and integration

The default `GameOptions.feedbackQuality` is `crowd`; `classic` retains the original behavior for same-build comparisons. `Game.feedbackDiagnostics` exposes cumulative presentation accounting. `GameUI.hit` accepts target, simulation time and direct/status context; only recurring status damage is marked as status. New damage modules own aggregation, pooled labels, safe placement and real model head anchors. No per-hit timers or forced DOM geometry reads are used. Same-tick salvos group only compatible hits; criticals and consecutive-tick direct hits remain separate.

Surface-pose caching shares presentation-owned world/inverse/normal matrices across status effects, detects local and parent movement/reparenting, and leaves authoritative scene matrices and dirty flags untouched. Temporary accent vectors are reused. HUD preparation reuses the already selected station. Combat calculations, collision, slots, muzzles, projectiles and effect counts remain unchanged. Existing renderers and the classic comparison remain usable.

The frozen measured source passed **536 tests**, TypeScript checking and its production build. Focused tests cover exact accounting, bounded overflow, resets, priority/starvation, safe placement, actual head anchors, matrix-cache invalidation and classic/cached accent equivalence. Source and bundle receipts are stored beside the raw results. A later read-only check of the shared workspace passed 28 focused crowd-feedback tests and TypeScript; that integration check does not extend the frozen performance measurements to concurrent features.

### Provenance and concurrent work

The measured source aggregate is `1c3e16946dfc9f5d535c6731ea849f949659b9cec8c5472a043e9be9fa37fe8c`; the shared compiled Game bundle is `game-CUE6pVXs.js`. Classic and new behavior are selected within that exact build, rather than comparing unrelated revisions. `before-source.tar.gz` preserves the starting runtime; `build-source.json` identifies every measured source byte. Frozen source and compiled-build archives accompany the review package.

The shared workspace continued to receive separate user requests during verification: removal of elemental-word prefixes, cluster weapons and ledge climbing. Those changes are preserved. In particular, the captured labels still show words such as STATUS; the current damage display uses color-only elemental cues as separately requested. These later changes are excluded from the measured source and timings, and this report does not certify their gameplay. Rebuilding the entire mutable workspace would invalidate the matched-build receipt.

Open the [screenshot gallery](../artifacts/crowd-feedback/gallery.html), [short measurements](../artifacts/crowd-feedback/final/report.md), [full measurements](../artifacts/crowd-feedback/final/verification.json) and [normal-game receipt](../artifacts/crowd-feedback/main-verification.json). The locally served review build is `http://127.0.0.1:5210/`; its gallery is `/artifacts/crowd-feedback/gallery.html`.
