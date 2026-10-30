# Gravity: stronger core and pressure folds

30 October 2026. Art-only follow-up to the [Opus 5.5 review](gravity-opus-review.md). This changes the controlled actual-Game prototype, with the existing [combat integration handoff](gravity-integration.md) still applicable. Normal-main integration remains with the combat lead.

Historical receipt: the user subsequently rejected the anchored pulsing fold and instant surface offset. The [smooth-deployment correction](gravity-deployment.md) supersedes that behavior; this pass's measurements, recordings and build remain frozen.

## What changed

- The core uses a much darker interior and restrained rim. Its visible radius stays inside the existing collision-validated `.32 × delivery scale` envelope. It contracts on crush pulses and keeps ordinary depth testing.
- One asymmetric, undulating pressure fold anchors the source. Two broader travelling sheets and five fine traces move through different parts of the field. Dark violet interiors, a narrow lit edge, torn widths and staggered travel replace the pale detached-shard read. There are no new orbit tori, matching radial spokes or closed waist rings.
- Cached curved paths separate spatial shape from bounded accelerating travel. Loop windows fade before restarting. Camera-facing width prevents an arbitrary ribbon roll from making the sheet disappear; view-parallel segments fade without nonfinite geometry.
- Cosmetic profiles vary curves, width, timing, reach and handedness once per source using the shared `EffectVariationSequence`. A fixed review seed supports comparison; the seed never enters combat simulation.
- Short body-edge wakes use copied member positions. Broader sheets fade near held bodies to keep aim points readable. These are presentation cues, not replacement collision bodies or body deformation.
- Grit follows the same cached paths within the existing 144-instance / three-well cap. Release collapses the core and leaves a short cosmetic tail, respecting the known contact plane.

The original thin-strand renderer is retained as a development-only comparison adapter in `src/dev/effects/gravity/reference.ts`. It is selected instead of the pressure response, never layered on top of it. Existing standalone element renderers remain usable.

## Behavior and sound isolation

Gravity source placement, pull, capture slots, hold, damage, cadence, release, fall and collision are unchanged. The baseline hashes cover `game.ts`, `world.ts`, `ui.ts`, `PlayerBallistics.ts`, the gravity core modules, shared body collision and `gravityAudio.ts`. The pressure pass retains the exact gravity sound recipe and audio buses, allowing an isolated visual comparison with native sound.

Automated checks cover finite accelerating timing, cached support-plane paths, shape variation beyond rotation, stable seeds, immutable gameplay snapshots, view-parallel geometry, one geometry write per snapshot, resource cleanup and identical field-audio cues from the two renderers. Gameplay receipts compare complete normalized combat and cue histories across visual modes and across two cosmetic seeds.

## Review entry and evidence

```sh
npx vite build --config vite.gravity-pressure.config.ts
npx vite preview --config vite.gravity-pressure.config.ts --port 5237 --strictPort
```

Open `/gravity-lab.html`. The comparison is **previous thin strands / pressure folds / previous thin strands repeated**, with the same Game, gravity simulation, recipes, six targets and actual sustained trigger/reloads. Sound is on, recording is off, and each run has 120 warm-up plus 720 measured frames at a fixed 1/60 simulation step per rendered frame. Both variants are compiled into the same build. Display-paced frame intervals are not GPU-headroom measurements; use submit CPU, GPU and p95 data as well.

Native recordings are separate from timing runs and capture the actual WebGL canvas plus the existing physical/elemental output buses. Recordings stop after ten wall-clock seconds. Frozen high/side views are review-only camera orbits applied after simulation; native recordings and matched measurements use the front gameplay view. Cinematic poses, new force, x-ray rendering, refraction and additional damage are outside this pass.

Each recording owns its chunk buffer and locks the fixture controls until export finishes. Its payload is published atomically with scene, renderer, probe, build-script identity, contact normals, frame/simulation timestamps and SHA-256. Packaging rejects mismatched scene/style/hash/normal metadata. Hold-frame comparisons are selected at approximately the same authoritative well age with the same weapon; the native videos are not retimed. This follows Claude catching a mislabeled draft wall clip, which was rejected and regenerated.

New evidence belongs under ignored `artifacts/gravity-pressure/`; the earlier `artifacts/gravity-prototype/` receipts and compiled build are preserved. Package with `node scripts/package-gravity-review.mjs --dir artifacts/gravity-pressure`; the original default directory remains compatible. Build/source hashes and raw proof/timing JSON accompany the gallery.

## Claude collaboration

Read-only Claude Opus 5.5 checks are stored in `artifacts/gravity-pressure/claude/`:

