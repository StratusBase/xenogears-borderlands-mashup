# Adhesive main-game verification

30 October 2026. User-approved Tack Resin, honey material, varied stains and aligned equipment now run through normal Enhanced `GamePresentation` / `createGameElements`. This is routing/lifecycle integration; the approved material, animation, audio and equipment source are unchanged. [Integration contract](adhesive-integration.md) · [Combat coordination and scoped commits](adhesive-combat-coordination.md).

## Exact delivery profile

- Scoped candidate C: exported from `eb1f35c`, registered modules Radiation/Shock/Adhesive, existing built-in corrosive and generic Fire/Ice/Gravity paths retained. The separate unfinished full-Fire registration/options remain unchanged in the live working tree; they are excluded from this scoped delivery.
- Frozen C contains the ordinary `index.html`, conditional `?verifyAdhesive=1` review and `adhesive-encounter.html`, served on `127.0.0.1:5292`. Exact transformed source hashes, emitted assets, visited main script and raw measurement hashes are retained.
- Gravity's owner independently committed `6c51dd0` during verification. Final candidate D inherits that parent and the exact integration scope. Independent comparison confirms **all 152 imported source hashes and all 18 emitted runtime files equal measured C**; only provenance timestamp/parent metadata differs. C evidence remains labeled C; no blind rebuild or relabeling.
- Earlier combined working-tree build A includes the separate full-Fire work. Its frozen build and four-scene results remain under `artifacts/adhesive-integration/`; final scoped evidence is separately under `artifacts/adhesive-integration/candidate-c/`.

## Actual gameplay

Ordinary **untagged C main URL**: normal workbench → Tackwork/Gum mortar → guaranteed-proc review option → Equip & Test, held left mouse and R reload. Pilot: ammo 1/4, dummy total damage 304.94, adhesive status 2.9s. Mech: ammo 1/2, total 471.28, adhesive status 2.5s. Both use normal equipment/muzzles and the default production registry. Screenshots include workbench, firing, status and active reload. Console errors `[]`. Automation denied pointer lock; the existing input fallback worked. Unrestricted pointer lock/controller play is not asserted.

Fresh full encounter uses the existing `createEncounterPolicy` (`scripted-route-v1`), public Game input/step/render interfaces and legitimate level 5 rare `mobile-precision` workbench weapons/rolled equipment, with adhesive bullet/slug and normal rolled proc chances. One real-time accumulated 1/60 simulation clock. No teleports, fixture targets, health/ammo/stat overrides, phase shortcuts or second `Game.run` clock.

**Full run completed at 195.700s:** all 24 distinct authoritative enemy-killed IDs, `vault-relay-a` and `vault-relay-b`, pilot infiltration → defenses → boarding → mech squads → mini-boss → loot → complete. 16 pilot and 73 mech shots. Reward-collected ID appears in inventory; ordinary inventory selection/Equip installed the actual Salvaged Vent Reactor. Cooling 33.65 → 36; max heat +9.52; other slots preserved. Run 2 reached an actual mech adhesive slug shot at Game time 219.600. Full route/errors/input/event/reward receipts retained; errors `[]`.

The combat lead independently recomputed the route audit and exercised one valid plus 11 invalid receipt cases. All pass. 122/122 sampled visibility/audio/capture records are healthy; these are samples, not continuous monitoring. This is a scripted route check, not a human balance/controller playtest. Close human and armored-human fixtures also show real collisions, varied honey ruptures, smaller secondary deposits and lingering outer-surface coats; their raised health/guaranteed procs are explicit review settings.

## Sound and media

Native Game-canvas WebM records both real final physical/elemental audio buses. Full run 195.688s video/195.693s audio; replay 24.844s/24.867s. Also two 14s repeated-shot cloth/armor clips. All 1440×900, VP9 + 48kHz stereo Opus. MP4 changes encoding only; no gain, replacement or retiming. Original media preserved.

Strict full audio decode exits0 for all four clips; finite/nonzero PCM, zero digital clipping. Peaks: full−3.66dBFS, replay−4.19, cloth−4.47, armor−4.43. FFmpeg emits one `Error parsing Opus packet header` at EOF per native file. Preserve this warning: full debug shows 3261 packets → 3261 decoded frames / 9,391,680 samples and replay 414 → 414 / 1,192,320, both **zero decode errors**. This supports complete decoded audio, not a claim of a warning-free container or subjective listening-panel quality. Browser playback verification is recorded separately in the local gallery receipt.

