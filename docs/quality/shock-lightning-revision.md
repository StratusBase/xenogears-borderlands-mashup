# Shock lightning revision

30 October 2026. The first A+B implementation (`b2dd1ec`) was rejected as too primitive compared with the concept boards. The earlier implementation and frozen evidence remain available; passing its tests/performance was not visual acceptance.

## Visual changes

- Camera-facing filaments replace the first prototype's three layers of cylindrical rods. One instanced, depth-tested batch shades a pale narrow core, blue ion envelope and soft local corona. Rounded segment joins and tapered widths avoid faceted tubing. No fullscreen bloom or extra renderer is used.
- Deterministic multiscale displacement makes unequal macro bends and finer kinks. Fine forks begin on their parent leader, with fast growth, discrete restrikes and decay. The primary leader has stronger width than its subordinate branches.
- Primary visual reach increases 1.48× for ordinary hits and 1.30× for heavy hits. Primary material coverage increases up to 1.6×, capped to 55% of the visible target span. This is presentation coverage, not collision, blast radius or damaging field size.
- Secondary splash/chain size records are exactly unchanged across energy/exposure samples. They keep thin, short, quiet feedback and never get the heavy primary discharge.
- Material charge uses branching conductors, fine attached forks, moving highlights and local glow. It stays on borrowed visible geometry and follows the existing target-local anchors. The original shader remains selectable for honest same-build comparisons.
- Heavy C uses a larger branching discharge and local flash instead of broad opaque ribbons. Existing explosive detonation gating is unchanged; no C on sticky contact or ordinary rifle/beam/scatter/slug/arc hits.
- The existing sound recipes are retained. Actual final physical/elemental buses are captured in the review clips. Rifle is an 8-second excerpt of the complete original WebM; heavy is 10.01 s and surface is 4.50 s. Decoded MP4 peaks are 0.5826 / 0.5623 / 0.0858, with zero clipped PCM samples. No normalization, replacement or retiming.

`ShockPresentation(scene,camera,'lightning')` is the revised default for the opt-in Shock adapter. `'prototype'` retains the first A+B profile. Both share the response lifecycle, pools, event routing, audio engine and sizing authority. `ElementalPresentation` and normal-game activation are unchanged. Shared surface selection/frame helpers now use their neutral paths; no new cross-element implementation dependency is introduced.

## Review and evidence

- [Moving gameplay with sound and matched comparisons](http://127.0.0.1:5225/review/).
- [Playable revised prototype](http://127.0.0.1:5225/shock-lab.html).
- Raw measurements, captured gameplay, source hashes and compiled review under `artifacts/shock-lightning/`; earlier `artifacts/shock-ab/` remains frozen.
- Cloth, outer armor and exposed skin; seven real deliveries; raised platform, wall, slope, underside and finite edge. Screenshots stop actual Game simulation +100 ms after impact/detonation; charge screenshots use +700/+900 ms. Native clips run on wall-clock timing.
- Five surface checks have minimum centerline clearance 0.1622 m above the actual hit plane, with material charge confined to borrowed finite geometry. The clearance audit inspects actual filament endpoints, excluding the camera-facing halo quad, whose orientation is resolved in the shader.
- 762 repository tests pass, including 19 Shock checks. All 13 ballistic delivery families retain exact pre-change compatibility. The Shock/main entry and dependencies pass scoped TypeScript checking; review build passes. The whole-workspace build initially failed in concurrently edited `src/dev/effects/radiation/lab.ts` (`ice` property references); that unrelated work was not edited. Its owner resolved those errors, and the final full workspace production build passes. The measured review build remains frozen.
- Protected game/world/UI, ballistics, arsenal/status logic, Shock sizing and Shock audio hashes match the start of this revision.

## Matched timings

First A+B / revised / repeated first A+B, milliseconds. Same compiled Game/build/scene/seed/inputs/weapon settings, six stationary raised-health human fixtures; 120 warm-up +720 measured displayed frames per run; existing 1/60 simulation step each displayed frame. Both audio buses on; recording off. Apple M5 Max, in-app Chromium 156, 1440×900, DPR1.

| Scene | Frame median | Frame p95 | Simulation CPU median | Draw CPU median | GPU median |
|---|---:|---:|---:|---:|---:|
| Rifle crowd | 8.30 / 8.30 / 8.40 | 10.00 / 9.90 / 11.20 | 1.50 / 1.40 / 1.50 | 4.10 / 3.50 / 4.50 | 2.69 / 2.38 / 2.10 |
| Heavy crowd | 8.20 / 8.30 / 8.30 | 9.50 / 9.30 / 9.40 | 1.50 / 1.40 / 1.40 | 4.60 / 3.80 / 4.00 | 2.24 / 2.41 / 1.78 |
| Crowd + raised surface | 8.30 / 8.30 / 8.30 | 9.50 / 9.50 / 9.40 | 1.20 / 1.20 / 1.30 | 3.20 / 3.10 / 4.00 | 1.83 / 2.13 / 2.22 |

All nine runs produce identical complete combat/chain/damage/status/ammo/reload/timing/contact snapshots. Peak revised use: 10/12 bolt slots, 408/1600 segments, six statuses, one world owner. More branches use one filament draw instead of three tube draws, but expanded material masks add GPU work: heavy GPU median is 0.17 ms above the first baseline. Baseline drift, concurrent browser load and display pacing prevent universal speed/improvement claims. This is not a full AI encounter, high-DPI, lower-end or mobile measurement.

## Claude collaboration

The user requested Claude Opus 5.5 for an independent critique. A read-only brief with the concept boards, actual first-prototype captures and relevant code is saved under `artifacts/shock-lightning/opus-review-prompt.txt`. The local CLI returned “Not logged in” before reaching any model; its receipt is preserved. The user opted to authenticate locally while this revision continued. No Opus critique or contribution is claimed until an authenticated call succeeds and its exact model is confirmed.

## Integration boundary

The combat-owner handoff in [shock-prototype.md](shock-prototype.md) still applies. This is a revised playable review, awaiting visual acceptance; it is not a claim that the new style is active in normal Enhanced gameplay. No edits to `src/game.ts`, `src/world.ts` or `src/ui.ts`, and no push/deployment.
