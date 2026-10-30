# Adhesive A equipment alignment

The approved [Tack Resin board](adhesive-design.md) calls for contained amber resin, a protective cage, a short connected pressure hose and an industrial applicator. The equipment pass provides these as runtime geometry, rather than attaching another elemental particle emitter to the muzzle.

`AlignedResinEquipment` in `src/rendering/quality/adhesive/alignedEquipment.ts` mounts a longitudinal cartridge on the visible receiver shoulder, with a shallow angle that exposes its length in first person. Dark end caps prevent the previous orange-button appearance. Four cage bars, end bands, bolted saddles, ribbed hose and a hollow stepped collar retain the existing weapon construction. Mech mounts face inward; secondary adhesive uses the opposite side and a smaller cartridge. Dimensions come from the authored receiver, barrel and muzzle, including compact, heavy and rotary forms. World matrices are refreshed before reading sibling receiver bounds.

Hardware uses the ordinary opaque depth, shadow and comic-outline passes. Only the wet resin is an overlay. Making the entire assembly an overlay erased its own cage depth; that candidate was rejected. Hardware is batched by three materials. The cartridge uses the exact existing calibrated solid-honey shader. Its cylinder exposes the long reflection, while the cage and opaque end caps provide dark edges. The accepted impact/stain material is unchanged. This is authored shading, not simulated refraction or fluid volume.

The valve receives bounded, independently varied pressure impulses from the existing shot event for the actual firing rig. Reload movement samples the existing magazine/breech pose. There is no second reload timer, gameplay random source, audio engine or update clock. `EquipmentEffectPresentation` owns update/disposal once. Original meshes, geometry, transforms, muzzle sockets and other material channels are borrowed; only adhesive-tagged materials are temporarily replaced and restored. The attachment has no collision or raycast surface.

## Interface and comparison

```ts
new AdhesivePresentation(scene, camera, {equipment: 'aligned'}); // opt-in default
new AdhesivePresentation(scene, camera, {equipment: 'previous'}); // prior receiver canister
```

The public equipment module also exposes `new AlignedResinEquipment(root, appearance, materialStyle?)`, `shot()`, `update(dt, time)`, `clear()` and idempotent `dispose()`. Pass an actual weapon owner and its appearance. Register its update/disposal through the shared equipment lifecycle; route a shot only to the firing rig. Preserve other elemental channels through the existing equipment presenter. Production composition should consume this interface under the integration owner's coordination, without stacking element adapters.

Build `npx vite build --config vite.adhesive-equipment.config.ts`, preview that config, and open `/adhesive-lab.html?equipment-align=1`. Both equipment versions run in the same compiled build with identical honey, stain profiles, combat and audio. The lab adds construction/form/primary/secondary controls and freezes actual idle, firing and automatic reload poses. The separately labeled inspection pose uses the same runtime item factory and Game renderer; it is not a gameplay-camera screenshot. Ordinary gameplay and recordings retain the real view rigs.

## Review evidence

The ignored `artifacts/adhesive-equipment/` package contains untouched 1440 × 900 Game canvas captures, full UI screenshots, native sound recordings, build/source provenance, raw matched performance receipts, boundary hashes and the two Opus reviews. The initial **Claude Opus 5.5** review rejected the lamp-like cartridge and invisible fittings. The revision moved and capped the cartridge, exposed the cage/hose, reduced the artificial glow and mirrored the mech mounts. The final reviews and any remaining visual differences are retained in the report, rather than being treated as user approval.

Only the approved board and gameplay/inspection images were supplied to Claude. Automatic review rejected an earlier request containing source/tests; those files were not sent. Claude assessed still images, not video, sound or performance.

Gameplay verification covers intact cloth/armor targets, pilot/mech idle/fire/reload, compact pistol/rifle/rotary construction, adhesive-primary/ice-secondary and the reverse. Tests additionally cover all 13 deliveries across four forms in both modes, exact original parts/muzzles/material restoration, preview ownership, nonweapon rejection, shot routing, pause/reset and stale matrix handling. Combat equivalence is checked separately by matched sustained-fire receipts. The initial equipment-specific shader caused each short-lived rifle shot to release and recompile the separate projectile honey program. A graphics-call trace identified recurring `getProgramParameter` stalls every shot. Sharing the standard honey shader with the persistent cartridge keeps that program referenced; a regression verifies identical shader source and independent material ownership. Frozen review views now use the shared `ReviewRenderDemand` helper and draw only when invalidated; live gameplay, recording and benchmarks always draw. Measurements include the whole rendered frame and native sound, with recording off and shared-machine load recorded; unique GPU samples and coverage accompany the results.

Normal Enhanced adoption remains the integration handoff after user visual approval. This equipment pass does not edit combat-lead-owned `src/game.ts`, `src/world.ts` or `src/ui.ts`, or adopt sibling elemental implementations.