## Matched performance

Same frozen C/scene/build, 1440×900 DPR1, sound on, capture off. Four arms: before/current/current-repeat/before-repeat. Each 120 warmup + 720 measured displayed frames with fixed 1/60 Game steps and input/combat RNG. Six raised-health fixtures per scene: sticky hits six actual recipients; rifle hits three. Baseline omits only Adhesive; Radiation/Shock and existing generic channels stay intact. Seed 37391 synchronizes current/repeated adhesive cosmetics, never gameplay RNG.

All four independent receipt checks **PASS**: exact combat state, resources, shot origins/directions/specs, contacts, hits, statuses/positions, kills/loot, repeated current burst/stain profiles and expected module inventory. Unique GPU query coverage 99.861% in every arm; one pending query per 720; no skipped/disjoint/lost queries.

Frame time, median /p95 milliseconds:

| Scene | Before | Current | Current repeat | Before repeat |
|---|---:|---:|---:|---:|
| Pilot sticky |8.30 /10.20|8.20 /10.10|8.20 /10.10|8.20 /10.20|
| Mech sticky |8.30 /10.00|8.30 /10.10|8.30 /10.00|8.30 /10.10|
| Adhesive +Shock rifle |8.20 /10.40|8.30 /10.50|8.30 /10.20|8.30 /10.30|
| Radiation +Adhesive rifle |8.30 /10.20|8.20 /10.20|8.20 /10.20|8.30 /10.40|

GPU cost is not free: mixed Shock median2.08 →3.09 →2.28 →2.39ms, p95 3.77 →5.21 →4.31 →4.15ms. Full arm costs, CPU submission/step timings, maxima, draws/resources, variation and baseline drift are in `verified.json` and raw receipts. Other VFX work continued on the shared host; our builds/tests/recordings/encodes were stopped while timing. No causal speedup or numeric budget acceptance is asserted. Step CPU includes scripted aiming plus Game.stepEvaluation; CPU/GPU timings overlap. End visibility, warmup and capture-off declarations do not establish independent continuous traces.

## Compatibility, ownership and checks

- Combat lead owns the shared per-hook flight contract, registry, sibling baselines and conditional main review entry. Adhesive owns its module, reusable review entry, full-route harness and evidence/report/docs. No edits to `src/game.ts`, `src/world.ts` or `src/ui.ts`; all 13 recorded approved art/audio/combat files remain byte-identical in C and working sources.
- Impact/audio/status route once, secondary hierarchy is preserved, aligned feeds bind the firing root, original parts/materials/muzzles survive, lifecycle cleanup is idempotent. Only the adhesive trail is replaced; physical carrier/payload/beam and existing boolean flight policies remain. Legacy and the original standalone adapter remain usable, including collision/Cluster child art for already-fired projectiles.
- Focused Adhesive integration 8/8; shared flight/registry plus adhesive add 16 passing cases. C exact suite 1013/1013 and production build pass.
- Final D suite **1022/1023**; clean parent `6c51dd0` **1006/1007**, both fail the same inherited Gravity test, `authoritative muzzle metadata survives reordered scene children; missing sockets never become gun zero`. All 16 added tests pass; D build and emitted-runtime identity pass. Gravity, Fire, equipment-model and unrelated files were not changed to fix it. This is an outstanding inherited test limitation, not an all-suite pass.
- Required Opus 5.5 equipment/material critique and user visual approval remain complete from `2cc5799`. Those images/art are reused unchanged. Opus did not newly review the combined route, audio or performance.

## Evidence

Local gallery: `/artifacts/adhesive-integration/candidate-c/` on the project dev server. Key ignored receipts: `verified.json`, `session-binding.json`, `build/provenance.json`, `boundary.json`, `encounter-evidence.json`, `audio-validation.json`, `ordinary-main-dom-binding.json`, `validation.json` and the final media/source binding. Staging includes independent route/mutation audits, parent/D test logs and `candidate-d-asset-identity.json`. Historical failed 14s rehearsal stays labeled failed and is excluded from accepted full-run proof; its obsolete recorder was removed before C freeze.

The combat lead coordinates three scoped local commits: shared contract/tests; atomic Adhesive registration/module/tests; review entries/configs/checkers/report/docs. No push or deployment.
