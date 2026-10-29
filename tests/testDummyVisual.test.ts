import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import * as THREE from 'three';
import { createTestDummy } from '../src/rendering/testDummy.ts';
import { PlayerBallistics, type BallisticHit } from '../src/rendering/PlayerBallistics.ts';
import { createWeaponSpec } from '../src/core/arsenal.ts';

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
before(() => Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) },
}));
after(() => { if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document'); });

test('the permanent dummy is grounded, distinct from an enemy, with untagged stand/nameplate and local anchors', () => {
  const dummy = createTestDummy(-1);
  dummy.group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(dummy.group);
  assert.ok(Math.abs(bounds.min.y) < 1e-7);
  assert.equal(dummy.group.userData.fixedTestDummy, true);
  assert.equal(dummy.group.getObjectByName('dummy-grounded-base')!.userData.enemyId, undefined);
  assert.equal(dummy.group.getObjectByName('dummy-nameplate')!.userData.enemyId, undefined);
  assert.equal(dummy.group.getObjectByName('enemy-vitals'), undefined);
  assert.equal(dummy.group.getObjectByName('dummy-body-target')!.userData.enemyId, -1);
  assert.ok(dummy.aimPoint.y > bounds.min.y && dummy.damageAnchor.y < bounds.max.y);
  dummy.dispose();
});

test('real pilot/body and mech-height shots hit the fixed target, and only red centers produce critical hits', () => {
  const dummy = createTestDummy(-1), scene = new THREE.Scene(), hits: BallisticHit[] = [];
  dummy.group.position.set(0, 0, -12); scene.add(dummy.group);
  const ballistics = new PlayerBallistics(scene, {
    targets: () => [{ id: -1, root: dummy.group, radius: dummy.radius }], occluders: () => [], hit: hit => hits.push(hit),
  });
  const beam = { ...createWeaponSpec('beam', 'kinetic'), spread: 0 };
  for (const [x, y, critical] of [[0, 1.8, false], [0, 2.3, true], [0.45, 2.3, false], [0, 4.35, true], [0.40, 4.35, false]] as const) {
    const before = hits.length;
    ballistics.fire(new THREE.Vector3(x, y, 0), new THREE.Vector3(0, 0, -1), beam, 20);
    assert.equal(hits.length, before + 1, `The physical target should accept a shot at ${x},${y}`);
    assert.equal(hits.at(-1)!.targetId, -1);
    assert.equal(hits.at(-1)!.critical, critical, `Critical classification should match the actual front-facing red center at ${x},${y}`);
  }
  const before = hits.length;
  for (const y of [0.1, 5.3]) ballistics.fire(new THREE.Vector3(0, y, 0), new THREE.Vector3(0, 0, -1), beam, 20);
  assert.equal(hits.length, before, 'The stand and nameplate cannot report damage');
  ballistics.clear(); dummy.dispose();
});

test('dummy disposal releases only owned resources once and leaves shared painted textures alive', () => {
  const dummy = createTestDummy(-1), scene = new THREE.Scene(); scene.add(dummy.group);
  const owned = dummy.group.userData.ownedTextures as THREE.Texture[];
  let signsDisposed = 0, sharedDisposed = 0, geometryDisposed = 0;
  owned.forEach(texture => texture.addEventListener('dispose', () => signsDisposed++));
  const body = dummy.group.getObjectByName('dummy-body-target') as THREE.Mesh<THREE.BoxGeometry, THREE.MeshToonMaterial>;
  body.material.map!.addEventListener('dispose', () => sharedDisposed++);
  body.geometry.addEventListener('dispose', () => geometryDisposed++);
  dummy.dispose(); dummy.dispose();
  assert.equal(signsDisposed, 1);
  assert.equal(geometryDisposed, 1);
  assert.equal(sharedDisposed, 0);
  assert.equal(dummy.group.parent, null);
});
