# Physical gamepad playtest — combined settings, Relay Break v3

**Status: PLAN / NOT RUN.** This document declares acceptance criteria for a person using real hardware. Automated input, simulated gamepads and the existing encounter matrix do not satisfy these criteria. Keep the combined settings and v3 pacing unchanged throughout collection and review.

## Fixed candidate and fixtures

- Balance: `combined`, with `secondaryElementCost: true` and `mechHeat: true`. Secondary-channel effective damage remains 85%; mech heat remains `min(31, 120 / fireRate)`, unlocking strictly below 45% capacity. Pilot heat/unlock, cooling, capacity, ammunition, reload, abilities and recovery remain unchanged.
- Encounter: `relay-break-v3`, vitality scale 1.3, six squads, 24 targets, 37,951 total target health plus shields. No forced waiting, enemy edits or route shortcuts to reach a timing target.
- Use the three complete fixtures in [gamepad-fixtures.json](playtests/gamepad-fixtures.json). They include both forms' exact weapon codes, shields, reactors, legs and resulting stats. A WS1 code restores only a weapon; loading codes into arbitrary saved gear is insufficient.
- Freeze one candidate before collection: record its Git commit, dirty-source fingerprint, source archive and dependency lockfile. A commit alone is insufficient when local source changes exist. Verify the four locked-file hashes in the fixture reference and both rule flags. If the candidate changes, start a separate dataset; keep prior attempts.

| Build | Pilot / mech weapon | Equipment maker | Main hardware question |
| --- | --- | --- | --- |
| Mobile precision | Kestrel sniper; kinetic bullet / slug | Kestrel | Can a person make small aim corrections, track and reposition reliably? |
| Sustained elemental pressure | Voltaic SMG; arc, shock + corrosion | Voltaic | Can they sustain fire, recognize heat locks and recover without losing control? |
| Heavy explosive / control | Ironvale launcher; rocket, gravity + fire | Ironvale | Can they place deliberate shots and manage reload, travel time and control effects? |

The [current simulated comparison](balance-v3-current-comparison.md) is context: combined means were 205.81 / 212.12 / 259.91 seconds. Those are not human benchmarks. Do not require identical human DPS, zero received damage or a particular random proc sequence.

## Coverage and session order

A **profile** is one tester + physical controller + connection type + OS/browser/version + display configuration. Start with one standard-mapped wired controller. Test wireless and other controller/browser combinations as separate profiles before claiming them supported. Record firmware if known; an unsupported mapping is a coverage gap, not a pass. Do not pool testers or profiles to conceal a failing build.

For each profile:

1. Perform the common controls checklist below. Allow one practice encounter per build, declared as practice before starting; retain notes but exclude practice from scored results.
2. Record **18 dummy samples**: three builds × pilot/mech × three repeats, seed 7, 30-second firing window plus five-second drain. Run focused build tasks separately from these clean samples.
3. Record **36 encounters**: three builds × seeds **7, 8, 41, 97** × three repeats. Seed 8 covers the mirrored layout.
4. Use [gamepad-run-sheet.json](playtests/gamepad-run-sheet.json). It rotates build order and seed order across three blocks of 12 encounters. Split blocks into sessions, with breaks between them. Budget approximately **4–5 hours per profile**, including setup, practice, notes and breaks.

Repeat the complete profile for additional testers when broader usability confidence is needed. Report individual results; this initial sample establishes acceptance for the tested profile, not population-wide performance.

## Setup and physical recording

Use the development evaluation lab, with hot reload disabled during collection. The combat lead owns shared Game/input integration; diagnostics own evidence and analysis. No integration change is needed to prepare this plan.

From the frozen candidate directory, with its dependencies available, start the existing local server (choose another unused port if needed):

```sh
node --import tsx scripts/serveBalanceMatrix.ts --port 5195 --root "$PWD" --out artifacts/physical-gamepad/server-simulated-only
```

This server disables hot reload. Ignore its printed matrix-page link; open the **plain evaluation lab** at `http://127.0.0.1:5195/evaluation-lab.html` with the query below. Manual exports are downloads; save them in the profile's evidence directory. The server's matrix-save endpoint is for simulated records and is not the hardware collection path.

