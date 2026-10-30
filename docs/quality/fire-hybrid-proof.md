# Fire A+C hybrid proof

30 October 2026. User authorized a small hybrid A+C proof with Claude Opus 5.5 before another full element pass. Baseline checkpoint: `54cd19c`.

## Scope

- A: deliberately forked directional tear, colored red/orange/gold with a small bright contact strike.
- C: separate open crescent artwork on the actual explosive detonation; sticky contact still uses A.
- Primary silhouette comes from layered cubic-path artwork baked into a palette-indexed SVG atlas and sampled on animated mesh cards. A small version of the previous raymarched field supports the contact core for 180 ms at 24% of its previous dimensions. It does not supply the main silhouette.
- Main and secondary art gestures spawn at staggered times and bend at different rates. Source curves retain broad fork gaps; no perforation noise or radial flower construction.
- Secondary blast recipients retain the previous exposure-scaled small response and do not receive primary cards. B status, equipment, projectile/trail geometry and audio recipes retain their previous implementations. This proof does not claim those parts match the concept boards.

## Collaboration and ownership

Claude Opus 5.5 is authoring the bounded vector path data from the A and C concept boards. Codex owns atlas baking, mesh animation, surface placement, integration, tests, runtime capture and performance verification. The completed proof will be returned to Claude for a read-only art-direction check using exact event-aligned captures and motion frames.

The new module has no authoritative simulation interface. `FirePresentation(scene,camera,{hybrid:true})` selects it; default construction keeps the previous volume version usable. Main gameplay defaults remain unchanged. `src/game.ts`, `src/world.ts`, `src/ui.ts`, collision and ballistic/muzzle owners are not edited.

Current impact notifications have no incoming velocity field. The proof uses a camera-derived tangent plus outward surface bias, without inventing shot data or changing combat interfaces. Every card clips against the real visible support plane. Contact is anchored to the actual outer body/armor source, while weapon and other equipment slots remain excluded by the existing shared surface selection.

## Review entry

```sh
npx vite build --config vite.fire-hybrid.config.ts
npx vite preview --config vite.fire-hybrid.config.ts --port 5221 --strictPort
```

Open `/fire-hybrid-lab.html`. The two modes compare previous puffy Fire versus hybrid A+C in the same compiled Game, using an isolated save. The original `/fire-lab.html` and previous review build remain separately usable.

The proof exposes `FireResponse.prepare(renderer, scene)`: it waits for the atlas, uploads it, and compiles the exact linear offscreen variants plus a retained, invisible status-shader template. The temporary renderer target is restored immediately; it neither fires nor steps combat nor attaches a dummy overlay to any target. The review entry awaits this before first-shot capture. This is a handoff for the combat owner to use when this style is integrated.

Capture controls freeze at 50, 100 or 250 ms after the actual contact/detonation, then optionally advance by 50 ms. Video starts with one second of quiet encoder lead-in and records the actual physical and elemental sound buses at30fps using VP8 to reduce encoder cost. The first candidate had first-use shader/capture stalls in A; it is archived separately and is not the final motion proof. Recorded contact/detonation timestamps identify the correct burst frames for external review; still sequences do not establish perceived motion or subjective sound quality.

The first Opus proof review found a viable direction but required a continuous hot spine, warmer fringe, asymmetric C arms, attached tip-first fade, and a fresh A recording. Those focused changes were applied, with C path adaptations by Codex to the Claude-authored source. The revised proof passed the separate small-proof check recorded below; the previous critique is retained as history.

Verification and final review results are recorded below. No full Fire rollout, push, or deployment is part of this proof.


## A+C verification before the targeted root correction

- Runtime build passed. The final workspace test checkpoint passed 812/812. The two Fire suites pass39/39, including exact replay for13 deliveries, all slot/material/geometry checks, primary/secondary separation, bounded resources, source following, pause behavior and shader-preparation isolation.
- A clean source snapshot at `54cd19c` plus only these Fire changes passes TypeScript, the39 Fire checks, and the normal production build. The shared working tree's current TypeScript check is blocked by concurrent Ice performance/profiler imports and types (`src/dev/iceFrameProfiler.ts`, `src/dev/icePerformanceLab.ts`, and their reference artifact imports). These files were not edited for Fire. See `artifacts/fire-hybrid/final-typecheck.log`.
- Actual Game screenshots cover A and C on clothed and armored humans at50/100/250ms. Floor A and wall C provide contact-plane sanity checks; full surface/angle/head-hit acceptance is deferred. Free-play checks and browser errors are in `browser-check.json`.
- Final media: actual 1440×900 canvas recordings at30fps, physical and elemental buses, decoded48kHz stereo, no clipped samples. Five event-aligned frames are distinct in both A and C. A has no frame gaps over90ms. C retains a single94ms gap at the initial sticky contact, before detonation; the detonation release sequence changes normally. No retiming, interpolation or sound replacement. The original Chrome WebM emits one Opus-header warning on decode; MP4 playback is verified.
- Source and compiled-asset fingerprints are in `proof/build.json`. The before/current/repeated-before comparisons use this same compiled build, scene, seed, input, fixed simulation steps, sound on and capture off. Each has120 warmup plus720 measured displayed frames. Rifle reaches3 targets; sticky reaches6; complete authoritative state is identical across all three modes/runs.

