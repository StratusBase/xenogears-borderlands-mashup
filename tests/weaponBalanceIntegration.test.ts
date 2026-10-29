import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createWeaponSpec, getWeaponElements, getWeaponSpec, type ProjectileType, type WeaponSpec } from '../src/core/arsenal.ts';
import { deserializeProgression, seededRandom, serializeProgression } from '../src/core/index.ts';
import { applyStatus, advanceStatuses, createStatusState, type StatusState } from '../src/core/statusEffects.ts';
import { BASELINE_WEAPON_BALANCE, DEFAULT_WEAPON_BALANCE, effectiveProjectileDamage, type WeaponBalanceRules } from '../src/core/weaponBalance.ts';
import { createEvaluationFixture } from '../src/diagnostics/fixtures.ts';
import { PlayerBallistics, type BallisticHit, type BallisticTarget } from '../src/rendering/PlayerBallistics.ts';

interface Observation {
  id: number;
  at: number;
  point: number[];
  damage: number;
  critical: boolean;
}

function delivered(projectile: ProjectileType, rules: WeaponBalanceRules) {
  const scene = new THREE.Scene(), targets: BallisticTarget[] = [];
  const statuses = new Map<number, StatusState>(), hits: Observation[] = [];
  const random = seededRandom(7);
  let now = 0;
  const spec: WeaponSpec = { ...createWeaponSpec(projectile, 'fire'), secondaryElement: 'shock', spread: 0,
    statusChance: 0.35, statusPower: 0.25, speed: 60 };
  if (projectile === 'sticky') spec.fuse = 0.35;
  function target(id: number, position: [number, number, number], size: [number, number, number], critical = false) {
    const root = new THREE.Group(); root.position.set(...position);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial());
    mesh.userData.enemyId = id; mesh.userData.critical = critical;
    root.add(mesh); scene.add(root);
    targets.push({ id, root, radius: Math.max(...size) / 2 }); statuses.set(id, createStatusState());
  }
  if (projectile === 'scatter') target(1, [0, 1, -4], [5, 5, 1]);
  else {
    target(1, [0, 1, -4], [1, 1, 1], projectile === 'bullet');
    if (['rocket', 'sticky', 'arc'].includes(projectile)) target(2, [1.5, 1, -4], [0.8, 0.8, 0.8]);
    if (projectile === 'arc') target(3, [4, 1, -4], [0.8, 0.8, 0.8]);
  }
  const ballistics = new PlayerBallistics(scene, {
    targets: () => targets, occluders: () => [],
    hit(hit: BallisticHit) {
      hits.push({ id: hit.targetId, at: now, point: hit.point.toArray(), damage: hit.damage, critical: hit.critical });
      for (const element of getWeaponElements(hit.spec)) {
        if (element !== 'kinetic' && random() < hit.spec.statusChance) {
          applyStatus(statuses.get(hit.targetId)!, element, now, hit.damage * hit.spec.statusPower);
        }
      }
    },
  });
  const rawSpec = structuredClone(spec);
  try {
    ballistics.fire(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), spec,
      effectiveProjectileDamage(100, spec, rules));
    for (let frame = 1; frame <= 60; frame++) { now = frame / 60; ballistics.update(1 / 60); }
    const active = [...statuses].map(([id, state]) => ({ id, state: structuredClone(state) }));
    const ticks = [...statuses].flatMap(([id, state]) => advanceStatuses(state, now + 6).map(tick => ({ id, ...tick })));
    assert.deepEqual(spec, rawSpec, 'Firing and downstream delivery must not mutate the raw recipe');
    return { hits, active, ticks, spec };
  } finally {
    ballistics.clear();
    for (const { root } of targets) {
      root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
      });
      root.removeFromParent();
    }
  }
}

