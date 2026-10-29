import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { ElementCoating } from '../src/rendering/ElementCoating.ts';
import { ElementEffects } from '../src/rendering/ElementEffects.ts';

function surface(name: string, parent: THREE.Object3D): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshToonMaterial({ color: 0xb9ad82 }));
  mesh.name = name; parent.add(mesh); return mesh;
}

test('enemy coating snapshots only tagged physical armor and skips overlays and untagged decorations', () => {
  const root = new THREE.Group();
  const armor = surface('armor', root); armor.userData.enemyId = 4;
  const weakpoint = surface('weakpoint', root); weakpoint.userData.enemyId = 4; weakpoint.userData.critical = true;
  surface('untagged-decoration', root);
  const invalid = surface('string-id', root); invalid.userData.enemyId = '4';
  const bar = surface('healthbar', root); bar.userData.enemyId = 4; bar.userData.comicOverlay = true;
  const overlayParent = new THREE.Group(); overlayParent.userData.comicOverlay = true; root.add(overlayParent);
  const glint = surface('overlay-descendant', overlayParent); glint.userData.enemyId = 4;
  const coating = new ElementCoating(root, 'corrosive');
  assert.equal(coating.overlays.length, 2);
  assert.deepEqual(coating.overlays.map(mesh => mesh.parent), [armor, weakpoint]);
  const second = new ElementCoating(root, 'ice');
  assert.equal(second.overlays.length, 2, 'Another active coating must not recursively coat earlier overlays');
  coating.dispose(); second.dispose(); assert.equal(armor.children.length, 0);
});

test('equipment coating obeys nearest visual ownership, excluding support hands and other equipment slots', () => {
  const root = new THREE.Group(); root.userData.visualOwner = 'body';
  surface('jacket', root);
  const weapon = new THREE.Group(); weapon.userData.visualOwner = 'weapon'; root.add(weapon);
  const receiver = surface('receiver', weapon), barrel = surface('barrel', weapon);
  const gripHand = new THREE.Group(); gripHand.userData.visualOwner = 'body'; weapon.add(gripHand); surface('hand', gripHand);
  for (const slot of ['shield', 'reactor', 'legs']) {
    const module = new THREE.Group(); module.userData.visualOwner = slot; weapon.add(module); surface(slot, module);
  }
  const coating = new ElementCoating(root, 'shock', { scope: 'equipment', intensity: .6 });
  assert.deepEqual(coating.overlays.map(mesh => mesh.parent), [receiver, barrel]);
  for (const overlay of coating.overlays) assert.equal((overlay.material as THREE.ShaderMaterial).uniforms.intensity.value, .6);
  coating.dispose();
});

test('surface overlays borrow geometry, keep true physical bounds and do not mutate the source material or transforms', () => {
  const root = new THREE.Group(); root.scale.set(1.4, 1.8, .9); root.rotation.y = .7;
  const armor = surface('armor', root); armor.userData.enemyId = 2; armor.position.set(1, 2, 3); armor.rotation.x = .25;
  const material = armor.material, vertices = Array.from(armor.geometry.getAttribute('position').array);
  const boundsBefore = new THREE.Box3().setFromObject(root), matrixBefore = armor.matrixWorld.toArray();
  const coating = new ElementCoating(root, 'corrosive');
  const overlay = coating.overlays[0], shader = overlay.material as THREE.ShaderMaterial;
  assert.equal(overlay.geometry, armor.geometry);
  assert.equal(overlay.userData.borrowedGeometry, true);
  assert.equal(shader.uniforms.normalOffset.value, .005);
  assert.ok(shader.vertexShader.includes('position + normalize(normal) * normalOffset'));
  assert.ok(shader.vertexShader.includes('normalMatrix * normal'));
  const boundsAfter = new THREE.Box3().setFromObject(root);
  assert.deepEqual(boundsAfter, boundsBefore); assert.deepEqual(armor.matrixWorld.toArray(), matrixBefore);
  assert.equal(armor.material, material); assert.deepEqual(Array.from(armor.geometry.getAttribute('position').array), vertices);
  assert.equal(overlay.userData.comicOverlay, true); assert.equal(shader.depthTest, true); assert.equal(shader.depthWrite, false);
  assert.equal(overlay.castShadow, false); assert.equal(overlay.receiveShadow, false);
  root.updateMatrixWorld(true);
  const hits = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(1, 0, 0)).intersectObject(overlay, true);
  assert.deepEqual(hits, []);
  coating.dispose();
});

test('coating disposal releases only owned materials once while shared original geometry remains usable', () => {
  const root = new THREE.Group(), armor = surface('armor', root); armor.userData.enemyId = 1;
  const a = new ElementCoating(root, 'fire'), b = new ElementCoating(root, 'ice');
  let geometryDisposals = 0, sourceMaterialDisposals = 0, overlayDisposals = 0;
  armor.geometry.addEventListener('dispose', () => geometryDisposals++);
  (armor.material as THREE.Material).addEventListener('dispose', () => sourceMaterialDisposals++);
  (a.overlays[0].material as THREE.Material).addEventListener('dispose', () => overlayDisposals++);
  a.dispose(); a.dispose();
  assert.equal(overlayDisposals, 1); assert.equal(geometryDisposals, 0); assert.equal(sourceMaterialDisposals, 0);
  assert.equal(b.overlays[0].geometry, armor.geometry); assert.equal(b.overlays[0].parent, armor);
  b.dispose(); assert.equal(geometryDisposals, 0); assert.equal(sourceMaterialDisposals, 0);
});

test('coating time pauses with the game and each real element selects its own animated surface pattern', () => {
  const root = new THREE.Group(), armor = surface('armor', root); armor.userData.enemyId = 1;
  const kinds = new Set<number>();
  for (const element of ['corrosive', 'fire', 'ice', 'shock', 'radiation', 'gravity', 'adhesive'] as const) {
    const coating = new ElementCoating(root, element);
    const uniforms = (coating.overlays[0].material as THREE.ShaderMaterial).uniforms;
    kinds.add(uniforms.elementKind.value);
    coating.update(0, 100); coating.update(-1); coating.update(NaN); assert.equal(uniforms.time.value, 0);
    coating.update(.25); assert.equal(uniforms.time.value, .25);
    coating.update(.25, 10); assert.equal(uniforms.time.value, 10);
    coating.dispose(); coating.update(1); assert.equal(uniforms.time.value, 10);
  }
  assert.equal(kinds.size, 7);
  const kinetic = new ElementCoating(root, 'kinetic'); assert.equal(kinetic.overlays.length, 0); kinetic.dispose();
});

test('toxic vapor uses bright layered opacity while retaining real depth occlusion', () => {
  const effect = new ElementEffects(new THREE.Group(), 'corrosive');
  const pool = effect.group.getObjectByName('corrosive-vapor') as THREE.InstancedMesh;
  const material = pool.material as THREE.ShaderMaterial;
  assert.equal(material.uniforms.tint.value.getHex(), 0x8aff22);
  const alpha = pool.geometry.getAttribute('particleAlpha');
  assert.ok(Math.max(...Array.from(alpha.array)) > .85);
  assert.equal(material.depthTest, true); assert.equal(material.depthWrite, false);
  effect.dispose();
});
