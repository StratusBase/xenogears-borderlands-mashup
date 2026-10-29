import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import * as THREE from 'three';
import { findLedgeGrab, sampleLedgeClimb, type LedgeGrab } from '../src/core/ledgeClimb.ts';
import { createClimbVisual, type ClimbVisual } from '../src/rendering/climbVisual.ts';

const visuals: ClimbVisual[] = [];
afterEach(() => { visuals.forEach(visual => visual.dispose()); visuals.length = 0; });
function fixture(height = 1.4) {
  const grab = findLedgeGrab({ x: 0, y: 0, z: .85 }, { x: 0, z: -1 },
    [{ minX: -2, maxX: 2, minZ: -3, maxZ: 0, minY: 0, maxY: height, climbable: true }]);
  assert.ok(grab, 'Use an actual accepted ledge, including its real contact points');
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(72, 1.6, .08, 350);
  scene.add(camera);
  const visual = createClimbVisual(); visuals.push(visual); scene.add(visual.group);
  return { grab, scene, camera, visual };
}
function pose(f: ReturnType<typeof fixture>, progress: number) {
  const sample = sampleLedgeClimb(f.grab, progress);
  f.camera.position.set(sample.position.x, sample.position.y + sample.eyeHeight, sample.position.z);
  f.camera.rotation.set(sample.pitch, Math.atan2(f.grab.normal.x, f.grab.normal.z), sample.roll, 'YXZ');
  f.camera.updateWorldMatrix(true, false);
  f.visual.update(f.grab, progress, f.camera); f.scene.updateMatrixWorld(true);
}
function part(visual: ClimbVisual, name: string): THREE.Object3D {
  const result = visual.group.getObjectByName(name); assert.ok(result, `Missing ${name}`); return result;
}
function point(visual: ClimbVisual, name: string): THREE.Vector3 {
  return part(visual, name).getWorldPosition(new THREE.Vector3());
}
function snapshot(visual: ClimbVisual) {
  const transforms: unknown[] = [];
  visual.group.traverse(node => transforms.push([node.name, node.visible, node.position.toArray(), node.quaternion.toArray(), node.scale.toArray()]));
  return transforms;
}

test('both palms stay planted in world space throughout the real pull-up and initial weight transfer', () => {
  for (const height of [.45, 1.4, 2.2]) {
    const f = fixture(height);
    let initialCamera: THREE.Vector3 | undefined;
    for (const progress of [.20, .24, .32, .45, .58, .65]) {
      pose(f, progress);
      assert.equal(f.visual.group.visible, true);
      for (const side of ['left', 'right'] as const) {
        const grip = side === 'left' ? f.grab.leftGrip : f.grab.rightGrip;
        assert.ok(point(f.visual, `climb-${side}-hand`).distanceTo(new THREE.Vector3(grip.x, grip.y, grip.z)) < 1e-10);
        const handBounds = new THREE.Box3().setFromObject(part(f.visual, `climb-${side}-hand`));
        assert.ok(handBounds.min.y >= f.grab.top - .002, 'Contact fingers and palms must stay above the solid ledge');
      }
      initialCamera ??= f.camera.position.clone();
    }
    assert.ok(f.camera.position.distanceTo(initialCamera!) > .1, 'Exercise moving body/camera rather than a stationary pose');
  }
});

test('the actual camera crouch keeps articulated arms in human proportions across low and high ledges', () => {
  for (const height of [.45, .9, 1.4, 2.2]) {
    const f = fixture(height);
    for (let frame = 1; frame < 61; frame++) {
      const progress = frame / 60; pose(f, progress);
      f.visual.group.traverse(node => {
        assert.ok([...node.position.toArray(), ...node.quaternion.toArray(), ...node.scale.toArray()].every(Number.isFinite), `${height}m/${progress}: ${node.name}`);
      });
      for (const side of ['left', 'right'] as const) {
        const shoulder = point(f.visual, `climb-${side}-shoulder`), elbow = point(f.visual, `climb-${side}-elbow`);
        const wrist = point(f.visual, `climb-${side}-wrist`);
        const upperLength = shoulder.distanceTo(elbow), forearmLength = elbow.distanceTo(wrist);
        assert.ok(upperLength > .38 && upperLength < .45, `Upper arm stretched to ${upperLength}`);
        assert.ok(forearmLength > .36 && forearmLength < .43, `Forearm stretched to ${forearmLength}`);
        if (progress >= .20 && progress <= .65) {
          const expectedShoulder = f.camera.localToWorld(new THREE.Vector3(side === 'left' ? -.27 : .27, -.30, -.15));
          assert.ok(shoulder.distanceTo(expectedShoulder) < .14, 'Planted arms must connect near the actual shoulders, not float at the edge');
        }
      }
    }
  }
});

test('real ledge contacts remain visible during reach, pull-up and initial transfer at gameplay aspect ratio', () => {
  for (const height of [.45, 1.3, 2.2]) {
    const f = fixture(height);
    for (const progress of [.20, .32, .43, .58, .65]) {
      pose(f, progress);
      for (const side of ['left', 'right']) {
        const projected = point(f.visual, `climb-${side}-hand`).project(f.camera);
        assert.ok(projected.z > -1 && projected.z < 1, `${height}m/${progress}: ${side} palm must be in front of the camera`);
        assert.ok(Math.abs(projected.x) < .92 && Math.abs(projected.y) < .92,
          `${height}m/${progress}: ${side} palm outside view at ${projected.toArray()}`);
      }
    }
  }
});

