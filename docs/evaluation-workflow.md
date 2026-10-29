# Arsenal evaluation workflow

For real-controller testing, use the [physical gamepad playtest plan](physical-gamepad-playtest.md): fixed combined/v3 settings, 36 encounter attempts and 18 dummy samples per profile, with explicit acceptance gates and tester attestations. Physical testing remains **NOT RUN** until recorded.

The [current v3 repeat and retained-v2 comparison](balance-v3-current-comparison.md) runs the same four-arm matrix without changing balance or pacing, including the shared simulation-clock integration. The [initial v3 snapshot comparison](balance-v3-comparison.md) remains preserved separately. Each report identifies its exact tested source.

For the approved secondary-element and mech heat changes, use the four-arm comparison in [balance-implementation-results.md](balance-implementation-results.md). Ordinary gameplay uses both changes; the development lab's **Balance** selector reproduces baseline, secondary-only, heat-only, and combined rules without altering saved equipment or encounter definitions. Historical evidence below retains its original source version.

Use `arsenal-evaluation-v1` to reproduce a build and scenario. Keep dummy measurements, browser combat, and physical controller results in separate records. Findings and proposed tuning belong in [evaluation-findings.md](evaluation-findings.md); this workflow does not change balance.

## Run the controlled baseline

From the project root:

```sh
node --import tsx scripts/evaluateArsenal.ts --out artifacts/evaluation
npm test
npm run build
npm run dev
```

The command writes evaluation artifacts under `artifacts/evaluation`. Its dummy runs are **simulated**, using the permanent dummy's geometry, real `PlayerBallistics`, status helpers, and `TestDummyMeter`. The small firing/cooling adapter mirrors the game loop; it is not the complete `Game` loop. Review this protocol when gameplay gates change. Automated input and collision checks do not establish hardware usability or human combat performance.

Open `/evaluation-lab.html` on the local development server for instrumented runs against the actual game. This lab is development-only. Its run controls use the combat lead's [encounter interface](encounter-integration.md). Export a record for each run and retain its build codes, complete equipped-item snapshot, seed, encounter configuration/version, source fingerprint, input device, protocol, and outcome. A seed alone is insufficient to reproduce a changed encounter or different gear.

### Browser controls and saved evidence

- Select a build, dummy/live scenario, seed, and dummy form, then choose **Load fresh configuration**. Start directly with **Begin measurement**, before entering or playing the game. The lab rejects pages whose gameplay clock/run has already advanced or whose equipped fixture changed.
- For the fixed-step actual encounter check, select **Live encounter**, then **Run scripted encounter**. It uses real game controls at 1/60s, ordinary movement around cover, body aim within 18m, normal abilities/healing, relay interaction, boarding and reward collection. It changes no stats, health, enemies or stages. A run stops at its explicit outcome or 480s timeout. Its provenance is **simulated**.
- For manual runs, use **Begin measurement** and play normally. Finish a dummy observation with **Finish dummy**; the live encounter reports its own completion/failure. **Abort** retains a partial run. Export JSON before choosing **Reload for next run**. Every attempt requires a fresh page so encounter counters, RNG, shot spread, gear and loot cannot carry over.
- Browser exports retain the event trace and frozen end snapshot. **Export JSON** saves a file through the browser; place it under `artifacts/evaluation/` with a distinct attempt filename. Keep any failed/timeout/aborted result. Hardware status defaults to **NOT RUN**; a person must separately complete and attach the checklist evidence before making a hardware claim.
- Summarize compatible exports with:

```sh
node --import tsx scripts/summarizeEncounters.ts artifacts/evaluation/encounter-*.json
```

The summarizer replays every event into a new recorder and requires an exact snapshot match, a finished run, zero rejected/dropped events, and matching source/protocol fingerprints. It refuses to pool changed source versions or duplicate run IDs. Save deliberate reproducibility repeats separately rather than weighting them twice in a comparison.

The delivered evidence has **234 dummy simulations**, **12 matched actual-game scripted encounters** (three builds × seeds 7, 8, 41, 97), and one pressure/seed-7 repeat with identical measurements and all 5742 events. Seed 8 checks the mirrored layout because the original three seeds share parity. These are small diagnostic samples, not statistical confidence or hardware testing.

