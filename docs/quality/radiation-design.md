# Radiation — approved A + B direction

Approved 30 October 2026 after the consistent-model `artifacts/concepts/radiation-v2/` review. The user chose **A Gamma Flash + B Fallout Bloom**. C is not part of this prototype.

## Visual and audio target

One short directional scintillation flash marks contact. Three unequal dust lobes release after it: a dominant outward/upward lobe, a shorter counter-lobe and a delayed thin fringe. The release disperses into sparse fluorescent dust and quiet decay ticks. These are separate beats, not two full bursts stacked at the same instant. Faces, cloth, armor and silhouettes remain intact. Warm ivory/sulfur/ochre distinguish it from fire, corrosive liquid, shock and gravity.

Equipment styling stays on a small shielded isotope insert/chamber with short yellow viewing slits. The normal receiver, muzzle sockets and other slots remain unchanged. A compact bright-core carrier gets a short dash/granular wake while retaining the existing delivery construction and trajectory.

The same clothed and open-face armored human fixtures used for corrosive remain the visual review subjects. No realistic replacement models. Coating belongs to the actual visible material: soft local fluorescence on cloth/skin, sparse sharper grains on outer armor. No gore, damage to skin, melted bodies, clothing holes or removed plates.

## Behavior and sizing boundary

Radiation's existing damage-over-time and irradiated-death pulse stay authoritative. Do not apply damage, change membership/range, add propagation, alter status/fuse clocks, move targets or change collision in a renderer. Bullet/scatter/beam contact stays compact. Existing explosive/delayed detonations earn the largest brief bloom. Secondary element weight, actual shot energy, recipient exposure, radius and target scale drive bounded visual sizes. Secondary recipients receive a few grains and a small deposit, never another full flash/fallout bloom.

The current irradiated-death pulse is applied inside the combat-owned death path. New presentation must receive a notification of its existing selected source/recipients through a handoff; do not rediscover recipients or reapply damage in art code. A prototype can demonstrate that callback against the real death outcome without changing production combat files.

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
