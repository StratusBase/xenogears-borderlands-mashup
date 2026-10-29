import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BALANCE_MATRIX_SEEDS } from '../src/diagnostics/balanceVariants.ts';
import { createEvaluationFixture, EVALUATION_BUILDS, EVALUATION_PROTOCOL, type EvaluationBuildId } from '../src/diagnostics/fixtures.ts';
import type { MeasurementOutcome, TargetMeasurement } from '../src/diagnostics/measurement.ts';
import { BALANCE_VARIANTS, validateBalanceEvidence, type BalanceEvidence, type BalanceVariant } from './serveBalanceMatrix.ts';
import { assertSnapshotBalanceRules } from './summarizeBalanceMatrix.ts';

const variants = Object.keys(BALANCE_VARIANTS) as BalanceVariant[];
const controls = 'scripted-route-v1: actual Game, fixed 1/60s, body aim, no teleport or stat modifications';
const requireThat: (condition: unknown, message: string) => asserts condition = (condition, message) => { if (!condition) throw new Error(message); };
const canonical = (value: unknown): string => JSON.stringify(value, (_key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
  ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const cellKey = (variant: BalanceVariant, build: string, seed: number) => `${variant}/${build}/${seed}`;
const keys = variants.flatMap(variant => EVALUATION_BUILDS.flatMap(build => BALANCE_MATRIX_SEEDS.map(seed => cellKey(variant, build.id, seed))));
const fixtures = new Map(EVALUATION_BUILDS.map(build => [build.id, createEvaluationFixture(build.id)]));
const outcomes: MeasurementOutcome[] = ['complete', 'failed', 'timeout', 'aborted'];

interface ValidatedRun { variant: BalanceVariant; data: BalanceEvidence; expectedTargets: number; expectedVitality: number }
interface VersionReceipt {
  sourceFingerprint: string; encounterVersion: string;
  budgets: { seed: number; targets: number; vitality: number }[];
}
interface ValidatedMatrix extends VersionReceipt { runs: Map<string, ValidatedRun> }
const meanKeys = ['observedDurationSeconds', 'damageApplied', 'damageHealth', 'damageShield', 'practicalDps',
  'receivedHealth', 'receivedShield', 'receivedTotal', 'ammoPilot', 'ammoMech', 'ammoTotal', 'heatBlockedSeconds', 'reloadSeconds'] as const;
type MeanKey = typeof meanKeys[number];
type NumericMetrics = Record<MeanKey, number>;
interface TtkSummary {
  observedTargets: number; expectedTargets: number; killedTargets: number; censoredTargets: number;
  firstHitTtkTargets: number; spawnTtkTargets: number; meanFirstHitSeconds: number | null; meanSpawnSeconds: number | null;
}
interface RunMetrics extends NumericMetrics {
  outcome: MeasurementOutcome; completionSeconds: number | null; pacingAccepted: boolean; ttk: TtkSummary;
  targets: TargetMeasurement[];
}
interface Aggregate {
  attempts: number; completed: number; completionRate: number; outcomes: Record<MeasurementOutcome, number>;
  pacingAccepted: number; completedMeanSeconds: number | null; means: NumericMetrics; ttk: TtkSummary;
}
interface AggregateDifference {
  completed: number; completionRate: number; pacingAccepted: number; completedMeanSeconds: number | null;
  means: NumericMetrics; firstHitTtkSeconds: number | null; spawnTtkSeconds: number | null;
}
interface Pair {
  variant: BalanceVariant; build: string; seed: number; completedPair: boolean;
  before: RunMetrics; after: RunMetrics;
  delta: NumericMetrics & { completionSeconds: number | null; firstHitTtkSeconds: number | null; spawnTtkSeconds: number | null };
}
interface Group {
  variant: BalanceVariant; build: string; before: Aggregate; after: Aggregate; delta: AggregateDifference;
  completedPairs: number; meanCompletedPairSecondsDelta: number | null;
}
interface Exception { variant: BalanceVariant; build: string; seed: number; outcome: MeasurementOutcome; observedDurationSeconds: number }
export interface MatrixComparison {
  protocol: 'balance-matrix-comparison-v1'; hardwareStatus: 'NOT RUN'; inputPolicy: string; requiredSeeds: readonly number[];
  before: VersionReceipt; after: VersionReceipt;
  overall: { before: Aggregate; after: Aggregate; delta: AggregateDifference };
  combined: { before: Aggregate; after: Aggregate; delta: AggregateDifference };
  groups: Group[]; pairs: Pair[]; pacingExceptions: { before: Exception[]; after: Exception[] }; limitations: string[];
}

function validateMatrix(value: unknown, label: string): ValidatedMatrix {
  requireThat(record(value), `${label}: expected a matrix report object.`);
  requireThat(typeof value.sourceFingerprint === 'string' && /^sha256:[a-f0-9]{64}$/.test(value.sourceFingerprint), `${label}: invalid source fingerprint.`);
  requireThat(typeof value.encounterVersion === 'string' && value.encounterVersion.trim().length > 0 && value.encounterVersion.length <= 200, `${label}: missing encounter version.`);
  requireThat(value.hardwareStatus === 'NOT RUN', `${label}: physical hardware status must remain NOT RUN.`);
  requireThat(canonical(value.variants) === canonical(BALANCE_VARIANTS), `${label}: matrix arm definitions differ.`);
  requireThat(canonical(value.requiredSeeds) === canonical(BALANCE_MATRIX_SEEDS), `${label}: matrix seeds differ.`);
  requireThat(Array.isArray(value.runs) && value.runs.length === 48, `${label}: expected all 48 matrix cells.`);
  const runs = new Map<string, ValidatedRun>();
  const budgets = new Map<number, { targets: number; vitality: number }>();
  for (const raw of value.runs) {
    requireThat(record(raw), `${label}: malformed run.`);
    const checked = validateBalanceEvidence(raw.data);
    const data = raw.data as BalanceEvidence, m = data.measurement, meta = m.metadata;
    const key = cellKey(checked.variant, checked.build, checked.seed);
    const context = `${label} ${key}`;
    requireThat(raw.variant === checked.variant, `${context}: row and actual arm differ.`);
    requireThat(!runs.has(key), `${context}: duplicate matrix cell.`);
    assertSnapshotBalanceRules(data.encounter, checked.variant);
    requireThat(meta.sourceFingerprint === value.sourceFingerprint, `${context}: run source differs from matrix source.`);
    const config = meta.configuration;
    requireThat(record(config) && meta.protocol === EVALUATION_PROTOCOL && config.protocol === EVALUATION_PROTOCOL,
      `${context}: measurement protocol differs.`);
    requireThat(config.controls === controls && config.seed === meta.seed && config.mode === 'pilot-to-mech'
      && config.startingRun === 1 && config.timeoutSeconds === 480 && config.sourceScope === 'all src ts/css' && config.hardwareStatus === 'NOT RUN',
    `${context}: fixed-step input policy/configuration differs.`);
    const fixture = fixtures.get(meta.buildId as EvaluationBuildId)!;
    requireThat(canonical(meta.buildCodes) === canonical(fixture.codes) && canonical(meta.equipment) === canonical(fixture.equipment),
      `${context}: workbench codes or equipment differ from the matched fixture.`);
    requireThat(typeof raw.expectedTargets === 'number' && Number.isInteger(raw.expectedTargets) && raw.expectedTargets > 0
      && typeof raw.expectedVitality === 'number' && Number.isFinite(raw.expectedVitality) && raw.expectedVitality > 0,
    `${context}: invalid encounter target/vitality budget.`);
    const previousBudget = budgets.get(meta.seed);
    requireThat(!previousBudget || previousBudget.targets === raw.expectedTargets && previousBudget.vitality === raw.expectedVitality,
      `${context}: encounter budget differs between arms/builds for the same seed.`);
    budgets.set(meta.seed, { targets: raw.expectedTargets, vitality: raw.expectedVitality });
    const spawns = data.events.filter(event => event.type === 'target-spawn');
    const spawnedVitality = spawns.reduce((sum, event) => sum + event.health + event.shield, 0);
    requireThat(spawns.length <= raw.expectedTargets && spawnedVitality <= raw.expectedVitality + 1e-6 && m.damage.total <= raw.expectedVitality + 1e-6,
      `${context}: observed combat exceeds the encounter budget.`);
    if (m.outcome === 'complete') requireThat(spawns.length === raw.expectedTargets && m.kills === raw.expectedTargets
      && m.targets.length === raw.expectedTargets && m.targets.every(target => target.killedAt !== null)
      && Math.abs(m.damage.total - raw.expectedVitality) < 1e-6 && Math.abs(spawnedVitality - raw.expectedVitality) < 1e-6,
    `${context}: complete outcome does not contain the full encounter.`);
    runs.set(key, { variant: checked.variant, data, expectedTargets: raw.expectedTargets, expectedVitality: raw.expectedVitality });
  }
  for (const key of keys) requireThat(runs.has(key), `${label}: missing matrix cell ${key}.`);
  return { sourceFingerprint: value.sourceFingerprint, encounterVersion: value.encounterVersion, runs,
    budgets: BALANCE_MATRIX_SEEDS.map(seed => ({ seed, ...budgets.get(seed)! })) };
}

function ttkSummary(runs: ValidatedRun[]): TtkSummary {
  const targets = runs.flatMap(run => run.data.measurement.targets);
  const killed = targets.filter(target => target.killedAt !== null);
  const first = killed.filter(target => target.ttkFromFirstDamage !== null);
  const spawned = killed.filter(target => target.ttkFromSpawn !== null);
  return { observedTargets: targets.length, expectedTargets: runs.reduce((sum, run) => sum + run.expectedTargets, 0),
    killedTargets: killed.length, censoredTargets: targets.length - killed.length, firstHitTtkTargets: first.length, spawnTtkTargets: spawned.length,
    meanFirstHitSeconds: first.length ? first.reduce((sum, target) => sum + target.ttkFromFirstDamage!, 0) / first.length : null,
    meanSpawnSeconds: spawned.length ? spawned.reduce((sum, target) => sum + target.ttkFromSpawn!, 0) / spawned.length : null };
}
function metrics(run: ValidatedRun): RunMetrics {
  const m = run.data.measurement;
  return { outcome: m.outcome!, completionSeconds: m.outcome === 'complete' ? m.duration : null,
    pacingAccepted: m.outcome === 'complete' && m.duration >= 180 && m.duration <= 300,
    observedDurationSeconds: m.duration, damageApplied: m.damage.total, damageHealth: m.damage.health, damageShield: m.damage.shield,
    practicalDps: m.practicalDps, receivedHealth: m.received.health, receivedShield: m.received.shield, receivedTotal: m.received.total,
    ammoPilot: m.ammo.pilot, ammoMech: m.ammo.mech, ammoTotal: m.ammo.total,
    heatBlockedSeconds: m.heatBlockedSeconds, reloadSeconds: m.reloadSeconds, ttk: ttkSummary([run]),
    targets: m.targets.map(target => ({ ...target })) };
}
function aggregate(runs: ValidatedRun[]): Aggregate {
  const rows = runs.map(metrics), completed = rows.filter(row => row.outcome === 'complete');
  return { attempts: rows.length, completed: completed.length, completionRate: completed.length / rows.length,
    outcomes: Object.fromEntries(outcomes.map(outcome => [outcome, rows.filter(row => row.outcome === outcome).length])) as Record<MeasurementOutcome, number>,
    pacingAccepted: rows.filter(row => row.pacingAccepted).length,
    completedMeanSeconds: completed.length ? completed.reduce((sum, row) => sum + row.completionSeconds!, 0) / completed.length : null,
    means: Object.fromEntries(meanKeys.map(key => [key, rows.reduce((sum, row) => sum + row[key], 0) / rows.length])) as NumericMetrics,
    ttk: ttkSummary(runs) };
}
const difference = (before: number | null, after: number | null) => before === null || after === null ? null : after - before;
function numericDifference(before: NumericMetrics, after: NumericMetrics): NumericMetrics {
  return Object.fromEntries(meanKeys.map(key => [key, after[key] - before[key]])) as NumericMetrics;
}
function aggregateDifference(before: Aggregate, after: Aggregate): AggregateDifference {
  return { completed: after.completed - before.completed, completionRate: after.completionRate - before.completionRate,
    pacingAccepted: after.pacingAccepted - before.pacingAccepted, completedMeanSeconds: difference(before.completedMeanSeconds, after.completedMeanSeconds),
    means: numericDifference(before.means, after.means),
    firstHitTtkSeconds: difference(before.ttk.meanFirstHitSeconds, after.ttk.meanFirstHitSeconds),
    spawnTtkSeconds: difference(before.ttk.meanSpawnSeconds, after.ttk.meanSpawnSeconds) };
}
function exceptions(matrix: ValidatedMatrix): Exception[] {
  return keys.flatMap(key => {
    const run = matrix.runs.get(key)!, m = run.data.measurement;
    return metrics(run).pacingAccepted ? [] : [{ variant: run.variant, build: m.metadata.buildId, seed: m.metadata.seed,
      outcome: m.outcome!, observedDurationSeconds: m.duration }];
  });
}

/** Revalidates raw evidence and recomputes all means; imported summary fields are never trusted. */
export function compareBalanceMatrices(beforeValue: unknown, afterValue: unknown): MatrixComparison {
  const before = validateMatrix(beforeValue, 'Before'), after = validateMatrix(afterValue, 'After');
  const pairs: Pair[] = keys.map(key => {
    const a = before.runs.get(key)!, b = after.runs.get(key)!, prior = metrics(a), next = metrics(b);
    requireThat(canonical(a.data.measurement.metadata.buildCodes) === canonical(b.data.measurement.metadata.buildCodes)
      && canonical(a.data.measurement.metadata.equipment) === canonical(b.data.measurement.metadata.equipment), `${key}: fixture differs between versions.`);
    return { variant: a.variant, build: a.data.measurement.metadata.buildId, seed: a.data.measurement.metadata.seed,
      completedPair: prior.outcome === 'complete' && next.outcome === 'complete', before: prior, after: next,
      delta: { ...numericDifference(prior, next), completionSeconds: difference(prior.completionSeconds, next.completionSeconds),
        firstHitTtkSeconds: difference(prior.ttk.meanFirstHitSeconds, next.ttk.meanFirstHitSeconds),
        spawnTtkSeconds: difference(prior.ttk.meanSpawnSeconds, next.ttk.meanSpawnSeconds) } };
  });
  const groups = variants.flatMap(variant => EVALUATION_BUILDS.map(build => {
    const groupKeys = BALANCE_MATRIX_SEEDS.map(seed => cellKey(variant, build.id, seed));
    const a = aggregate(groupKeys.map(key => before.runs.get(key)!)), b = aggregate(groupKeys.map(key => after.runs.get(key)!));
    const completePairs = pairs.filter(pair => pair.variant === variant && pair.build === build.id && pair.completedPair);
    return { variant, build: build.id, before: a, after: b, delta: aggregateDifference(a, b), completedPairs: completePairs.length,
      meanCompletedPairSecondsDelta: completePairs.length ? completePairs.reduce((sum, pair) => sum + pair.delta.completionSeconds!, 0) / completePairs.length : null };
  }));
  const allBefore = aggregate([...before.runs.values()]), allAfter = aggregate([...after.runs.values()]);
  const combinedBefore = aggregate([...before.runs.values()].filter(run => run.variant === 'combined'));
  const combinedAfter = aggregate([...after.runs.values()].filter(run => run.variant === 'combined'));
  return { protocol: 'balance-matrix-comparison-v1', hardwareStatus: 'NOT RUN', inputPolicy: controls, requiredSeeds: [...BALANCE_MATRIX_SEEDS],
    before: { encounterVersion: before.encounterVersion, sourceFingerprint: before.sourceFingerprint, budgets: before.budgets },
    after: { encounterVersion: after.encounterVersion, sourceFingerprint: after.sourceFingerprint, budgets: after.budgets },
    overall: { before: allBefore, after: allAfter, delta: aggregateDifference(allBefore, allAfter) },
    combined: { before: combinedBefore, after: combinedAfter, delta: aggregateDifference(combinedBefore, combinedAfter) }, groups, pairs,
    pacingExceptions: { before: exceptions(before), after: exceptions(after) },
    limitations: [
      'Inputs are simulated in the actual Game. Physical gamepad and human play remain NOT RUN.',
      'Source versions may also differ in presentation/integration. Version differences do not isolate a causal effect of encounter vitality.',
      'Exact trace replay verifies accounting. Render-clock muzzle/recoil updates prevent a claim of byte-identical whole-game execution.',
      'All-attempt means include failed, timeout and aborted outcomes at their observed stop times; those durations are not completion times.',
      'Completion means show their completed denominator. Paired completion deltas include only seeds completed in both versions.',
      'TTK means include only killed targets with the corresponding timestamp. Survivors retain null TTK; unspawned targets are not counted as observed.',
      'Pacing exceptions are reported without changing balance, encounter settings or measurement inputs.',
    ] };
}

export function comparisonMarkdown(report: MatrixComparison): string {
  const f = (value: number | null) => value === null ? '—' : value.toFixed(2);
  const mean = (a: number, b: number) => `${f(a)} → ${f(b)}`;
  const ttk = (a: TtkSummary, b: TtkSummary) => `${f(a.meanFirstHitSeconds)} (${a.firstHitTtkTargets}/${a.observedTargets}) → ${f(b.meanFirstHitSeconds)} (${b.firstHitTtkTargets}/${b.observedTargets})`;
  const lines = ['# Retained encounter matrix comparison', '',
    `Before: **${report.before.encounterVersion}**, \`${report.before.sourceFingerprint}\`.`,
    `After: **${report.after.encounterVersion}**, \`${report.after.sourceFingerprint}\`.`, '',
    `**48 matched cells per version. Completion: ${report.overall.before.completed}/48 → ${report.overall.after.completed}/48. Combined pacing: ${report.combined.before.pacingAccepted}/12 → ${report.combined.after.pacingAccepted}/12 within 180–300s.**`, '',
    'All values below are before → after. Deltas are after minus before. Every raw event trace was revalidated; imported summary means were ignored.', '',
    '| Arm | Build | Completed | All-attempt duration s | Completed-only s | Completed pairs | Paired completion delta s | Pacing accepted |',
    '| --- | --- | --- | --- | --- | --- | ---: | --- |'];
  for (const g of report.groups) lines.push(`| ${g.variant} | ${g.build} | ${g.before.completed}/4 → ${g.after.completed}/4 | ${mean(g.before.means.observedDurationSeconds, g.after.means.observedDurationSeconds)} | ${f(g.before.completedMeanSeconds)} → ${f(g.after.completedMeanSeconds)} | ${g.completedPairs}/4 | ${f(g.meanCompletedPairSecondsDelta)} | ${g.before.pacingAccepted}/4 → ${g.after.pacingAccepted}/4 |`);
  lines.push('', '## Damage, target timing and resources', '',
    'Each row averages all four attempts for damage, DPS, received damage and resources. First-hit TTK is weighted across eligible killed targets; the denominator is eligible killed / observed targets. Complete target timing rows, including null survivor TTK, remain in comparison.json.', '',
    '| Arm | Build | Applied damage | Practical DPS | First-hit TTK s (targets) | Received health / shield | Ammo pilot / mech | Heat blocked s | Reload s |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const g of report.groups) {
    const a = g.before.means, b = g.after.means;
    lines.push(`| ${g.variant} | ${g.build} | ${mean(a.damageApplied, b.damageApplied)} | ${mean(a.practicalDps, b.practicalDps)} | ${ttk(g.before.ttk, g.after.ttk)} | ${f(a.receivedHealth)}/${f(a.receivedShield)} → ${f(b.receivedHealth)}/${f(b.receivedShield)} | ${f(a.ammoPilot)}/${f(a.ammoMech)} → ${f(b.ammoPilot)}/${f(b.ammoMech)} | ${mean(a.heatBlockedSeconds, b.heatBlockedSeconds)} | ${mean(a.reloadSeconds, b.reloadSeconds)} |`);
  }
  lines.push('', '## Pacing exceptions', '');
  for (const version of ['before', 'after'] as const) {
    lines.push(`### ${report[version].encounterVersion}`, '', ...(report.pacingExceptions[version].length ? report.pacingExceptions[version].map(row => `- ${row.variant} / ${row.build} / seed ${row.seed}: ${row.outcome}, ${f(row.observedDurationSeconds)}s.`) : ['None.']), '');
  }
  lines.push('## Validation boundaries', '', ...report.limitations.map(line => `- ${line}`), '');
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2), options = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    requireThat(['--before', '--after', '--outdir'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--') && !options.has(args[i]),
      'Usage: node --import tsx scripts/compareBalanceMatrices.ts --before before/results.json --after after/results.json --outdir new-directory');
    options.set(args[i], args[i + 1]);
  }
  requireThat(options.size === 3, 'Required: --before, --after and --outdir (new directory).');
  const beforePath = resolve(options.get('--before')!), afterPath = resolve(options.get('--after')!), output = resolve(options.get('--outdir')!);
  const [beforeText, afterText] = await Promise.all([readFile(beforePath, 'utf8'), readFile(afterPath, 'utf8')]);
  const report = compareBalanceMatrices(JSON.parse(beforeText), JSON.parse(afterText));
  const sha = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
  const toolPath = fileURLToPath(import.meta.url), toolText = await readFile(toolPath, 'utf8');
  const document = { ...report, comparisonTool: { path: toolPath, fileFingerprint: sha(toolText) },
    inputReports: { before: { path: beforePath, fileFingerprint: sha(beforeText) }, after: { path: afterPath, fileFingerprint: sha(afterText) } } };
  // A fresh directory prevents overwriting retained comparisons or raw evidence.
  await mkdir(output);
  await writeFile(resolve(output, 'comparison.json'), `${JSON.stringify(document, null, 2)}\n`, { flag: 'wx' });
  await writeFile(resolve(output, 'comparison.md'), comparisonMarkdown(report), { flag: 'wx' });
  process.stdout.write(`Compared 48 matched cells per version with exact trace replay. Combined pacing ${report.combined.before.pacingAccepted}/12 → ${report.combined.after.pacingAccepted}/12. Reports: ${output}\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
