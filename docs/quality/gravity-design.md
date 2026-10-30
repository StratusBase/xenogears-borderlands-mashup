# Gravity well: canonical design

Recorded 30 October 2026. The user authorized full Gravity integration after approving its equipment direction. The pull/hold/lift/crush mechanic now runs by default in normal gameplay; Enhanced presents the dark core, slower wisps and contracting distortion, while Legacy changes presentation only. See the [full-field production receipt](gravity-field-production.md), [integration contract](gravity-integration.md), historical [equipment receipt](gravity-production.md) and [prototype evidence](gravity-prototype.md). Apply [effects architecture and ownership](../effects-architecture.md).

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

The user explicitly requires equipment to match this gravity language and collaboration with **Claude Opus 5.5**. The [equipment prototype and evidence](gravity-equipment.md) provide contained dark cores, soft inward wisps and construction-specific mounts in actual pilot/mech gameplay. The user approved that direction and requested normal-game adoption. The existing production composition root now registers `gravityModule()`, which composes that equipment with the authoritative field presentation. Normal Enhanced gameplay needs no review query. Legacy and the same-build equipment baseline retain the older generic equipment treatment; the equipment baseline keeps the full field. The [equipment receipt](gravity-production.md) records the earlier adoption phase; the [field receipt](gravity-field-production.md) records the subsequent complete integration.

- Preserve the weapon's construction, silhouette and aiming space. Place contained dark-core cues, soft inward wisps and restrained local compression at purposeful chambers, feeds or emitters. Do not wrap the whole weapon in the deployed well or add permanent orbiting ribbons.
- Vary the installation and motion with construction and delivery: compact cartridge/feed accents for conventional guns, a pressure chamber for launchers/sticky delivery, and an exposed focus where an energy/orb emitter supports it. An equipment cue is cosmetic; it does not create another damaging field.
- Use subdued idle treatment and brief shot-driven intake/contraction. Accents follow the existing recoil and reload assemblies; do not move muzzles, change projectile spawning, or infer extra charge/reload mechanics from the art.
- Keep primary/secondary hierarchy and each weapon/armor/reactor/leg slot independent, including the mech's separate guns. Preserve original parts and borrowed resources through release, replacement and Enhanced/Legacy switching.
- Verify pilot and mech equipment at idle, firing and reload, plus mixed elements and previews/drops. Retain actual equipment-to-projectile-to-impact gameplay with native sound, screenshots and matched same-build before/current/before-repeat performance.
- Once actual equipment views are ready, have Opus 5.5 compare them with the agreed gravity direction and world-effect evidence. Record the exact model, findings, changes and remaining gaps, including whether video/audio was assessed. User visual approval remains the adoption gate.

