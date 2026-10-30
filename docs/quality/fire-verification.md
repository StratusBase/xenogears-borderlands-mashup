# Full hybrid Fire verification

30 October 2026. Full A+B with C for authoritative explosive detonations, integrated through the normal Enhanced composition. The user explicitly authorized integration and then requested varied impact directions. Legacy and earlier proof adapters remain available.

## Final direction correction

Each actual contact/detonation chooses one stable independent cosmetic profile. Six nonrepeating sectors vary left/right bearing, shallow/medium/steep upward angle, curl, phase and timing. The profile is retained through the animation; it never rerolls every frame or consumes combat randomness. Supporting embers share its handedness. Floor flow stays upward; underside flow rolls shallowly along its support. Primary/secondary exposure and real Cluster bomblet sizing remain distinct.

Six continuing real shots, without rebuilding the scene or renderer, produced profile IDs 3,1,4,2,1,4. Their screenshots show different bearings; the real shot history has six entries and ammunition falls 30→24. The final native same-target recording has thirty real shots with sound. This demonstrates event variation, not a guarantee that every possible random profile is globally unique.

## Playable and recorded evidence

Frozen normal game: `http://127.0.0.1:5279/`. Review: `/review/`. Actual-Game lab: `/fire-full-lab.html`. Evidence lives in ignored `artifacts/fire-full/proof/`; the packaging script copies it into the frozen build's review directory. Original captures, normalized combat snapshots, timing samples, build hashes, video metadata and source provenance remain available in the review receipt.

- Normal main entry: K → Pyro workbench → Equip & Test → real firing. Enhanced and sound ON were checked. Refreshed dummy evidence records total damage 157.23 and last hit 30.68. Workbench side views show configured original construction; live equipment effects are demonstrated separately by actual gameplay videos.
- Intact clothed human: real repeated rifle shots, attached Cinderbrand, curved staggered lingering roots. No gore or mesh deformation.
- Moving armored human: actual sticky contact, original fuse, Backdraft detonation, smaller secondary recipients and outer armor aftermath.
- Six-target sustained sticky fire: actual firing/reload and multi-recipient exposure. Rifle sustained-fire benchmark reaches three unobscured targets; explosives reach all six.
- Pilot equipment: idle, actual shot, OUT/IN/BOLT reload, second shot. Mech equipment: primary Ice/secondary Fire, idle, one actual rocket and full OUT/IN/BOLT reload. The attempted second mech trigger falls inside the real reload and is correctly blocked. No altered cooldown/ammunition to manufacture evidence.
- Surface views: floor, wall, slope and underside contact/aftermath; head-height body response; sticky/rocket flight and Fire+corrosive beam examples. Earlier flight/beam/body stills predate final bearing/vent polish; final videos, floor/underside and six-shot comparison include it. Coverage is the supplied views, not every possible camera angle or weapon/brand combination.

Native recordings are 1440×900 at 30 fps with real physical and elemental buses mixed at original gain. VP8/Opus source is retained; H.264/AAC MP4s use passthrough timestamps, without retiming, interpolation, replacement sound or sound gain. All five decode to 48 kHz stereo with zero clipped samples. The original WebM conversion emits an Opus packet-header warning; delivered MP4s decode cleanly.

| Native clip | Real shots | Gaps above 90 ms |
|---|---:|---|
| Same clothed target / rifle |30|None|
| Moving armor / sticky |1|One 108 ms initial contact gap|
| Six targets / sticky |6|One 151 ms initial launch gap|
| Pilot equipment |2|One 107 ms initial shot gap|
| Mech mixed equipment |1|One 126 ms initial shot gap|

Those cold initial gaps remain visible and unresolved; shader/atlas warm-up reduces larger earlier stalls but does not establish universally hitch-free first use. Native playback and audio remain available for user assessment. No subjective listening claim is substituted by waveform measurements.

## Final matched measurements

Apple M5 Max, Chrome Metal; fixed 1440×900, DPR 1. Same compiled build, actual Game/scene/weapons/aim schedule/combat seed 37391, fixed 1/60 simulation steps. Before → full Fire → repeated before. Each run 120 warmup + 720 measured displayed frames. Sound ON, capture OFF. No build, tests, encoding or Claude processing ran alongside final measurements. Other production element modules remain enabled on both sides. Cosmetic entropy is independent of combat seed.

All values below are median / p95 milliseconds. Frame cost includes displayed frame interval; GPU timers and render submission/update are separately reported. Local-device results include baseline drift and do not imply universal FPS.

