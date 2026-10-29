import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ENCOUNTER, EncounterDirector, type EnemySpawn } from '../src/encounter/encounter.ts';
import { createEvaluationFixture, EVALUATION_BUILDS, EVALUATION_PROTOCOL, type EvaluationBuildId } from '../src/diagnostics/fixtures.ts';
import { ENCOUNTER_POLICY_VERSION } from '../src/diagnostics/encounterDriver.ts';
import type { MeasurementSnapshot, MeasurementEvent } from '../src/diagnostics/measurement.ts';
import type { Progression } from '../src/core/index.ts';
import { BALANCE_VARIANTS, validateBalanceEvidence, type BalanceEvidence, type BalanceVariant } from './serveBalanceMatrix.ts';

const root = resolve(import.meta.dirname, '..');
const seeds = [7, 8, 41, 97];
const variants = Object.keys(BALANCE_VARIANTS) as BalanceVariant[];
const controls = 'scripted-route-v1: actual Game, fixed 1/60s, body aim, no teleport or stat modifications';
const usage = 'Usage: node --import tsx scripts/summarizeBalanceMatrix.ts run1.json ... run48.json [--outdir artifacts/balance-matrix/summary]';
const requireThat: (condition: unknown, message: string) => asserts condition = (condition, message) => { if (!condition) throw new Error(message); };
const canonical = (value: unknown): string => JSON.stringify(value, (_key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
  ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);

/** The game-owned snapshot attests which rules actually ran; labels alone do not. */
export function assertSnapshotBalanceRules(snapshot: unknown, variant: BalanceVariant): void {
  const value = snapshot && typeof snapshot === 'object' ? snapshot as { weaponBalance?: unknown } : null;
  requireThat(value && canonical(value.weaponBalance) === canonical(BALANCE_VARIANTS[variant]),
    `Encounter snapshot balance rules differ from ${variant}.`);
}

async function sourceFingerprint(): Promise<string> {
  async function files(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(resolve(directory, entry.name))
      : entry.isFile() && /\.(ts|css)$/.test(entry.name) ? [resolve(directory, entry.name)] : []))).flat();
  }
  const paths = (await files(resolve(root, 'src'))).sort();
  const contents = await Promise.all(paths.map(async path => ({ path: relative(root, path).replaceAll('\\', '/'), content: await readFile(path, 'utf8') })));
  return `sha256:${createHash('sha256').update(JSON.stringify(contents)).digest('hex')}`;
}
function currentSpawns(seed: number): EnemySpawn[] {
  const director = new EncounterDirector(seed), result: EnemySpawn[] = [];
  requireThat(director.start(), 'Could not start current encounter');
  for (let i = 0; i < 100; i++) {
    const batch = director.drainActions().flatMap(action => action.type === 'spawn' ? [...action.enemies] : []);
    result.push(...batch);
    for (const enemy of batch) director.enemyKilled(enemy.id);
    if (director.snapshot.phase === 'defenses') for (const relay of ENCOUNTER.relays) director.disableRelay(relay.id, 'pilot', relay);
    if (director.snapshot.phase === 'boarding') director.update(0, { mode: 'mech', position: ENCOUNTER.battleEntry });
    if (director.snapshot.phase === 'loot') return result;
  }
  throw new Error('Current encounter did not reach loot');
}

