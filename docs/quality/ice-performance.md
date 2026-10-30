# Ice performance remediation

Follow-up: [corrected GPU accounting, equalized scene preparation and parallel-workload pacing evidence](ice-pacing.md). The original GPU distributions below used latched display results; use the follow-up's unique-query receipts for GPU comparisons. Earlier evidence remains preserved.

**Confirmed Ice shader-lifetime stall fixed. Whole-app pacing is NOT signed off; main-game integration remains on hold.**

Approved scope: keep the accepted `159854d` layered plates/frost, sizing, secondary falloff, particle counts, sound and combat unchanged; work with Opus 5.5. Starting checkpoint: `efd29cf`. No normal-game wiring is included.

## Cause and implementation

The trace exposed destruction of the last frost GPU program at **frame 433**, then recreation on a later cloth hit at **frame 493**. Two diagnostic baseline callbacks stalled for **58.0 / 59.5 ms**. Info-log and shader-log reads accounted for roughly 44 ms of the pause; cheap compile/link invocation timing had hidden the driver wait.

`IceResponse` now owns one `IceRimeMaterials` instance for its complete lifetime. Each source retains its four contact slots, normals, radii, ages, metric, surface kind and intensity. `onBeforeRender` binds that source's data only for the actual frost material. Status expiry/root removal release overlays without releasing the shared program; presentation disposal releases it once.

`IcePresentation.prepare(renderer, scene, drawScene)` asynchronously prepares shaders, draws private exact-state FX proxies, then warms the real comic pipeline. It warms the **live** particle buffers without writing them. Cleanup detaches borrowed instance/color/morph handles before proxy disposal; it never disposes source geometry or materials. This removed four remaining first-use buffer allocations.

No shading math, opacity, blending, geometry, trajectories, sizes, delays, lifetimes, counts, damage, muzzle, collision, statuses or audio recipes changed. Installed Three r180 `ShaderMaterial` defaults to `forceSinglePass=true`; accepted and candidate materials retain that default and `DoubleSide`. No pass-count optimization was made.

## Same-build gameplay evidence

Frozen build: `artifacts/ice-performance/build/`. Both arms render the **accepted layered look**: five Ice modules frozen from `159854d` versus optimized Ice, with the same compiled shared Game/render/collision/audio code. This does not compare against the older cyan material. Source fingerprints: `build/provenance.json`; emitted JavaScript hashes: `verification.json`.

Actual Game, six raised-health clothed/armored fixtures, standard firing/reload/heat/status behavior, fixed 1/60 simulation step, 1440 × 900 render size, DPR 1. Both audio buses unlock. Recording and phase probes are off for timing. Every block is **before / optimized / before repeat**, with unchanged 120-frame warm-up and 720 measured frames. Resize/hidden-page counters are zero. The longer block has 2,160 measured frames after warm-up: 38 simulated seconds, with wall duration reported separately.

Frame interval **median / p95 / max**, milliseconds:

| Final block | Before | Optimized | Before repeat |
| --- | --- | --- | --- |
| Rifle | 8.3 / 9.4 / 12.9 | 8.3 / 9.5 / **28.3** | 8.3 / 9.8 / 12.8 |
| Sticky | 8.3 / 9.2 / 14.9 | 8.3 / 9.2 / 15.1 | 8.3 / 9.3 / 14.5 |
| Humans + raised surface | 8.3 / 9.2 / 15.0 | 8.3 / 9.4 / 14.8 | 8.3 / 9.2 / 14.2 |
| Mixed repeat 2 | 8.3 / 9.3 / 14.5 | 8.3 / 9.2 / 14.3 | 8.3 / 9.3 / 14.3 |
| Mixed repeat 3 | 8.3 / 9.2 / 14.6 | 8.3 / 9.3 / 14.7 | 8.3 / 9.3 / 13.6 |
| Mixed extended | 8.3 / 9.2 / 14.7 | 8.3 / 9.2 / **22.5** | 8.3 / 9.7 / 16.1 |

Explicit preparation took about **46–59 ms** in these blocks; the earlier instrumented initial-fix run took 146 ms. This is loading work before control, not an increased measurement warm-up or changed clock. Separate diagnostic traces include the first 120 frames.

The steady median is essentially unchanged. This patch cannot claim credit for the median improvement over the historical plate-pass build: shared code and host conditions changed. A sticky GPU median of 1.96 ms versus approximately 1.60 ms in its baseline arms, and an optimized maximum of 5.42 ms, remain in the record. No blanket GPU improvement is claimed.

All three final diagnostic candidate sequences include 840 frames and show:

- Zero program creation/deletion/compilation/linking or first-use info/shader-log calls after preparation.
- Zero first-use source attribute storage uploads (`bufferData`); animated `bufferSubData` updates continue.
- Equal rendered shader-source fingerprint sets, normalizing only the debug shader-name macro.
- Equal renderer configuration and Game time across preparation, with no GL error.

Complete shots, hits, contacts, target health/shields/statuses, ammunition/heat/reload state and **physical plus elemental audio request logs** match in every retained comparison. Plate/flake/frost-target peaks match. Rifle reaches three targets in this cadence; sticky/mixed reach all six. The package script independently recomputes parity.

