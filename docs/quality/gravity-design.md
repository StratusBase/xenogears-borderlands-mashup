# Gravity well: canonical prototype design

Recorded 30 October 2026. The user has specified the mechanic and asked to prepare implementation with organized, reusable effects. This is the tracked source of truth for that design. A controlled actual-Game prototype implements the full field mechanic; that mechanic still requires normal-main integration. The user-approved equipment is now registered in normal Enhanced gameplay. See [production equipment receipt](gravity-production.md), [field integration](gravity-integration.md) and [prototype evidence](gravity-prototype.md). Apply [effects architecture and ownership](../effects-architecture.md).

## User-defined behavior

- A qualifying impact/detonation creates a persistent singularity associated with that contact.
- Nearby eligible enemies are pulled from **all directions in 3D**, including enemies entering its range while it is active.
- Capture and hold enemies around the core, including **lifting and suspending them** when the well is above them.
- Deal recurring **crush / gravity damage** while affected, through the normal authoritative damage path.
- Held targets remain hittable and damageable by other guns. Their bodies, hitboxes and damage anchors move together.
- Offset the core outward from the struck surface with enough room for visibility and capture. A wall impact places it out from the wall at that height; a floor impact places it above the floor; an underside impact places it below the ceiling.
- Use the **same collision-checked world-space center** for art, attraction, hold and damage. A visual offset alone is insufficient. On impact, the core starts just outside the contact face and floats smoothly to its final clearance over 0.28 seconds. No field pull, capture, periodic crush or pressure bed begins until it settles. It then stays fixed; an enemy moving away does not move the source with them. This replaces the rejected instant offset/teleport.
- Keep enemies intact and stylized. No gore, anatomical crushing, melting, body stretching, missing armor or world destruction.
- Expiry stops pull/hold/crush. Suspended targets return to normal gravity and land with collision. No extra slam or fall-damage mechanic is specified.

The concept combines Tidal Fold's asymmetric inward pressure language with restrained Orbital Crush grit, rearranged around one shared source rather than isolated chest flares. Primary and secondary visuals, gun construction and shot delivery remain purposeful. A continuous well should stay open enough to aim at captured heads and torsos; it must not look or behave like an opaque shield.

Latest art direction: keep the **dark singularity at the center**. A separate large background-distortion envelope forms after deployment, contracts rapidly into that core and fades. Purple inflow is ethereal, soft and faster than enemy pull, without solid ribbon bodies, ink borders or hard bright edges. The core does not disappear with the envelope. See the [wisps and distortion pass](gravity-wisps.md); this is based on the user's written description, not a verified exact Borderlands video match.

## Equipment alignment: approved production adoption

The user explicitly requires equipment to match this gravity language and collaboration with **Claude Opus 5.5**. The [equipment prototype and evidence](gravity-equipment.md) provide contained dark cores, soft inward wisps and construction-specific mounts in actual pilot/mech gameplay. The user approved that direction and requested normal-game adoption. The existing production composition root now registers the equipment-only `gravityEquipmentModule()`; normal Enhanced gameplay uses it without a review query. Legacy and the same-build equipment baseline retain the older generic treatment. The initial Opus 5.5 source/still critique is complete; the subsequent timing/integration review is recorded separately in the [production receipt](gravity-production.md).

- Preserve the weapon's construction, silhouette and aiming space. Place contained dark-core cues, soft inward wisps and restrained local compression at purposeful chambers, feeds or emitters. Do not wrap the whole weapon in the deployed well or add permanent orbiting ribbons.
- Vary the installation and motion with construction and delivery: compact cartridge/feed accents for conventional guns, a pressure chamber for launchers/sticky delivery, and an exposed focus where an energy/orb emitter supports it. An equipment cue is cosmetic; it does not create another damaging field.
- Use subdued idle treatment and brief shot-driven intake/contraction. Accents follow the existing recoil and reload assemblies; do not move muzzles, change projectile spawning, or infer extra charge/reload mechanics from the art.
- Keep primary/secondary hierarchy and each weapon/armor/reactor/leg slot independent, including the mech's separate guns. Preserve original parts and borrowed resources through release, replacement and Enhanced/Legacy switching.
- Verify pilot and mech equipment at idle, firing and reload, plus mixed elements and previews/drops. Retain actual equipment-to-projectile-to-impact gameplay with native sound, screenshots and matched same-build before/current/before-repeat performance.
- Once actual equipment views are ready, have Opus 5.5 compare them with the agreed gravity direction and world-effect evidence. Record the exact model, findings, changes and remaining gaps, including whether video/audio was assessed. User visual approval remains the adoption gate.

