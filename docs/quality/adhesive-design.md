# Adhesive A — Tack Resin

30 October 2026. The user selected **A / Tack Resin** from the restarted, consistent illustrated concept review. This checkpoint records the approved concept before implementation.

Reference: `artifacts/concepts/adhesive-v2/a-tack-resin.png` (local generated paintover, not gameplay). A shared clean reference derived from the Fire concept board keeps the clothed/armored humans, framing and illustrated finish consistent. The mixed adhesive-v1 study is superseded.

## Approved visual and audio target

- Heavy golden-amber resin, dark honey depth, creamy restrained glints and an intact, readable target silhouette.
- Contact compresses into a small tack pad; one generous leading fold stretches outward with a shorter counterfold and trailing neck; it then sags back into a glossy localized deposit with weighted drips. Geometry must deform, not simply scale a static crown.
- Cloth remains visible and intact beneath the cosmetic resin. Armor response sits on the actual outer plate. Faces, body shape and armor remain intact; no gore, melting, material destruction or body deformation.
- Equipment accents are local to a caged feed cartridge, short hose and applicator collar. Projectiles retain their existing carrier and trajectory, with a short weighted resin neck and restrained beads.
- A primary explosive contact can carry the substantial fold; ordinary contacts are compact. Secondary recipients get smaller deposition, fewer beads and quiet contact, without another full primary fold or puddle.
- Sound: firm wet contact, short sticky tear, low peel/release and quiet weighted drips. Preserve the physical weapon report and use the existing bounded audio engine.

## Authority and ownership

Adhesive currently slows movement to 60% for three seconds. Adhesive is an element; sticky is a separate projectile delivery with its own contact, fuse and blast. This pass changes presentation only: no added roots, ropes, traps, tethers, damage, changed duration, collision, fuse, projectile behavior, radius, cover/exposure, muzzle or equipment-slot ownership.

New element modules belong in `src/rendering/quality/adhesive/`, recipes in `src/audio/adhesiveAudio.ts`, and review entry in `src/dev/effects/adhesive/`. Reuse neutral shared surface/contact helpers and the existing audio engine. `src/game.ts`, `src/world.ts`, `src/ui.ts`, active sibling effects and shared composition work remain outside this pass. Provide an integration interface/handoff.

## Review gate and completion evidence

First deliver an opt-in real-Game prototype with cloth and armored humans, moving attachments, representative deliveries and actual sound. Compare contact/peak/aftermath with the selected board at normal speed. Preserve the old renderer for same-build comparisons. Gameplay approval precedes adopting the prototype in normal Enhanced gameplay.

Verify visible outer-surface placement, floors/walls/slopes/raised tops/undersides/finite edges, primary/secondary hierarchy, mixed elements, pause/reset/dispose, borrowed geometry/material identity and slot/muzzle isolation. Record source/build fingerprints and screenshots. Run matched before/current/repeated-before sustained-fire measurements with multiple targets and sound enabled, capture off while timing; report frame median/p95, CPU/GPU cost, exact combat outcomes, hardware and coverage limits.

The paintover does not prove pixel-identical translucency, highlights, animation or performance. Remaining visual differences must be explicit in the playable review. This document is the approved direction; implementation and verification receipts follow separately. Do not push or deploy.