Keep the implementation in small gravity-owned modules, composed through the existing optional equipment contract and lifecycle. Equipment and field share one production registration; Game remains the sole gameplay authority. Follow the common [equipment acceptance requirements](../effects-architecture.md#required-equipment-alignment-and-opus-review).

## Slower cosmetic timing

The follow-up response to the user's speed feedback is centralized in `rendering/quality/gravity/timing.ts`:

| Presentation | Previous | Current |
|---|---:|---:|
| Equipment wisp cycle | 0.22–0.34 s | 0.40–0.62 s |
| Equipment kick decay / texture rate | 12 / 23 | 8 / 14 |
| Field wisp inflow | 28–36 m/s | 21–27 m/s |
| Distortion collapse | 0.34 s | 0.65 s |
| Distortion fade window | 0.22–0.38 s | 0.44–0.74 s |

These rates affect presentation only. The dark central core remains, and inflow remains faster than the 7 m/s target pull cap even at the smallest source scale. Internal lens swirl/rim shimmer retain their previous rates. Deployment, activation, pull/hold/crush and projectile behavior keep their gameplay clocks. The slower field art now consumes normal Game's authoritative state; the earlier timing prototype remains available as historical comparison evidence.

## Placement and collision

```text
world center = real contact point + outward world normal × clearance
```

Clearance derives from well/core size, required capture space and nearby geometry; its exact value is tuning. Validate the candidate center and the entire source-volume deployment path against corners, neighboring solids and ceilings. An obstructed route is rejected instead of teleporting the source across it. Pull uses full 3D distance/direction and swept collision; it must not flatten the vertical component or teleport targets through cover. Capture positions remain distinct and collision-valid rather than stacking every actor at one coordinate. Cover/line-of-sight policy must be explicit.

Deployment uses simulation time and a smooth start/stop curve. The full 4.5-second active duration and 0.5-second crush cadence start after settling; ordinary projectile flight, sticky fuse and direct blast damage retain their existing behavior. See the [deployment correction and evidence](gravity-deployment.md).

## Delivery and control policy

Normal production creates one deterministic source per qualifying **sticky, rocket or orb blast detonation**. Contact alone does not activate it; sticky retains its fuse and all three retain ordinary flight/direct/blast behavior. A world-only impact may create a source without a damaged target. Primary Gravity uses full crush power; secondary Gravity applies **0.62 crush power once**, retaining the same reach and control. These balance values are provisional and centralized in `gravity/combat.ts` and `profile.ts`.

Qualifying deliveries skip the old Gravity status/planar proc, preserving sibling proc RNG draws and order. Other deliveries deliberately keep the legacy 3 s slow/pull with zero Gravity status DPS; they do not create a full well. A legacy bullet status can remain on a field member, but field/fall ownership suppresses its displacement. If a late bullet's status is still active after ownership ends, its original control may resume until expiry; no second crush loop is added.

Bosses, player/friendlies, the fixed test dummy and props are excluded from field capture/crush. Qualifying ordnance still deals its ordinary direct/blast damage to damageable targets; removing the old zero-DPS Gravity control status does not remove direct damage or dummy-meter damage. Ordinary eligible enemies retain their AI attacks while the field owns movement. Normal unshielded crush reactions do not restart ranged windup; existing critical/shield-break interruption rules remain.

## Module and integration boundaries

- Gameplay location: `src/core/effects/gravity/`. `GravityCombat` composes the existing `GravityFields` and `GravityActivation`; `capture.ts` resolves surface-aware capture goals. Use plain data, injected collision/damage ports and the Game simulation clock. Keep source/target/event identities stable and tuning centralized.
- Presentation location: `src/rendering/quality/gravity/`. Consume authoritative spawn/update/member/pulse/end events and snapshots. Do not decide eligibility, move combat targets or apply damage there.
- Sound recipes: `src/audio/gravityAudio.ts`, composed into the existing `ElementalAudio` engine and voice budget. `GravitySound` routes quiet pressure, real crush ticks and release; no additional capture/spawn cue or audio engine is introduced. Keep other gun reports readable.
- Combat lead integrated `src/game.ts`, `src/world.ts` and `src/ui.ts`: ballistics advance before fields, followed by one `GamePresentation.gravity(snapshot,events)` handoff per simulation tick. Actual roots/hitboxes, elevated aim/damage anchors, shield/health damage, kill credit, release and landing remain game-owned. The HUD reads authoritative crush rate/lifetime.
- Share neutral contact/surface transforms, visible-surface bindings, pooling/lifecycle and review plumbing when semantics genuinely match. Leave gravity-specific placement/capture rules and pressure motion in gravity modules. Coordinate extraction of currently reused helpers out of the corrosive folder before introducing another deep sibling import.
- Pause/reset/death/source expiry and presentation switches must handle vertical state explicitly. Turning art off does not stop damage, change motion or erase a well.

## Collision, lifecycle and provisional balance

Centralize radius, duration, crush damage/cadence/falloff, pull acceleration and speed cap, capture clearance/radius, active-source budgets, activation/proc/delivery rules, cover policy and overlapping-well arbitration. Production retains explicit provisional defaults from the playable prototype; do not scatter constants or introduce a full-size well on every automatic bullet implicitly. Final balance follows playable review.

The production world supplies existing measured traversal AABBs, overheads, map boundaries and the dummy's measured solid. Unknown heights remain conservative walls. Deployment and actor movement are swept; capture rings shift toward the contact's open side without changing the core, stacking feasible slots or lifting bodies onto a wall. Additional cover can prevent a goal reaching `held`; the body remains collision-blocked in `pull`, and visible in-range pull still receives crush. This is not a general free-space packing or crowd-body collision solver.

The production profile and renderer both cap active wells at **three**. One source owns each target; replacement/expiry releases it through collision-aware falling/landing. Pause freezes the Game clock. Death/removal and combat teardown clear ownership; reset removes/resets actors and sources together. Walking off a raised landing resumes normal falling. Presentation switches retain current state and rehydrate without replaying historical crush cues; art settings do not disable the mechanic.

`GameOptions.gravityFields:false` is an explicit constructor seam for preserved standalone prototypes and an old-mechanic cost comparison. Ordinary `/` defaults to fields enabled and is not gated behind a query. It is distinct from the same-mechanics, same-sound audio-only presentation baseline.

## Acceptance evidence

Show clothed and armored enemies pulled from different sides/heights and arriving late; a floor/wall impact without an initially damaged target; an elevated wall well with visible clearance; actual lift and stable airborne capture; rifle hits on the true held outer armor; recurring crush ticks plus independent weapon damage; normal release/landing; ceiling/corner/cover collision; pause/death/reset and bounded multiple wells. Keep silhouettes and slot isolation readable.

Verify the ordinary production entry after approval and retain the existing renderer during development. Run matched same-build multi-target sustained-fire performance with sound, separately recording gameplay. Report tests, source boundaries, screenshots, native sound and measurement limitations honestly. No approved-looking mockup is gameplay proof.

The current source-only `claude-opus-5-5` critique has no confirmed runtime blocker after triage. **14 authoritative host regression tests pass**, including sustained crush during a completed ranged windup and six direct-hit delivery/lethal cases. Opus did not view motion, listen to audio or measure performance. Current gameplay and matched results belong to the [field production receipt](gravity-field-production.md); earlier receipts remain frozen.

## Concept references

Generated art/prompt history is local ignored evidence, not the only home of the design:

- `artifacts/concepts/gravity-v1/` — initial A/B/C art-language studies.
- `artifacts/concepts/gravity-well-v2/gravity-well.png` — pull/hold/crush and follow-up rifle fire, illustrated with a low floor well.
- `artifacts/concepts/gravity-well-v2/surface-placement.md` — height/clearance clarification; this canonical document carries its essential requirements even if ignored artifacts are absent.

## Historical playable visual revisions

Review rejected the first six evenly spaced curved ribbons because they resembled flower petals. The [stronger-core and pressure-fold pass](gravity-pressure.md) replaced the thin-strand revision. Its anchored pulsing fold was subsequently rejected in favor of finite inward travel windows. That earlier phase did not yet provide the later wisps/background-refraction pass or normal-main adoption. The current direction and slower timing are specified above; earlier renderers and receipts remain development comparisons, not alternative gameplay authorities.