interface EndSnapshot { phase: string; run: number; kills: number; remainingEnemies: number; enemies: unknown[]; disabledRelays: string[]; progression: Progression }
interface Run { input: string; variant: BalanceVariant; data: BalanceEvidence; expectedTargets: number; expectedVitality: number }
async function main() {
const args = process.argv.slice(2), paths: string[] = [];
let output = resolve(root, 'artifacts/balance-matrix/summary'), seenOutput = false;
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--outdir') {
    requireThat(!seenOutput && args[index + 1] && !args[index + 1].startsWith('--'), usage);
    output = resolve(args[++index]); seenOutput = true;
  } else { requireThat(!args[index].startsWith('--'), usage); paths.push(args[index]); }
}
requireThat(paths.length === 48, `${usage}\nExpected exactly 48 distinct cells, received ${paths.length}. Preserve retries separately.`);
const testedSource = await sourceFingerprint();
const spawns = new Map(seeds.map(seed => [seed, currentSpawns(seed)]));
const runs: Run[] = await Promise.all(paths.map(async path => {
  try {
    const data = JSON.parse(await readFile(path, 'utf8')) as BalanceEvidence;
    const { variant } = validateBalanceEvidence(data);
    // Required for complete, failed, timeout and aborted outcomes alike.
    assertSnapshotBalanceRules(data.encounter, variant);
    const m = data.measurement, meta = m.metadata, config = meta.configuration as Record<string, unknown>;
    requireThat(meta.sourceFingerprint === testedSource, `source differs from current/frozen source: ${testedSource}`);
    requireThat(meta.protocol === EVALUATION_PROTOCOL && config.controls === controls && ENCOUNTER_POLICY_VERSION === 'scripted-route-v1', 'protocol/control policy changed');
    requireThat(config.seed === meta.seed && config.mode === 'pilot-to-mech' && config.startingRun === 1 && config.timeoutSeconds === 480
      && config.sourceScope === 'all src ts/css', 'not a pristine fixed-step encounter configuration');
    const fixture = createEvaluationFixture(meta.buildId as EvaluationBuildId);
    requireThat(canonical(meta.buildCodes) === canonical(fixture.codes) && canonical(meta.equipment) === canonical(fixture.equipment), 'fixture weapon/equipment changed');
    const expected = spawns.get(meta.seed)!;
    const spawnEvents = data.events.filter((event): event is Extract<MeasurementEvent, { type: 'target-spawn' }> => event.type === 'target-spawn');
    requireThat(spawnEvents.length <= expected.length && spawnEvents.every((event, index) => event.health === expected[index].health && event.shield === expected[index].shield), 'encounter pacing/spawn vitality changed');
    let active = 0;
    for (const event of data.events) {
      if (event.type === 'target-spawn') active++;
      if (event.type === 'target-killed') active--;
      requireThat(active >= 0 && active <= 3, 'active squad population changed');
    }
    const vitality = expected.reduce((sum, spawn) => sum + spawn.health + spawn.shield, 0);
    if (m.outcome === 'complete') {
      requireThat(spawnEvents.length === expected.length && m.kills === expected.length && m.targets.every(target => target.killedAt !== null), 'completion lacks all current targets');
      requireThat(Math.abs(m.damage.total - vitality) < 1e-6, 'actual damage does not reconcile to encounter vitality');
      const end = data.encounter as EndSnapshot;
      requireThat(end?.phase === 'complete' && end.run === 1 && end.kills === expected.length && end.remainingEnemies === 0 && end.enemies.length === 0, 'completion/reward end state missing');
      requireThat(ENCOUNTER.relays.every(relay => end.disabledRelays.includes(relay.id)), 'relay objectives missing');
      for (const mode of ['pilot', 'mech'] as const) {
        const items = Object.values(end.progression.loadouts[mode]).map(id => end.progression.inventory.find(item => item.id === id));
        requireThat(canonical(items) === canonical(fixture.equipment[mode]), `${mode} equipment changed during combat`);
      }
    }
    return { input: relative(root, resolve(path)), variant, data, expectedTargets: expected.length, expectedVitality: vitality };
  } catch (error) { throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`); }
}));
const keys = runs.map(run => `${run.variant}/${run.data.measurement.metadata.buildId}/${run.data.measurement.metadata.seed}`);
requireThat(new Set(keys).size === 48, 'Duplicate matrix cells; preserve repeatability attempts outside this matrix.');
for (const variant of variants) for (const build of EVALUATION_BUILDS) for (const seed of seeds) requireThat(keys.includes(`${variant}/${build.id}/${seed}`), `Missing ${variant}/${build.id}/${seed}`);
runs.sort((a, b) => variants.indexOf(a.variant) - variants.indexOf(b.variant)
  || a.data.measurement.metadata.buildId.localeCompare(b.data.measurement.metadata.buildId)
  || a.data.measurement.metadata.seed - b.data.measurement.metadata.seed);

const summaries = variants.flatMap(variant => EVALUATION_BUILDS.map(build => {
  const samples = runs.filter(run => run.variant === variant && run.data.measurement.metadata.buildId === build.id).map(run => run.data.measurement);
  const mean = (pick: (m: MeasurementSnapshot) => number) => samples.reduce((sum, m) => sum + pick(m), 0) / samples.length;
  const completed = samples.filter(m => m.outcome === 'complete');
  const killed = samples.flatMap(m => m.targets.filter(target => target.killedAt !== null && target.ttkFromFirstDamage !== null));
  return { variant, build: build.id, completed: samples.filter(m => m.outcome === 'complete').length, attempts: samples.length,
    minSeconds: Math.min(...samples.map(m => m.duration)), maxSeconds: Math.max(...samples.map(m => m.duration)),
    meanSeconds: mean(m => m.duration), meanDps: mean(m => m.practicalDps), meanDamage: mean(m => m.damage.total),
    meanCompletedSeconds: completed.length ? completed.reduce((sum, m) => sum + m.duration, 0) / completed.length : null,
    outcomes: Object.fromEntries(['complete', 'failed', 'timeout', 'aborted'].map(outcome => [outcome, samples.filter(m => m.outcome === outcome).length])),
    meanReceivedHealth: mean(m => m.received.health), meanReceivedShield: mean(m => m.received.shield),
    meanAmmo: mean(m => m.ammo.total), meanPilotAmmo: mean(m => m.ammo.pilot), meanMechAmmo: mean(m => m.ammo.mech),
    meanHeatSeconds: mean(m => m.heatBlockedSeconds), meanReloadSeconds: mean(m => m.reloadSeconds),
    killedTargets: killed.length, observedTargets: samples.reduce((sum, m) => sum + m.targets.length, 0),
    meanFirstHitTtk: killed.length ? killed.reduce((sum, target) => sum + target.ttkFromFirstDamage!, 0) / killed.length : null };
}));
const paired = runs.filter(run => run.variant !== 'baseline').map(run => {
  const m = run.data.measurement;
  const baseline = runs.find(candidate => candidate.variant === 'baseline' && candidate.data.measurement.metadata.buildId === m.metadata.buildId && candidate.data.measurement.metadata.seed === m.metadata.seed)!.data.measurement;
  return { variant: run.variant, build: m.metadata.buildId, seed: m.metadata.seed, outcome: m.outcome, baselineOutcome: baseline.outcome,
    completedPair: m.outcome === 'complete' && baseline.outcome === 'complete',
    secondsDelta: m.duration - baseline.duration, secondsPercent: (m.duration / baseline.duration - 1) * 100,
    ammoDelta: m.ammo.total - baseline.ammo.total, heatSecondsDelta: m.heatBlockedSeconds - baseline.heatBlockedSeconds,
    reloadSecondsDelta: m.reloadSeconds - baseline.reloadSeconds, receivedDelta: m.received.total - baseline.received.total,
    dpsDelta: m.practicalDps - baseline.practicalDps };
});
const violations = runs.filter(run => run.data.measurement.outcome !== 'complete' || run.data.measurement.duration < 180 || run.data.measurement.duration > 300)
  .map(run => ({ variant: run.variant, build: run.data.measurement.metadata.buildId, seed: run.data.measurement.metadata.seed,
    outcome: run.data.measurement.outcome, seconds: run.data.measurement.duration }));
const combinedViolations = violations.filter(run => run.variant === 'combined');
const f = (value: number) => value.toFixed(2);
const lines = ['# Separate and combined balance matrix', '',
  `**48/48 cells validated. Combined pacing acceptance: ${combinedViolations.length ? 'FAIL' : 'PASS'} (${12 - combinedViolations.length}/12 complete within 180–300s).**`, '',
  `Source: \`${testedSource}\`. Encounter ${ENCOUNTER.version}: ${ENCOUNTER.battleGroups} squads, ${spawns.get(7)!.length} targets, ${runs[0].expectedVitality} health + shield. No encounter definitions were changed by the test arms.`, '',
  'Every event trace matches its measurement exactly. The actual Game snapshot balance rules also match each arm, including failed outcomes. Builds, equipped items, proc RNG seeds, navigation/input policy and source are identical between arms. Inputs are simulated in the actual Game; physical gamepad and human play remain NOT RUN. Failed and out-of-band attempts remain included.', '',
  'All-attempt means include every scheduled outcome through its observed stop time. A failed/timeout/aborted duration is not a completion time; completed-only duration means are shown separately. DPS, resources and received damage likewise include every attempt, and outcomes are retained individually in results.json. TTK means include killed targets only, with the denominator shown.', '',
  '| Variant | Build | Complete | All-attempt duration [min–max] | Completed-only mean | DPS | Received health / shield | Ammo pilot / mech | Heat s | Reload s | First-hit TTK |',
  '| --- | --- | --- | --- | --- | ---: | --- | --- | ---: | ---: | --- |',
];
for (const s of summaries) lines.push(`| ${s.variant} | ${s.build} | ${s.completed}/${s.attempts} | ${f(s.meanSeconds)}s [${f(s.minSeconds)}–${f(s.maxSeconds)}] | ${s.meanCompletedSeconds === null ? '—' : `${f(s.meanCompletedSeconds)}s`} | ${f(s.meanDps)} | ${f(s.meanReceivedHealth)}/${f(s.meanReceivedShield)} | ${f(s.meanPilotAmmo)}/${f(s.meanMechAmmo)} | ${f(s.meanHeatSeconds)} | ${f(s.meanReloadSeconds)} | ${s.meanFirstHitTtk === null ? '—' : `${f(s.meanFirstHitTtk)}s`} (${s.killedTargets}/${s.observedTargets} killed) |`);
lines.push('', '## Paired differences from baseline', '', 'These differences include all matched outcomes. When either attempt failed, the observed-duration difference must not be read as a clear-time improvement. The completed-pair count makes that distinction explicit.', '', '| Variant | Build | Completed pairs | All-pair duration change | Ammo change | Heat change | Reload change | Received change |', '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |');
for (const variant of variants.filter(v => v !== 'baseline')) for (const build of EVALUATION_BUILDS) {
  const cells = paired.filter(cell => cell.variant === variant && cell.build === build.id);
  const mean = (pick: (cell: typeof paired[number]) => number) => cells.reduce((sum, cell) => sum + pick(cell), 0) / cells.length;
  lines.push(`| ${variant} | ${build.id} | ${cells.filter(cell => cell.completedPair).length}/${cells.length} | ${f(mean(cell => cell.secondsDelta))}s (${f(mean(cell => cell.secondsPercent))}%) | ${f(mean(cell => cell.ammoDelta))} | ${f(mean(cell => cell.heatSecondsDelta))}s | ${f(mean(cell => cell.reloadSecondsDelta))}s | ${f(mean(cell => cell.receivedDelta))} |`);
}
lines.push('', '## Pacing acceptance exceptions', '', ...(violations.length ? violations.map(v => `- ${v.variant} / ${v.build} / seed ${v.seed}: ${v.outcome}, ${f(v.seconds)}s.`) : ['None.']), '',
  'Acceptance exceptions are reported, not used to tune parameters or alter encounter pacing. Means include every scheduled attempt; surviving targets retain null TTK. Full individual rows, outcomes, applied damage, target timings and event traces are in results.json.', '');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'results.json'), `${JSON.stringify({ sourceFingerprint: testedSource, encounterVersion: ENCOUNTER.version,
  hardwareStatus: 'NOT RUN', variants: BALANCE_VARIANTS, requiredSeeds: seeds, combinedAccepted: combinedViolations.length === 0,
  violations, summaries, paired, runs }, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(output, 'summary.md'), lines.join('\n'), { flag: 'wx' });
process.stdout.write(`Validated 48 cells and exact traces. Combined acceptance ${combinedViolations.length ? 'FAIL' : 'PASS'}; ${violations.length} total pacing exceptions. Reports: ${output}\n`);
if (combinedViolations.length) process.exitCode = 2;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
