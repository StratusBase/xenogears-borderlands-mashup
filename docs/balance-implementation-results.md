# Secondary-element cost and mech heat

The authorized change enables both weapon rules in ordinary gameplay. The four-arm comparison holds **Relay Break v2** fixed at the version captured before implementation. Separate diagnostic switches reproduce baseline, secondary-only, heat-only and combined behavior without changing the loadout, enemy budget or input policy. No further weapon tuning is performed in response to acceptance results.

The user resolved a concurrent-workstream conflict with **“Keep v3; retain the v2 comparison.”** The shared project therefore retains the combat lead's separate Relay Break v3 pacing work, plus the parallel presentation integration. The comparison here remains an immutable v2 experiment; it is not presented as a four-arm validation of the later integrated game. The [source receipt](../artifacts/balance-matrix/source-comparison.json) lists those concurrent source differences, verifies the numerical rule modules and diagnostic entrypoints byte for byte, and separately checks that current Game/UI integration still uses the approved helpers.

## Implemented values

| Rule | Baseline | Combined default |
| --- | --- | --- |
| Effective damage with a valid secondary channel | 100% | 85% |
| Mech heat per consumed trigger | 31 | `min(31, 120 / fireRate)` |
| Mech overheat unlock | Strictly below 30% capacity | Strictly below 45% capacity |
| Pilot heat / unlock | 8 / 30% | 8 / 30% |

The damage cost is applied once at shot creation, before actual projectile collision, splash, chains, critical modifiers and proc-power calculations. Direct and per-proc item-card values use the same helper. Saved damage rolls, item metadata, build codes, proc chances and durations remain intact. A kinetic primary with a valid secondary pays the cost; invalid, duplicate and kinetic-secondary metadata does not invent an extra channel. Fixed target-health-based radiation pulses and the mech ability retain their own damage rules. Cooling, capacity, ammunition rules, the 40-heat vent and its nine-second cooldown retain their existing values.

## Actual encounter comparison — frozen v2

**48/48 encounters completed. Combined pacing acceptance fails narrowly: 11/12 runs meet 180–300s; pressure/seed 97 completes at 172.10s.** The observed exception is retained, not tuned away. All 48 event traces replay exactly to their measurements, with zero invalid/dropped events, unchanged fixture equipment, correct actual arm rules, 24 kills and 34,450 applied health-plus-shield damage per completed run. Both relays, boarding, all six squads, boss group and reward collection are included.

Mean completion seconds across seeds 7, 8, 41 and 97:

| Arm | Precision | Elemental pressure | Heavy/control |
| --- | ---: | ---: | ---: |
| Baseline | 200.12 | 282.98 | 202.83 |
| Secondary cost only | 200.11 | 339.96 | 254.20 |
| Mech heat only | 197.27 | 162.05 | 205.99 |
| Combined | 197.83 | 184.23 | 213.82 |

[Full observed rows and acceptance exceptions](../artifacts/balance-matrix/summary/summary.md) and [raw/paired measurements](../artifacts/balance-matrix/summary/results.json) retain damage, DPS, received health/shield damage, pilot/mech ammunition, heat/reload time and both target-TTK clocks. There are eleven pacing-band exceptions across all arms, including the baseline; these are short/long completed runs, not deaths or omitted attempts. All recorded incoming damage reached shields; no health was lost in this scripted sample.

- **Secondary cost alone** slows pressure by 56.98s on average and consumes 68 more rounds. Heavy/control also slows and reloads more. This establishes a real price for the additional channel.
- **Heat alone** takes pressure to 155.35–169.45s, below the pacing band in every seed. The change should not be treated as independently pacing-neutral.
- **Combined pressure** averages 184.23s versus 282.98s baseline, 401 rounds versus 353.75, and 79.15s heat block versus 177.19s. Less forced cooling buys faster completion at greater ammunition expenditure. It remains within the band in three of four seeds.
- **Combined heavy/control** averages 213.82s versus 202.83s baseline, with 32.5 versus 30.75 rounds and no heat block. Its slow firing receives no per-shot heat reduction and still pays the secondary damage cost.
- **Precision** has no secondary cost and no heat lock with the tested equipment. Its mean changes by only a few seconds across arms; those small differences must not be interpreted as a direct effect of the rules.

These browser samples use perfect scripted body aim and are not deterministic executions of the entire renderer. Combat steps at 60Hz, while weapon-pose/recoil presentation still updates on the render clock and the actual muzzle transform participates in firing. Exact trace replay validates the recorded accounting; it does not establish byte-identical live execution or justify fine tuning close time differences. The deterministic dummy checks isolate the numerical rules. Full render-clock isolation is outside this weapon change. Human aiming, rear-core tactics, saved high-level gear and physical controller performance remain untested.

The frozen v2 source passes **495 tests**, TypeScript and the production build using the supported Node runtime. A final separate check of the shared v3/presentation integration passes **502 tests** and its production build. Vite retains its existing large-bundle advisory. The frozen-source archive and source-comparison receipt make the version boundary explicit; no claim is made here that v2 timing acceptance establishes timing acceptance for the later integrated game.

