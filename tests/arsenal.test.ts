import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBrandModifiers, brandList, brands, createWeaponSpec, elementLabels, getWeaponSpec, normalizeWeaponSpec, projectileLabels, type ElementType, type ProjectileType } from '../src/core/arsenal.ts';
import { createProgression, deserializeProgression, equipItem, getStats, rollItem, seededRandom, serializeProgression, type Stats } from '../src/core/index.ts';
import { describeItemAppearance } from '../src/core/appearance.ts';
import { getDamageColor } from '../src/core/feedback.ts';

test('generated equipment carries valid branded metadata, and weapon pools cover every supported delivery and element', () => {
  const random = seededRandom(84021);
  const projectiles = new Set<string>(), elements = new Set<string>(), seenBrands = new Set<string>();
  for (const brand of brandList) {
    for (const mode of ['pilot', 'mech'] as const) {
      for (const slot of ['weapon', 'shield', 'reactor', 'legs'] as const) {
        for (let index = 0; index < 60; index++) {
          const item = rollItem(mode, 1 + index, random, slot, { brand: brand.id });
          assert.equal(item.brand, brand.id);
          seenBrands.add(item.brand);
          assert.ok(Object.values(item.stats).every(value => Number.isFinite(value) && value > 0));
          if (slot === 'weapon') {
            assert.ok(item.weapon);
            assert.deepEqual(normalizeWeaponSpec(item.weapon, mode), item.weapon);
            projectiles.add(item.weapon.projectile); elements.add(item.weapon.element);
          } else assert.equal(item.weapon, undefined);
        }
      }
    }
  }
  assert.deepEqual([...seenBrands].sort(), brandList.map(brand => brand.id).sort());
  assert.deepEqual([...projectiles].sort(), Object.keys(projectileLabels).sort());
  assert.deepEqual([...elements].sort(), Object.keys(elementLabels).sort());
});

test('brand traits modify real combat values for every equipment slot without mutating their input', () => {
  const base: Stats = { damage: 20, fireRate: 5, magazine: 30, reload: 1.5, maxHealth: 50, maxShield: 100, moveSpeed: 1, heatCapacity: 50, cooling: 10 };
  for (const brand of brandList) {
    for (const slot of ['weapon', 'shield', 'reactor', 'legs'] as const) {
      assert.notDeepEqual(applyBrandModifiers(base, brand.id, slot), base, `${brand.name} ${slot} must have actual statistical traits`);
    }
  }
  assert.equal(base.damage, 20);
  const heavy = applyBrandModifiers(base, 'ironvale', 'weapon');
  const fast = applyBrandModifiers(base, 'kestrel', 'weapon');
  assert.ok(heavy.damage! > fast.damage! && heavy.fireRate! < fast.fireRate!);
  const state = createProgression();
  const before = getStats(state, 'mech');
  const item = rollItem('mech', 1, () => 0, 'shield', { brand: 'nullward' });
  state.inventory.push(item); equipItem(state, item.id);
  assert.notEqual(getStats(state, 'mech').maxShield, before.maxShield);
  assert.deepEqual(getStats(deserializeProgression(serializeProgression(state))!, 'mech'), getStats(state, 'mech'), 'Saved brand modifiers must not apply twice');
});

test('explicit weapon fixtures bake the requested brand and profile, including balanced per-pellet scatter damage', () => {
  for (const projectile of Object.keys(projectileLabels) as ProjectileType[]) {
    for (const element of Object.keys(elementLabels) as ElementType[]) {
      const requested = createWeaponSpec(projectile, element, 'pilot');
      const item = rollItem('pilot', 2, seededRandom(2), 'weapon', { brand: 'prism', weapon: requested });
      assert.equal(item.brand, 'prism');
      assert.deepEqual(item.weapon, requested);
    }
  }
  const bullet = rollItem('pilot', 1, () => 0, 'weapon', { brand: 'ironvale', weapon: createWeaponSpec('bullet', 'kinetic') });
  const scatter = rollItem('pilot', 1, () => 0, 'weapon', { brand: 'ironvale', weapon: createWeaponSpec('scatter', 'kinetic') });
  const totalPelletDamage = scatter.stats.damage! * scatter.weapon!.pellets;
  assert.ok(totalPelletDamage > bullet.stats.damage! && totalPelletDamage < bullet.stats.damage! * 1.5);
});

