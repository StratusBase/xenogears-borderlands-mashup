import assert from 'node:assert/strict';
import test from 'node:test';
import { CombatMeasurement, type MeasurementEvent, type MeasurementOutcome } from '../src/diagnostics/measurement.ts';
import { BALANCE_VARIANTS, validateBalanceEvidence, type BalanceVariant } from '../scripts/serveBalanceMatrix.ts';
import { assertSnapshotBalanceRules } from '../scripts/summarizeBalanceMatrix.ts';

function evidence(variant: BalanceVariant = 'combined', outcome: MeasurementOutcome = 'complete') {
  const sourceFingerprint = `sha256:${'a'.repeat(64)}`;
  const recorder = new CombatMeasurement({ runId: 'transport-validation', scenario: 'encounter', provenance: 'simulated', seed: 7,
    buildId: 'mobile-precision', buildCodes: { pilot: 'fixture-pilot', mech: 'fixture-mech' }, equipment: {}, sourceFingerprint,
    configuration: { balanceVariant: variant, balanceRules: BALANCE_VARIANTS[variant] }, protocol: 'transport-test' });
  const events: MeasurementEvent[] = [
    { type: 'target-spawn', at: 0, targetId: 'enemy-1', health: 100, shield: 0 },
    { type: 'shot', at: 0.2, mode: 'pilot', ammo: 1 },
    { type: 'damage', at: 0.3, targetId: 'enemy-1', target: 'enemy', health: 100, shield: 0, source: 'direct' },
    { type: 'target-killed', at: 0.3, targetId: 'enemy-1' },
    { type: 'finish', at: 1, outcome },
  ];
  for (const event of events) assert.equal(recorder.record(event), true);
  return { measurement: recorder.snapshot(), events, droppedTraceEvents: 0, hardwareStatus: 'NOT RUN', sourceFingerprint, encounter: {} };
}

test('all four matrix arms retain explicit rules and permit failed attempts as evidence', () => {
  for (const variant of Object.keys(BALANCE_VARIANTS) as BalanceVariant[]) {
    for (const outcome of ['complete', 'failed', 'timeout', 'aborted'] as const) {
      const value = evidence(variant, outcome);
      assert.deepEqual(validateBalanceEvidence(value), { variant, build: 'mobile-precision', seed: 7, hash: 'a'.repeat(64) });
    }
  }
});

test('mislabelled rule arms, source versions and hardware claims cannot enter the matrix', () => {
  const rules = evidence('baseline');
  (rules.measurement.metadata.configuration as Record<string, unknown>).balanceRules = { secondaryElementCost: true, mechHeat: true };
  assert.throws(() => validateBalanceEvidence(rules), /rules differ/);
  const source = evidence(); source.sourceFingerprint = `sha256:${'b'.repeat(64)}`;
  assert.throws(() => validateBalanceEvidence(source), /fingerprint/);
  const hardware = evidence(); hardware.hardwareStatus = 'PASSED';
  assert.throws(() => validateBalanceEvidence(hardware), /hardware NOT RUN/);
});

test('tampered totals, invalid events and trace truncation are rejected instead of silently repaired', () => {
  const totals = evidence(); totals.measurement.damage.total++;
  assert.throws(() => validateBalanceEvidence(totals), /exactly reproduce/);
  const invalid = evidence(); invalid.events.splice(1, 0, { type: 'shot', at: -1, mode: 'pilot', ammo: 1 });
  assert.throws(() => validateBalanceEvidence(invalid), /exactly reproduce/);
  const dropped = evidence(); dropped.droppedTraceEvents = 1;
  assert.throws(() => validateBalanceEvidence(dropped), /invalid\/dropped/);
});

test('the actual game snapshot must attest the declared rules for every outcome, including failures', () => {
  for (const variant of Object.keys(BALANCE_VARIANTS) as BalanceVariant[]) {
    for (const outcome of ['complete', 'failed', 'timeout', 'aborted'] as const) {
      const value = evidence(variant, outcome);
      value.encounter = { weaponBalance: { ...BALANCE_VARIANTS[variant] } };
      const checked = validateBalanceEvidence(value);
      assert.doesNotThrow(() => assertSnapshotBalanceRules(value.encounter, checked.variant));
      assert.throws(() => assertSnapshotBalanceRules({ weaponBalance: { ...BALANCE_VARIANTS[variant], mechHeat: !BALANCE_VARIANTS[variant].mechHeat } }, checked.variant), /snapshot balance rules differ/);
      assert.throws(() => assertSnapshotBalanceRules({}, checked.variant), /snapshot balance rules differ/);
    }
  }
});
