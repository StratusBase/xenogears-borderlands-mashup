# Gravity equipment: production receipt

30 October 2026. The user approved the contained dark-core equipment direction and requested normal-game adoption with slower wisps/distortion, pilot/mech verification and sound.

## Delivered scope

- Normal Enhanced gameplay now registers `gravityEquipmentModule()` in the existing `gameElements.ts` composition root. No review query is required to see the equipment.
- The module replaces only generic Gravity equipment. It retains the existing gameplay, projectile/impact/status behavior and shared audio. The new all-direction well, lift/hold/crush and deployment mechanic remain a separate prototype combat handoff.
- Actual `rig.group` and authoritative `muzzleIndex` drive the shot response. Primary/secondary equipment, the mech's separate guns, parked equipment, reload assemblies, original resources and muzzle transforms retain their ownership.
- Legacy remains available. `createGameElementsBeforeGravityEquipment()` changes Gravity equipment only and preserves sibling element registrations/options for matched comparisons.

## Cosmetic timing

`src/rendering/quality/gravity/timing.ts` centralizes these presentation values:

| Presentation | Before | Current |
|---|---:|---:|
| Equipment wisp cycle | 0.22–0.34 s | 0.40–0.62 s |
| Equipment kick decay / texture rate | 12 / 23 | 8 / 14 |
| Prototype field wisp inflow | 28–36 m/s | 21–27 m/s |
| Prototype lens collapse | 0.34 s | 0.65 s |
| Prototype lens fade | 0.22–0.38 s | 0.44–0.74 s |

The dark central singularity remains. Equipment/field wisp travel and the lens collapse/fade are slower; internal lens swirl and rim shimmer retain their previous rates. Even the smallest prototype field's wisp speed remains above the 7 m/s target pull cap. These changes do not alter gameplay clocks, projectile recipes or audio. The field timing entry is separate from ordinary gameplay and does not establish normal-main field adoption.

## Verification and evidence

- **1,070 tests pass**, with TypeScript and the frozen integration build also passing. The production integration tests cover equipment-only registration, sibling defaults/options, exact local/world muzzles and reload homes, immutable fired specs, the firing gun's pulse, parked isolation, borrowed-resource restoration and repeated Enhanced/Legacy transitions.
- `/?verifyGravity` uses the normal Game and current default production factory, a separate save key, actual ballistics/collision/damage/equipment and native sound. Its clothed/armored fixtures are controlled encounter evidence. The native encounter action follows the real start policy: pilot first, retained loadouts and actual mech boarding.
- Matched pilot and mech sustained-fire studies use the same compiled entry and scene, sound on, recording off, 120 warm-up / 720 measured frames and one 1/60 simulation step per rendered frame. Only Gravity equipment changes between before/current/before-repeat.
- Full normalized combat and elemental audio dispatch snapshots are identical across each trio: **62 dispatches per pilot arm and 41 per mech arm**. The observer delegates once through the existing common audio dispatch; production audio source/recipes remain unchanged. Native recordings provide separate audible evidence.
- Current [screenshots, native sound clips and measured results](http://127.0.0.1:5303/review/) are packaged under ignored `artifacts/gravity-integration/`. Raw equipment studies are `performance-main-pilot.json` and `performance-main-mech.json`. The rendering owner maintains the final measured summary and source/build provenance there; do not infer a speedup from display-paced frame medians alone.

Task-baseline SHA256 values match for `src/game.ts`, `src/world.ts`, `src/ui.ts`, gravity `field.ts` / `activation.ts` / `profile.ts`, `src/rendering/PlayerBallistics.ts` and `src/audio/gravityAudio.ts`. See `artifacts/gravity-integration/coordination/protected-hashes.json`. The owned production integration is confined to the registry and an explicit development verification entry; protected combat files were not edited.

### Final measured summary

Each cell is **before / current / before-repeat**, in milliseconds. One frozen build, 1280×720, DPR 1; native recording is off during measurements.

| Scope | Median frame | p95 frame | Median GPU, unique queries |
|---|---|---|---|
| Normal pilot equipment | 8.30 / 8.30 / 8.30 | 9.30 / 9.50 / 9.90 | 2.44 / 2.78 / 2.53 |
| Normal mech equipment | 8.30 / 8.30 / 8.30 | 9.50 / 9.60 / 9.50 | 2.14 / 2.46 / 2.08 |
| Separate wall-field timing prototype | 8.30 / 8.30 / 8.30 | 9.30 / 10.00 / 9.90 | 2.19 / 2.16 / 2.26 |

The approved equipment adds about 0.3 ms of median GPU work relative to the initial baseline here. Display pacing masks small frame differences, so this is not a speedup or universal hardware budget claim. The field comparison sustains three wells and six members, with 144 identical audio dispatches per arm. Native before/after field clips reach six held targets; normal pilot/mech clips include shots, impacts and reload with non-silent, unclipped audio.

Plain `/` also passed through the real Workbench, Nullward Singularity orb, Equip & Test, training-dummy damage and reload for both pilot and mech. Browser pointer capture was denied; coordinate firing worked. Six controlled in-game idle/shot/reload pairs preserve exact local/world muzzles and home transforms. Both Legacy roundtrips restore the approved cells and exact muzzles. Fire + Gravity, Gravity + Corrosive and Gravity + Shock screenshots preserve the selected equipment and parked isolation.

## Review boundaries

The initial equipment received four successful read-only `claude-opus-5-5` source/still reviews, followed by the user's visual approval. The follow-up timing/integration review also used exactly `claude-opus-5-5`, made eight read-only source reads and found no blocker. Its audit and critique are `artifacts/gravity-integration/claude/audit.json` and `review.md`. It noted the intentionally retained lens swirl/rim shimmer and the limited margin for further inflow slowdown above the pull-speed cap. Opus did not view motion, listen to audio or measure performance; this source review is not a runtime, audible or performance attestation.

Historical equipment prototype evidence under `artifacts/gravity-equipment/` remains unchanged, including its older timings and full-well fixture. Current equipment production runs and the separate slower field prototype are labelled separately. See [equipment history](gravity-equipment.md), [canonical design](gravity-design.md), [combat coordination](gravity-combat-coordination.md) and the still-open [full-field integration handoff](gravity-integration.md).
