import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkbenchWeapon, normalizeWorkbenchConfig } from '../src/core/workbench.ts';
import { buildItemCard } from '../src/core/itemCard.ts';
import { BASELINE_WEAPON_BALANCE } from '../src/core/weaponBalance.ts';

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('cards show effective direct and per-proc damage while preserving chance, duration and saved stats', () => {
  const item = createWorkbenchWeapon(normalizeWorkbenchConfig({ projectile: 'scatter', element: 'shock', secondaryElement: 'fire' }));
  const before = structuredClone(item);
  const old = buildItemCard(item, undefined, BASELINE_WEAPON_BALANCE), current = buildItemCard(item);
  close(current.weapon!.damagePerPellet, item.stats.damage! * 0.85);
  close(current.weapon!.damagePerTrigger, old.weapon!.damagePerTrigger * 0.85);
  close(current.weapon!.burstDps.value, old.weapon!.burstDps.value * 0.85);
  close(current.weapon!.sustainedDps.value, old.weapon!.sustainedDps.value * 0.85);
  for (const [index, status] of current.statuses.entries()) {
    close(status.dps!, old.statuses[index].dps! * 0.85);
    assert.equal(status.chancePercent, old.statuses[index].chancePercent);
    assert.equal(status.duration, old.statuses[index].duration);
    assert.match(status.description, /15% secondary-element damage cost/);
  }
  assert.match(current.weapon!.burstDps.description, /15% secondary-element damage cost/);
  assert.doesNotMatch(old.weapon!.burstDps.description, /15% secondary-element damage cost/);
  assert.deepEqual(item, before);
});

test('comparison applies each weapon cost once and reports an actual single-channel damage advantage', () => {
  const config = normalizeWorkbenchConfig({ element: 'shock' });
  const single = createWorkbenchWeapon(config), dual = createWorkbenchWeapon({ ...config, secondaryElement: 'corrosive' });
  const singleCard = buildItemCard(single), comparison = buildItemCard(dual, single);
  close(comparison.stats.find(row => row.key === 'damage')!.delta!.amount, single.stats.damage! * -0.15);
  assert.equal(comparison.stats.find(row => row.key === 'damage')!.delta!.better, false);
  assert.equal(singleCard.weapon!.damagePerPellet, single.stats.damage);
  assert.doesNotMatch(singleCard.weapon!.burstDps.description, /secondary-element damage cost/);
  const same = buildItemCard(dual, structuredClone(dual));
  assert.equal(same.weapon!.burstDps.delta!.direction, 'equal');
  assert.ok(same.statuses.every(status => status.dpsDelta?.direction === 'equal'));
});

test('kinetic plus secondary control pays direct damage without inventing periodic damage or reducing control duration', () => {
  const item = createWorkbenchWeapon(normalizeWorkbenchConfig({ element: 'kinetic', secondaryElement: 'gravity' }));
  const card = buildItemCard(item), old = buildItemCard(item, undefined, BASELINE_WEAPON_BALANCE);
  close(card.weapon!.damagePerPellet, old.weapon!.damagePerPellet * 0.85);
  assert.deepEqual(card.statuses.map(status => status.dps), [null, null]);
  assert.equal(card.statuses[1].duration, old.statuses[1].duration);
  assert.equal(card.statuses[1].effect, old.statuses[1].effect);
});
