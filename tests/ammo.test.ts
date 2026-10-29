import test from 'node:test';
import assert from 'node:assert/strict';
import { ammoReserveCapacity, fitMagazine, reloadAmmo } from '../src/core/ammo';

test('reload conserves rounds, including a partial final magazine', () => {
  assert.deepEqual(reloadAmmo(7, 100, 30), { ammo: 30, reserve: 77, loaded: 23 });
  assert.deepEqual(reloadAmmo(0, 8, 30), { ammo: 8, reserve: 0, loaded: 8 });
  assert.deepEqual(reloadAmmo(0, 0, 30), { ammo: 0, reserve: 0, loaded: 0 });
  assert.deepEqual(reloadAmmo(30, 25, 30), { ammo: 30, reserve: 25, loaded: 0 });
});

test('reserve capacities accommodate both normal and large rolled magazines', () => {
  assert.equal(ammoReserveCapacity('pilot', 30), 240);
  assert.equal(ammoReserveCapacity('mech', 12), 96);
  assert.equal(ammoReserveCapacity('pilot', 100), 800);
});

test('equipping a smaller magazine never discards purchased reserve or loaded rounds', () => {
  assert.deepEqual(fitMagazine(40, 320, 30), { ammo: 30, reserve: 330 });
  assert.deepEqual(fitMagazine(40, 240, 30), { ammo: 30, reserve: 250 });
  assert.deepEqual(fitMagazine(12, 30, 40), { ammo: 12, reserve: 30 });
});
