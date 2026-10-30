# Gravity: smooth deployment and transient sheets

30 October 2026. User correction to the [pressure-fold pass](gravity-pressure.md): remove the strand that stays and pulses, and make the orb float quickly/smoothly off a struck surface before suction begins.

## Result and contract

- Removed lane zero's anchored head/window, fixed direction/reach/width and travelling pulse displacement. All eight lanes now carry staggered inward windows with faded restarts. Crush still contracts the core; it does not deform sheet geometry.
- `GravityFields` owns a 0.28-second smoothstep deployment from a collision-clear near-contact start to the existing collision-checked destination. `well.center` is the actual moving position, consumed directly by art. No visual-only offset, renderer clock or target teleport was added.
- Optional `well.deployment` contains deep-copied start/destination, elapsed time and duration. `gravityActive()` gates membership, pressure art and the pressure bed. `age` counts only active time, carrying substep overshoot at settle. Active lifetime remains 4.5 seconds; first periodic crush remains 0.5 seconds after activation. Existing direct weapon blast damage is unchanged.
- Required `clearSourcePath` validates swept source-volume travel, not just the final point. The neutral `effectBodyPathClear` wraps the existing sweep without changing its behavior. Obstructed routes are rejected; a newly blocked route cancels the source. Pausing, eviction and teardown handle pending deployment without ownership/damage leaks.
- The core has a separate deployment fade. Sheets, grit and wakes remain hidden until settle and then fade in. Cached support-plane clipping uses the final destination, not the initial moving center. Sound recipes/buses remain unchanged; the pressure bed now waits for activation.

The [combat handoff](gravity-integration.md) records the new port and snapshot meaning. Normal `/` integration remains combat-lead work; this is a controlled actual-Game prototype with stationary high-health clothed/armored humans and their preserved combat proxies, not a normal AI encounter signoff.

## Review and evidence

Open `/gravity-lab.html` in the build produced by `vite.gravity-emergence.config.ts`; review output is ignored `artifacts/gravity-emergence/`. Native wall/floor clips include real firing, fuse/detonation, deployment, capture, kinetic rifle follow-up, recurring crush and release/landing with captured game buses. Recordings are not retimed. Scene/style/build identities and SHA-256 are checked; gameplay frame samples include deployment position and phase.

Actual-Game phase receipts cover wall, floor, underside, raised support, slope, blocking cover, late entrant and rocket/orb scaling. During every pending deployment sample there are zero field members, periodic crush ticks or pressure-bed cues; targets retain their initial positions, and art matches the authoritative moving center. Seed swaps retain identical complete combat and audio-cue histories. Direct blast damage can still appear during deployment.

Claude Opus 5.5 reviewed the design and then current source/tests plus actual gameplay stills, using Read only. Its second review found no blockers. Accepted corrections include final-plane clipping, separate core visibility, carried settle time and explicit audio/membership gates. Its proposed zero-travel fallback and extra activation event were not adopted: obstructed travel is rejected, and authoritative snapshots already supply activation. A flagged dark shape was traced in a separate diagnostic entry to background range-dummy hardware, not an abandoned field effect. Claude did not play continuous footage or listen to sound; motion/audio approval remains with the user.

The source/build archive isolates the task-start `game.ts` from concurrent radiation edits without changing the live file. Both measured variants and every final recording use that one compiled build. The thin-renderer reference shares the new deployment simulation and adapted bed gate; it hides its orb during deployment and is only a render-cost reference. The earlier pressure-fold recordings/build remain untouched for the actual visual-history comparison. See `task-baseline.json`, `baseline.json`, `build-provenance.json`, `source/`, recording manifests, Claude receipts and raw timing JSON for provenance.

## Validation and measurements

37 focused gravity/main-presentation tests and 876 full tests pass. Coverage includes source travel on all face normals, finite monotonic easing, no early ownership/damage, exact active duration/cadence, pause/clear/dispose/eviction, thin-obstacle route rejection, deep snapshots, chunked-update settle time, the moving visible core and transient unpulsed sheets. Exact ballistic replay retains all 13 delivery families. App build, live typecheck and performance outcomes are recorded with the final packet below.

Frozen application typecheck and Vite build pass. The latest whole-workspace `npm run build` also passes; an earlier concurrent Fire test type error was resolved outside this change. The final full-test checkpoint is 876/876. All four delivered H264/AAC clips decode without audio errors, contain nonzero unclipped 48 kHz sound (after peaks .568 wall / .563 floor), and browser playback is verified unmuted with no errors. Native WebM captures remain preserved; transcoding reported Opus packet-header warnings, so decoded MP4 validation is recorded separately rather than claiming pristine native audio containers.

Matched rendering comparison: Apple M5 Max / ANGLE Metal, 1280×720, DPR 1; six targets, three wells, 144 grit instances; 120 warm-up + 720 measured frames per run, sound on and recording off. Both variants use the new deployment rules. Values are median / p95 milliseconds.

| Scene | Variant | Frame interval | Simulation CPU | Render submit CPU | Full render GPU |
|---|---|---|---|---|---|
| wall | before | 14.10 / 22.50 | 1.90 / 2.60 | 4.80 / 7.40 | 1.42 / 2.24 |
| wall | current | 16.40 / 24.10 | 2.20 / 2.90 | 6.80 / 8.50 | 1.49 / 2.23 |
| wall | before-repeat | 13.50 / 14.90 | 1.80 / 2.30 | 4.50 / 5.00 | 1.38 / 1.96 |
| floor | before | 13.40 / 14.60 | 1.70 / 2.20 | 4.40 / 4.90 | 1.42 / 1.99 |
| floor | current | 13.20 / 14.50 | 1.60 / 2.00 | 4.30 / 4.90 | 1.37 / 2.01 |
| floor | before-repeat | 12.80 / 14.20 | 1.70 / 2.20 | 4.40 / 5.00 | 1.34 / 1.94 |

Complete normalized combat and cue histories match across both trios and cosmetic seed swaps. Wall corrected pressure measured 16.40 ms median / 24.10 ms p95 frame intervals and 6.80 ms median render submission versus 14.10 / 22.50 ms and 4.80 ms for the thin reference. The repeated wall baseline then improved to 13.50 / 14.90 ms, showing material machine/pacing drift. Floor corrected pressure measured 13.20 / 14.50 ms versus 13.40 / 14.60 ms. GPU medians were 1.42 → 1.49 ms on wall and 1.42 → 1.37 ms on floor. These data do not establish a speedup, an isolated causal CPU regression or a 60-FPS signoff; wall stress CPU/frame cost remains a production performance consideration. All raw min/max, median/p95, counts and repeat results are retained.


## Limits

Real depth can still hide the floor core behind captured actors. Sloped cover uses conservative AABB collision; source starts may be farther from its visual face. Rejected obstructed travel is an intentional change from endpoint-only placement, so production collision/encounter coverage must assess close corners and low-wall impacts. Equipment, muzzle positions, projectile flight, fuses and unrelated combat remain outside this correction. No push or deployment is authorized by this review.
