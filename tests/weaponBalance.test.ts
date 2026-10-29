import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createWeaponSpec, type ElementType, type ProjectileType } from '../src/core/arsenal.ts';
import { createProgression, deserializeProgression, serializeProgression } from '../src/core/index.ts';
import { createWorkbenchWeapon, normalizeWorkbenchConfig } from '../src/core/workbench.ts';
import { advanceStatuses, applyStatus, createStatusState } from '../src/core/statusEffects.ts';
import { PlayerBallistics, type BallisticHit } from '../src/rendering/PlayerBallistics.ts';
import { BASELINE_WEAPON_BALANCE, DEFAULT_WEAPON_BALANCE, effectiveProjectileDamage, hasSecondaryElementCost, heatPerShot, heatRecoveryFraction, type WeaponBalanceRules } from '../src/core/weaponBalance.ts';

function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`); }

test('a valid secondary channel costs 15% effective damage, including kinetic plus status, without changing its specification', () => {
  for (const element of ['kinetic', 'shock', 'gravity'] as const) {
    const spec = { ...createWeaponSpec('bullet', element), secondaryElement: 'fire' as const };
    const before = structuredClone(spec);
    assert.equal(effectiveProjectileDamage(100, spec), 85);
    assert.equal(effectiveProjectileDamage(100, spec, BASELINE_WEAPON_BALANCE), 100);
    assert.equal(spec.statusChance, before.statusChance);
    assert.equal(spec.statusPower, before.statusPower);
    assert.deepEqual(spec, before);
  }
  assert.ok(Object.isFrozen(DEFAULT_WEAPON_BALANCE) && Object.isFrozen(BASELINE_WEAPON_BALANCE));
});

test('single, duplicate, kinetic and invalid secondary metadata never invent a cost', () => {
  const spec = createWeaponSpec('bullet', 'fire');
  for (const secondaryElement of [undefined, 'fire', 'kinetic', '__proto__', 'not-an-element', 17]) {
    const candidate = { ...spec, secondaryElement: secondaryElement as ElementType };
    assert.equal(hasSecondaryElementCost(candidate), false);
    assert.equal(effectiveProjectileDamage(100, candidate), 100);
  }
  for (const damage of [NaN, Infinity, -1]) assert.equal(effectiveProjectileDamage(damage, spec), 0);
  assert.equal(effectiveProjectileDamage(0, spec), 0);
});

test('effective damage is derived after loading; raw saved rolls and gear are never rewritten', () => {
  const state = createProgression();
  const item = createWorkbenchWeapon(normalizeWorkbenchConfig({ element: 'shock', secondaryElement: 'corrosive' }));
  state.inventory.push(item); state.loadouts.pilot.weapon = item.id;
  const before = serializeProgression(state);
  const restored = deserializeProgression(before)!;
  const loaded = restored.inventory.find(entry => entry.id === item.id)!;
  const raw = loaded.stats.damage!;
  close(effectiveProjectileDamage(raw, loaded.weapon!), raw * 0.85);
  close(effectiveProjectileDamage(raw, loaded.weapon!), raw * 0.85);
  assert.equal(loaded.stats.damage, item.stats.damage);
  assert.equal(serializeProgression(state), before);
  assert.deepEqual(loaded, item);
});

function deliveredHits(projectile: ProjectileType, rules: WeaponBalanceRules): BallisticHit[] {
  const scene = new THREE.Scene(), hits: BallisticHit[] = [];
  const roots = [new THREE.Group(), new THREE.Group()];
  const owned: THREE.Mesh[] = [];
  for (const [index, root] of roots.entries()) {
    root.position.set(index * 2, 1, -6);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(projectile === 'scatter' ? 5 : 1, 2, 1), new THREE.MeshBasicMaterial());
    mesh.userData.enemyId = index + 1; root.add(mesh); scene.add(root); owned.push(mesh);
  }
  const ballistics = new PlayerBallistics(scene, { targets: () => roots.map((root, index) => ({ id: index + 1, root, radius: 0.5 })), occluders: () => [], hit: hit => hits.push(hit) });
  const spec = { ...createWeaponSpec(projectile, 'shock'), secondaryElement: 'fire' as const, spread: 0 };
  try {
    ballistics.fire(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), spec, effectiveProjectileDamage(100, spec, rules));
    ballistics.update(2);
    return hits;
  } finally {
    ballistics.clear();
    for (const mesh of owned) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
  }
}

test('real scatter, arc chains, rocket splash and sticky impact/fuse inherit the one shot-level cost', () => {
  for (const projectile of ['bullet', 'scatter', 'arc', 'rocket', 'sticky'] as const) {
    const baseline = deliveredHits(projectile, BASELINE_WEAPON_BALANCE);
    const charged = deliveredHits(projectile, DEFAULT_WEAPON_BALANCE);
    assert.ok(baseline.length > 0, `${projectile} must produce actual collisions`);
    assert.equal(charged.length, baseline.length);
    if (projectile === 'arc' || projectile === 'rocket') assert.ok(new Set(baseline.map(hit => hit.targetId)).size > 1, `${projectile} reaches a second target`);
    if (projectile === 'sticky') assert.ok(baseline.length >= 2, 'the attachment hit and delayed fuse are both measured');
    if (projectile === 'scatter') assert.ok(baseline.length >= 6, 'all real pellets are measured');
    for (let index = 0; index < charged.length; index++) {
      assert.equal(charged[index].targetId, baseline[index].targetId);
      close(charged[index].damage, baseline[index].damage * 0.85);
    }
  }
});

test('status power inherits effective impact damage without charging a second time or changing duration', () => {
  const spec = { ...createWeaponSpec('bullet', 'shock'), secondaryElement: 'fire' as const };
  const status = createStatusState();
  const damage = effectiveProjectileDamage(100, spec);
  assert.equal(applyStatus(status, 'fire', 0, damage * spec.statusPower), true);
  assert.equal(status.fire!.expiresAt, 4);
  const ticks = advanceStatuses(status, 4);
  close(ticks.reduce((total, tick) => total + tick.damage, 0), 85);
  assert.equal(spec.statusChance, 0.35);
  assert.equal(spec.statusPower, 0.25);
});

test('fast mech weapons use the 120 heat/s budget while pilot and slower mech charges remain unchanged', () => {
  for (const rate of [0.19, 0.52, 1.4, 120 / 31]) assert.equal(heatPerShot('mech', rate), 31);
  close(heatPerShot('mech', 6.95), 120 / 6.95);
  close(heatPerShot('mech', 30) * 30, 120);
  for (const rate of [0.19, 6.95, 30, NaN, Infinity, 0, -1]) {
    assert.equal(heatPerShot('pilot', rate), 8);
    assert.equal(heatPerShot('mech', rate, BASELINE_WEAPON_BALANCE), 31);
  }
  for (const rate of [NaN, Infinity, 0, -1]) assert.equal(heatPerShot('mech', rate), 31);
});

test('only mech heat rules alter the unlock fraction, independent from the damage-cost switch', () => {
  for (const secondaryElementCost of [false, true]) {
    const mechRules = { secondaryElementCost, mechHeat: true };
    const oldRules = { secondaryElementCost, mechHeat: false };
    assert.equal(heatRecoveryFraction('pilot', mechRules), 0.3);
    assert.equal(heatRecoveryFraction('mech', oldRules), 0.3);
    assert.equal(heatRecoveryFraction('mech', mechRules), 0.45);
  }
});
