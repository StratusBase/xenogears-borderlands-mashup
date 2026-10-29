import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { CombatMeasurement, type MeasurementEvent, type MeasurementSnapshot } from '../src/diagnostics/measurement.ts';
import { createEvaluationFixture, EVALUATION_BUILDS, EVALUATION_PROTOCOL, type EvaluationBuildId } from '../src/diagnostics/fixtures.ts';
import { ENCOUNTER_POLICY_VERSION } from '../src/diagnostics/encounterDriver.ts';
import { ENCOUNTER, EncounterDirector, type EnemySpawn } from '../src/encounter/encounter.ts';
import { DEFAULT_WEAPON_BALANCE, SECONDARY_ELEMENT_DAMAGE_MULTIPLIER, MECH_HEAT_BUDGET_PER_SECOND } from '../src/core/weaponBalance.ts';
import type { EvaluationInput } from '../src/game.ts';

const ROOT = resolve(import.meta.dirname, '..');
const PROTOCOL = 'render-clock-repeatability-v1';
const SEEDS = [7, 8, 41, 97] as const;
const SCHEDULES = ['none', 'none-repeat', '30hz', '60hz', '144hz', 'jitter', 'draw-jitter'] as const;
type Schedule = typeof SCHEDULES[number];
const CONTROLS = 'scripted-route-v1: actual Game, fixed 1/60s, body aim, no teleport or stat modifications';
const usage = 'Usage: node --import tsx scripts/verifyRepeatability.ts run1.json ... run30.json [--outdir artifacts/render-clock/final]';
const canonical = (value: unknown): string => JSON.stringify(value, (_key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
  ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);
const sha = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
const check: (condition: unknown, message: string) => asserts condition = (condition, message) => { if (!condition) throw new Error(message); };

interface Launch { at: number; sequence: number; mode: 'pilot' | 'mech'; origin: Point; direction: Point; aimPoint: Point; spec: unknown }
interface Point { x: number; y: number; z: number }
interface Evidence {
  measurement: MeasurementSnapshot; events: MeasurementEvent[]; inputs: EvaluationInput[]; launches: Launch[];
  authoritativeEnd: unknown; afterFinalDrawState: unknown; encounter: { phase: string; kills: number; remainingEnemies: number; disabledRelays: string[]; enemies: unknown[]; weaponBalance: unknown; elapsed: number };
  renderClock: { protocol: string; schedule: Schedule; step: number; preparationCalls: number; gpuDrawCalls: number; reference: string | null; generatedInputs: boolean };
  sourceFingerprint: string; droppedTraceEvents: number; hardwareStatus: string;
}
interface Run { input: string; data: Evidence; build: EvaluationBuildId; seed: number; schedule: Schedule }

async function sourceFingerprint(): Promise<string> {
  async function files(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(resolve(directory, entry.name))
      : entry.isFile() && /\.(ts|css)$/.test(entry.name) ? [resolve(directory, entry.name)] : []))).flat();
  }
  const paths = (await files(resolve(ROOT, 'src'))).sort();
  const contents = await Promise.all(paths.map(async path => ({ path: relative(ROOT, path).replaceAll('\\', '/'), content: await readFile(path, 'utf8') })));
  return `sha256:${createHash('sha256').update(JSON.stringify(contents)).digest('hex')}`;
}
function expectedSpawns(seed: number): EnemySpawn[] {
  const director = new EncounterDirector(seed), result: EnemySpawn[] = [];
  check(director.start(), 'Encounter could not start');
  for (let iteration = 0; iteration < 100; iteration++) {
    const group = director.drainActions().flatMap(action => action.type === 'spawn' ? [...action.enemies] : []);
    result.push(...group); for (const enemy of group) check(director.enemyKilled(enemy.id), `Invalid current spawn ${enemy.id}`);
    if (director.snapshot.phase === 'defenses') for (const relay of ENCOUNTER.relays) director.disableRelay(relay.id, 'pilot', relay);
    if (director.snapshot.phase === 'boarding') director.update(0, { mode: 'mech', position: ENCOUNTER.battleEntry });
    if (director.snapshot.phase === 'loot') return result;
  }
  throw new Error('Current encounter did not reach loot');
}
function point(value: Point): boolean { return !!value && [value.x, value.y, value.z].every(Number.isFinite); }
function withoutMetadata({ metadata: _metadata, ...measurement }: MeasurementSnapshot) { return measurement; }

