# Relay Break pacing validation

The follow-up targets **180–300 active simulation seconds for the three existing tested builds**. The prior 64–96 second results are retained under `artifacts/evaluation/`; they do not satisfy the pacing goal.

## Encounter changes

- Six mixed-role mech squads replace two. Every squad contains one rusher, one ranged flanker and one shielded heavy; only three enemies are active at once.
- Four clear spawn layouts vary approach lanes. Death of the last enemy immediately starts the next squad.
- Pilot sentry durability uses 1.45 times the prior budget and the mini-boss group uses 1.6 times its prior budget. Mech squads use a larger authored budget with role-specific hull/shield allocation.
- Mech squad flankers have more health; regular heavies trade hull for substantially more shields. This retains shock's shield-breaking value, precision's rear-core positioning, and the explosive build's control/area-damage efficiency.
- Reserve ammunition is replenished before each mech squad and the mini-boss. Health, shields, magazine and heat carry through the mech squads.
- The encounter has 24 enemies, two defense interactions, boarding, mini-boss combat and final upgrade collection. Replay retains the same budget.

There are **no added delays, minimum encounter times, locked doors waiting on a clock, invulnerable phases, or movement slowdowns**. Enemy windups/recovery and existing weapon heat/reload remain tactical mechanics. A regression completes the entire objective sequence at elapsed time zero when every enemy/objective is resolved immediately.

## Preserved contracts

The three level-five rare equipment fixtures and `scripted-route-v1` policy are unchanged.
Pacing edits do not normalize player equipment, proc chances, Q abilities, movement or
healing. Save serialization, inventory, vendors, checkpoints and input bindings are
retained. A separate authorized balance workstream added a secondary-element damage
cost and revised mech heat rules during validation; the final matrix includes those
combined defaults rather than claiming that the earlier combat rules are still current.

The additive `pacing-lab.html` imports the original evaluation lab unchanged. Its workspace-export button observes the public measurement/events and saves them through a local same-origin endpoint. The browser's download transport proved unreliable; the local endpoint verifies exact event replay before saving and never overwrites a prior attempt. This transport does not change simulation or input.

## Evidence and acceptance

Each candidate has a frozen source archive and separate attempts under `artifacts/pacing-v2/`. Candidate 1's first precision run completed in 170.1 seconds and therefore failed the lower limit; its timing informed the shield/flanker adjustment. That preliminary run's browser download stalled, so only its observed UI result is available; it is excluded from the final verified matrix. Candidate 2 then measured precision at 190.78–199.05 seconds and explosive control at 219.73 seconds, but elemental pressure exceeded the limit at 303.70 seconds. All four Candidate 2 traces are retained separately. Candidate 3 reallocates regular-heavy hull into shielding to favor shock without changing player stats or controls.

All 12 Candidate 3 runs passed for the pre-balance snapshot (precision 189.32–203.12s,
pressure 268.03–291.40s, heavy 185.40–242.13s). A concurrent authorized weapon-balance
workstream then changed secondary-element damage and mech heat defaults. On those
new defaults, Candidate 4 pressure/seed97 completed in 172.10s, failing the lower bound.
That counterexample and the earlier passing snapshot are preserved separately.

Current encounter version relay-break-v3 retains the same groups and tactics and raises
the authored vitality scale from 1.18 to 1.30 (about 10.17%) for a fresh current-default
validation. The other workstream's frozen 48-cell comparison is untouched.

Final acceptance uses fresh pages for all three fixtures across seeds **7, 8, 41 and 97**, with the same 60 Hz inputs, no teleports/stat edits, normal combat/navigation/abilities, both relay interactions, boarding and loot collection. Every attempt retains its explicit outcome. `scripts/verifyPacing.ts` requires all twelve distinct cells, completion within 180–300 seconds, exact event replay, unchanged fixture equipment/codes and policy, and the current source fingerprint. The checker also verifies the actual snapshot uses the combined balance defaults when balance variants are present. Unit damage models are not pacing acceptance evidence.


## Final current-default result

**PASS: all 12 actual-Game scripted runs completed within 180–300 seconds.**
This is the current combined-balance source, not the earlier pre-balance snapshot.

| Build | Seeds | Duration range | Ammo range | Heat blocked |
| --- | --- | ---: | ---: | ---: |
| Mobile precision | 7, 8, 41, 97 | 194.58–211.37 s | 87–94 | 0 s |
| Sustained elemental pressure | 7, 8, 41, 97 | 210.78–213.25 s | 445–463 | 82.28–96.38 s |
| Heavy explosive/control | 7, 8, 41, 97 | 233.77–284.20 s | 36–44 | 0 s |

Every run defeated all 24 enemies, disabled both relays, boarded the frame and collected
the guaranteed upgrade. Applied damage reconciled to the full 37,951 health/shield budget.
Every event replayed exactly with zero rejected or dropped events. All equipment codes,
raw equipment stats and the scripted control policy match the existing three fixtures.
The game-owned snapshots confirm the current combined balance defaults.

The strict acceptance checker verified the complete current source fingerprint:
`sha256:565e977212eff0af96f3516a20327da7f1a32fa0e86274d560db1347f53e7ddb`.
A separate file-by-file comparison confirmed all 99 source files match the frozen measured
source, including the evaluation entrypoint. The earlier pre-balance fingerprint omitted
Vite's glob importer; the current lab explicitly includes it, and the final checker matches
that full scope. No source drift is being accepted as equivalent.

- [Strict acceptance summary](../artifacts/pacing-v2/final/summary.md)
- [Complete acceptance records](../artifacts/pacing-v2/final/results.json)
- [Exact measured source archive](../artifacts/pacing-v2/candidate5-current-balance/source-snapshot.tar.gz)
- [Source byte comparison](../artifacts/pacing-v2/candidate5-current-balance/source-byte-comparison.json)
- [Final browser screenshot](../artifacts/pacing-v2/candidate5-current-balance/final-live-validation.jpg)

`npm test` passed **495 tests** and `npm run build` passed. Explicit TypeScript checks for
the validation/export scripts passed too. Vite retains its bundle-size advisory.

The tactics remain materially different: precision spends relatively little ammo without
heat lock; elemental pressure spends more ammo and manages substantial heat/status damage;
explosive control spends few rounds but more reload time and uses large shockwaves. This
is not a forced equalization of damage, equipment, or completion times.

No Git initialization, commits, pushes or deployment were performed. The older comparison
and all failed tuning candidates remain separate, immutable evidence rather than being
replaced with passing attempts. Temporary servers created for this validation were stopped.

## Reproduction

```sh
node --import tsx scripts/servePacingValidation.ts --port 5189 --out artifacts/pacing-v2/new-attempts
```

Open `/pacing-lab.html?scenario=encounter&build=mobile-precision&seed=7`, choose **Run scripted encounter**, then **Save evidence to workspace**. Repeat from fresh pages for each build/seed. Freeze source while collecting a comparison; the archive preserves the exact measured version.

```sh
node --import tsx scripts/verifyPacing.ts artifacts/pacing-v2/new-attempts/encounter-*.json --outdir artifacts/pacing-v2/verified
npm test
npm run build
```

Physical controller testing and human pacing are not asserted by the scripted matrix. Saved equipment outside the tested fixtures, player skill and choosing to collect optional loot can change duration; the game does not force a timer on those runs.
