# Gravity field: normal gameplay receipt

30 October 2026. Full pull, hold, lift and crush now run by default in normal Game. The combat lead owns the Game/World/UI host changes; presentation receives copied authoritative state/events through `GamePresentation.gravity` and never advances physics.

## Delivered behavior

- Gravity sticky, rocket and orb detonations create one source per projectile. Flight, fuse, direct/blast damage, equipment construction and muzzle sockets retain their existing paths. Automatic bullets and other nonqualifying deliveries retain their old control status.
- The source travels smoothly off its actual contact face over 0.28 s before attraction/crush activate. The same collision-checked center drives art, all-direction movement, hold and damage. Floor sources can keep bodies grounded; higher wall/underside sources lift them.
- Fields hold living enemies at distinct collision-resolved slots and apply recurring native Gravity damage. Other guns hit the actual moved bodies/hitboxes. AI movement yields while owned; attacks and ordinary hit reactions remain active. Natural expiry releases through swept falling/landing, without extra fall damage. Death/reset clears ownership.
- Secondary Gravity applies 0.62 crush power once, retaining reach/control. Three active wells share one-owner target arbitration and the existing presentation/audio lifecycle. Bosses, dummy, player, friendlies and props are excluded from capture/crush; ordinary direct/blast damage remains.
- The approved dark core, slower wisps/equipment and 0.65 s distortion remain. Enhanced restores active wells after Legacy without replaying prior crush cues. Turning presentation off never stops the authoritative mechanic.

## Gameplay evidence

[Review native sound clips, screenshots and raw results](http://127.0.0.1:5313/review/). Current normal entry with corrected cards: [live ordinary game](http://127.0.0.1:5311/). Evidence is ignored under `artifacts/gravity-production-field/`; earlier equipment/prototype evidence is preserved.

- Normal `/` passed the real Workbench pilot/mech equip path, ordinary firing/dummy damage, native encounter entry and a visible Gravity source in Service Vault. No review query, injected progression or fixture controls were used for that check. Browser pointer capture was denied; normal keyboard aim/mouse-firing fallback worked.
- Controlled high-health clothed/armored fixtures use the production Game field, AI, collision, attacks, damage and sound paths. Wall, floor, ceiling underside, raised support, blocked cover and late entry were checked for both loadouts. Every recorded body-versus-world clearance check passed. Late entrants joined active pilot sticky and mech rocket wells at approximately 1.13 / 1.10 seconds of active age; both reached six held targets.
- Six before/after idle, firing and reload pairs preserve exact local/world muzzle matrices and home transforms. Native frames preserve parked isolation and the firing mech gun's local response. Fire + Gravity and Gravity + Corrosive retain their equipment channel boundaries.
- Pilot/mech held-target rifle hits, native crush damage, release/landing, pause and Legacy restoration pass. Four native canvas recordings include the unchanged final game sound buses; no microphone, replacement audio or edited soundtrack. HUD evidence is supplied by screenshots. Audio streams are non-silent and unclipped, and browser playback is checked separately.
- Existing measured AABBs remain conservative world collision, not exact sloped-mesh physics or a general crowd collision solver. Additional cover can make a capture goal unreachable; it remains bounded pull/crush while visible rather than teleporting, penetrating or falsely reporting `held`. Within a feasible wall source, six slots converge without standing on the wall, with pair separation above 1.2 m in the host regression.

## Matched performance

One frozen compiled build for each before/current/before-repeat trio; same scene, loadout, seed and firing schedule, six live targets, sound on, recording off. 1280×720, DPR 1. Each arm has 120 warm-up + 720 measured frames and one 1/60 simulation step per rendered frame. Update timings include dev observation and world-clearance checks. Native-speed recordings are separate from measurement.

Each cell is **before / current / before-repeat**, milliseconds.

| Full integration cost | Median frame | p95 frame | Median update | Median GPU, unique queries |
|---|---|---|---|---|
| Pilot | 8.30 / 8.20 / 8.40 | 10.70 / 10.90 / 10.50 | 1.60 / 2.00 / 1.50 | 1.65 / 1.48 / 1.51 |
| Mech | 8.40 / 8.40 / 8.40 | 10.80 / 10.40 / 10.50 | 1.30 / 1.80 / 1.30 | 1.51 / 1.90 / 1.49 |

The old-mechanic arm is an explicit review-only `GameOptions.gravityFields:false` constructor seam. It retains the old status/planar behavior; outcomes intentionally differ. Ordinary `/` defaults to full fields. Baseline repeat snapshots match, but this is a total-cost comparison, not identical fights. Current pilot sustained fire reaches three wells, mech two; both affect/hold six targets. Instrumented update medians rise about 0.4–0.5 ms from the initial baseline.

A separate full/audio-only/full-art comparison retains **identical new mechanics, AI, damage and sound dispatches**, omitting only world art before. Both trios match complete normalized traces: 136 sound dispatches per pilot arm and 67 per mech arm. Field IDs normalize to spawn order. GPU baselines drift substantially: pilot median 1.55 / 2.09 / 2.16 ms, mech 1.67 / 2.10 / 2.19 ms. Display pacing and that drift prevent a rendering-speedup or spare-headroom claim. Raw median/p95, CPU submit, unique GPU samples, coverage and hardware are in the receipt.

## Source review, tests and card addendum

- Frozen source: **1,132 tests**, TypeScript and build pass. Exact `claude-opus-5-5` read-only review raised conditional concerns; new real-Game regressions prove a held ranged actor completes a >0.8 s windup across multiple native crush ticks, and all six sticky/rocket/orb surviving/lethal direct-hit cases create exactly one well with immutable recipes/fuses. Fourteen authoritative host tests pass. The critique and evidence-based triage are retained; Opus did not play, view motion, listen or measure performance.
- Normal Workbench inspection exposed old generic Gravity copy. A separate **UI-only post-capture addendum** corrects qualifying cards to “Every detonation”, variable crush, 4.5 s active, pull/lift/hold and 0.28 s deployment; secondary cards state 62% crush. Unsupported Gravity and sibling cards retain their previous semantics. Actual direct damage/DPS figures remain unchanged.
- The addendum passes 35 focused card/Workbench tests, including six new tests, **1,138 total workspace tests**, and TypeScript. Both pilot/mech cards are visually verified in live `/` at port 5311. All 28 checked captured gameplay/Gravity-render/audio source hashes match. The two updated card screenshots are labelled live addendum evidence; the frozen port 5313 binary intentionally retains its measured source and older card copy. Its captured gameplay/effects and timings are unchanged.
- An isolated snapshot of the scoped Git index also passes **1,092 tests**, TypeScript and the normal production build, excluding concurrent uncommitted Shock/damage-number work. This checks that the Gravity commit stands on its own; the larger workspace count includes those other owners' tests.
- Task-owned files are committed separately from concurrent Shock, damage-number, arsenal, tooling and other element work. Source/build hashes, additions and drift are recorded rather than silently refreshing old evidence. See [canonical design](gravity-design.md), [production interfaces](gravity-integration.md) and [coordination](gravity-combat-coordination.md).
