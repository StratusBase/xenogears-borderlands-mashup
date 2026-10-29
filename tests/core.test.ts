import assert from 'node:assert/strict';
import test from 'node:test';
import { checkZoneAccess, createProgression, deserializeProgression, equipItem, getStats, rollItem, seededRandom, sellItem, serializeProgression } from '../src/core/index.ts';

test('seeded rolls produce reproducible stats across both scales and every slot', () => {
  const first = seededRandom(382);
  const second = seededRandom(382);
  for (const mode of ['pilot', 'mech'] as const) {
    for (const slot of ['weapon', 'shield', 'reactor', 'legs'] as const) {
      for (let index = 0; index < 100; index++) {
        const a = rollItem(mode, 1 + index, first, slot);
        const b = rollItem(mode, 1 + index, second, slot);
        assert.deepEqual({ ...a, id: '' }, { ...b, id: '' });
        assert.ok(Object.values(a.stats).every(stat => Number.isFinite(stat) && stat > 0));
      }
    }
  }
});

test('rarity boundaries and untrusted random inputs stay within valid tiers', () => {
  for (const [draw, tier] of [[0, 'common'], [0.45999, 'common'], [0.46, 'uncommon'], [0.73, 'rare'], [0.89, 'epic'], [0.975, 'legendary'], [1, 'legendary']] as const) {
    assert.equal(rollItem('pilot', 1, () => draw, 'weapon').rarity, tier);
  }
  assert.equal(rollItem('mech', Infinity, () => NaN).level, 1);
  assert.equal(rollItem('mech', -4, () => -1).level, 1);
  assert.equal(rollItem('mech', 1000, () => 1).level, 100);
});

test('mech and pilot have distinct combat statistics and independently equipped slots', () => {
  const state = createProgression();
  const originalPilot = getStats(state, 'pilot');
  const originalMech = getStats(state, 'mech');
  assert.ok(originalMech.damage > originalPilot.damage * 2);
  assert.ok(originalPilot.fireRate > originalMech.fireRate * 2);
  assert.ok(originalMech.maxHealth > originalPilot.maxHealth * 3);
  const upgrade = rollItem('mech', 10, () => 0.99, 'reactor');
  state.inventory.push(upgrade);
  assert.equal(equipItem(state, upgrade.id), true);
  assert.ok(getStats(state, 'mech').heatCapacity > originalMech.heatCapacity);
  assert.deepEqual(getStats(state, 'pilot'), originalPilot);
  assert.equal(equipItem(state, 'missing'), false);
});

test('named weapon affixes change practical behavior', () => {
  const make = (last: number) => {
    const values = [0.8, 0.5, 0.5, 0.5, 0.5, last];
    return rollItem('pilot', 1, () => values.shift() ?? 0, 'weapon');
  };
  const heavy = make(0);
  const rapid = make(0.4);
  const quickdraw = make(0.9);
  assert.equal(heavy.affix, 'Heavy');
  assert.equal(rapid.affix, 'Rapid');
  assert.equal(quickdraw.affix, 'Quickdraw');
  assert.ok(heavy.stats.damage! > rapid.stats.damage!);
  assert.ok(rapid.stats.fireRate! > heavy.stats.fireRate!);
  assert.ok(quickdraw.stats.reload! < heavy.stats.reload!);
});

test('selling cannot remove equipped equipment; replacing it makes the old part sellable', () => {
  const state = createProgression();
  const original = state.loadouts.pilot.weapon!;
  assert.equal(sellItem(state, original), false);
  const item = rollItem('pilot', 2, seededRandom(42), 'weapon');
  state.inventory.push(item);
  equipItem(state, item.id);
  const value = state.inventory.find(candidate => candidate.id === original)!.value;
  assert.equal(sellItem(state, original), true);
  assert.equal(state.credits, value);
  assert.equal(state.inventory.some(candidate => candidate.id === original), false);
  assert.equal(sellItem(state, original), false);
});

test('complete starter state and generated items round-trip safely', () => {
  const state = createProgression();
  for (let i = 0; i < 100; i++) state.inventory.push(rollItem(i % 2 ? 'mech' : 'pilot', i + 1, seededRandom(i)));
  assert.deepEqual(deserializeProgression(serializeProgression(state)), state);
});

test('save loader rejects corruption, invalid cross references, duplicates, and unsafe stats', () => {
  assert.equal(deserializeProgression(null), null);
  assert.equal(deserializeProgression('{broken'), null);
  assert.equal(deserializeProgression('null'), null);
  assert.equal(deserializeProgression('{"version":2}'), null);
  for (const mutate of [
    (state: any) => state.inventory.push(state.inventory[0]),
    (state: any) => state.inventory[0].stats.damage = -5,
    (state: any) => state.inventory[0].stats.damage = '20',
    (state: any) => state.inventory[0].stats.magazine = 1.5,
    (state: any) => state.loadouts.pilot.weapon = state.loadouts.mech.weapon,
    (state: any) => state.loadouts.pilot.weapon = 'missing',
    (state: any) => state.credits = -1,
    (state: any) => state.wave = 0,
  ]) {
    const state = createProgression();
    mutate(state);
    assert.equal(deserializeProgression(serializeProgression(state)), null);
  }
  const unknownStat = serializeProgression(createProgression()).replace('"damage":20', '"__proto__":20,"damage":20');
  assert.equal(deserializeProgression(unknownStat), null);
});

test('zone rules accept both forms only in shared areas', () => {
  assert.equal(checkZoneAccess('pilot', 'both'), true);
  assert.equal(checkZoneAccess('mech', 'both'), true);
  assert.equal(checkZoneAccess('pilot', 'pilot'), true);
  assert.equal(checkZoneAccess('mech', 'mech'), true);
  assert.equal(checkZoneAccess('pilot', 'mech'), false);
  assert.equal(checkZoneAccess('mech', 'pilot'), false);
});
