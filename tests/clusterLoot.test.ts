import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { brandList, createWeaponSpec, getHitStatusChance, getHitStatusPower, normalizeWeaponSpec, rollWeaponSpec, type BrandId, type ProjectileType, type WeaponSpec } from '../src/core/arsenal.ts';
import { createProgression, deserializeProgression, rollItem, seededRandom, serializeProgression, type Item, type Mode } from '../src/core/index.ts';

interface ProfileBaseline { brand: BrandId; mode: Mode; selection: number; seed: number; draws: number; nextDraw: number; spec: WeaponSpec }
interface ItemBaseline { brand: BrandId; mode: Mode; seed: number; draws: number; nextDraw: number; item: Item }
const baseline = JSON.parse(readFileSync(new URL('./fixtures/cluster-loot-baseline.json', import.meta.url), 'utf8')) as {
  source: string; profiles: ProfileBaseline[]; items: ItemBaseline[];
};

// Historical distributions, captured before Cluster was enabled for ordinary loot.
const legacyPools: Record<BrandId, readonly ProjectileType[]> = {
  ironvale: ['bullet', 'slug', 'scatter', 'rocket'], prism: ['beam', 'orb', 'disc'],
  kestrel: ['bullet', 'homing', 'scatter'], rebound: ['ricochet', 'disc', 'bullet'],
  tackwork: ['sticky', 'spike', 'rocket'], nullward: ['orb', 'homing', 'disc'],
  cindergrid: ['rocket', 'scatter', 'slug'], voltaic: ['arc', 'beam', 'spike'],
};

function plannedSelection(brand: BrandId, selection: number): ProjectileType {
  const pool = legacyPools[brand], scaled = selection * pool.length, previous = pool[Math.floor(scaled)];
  return (brand === 'ironvale' || brand === 'cindergrid') && previous === 'rocket' && scaled % 1 >= 0.5 ? 'cluster' : previous;
}

function stableCarrierFields(spec: WeaponSpec) {
  const { projectile: _, split: __, blastRadius: ___, fuse: ____, ...unchanged } = spec;
  return unchanged;
}

test('Cluster receives half of existing Ironvale/Cindergrid rocket weight and preserves every other interval', () => {
  for (const { id: brand } of brandList) for (const mode of ['pilot', 'mech'] as const) {
    const counts = new Map<ProjectileType, number>();
    for (let bucket = 0; bucket < 24; bucket++) {
      const selection = (bucket + 0.5) / 24;
      let draws = 0;
      const spec = rollWeaponSpec(brand, mode, () => draws++ === 0 ? selection : 0.5);
      assert.equal(spec.projectile, plannedSelection(brand, selection), `${brand}/${mode}/${selection}`);
      counts.set(spec.projectile, (counts.get(spec.projectile) ?? 0) + 1);
    }
    if (brand === 'ironvale') assert.deepEqual(Object.fromEntries(counts), { bullet: 6, slug: 6, scatter: 6, rocket: 3, cluster: 3 });
    else if (brand === 'cindergrid') assert.deepEqual(Object.fromEntries(counts), { rocket: 4, cluster: 4, scatter: 8, slug: 8 });
    else assert.ok(!counts.has('cluster'), `${brand} retains its established delivery identity`);
  }
  for (const [brand, boundary] of [['ironvale', 0.875], ['cindergrid', 1 / 6]] as const) {
    for (const [selection, expected] of [[boundary - 1e-9, 'rocket'], [boundary, 'cluster'], [boundary + 1e-9, 'cluster']] as const) {
      let draws = 0;
      assert.equal(rollWeaponSpec(brand, 'pilot', () => draws++ === 0 ? selection : 0.5).projectile, expected);
    }
  }
});

test('frozen pre-change metadata proves nonrocket rolls and the subsequent RNG position remain exact', () => {
  assert.match(baseline.source, /ddb86b1/);
  assert.equal(baseline.profiles.length, 100, 'The frozen evidence covers every original pool interval in both modes');
  let converted = 0;
  for (const entry of baseline.profiles) {
    const random = seededRandom(entry.seed); let draws = 0;
    const spec = rollWeaponSpec(entry.brand, entry.mode, () => { const value = draws === 0 ? entry.selection : random(); draws++; return value; });
    assert.equal(draws, entry.draws, `${entry.brand}/${entry.mode}/${entry.selection}: no extra or skipped loot draws`);
    assert.equal(random(), entry.nextDraw, 'Later combat/supply/loot RNG must not shift because of profile selection');
    assert.equal(spec.projectile, plannedSelection(entry.brand, entry.selection));
    if (spec.projectile === 'cluster') {
      converted++;
      assert.equal(entry.spec.projectile, 'rocket');
      assert.deepEqual(stableCarrierFields(spec), stableCarrierFields(entry.spec), 'Converted rockets retain rolled channels, velocity, spread, status and cosmetic metadata');
      assert.deepEqual(spec.split, createWeaponSpec('cluster', spec.element, entry.mode).split);
    } else assert.deepEqual(spec, entry.spec, 'All metadata from an unconverted historical roll must remain identical');
    assert.deepEqual(normalizeWeaponSpec(spec, entry.mode), spec);
    assert.ok(Object.values(spec).filter(value => typeof value === 'number').every(Number.isFinite));
  }
  assert.equal(converted, 4, 'Only the selected half of each eligible rocket bucket changes, in each mode');
});

