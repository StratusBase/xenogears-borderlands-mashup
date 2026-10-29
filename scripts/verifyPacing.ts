import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { ENCOUNTER, EncounterDirector, type EnemySpawn } from '../src/encounter/encounter.ts';
import { ENCOUNTER_POLICY_VERSION } from '../src/diagnostics/encounterDriver.ts';
import { createEvaluationFixture, EVALUATION_BUILDS, EVALUATION_PROTOCOL, type EvaluationBuildId } from '../src/diagnostics/fixtures.ts';
import { CombatMeasurement, type MeasurementEvent, type MeasurementSnapshot } from '../src/diagnostics/measurement.ts';
import type { Progression } from '../src/core/index.ts';

/** Acceptance checks consume exported actual-Game runs. They never generate
 * completion times, edit builds, or substitute a damage model for live evidence. */
const root = resolve(import.meta.dirname, '..');
const seeds = [7, 8, 41, 97] as const;
const controls = 'scripted-route-v1: actual Game, fixed 1/60s, body aim, no teleport or stat modifications';
const expectedRuns = EVALUATION_BUILDS.length * seeds.length;
const usage = 'Usage: node --import tsx scripts/verifyPacing.ts run1.json ... run12.json [--outdir artifacts/pacing-v2/final]';

interface RunExport {
  measurement: MeasurementSnapshot;
  events: MeasurementEvent[];
  droppedTraceEvents: number;
  hardwareStatus: string;
  encounter: {
    phase: string; run: number; elapsed: number; kills: number; remainingEnemies: number;
    enemies: unknown[]; disabledRelays: string[]; progression: Progression;
    weaponBalance?: { secondaryElementCost: boolean; mechHeat: boolean };
  };
  scriptedReason?: string;
}
interface VerifiedRun { input: string; data: RunExport; expectedTargets: number; expectedVitality: number }

function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
    ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);
}

async function sourceFingerprint(): Promise<string> {
  async function sourceFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const lists = await Promise.all(entries.map(entry => entry.isDirectory() ? sourceFiles(resolve(directory, entry.name))
      : entry.isFile() && /\.(ts|css)$/.test(entry.name) ? [resolve(directory, entry.name)] : []));
    return lists.flat();
  }
  // The current lab explicitly adds its own raw source back after Vite's glob
  // excludes the importer. Match that complete, sorted src TS/CSS fingerprint.
  // Historical pre-balance archives retain their older importer-excluding checker.
  const files = (await sourceFiles(resolve(root, 'src'))).sort((a, b) => {
    const left = relative(root, a).replaceAll('\\', '/'), right = relative(root, b).replaceAll('\\', '/');
    return left < right ? -1 : left > right ? 1 : 0;
  });
  const contents = await Promise.all(files.map(async path => ({ path: relative(root, path).replaceAll('\\', '/'), content: await readFile(path, 'utf8') })));
  return `sha256:${createHash('sha256').update(JSON.stringify(contents)).digest('hex')}`;
}

function currentSpawns(seed: number): EnemySpawn[] {
  const director = new EncounterDirector(seed), spawns: EnemySpawn[] = [];
  requireThat(director.start(), 'Current encounter cannot start');
  for (let iteration = 0; iteration < 100; iteration++) {
    const next = director.drainActions().flatMap(action => action.type === 'spawn' ? [...action.enemies] : []);
    spawns.push(...next);
    for (const enemy of next) requireThat(director.enemyKilled(enemy.id), `Current encounter rejected ${enemy.id}`);
    const phase = director.snapshot.phase;
    if (phase === 'defenses') for (const relay of ENCOUNTER.relays) {
      requireThat(director.disableRelay(relay.id, 'pilot', relay), `Current encounter cannot disable ${relay.id}`);
    }
    if (director.snapshot.phase === 'boarding') director.update(1 / 60, { mode: 'mech', position: ENCOUNTER.battleEntry });
    if (director.snapshot.phase === 'loot') {
      requireThat(director.collectReward('acceptance-check-reward'), 'Current encounter cannot collect its reward');
      return spawns;
    }
  }
  throw new Error('Current encounter did not reach loot through bounded kill-driven stages');
}

