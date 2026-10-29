import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createWeaponSpec, type ProjectileType, type WeaponSpec } from '../src/core/arsenal.ts';
import { PlayerBallistics, ballisticPelletDirections, reflectBallisticVelocity, steerBallisticVelocity, type BallisticHit, type BallisticTarget } from '../src/rendering/PlayerBallistics.ts';

function fixture() {
  const scene = new THREE.Scene(), targets: BallisticTarget[] = [], covers: THREE.Object3D[] = [], hits: BallisticHit[] = [];
  const callbacks = { targets: () => targets, occluders: () => covers, hit: (event: BallisticHit) => { hits.push(event); } };
  const ballistics = new PlayerBallistics(scene, callbacks);
  const target = (id: number, position: [number, number, number], size: [number, number, number] = [1, 1, 1], critical = false) => {
    const root = new THREE.Group(); root.position.set(...position);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial());
    mesh.userData.enemyId = id; mesh.userData.critical = critical; root.add(mesh); scene.add(root);
    const result = { id, root, radius: Math.max(...size) / 2 }; targets.push(result);
    return { ...result, mesh };
  };
  const cover = (position: [number, number, number], size: [number, number, number]) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial());
    mesh.position.set(...position); covers.push(mesh); scene.add(mesh); return mesh;
  };
  return { scene, targets, covers, hits, callbacks, ballistics, target, cover };
}

function spec(projectile: ProjectileType, overrides: Partial<WeaponSpec> = {}): WeaponSpec {
  return { ...createWeaponSpec(projectile, 'kinetic'), spread: 0, ...overrides };
}

test('swept fast rounds hit actual weakpoint geometry once without applying the critical multiplier', () => {
  const f = fixture();
  f.target(7, [0, 2, -8], [1, 1, 0.08], true);
  f.ballistics.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -1), spec('bullet', { speed: 260 }), 25);
  assert.equal(f.hits.length, 0, 'Physical rounds must travel before impact');
  f.ballistics.update(0.1);
  assert.equal(f.hits.length, 1);
  assert.equal(f.hits[0].targetId, 7);
  assert.equal(f.hits[0].critical, true);
  assert.equal(f.hits[0].damage, 25, 'Root applies the critical multiplier');
  assert.ok(Math.abs(f.hits[0].point.z + 7.96) < 0.00001);
  f.ballistics.update(1);
  assert.equal(f.hits.length, 1);
  f.ballistics.clear();
});

test('thin cover blocks swept rounds and even a muzzle already inside the cover', () => {
  const f = fixture();
  f.target(1, [0, 1, -8]);
  const wall = f.cover([0, 1, -3], [3, 3, 0.04]);
  const originalMaterial = wall.material;
  for (const originZ of [0, -3]) {
    f.ballistics.fire(new THREE.Vector3(0, 1, originZ), new THREE.Vector3(0, 0, -1), spec('bullet', { speed: 260 }), 30);
    f.ballistics.update(0.2);
  }
  assert.equal(f.hits.length, 0);
  assert.equal(f.ballistics.activeCount, 0);
  assert.equal(wall.material, originalMaterial, 'Physics must restore original render materials');
  f.ballistics.clear();
});

test('enemy decoration cannot accept hits without the matching enemyId and overlay tags are excluded', () => {
  const f = fixture();
  const enemy = f.target(9, [0, 1, -6]);
  const aura = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 1), new THREE.MeshBasicMaterial());
  aura.position.z = 3;
  aura.userData.comicOverlay = true;
  aura.userData.enemyId = 9;
  enemy.root.add(aura);
  f.ballistics.fire(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), spec('beam'), 20);
  assert.equal(f.hits.length, 1);
  assert.ok(Math.abs(f.hits[0].point.z + 5.5) < 0.00001, 'The aura must not intercept the beam');
  enemy.mesh.userData.enemyId = 100;
  f.ballistics.fire(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), spec('beam'), 20);
  assert.equal(f.hits.length, 1);
  f.ballistics.clear();
});

test('scatter retains the core per-projectile damage budget instead of dividing it a second time', () => {
  const f = fixture(); f.target(1, [0, 2, -6], [5, 5, 1]);
  f.ballistics.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -1), spec('scatter', { pellets: 6, spread: 0 }), 10);
  f.ballistics.update(0.15);
  assert.equal(f.hits.length, 6);
  assert.equal(f.hits.reduce((sum, hit) => sum + hit.damage, 0), 60);
  assert.ok(f.hits.every(hit => hit.damage === 10));
  f.ballistics.clear();
});

