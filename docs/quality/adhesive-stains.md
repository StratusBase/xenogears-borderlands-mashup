# Adhesive A / varied lingering stains

30 October 2026. The user authorized the next stain-shape pass while preserving [the honey material](adhesive-honey-material.md), combat, and the existing presentation. The approved reference remains `artifacts/concepts/adhesive-v2/a-tack-resin.png`.

## Scope and interface

`stains.ts` supplies immutable contact profiles with five silhouette families, 2–4 overlapping elliptical lobes, continuously varied aspect/offset/orientation and a 1.25-radius maximum extent. Every ellipse contains the contact origin: the union stays connected and has no holes. This avoids radial crowns, cutout holes and evenly spaced petals. The independent cosmetic sequence uses the neutral `EffectVariationSequence`; it does not consume or alter burst/gameplay randomness. Shape families do not repeat on consecutive events of the same track.

The first Opus critique confirmed real silhouette variation and preserved honey, but identified unequal coverage and upward/flame-like tongues. Profiles now normalize analytic union area to the fixed honey coat with only ±4% target variation (independent Cartesian checks allow less than ±8%). Family-specific body aspect keeps the normalized shapes distinct. Body/wall orientation follows source-projected world-down with bounded jitter; horizontal planes retain free orientation where gravity has no in-plane direction. The existing drip emitter/trajectory remains unchanged. The first critique and captures are preserved in `review-1/`.

`stainShader.ts` consumes each profile once selected and reuses the unchanged honey lighting, palette, opacity, contour and convex-normal formulas. Source-local tangents preserve a consistent contact plane on rotated/nonuniformly scaled meshes and stay attached as targets move. Parameters are retained; they are not rerolled each frame or billboarded to the camera. The existing bounded mask/contact/status lifecycle remains the sole resource owner.

Overlapping new primary coats refresh nearby deposits rather than averaging many outlines into a round patch. Smaller direct/secondary deposits cannot clear or evict larger primary coats, including at the four-contact cap. Separated contacts use the existing bounded slots; authoritative status expiry/intensity still owns release. These are visual storage choices, without changes to gameplay damage, blast area or status rules.

Refreshed coats inherit their reveal progress rather than repeatedly restarting a sweep during sustained fire. The varied reveal covers the complete bounded footprint. No particle placement or physical effect radius changes are involved.

```ts
new AdhesivePresentation(scene, camera); // honey + varied stains
new AdhesivePresentation(scene, camera, {
  material: 'honey', stains: 'fixed', visualSeed: 37391,
}); // exact previous honey coat field for comparison
```

Fixed mode does not generate unused varied profiles. Existing fixed honey and older material shaders remain available. The public adapter still uses `GamePresentation.setElementalFactory`; production composition remains the explicit handoff in [adhesive-integration.md](adhesive-integration.md). Combat-lead-owned `src/game.ts`, `src/world.ts` and `src/ui.ts` are outside this pass. Normal-main adoption awaits user visual approval.

The honey helper/palette, burst geometry/motion/variation, particle and pad poses, audio recipe, energy/exposure sizes, fuse, projectile behavior, collision, damage, status duration/modifiers, slots and muzzles are unchanged. Raised volume, hanging drips, pull silhouette and stronger retraction remain separate follow-ups.

## Review and reproducibility

Build with `npx vite build --config vite.adhesive-stains.config.ts`, preview on localhost:5281. Output: ignored `artifacts/adhesive-stains/build`; original prototype and honey-material frozen builds remain intact. The comparison is fixed honey stains → varied honey stains → fixed repeat in one compiled build, with transformed-source hashes and explicit shared-source provenance.

The actual-Game lab adds a settled +917 ms freeze and a continue-sequence control. Continue uses real ammo, cadence and auto-reload, without resetting cosmetic or combat state; it tracks only new contacts rather than accidentally freezing on an earlier hit. Independent live seeds remain the normal setting; fixed review seeds enable exact comparisons. Separate-save high-health human fixtures preserve actual Game collision, fuse, damage and statuses; scripted motion is attachment testing, not an AI/slowdown demonstration.

Eight chronological real detonations were captured on cloth and armor for both modes. Complete combat snapshots and original cosmetic event receipts match at every corresponding shot. Stain profiles are logged separately because that is the intended change. All image sheets are unpainted crops of actual screenshots. Claude Opus 5.5 reviews the approved board, these sheets and bounded source access with Read tools only; its result is peer critique, not user approval or a sound/continuous-video assessment.

## Automated validation

