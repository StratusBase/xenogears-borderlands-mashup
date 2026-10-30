# Gravity well: canonical prototype design

Recorded 30 October 2026. The user has specified the mechanic and asked to prepare implementation with organized, reusable effects. This is the tracked source of truth for that design. A controlled actual-Game prototype now implements this mechanic; normal-main integration remains with the combat lead. See [integration](gravity-integration.md) and [review evidence](gravity-prototype.md). Apply [effects architecture and ownership](../effects-architecture.md).

## User-defined behavior

- A qualifying impact/detonation creates a persistent singularity associated with that contact.
- Nearby eligible enemies are pulled from **all directions in 3D**, including enemies entering its range while it is active.
- Capture and hold enemies around the core, including **lifting and suspending them** when the well is above them.
- Deal recurring **crush / gravity damage** while affected, through the normal authoritative damage path.
- Held targets remain hittable and damageable by other guns. Their bodies, hitboxes and damage anchors move together.
- Offset the core outward from the struck surface with enough room for visibility and capture. A wall impact places it out from the wall at that height; a floor impact places it above the floor; an underside impact places it below the ceiling.
- Use the **same collision-checked world-space center** for art, attraction, hold and damage. A visual offset alone is insufficient. Once placed, the well is fixed; an enemy moving away does not move the source with them.
- Keep enemies intact and stylized. No gore, anatomical crushing, melting, body stretching, missing armor or world destruction.
- Expiry stops pull/hold/crush. Suspended targets return to normal gravity and land with collision. No extra slam or fall-damage mechanic is specified.

The concept combines Tidal Fold's asymmetric inward pressure language with restrained Orbital Crush grit, rearranged around one shared source rather than isolated chest flares. Primary and secondary visuals, gun construction and shot delivery remain purposeful. A continuous well should stay open enough to aim at captured heads and torsos; it must not look or behave like an opaque shield.

## Placement and collision

```text
world center = real contact point + outward world normal × clearance
```

Clearance derives from well/core size, required capture space and nearby geometry; its exact value is tuning. Validate the candidate center against corners, neighboring solids and ceilings. Pull uses full 3D distance/direction and swept collision; it must not flatten the vertical component or teleport targets through cover. Capture positions remain distinct and collision-valid rather than stacking every actor at one coordinate. Cover/line-of-sight policy must be explicit.

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

Review rejected the first six evenly spaced curved ribbons because they resembled flower petals. The [stronger-core and pressure-fold pass](gravity-pressure.md) now replaces the thin-strand revision: a dark contracting core, asymmetric curved pressure sheets, fine inward traces and sparse grit. Cached per-source profiles vary shape and timing without a radial rosette or leaf-shaped width envelope. This is implemented art for review, not final visual approval or background refraction. Gameplay tuning is unchanged. The previous thin-strand renderer remains a development-only same-build comparison.
