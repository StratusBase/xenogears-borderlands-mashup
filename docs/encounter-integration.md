# Encounter integration contract

`src/encounter/contracts.ts` is the shared animation/event contract. Integration owns
`src/game.ts`, `src/world.ts`, and `src/ui.ts`; other workstreams own their modules.

Game options add `encounterSeed?: number`, `onEncounterEvent?: EncounterEventListener`,
and `onMeasurement?: (event: CombatMeasurementEvent) => void`. Simulation and loot use
the seeded RNG for explicit seeded runs; presentation randomness remains independent.

Public harness methods on Game:

- `startEncounter(seed?: number): void` starts/replays the staged encounter, retaining equipment.
- `startDummyEvaluation(mode?: Mode): void` clears live combat and places that form at the fixed dummy.
- `getEncounterSnapshot()` exposes phase, elapsed, run, objective, mode, position, enemies,
  current health/shield/ammo/reserve/heat, and equipped progression clone.
- `resetEvaluation(): void` aborts the current run without deleting saves or equipment.

The optional measurement hook uses simulation seconds and reports applied direct/status/ability
damage, target spawn/death, received damage, shots, heat/reload intervals and finish outcomes.
It has no collector dependency. Browser timing/input remains caller-owned.

Explicit development harnesses may set `evaluationDriver: true`, then use
`driveEvaluation({moveX,moveY,yaw,pitch,sprint,fire,interact,switchMode,ability,heal,reload})`.
Movement uses local stick coordinates (`moveY:-1` forward); boolean actions other than
fire/sprint happen once per call. `stepEvaluation(dt)` switches off automatic simulation
and advances up to 0.25 seconds in 60Hz substeps, using the same gameplay methods.
These APIs throw unless the harness explicitly enables the driver. `snapshot.time`
and measurement `at` use simulation seconds; subtract the start snapshot's time for
run-relative reports. Shot `ammo` means rounds consumed (1), not rounds remaining.

Encounter state is session-local. Existing version-1 progression, checkpoint, vending and
inventory serialization are retained. N / controller D-pad up starts or replays; active runs
reject restart to prevent duplicate rewards. Pause/workbench remain accessible.