async function readRun(path: string): Promise<Run> {
  try {
    const data = JSON.parse(await readFile(path, 'utf8')) as Evidence;
    const m = data.measurement, meta = m?.metadata, clock = data.renderClock;
    check(meta?.scenario === 'encounter' && meta.protocol === EVALUATION_PROTOCOL && meta.provenance === 'simulated', 'Not the existing simulated encounter protocol');
    check(EVALUATION_BUILDS.some(build => build.id === meta.buildId), 'Unknown fixture');
    check(SEEDS.some(seed => seed === meta.seed), 'Unknown seed');
    check(clock?.protocol === PROTOCOL && SCHEDULES.includes(clock.schedule) && clock.step === 1 / 60, 'Invalid render-clock protocol/schedule');
    check(clock.schedule === 'none' || meta.seed === 7, 'Alternate schedules must use the seed-7 baseline');
    check(meta.runId === `encounter-${meta.buildId}-${meta.seed}-1`, 'Not a fresh fixture page');
    const config = meta.configuration as Record<string, unknown>;
    check(config.controls === CONTROLS && ENCOUNTER_POLICY_VERSION === 'scripted-route-v1', 'Input policy changed');
    check(config.protocol === EVALUATION_PROTOCOL && config.seed === meta.seed && config.mode === 'pilot-to-mech'
      && config.startingRun === 1 && config.timeoutSeconds === 480 && config.sourceScope === 'all src ts/css'
      && config.repeatabilityProtocol === PROTOCOL && config.renderSchedule === clock.schedule, 'Configuration differs');
    check(config.balanceVariant === 'combined' && canonical(config.balanceRules) === canonical(DEFAULT_WEAPON_BALANCE)
      && canonical(data.encounter.weaponBalance) === canonical(DEFAULT_WEAPON_BALANCE), 'Current balance defaults changed');
    const fixture = createEvaluationFixture(meta.buildId as EvaluationBuildId);
    check(canonical(meta.buildCodes) === canonical(fixture.codes) && canonical(meta.equipment) === canonical(fixture.equipment), 'Fixture equipment changed');
    check(m.outcome === 'complete' && m.duration >= 180 && m.duration <= 300, `Outcome ${m.outcome} / ${m.duration.toFixed(3)}s misses pacing acceptance`);
    check(m.rejectedEvents === 0 && data.droppedTraceEvents === 0 && data.hardwareStatus === 'NOT RUN', 'Invalid trace/hardware attestation');
    check(data.sourceFingerprint === meta.sourceFingerprint, 'Source labels differ');
    check(Array.isArray(data.events) && data.events.length > 0 && data.events.length < 100_000, 'Missing/capped measurement trace');
    const replay = new CombatMeasurement(meta);
    check(data.events.every(event => replay.record(event)), 'Invalid measurement event');
    check(canonical(replay.snapshot()) === canonical(m), 'Event trace does not reproduce the measurement');
    const expected = expectedSpawns(meta.seed);
    const spawned = data.events.filter((event): event is Extract<MeasurementEvent, { type: 'target-spawn' }> => event.type === 'target-spawn');
    check(m.kills === expected.length && m.targets.length === expected.length && spawned.length === expected.length, 'Not all current targets were defeated');
    check(spawned.every((event, index) => event.health === expected[index].health && event.shield === expected[index].shield), 'Encounter vitality changed');
    const vitality = expected.reduce((total, spawn) => total + spawn.health + spawn.shield, 0);
    check(Math.abs(m.damage.total - vitality) < 1e-6, 'Applied damage does not reconcile');
    check(data.encounter.phase === 'complete' && data.encounter.kills === expected.length && data.encounter.remainingEnemies === 0
      && data.encounter.enemies.length === 0 && ENCOUNTER.relays.every(relay => data.encounter.disabledRelays.includes(relay.id)), 'Incomplete end objectives or loot');
    check(Math.abs(data.encounter.elapsed - m.duration) < 1e-6, 'End clocks differ');
    check(canonical(data.authoritativeEnd) === canonical(data.afterFinalDrawState), 'Final GPU draw changed authoritative state');
    check(Array.isArray(data.inputs) && data.inputs.length > 0 && data.inputs.length <= 480 * 60, 'Missing/capped input trace');
    const allowed = new Set(['moveX', 'moveY', 'yaw', 'pitch', 'sprint', 'fire', 'interact', 'switchMode', 'ability', 'heal', 'reload']);
    for (const input of data.inputs) {
      check(input && typeof input === 'object' && Object.keys(input).every(key => allowed.has(key)), 'Unknown input mutation');
      for (const key of ['moveX', 'moveY', 'yaw', 'pitch'] as const) check(input[key] === undefined || Number.isFinite(input[key]), 'Non-finite input');
      for (const key of ['sprint', 'fire', 'interact', 'switchMode', 'ability', 'heal', 'reload'] as const) check(input[key] === undefined || typeof input[key] === 'boolean', 'Invalid input action');
    }
    check(Array.isArray(data.launches) && data.launches.length === m.shots.total, 'Launch count differs from shots');
    const shots = data.events.filter((event): event is Extract<MeasurementEvent, { type: 'shot' }> => event.type === 'shot');
    for (const [index, launch] of data.launches.entries()) {
      check(launch.at === shots[index].at && launch.mode === shots[index].mode && Number.isInteger(launch.sequence)
        && launch.sequence > (data.launches[index - 1]?.sequence ?? 0), 'Launch order/time differs from successful trigger');
      check(point(launch.origin) && point(launch.direction) && point(launch.aimPoint), 'Invalid launch geometry');
      check(Math.abs(Math.hypot(launch.direction.x, launch.direction.y, launch.direction.z) - 1) < 1e-9, 'Launch direction is not normalized');
    }
    if (clock.schedule === 'none' || clock.schedule === 'none-repeat') {
      check(clock.preparationCalls === 0 && clock.gpuDrawCalls === 0 && clock.generatedInputs, 'No-render arm did not regenerate unchanged policy inputs');
    } else {
      check(clock.preparationCalls > 0 && !clock.generatedInputs && !!clock.reference, 'Render arm did not replay the baseline input trace');
      check(clock.schedule === 'draw-jitter' ? clock.gpuDrawCalls > 0 : clock.gpuDrawCalls === 0, 'GPU draw schedule differs');
    }
    return { input: path, data, build: meta.buildId as EvaluationBuildId, seed: meta.seed, schedule: clock.schedule };
  } catch (error) { throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`); }
}

const args = process.argv.slice(2), paths: string[] = [];
let output = resolve(ROOT, 'artifacts/render-clock/final'), seen = false;
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--outdir') { check(!seen && !!args[index + 1] && !args[index + 1].startsWith('--'), usage); output = resolve(args[++index]); seen = true; }
  else { check(!args[index].startsWith('--'), usage); paths.push(args[index]); }
}
check(paths.length === 30, `${usage}\nExpected exactly 30 exports, received ${paths.length}. Preserve failed/repeated attempts separately.`);
check(ENCOUNTER.version === 'relay-break-v3' && ENCOUNTER.battleGroups === 6 && ENCOUNTER.vitalityScale === 1.3, 'V3 pacing was changed');
check(DEFAULT_WEAPON_BALANCE.secondaryElementCost && DEFAULT_WEAPON_BALANCE.mechHeat
  && SECONDARY_ELEMENT_DAMAGE_MULTIPLIER === 0.85 && MECH_HEAT_BUDGET_PER_SECOND === 120, 'Current weapon balance was changed');
const runs = await Promise.all(paths.map(readRun));
const identity = (run: Run) => `${run.build}/${run.seed}/${run.schedule}`;
check(new Set(runs.map(identity)).size === 30, 'Duplicate build/seed/schedule cells');
const currentFingerprint = await sourceFingerprint();
check(runs.every(run => run.data.sourceFingerprint === currentFingerprint), `Tested source differs from current source ${currentFingerprint}`);
const comparisons: { build: string; schedule: string; seconds: number; inputs: number; launches: number; events: number; inputHash: string; launchHash: string; eventHash: string; preparationCalls: number; gpuDrawCalls: number }[] = [];
for (const fixture of EVALUATION_BUILDS) {
  for (const seed of SEEDS) check(runs.some(run => run.build === fixture.id && run.seed === seed && run.schedule === 'none'), `Missing pacing baseline ${fixture.id}/${seed}`);
  const baseline = runs.find(run => run.build === fixture.id && run.seed === 7 && run.schedule === 'none')!;
  for (const schedule of SCHEDULES) {
    const run = runs.find(run => run.build === fixture.id && run.seed === 7 && run.schedule === schedule);
    check(run, `Missing render schedule ${fixture.id}/${schedule}`);
    check(canonical(run.data.inputs) === canonical(baseline.data.inputs), `${identity(run)} input trace differs`);
    check(canonical(run.data.events) === canonical(baseline.data.events), `${identity(run)} measurement events differ`);
    check(canonical(run.data.launches) === canonical(baseline.data.launches), `${identity(run)} launch origin/direction trace differs`);
    check(canonical(run.data.authoritativeEnd) === canonical(baseline.data.authoritativeEnd), `${identity(run)} authoritative final state differs`);
    check(canonical(withoutMetadata(run.data.measurement)) === canonical(withoutMetadata(baseline.data.measurement)), `${identity(run)} aggregate measurement differs`);
    comparisons.push({ build: fixture.id, schedule, seconds: run.data.measurement.duration, inputs: run.data.inputs.length,
      launches: run.data.launches.length, events: run.data.events.length, inputHash: sha(run.data.inputs), launchHash: sha(run.data.launches),
      eventHash: sha(run.data.events), preparationCalls: run.data.renderClock.preparationCalls, gpuDrawCalls: run.data.renderClock.gpuDrawCalls });
  }
}
const baselines = runs.filter(run => run.schedule === 'none');
const summaries = EVALUATION_BUILDS.map(fixture => {
  const sample = baselines.filter(run => run.build === fixture.id).map(run => run.data.measurement);
  return { build: fixture.id, minSeconds: Math.min(...sample.map(m => m.duration)), maxSeconds: Math.max(...sample.map(m => m.duration)),
    ammo: [Math.min(...sample.map(m => m.ammo.total)), Math.max(...sample.map(m => m.ammo.total))],
    heat: [Math.min(...sample.map(m => m.heatBlockedSeconds)), Math.max(...sample.map(m => m.heatBlockedSeconds))] };
});
const lines = ['# Render-clock repeatability acceptance', '',
  '**PASS: 30/30 actual-Game runs completed within 180–300 seconds; every seed-7 input, launch, event and authoritative end-state trace matches across render schedules.**', '',
  `Source: \`${currentFingerprint}\`. Encounter: ${ENCOUNTER.version}; balance: current combined defaults; controls: ${ENCOUNTER_POLICY_VERSION}.`, '',
  'Twelve baseline runs cover the three unchanged builds and seeds 7, 8, 41 and 97. Fresh generated-policy repeats and recorded-input replays cover no render, 30/60/144 Hz preparation, jitter and jitter with actual GPU draws. GPU drawing is skipped only in the named preparation-only arms. No initial draw occurs; the no-render baseline exercises construction and simulation without any GPU draw. A final UI draw occurs after evidence capture and is verified to leave authoritative state unchanged.', '',
  'Only generated loot UUIDs are normalized in the authoritative end-state comparison. Inputs, launch transforms, measurement events and aggregate values are compared exactly without rounding. Every trace also independently replays through CombatMeasurement. All failures from earlier source candidates remain separate evidence.', '',
  '| Build | Four-seed completion range | Ammo | Heat blocked |', '| --- | ---: | ---: | ---: |',
];
for (const summary of summaries) lines.push(`| ${summary.build} | ${summary.minSeconds.toFixed(2)}–${summary.maxSeconds.toFixed(2)} s | ${summary.ammo.join('–')} | ${summary.heat.map(value => value.toFixed(2)).join('–')} s |`);
lines.push('', '| Build | Schedule | Seconds | Inputs | Launches | Events | Render preparations | GPU draws |', '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const sample of comparisons) lines.push(`| ${sample.build} | ${sample.schedule} | ${sample.seconds.toFixed(2)} | ${sample.inputs} | ${sample.launches} | ${sample.events} | ${sample.preparationCalls} | ${sample.gpuDrawCalls} |`);
lines.push('', 'Full SHA-256 trace digests and every raw input/event/launch record are retained in results.json and the original exports. This is simulated browser input in the actual Game; human pacing, physical controller ergonomics and deterministic GPU pixels are not asserted.', '');
await mkdir(output, { recursive: true });
const existing = await readdir(output); check(!existing.includes('summary.md') && !existing.includes('results.json'), `Reports already exist in ${output}; choose another --outdir.`);
await writeFile(resolve(output, 'results.json'), `${JSON.stringify({ accepted: true, protocol: PROTOCOL, sourceFingerprint: currentFingerprint,
  hardwareStatus: 'NOT RUN', summaries, comparisons, runs: runs.map(run => ({ input: relative(ROOT, resolve(run.input)), ...run.data })) }, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(output, 'summary.md'), lines.join('\n'), { flag: 'wx' });
process.stdout.write(`PASS: 30 complete live runs; 12 pacing cells and all render schedules match exact inputs, launches, events and authoritative state. Wrote ${output}/summary.md\n`);
