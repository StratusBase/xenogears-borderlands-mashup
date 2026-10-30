# Gravity equipment alignment

30 October 2026. The user approved this equipment direction and requested normal-game integration. The equipment-only module is now registered in the normal Enhanced production factory; the full field mechanic remains a separate combat handoff. See the [current production receipt](gravity-production.md). The original [interactive prototype](http://127.0.0.1:5269/gravity-equipment.html) and [prototype footage, screenshots and measurements](http://127.0.0.1:5269/review/) below remain historical evidence for the initial review.

## Implemented presentation

- Small physical containment cells mount outside the actual barrel cross-section. Conventional cartridges have compact cells and feeds; ordnance has longer pressure feeds; energy/orb delivery has a larger focus. The mech cells face inward; secondary pilot Gravity also uses the visible inward mount. This avoids burying the cell under wide bores or receiver geometry.
- The field and equipment share `gravity/coreMaterial.ts`: persistent black center with a restrained violet edge (equipment rim gain 0.45; field default unchanged). Equipment uses a short 12% shot contraction and seven soft, finite inward wisp packets, with independent cosmetic event variation. Secondary core radius is 70% of primary, with no idle wisps and shot/rim intensity weighted to 62%. Stable per-device paths vary only at invisible cycle boundaries. Sparse soft wisps begin 5.5–8 core radii out, keeping the intake local and readable.
- Quiet idle and brief firing intake use the existing presentation time. The cell follows its actual barrel parent through recoil and reload. No new charging mechanic, background-refraction pass on the held gun, audio engine, damage field or collision surface is introduced.
- Original geometry is retained. Only Gravity-tagged cartridge materials are borrowed/replaced, then restored exactly. Cage, core and wisp geometry/materials are owned and disposed by the element. Presentation meshes do not raycast. Receiver, optics, other channels and other slots retain their materials and transforms.
- Existing shared gravity/weapon audio is retained in both comparison arms. Native recordings include report, fuse/contact, suction/crush, reload and release. No replacement soundtrack or microphone recording is used.
- Following the user's speed feedback, the equipment wisp cycle is now 0.40–0.62 s rather than 0.22–0.34 s, kick decay is 8 rather than 12, and texture rate is 14 rather than 23. These cosmetic values live in `gravity/timing.ts`; firing, reload and audio timing are unchanged. The separate field prototype now uses 21–27 m/s inflow and a 0.65 s lens collapse; its mechanics are not installed by equipment registration.

## Interfaces and ownership

`gravity/equipment.ts` owns construction, material and motion. `GravityEquipmentResponse` in `gravity/equipmentModule.ts` owns the element's map of equipment presentations under the existing common lifecycle. Its equipment-only `gravityEquipmentModule()` can be registered without creating another field response or changing other elements' recipes/impacts.

`gravityModule()` now composes the same equipment capability with the existing world response. `{equipment:'legacy'}` retains the old generic equipment for review. Do not register both gravity modules for the same element. The shared compositor suppresses only the generic Gravity equipment channel via `replaceEquipment:true`.

Forward `shot(spec, mode, rig.group, muzzleIndex)` through the common compositor. The current host already forwards the authoritative muzzle index. Only the matching active gun receives a pulse; automatic preview/drop and parked equipment do not receive the active rig's shot event. Retain `release(root)`, `clear()` and `dispose()` in the existing lifecycle. The initial prototype did not edit the production registry. The approved follow-up now adds `gravityEquipmentModule()` to `gameElements.ts` and an explicit verification branch to `main.ts`; `src/game.ts`, `src/world.ts`, `src/ui.ts` and equipment model geometry remain unchanged.

## Initial prototype verification

The following numbers describe the frozen initial prototype, before the slower timing and equipment-only production adoption. Use the [production receipt](gravity-production.md) for the current normal-entry results. Full well capture in this historical fixture is not proof of normal-main field integration.

- Frozen source: `artifacts/gravity-equipment/source`; exact compiled before/current build: `artifacts/gravity-equipment/build`. Source and compiled hashes are in `build-provenance.json`. Earlier draft placements and measurements are retained under `iterations/` and excluded from final results.
- Full frozen suite: **1,067 passing tests**, plus successful build and TypeScript check. The equipment matrix covers 208 pilot/mech × delivery × primary/secondary × construction cases. It checks original resources, exact muzzles, unrelated channels/slots, nearest ownership and release. A separate test checks that only the fired mech gun pulses.
- Six real-Game before/current pairs preserve exact local and world muzzle matrices at pilot/mech idle, shot and reload. Actual reload state is true in both reload captures. There are additional real rifle, precision, spreader, orb, rocket, mixed Fire + Gravity and Gravity + Corrosive frames, plus the production preview/drop model.
- Four native-speed 10-second videos compare pilot/mech before and after, with actual sound. Native WebM hashes match their recorder metadata; MP4 playback is unmuted, error-free and 1280×720. Audio is present and unclipped. Recordings show six targets captured while the actual equipment fires and reloads.

Matched elevated-wall scene, six intact clothed/armored targets, sound on, recording off; one 1/60 simulation step per rendered frame. Each arm has 120 warm-up and 720 measured frames. Full normalized combat and sound-cue snapshots are identical across each trio.

| Mode / equipment | Frame median / p95 | Simulation | CPU submit | GPU unique |
|---|---:|---:|---:|---:|
| Pilot / before | 8.20 / 10.30 | 1.70 / 2.20 | 4.30 / 5.00 | 1.78 / 4.20 |
| Pilot / current | 8.30 / 10.40 | 1.50 / 2.10 | 3.50 / 4.10 | 1.52 / 3.17 |
| Pilot / before repeat | 8.20 / 10.40 | 1.50 / 2.00 | 3.40 / 3.90 | 1.74 / 3.98 |
| Mech / before | 8.30 / 10.20 | 1.40 / 1.80 | 3.50 / 4.20 | 1.60 / 3.29 |
| Mech / current | 8.20 / 10.40 | 1.40 / 1.70 | 3.10 / 3.70 | 1.94 / 4.10 |
| Mech / before repeat | 8.30 / 10.40 | 1.30 / 1.80 | 3.10 / 3.60 | 1.65 / 4.10 |

Milliseconds, median / p95. Apple M5 Max / ANGLE Metal, 1280×720, DPR 1. GPU query coverage is 99.72–99.86%; raw distinct samples and pending queries are retained. Pilot peaks at three wells / 144 grit; native mech heat/reload limits peak at two wells / 96 grit. Both capture all six targets. Median draw calls change from 2108 to 2106 for pilot and 1848 to 1847 for mech. Display pacing and baseline GPU drift prevent a speedup or universal headroom claim.

The frozen source includes the host's concurrent `equipmentMuzzleIndex` metadata and production-registry updates. Source drift is enumerated by the receipt; historical measurements remain frozen under `iterations/`. Mixed-channel isolation here is demonstrated in the prototype's common fallback composition. The subsequent production integration has its own normal-entry matrix and matched runs under `artifacts/gravity-integration/`.

The additional detail images are explicitly labelled **3× camera crops of the same frozen gameplay frame**. They retain actual geometry, materials, source/muzzle transforms and game state. Normal screenshots, native recordings and performance all use the ordinary camera; fixture resets clear the inspection projection. HUD crosshairs remain visible in inspection. Secondary equipment remains subtle at native scale, particularly beside a bright beam.

## Opus 5.5 review

The user explicitly approved sending the gravity/equipment source, design notes and gameplay screenshots to Anthropic through the installed Claude CLI. Four successful, read-only reviews used exactly `claude-opus-5-5`; every tool call was `Read`. `artifacts/gravity-equipment/claude/audit.json` records models, read paths, results and costs. The gallery includes all critiques, latest first.

Opus identified abrupt re-seeding, oversized cores, halo-like paths, weak mounting hardware, a weak secondary hierarchy and several ownership/index edge cases. The implementation now has stable paths, one CPU kick, smaller recessed cells, soft 3D inflow, a canted cradle/single feed spine, explicit muzzle metadata, conservative missing-index handling, identity-safe release and fixed-matrix preservation. Tests cover both mixed-channel release orders and clock rewinds. Final initial-prototype critique found no substantive blocker and confirmed full-frame mech inflow separate from the projectile on the quiet gun. Some firing-gun wisps can blend with the unchanged projectile in a still; secondary wisps remain difficult to judge at native scale. These limitations remain disclosed after the user's visual approval.

Opus assessed source and stills only: **it did not play the videos, hear audio or assess the performance runs**. Actual native footage with sound and raw timing are provided for the user. The user subsequently approved equipment adoption. The later timing/integration review and current normal-game evidence are recorded in the [production receipt](gravity-production.md).
