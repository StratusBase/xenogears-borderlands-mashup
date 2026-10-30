# Shock equipment: Live Terminals

30 October 2026. The normal Enhanced registry now replaces the old generic Shock equipment coating with construction-fitted contacts. This closes the equipment gap left by the impact integration. The approved A+B impacts, heavy-only C, sticky charge and smaller secondaries remain on their existing production paths.

## Visual construction and motion

- Narrow navy contact straps fit the actual barrel cross-section. Launchers and rotary/twin assemblies no longer bury a fixed-size ring; precision barrels no longer carry oversized washers.
- Mixed-element straps cover only an upper-side sector, leaving the other cartridge material exposed. Only Shock-tagged weapon surfaces change. Receivers, magazines, body, shield, reactor and legs retain their owners.
- Ceramic seats, metal terminals and white contacts mount on the real forward transfer band. Small cobalt/white leaders connect those contacts. The material paths sample the actual geometry facets once, rather than approximating a smooth cylinder.
- Sparse idle discharges, a short firing leader, dimming and a roughly half-second recharge share the existing simulation time. Precision weapons are quieter; beam/arc weapons bridge their actual emitter tips. C remains an impact effect.
- Each mech cannon has a separate terminal and firing pulse. The authoritative muzzle index selects it. Recoil, reload and root motion carry the attached geometry directly; no previous-frame world-center upload is involved.
- Preview/drop geometry uses its real construction and delivery metadata. Borrowed source materials and geometry restore exactly on release or Legacy transition; only owned straps, contact meshes, shaders and fixed-capacity segment pools are disposed.

## Integration interface and ownership

`shock/equipment.ts`, `equipmentGeometry.ts` and `equipmentSurface.ts` own this implementation. `createShockModule()` registers it through the shared equipment lifecycle. No combat clock, projectile system, audio engine or event bus was added.

`ElementResponse.shot(spec, mode, root?, muzzleIndex?)` gains an optional fourth argument. `GamePresentation.shot()` forwards the index already present on the authoritative presentation event. Old three-argument callers remain valid. No equipment code writes muzzle transforms, colliders, projectile specs, targets, damage, fuse or splash falloff. This equipment pass does not edit combat-owned `game.ts`, `world.ts` or `ui.ts`.

The shared wiring is already present. `shock-equipment-wiring.patch` isolates the three optional-argument seams without including concurrent shared-file changes; reverse-application checks against the isolated commit snapshot. Preserve the existing composition work when committing those shared files.

`createShockModule('capacitor', {equipment:'legacy'})` preserves the generic renderer during development. The equipment review baseline factory selects this option while retaining the approved Shock impacts/audio and every other production module. Ordinary Enhanced gameplay selects Live Terminals through the default registry, including automatic item models.

The existing approved firing, reload, impact and lingering sound recipes remain in use. Equipment pulses consume the firing event visually without adding impact sounds, a continuous hum or a new audio layer.

## Opus collaboration

Claude Opus 5.5 completed a read-only critique of the explicitly approved 21-file equipment payload. The audit records 21 reads, only the approved paths, and no shell/browser/edit tools. It identified the missing equipment override, buried fixed-radius bands, downward-facing local accents, normalized-width distortion and missing muzzle-index forwarding. The implementation follows its Live Terminals direction.

The critique reviewed the supplied baseline code, two approved concept boards and three gameplay stills. It did not review or sign off the finished implementation, motion, sound or timing. Those are verified locally below. The payload, complete critique and access audit remain under ignored `artifacts/shock-equipment/`.

## Verification

`tests/shockEquipment.test.ts` covers 48 pilot/mech, weapon-family and construction combinations; exact source restoration; local attachment through animated/scaled parents; separate cannon pulses; pause; preview/drop construction; mixed channels; and disposal ordering with the reference weapon upgrade. The integration suite continues to replay combat, source ownership, secondary behavior and fallback rendering. Only Shock-owned transfer-band geometry may be replaced while active; every original geometry/material restores afterward.

The equipment review uses the normal `index.html`, actual `Game` collision, firing, reload, fuse and chain logic, and final sound buses. Human fixtures have raised health, with alternating clothed and armored appearances. Inspection stills explicitly show the production preview/drop model placed for review; they do not claim a normal loot-drop interaction.

Performance compares generic equipment / Live Terminals / generic equipment again in one frozen main-entry build, using the same scene, seed, weapons, inputs and approved impact presentation. The normal registry accepts optional Shock presentation options; the review pins only its existing cosmetic seed to 37391 in both arms. Ordinary gameplay retains independent cosmetic variation. The packaging verifier requires exact impact-event and direction histories as well as complete combat equality. Each arm uses 120 warm-up and 720 measured displayed frames with one 1/60 simulation step per frame. Sound is on and capture is off. GPU results use unique resolved queries and report coverage, rather than reusing latched display samples. Native-speed clips are separate from timing runs. Earlier provisional runs without a pinned direction seed remain in `iteration-one/` and are excluded from the final comparison.

