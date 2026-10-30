# Adhesive A / honey-material pass

30 October 2026. The user authorized the material-only priority from the [Opus review](adhesive-opus-review.md), including a new Claude review on human/armor, actual gameplay with sound and matched performance. The approved board remains `artifacts/concepts/adhesive-v2/a-tack-resin.png`.

## Change and authority boundary

`adhesive/material.ts` owns a thickness-dependent amber/gold palette and restrained warm reflections. Thick bodies have amber depth; thin resin is saturated gold; the coat has a darker amber contour inside its existing footprint. Fold thickness is one additional scalar attribute on owned geometry. The coat's apparent curvature comes from the winning existing lobe, with a vertex-supplied basis for view-space normals. This is authored shading, not new fluid geometry, optical refraction or simulation.

The first Opus check rejected a too-brown core, luminous cloth rim and screen-aligned streak. Those were corrected within material scope: a calibrated gold midband, lighter thick amber, darker contour with greater opacity, and depth-gated highlights following existing lobes. Both critique rounds and their images are preserved under ignored `artifacts/adhesive-honey/`, including `review-1/`.

A second review judged the material goal met on both target types, but found the virtual coat normal was concave. Both tangent signs were corrected to create a convex coat, then the final images were reviewed again. Opus confirmed the source correction and upper-left highlight placement on cloth and armor, and returned **P1 material: met**. CLI result metadata identifies `claude-opus-5-5` in every round. Only Read tools were allowed; no edits/commands were delegated. The final delta check is `claude-convex-check.{json,md}`; prior critique/image sets are in `review-1/` and `review-2/`.

That is a peer material assessment, not user visual approval. The reviewer still sees limited glint richness, some concentric banding and flat deposited volume. Fixed stamps, thin pulls, hanging drips/heavy aftermath and retraction remain separate follow-ups. The review used still frames and source, without continuous-video viewing, sound listening, pixel acceptance measurements or other-device shader testing.

No burst geometry, footprint boundary, size, seed sequence, phase timing, particle motion, sticky fuse, trajectory, collision, exposure, damage, status rule, muzzle, slot ownership or audio recipe was changed. The fixed lingering stamp, pull silhouette, hanging drips and stronger retraction remain separate follow-ups. Main Enhanced adoption still awaits user visual approval.

## Interface and comparison

```ts
new AdhesivePresentation(scene, camera); // honey material in the opt-in adapter
new AdhesivePresentation(scene, camera, {
  material: 'previous', // exact previous Tack Resin shaders
  visualSeed: 37391,
});
```

The existing `GamePresentation.setElementalFactory` handoff remains unchanged. The adapter is not registered in normal main by this pass; combat-lead-owned `src/game.ts`, `src/world.ts` and `src/ui.ts` were not edited. Legacy/generic rendering remains available. The previous fold, particle, coat vertex and coat fragment strings match checkpoint `d66aaf0` byte-for-byte; hashes are in `compatibility.json`.

The review lab compares previous Tack Resin against honey, with the same adapter, animation and sound recipes in both modes. Review controls offer independent live variation or fixed cosmetic seeds 37391/95017, plus 6.4/12/20 m views. Fixed review seeds do not consume or change combat randomness. Production integration should continue through the common composition seam described in [the handoff](adhesive-integration.md), with one event contribution per element.

Build: `npx vite build --config vite.adhesive-honey.config.ts`; preview: `npx vite preview --config vite.adhesive-honey.config.ts --port 5251 --strictPort`. The output is `artifacts/adhesive-honey/build`, preserving the preceding frozen build and report. Actual entry: `http://127.0.0.1:5251/adhesive-lab.html`; evidence report: `http://127.0.0.1:5186/artifacts/adhesive-honey/`.

## Color-path verification

Six opt-in cards render in the actual Game scene, through the existing ComicRenderer/ACES exposure 1.05/OutputPass/sRGB/FXAA pipeline. The diagnostic samples the default framebuffer immediately after rendering and compares it with the installed Three.js ACES matrix/fit and sRGB transfer. It uses no alternate renderer, global exposure change or replacement light. Cards are removed/disposed before gameplay and measurement.

| Card | Actual and expected display RGB | Maximum byte error |
|---|---|---|
| Previous raw linear body | 209, 144, 38 | 0 |
| Honey thin | 209, 142, 19 | 0 |
| Honey middle | 228, 155, 29 | 0 |
| Honey thick | 168, 86, 7 | 0 |
| Honey outline | 116, 61, 8 | 0 |
| Honey reflection | 245, 233, 185 | 0 |

These are palette cards, not a claim that every blended/illuminated gameplay pixel equals a card. The reflection input is HDR linear light; the unchanged output pass produces warm cream rather than unbounded white. Successful numerical calibration does not establish visual acceptance.

