import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CombatMeasurement, MEASUREMENT_TARGET_LIMIT, type MeasurementEvent, type MeasurementMetadata } from '../src/diagnostics/measurement.ts';

const metadata = (scenario: 'dummy' | 'encounter' = 'encounter'): MeasurementMetadata => ({
  runId: 'pressure-seed-17', scenario, provenance: 'simulated', seed: 17,
  buildId: 'elemental-pressure', buildCodes: { pilot: 'WS1:fixture-pilot', mech: 'WS1:fixture-mech' },
  configuration: { version: 1, fixedStep: 1 / 60, targets: ['shielded'] },
  equipment: { pilot: { shield: { maxShield: 65 } }, mech: { cooling: 30 } },
  sourceFingerprint: 'fixture-source-v1', protocol: 'measurement-fixture-v1',
});

test('practical damage, resources, and two target TTK clocks use actual event amounts', () => {
  const meter = new CombatMeasurement(metadata());
  const events: MeasurementEvent[] = [
    { type: 'target-spawn', at: 0, targetId: 'heavy', health: 100, shield: 50 },
    { type: 'shot', at: 2, mode: 'pilot', ammo: 1 },
    { type: 'damage', at: 2, target: 'enemy', targetId: 'heavy', health: 10, shield: 50, source: 'direct', critical: true },
    { type: 'interval', at: 3, dt: 3, heatBlocked: false, reloading: true },
    { type: 'received', at: 3, health: 4, shield: 25 },
    { type: 'shot', at: 4, mode: 'mech', ammo: 2 },
    { type: 'damage', at: 4, target: 'enemy', targetId: 'heavy', health: 30, shield: 0, source: 'status', critical: true },
    { type: 'damage', at: 5, target: 'enemy', targetId: 'heavy', health: 60, shield: 0, source: 'ability' },
    { type: 'target-killed', at: 5, targetId: 'heavy' },
    { type: 'interval', at: 5, dt: 2, heatBlocked: true, reloading: false },
    { type: 'finish', at: 6, outcome: 'complete' },
  ];
  for (const event of events) assert.equal(meter.record(event), true, event.type);
  const snapshot = meter.snapshot();
  assert.deepEqual(snapshot.damage, { total: 150, health: 100, shield: 50, direct: 60, status: 30, ability: 60, critical: 60 });
  assert.equal(snapshot.practicalDps, 25);
  assert.equal(snapshot.duration, 6);
  assert.deepEqual(snapshot.received, { health: 4, shield: 25, total: 29 });
  assert.deepEqual(snapshot.shots, { pilot: 1, mech: 1, total: 2 });
  assert.deepEqual(snapshot.ammo, { pilot: 1, mech: 2, total: 3 });
  assert.equal(snapshot.heatBlockedSeconds, 2);
  assert.equal(snapshot.reloadSeconds, 3);
  assert.deepEqual(snapshot.targets, [{ targetId: 'heavy', spawnedAt: 0, firstDamageAt: 2,
    killedAt: 5, damage: 150, ttkFromSpawn: 5, ttkFromFirstDamage: 3 }]);
  assert.equal(snapshot.kills, 1);
  assert.equal(snapshot.outcome, 'complete');
});

test('dummy and encounter damage stay separate and an immortal dummy never acquires a TTK', () => {
  const dummy = new CombatMeasurement(metadata('dummy'));
  assert.equal(dummy.record({ type: 'target-spawn', at: 0, targetId: 'dummy', health: 0, shield: 0 }), true);
  assert.equal(dummy.record({ type: 'damage', at: 1, target: 'enemy', targetId: 'heavy', health: 999, shield: 0, source: 'direct' }), false);
  assert.equal(dummy.record({ type: 'damage', at: 1, target: 'dummy', targetId: 'dummy', health: 100_000, shield: 0, source: 'direct' }), true);
  assert.equal(dummy.record({ type: 'target-killed', at: 1, targetId: 'dummy' }), false);
  assert.equal(dummy.record({ type: 'finish', at: 10, outcome: 'timeout' }), true);
  assert.equal(dummy.snapshot().damage.total, 100_000);
  assert.equal(dummy.snapshot().practicalDps, 10_000);
  assert.equal(dummy.snapshot().targets[0]!.ttkFromSpawn, null);
  assert.equal(dummy.snapshot().targets[0]!.ttkFromFirstDamage, null);
  assert.equal(dummy.snapshot().kills, 0);
  const encounter = new CombatMeasurement(metadata());
  assert.equal(encounter.record({ type: 'damage', at: 1, target: 'dummy', targetId: 'dummy', health: 100, shield: 0, source: 'direct' }), false);
  assert.equal(encounter.snapshot().damage.total, 0);
});

