import assert from 'node:assert/strict';
import test from 'node:test';
import { compareBalanceMatrices, comparisonMarkdown } from '../scripts/compareBalanceMatrices.ts';
import { BALANCE_VARIANTS, type BalanceVariant } from '../scripts/serveBalanceMatrix.ts';
import { BALANCE_MATRIX_SEEDS } from '../src/diagnostics/balanceVariants.ts';
import { createEvaluationFixture, EVALUATION_BUILDS, EVALUATION_PROTOCOL } from '../src/diagnostics/fixtures.ts';
import { CombatMeasurement, type JsonValue, type MeasurementEvent, type MeasurementOutcome } from '../src/diagnostics/measurement.ts';

const controls = 'scripted-route-v1: actual Game, fixed 1/60s, body aim, no teleport or stat modifications';
function matrix(after = false, outcomeFor: (variant: BalanceVariant, build: string, seed: number) => MeasurementOutcome = () => 'complete') {
  const sourceFingerprint = `sha256:${(after ? 'b' : 'a').repeat(64)}`;
  const runs = (Object.keys(BALANCE_VARIANTS) as BalanceVariant[]).flatMap(variant => EVALUATION_BUILDS.flatMap(build => BALANCE_MATRIX_SEEDS.map(seed => {
    const fixture = createEvaluationFixture(build.id), outcome = outcomeFor(variant, build.id, seed);
    const health = after ? 125 : 100, duration = outcome === 'complete' ? after ? 220 : 200 : 100;
    const metadata = { runId: `${variant}-${build.id}-${seed}`, scenario: 'encounter' as const, provenance: 'simulated' as const, seed, buildId: build.id,
      buildCodes: fixture.codes, equipment: JSON.parse(JSON.stringify(fixture.equipment)) as JsonValue, sourceFingerprint, protocol: EVALUATION_PROTOCOL,
      configuration: { balanceVariant: variant, balanceRules: BALANCE_VARIANTS[variant], protocol: EVALUATION_PROTOCOL,
        controls, seed, mode: 'pilot-to-mech', startingRun: 1, timeoutSeconds: 480, sourceScope: 'all src ts/css', hardwareStatus: 'NOT RUN' } };
    const events: MeasurementEvent[] = [
      { type: 'target-spawn', at: 0, targetId: 'a', health, shield: 0 },
      { type: 'target-spawn', at: 0, targetId: 'b', health, shield: 0 },
      { type: 'shot', at: 0.1, mode: 'pilot', ammo: 1 },
      { type: 'shot', at: 0.2, mode: 'mech', ammo: after ? 4 : 2 },
      { type: 'damage', at: 1, targetId: 'a', target: 'enemy', health, shield: 0, source: 'direct' },
      { type: 'interval', at: 1, dt: 1, heatBlocked: true, reloading: false },
      { type: 'interval', at: 2, dt: 1, heatBlocked: after, reloading: true },
      { type: 'received', at: 2.5, health: after ? 4 : 2, shield: after ? 6 : 3 },
      { type: 'target-killed', at: 3, targetId: 'a' },
      { type: 'damage', at: 4, targetId: 'b', target: 'enemy', health: health / 2, shield: 0, source: 'status' },
    ];
    if (outcome === 'complete') events.push(
      { type: 'damage', at: 6, targetId: 'b', target: 'enemy', health: health / 2, shield: 0, source: 'status' },
      { type: 'target-killed', at: after ? 7 : 6, targetId: 'b' });
    events.push({ type: 'finish', at: duration, outcome });
    const recorder = new CombatMeasurement(metadata);
    for (const event of events) assert.equal(recorder.record(event), true);
    return { variant, expectedTargets: 2, expectedVitality: health * 2, data: { measurement: recorder.snapshot(), events,
      droppedTraceEvents: 0, hardwareStatus: 'NOT RUN', sourceFingerprint, encounter: { weaponBalance: { ...BALANCE_VARIANTS[variant] } } } };
  })));
  return { sourceFingerprint, encounterVersion: after ? 'relay-break-v3' : 'relay-break-v2', hardwareStatus: 'NOT RUN',
    variants: BALANCE_VARIANTS, requiredSeeds: [...BALANCE_MATRIX_SEEDS], summaries: [{ meanSeconds: -999 }], combinedAccepted: false, runs };
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

test('matrix comparison pairs all 48 cells, recomputes means and reports resource/damage arithmetic', () => {
  const report = compareBalanceMatrices(matrix(), matrix(true));
  assert.equal(report.pairs.length, 48); assert.equal(report.groups.length, 12);
  const group = report.groups.find(row => row.variant === 'combined' && row.build === 'elemental-pressure')!;
  assert.equal(group.before.means.observedDurationSeconds, 200);
  assert.equal(group.after.means.observedDurationSeconds, 220);
  assert.equal(group.delta.means.observedDurationSeconds, 20);
  assert.equal(group.delta.means.damageApplied, 50);
  assert.equal(group.delta.means.practicalDps, 250 / 220 - 1);
  assert.equal(group.delta.means.ammoPilot, 0); assert.equal(group.delta.means.ammoMech, 2);
  assert.equal(group.delta.means.receivedHealth, 2); assert.equal(group.delta.means.receivedShield, 3);
  assert.equal(group.delta.means.heatBlockedSeconds, 1); assert.equal(group.delta.means.reloadSeconds, 0);
  assert.equal(group.meanCompletedPairSecondsDelta, 20); assert.equal(group.completedPairs, 4);
  assert.equal(report.combined.before.pacingAccepted, 12); assert.equal(report.combined.after.pacingAccepted, 12);
  assert.deepEqual(report.pacingExceptions, { before: [], after: [] });
  assert.match(comparisonMarkdown(report), /relay-break-v2/); assert.match(comparisonMarkdown(report), /relay-break-v3/);
});

test('failed attempts stay in duration means while completion pairs and killed TTK retain their denominators', () => {
  const before = matrix(false, (variant, build, seed) => variant === 'combined' && build === 'elemental-pressure' && seed === 7 ? 'failed' : 'complete');
  const report = compareBalanceMatrices(before, matrix(true));
  const group = report.groups.find(row => row.variant === 'combined' && row.build === 'elemental-pressure')!;
  assert.equal(group.before.completed, 3); assert.equal(group.before.outcomes.failed, 1);
  assert.equal(group.before.means.observedDurationSeconds, 175); assert.equal(group.before.completedMeanSeconds, 200);
  assert.equal(group.delta.means.observedDurationSeconds, 45); assert.equal(group.delta.completedMeanSeconds, 20);
  assert.equal(group.completedPairs, 3); assert.equal(group.meanCompletedPairSecondsDelta, 20);
  assert.deepEqual(group.before.ttk, { observedTargets: 8, expectedTargets: 8, killedTargets: 7, censoredTargets: 1,
    firstHitTtkTargets: 7, spawnTtkTargets: 7, meanFirstHitSeconds: 2, meanSpawnSeconds: 30 / 7 });
  assert.equal(group.after.ttk.meanFirstHitSeconds, 2.5); assert.equal(group.delta.firstHitTtkSeconds, 0.5);
  const pair = report.pairs.find(row => row.variant === 'combined' && row.build === 'elemental-pressure' && row.seed === 7)!;
  assert.equal(pair.completedPair, false); assert.equal(pair.delta.completionSeconds, null);
  assert.equal(pair.before.targets[1].ttkFromFirstDamage, null); assert.equal(pair.before.targets[1].killedAt, null);
  assert.deepEqual(report.pacingExceptions.before, [{ variant: 'combined', build: 'elemental-pressure', seed: 7, outcome: 'failed', observedDurationSeconds: 100 }]);
});

test('zero completed outcomes never become zero-second clears and every failure outcome is retained', () => {
  const before = matrix(false, (_v, _b, seed) => seed === 7 ? 'failed' : seed === 8 ? 'timeout' : 'aborted');
  const report = compareBalanceMatrices(before, matrix(true));
  assert.equal(report.overall.before.completedMeanSeconds, null);
  assert.equal(report.overall.delta.completedMeanSeconds, null);
  assert.deepEqual(report.overall.before.outcomes, { complete: 0, failed: 12, timeout: 12, aborted: 24 });
  assert.equal(report.pacingExceptions.before.length, 48);
  assert.ok(report.pairs.every(pair => pair.delta.completionSeconds === null));
  assert.ok(report.groups.every(group => group.completedPairs === 0 && group.meanCompletedPairSecondsDelta === null));
});

test('missing, duplicate and malformed matrix cells are rejected', () => {
  assert.throws(() => compareBalanceMatrices(null, matrix(true)), /matrix report object/);
  const missing = matrix(); missing.runs.pop(); assert.throws(() => compareBalanceMatrices(missing, matrix(true)), /all 48/);
  const duplicate = matrix(); duplicate.runs[1] = clone(duplicate.runs[0]);
  assert.throws(() => compareBalanceMatrices(duplicate, matrix(true)), /duplicate matrix cell/);
  const wrongArm = matrix(); wrongArm.runs[0].variant = 'combined';
  assert.throws(() => compareBalanceMatrices(wrongArm, matrix(true)), /row and actual arm differ/);
  const flags = matrix(); flags.runs[0].data.encounter.weaponBalance.mechHeat = true;
  assert.throws(() => compareBalanceMatrices(flags, matrix(true)), /snapshot balance rules differ/);
});

test('source/version/protocol/input/fixture mismatches are rejected before comparison', () => {
  const source = matrix(); source.sourceFingerprint = `sha256:${'c'.repeat(64)}`;
  assert.throws(() => compareBalanceMatrices(source, matrix(true)), /run source differs/);
  const version = matrix(); version.encounterVersion = '';
  assert.throws(() => compareBalanceMatrices(version, matrix(true)), /encounter version/);
  const protocol = matrix(); protocol.runs[0].data.measurement.metadata.protocol = 'other-protocol';
  assert.throws(() => compareBalanceMatrices(protocol, matrix(true)), /protocol differs/);
  const input = matrix(); (input.runs[0].data.measurement.metadata.configuration as Record<string, unknown>).controls = 'other-route';
  assert.throws(() => compareBalanceMatrices(input, matrix(true)), /input policy/);
  const fixture = matrix(); fixture.runs[0].data.measurement.metadata.buildCodes.pilot = 'other-code';
  assert.throws(() => compareBalanceMatrices(fixture, matrix(true)), /workbench codes or equipment/);
  const equipment = matrix(); (equipment.runs[0].data.measurement.metadata.equipment as Record<string, unknown>).pilot = [];
  assert.throws(() => compareBalanceMatrices(equipment, matrix(true)), /workbench codes or equipment/);
});

test('tampered accounting and incompatible encounter budgets cannot hide in valid summary means', () => {
  const totals = matrix(); totals.runs[0].data.measurement.damage.total++;
  assert.throws(() => compareBalanceMatrices(totals, matrix(true)), /exactly reproduce/);
  const budget = matrix(); budget.runs[0].expectedVitality++;
  assert.throws(() => compareBalanceMatrices(budget, matrix(true)), /full encounter/);
  const failedBudget = matrix(false, () => 'failed'); failedBudget.runs[1].expectedVitality++;
  assert.throws(() => compareBalanceMatrices(failedBudget, matrix(true)), /budget differs between arms\/builds/);
});
