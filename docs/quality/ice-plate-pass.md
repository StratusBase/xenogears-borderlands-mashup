# Ice plate arrangement and material pass

Approved 30 October 2026: continue the Claude Opus 5.5 collaboration and implement the plate arrangement/material recommendations on clothed and armored humans. Keep sizing, secondary falloff and particle counts unchanged. Frost aftermath, release timing, audio recipes and authoritative combat are outside this narrow pass.

Starting reference: [Opus mockup review](ice-mockup-review.md), approved B release plus A aftermath. Retain the previous plate-rime renderer alongside the candidate in one compiled review build. Preserve the original frozen prototype artifacts.

Required delivery: actual gameplay on both humans with live sound; same-build previous/candidate/repeated-previous sustained-fire measurements; exact combat, sizing/count and secondary equivalence; surface and slot-isolation regressions; a further Opus images-only review of the actual result. Results and limitations will be added after verification.

## Delivered result

The pass was checkpointed before implementation as `4ae56a5`. [Play and compare both styles](http://127.0.0.1:5250/ice-lab.html), or open the [gameplay, sound and measurement review](http://127.0.0.1:5250/review/). The earlier `ice-prototype/build` and its receipts remain intact.

- Plates now form a varied asymmetric shingle, with a shared tilt, distinct overlaps and a coherent peel direction. Cosmetic choices are made once per event through the shared variation helper; the review uses seed 37391. Gameplay randomness is untouched.
- The material uses darker desaturated blue-grey interiors, a thin rim following the actual polygon, sparse broken fracture paths and restrained alpha transmission. It adds no bloom, refraction or render pass. Flake geometry/material and the rime shader are unchanged.
- Geometry dimensions, per-particle size values, emission counts, lifetimes, release delays and speed magnitudes match the previous variant. The pass changes plate placement, orientation/spin/direction and material. Source-bound placement retains visible outer-armor projection and slot exclusion. Finite-surface placement falls back to the original accepted contact if a candidate offset misses, preserving count decisions.

## Claude collaboration

Three new images-only review rounds returned `claude-opus-5-5` and successful result receipts. No source code was sent. The first candidate read as chalky paper and a rosette; Opus's feedback drove the darker material and shingle arrangement. Its [final review](../../artifacts/ice-plate-pass/opus-signoff-review.md) accepts this limited pass on both humans, identifying the armor contrast as the larger improvement.

Opus did not play the build or review motion, sound, collision or performance. Its acceptance covers the supplied 183 ms stills. It still notes reticle occlusion, limited facet readability at range, background overlap behind released debris and the deliberately unchanged rime. It does not certify an exact reproduction of the painted mockup. Earlier candidates, prompts, raw responses and image fingerprints are retained separately.

## Gameplay and compatibility evidence

- Eight matched human records cover both targets, previous/current release at 183 ms and aftermath at 883 ms. Complete shots, hit/spec payloads, status/vitals, ammo, time and contacts match exactly. Full presentation event traces also match, including every reach/rime size and count. Primary sticky release remains five plates; secondary recipients remain zero plates with the existing smaller rime/falloff.
- All nine sustained-fire snapshots match exactly. Plate, flake and rime peaks match across each trio: rifle 12/34/3, sticky 8/44/6 and mixed 8/43/7. Physical/elemental sound voices are active in every arm; wall-clock voice peaks need not match a fixed-step simulation.
- Real Game shots also cover rifle, scatter, beam, slug, rocket and mech delivery, plus raised top, slope, underside and finite ledge. The focused regressions check every plate vertex through floor/slope/underside lifetimes, armor projection, slot tags, resource ownership, pause and cleanup.
- **810 repository tests pass**, including 22 focused Ice tests. All 13 delivery families retain exact hit, active-projectile and status-modifier traces. New tests compare both plate styles for per-particle sizes, lifetimes, delays, speed magnitudes, exact geometry, secondary event traces and unchanged flake trajectories; cosmetic variation is reproducible and does not reroll on pause.
- Production and standalone Ice builds pass, with the existing large-bundle advisory. Frozen Game/world/UI, stable damage-number implementation, ballistics, sizing, rime and Ice audio hashes match the starting boundary. This pass edits none of those files.

## Matched performance

One frozen compiled build contains both plate styles. Six raised-health stationary humans, identical camera/weapon/seed, native sound enabled, recording disabled; 120 warmup plus 720 measured displayed frames per arm, one existing 1/60 Game step per displayed frame. M5 Max / ANGLE Metal / Chrome, 1440 × 900, DPR 1. Accepted runs have zero resize/background transitions. Each cell below is **previous / layered / repeated previous**, milliseconds.

| Scene | Frame median | Frame p95 | Draw CPU median | GPU median | Frame max |
| --- | ---: | ---: | ---: | ---: | ---: |
| Rifle | 14.00 / 13.40 / 13.90 | 20.30 / 17.40 / 16.30 | 7.30 / 8.60 / 9.60 | 1.91 / 1.92 / 1.84 | 24.10 / 27.80 / 19.60 |
| Sticky | 11.30 / 14.10 / 13.70 | 19.30 / 22.70 / 16.60 | 7.10 / 8.20 / 9.70 | 1.82 / 1.97 / 2.04 | 48.10 / 94.80 / 88.90 |
| Targets + raised top | 11.10 / 15.70 / 13.80 | 17.90 / 19.10 / 19.10 | 7.00 / 9.30 / 9.20 | 1.86 / 2.11 / 1.83 | 52.70 / 125.90 / 86.30 |

**No production performance sign-off or speedup claim.** Sticky and mixed candidate medians increase relative to the first baseline; the repeated baselines also drift. Candidate maxima reach 94.8/125.9 ms, and repeated baselines reach 88.9/86.3 ms. These measurements do not isolate all stalls or prove a zero-cost shader change. Other devices, high DPI, endurance and full AI encounters remain unmeasured. An interrupted mixed run and an earlier candidate rifle run are archived separately and excluded. The interrupted run detected both resize transitions and changed combat; it was rerun without interacting with controls.

## Sound and capture

Four separate native-timing clips show previous/current on both humans, with actual sticky firing, fuse, reload and existing Ice sound. They record the WebGL canvas and both final physical/elemental WebAudio buses. The live receipts observe both buses active and unlocked. There is no replacement sound, normalization or artificial slow motion; canvas video omits HTML HUD, while stills include it.

Delivered MP4 PCM durations are 8.06–8.43 seconds, stereo 48 kHz, peaks 0.530–0.556, with **zero clipped samples**. Original WebMs and decoded WAVs are retained. Conversion emitted Opus packet-header warnings; delivered MP4s decode successfully. The local-only export helper was loaded before final timing in both variants and does not change the compiled Game assets. [Complete evidence and fingerprints](../../artifacts/ice-plate-pass/verification.json).

All four delivered MP4s were also played unmuted in the browser: advancing clocks, ready-state 4 and no media/page errors. This verifies playback and recorded signal, not an independent subjective audio review by Opus.

## Interface and integration

`IceResponse(scene, camera, {plateStyle:'layered'|'previous', variationSeed?:number})` is the presentation response; `IcePresentation` accepts the same optional third argument for the existing prototype adapter. Default style is layered; previous remains available. Existing audio and gameplay events/status ownership continue to drive it.

This remains the opt-in Ice prototype. The combat lead should register its response/recipe through the existing composition mechanism when normal-game adoption is approved; do not replace other approved element handlers or chain their adapters. No edit to game.ts, world.ts or ui.ts is supplied by this workstream. Frost aftermath and audio tuning are separate future passes.

Reproduce the standalone build with `npx vite build --config vite.ice-plates.config.ts`, then preview on port 5250. Preserve delivered evidence before rebuilding. For local recording export use `ICE_CAPTURE_ROOT=artifacts/ice-plate-pass ICE_CAPTURE_ORIGIN=http://127.0.0.1:5250 ICE_CAPTURE_PORT=5268 node scripts/serve-ice-capture.mjs`. The visible controls drive actual Game shots, native recording and matched comparisons; never touch controls during timing. `node scripts/package-ice-plate-review.mjs` validates saved browser evidence and packages the gallery; it does not drive a browser or synthesize results.
