import assert from 'node:assert/strict';
import test from 'node:test';
import { brandList, createWeaponSpec, elementLabels, getWeaponElements, normalizeWeaponSpec, projectileLabels, projectileTrailLabels, rollWeaponSpec, weaponTypeLabels, type WeaponSpec } from '../src/core/arsenal.ts';
import { describeItemAppearance } from '../src/core/appearance.ts';
import { createProgression, deserializeProgression, serializeProgression } from '../src/core/index.ts';
import { createWorkbenchWeapon, DEFAULT_WORKBENCH_CONFIG, normalizeWorkbenchConfig, parseWorkbenchCode, WORKBENCH_PRESETS, workbenchCode } from '../src/core/workbench.ts';

test('legacy weapon metadata gains safe cosmetic defaults without changing a numeric combat roll', () => {
  const current = createWeaponSpec('homing', 'corrosive', 'mech');
  const { weaponType: _, trail: __, visualVariant: ___, ...legacy } = current;
  legacy.speed = 68.1; legacy.statusChance = 0.27; legacy.statusPower = 0.37;
  const normalized = normalizeWeaponSpec(legacy, 'mech');
  for (const [key, value] of Object.entries(legacy)) assert.equal(normalized[key as keyof WeaponSpec], value);
  assert.equal(normalized.weaponType, 'rifle');
  assert.equal(normalized.trail, 'tracer');
  assert.equal(normalized.visualVariant, 0);
  const brokenCosmetics = normalizeWeaponSpec({ ...legacy, weaponType: '__proto__', trail: [], visualVariant: -1, secondaryElement: 'corrosive' }, 'mech');
  assert.deepEqual(brokenCosmetics, normalized);
  assert.deepEqual(getWeaponElements({ ...normalized, secondaryElement: 'fire' }), ['corrosive', 'fire']);
  assert.deepEqual(getWeaponElements({ ...normalized, secondaryElement: 'kinetic' }), ['corrosive']);
});

test('workbench family, delivery, dual elements and trail round-trip through normal progression saves', () => {
  const state = createProgression();
  const config = normalizeWorkbenchConfig({ weaponType: 'pistol', projectile: 'rocket', element: 'corrosive', secondaryElement: 'fire', trail: 'helix', visualVariant: 3, guaranteedStatus: true });
  const item = createWorkbenchWeapon(config);
  state.inventory.push(item); state.loadouts.pilot.weapon = item.id;
  const loaded = deserializeProgression(serializeProgression(state))!;
  assert.ok(loaded);
  assert.deepEqual(loaded.inventory.find(entry => entry.id === item.id), item);
  assert.equal(item.weapon!.weaponType, 'pistol');
  assert.equal(item.weapon!.projectile, 'rocket');
  assert.equal(item.weapon!.blastRadius, 4.2);
  assert.equal(item.weapon!.statusChance, 1);
  assert.equal(item.value, 0, 'Free sandbox weapons must not mint resale money');
});

test('new drop cosmetics consume no additional RNG and preserve established ballistic rolls', () => {
  let draws = 0;
  const spec = rollWeaponSpec('cindergrid', 'pilot', () => { draws++; return 0.5; });
  assert.equal(draws, 7, 'Delivery, element, velocity, pellet count, spread and two status draws only');
  assert.equal(spec.projectile, 'scatter');
  assert.equal(spec.element, 'radiation');
  assert.equal(spec.speed, 125);
  assert.equal(spec.pellets, 6);
  assert.equal(spec.spread, 0.11);
  assert.equal(spec.statusChance, 0.33);
  assert.equal(spec.statusPower, 0.28);
  assert.equal(spec.secondaryElement, undefined, 'Workbench dual channels do not alter ordinary drop balance');
});

