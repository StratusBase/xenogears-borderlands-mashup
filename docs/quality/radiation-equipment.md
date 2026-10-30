# Radiation equipment alignment

30 October 2026. The user requested equipment effects to align with the approved Gamma Flash + Fallout Bloom, in collaboration with Claude Opus 5.5. Runtime assets are procedural game geometry, not generated replacement images.

## Result and ownership

`radiation/equipment.ts`, `equipmentHardware.ts` and `equipmentProfile.ts` own shielded chamber fittings, warm sulfur/ivory viewing slits, a short shot-driven charge, finite fallout grains and delivery-dependent decay. A small map in `radiation/presentation.ts` routes the existing rig-scoped shot event. It schedules no extra audio: the shared physical/elemental engines remain authoritative.

Only authored `element-chamber-*` meshes tagged Radiation receive fittings. The actual chamber channel supplies primary/secondary identity, including automatic preview and drop paths where an abbreviated appearance might otherwise promote a secondary. One fitting per physical barrel: one pilot weapon, two cockpit/world cannons, one standalone dropped cannon. Secondary windows visibly charge at lower brightness, never go ivory, and emit no grains. Fire's chamber and other equipment slots remain separate.

Physical shielding is opaque and inked. Only the luminous batch bypasses the ink pass. All fittings are presentation-only and non-raycast. Existing source geometry/materials, socket transforms, projectiles and collision remain unchanged. Two additive muzzle metadata fields carry weapon family and assembly into automatic views; they do not change muzzle positions. The neutral preview-framing predicate excludes presentation-only attachments.

Support comes from real weapon triangles under the footprint. A merged reference mesh's distant high detail must not lift a cap; the regression reproduces that failure. Pilot housings use local support and a short solid skirt. The heavy mech uses a bounded solid containment housing at the forward chamber rather than thin posts, so it stays visible from the cockpit. Exact inverse source matrices handle attachment rotation/scaling. Initially hidden rig views receive bindings before normal mode switching.

The same existing view/game time advances idle and shot charge; paused or repeated-time renders cannot advance it. Rapid fire limits peak brightness; beam/arc uses a bounded cadence-derived hold; heavy deliveries get longer afterglow and up to four small grains per cannon. Stable cosmetic variation is independent of gameplay randomness. Heavy slit tails are staggered. The current rig-level notification energizes the paired cannon containment bank together; actual alternating muzzle behavior is unchanged.

## Opus collaboration

Read-only CLI reviews explicitly use `claude-opus-5-5`, restricted/safe mode, Read/Glob/Grep only, no edits, shell or MCP tools, and no persistent session. Prompts, exact model receipts and results are in `artifacts/radiation-equipment/opus-*`.

The initial review identified hidden/wrong-channel mounts, missing firing response, inconsistent mech counts and an olive palette. The second rejected the first alignment revision: shielding lacked ink, secondary charge did not affect real painted color, and thin supports looked like stilts. Those were corrected, along with batched-mesh false clearance, and new normal-game screenshots and a diagnostic hardware tint were supplied for the final review. The diagnostic magenta is explicitly an inspection aid, never the production palette.

The third review passed construction and code with two remaining proof requirements: retain yellow under ivory at firing peak, and supply matching idle/shot/decayed frames. The final revision keeps sulfur-yellow wells and rear viewports around smaller ivory cores, with at most 13 luminous instances per fitting. Nine phase captures use exactly zero shots at idle and one actual Game shot at peak/decay, with the same camera and real recoil. The fourth Opus 5.5 review closed both items: “Neither the stills nor the JSON shows a code or visual blocker.”

Its review covers code, screenshots and material/shot audits. Opus did not watch/listen to the clips or assess performance; those are independently recorded below. It calls simultaneous paired-cannon containment charging optional polish, and notes the devices remain small at native gameplay size. User visual approval remains separate.

## Verification

Meaningful equipment regressions cover 384 manufacturer/family/variant/mode constructions; source materials and raycasts; muzzle matrices; correct secondary chamber binding; hidden-rig mode transitions; preview/world/drop counts and fixed framing; live instance colors across secondary charge/decay; pause/repeated-render stability; finite batches; shared-geometry final-owner disposal; no extra shot audio and no pulse on another weapon root; and disconnected high geometry in the reference batch. Existing radiation replay coverage retains all 13 deliveries and combat/status outcomes.

Actual captures use the production default in both the ordinary main URL/workbench and an isolated actual-Game comparison entry, `radiation-equipment.html`. The baseline substitutes only the frozen previous equipment class; impacts, projectiles, audio, Fire, Shock, corrosive and the shared renderer remain the same. The fixture reuses the existing Game verification/capture/performance code and a separate save. Ground-drop inspection explicitly hides the loot card; normal firing captures retain ordinary gameplay. No gore or new combat rules.

Final combined-source validation: **1,038 tests pass**, TypeScript passes, ordinary production build passes. The measured equipment build is frozen at `2026-10-30T15:10:24.285Z`; its source hashes are in `build/provenance.json`. Subsequent concurrent source drift is recorded in `source-drift.json`; Radiation rendering sources still match.

Matched before → aligned → before repeat, same compiled build, six actual targets, sustained rocket fire, sound unlocked/on and recording off. Each arm: 120 warm-up + 720 measured fixed-step frames; 1280×720 DPR 1; Apple M5 Max / ANGLE Metal. Before replaces equipment only. All three arms have identical shots, damage/status, body state, kills and loot. All six targets are hit. Baseline-repeat draws and geometry counts are identical.

