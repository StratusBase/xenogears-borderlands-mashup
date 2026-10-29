import { createHash } from 'node:crypto';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { brandList, elementLabels, projectileLabels } from '../src/core/arsenal.ts';
import { createEvaluationFixture, EVALUATION_BUILDS, EVALUATION_PROTOCOL, EVALUATION_SEEDS, type FixtureOverrides, type EvaluationBuildId } from '../src/diagnostics/fixtures.ts';
import { CombatMeasurement, type JsonValue } from '../src/diagnostics/measurement.ts';
import { simulateDummy } from '../src/diagnostics/dummySimulation.ts';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
if (!(args.length === 0 || args.length === 2 && outIndex === 0 && args[1] && !args[1].startsWith('--'))) {
  throw new Error('Usage: node --import tsx scripts/evaluateArsenal.ts [--out artifacts/evaluation]');
}
const outputDirectory = resolve(root, outIndex >= 0 ? args[outIndex + 1] : 'artifacts/evaluation');

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? sourceFiles(resolve(directory, entry.name)) : [resolve(directory, entry.name)]));
  return nested.flat().filter(file => /\.(ts|css)$/.test(file));
}
const sources = [...await sourceFiles(resolve(root, 'src')), resolve(root, 'scripts/evaluateArsenal.ts'), resolve(root, 'package-lock.json'), resolve(root, 'tsconfig.json')].sort();
const sourceContents = await Promise.all(sources.map(async file => ({ path: relative(root, file), content: await readFile(file, 'utf8') })));
const fingerprint = `sha256:${createHash('sha256').update(JSON.stringify(sourceContents)).digest('hex')}`;

const experiments: { id: string; build: EvaluationBuildId; overrides?: FixtureOverrides; distance?: number; criticalAim?: boolean }[] = [];
for (const build of EVALUATION_BUILDS) experiments.push({ id: 'baseline', build: build.id });
for (const brand of brandList) experiments.push({ id: `manufacturer-${brand.id}`, build: 'mobile-precision', overrides: { pilot: { brand: brand.id }, mech: { brand: brand.id } } });
for (const projectile of Object.keys(projectileLabels) as (keyof typeof projectileLabels)[]) {
  experiments.push({ id: `projectile-${projectile}`, build: 'mobile-precision', overrides: { pilot: { projectile }, mech: { projectile } } });
}
for (const element of Object.keys(elementLabels) as (keyof typeof elementLabels)[]) {
  experiments.push({ id: `element-${element}`, build: 'mobile-precision', overrides: { pilot: { element }, mech: { element } } });
}
experiments.push(
  { id: 'single-channel', build: 'elemental-pressure', overrides: { pilot: { secondaryElement: 'none' }, mech: { secondaryElement: 'none' } } },
  { id: 'cooling-reactor', build: 'elemental-pressure', overrides: { reactorBrand: 'cindergrid' } },
  { id: 'capacity-reactor', build: 'elemental-pressure', overrides: { reactorBrand: 'nullward' } },
  { id: 'armored-equipment', build: 'mobile-precision', overrides: { equipmentBrand: 'ironvale' } },
  { id: 'armored-legs', build: 'mobile-precision', overrides: { legsBrand: 'ironvale' } },
  { id: 'arc-12m', build: 'elemental-pressure', distance: 12 },
  { id: 'arc-30m', build: 'elemental-pressure', distance: 30 },
  { id: 'precision-critical-aim', build: 'mobile-precision', criticalAim: true },
);

