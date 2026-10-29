import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { ElementalStatus, SURFACE_ELEMENTS } from '../src/rendering/quality/elementalSurfaces.ts';
import { getCrowdFeedbackMode, setCrowdFeedbackMode } from '../src/rendering/quality/crowdFeedbackPolicy.ts';
import { resetSurfacePoseCacheDiagnostics, sampleSurfaceWorldMatrix, surfacePoseCacheDiagnostics } from '../src/rendering/quality/surfacePoseCache.ts';

function fixture() {
  const scene = new THREE.Scene(), parent = new THREE.Group(), root = new THREE.Group(), bone = new THREE.Group();
  scene.add(parent); parent.add(root); root.add(bone);
  parent.position.set(2, -.2, -1); parent.rotation.set(.1, -.3, .05); parent.scale.set(1.1, .9, 1.3);
  root.position.set(-.5, .3, .4); root.rotation.set(.03, .4, -.12); root.scale.set(1.2, .8, 1.1);
  bone.position.set(.1, .7, .2); bone.rotation.set(.2, .07, -.03);
  const meshes = Array.from({ length: 6 }, (_, index) => {
    const material = new THREE.MeshBasicMaterial(); material.name = 'quality-paint';
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(.35, .5, .25), material);
    mesh.name = `torso-${index}`; mesh.userData.enemyId = 17; mesh.userData.critical = false;
    mesh.position.set((index % 2) * .4, Math.floor(index / 2) * .3, index * .02);
    mesh.rotation.set(index * .01, index * .1, 0); bone.add(mesh); return mesh;
  });
  return { scene, parent, root, bone, meshes, dispose() { meshes.forEach(mesh => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }); } };
}

function effects(value: ReturnType<typeof fixture>, mode: 'classic' | 'crowd') {
  setCrowdFeedbackMode(mode); return SURFACE_ELEMENTS.map(element => new ElementalStatus(value.root, element));
}
function appearance(values: ElementalStatus[]) {
  return values.map(effect => {
    const pools: { matrices: number[]; alpha: number[]; tint: number[]; count: number }[] = [];
    effect.group.traverse(object => {
      if (object instanceof THREE.InstancedMesh) pools.push({ matrices: Array.from(object.instanceMatrix.array),
        alpha: Array.from(object.geometry.getAttribute('elementalAlpha').array), tint: Array.from(object.geometry.getAttribute('elementalTint').array), count: object.count });
    });
    return { element: effect.element, overlays: effect.overlays.length, accents: effect.activeAccentCount, pools,
      uniforms: effect.overlays.map(mesh => { const u = (mesh.material as THREE.ShaderMaterial).uniforms; return [u.time.value, u.presence.value, u.elementKind.value]; }) };
  });
}
function originalMatrices(value: ReturnType<typeof fixture>) {
  return [value.scene, value.parent, value.root, value.bone, ...value.meshes].map(object => ({
    local: object.matrix.toArray(), world: object.matrixWorld.toArray(), dirty: object.matrixWorldNeedsUpdate,
  }));
}
function animate(value: ReturnType<typeof fixture>, tick: number) {
  value.parent.position.x = 2 + tick * .03; value.parent.rotation.y = -.3 + tick * .02;
  value.root.rotation.y = .4 + tick * .07; value.root.scale.y = .8 + tick * .01;
  value.bone.position.y = .7 + Math.sin(tick) * .12; value.bone.rotation.x = .2 + tick * .04;
  value.meshes[2].rotation.z = tick * .05;
}

test('world-only anchor samples avoid inverse/normal work and preserve authoritative matrices', () => {
  const value = fixture(), before = originalMatrices(value);
  try {
    resetSurfacePoseCacheDiagnostics(); const first = sampleSurfaceWorldMatrix(value.meshes[0]);
    assert.notEqual(first, value.meshes[0].matrixWorld); assert.deepEqual(originalMatrices(value), before);
    value.parent.position.x += 3; const actual = sampleSurfaceWorldMatrix(value.meshes[0]).toArray();
    assert.deepEqual(originalMatrices(value), before); assert.equal(surfacePoseCacheDiagnostics().inversions, 0); assert.equal(surfacePoseCacheDiagnostics().normalMatrices, 0);
    value.scene.updateMatrixWorld(true); assert.deepEqual(actual, value.meshes[0].matrixWorld.toArray());
  } finally { value.dispose(); }
});

test('crowd surface poses exactly preserve all seven accent/material responses without publishing combat matrices', () => {
  const previous = getCrowdFeedbackMode(), classic = fixture(), crowd = fixture();
  const before = originalMatrices(crowd), a = effects(classic, 'classic'), b = effects(crowd, 'crowd');
  try {
    assert.deepEqual(originalMatrices(crowd), before, 'constructing presentation must not publish authoritative poses');
    assert.deepEqual(appearance(b), appearance(a));
    for (let tick = 0; tick < 9; tick++) {
      animate(classic, tick); animate(crowd, tick);
      // The repeated timestamp deliberately tests pose invalidation rather than a time-only cache.
      a.forEach(effect => effect.update(1 / 60, 3)); b.forEach(effect => effect.update(1 / 60, 3));
      assert.deepEqual(appearance(b), appearance(a)); assert.deepEqual(originalMatrices(crowd), before);
    }
    const frozen = appearance(b); b.forEach(effect => { effect.update(0, 99); effect.update(NaN, 99); });
    assert.deepEqual(appearance(b), frozen);
  } finally { a.forEach(effect => effect.dispose()); b.forEach(effect => effect.dispose()); classic.dispose(); crowd.dispose(); setCrowdFeedbackMode(previous); }
});

