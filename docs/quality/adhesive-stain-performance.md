# Adhesive varied-stain performance correction

30 October 2026. Baseline: `ef0eeb8` (varied honey), not the older fixed stain. The user authorized removal of the reported sticky-fire cost while preserving honey, variation and combat, and noted concurrent VFX work may affect timings.

## Bounded change

`stainShader.ts` retains the exact prior varied fragment as `referenceVariedStainFragment`. For one active contact, the optimized default skips empty contact slots and hoists the shared metric and source-normal normalization outside the contact loop. It preserves the original inner lobe loop and per-pixel control flow. An initial experiment with more per-pixel/lobe branches was rejected after isolated profiling found a dense-contact regression; those source/build/timing receipts remain in `attempt-1/` and `attempt-2/`. Dense masks (two or more contacts) retain the exact frozen fragment rather than paying extra uniform-branch overhead. Kernel selection changes only when contact occupancy changes, uses the same owned material/uniforms, and does not change deposits or their quality. Stable occupancy does not mark materials for recompilation. The first transition to another kernel can compile that program; warmed programs use the renderer cache and are released with the material. It retains the original per-lobe distance, nearest-lobe choice, reveal, optical depth, contour, virtual normal, honey lighting and opacity calculations.

`stainFrames.z` now carries each contact's actual lobe count (2–4); zero means inactive. Coalescing clears this value when it clears the contact. The fixed and older material renderers ignore this metadata and remain available. No geometry, particles, pad poses, profiles, radius inputs, status timing, audio recipes or combat change. Palette/helper, shape generator, burst geometry, sizing, equipment and adhesive audio are byte-identical to `ef0eeb8`.

The public adapter adds optional `stainKernel:'reference'|'optimized'`; optimized is the default. Reference is a reproducibility option, not another presentation lifecycle. Normal main adoption remains the existing explicit integration handoff. This pass does not edit `src/game.ts`, `src/world.ts`, `src/ui.ts` or other owners' concurrent work.

## Verification protocol

The review build is frozen in `artifacts/adhesive-stain-performance/build`. Use `npx vite build --config vite.adhesive-performance.config.ts`; preview at localhost:5283. `/adhesive-lab.html?stain-perf=1` compares the old varied shader with optimized varied honey. The existing URL without that query still compares fixed honey with optimized varied honey. Earlier frozen builds and receipts remain intact.

Eight paired real-Game captures are byte-identical PNGs at 1440 × 900: human and armored onset/settled, slope, underside, moving armor plus corrosive secondary with a second cosmetic seed, and mech sticky fire. Combat and original burst/stain-profile receipts match. Asynchronous audio voice occupancy can differ by one in frozen captures because audio uses wall time; it is not part of combat equivalence. Source-bound motion and all existing hierarchy rules remain intact.

Sound-on crowd comparisons use one compiled build, 120 warmup + 720 displayed measured frames per run, fixed 1/60 Game steps, seed 37391, six fixtures and recording off. Reference → optimized → optimized repeat → reference repeat brackets host drift. The fixed-stain cross-check uses the previous fixed → optimized → fixed sequence. Full frame, Game CPU, render submission, GPU and resource distributions are retained. Our tests, builds and encodes are kept outside these measurements. Other concurrent user work is not stopped. System load averages are recorded as context, not CPU/GPU utilization or proof of a particular process causing a stall.

`adhesive-kernel-profile.html` is a separate diagnostic using the actual `ResinMask` shaders, generated profiles and borrowed plane geometry. It renders eight repeated draws per displayed frame with ABBA alternation every four frames, 80 warmup and 240 measured frames per case, producing 120 GPU samples per kernel/path. One-contact and four-contact cases amplify shader cost; GPU results are divided by eight and include the same clear/blend overhead in both paths. Pixel equality is checked outside timing. This isolates mask cost and is explicitly not full gameplay, postprocessing or audio. It runs after full-game timings.

New tests cover the frozen reference hash, contact/lobe activity through coalescing and eviction, and complete reference/optimized profile, burst, particle-pose and lifetime equivalence. Full-game image equality is runtime evidence rather than an implementation-mirroring shader-string test.

## Results

36 adhesive tests and all 951 repository tests pass. Production build and type checking pass. Final measured receipts and native-time sound clips are linked from `artifacts/adhesive-stain-performance/index.html`; earlier frozen receipts remain intact.

The final isolated diagnostic has zero different pixel channels for both cases. One active contact measures 0.1596405 → 0.124604125 ms median GPU per amplified draw (21.95% lower); p95 0.244005125 → 0.231427 ms. Four contacts select the exact reference kernel and measure 0.14309375 → 0.14480725 ms median (about 1.2% variance), p95 0.212567625 → 0.18721875 ms. There are 120 samples per path and no GPU-disjoint events. These mask-only numbers do not describe full-game frame time.

The earlier reported 10–11% full-frame penalty was an association in a shared-host run, not an isolated shader measurement. Bracketed reference runs can drift substantially as parallel VFX work changes load. The final full-game table below retains this uncertainty; no fixed percentage frame-speedup, zero-regression certification, other-device or quiet-machine claim is intended.


Final full-frame median / p95 milliseconds (same build, M5 Max, 1440 × 900 DPR 1, sound on):

| Scene | Reference/fixed before | Optimized | Optimized repeat | Reference/fixed repeat |
| --- | ---: | ---: | ---: | ---: |
| human-sticky | 11.30 / 13.90 | 12.00 / 16.00 | 11.50 / 13.60 | 11.40 / 14.10 |
| armored-sticky | 11.70 / 14.70 | 11.80 / 15.60 | 11.20 / 14.40 | 11.50 / 13.70 |
| mixed | 9.50 / 12.50 | 9.30 / 12.00 | 9.70 / 12.10 | 9.30 / 12.70 |
| fixed-baseline | 11.60 / 14.80 | 11.10 / 14.10 | — | 10.60 / 12.80 |

All three ABBA comparisons preserve every combat snapshot, original burst event and stain profile across all four runs. The fixed-baseline cross-check preserves combat and burst events; its stain profiles intentionally differ. Every scene hits all six fixtures. Draw, triangle, geometry and texture counts stay equal within comparisons. Frame, submission CPU and GPU variations remain in the raw receipts. There is no stable full-frame 10–11% recovery claim: the demonstrated improvement is the sparse mask kernel, with the exact original varied shader retained for dense masks.
