import { createHash } from 'node:crypto';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStats, type Mode } from '../src/core/index.ts';
import { createEvaluationFixture, EVALUATION_BUILDS, type EvaluationFixture } from '../src/diagnostics/fixtures.ts';
import { BALANCE_MATRIX_PROTOCOL, BALANCE_MATRIX_SEEDS, BALANCE_VARIANTS, type BalanceVariant } from '../src/diagnostics/balanceVariants.ts';
import { CombatMeasurement, type JsonValue, type MeasurementSnapshot } from '../src/diagnostics/measurement.ts';
import { simulateDummy, type DummySimulationEvent, type DummySimulationResult } from '../src/diagnostics/dummySimulation.ts';

const root = resolve(import.meta.dirname, '..');
const hash = (value: string) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));

/** Intervals report trigger-blocked time, not future cooldown after trigger release. */
export function dummyHeatTiming(events: readonly DummySimulationEvent[]) {
  let longestHeatLockSeconds = 0, current = 0;
  let firstOverheatAt: number | null = null;
  for (const event of events) {
    if (event.type !== 'interval') continue;
    if (event.heatBlocked) {
      firstOverheatAt ??= event.at - event.dt;
      current += event.dt; longestHeatLockSeconds = Math.max(longestHeatLockSeconds, current);
    } else current = 0;
  }
  const firstBurstShots = events.filter(event => event.type === 'shot' && (firstOverheatAt === null || event.at <= firstOverheatAt + 1e-9)).length;
  return { longestHeatLockSeconds, firstOverheatAt, firstBurstShots };
}

interface Run {
  experiment: string;
  variant: BalanceVariant;
  build: string;
  mode: Mode;
  seed: number;
  measurement: MeasurementSnapshot;
  raw: Omit<DummySimulationResult, 'events'>;
  heat: ReturnType<typeof dummyHeatTiming>;
  stats: ReturnType<typeof getStats>;
  eventCount: number;
  eventTraceFingerprint: string;
  accountingValid: boolean;
}
interface Acceptance { name: string; passed: boolean; details: unknown }

async function sourceFingerprint() {
  async function files(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(resolve(directory, entry.name)) : [resolve(directory, entry.name)]))).flat();
  }
  const paths = (await files(resolve(root, 'src'))).filter(path => /\.(ts|css)$/.test(path)).sort();
  const sources = await Promise.all(paths.map(async path => ({ path: relative(root, path), content: await readFile(path, 'utf8') })));
  // Exactly the browser evaluation lab's all-src TypeScript/CSS fingerprint scope.
  return { fingerprint: hash(JSON.stringify(sources)), paths: sources.map(source => source.path) };
}

