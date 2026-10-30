# Radiation — approved A + B direction

Approved 30 October 2026 after the consistent-model `artifacts/concepts/radiation-v2/` review. The user chose **A Gamma Flash + B Fallout Bloom**. C is not part of this prototype.

## Visual and audio target

One short directional scintillation flash marks contact. Three unequal dust lobes release after it: a dominant outward/upward lobe, a shorter counter-lobe and a delayed thin fringe. The release disperses into sparse fluorescent dust and quiet decay ticks. These are separate beats, not two full bursts stacked at the same instant. Faces, cloth, armor and silhouettes remain intact. Warm ivory/sulfur/ochre distinguish it from fire, corrosive liquid, shock and gravity. The canonical radiation feedback color is warm yellow `#f5df3d`; corrosive owns the former radiation lime `#b7f34a`, per the subsequent palette correction.

Equipment styling stays on a small shielded isotope insert/chamber with short yellow viewing slits. The normal receiver, muzzle sockets and other slots remain unchanged. A compact bright-core carrier gets a short dash/granular wake while retaining the existing delivery construction and trajectory.

The same clothed and open-face armored human fixtures used for corrosive remain the visual review subjects. No realistic replacement models. Coating belongs to the actual visible material: soft local fluorescence on cloth/skin, sparse sharper grains on outer armor. No gore, damage to skin, melted bodies, clothing holes or removed plates.

## Behavior and sizing boundary

Radiation's existing damage-over-time and irradiated-death pulse stay authoritative. Do not apply damage, change membership/range, add propagation, alter status/fuse clocks, move targets or change collision in a renderer. Bullet/scatter/beam contact stays compact. Existing explosive/delayed detonations earn the largest brief bloom. Secondary element weight, actual shot energy, recipient exposure, radius and target scale drive bounded visual sizes. Secondary recipients receive a few grains and a small deposit, never another full flash/fallout bloom.

The irradiated-death pulse stays inside the combat-owned death path. On the user's subsequent explicit integration approval, its existing selected source/recipients now notify `GamePresentation.confirmedPulse`. Art never rediscovers recipients or reapplies damage. The normal production registry composes Radiation and Fire with corrosive; see [normal-game integration verification](radiation-main-verification.md).

## Architecture and ownership

Follow `docs/effects-architecture.md`. Radiation owns `src/rendering/quality/radiation/`, a thin recipe in `src/audio/radiationAudio.ts`, and its review entry under `src/dev/effects/radiation/`. Reuse neutral shared visible-surface/contact-frame helpers, the human fixture, existing performance statistics, the existing presentation lifecycle and the shared audio engine/recipe composition. Keep element-specific shape, masks, size curves and dust shading local.

Combat lead retains `src/game.ts`, `src/world.ts` and `src/ui.ts`. Shared composition work is concurrent; avoid replacing its current work. Provide an explicit optional module/factory and production handoff. Existing renderers remain usable. Normal Enhanced integration follows visual approval of actual gameplay, not this concept approval alone.

## Proof required for this prototype

- Real Game shots and native-time sound on the same clothed/armored humans; all relevant deliveries, pilot/mech, secondary channel, moving attachments, pause/cleanup and the real radiation status.
- Real surface contacts on floor, wall, raised top, slope, underside and finite ledge. Residue uses the real surface transform; clouds lift away from it rather than rotating a wall splash flat onto a floor.
- Meaningful isolation/compatibility tests for immutable specs, collisions, damage/status outcomes, borrowed geometry/materials and equipment slots; finite pool and cleanup checks.
- Same-build before/current/repeated-before sustained fire with several targets and sound, recording off during timing. Report median/p95, update/submission/GPU costs, exact combat comparisons and hardware limits.
- Preserve source fingerprints, screenshots, live-sound recordings and an integration handoff. Generated paintovers are targets, not proof of runtime parity or performance.

The scope begins with a playable prototype for review. No push or deployment is authorized.

## Finished visual/audio revision

The 30 October finish pass adds a held 240 ms contact core, bolder tapered onset rays, relit ivory/sulfur volume, larger finite scintillation, and a slow 1.45-second fringe. Local residue can cross adjacent visible meshes of the same material within its original footprint; this prevents a center rib from hiding the affected armor. Rocket contact presentation is subsumed by immediate detonation, and splash audio is bounded independently of combat. See `radiation-opus-review.md` and `radiation-verification.md` for actual captures, final review and matched results. Optional cosmetic seed injection supports reproducible comparisons without consuming gameplay randomness.

## Equipment alignment

The subsequent [equipment alignment and Opus 5.5 review](radiation-equipment.md) completes primary/secondary chamber fitting, shot-driven yellow/ivory charging and delivery-specific decay across pilot, mech, world, drop and preview paths. That report includes actual native-time sound clips, matching shot-phase screenshots and equipment-only matched performance results.