## Gameplay and behavior evidence

Matched human and outer-armor peak/one-second aftermath at 6.4 m and peak at 12 m have identical complete combat AND cosmetic event receipts. Screenshots retain intact human models, original source surfaces and smaller secondary deposits. Four native-time 14-second recordings compare both materials on both target types, including actual final physical and elemental audio buses. No replacement sound, gain normalization or retiming. Additional wall/floor, moving/mixed-element and mech checks are in the runtime coverage receipt.

`npm test` passed **811 tests**, including 27 adhesive cases. Both material modes preserve exact hit receipts, immutable recipes and projectile-root poses across all 13 deliveries against the existing renderer. New checks prove optical thickness changes no vertex, normal, index, source anchor, pool pose, event size, random profile or expiry. Existing slot/muzzle, borrowed-resource, lifecycle, contact-plane and sound-routing checks pass. `npm run build` and the dedicated review build pass; Vite retains its large-chunk advisory.

The frozen build's transformed-source provenance includes actual concurrent shared source. Runtime hashes, exact previous shaders, raw state comparisons, captures, audio checks and same-build timing receipts are linked by `artifacts/adhesive-honey/index.html`. The final peer review is recorded above; matched measurements follow below. Review fixtures are high-health human visuals in the real Game, not a claim of complete AI encounters or roster replacement.

## Final matched performance

Hardware: `ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version)`, Chrome 156, 1440 × 900 DPR 1. All modes in the same final compiled build; previous Tack Resin → honey → previous repeat. Each run uses 120 warmup + 720 measured displayed frames, a fixed 1/60 Game step per frame, fixed combat/cosmetic seed 37391, sound on, recording off and a visible document. The six fixtures include cloth and armor. Rifle hits three front-row targets; sticky and mixed runs hit all six.

All nine runs have identical complete combat snapshots and cosmetic event receipts within their scenario. Table values are median / p95 milliseconds; Game CPU and render submission CPU are separate measurements. GPU queries can lag a completed frame.

| Scene | Material | Frame | Game CPU | Submit CPU | GPU |
|---|---|---|---|---|---|
| rifle | before | 12.20 / 15.20 | 1.70 / 3.60 | 6.00 / 8.50 | 2.82 / 4.74 |
| rifle | current | 10.90 / 15.60 | 1.60 / 3.30 | 5.60 / 10.90 | 1.97 / 3.60 |
| rifle | before-repeat | 11.10 / 13.50 | 1.60 / 3.40 | 5.20 / 7.50 | 2.59 / 3.94 |
| sticky | before | 11.20 / 17.00 | 1.40 / 1.90 | 6.00 / 11.20 | 2.04 / 3.65 |
| sticky | current | 10.70 / 13.70 | 1.40 / 1.80 | 5.90 / 9.00 | 2.23 / 3.53 |
| sticky | before-repeat | 10.20 / 12.80 | 1.30 / 1.80 | 5.00 / 8.10 | 2.08 / 3.37 |
| mixed | before | 10.00 / 10.90 | 1.40 / 1.90 | 4.20 / 5.00 | 2.12 / 3.47 |
| mixed | current | 10.00 / 11.00 | 1.50 / 2.20 | 4.60 / 5.60 | 2.32 / 3.61 |
| mixed | before-repeat | 10.00 / 10.90 | 1.30 / 1.80 | 4.00 / 4.80 | 2.21 / 3.48 |

Frame medians range from 10.0–12.2 ms before and 10.0–10.9 ms with honey, but baseline repeat drift prevents a speedup claim. Mixed Game CPU rises from 1.4 to 1.5 ms median (repeated baseline 1.3 ms); p95 rises from 1.9 to 2.2 ms. Sticky has isolated long frames: 59.2 ms before, 65.5 ms honey and 67.1 ms repeated before. This is not a stutter-free signoff or other-device certification. Raw receipts retain distributions, draw/triangle/resource counts, pools and voice peaks.

Actual wall/floor shots, moving armored + corrosive, beam + ice and mech sticky fire passed; final-build browser error logs are empty. Pixel/photometric thresholds proposed by the reviewer were not measured on the actual resin; only the six output cards were numerically sampled.

All four final clips decode 13.98 seconds of native mixed audio. Unnormalized decoded mono peaks range 0.808–0.853, RMS 0.0148–0.0152, with zero samples at or above magnitude 1. The native WebM decoder emits an Opus packet warning, retained in `audio-validation.json`; MP4/AAC exports are available for playback. No replacement or normalization was applied. These checks prove a nonempty, unclipped capture, not a subjective listening assessment. The material pass leaves the audio recipe byte-identical.