test('invalid values, rewound time, overlapping intervals, and duplicate deaths cannot inflate evidence', () => {
  const meter = new CombatMeasurement(metadata());
  meter.record({ type: 'target-spawn', at: 0, targetId: 'target', health: 20, shield: 0 });
  meter.record({ type: 'interval', at: 2, dt: 2, heatBlocked: true, reloading: false });
  const before = meter.snapshot();
  const bad: unknown[] = [
    null,
    { type: 'unknown', at: 2 },
    { type: 'received', at: 1, health: 4, shield: 0 },
    { type: 'received', at: 3, health: -1, shield: 0 },
    { type: 'received', at: Infinity, health: 4, shield: 0 },
    { type: 'damage', at: 3, target: 'enemy', targetId: 'target', health: NaN, shield: 0, source: 'direct' },
    { type: 'damage', at: 3, target: 'enemy', targetId: 'target', health: 4, shield: 0, source: 'invalid' },
    { type: 'damage', at: 3, target: 'enemy', targetId: 'target', health: 4, shield: 0, source: 'direct', critical: 1 },
    { type: 'shot', at: 3, mode: 'pilot', ammo: 0.5 },
    { type: 'shot', at: 3, mode: 'invalid', ammo: 1 },
    { type: 'interval', at: 3, dt: 2, heatBlocked: true, reloading: false },
    { type: 'interval', at: 3, dt: 4, heatBlocked: false, reloading: false },
    { type: 'interval', at: 3, dt: 1, heatBlocked: 1, reloading: false },
    { type: 'target-spawn', at: 3, targetId: 'target', health: 20, shield: 0 },
    { type: 'finish', at: 3, outcome: 'victory' },
  ];
  for (const event of bad) assert.equal(meter.record(event as MeasurementEvent), false);
  const after = meter.snapshot();
  assert.equal(after.rejectedEvents, bad.length);
  assert.deepEqual({ ...after, rejectedEvents: 0 }, before);
  assert.equal(meter.record({ type: 'damage', at: 3, target: 'enemy', targetId: 'target', health: 20, shield: 0, source: 'direct' }), true);
  assert.equal(meter.record({ type: 'target-killed', at: 3, targetId: 'target' }), true);
  assert.equal(meter.record({ type: 'target-killed', at: 3, targetId: 'target' }), false);
  assert.equal(meter.record({ type: 'damage', at: 3, target: 'enemy', targetId: 'target', health: 20, shield: 0, source: 'direct' }), false);
  assert.equal(meter.snapshot().kills, 1);
  assert.equal(meter.snapshot().damage.total, 20);
});

test('zero-time, surviving targets, and absent spawn data retain honest null TTKs', () => {
  const meter = new CombatMeasurement(metadata());
  meter.record({ type: 'damage', at: 0, target: 'enemy', targetId: 'late-hook', health: 5, shield: 0, source: 'status' });
  assert.equal(meter.snapshot().practicalDps, 0);
  meter.record({ type: 'target-killed', at: 2, targetId: 'late-hook' });
  meter.record({ type: 'target-spawn', at: 2, targetId: 'survivor', health: 100, shield: 0 });
  meter.record({ type: 'finish', at: 10, outcome: 'failed' });
  const [late, survivor] = meter.snapshot().targets;
  assert.equal(late!.ttkFromSpawn, null);
  assert.equal(late!.ttkFromFirstDamage, 2);
  assert.equal(survivor!.ttkFromSpawn, null);
  assert.equal(survivor!.ttkFromFirstDamage, null);
  assert.equal(meter.snapshot().outcome, 'failed');
});

