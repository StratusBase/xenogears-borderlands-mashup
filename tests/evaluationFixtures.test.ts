import assert from 'node:assert/strict';
import test from 'node:test';
import { createEvaluationFixture, EVALUATION_BUILDS } from '../src/diagnostics/fixtures.ts';
import { createWorkbenchWeapon, parseWorkbenchCode } from '../src/core/workbench.ts';

test('all three fixtures reproduce exact weapons, equipped gear, IDs and state', () => {
  for (const { id } of EVALUATION_BUILDS) {
    const a = createEvaluationFixture(id), b = createEvaluationFixture(id);
    assert.deepEqual(a, b);
    for (const mode of ['pilot', 'mech'] as const) {
      const config = parseWorkbenchCode(a.codes[mode]);
      assert.ok(config);
      assert.deepEqual(createWorkbenchWeapon(config), a.equipment[mode][0]);
      assert.equal(Object.keys(a.state.loadouts[mode]).length, 4);
      assert.equal(config.guaranteedStatus, false);
      assert.equal(config.level, 5);
      assert.equal(config.rarity, 'rare');
    }
  }
});

test('reactor comparison holds weapons and all other equipment fixed', () => {
  const a = createEvaluationFixture('elemental-pressure', { reactorBrand: 'cindergrid' });
  const b = createEvaluationFixture('elemental-pressure', { reactorBrand: 'nullward' });
  assert.deepEqual(a.codes, b.codes);
  for (const mode of ['pilot', 'mech'] as const) {
    assert.deepEqual(a.equipment[mode].filter(i => i.slot !== 'reactor'), b.equipment[mode].filter(i => i.slot !== 'reactor'));
    assert.ok(a.stats[mode].cooling > b.stats[mode].cooling);
    assert.ok(a.stats[mode].heatCapacity < b.stats[mode].heatCapacity);
  }
});

test('mobile equipment trades health and shields for actual movement speed', () => {
  const mobile = createEvaluationFixture('mobile-precision');
  const armored = createEvaluationFixture('mobile-precision', { equipmentBrand: 'ironvale' });
  assert.deepEqual(mobile.codes, armored.codes);
  for (const mode of ['pilot', 'mech'] as const) {
    assert.ok(mobile.stats[mode].moveSpeed > armored.stats[mode].moveSpeed);
    assert.ok(mobile.stats[mode].maxHealth < armored.stats[mode].maxHealth);
    assert.ok(mobile.stats[mode].maxShield < armored.stats[mode].maxShield);
  }
});

test('legs-only comparison holds shield, reactor and weapon fixed', () => {
  const a = createEvaluationFixture('mobile-precision');
  const b = createEvaluationFixture('mobile-precision', { legsBrand: 'ironvale' });
  for (const mode of ['pilot', 'mech'] as const) {
    assert.deepEqual(a.equipment[mode].filter(item => item.slot !== 'legs'), b.equipment[mode].filter(item => item.slot !== 'legs'));
    assert.equal(a.stats[mode].maxShield, b.stats[mode].maxShield);
    assert.ok(a.stats[mode].moveSpeed > b.stats[mode].moveSpeed);
    assert.ok(a.stats[mode].maxHealth < b.stats[mode].maxHealth);
  }
});
