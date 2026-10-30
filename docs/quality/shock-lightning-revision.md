# Shock lightning revision

30 October 2026. The first A+B prototype (`b2dd1ec`) was rejected as too primitive compared with the concept boards. This revision received two independent Claude Opus 5.5 critiques and several actual-Game refinements. It is a new moving-result review candidate, not visual acceptance or a claimed exact paintover match.

- [Final gameplay with live sound, comparisons and full measurements](http://127.0.0.1:5226/review/).
- [Play the final prototype](http://127.0.0.1:5226/shock-lab.html).
- [Opus findings, corrections and remaining limits](shock-opus-review.md).
- [Raw final evidence](../../artifacts/shock-lightning/verification.json).

## C follow-up

The heavy-density gap recorded below is addressed by the [dense C follow-up](shock-capacitor.md), with new same-build measurements and native-sound footage. This document and its artifacts remain the previous frozen receipt.

## Final rendering

- Thin tapered leaders and parent-attached forks replace opaque cylindrical rods. Two camera-facing, depth-tested layers share one instance buffer: a normal-blended cobalt separation/ion envelope, then a narrow luminous core. Soft glow stays local; there is no fullscreen bloom or added dynamic light.
- Deterministic multiscale kinks and the shared cosmetic variation sequence vary direction, length and fork roots independently of gameplay RNG. Fast leader growth, discrete restrikes and decay remain on the existing presentation clock. Outward arc lift is capped at 0.22 m.
- Primary cosmetic reach is 1.48× the first A+B for ordinary hits and 1.30× for heavy hits. Primary material coverage grows up to 1.6×, capped to 55% of visible target span. This does not enlarge hitboxes, damaging fields or blast radii. Secondary splash/chain size records remain exact.
- B uses several connected charge islands, tapered conductors, small forks, bright nodes, travelling highlights and a sparse aftermath. Armor steers outgoing paths along plate axes; cloth keeps irregular webs. Borrowed visible geometry, target-local anchors and equipment exclusion remain intact.
- Heavy C has a stronger local flash and three-segment spark streaks in a directional cone, keeping the same spark count. Existing heavy detonation gating stays exact. Ordinary/secondary feedback never inherits that heavy flash or spark form.
- Confirmed chain connectors now have event-specific seeds and multiscale kinks. No recipient selection or damage occurs in rendering. A regression verifies successive connector shapes vary without mutating confirmed endpoints.
- The review entry hides its aim marker to expose the contact and includes repeated native hits on one human. This CSS is scoped to the Shock lab. Normal-game HUD and rendering activation are unchanged.
- Existing sound recipes and final physical/elemental audio buses are retained. `ShockPresentation(scene,camera,'prototype')` keeps the first A+B; `'lightning'` selects the revision. Existing `ElementalPresentation` remains usable.

## Actual gameplay checks

The real Game evaluation driver supplies ordinary weapon cadence, muzzle poses, swept collisions, fuse, heat, reload, damage, statuses and existing confirmed chains. Fixtures are intact stationary raised-health clothed/armored humans, not a full AI encounter.

- Cloth, visible outer armor and exposed skin; bullet, sticky, rocket, beam, scatter, slug and arc. Only confirmed sticky/rocket heavy detonations receive C in these studies.
- Raised top, vertical wall, slope, underside and finite ledge. All have positive filament centerline clearance, minimum 0.1622 m at +100 ms. The audit checks actual filament endpoints; camera-facing halo width is resolved in the shader. Charge at +900 ms stays on finite borrowed geometry/elevation.
- All nine matched runs preserve exact full shot, hit, confirmed-chain damage, vitals/status, ammo/reload, timing and contact snapshots. Secondary sizes are separately checked against the first profile.
- 811 repository tests pass, including 20 Shock checks. Production and final review builds pass. All 13 ballistic delivery families retain exact compatibility. Paused matrices/status ages and borrowed geometry ownership retain regression coverage.
- Stills stop actual Game simulation +100 ms after impact/detonation; charge stills use +700/+900 ms. Four separate recordings use native wall-clock timing and final live audio, with no replacement, normalization or retiming. Canvas clips omit the HTML HUD.
- No shader/page errors in final checks. Combat-owner files, ballistics/status logic, Shock sizing/audio retain their start hashes. Another workstream changed only radiation/corrosive display colors in `arsenal.ts`; the validation script reverses exactly those two literals and proves the initial hash. All compared versions share that same compiled arsenal. No unrelated edits were staged.

## Final matched timings

First A+B / final revision / repeated first A+B, milliseconds. One compiled `refined-build`, same Game/scene/seed37391/inputs/weapon settings, six humans. 120 warm-up +720 measured displayed frames per run, one existing 1/60 Game step per frame. Both audio buses on; recording off. Apple M5 Max, in-app Chromium156, 1440×900 DPR1.

| Scene | Frame median | Frame p95 | Simulation CPU median | Draw CPU median | GPU median |
|---|---:|---:|---:|---:|---:|
| Rifle crowd | 18.70 / 18.40 / 18.40 | 23.00 / 22.10 / 21.80 | 1.90 / 1.70 / 1.80 | 5.10 / 4.80 / 5.30 | 1.87 / 2.38 / 1.86 |
| Heavy crowd | 15.50 / 15.60 / 15.00 | 18.80 / 18.00 / 20.90 | 1.60 / 1.60 / 1.90 | 4.70 / 5.20 / 7.10 | 1.94 / 2.23 / 1.65 |
| Crowd + raised surface | 16.40 / 16.30 / 16.50 | 18.80 / 19.30 / 19.00 | 1.60 / 1.60 / 1.70 | 4.60 / 4.70 / 5.50 | 1.98 / 1.98 / 1.95 |

Final GPU median increases are +0.51 / +0.29 / +0.01 ms against each first baseline. Frame medians vary substantially with concurrent browser load; repeat baselines expose that drift. These results do not support a zero-cost claim or a universal frame-rate claim. Peak final use is 474/1600 segment slots, ten/twelve bolt slots, six statuses and one world owner. Lower-end/mobile/high-DPI and full AI encounters remain unmeasured.

## Recorded sound

| Clip | Seconds | Peak | RMS | Clipped samples |
|---|---:|---:|---:|---:|
| repeat-live | 8.00 | 0.5765 | 0.02591 | 0 |
| rifle-live | 8.00 | 0.5823 | 0.02594 | 0 |
| heavy-live | 10.01 | 0.5567 | 0.01080 | 0 |
| surface-live | 4.50 | 0.0869 | 0.00324 | 0 |

Original WebM and playable MP4 files are retained. Initial/working iterations are separate: `iteration-one/` plus the original frozen `build/` preserve the first revision; `iteration-two/` retains discarded intermediate raw measurements, explicitly without a reproducible frozen build. Only parent-path results and `refined-build/` are the final delivered measurements.

## Review and ownership boundary

Opus confirmed the revised cores/outlines and jagged leaders look closer. Its follow-up still found the heavy burst less dense than C's painted board; that remains an explicit art target. Final node visibility, aim-marker removal and chain corrections follow that critique and were verified by Codex, not a third Opus signoff. Charge does not yet route around a finite edge onto a new face, and decorative leaders are not an additional chain mechanic.

Normal Enhanced activation remains pending moving-result approval. The [combat-owner integration handoff](shock-prototype.md) still applies. No edits to `src/game.ts`, `src/world.ts` or `src/ui.ts`; no push or deployment.
