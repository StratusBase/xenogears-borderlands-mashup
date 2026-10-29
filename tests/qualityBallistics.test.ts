import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createWeaponSpec, type ProjectileType } from '../src/core/arsenal.ts';
import { PlayerBallistics, type BallisticHit, type BallisticTarget } from '../src/rendering/PlayerBallistics.ts';
import { ElementCoating } from '../src/rendering/ElementCoating.ts';
import { decorateEnemy, type ActorPresentation } from '../src/rendering/quality/actors.ts';

/** Same seven authored combat boxes used by Game.makeEnemy, without its renderer/UI. */
function enemy(scene: THREE.Scene, id: number, at: [number, number, number], heavy = false): BallisticTarget {
  const root = new THREE.Group(); root.position.set(...at); root.scale.setScalar(heavy ? 1.85 : 1);
  const add = (size: [number, number, number], at: [number, number, number], critical = false) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ color: 0x536577 }));
    mesh.position.set(...at); mesh.userData.enemyId = id; mesh.userData.critical = critical; root.add(mesh);
  };
  add([1, 1.1, .8], [0, 1.45, 0]); add([.65, .55, .65], [0, 2.25, 0], true);
  add([.48, .14, .05], [0, 2.27, .34], true); add([.32, .95, .4], [-.33, .45, 0]);
  add([.32, .95, .4], [.33, .45, 0]); add([.28, .35, .95], [.73, 1.6, .25]);
  add([.3, .75, .4], [-.68, 1.35, 0]); scene.add(root);
  return { id, root, radius: heavy ? 1.6 : .85 };
}

function eventSnapshot(event: BallisticHit) {
  return { targetId: event.targetId, point: event.point.toArray(), direction: event.direction.toArray(), damage: event.damage, critical: event.critical, spec: structuredClone(event.spec) };
}

function run(options: { quality: boolean; projectile: ProjectileType; aim: 'head' | 'body'; heavy?: boolean; cover?: boolean; coating?: boolean; splash?: boolean }) {
  const scene = new THREE.Scene(), hits: ReturnType<typeof eventSnapshot>[] = [], occluders: THREE.Object3D[] = [];
  const main = enemy(scene, 17, [0, 0, options.splash ? -4 : -8], options.heavy);
  const targets = [main];
  if (options.splash) targets.push(enemy(scene, 23, [1.5, 0, -2.4], false));
  if (options.cover) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(options.splash ? 2 : 12, 7, .2), new THREE.MeshBasicMaterial());
    wall.position.set(0, 2.5, -3); scene.add(wall); occluders.push(wall);
  }
  const handles: ActorPresentation[] = [];
  if (options.quality) for (const target of targets) handles.push(decorateEnemy(target.root, target.id, options.heavy));
  const coatings = options.coating ? targets.map(target => new ElementCoating(target.root, 'corrosive', { scope: 'enemy' })) : [];
  // Articulated presentation and active conditions must not move a combat proxy.
  handles.forEach(handle => handle.update(3.8, .05, 2.6, .025, .09));
  coatings.forEach(coating => coating.update(.05, 3.8));
  const scale = options.heavy ? 1.85 : 1;
  const height = (options.aim === 'head' ? 2.27 : 1.45) * scale;
  const ballistics = new PlayerBallistics(scene, { targets: () => targets, occluders: () => occluders, hit: hit => hits.push(eventSnapshot(hit)) });
  const spec = { ...createWeaponSpec(options.projectile, 'kinetic'), spread: 0, speed: 120, blastRadius: options.splash ? 4 : 2.6 };
  ballistics.fire(new THREE.Vector3(0, height, 0), new THREE.Vector3(0, 0, -1), spec, 37);
  ballistics.update(.35);
  ballistics.clear(); coatings.forEach(coating => coating.dispose()); handles.forEach(handle => { handle.dispose(); handle.dispose(); });
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose());
  });
  return hits;
}

for (const projectile of ['bullet', 'slug', 'beam', 'rocket'] as const) {
  for (const aim of ['head', 'body'] as const) {
    test(`${projectile} ${aim}: full ballistic events stay identical with animated reference art and active coating`, () => {
      for (const heavy of [false, true]) {
        const baseline = run({ quality: false, projectile, aim, heavy, coating: true });
        const quality = run({ quality: true, projectile, aim, heavy, coating: true });
        assert.ok(baseline.length > 0, 'Fixture must receive real combat damage');
        assert.deepEqual(quality, baseline, 'Target, exact point/direction, damage, critical flag and full weapon spec must match');
        if (projectile !== 'rocket') assert.equal(baseline[0].critical, aim === 'head');
      }
    });
  }
  test(`${projectile}: the same cover blocks legacy and reference targets`, () => {
    const baseline = run({ quality: false, projectile, aim: 'body', cover: true });
    assert.equal(baseline.length, 0);
    assert.deepEqual(run({ quality: true, projectile, aim: 'body', cover: true }), baseline);
  });
}

test('rocket splash reaches the same exposed target and cannot cross cover after the art upgrade', () => {
  const baseline = run({ quality: false, projectile: 'rocket', aim: 'body', splash: true, cover: true });
  assert.ok(baseline.some(hit => hit.targetId === 23)); assert.ok(baseline.every(hit => hit.targetId !== 17));
  assert.deepEqual(run({ quality: true, projectile: 'rocket', aim: 'body', splash: true, cover: true }), baseline);
});

test('enemy presentation can toggle repeatedly while retaining collision geometry/material identity', () => {
  const scene = new THREE.Scene(), target = enemy(scene, 11, [0, 0, -8]);
  const originalMeshes = target.root.children.map(object => object as THREE.Mesh);
  const originals = originalMeshes.map(mesh => ({ geometry: mesh.geometry, material: mesh.material, matrix: mesh.matrix.toArray(), raycast: mesh.raycast }));
  for (let cycle = 0; cycle < 5; cycle++) {
    const art = decorateEnemy(target.root, target.id);
    art.update(cycle + .2, .05, 2.6);
    art.dispose(); art.dispose();
    assert.deepEqual(target.root.children, originalMeshes);
    originalMeshes.forEach((mesh, index) => {
      assert.equal(mesh.geometry, originals[index].geometry); assert.equal(mesh.material, originals[index].material);
      assert.equal(mesh.raycast, originals[index].raycast);
    });
  }
});