async function verify(path: string): Promise<VerifiedRun> {
  try {
    const data = JSON.parse(await readFile(path, 'utf8')) as RunExport;
    const m = data.measurement, metadata = m?.metadata;
    requireThat(metadata?.scenario === 'encounter', 'not an encounter export');
    requireThat(EVALUATION_BUILDS.some(build => build.id === metadata.buildId), 'unknown or changed build fixture');
    requireThat(seeds.some(seed => seed === metadata.seed), 'seed must be one of 7, 8, 41, 97');
    requireThat(metadata.provenance === 'simulated' && data.hardwareStatus === 'NOT RUN', 'input/hardware provenance changed');
    requireThat(metadata.protocol === EVALUATION_PROTOCOL, 'measurement protocol changed');
    const config = metadata.configuration as Record<string, unknown> | null;
    requireThat(config && config.controls === controls && ENCOUNTER_POLICY_VERSION === 'scripted-route-v1', 'scripted input policy changed');
    requireThat(config.seed === metadata.seed && config.protocol === EVALUATION_PROTOCOL && config.mode === 'pilot-to-mech'
      && config.startingRun === 1 && config.timeoutSeconds === 480 && config.sourceScope === 'all src ts/css'
      && config.hardwareStatus === 'NOT RUN', 'run configuration differs from the fresh-page protocol');
    if ('balanceRules' in config || 'balanceVariant' in config) {
      const expectedRules = { secondaryElementCost: true, mechHeat: true };
      requireThat(config.balanceVariant === 'combined' && canonical(config.balanceRules) === canonical(expectedRules)
        && canonical(data.encounter.weaponBalance) === canonical(expectedRules), 'run does not use the current combined balance defaults');
    }
    requireThat(metadata.runId === `encounter-${metadata.buildId}-${metadata.seed}-1`, 'run did not start on a fresh fixture page');
    const fixture = createEvaluationFixture(metadata.buildId as EvaluationBuildId);
    requireThat(canonical(metadata.buildCodes) === canonical(fixture.codes), 'weapon codes differ from the tested fixture');
    requireThat(canonical(metadata.equipment) === canonical(fixture.equipment), 'equipment differs from the tested fixture');
    requireThat(m.outcome === 'complete', `outcome is ${String(m.outcome)}, not complete`);
    requireThat(m.duration >= ENCOUNTER.recommendedSeconds[0] && m.duration <= ENCOUNTER.recommendedSeconds[1],
      `completion ${m.duration.toFixed(3)}s is outside ${ENCOUNTER.recommendedSeconds.join('–')}s`);
    requireThat(m.rejectedEvents === 0 && data.droppedTraceEvents === 0, 'rejected or dropped measurement events');
    requireThat(Array.isArray(data.events) && data.events.length > 0, 'missing event trace');
    const recorder = new CombatMeasurement(metadata);
    for (const [index, event] of data.events.entries()) requireThat(recorder.record(event), `invalid event ${index} (${event?.type})`);
    requireThat(canonical(recorder.snapshot()) === canonical(m), 'event replay does not exactly match the exported measurement');

    const expected = currentSpawns(metadata.seed);
    const actual = data.events.filter((event): event is Extract<MeasurementEvent, { type: 'target-spawn' }> => event.type === 'target-spawn');
    requireThat(m.kills === expected.length && m.targets.length === expected.length && actual.length === expected.length,
      `must defeat all ${expected.length} current encounter targets`);
    requireThat(m.targets.every(target => target.killedAt !== null && target.spawnedAt !== null && target.firstDamageAt !== null), 'surviving or unrecorded targets');
    requireThat(actual.every((spawn, index) => spawn.health === expected[index].health && spawn.shield === expected[index].shield), 'spawn vitality differs from the current encounter definition');
    const vitality = expected.reduce((total, enemy) => total + enemy.health + enemy.shield, 0);
    requireThat(Math.abs(m.damage.total - vitality) < 1e-6, 'applied damage does not reconcile to total encounter vitality');
    const end = data.encounter;
    requireThat(end?.phase === 'complete' && end.run === 1 && end.kills === expected.length && end.remainingEnemies === 0
      && Array.isArray(end.enemies) && end.enemies.length === 0, 'end snapshot does not confirm complete combat and reward collection');
    requireThat(Math.abs(end.elapsed - m.duration) < 1e-6, 'end snapshot and measurement clocks differ');
    requireThat(Array.isArray(end.disabledRelays) && ENCOUNTER.relays.every(relay => end.disabledRelays.includes(relay.id)), 'not all defense relays were disabled');
    for (const mode of ['pilot', 'mech'] as const) {
      const equipped = Object.values(end.progression?.loadouts?.[mode] ?? {}).map(id => end.progression.inventory.find(item => item.id === id));
      requireThat(canonical(equipped) === canonical(fixture.equipment[mode]), `${mode} loadout changed during the run`);
    }
    return { input: relative(root, resolve(path)).replaceAll('\\', '/'), data, expectedTargets: expected.length, expectedVitality: vitality };
  } catch (error) {
    throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const args = process.argv.slice(2), paths: string[] = [];
let output = resolve(root, 'artifacts/pacing-v2/final'), hasOutput = false;
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--outdir') {
    requireThat(!hasOutput && !!args[index + 1] && !args[index + 1].startsWith('--'), usage);
    output = resolve(args[++index]); hasOutput = true;
  } else { requireThat(!args[index].startsWith('--'), usage); paths.push(args[index]); }
}
requireThat(paths.length === expectedRuns, `${usage}\nExpected exactly ${expectedRuns} exports; received ${paths.length}. Keep failed attempts and repeats in separate directories.`);
const runs = await Promise.all(paths.map(verify));
const keys = runs.map(({ data: { measurement: m } }) => `${m.metadata.buildId}/${m.metadata.seed}`);
requireThat(new Set(keys).size === expectedRuns, 'Duplicate build/seed cells; each of the 12 cells must occur exactly once.');
for (const build of EVALUATION_BUILDS) for (const seed of seeds) requireThat(keys.includes(`${build.id}/${seed}`), `Missing ${build.id}/${seed}`);
const fingerprints = new Set(runs.map(run => run.data.measurement.metadata.sourceFingerprint));
requireThat(fingerprints.size === 1, 'Mixed tested source versions cannot establish one acceptance baseline.');
const liveFingerprint = await sourceFingerprint();
requireThat(fingerprints.has(liveFingerprint), `Tested source does not match shipped src TS/CSS. Current: ${liveFingerprint}; tested: ${[...fingerprints].join(', ')}.`);
runs.sort((a, b) => a.data.measurement.metadata.buildId.localeCompare(b.data.measurement.metadata.buildId)
  || a.data.measurement.metadata.seed - b.data.measurement.metadata.seed);