const runs = [];
for (const experiment of experiments) {
  const fixture = createEvaluationFixture(experiment.build, experiment.overrides);
  for (const mode of ['pilot', 'mech'] as const) for (const seed of EVALUATION_SEEDS) {
    const controls = { firingSeconds: 30, drainSeconds: 5, fixedStep: 1 / 60, distance: experiment.distance ?? 19, criticalAim: experiment.criticalAim ?? false, aim: 'fixed geometric aim; no recoil cost', movement: 'stationary', abilities: false };
    const raw = simulateDummy({ state: fixture.state, mode, seed, duration: controls.firingSeconds, drainSeconds: controls.drainSeconds, distance: controls.distance, criticalAim: controls.criticalAim });
    const collector = new CombatMeasurement({
      runId: `${experiment.id}-${experiment.build}-${mode}-${seed}`, scenario: 'dummy', provenance: 'simulated', seed,
      buildId: fixture.id, buildCodes: fixture.codes, configuration: { experiment: experiment.id, mode, ...controls },
      equipment: JSON.parse(JSON.stringify(fixture.equipment)) as JsonValue, sourceFingerprint: fingerprint, protocol: EVALUATION_PROTOCOL,
    });
    for (const event of raw.events) collector.record(event);
    const measurement = collector.snapshot();
    if (measurement.rejectedEvents) throw new Error(`${measurement.metadata.runId}: ${measurement.rejectedEvents} rejected events`);
    if (Math.abs(measurement.damage.total - raw.totalDamage) > 1e-6 || measurement.ammo.total !== raw.ammoUsed) throw new Error('Raw/meter accounting mismatch');
    runs.push({ experiment: experiment.id, mode, stats: fixture.stats[mode], measurement, firingWindowDps: raw.firingWindowDps,
      simulatorProtocol: raw.protocol, pendingProjectiles: raw.pendingProjectiles, activeStatusesAtEnd: raw.activeStatusesAtEnd,
      remainingAmmo: { magazine: raw.magazineRemaining, reserve: raw.reserveRemaining }, limitations: raw.limitations });
  }
}
const summaries = experiments.flatMap(experiment => (['pilot', 'mech'] as const).map(mode => {
  const samples = runs.filter(run => run.experiment === experiment.id && run.measurement.metadata.buildId === experiment.build && run.mode === mode);
  const average = (pick: (run: typeof runs[number]) => number) => samples.reduce((total, run) => total + pick(run), 0) / samples.length;
  return { experiment: experiment.id, build: experiment.build, mode, samples: samples.length,
    damage: average(run => run.measurement.damage.total), dps: average(run => run.measurement.practicalDps),
    minDps: Math.min(...samples.map(run => run.measurement.practicalDps)), maxDps: Math.max(...samples.map(run => run.measurement.practicalDps)),
    firingWindowDps: average(run => run.firingWindowDps), statusDamage: average(run => run.measurement.damage.status),
    ammo: average(run => run.measurement.ammo.total), heatSeconds: average(run => run.measurement.heatBlockedSeconds), reloadSeconds: average(run => run.measurement.reloadSeconds),
  };
}));
const report = { protocol: EVALUATION_PROTOCOL, sourceFingerprint: fingerprint, sources: sourceContents.map(source => source.path), seeds: EVALUATION_SEEDS,
  provenance: 'simulated', encounterResults: [], encounterStatus: 'Live encounter runs are collected separately in evaluation-lab.html; dummy damage never proves completion or target TTK.', hardwareStatus: 'NOT RUN', summaries, runs };
const n = (value: number) => value.toFixed(2);
const markdown = [
  '# Arsenal measurement evidence', '', `Protocol: ${EVALUATION_PROTOCOL}. Source: \`${fingerprint}\`.`, '',
  'SIMULATED DUMMY ONLY. Actual projectile collision against permanent dummy geometry; fixed aim and mirrored weapon timing. No enemy AI, received damage, target defeats, encounter completion, or physical controller testing is claimed.', '',
  '30s trigger window + 5s drain; practical DPS = all accepted damage / 35s. Three seeds per row. Pilot and mech remain separate. Frozen/control utility, chains, crowd splash and movement have no representative target here.', '',
  '| Experiment | Build | Form | DPS mean [min–max] | Status damage | Ammo | Heat blocked s | Reload s |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...summaries.map(row => `| ${row.experiment} | ${row.build} | ${row.mode} | ${n(row.dps)} [${n(row.minDps)}–${n(row.maxDps)}] | ${n(row.statusDamage)} | ${n(row.ammo)} | ${n(row.heatSeconds)} | ${n(row.reloadSeconds)} |`),
  '', 'Full equipped items, both WS1 codes, controls, applied damage breakdown, timing, source fingerprint and seeded results are in results.json. Proposed balance changes belong in docs/evaluation-findings.md.', '',
].join('\n');
await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, 'results.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(resolve(outputDirectory, 'summary.md'), markdown);
process.stdout.write(`Evaluated ${runs.length} simulated dummy runs. Evidence: ${relative(root, outputDirectory)}/summary.md\n`);
