# Cluster balance and manufacturer loot

> **Historical version:** this report measures the 29 October 2026 forward-cone Cluster. The [classic MIRV revision](cluster-mirv.md) supersedes that delivery behavior. All 72 scripted runs, numbers, source fingerprints and raw evidence below are retained unchanged; they do not validate the new MIRV lifecycle, balance or performance.

2026-10-29. Retain the tuned candidate. Ordinary-roll Cluster completes all three matched encounter seeds, with **8.1% lower mean completion time** and **8.1% less mech ammunition** than the initial implementation. Cluster remains a higher-ammunition alternative to Rocket, with a more reliable airburst and less excessive control. This is a scripted actual-game pass; human/controller testing is not claimed.

## Changes

- Pilot: six children, 0.12-radian split cone, 3m child blast radius.
- Mech: eight children, 0.08-radian split cone, 4m child blast radius.
- Direct damage, fire rate, carrier speed, 0.45s split delay, 0.65s child fuse, one ammunition charge, and heat rules are unchanged.
- Each element independently shares its saved carrier chance across children: `q = 1 − (1 − p)^(1 / count)`. All children reaching one target in one impact stage retain chance `p` of at least one proc. At saved 35%, child chances are about 6.9% pilot and 5.2% mech.
- A successful proc uses carrier-level status strength, retaining actual splash falloff and the single secondary-element damage cost. Restoring strength is an intentional improvement to nonstacking DoT, paired with fewer successful procs. It is not a claim that all elemental DPS is unchanged.
- Cluster receives half the existing rocket weight in Ironvale and Cindergrid pools: 12.5% and 16.7% of their weapon profiles respectively. Other manufacturer pools remain unchanged.
- Saved numeric rolls and explicit split settings remain intact. New geometry defaults apply to new weapons; existing Cluster items receive the shared runtime status rule. Build codes need a source version or full saved-item snapshot to reproduce defaults across revisions.

## Actual-game result

Each arm contains 36 fresh `Game` instances: Cluster/Rocket/Scatter × three seeds × kinetic, corrosion+fire, or ice using workbench weapons (27 cells), plus three delivery types × three seeds using ordinary-roll weapons with corrosion+fire (9 cells). Every cell plays the entire pilot/relay/boarding/mech/boss/reward route with real AI, collision, health, shields, status effects, ammunition, reloads and heat.

The policy uses perfect body aim, ordinary navigation/strafe/healing, fixed 60Hz steps, and **offensive abilities disabled** to isolate weapon behavior. It fires within 18m. It does not teleport actors, edit enemy health, force stages, or equip better drops during combat. GPU draws occur between bounded stepping chunks. This is not a hardware or frame-rate benchmark.

All comparisons hold the Ironvale launcher receiver and equipped gear constant. Workbench weapons are rare level 5 with standard assembly. Ordinary-roll fixtures use the real `rollItem` numeric path, rare Rapid level-5 stat seed 2, with delivery forced for comparison. Delivery selection in natural loot is verified separately below. WS1 alone does not encode all ordinary-roll stats; full starting equipment and launch recipes are retained.

Seeds: 7, 8, 41. Values below are means over all three seeds. Frozen/slowed exposure is sampled in enemy-seconds; frozen exposure also counts as slowed. Form labels use the active combat phase when events occur.

| Cluster metric | Initial | Tuned |
| --- | ---: | ---: |
| Ordinary-roll full encounter time (s) | 258.71 | 237.83 |
| Ordinary-roll mech ammunition | 230.33 | 211.67 |
| Ordinary-roll mech heat-blocked time (s) | 27.61 | 24.70 |
| Ordinary-roll mech periodic/status damage | 1915.76 | 7931.86 |
| Workbench dual-element full encounter time (s) | 425.63 | 403.21 |
| Workbench ice mech frozen enemy-seconds | 39.28 | 4.05 |

The tuned ordinary-roll Cluster runs finish in **227.02–244.13s**; all three complete, within the encounter's 180–300s target. Their mean remains about **9.7% slower than Rocket** and **4.2% slower than Scatter**, so this pass does not establish Cluster dominance or universal area superiority.

**Completion limits remain visible:** initial matrix 20/36 complete and 16 timeouts; tuned matrix 19/36 complete and 17 timeouts. These include slow standard launcher/control configurations with abilities disabled. All six dual-element Cluster cells per arm complete. Kinetic workbench Cluster still times out on all three seeds, as do the corresponding Rocket controls. The ice/seed-7 Cluster case changes from completion at 476.25s to a 480s timeout with roughly 420 boss health remaining after excessive freeze reliability is removed. No attempt was omitted to improve the completion rate. This is a remaining weak build under this specific weapons-only policy, not evidence that every permutation meets normal pacing.

One extra baseline attempt was interrupted by a controller focus change: its game clock paused at 330s while the old harness consumed 480s of scheduled steps. Its raw file remains preserved, explicitly classified as a technical interruption and excluded from the paired matrix. A valid rerun occupies that cell. The harness now detects nonadvancing clocks, and manually driven evaluation is independent of window focus. Normal gameplay still pauses on focus loss.

## Range and cover

