# Current v3 versus retained v2 — balance matrix

**All 48 current-v3 encounters completed. Combined pacing passes 12/12 within 180–300 seconds, versus 11/12 on retained v2. Balance and encounter pacing remained unchanged; no further tuning was performed.**

## Tested source and method

Primary v3 source: `sha256:182cca6874e40549b2ff5cd174d663874cd9142e9619eeab64e6ffa23111db13`. Retained v2: `sha256:a99e96bbd77e6e2279b718af4a850821b2f617030fb86cf497baf1db5c634292`. Four arms × three unchanged workbench builds × seeds 7, 8, 41 and 97. Each attempt uses a fresh page, the same scripted input policy, fixed 1/60s steps and 480-second timeout. Both relays, boarding, six squads, boss and reward completion are required. Inputs are simulated in the actual game; physical gamepad and human play remain **NOT RUN**.

An initial 48-cell v3 matrix finished while separate shared work moved recoil/muzzle pose onto simulation steps. Because that can affect shots and timings, the full matrix was repeated against the newer integration. This report uses that second run as primary evidence. The [initial v3 report](balance-v3-comparison.md), its 48 raw records and its source archive remain preserved. Thus 96 new v3 encounters were run across two explicitly separated snapshots.

The primary snapshot includes the simulation-clock integration. Shared Game, core, encounter and matrix entrypoints still match it. Only two unrelated diagnostic pages changed afterward; the [final integrity receipt](../artifacts/balance-matrix-v3-current/final-integrity.json) lists them. All 79 retained v2 artifact files and the initial v3 evidence checked remain unchanged.

V3 has 24 targets and **37,951** total health plus shields, versus **34,450** in v2 (+10.16%). Weapon-rule modules, fixture equipment/build codes, measurement collector and scripted policy match. The versions also differ in Game/UI/world, presentation and simulation-clock integration, so timing changes cannot be attributed solely to the vitality increase. See the [source comparison](../artifacts/balance-matrix-v3-current/version-source-comparison.json).

## Completion and pacing

Mean completion seconds, **v2 → current v3**, four seeds per cell:

| Arm | Precision | Elemental pressure | Heavy / control |
| --- | ---: | ---: | ---: |
| baseline | 200.12 → 205.81 | 282.98 → 316.53 | 202.83 → 232.60 |
| secondary-only | 200.11 → 205.81 | 339.96 → 378.49 | 254.20 → 259.91 |
| heat-only | 197.27 → 205.81 | 162.05 → 175.92 | 205.99 → 232.60 |
| combined | 197.83 → 205.81 | 184.23 → 212.12 | 213.82 → 259.91 |

| Arm | V2 within 180–300s | Current v3 within 180–300s |
| --- | ---: | ---: |
| baseline | 11/12 | 9/12 |
| secondary-only | 7/12 | 8/12 |
| heat-only | 8/12 | 8/12 |
| combined | 11/12 | 12/12 |

- Combined pressure/seed 97: **172.10 → 212.30s**. The retained v2 under-target observation is resolved in this sample.
- Combined heavy range: **234.75–274.00s**. The longest combined run is **274.00s**, leaving **26.00s** below five minutes.
- Secondary cost alone: all four v3 pressure runs exceed five minutes, **349.55–394.12s**.
- Heat alone: all four v3 pressure runs finish below three minutes, **172.42–178.53s**.
- All 48 primary v3 runs completed without death or timeout, with all 24 targets killed in each. Eleven separate-arm pacing exceptions remain visible; combined has none.

## Combined-build resource tradeoffs

Four-seed means, **v2 → current v3**. Each completed run applies all target vitality: **34,450 → 37,951** damage. Received health damage remains zero in every run. Received shield damage is cumulative and includes regeneration between hits.

