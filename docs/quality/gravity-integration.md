# Gravity: production combat integration

The full pull/hold/lift/crush mechanic now runs by default in normal `/`, through the actual Game, ballistics, collision and damage paths. Enhanced presents the composed field/equipment art; Legacy changes presentation only. Combat lead owns the host changes in `src/game.ts`, `src/world.ts` and `src/ui.ts`. See the [field production receipt](gravity-field-production.md). The earlier [equipment receipt](gravity-production.md) and prototype labs remain historical evidence; their results are not rewritten as proof of this later integration.

## Public modules

| Entry | Responsibility |
|---|---|
| `core/effects/gravity/field.ts` | `GravityFields`, plain targets/sources/state/events, pull/hold/crush/release |
| `core/effects/gravity/activation.ts` | `GravityActivation`, one source per qualifying blast detonation |
| `core/effects/gravity/combat.ts` | `GravityCombat`, production delivery/secondary policy, field/activation lifecycle, copied diagnostics and target crush status |
| `core/effects/gravity/capture.ts` | Surface-aware capture-ring goals and per-body plane clearance; never moves actors |
| `core/effects/gravity/profile.ts` | Provisional balance and finite budgets |
| `core/effects/shared/collision.ts` | Swept AABB movement, visibility, body clearance, raised-support pose helper |
| `rendering/PlayerBallistics.ts` | Optional `worldImpact` callback / `setWorldImpactHandler`, including world-only contacts and detonations |
| `rendering/quality/gravity/response.ts` | `gravityModule`, `GravityView` / `GravityResponse.sync(snapshot)` / `.event(event)`; presentation only |
| `rendering/quality/gravity/binding.ts` | Typed snapshot/event dispatch to the existing Gravity response only |
| `rendering/quality/gravity/sound.ts` | Source pressure/crush/release cues in the existing shared elemental audio engine; common to visible/audio-only arms |
| `rendering/quality/gravity/flow.ts` | Cached pressure paths, arc-length sampling and cosmetic profiles; no combat state |
| `rendering/quality/gravity/lens.ts` | Transient background distortion around the unchanged dark core; borrowed compositor inputs |
| `rendering/quality/gravity/timing.ts` | Centralized cosmetic equipment, wisp and lens rates; no gameplay or audio clocks |
| `rendering/quality/gravity/equipmentModule.ts` | `gravityEquipmentModule()` equipment-only capability; `GravityEquipmentResponse` lifecycle composed by the full gravity module |
| `rendering/quality/gravity/equipment.ts` | Mounted containment cells and finite inward wisps; exact source restoration, per-rig/muzzle shot response |
| `rendering/quality/gravity/coreMaterial.ts` | One unchanged dark-core shader shared by deployed wells and equipment |
| `rendering/quality/shared/sceneColor.ts` | Neutral scene-color/depth binding and ordered sampling-surface marker |
| `rendering/quality/shared/composedPresentation.ts` | One generic composition layer, alongside existing carrier effects |
| `audio/gravityAudio.ts` | Recipe in existing shared audio engine; no new runtime context/engine |

Imports are relative to `src/`. No Three.js, DOM or audio dependency exists in the gameplay modules.

## Implemented host wiring

1. Game owns one `GravityCombat`, composing the existing `GravityFields` and `GravityActivation`. Live eligible enemies supply stable IDs and actual 3D centers. Normal bodies use radius 0.6 / half-height 1.3 m; heavy bodies use 1.4 / 2.35 m. Bosses, player/friendlies, dummy and props are excluded. Dead/removed actors disappear from the supplied candidates.
2. `world.effectColliders` derives from the existing measured traversal AABBs, overheads and map boundaries; Game adds the dummy's measured solid. Unknown heights remain conservative walls. The shared sweep writes the **actual root transform**, updates world matrices and preserves true airborne hitboxes. Aim, attacks, secondary-hit anchors and damage-number anchors include actor elevation. Home-zone bounds preserve the existing legal movement region.
3. The same solids provide range/visibility, center clearance and whole source-volume deployment clearance. `gravityCapturePose` shifts the wall ring toward the contact's open side, retaining distinct slots and per-body floor/wall/underside clearance. It proposes goals only; every actor move still sweeps. Raised support is conservative AABB support, not exact sloped mesh physics. Additional cover can leave an unreachable goal in `pull`; it cannot force a teleport, penetration or false `held` event.
4. Crush routes through existing status damage, shield modifiers, health, hit feedback, death and kill credit. The HUD reads its actual rate/lifetime. No extra Gravity status-DPS loop is installed. Damage during visible in-range pull is intentional; `held` means convergence, not damage eligibility.
5. Game's normal `PlayerBallistics` constructor callback feeds immutable contact/detonation events to the production activation policy. Sticky retains its ID/fuse, and direct enemy rocket/orb impacts still detonate. The optional observer setter takes precedence; a new review logger must not override it without delegating to the Game host. A world-only detonation can create a source without an initial damaged enemy.
6. Normal ballistics advance, then fields advance, then Game calls `GamePresentation.gravity(snapshot,events)` **once per simulation tick**, including deployment. Pause stops the Game clock. `well.deployment` carries the copied start/destination and authoritative elapsed time; `gravityActive(well)` gates pull, crush and pressure sound. Active age remains zero until settle. Art never advances physics.
7. Field ownership suppresses AI navigation, legacy displacement and direct movement impulses through the collision-aware release fall. It preserves the real AI brain, facing and attacks; ordinary unshielded crush reactions do not restart ranged windup. Other guns continue raycasting the moved meshes. After a raised landing, walking off resumes normal falling.
8. The single production registry now uses `gravityModule()`, composing equipment and field presentation. Do not additionally register `gravityEquipmentModule()` for the same channel. `GamePresentation` retains the latest snapshot across Enhanced/Legacy switches and rehydrates art without replaying historical crush events. `GravitySound` routes pressure/crush/release through the existing shared `ElementalAudio` engine; visible and audio-only arms use the same owner. Optional cosmetic seeds never enter simulation.
9. Qualifying sticky/rocket/orb recipes skip the old Gravity status/planar proc while retaining all sibling RNG draws/order. Nonqualifying deliveries retain legacy behavior. Natural expiry releases through falling/landing; actor death and combat reset clear ownership. Reset removes/resets target bodies and sources together; presentation switches do not reset gameplay or save a field into progression.

