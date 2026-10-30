# Adhesive A integration handoff

The approved direction is [Tack Resin](adhesive-design.md). **User visual approval received on 30 October 2026:** “Looks good,” accepting the equipment/gameplay review delivered with `2cc5799`. Adhesive is now registered in ordinary Enhanced gameplay through `createAdhesiveModule` and the shared production registry; it is no longer limited to the lab. [Main-game verification](adhesive-main-verification.md) records the exact scoped build, ordinary pilot/mech input checks, full encounter/replay, sound and matched performance. Legacy and the previous standalone renderer remain available. This pass does not edit combat-lead-owned `src/game.ts`, `src/world.ts` or `src/ui.ts`.

The subsequent [honey-material pass](adhesive-honey-material.md) adds `material:'honey'|'previous'` to the adapter options; honey is the current opt-in default. Its separate build/report preserves the original verification receipt below. It compares against the previous Tack Resin material, with identical animation and audio in both modes.

The [varied-stain pass](adhesive-stains.md) adds `stains:'varied'|'fixed'`. The opt-in default now varies the lingering footprint; `material:'honey',stains:'fixed'` retains the previous honey coat for same-build comparison. Honey material, combat and burst behavior remain unchanged.

The [stain performance correction](adhesive-stain-performance.md) makes the optimized varied shader the default and retains `stainKernel:'reference'` for exact same-build comparison against `ef0eeb8`. Honey and profile generation remain unchanged.

The [equipment alignment pass](adhesive-equipment.md) adds `equipment:'aligned'|'previous'`. The opt-in default uses a caged longitudinal honey feed, connected ribbed hose and hollow applicator collar, with pressure response and sampling of the existing reload pose. The previous receiver canister remains available. The required Opus 5.5 review, actual pilot/mech equipment evidence and user visual approval are complete. Ordinary Enhanced adoption and combined-game verification are recorded in [the main-game receipt](adhesive-main-verification.md).

## Review entry

`npx vite --host 127.0.0.1 --port 5186 --strictPort` serves `/adhesive-lab.html`. For a frozen comparison, build with `npx vite build --config vite.adhesive.config.ts`, then preview that config on a free port. The review build contains both prior adhesive and Tack Resin, plus transformed-source SHA-256 provenance. The lab locks the renderer/camera to 1440 × 900, DPR 1.

The entry uses the actual `Game` evaluation driver and isolated save `dust-steel.adhesive-a.review.v1`. Human fixtures replace only visual models; authoritative projectiles, collisions, sticky fuse, damage, statuses, ammo, heat and reload still run through Game/PlayerBallistics. High-health training targets allow repeat review without killing the fixture. The move checkbox is scripted attachment testing, not an AI or slowdown demonstration. Surface tests move the human fixtures out of the shot path.

Use **Replay repeated shots with sound** to assess variation at native speed. **Fire real shot / freeze peak** freezes seven simulation frames after the actual event; **Show settled resin** advances one second. Record controls mix the actual final physical/elemental audio buses; they do not replace or normalize sound. Measurements keep recording off.

## Production module and retained standalone adapter

Normal `GamePresentation` uses `createGameElements`. The production registry registers `createAdhesiveModule(options.adhesive)` beside Radiation and Shock. Corrosive and unregistered channels keep their existing paths. The scoped committed candidate preserves HEAD’s generic Fire; the concurrent working-tree full-Fire registration/options remain untouched. The before-Adhesive factory omits only Adhesive and retains every sibling option.

The module reuses the approved response, aligned equipment and audio recipe. It replaces its impact, equipment and trail once per channel. The physical carrier/payload and beam remain, using the shared per-hook flight policy; existing boolean policies retain their semantics. Statuses/audio advance through the shared owner, and retained projectiles keep their original flight hooks after a Legacy toggle.

The following standalone adapter remains available for historical comparisons; it is not the production integration mechanism.

```ts
import {AdhesivePresentation} from './rendering/quality/adhesive/presentation';

// GamePresentation must be disabled while changing the factory.
presentation.setElementalFactory((scene, camera) =>
  new AdhesivePresentation(scene, camera));

// Optional exact review sequence, never a gameplay RNG:
new AdhesivePresentation(scene, camera, {visualSeed: 37391});
```

The standalone adapter retains its original behavior. Production uses the composed module instead of replacing another element’s factory. Sibling element implementations do not import adhesive internals.

`AdhesiveResponse.impact()` consumes the existing presentation impact receipt. It uses `point`, `normal`, `target`, optional `hitSurface`, immutable `spec`, `phase`, `radius`, energy and exposure. `splash()` only decorates secondary recipients. `status(root)` returns the shared structural `SurfaceStatusVisual` interface. `release`, `clear` and idempotent `dispose` own only temporary resources. The existing superclass retains update/audio/status scheduling and nonadhesive routing. Borrowed source geometry, original materials/raycast functions and all equipment sockets remain intact.

## Modules and budgets

- `adhesive/resin.ts`: closed thick sections, authored amber shading and event-specific deformations. Five families with continuously varied pull counts, handedness, lengths, curvature, bead weight, growth and gravity sag. Geometry stays outside its contact plane. No hole mask, flat radial petals or fixed signature spike.
- `adhesive/response.ts`: actual outer-surface resolution, anchors, finite-support drops and bounded pools: 10 folds, 192 drops, 96 pads, 16 environment masks and 32 statuses.
- `adhesive/sizing.ts`: cosmetic energy/delivery/exposure curves; secondary response has no full fold, smaller deposits and fewer beads. Variation stays within these size envelopes.
- `adhesive/surfaces.ts`: source-local coats/drips and authoritative intensity/expiry. Cloth remains visible; armor selection uses the outer plate. Ground residue is cosmetic and adds no hazard.
- `adhesive/alignedEquipment.ts`: current owned weapon-slot feed/cage/hose/collar and pressure presentation. `adhesive/equipment.ts` retains the previous attachment and unchanged projectile neck/trail. Both preserve original construction and muzzles.
- `audio/adhesiveAudio.ts`: wet contact/tear/release/drips via the existing audio engine and budgets. Other recipes pass through unchanged.
- `shared/variation.ts`: independent cosmetic seed sequence and nonrepeating variant families per named event track. A profile is chosen once per event, never rerolled per frame. Default instances obtain independent seeds; explicit seeds/reset support exact review. Contact/secondary events cannot force repeated detonation families. No `Math.random` or gameplay RNG is consumed.

The variation standard is now recorded in [the effects architecture guide](../effects-architecture.md). This shared helper is implemented and used by adhesive. Existing elements have not been silently rewritten; their owners should apply the standard as they revise them.

## Fidelity and review limits

The concept is a generated paintover. Runtime resin uses bounded procedural geometry, surface overlays and authored glints; it does not simulate optical refraction, fluid volume or armor/material destruction. No gore. Human fixtures preserve the game style but are review models, not a claim that the normal enemy roster has been replaced. The user approved the current runtime review, including its documented material approximation and performance limits. The separate Claude reviews are read-only peer critiques, not the user's approval or proof of performance.

Validation and performance receipts are recorded in [adhesive-verification.md](adhesive-verification.md) and the later [equipment pass](adhesive-equipment.md). User visual approval is complete. Production composition, its independent compatibility audit and measured costs are documented in [adhesive-main-verification.md](adhesive-main-verification.md). Historical equipment-lab timings remain separate. The combat lead coordinates the scoped shared-contract, production and verification commits; no push or deployment is part of this delivery.