1. Open a fresh `/evaluation-lab.html?scenario=encounter&balance=combined&build=mobile-precision&seed=7`, substituting the scheduled build/seed. For dummy samples use `scenario=dummy&mode=pilot` or `mode=mech`. The fixture selector loads both complete loadouts independently of normal saves.
2. Record controller model, connection, browser-visible gamepad ID, `standard` mapping, OS/browser versions, display refresh rate, tester ID and candidate fingerprint. While still on the start screen, press a harmless detection input such as RT/LT, then **fully release it**; verify the gamepad HUD label. Do not press A/Start or enter gameplay before Begin. If time/run advanced, reload the fresh configuration.
3. Confirm full health/shields, magazines/reserves, zero heat, ready abilities/recovery, correct equipment and a fresh encounter counter. Keep the default presentation and the same sensitivity/settings for the profile.
4. Choose **Begin measurement** directly from the fresh page. Then play with the physical pad. Setup, Begin/Export clicks and observer notes may use mouse/keyboard; log them as administrative assistance. Any mouse/keyboard gameplay intervention makes the attempt **assisted**.
5. **Do not choose Run scripted encounter or use `driveEvaluation`, `stepEvaluation`, `renderEvaluation`, synthetic gamepads or input automation.** Those change input/clock ownership and cannot establish physical play.
6. Record screen/video and observer notes covering the input HUD, timing, heat/reload cues, objectives and failures. Export immediately on completion or failure, before reloading. Use a fresh page for every attempt; do not carry loot, purchases or progress forward.

The current manual Begin flow leaves real-time simulation and physical gamepad polling active. Original exports intentionally retain `provenance: browser` and `hardwareStatus: NOT RUN`. **Preserve those bytes.** Attach a copy of [gamepad-attempt-template.json](playtests/gamepad-attempt-template.json) with a unique external attempt ID, original-export hash, physical-device evidence, assistance log and the tester's own attestation after execution. The signed sidecar establishes physical provenance; a tool must not certify it for the tester.

Fresh pages reuse raw IDs such as `encounter-<build>-<seed>-1`. Prefix the run-sheet suffix with profile/session IDs for the external identity. Keep the raw ID unchanged. Aggregate by external attempt ID, never by raw ID alone.

## Common controls — every item must pass per profile

