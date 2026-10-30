# Fire equipment alignment

The equipment must read as the same Fire family as approved Flashover/Cinderbrand/Backdraft: cooled dark construction, recessed red embers, orange/gold release and a small hot root. Equipment is a localized heat source rather than a permanent fire attached to the muzzle.

The prior full-pass review identified tiny vent hardware and inconclusive mech vent origins. This follow-up makes that construction visible in actual gameplay and uses Claude Opus 5.5 for both guidance and a final evidence review. Prior frozen full-pass media and timings remain separate under `artifacts/fire-full/`.

## Construction and response

- Only meshes tagged `equipmentElementSurface:'fire'` under the weapon owner receive additions. Keep source geometry, materials, transforms, raycasts and sockets intact. Receiver, grip, magazine, optics, shield, reactor, legs and other element cartridges remain owned by their original systems.
- Build a dark feed riser and a small angled vent shoe on the existing Fire chamber. Resolve the barrel/collar bounds at that axial station once, so the vent clears opaque launcher steel. Recess staggered warm baffles between thick dark cheeks. All additions are presentation-only and noncolliding.
- At idle, baffles remain dim embers; heat tears are hidden. A real shot heats the firing chamber, releases two fixed crossed authored tears, then cools. No billboarding or arbitrary camera offset. The shoe follows actual recoil and reload because it remains a child of the original chamber.
- Use independent cosmetic event profiles for lean, curl and release strength. Blend toward the selected profile during rapid fire; retain the choice through the response. This does not consume combat RNG.
- Pass the existing muzzle index through Fire's shot handler so a mech shot heats only the corresponding barrel. The asset builder stamps the socket with its actual rig-list index; Fire reads that explicit identity and does not depend on traversal order or map unknown chambers to arm zero. Broad ordnance gets a larger shoe/release; beam/arc cues remain shorter; heavy/compact construction scales the housing. Slot roles and original cartridge side remain intact.
- Reuse the shared authored Fire plume and atlas. The new optional curl uniform defaults to zero for projectile and previous equipment consumers. Release all owned geometry/materials/atlas leases; borrowed resources remain untouched.

## Opus 5.5 guidance

The restricted read-only review inspected the selected A/C boards, six original gameplay frames, `equipment.ts`, `equipmentModels.ts` and `plume.ts`. Canonical first-party model: `claude-opus-5-5`; permission denials: none. Full receipt: `artifacts/fire-equipment/opus-plan.json`.

Applied guidance: visible physical feed/shoe outside buried launcher chambers, comic dark housing, recessed baffles, fixed crossed exhaust, no idle tears, delivery variation, smooth shot variation and per-firing-barrel response. The initial candidate was built while that review ran; final captures use the refinements made after reading it. The peer's size/projection estimates were proposals, not runtime measurements. It reviewed stills/source and did not hear audio or watch video.

## Integration and matched comparison

Normal production `fireModule` uses the aligned equipment. No combat-lead file edits are needed. `createGameElementsBeforeFireEquipment` retains the exact approved full Fire impact/flight/audio and other production modules, selecting only the former subtle equipment profile. `FireOptions.equipment:'subtle'` remains a review compatibility path. Existing full/proof/Legacy renderers remain available.

Build `vite.fire-equipment.config.ts`; open `/fire-equipment.html`. It reuses the actual-Game driver and records real idle/fire/reload with both audio buses. The second scripted equipment trigger is after the real mech reload/cooldown; a third trigger uses the remaining round to show the other arm. Ammunition selects the actual arm, so the first two use muzzle 1 after a refill, and the third uses muzzle 0. The equipment review uses its own isolated save. Same-build before/aligned/repeated-before measurements keep aim, combat seed, fixed simulation steps, sound and other modules constant. Pilot rifle and mixed-channel mech rocket are measured separately.

Final media, measurements and independent equipment review are recorded below. Peer critique is not user visual approval; source/still review does not certify native sound, combat or performance.

## Final verification receipt

1063/1063 workspace tests and app/tools TypeScript checks pass. New regression covers explicit muzzle identity after hierarchy reorder and safe handling of an unknown chamber; the existing suite preserves all delivery replays, original parts/materials/raycasts, slots, muzzles, audio lifecycle and Legacy compatibility. Fire did not edit combat-lead-owned game/world/ui files. No Git initialization, push or deployment.

The final build has 20 compiled files; all match its recorded SHA-256 manifest. Current Fire assets, asset-builder metadata and shared production sources match that build. Only an unrelated Adhesive review source advanced during the final integrity check. The receipt identifies it; measurements describe the frozen artifact, not later unrelated work.

Normal main entry: workbench Pyro rifle, level 1 common guaranteed-status configuration, Enhanced and sound ON. Actual dummy total damage 120.95, last hit 23.60, ammunition 30→25. Native recordings: pilot 2 shots plus OUT/IN/BOLT reload; mixed mech 3 shots with muzzle indices 1,1,0 plus full reload. Source artwork/materials remain intact and the body/impact style is unchanged this turn.