`ComicRenderer` automatically supplies borrowed scene-color/depth inputs for the transient envelope; a plain renderer retains the core/wisps and faint fallback. Optional `GravityView.setDistortionEnabled()` changes art only. Earlier `gravity-lab.html`, `gravity-wisp-lab.html` and timing/equipment labs remain usable with their own explicit constructor policy and frozen reference builds. Their private development bridges are not the production integration.

## Production policy and provisional balance

- **Sticky, rocket and orb Gravity blast detonations only**, deterministically one source per projectile; no full well for automatic bullets, clusters or other deliveries. Existing flight/fuse/direct/blast behavior is retained. Secondary Gravity applies **0.62 crush power once** with unchanged reach/control. This delivery and balance policy remains provisional and centralized.
- Qualifying ordnance applies no old Gravity control status to bosses or dummy, but still deals its ordinary direct/blast damage. Boss/player/friendly/dummy/prop exclusion is conservative field immunity. Other deliveries retain their old status policy.
- Legacy bullet Gravity has zero DPS and a 3 s slow/pull. Field/fall ownership suppresses its displacement; a late still-active status may resume afterward until its original expiry. It never duplicates crush damage.
- Base radius 6 m, active lifetime 4.5 s after 0.28 s deployment, clearance 1.8 m, capture radius 1.16 m; acceleration 24 m/s², speed cap 7 m/s, crush 18 DPS in 0.5 s pulses after settle with distance exposure and shot energy. Blast radius scales the source. These are provisional, centralized values.
- Final center = actual detonation/contact point + normalized outward face normal × scaled clearance; validate candidates at 1 / 1.25 / 1.5 clearance. The current center eases from a collision-clear near-contact start to that destination, checking the source sweep each substep. An obstructed route is rejected/cancelled; there is no teleport fallback. Art follows this same center, showing only the core during travel. This also moves ceiling wells below the underside. Conservative measured AABBs can require a start farther from a slope; exact sloped mesh collision is not claimed.
- Full 3D range and cover checks include late entrants. Captured bodies hang around/below the core; floor and raised support can keep them grounded. Distinct ring/layer slots avoid one shared coordinate. This is not a crowd-body collision solver.
- At most **three active wells**, matching the renderer's three-well budget; oldest replacement releases its members. One source owns a target. Existing ownership is stable until invalid; new ownership chooses nearest normalized distance with insertion-order ties. No duplicate overlapping crush loops for one body. This is not a general crowd-body collision solver, including across separate sources.
- `clear()` ends sources but retains members for collision-aware falling/landing. Keep updating until landing. `dispose()` also forgets bodies and is only for encounter teardown when the host removes/resets those actors. Dead/removed members disappear without resurrection. No added slam or fall damage.
- Current renderer budget: three wells, eight transient pressure paths per well, 24 segments per path, 144 grit instances total and 12 short body-edge wakes per well. Owned resources are disposed; source resources are borrowed intact. Core size comes from the gameplay profile. See the [deployment correction](gravity-deployment.md) for current evidence and the [pressure-fold review](gravity-pressure.md) for the previous frozen pass.

## Compatibility and verification

**Equipment and full field are now registered in normal gameplay.** `GameElementOptions.gravity.equipment:'legacy'` / `createGameElementsBeforeGravityEquipment()` retain old equipment while preserving the field and sibling options. `createGameElementsBeforeGravityField()` selects audio-only world presentation with identical new mechanics, equipment and sound. Actual `rig.group` / `muzzleIndex` still isolate shots. Combat-lead host edits are now intentional authorized integration changes; the earlier equipment phase's unchanged-source hashes remain historical facts, not claims about this later source.

The user's speed feedback is applied through `gravity/timing.ts`: equipment cycles are 0.40–0.62 s, field inflow is 21–27 m/s and distortion collapse is 0.65 s. Internal swirl/rim shimmer retain their rates. These are cosmetic clocks; they do not retime deployment, damage or movement.

`PlayerBallistics` still works with no observer; the 13-family exact old-engine replay passes. New surface helpers are extracted into `quality/shared` with old corrosive-path exports retained. The generic compositor invokes the original carrier impact once, preserving delivery and dual-element weights, then adds authoritative persistent response. Recipe composition changes gravity only.

`GameOptions.gravityFields:false` is an explicit constructor-only seam for preserved standalone prototypes and a clearly labelled old-mechanic cost comparison. Ordinary `/` defaults to true; there is no normal-game query gate. The old-mechanic comparison intentionally changes combat, damage and downstream RNG consumption. Only the full versus audio-only field presentation trio is an identical-mechanics/sound rendering comparison.

The current source-only `claude-opus-5-5` review has no confirmed runtime blocker after triage. **14 actual-Game host regressions pass**, including sustained crush during a completed ranged windup and six direct-hit delivery/lethal cases. The review did not watch motion, hear audio or measure performance. Current normal-game footage, collision/held audits, sound, source/build hashes and matched results are recorded in [gravity-field-production.md](gravity-field-production.md). The [equipment history](gravity-equipment.md), [earlier production receipt](gravity-production.md) and [coordination record](gravity-combat-coordination.md) retain their phase boundaries.