`artifacts/evaluation/source-snapshot.tar.gz` contains the exact measured `src`, scripts, HTML entrypoints, package/lockfile and compiler configuration, without dependencies or saves. To rerun after parallel edits, extract it into a new folder, install dependencies from its lockfile, and run the same commands there. Use a local Vite configuration with `server.hmr = false` while collecting a fixed-version matrix; source reloads invalidate an in-flight measurement. CLI source fingerprints include all source files plus its experiment script, lockfile and compiler configuration; browser fingerprints cover all `src` TypeScript/CSS. Compare fingerprints within the same scope. The source archive preserves both scopes.

## Build fixtures

`src/diagnostics/fixtures.ts` owns the three fixtures. Each includes both forms so a staged encounter can require pilot movement and mech combat without substituting an unrecorded weapon. All six weapons are **level 5, rare, normal rolled proc chances**; `proc100` is reserved for diagnostic effect checks and must not enter the baseline comparison.

| Build | Pilot | Mech | Shield / reactor / legs manufacturer |
| --- | --- | --- | --- |
| Mobile precision | Kestrel sniper, bullet, kinetic, compact | Kestrel sniper, slug, kinetic, compact | Kestrel |
| Sustained elemental pressure | Voltaic SMG, arc, shock + corrosion, rapid | Voltaic SMG, arc, shock + corrosion, rapid | Voltaic |
| Heavy explosive / control | Ironvale launcher, rocket, gravity + fire, heavy | Ironvale launcher, rocket, gravity + fire, heavy | Ironvale |

Exact weapon codes:

```text
WS1:pilot:kestrel:sniper:bullet:kinetic:none:tracer:0:compact:5:rare:rolled
WS1:mech:kestrel:sniper:slug:kinetic:none:tracer:0:compact:5:rare:rolled
WS1:pilot:voltaic:smg:arc:shock:corrosive:tracer:0:rapid:5:rare:rolled
WS1:mech:voltaic:smg:arc:shock:corrosive:tracer:0:rapid:5:rare:rolled
WS1:pilot:ironvale:launcher:rocket:gravity:fire:tracer:0:heavy:5:rare:rolled
WS1:mech:ironvale:launcher:rocket:gravity:fire:tracer:0:heavy:5:rare:rolled
```

WS1 reproduces a weapon, **not the complete loadout**. Each form's shield, reactor, and legs are real level-5 rolls from independent seeds 1500, 1501, and 1502. Their slot rolls are held constant between builds: the shield is rare/Lightweight, and reactor and legs are common/unaffixed. Only their designated manufacturer differs. Retain all item stats and the resulting `getStats` values; do not substitute gear from an existing browser save. Fixture inventories, IDs, ammunition, starting vitals, and progression reset independently of normal saves. The whole-build comparison intentionally varies several choices; use the one-factor experiments below to attribute a result.

## Dummy protocol

- Use seeds **7, 41, 97**, each build, and each form. Reset the dummy's meter/statuses, vitals, ammunition, heat, reload state, and firing sequence before every run.
- Use the normal **19m** workbench lane and body aim for the baseline. Label critical-center aim and range changes as separate configurations. Do not mix their damage with the baseline.
- Hold the trigger for **30 active simulation seconds**, then release it for **5 seconds** to allow late projectiles and statuses to resolve. Keep reload behavior consistent. Record pending projectiles and remaining statuses; exclude future damage beyond the stop.
- Practical DPS is total damage applied during the full **35 seconds / 35**. Firing-window DPS is damage observed by trigger release **/ 30**. Neither is the card's burst DPS or the dummy HUD's trailing-five-second DPS.
- Report direct, status, and critical damage, shots/ammunition spent, heat-blocked time, reload time, and remaining supplies. The immortal dummy has **no TTK**. Its zero received damage is a property of the scenario, not a survivability result. Completing a timed dummy sample does not mean completing an encounter.
- Dummy results cannot establish crowd control, enemy defeat, incoming damage, cover tactics, chain/splash value across enemies, or encounter completion.

## Actual encounter protocol

The combat lead owns `Game`, shared world/UI integration, enemy behavior, and seeded gameplay. Diagnostics consume `onMeasurement` and the public reset/start/snapshot methods; they do not patch damage or enemy statistics. The encounter's seeded simulation/loot stream must remain independent of presentation randomness. See [the integration contract](encounter-integration.md).

