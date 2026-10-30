# Ice B + A: playable plate release and frost aftermath

The later approved [plate arrangement and material pass](ice-plate-pass.md) keeps sizing/counts/falloff and frost unchanged, with its own gameplay, Opus review and matched-performance receipt. This document retains the original prototype results.

30 October 2026. The approved B Platefrost release and A Rimebite aftermath now run as an opt-in actual-Game prototype on clothed and armored humans. The approved direction was checkpointed first as `4facccd`. No push or deployment was performed.

- [Gameplay screenshots, before/after clips with sound, complete measurements](http://127.0.0.1:5233/review/).
- [Hands-on playable prototype](http://127.0.0.1:5235/ice-lab.html) — choose the target/delivery, then **Take control / move and fire**. WASD moves, mouse or arrows aim, LMB fires, R reloads and Escape pauses.
- [Frozen measured replay scene](http://127.0.0.1:5233/ice-lab.html).
- [Full evidence and compiled fingerprints](../../artifacts/ice-prototype/verification.json).
- [Approved mockup directions](http://127.0.0.1:5231/).

## Result

New IceResponse owns a fixed pool of 80 unequal thin plates and 192 smaller flakes. Plates form on the visible cloth or outer armor, independently rotate/translate after staggered release, and fall under visual gravity. Early rotating corners stay outside the actual support plane, including floors, slopes and undersides. Finite ledges use mesh-local presentation raycasts instead of an infinite catch plane. Neither the new geometry nor these visual raycasts participates in combat collision.

IceRime borrows body/surface geometry and owns only its local overlay materials. Progressive asymmetric frost masks follow the source's transform and the existing authoritative condition's intensity/expiry. Actual hit projection uses the established visible-shell helper; equipment slots, overlays, invisible combat proxies and weapon descendants are excluded. Clothing, armor and anatomy stay intact. Transient environmental rime is cosmetic and creates no solid barriers or hazards.

Sizing responds to delivery, actual hit energy, primary/secondary channel, target span and actual splash exposure. In the two-human sticky capture, the primary detonation uses five plates and a 0.546 m rime radius; the neighbor receives zero plates and a roughly 0.099–0.101 m frost mark. It never replays the full release. Rifle, beam and individual scatter contacts remain compact.

The original ice audio supplies a short weighted cold clack, staggered brittle clicks, falling-chip texture and quieter granular rime. Equipment and flight geometry retain the existing localized ice treatment. The new modules change impact, aftermath and audio presentation; painted concept frost grain, exact prop silhouettes and optical transparency are simplified. Mixed-element combat payloads are regression-covered; mixed-element visual balance has not received a separate art review.

## Actual gameplay evidence

The review entry instantiates the real Game with an isolated save and its existing evaluation driver. It uses real specs, muzzle pose, swept collision, sticky attachment/fuse, hit callbacks, status rules, auto-reload, equipment and final audio buses. Clothed and armored displays wrap the same existing combat proxies without changing their resources or raycasts. Targets have raised health and use stationary training mode for repeatability; this is not a complete AI encounter or new character canon.

Before/after stills compare identical simulation times: 183 ms after a real sticky detonation, then another 700 ms for the frost aftermath. The stills freeze simulation for inspection. Each target's complete before/after shot, hit, vitals/status, ammo and contact snapshot matches exactly. Native-timing videos are recorded separately.

- [Cloth release](../../artifacts/ice-prototype/cloth-after-peak.jpg) · [frost](../../artifacts/ice-prototype/cloth-after-aftermath.jpg) · [before clip](../../artifacts/ice-prototype/cloth-before.mp4) · [prototype clip](../../artifacts/ice-prototype/cloth-after.mp4).
- [Armor release](../../artifacts/ice-prototype/armor-after-peak.jpg) · [frost](../../artifacts/ice-prototype/armor-after-aftermath.jpg) · [before clip](../../artifacts/ice-prototype/armor-before.mp4) · [prototype clip](../../artifacts/ice-prototype/armor-after.mp4).
- Real sticky contacts on [raised top](../../artifacts/ice-prototype/surface-raised-peak.jpg), [slope](../../artifacts/ice-prototype/surface-slope-peak.jpg), [underside](../../artifacts/ice-prototype/surface-ceiling-peak.jpg) and [finite ledge](../../artifacts/ice-prototype/surface-ledge-peak.jpg), each with a settled frost capture in the review page.
- Actual rifle, scatter, beam, slug, rocket and mech coverage is stored in coverage-verification.json. All register real hits and source-bound rime.
- Native Escape pause froze **eight live plates and 34 flakes**, with stable full instance-matrix hash and simulation time; physical and elemental voices were both zero. See [pause receipt](../../artifacts/ice-prototype/pause.json).
- No page/shader errors were recorded in final gameplay checks.

All four clips record native wall-clock Game timing and the WebGL canvas plus final physical/elemental WebAudio buses. There is no replacement sound, normalization, slow motion or painted VFX. Canvas video omits HTML HUD; stills include it. Each decoded audio track is 7.26 s, stereo 48 kHz, peak 0.532–0.572, RMS 0.00996–0.01014, zero clipped PCM samples. Original WebM files are retained; decoding emitted an Opus packet-header warning, while playable MP4s retain the decoded sound. A local-only recording export helper was added after timing; measured Game JS/CSS assets were not rebuilt or changed by it.

The later hands-on build adds ordinary native player controls beside the replay controls. It has a separate compiled fingerprint; all measured Ice rendering/sizing/rime/audio source hashes match the frozen review build. Native W moved the pilot from z=4.2 to z=1.7521; a manual mouse shot consumed one round, created three plates and local rime, then native R reloaded from 29 to 30 rounds and consumed one reserve round. Browser mouse capture was denied during automation, so the game's existing capture-blocked fallback was used. The browser handled the denial without page errors. See [hands-on receipt](../../artifacts/ice-prototype/hands-on.json) and [manual shot](../../artifacts/ice-prototype/hands-on-shot.jpg). The later UI build is functionally verified; its UI overhead is not covered by the earlier timing table.

## Matched performance

One frozen compiled build contains existing ElementalPresentation with approved corrosive enabled and the new IcePresentation adapter. Each scene uses the same six clothed/armored humans, seed 37391, weapon, aim sequence, initial state and sound setting. Each run has 120 warm-up plus 720 measured displayed frames, one existing 1/60 Game step per displayed frame, normal heat/reload/status rules, both sound buses active, and capture disabled. Separate native recordings use real wall-clock timing.

Hardware: ANGLE Metal / Apple M5 Max; Chrome 156; 1440 × 900; DPR 1. Each table cell is **before / prototype / repeated before**, in milliseconds.

| Scene | Frame median | Frame p95 | Simulation CPU median | Draw CPU median | GPU median |
|---|---:|---:|---:|---:|---:|
| Six humans / rifle | 10.60 / 10.60 / 10.90 | 12.30 / 12.30 / 12.60 | 1.10 / 1.10 / 1.10 | 6.50 / 6.70 / 6.80 | 3.35 / 3.35 / 3.33 |
| Six humans / sticky | 12.50 / 12.30 / 14.60 | 14.60 / 17.40 / 17.40 | 1.00 / 1.10 / 1.10 | 6.70 / 7.00 / 6.90 | 3.47 / 3.05 / 1.64 |
| Humans + raised top / sticky | 12.80 / 14.10 / 11.40 | 17.20 / 19.20 / 19.80 | 1.00 / 1.10 / 1.00 | 6.20 / 6.10 / 5.60 | 3.12 / 3.04 / 3.21 |

All nine complete replay snapshots match exactly. Rifle fires 58 shots and registers 57 hits on three front targets; sticky affects all six targets. Current peaks in these scenes are 12 plates, 44 flakes and seven rime roots, within the presentation budgets. Transient rime roots are capped; live Game-owned statuses follow target ownership and are not evicted by cosmetic marks.

**Performance is not signed off for production.** Final prototype frame maxima were 14.6 ms for rifle, 84.0 ms for sticky and 113.8 ms for the mixed scene. The repeated sticky baseline also spiked to 151.8 ms. Baseline drift and long stalls prevent attributing small differences or claiming a speedup. Median simulation cost is similar, but a quieter controlled run and endurance profiling remain before adoption. Other devices, high DPI, mobile, long sessions and full AI encounters are unmeasured. Earlier passes are archived separately under first-pass and are not mixed with final build results.

## Compatibility and ownership

- The frozen check passed **713 repository tests**, including 20 focused Ice tests. All 13 delivery families preserve complete hit payloads, active projectile transforms and ice modifier timelines. Dual-element recipes are included in the focused replay. Floors/slopes/undersides check every plate vertex through its sampled lifetime; other checks cover outer armor, adversarial slot tags, source resource identity, moving attachments, fade, invalid input, bounded pools, paused reveal and original audio envelopes.
- Production build passes with the existing large-bundle advisory. A separate latest-working-tree build/test check is retained alongside the frozen receipt when concurrent work advances.
- The later integration check passed **728 tests**, and final typechecking passed after adding hands-on controls. All four MP4s were played unmuted in the browser with advancing clocks and no media errors.
- This workstream did not edit game.ts, world.ts, ui.ts, PlayerBallistics.ts, arsenal or status rules. The frozen game/world/UI hashes match the starting boundary. Parallel work added an optional world-impact notification seam to PlayerBallistics; exact archived/current engine replay confirms all 13 traces still match with the review's existing callbacks. The frozen engine hash matches that compatibility receipt.
- Ice uses the shared audio-recipe, status-construction and splash extension points supplied alongside the Shock work. It does not replace that workstream's files. Existing corrosive behavior and non-ice recipes remain available.

## Integration interface and review gate

For the isolated review, construct `new IcePresentation(scene,camera)` through `GamePresentation.setElementalFactory` while presentation is disabled. The adapter extends ElementalPresentation and retains Game-owned equipment/projectile/status lifecycles. Do not apply damage or status changes from its callbacks. **This factory replacement is not the production integration interface:** normal gameplay now composes approved modules through `gameElements.ts`. Future Ice registration must use the existing `ElementModule` contract and preserve Fire/Radiation/Shock; see the [current performance handoff](ice-pacing.md).

This is **opt-in prototype review**, not normal-game adoption. The normal Enhanced factory remains on the existing ice style until the user approves actual motion/sound. After approval, wire the approved adapter into normal Enhanced gameplay, then verify the normal entry and complete the outstanding performance sign-off. Existing renderer and prototype comparison remain usable.

Reproduce: run `npm test` and `npm run build`; build `npx vite build --config vite.ice.config.ts`; preview `npx vite preview --config vite.ice.config.ts --port 5233`. The visible lab controls supply human before/after captures, delivery/mode checks, surfaces and matched comparisons. Do not change controls during timing. `node scripts/serve-ice-capture.mjs` adds the local-only post-timing recording export control and endpoint. `node scripts/package-ice-review.mjs` validates saved real-browser evidence, complete replay equivalence, audio activity, source/bundle hashes and boundaries before packaging the review page; it does not drive the browser or synthesize results.

To preserve the delivered frozen measurement build while compiling the later hands-on UI, use `npx vite build --config vite.ice.config.ts --outDir artifacts/ice-prototype/playable`, then preview that directory on port 5235. The evidence packager verifies that its Ice module hashes match the measured build.