1. Concrete design check: contraction bounds, camera-facing degeneracy, loop fades, cue parity and source-budget cleanup.
2. First gameplay pictures: identified pale shards and detached scratches; this prompted darker interiors, longer curved windows and a source-anchored fold.
3. Screenshot/frame and source review: caught a wall recording that actually showed the floor. That draft packet was rejected; recording ownership, locks and atomic manifests were strengthened before all four clips were regenerated.
4. Corrected evidence recheck: confirmed the wall/floor hold pairing and called out the floor's remaining plume-like read and actor occlusion. It also noted that a later native frame showed the intentional kinetic follow-up, so the gallery uses matched launcher-phase hold frames for still comparisons.

All four receipts report `claude-opus-5-5`, success and Read-only tool calls (`claude/audit.json`). These critiques used source and still frames, not continuous-video playback or sound listening. After that recheck, the anchored fold's travelling crease was corrected to propagate inward; its direction has a regression test and all final recordings, surface receipts and measurements were regenerated on that final build. No claim of Claude approving that later motion or of user visual signoff is made.

## Measured results

Same frozen compiled build for before/current/before-repeat; Apple M5 Max through ANGLE Metal, 1280×720, DPR 1. Six targets, three active wells, 144 grit instances; actual firing/reloads, sound on, recording off. Each row contains 720 measured frames after 120 warm-up frames. Values are median / p95 milliseconds.

| Scene | Renderer | Frame interval | Simulation CPU | Render submit CPU | Full render GPU |
|---|---|---|---|---|---|
| Wall | Before | 14.40 / 16.10 | 1.60 / 2.20 | 3.70 / 4.00 | 1.75 / 4.09 |
| Wall | Pressure | 14.20 / 15.90 | 1.50 / 2.00 | 3.70 / 4.10 | 1.77 / 4.27 |
| Wall | Before repeat | 11.70 / 14.50 | 1.50 / 2.00 | 3.60 / 4.20 | 1.15 / 2.36 |
| Floor | Before | 11.10 / 12.70 | 1.40 / 1.90 | 3.50 / 3.90 | 1.17 / 2.39 |
| Floor | Pressure | 11.00 / 12.60 | 1.40 / 1.90 | 3.60 / 4.00 | 1.20 / 2.32 |
| Floor | Before repeat | 12.70 / 16.00 | 1.50 / 2.00 | 3.70 / 4.10 | 1.23 / 2.49 |

Initial-pair GPU median changes are about +0.02 ms in each scene, with repeat-baseline drift much larger on wall. Display pacing and machine contention vary, including isolated long CPU frames; raw min/max, draw counts and timings remain in `performance-wall.json` and `performance-floor.json`. These runs do not establish a speedup or a device-wide FPS guarantee. Full normalized combat **and sound-cue histories** match within both trios and across cosmetic seed A/B.

- Gameplay: six held on wall, floor, underside, raised and slope fixtures; cover excludes three; a late entrant joins five held actors; rocket holds six and the smaller orb holds two. Pausing freezes state; release returns targets to support. A kinetic rifle hit reduces the suspended armored target's health by 29.64 through the preserved combat proxy.
- Sound: four native-speed wall/floor before/after clips include the existing game buses. After clips decode to 48 kHz audio, nonzero RMS, peaks .558/.574 below clipping. Browser playback is verified unmuted. This proves captured playback, not subjective sound-quality approval.
- Validation: 826/826 full tests; 31/31 focused gravity and main-presentation tests; exact pre-change ballistics replay passes all 13 delivery families. Frozen pressure build and evidence packaging pass; browser errors are empty.
- Latest whole-workspace `npm run build` is currently blocked by concurrent untracked `src/dev/iceFrameProfiler.ts:33` (TS18046, unknown `a`). That file drifted after the frozen review build and is outside this change. The compiled pressure build, all nine protected behavior/audio hashes and its recording manifests remain verified. See `main-build.log` for the live-check failure and `build.log` for the successful frozen Vite build.

## Limits and next gate

The floor core can still be hidden by captured actors under real depth; source-adjacent pressure cues communicate its location. Stacked health bars and the procedural viewmodel can compete with the effect. Those are explicit UI/fixture handoffs, not reasons to alter bodies or combat from a renderer. Sloped-cover collision remains the existing conservative AABB prototype adapter. Captures use stationary high-health humans, not a normal AI encounter signoff.

Visual approval belongs to the user. Judge the native motion and sound, including repeated shots, held armor aimability, floor/wall/underside, late entrants, release and several overlapping wells. Main-entry integration and normal AI encounter verification remain with the combat lead.