test('pellet cones are deterministic and centered, while successive single shots vary within their accuracy cone', () => {
  const aim = new THREE.Vector3(0, 0, -1);
  const pellets = ballisticPelletDirections(aim, 8, 0.18);
  assert.deepEqual(pellets[0].toArray(), aim.toArray());
  assert.ok(pellets.every(direction => direction.angleTo(aim) <= 0.1800001));
  assert.deepEqual(pellets.map(value => value.toArray()), ballisticPelletDirections(aim, 8, 0.18).map(value => value.toArray()));
  const shotPositions = () => {
    const f = fixture();
    for (let index = 0; index < 8; index++) f.ballistics.fire(new THREE.Vector3(0, 10, 0), aim, spec('bullet', { speed: 40, spread: 0.18 }), 1);
    f.ballistics.update(0.1);
    const result = f.scene.children.filter(object => object.name === 'player-projectile-bullet').map(object => object.position.clone().sub(new THREE.Vector3(0, 10, 0)));
    assert.ok(result.every(vector => vector.angleTo(aim) <= 0.1800001));
    assert.equal(new Set(result.map(vector => vector.toArray().map(value => value.toFixed(6)).join(','))).size, 8);
    f.ballistics.clear();
    return result.map(vector => vector.toArray());
  };
  assert.deepEqual(shotPositions(), shotPositions());
});

test('slug and spike flight visibly drops under gravity while ordinary rounds remain level', () => {
  const f = fixture();
  for (const projectile of ['slug', 'spike', 'bullet'] as const) f.ballistics.fire(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, 0, -1), spec(projectile, { speed: 30 }), 5);
  f.ballistics.update(0.5);
  assert.ok(f.scene.getObjectByName('player-projectile-slug')!.position.y < 4);
  assert.ok(f.scene.getObjectByName('player-projectile-spike')!.position.y < 4.2);
  assert.equal(f.scene.getObjectByName('player-projectile-bullet')!.position.y, 5);
  f.ballistics.clear();
});

for (const projectile of ['ricochet', 'disc'] as const) {
  test(`${projectile} reflects from an actual wall normal and hits a secondary line of fire`, () => {
    const f = fixture();
    f.cover([2, 1, -2], [0.1, 5, 10]);
    f.target(2, [-2, 1, -6], [1.4, 1.4, 1.4]);
    f.ballistics.fire(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, -1), spec(projectile, { speed: 40, bounces: 1 }), 20);
    f.ballistics.update(0.5);
    assert.equal(f.hits.length, 1);
    assert.equal(f.hits[0].targetId, 2);
    assert.equal(f.hits[0].damage, 17);
    assert.ok(f.hits[0].direction.x < 0);
    f.ballistics.clear();
  });
}

test('homing turns at a bounded rate, preserves speed, and actually intercepts an off-axis target', () => {
  const velocity = new THREE.Vector3(0, 0, -20), desired = new THREE.Vector3(10, 0, 0);
  const steered = steerBallisticVelocity(velocity, desired, 0.1);
  assert.ok(Math.abs(steered.length() - 20) < 1e-8);
  assert.ok(steered.angleTo(velocity) <= 0.1000001);
  assert.deepEqual(reflectBallisticVelocity(new THREE.Vector3(2, 0, -3), new THREE.Vector3(-10, 0, 0)).toArray(), [-2, 0, -3]);
  const f = fixture(); f.target(1, [3, 1, -10]);
  f.ballistics.fire(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), spec('homing', { speed: 20, tracking: 4 }), 20);
  f.ballistics.update(0.8);
  assert.equal(f.hits.length, 1);
  assert.equal(f.hits[0].targetId, 1);
  f.ballistics.clear();
});

test('sticky charges follow target-local attachments and fall away when that target dies', () => {
  const f = fixture(), target = f.target(1, [0, 1, -3]);
  f.ballistics.fire(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), spec('sticky', { speed: 20, fuse: 0.5 }), 20);
  f.ballistics.update(0.15);
  assert.equal(f.hits.length, 1);
  assert.equal(f.hits[0].damage, 4);
  const charge = f.scene.getObjectByName('player-projectile-sticky')!;
  const attached = charge.position.clone();
  target.root.position.x = 2;
  f.ballistics.update(0.1);
  assert.ok(Math.abs(charge.position.x - attached.x - 2) < 0.00001);
  const beforeFall = charge.position.y;
  f.targets.splice(0); target.root.removeFromParent();
  f.ballistics.update(0.1);
  assert.ok(charge.position.y < beforeFall);
  f.ballistics.update(0.5);
  assert.equal(f.ballistics.activeCount, 0);
  assert.equal(f.hits.length, 1, 'A dead target must never receive delayed damage');
  f.ballistics.clear();
});