test('same-time manual local/world matrices, automatic-mode changes and reparenting stay exact', () => {
  const previous = getCrowdFeedbackMode(), classic = fixture(), crowd = fixture();
  for (const value of [classic, crowd]) {
    value.root.matrixWorldAutoUpdate = false; value.root.matrixWorld.makeRotationY(.3).setPosition(4, .2, -2);
    value.bone.matrixAutoUpdate = false; value.bone.matrix.makeRotationZ(.2).setPosition(.4, .8, .2);
  }
  const a = effects(classic, 'classic'), b = effects(crowd, 'crowd');
  try {
    for (let tick = 0; tick < 3; tick++) {
      for (const value of [classic, crowd]) {
        value.root.matrixWorld.makeRotationY(.3 + tick * .1).setPosition(4 + tick, .2, -2);
        value.bone.matrix.makeRotationZ(.2 + tick * .15).setPosition(.4, .8 + tick * .1, .2);
      }
      a.forEach(effect => effect.update(.016, 7)); b.forEach(effect => effect.update(.016, 7)); assert.deepEqual(appearance(b), appearance(a));
    }
    for (const value of [classic, crowd]) {
      value.root.matrixWorldAutoUpdate = true; value.bone.matrixAutoUpdate = true;
      const next = new THREE.Group(); next.position.set(1, 2, -3); next.rotation.y = .4; value.scene.add(next); next.add(value.root);
    }
    a.forEach(effect => effect.update(.016, 7)); b.forEach(effect => effect.update(.016, 7)); assert.deepEqual(appearance(b), appearance(a));
  } finally { a.forEach(effect => effect.dispose()); b.forEach(effect => effect.dispose()); classic.dispose(); crowd.dispose(); setCrowdFeedbackMode(previous); }
});

test('seven stacked statuses share one root inverse and one normal transform per armor source', () => {
  const previous = getCrowdFeedbackMode(), value = fixture();
  const publish = value.root.updateWorldMatrix;
  value.root.updateWorldMatrix = () => { throw new Error('Surface presentation must not publish target matrices'); };
  let all: ElementalStatus[] = [];
  try {
    all = effects(value, 'crowd'); resetSurfacePoseCacheDiagnostics(); value.root.rotation.y += .1;
    all.forEach(effect => effect.update(.016, 1));
    const counts = surfacePoseCacheDiagnostics();
    assert.equal(counts.inversions, 1); assert.equal(counts.normalMatrices, 6); assert.equal(counts.worldCompositions, 8);
    resetSurfacePoseCacheDiagnostics(); all.forEach(effect => effect.update(.016, 2));
    assert.equal(surfacePoseCacheDiagnostics().worldCompositions, 0, 'stationary sources reuse their exact poses');
    assert.equal(surfacePoseCacheDiagnostics().normalMatrices, 0);
    let destroyed = 0; value.meshes.forEach(mesh => mesh.geometry.addEventListener('dispose', () => destroyed++));
    all.forEach(effect => { effect.dispose(); effect.dispose(); }); assert.equal(destroyed, 0, 'borrowed geometry has no cache ownership');
  } finally { value.root.updateWorldMatrix = publish; all.forEach(effect => effect.dispose()); value.dispose(); setCrowdFeedbackMode(previous); }
});

test('explicit authoritative publication retains identical collision hits after crowd status updates', () => {
  const previous = getCrowdFeedbackMode(), classic = fixture(), crowd = fixture();
  const a = effects(classic, 'classic'), b = effects(crowd, 'crowd');
  function hits(value: ReturnType<typeof fixture>) {
    // PlayerBallistics.refreshWorld owns this publication before every fire/update sweep.
    value.scene.updateMatrixWorld(true); value.root.updateWorldMatrix(true, true);
    const center = value.meshes[0].getWorldPosition(new THREE.Vector3());
    return new THREE.Raycaster(center.clone().add(new THREE.Vector3(0, 0, 10)), new THREE.Vector3(0, 0, -1))
      .intersectObject(value.root, true).map(hit => ({ name: hit.object.name, id: hit.object.userData.enemyId, distance: hit.distance, point: hit.point.toArray() }));
  }
  try {
    animate(classic, 4); animate(crowd, 4); a.forEach(effect => effect.update(.016, 4)); b.forEach(effect => effect.update(.016, 4));
    const expected = hits(classic), actual = hits(crowd); assert.ok(expected.length > 0); assert.deepEqual(actual, expected);
    a.forEach(effect => effect.dispose()); b.forEach(effect => effect.dispose()); assert.deepEqual(hits(crowd), hits(classic));
  } finally { a.forEach(effect => effect.dispose()); b.forEach(effect => effect.dispose()); classic.dispose(); crowd.dispose(); setCrowdFeedbackMode(previous); }
});