test('representative complete item rolls retain their RNG stream, identity fields and unconverted stats', () => {
  for (const entry of baseline.items) {
    const random = seededRandom(entry.seed); let draws = 0;
    const item = rollItem(entry.mode, 7, () => { draws++; return random(); }, 'weapon', { brand: entry.brand });
    item.id = entry.item.id;
    assert.equal(draws, entry.draws); assert.equal(random(), entry.nextDraw);
    if (item.weapon!.projectile === 'cluster') {
      assert.equal(entry.item.weapon!.projectile, 'rocket');
      assert.deepEqual({ ...item, weapon: undefined, stats: undefined }, { ...entry.item, weapon: undefined, stats: undefined });
      assert.equal(item.stats.magazine, entry.item.stats.magazine); assert.equal(item.stats.reload, entry.item.stats.reload);
      assert.deepEqual(stableCarrierFields(item.weapon!), stableCarrierFields(entry.item.weapon!));
    } else assert.deepEqual(item, entry.item);
    assert.ok(Object.values(item.stats).every(value => Number.isFinite(value) && value > 0));
  }
});

test('natural Cluster rolls keep manufacturer elements independent and round-trip without rewriting saved equipment', () => {
  const elementPools: Record<'ironvale' | 'cindergrid', readonly string[]> = {
    ironvale: ['kinetic', 'kinetic', 'corrosive'], cindergrid: ['fire', 'radiation', 'corrosive'],
  };
  for (const brand of ['ironvale', 'cindergrid'] as const) for (const mode of ['pilot', 'mech'] as const) {
    for (let channel = 0; channel < 3; channel++) {
      const values = [brand === 'ironvale' ? 0.9 : 0.25, (channel + 0.5) / 3]; let draws = 0;
      const spec = rollWeaponSpec(brand, mode, () => values[draws++] ?? 0.5);
      assert.equal(spec.projectile, 'cluster'); assert.equal(spec.element, elementPools[brand][channel]);
      assert.equal(spec.secondaryElement, undefined, 'Ordinary drops do not silently gain a second element');
      assert.equal(spec.pellets, 1); assert.ok(spec.split && spec.split.count >= 2 && spec.split.count <= 12);
      assert.deepEqual(normalizeWeaponSpec(spec, mode), spec);
    }
  }
  const state = createProgression();
  const historical = baseline.items.map(entry => structuredClone(entry.item));
  state.inventory.push(...historical);
  for (const brand of ['ironvale', 'cindergrid'] as const) for (const mode of ['pilot', 'mech'] as const) {
    let cluster: Item | undefined;
    for (let seed = 0; seed < 500 && !cluster; seed++) {
      const item = rollItem(mode, 5, seededRandom(seed), 'weapon', { brand });
      if (item.weapon!.projectile === 'cluster') cluster = item;
    }
    assert.ok(cluster, `${brand}/${mode}: Cluster must be reachable through actual item generation`);
    cluster.id = `natural-cluster-${brand}-${mode}`; state.inventory.push(cluster);
    assert.ok(Object.values(cluster.stats).every(value => Number.isFinite(value) && value > 0));
  }
  const before = structuredClone(state);
  for (let cycle = 0; cycle < 3; cycle++) {
    const restored = deserializeProgression(serializeProgression(state)); assert.ok(restored);
    assert.deepEqual(restored, before, 'Old gear and new Cluster rolls must preserve their complete saved values');
    assert.deepEqual(restored.inventory.filter(item => item.id.startsWith('baseline-')), historical);
    state.inventory = restored.inventory;
  }
});


test('legacy saved Cluster geometry and raw combat rolls survive new defaults and runtime proc balance', () => {
  let state = createProgression();
  for (const mode of ['pilot', 'mech'] as const) {
    const historical = structuredClone(baseline.items.find(entry => entry.mode === mode)!.item);
    const item: Item = {
      ...historical, id: `legacy-cluster-${mode}`, name: `Legacy Cluster / ${mode}`,
      stats: mode === 'pilot' ? { damage: 253.17, fireRate: 3.41, magazine: 17, reload: 1.83 }
        : { damage: 721.34, fireRate: 1.23, magazine: 7, reload: 2.43 },
      weapon: {
        projectile: 'cluster', weaponType: 'launcher', element: 'corrosive', secondaryElement: 'fire', trail: 'helix', visualVariant: 2,
        speed: 61.7, pellets: 1, spread: 0.0144, bounces: 0, tracking: 0,
        blastRadius: mode === 'pilot' ? 2.2 : 3.2, fuse: 0.65,
        split: { count: mode === 'pilot' ? 6 : 8, delay: 0.45, spread: 0.32 },
        statusChance: 0.31, statusPower: 0.37,
      },
    };
    state.inventory.push(item); state.loadouts[mode].weapon = item.id;
    assert.deepEqual(normalizeWeaponSpec(item.weapon, mode), item.weapon);
  }
  const before = structuredClone(state);
  for (let cycle = 0; cycle < 3; cycle++) {
    const loaded = deserializeProgression(serializeProgression(state)); assert.ok(loaded); state = loaded;
    assert.deepEqual(state, before, 'Defaults must never replace explicit geometry, raw status rolls or numeric stats in an existing save');
    for (const mode of ['pilot', 'mech'] as const) {
      const item = state.inventory.find(candidate => candidate.id === `legacy-cluster-${mode}`)!;
      const spec = item.weapon!, count = mode === 'pilot' ? 6 : 8;
      assert.equal(spec.blastRadius, mode === 'pilot' ? 2.2 : 3.2);
      assert.deepEqual(spec.split, { count, delay: 0.45, spread: 0.32 });
      assert.equal(spec.statusChance, 0.31); assert.equal(spec.statusPower, 0.37);
      assert.ok(getHitStatusChance(spec) < spec.statusChance, 'Existing saved Cluster uses the new runtime chance rule without rewriting its raw roll');
      assert.ok(Math.abs(getHitStatusPower(120 / count, spec) - 120 * 0.37) < 1e-10);
    }
    assert.deepEqual(state, before, 'Reading effective runtime status values must also leave the saved item unchanged');
  }
});
