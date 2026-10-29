# Corrosive A+B: directional rupture

29 October 2026. Existing prototype committed first as **547cc49**, following the user's request. The directional revision was approved after gameplay review. It is now enabled in normal Enhanced gameplay; see [the main-entry integration receipt](corrosive-main-integration.md). The measurements below remain the frozen revision 4 comparison prototype.

- [Actual gameplay with live sound, motion frames and performance](http://127.0.0.1:5202/artifacts/corrosive-ab/).
- [Play the measured compiled build](http://127.0.0.1:5203/corrosive-lab.html).
- [Complete matched performance and combat outcomes](../../artifacts/corrosive-ab/verification.json).
- [Motion/size/state comparisons at matching actual-game times](../../artifacts/corrosive-ab/motion-review.json).
- [Recording provenance and compiled hashes](../../artifacts/corrosive-ab/recordings.json), [decoded audio measurements](../../artifacts/corrosive-ab/audio-measurements.json).

## Revision 4

The previous onset combined an instant round coating with three fans expanding about one origin. The new version moves a leading sheet, a shorter counter jet and a delayed trailing strand along unequal paths. Their tails follow the heads, the sheets roll in depth, gravity bends their paths and open edges tear away. Geometry deforms each frame instead of scaling a fixed silhouette. Surface coating reveals along an asymmetric streak, rather than appearing instantly as a complete disk. Existing wet contact / tearing / bubbling / sizzle recipes play from the actual game events.

The sizing module is byte-for-byte unchanged. Primary size parameters, coating radius bounds, drop counts and sizes, energy, exposure, target projection and fixed pool capacities remain. Secondary recipients keep their previous deposition shapes, particle transforms, sizes, counts, quiet sound and actual damage falloff. They never produce another full rupture sheet or floor puddle. The motion audit compares complete event arrays exactly between previous and directional modes. Five matched gameplay comparisons preserve full shots, hits, vitals and status timing.

Current three-target audit:

- Direct: size parameter 107 cm, coating radius bound 57.3 cm, 29 droplets; exposure 100.0%.
- Near: size parameter 0 cm, coating radius bound 14.3 cm, 6 droplets; exposure 61.2%.
- Edge: size parameter 0 cm, coating radius bound 7.3 cm, 3 droplets; exposure 14.2%.

The effect remains stylized, authored liquid motion, rather than a fluid solver. Non-robot targets stay intact with clothing, faces and armor; no wounds, exposed tissue, melting, dismemberment or body deformation. Surface pitting is cosmetic. This is an isolated normal-Game review harness with raised target health, rather than an ordinary encounter or new story canon.

## What changed and what remains isolated

- New rupture.ts owns the deformed mesh and shading. previousRupture.ts preserves the revision 3 geometry/shaders for a same-build comparison. Ten independent fixed-capacity burst meshes avoid shared animation state; existing bounded drop/bubble/residue/vapor pools remain.
- liquid.ts integrates the directional motion and its primary spray direction. surfaces.ts adds per-contact reveal age/direction for primary coatings. Tiny secondary marks keep their existing shape and world-unit radius.
- The optional corrosiveMotion selector defaults to directional only inside corrosiveAB. Both the prior main renderer and prior corrosive motion remain usable.
- No edits to game.ts, world.ts, ui.ts, PlayerBallistics.ts or sizing.ts in this revision. [Boundary before](../../artifacts/corrosive-ab/revision-4-boundary-before.sha256) · [Boundary after](../../artifacts/corrosive-ab/revision-4-boundary-after.sha256). No equipment-slot, muzzle, swept collision, projectile trajectory/fuse, blast, damage or authoritative status changes.
- Display meshes still opt out of combat raycasts. Local visual ray/triangle projection keeps coatings on visible armor and rejects equipment descendants. Source meshes, materials and geometry are borrowed without modification.

## Verification

**648 tests passed for the frozen motion prototype**, including 35 corrosive checks and 4 footstep checks. New checks require actual mesh deformation beyond uniform scale, a dominant leading stream, paused geometry stability, exact prior/after event sizes and secondary instance transforms, and separate primary reveal clocks. Existing tests cover original collision/critical hits, immutable specs, slot isolation, local visible-material binding, finite values, cleanup and bounded resources.

Ordinary production and isolated prototype builds pass; the existing large-bundle advisory remains. Exact old-engine/current-engine replay against Git baseline ddb86b155e4e9979303894a0501b544458997f3d matches all 13 deliveries, 600 steps each, including moving neighbors, cover and critical hits: [source compatibility evidence](../../artifacts/corrosive-ab/ballistics-before-after.json).

Actual compiled gameplay covers clothed and armored humans, exposed skin, ground, moving attachments, sticky, rifle, scatter, beam, rocket, slug, secondary fire channel and mech firing. Actual Escape pause freezes visual instances and silences the audio buses. The motion audit steps the real Game to 25, 100, 200, 330 and 650 ms after actual sticky detonation, comparing both visual modes and full combat snapshots. No page or shader errors were recorded in the final verification.

## Matched performance

Hardware: ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version). Same compiled assets, 1440 × 900 at DPR 1. Each row is **previous rupture → directional rupture → repeated previous rupture**, with the same current sizing and secondary falloff. Same target geometry, seed, camera, weapon and initial state. 90 warmup + 360 measured displayed frames, one existing 1/60 simulation step per frame. Sound enabled; recording disabled during measurement.

| Scene | Frame median ms previous / directional / repeat | Frame p95 previous / directional | CPU draw median ms previous / directional / repeat | Whole-frame draw median | GPU median ms previous / directional / repeat |
|---|---:|---:|---:|---:|---:|
| human-rifle | 8.30 / 8.30 / 8.30 | 10.40 / 10.40 | 2.60 / 2.60 / 2.70 | 1330 → 1330 | 1.35 / 1.26 / 1.44 |
| armor-rifle | 8.30 / 8.30 / 8.30 | 10.40 / 10.60 | 2.40 / 2.80 / 2.60 | 1363 → 1363 | 1.21 / 1.29 / 1.10 |
| human-sticky | 8.30 / 8.30 / 8.30 | 9.40 / 9.40 | 2.60 / 3.10 / 2.70 | 1338 → 1338 | 1.31 / 1.39 / 1.36 |
| armor-sticky | 8.30 / 8.30 / 8.30 | 9.40 / 9.30 | 2.70 / 2.80 / 2.60 | 1364 → 1364 | 1.63 / 1.51 / 1.29 |
| crowded-six-sticky | 8.30 / 8.30 / 8.30 | 9.40 / 9.50 | 4.10 / 4.10 / 3.80 | 2060 → 2060 | 1.29 / 1.35 / 1.27 |

CPU draw measures renderer submission. Deforming-mesh updates occur in the game step and contribute to displayed frame intervals. Whole-frame draws count every pass. Display pacing may mask extra work; GPU baseline drift limits causal comparisons. These are high-end Mac measurements, not proof for lower-end/mobile/high-DPI or full encounters. Complete distributions are in the raw report. All current combat videos and timing use the hashes below. Archived revision 3 and revision 2 walking clips are explicitly separate.

## Runtime sound and recordings

Six clips record native Game.run timing and the WebGL canvas with live final physical and elemental WebAudio buses. Before clips select previous rupture, after clips select directional rupture in this same measured build. Compiled asset hashes are verified before and after capture. Original weapon cadence, sticky fuse and status ticking drive the footage. Canvas capture omits HTML HUD; gameplay screenshots include it. MP4 transcodes preserve recorded frame timestamps. No painted effects, slow motion, offline sound replacement or audio normalization.

- human-before-sticky.wav: peak 0.5375, RMS 0.0118, 5.52 s, 0 clipped PCM samples.
- human-ab-sticky.wav: peak 0.5547, RMS 0.0118, 5.52 s, 0 clipped PCM samples.
- armored-before-sticky.wav: peak 0.5468, RMS 0.0117, 5.52 s, 0 clipped PCM samples.
- armored-ab-sticky.wav: peak 0.5845, RMS 0.0118, 5.52 s, 0 clipped PCM samples.
- human-ab-bullet.wav: peak 0.5827, RMS 0.0244, 6.00 s, 0 clipped PCM samples.
- armored-ab-bullet.wav: peak 0.5924, RMS 0.0244, 6.00 s, 0 clipped PCM samples.
- sizing-review.wav: peak 0.5281, RMS 0.0089, 4.80 s, 0 clipped PCM samples.
- footsteps/before.wav: peak 0.1724, RMS 0.0047, 4.92 s, 0 clipped PCM samples.
- footsteps/after.wav: peak 0.0096, RMS 0.0004, 4.98 s, 0 clipped PCM samples.

Walking clips are retained revision 2 auditions; footsteps are unchanged here.

## Integration handoff

1. Use ElementalPresentation(scene, camera, {corrosiveAB:true}) for the new motion. Add corrosiveMotion:'previous' to retain revision 3 motion with the same sizing and falloff. Standalone ElementalPresentation defaults retain the prior profile. Production GamePresentation now explicitly selects the approved corrosive profile. The lab exposes a separate rupture toggle. The approved visual direction is now integrated through production GamePresentation without combat-owned source edits.
2. GamePresentation.setElementalFactory(factory) remains available only while disabled. Game owns presentation mode/status/equipment lifecycle. No edits to combat-owned files are required for this prototype.
3. Body meshes should tag userData.corrosiveSurface as skin, cloth or armor. All equipment-slot and presentation descendants are excluded. CorrosiveStatus borrows geometry, owns/disposes only overlays and uses source-local anchors with world-unit radii.
4. Existing BallisticPresentationImpact energy/exposure and optional splash notification are unchanged. CorrosiveResponse.impact presents the primary response; splash skips primary recipients and presents existing secondary deposition. Never use these callbacks to apply damage.
5. Existing gesture unlock, sound toggle, pause, distance attenuation and audio voice caps remain. recordingStreams() taps the same final buses only for requested captures. Dispose statuses before target display resources, then dispose/release the presentation on the existing lifecycle.

## Reproduce

Run node scripts/verify-corrosive-tests.mjs and node --import tsx scripts/verify-ballistic-feedback-compat.mjs. Run npm run build, then npx vite build --config vite.corrosive.config.ts. Serve npx vite preview --config vite.corrosive.config.ts --port 5203 and the workspace Vite server on 5202. Run scripts/verify-corrosive-motion.mjs, scripts/verify-splash-scaling.mjs, scripts/verify-corrosive-ab.mjs, scripts/record-corrosive-ab.mjs and scripts/package-corrosive-media.mjs sequentially. Never record during timing. Run scripts/build-corrosive-review.mjs and scripts/verify-corrosive-review-ui.mjs for the gallery. PLAYWRIGHT_MODULE, CHROME_EXECUTABLE and CORROSIVE_REVIEW_URL override local paths/origin. Media packaging requires ffmpeg/ffprobe.

Measured compiled fingerprints:

- corrosive-lab-BxlOeTvP.js: SHA-256 e5b0bbf9077577874f49a7995d52571025f09dde0db1471636a23f8921d91baa
- corrosive-lab-DHm56mDP.css: SHA-256 7ad7ef75ac6ed97a26af7445229bfad401959242d5547cfaeade3df4a719aaa4

The existing prototype was committed as 547cc49 before this revision. No push or deployment was performed.