test('legacy metadata migration is deterministic and preserves all existing item stats, credits, and checkpoint data', () => {
  const state = createProgression();
  state.credits = 9823; state.checkpoint = { id: 'heavy-depot', mode: 'mech' };
  state.inventory.push(rollItem('pilot', 5, seededRandom(31), 'weapon'));
  const legacy = JSON.parse(serializeProgression(state));
  for (const item of legacy.inventory) { delete item.brand; delete item.weapon; }
  const raw = JSON.stringify(legacy);
  const first = deserializeProgression(raw)!, second = deserializeProgression(raw)!;
  assert.ok(first && second);
  assert.equal(first.credits, 9823);
  assert.deepEqual(first.checkpoint, state.checkpoint);
  assert.deepEqual(first.loadouts, state.loadouts);
  first.inventory.forEach((item, index) => {
    assert.ok(brands[item.brand]);
    assert.deepEqual(item.stats, state.inventory[index].stats);
    assert.equal(item.id, state.inventory[index].id);
    assert.equal(item.value, state.inventory[index].value);
    if (item.slot === 'weapon') {
      assert.equal(item.weapon!.element, 'kinetic');
      assert.equal(item.weapon!.projectile, item.target === 'mech' ? 'slug' : 'bullet');
    }
  });
  assert.deepEqual(first, second);
  assert.deepEqual(deserializeProgression(serializeProgression(first)), first);
});

test('malformed brand and weapon metadata recover independently without discarding saved equipment or money', () => {
  const state = createProgression(); state.credits = 460;
  const raw = JSON.parse(serializeProgression(state));
  const weapon = raw.inventory.find((item: { slot: string }) => item.slot === 'weapon');
  weapon.brand = 'not-real'; weapon.weapon = createWeaponSpec('homing', 'ice');
  const loaded = deserializeProgression(JSON.stringify(raw))!;
  assert.ok(loaded);
  assert.equal(loaded.credits, 460);
  assert.equal(loaded.inventory.length, state.inventory.length);
  assert.equal(loaded.inventory[0].weapon!.projectile, 'homing');
  assert.deepEqual(loaded.inventory[0].stats, state.inventory[0].stats);
  for (const corrupted of [
    null, {}, { ...createWeaponSpec('rocket', 'fire'), speed: -1 },
    { ...createWeaponSpec('scatter', 'shock'), pellets: 1.5 },
    { ...createWeaponSpec('disc', 'gravity'), bounces: 6 },
    { ...createWeaponSpec('orb', 'radiation'), statusPower: Infinity },
    { ...createWeaponSpec('bullet', 'kinetic'), projectile: '__proto__' },
  ]) {
    weapon.brand = 'voltaic'; weapon.weapon = corrupted;
    const repaired = deserializeProgression(JSON.stringify(raw))!;
    assert.ok(repaired);
    assert.equal(repaired.inventory[0].brand, 'voltaic');
    assert.deepEqual(repaired.inventory[0].weapon, createWeaponSpec('bullet', 'kinetic'));
    assert.deepEqual(repaired.inventory[0].stats, state.inventory[0].stats);
    assert.equal(repaired.credits, 460);
  }
  raw.inventory.find((item: { slot: string }) => item.slot === 'shield').weapon = { invalid: true };
  assert.equal(deserializeProgression(JSON.stringify(raw))!.inventory.find(item => item.slot === 'shield')!.weapon, undefined);
});

test('starter weapons retain their established balance and safe kinetic delivery', () => {
  const state = createProgression();
  const pilot = state.inventory.find(item => item.id === state.loadouts.pilot.weapon)!;
  const mech = state.inventory.find(item => item.id === state.loadouts.mech.weapon)!;
  assert.equal(pilot.brand, 'ironvale'); assert.equal(mech.brand, 'ironvale');
  assert.equal(pilot.stats.damage, 20); assert.equal(mech.stats.damage, 75);
  assert.equal(getWeaponSpec(pilot).projectile, 'bullet'); assert.equal(getWeaponSpec(mech).projectile, 'slug');
  assert.equal(getWeaponSpec(pilot).element, 'kinetic');
  const spec = getWeaponSpec(pilot); spec.element = 'fire';
  assert.equal(pilot.weapon!.element, 'kinetic', 'Safe getters return independent metadata');
});

test('appearance identity includes actual brand and weapon behavior while resale values stay cosmetic', () => {
  const item = rollItem('pilot', 2, seededRandom(9), 'weapon');
  const original = describeItemAppearance(item);
  assert.notEqual(describeItemAppearance({ ...item, brand: item.brand === 'prism' ? 'kestrel' : 'prism' }).key, original.key);
  assert.notEqual(describeItemAppearance({ ...item, weapon: createWeaponSpec('rocket', 'fire') }).key, original.key);
  assert.deepEqual(describeItemAppearance({ ...item, value: 1, level: 100 }), original);
});

test('new elemental status feedback retains effect colors while direct critical and normal hits remain red and white', () => {
  assert.equal(getDamageColor({ critical: false }), '#fff');
  assert.equal(getDamageColor({ critical: true }), '#ff3b3b');
  for (const effect of ['fire', 'ice', 'radiation', 'gravity', 'corrosive', 'shock', 'adhesive'] as const) {
    assert.equal(getDamageColor({ critical: true, effect }), getDamageColor({ critical: false, effect }));
    assert.notEqual(getDamageColor({ critical: false, effect }), '#fff');
    assert.notEqual(getDamageColor({ critical: false, effect }), '#ff3b3b');
  }
});
