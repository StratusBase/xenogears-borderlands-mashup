# Corrosive final gameplay verification

30 October 2026. The remaining surface and final-build performance checks are complete for the measured Mac configuration. No production effect, audio recipe or combat changes were needed in this pass.

- [Screenshots, live-sound recording and full results](http://127.0.0.1:5210/review/).
- [Raw measurements, complete combat snapshots, source hashes and boundaries](../../artifacts/corrosive-ab/signoff/verification.json).
- [Next-element kickoff prompt](next-element-prompt.md).

## Gameplay surface coverage

The compiled review entry uses the real `Game`, ordinary weapon specs, muzzle pose, swept collision, sticky contact and fuse, authoritative statuses and auto-reload. It adds finite physical review surfaces to the proving ground's existing occluder list. The shooter stands on an actual support platform for elevated shots. No presentation impacts are manufactured. The isolated save does not change the user's progression.

All four cases were fired through the visible review controls with both real audio buses unlocked. Each consumed one round, contacted the named surface and detonated through its real fuse. The snapshots stop the simulation 100 ms after detonation and again at 900 ms to inspect the moving splash and settled state; these stills are not a native-timing video.

| Case | Actual contact | Observed result |
|---|---|---|
| Raised platform | Top at y=1.525 m; normal [0,1,0] | Splash remains above the top; residue stays at y=1.537 m. Returning droplets settle on the finite mesh. |
| Sloped face | Normal [0,0.852525,0.522687] | Sheet and residue align with the slope; residue is 12 mm outside that contact plane. |
| Ceiling / underside | Bottom at y=3.425 m; normal [0,-1,0] | Sheet projects down into the room. Residue sits at y=3.413 m; droplets fall away rather than sticking to a reversed floor. |
| Finite ledge | Top at y=1.525 m; contact near its right edge | Drops move past the edge. At +900 ms an active non-resting drop is beyond the top and below its height. No infinite support plane catches it. |

The sampled onset sheet has 113 mm minimum clearance in all four cases. The earlier geometric regression still covers the complete sampled animation on floor/slope/underside and exact wall preservation. This review closes the previously missing actual gameplay observations. It does not claim every authored surface in every level has been traversed.

- [Raised onset](../../artifacts/corrosive-ab/signoff/raised-onset.jpg) · [settled](../../artifacts/corrosive-ab/signoff/raised-settled.jpg).
- [Slope onset](../../artifacts/corrosive-ab/signoff/slope-onset.jpg) · [settled](../../artifacts/corrosive-ab/signoff/slope-settled.jpg).
- [Underside onset](../../artifacts/corrosive-ab/signoff/ceiling-onset.jpg) · [settled](../../artifacts/corrosive-ab/signoff/ceiling-settled.jpg).
- [Ledge onset](../../artifacts/corrosive-ab/signoff/ledge-onset.jpg) · [settled](../../artifacts/corrosive-ab/signoff/ledge-settled.jpg).

## Matched sustained-fire measurements

Before is the actual approved directional response at `328a175`, immediately before the horizontal fix. Current is the response at `83e8ccd`. The Vite review configuration compiles the original baseline presentation/liquid/rupture sources beside the current modules in one build, using the same current Game, collision, targets, audio, coatings and sizing. Build-time hashes require the shared sizing, surface and audio dependencies to be identical. The new floor support metadata remains available to both versions; the old response ignores it.

Hardware: Apple M5 Max via ANGLE Metal; Chrome 156; 1440 × 900; DPR 1. Each run has 120 warm-up + 720 measured displayed frames, one existing 1/60 Game simulation step per displayed frame, seed 37391, six stationary clothed/armored human fixtures with raised health, real cadence/heat/auto-reload and statuses. Both physical and elemental audio buses are unlocked and actively voice sounds. Recording is disabled during timing. Do not interact with the review controls during a run.

Each cell is **before / current / repeated before**, in milliseconds.

| Scene | Frame median | Frame p95 | Simulation CPU median | Draw CPU median | GPU median |
|---|---:|---:|---:|---:|---:|
| Six humans / rifle | 8.30 / 8.30 / 8.30 | 9.50 / 9.60 / 9.90 | 1.00 / 1.00 / 1.20 | 2.70 / 2.60 / 3.20 | 1.57 / 1.54 / 1.59 |
| Six humans / sticky | 8.30 / 8.30 / 8.30 | 9.00 / 9.20 / 9.10 | 0.90 / 1.10 / 1.00 | 2.70 / 3.00 / 3.10 | 2.52 / 1.91 / 1.70 |
| Six humans + raised surface / sticky | 8.30 / 8.30 / 8.30 | 9.20 / 9.30 / 9.20 | 1.00 / 1.00 / 1.10 | 3.20 / 2.90 / 3.10 | 1.88 / 2.06 / 1.74 |

All three scenes have exact before/current/repeated-before equality of full shot, hit, vitals/status, ammo, timing and contact snapshots. Rifle fires 58 rounds and registers 57 hits on three front targets; rear targets are occluded. Sticky fires eight charges and registers 46 hit callbacks across all six targets. The mixed scene fires eight charges, registers 26 hit callbacks across all six targets, and includes eight contact/detonation notifications from the actual raised top. The normal auto-reload path runs in every scene.

The current frame p95 is 0.1–0.2 ms above the initial baseline. Sticky simulation median adds 0.2 ms against the first baseline and 0.1 ms against its repeat. Display pacing may hide extra work, and the repeated baseline also drifts; these measurements establish similar performance in these controlled scenes, not a universal speedup or zero-cost claim. Current peaks remain bounded: at most 59 liquid drops, six active corrosion statuses, five physical voices in sticky scenes and 32 elemental voices. The complete distributions, geometry/texture counts, draw counts and snapshots are preserved in the raw receipt.

An initial rifle timing attempt left enemy AI active and failed the full replay comparison. It was rejected and excluded. Accepted runs use the existing stationary training-target mode, matching the prior corrosive review protocol. This is actual gameplay simulation in a controlled fixture, not a full AI-encounter benchmark. Lower-end hardware, high DPI, mobile and long-session endurance are not measured here.

## Live sound recording

[Crowded gameplay MP4](../../artifacts/corrosive-ab/signoff/crowd-live.mp4) and [unmodified decoded sound](../../artifacts/corrosive-ab/signoff/crowd-live.wav) come from a separate native wall-clock run. The recorder taps the game's final physical and elemental WebAudio buses and the WebGL canvas. There is no offline sound replacement, normalization, artificial slow motion or painted VFX. Canvas video excludes HTML HUD; gameplay screenshots include it.

Decoded audio is 7.20 seconds, stereo 48 kHz, peak 0.5519, RMS 0.01224, with zero clipped PCM samples. Chrome's original WebM produced an Opus packet-header warning during decoding; the playable MP4 retains 7.2 seconds of decoded audio. The original recording is retained. No page or renderer errors were recorded during the final surface/measurement/live-gameplay checks.

## Source and regression checks

- **655 tests pass, zero fail**, and the ordinary production build passes with its existing large-bundle advisory.
- Exact original/current ballistic replay passes all 13 delivery families.
- The horizontal comparison still passes 30 exact wall geometry comparisons, zero floor vertices behind support and unchanged sizing.
- `game.ts`, `world.ts`, `ui.ts`, `PlayerBallistics.ts`, corrosive sizing and corrosive audio remain byte-identical to `83e8ccd`. Unrelated existing damage-number edits are shared by both measured modes and were left untouched.
- Production normal Enhanced gameplay retains the approved effect. The review harness and baseline import exist only in the separate review entry/configuration.

Reproduce with `npm test`, `npm run build`, `npx vite build --config vite.corrosive-signoff.config.ts`, then `npx vite preview --config vite.corrosive-signoff.config.ts --port 5210`. Open `/corrosive-signoff.html`; run the four surface tests and three performance scene comparisons through their controls. Save the raw DOM results and screenshots under `artifacts/corrosive-ab/signoff/`. The gallery/receipt packager is `node scripts/package-corrosive-signoff.mjs`; it asserts evidence, source fingerprints, finite-edge behavior, unmodified combat snapshots and sound activity before packaging. It does not drive the browser or manufacture measurements. Local baseline history at `328a175` is required.