## Visual and sound proof

Twelve zero-tolerance pairs of complete gameplay RGBA framebuffers have identical SHA-256 hashes: clothed and armored humans at release/aftermath (four pairs), and raised floor, slope, ceiling/underside and finite ledge at onset/settled aftermath (eight pairs).

Nine native recordings capture the game's final physical and elemental buses: before/after humans, sustained mixed fire and extra pilot/mech rifle/sticky scenes. No replacement sound or normalization. PCM is non-silent with zero clipped samples. Original WebMs are retained; MP4 previews use codec conversion and optional one-pixel padding. Original WebM decoding emitted nonfatal initial Opus header warnings, retained in logs; decoded audio duration differs from video by 24–60 ms. Preview playback is checked separately.

Review: `http://127.0.0.1:5300/review/`. Playable prototype: `http://127.0.0.1:5300/ice-performance-lab.html?profile=0`. Assets, raw receipts and manifest: `artifacts/ice-performance/`.

Validation: **878 full-suite tests passed** at the final check; **25 targeted Ice tests passed**, including alternating-source/override isolation, expiry/clear/disposal and success/failure cleanup of borrowed instance/color/morph resources. Typecheck and prototype/main-entry compatibility builds also pass. Opus reviewed the earlier 826-test result; later concurrent project additions account for the larger final suite.

## Remaining pacing gate

**The full-app zero-over-25-ms gate fails.** The valid 28.3 ms rifle outlier is retained. Later sessions also show wider drift in both arms: rifle candidate up to 41.1 ms; sticky baselines 78.2 / 79.6 ms and candidate 40.3 ms. Those blocks remain separate from the earlier baseline.

An additional diagnostic reproduced a **41.5 ms callback-start interval at frame 430**, while that complete `Game.renderFrame` callback took **8.2 ms**. All 840 optimized callbacks stayed below **15.3 ms**, p95 13.3 ms. On frame 430, Ice update/impact work was zero, overlay time was 1.1 ms, and shader/source-buffer setup counters stayed zero. At least **26.2 ms** of the interval is outside the instrumented callback. `QualityPerformance` reported a 41.8 ms interval maximum at its slightly different sampling boundary.

Read-only inspection confirms manual evaluation skips `Game.run`'s outer simulation branch; only clock sampling precedes `renderFrame`. Actual evaluation simulation runs inside the measured wrapper. This localizes the gap but **does not identify its cause**. Browser layout/paint, GC, other work and scheduling remain possible. Host one-minute load was about 19.7–20.2 on 18 CPUs: a confound, not proof. Only one agent-owned Ice tab was running.

Next: a browser-level trace of tasks, GC, style/layout/paint and compositor/frame scheduling over rifle/mixed sequences under quiet and observed load. Native Chrome UI acquisition timed out on three attempts; **no browser-level trace was obtained**. No unsupported browser-internal or remote-debugging workaround was used.

Opus considers a separate VFX patch handoff reasonable, with overall pacing signoff conditional. **Do not claim all spikes eliminated or integrate into the normal game until the residual gap is attributed or ruled out.** Fresh GPU disk-cache/profile behavior, context restoration, changed quality settings and other hardware remain unvalidated.

## Combat-lead integration interface

This task did not edit `src/game.ts`, `src/world.ts` or `src/ui.ts`. Concurrent changes from their owners remain separate. Existing entry points/renderer selection remain available; the normal entry compiles to an isolated compatibility output.

Use `GamePresentation.setElementalFactory` during loading:

```ts
let ice: IcePresentation;
presentation.setElementalFactory((scene, camera) =>
  (ice = new IcePresentation(scene, camera, { plateStyle: 'layered' })));
// Bind the scene, equipment and target archetypes before combat.
await ice.prepare(renderer, scene, () => comicRenderer.render());
```

Hold input/simulation while preparing. Await completion before disposing the presentation or changing render configuration. Preparation does not advance Game time or invent hits/statuses. Root/status cleanup must not dispose the response-owned material. New geometry/target variants and renderer configurations require their own preparation/zero-creation checks; context restore/settings transitions need follow-up coverage.

After the pacing gate clears, wire the factory/loading hook into the normal entry and repeat gameplay checks there. Preserve slots, muzzle transforms, projectile routing and authoritative combat.

## Reproduce and inspect

```sh
npx vite build --config vite.ice-performance.config.ts
npx vite preview --config vite.ice-performance.config.ts --host 127.0.0.1 --port 5300 --strictPort
node scripts/package-ice-performance-review.mjs
```

`?profile=1` enables separate diagnostics; `?profile=0&endurance=1` enables the longer matched block. Keep recording separate. Per-arm automatic local exports and full combined receipts survive tab cleanup.

The early audio-mismatched rifle block is excluded under `excluded-dry-cooldown/`: the fixture carried `lastDryClickAt` between resets. The harness now resets it to fresh-Game state in every arm. No combat file, clock or audio recipe changed. Intermediate diagnostics and the pre-live-buffer build are retained in named artifact directories.

Full manifest: `artifacts/ice-performance/verification.json`. Reviewer limits: [ice-performance-opus-review.md](ice-performance-opus-review.md).
