> Historical v1 report. The current pacing fix and live acceptance are documented in [pacing-v2-validation.md](pacing-v2-validation.md). The evidence below is retained as the pre-fix baseline.

# Breach / Break / Salvage encounter

The encounter is transient, independent of narrative and of the version-one save schema. Its director owns stage progression and enemy spawn identities. The game continues to own equipment, inventory, input, checkpoints, vending, damage, and loot collection.

## Sequence and replay

1. Pilot clears three Service Vault sentries.
2. Pilot interacts with both defense relays, within 3.5 m, using the existing interact input.
3. Pilot returns to the frame at the west gate, boards, and crosses the east gate.
4. Mech clears two groups of three enemies, with a mix of all three roles.
5. Mech clears the heavy mini-boss and its two escorts.
6. Player collects one guaranteed rare inventory upgrade; collection unlocks replay.

The first reward improves mech cooling and heat capacity, the second improves pilot mobility, and the third improves mech shields. This cycle repeats. Main reward stats improve over the currently equipped module by 18%, subject to the existing save-validation limits. It adds an ordinary item without replacing or automatically equipping prior items. At a stat's existing hard cap, further improvement to that stat is naturally unavailable.

N / D-pad Up starts or replays. Interact remains E / Y; boarding remains F / LB. There are no mandatory waiting timers. Replays retain bounded group sizes and health; seed/run parity varies a flanking approach. A death or abandon resets transient encounter state; earned inventory items remain ordinary saved items.

## Automated validation

Run `node --import tsx --test tests/encounter.test.ts tests/encounterBuilds.test.ts`.

- Stage gates reject unknown/duplicate/stale kill IDs, distant or mech relay interactions, incomplete boss groups, empty reward collection, and replay before loot collection.
- Rewards equip with the existing inventory functions and round-trip through the unchanged version-one save reader/writer.
- Every scripted enemy position fits its full collision footprint in the actual `createWorld` geometry, for both flank variants; relay approaches and frame/entry positions are checked too.
- Three substantially different level-one builds use the existing arsenal: starter kinetic rifle/slug, mobile electric arc/control equipment, and armored fire rocket equipment. Custom weapon rolls are common quality (`rollItem` draw 0.3); supporting custom modules are uncommon (`rollItem` draw 0.5). The resulting stats are unmodified arsenal rolls.

### Deterministic damage-model results

Seed 7381; this is a tuning model, **not recorded browser play or a survival test**.

| Build | Modeled total | Combat | Shots | Reloads | Heat-blocked time | Status damage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Starter kinetic | 278 s | 235 s | 204 | 13 | 0 s | 0 |
| Mobile electric control | 261 s | 219 s | 244 | 15 | 15 s | 670 |
| Armored fire rockets | 229 s | 186 s | 125 | 8 | 0 s | 1,379 |

All three clear all 12 enemies and reach the loot stage within the modeled three-to-five-minute target. Re-running the same build and seed reproduces the result. All use finite magazines/reserves and the real reload, status, shield, heat, and enemy phase functions. Total encounter vitality is 8,703, including shields; 7,918 belongs to mech stages. A single bounded durability tier increases the initial health budget by 18%; replays do not compound it.

Model assumptions are explicit in `tests/encounterBuilds.test.ts`: 68% hit probability, seven seconds firing followed by five seconds in cover, a 30% chance of aiming at the heavy core during a recovery window, modeled traversal/interaction time, and reserve ammunition replenishment before each of the three mech groups. Refills preserve magazine and heat. It excludes geometric aiming, incoming projectile collision and survival, ability use, splash/chain damage, and actual pickup paths. It approximates the integration's armor/weak-point rules and does not prove they are identical.

### Remaining limits

- Three-to-five minutes is a baseline tuning target, not an enforced timer or a guarantee across equipment. Stronger-quality and higher-level existing gear can finish faster; the selected common-weapon builds provide a controlled comparison.
- The game replenishes reserve ammunition before each mech group. Magazine, heat, and health carry forward. Starting reserve alone cannot support realistic misses plus shielded frontal fire across the entire encounter.
- Human pacing, controller ergonomics, and visual readability under human input remain unverified. The live scripted checks below validate the game loop, without establishing those outcomes.
- Reload/heat timing is real; cover and aim behavior are assumptions. The model is useful for regression and comparing builds, not an empirical difficulty or performance benchmark.

## Published integration contracts

`src/encounter/contracts.ts` contains the small animation/event contract. `EncounterDirector.drainActions()` supplies bounded spawns, phase changes, reward creation, and observational events. Only IDs from a current spawn can count as encounter deaths. Animation uses `EnemyPresentation`; orchestration does not import Three.js.

## Actual game-loop checks

The parallel arsenal evaluation workstream ran three level-five rare builds through the actual
Game loop, with identical scripted body-aim controls, across seeds 7, 8, 41, and 97. All twelve
runs completed all 12 enemies, both relays, boarding, the mini-boss and guaranteed loot
collection. Every applied-damage trace replayed exactly, with no rejected events. Integration
independently revalidated all twelve exports. The tested frozen source matches the current src
files byte for byte.

| Build | Actual scripted duration range | Completed runs |
| --- | ---: | ---: |
| Mobile precision | 63.97–71.12 s | 4 / 4 |
| Sustained elemental pressure | 76.50–88.45 s | 4 / 4 |
| Heavy explosive / control | 66.02–95.57 s | 4 / 4 |

These stronger builds and perfect scripted aiming finish substantially faster than the
3–5 minute common-gear model. **The target is baseline tuning, not a validated human
completion time or a cap on stronger equipment.** No waiting timers or automatic equipment
normalization were introduced. Pacing across human skill and saved high-level equipment
remains a design limitation.

Detailed measurements, received damage, ammunition, heat, reloads, target defeat times,
source fingerprints and source archive are in
[the actual encounter summary](../artifacts/evaluation/encounters/summary.md),
[the raw evidence](../artifacts/evaluation/encounters/results.json), and
[the source snapshot](../artifacts/evaluation/source-snapshot.tar.gz).

Final checks: `npm test` passed 332 tests; `npm run build` passed TypeScript and Vite.
Vite retains its bundle-size advisory (about 860 kB before gzip). Keyboard and gamepad
mapping tests pass; physical controller testing was not performed. Static cover navigation
uses full actor footprints and swept routes, but has no enemy-to-enemy crowd avoidance.
