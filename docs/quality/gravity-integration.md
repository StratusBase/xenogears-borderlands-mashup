# Gravity prototype: combat integration handoff

The review entry is `gravity-lab.html` (`src/dev/effects/gravity/lab.ts`). It runs the real Game, fired recipes, ballistics, target meshes/hitboxes, damage path, renderer and sound. Its private Game bridge is **development-only**. Normal `/` does not yet run the new field mechanic. Combat lead retains `src/game.ts`, `src/world.ts` and `src/ui.ts`; none was edited for this prototype.

## Public modules

| Entry | Responsibility |
|---|---|
| `core/effects/gravity/field.ts` | `GravityFields`, plain targets/sources/state/events, pull/hold/crush/release |
| `core/effects/gravity/activation.ts` | `GravityActivation`, one source per qualifying blast detonation |
| `core/effects/gravity/profile.ts` | Provisional balance and finite budgets |
| `core/effects/shared/collision.ts` | Swept AABB movement, visibility, body clearance, raised-support pose helper |
| `rendering/PlayerBallistics.ts` | Optional `worldImpact` callback / `setWorldImpactHandler`, including world-only contacts and detonations |
| `rendering/quality/gravity/response.ts` | `gravityModule`, `GravityView` / `GravityResponse.sync(snapshot)` / `.event(event)`; presentation only |
| `rendering/quality/gravity/flow.ts` | Cached pressure paths, arc-length sampling and cosmetic profiles; no combat state |
| `rendering/quality/shared/composedPresentation.ts` | One generic composition layer, alongside existing carrier effects |
| `audio/gravityAudio.ts` | Recipe in existing shared audio engine; no new runtime context/engine |

Imports are relative to `src/`. No Three.js, DOM or audio dependency exists in the gameplay modules.

## Host wiring

1. Create one `GravityFields` per encounter/combat simulation. Its ports supply live eligible bodies with stable numeric IDs and center positions. `radius` and `halfHeight` describe the collision body. Dead/removed targets must be marked unavailable.
2. Inject `move(target, desiredCenter)` using the world's swept body collision. Write the **actual actor/root transform**, including vertical position, then update hitboxes, aim and damage anchors together. Return the resolved center. The supplied AABB sweep is a conservative prototype adapter; use the authoritative world collision representation for production.
3. Inject `visible(center,target)` for the explicit cover rule, `clearCenter(center,radius)` for placement, and the required `clearSourcePath(start,end,radius)` swept-volume check for deployment. Endpoint checks alone miss thin obstacles. The lab uses `effectBodyPathClear` with the existing body sweep; production should use its authoritative collision representation. Optional `capturePosition(desired,target,well)` resolves stationary goals above raised support; it must not teleport/move the actor. Movement still goes through the sweep. `supportedEffectPose` is the lab's AABB version, not exact sloped-surface physics.
4. Route `damage(id,amount,well)` through normal gravity/status damage, shields, death, damage numbers and credit. The module supplies recurring amounts; do not apply a second status-DPS loop. Source `ownerId` is the credit identity.
5. Feed the immutable `BallisticWorldImpact` to `GravityActivation.impact`. Use the constructor callback **or** the setter; the setter takes precedence and is a single owner, not an event bus. Clear it on teardown. The event includes a stable projectile ID, phase, copied world point/normal, frozen fired spec, energy, radius and optional target ID. Delayed sticky detonation retains its ID. Source placement works without an initial enemy hit.
6. Advance ballistics, then fields, then publish their snapshot to presentation **once per simulation tick**, including deployment. Skip field updates while paused. Never advance physics per camera or renderer. Let fields continue when art is disabled or Legacy is selected. `spawn` now reports the near-contact moving `center`; `well.deployment` supplies copied start/destination, elapsed time and duration. `gravityActive(well)` is authoritative: `age` stays zero during travel and counts active time after settle. Consumers without deployment metadata represent already-active historical snapshots. No second presentation timer or activation event is needed.
7. While `fields.owns(targetId)` is true, avoid a competing AI movement write, including during the release fall. Keep attack/AI policy explicit; this prototype does not authorize globally disabling enemy attacks or boss/player capture. Ordinary weapon raycasts continue against the moved meshes; no separate airborne proxy is needed.
8. Register `gravityModule` at the production composition root. Forward authoritative events to its response and snapshots through `.sync` once per tick. Its cosmetic `update` handles pulse/end envelopes and audio without rebuilding geometry again. Optional `{seed}` is for reproducible presentation only; never feed it to simulation. `GamePresentation` still owns update/pause/audio/clear/dispose. Its factory supports this generic composition without changing existing standalone renderers. Do not register the dev-only `gravityReferenceModule` in production.
9. Replace the **legacy gravity proc / planar displacement** for deliveries using the new field. Do not combine both pulls. The lab explicitly gives its gravity weapon `statusChance=0` and activates qualifying blasts through the new event; this is isolated to its fixture, not a silent weapon balance edit.

## Explicit prototype policies

- Gravity blast detonations only; no full well for every automatic bullet. Sticky, rocket and orb retain their normal flight/fuse/blast recipe. The first prototype activates deterministically; final proc/cooldown and delivery policy need balance review.
- Base radius 6 m, active lifetime 4.5 s after 0.28 s deployment, clearance 1.8 m, capture radius 1.16 m; acceleration 24 m/s², speed cap 7 m/s, crush 18 DPS in 0.5 s pulses after settle with distance exposure and shot energy. Blast radius scales the source. These are provisional, centralized values.
- Final center = actual detonation/contact point + normalized outward face normal × scaled clearance; validate candidates at 1 / 1.25 / 1.5 clearance. The current center eases from a collision-clear near-contact start to that destination, checking the source sweep each substep. An obstructed route is rejected/cancelled; there is no teleport fallback. Art follows this same center, showing only the core during travel. This also moves ceiling wells below the underside. Conservative slope AABBs can require a start farther from the face; production mesh collision should resolve that contact accurately.
- Full 3D range and cover checks include late entrants. Captured bodies hang around/below the core; floor and raised support can keep them grounded. Distinct ring/layer slots avoid one shared coordinate. This is not a crowd-body collision solver.
- At most three active wells; oldest replacement releases its members. One source owns a target. Existing ownership is stable until invalid; new ownership chooses nearest normalized distance with insertion-order ties. No duplicate overlapping crush loops for one body.
- `clear()` ends sources but retains members for collision-aware falling/landing. Keep updating until landing. `dispose()` also forgets bodies and is only for encounter teardown when the host removes/resets those actors. Dead/removed members disappear without resurrection. No added slam or fall damage.
- Current renderer budget: three wells, eight transient pressure paths per well, 24 segments per path, 144 grit instances total and 12 short body-edge wakes per well. Owned resources are disposed; source resources are borrowed intact. Core size comes from the gameplay profile. See the [deployment correction](gravity-deployment.md) for current evidence and the [pressure-fold review](gravity-pressure.md) for the previous frozen pass.

## Compatibility and remaining production checks

`PlayerBallistics` still works with no observer; the 13-family exact old-engine replay passes. New surface helpers are extracted into `quality/shared` with old corrosive-path exports retained. The generic compositor invokes the original carrier impact once, preserving delivery and dual-element weights, then adds authoritative persistent response. Recipe composition changes gravity only.

The lab proves controlled real-Game encounters, not normal AI encounters or production completion. Combat lead must verify ordinary pilot/mech loadouts, enemy movement/attacks, boss resistance policy, saves/encounter teardown, UI status naming and production wiring. After visual approval, verify `/` in Enhanced with sound and retain Legacy comparison. Do not ship the dev bridge as production integration.