1. Install a fresh selected fixture; capture both forms' exact equipment and the encounter snapshot. Start from full health/shields, ammunition, zero heat, and ready abilities/recovery. Reset between attempts; do not carry picked-up upgrades into the next build.
2. Start/replay the same encounter configuration with seed **7**, **41**, or **97**. Start the recorder before the encounter's first target spawn. Keep the route and objective policy consistent: pilot objectives, mount opportunity, combat, boss, then reward/completion as required by the scenario.
3. Play the full run. Capture actual applied damage and supplies from the measurement hook. Do not infer completion from enemy count: use the encounter's completion outcome. Death, timeout, and deliberate abort remain visible outcomes.
4. Stop/export on completion, failure, timeout, or abort. Record the reason and remaining objectives/targets. Keep a failed attempt in the dataset; never omit it to improve average TTK or completion.
5. Repeat after reset. Compare matched seeds and input policies. Separate browser input from physical hardware provenance, and separate pilot and mech ammunition. Retain individual runs before producing summaries.

Metric definitions:

| Metric | Definition / interpretation |
| --- | --- |
| Practical damage / DPS | Actual health plus shield removed; overkill excluded. DPS divides by the whole active run duration, including travel, objectives, reload, and heat. Paused menu time is excluded. |
| Target TTK | Export both spawn-to-death and first-damage-to-death. Summarize killed targets only and state the kill denominator. Surviving targets are censored (`null`), never zero-time kills. |
| Damage received | Sum actual health and shield damage separately, after mitigation. Healing, regeneration, or death restoration cannot erase earlier received damage. |
| Ammunition | Count successful shot events and ammunition consumed by form; reload transfers are not expenditure. A scatter trigger spends one round despite multiple pellets. Record pickups/refills separately if used. |
| Heat downtime | Active simulation intervals in which overheating blocks fire. Report reload intervals separately; they can overlap, so do not sum them into a claimed exclusive downtime total. |
| Completion | Explicit outcome and elapsed active seconds; completion rate includes every scheduled attempt. Record deaths and retries even when a later attempt succeeds. |

Exclude permanent-dummy hits from encounter damage, including splash, shock chains, and radiation pulses. Enemy damage cannot enter the dummy record. Flag rejected measurement events; a malformed or incomplete stream is not trustworthy evidence.

## Attribute tradeoffs with one-factor experiments

Use the same seeds, target layout, aim policy, ammunition, and unchanged gear for each pair. Export the altered configuration and full equipment every time.

- **Manufacturer:** change only the weapon manufacturer. Compare per-shot damage, ammunition efficiency, reload, heat, and completion; a higher card DPS does not prove a better sustained weapon.
- **Projectile:** hold receiver/manufacturer/elements fixed. Compare bullet/beam/slug against one target; arc/rocket/sticky against clustered and spread targets with and without cover. Include arc tests inside and outside 24m. Do not call stationary-target damage a crowd-control result.
- **Element:** hold weapon and delivery fixed. Compare kinetic, one elemental channel, and two channels; test shields and unshielded targets separately. Keep guaranteed proc checks in their own diagnostic dataset. Record control duration and incoming damage in live combat before valuing freeze, pull, or slow.
- **Equipment:** change only reactor manufacturer or only legs manufacturer using identical per-slot roll seeds. Compare cooling/capacity against heat downtime and mobility/protection against received damage and completion. Replacing all equipment at once cannot isolate a particular slot.
- **Aim/range:** compare body versus critical-center aim and short versus long distance as separate tests. Do not silently correct projectile drop or assume perfect weak-point access.

Prioritize recommendations by repeatable completion/survivability problems, then dominant choices lacking a cost, then smaller numeric differences. Include the comparison, seed range, effect size, limitations, and a falsifiable follow-up. Keep proposed balance values in the findings report; measurement tools remain neutral.

## Physical gamepad checklist — NOT RUN

No physical controller test or personal completion is attested by this document. Check boxes only after a person performs each item on actual hardware. Record tester, date, controller model/connection, OS, browser/version, game/source fingerprint, build codes, equipment snapshot, seed, and observed failures. Synthetic `GamepadLike` checks and browser automation remain **simulated**, even when they use the same mapping.

### Detection and control