Keep the implementation in small gravity-owned presentation modules, composed through the existing optional equipment contract and lifecycle. Equipment registration is coordinated through the one production registry; normal field integration remains a separate combat handoff. Follow the common [equipment acceptance requirements](../effects-architecture.md#required-equipment-alignment-and-opus-review).

## Slower cosmetic timing

The follow-up response to the user's speed feedback is centralized in `rendering/quality/gravity/timing.ts`:

| Presentation | Previous | Current |
|---|---:|---:|
| Equipment wisp cycle | 0.22–0.34 s | 0.40–0.62 s |
| Equipment kick decay / texture rate | 12 / 23 | 8 / 14 |
| Prototype field wisp inflow | 28–36 m/s | 21–27 m/s |
| Prototype distortion collapse | 0.34 s | 0.65 s |
| Prototype distortion fade window | 0.22–0.38 s | 0.44–0.74 s |

These rates affect presentation only. The dark central core remains, and prototype inflow remains faster than the 7 m/s target pull cap even at the smallest source scale. Deployment, activation, pull/hold/crush, projectile behavior and sound recipes keep their existing clocks. The slower field presentation is demonstrated in the separate timing prototype; equipment production adoption does not install that field in normal gameplay.

## Placement and collision

```text
world center = real contact point + outward world normal × clearance
```

Clearance derives from well/core size, required capture space and nearby geometry; its exact value is tuning. Validate the candidate center and the entire source-volume deployment path against corners, neighboring solids and ceilings. An obstructed route is rejected instead of teleporting the source across it. Pull uses full 3D distance/direction and swept collision; it must not flatten the vertical component or teleport targets through cover. Capture positions remain distinct and collision-valid rather than stacking every actor at one coordinate. Cover/line-of-sight policy must be explicit.

Deployment uses simulation time and a smooth start/stop curve. The full 4.5-second active duration and 0.5-second crush cadence start after settling; ordinary projectile flight, sticky fuse and direct blast damage retain their existing behavior. See the [deployment correction and evidence](gravity-deployment.md).

## Existing baseline and required work

At the source inspection on 30 October, `game.ts` applies a gravity proc to nearby enemies within 6 m after a damageable-target hit, saves `gravityPoint`, and performs bounded ground-plane displacement. The status is three seconds at 65% movement speed with no gravity DPS multiplier. World-surface visual contact callbacks do not themselves create an authoritative field. Recheck current code before implementation because other workstreams are active.

The persistent source, late entrants, 3D lift/capture, hold, crush ticks and collision-aware release are implemented in the independent prototype module; adopting them in normal Game remains new integration work. The old 6 m / 3 s values are references, not approved new balance numbers. This user-requested change supersedes preserving the old gravity behavior; other elements and unrelated weapon/collision behavior remain protected.

## Module and integration boundaries

- Gameplay location: `src/core/effects/gravity/`. Use plain data, injected collision/damage ports and simulation time/RNG. Keep source/target/event identities stable and tuning centralized.
- Presentation location: `src/rendering/quality/gravity/`. Consume authoritative spawn/update/member/pulse/end events and snapshots. Do not decide eligibility, move combat targets or apply damage there.
- Sound recipes: `src/audio/gravityAudio.ts`, composed into the existing `ElementalAudio` engine and voice budget. Capture intake, quiet pressure bed, crush cues driven by real ticks and clear release; keep other gun reports readable.
- Combat lead retains `src/game.ts`, `src/world.ts` and `src/ui.ts`. Provide an explicit handoff for authoritative impact events, body/collision integration, damage and release; do not bypass ownership with a renderer-owned simulation.
- Share neutral contact/surface transforms, visible-surface bindings, pooling/lifecycle and review plumbing when semantics genuinely match. Leave gravity-specific placement/capture rules and pressure motion in gravity modules. Coordinate extraction of currently reused helpers out of the corrosive folder before introducing another deep sibling import.
- Pause/reset/death/source expiry and presentation switches must handle vertical state explicitly. Turning art off does not stop damage, change motion or erase a well.

## Configurable prototype decisions

Centralize radius, duration, crush damage/cadence/falloff, pull acceleration and speed cap, capture clearance/radius, active-source budgets, activation/proc/delivery rules, cover policy and overlapping-well arbitration. Start with explicit conservative prototype defaults and label them provisional; do not scatter constants or introduce a full-size well on every automatic bullet implicitly. Final balance follows playable review.

Movable enemies and 3D capture are required. Physics props, boss resistance, players/friendly fire and disabling enemy attacks are not implicitly approved mechanics. Static world geometry remains solid and stationary. Multiple sources must not fight over one body, create duplicate damage/hold ownership or multiply effects without a defined rule.

## Acceptance evidence

Show clothed and armored enemies pulled from different sides/heights and arriving late; a floor/wall impact without an initially damaged target; an elevated wall well with visible clearance; actual lift and stable airborne capture; rifle hits on the true held outer armor; recurring crush ticks plus independent weapon damage; normal release/landing; ceiling/corner/cover collision; pause/death/reset and bounded multiple wells. Keep silhouettes and slot isolation readable.

Verify the ordinary production entry after approval and retain the existing renderer during development. Run matched same-build multi-target sustained-fire performance with sound, separately recording gameplay. Report tests, source boundaries, screenshots, native sound and measurement limitations honestly. No approved-looking mockup is gameplay proof.

## Concept references

Generated art/prompt history is local ignored evidence, not the only home of the design:

- `artifacts/concepts/gravity-v1/` — initial A/B/C art-language studies.
- `artifacts/concepts/gravity-well-v2/gravity-well.png` — pull/hold/crush and follow-up rifle fire, illustrated with a low floor well.
- `artifacts/concepts/gravity-well-v2/surface-placement.md` — height/clearance clarification; this canonical document carries its essential requirements even if ignored artifacts are absent.

## Playable visual revision

Review rejected the first six evenly spaced curved ribbons because they resembled flower petals. The [stronger-core and pressure-fold pass](gravity-pressure.md) replaced the thin-strand revision. Its anchored pulsing fold was subsequently rejected: **every sheet now travels inward in a finite faded window**, with no persistent strand or pulse-driven sheet deformation. The dark contracting core, asymmetric pressure sheets, fine traces and sparse grit remain. Cached per-source profiles vary shape and timing without a radial rosette or leaf-shaped width envelope. This is implemented art for review, not final visual approval or background refraction. Active combat tuning remains unchanged apart from the explicitly requested deployment delay. The previous thin renderer remains a development-only cost comparison, with its pressure-bed gate adapted to deployment.