Separate controlled geometry uses authored stationary enemy meshes, actual `PlayerBallistics`, normal weapon spread, compact/spread groups and physical thin cover. There are 54 cells and 648 real triggers per arm. These observations measure raw spatial delivery; they do not substitute for live AI or status results.

The compact group contains a center target and peers at ±1.5m. Group delivery divides all three targets' raw damage by the trigger damage budget, so splash can legitimately make this ratio exceed one. Center capture is the fraction of that budget delivered to the center target.

| Form | Distance (m) | Group delivery before | Group delivery tuned | Center capture before | Center capture tuned |
| --- | ---: | ---: | ---: | ---: | ---: |
| Pilot | 19 | 1.852 | 1.972 | 100.0% | 100.0% |
| Pilot | 30 | 1.184 | 1.807 | 54.7% | 90.7% |
| Pilot | 40 | 0.302 | 1.118 | 15.8% | 45.5% |
| Mech | 19 | 1.992 | 2.054 | 100.0% | 100.0% |
| Mech | 30 | 1.208 | 1.968 | 54.0% | 95.8% |
| Mech | 40 | 0.247 | 1.335 | 12.0% | 60.2% |

All 36 Rocket/Scatter geometry cell objects, including individual hits, remain exactly equal. Covered peers receive zero damage in every initial/tuned cell; exposed center targets are actually struck. Every cell drains to zero pending projectiles within the existing caps. Behavioral regressions protect close contact budget, at least 80% close-group delivery at 30m, and at least 50% plus one trigger budget at 40m. These are useful-delivery regression floors, not statistical balance proof.

## Compatibility and validation

- **561 tests pass**, including real child collisions, shared elemental chance/strength, independently rolled channels, one secondary cost, old saved Cluster settings, natural loot reachability and meaningful range/cover guards. TypeScript and the production build pass.
- All **24 live Rocket/Scatter controls** preserve inputs, aggregate form metrics, initial equipment, timing and authoritative combat end state exactly. Raw launch vectors differ by at most 7.04×10⁻¹³; four damage components differ by at most 4.55×10⁻¹³ and one proc-power value by at most 8.18×10⁻¹⁴ in one control. The complete unrounded audit is retained, with a declared 10⁻⁹ absolute numerical boundary. Generated inventory IDs and intentionally changed new loot types are outside the combat-state equality claim.
- **4,096 pre-change loot samples:** 3,948 unconverted complete items remain equal; 148 eligible rockets become Cluster. Every sample retains the exact RNG draw count and subsequent random value. Converted items retain identity, magazine/reload, selected element, rolled spread/speed/status values and cosmetics; their delivery defaults and profile damage/rate intentionally change.
- Frozen tests separately cover 100 complete profile cases, 12 representative item rolls, manufacturer selection boundaries, all modes, natural Cluster generation and repeated save/load. Old saved Cluster radius/cone/count/raw status values are explicitly preserved.
- Pilot/mech workbench cards were visually checked with independent Fire + Corrosive channels, child chance/strength values, updated radii and no browser errors.

This is a small deterministic sample with perfect scripted aiming. It does not cover human/controller comfort, every natural roll, every elemental combination, every distance, or every manufacturer loadout. Cindergrid's stronger Rapid/single-element/radiation rolls have valid tested generation and bounds, but the live fixture uses representative Ironvale stats. Existing Scatter behavior is deliberately retained rather than globally retuned.

## Evidence and reproduction

Local ignored artifacts retain all **73 raw attempts** (72 included plus one documented technical interruption), event/input/launch/proc traces, full starting equipment, per-form metrics, exact source contents, summary and dispositions:

- `artifacts/cluster-live/summary.json` and `summary.md`
- `artifacts/cluster-live/attempt-dispositions.json` and each arm's `raw/`
- `artifacts/cluster-live/sources/` with the exact measured source contents
- `artifacts/cluster-balance/baseline/geometry.json` and `final/geometry.json`
- `artifacts/cluster-balance/final/control-parity.json` and `cluster-before-after-review.json`
- `artifacts/cluster-balance/final/loot-compatibility.json`, validation logs and UI captures

Measured live source fingerprints:

```text
initial sha256:04d05a4409535ca31751e87ccad4f824503635784e2b932e9b454310cef6e926
tuned   sha256:5e1cc38792078641667720fd9b5f973c0636f86a59eec85c95abd22080cb8883
```

Use a current Node runtime (tested with Node 25.7.0, Vite 7.3.7). The server disables HMR, freezes all source/script/config inputs, rejects source changes during an arm, and preserves attempts exclusively without overwriting. Run each source snapshot separately and keep every outcome:

```sh
node --import tsx scripts/serveClusterLive.ts --port 5209 --out artifacts/cluster-live
# Open /cluster-live-lab.html and use the matching initial/final matrix button.
node --import tsx scripts/summarizeClusterLive.ts artifacts/cluster-live
node --import tsx scripts/evaluateClusterGeometry.ts --out artifacts/cluster-balance/repeat/geometry.json
npm test
npm run build
```

For duplicate valid attempts, the summarizer requires an explicit selection manifest; it never silently picks the newest result. Purely technical clock interruptions are retained with their exclusion reason. Baseline collection continued from its exact frozen source in a separate local checkout; the temporary parent controller only queued unchanged single-cell URLs and did not change gameplay or policy.
