# Fire A+B, with C for explosive hits

30 October 2026. Flashover ignition (A), Cinderbrand aftermath (B), and Backdraft on existing explosive hits (C). Playable visual approval is pending. The user rejected the first smooth ribbon implementation; the current revision replaces that construction rather than merely changing its speed.

## Visual review status

The independent [Opus 5.5 review](fire-opus-review.md) finds the current prototype still below A+B/C: soft puffy shape, excessive vertical rise, faint char/sparks/smoke and missing C crescents. No review suggestions have been applied yet. The next proof should prioritize deliberate cel flame silhouettes and direction, then B aftermath and surface attachment.

## Current playable revision

- A: seven unequal, buoyant combustion parcels sampled as a turbulent 3D field. Curved paths, staggered births, splitting, upward advection, erosion and independent cooling replace the three smooth ribbons. The orange body contains smaller gold knots; its edge dissolves rather than retaining a solid strip silhouette.
- B: localized curled flamelets, small upward-drifting embers, and cosmetic soot/ember masks on the actual visible clothing or outer plate. Status intensity and lifetime still come from the existing combat owner. Masks borrow source geometry without changing or disposing it.
- C: wider, slower rolling parcels only on an actual explosive detonation. Existing sticky contact and fuse remain separate from detonation. Secondary recipients receive small exposure-scaled flamelets and embers, no repeated full burst or boom.
- Capacity: 12 primary volumes, 256 instanced embers, 96 instanced flamelets, 24 smoke particles, 16 ground soot masks. The legacy diagnostic `sheets` now counts the pooled combustion volumes. The volume shader uses 36 ray samples and seven bounded lobes; it is a visual field, not a fluid physics solver.
- Each primary volume clips against its actual contact plane. Fire rises in world space on walls/floors/slopes; undersides redirect it beneath the support. The shader writes the first visible fire depth for opaque-object occlusion. Flamelets face the camera around their rising axis, rather than becoming edge-on strips.
- Sound: ignition snap, restrained air tear/whump and crackle; broader low release only for C; quiet secondary ticks and status crackle. Both existing sound buses retain mute, unlock, distance attenuation and bounded voices.
- Characters, clothing and plates stay intact. No gore, body deformation, extra damage, new hazard or environmental spread. The implementation owns no collision or projectile simulation.

## Play and integration

```sh
npx vite build --config vite.fire.config.ts
npx vite preview --config vite.fire.config.ts --port 5220 --strictPort
```

Open `/fire-lab.html` for actual `Game` shooting, reloads, fuses, statuses and sound with an isolated review save. The two human fixtures wrap real collision proxies and use high health for repeated inspection. Free play supports existing pilot/mouse controls. The 50 ms step button advances real simulation for motion review.

`FirePresentation` is an opt-in `ElementalPresentation` subclass supplied through `GamePresentation.setElementalFactory`. Disable presentation before replacing the factory, then re-enable it:

```ts
// Inside the combat owner, using its existing GamePresentation instance:
presentation.setEnabled(false);
presentation.setElementalFactory((scene, camera) => new FirePresentation(scene, camera));
presentation.setEnabled(true);
```

Fire consumes the shared audio recipe, protected `createStatus`, and protected `splashImpact` seams already committed with the element prototypes. It inherits equipment, projectile, trail, muzzle and beam rendering, and forwards other elements independently. Corrosive remains enabled in the base adapter. Combining several prototype adapters requires the shared element-composition owner; nesting adapters is not the composition interface.

Normal-game defaults have deliberately not been switched to this unapproved revision. `src/game.ts`, `src/world.ts`, and `src/ui.ts` are unchanged by this work. Existing renderers remain usable. No push or deployment.

## Verification and evidence

The review gallery at `/review/` contains actual gameplay MP4s with both runtime sound buses, in-game screenshots, surface checks, complete raw comparisons and source/bundle fingerprints. Build it after collecting evidence with `node scripts/packageFireReview.mjs`.

- `tests/firePrototype.test.ts`: 20 passing checks, including exact hits, frozen specs and trajectories across 13 delivery types; real outer armor versus cloth; equipment-slot exclusion; moving/fading statuses; pool bounds; paused state; unchanged other-element audio; and secondary falloff.
- Full workspace suite at the validation checkpoint: 757/757 passed. Production build and final TypeScript check passed. Other element work is concurrent; these counts describe that checkpoint.
- Final measured and recorded assets: `artifacts/fire-prototype/turbulent/`. Vite records SHA256 hashes of the actual source fed to the build, including concurrent shared changes. Before/current/repeated-before all use the same compiled bundle, 1440 × 900 DPR 1, seed, scene, aim sequence and fixed simulation step.
- Every comparison uses 120 warmup and 720 measured displayed frames, live audio, and recording disabled. Full state equality covers damage, hit positions/directions, shots/specs, ammunition/heat, status state and authoritative contacts. Background workload can influence wall-clock measurements; use the repeated baseline to assess drift.
- The recorder holds a quiet scene for one second before firing to let the encoder produce video before the shot. Original browser audio is retained; MP4 conversion does not replace or normalize sound. The original Chrome WebM files emit one Opus-header decode warning; the converted clips contain continuous decoded stereo audio. Audio peak and clipping measurements are in `media.json`.
- `rejected-linear/` preserves the rejected ribbon source/build. `turbulent-first-capture/` preserves the initial recording/performance investigation, including the capture startup delay; those clips are not presented as the final review.

## Final local measurements

All times in milliseconds, sound enabled, recording disabled. Each cell is median / p95 frame time; GPU cells are median / p95. The repeated baseline is retained rather than interpreted as a speedup.

| Six-target scene | Before frame | Revised frame | Before repeat frame | Before GPU | Revised GPU | Repeat GPU |
| --- | --- | --- | --- | --- | --- | --- |

| Rifle | 8.30 / 9.70 | 8.30 / 9.70 | 8.30 / 9.60 | 2.25 / 3.29 | 2.99 / 4.36 | 2.41 / 3.44 |
| Sticky | 8.50 / 11.40 | 8.40 / 10.60 | 8.30 / 9.40 | 2.30 / 3.60 | 2.33 / 4.43 | 2.52 / 3.43 |
| Rocket | 8.40 / 10.70 | 8.40 / 10.00 | 8.30 / 9.30 | 2.46 / 3.70 | 2.48 / 4.42 | 2.91 / 3.75 |

Rifle reaches 3 distinct targets; sticky and rocket reach all 6. Before/current/repeated-before combat state is exactly equal in all scenes. Rifle GPU median increases about 0.74 ms against its first baseline; its frame median stays 8.30 ms. Explosive scenes have increased GPU p95 during releases despite similar frame medians. One 232.9 ms baseline rocket outlier is retained in the raw result, not attributed to Fire. These measurements apply to this local scene/device, not all hardware or production combat loads.

Actual gameplay checks cover clothed/armored targets at contact, +100 ms, +250 ms and aftermath; floor, wall, slope and underside at +250 ms; sustained multi-target fire with sound. Final recordings start video at 0 and audio at 19–20 ms, with the real shot after the one-second quiet encoder lead-in. They contain 48 kHz stereo audio and zero clipped samples. The largest decoded peak is 0.480.
