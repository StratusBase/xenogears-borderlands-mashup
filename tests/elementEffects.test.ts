import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { ElementEffects, getElementSmokeTexture } from '../src/rendering/ElementEffects.ts';
import { createWeaponSpec, type ElementType } from '../src/core/arsenal.ts';
import { PlayerBallistics, type BallisticHit } from '../src/rendering/PlayerBallistics.ts';

const elements: ElementType[] = ['kinetic', 'fire', 'ice', 'radiation', 'gravity', 'corrosive', 'shock', 'adhesive'];
function matrices(effect: ElementEffects): number[][] {
  return effect.group.children.map(object => Array.from((object as THREE.InstancedMesh).instanceMatrix.array));
}
function fingerprint(effect: ElementEffects): string {
  return effect.group.children.map(object => {
    const mesh = object as THREE.InstancedMesh;
    return `${mesh.name}:${mesh.geometry.type}:${mesh.count}`;
  }).join('|');
}

test('each element has a distinct fixed particle silhouette with a compact matching equipment effect', () => {
  const parent = new THREE.Group(), fingerprints = new Set<string>();
  for (const element of elements) {
    const status = new ElementEffects(parent, element), equipment = new ElementEffects(parent, element, { style: 'equipment', scale: 2 });
    assert.equal(status.group.parent, parent);
    assert.ok(status.particleCount >= 16 && status.particleCount <= 36);
    assert.ok(equipment.particleCount >= 8 && equipment.particleCount <= 12);
    assert.ok(status.group.children.length <= 3, 'Particle pooling must bound draw calls independently of particle count');
    assert.equal(equipment.group.scale.x, 0.24);
    fingerprints.add(fingerprint(status).replaceAll(element, 'ELEMENT'));
    if (element === 'corrosive') assert.deepEqual(status.group.children.map(child => child.userData.elementParticleKind), ['vapor', 'gloop', 'splat']);
    if (element === 'shock') assert.ok(status.group.getObjectByName('shock-arc'));
    if (element === 'fire') assert.ok(status.group.getObjectByName('fire-flame'));
    if (element === 'ice') assert.ok(status.group.getObjectByName('ice-crystal'));
    status.dispose(); equipment.dispose();
  }
  assert.equal(fingerprints.size, elements.length, 'Element identity must change geometry and composition, not only tint');
  assert.equal(parent.children.length, 0);
});

test('pooled effects animate deterministically without emitting new objects or advancing a paused clock', () => {
  const a = new ElementEffects(new THREE.Group(), 'corrosive'), b = new ElementEffects(new THREE.Group(), 'corrosive');
  const meshes = [...a.group.children], before = matrices(a);
  a.update(0, 100); a.update(-1); a.update(NaN);
  assert.deepEqual(matrices(a), before);
  const random = Math.random;
  Math.random = () => { throw new Error('Animation may not consume a random draw'); };
  try {
    a.update(0.2, 0.2); a.update(0.3, 0.5);
    b.update(0.5, 0.5);
    for (let i = 0; i < 120; i++) a.update(1 / 60, 0.5);
  } finally { Math.random = random; }
  assert.deepEqual(matrices(a), matrices(b), 'Explicit game time must fully determine sustained motion');
  assert.notDeepEqual(matrices(b), before);
  assert.deepEqual(a.group.children, meshes, 'Animation must reuse the same particle pools');
  assert.ok(matrices(a).flat().every(Number.isFinite));
  a.group.visible = false; a.update(0.1, 0.6); assert.equal(a.group.visible, false);
  a.dispose(); b.dispose();
});

test('all particle geometry uses actual depth-tested post-ink overlays and never intercepts a ray', () => {
  const scene = new THREE.Scene();
  const effect = new ElementEffects(scene, 'shock');
  scene.updateMatrixWorld(true);
  assert.equal(effect.group.userData.comicOverlay, true);
  for (const child of effect.group.children) {
    const mesh = child as THREE.InstancedMesh, material = mesh.material as THREE.Material;
    assert.equal(mesh.userData.comicOverlay, true);
    assert.equal(material.depthTest, true); assert.equal(material.depthWrite, false);
    assert.equal(mesh.castShadow, false); assert.equal(mesh.receiveShadow, false);
  }
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 3), new THREE.Vector3(0, 0, -1));
  assert.deepEqual(ray.intersectObject(effect.group, true), []);
  effect.dispose();
});

