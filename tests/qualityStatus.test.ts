import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import * as THREE from 'three';
import { decorateEnemy } from '../src/rendering/quality/actors.ts';
import { createQualityStatusCoating } from '../src/rendering/quality/statusCoating.ts';
import { createEncounterEnemy } from '../src/rendering/encounterEnemy.ts';
import type { ElementType } from '../src/core/arsenal.ts';

let originalDocument: PropertyDescriptor | undefined;
before(() => {
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {} }) }) },
  });
});
after(() => {
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else Reflect.deleteProperty(globalThis, 'document');
});

function physicalMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  root.traverse(object => { if (object instanceof THREE.Mesh && typeof object.userData.enemyId === 'number') result.push(object); });
  return result;
}
function displaySources(root: THREE.Object3D): THREE.Mesh[] {
  const display = root.getObjectByName('reference-sentry')!;
  const result: THREE.Mesh[] = [];
  display.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object.userData.comicOverlay) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.some(material => material.name === 'quality-paint' || material.name === 'quality-metal')) result.push(object);
  });
  return result;
}
function hitSnapshot(root: THREE.Object3D) {
  root.updateWorldMatrix(true, true);
  const result: { name: string; distance: number; critical: unknown; enemyId: unknown }[][] = [];
  for (const y of [.35, 1.4, 2.25, 2.8]) for (const x of [-.6, 0, .6]) {
    const origin = new THREE.Vector3(x, y, 5); root.localToWorld(origin);
    const direction = new THREE.Vector3(0, 0, -1).transformDirection(root.matrixWorld);
    result.push(new THREE.Raycaster(origin, direction).intersectObject(root, true)
      .map(hit => ({ name: hit.object.name, distance: hit.distance, critical: hit.object.userData.critical, enemyId: hit.object.userData.enemyId })));
  }
  return result;
}

test('current encounter flanker coats authored armor while preserving every gameplay hit surface', () => {
  const visual = createEncounterEnemy(72, 'flanker');
  visual.group.position.set(4, 0, -7); visual.group.rotation.y = -.34;
  visual.update(.016, 2, { phase: 'attack', phaseProgress: .25, moving: false, shieldFraction: 0, weakPointOpen: false, hitReaction: 0 });
  const physical = physicalMeshes(visual.group);
  const before = hitSnapshot(visual.group);
  const geometry = physical.map(mesh => mesh.geometry);
  const positions = physical.map(mesh => Array.from(mesh.geometry.getAttribute('position').array));
  const matrices = physical.map(mesh => mesh.matrixWorld.toArray());
  const ids = physical.map(mesh => ({ ...mesh.userData }));
  const originalMaterials = physical.map(mesh => mesh.material);
  const actor = decorateEnemy(visual.group, 72);
  const proxies = physical.map(mesh => mesh.material);
  const sources = displaySources(visual.group);
  assert.ok(sources.length >= 6, 'Reference armor provides independently articulated coat surfaces');
  const statuses: Exclude<ElementType, 'kinetic'>[] = ['corrosive', 'fire', 'ice', 'shock', 'radiation', 'gravity', 'adhesive'];
  const coatings = statuses.map(element => createQualityStatusCoating(visual.group, element));
  for (const coating of coatings) {
    assert.equal(coating.overlays.length, sources.length, 'Every status binds to the authored paint/metal surfaces');
    for (const overlay of coating.overlays) {
      const source = overlay.parent as THREE.Mesh;
      assert.ok(sources.includes(source));
      assert.ok(!physical.includes(source), 'Invisible hit proxies must never receive display coatings');
      assert.equal(overlay.geometry, source.geometry, 'Coating conforms to the exact authored armor vertices');
      assert.deepEqual(overlay.position.toArray(), [0, 0, 0]);
      assert.deepEqual(overlay.quaternion.toArray(), [0, 0, 0, 1]);
      assert.deepEqual(overlay.scale.toArray(), [1, 1, 1]);
      assert.equal(overlay.userData.enemyId, undefined);
      const shader = overlay.material as THREE.ShaderMaterial;
      assert.equal(shader.uniforms.normalOffset.value, .005);
      assert.equal(shader.depthTest, true); assert.equal(shader.depthWrite, false);
    }
  }
  actor.update(2.1, .016, 2.6, .025, .05);
  assert.deepEqual(hitSnapshot(visual.group), before, 'Authored display animation and stacked status shells cannot change ballistics');
  physical.forEach((mesh, index) => {
    assert.equal(mesh.geometry, geometry[index]); assert.equal(mesh.material, proxies[index]);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('position').array), positions[index]);
    assert.deepEqual(mesh.matrixWorld.toArray(), matrices[index]); assert.deepEqual(mesh.userData, ids[index]);
    assert.ok(mesh.children.every(child => !child.userData.elementCoating));
  });
  sources.forEach(source => assert.equal(Object.hasOwn(source.userData, 'enemyId'), false, 'Temporary selection tags are removed'));
  let geometryDisposals = 0;
  sources.forEach(source => source.geometry.addEventListener('dispose', () => geometryDisposals++));
  coatings.forEach(coating => { coating.dispose(); coating.dispose(); });
  assert.equal(geometryDisposals, 0, 'Coatings borrow authored geometry and must never destroy it');
  actor.dispose(); physical.forEach((mesh, index) => assert.equal(mesh.material, originalMaterials[index]));
  visual.dispose();
});