function near(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} differs from ${expected}`);
}

for (const projectile of ['bullet', 'scatter', 'rocket', 'sticky', 'arc'] as const) {
  test(`secondary cost travels once through actual ${projectile} contacts and delayed/secondary damage`, () => {
    const baseline = delivered(projectile, BASELINE_WEAPON_BALANCE);
    const combined = delivered(projectile, DEFAULT_WEAPON_BALANCE);
    assert.ok(baseline.hits.length > 0);
    assert.equal(combined.hits.length, baseline.hits.length, 'The cost must not change collision count or delivery');
    combined.hits.forEach((hit, index) => {
      const previous = baseline.hits[index];
      assert.deepEqual({ ...hit, damage: undefined }, { ...previous, damage: undefined });
      near(hit.damage, previous.damage * 0.85);
    });
    if (projectile === 'bullet') { assert.equal(combined.hits[0].critical, true); near(combined.hits[0].damage, 85); }
    if (projectile === 'scatter') { assert.equal(combined.hits.length, 6); near(combined.hits.reduce((sum, hit) => sum + hit.damage, 0), 510); }
    if (projectile === 'rocket') {
      assert.deepEqual(combined.hits.map(hit => hit.id), [1, 2]);
      near(combined.hits[0].damage, 85);
      assert.ok(combined.hits[1].damage < 85, 'The nearby target retains actual splash falloff');
    }
    if (projectile === 'sticky') {
      near(combined.hits[0].damage, 17);
      assert.ok(combined.hits.some(hit => hit.at > combined.hits[0].at + 0.3), 'The fuse must deliver a later hit');
      assert.ok(combined.hits.some(hit => hit.id === 2), 'The detonation must still reach its nearby target');
    }
    if (projectile === 'arc') {
      assert.deepEqual(combined.hits.map(hit => hit.id), [1, 2, 3]);
      near(combined.hits[0].damage, 85); near(combined.hits[1].damage, 49.3); near(combined.hits[2].damage, 28.594);
    }
    assert.equal(combined.spec.statusChance, baseline.spec.statusChance);
    assert.equal(combined.spec.statusPower, baseline.spec.statusPower);
    assert.ok(baseline.ticks.length > 0, 'The seeded fixture must exercise actual periodic status damage');
    combined.active.forEach(({ id, state }, index) => {
      const previous = baseline.active[index]; assert.equal(id, previous.id);
      assert.deepEqual(Object.keys(state), Object.keys(previous.state), 'The same seeded proc decisions must be retained');
      for (const element of Object.keys(state) as (keyof StatusState)[]) {
        const { power, ...timing } = state[element]!;
        const { power: originalPower, ...originalTiming } = previous.state[element]!;
        assert.deepEqual(timing, originalTiming, 'Status duration and tick schedule must remain unchanged');
        near(power, originalPower * 0.85);
      }
    });
    assert.equal(combined.ticks.length, baseline.ticks.length);
    combined.ticks.forEach((tick, index) => {
      assert.equal(tick.id, baseline.ticks[index].id); assert.equal(tick.effect, baseline.ticks[index].effect);
      near(tick.damage, baseline.ticks[index].damage * 0.85);
    });
  });
}

test('save/load retains raw dual-channel rolls and never compounds the effective damage cost', () => {
  const fixture = createEvaluationFixture('elemental-pressure');
  const original = structuredClone(fixture.state);
  let state = fixture.state;
  for (let reload = 0; reload < 3; reload++) {
    for (const mode of ['pilot', 'mech'] as const) {
      const item = state.inventory.find(item => item.id === state.loadouts[mode].weapon)!;
      const rawItem = original.inventory.find(candidate => candidate.id === item.id)!;
      assert.deepEqual(item.stats, rawItem.stats);
      assert.deepEqual(item.weapon, rawItem.weapon);
      near(effectiveProjectileDamage(item.stats.damage!, getWeaponSpec(item)), rawItem.stats.damage! * 0.85);
    }
    const restored = deserializeProgression(serializeProgression(state)); assert.ok(restored); state = restored;
  }
  assert.deepEqual(fixture.state, original, 'Effective calculations and saving must not rewrite fixture items');
});
