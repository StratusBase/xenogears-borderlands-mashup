# Arsenal tuning findings

Historical pre-change evidence. The approved secondary-element cost and mech heat implementation are evaluated separately in [balance-implementation-results.md](balance-implementation-results.md); the original measurements below remain unchanged.

**Measurement tools do not change balance.** Recommendations below are proposals for the combat lead. Evidence is in [the generated dummy table](../artifacts/evaluation/summary.md) and [individual records](../artifacts/evaluation/results.json). Follow [the evaluation workflow](evaluation-workflow.md) to rerun them.

## Actual encounter results — simulated inputs

**12/12 completed**, with 12 targets defeated and 8703 actual health-plus-shield damage removed in every run. Four matched seeds (7, 8, 41, 97), one pristine page per attempt, one frozen source version, same `scripted-route-v1` policy. Seed 8 exercises the mirrored battle layout; the other three vary proc/loot RNG on the other layout. These run the complete `Game` loop with real enemy AI, projectile collision, movement, relays, boarding, abilities, and reward collection. They use perfect body aiming and ordinary scripted movement rather than human/controller inputs.

| Build | Completion | Mean time [range] | Received health / shield | Ammo | Heat blocked | Reload | Mean first-hit TTK |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| Mobile precision | 4/4 | 69.33s [63.97–71.12] | 0 / 88.50 | 30.25 | 0s | 7.77s | 3.77s |
| Elemental pressure | 4/4 | 80.88s [76.50–88.45] | 0 / 242.50 | 106.25 | 43.73s | 3.60s | 6.05s |
| Heavy explosive/control | 4/4 | 85.61s [66.02–95.57] | 0 / 202.00 | 13.75 | 0s | 16.06s | 3.62s |

Means include every scheduled matched attempt. All 48 targets per build were killed; per-target spawn and first-hit TTKs are retained. See [each encounter row](../artifacts/evaluation/encounters/summary.md) and [full event evidence](../artifacts/evaluation/encounters/results.json). Every event trace replays exactly to its exported measurement, with zero rejected events. A separate repeat of pressure/seed 7 produced **identical measurements and all 5742 events**; [verification](../artifacts/evaluation/repeatability/verification.json) and the repeat trace are retained outside the matched matrix.

The precision build has the fastest mean time, lower time variation and less shield damage under this body-aim policy; heavy wins the seed-41 time comparison. Heavy spends far fewer rounds but varies considerably across seeds and spends longer reloading. Pressure benefits from chain/status utility but still loses substantial time to heat. This establishes distinct costs, not a universally optimal build. The policy does not exploit heavy rear weak points, swap weapons, or represent human aiming effort. Automatic encounter stage ammunition servicing and the mech's normal venting ability remain enabled for all builds; rounds consumed are measured independently of those refills. No run lost health, so these trials do not price healing or death recovery.

The exact measured sources are preserved in [source-snapshot.tar.gz](../artifacts/evaluation/source-snapshot.tar.gz), avoiding drift from parallel gameplay/art work. Browser source fingerprint: `sha256:e0ede8cef7599719fb9f07a2d7eb2f86d64eab049c8113e69aaab64ac89cf12b`. CLI fingerprints additionally cover its experiment script, dependency lockfile and compiler configuration, so the two scopes intentionally have different hashes.

## Controlled dummy baseline

Actual permanent-dummy collision, seeded proc rolls, stationary body aim at 19m, 30s held trigger plus 5s released trigger; means across seeds 7, 41, 97. This is a diagnostic simulation using the real projectile/status modules and a small adapter for weapon timing. It is not a human combat or physical gamepad test. The three complete builds intentionally vary weapon and equipment choices; use the controlled experiments for attribution.

| Build | Form | Applied damage | Practical DPS over 35s | Ammo | Heat blocked during 30s | Reload |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Mobile precision | Pilot | 3909.50 | 111.70 | 35 | 0s | 4.47s |
| Elemental pressure | Pilot | 3957.99 | 113.09 | 164 | 15.07s | 4.30s |
| Heavy explosive/control | Pilot | 3532.31 | 100.92 | 11 | 0s | 5.83s |
| Mobile precision | Mech | 5955.18 | 170.15 | 14 | 0s | 4.20s |
| Elemental pressure | Mech | 2632.64 | 75.22 | 35 | 24.00s | 1.80s |
| Heavy explosive/control | Mech | 4189.50 | 119.70 | 5 | 0s | 7.28s |

