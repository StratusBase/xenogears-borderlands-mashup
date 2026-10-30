# Adhesive A integration handoff

The approved direction is [Tack Resin](adhesive-design.md). The playable prototype remains opt-in pending gameplay/material approval. Normal Enhanced has not adopted this adapter. Legacy and the previous adhesive renderer remain available. No changes to combat-lead-owned `src/game.ts`, `src/world.ts` or `src/ui.ts` belong to this pass.

## Review entry

`npx vite --host 127.0.0.1 --port 5186 --strictPort` serves `/adhesive-lab.html`. For a frozen comparison, build with `npx vite build --config vite.adhesive.config.ts`, then preview that config on a free port. The review build contains both prior adhesive and Tack Resin, plus transformed-source SHA-256 provenance. The lab locks the renderer/camera to 1440 × 900, DPR 1.

The entry uses the actual `Game` evaluation driver and isolated save `dust-steel.adhesive-a.review.v1`. Human fixtures replace only visual models; authoritative projectiles, collisions, sticky fuse, damage, statuses, ammo, heat and reload still run through Game/PlayerBallistics. High-health training targets allow repeat review without killing the fixture. The move checkbox is scripted attachment testing, not an AI or slowdown demonstration. Surface tests move the human fixtures out of the shot path.

Use **Replay repeated shots with sound** to assess variation at native speed. **Fire real shot / freeze peak** freezes seven simulation frames after the actual event; **Show settled resin** advances one second. Record controls mix the actual final physical/elemental audio buses; they do not replace or normalize sound. Measurements keep recording off.

## Public adapter and existing seam

```ts
import {AdhesivePresentation} from './rendering/quality/adhesive/presentation';

// GamePresentation must be disabled while changing the factory.
presentation.setElementalFactory((scene, camera) =>
  new AdhesivePresentation(scene, camera));

// Optional exact review sequence, never a gameplay RNG:
new AdhesivePresentation(scene, camera, {visualSeed: 37391});
```

This is a single opt-in adapter over the current lifecycle, not a proposed chain of element adapters. Production integration should register the adhesive response through the shared composition contract under its owner's coordination, consume the adhesive impact channel once, and suppress the old generic adhesive burst. Do not blindly layer the adapter over another element adapter. Preserve the existing status lifecycle and shared audio owner. Sibling element implementations must not import adhesive internals.

`AdhesiveResponse.impact()` consumes the existing presentation impact receipt. It uses `point`, `normal`, `target`, optional `hitSurface`, immutable `spec`, `phase`, `radius`, energy and exposure. `splash()` only decorates secondary recipients. `status(root)` returns the shared structural `SurfaceStatusVisual` interface. `release`, `clear` and idempotent `dispose` own only temporary resources. The existing superclass retains update/audio/status scheduling and nonadhesive routing. Borrowed source geometry, original materials/raycast functions and all equipment sockets remain intact.

## Modules and budgets

- `adhesive/resin.ts`: closed thick sections, authored amber shading and event-specific deformations. Five families with continuously varied pull counts, handedness, lengths, curvature, bead weight, growth and gravity sag. Geometry stays outside its contact plane. No hole mask, flat radial petals or fixed signature spike.
- `adhesive/response.ts`: actual outer-surface resolution, anchors, finite-support drops and bounded pools: 10 folds, 192 drops, 96 pads, 16 environment masks and 32 statuses.
- `adhesive/sizing.ts`: cosmetic energy/delivery/exposure curves; secondary response has no full fold, smaller deposits and fewer beads. Variation stays within these size envelopes.
- `adhesive/surfaces.ts`: source-local coats/drips and authoritative intensity/expiry. Cloth remains visible; armor selection uses the outer plate. Ground residue is cosmetic and adds no hazard.
- `adhesive/equipment.ts`: owned weapon-slot cartridge/feed/collar, short projectile neck and trail. It preserves the carrier transform, original construction and muzzles.
- `audio/adhesiveAudio.ts`: wet contact/tear/release/drips via the existing audio engine and budgets. Other recipes pass through unchanged.
- `shared/variation.ts`: independent cosmetic seed sequence and nonrepeating variant families per named event track. A profile is chosen once per event, never rerolled per frame. Default instances obtain independent seeds; explicit seeds/reset support exact review. Contact/secondary events cannot force repeated detonation families. No `Math.random` or gameplay RNG is consumed.

The variation standard is now recorded in [the effects architecture guide](../effects-architecture.md). This shared helper is implemented and used by adhesive. Existing elements have not been silently rewritten; their owners should apply the standard as they revise them.

## Fidelity and review limits

The concept is a generated paintover. Runtime resin uses bounded procedural geometry, surface overlays and authored glints; it does not simulate optical refraction, fluid volume or armor/material destruction. No gore. Human fixtures preserve the game style but are review models, not a claim that the normal enemy roster has been replaced. Current material and motion remain subject to visual review against the board. A separate Claude review is read-only and must not be described as visual approval or proof of performance.

Validation and current performance receipts are recorded in [adhesive-verification.md](adhesive-verification.md). Adoption in normal Enhanced gameplay remains the next integration gate after the user's visual approval.
