import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createWeaponSpec, type WeaponSpec } from '../src/core/arsenal.ts';
import { PlayerBallistics, type BallisticHit, type BallisticTarget, type BallisticPresentation } from '../src/rendering/PlayerBallistics.ts';

function fixture() {
  const scene = new THREE.Scene(), targets: BallisticTarget[] = [], covers: THREE.Object3D[] = [], hits: BallisticHit[] = [];
  const callbacks = { targets: () => targets, occluders: () => covers, hit: (hit: BallisticHit) => { hits.push(hit); } };
  const ballistics = new PlayerBallistics(scene, callbacks);
  function box(position: [number, number, number], size: [number, number, number], id?: number) {
    const root = new THREE.Group(); root.position.set(...position);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial()); root.add(mesh); scene.add(root);
    if (id === undefined) covers.push(root);
    else { mesh.userData.enemyId = id; targets.push({ id, root, radius: Math.max(...size) / 2 }); }
    return root;
  }
  const rounds = () => scene.children.filter(root => root.name.startsWith('player-projectile-') && root.name !== 'player-projectile-trail');
  return { scene, ballistics, hits, callbacks, rounds, box };
}

function splitCarrier(overrides: Partial<WeaponSpec> = {}): WeaponSpec {
  return { ...createWeaponSpec('cluster', 'kinetic'), projectile: 'rocket', spread: 0, ...overrides };
}

// The reusable forward-split engine remains compatible for other deliveries.
// Cluster-specific MIRV physics is covered in clusterMirv.test.ts.
test('generic split carrier flies as one carrier, pauses, then releases a finite deterministic child cone without recursive splitting', () => {
  function run() {
    const f = fixture();
    const recipe = splitCarrier({ speed: 20, split: { count: 6, delay: 0.2, spread: 0.32 }, fuse: 0.6 });
    f.ballistics.fire(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, 0, -1), recipe, 60);
    assert.equal(f.ballistics.activeCount, 1, 'A split carrier must not behave as muzzle scatter');
    const carrierScale = f.rounds()[0].scale.x;
    f.ballistics.update(0.1);
    assert.ok(Math.abs(f.rounds()[0].position.z + 2) < 1e-8);
    const paused = f.rounds()[0].position.toArray();
    for (const dt of [0, -1, NaN, Infinity]) f.ballistics.update(dt);
    assert.deepEqual(f.rounds()[0].position.toArray(), paused);
    f.ballistics.update(0.12);
    assert.equal(f.ballistics.activeCount, 6);
    const released = f.rounds().map(root => ({ position: root.position.toArray(), scale: root.scale.toArray() }));
    assert.ok(released.every(root => root.position[2] <= -4 + 1e-7 && root.scale.every(value => Math.abs(value - carrierScale * .42) < 1e-9)));
    f.ballistics.update(0.24);
    assert.equal(f.ballistics.activeCount, 6, 'Children must not create grandchildren after the carrier delay');
    f.ballistics.update(0);
    assert.equal(f.ballistics.activeCount, 6);
    f.ballistics.update(0.5);
    assert.equal(f.ballistics.activeCount, 0, 'Every child fuse must expire');
    assert.equal(f.hits.length, 0);
    f.ballistics.clear(); assert.equal(f.scene.children.length, 0);
    return released;
  }
  assert.deepEqual(run(), run());
});

test('impact releases children before the delay and preserves exactly one direct damage budget for pilot and mech', () => {
  for (const mode of ['pilot', 'mech'] as const) {
    const f = fixture(); f.box([0, 2, -4], [6, 6, 1], 1);
    const recipe = { ...createWeaponSpec('cluster', 'kinetic', mode), projectile: 'rocket' as const, spread: 0 };
    f.ballistics.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -1), recipe, 120);
    f.ballistics.update(0.08);
    assert.ok(f.hits.length > 0, 'Contact release must not wait for the airburst timer');
    f.ballistics.update(1);
    assert.equal(f.hits.length, recipe.split!.count, 'The carrier must add no damage event');
    assert.ok(f.hits.every(hit => Math.abs(hit.damage - 120 / recipe.split!.count) < 1e-9));
    assert.ok(Math.abs(f.hits.reduce((sum, hit) => sum + hit.damage, 0) - 120) < 1e-9);
    assert.equal(f.ballistics.activeCount, 0); f.ballistics.clear();
  }
});

test('split children inherit a deep frozen shot snapshot even if the source recipe changes in flight', () => {
  const f = fixture(); f.box([0, 2, -8], [8, 6, 1], 1);
  const recipe = splitCarrier({ element: 'fire', secondaryElement: 'shock', statusChance: 1, split: { count: 6, delay: 0.2, spread: 0 } });
  f.ballistics.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -1), recipe, 60);
  recipe.split!.count = 12; recipe.split!.delay = 5; recipe.element = 'ice'; recipe.secondaryElement = 'corrosive';
  f.ballistics.update(2);
  assert.equal(f.hits.length, 6);
  assert.ok(f.hits.every(hit => hit.damage === 10 && hit.spec.element === 'fire' && hit.spec.secondaryElement === 'shock'));
  assert.ok(f.hits.every(hit => Object.isFrozen(hit.spec) && Object.isFrozen(hit.spec.split)));
  assert.equal(f.hits[0].spec.split!.count, 6);
  assert.notEqual(f.hits[0].spec.split, recipe.split); f.ballistics.clear();
});