const percent = (amount: number, total: number) => `${(amount / total * 100).toFixed(1)}%`;
const summaries = EVALUATION_BUILDS.map(build => {
  const samples = runs.filter(run => run.data.measurement.metadata.buildId === build.id).map(run => run.data.measurement);
  const mean = (pick: (sample: MeasurementSnapshot) => number) => samples.reduce((total, sample) => total + pick(sample), 0) / samples.length;
  return { build: build.id, runs: samples.length, minSeconds: Math.min(...samples.map(sample => sample.duration)),
    maxSeconds: Math.max(...samples.map(sample => sample.duration)), meanSeconds: mean(sample => sample.duration),
    meanAmmo: mean(sample => sample.ammo.total), meanHeatBlockedSeconds: mean(sample => sample.heatBlockedSeconds),
    meanReloadSeconds: mean(sample => sample.reloadSeconds), meanStatusShare: mean(sample => sample.damage.status / sample.damage.total),
    meanAbilityShare: mean(sample => sample.damage.ability / sample.damage.total) };
});
const lines = ['# Live pacing acceptance', '',
  `**PASS: ${runs.length}/${expectedRuns} actual-Game scripted runs complete in 180–300 seconds.**`, '',
  `Encounter: ${ENCOUNTER.version}; ${ENCOUNTER.battleGroups} kill-driven battle groups. Source: \`${liveFingerprint}\`.`, '',
  'All traces replay exactly. Each run retains the original fixture equipment/codes and scripted control policy; every current target, both relays and reward collection are complete. No rejected or dropped events. The current combined balance defaults are confirmed in each game snapshot. This verifies simulated browser controls, not human pacing or physical-controller ergonomics. The complete src TS/CSS fingerprint includes the evaluation entrypoint; a separate frozen-source byte comparison covers every shipped source file.', '',
  '| Build | Seed | Seconds | Targets | Pilot / mech ammo | Heat s | Reload s | Status share | Ability share | Received health / shield |',
  '| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |',
];
for (const run of runs) {
  const m = run.data.measurement;
  lines.push(`| ${m.metadata.buildId} | ${m.metadata.seed} | ${m.duration.toFixed(2)} | ${m.kills}/${run.expectedTargets} | ${m.ammo.pilot}/${m.ammo.mech} | ${m.heatBlockedSeconds.toFixed(2)} | ${m.reloadSeconds.toFixed(2)} | ${percent(m.damage.status, m.damage.total)} | ${percent(m.damage.ability, m.damage.total)} | ${m.received.health.toFixed(2)}/${m.received.shield.toFixed(2)} |`);
}
lines.push('', '## Build differences retained', '', '| Build | Duration range | Mean ammo | Mean heat s | Mean reload s | Mean status share | Mean ability share |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: |');
for (const summary of summaries) lines.push(`| ${summary.build} | ${summary.minSeconds.toFixed(2)}–${summary.maxSeconds.toFixed(2)} s | ${summary.meanAmmo.toFixed(1)} | ${summary.meanHeatBlockedSeconds.toFixed(2)} | ${summary.meanReloadSeconds.toFixed(2)} | ${(summary.meanStatusShare * 100).toFixed(1)}% | ${(summary.meanAbilityShare * 100).toFixed(1)}% |`);
lines.push('', 'These measurements expose the builds’ ammunition, heat, reload, status and ability tradeoffs; they do not claim that a single scripted body-aim policy captures every tactical advantage. Failed tuning candidates and repeatability attempts remain separate from this exact matrix.', '');

await mkdir(output, { recursive: true });
// Refuse to overwrite reports or run exports from a previous acceptance attempt.
const existing = new Set(await readdir(output));
requireThat(!existing.has('summary.md') && !existing.has('results.json'), `Acceptance reports already exist in ${output}; choose a new --outdir to preserve prior evidence.`);
await writeFile(resolve(output, 'results.json'), `${JSON.stringify({ accepted: true, encounterVersion: ENCOUNTER.version,
  sourceFingerprint: liveFingerprint, hardwareStatus: 'NOT RUN', requiredSeeds: seeds, controls, summaries, runs }, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(output, 'summary.md'), lines.join('\n'), { flag: 'wx' });
process.stdout.write(`PASS: ${runs.length} complete unchanged-build live runs in 180–300s; exact traces and current source verified. Wrote ${output}/summary.md\n`);