| Scene | Mode | Frame | GPU | CPU submission | Update |
|---|---|---|---|---|---|
| Rifle |Before|8.30 /12.10|2.60 /4.34|3.80 /7.50|1.30 /2.60|
| Rifle |Full Fire|8.30 /10.20|2.91 /4.58|3.60 /4.20|1.30 /2.50|
| Rifle |Before repeat|8.30 /10.30|2.64 /4.36|3.70 /4.30|1.20 /2.30|
| Sticky |Before|8.30 /10.00|2.85 /4.56|3.90 /4.40|1.40 /3.00|
| Sticky |Full Fire|8.30 /11.50|2.72 /4.23|3.90 /4.50|1.60 /4.50|
| Sticky |Before repeat|8.30 /10.10|2.89 /4.54|4.00 /4.70|1.30 /2.90|
| Rocket |Before|8.30 /10.20|2.88 /4.48|3.60 /4.10|1.20 /3.10|
| Rocket |Full Fire|8.30 /11.40|2.50 /4.48|4.10 /4.60|1.40 /3.10|
| Rocket |Before repeat|8.30 /10.20|2.51 /3.93|3.50 /4.00|1.20 /2.90|

All three comparisons pass exact normalized combat-state equality: shots, contacts, target health/statuses, ammunition, heat, positions and immutable weapon recipes. Raw results retain GPU query coverage and samples. These are sustained warmed measurements; they do not replace the cold-start limits above.

## Regression and ownership checks

- Full workspace tests: 1036/1036 pass. App and tools TypeScript checks pass. Logs retained under `artifacts/fire-full/`.
- Meaningful Fire regressions cover all 13 delivery recipes in both channel orders, pilot/mech source parts/materials/raycast/slots/muzzles, physical carriers/casings, exact beam endpoints, six-direction geometry, no adjacent profile repeats, support angles, primary/secondary and bomblet size hierarchy, private shader preparation, atlas lifetime and captured Cluster children after a Legacy switch. Shared replacement semantics retain deliberate live omissions while providing a safe post-disposal fallback.
- Fire did not edit combat-lead-owned `src/game.ts`, `src/world.ts` or `src/ui.ts`. Concurrent owner changes to shared/other-element files are outside the Fire patch. No Git initialization, push or deployment.
- All 17 compiled files match the frozen final manifest in `proof/build.json`. Fire and shared runtime sources listed in that manifest still match at integrity check. Only unrelated Radiation equipment/verification sources had advanced concurrently after the frozen build; the receipt names them. Benchmarks describe the frozen compiled artifact, not subsequent unrelated source edits.

## Opus equipment alignment review

Completed with installed Claude CLI using canonical model `claude-opus-5-5`, first-party provider, restricted read-only packet and no permission denials. Full output is retained in `artifacts/fire-full/claude-final-review.json` and exposed as `review/opus-review.txt`.

Opus inspected all 32 supplied stills plus `direction.ts`, `equipment.ts`, `plume.ts` and `hybrid.ts`. It did not read the supplied `response.ts`, `flight.ts`, `presentation.ts` or design document. It did not watch native video or hear audio and cannot independently certify combat or performance.

- Confirmed varied impact bearings, coherent red/orange/gold palette, upward floor flow, shallow underside roll, intact construction and no gore. It sees about four distinct directions in the six selected captures; two profile IDs deliberately recur nonconsecutively. The implementation guarantees no adjacent identical sector, not six unique directions per six shots.
- Described the revised C sequence as changing shape, with nested offset curls and inner warmth. It still reads as a ribbon/glyph in some frames and falls short of the original board's dense smoky volume. It accepts the selected proof lineage as a prototype step; it does not certify exact mockup reproduction.
- Remaining readability limits: pilot vent hardware is small in first person; the mixed mech views do not conclusively expose its Fire vent origin; soot is restrained on some surfaces. Workbench previews document original construction rather than live elemental effects. These are retained as limitations, not presented as closed visual approval.
- Peer review's statement that C has no smoke or ember support is limited to the `hybrid.ts` cards it read. `response.ts` separately supplies bounded smoke/particles around them. That does not erase its subjective thin-glyph concern.

Changes made after the earlier peer review and before these final captures: independently bending C tips/inner heat and offset crescents, shorter reach, upward floor growth, shallow ceiling rolls, six-sector event variation, and physical cartridge vent baffles. The final review is critique of that final build; no runtime art changed afterward. User approval remains separate from this peer receipt. Native motion/audio and the cold-start gaps remain directly reviewable.