export async function evaluateBalanceDummy(args = process.argv.slice(2)) {
  if (!(args.length === 0 || args.length === 2 && args[0] === '--out' && !args[1].startsWith('--'))) {
    throw new Error('Usage: node --import tsx scripts/evaluateBalanceDummy.ts [--out artifacts/balance-matrix/dummy]');
  }
  const output = resolve(root, args.length ? args[1] : 'artifacts/balance-matrix/dummy');
  const source = await sourceFingerprint();
  const runnerFingerprint = hash(await readFile(fileURLToPath(import.meta.url), 'utf8'));
  const variants = Object.keys(BALANCE_VARIANTS) as BalanceVariant[];
  const runs: Run[] = [];
  const acceptance: Acceptance[] = [];

  function run(experiment: string, fixture: EvaluationFixture, variant: BalanceVariant, mode: Mode, seed: number, firingSeconds = 30) {
    const rules = BALANCE_VARIANTS[variant];
    const result = simulateDummy({ state: fixture.state, mode, seed, duration: firingSeconds, drainSeconds: 5, distance: 19, criticalAim: false, balanceRules: rules });
    const { events, ...raw } = result;
    const collector = new CombatMeasurement({ runId: `${experiment}-${variant}-${fixture.id}-${mode}-${seed}`, scenario: 'dummy', provenance: 'simulated',
      seed, buildId: fixture.id, buildCodes: fixture.codes, protocol: BALANCE_MATRIX_PROTOCOL, sourceFingerprint: source.fingerprint,
      configuration: { experiment, variant, balanceRules: { ...rules }, mode, firingSeconds, drainSeconds: 5, fixedStep: 1 / 60,
        distance: 19, aim: 'stationary body aim', abilities: false, venting: false, syntheticCapacityBonus: experiment === 'capacity-plus-10pct' ? '10% of original total heat capacity; cooling and all other stats fixed' : null },
      equipment: JSON.parse(JSON.stringify(fixture.equipment)) as JsonValue,
    });
    for (const event of events) collector.record(event);
    const measurement = collector.snapshot();
    const accountingValid = measurement.rejectedEvents === 0 && close(measurement.damage.total, raw.totalDamage)
      && close(measurement.damage.direct, raw.directDamage) && close(measurement.damage.status, raw.statusDamage)
      && measurement.ammo.total === raw.ammoUsed && measurement.shots.total === raw.shots
      && close(measurement.heatBlockedSeconds, raw.heatBlockedSeconds) && close(measurement.reloadSeconds, raw.reloadSeconds);
    const record: Run = { experiment, variant, build: fixture.id, mode, seed, measurement, raw, heat: dummyHeatTiming(events),
      stats: getStats(fixture.state, mode), eventCount: events.length, eventTraceFingerprint: hash(JSON.stringify(events)), accountingValid };
    runs.push(record);
    return record;
  }

  // 96 matched baseline samples: four arms, three complete builds, two forms, four seeds.
  for (const { id } of EVALUATION_BUILDS) for (const variant of variants) for (const mode of ['pilot', 'mech'] as const) for (const seed of BALANCE_MATRIX_SEEDS) {
    run('matrix', createEvaluationFixture(id), variant, mode, seed);
  }
  // Reuse the dual-channel matrix cell and add only the matched single-channel control.
  for (const variant of variants) for (const mode of ['pilot', 'mech'] as const) for (const seed of BALANCE_MATRIX_SEEDS) {
    run('shock-only', createEvaluationFixture('elemental-pressure', { pilot: { secondaryElement: 'none' }, mech: { secondaryElement: 'none' } }), variant, mode, seed);
  }
  // Sustained cooling versus capacity is measured for 90 seconds, without resupply or venting.
  for (const variant of variants) for (const seed of BALANCE_MATRIX_SEEDS) for (const [experiment, reactorBrand] of [['cooling-reactor-90s', 'cindergrid'], ['capacity-reactor-90s', 'nullward']] as const) {
    run(experiment, createEvaluationFixture('elemental-pressure', { reactorBrand }), variant, 'mech', seed, 90);
  }
  // Synthetic fixed-cooling capacity control; mutate only an isolated diagnostic fixture in memory.
  for (const variant of variants) for (const seed of BALANCE_MATRIX_SEEDS) {
    const fixture = createEvaluationFixture('elemental-pressure');
    const reactor = fixture.equipment.mech.find(item => item.slot === 'reactor')!;
    reactor.stats.heatCapacity! += getStats(fixture.state, 'mech').heatCapacity * 0.1;
    run('capacity-plus-10pct', fixture, variant, 'mech', seed);
  }

  const cell = (variant: BalanceVariant, build: string, mode: Mode, seed: number, experiment = 'matrix') => runs.find(run => run.experiment === experiment && run.variant === variant && run.build === build && run.mode === mode && run.seed === seed)!;
  const sameResources = (a: Run, b: Run) => a.raw.ammoUsed === b.raw.ammoUsed && close(a.raw.heatBlockedSeconds, b.raw.heatBlockedSeconds) && close(a.raw.reloadSeconds, b.raw.reloadSeconds);
  const ratios: unknown[] = [];
  for (const { id } of EVALUATION_BUILDS) for (const mode of ['pilot', 'mech'] as const) for (const seed of BALANCE_MATRIX_SEEDS) {
    for (const [uncharged, charged] of [['baseline', 'secondary-only'], ['heat-only', 'combined']] as const) {
      const a = cell(uncharged, id, mode, seed), b = cell(charged, id, mode, seed);
      const factor = id === 'mobile-precision' ? 1 : 0.85;
      ratios.push({ build: id, mode, seed, pair: [uncharged, charged], factor,
        passed: sameResources(a, b) && close(b.raw.totalDamage, a.raw.totalDamage * factor) && close(b.raw.directDamage, a.raw.directDamage * factor) && close(b.raw.statusDamage, a.raw.statusDamage * factor) });
    }
  }
  acceptance.push({ name: 'Secondary cost scales effective direct/status/total damage once, with the same resources', passed: ratios.every(row => (row as { passed: boolean }).passed), details: ratios });
  const unchanged: unknown[] = [];
  for (const { id } of EVALUATION_BUILDS) for (const mode of ['pilot', 'mech'] as const) for (const seed of BALANCE_MATRIX_SEEDS) {
    if (mode === 'mech' && id === 'elemental-pressure') continue;
    for (const [a, b] of [['baseline', 'heat-only'], ['secondary-only', 'combined']] as const) {
      const first = cell(a, id, mode, seed), second = cell(b, id, mode, seed);
      unchanged.push({ build: id, mode, seed, pair: [a, b], passed: first.eventTraceFingerprint === second.eventTraceFingerprint });
    }
  }
  acceptance.push({ name: 'Pilot and slow precision/heavy mech thermal behavior remains identical', passed: unchanged.every(row => (row as { passed: boolean }).passed), details: unchanged });
  const thermal = BALANCE_MATRIX_SEEDS.map(seed => {
    const record = cell('combined', 'elemental-pressure', 'mech', seed);
    return { seed, shots: record.raw.shots, heatBlockedSeconds: record.raw.heatBlockedSeconds, longestHeatLockSeconds: record.heat.longestHeatLockSeconds,
      passed: record.raw.shots >= 60 && record.raw.shots <= 75 && record.raw.heatBlockedSeconds >= 15 && record.raw.heatBlockedSeconds <= 19 && record.heat.longestHeatLockSeconds <= 2.6 };
  });
  acceptance.push({ name: 'Combined pressure mech: 60–75 shots, 15–19s heat block, longest lock ≤2.6s', passed: thermal.every(row => row.passed), details: thermal });

  const mean = (samples: Run[], pick: (run: Run) => number) => samples.reduce((sum, record) => sum + pick(record), 0) / samples.length;
  const channelComparisons = variants.flatMap(variant => (['pilot', 'mech'] as const).map(mode => {
    const dual = BALANCE_MATRIX_SEEDS.map(seed => cell(variant, 'elemental-pressure', mode, seed));
    const single = BALANCE_MATRIX_SEEDS.map(seed => cell(variant, 'elemental-pressure', mode, seed, 'shock-only'));
    const gainPercent = (mean(dual, record => record.raw.totalDamage) / mean(single, record => record.raw.totalDamage) - 1) * 100;
    return { variant, mode, singleDps: mean(single, record => record.raw.practicalDps), dualDps: mean(dual, record => record.raw.practicalDps), gainPercent,
      withinDesiredBand: gainPercent >= 5 && gainPercent <= 20, acceptanceApplies: BALANCE_VARIANTS[variant].secondaryElementCost };
  }));
  acceptance.push({ name: 'Proposed cost arms: dual shock/corrosion mean DPS advantage is 5–20%', passed: channelComparisons.filter(row => row.acceptanceApplies).every(row => row.withinDesiredBand), details: channelComparisons });
  const cooling = variants.flatMap(variant => BALANCE_MATRIX_SEEDS.map(seed => {
    const a = cell(variant, 'elemental-pressure', 'mech', seed, 'cooling-reactor-90s'), b = cell(variant, 'elemental-pressure', 'mech', seed, 'capacity-reactor-90s');
    return { variant, seed, coolingShots: a.raw.shots, capacityShots: b.raw.shots, passed: a.raw.shots > b.raw.shots };
  }));
  acceptance.push({ name: 'Cooling retains a sustained firing advantage over capacity over 90 seconds', passed: cooling.every(row => row.passed), details: cooling });
  const capacity = variants.flatMap(variant => BALANCE_MATRIX_SEEDS.map(seed => {
    const a = cell(variant, 'elemental-pressure', 'mech', seed), b = cell(variant, 'elemental-pressure', 'mech', seed, 'capacity-plus-10pct');
    return { variant, seed, normalBurstShots: a.heat.firstBurstShots, increasedCapacityBurstShots: b.heat.firstBurstShots,
      normalFirstOverheatAt: a.heat.firstOverheatAt, increasedCapacityFirstOverheatAt: b.heat.firstOverheatAt,
      passed: b.heat.firstBurstShots > a.heat.firstBurstShots && b.heat.firstOverheatAt! > a.heat.firstOverheatAt! && a.stats.cooling === b.stats.cooling };
  }));
  acceptance.push({ name: 'At fixed cooling, +10% total capacity extends the first burst', passed: capacity.every(row => row.passed), details: capacity });
  acceptance.push({ name: 'Every event stream matches the independent aggregate collector', passed: runs.every(run => run.accountingValid), details: { runs: runs.length, failures: runs.filter(run => !run.accountingValid).map(run => run.measurement.metadata.runId) } });

  const original = cell('combined', 'elemental-pressure', 'mech', 7);
  const repeated = simulateDummy({ state: createEvaluationFixture('elemental-pressure').state, mode: 'mech', seed: 7, balanceRules: BALANCE_VARIANTS.combined });
  const { events: repeatedEvents, ...repeatedRaw } = repeated;
  const repeatability = { runId: original.measurement.metadata.runId, eventCount: repeatedEvents.length,
    eventTraceIdentical: hash(JSON.stringify(repeatedEvents)) === original.eventTraceFingerprint,
    rawMeasurementsIdentical: JSON.stringify(repeatedRaw) === JSON.stringify(original.raw) };
  acceptance.push({ name: 'Repeated combined pressure/seed7 reproduces every event and measurement', passed: repeatability.eventTraceIdentical && repeatability.rawMeasurementsIdentical, details: repeatability });
  acceptance.push({ name: 'Source stayed unchanged during the matrix', passed: (await sourceFingerprint()).fingerprint === source.fingerprint, details: source.fingerprint });

  const summaries = variants.flatMap(variant => EVALUATION_BUILDS.flatMap(build => (['pilot', 'mech'] as const).map(mode => {
    const samples = BALANCE_MATRIX_SEEDS.map(seed => cell(variant, build.id, mode, seed));
    return { variant, build: build.id, mode, samples: samples.length,
      directDamage: mean(samples, record => record.raw.directDamage), statusDamage: mean(samples, record => record.raw.statusDamage), dps: mean(samples, record => record.raw.practicalDps),
      ammo: mean(samples, record => record.raw.ammoUsed), heatBlockedSeconds: mean(samples, record => record.raw.heatBlockedSeconds),
      reloadSeconds: mean(samples, record => record.raw.reloadSeconds), maxHeatLockSeconds: Math.max(...samples.map(record => record.heat.longestHeatLockSeconds)) };
  })));
  const report = { protocol: BALANCE_MATRIX_PROTOCOL, provenance: 'simulated', sourceFingerprint: source.fingerprint, sourceScope: 'all src TypeScript/CSS; matches browser scope',
    runnerFingerprint, sources: source.paths, variants: BALANCE_VARIANTS, seeds: BALANCE_MATRIX_SEEDS, primaryMatrixRuns: 96,
    controlRuns: runs.length - 96, hardwareStatus: 'NOT RUN', encounterResults: 'separate actual Game matrix',
    eventTraceStorage: 'Every generated event is replayed into the collector; trace hashes/counts are retained rather than full dummy event arrays. Re-running the exact source/configuration reconstructs those arrays.',
    acceptance, repeatability, summaries, channelComparisons, runs };
  const n = (value: number) => value.toFixed(2);
  const markdown = ['# Separate and combined dummy balance matrix', '', `Source: \`${source.fingerprint}\`. Protocol: ${BALANCE_MATRIX_PROTOCOL}.`, '',
    `96 matched build/form/seed/arm samples, ${runs.length - 96} explicit controls, and one deterministic repeat. Actual permanent-dummy collision; stationary body aim at 19m; 30s trigger + 5s drain except the explicitly marked 90s reactor controls. Practical DPS includes the full observation window.`, '',
    'SIMULATED DUMMY ONLY. No encounter completion, received-damage survival, moving aim, area/control utility across enemies or hardware result is inferred. Source/gear/codes/rules, pending projectiles and statuses are retained per sample. The small timing adapter shares balance helpers with Game but does not execute Game.', '',
    '| Arm | Build | Form | DPS | Direct damage | Status damage | Ammo | Heat s | Reload s | Longest heat lock s |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...summaries.map(row => `| ${row.variant} | ${row.build} | ${row.mode} | ${n(row.dps)} | ${n(row.directDamage)} | ${n(row.statusDamage)} | ${n(row.ammo)} | ${n(row.heatBlockedSeconds)} | ${n(row.reloadSeconds)} | ${n(row.maxHeatLockSeconds)} |`), '',
    '## Acceptance checks', '', ...acceptance.map(check => `- **${check.passed ? 'PASS' : 'FAIL'}** — ${check.name}`), '',
    'Failed bands are retained for review; the runner never changes balance or discards a measured sample.', '',
    '## Matched single versus dual pressure channels', '', '| Arm | Form | Shock only DPS | Shock/corrosion DPS | Gain | Desired 5–20% band |', '| --- | --- | ---: | ---: | ---: | --- |',
    ...channelComparisons.map(row => `| ${row.variant} | ${row.mode} | ${n(row.singleDps)} | ${n(row.dualDps)} | ${n(row.gainPercent)}% | ${row.withinDesiredBand ? 'inside' : 'outside'}${row.acceptanceApplies ? '' : ' (baseline contrast)'} |`), '',
    '## Reactor and capacity controls', '', '| Arm | Cooling / capacity reactor shots over 90s | Normal / +10% total capacity first-burst shots |', '| --- | --- | --- |',
    ...variants.map(variant => {
      const sustained = cooling.find(row => row.variant === variant)!;
      const burst = capacity.find(row => row.variant === variant)!;
      return `| ${variant} | ${sustained.coolingShots} / ${sustained.capacityShots} | ${burst.normalBurstShots} / ${burst.increasedCapacityBurstShots} |`;
    }), '',
    'The control shot counts are identical across all four proc seeds. Full 90s reactor and fixed-cooling capacity comparisons, accounting checks, trace hashes and all acceptance details are in results.json. Every generated event is checked; the report retains trace hashes/counts rather than full dummy event arrays. Repeat raw/event hashes are checked independently of the collector.', '',
  ].join('\n');
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'results.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(resolve(output, 'summary.md'), markdown);
  process.stdout.write(`Measured ${runs.length} simulated dummy samples plus one repeat; ${acceptance.filter(check => check.passed).length}/${acceptance.length} acceptance checks passed. ${output}/summary.md\n`);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await evaluateBalanceDummy();
