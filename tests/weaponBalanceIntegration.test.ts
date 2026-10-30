import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createWeaponSpec, getDamagePacketCount, getHitStatusChance, getHitStatusPower, getWeaponElements, getWeaponSpec, type ProjectileType, type WeaponSpec } from '../src/core/arsenal.ts';
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

function delivered(projectile: ProjectileType, rules: WeaponBalanceRules, triggers = 1, secondary: 'shock' | 'none' = 'shock') {
  const scene = new THREE.Scene(), targets: BallisticTarget[] = [];
  const statuses = new Map<number, StatusState>(), hits: Observation[] = [];
  const procs: { id: number; at: number; element: string; power: number }[] = [];
  // Keep the established seed and normal saved chance through the MIRV revision.
  const random = seededRandom(7);
  let now = 0;
  const spec: WeaponSpec = { ...createWeaponSpec(projectile, 'fire'), ...(secondary === 'shock' ? { secondaryElement: 'shock' as const } : {}), spread: 0,
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
  else if (projectile === 'cluster') {
    // Deliberate full-exposure accounting fixture: the carrier's short range
    // ends inside this enclosing target, and every physical bomblet remains
    // inside its bounds. Small-target misses/coverage are tested separately.
    target(1, [0, 1, -4], [100, 100, 100]);
    target(2, [1.5, 1, -0.8], [0.8, 0.8, 0.8]);
  } else {
    target(1, [0, 1, -4], [1, 1, 1], projectile === 'bullet');
    if (['rocket', 'sticky', 'arc'].includes(projectile)) target(2, [1.5, 1, -4], [0.8, 0.8, 0.8]);
    if (projectile === 'arc') target(3, [4, 1, -4], [0.8, 0.8, 0.8]);
  }
  const ballistics = new PlayerBallistics(scene, {
    targets: () => targets, occluders: () => [],
    hit(hit: BallisticHit) {
      hits.push({ id: hit.targetId, at: now, point: hit.point.toArray(), damage: hit.damage, critical: hit.critical });
      for (const element of getWeaponElements(hit.spec)) {
        if (element !== 'kinetic' && random() < getHitStatusChance(hit.spec)) {
          const power = getHitStatusPower(hit.damage, hit.spec);
          if (applyStatus(statuses.get(hit.targetId)!, element, now, power)) procs.push({ id: hit.targetId, at: now, element, power });
        }
      }
    },
  });
  const rawSpec = structuredClone(spec);
  try {
    for (let trigger = 0; trigger < triggers; trigger++) {
      ballistics.fire(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), spec,
        effectiveProjectileDamage(100, spec, rules), projectile === 'cluster' ? 0.8 : 100);
      const frames = projectile === 'cluster' ? 120 : 60, startedAt = now;
      for (let frame = 1; frame <= frames; frame++) { now = startedAt + frame / 60; ballistics.update(1 / 60); }
      if (projectile === 'cluster') assert.equal(ballistics.activeCount, 0, 'Observe the complete parent and staggered bomblet lifetime');
    }
    const active = [...statuses].map(([id, state]) => ({ id, state: structuredClone(state) }));
    const ticks = [...statuses].flatMap(([id, state]) => advanceStatuses(state, now + 6).map(tick => ({ id, ...tick })));
    assert.deepEqual(spec, rawSpec, 'Firing and downstream delivery must not mutate the raw recipe');
    return { hits, active, ticks, spec, procs };
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

for (const projectile of ['bullet', 'scatter', 'rocket', 'sticky', 'arc', 'cluster'] as const) {
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
    if (projectile === 'cluster') {
      const packets = getDamagePacketCount(combined.spec);
      const primary = combined.hits.filter(hit => hit.id === 1);
      const splash = combined.hits.filter(hit => hit.id === 2);
      assert.equal(primary.length, combined.spec.split!.count + 1, 'Parent plus bomblets must each deliver one splash packet');
      near(primary.reduce((sum, hit) => sum + hit.damage, 0), 114.75);
      primary.forEach(hit => { near(hit.damage, 114.75 / packets); assert.equal(hit.critical, false); });
      assert.ok(primary.slice(1).every(hit => hit.at > primary[0].at + 0.3), 'Bomblets must retain an actual delayed damage stage');
      assert.ok(splash.length > 0, 'An offset real target must receive actual blast exposure');
      assert.ok(splash.every(hit => hit.damage <= 114.75 / packets + 1e-8));
      assert.ok(splash.some(hit => hit.damage < 114.75 / packets), 'Offset blast damage must retain actual falloff');
      const mainStatus = combined.active.find(({ id }) => id === 1)!.state;
      // A normal 35% carrier chance does not promise both channels in one
      // trigger. The actual MIRV packet/recipient ordering leaves this primary sample
      // with fire only; multi-trigger coverage below exercises both normally.
      assert.deepEqual(Object.keys(mainStatus).sort(), ['fire']);
      near(mainStatus.fire!.power, 114.75 * combined.spec.statusPower);
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
    assert.equal(combined.procs.length, baseline.procs.length, 'Every actual seeded proc decision must remain identical');
    combined.procs.forEach((proc, index) => {
      const previous = baseline.procs[index];
      assert.deepEqual({ ...proc, power: undefined }, { ...previous, power: undefined });
      near(proc.power, previous.power * 0.85);
    });
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

test('one real MIRV trigger delivers exactly the boosted single or dual budget and derives status power once', () => {
  for (const secondary of ['none', 'shock'] as const) {
    const deliveredShot = delivered('cluster', DEFAULT_WEAPON_BALANCE, 1, secondary);
    const expectedBudget = secondary === 'none' ? 135 : 114.75;
    const primary = deliveredShot.hits.filter(hit => hit.id === 1);
    const packets = deliveredShot.spec.split!.count + 1;
    assert.equal(primary.length, packets);
    near(primary.reduce((sum, hit) => sum + hit.damage, 0), expectedBudget);
    primary.forEach(hit => near(hit.damage, expectedBudget / packets));
    assert.equal(deliveredShot.spec.statusChance, 0.35);
    assert.equal(deliveredShot.spec.statusPower, 0.25);
    assert.equal(deliveredShot.spec.secondaryElement, secondary === 'none' ? undefined : 'shock');
    const procs = deliveredShot.procs.filter(proc => proc.id === 1);
    assert.ok(procs.length > 0, 'Unchanged seed 7 actually applies a normal-chance primary proc');
    procs.forEach(proc => near(proc.power, expectedBudget * 0.25));
  }
});

test('normal-chance MIRV firing exercises both independent channels with the secondary cost applied once per event', () => {
  // A fixed 12-trigger observation retains seed 7, the saved .35 chance, and
  // ordinary application functions; neither channel is forced for coverage.
  const baseline = delivered('cluster', BASELINE_WEAPON_BALANCE, 12);
  const combined = delivered('cluster', DEFAULT_WEAPON_BALANCE, 12);
  assert.equal(combined.spec.statusChance, 0.35);
  assert.equal(combined.hits.length, baseline.hits.length);
  combined.hits.forEach((hit, index) => {
    const previous = baseline.hits[index];
    assert.deepEqual({ ...hit, damage: undefined }, { ...previous, damage: undefined });
    near(hit.damage, previous.damage * 0.85);
  });
  const packets = getDamagePacketCount(combined.spec);
  const primary = combined.hits.filter(hit => hit.id === 1);
  assert.equal(primary.length, 12 * packets);
  near(primary.reduce((sum, hit) => sum + hit.damage, 0), 12 * 114.75);
  assert.equal(combined.procs.length, baseline.procs.length);
  combined.procs.forEach((proc, index) => {
    const previous = baseline.procs[index];
    assert.deepEqual({ ...proc, power: undefined }, { ...previous, power: undefined });
    near(proc.power, previous.power * 0.85);
  });
  const primaryProcs = combined.procs.filter(proc => proc.id === 1);
  for (const element of ['fire', 'shock']) {
    const events = primaryProcs.filter(proc => proc.element === element);
    assert.ok(events.length > 0, `${element} must actually proc at the normal saved chance`);
    events.forEach(proc => near(proc.power, 114.75 * combined.spec.statusPower));
    assert.ok(events.some(proc => !primaryProcs.some(other => other.at === proc.at && other.element !== element)),
      `${element} must have its own successful outcome rather than a shared channel roll`);
  }
  assert.equal(combined.ticks.length, baseline.ticks.length);
  combined.ticks.forEach((tick, index) => {
    const previous = baseline.ticks[index];
    assert.deepEqual({ ...tick, damage: undefined }, { ...previous, damage: undefined });
    near(tick.damage, previous.damage * 0.85);
  });
});

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