Times below are median / p95 milliseconds. Frame timing varies with shared machine load; GPU timing more directly reflects rendering cost.

| Scene | Volume frame | Hybrid frame | Volume repeat frame | Volume GPU | Hybrid GPU | Repeat GPU |
| --- | --- | --- | --- | --- | --- | --- |
| six-rifle | 9.70 / 11.90 | 9.40 / 11.90 | 9.40 / 12.90 | 2.67 / 4.07 | 2.09 / 3.30 | 2.64 / 3.85 |
| six-sticky | 11.80 / 16.70 | 12.40 / 17.80 | 8.60 / 11.50 | 2.47 / 4.30 | 2.22 / 4.86 | 2.12 / 3.41 |

## Claude follow-up and next gate

The [Opus5.5 final check](fire-hybrid-opus-review.md) finds no blockers to showing this **small proof**: A and C distinguish, faces stay readable in the supplied frames, A's live frame sequence changes, and fade remains attached. The review does not certify native motion, audio, combat or performance. Codex performed those runtime checks separately.

Remaining visible caveats: C can tighten into a letter-like curl, and the upper arm passes close to the chin at some moments. Broader head-hit/camera-angle safety is unverified. A remains cleaner/vector-like and less hot than the concept paintover. This is not final Fire rollout approval. Review the actual moving A+C proof before extending B, equipment, projectiles or environment treatment.


## Targeted lingering-root correction after user feedback

Checkpoint `004ded4` preserves the A+C proof before this correction. The user then identified a straight flat base in the lingering body flames. This is a small additional correction, not the deferred full B material/soot pass.

- The visible lower contour is now a curved, seeded, moving boundary inside the quad. Its physical quad edge is transparent; the root is offset to sit into the contact rather than floating above it.
- Flamelets use different surface heights, independent tilt and staggered starts. Their candidate roots are projected back onto real visible surfaces of the same material kind; equipment-slot surfaces remain excluded.
- Existing authoritative status duration/intensity, damage, collision and muzzle/projectile behavior remain unchanged. Both the previous-volume and hybrid comparison modes share the corrected lingering roots.
- 41 Fire checks pass, including new clothing/armor cases that verify distinct root heights, staggered births, visible-surface attachment, and untouched source and equipment geometry/materials.
- Actual clothing and armor screenshots, native-speed cropped aftermath videos with original sound, and a multi-target live freeze are included in the review. The user's original screenshot is retained as the observation, not presented as a matched camera comparison.
- Final clips were re-recorded after this correction: both have five distinct event-aligned release frames, no frame gaps above90ms, decoded48kHz stereo audio, and zero clipped samples. Audio starts20ms after video. The earlier94ms sticky-contact gap belongs to the archived pre-correction clip.

## Root-corrected build measurements and final checks

Both comparisons use the root-corrected build whose hashes are in `proof/build.json`. The primary A+C comparison remains previous volume versus hybrid; both share the body-root correction. Times are median / p95 milliseconds.

| Scene | Volume frame | Hybrid frame | Volume repeat frame | Volume GPU | Hybrid GPU | Repeat GPU |
| --- | --- | --- | --- | --- | --- | --- |
| six-rifle | 10.60 / 13.00 | 10.60 / 12.80 | 10.50 / 12.60 | 2.67 / 3.92 | 2.07 / 3.12 | 2.69 / 3.91 |
| six-sticky | 10.50 / 12.50 | 10.20 / 12.70 | 9.80 / 12.80 | 2.30 / 3.58 | 2.14 / 3.29 | 2.20 / 3.57 |

The rifle comparison reaches3 targets and sticky reaches6; all authoritative state compares exactly across before/current/repeated-before. No build, test or encoding work ran alongside these final measurements. Prior investigative and pre-root-fix runs remain archived separately. These are local-device measurements, not a universal performance claim.

The 41 Fire checks and TypeScript pass in the isolated Fire snapshot. The latest full-workspace run passes825/825, and the shared TypeScript check passes. Earlier concurrent Gravity and Ice failures were resolved by their owners; their investigative logs are retained. These unrelated files were not modified for Fire. See `root-final-workspace-tests.log` and `root-typecheck.log`.

Native gameplay input also passes: one click changes ammunition30→29, R reload restores30 and reduces reserve500→499, Escape pauses, sound is ON, and browser error logs are empty. Pointer lock may be denied by Chrome; the existing right-drag fallback remains available.

A+C artwork and its final Opus proof review are unchanged by the root-only correction. The targeted root correction was verified separately in actual single-target and sustained multi-target gameplay. No game/world/UI owner files were edited, and no rollout/push/deployment was performed.