## Dummy acceptance

[Full dummy results](../artifacts/balance-matrix/dummy/summary.md): **176 actual-geometry samples plus one deterministic repeat; 9/9 acceptance checks pass.** The 96 main samples cover four arms × three builds × two forms × four seeds. Eighty controlled samples test single/dual channels and reactor/capacity choices. The standard observation is 30s held trigger + 5s drain; 90s reactor experiments are separately labeled. These run the actual permanent dummy and projectile/status helpers with a small timing adapter, not the complete `Game` loop.

| Pressure mech | Practical DPS over 35s | Rounds fired | Heat blocked | Longest heat lock |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 74.36 | 35 | 24.00s | 3.17s |
| Secondary only | 63.21 | 35 | 24.00s | 3.17s |
| Heat only | 127.95 | 63 | 18.08s | 2.33s |
| Combined | 108.76 | 63 | 18.08s | 2.33s |

- Secondary cost reduces matched direct/status/total damage to exactly 85% while preserving trigger timing, ammo, heat and reload. Actual scatter, rocket splash, arc chains and sticky contact/fuse regressions guard against double application.
- The pressure mech meets the 60–75 shot, 15–19s blocked-fire and ≤2.6s longest-lock acceptance bands without venting.
- Combined dual shock/corrosion retains a 13.29% pilot / 15.51% mech mean DPS advantage over matched shock-only, within the 5–20% target. The previous advantage was about 33–36% on this seed set.
- Pilot heat behavior and tested slow precision/heavy mech thermal behavior remain unchanged. The mech unlock threshold intentionally changes even for other mech loadouts that do overheat.
- Over 90s, the cooling reactor fires 189 rounds versus the capacity reactor's 178. At fixed cooling, +10% total capacity extends the first burst from 11 to 12 shots. More sustained firing still costs ammunition; capacity remains useful for bursts.
- The repeated combined pressure/seed-7 sample reproduces its raw measurements and every event. Every generated event is checked against the independent aggregate collector; trace hashes/counts, remaining supplies, pending projectiles and statuses are retained.

## Reproduce the separate and combined matrix

Run these commands in the extracted v2 source archive to reproduce this report. Running them directly in the shared project instead creates a new comparison against its retained v3 encounter. Requires the project's supported Node version (20.19+ or 22.12+); the validation recorded here used Node 25.7.0.

```sh
node --import tsx scripts/evaluateBalanceDummy.ts --out artifacts/balance-matrix/dummy-new
node --import tsx scripts/serveBalanceMatrix.ts --port 5192 --out artifacts/balance-matrix/new-raw
```

Open `/balance-lab.html?scenario=encounter&balance=baseline&build=mobile-precision&seed=7` on the local server and select **Run full 48-cell matrix**. Each cell uses a fresh page, one of the three exact evaluation fixtures, seed 7/8/41/97, the unchanged `scripted-route-v1` policy at 1/60s, normal abilities/cover/movement and complete objective/reward collection. The same-origin local export endpoint saves every finished outcome exclusively and verifies exact event replay. Failed and timed-out runs remain evidence; the queue does not tune anything. Stop/resume controls preserve completed attempts.

```sh
node --import tsx scripts/summarizeBalanceMatrix.ts artifacts/balance-matrix/new-raw/encounter-*.json --outdir artifacts/balance-matrix/new-summary
npm test
npm run build
```

The summary requires all 48 unique arm/build/seed cells, matching complete source fingerprints, identical fixture codes/equipment, the actual Game rules matching the declared arm, exact event replay, unchanged target vitality, at most three active enemies and complete objectives for successful runs. It preserves every outcome and explicitly reports violations of the proposed 180–300s pacing band. Out-of-band results do not trigger parameter changes.

The delivered `artifacts/balance-matrix/source-snapshot.tar.gz` preserves the exact measured source, scripts, tests, package/lockfile and compiler configuration. Dependencies and saves are excluded. Extract into a new directory, install dependencies from the lockfile, and run the same commands to reproduce after subsequent development. Browser and dummy fingerprints now both include the evaluation entrypoint explicitly: Vite otherwise excludes the importing file from its glob.

## Scope and validation boundaries

- Pacing fingerprints were captured before implementation. The frozen matrix retains those encounter definitions; enemy AI/navigation, rewards and world remain separately checked. The explicitly retained shared v3 encounter definition belongs to the combat lead's pacing workstream.
- Preliminary exports from repairing a queue-navigation race and complete-source fingerprinting remain under `preliminary-queue-race/` and `preliminary-source-identity/`. They are not pooled into the final matrix, and no balance values were changed during those harness repairs.
- Automated projectile/save/card tests and scripted browser inputs do not establish human performance, final visual quality or physical gamepad usability. **Physical gamepad testing: NOT RUN.** Use the checklist in [evaluation-workflow.md](evaluation-workflow.md).
- No Git initialization, commits, pushes, deployment, encounter pacing adjustment by this workstream or subsequent weapon tuning is part of this change.