test('element and trail changes retain the same receiver variant, base paint, affix and combat stats', () => {
  const base = createWorkbenchWeapon({ ...DEFAULT_WORKBENCH_CONFIG, element: 'corrosive' });
  const changed = createWorkbenchWeapon({ ...DEFAULT_WORKBENCH_CONFIG, element: 'shock', secondaryElement: 'fire', trail: 'ribbon' });
  const a = describeItemAppearance(base), b = describeItemAppearance(changed);
  assert.notEqual(a.key, b.key, 'Rendering must still know to refresh attached payload accents');
  for (const key of ['primary', 'secondary', 'metal', 'form', 'variant', 'brand', 'weaponType', 'projectile', 'visualVariant'] as const) assert.equal(a[key], b[key], key);
  assert.notEqual(a.accent, b.accent);
  assert.deepEqual(base.stats, changed.stats);
});

test('workbench manufacturer and weapon family affect actual mechanics independently from delivery and elements', () => {
  const rifle = createWorkbenchWeapon({ ...DEFAULT_WORKBENCH_CONFIG, brand: 'ironvale', weaponType: 'rifle', projectile: 'bullet' });
  const fast = createWorkbenchWeapon({ ...DEFAULT_WORKBENCH_CONFIG, brand: 'kestrel', weaponType: 'rifle', projectile: 'bullet' });
  const pistol = createWorkbenchWeapon({ ...DEFAULT_WORKBENCH_CONFIG, brand: 'ironvale', weaponType: 'pistol', projectile: 'bullet' });
  assert.ok(rifle.stats.damage! > fast.stats.damage! && rifle.stats.fireRate! < fast.stats.fireRate!);
  assert.ok(pistol.stats.damage! > rifle.stats.damage! && pistol.stats.magazine! < rifle.stats.magazine!);
  assert.equal(rifle.weapon!.projectile, pistol.weapon!.projectile);
  assert.equal(rifle.weapon!.element, fast.weapon!.element);
  const before = structuredClone(DEFAULT_WORKBENCH_CONFIG);
  assert.deepEqual(createWorkbenchWeapon(DEFAULT_WORKBENCH_CONFIG), createWorkbenchWeapon(DEFAULT_WORKBENCH_CONFIG));
  assert.deepEqual(DEFAULT_WORKBENCH_CONFIG, before);
});

test('curated workbench presets cover all makes, families, delivery types, elements and trails', () => {
  const configs = WORKBENCH_PRESETS.map(preset => normalizeWorkbenchConfig(preset.config));
  const unique = <T>(values: T[]) => [...new Set(values)].sort();
  assert.deepEqual(unique(configs.map(c => c.brand)), brandList.map(brand => brand.id).sort());
  assert.deepEqual(unique(configs.map(c => c.weaponType)), Object.keys(weaponTypeLabels).sort());
  assert.deepEqual(unique(configs.map(c => c.projectile)), Object.keys(projectileLabels).sort());
  assert.deepEqual(unique(configs.map(c => c.element)), Object.keys(elementLabels).sort());
  assert.deepEqual(unique(configs.map(c => c.trail)), Object.keys(projectileTrailLabels).sort());
  for (const c of configs) {
    const item = createWorkbenchWeapon(c);
    assert.ok(Object.values(item.stats).every(stat => Number.isFinite(stat) && stat > 0));
    assert.deepEqual(parseWorkbenchCode(workbenchCode(c)), c);
  }
});

test('permutation codes round-trip each independent control and reject corrupt or ambiguous input', () => {
  const config = normalizeWorkbenchConfig({ ...DEFAULT_WORKBENCH_CONFIG, target: 'mech', secondaryElement: 'gravity', affix: 'heavy', visualVariant: 3, level: 100, rarity: 'legendary', guaranteedStatus: true });
  const code = workbenchCode(config);
  assert.deepEqual(parseWorkbenchCode(code), config);
  for (const bad of ['', '{}', `${code}:extra`, code.replace('WS1', 'WS2'), code.replace(':100:', ':Infinity:'), code.replace(':3:', ':4:'), code.replace(':gravity:', ':kinetic:'), code.replace(':heavy:', ':__proto__:')]) assert.equal(parseWorkbenchCode(bad), null, bad);
  const safe = normalizeWorkbenchConfig({ visualVariant: Infinity, level: NaN, secondaryElement: 'kinetic' });
  assert.deepEqual(safe, DEFAULT_WORKBENCH_CONFIG);
});