test('coating clocks freeze with dt zero and cleanup leaves the reference model usable', () => {
  const visual = createEncounterEnemy(13, 'flanker');
  const actor = decorateEnemy(visual.group, 13);
  const before = hitSnapshot(visual.group);
  const coating = createQualityStatusCoating(visual.group, 'shock');
  coating.update(.016, 4);
  const materials = coating.overlays.map(mesh => mesh.material as THREE.ShaderMaterial);
  assert.ok(materials.every(material => material.uniforms.time.value === 4));
  coating.update(0, 99);
  assert.ok(materials.every(material => material.uniforms.time.value === 4));
  let disposed = 0;
  materials.forEach(material => material.addEventListener('dispose', () => disposed++));
  coating.dispose(); coating.dispose();
  assert.equal(disposed, materials.length);
  assert.deepEqual(hitSnapshot(visual.group), before);
  const kinetic = createQualityStatusCoating(visual.group, 'kinetic');
  assert.equal(kinetic.overlays.length, 0);
  displaySources(visual.group).forEach(source => assert.equal(Object.hasOwn(source.userData, 'enemyId'), false));
  kinetic.dispose(); actor.dispose(); visual.dispose();
});

test('temporary display tags restore previous values even when a coating source fails', () => {
  const visual = createEncounterEnemy(19, 'flanker');
  const actor = decorateEnemy(visual.group, 19);
  const sources = displaySources(visual.group);
  sources[0].userData.enemyId = undefined;
  sources[1].userData.enemyId = 12345;
  const geometry = sources[0].geometry;
  sources[0].geometry = { getAttribute() { throw new Error('invalid-coating-source'); } } as unknown as THREE.BufferGeometry;
  assert.throws(() => createQualityStatusCoating(visual.group, 'fire'), /invalid-coating-source/);
  assert.equal(Object.hasOwn(sources[0].userData, 'enemyId'), true);
  assert.equal(sources[0].userData.enemyId, undefined);
  assert.equal(sources[1].userData.enemyId, 12345);
  sources.slice(2).forEach(source => assert.equal(Object.hasOwn(source.userData, 'enemyId'), false));
  sources[0].geometry = geometry; delete sources[0].userData.enemyId; delete sources[1].userData.enemyId;
  actor.dispose(); visual.dispose();
});

test('undecorated enemies retain the existing status renderer', () => {
  const visual = createEncounterEnemy(27, 'heavy');
  const sources = physicalMeshes(visual.group);
  const before = hitSnapshot(visual.group);
  const coating = createQualityStatusCoating(visual.group, 'ice');
  assert.equal(coating.overlays.length, sources.length);
  coating.overlays.forEach(overlay => assert.ok(sources.includes(overlay.parent as THREE.Mesh)));
  assert.deepEqual(hitSnapshot(visual.group), before);
  coating.dispose(); visual.dispose();
});
