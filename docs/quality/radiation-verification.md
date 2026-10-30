# Radiation finish verification

**Subsequent production adoption:** Radiation and its confirmed death pulse are now integrated; see [normal-game integration verification](radiation-main-verification.md). The report below preserves the earlier visual-pass evidence and its then-open integration boundary.

30 October 2026. Actual Game validation of the finished radiation visual/audio revision. [Opus's final review](radiation-opus-review.md) passes the current visual pass. Main-game adoption remains the documented [integration handoff](radiation-integration.md).

## Matched performance

Both the frozen prior A+B smoke pass and finished effect run in **one compiled build**, on the same actual Game, scene, seeded shots, weapons, targets and sounds. Baseline element snapshots live in `src/dev/effects/radiation/before/` and import the same shared services; only import relocation and injectable cosmetic-seed plumbing were added. They are comparison fixtures, not another production engine. Original hashes are in `artifacts/radiation-finish/baseline-fingerprints.json` and all compiled sources are fingerprinted in `build/provenance.json`.

Apple M5 Max / ANGLE Metal, **1288 × 1314, DPR 1**, 120 warm-up plus 720 measured display frames per run, fixed 1/60 simulation steps, six clothed/armored targets, standard cadence/reloads, sound unlocked/on, recording off. Each scenario runs before → current → before-repeat. Every measured frame's canvas size/DPR was checked; each run reports the same single viewport. Cosmetic seed 37391 is injected identically; production defaults retain independent cosmetic entropy.

Frame time in ms, **median / p95**, lower is better:

| Scene | Prior A+B | Finished | Prior repeat | Targets hit / combat |
|---|---|---|---|---|
| crowd-rifle | 14.5 / 17.3 | 16.6 / 19.4 | 19.1 / 22.4 | 3 / identical |
| crowd-sticky | 14.0 / 15.8 | 14.0 / 15.8 | 13.8 / 16.0 | 6 / identical |
| crowd-rocket | 13.8 / 17.1 | 14.0 / 17.7 | 14.6 / 20.1 | 6 / identical |
| crowd-and-surfaces | 12.8 / 14.4 | 14.3 / 16.4 | 15.4 / 19.6 | 6 / identical |

Sticky median and p95 were unchanged at 14.0 / 15.8 ms. Rocket median was 14.0 ms versus 13.8 and 14.6 ms baselines. Rifle and mixed-surface runs showed baseline drift, with current times between the two baselines; do not claim a speedup or a precisely isolated frame penalty from them. This is a shared development machine, not controlled hardware certification.

All four scenarios produced exact matching combat traces: ammo/reserve/heat, shot and hit logs, target health/shields/statuses and raw contact events. Presentation-only rocket dedup does not remove the authoritative contact from those logs.

CPU/GPU costs in ms, **median / p95**:

| Scene / run | Simulation update | Render submission | GPU query | Median draws |
|---|---|---|---|---|
| crowd-rifle / before | 1.70 / 3.20 | 4.80 / 7.00 | 1.93 / 2.88 | 1886 |
| crowd-rifle / current | 1.40 / 3.00 | 6.30 / 8.80 | 1.99 / 3.38 | 1890 |
| crowd-rifle / before-repeat | 1.50 / 3.10 | 6.40 / 9.10 | 2.06 / 3.45 | 1886 |
| crowd-sticky / before | 1.40 / 1.80 | 4.60 / 7.30 | 1.92 / 2.79 | 1891 |
| crowd-sticky / current | 1.30 / 1.80 | 5.20 / 7.30 | 1.92 / 2.86 | 1897 |
| crowd-sticky / before-repeat | 1.30 / 1.80 | 4.80 / 7.40 | 1.86 / 2.73 | 1891 |
| crowd-rocket / before | 1.40 / 3.50 | 4.80 / 7.10 | 2.07 / 2.62 | 1915 |
| crowd-rocket / current | 1.40 / 3.30 | 5.10 / 7.40 | 2.11 / 2.82 | 1919 |
| crowd-rocket / before-repeat | 1.70 / 5.20 | 6.40 / 8.60 | 2.07 / 2.68 | 1915 |
| crowd-and-surfaces / before | 1.30 / 1.60 | 3.70 / 5.50 | 2.18 / 2.64 | 1872 |
| crowd-and-surfaces / current | 1.40 / 2.00 | 4.40 / 6.70 | 2.10 / 2.87 | 1880 |
| crowd-and-surfaces / before-repeat | 1.70 / 2.30 | 6.00 / 7.70 | 2.19 / 3.01 | 1872 |

Raw traces, resource/voice peaks, geometry counts, viewport sets and protocol metadata are under `artifacts/radiation-finish/perf-*.json`; `performance-summary.json` contains all four scenarios.

## Actual gameplay and sound

- Actual clothed and armored human shots captured at 33 / 183 / 317 / 1100 ms after real sticky detonation. Same simple models, unchanged faces/clothes/armor; reticle hidden only with an explicit review checkbox. Frames use reproducible shot variation, not paintovers.
- The final rocket capture/audit shows exactly one primary detonation with three lobes, and a smaller secondary recipient with no full bloom.
- Floor, wall, raised top, slope, underside and finite ledge tested through real projectile collision/fuse/detonation at +100 ms and +900 ms. Core stars sit in the real tangent; residue uses the real support and particles do not snap to an invented floor. This does not certify every grazing angle.
- Controlled moving-target fixture, mixed corrosive/radiation, and mech firing captured separately. Moving-fixture translation is an inspection aid, not a new enemy AI behavior. All 13 deliveries have exact ballistic/status replay coverage; major delivery variants also have gameplay captures.
- Final clothed-human and armored-rocket clips contain the **actual physical and elemental audio buses** at native simulation timing. Final WebM extracts are stream copies, with no replacement soundtrack, normalization or retiming. They were recorded after timing capture, from the final measured build. Media metadata and signal-level receipts are preserved; signal presence is not a subjective listening verdict.
- No browser/shader errors were logged in these sessions. See `final-*.jpg`, `final-*-gameplay-sound.webm` and raw coverage audits.

## Checks and limits

Full final suite: **826 passed, 0 failed**. TypeScript and the isolated Vite build (including the normal index entry) pass. The existing large-bundle advisory remains. Tests cover complete trajectories/hits/statuses across all 13 deliveries, slot isolation, borrowed resources, moving/nonuniform poses, contact tangent clearance, lifetime/pause/budgets, secondary hierarchy/audio limits, rocket dedup, coalesced contacts, real rib-to-plate coverage and a later material hit after the binding budget is full.

Pools remain bounded at 96 rays, 48 cloud lobes, 256 flakes, 96 stars and 32 residue roots, with at most four borrowed surface bindings per root. Original `src/game.ts`, `src/world.ts`, `src/ui.ts` hashes remain unchanged. No combat rules, collision, muzzle transform or projectile timing changes were made.

The death-pulse presentation callback remains an explicit combat-owned integration item and is not represented as demonstrated on a real kill. The generic compositor also still needs exclusive replacement routing and equipment/carrier capabilities; the standalone factory supplies the playable revision. First-person insert visibility across every construction and paused camera-orbit inspection remain separate acceptance checks. No push or deployment occurred.
