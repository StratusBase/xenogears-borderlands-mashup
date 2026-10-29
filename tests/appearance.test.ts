import assert from 'node:assert/strict';
import test from 'node:test';
import { describeItemAppearance, resolveEquipmentAppearance, type EquipmentAppearance } from '../src/core/appearance.ts';
import { createProgression, deserializeProgression, equipItem, rarityColors, rollItem, seededRandom, serializeProgression, type Item, type Slot } from '../src/core/index.ts';
import { elementColors, getWeaponSpec } from '../src/core/arsenal.ts';

function item(slot: Slot = 'weapon'): Item {
  const value = rollItem('pilot', 5, seededRandom(18), slot);
  value.id = `appearance-fixture-${slot}`;
  return value;
}

test('visual identity survives saves and arbitrary combat-stat property order without random draws', () => {
  const state = createProgression();
  const before = resolveEquipmentAppearance(state, 'mech');
  const restored = deserializeProgression(serializeProgression(state))!;
  assert.deepEqual(resolveEquipmentAppearance(restored, 'mech'), before);
  const rifle = item();
  const reordered = { ...rifle, stats: Object.fromEntries(Object.entries(rifle.stats).reverse()) };
  const random = Math.random;
  try {
    Math.random = () => { throw new Error('Appearance must not consume randomness'); };
    assert.deepEqual(describeItemAppearance(reordered), describeItemAppearance(rifle));
    assert.deepEqual(resolveEquipmentAppearance(state, 'mech'), before);
  } finally {
    Math.random = random;
  }
});

test('affixes select the structural form used by renderers', () => {
  const expected: [Slot, string | null, EquipmentAppearance['form']][] = [
    ['weapon', 'Heavy', 'heavy'], ['weapon', 'Rapid', 'rapid'], ['weapon', 'Quickdraw', 'compact'],
    ['shield', 'Fortified', 'fortified'], ['shield', 'Reinforced', 'fortified'], ['shield', 'Lightweight', 'lightweight'],
    ['reactor', 'Ventilated', 'vented'], ['reactor', 'High-capacity', 'capacity'],
    ['legs', 'Sprinter', 'sprinter'], ['legs', 'Trailrunner', 'sprinter'], ['legs', 'Armored', 'armored'],
    ['weapon', null, 'standard'], ['reactor', 'Balanced', 'standard'], ['weapon', '__proto__', 'standard'],
  ];
  for (const [slot, affix, form] of expected) {
    assert.equal(describeItemAppearance({ ...item(slot), affix }).form, form);
  }
});

test('equipping a replacement changes only that slot and leaves the other form unchanged', () => {
  const state = createProgression();
  const before = resolveEquipmentAppearance(state, 'pilot');
  const otherForm = resolveEquipmentAppearance(state, 'mech');
  const replacement = item('shield');
  state.inventory.push(replacement);
  assert.equal(equipItem(state, replacement.id), true);
  const after = resolveEquipmentAppearance(state, 'pilot');
  assert.notEqual(after.shield.key, before.shield.key);
  for (const slot of ['weapon', 'reactor', 'legs'] as const) assert.deepEqual(after[slot], before[slot]);
  assert.deepEqual(resolveEquipmentAppearance(state, 'mech'), otherForm);
});

test('price, item label, and level-only metadata changes do not repaint otherwise identical gear', () => {
  const rifle = item();
  const before = describeItemAppearance(rifle);
  assert.deepEqual(describeItemAppearance({ ...rifle, value: Math.floor(rifle.value / 2) }), before);
  assert.deepEqual(describeItemAppearance({ ...rifle, level: 99, name: 'Renamed display label' }), before);
  assert.notEqual(describeItemAppearance({ ...rifle, stats: { ...rifle.stats, damage: rifle.stats.damage! + 1 } }).key, before.key);
  assert.notEqual(describeItemAppearance({ ...rifle, id: `${rifle.id}-other` }).key, before.key);
});

test('preview replaces just its compatible slot and never equips or mutates the selected item', () => {
  const state = createProgression();
  const preview = item('legs');
  const stateBefore = serializeProgression(state);
  const itemBefore = structuredClone(preview);
  const real = resolveEquipmentAppearance(state, 'pilot');
  const rendered = resolveEquipmentAppearance(state, 'pilot', preview);
  assert.deepEqual(rendered.legs, describeItemAppearance(preview));
  for (const slot of ['weapon', 'shield', 'reactor'] as const) assert.deepEqual(rendered[slot], real[slot]);
  assert.equal(serializeProgression(state), stateBefore);
  assert.deepEqual(preview, itemBefore);
  assert.deepEqual(resolveEquipmentAppearance(state, 'mech', preview), resolveEquipmentAppearance(state, 'mech'));
  assert.deepEqual(resolveEquipmentAppearance(state, 'pilot', { ...preview, id: '' }), real);
  assert.deepEqual(resolveEquipmentAppearance(state, 'pilot', { ...preview, stats: { moveSpeed: NaN } }), real);
});

test('empty slots and foreign or mismatched equipped IDs produce safe independent defaults', () => {
  const state = createProgression();
  state.loadouts.pilot = {};
  state.loadouts.mech = {};
  const pilot = resolveEquipmentAppearance(state, 'pilot');
  const mech = resolveEquipmentAppearance(state, 'mech');
  assert.equal(new Set([...Object.values(pilot), ...Object.values(mech)].map(part => part.key)).size, 8);
  for (const part of [...Object.values(pilot), ...Object.values(mech)]) {
    assert.equal(part.equipped, false);
    assert.equal(part.form, 'standard');
    assert.ok(Number.isInteger(part.variant) && part.variant >= 0 && part.variant <= 2);
    for (const color of [part.primary, part.secondary, part.accent, part.metal]) assert.ok(Number.isInteger(color) && color >= 0 && color <= 0xffffff);
  }
  state.loadouts.pilot.weapon = 'starter-mech-weapon';
  state.loadouts.pilot.shield = 'starter-pilot-weapon';
  state.loadouts.pilot.legs = 'missing';
  assert.deepEqual(resolveEquipmentAppearance(state, 'pilot'), pilot);
  pilot.weapon.primary = 0;
  assert.notEqual(resolveEquipmentAppearance(state, 'pilot').weapon.primary, 0, 'Returned defaults must not share mutable appearance state');
});

test('palette and geometry variants are stable, with elemental weapon accents and rarity accents otherwise', () => {
  const variants = new Set<number>();
  const palettes = new Set<number>();
  for (let index = 0; index < 100; index++) {
    const gear = { ...item(), id: `distinct-item-${index}` };
    const appearance = describeItemAppearance(gear);
    variants.add(appearance.variant);
    palettes.add(appearance.primary);
    assert.notEqual(appearance.primary, appearance.secondary);
    const element = getWeaponSpec(gear).element;
    assert.equal(appearance.accent, Number.parseInt((element === 'kinetic' ? rarityColors[gear.rarity] : elementColors[element]).slice(1), 16));
  }
  assert.deepEqual([...variants].sort(), [0, 1, 2]);
  assert.equal(palettes.size, 5);
});