| Build | Completion change | Total ammo | Heat block s | Received shield damage | First-hit target TTK s |
| --- | ---: | ---: | ---: | ---: | ---: |
| Precision | +7.98s | 86.50 → 91.75 | 0.00 → 0.00 | 367.25 → 446.50 | 8.17 → 7.91 |
| Elemental pressure | +27.90s | 401.00 → 455.00 | 79.15 → 89.72 | 420.00 → 509.25 | 10.10 → 10.80 |
| Heavy / control | +46.09s | 32.50 → 39.50 | 0.00 → 0.00 | 505.00 → 656.75 | 7.00 → 8.86 |

TTK uses 96/96 killed targets per version/build. The [full paired comparison](../artifacts/balance-matrix-v3-current/comparison/comparison.md) also reports practical DPS, pilot/mech ammunition separately, received health/shield damage, reload intervals and all per-seed differences. Individual outcomes and target timings, including null survivor TTK if present, are retained in JSON.

Within current v3, combined pressure versus its baseline consumes **59.75 more rounds**, spends **111.92 fewer seconds heat-blocked**, completes **104.41 seconds sooner**, and receives **227.00 fewer shield damage** on average. Combined heavy versus its baseline consumes **5.25 more rounds**, reloads for **4.63 more seconds**, completes **27.32 seconds later**, and receives **81.50 more shield damage**. These are measured tradeoffs under this policy, with no new tuning proposed.

## Verification and repeatability

- Frozen current v3: **515/515 tests**, TypeScript and production build pass. The existing bundle-size advisory remains.
- Comparison tool: six targeted tests and TypeScript pass; a real retained-v2 self-comparison yields 48 matched pairs and zero deltas. The tool and tests are included in the primary source archive and preserved separately with hashes.
- Dummy: **176 samples plus exact repeat; 9/9 acceptance checks pass**. Every matched v2/v3 numerical metric, target timing, stat snapshot and event-trace signature is identical. Runner source hash also matches; provenance metadata correctly differs.
- Encounter: **48/48 traces replay exactly**, with zero invalid/dropped events, actual Game rule flags correct per arm, unchanged equipped fixtures and damage reconciled to source-owned target vitality.
- Current-v3 controls: **20/20 full event-array comparisons match exactly**. Precision matches baseline versus each other arm for all four seeds (12 pairs); heavy matches baseline versus heat-only and secondary-only versus combined (8 pairs). These fixtures do not engage the differing rule in those controls. See [control identities](../artifacts/balance-matrix-v3-current/arm-identity-checks.json).
- The retained v2 data predates the simulation-clock fix and includes render-clock recoil/muzzle variation. Exact replay proves accounting; these controls do not establish arbitrary cross-platform or human-play determinism. Four seeds are not a statistical guarantee for all encounters.
- Physical gamepad testing remains **NOT RUN**. Use the [hardware checklist](evaluation-workflow.md#physical-gamepad-checklist--not-run) and keep those records separate.

## Evidence and repeat commands

- [Current v3 summary](../artifacts/balance-matrix-v3-current/summary/summary.md) and raw records under `artifacts/balance-matrix-v3-current/raw/`.
- [Primary v2/current-v3 comparison](../artifacts/balance-matrix-v3-current/comparison/comparison.md).
- [Initial-v3/current-v3 comparison](../artifacts/balance-matrix-v3-current/initial-v3-comparison/comparison.md), preserving the effect of the intervening integration as a separate dataset.
- [Validation](../artifacts/balance-matrix-v3-current/validation/summary.md) and [exact dummy identity evidence](../artifacts/balance-matrix-v3-current/validation/dummy-v2-v3-comparison.json).
- [Source receipt](../artifacts/balance-matrix-v3-current/source-receipt.json), [source archive](../artifacts/balance-matrix-v3-current/source-snapshot.tar.gz), [repeat instructions](../artifacts/balance-matrix-v3-current/README.md).
- [Comparison tool](../scripts/compareBalanceMatrices.ts) and [tests](../tests/balanceMatrixComparison.test.ts).

No Git initialization, commit, push, deployment, balance edit or encounter pacing edit was performed. Results are reported before any further tuning.
