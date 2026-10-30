# Approved Shock in the main game

30 October 2026. The approved A+B impacts/material charge, heavy C burst, balanced per-hit directions and fixed sticky charge are registered in normal Enhanced gameplay. Existing inventory, loadouts, save keys and Legacy mode retain their usual behavior.

## Composition and ownership

`shock/module.ts` is the single production implementation. It composes beside the existing Fire and Radiation registrations in `gameElements.ts`, retaining approved Corrosive through the shared fallback. `ShockPresentation` remains a compatibility entry for previous labs and constructor options; it delegates to this same module. It does not replace another element's factory or add an audio engine, equipment lifecycle, projectile engine or clock.

At this integration checkpoint the module replaced Shock impact/status/secondary presentation and its impact audio, while retaining generic Shock equipment/trails/beams and the approved fixed charge on sticky projectiles. The equipment quality pass was still missing; [Live Terminals](shock-equipment.md) now supersedes that generic equipment path. Shared flight retains current carrier/bomblet role metadata. Other channels retain their own registration, audio recipe and size weighting. Zero-energy carrier notifications cannot replay a preceding heavy Shock sound.

The existing `GamePresentation.confirmedShockChain` handoff now routes a neutral `ConfirmedElementChain` through the compositor. The main Game's original chain branch calculates the same damage once, applies it through the same `hurtTarget`, then publishes the existing source/end/recipient/spec/damage fraction. Selection order, six-meter range, cover, status/proc checks, shield scaling and damage readout remain in combat. Returning false preserves the previous tracer. This is the only Shock-specific change to combat-owned `src/game.ts`; `world.ts` and `ui.ts` are untouched by this task.

The ordinary `new Game(host)` path uses the updated registry. The optional `?verifyShock` branch in the normal `index.html` entry supplies a separate review save and real-Game controls, not a separate renderer or a production-loadout migration. Its integrated arm calls `resetElementalFactory()`; its baseline omits only Shock and retains every other registered production module. Existing `?verifyRadiation` remains intact.

## Verification contract

- `tests/shockIntegration.test.ts` replays the actual prior/current `Game.onBallisticHit` across16 combinations of Enhanced/Legacy fallback, blocked/unblocked cover, armored source and primary/secondary Shock. Complete damage, recipients, proc/status records, line checks and RNG-call counts match.
- Main-factory checks cover one Shock impact/audio contribution, heavy-only C, small confirmed secondaries, exact fallback particle matrices in both elemental orders, zero-energy notifications, release/mode toggles, and pilot/mech equipment. Unrelated slots deliberately share the Shock tag; only weapon-owned cartridge materials may change. Every muzzle, original geometry and transform stays exact; release restores materials.
- `scripts/verify-shock-integration.mjs` proves seven approved art/audio source files match `7941c45` byte-for-byte. Ballistics matches current MIRV checkpoint `32caa1e` byte-for-byte and passes the existing exact13-delivery replay against that pinned source.
- The historical pre-feedback replay intentionally differs for Cluster after its independently approved MIRV change. The verifier gains optional pinned hash/output-directory overrides, preserving its original defaults and historical receipts. Shock's fresh receipts stay under ignored `artifacts/shock-integration/`.
- Earlier captured comparisons are retained in `iteration-one/`; final measurements use a fresh frozen main build after the concurrent Cluster update.

Gameplay evidence uses the normal main entry, actual authoritative collision/damage/fuse/reload/chain logic and final sound buses. Controlled human fixtures have raised health; moving cases use native enemy brains, not renderer-driven target motion. Native encounters retain the normal controls and default registry. Stills freeze real simulation after the actual contact/detonation; native clips are separate.

Matched timing arms run before/current/repeated-before within one compiled build, with identical scene, weapons, inputs and combat seed37391;120 warm-up +720 measured displayed frames, one existing1/60 simulation step per frame, sound on and recording off,1440×900 DPR1. Report CPU/GPU costs and baseline drift rather than claiming a universal speedup. Moving AI encounters and high-DPI/lower-end devices have separate coverage limits.

No push or deployment. Use Enhanced mode and equip an existing Shock weapon after reloading the current game.

## Final delivery evidence

- [Main-game gameplay with sound, screenshots and measurements](http://127.0.0.1:5301/review/).
- [Normal main-entry verification with an isolated save](http://127.0.0.1:5301/?verifyShock).
- 946 tests pass, including27 existing Shock checks and20 main-integration checks. Production and frozen review builds pass. All13 ballistic-family replays pass against pinned32caa1e; the original default historical baseline remains available.
- Seven main-entry stills cover pilot rifle/heavy, mech heavy, Fire+Shock, Corrosive+Shock and real floor/wall contacts. Floor normal is[0,1,0], wall normal[0,0,1]. Each capture uses actual collision/detonation through the default registry.
- Native final-bus clips: moving humans6.06s, pilot heavy8.04s and mech heavy8.04s. All have nonzero audio and zero clipped decoded samples. Variable-frame-rate MP4 decoding passes. The source WebM header warnings and initial null-muxer timebase warnings are recorded; decoding with timestamp-preserving output resolves the latter without changing the clips.
- The ordinary objective encounter was started and mouse-fired manually: ammo changed4→2 and production Shock/status events appeared. Embedded native pointer capture was denied; the game's existing click fallback worked. This is a smoke check, not a full encounter performance claim. Fixture-target arrays are excluded from its receipt.

All nine final runs have identical complete combat snapshots. Before / integrated / repeated-before, milliseconds:

| Scene | Frame median | Frame p95 | Game/HUD CPU median | Draw CPU median | GPU median |
|---|---:|---:|---:|---:|---:|
| rifle | 9.50 / 11.40 / 9.20 | 48.70 / 13.40 / 48.80 | 1.40 / 1.40 / 1.30 | 4.50 / 4.00 / 3.80 | 2.22 / 3.02 / 2.15 |
| sticky | 11.30 / 11.30 / 11.30 | 13.10 / 13.00 / 13.10 | 1.30 / 1.40 / 1.30 | 4.50 / 4.40 / 4.50 | 2.38 / 2.96 / 2.41 |
| mech | 10.80 / 10.90 / 10.60 | 12.10 / 12.20 / 12.10 | 1.20 / 1.30 / 1.10 | 4.00 / 3.80 / 3.60 | 2.50 / 2.79 / 2.44 |

The rifle increases median frame time1.9ms and median GPU time0.80ms. Heavy/mech median GPU increases are0.58/0.29ms; frame medians stay within0.1ms of the initial baselines. Rifle baseline arms have large frame tails. These measurements establish a bounded observed cost on this machine, not a universal cost or speedup. Approved C pools/capacities and secondary curves retain their exact source.

Reproduce source/ballistic contracts with `node scripts/verify-shock-integration.mjs`. Package existing browser evidence with `node scripts/package-shock-integration-review.mjs`. Raw receipts, original WebM, MP4, build hashes and limits are under `artifacts/shock-integration/verification.json`.

## Shared-file handoff

The current working tree already contains the main-game wiring. `shock-main-wiring.patch` records Shock's five shared seams against the isolated commit snapshot, preserving the independently committed Radiation parent and excluding pending element changes; its reverse application checks against that snapshot. Keep those existing foundation changes when committing the shared files. The later Shock equipment commit isolates Shock plus the neutral hooks it needs from these shared files. Pending concurrent element registrations and implementations remain in the working tree. The frozen gameplay/timing receipts describe the earlier combined-workspace integration; the isolated commit is validated separately in `shock-equipment.md`.