Reproduce the source/ballistic contract with:

```sh
SHOCK_OUTPUT_DIR=artifacts/shock-equipment node scripts/verify-shock-integration.mjs
```

The output-directory option preserves the original verifier default. Seven approved impact/sticky/audio sources still match `7941c45`; the current ballistic engine matches `32caa1e` and all 13 delivery-family replays. The shared lightning segment shader now accounts for parent scale when deriving width; world-space impact groups retain their unit-scale width.

No push or deployment. Shared foundation files also contain concurrent element work; do not stage or revert them wholesale.

## Final evidence

- [Gameplay with sound, paired screenshots, construction coverage and timings](http://127.0.0.1:5302/review/).
- 1,034 tests pass, including 101 Shock checks; production and frozen review builds pass. All 13 exact ballistic delivery-family replays pass. A transient concurrent Fire test failure was retained in its own log; the subsequent full run passes.
- Ten fired-equipment scenes cover rifle, launcher, mech, precision, twin barrels, rotary, pilot/mech beam, Fire+Shock and Corrosive+Shock. Additional captures show actual pilot/mech reloads, idle, and rotated production item models.
- The ordinary objective encounter was checked separately with the default unseeded registry and manual mouse fire. Ammo30→29 and a live Shock event were recorded. Embedded pointer capture was denied; the existing click fallback worked. Fixture arrays are excluded from this smoke receipt.
- Four native captures run8.22–8.40s, with both original final sound buses. All play unmuted with advancing time, no media error, nonzero decoded PCM and zero clipped samples. Timestamp-preserving MP4 decoding passes; original WebM files and encoding logs are retained.
- Twelve matched timing runs have identical complete combat, impact-event and cosmetic-direction histories. GPU coverage is716/720 unique resolved queries per arm (99.44%), with four pending and no disjoint/lost queries. Only this review pins Shock's existing cosmetic seed; ordinary gameplay retains independent variation.

Before / Live Terminals / repeated before, milliseconds,1280×720 DPR1 on Apple M5 Max /Chromium156:

| Scene | Frame median | Frame p95 | Game/HUD CPU median | Draw CPU median | Unique GPU median |
|---|---:|---:|---:|---:|---:|
| rifle | 16.20 / 16.70 / 16.50 | 20.80 / 20.50 / 19.80 | 2.20 / 1.90 / 1.70 | 9.70 / 10.70 / 9.40 | 2.60 / 2.77 / 2.76 |
| sticky | 15.80 / 16.70 / 18.80 | 21.90 / 24.70 / 25.00 | 1.80 / 1.80 / 2.00 | 9.60 / 11.10 / 12.40 | 2.54 / 2.81 / 2.90 |
| mech | 13.70 / 14.60 / 14.40 | 17.40 / 17.00 / 17.10 | 1.60 / 1.70 / 1.50 | 6.10 / 7.60 / 6.50 | 2.15 / 2.27 / 2.22 |
| beam | 16.10 / 16.60 / 16.80 | 21.20 / 22.10 / 21.40 | 2.00 / 1.80 / 1.60 | 10.00 / 10.40 / 10.50 | 2.63 / 2.86 / 2.66 |

The new GPU medians are2.27–2.86ms across these scenes. Initial/repeated baselines span2.15–2.90ms. The launcher baseline drifts from15.8 to18.8ms frame median and2.54 to2.90ms GPU median; its new arm lies between those GPU baselines. Do not infer a precise equipment cost or a speedup from that scene. Lower-end/high-DPI hardware remains unmeasured.

Package the retained receipts with `node scripts/package-shock-equipment-review.mjs`; package original captures with `python3 scripts/package-shock-equipment-audio.py`. Raw gameplay/audio/Opus access receipts, source/build hashes, full distributions and coverage limits remain under ignored `artifacts/shock-equipment/verification.json`. The review build remains frozen after the measurements.

The user approved the equipment and requested a Shock-only commit. Its isolated snapshot includes the required earlier Shock production wiring and neutral equipment/impact/capture hooks, while excluding changes from other element workstreams. Radiation was committed independently during isolation; its already committed implementation and hooks remain in the parent. Pending Fire/Adhesive registrations, flight overrides, palette changes, UI and development tooling stay outside this commit. The combined working tree stays intact.

Commit isolation was checked separately: 997 tests and a production build pass from a clean HEAD archive plus the exact Shock commit contents, using the project's Node25 runtime. The 101 Shock checks also cover a baseline with generic Fire rather than requiring the concurrent Fire implementation. The shared registry retains normal fallback channels; pending concurrent registrations remain in the working tree for their owners to commit.

The gameplay captures and matched timings above remain the frozen combined-workspace evidence, with their original source and bundle hashes. They are not relabeled as measurements of the isolated commit. Shock equipment, shaders and approved impact/audio assets are the same; the independent commit checks establish that no uncommitted element dependency is required. Nothing was pushed or deployed.