test('impact splits and child splash stay in front of thin cover, including a carrier fired inside it', () => {
  for (const originZ of [0, -3]) {
    const f = fixture(); f.box([0, 2, -3], [2, 6, .04]);
    f.box([1.5, 2, -2.4], [.8, .8, .8], 1); f.box([0, 2, -4], [.8, .8, .8], 2);
    f.ballistics.fire(new THREE.Vector3(0, 2, originZ), new THREE.Vector3(0, 0, -1), splitCarrier({ blastRadius: 4 }), 60);
    f.ballistics.update(1);
    if (originZ === 0) assert.ok(f.hits.some(hit => hit.targetId === 1), 'Exposed targets must receive actual child splash');
    assert.ok(f.hits.every(hit => hit.targetId !== 2), 'Neither carrier nor children may bypass the wall');
    assert.equal(f.ballistics.activeCount, 0); f.ballistics.clear();
  }
});

test('range exhaustion retires a pending carrier without phantom damage or children and limits child travel', () => {
  const f = fixture(); f.box([0, 2, -6], [1, 1, 1], 1);
  f.ballistics.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -1), splitCarrier({ blastRadius: 10 }), 60, 2);
  f.ballistics.update(1);
  assert.equal(f.hits.length, 0, 'An unreleased carrier must never explode for the full shot damage');
  assert.equal(f.ballistics.activeCount, 0);
  f.ballistics.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -1), splitCarrier({ speed: 20, blastRadius: 0, split: { count: 6, delay: .05, spread: 0 } }), 60, 2);
  f.ballistics.update(.5);
  assert.equal(f.hits.length, 0, 'Children must share the remaining shot range rather than gaining a new full range');
  assert.equal(f.ballistics.activeCount, 0); f.ballistics.clear();
});

test('clear during the first child hit cancels all other children and pending damage', () => {
  const f = fixture(); f.box([0, 2, -4], [6, 6, 1], 1);
  f.callbacks.hit = hit => { f.hits.push(hit); f.ballistics.clear(); };
  f.ballistics.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -1), splitCarrier(), 60);
  f.ballistics.update(2);
  assert.equal(f.hits.length, 1); assert.equal(f.hits[0].damage, 10);
  assert.equal(f.ballistics.activeCount, 0); assert.equal(f.ballistics.effectCount, 0);
  f.ballistics.update(2); assert.equal(f.hits.length, 1);
});

test('many splitting carriers respect projectile/effect caps and clear disposes every shot resource', () => {
  const f = fixture();
  const recipe = splitCarrier({ split: { count: 12, delay: .05, spread: .4 }, element: 'fire', secondaryElement: 'shock' });
  for (let index = 0; index < 80; index++) f.ballistics.fire(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, 0, -1), recipe, 60);
  f.ballistics.update(.1);
  assert.ok(f.ballistics.activeCount > 0 && f.ballistics.activeCount <= 192);
  assert.ok(f.ballistics.effectCount <= 256);
  f.ballistics.clear(); assert.equal(f.scene.children.length, 0);
  f.ballistics.update(2); assert.equal(f.ballistics.activeCount, 0);
});

test('generic timed split cannot stall at floating point residuals and preserves child flight across update schedules', () => {
  const observations: number[][][] = [];
  for (const dt of [1 / 60, 1 / 120, .05]) {
    const f = fixture();
    f.ballistics.fire(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, 0, -1), splitCarrier(), 60);
    for (let frame = 0; frame < Math.round(.6 / dt); frame++) f.ballistics.update(dt);
    assert.equal(f.ballistics.activeCount, 6, `${dt}: the default .45s delay must release children`);
    observations.push(f.rounds().map(root => root.position.toArray()));
    f.ballistics.update(1); assert.equal(f.ballistics.activeCount, 0); f.ballistics.clear();
  }
  for (const values of observations.slice(1)) values.forEach((point, index) => point.forEach((value, axis) => {
    assert.ok(Math.abs(value - observations[0][index][axis]) < 1e-7, 'Splitting must retain the unused step time');
  }));
});

test('clear inside a child presentation factory cannot revive disposed shots or deliver later damage', () => {
  const f = fixture(); f.box([0, 2, -4], [6, 6, 1], 1);
  let factories = 0, disposals = 0;
  const adapter: BallisticPresentation = {
    projectile() {
      const root = new THREE.Group();
      const geometry = new THREE.BoxGeometry(.1, .1, .1); geometry.addEventListener('dispose', () => disposals++);
      root.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
      if (++factories === 2) f.ballistics.clear();
      return root;
    },
    trail: () => new THREE.Group(), beam: () => new THREE.Group(), impact() {},
  };
  f.ballistics.setPresentation(adapter);
  f.ballistics.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -1), splitCarrier(), 60);
  f.ballistics.update(1);
  assert.equal(factories, 2); assert.equal(disposals, 2);
  assert.equal(f.ballistics.activeCount, 0); assert.equal(f.ballistics.effectCount, 0);
  assert.equal(f.hits.length, 0);
  f.ballistics.update(1); assert.equal(f.hits.length, 0);
});

test('clear from a generic child detonation presentation cancels its splash and every sibling', () => {
  const f = fixture(); f.box([0, 2, -1], [.2, .2, .2], 1);
  let detonations = 0;
  f.ballistics.setPresentation({
    projectile: () => new THREE.Group(), trail: () => new THREE.Group(), beam: () => new THREE.Group(),
    impact(event) { if (event.phase === 'detonate') { detonations++; f.ballistics.clear(); } },
  });
  f.ballistics.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -1), splitCarrier({ speed: 4, fuse: .05, split: { count: 2, delay: .05, spread: 0 } }), 60);
  f.ballistics.update(1);
  assert.equal(detonations, 1); assert.equal(f.hits.length, 0);
  assert.equal(f.ballistics.activeCount, 0); assert.equal(f.ballistics.effectCount, 0);
});
