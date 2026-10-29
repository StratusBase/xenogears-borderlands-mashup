import assert from 'node:assert/strict';
import test from 'node:test';
import { runGeometryCell } from '../scripts/evaluateClusterGeometry.ts';

// Behavioral floors guard useful delivery at distance. They deliberately avoid
// asserting a particular cone, radius, fuse, or child count used to achieve it.
test('cluster retains useful group damage at 30m and 40m without losing its close contact budget', () => {
  for (const mode of ['pilot', 'mech'] as const) {
    const [close, medium, distant] = [19, 30, 40].map(distance => runGeometryCell({ projectile: 'cluster', mode, distance, layout: 'compact' }));
    for (const shot of close.perTrigger) {
      assert.ok(Math.abs(shot.centerDamage - shot.triggerBudget) < 1e-7, `${mode}: a close contact must deliver one carrier budget to the real center mesh`);
    }
    assert.ok(medium.damageBudgetRatio >= close.damageBudgetRatio * .8, `${mode}: 30m compact group must retain at least 80% of close group delivery`);
    assert.ok(distant.damageBudgetRatio >= close.damageBudgetRatio * .5, `${mode}: 40m compact group must retain at least half of close group delivery`);
    assert.ok(distant.damageBudgetRatio >= 1, `${mode}: a 40m compact group must receive at least one trigger budget across its three targets`);
    for (const result of [close, medium, distant]) assert.equal(result.pendingProjectiles, 0, `${mode}/${result.distance}: every child must finish within its travel/fuse limits`);
  }
});

test('cluster range improvements cannot damage side peers through physical thin cover', () => {
  for (const mode of ['pilot', 'mech'] as const) for (const distance of [19, 30, 40]) {
    const result = runGeometryCell({ projectile: 'cluster', mode, distance, layout: 'covered' });
    assert.ok(result.totalCenterDamage > 0, `${mode}/${distance}: the exposed center lane must actually be struck`);
    assert.equal(result.totalPeerDamage, 0, `${mode}/${distance}: covered side targets must remain protected`);
    for (const shot of result.perTrigger) assert.deepEqual(shot.peerDamage, [0, 0], `${mode}/${distance}: no individual trigger may bypass cover`);
    assert.equal(result.pendingProjectiles, 0);
  }
});