Native 1440×900, 30 fps capture uses the real final physical and elemental buses, no gain, replacement audio, retiming or interpolation. Both final MP4s decode cleanly to 48 kHz stereo, nonzero sound, zero clipped samples and no captured gaps above 90 ms. Original WebM conversion has an Opus packet-header warning, retained in encode logs. This is evidence for the supplied two captures, not a guarantee of hitch-free first use on every delivery/device.

Matched sound-on measurements: Apple M5 Max / Chrome Metal, 1440×900, DPR 1, 120 warmup + 720 measured displayed frames per run, before/aligned/repeated-before. Recording OFF; no build, tests, encoding or peer review during measurement. Same actual Game, combat seed 37391, fixed 1/60 steps, fixtures, inputs and recipes. Both versions keep full Fire impact/flight/lingering/audio and the other modules. All normalized combat state is identical. Rifle reaches 3 targets; mech rockets reach 6.

| Scene | Mode | Frame | Unique GPU | CPU submission | Update |
|---|---|---|---|---|---|
|pilot-six-rifle|before|11.30 / 14.50|2.91 / 5.34|5.30 / 7.40|1.50 / 3.00|
|pilot-six-rifle|current|11.10 / 13.60|2.84 / 4.51|5.20 / 7.30|1.40 / 2.80|
|pilot-six-rifle|before-repeat|10.00 / 11.40|2.25 / 4.67|4.20 / 4.70|1.50 / 2.70|
|mech-six-rocket|before|10.00 / 10.90|2.09 / 3.78|3.70 / 4.20|1.30 / 1.60|
|mech-six-rocket|current|10.00 / 11.00|1.92 / 4.43|3.90 / 4.40|1.30 / 1.60|
|mech-six-rocket|before-repeat|10.00 / 11.00|2.18 / 4.31|3.50 / 3.90|1.20 / 1.60|

All values median/p95 milliseconds. Unique GPU query coverage is 99.44–99.86%; raw per-frame samples remain in the receipt. The pilot repeated baseline improves materially (11.30→10.00 ms median), so these runs do not support a precise tiny equipment-cost claim or a performance-win claim. Mech frame costs remain near 10.00 ms median. These are local-device results with visible drift.

## Completed Opus equipment review

Claude CLI used canonical first-party model `claude-opus-5-5`, restricted read-only packets, no permission denials. Three receipts are retained: construction guidance (`opus-plan.json`), equipment alignment critique (`opus-final.json`), and focused pilot/muzzle follow-up (`opus-pilot-final.json`). The user asked for this collaboration; peer critique is separate from user visual approval.

- The equipment critique inspected the selected A/B/C boards, nine native gameplay stills, Fire equipment/vent/plume/presentation source and passive capture facts. It passed the mech alignment: the raised shoe is visible above armor, and the flame comes from the shoe rather than the muzzle. The two fire frames agree with actual muzzle indices 1 then 0. It found no material blocker, but pilot idle-to-fire contrast was weak.
- Applied follow-up: cool aligned cartridge seams at idle and increase the narrow release envelope while retaining its source and palette. Replace hierarchy-order mapping with explicit socket metadata assigned at the rig muzzle-list insertion points. Preserve the source/slot/muzzle/physics contracts. Final captures and matched measurements were refreshed after these changes.
- The final follow-up inspected previous/current pilot idle/fire, pilot reload, both mech firing-arm frames, selected A, `equipment.ts` and `equipmentModels.ts` lines 1–498. It confirms better pilot contrast, mainly because idle went darker, and source mapping fixed with no blockers. It did not visually establish a larger fire flick; geometry tuning is not substituted for that visual observation. The pilot remains a restrained top-vent response compared with the brighter forward concept plume.
- Remaining review limits: single-frame critique does not assess native motion, curl variation, blending, audio, frame rate or GPU cost. Reload frames hide the housing during the pose; native videos provide the actual follow-through for user review. The reviewer did not inspect the Game shot call path or our regressions; local source tracing and passing tests cover the actual muzzle index and reordered/orphan cases. Future multi-barrel builders must stamp each socket's real list index. The legacy no-index `shot()` call intentionally remains an all-source Fire heat pulse for compatibility; normal gameplay supplies its actual index.
- Placement is a construction-local barrel bound plus a finite outer-shoulder lift, not a camera-derived visibility solver. Only the supplied rifle/launcher cases have native visual evidence; other deliveries retain automated behavior/slot tests and delivery-driven tuning but are not claimed as individually visually approved. Contrast against other environments and camera configurations remains a review limit.

The review page exposes both native clips with sound, original uncropped frames, the full peer critiques, exact state/timing receipts and build hashes. No further runtime art changes were made after that follow-up.