New checks cover deterministic profiles, bounded silhouettes, connected/hole-free radial sections, geometric variation after removing rotation, 2/3/4-lobe cases, stability during updates, repeated primary coalescing, small-deposit protection under slot pressure, cross-source coordinate agreement under rotation/nonuniform scale, borrowed-resource identity, and fixed/varied equality for bursts, sizes, droplet/pad poses and expiry. Existing all-13-delivery, slot/muzzle, immutable recipe, lifecycle and mixed routing checks remain in force.

All **32 adhesive tests and all 878 repository tests pass**. The normal production build and frozen review build pass. The normal build retains the existing large-chunk advisory. The review tab reports no runtime errors.

## Final gameplay and peer review

[Open the gameplay/sound report](http://127.0.0.1:5186/artifacts/adhesive-stains/) or [play the frozen actual-Game lab](http://127.0.0.1:5281/adhesive-lab.html). Eight settled shots per target/mode retain 16/16 exact matched combat and original burst-event receipts. Four native-time, 14-second repeated-fire clips contain real firing, impacts, fuse, reload and lingering sound on human and armored fixtures. An additional armored rifle clip checks sustained refresh. Audio recipes have not changed. Native WebM decoding reports an Opus packet-header warning; MP4 exports succeed, with 13.92–13.98 seconds of decoded sound and zero clipped PCM samples in the four primary clips. Raw warnings and originals remain available; this is signal validation, not a separate listening-panel assessment.

Actual shots also verify floor, wall, raised top, slope, underside, finite ledge, moving armor with corrosive secondary, beam with ice secondary, and mech sticky firing. Full screenshots and Game snapshots are in `runtime-coverage.json`. Marks stay source-bound and respect the surface normal; small secondary coats retain their hierarchy. Scripted fixture motion verifies attachment, not AI behavior. A short rifle-video inspection shows changing refreshed outlines; the profile can still swap immediately at a new hit, rather than morphing between profiles.

Claude Opus 5.5 reviewed the approved A board, chronological human/armor sheets and source twice, using read-only tools. Its final P2 verdict is **met on both targets, but only just**, with no necessary corrections. It confirms consistent coverage, downward-biased mass, preserved honey and smaller secondary marks, with no holes, petals, flame tongues, detached coat patches or spinning stamps. It still considers several rounded silhouettes too similar. Stronger tongue shapes are optional tuning, not implemented here. The complete critique and model receipt are retained; peer review is not user approval. Raised volume, hanging drips, stronger pull/retraction and existing material banding remain separate follow-ups.

## Matched performance results

Apple M5 Max / ANGLE Metal, Chrome 156, 1440 × 900 DPR 1. All modes run in the same frozen compiled build (`2026-10-30T13:21:23.735Z`); no runtime changes followed. Each comparison runs fixed honey → varied honey → fixed repeat, with 120 warmup + 720 displayed measured frames per mode, one 1/60 Game step per displayed frame, seed 37391, six fixtures, sound unlocked/on and capture off. Rifle reaches three front-row targets; sticky and mixed scenes reach all six. Combat and original burst events are identical in every comparison. Source/build hashes include the actual shared work compiled alongside adhesive.

Median / p95 frame milliseconds:

| Scene | Fixed before | Varied | Fixed repeat |
| --- | ---: | ---: | ---: |

| rifle | 13.60 / 20.90 | 13.30 / 16.70 | 13.40 / 16.10 |
| sticky | 15.20 / 21.80 | 18.10 / 26.80 | 16.70 / 22.60 |
| mixed | 15.70 / 25.90 | 16.00 / 24.30 | 14.80 / 17.20 |
| sticky-repeat | 12.50 / 14.70 | 13.80 / 18.80 | 12.40 / 17.60 |

The repeated sticky comparison confirms an added cost: median +1.30 ms against its first fixed run and +1.40 ms against its repeated baseline (about 10–11%). Its varied GPU median is 3.32 ms versus 2.74 / 2.97 ms fixed, while Game CPU medians are 1.40 versus 1.30 / 1.30 ms. Initial sticky results are retained, not replaced by the repeat. Draw counts, geometry and texture counts remain equal within every comparison. GPU/CPU/source attribution is not isolated by this scene-level measurement.

Frame stalls and shared-host variance remain visible: the original runs contain 99–174 ms maxima; the sticky repeat contains 84–103 ms maxima. No speedup, zero-regression or other-device claim is made. Full median/p95/min/max frame, Game CPU, submission CPU, GPU, draw, geometry, texture and peak voice/pool receipts are linked from the report. The extra sticky run investigates the first sticky regression; no settings or scene were changed to conceal it.
