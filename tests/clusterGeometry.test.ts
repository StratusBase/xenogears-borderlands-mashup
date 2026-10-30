import assert from 'node:assert/strict';
import test from 'node:test';
import { runGeometryCell } from '../scripts/evaluateClusterGeometry.ts';

// Real-floor behavioral bounds guard useful splash delivery at distance. They deliberately avoid
// asserting a particular cone, radius, fuse, or child count used to achieve it.
test('MIRV retains useful group coverage while its close splash stays inside one trigger budget', () => {
  for (const mode of ['pilot', 'mech'] as const) {
    const [close, medium, distant] = [19, 30, 40].map(distance => runGeometryCell({ projectile: 'cluster', mode, distance, layout: 'compact' }));
    for (const shot of close.perTrigger) {
      assert.ok(shot.centerDamage >= shot.triggerBudget * .55, `${mode}: a close hit must retain useful center damage after physical scatter/falloff`);
      assert.ok(shot.centerDamage <= shot.triggerBudget + 1e-7, `${mode}: parent plus bomblets cannot exceed one trigger budget on the center`);
      assert.equal(shot.criticalHitFlags, 0, 'MIRV splash cannot gain a direct headshot multiplier');
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
