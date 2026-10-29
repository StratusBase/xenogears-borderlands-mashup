# Frozen v3 versus retained v2 — separate and combined balance matrix

**All 48 v3 encounters completed. Combined pacing passes 12/12 within 180–300 seconds, versus 11/12 on v2. No balance or pacing changes were made for this comparison, and no further tuning was performed.**

## Scope and source boundary

The v3 game was frozen at the start of this request: `sha256:ff84dbf9e5f37e5b0b46e39de710180f202dceb1dab5acd4a657793c7ba2d409`. The retained v2 source is `sha256:a99e96bbd77e6e2279b718af4a850821b2f617030fb86cf497baf1db5c634292`. Each version has four arms, three unchanged workbench builds and seeds 7, 8, 41 and 97. Every attempt starts on a fresh page and uses the same fixed-step scripted input policy, 480-second timeout and measurement protocol. Both relays, boarding, six squads, boss and reward completion are required. Inputs are simulated in the actual game; physical gamepad and human play remain **NOT RUN**.

V3 contains 24 targets and 37,951 total health plus shields, versus 34,450 in v2 (+3,501; +10.16%). Numerical weapon rules, fixtures, build codes, equipment, collector and scripted policy match. V3 also includes Game/UI/world and presentation integration differences, so measured version differences do not isolate the effect of vitality alone. See the [version source comparison](../artifacts/balance-matrix-v3/version-source-comparison.json).

**Later shared integration is outside this timing comparison.** During the run, separate work moved recoil/muzzle pose and related presentation onto simulation steps and added manual clock ownership. Those changes can alter shot origins, collisions and timings. They were not substituted midway through the matrix. The approved balance constants, helper calls and encounter definition remain unchanged. The [final integrity receipt](../artifacts/balance-matrix-v3/final-integrity.json) lists this boundary and verifies the frozen snapshot and all 79 retained v2 artifact files.

## Completion and pacing

Mean completion seconds, **v2 → frozen v3**, four seeds per cell:

| Arm | Precision | Elemental pressure | Heavy / control |
| --- | ---: | ---: | ---: |
| baseline | 200.12 → 202.95 | 282.98 → 316.53 | 202.83 → 223.32 |
| secondary-only | 200.11 → 198.70 | 339.96 → 381.51 | 254.20 → 261.55 |
| heat-only | 197.27 → 195.08 | 162.05 → 175.92 | 205.99 → 223.21 |
| combined | 197.83 → 203.41 | 184.23 → 212.12 | 213.82 → 261.17 |

| Arm | V2 within 180–300s | Frozen v3 within 180–300s |
| --- | ---: | ---: |
| baseline | 11/12 | 9/12 |
| secondary-only | 7/12 | 8/12 |
| heat-only | 8/12 | 8/12 |
| combined | 11/12 | 12/12 |

- Combined pressure/seed 97: **172.10s → 212.30s**, resolving the retained v2 under-target observation in this sample.
- Combined heavy has the narrowest upper margin: **292.70s** maximum, only **7.30s** below five minutes. Its four-seed range is 205.43–292.70s.
- Secondary cost alone: all four v3 pressure runs exceed five minutes, **349.55–404.45s**.
- Heat alone: all four v3 pressure runs finish below three minutes, **172.42–178.53s**.
- All 48 v3 runs completed without death or timeout; all 24 targets were killed in each. Eleven pacing exceptions across the separate arms remain in the dataset. Combined has none.

## Combined-build resource tradeoffs

Values are four-seed means, **v2 → frozen v3**. Each completed run applies all encounter vitality: **34,450 → 37,951** damage. Received health damage remains zero in every run; shield damage below is cumulative and includes regeneration between hits.

| Build | Completion change | Total ammo | Heat block s | Received shield damage | First-hit target TTK s |
| --- | ---: | ---: | ---: | ---: | ---: |
| Precision | +5.58s | 86.50 → 90.75 | 0.00 → 0.00 | 367.25 → 425.00 | 8.17 → 8.41 |
| Elemental pressure | +27.90s | 401.00 → 455.00 | 79.15 → 89.72 | 420.00 → 509.25 | 10.10 → 10.80 |
| Heavy / control | +47.35s | 32.50 → 40.00 | 0.00 → 0.00 | 505.00 → 673.25 | 7.00 → 8.71 |

TTK uses 96/96 killed targets per version/build, rather than treating survivors as zero-time kills. The [full paired comparison](../artifacts/balance-matrix-v3/comparison/comparison.md) includes practical DPS, pilot/mech ammunition separately, received health/shield damage, reload intervals, per-seed differences and every pacing exception. Its JSON retains individual target timings and all outcomes without duplicating event traces.

Within frozen v3, combined pressure versus its baseline uses **59.75 more rounds**, but spends **111.92 fewer seconds heat-blocked**, completes **104.41 seconds sooner**, and receives **227 fewer shield damage** on average. Combined heavy versus baseline uses **7 more rounds**, spends **9.10 more seconds reloading**, completes **37.85 seconds later**, and receives **67.25 more shield damage**. These are observed tradeoffs under this policy, not new balance recommendations. Small precision differences between arms must not be attributed to rules that do not affect that build.

## Verification and repeatability

- Frozen v3: **502/502 tests**, TypeScript and production build pass. The existing large-bundle advisory remains.
- New comparison tool: **6/6 tests** and TypeScript pass. A real retained-v2 self-comparison yields 48 matched pairs with zero deltas. The later shared workspace separately passes **515/515 tests** and production build; that does not establish its encounter pacing.
- Dummy: **176 samples plus exact repeat**, **9/9 acceptance checks pass**. Every matched v2/v3 numerical result, target timing, stat snapshot and event-trace signature is identical. Runner source hash also matches. Only source/provenance metadata differs.
- Encounter: all **48/48 traces replay exactly**, with zero invalid/dropped events; actual Game snapshot rule flags match each arm, fixtures remain equipped, and damage reconciles to the source-owned target budget.
- Exact event replay proves accounting. The frozen game still has render-clock recoil/muzzle variability, so this is not a claim of byte-identical encounter execution or statistical certainty from four seeds.
- Physical gamepad testing remains **NOT RUN**. Use the [physical checklist](evaluation-workflow.md#physical-gamepad-checklist--not-run) and keep those records separate.

## Evidence and commands

- [Frozen v3 summary](../artifacts/balance-matrix-v3/summary/summary.md) and raw records in `artifacts/balance-matrix-v3/raw/`.
- [Paired comparison](../artifacts/balance-matrix-v3/comparison/comparison.md), with source/input/script fingerprints in its JSON.
- [Dummy and validation summary](../artifacts/balance-matrix-v3/validation/summary.md), [dummy identity evidence](../artifacts/balance-matrix-v3/validation/dummy-v2-v3-comparison.json).
- [Source receipt](../artifacts/balance-matrix-v3/source-receipt.json), [source archive](../artifacts/balance-matrix-v3/source-snapshot.tar.gz), and [repeat instructions](../artifacts/balance-matrix-v3/README.md).
- [Comparison tool](../scripts/compareBalanceMatrices.ts) and [tests](../tests/balanceMatrixComparison.test.ts); exact copies and hashes are retained under `artifacts/balance-matrix-v3/comparison-tool/`.

No Git initialization, commit, push, deployment, balance edit or encounter pacing edit was performed. Further tuning is outside this run.