Use the full [physical checklist](evaluation-workflow.md#physical-gamepad-checklist--not-run) for detailed steps. Record each item as PASS, FAIL, BLOCKED or NOT RUN, with evidence. A blocked or unmeasured required item prevents signoff.

| ID | Test | Acceptance |
| --- | --- | --- |
| C1 | Detection, movement and aim | Correct physical device/standard mapping; 30 seconds of neutral sticks produces no movement, aim drift or menu action. Slow/full stick motion is proportional and diagonals do not gain speed. Both sticks work independently; LT reduces aiming sensitivity. |
| C2 | Fire and reload | Ten ready-weapon press/release trials per form: each deliberate press fires, release stops further shots after the input frame, and no shot occurs while blocked by heat/reload. X reloads with no focused loot; rounds transfer correctly. |
| C3 | Jump, sprint and form change | A press/release/repress gives exactly two jumps; holding A does not repeat jumps. L3 sprints. LB boards/dismounts only where allowed, preserving each form's loadout. |
| C4 | Context actions and recovery | B heals in gameplay and goes Back in menus; it does not do both. X equips aimed loot, Y interacts, D-pad Down junks aimed loot. Inventory X sells, RB favorites and LB marks junk. No action leaks across contexts. Test recovery when injured, full and on cooldown. |
| C5 | Objectives and replay | Using the pad, disable both relays, board, cross the battle entry, defeat the boss and collect the reward. D-pad Up starts/replays when permitted; it does not duplicate an active run or reward. |
| C6 | Menus and workbench | Back opens loadout, Start pauses; D-pad/left stick navigates, A confirms, B returns. Reach workbench, change a field, Equip & Test, reset dummy and return without a keyboard gameplay shortcut. Record any OS/browser assistance for build-code text entry separately. Restore the fixture before scored runs. |
| C7 | Pause and focus | During a projectile/status/reload, pause for ten wall-clock seconds: active timer, gameplay, ammunition and effects do not advance. Background/return pauses safely; no stuck movement or firing. Repeat once per form. |
| C8 | Disconnect and reconnect | Disconnect during firing and during a menu: gameplay pauses and does not resume on reconnect alone. Release buttons/sticks, reconnect, then resume explicitly; no unintended shot, heal, jump or selection before the intended input. Repeat once per form. |

Xbox labels above describe standard button positions. Record the equivalent labels on another device rather than guessing compatibility from its product name. Source reference: radial deadzone 0.16, trigger threshold 0.5, menu direction threshold 0.55; these remain unchanged and are not new tuning proposals.

## Build-specific tasks — both forms

Perform these outside timed encounter attempts and outside the clean dummy firing windows. A normal rolled proc is probabilistic: do not enable `proc100`, change gear or require a proc on a particular shot.

| Build | Focused acceptance criteria |
| --- | --- |
| Mobile precision | At the 19m dummy, at least **8/10 deliberate body shots hit** per form. In **4/5 trials per form**, acquire the visible critical center within three seconds and hold the reticle there for one second using LT and fine stick correction. Judge reticle placement from video; random critical damage does not prove weak-point aim. Complete a strafe → stop → aimed shot → reposition sequence five times without unwanted sprint, jump or form change. |
| Elemental pressure | Hold RT through **three naturally occurring overheat/recovery cycles in mech form**: fire is blocked while overheated and resumes without needing an extra trigger press once ready. Release RT stops fire. In both forms, sustain and track the dummy for ten seconds without an unwanted menu/form action. For shock/corrosion effects that actually proc, the tester can distinguish the observed cues; collect three clips of each channel for review, or mark cue coverage BLOCKED rather than inventing successes. Test one deliberate mech RB vent and a second press during cooldown: no duplicate activation; preserve the existing 40-heat/9-second rules. |
| Heavy / control | At 19m, at least **8/10 deliberate body shots hit** per form after familiarization with travel/drop. Ten ready-weapon single-shot trials consume exactly one round per registered shot; delayed splash/status damage never consumes an extra round. In **5/5 reload → aim → fire trials**, firing resumes with no stuck lock or unexpected extra launch. Capture gravity/fire cues when they proc, with three clips each or BLOCKED cue coverage. Demonstrate moving to cover during reload and returning to fire without losing aim/control. |

For numerical heat boundaries, use recorded internal telemetry if available; a rounded HUD percentage cannot prove an exact threshold. Hardware signoff checks usability and input behavior. The prior numerical tests remain separate simulated evidence.

## Clean dummy measurements

- Use seed 7, the scheduled form, the fixed **19m** lane and body aim; stay still. Use normal automatic reload behavior; do not manually reload, vent, heal, use abilities or resupply during the sample.
- Start the firing window at the first consumed-round/shot event (`t0`), **including a miss**. Hold RT for **30 active seconds ±0.25s**, then release for **five active seconds ±0.25s** before Finish dummy. An observer can operate Finish after the physical firing/drain window; log that administrative action.
- Record the actual RT-release timestamp against the active game clock, using synchronized controller-view video or equivalent passive physical-input evidence. **The last shot is not the release time:** heat/reload can leave a gap while RT is still held. If release timing cannot be verified, mark timing UNVERIFIED and retain the sample as a protocol deviation.
- Aim/setup may take place after Begin, so the export can include a prelude. Preserve it. Compute the comparable window from `t0` through release/drain; clip heat/reload intervals to that window and retain actual durations. Report damage / actual window duration; use the 35-second reference only when timing passes tolerance. Never treat the full-export DPS or trailing HUD DPS as this window's DPS.
- Retain direct/status/critical damage, shots, ammunition, heat-blocked and reload seconds, remaining ammo, pending effects and aim misses. Dummy TTK is **not applicable**; dummy received damage does not measure survivability.
- All **3/3 samples per build/form** need valid timing, complete event replay and fixture/provenance evidence. Keep a mistimed/assisted sample as a protocol deviation; an additional diagnostic sample does not erase it or silently replace a scheduled result. No human DPS parity requirement is imposed.

## Encounter acceptance — apply separately to every build/profile

These are predeclared human-play goals. They are not already demonstrated by the simulated matrix and do not authorize balance changes.

| Gate | Required result across 12 scheduled attempts per build |
| --- | --- |
| Evidence | **12/12 attempts accounted for**, with matched candidate/fixture, original trace, unique external identity, device/assistance record and tester attestation. All traces replay exactly with zero rejected/dropped events. |
| Controller completion | At least **11/12 controller-only completions**, and at least **2/3 on every seed**. Death, timeout, abort or gameplay assistance counts against this gate. |
| Pacing | At least **10/12 scheduled attempts** are controller-only completions in **180–300 active seconds**, with at least **2/3 on every seed**. Early clears remain misses; do not slow down or wait to meet the target. |
| Objectives and damage | Every completion includes both relays, boarding, all six squads, boss and reward; 24 kills and applied health-plus-shield damage reconciles to **37,951** within floating-point tolerance. Keep incomplete target timings censored on failures. |
| Usability | C1–C8 and the build's focused tasks pass. The tester correctly identifies heat/reload state, recovery readiness, current objective and next intended action in **4/5 observer prompts per build**. Ask after a segment/pause, not during a timed firefight. |
| Blocking defects | **Zero unresolved critical/major control defects:** stuck inputs, lost progress, inability to aim/fire/finish an objective with the pad, incorrect context actions, or unsafe pause/reconnect behavior. Retain lesser issues with severity and reproduction evidence. |

Both completion gates use all 12 scheduled attempts as the denominator, not only successful or unassisted attempts. Report completed-only timing separately from the all-attempt observed duration, with counts. Keep normal human aiming, cover, abilities, recovery and supply use; record pickups/refills and do not equip acquired upgrades during a scored run.

The manual lab has no automatic 480-second cutoff. At **480 active seconds**, the observer selects Abort and records `observerStopReason: observer_time_limit`. Preserve the raw `aborted` outcome; do not rewrite it to `timeout`. It fails completion/pacing. Abort for a control blocker immediately and retain the partial evidence. Start any retry as a new external attempt; do not replace the original.

## Review and handoff

- Diagnostics reviews each original event trace, fixture and source; the tester personally confirms physical device use and assistance. The combat lead reviews shared gameplay/control defects. Reviewers do not fill in unperformed hardware checkboxes.
- Report per build/profile: completion and pacing counts; complete/all-attempt duration and range; practical damage/DPS; killed-target TTK with denominator; received health/shield damage; pilot/mech ammo; heat/reload downtime; supplies, assists and all failure reasons. Keep dummy, human combat and simulated references in separate tables.
- Fresh-page raw IDs repeat. Existing `summarizeEncounters.ts` must be run **one export at a time**, with a unique `--out` directory. Its generated prose and `hardwareStatus` describe simulated evidence even for manual exports; use it only for accounting. Use the signed external attempt manifest for hardware classification and aggregate every scheduled row yourself. Dummy exports require the generic replay check below rather than the encounter-only summarizer.
- Mark each build/profile ACCEPTED only when every gate passes. Otherwise mark NOT ACCEPTED with the failed/missing criteria. Missing coverage is not a pass. Keep combined settings and v3 pacing fixed; return evidence for review before proposing any change.

### Generic event-accounting check (diagnostics operator)

This read-only check works on one dummy or encounter export. It validates accounting only; it cannot attest physical hardware use. Replace the placeholder filename with one original export.

```sh
node --import tsx --input-type=module - path/to/original-export.json <<'NODE'
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { CombatMeasurement } from './src/diagnostics/measurement.ts';
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
assert.ok(data.measurement?.outcome);
assert.equal(data.measurement.rejectedEvents, 0);
assert.equal(data.droppedTraceEvents, 0);
assert.ok(Array.isArray(data.events) && data.events.length > 0);
const replay = new CombatMeasurement(data.measurement.metadata);
for (const event of data.events) assert.equal(replay.record(event), true);
assert.deepEqual(replay.snapshot(), data.measurement);
console.log('Event accounting PASS; physical provenance requires tester attestation.');
NODE
```

Current execution status for every profile, build and criterion remains **NOT RUN** until a person performs and records the tests.
