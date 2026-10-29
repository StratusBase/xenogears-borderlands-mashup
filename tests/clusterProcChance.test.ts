import assert from 'node:assert/strict';
import test from 'node:test';
import { createWeaponSpec, getHitStatusChance, getHitStatusPower, getWeaponElements, projectileLabels, type ProjectileType, type WeaponSpec } from '../src/core/arsenal.ts';
import { seededRandom } from '../src/core/index.ts';
import { effectiveProjectileDamage } from '../src/core/weaponBalance.ts';

function close(actual: number, expected: number, tolerance = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

test('unsplit deliveries and instant rays retain their saved per-hit proc probability', () => {
  for (const projectile of Object.keys(projectileLabels) as ProjectileType[]) {
    const { split: _, ...unsplit } = createWeaponSpec(projectile, 'fire');
    for (const statusChance of [0, 0.2, 0.35, 0.45, 1]) {
      assert.equal(getHitStatusChance({ ...unsplit, statusChance }), statusChance, projectile);
    }
  }
  for (const projectile of ['beam', 'arc'] as const) {
    const spec = { ...createWeaponSpec(projectile, 'shock'), split: { count: 8, delay: 0.45, spread: 0.2 } };
    assert.equal(getHitStatusChance(spec), spec.statusChance, 'Rays never release physical children');
  }
});

test('a complete child group retains the saved carrier probability of at least one proc', () => {
  for (let count = 2; count <= 12; count++) {
    for (const statusChance of [0, 1e-14, 0.001, 0.2, 0.35, 0.45, 0.999999999999, 1]) {
      const spec = { ...createWeaponSpec('cluster', 'fire'), statusChance, split: { count, delay: 0.45, spread: 0.32 } };
      const before = structuredClone(spec);
      Object.freeze(spec.split); Object.freeze(spec);
      const child = getHitStatusChance(spec);
      assert.ok(Number.isFinite(child) && child >= 0 && child <= 1);
      if (statusChance > 0 && statusChance < 1) assert.ok(child > 0 && child < statusChance);
      const completeGroup = child === 1 ? 1 : -Math.expm1(count * Math.log1p(-child));
      close(completeGroup, statusChance);
      assert.deepEqual(spec, before, 'Effective proc calculations must never rewrite saved rolls');
    }
  }
});

test('proc normalization supports reusable physical carriers and keeps guaranteed status guaranteed', () => {
  for (const projectile of ['cluster', 'rocket', 'orb', 'sticky', 'homing'] as const) {
    const spec = { ...createWeaponSpec(projectile, 'ice'), split: { count: 6, delay: 0.45, spread: 0.32 } };
    close(getHitStatusChance(spec), 0.06928032934674537);
    assert.equal(getHitStatusChance({ ...spec, statusChance: 0 }), 0);
    assert.equal(getHitStatusChance({ ...spec, statusChance: 1 }), 1);
  }
  const pilot = getHitStatusChance(createWeaponSpec('cluster', 'fire', 'pilot'));
  const mech = getHitStatusChance(createWeaponSpec('cluster', 'fire', 'mech'));
  assert.ok(mech < pilot, 'Eight children share the same carrier chance as six');
});

test('malformed helper inputs cannot produce NaN probabilities or amplify an ordinary proc chance', () => {
  const spec = createWeaponSpec('cluster', 'fire');
  for (const statusChance of [NaN, Infinity, -Infinity]) assert.equal(getHitStatusChance({ ...spec, statusChance }), 0);
  assert.equal(getHitStatusChance({ ...spec, statusChance: -0.1 }), 0);
  assert.equal(getHitStatusChance({ ...spec, statusChance: 1.1 }), 1);
  for (const count of [NaN, Infinity, -1, 0, 1, 2.5, 13]) {
    const invalid = { ...spec, split: { ...spec.split!, count } };
    assert.equal(getHitStatusChance(invalid), spec.statusChance, 'Invalid optional split counts must not create a probability transformation');
  }
});

test('primary and secondary channels use independent normalized rolls rather than a shared trigger result', () => {
  // Fixed diagnostic sample: independent RNG calls per channel and child, as in Game.
  const spec: WeaponSpec = { ...createWeaponSpec('cluster', 'fire'), secondaryElement: 'shock', statusChance: 0.35 };
  const random = seededRandom(0x51a7), chance = getHitStatusChance(spec), trials = 20_000;
  let primary = 0, secondary = 0, both = 0, different = 0;
  for (let trial = 0; trial < trials; trial++) {
    const procs = new Set<string>();
    for (let child = 0; child < spec.split!.count; child++) {
      for (const element of getWeaponElements(spec)) if (element !== 'kinetic' && random() < chance) procs.add(element);
    }
    primary += Number(procs.has('fire')); secondary += Number(procs.has('shock'));
    both += Number(procs.has('fire') && procs.has('shock'));
    different += Number(procs.has('fire') !== procs.has('shock'));
  }
  close(primary / trials, 0.35, 0.015); close(secondary / trials, 0.35, 0.015);
  close(both / trials, 0.35 * 0.35, 0.015);
  assert.ok(different > trials * 0.3, 'Channels must not be tied to the same random outcome');
  const kinetic = { ...spec, element: 'kinetic' as const };
  close(getHitStatusChance(kinetic), chance);
  assert.deepEqual(getWeaponElements(kinetic), ['kinetic', 'shock']);
});


test('unsplit shots and instant rays preserve existing proc strength while valid children restore carrier strength', () => {
  for (const projectile of Object.keys(projectileLabels) as ProjectileType[]) {
    const { split: _, ...unsplit } = createWeaponSpec(projectile, 'fire');
    assert.equal(getHitStatusPower(24, { ...unsplit, statusPower: 0.4 }), 24 * 0.4, projectile);
  }
  for (const projectile of ['beam', 'arc'] as const) {
    const spec = { ...createWeaponSpec(projectile, 'shock'), statusPower: 0.4, split: { count: 8, delay: 0.45, spread: 0.2 } };
    assert.equal(getHitStatusPower(24, spec), 24 * 0.4, 'Instant rays never receive a physical carrier multiplier');
  }
  for (const projectile of ['cluster', 'rocket', 'orb', 'sticky', 'homing'] as const) {
    for (const count of [2, 6, 8, 12]) {
      const spec = { ...createWeaponSpec(projectile, 'fire'), statusPower: 0.4, split: { count, delay: 0.45, spread: 0.32 } };
      const before = structuredClone(spec); Object.freeze(spec.split); Object.freeze(spec);
      close(getHitStatusPower(120 / count, spec), 48);
      assert.deepEqual(spec, before, 'Restoring carrier strength must not rewrite saved metadata');
    }
  }
});

test('carrier-strength procs retain actual splash falloff and never recharge the secondary-element cost', () => {
  const spec: WeaponSpec = { ...createWeaponSpec('cluster', 'fire'), secondaryElement: 'corrosive', statusPower: 0.4, statusChance: 0.35 };
  const before = structuredClone(spec), budget = effectiveProjectileDamage(120, spec), count = spec.split!.count;
  assert.equal(budget, 102);
  const direct = budget / count;
  close(getHitStatusPower(direct, spec), 40.8, 1e-10);
  close(getHitStatusPower(direct * 0.65 * 0.25, spec), 40.8 * 0.65 * 0.25, 1e-10);
  assert.deepEqual(spec, before);
  const childChance = getHitStatusChance(spec);
  const groupChance = -Math.expm1(count * Math.log1p(-childChance));
  close(groupChance * getHitStatusPower(direct, spec), spec.statusChance * budget * spec.statusPower, 1e-10);
  const kinetic = { ...spec, element: 'kinetic' as const, secondaryElement: 'shock' as const };
  close(getHitStatusPower(direct, kinetic), 40.8, 1e-10);
});

test('invalid proc strength inputs stay finite and malformed split counts retain ordinary hit strength', () => {
  const spec = createWeaponSpec('cluster', 'fire');
  for (const damage of [NaN, Infinity, -Infinity, -1, 0]) assert.equal(getHitStatusPower(damage, spec), 0);
  for (const statusPower of [NaN, Infinity, -Infinity, -1, 0]) assert.equal(getHitStatusPower(20, { ...spec, statusPower }), 0);
  assert.equal(getHitStatusPower(Number.MAX_VALUE, { ...spec, statusPower: 2 }), 0, 'Overflowing products must not escape as Infinity');
  for (const count of [NaN, Infinity, -1, 0, 1, 2.5, 13]) {
    const invalid = { ...spec, split: { ...spec.split!, count } };
    assert.equal(getHitStatusPower(20, invalid), 20 * spec.statusPower);
  }
});