test('a sticky fuse follows the newest target position before detonating and does not advance while paused', () => {
  const f = fixture(), target = f.target(1, [0, 1, -3]);
  f.ballistics.fire(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), spec('sticky', { speed: 20, fuse: 0.2 }), 20);
  f.ballistics.update(0.15);
  f.ballistics.update(0);
  assert.equal(f.hits.length, 1);
  target.root.position.x = 3;
  f.ballistics.update(0.3);
  assert.equal(f.hits.length, 2);
  assert.equal(f.hits[1].critical, false, 'Splash is never a weakpoint hit');
  assert.ok(Math.abs(f.hits[1].point.x - 3) < 0.00001);
  assert.equal(f.ballistics.activeCount, 0);
  f.ballistics.clear();
});

test('rocket splash reaches exposed nearby targets but cannot damage through the impact wall', () => {
  const f = fixture();
  f.cover([0, 1, -3], [2, 3, 0.2]);
  f.target(1, [1.5, 1, -2.4], [0.8, 0.8, 0.8]);
  f.target(2, [0, 1, -4], [0.8, 0.8, 0.8]);
  f.ballistics.fire(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), spec('rocket', { speed: 30, blastRadius: 4 }), 20);
  f.ballistics.update(0.2);
  assert.ok(f.hits.some(hit => hit.targetId === 1));
  assert.ok(f.hits.every(hit => hit.targetId !== 2));
  assert.ok(f.hits.every(hit => hit.damage > 0 && hit.damage < 20 && !hit.critical));
  f.ballistics.clear();
});

test('long update intervals advance the full sticky fuse through bounded collision substeps', () => {
  const f = fixture(); f.target(1, [0, 1, -3]);
  f.ballistics.fire(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), spec('sticky', { speed: 20, fuse: 2.5 }), 20);
  f.ballistics.update(0.15);
  assert.equal(f.hits.length, 1);
  f.ballistics.update(2.6);
  assert.equal(f.hits.length, 2);
  assert.equal(f.ballistics.activeCount, 0);
  f.ballistics.clear();
});

test('short electric arcs chain to visible secondary targets and stop at cover', () => {
  const f = fixture();
  f.target(1, [0, 1, -4]); f.target(2, [3, 1, -4]); f.target(3, [-3, 1, -4]);
  f.cover([-1.5, 1, -3.75], [0.2, 3, 2]);
  f.ballistics.fire(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), spec('arc', { element: 'shock' }), 20);
  assert.deepEqual(f.hits.map(hit => hit.targetId), [1, 2]);
  assert.ok(Math.abs(f.hits[1].damage - 11.6) < 0.00001);
  assert.equal(f.hits[1].critical, false);
  f.ballistics.clear();
});

test('beam cores and halos occupy the same actual segment and use depth-tested overlay geometry', () => {
  const f = fixture();
  f.ballistics.fire(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), spec('beam'), 20, 30);
  const beam = f.scene.getObjectByName('player-ray-beam')!;
  assert.equal(beam.userData.comicOverlay, true);
  assert.equal(beam.children.length, 2);
  assert.deepEqual(beam.children[0].position.toArray(), beam.children[1].position.toArray());
  beam.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material as THREE.Material;
    assert.equal(material.depthTest, true);
    assert.equal(material.depthWrite, false);
  });
  f.ballistics.clear();
});

test('clear during a hit callback stops the remaining pellets and all delayed effects', () => {
  const f = fixture(); f.target(1, [0, 1, -4]);
  f.callbacks.hit = event => { f.hits.push(event); f.ballistics.clear(); };
  f.ballistics.fire(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), spec('beam', { pellets: 3 }), 10);
  assert.equal(f.hits.length, 1);
  assert.equal(f.ballistics.activeCount, 0);
  assert.equal(f.ballistics.effectCount, 0);
  f.ballistics.update(1);
  assert.equal(f.hits.length, 1);
});

test('projectile/effect caps and clear bound scene resources without poisoning later shots', () => {
  const f = fixture();
  for (let index = 0; index < 250; index++) f.ballistics.fire(new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, 0, -1), spec('bullet', { speed: 4 }), 1);
  assert.equal(f.ballistics.activeCount, 192);
  f.ballistics.update(1);
  assert.ok(f.ballistics.effectCount <= 256);
  f.ballistics.clear();
  assert.equal(f.scene.children.length, 0);
  f.ballistics.fire(new THREE.Vector3(NaN, 0, 0), new THREE.Vector3(0, 0, -1), spec('bullet'), 1);
  assert.equal(f.ballistics.activeCount, 0);
  f.target(1, [0, 1, -3]);
  f.ballistics.fire(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), spec('bullet'), 1);
  f.ballistics.update(0.1);
  assert.equal(f.hits.length, 1);
  f.ballistics.clear();
});
