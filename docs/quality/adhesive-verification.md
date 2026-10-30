# Adhesive A verification receipt

30 October 2026. This is a working, opt-in actual-Game prototype. The [Opus critique](adhesive-opus-review.md) identifies remaining material, stamp and viscosity gaps against the approved board. This receipt verifies behavior and records costs; it does not claim visual acceptance.

## Frozen build and protocol

- Entry: `http://127.0.0.1:5240/adhesive-lab.html`; report: `http://127.0.0.1:5186/artifacts/adhesive-prototype/`.
- Frozen Vite build: `artifacts/adhesive-prototype/build`; built at `2026-10-30T11:32:34.961Z` from base HEAD `8f5569a79a876cdbe51c2bc40b59219096fe356c` plus the uncommitted source captured by `build/provenance.json`. Concurrent shared work is included honestly in the transformed-source fingerprints. The report's `verification-summary.json` includes build-file SHA-256 hashes.
- Both prior adhesive and current Tack Resin are in this one compiled build. Same actual Game scene, combat seed 37391, fixed cosmetic seed 37391 for timing, six high-health human fixtures, camera/canvas 1440 × 900, DPR 1. Review/free-play defaults obtain independent cosmetic seeds.
- Each scene runs before → current → repeated-before, each with 120 warmup and 720 measured displayed frames; one 1/60 simulation step per frame. Sound enabled/unlocked on both final buses, recording off, visible document. Normal ammo/heat/auto-reload remain active. This is a scripted sustained-fire scenario, not a human input latency measurement.
- Hardware reported by WebGL: `ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version)`, Chrome 156 on macOS. Results do not establish low-end or other-device performance.

## Results

All values are median / p95 milliseconds. Game CPU measures the evaluation/update step; render submission CPU is measured separately. GPU timer query values may correspond to a preceding completed frame.

| Scene | Mode | Frame | Game CPU | Render submit CPU | GPU |
|---|---|---|---|---|---|
| Rifle | Before | 10.00 / 17.80 | 1.40 / 3.10 | 6.50 / 11.20 | 2.20 / 4.12 |
| Rifle | Current | 13.00 / 15.50 | 1.60 / 3.30 | 9.30 / 11.40 | 2.31 / 3.50 |
| Rifle | Before repeat | 13.70 / 18.70 | 1.30 / 3.00 | 8.80 / 12.00 | 2.31 / 3.65 |
| Sticky | Before | 10.80 / 16.40 | 1.10 / 1.60 | 7.50 / 9.90 | 2.36 / 4.65 |
| Sticky | Current | 10.80 / 15.60 | 1.20 / 1.70 | 7.50 / 10.50 | 2.59 / 5.12 |
| Sticky | Before repeat | 10.10 / 13.40 | 1.10 / 1.50 | 6.90 / 9.40 | 2.64 / 4.72 |
| Mixed target / raised top | Before | 10.10 / 11.90 | 1.20 / 1.70 | 5.10 / 7.90 | 2.07 / 3.16 |
| Mixed target / raised top | Current | 9.40 / 10.80 | 1.20 / 1.60 | 4.00 / 7.60 | 2.12 / 3.12 |
| Mixed target / raised top | Before repeat | 9.50 / 11.10 | 1.10 / 1.50 | 4.00 / 7.70 | 2.06 / 3.25 |

Complete normalized combat snapshots are identical across the three modes in every scene: body/ammo/heat, time/mode, shots, hits, collisions, target positions, health/shield, statuses and modifiers. Rifle hits the three visible front-row targets; sticky and mixed runs hit all six. Raw per-run receipts preserve shots, hits, source metadata, costs, draw counts and active pools.

Current median Game CPU increases by about 0–0.2 ms relative to initial before. Baseline repeat drift is material, especially rifle, so no speedup is claimed. Current sticky/mixed runs contain isolated 62.7 / 67.1 ms frames (render submission peaks 60.5 / 63.9 ms). This is not a stutter-free signoff. Current observed pool peaks remain below budgets: at most 3 folds, 28 drops, 24 pads and 6 statuses. Memory/draw/triangle counts and voice peaks are in raw receipts.

## Actual gameplay and sound

- Clothed and armored humans: real sticky contact, fuse and explosive response; final peak and one-second aftermath screenshots. Deposits resolve to the visible outer armor rather than hidden cloth. Target silhouettes remain intact.
- Two final native-time 14-second recordings include eight consecutive detonations each, physical weapon/reload sound and live elemental buses. No consecutive detonation family repeats; long draws are occasional. Per-event seeds, families and unchanged reach are recorded. The shape profile is stable within an event; it is not randomized each frame.
- Moving armored fixture plus corrosive and beam plus ice were exercised through Game. Scripted movement verifies attachments, not AI behavior. Mech sticky fire was captured with the original paired equipment/muzzles intact.
- Actual collision receipts and screenshots cover floor, wall, raised top (y 1.525), slope, underside (y 3.45, downward normal) and a finite ledge. Human fixtures are moved away so these shots hit the intended support. These supports are static review meshes, not exhaustive coverage of every production triangle/animation.
- Both final clips decode 13.98 seconds of actual mixed audio. Unnormalized mono decoded peaks are 0.812 / 0.839, RMS 0.0157 / 0.0152, zero samples at or above magnitude 1. The native WebM decoder emits an Opus packet warning; it is preserved in `audio-validation.json`. MP4 exports are provided for playback. No replacement audio or gain normalization was applied. These checks establish a nonempty, unclipped capture, not subjective sound approval.

All evidence is under ignored `artifacts/adhesive-prototype/`. `index.html` links native/MP4 clips, full screenshots and receipts. Some early foam/petal captures remain historical rejected evidence; the report links final-build captures. The separate Opus review used earlier target captures from the same final VFX source before the lab-only surface-path correction; actual final recordings and all timing use the frozen build above.

## Automated validation and ownership

- `npm test`: **759 pass, 0 fail**; `tests/adhesivePrototype.test.ts`: **25 pass**.
- `npm run build` and the dedicated review build pass. Vite emits the existing large-chunk advisory.
- Meaningful comparisons cover all 13 projectile deliveries, exact hit receipts and projectile-root transforms, immutable recipes, pilot/mech original parts and muzzles, weapon-slot-only ownership, mixed routing once, unchanged unrelated sound recipes and existing adhesive rules (60% movement, three seconds, zero DoT).
- Geometry/profile checks cover nonuniform deformation, 1/2/3-pull families, pinched necks, finite normals, outward clearance for floor/slope/underside, independent reproducible cosmetic RNG and no adjacent explosion-family repeat despite interleaved contacts/secondary events.
- Surface/pool tests cover outer-armor selection and equipment exclusion, borrowed geometry/material/raycast identity, moving attachments, authoritative intensity/removal, true raised support height despite sticky clearance, no floating airborne pad, caps, pause, reset, release and disposal.

The existing renderer remains usable. No combat-lead-owned files or sibling element implementations were edited. [Integration](adhesive-integration.md) remains an explicit handoff; normal-main promotion awaits user visual approval and the material gaps identified in review remain open.