test('maximum accepted oblique approaches retain finite connected anatomy while the torso squares to the edge', () => {
  for (const height of [.45, 2.2]) for (const angle of [-Math.acos(.65), Math.acos(.65)]) {
    const f = fixture(height);
    for (const progress of [.03, .08, .14, .20]) {
      pose(f, progress);
      const t = Math.min(1, progress / .20), align = t * t * (3 - 2 * t);
      f.camera.rotation.y += angle * (1 - align); f.camera.updateWorldMatrix(true, false);
      f.visual.update(f.grab, progress, f.camera); f.scene.updateMatrixWorld(true);
      for (const side of ['left', 'right']) {
        const shoulder = point(f.visual, `climb-${side}-shoulder`), elbow = point(f.visual, `climb-${side}-elbow`);
        const wrist = point(f.visual, `climb-${side}-wrist`);
        assert.ok(shoulder.distanceTo(elbow) < .45 && elbow.distanceTo(wrist) < .43);
      }
    }
  }
});

test('hands reach and release in sequence, with mirrored thumbs and articulated finger curl', () => {
  const f = fixture(); pose(f, .10);
  const left = new THREE.Vector3(f.grab.leftGrip.x, f.grab.leftGrip.y, f.grab.leftGrip.z);
  const right = new THREE.Vector3(f.grab.rightGrip.x, f.grab.rightGrip.y, f.grab.rightGrip.z);
  assert.ok(point(f.visual, 'climb-left-hand').distanceTo(left) < point(f.visual, 'climb-right-hand').distanceTo(right), 'Left hand should lead the right reach');
  const earlyCurl = part(f.visual, 'climb-left-finger-1-tip').rotation.x;
  pose(f, .4);
  assert.ok(part(f.visual, 'climb-left-finger-1-tip').rotation.x < earlyCurl);
  assert.ok(part(f.visual, 'climb-left-thumb').position.x > 0);
  assert.ok(part(f.visual, 'climb-right-thumb').position.x < 0);
  pose(f, .70);
  assert.ok(point(f.visual, 'climb-left-hand').distanceTo(left) > .005);
  assert.ok(point(f.visual, 'climb-right-hand').distanceTo(right) < 1e-10, 'Right palm still supports the first hand release');
  pose(f, .85);
  assert.ok(point(f.visual, 'climb-right-hand').distanceTo(right) > .1, 'Both hands release before the camera stands');
});

test('frozen simulation poses are idempotent and cancellation resets a subsequent climb', () => {
  const f = fixture(); pose(f, .42); const frozen = snapshot(f.visual);
  for (let draw = 0; draw < 144; draw++) f.visual.update(f.grab, .42, f.camera);
  assert.deepEqual(snapshot(f.visual), frozen);
  f.visual.update(undefined, .42, f.camera); assert.equal(f.visual.group.visible, false);
  pose(f, .05); const restarted = snapshot(f.visual);
  const fresh = fixture(); pose(fresh, .05); assert.deepEqual(snapshot(fresh.visual), restarted);
  f.visual.update(f.grab, 1, f.camera); assert.equal(f.visual.group.visible, false);
  f.visual.update(f.grab, NaN, f.camera); assert.equal(f.visual.group.visible, false);
  f.visual.update({ ...f.grab, normal: { x: 0, z: 0 } }, .5, f.camera); assert.equal(f.visual.group.visible, false);
  const invalid = { ...f.grab, leftGrip: { ...f.grab.leftGrip, y: NaN } } as LedgeGrab;
  f.visual.update(invalid, .5, f.camera); assert.equal(f.visual.group.visible, false);
});

test('climb anatomy owns its resources, does not intercept aim rays, and disposes exactly once', () => {
  const f = fixture(); pose(f, .4);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  f.visual.group.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    geometries.add(node.geometry);
    (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => materials.add(material));
    assert.equal(node.castShadow, false);
  });
  assert.equal(f.visual.group.userData.visualOwner, 'body');
  assert.equal(f.visual.group.userData.equipmentSlot, undefined);
  let releasedGeometry = 0, releasedMaterial = 0;
  geometries.forEach(geometry => geometry.addEventListener('dispose', () => releasedGeometry++));
  materials.forEach(material => material.addEventListener('dispose', () => releasedMaterial++));
  const ray = new THREE.Raycaster(f.camera.position, new THREE.Vector3(0, 0, -1));
  assert.deepEqual(ray.intersectObject(f.visual.group, true), []);
  f.visual.dispose(); f.visual.dispose();
  assert.equal(f.visual.group.parent, null); assert.equal(f.visual.group.visible, false);
  assert.equal(releasedGeometry, geometries.size); assert.equal(releasedMaterial, materials.size);
  f.visual.update(f.grab, .4, f.camera); assert.equal(f.visual.group.visible, false);
});
