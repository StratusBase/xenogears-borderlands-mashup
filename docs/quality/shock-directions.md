# Heavy Shock direction variation

30 October 2026. Follow-up to `3660665`. The user noticed that C sparks repeatedly travelled right. The local burst axis was selected only from 0.12–0.67 radians; the branches varied but the overall cone remained right-biased.

- [Actual consecutive hits and native gameplay with sound](http://127.0.0.1:5297/review/).
- [Playable comparison](http://127.0.0.1:5297/shock-lab.html).
- Evidence: ignored `artifacts/shock-directions/`; the preceding frozen C build and receipts remain untouched.

## Runtime and integration

`shock/directions.ts` owns a shuffled eight-sector sequence, using neutral `shared/variation.ts` cosmetic entropy. Every eight heavy primary detonations cover the full contact plane. Consecutive sectors never repeat; a turn of at least 90 degrees is preferred when the remaining bag permits it. Small angle jitter prevents exact compass stamps. The existing branch widths, lengths, bends, origins and spark distributions still vary per event.

`ShockResponse` rotates the whole C contact frame once at birth, keeping blades, sparks, nucleus and retained main leader coherent. Direction stays fixed for that burst. Contact position/normal, source mesh, reach, size, lifetime, depth and secondary geometry remain authoritative and unchanged. This adds no gameplay random calls, clock, resource engine or audio voices.

`new ShockPresentation(scene,camera,'capacitor',options)` and the corresponding `ShockResponse` constructor accept optional `{capacitorDirection:'balanced'|'legacy',cosmeticSeed?:number}`. Balanced is the default. Legacy recreates the preceding right-biased C for comparison. Production receives an independent cosmetic seed; the isolated review uses seed37391. Existing three-argument constructors and old prototype/lightning profiles remain usable. Clear resets the cosmetic sequence and bounded direction history; disposal retains the existing lifecycle.

Combat-lead handoff remains unchanged: select the opt-in Shock adapter and route existing confirmed chain events as documented in the earlier Shock handoff. This task does not enable a production factory, edit combat-owned files, change muzzle transforms, slot bindings, collision, projectiles, fuse, damage, status or secondary exposure. Concurrent Radiation work changed `src/game.ts` during this task; the before/after comparison uses one frozen compiled Game in both modes and records its hash.

## Verification

- 25 focused Shock tests pass, including 128 direction choices, deterministic review seed/reset, actual primary geometry pointing both ways, exact secondary matrices/sizing and all eight orientations outside five support planes.
- All 13 ballistic delivery families pass exact pre-change compatibility. Vite review build passes.
- Full workspace test run: 832 pass, one concurrent Gravity ceiling-release failure. Production build is blocked by unrelated `composedPresentation.ts` and `fireFull.test.ts` type errors. These are recorded rather than changed by this task.
- Eight consecutive actual sticky detonations on the same armored human produce sectors `0,6,2,5,3,1,4,7`, without resetting the fixture or sequence. Stills freeze the real simulation +100 ms after each detonation. Native-speed recording observes 12 heavy detonations with no adjacent repeat and all eight directions in the first eight.
- Native final-bus audio: 21.42 seconds, peak0.6017, RMS0.01149, zero clipped decoded samples. Original WebM retained; MP4 has no decoder errors. FFmpeg logs an Opus header warning on the original WebM, also reproducible on the preceding C recording. No sound replacement, normalization or retiming.

## Matched heavy crowd measurements

One frozen build, six stationary raised-health humans, seed37391, same weapons/inputs, 120 warm-up +720 measured display frames, existing 1/60 simulation step per frame, sound on and recording off. M5 Max / Chromium156 /1440×900 DPR1.

| Milliseconds | Right-biased C | Varied C | Right-biased repeat |
|---|---:|---:|---:|
| Frame median | 15.40 | 10.30 | 14.50 |
| Frame p95 | 18.40 | 17.50 | 18.10 |
| GPU median | 2.84 | 2.26 | 2.52 |

All three complete combat snapshots match, including shots, damage, confirmed chains, statuses, ammo/reloads, time and contacts. Draw-count and triangle distributions match exactly. Peak C remains eight blades, 56 shards and1200 vertices; no capacity growth. Baseline drift/concurrent load prevents a speedup claim. These controlled fixtures do not establish full encounter or lower-end-device performance.

The lab adds “Next heavy hit / freeze” to continue the same fixture and direction sequence, including real reload/cadence waits. “Reset & fire study” intentionally reproduces the first seeded comparison. Use repeated native shots to judge variation. Package with `node scripts/package-shock-directions-review.mjs` after the frozen build and receipts exist. No push or deployment.
