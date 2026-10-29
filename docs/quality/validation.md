# Gameplay, visual and performance verification

This records the earlier isolated quality pass and its original build. For the subsequently integrated normal game, use [main-game validation](main-integration.md). Measurements from these different builds must remain separate.

Captured from the compiled local review build on October 29, 2026. All screenshots show the actual Game and proving ground. None are generated concept images.

## Results

- `npm run build`: passed. Vite reports its existing large game-chunk advisory.
- `npm test`: **332 / 332 passed**, including **34 new quality regressions**.
- `scripts/verify-quality.mjs`: passed in installed Chromium with actual DOM keyboard/mouse input and mouse capture. No page or shader errors were reported.
- A real pilot shot consumed ammunition, created 13 pooled particles and 5 audio voices, and produced a ballistic hit on the actual sentry. Magazine/bolt reload timing and moving magazine were checked.
- Pilot movement, real enemy navigation/windup, F mounting, mech movement/firing/reload and ground dust were exercised. Pause left zero live audio voices. Renderer toggles restored one mech display without duplicate attachments.
- Four payloads were fired through actual equipment refresh and ballistics: fire/bullet, ice/beam, corrosion/sticky and shock/arc. Display coatings conform to authored armor while hit geometry stays authoritative.
- Real-ballistics regressions compare complete hit events, critical flags, points, directions, damage/specs, cover blocking and rocket splash before/after art changes. Equipment tests retain exact muzzle matrices/parents, reload homes and unrelated slot resources.

Raw evidence: [gameplay assertions](../../artifacts/quality/gameplay-validation.json), [performance samples](../../artifacts/quality/performance.json).

## Matched performance

One frozen `quality-field-v1` scene; identical pilot camera, equipment, enemy, mech, terrain, viewport and compiled build. Both configurations remain in the same page. Warmup: 90 frames each; 180 recorded frames each; then a repeated original baseline with 60 warmup / 180 recorded frames. Sound is paused during measurement. Counts include normal, shadow, beauty, ink, overlay, output and antialiasing passes.

Hardware: **ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version)**, WebGL 2, hardware GPU timer queries. Viewport **1440 × 900**, DPR **1**. This is a headless local Chrome rendering measurement, not a lower-end-device guarantee.

| Measurement | Original | Reference | Original repeat |
|---|---:|---:|---:|
| Frame median (ms) | 8.30 | 8.30 | 8.30 |
| Frame p95 (ms) | 9.20 | 9.20 | 9.20 |
| CPU render submission median (ms) | 2.80 | 2.90 | 2.70 |
| GPU median (ms) | 2.93 | 2.43 | 2.17 |
| GPU p95 (ms) | 4.43 | 3.71 | 2.79 |
| Multipass draw calls | 1102 | 1111 | 1102 |
| Rendered triangles | 17105 | 55315 | 17105 |

The median frame interval remained 8.30 ms (about 120 Hz). Reference geometry adds **9 whole-frame draw calls** and **38,210 rendered triangles**. Bevels and articulated shapes increase triangle cost; rigid parts share material batches. GPU timing varies enough between the two original samples that the reference's lower GPU median is **not evidence of a speedup**. CPU submission measures rendering calls; frame intervals include the game loop and display scheduling.

Scope: one enemy, one parked mech and the current proving ground at DPR 1. Full encounter density, high-DPI/mobile/low-end hardware, a sustained combat load and long-session memory behavior remain separate measurements. Repeated toggles returned the baseline to 561 active uploaded geometries / 20 textures in both original samples.

## Audio evidence

[Play the original 7.2 second sound audition](../../artifacts/quality/reference-audio.wav). It renders the same voice recipes, filters, gain staging and compressor used live: pilot report/reload/step, mech report/hydraulics/step, then metal, shield and dust impacts.

48 kHz mono PCM; measured peak **0.600** (-4.44 dBFS), RMS **0.0217** including silence. No clipped samples. Browser verification confirmed gesture unlock, active playback voices, mute/pause cleanup and bounded voice counts. Final speaker/headphone mix approval remains a listening review.

## Screenshots

Original and reference share the same compiled scene and camera.

| Original | Reference |
|---|---|
| ![Original field](../../artifacts/quality/original-field.png) | ![Reference field](../../artifacts/quality/reference-field.png) |
| ![Original enemy](../../artifacts/quality/original-enemy.png) | ![Reference enemy](../../artifacts/quality/reference-enemy.png) |
| ![Original mech](../../artifacts/quality/original-mech.png) | ![Reference mech](../../artifacts/quality/reference-mech.png) |

Actual action captures:

- [Pilot firing and surface impact](../../artifacts/quality/reference-firing.png)
- [Pilot magazine reload](../../artifacts/quality/reference-reload.png)
- [Enemy navigation and windup](../../artifacts/quality/reference-enemy-moving.png)
- [Mech firing](../../artifacts/quality/reference-mech-firing.png)
- [Mech hinged breech reload](../../artifacts/quality/reference-mech-reload.png)
- [Fire / physical bullet](../../artifacts/quality/reference-fire-bullet.png)
- [Ice / beam](../../artifacts/quality/reference-ice-beam.png)
- [Corrosion / sticky charge](../../artifacts/quality/reference-corrosive-sticky.png)
- [Shock / chain arc](../../artifacts/quality/reference-shock-arc.png)

## Build fingerprints

These fingerprints belong to **both** timing configurations and the action screenshots. The source remains modular; the normal game entry continues to use existing renderers until the combat lead adopts the [integration interface](integration.md).

- `game-Bx-xA8ip.js` — SHA-256 `d43ea9bf0cbf758e60ab5ade4ccf75c512d0d674bedc4b8a5bc9f14f2a0c8d8d`
- `index-BOtr4CVz.js` — SHA-256 `c57fbd1e6604dd564cb4e5372911363506676a7b9bb98fd3be862fbd93f5d077`
- `quality-lab-dEq6s5Z-.js` — SHA-256 `1c9ec5b4c08c239737bc2dbba14948dfee6df752f31ac6ccf56ee04528b6d8cd`

No Git initialization, commits, pushes or deployment were performed by this workstream.