Frame time median / p95 (ms):

| Scene | Before | Aligned | Before repeat |
|---|---:|---:|---:|
| Pilot / Radiation primary | 8.20 / 10.90 | 8.20 / 10.80 | 8.20 / 10.90 |
| Mech / Radiation primary | 8.30 / 10.30 | 8.30 / 10.20 | 8.30 / 10.20 |
| Pilot / Fire + Radiation secondary | 8.20 / 10.40 | 8.20 / 11.20 | 8.10 / 10.40 |

| Scene / arm | Update ms | Submit ms | Unique GPU ms | Draws | Geometries |
|---|---:|---:|---:|---:|---:|
| Pilot / Radiation primary / before | 1.60 / 3.10 | 3.50 / 4.10 | 1.69 / 2.46 | 1530 | 716 |
| Pilot / Radiation primary / integrated | 1.60 / 3.10 | 4.00 / 4.80 | 1.66 / 2.52 | 1505 | 677 |
| Pilot / Radiation primary / before-repeat | 1.60 / 3.10 | 3.80 / 4.70 | 1.75 / 2.65 | 1530 | 716 |
| Mech / Radiation primary / before | 1.20 / 1.60 | 2.90 / 3.30 | 1.92 / 2.90 | 1313 | 613 |
| Mech / Radiation primary / integrated | 1.20 / 1.80 | 3.00 / 3.70 | 1.97 / 3.19 | 1310 | 601 |
| Mech / Radiation primary / before-repeat | 1.20 / 1.70 | 2.90 / 3.40 | 1.97 / 2.98 | 1313 | 613 |
| Pilot / Fire + Radiation secondary / before | 1.90 / 3.90 | 4.10 / 4.90 | 1.89 / 2.75 | 1600 | 878 |
| Pilot / Fire + Radiation secondary / integrated | 1.90 / 4.00 | 4.20 / 5.30 | 1.91 / 2.76 | 1575 | 839 |
| Pilot / Fire + Radiation secondary / before-repeat | 1.90 / 4.00 | 4.30 / 5.00 | 2.03 / 2.81 | 1600 | 878 |

Median frame cadence stays at 8.2–8.3 ms. Pilot draw calls fall by 25; mech by 3. New opaque inked hardware adds modest CPU submission cost. Fire + secondary Radiation p95 rises 0.8 ms; this is reported rather than claimed as a speedup. Unique GPU timing coverage exceeds 99.7%, with no disjoint samples; its medians stay within baseline-repeat variation. These are local results on one device/browser. `performance-results.json` retains complete traces; `performance-summary.json` contains compact receipts.

Final sound clips tap the actual physical and elemental audio buses. No microphone, replacement soundtrack, normalization or retiming. Recording is disabled during performance timing. Earlier integration/visual evidence remains frozen in its original artifact folders. No commit, push or deployment is part of this equipment task.

## Review artifacts

Open `http://127.0.0.1:5264/review/` for the compiled gameplay videos, screenshots, phase inspection, exact Opus verdict and performance receipts. Repackage with `node scripts/package-radiation-equipment.mjs`; this copies evidence and does not rebuild the frozen runtime.

Final clips contain VP9 1280×720 and stereo Opus 48 kHz from the existing game buses. They run approximately 12 seconds at native time and retain the original sound level. Audio peak checks are -4.9 dBFS (pilot), -4.2 dBFS (mech), -4.9 dBFS (secondary). Unmuted browser playback decodes without media errors. This proves recorded sound and playback, not an independent subjective listening verdict from Opus.

The final ordinary main URL was also verified through the normal workbench, Equip & Test, and native mouse firing: five rounds spent, live Radiation status and damage on the ordinary dummy. `ordinary-final-preview.jpg`, `ordinary-final-gameplay.jpg` and `ordinary-final-ui.txt` preserve this check. The embedded browser denies pointer lock; normal mouse firing works with its existing fallback. No review driver or custom factory is installed at that URL.

Console receipt: `browser-console.json` records no ordinary-main renderer errors and no review-page media errors. The ordinary entry reports its expected embedded-browser pointer-lock warnings. Repeated comparison setup also records `Texture marked for update but no image data found` warnings in the shared renderer. Radiation equipment itself uses no textures; the concurrently composed Fire path loads an atlas asynchronously, which is a likely source, not a proved stack-traced diagnosis. Timings exclude 120 warm-up frames in every arm, and the final recordings decode correctly. This equipment pass does not change Fire texture ownership.

## Accepted delivery and local commit boundary

The user accepted the equipment alignment and requested a local Radiation-only commit on 30 October 2026, without pushing. The commit contains Radiation runtime, audio, review entries, tests, documentation and only the neutral integration hooks required by Radiation, including the existing-death-rule notification. Concurrent Fire/Shock modules, their production registrations and dedicated review controls, labels, UI and development tooling stay outside this commit and remain in the live checkout. Shared files are staged selectively; their complete working copies are preserved.

The isolated proposed commit tree passes **923 tests** and the standard TypeScript/production build, independent of the concurrent uncommitted modules. The earlier 1,038-test receipt and matched performance recordings describe the frozen combined build identified above, rather than a new performance measurement of the isolated commit. Generated mockups, recordings and measurement artifacts remain in the ignored artifact folders.