The immortal dummy has no target defeat time. Received damage is zero by construction. These samples say nothing about live completion or the value of grouping, cover, freeze, slow, chain damage, or splash across enemies. Heat and reload can overlap; do not add their durations into an exclusive downtime figure. Heavy mech damage varies from 95.76 to 143.64 DPS across just three proc seeds; the mean is provisional.

## Prioritized proposals

**First: review encounter pacing and pressure before broad weapon nerfs.** All twelve full runs finish in **64–96 seconds**, below the stated **180–300 second** target, while shield regeneration absorbs all received damage. Repeat this matrix with human/controller aiming and a deliberate heavy weak-point policy; then tune traversal/objective pressure, enemy attack opportunities or encounter composition if short clears persist. Keep the three builds viable, require positioning decisions and meet the intended duration without relying on an arbitrary health multiplier. Perfect scripted aim makes this a pacing signal, not a human completion-time estimate. The following arsenal recommendations come after that encounter check.

1. **Give secondary elements an explicit budget or cost.** The pressure pilot's single shock channel averages **84.81 DPS**; adding corrosion raises it to **113.09 DPS (+33.3%)**, with the same 164 ammo, 15.07s heat block and 4.30s reload. Mech rises from **54.73 to 75.22 DPS (+37.4%)**, with the same 35 rounds. The workbench adds a channel without reducing direct stats or increasing ammo/heat. Corrosion also increases incoming damage, so the gain includes direct damage amplification. Proposal: investigate a shared proc/power budget, or an explicit handling/resource cost for dual channels. Acceptance: repeat paired seeds on shielded, unshielded, clustered and spread live targets; preserve a reason to choose a single channel. Do not select final numbers from three dummy samples.

2. **Review heat-per-shot scaling for high-rate mech weapons before buffing raw damage.** The pressure mech advertises 6.95 shots/s but fires only **35 rounds in 30s**, with **24s heat block (80%)**. Precision fires 14 rounds at 170.15 DPS without heat block; pressure achieves 75.22 DPS against this isolated target. The actual encounter still averages **43.73s blocked fire over 80.88s total** despite normal mech venting. Proposal: test a fire-rate-aware heat budget or gentler lock/recovery curve, while retaining a cooling-equipment advantage. Acceptance: check total encounter time, received damage, clustered chain utility and ammunition cost; a single-target DPS gap is not proof that arc damage is underpowered.

3. **Make range and area utility legible before raising projectile damage.** The same pressure pilot averages **113.09 DPS at 12m and 0 at 30m**, spending 164 rounds either way. Mech likewise spends 35 rounds at 30m for no damage. Arc is capped at 24m; this is an existing tradeoff, not a measurement failure. Proposal: emphasize effective range in weapon/aim feedback and test whether players can recognize it. Keep precision, splash, ricochet and control roles; compare covered/clustered encounters before changing their multipliers. The single dummy intentionally excludes those advantages.

4. **Preserve meaningful reactor and mobility decisions; tune only if live outcomes flatten them.** Holding the pressure build and slot rolls fixed, a cooling-focused Cindergrid reactor averages **121.99 pilot / 83.53 mech DPS**, versus **114.44 / 75.30** for the capacity-focused Nullward reactor. Pilot ammo rises from 166 to 177, mech from 35 to 39. More capacity does not automatically improve a 30s sustained test. Legs-only armor/mobility comparisons retain identical weapons, shields and reactors in the evidence. Proposal: test short burst windows and exposed traversal separately before modifying equipment stats. Stationary damage cannot price survival or movement.

5. **Retain manufacturer identity; avoid a universal dummy-DPS equalization.** On a matched pilot precision weapon and fixed support gear, Kestrel averages **111.70 DPS / 35 rounds** versus Ironvale **100.43 / 24 rounds**. Damage per round is about **111.70 versus 146.46**: output and ammunition efficiency already oppose each other. The matched mech ranking differs. Proposal: use practical completion, ammo availability and weak-point access as the acceptance criteria for any brand changes; this baseline does not justify flattening them.

## Validation boundaries

- Automated diagnostic and browser-scripted controls are simulated input. They do not certify physical controller feel or human performance.
- Exact weapon codes, full support gear, controls, seeds, per-target TTK/censoring and source fingerprints accompany measurements. A changed source fingerprint requires a new baseline.
- The browser lab enforces a fresh page for every measurement. Playing before beginning invalidates that page's pristine RNG/spread state; reload it.
- Physical controller status: **NOT RUN**. Use the explicit checklist in [evaluation-workflow.md](evaluation-workflow.md).