test('equipment/config metadata and returned evidence are detached and serialization is deterministic', () => {
  const input = metadata();
  const meter = new CombatMeasurement(input);
  input.buildCodes.pilot = 'changed';
  (input.configuration as { version: number }).version = 999;
  const first = meter.snapshot();
  first.metadata.buildCodes.pilot = 'changed again';
  first.damage.total = 999;
  assert.equal(meter.snapshot().metadata.buildCodes.pilot, 'WS1:fixture-pilot');
  assert.deepEqual(meter.snapshot().metadata.configuration, { version: 1, fixedStep: 1 / 60, targets: ['shielded'] });
  assert.equal(meter.snapshot().damage.total, 0);
  assert.equal(JSON.stringify(meter), JSON.stringify(meter));
  assert.equal(JSON.stringify(meter), JSON.stringify(meter.snapshot()));
  for (const invalid of [NaN, -1, 1.5, 0x1_0000_0000]) assert.throws(() => new CombatMeasurement({ ...metadata(), seed: invalid }), TypeError);
  assert.throws(() => new CombatMeasurement({ ...metadata(), equipment: { invalid: NaN } }), TypeError);
  assert.throws(() => new CombatMeasurement({ ...metadata(), protocol: '' }), TypeError);
});

test('no raw event history grows, target storage is bounded, and finishing freezes measured values', () => {
  const meter = new CombatMeasurement(metadata());
  for (let index = 0; index < MEASUREMENT_TARGET_LIMIT; index++) {
    assert.equal(meter.record({ type: 'target-spawn', at: 0, targetId: `target-${index}`, health: 1, shield: 0 }), true);
  }
  assert.equal(meter.record({ type: 'target-spawn', at: 0, targetId: 'overflow', health: 1, shield: 0 }), false);
  assert.equal(meter.record({ type: 'damage', at: 0, target: 'enemy', targetId: 'overflow', health: 1, shield: 0, source: 'direct' }), false);
  for (let index = 0; index < 10_000; index++) meter.record({ type: 'shot', at: 0, mode: 'pilot', ammo: 1 });
  assert.equal(meter.snapshot().targets.length, MEASUREMENT_TARGET_LIMIT);
  assert.equal(meter.snapshot().ammo.total, 10_000);
  assert.equal(meter.record({ type: 'finish', at: 60, outcome: 'aborted' }), true);
  const before = meter.snapshot();
  assert.equal(meter.record({ type: 'shot', at: 61, mode: 'pilot', ammo: 1 }), false);
  assert.equal(meter.record({ type: 'finish', at: 62, outcome: 'complete' }), false);
  assert.deepEqual({ ...meter.snapshot(), rejectedEvents: before.rejectedEvents }, before);
});

test('overflow cannot turn finite damage or resource totals into unsafe values', () => {
  const meter = new CombatMeasurement(metadata());
  const max = Number.MAX_SAFE_INTEGER;
  assert.equal(meter.record({ type: 'damage', at: 1, target: 'enemy', targetId: 'x', health: max, shield: 0, source: 'direct' }), true);
  assert.equal(meter.record({ type: 'damage', at: 1, target: 'enemy', targetId: 'x', health: 1, shield: 0, source: 'direct' }), false);
  assert.equal(meter.record({ type: 'received', at: 1, health: max, shield: 0 }), true);
  assert.equal(meter.record({ type: 'received', at: 1, health: 0, shield: 1 }), false);
  assert.equal(meter.record({ type: 'shot', at: 1, mode: 'mech', ammo: max }), true);
  assert.equal(meter.record({ type: 'shot', at: 1, mode: 'mech', ammo: 1 }), false);
  assert.equal(meter.snapshot().damage.total, max);
  assert.equal(meter.snapshot().received.total, max);
  assert.equal(meter.snapshot().ammo.total, max);
});