test('soft smoke has a bright interior and zero-alpha edge; independent disposal preserves the shared map', () => {
  const parent = new THREE.Group(), a = new ElementEffects(parent, 'corrosive'), b = new ElementEffects(parent, 'ice');
  const map = getElementSmokeTexture();
  const texture = map as THREE.DataTexture;
  if (texture.isDataTexture) {
    const pixels = texture.image.data as Uint8Array;
    assert.equal(pixels[3], 0);
    assert.ok(pixels[(32 * 64 + 32) * 4 + 3] > 225);
  }
  let textureDisposals = 0, geometryDisposals = 0, materialDisposals = 0, instanceDisposals = 0;
  map.addEventListener('dispose', () => textureDisposals++);
  const pools = a.group.children as THREE.InstancedMesh[];
  for (const mesh of pools) {
    mesh.addEventListener('dispose', () => instanceDisposals++);
    mesh.geometry.addEventListener('dispose', () => geometryDisposals++);
    (mesh.material as THREE.Material).addEventListener('dispose', () => materialDisposals++);
  }
  const count = pools.length;
  a.dispose(); a.dispose(); a.update(1);
  assert.equal(instanceDisposals, count); assert.equal(geometryDisposals, count); assert.equal(materialDisposals, count);
  assert.equal(textureDisposals, 0); assert.equal(getElementSmokeTexture(), map);
  assert.equal(b.group.parent, parent); b.update(0.1); b.dispose(); assert.equal(textureDisposals, 0);
});

function ballisticFixture() {
  const scene = new THREE.Scene(), hits: BallisticHit[] = [];
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1), new THREE.MeshBasicMaterial()); body.userData.enemyId = 1;
  const root = new THREE.Group(); root.position.set(0, 1, -4); root.add(body); scene.add(root);
  const ballistics = new PlayerBallistics(scene, { targets: () => [{ id: 1, root, radius: 1 }], occluders: () => [], hit: event => hits.push(event) });
  return { scene, hits, ballistics };
}

test('corrosive travel and impact carry vapor, gloop and solid trails while damage remains unchanged', () => {
  const f = ballisticFixture(), spec = { ...createWeaponSpec('orb', 'corrosive'), speed: 20, tracking: 0, spread: 0, blastRadius: 0, fuse: 0 };
  f.ballistics.fire(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), spec, 25);
  assert.ok(f.scene.getObjectByName('element-equipment-corrosive'));
  f.ballistics.update(0.05);
  const trail = f.scene.getObjectByName('player-projectile-trail')!;
  assert.ok(trail.children.length >= 3 && trail.children.every(child => child instanceof THREE.Mesh));
  f.ballistics.update(0.2);
  assert.equal(f.hits.length, 1); assert.equal(f.hits[0].damage, 25);
  const impact = f.scene.getObjectByName('player-ballistic-impact-corrosive')!;
  assert.ok(impact.getObjectByName('corrosive-vapor')); assert.ok(impact.getObjectByName('corrosive-gloop')); assert.ok(impact.getObjectByName('corrosive-splat'));
  const before = (impact.children[0] as THREE.InstancedMesh).instanceMatrix.array.slice();
  f.ballistics.update(0); assert.deepEqual((impact.children[0] as THREE.InstancedMesh).instanceMatrix.array, before);
  f.ballistics.update(1.3); assert.equal(f.scene.getObjectByName('player-ballistic-impact-corrosive'), undefined);
  f.ballistics.clear(); assert.equal(f.scene.children.length, 1, 'Only the original enemy remains');
});

test('elemental effect budgets cap repeated impacts and clear releases payloads and delayed bursts', () => {
  const f = ballisticFixture(), spec = { ...createWeaponSpec('beam', 'shock'), spread: 0 };
  for (let i = 0; i < 150; i++) f.ballistics.fire(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), spec, 1);
  assert.ok(f.ballistics.effectCount <= 256);
  assert.ok(f.scene.children.filter(object => object.name === 'player-ballistic-impact-shock').length <= 32);
  const orb = { ...createWeaponSpec('orb', 'corrosive'), spread: 0 };
  for (let i = 0; i < 100; i++) f.ballistics.fire(new THREE.Vector3(3, 1, 0), new THREE.Vector3(0, 0, -1), orb, 1);
  let payloadCount = 0;
  f.scene.traverse(object => { if (object.name === 'element-equipment-corrosive') payloadCount++; });
  assert.equal(payloadCount, 24);
  f.ballistics.clear(); assert.equal(f.ballistics.effectCount, 0); assert.equal(f.ballistics.activeCount, 0);
  assert.equal(f.scene.children.length, 1);
});
