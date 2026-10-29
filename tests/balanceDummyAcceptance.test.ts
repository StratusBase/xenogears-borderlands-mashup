import assert from 'node:assert/strict';
import test from 'node:test';
import { createEvaluationFixture } from '../src/diagnostics/fixtures.ts';
import { BALANCE_VARIANTS } from '../src/diagnostics/balanceVariants.ts';
import { simulateDummy } from '../src/diagnostics/dummySimulation.ts';
import { getStats } from '../src/core/index.ts';
import { dummyHeatTiming } from '../scripts/evaluateBalanceDummy.ts';

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 1e-8 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);

test('actual dummy direct/status damage scales once between paired arms without resource or timing changes', () => {
  const fixture = createEvaluationFixture('elemental-pressure');
  for (const mode of ['pilot', 'mech'] as const) for (const [before, after] of [['baseline', 'secondary-only'], ['heat-only', 'combined']] as const) {
    const a = simulateDummy({ state: fixture.state, mode, seed: 7, balanceRules: BALANCE_VARIANTS[before] });
    const b = simulateDummy({ state: fixture.state, mode, seed: 7, balanceRules: BALANCE_VARIANTS[after] });
    close(b.totalDamage, a.totalDamage * 0.85); close(b.directDamage, a.directDamage * 0.85); close(b.statusDamage, a.statusDamage * 0.85);
    assert.equal(b.shots, a.shots); close(b.heatBlockedSeconds, a.heatBlockedSeconds); close(b.reloadSeconds, a.reloadSeconds);
    assert.deepEqual(b.events.filter(event => event.type === 'shot' || event.type === 'interval'), a.events.filter(event => event.type === 'shot' || event.type === 'interval'));
  }
});

test('pilot heat-only and slow precision mech shots replay unchanged on the actual dummy', () => {
  for (const [id, mode] of [['elemental-pressure', 'pilot'], ['mobile-precision', 'mech']] as const) {
    const state = createEvaluationFixture(id).state;
    const baseline = simulateDummy({ state, mode, seed: 41, balanceRules: BALANCE_VARIANTS.baseline });
    const heat = simulateDummy({ state, mode, seed: 41, balanceRules: BALANCE_VARIANTS['heat-only'] });
    assert.deepEqual(heat, baseline);
  }
});

test('combined pressure mech meets the specified no-vent thermal acceptance on real firing geometry', () => {
  const result = simulateDummy({ state: createEvaluationFixture('elemental-pressure').state, mode: 'mech', seed: 7, balanceRules: BALANCE_VARIANTS.combined });
  assert.ok(result.shots >= 60 && result.shots <= 75, `shots ${result.shots}`);
  assert.ok(result.heatBlockedSeconds >= 15 && result.heatBlockedSeconds <= 19, `heat block ${result.heatBlockedSeconds}`);
  assert.ok(dummyHeatTiming(result.events).longestHeatLockSeconds <= 2.6);
  assert.ok(result.statusDamage > 0, 'real procs and delayed ticks remain in the sample');
});

test('cooling and capacity retain distinct sustained and first-burst advantages', () => {
  const cooling = createEvaluationFixture('elemental-pressure', { reactorBrand: 'cindergrid' });
  const capacity = createEvaluationFixture('elemental-pressure', { reactorBrand: 'nullward' });
  const a = simulateDummy({ state: cooling.state, mode: 'mech', seed: 8, duration: 90, balanceRules: BALANCE_VARIANTS.combined });
  const b = simulateDummy({ state: capacity.state, mode: 'mech', seed: 8, duration: 90, balanceRules: BALANCE_VARIANTS.combined });
  assert.ok(a.shots > b.shots, `cooling ${a.shots}, capacity ${b.shots}`);
  const normal = createEvaluationFixture('elemental-pressure'), larger = createEvaluationFixture('elemental-pressure');
  const beforeStats = getStats(normal.state, 'mech');
  larger.equipment.mech.find(item => item.slot === 'reactor')!.stats.heatCapacity! += beforeStats.heatCapacity * 0.1;
  assert.equal(getStats(larger.state, 'mech').cooling, beforeStats.cooling);
  const first = dummyHeatTiming(simulateDummy({ state: normal.state, mode: 'mech', seed: 8, duration: 5, balanceRules: BALANCE_VARIANTS.combined }).events);
  const second = dummyHeatTiming(simulateDummy({ state: larger.state, mode: 'mech', seed: 8, duration: 5, balanceRules: BALANCE_VARIANTS.combined }).events);
  assert.ok(second.firstBurstShots > first.firstBurstShots);
  assert.ok(second.firstOverheatAt! > first.firstOverheatAt!);
});
