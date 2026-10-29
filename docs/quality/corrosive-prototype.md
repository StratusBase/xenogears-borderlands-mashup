# Corrosive A+B playable prototype

29 October 2026. User selected Caustic Splash + Armor Eater, with non-robot coverage and stylized intact characters. This is an opt-in actual-Game prototype, not an adoption into the ordinary main entry.

- [Review gameplay, sound, screenshots and measurements](http://127.0.0.1:5202/artifacts/corrosive-ab/).
- [Play the measured compiled build](http://127.0.0.1:5203/corrosive-lab.html).
- [Full gameplay/performance results](../../artifacts/corrosive-ab/verification.json).
- [Recording provenance](../../artifacts/corrosive-ab/recordings.json) and [actual captured audio measurements](../../artifacts/corrosive-ab/audio-measurements.json).

## Revision 3: dynamic splash hierarchy

The previous version used a fixed detonation size of 1.1, delivery-specific contact sizes, two particle count presets and a fixed fallback coating on nearby recipients. It was not truly impact-driven sizing.

- Main size now uses existing blast radius, actual shot energy (damage-equivalent units, not physical joules), delivery construction, channel weight and target bounds. Particle counts and dimensions respond within the original fixed pool budgets.
- Each secondary target receives the actual damage fraction computed after the existing blast-range and cover checks. It gets a small wet deposition, fewer/smaller droplets and a short quiet contact sound; it never repeats the epicentre sheet or floor puddle.
- Coating distances use world units on non-uniformly scaled display meshes. A missed proxy-to-display ray projects onto the nearest actual display triangle, keeping small marks on real geometry without altering collision.
- Actual three-target gameplay produced these sheet sizes / coating radii / emitted droplets:
  - Direct: 107 cm / 57.3 cm / 29; actual energy 62.72, exposure 100.0%.
  - Near: 0 cm / 14.3 cm / 6; actual energy 48.00, exposure 61.2%.
  - Edge: 0 cm / 7.3 cm / 3; actual energy 11.12, exposure 14.2%.
- [Normal-speed gameplay with live sound](../../artifacts/corrosive-ab/sizing-review.mp4), [detonation screenshot](../../artifacts/corrosive-ab/sizing-burst.png), [settled screenshot](../../artifacts/corrosive-ab/sizing-residue.png), [complete recipient/binding audit](../../artifacts/corrosive-ab/sizing-review.json).
- This pass corrects proportions; the overall fan silhouette remains unapproved. The Earlier A+B gallery toggle uses archived revision 2 footage. It is separate from the same-build performance baseline below.

## Retained revision 2 corrections

- Removed the interior hole mask and the full-circle crown/nine repeated radial strands. Three unequal folded fans now have different velocities, lifetimes and tears that begin only at open edges. Fewer, smaller translucent bubbles avoid a dense ring-shaped mass.
- Visible-surface projection resolves the VFX from the unchanged collision proxy onto the outer display shell. The coating stays on the struck material; armor cannot route the effect onto cloth beneath it. Actual gameplay audits require visible armor bindings and armor-classified contacts.
- Replaced pilot pitched footsteps with quiet filtered sand/grit Foley, varied by deterministic sample offsets. Ground distance and minimum contact intervals drive cadence. Spawn teleports, dashes, jumps, pauses and stops do not emit queued steps; landing emits one contact. Mech footsteps retain a restrained low weight layer.
- Walking recordings use the same sequence of moving/stopped intervals. Earlier: 9 contacts; revised: 6. Signal measurements below include the isolated real walking audio.

## What is real

The normal Game, PlayerBallistics, equipment recipes, muzzle poses, swept collision, sticky attachment/fuse, impact damage and authoritative status ticking drive the prototype. Its isolated review fixtures use actual enemy roots and raised health so repeated effects can be reviewed. Their clothed and armored human presentation is new review art, not new story canon or combat archetypes. Original visible collision proxies retain their geometry/transforms/critical flags and raycasts while their presentation is hidden. The human display geometry never participates in collision. Local stock ray and closest-triangle tests are used only to place visual surface responses.

The A response is an expanding, three unequal folded liquid fans, with separate flow velocities and edge-only breakup, thin curved rivulets, bead tips and ballistic liquid drops. B uses conforming wet surface masks and attached expanding bubbles. Armor gets cosmetic pitting; skin and cloth get intact coatings. A small local splat and sparse vapor provide a settling tail. Ordinary bullets, scatter, beams and slugs remain smaller than existing explosive detonation events. Pools are fixed: 10 liquid bursts, 256 detached drops, 96 bubbles, 24 residue marks and 32 vapor wisps. Up to four local reaction islands per source surface, and unaffected surfaces submit no overlay draw.

Six original gameplay videos request 60 fps capture of the WebGL canvas with native frame timestamps with final physical and elemental WebAudio buses mixed into the recording. The native Game.run clock advances normal gameplay; scripted trigger inputs fire the actual gun. No rendered effect was painted into the videos and no offline sound was substituted. Canvas capture omits the HTML HUD; screenshots retain gameplay HUD/real damage counters, with the review capture prompt and repetitive objective/toast UI hidden. Native video and AAC playback can vary slightly by browser.

## Faithfulness and limits

The concept's larger liquid silhouette, attached surface reaction and temporal beats exist in real time. The paintovers still have richer liquid reflection and finer detail; the actual sheet is visibly more planar. The prototype uses authored mesh deformation and shaders, not fluid simulation. This difference remains visible in the review gallery. Non-robot targets retain faces, clothing and body shape; there are no wounds, exposed tissue, melting, dismemberment or body deformation.

## Verification

- **645 tests pass**, including **32 A+B tests plus 4 footstep checks**. All 13 projectile families compare exact full hits and per-step trajectories with the prior elemental presentation, including a secondary fire channel. Borrowed geometry, source materials, original collision/critical hits, immutable specs, equipment-slot boundaries, pause/no-NaN handling, removed attachments and fixed pools are covered.
- Ordinary production build and isolated compiled prototype build pass. The existing large-bundle advisory remains.
- Actual compiled gameplay covers both humans, sticky contact/fuse/detonation, cloth/skin/armor/ground classification, moving target, rifle/scatter/beam/rocket/slug, dual fire/corrosive and mech firing. All shots register real hits and authoritative corrosive statuses.
- Actual Escape pause freezes instance matrices and silences both audio layers. No page or shader errors were recorded.
- All five matched before/A+B/repeated-before runs have **exactly identical complete combat outcomes**, including shot times/specs/origins/directions/aim points, hit order/coordinates/critical flags/damage, ammo/reserve/heat and target health/shield/status state. Enemy IDs are normalized to the same fixture order only.
- This workstream did not edit game.ts, world.ts, ui.ts, core/arsenal.ts or core/statusEffects.ts. PlayerBallistics.ts was intentionally extended with optional visual energy/exposure metadata and per-recipient splash notifications. Its original damage formula, range/cover tests, hit sequence and projectile paths remain unchanged. Exact source-before/source-after replay against Git baseline ddb86b155e4e9979303894a0501b544458997f3d compares full hits and all projectile transforms across 13 deliveries, 600 steps each, with moving neighbors, cover and critical hits: [complete evidence](../../artifacts/corrosive-ab/ballistics-before-after.json). The frozen compiled build is fingerprinted below. Other workstreams may change protected files concurrently; this workstream does not overwrite them. [Before boundary](../../artifacts/corrosive-ab/revision-3-boundary-before.sha256) · [After boundary](../../artifacts/corrosive-ab/revision-3-boundary-after.sha256).

## Matched performance

Hardware: ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version). Same compiled assets, 1440 × 900 at DPR 1. Each scene runs **previous elemental pass → A+B → previous pass repeated**. There are 90 warmup + 360 measured displayed frames per run; one existing 1/60 simulation step per displayed frame. Native weapon cadence, heat, reload, sticky fuse and status timing apply. Sound is enabled. Recording and other browser work are disabled during measurement. This deterministic firing benchmark is separate from the native-clock gameplay recordings.

| Scene | Frame median ms before / A+B / repeat | Frame p95 before / A+B | CPU draw median ms before / A+B / repeat | Whole-frame draw median | GPU median ms before / A+B / repeat |
|---|---:|---:|---:|---:|---:|
| human-rifle | 8.30 / 8.30 / 8.30 | 10.20 / 10.30 | 2.60 / 2.60 / 2.70 | 1327 → 1330 | 1.41 / 1.52 / 1.54 |
| armor-rifle | 8.30 / 8.30 / 8.30 | 10.10 / 10.40 | 2.50 / 2.70 / 2.60 | 1360 → 1363 | 1.33 / 1.29 / 1.35 |
| human-sticky | 8.30 / 8.30 / 8.30 | 9.30 / 9.40 | 2.40 / 2.60 / 2.40 | 1334 → 1338 | 1.61 / 1.84 / 1.47 |
| armor-sticky | 8.30 / 8.30 / 8.30 | 9.20 / 9.30 | 2.50 / 2.70 / 2.50 | 1367 → 1364 | 1.97 / 1.20 / 1.49 |
| crowded-six-sticky | 8.30 / 8.30 / 8.30 | 9.30 / 9.30 | 4.20 / 4.30 / 4.20 | 2073 → 2060 | 1.73 / 1.50 / 1.26 |

CPU draw measures renderer submission, not all simulation work. Whole-frame draws include shadows, normals, beauty, ink and postprocessing. Display pacing can mask extra CPU/GPU work; GPU baselines drift, so the raw timing distributions and repeated baselines matter. These high-end Mac results do not establish lower-end, mobile, high-DPI or full-encounter performance. The six-target case exercises actual nearby sticky splash, not a new simulated blast radius. The delivered build culls unaffected surface overlays. All revision 3 timing runs and combat recordings use the fingerprints below. The retained walking audition is from revision 2; footstep code is unchanged in revision 3.

## Audio

The physical report remains the game's original quality weapon sound. Corrosive impact adds a low wet transient, liquid tearing spray, several offset bubble pops, a granular reaction and thinning sizzle. The current world terrain, including painted roads and service pads, is one sand surface, so footsteps use subdued grit rather than metal clanks. Pilot steps contain no pitched oscillator; mech contacts retain a quiet low weight layer. Cadence is displacement-driven and bounded in time, with motion-state guards. Armor emphasizes a higher crackling tail; cloth/skin uses a softer wet reaction. The original 32-voice and 14-loop elemental caps, distance attenuation, gesture unlock, mute and pause remain. Capture taps attach to the exact final output buses only when a recording is requested.

- human-before-sticky.wav: peak 0.5649, RMS 0.0104, 5.46 s, 0 clipped PCM samples.
- human-ab-sticky.wav: peak 0.5452, RMS 0.0117, 5.52 s, 0 clipped PCM samples.
- armored-before-sticky.wav: peak 0.5567, RMS 0.0104, 5.46 s, 0 clipped PCM samples.
- armored-ab-sticky.wav: peak 0.5787, RMS 0.0118, 5.52 s, 0 clipped PCM samples.
- human-ab-bullet.wav: peak 0.5736, RMS 0.0243, 6.00 s, 0 clipped PCM samples.
- armored-ab-bullet.wav: peak 0.5919, RMS 0.0243, 6.00 s, 0 clipped PCM samples.
- sizing-review.wav: peak 0.5585, RMS 0.0089, 4.80 s, 0 clipped PCM samples.
- footsteps/before.wav: peak 0.1724, RMS 0.0047, 4.92 s, 0 clipped PCM samples.
- footsteps/after.wav: peak 0.0096, RMS 0.0004, 4.98 s, 0 clipped PCM samples.

## Integration interface / combat-lead handoff

All default constructors retain the prior presentation. No combat-owned integration edits are required for this prototype.

1. Instantiate ElementalPresentation(scene, camera, { corrosiveAB: true }) to select the new response. Existing projectile/trail/beam factories are unchanged. Non-corrosive effects still use the prior layer; secondary elements keep their own response. The consumed event point/normal/spec are never mutated.
2. For GamePresentation, the optional setElementalFactory(factory) seam is allowed only while presentation is disabled. The lab uses Game.setPresentationMode('legacy'), installs the factory, then uses Game.setPresentationMode('quality') so the existing status/equipment lifecycle remains game-owned. Changing this in the default product is pending the user's visual review.
3. Bind new asset meshes with userData.corrosiveSurface = 'skin' | 'cloth' | 'armor'. The selector rejects all equipment-slot descendants and presentation/overlay descendants. Original quality armor keeps its existing fallback. Future native non-robot assets should provide explicit surface tags on the actual body meshes.
4. CorrosiveResponse(scene,camera) consumes BallisticPresentationImpact events with optional energy/exposure fields. The optional BallisticPresentation.splash(event) callback carries target, origin, primary, energy and exposure after existing blast cover/range/eligibility checks. Default presentations have no splash callback; only corrosiveAB enables it. Non-corrosive behavior is unchanged. CorrosiveStatus borrows geometry, never replaces source material or alters vertices, and supplies update/setIntensity/dispose to the existing status lifecycle. Surface anchors follow the actual source transforms. Pass the impact normal to nearestCorrosiveSurface to project onto the visible shell; neither its projection nor its stock display-mesh ray test enters combat collision. Use splash(event) for true secondary contacts; primary recipients are ignored there because impact(event) already presented the epicentre. A status with no known impact uses a small 0.10 m torso fallback. These notifications do not create hits or damage events.
5. Dispose status effects before target display resources; release/dispose the presentation on the existing lifecycle. Audio recordingStreams() is optional review capture only; runtime audio remains unchanged when no capture is requested.

## Reproduce

Run node scripts/verify-corrosive-tests.mjs and node --import tsx scripts/verify-ballistic-feedback-compat.mjs, then npm run build, then npx vite build --config vite.corrosive.config.ts. Serve npx vite preview --config vite.corrosive.config.ts --port 5203. Run scripts/verify-splash-scaling.mjs, scripts/verify-corrosive-ab.mjs, then scripts/record-corrosive-ab.mjs sequentially; never record during performance runs. PLAYWRIGHT_MODULE, CHROME_EXECUTABLE and CORROSIVE_REVIEW_URL override local installations/origin. Run FOOTSTEP_VERSION=after node scripts/record-footstep-review.mjs for the walking audition. Run scripts/package-corrosive-media.mjs for timing-preserving H.264/AAC transcodes and decoded-audio measurements (requires ffmpeg/ffprobe). scripts/build-corrosive-review.mjs builds this report/gallery from the measured JSON. Serve the workspace on port 5202 for the gallery/artifact links. Rebuilding incorporates any subsequent concurrent workspace changes; rerun the matched comparisons for that new build rather than reusing these numbers.

Measured compiled fingerprints:

- corrosive-lab-DHm56mDP.css: SHA-256 7ad7ef75ac6ed97a26af7445229bfad401959242d5547cfaeade3df4a719aaa4
- corrosive-lab-YIgOat3-.js: SHA-256 b93ae40e8063c48856c5c6ced2733bd87d3de6d1f5d2a9cfad0b4cde55730c0c

No Git initialization, commit, push or deployment was performed.