- [ ] Connect a physical standard-mapped controller; press a button after loading the active browser tab. Confirm the displayed device name and gamepad prompts. Record unsupported mappings instead of treating them as passed.
- [ ] Leave both sticks centered for 30 seconds: no drift or accidental menu selection. Move just inside/outside the radial deadzone; verify smooth low-speed onset, full travel, and equal cardinal/diagonal speed. Test both sticks independently.
- [ ] Left stick moves proportionally; clicking it sprints. Right stick aims proportionally, with correct vertical direction. LT aims and lowers look sensitivity. Test small corrections on both dummy critical centers and moving enemies.
- [ ] RT fires while held and stops on release. Confirm trigger thresholds and no phantom fire when reconnecting or closing a menu. Compare recoil recovery, precision misses, and continuous pressure-fire control.
- [ ] X reloads when no loot is targeted; with targeted loot it takes/equips that item. Verify reserve transfer and no free ammunition. Record the context change clearly.
- [ ] A jumps once per press; release/repress in midair gives the second jump. Holding A must not create repeated jumps. Confirm landing resets availability for both forms.
- [ ] B during gameplay heals an injured pilot or repairs an injured mech, applies health at the recovery action's intended moment, and respects cooldown. B in menus goes Back and must not start healing. Test at full health and during cooldown too.
- [ ] LB mounts/dismounts near the frame, respects restricted areas, and preserves each form's equipment. RB activates pilot dash/mech shockwave with the correct cooldown and targeting.
- [ ] Y interacts with focused stations, encounter relays/objectives, supplies, and the final reward. Confirm visible focus/range feedback and one interaction per press. Empty-space interaction must not choose an unrelated object.
- [ ] D-pad up starts/replays the encounter when allowed, without duplicating an active run or reward. D-pad down marks targeted loot as junk; moving the left stick down must not do so.

### Menus, interruption, and workbench

- [ ] Back opens/closes loadout; Start pauses/resumes. D-pad/left stick moves focus, A selects, B returns. Check both inventory forms, scrolling, comparison, equipping, and focus after a list changes. Verify X sale, RB favorite, and LB junk remain menu actions.
- [ ] Reach the physical workbench and the pause-menu workbench using the controller. Navigate presets and every build field; change selects/numbers with left/right, choose Equip & Test and Reset Dummy, and return to live encounter without a keyboard shortcut.
- [ ] Reach build-code Copy and Load controls with the controller; verify an exported code loads the exact same weapon. Code text entry/clipboard may require the browser/OS text interface: record that assistance explicitly. Do not mark code entry as controller-only unless it actually is. Check feedback for invalid codes and denied clipboard access.
- [ ] Pause while a projectile/sticky fuse and status effect are active. Confirm projectiles, fuse, status durations, enemy attacks, and recorder time freeze, then resume without a jump or duplicated damage.
- [ ] Unplug the active pad during combat: combat pauses. Reconnect, release held buttons, and resume explicitly. Verify no immediate accidental firing, healing, interaction, or double activation. Repeat during workbench/inventory and note focus behavior.
- [ ] Change browser focus/background the tab and return; verify input does not remain stuck and the run record does not count paused time. Record any difference from explicit pause rather than assuming equivalence.

### Controller combat matrix

- [ ] Warm up once with each build; discard warm-up results but retain notes about usability failures.
- [ ] Run all three builds on seeds **7, 41, 97**, with **three recorded attempts per build/seed**: 27 encounters. Counterbalance build order: precision/pressure/heavy, pressure/heavy/precision, heavy/precision/pressure across repeats. Keep route, objective policy, and reset conditions fixed.
- [ ] Play every recorded attempt using the controller after fixture setup. Note any mouse/keyboard intervention and classify that attempt as assisted. Record device reconnects, deaths, retries, completion/outcome, elapsed active time, both forms' ammo, received health/shield damage, heat downtime, and reload time.
- [ ] Perform the 30s trigger + 5s drain dummy protocol with each build/form using physical aiming. Export those as hardware dummy records, separate from simulated dummy and hardware encounter records.
- [ ] Check readability and decision feedback while moving: weak-point visibility, incoming attack cues, heat lock, reload, healing readiness, objective focus, and final reward. Capture issues with build/seed/action and reproduction steps; numbers alone do not establish controller comfort.

Hardware status remains **NOT RUN** until the completed records exist. A green automated test suite does not change that status.
