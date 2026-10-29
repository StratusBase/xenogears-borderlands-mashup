import * as THREE from 'three';
import type { LedgeGrab } from '../core/ledgeClimb';
import { bevelBox, createQualityMaterial } from './quality/primitives';

export interface ClimbVisual {
  group: THREE.Group;
  update(grab: LedgeGrab | undefined, progress: number, camera: THREE.Camera): void;
  dispose(): void;
}

const UP = new THREE.Vector3(0, 1, 0);
const UPPER_LENGTH = .42, FOREARM_LENGTH = .40;
const smooth = (value: number) => { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const phase = (value: number, from: number, to: number) => smooth((value - from) / (to - from));
const finitePoint = (point: { x: number; y?: number; z: number }) =>
  Number.isFinite(point.x) && Number.isFinite(point.z) && (point.y === undefined || Number.isFinite(point.y));

/** Body-owned arms. Contacts live in the world, independently of the weapon and
 * camera, so the palms bear weight instead of sliding upward with the view. */
export function createClimbVisual(): ClimbVisual {
  const group = new THREE.Group(); group.name = 'pilot-climb'; group.visible = false;
  group.userData.visualOwner = 'body';
  const sleeve = createQualityMaterial(0x405c69), glove = createQualityMaterial(0x273238, 'rubber');
  const cuffMaterial = createQualityMaterial(0xc9bb99), stitch = createQualityMaterial(0x859293);
  const materials = [sleeve, glove, cuffMaterial, stitch];
  const geometries = new Set<THREE.BufferGeometry>();
  let disposed = false;

  const mesh = (parent: THREE.Object3D, name: string, geometry: THREE.BufferGeometry, material: THREE.Material) => {
    geometries.add(geometry);
    const result = new THREE.Mesh(geometry, material); result.name = name;
    result.castShadow = false; result.receiveShadow = true;
    // Foreground anatomy must not intercept weapon/interaction rays.
    result.raycast = () => {}; parent.add(result); return result;
  };
  const box = (parent: THREE.Object3D, name: string, size: [number, number, number], at: [number, number, number], material: THREE.Material) => {
    const result = mesh(parent, name, bevelBox(size, .012), material); result.position.set(...at); return result;
  };
  const joint = (parent: THREE.Object3D, name: string) => {
    const result = new THREE.Group(); result.name = name; parent.add(result); return result;
  };
  const arms = ([-1, 1] as const).map(side => {
    const name = side < 0 ? 'left' : 'right';
    const root = joint(group, `climb-${name}-arm`);
    const shoulder = joint(root, `climb-${name}-shoulder`), elbow = joint(root, `climb-${name}-elbow`);
    const upper = mesh(root, `climb-${name}-upper-arm`, new THREE.CylinderGeometry(.068, .083, 1, 9), sleeve);
    const forearm = mesh(root, `climb-${name}-forearm`, new THREE.CylinderGeometry(.067, .048, 1, 9), sleeve);
    mesh(elbow, `climb-${name}-elbow-pad`, new THREE.SphereGeometry(.069, 9, 6), glove);
    const cuff = mesh(root, `climb-${name}-cuff`, new THREE.CylinderGeometry(.058, .058, .045, 9), cuffMaterial);
    const hand = joint(root, `climb-${name}-hand`);
    const wrist = joint(hand, `climb-${name}-wrist`); wrist.position.set(0, .033, .073);
    // Hand origin is the contact on the top face; all pads remain above it.
    box(hand, `climb-${name}-palm`, [.108, .046, .136], [0, .032, -.008], glove);
    box(hand, `climb-${name}-knuckle-pad`, [.098, .021, .045], [0, .062, -.045], sleeve);
    box(hand, `climb-${name}-wrist-seam`, [.10, .012, .013], [0, .06, .04], stitch);
    const fingers = [-.039, -.013, .013, .039].map((x, index) => {
      const length = index === 0 || index === 3 ? .043 : .049;
      const finger = joint(hand, `climb-${name}-finger-${index}`); finger.position.set(x, .035, -.068);
      box(finger, `climb-${name}-finger-${index}-proximal`, [.022, .026, length], [0, 0, -length / 2], glove);
      const tip = joint(finger, `climb-${name}-finger-${index}-tip`); tip.position.z = -length;
      box(tip, `climb-${name}-finger-${index}-distal`, [.021, .024, .027], [0, 0, -.0135], glove);
      return { finger, tip };
    });
    const thumb = joint(hand, `climb-${name}-thumb`); thumb.position.set(-side * .063, .026, .005);
    box(thumb, `climb-${name}-thumb-proximal`, [.033, .033, .045], [0, 0, -.019], glove);
    const thumbTip = joint(thumb, `climb-${name}-thumb-tip`); thumbTip.position.z = -.038;
    box(thumbTip, `climb-${name}-thumb-distal`, [.029, .029, .031], [0, 0, -.014], glove);
    return { root, shoulder, elbow, upper, forearm, cuff, hand, wrist, fingers, thumb, thumbTip, side };
  });

  const cameraPosition = new THREE.Vector3(), cameraRotation = new THREE.Quaternion();
  const outward = new THREE.Vector3(), tangent = new THREE.Vector3(), surfaceRotation = new THREE.Quaternion();
  const basis = new THREE.Matrix4(), start = new THREE.Vector3(), destination = new THREE.Vector3();
  const shoulderPoint = new THREE.Vector3(), wristPoint = new THREE.Vector3(), elbowPoint = new THREE.Vector3();
  const direction = new THREE.Vector3(), bend = new THREE.Vector3(), delta = new THREE.Vector3();
  const local = (x: number, y: number, z: number, target: THREE.Vector3) =>
    target.set(x, y, z).applyQuaternion(cameraRotation).add(cameraPosition);
  const segment = (part: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) => {
    delta.copy(to).sub(from); const length = delta.length();
    part.position.copy(from).add(to).multiplyScalar(.5);
    part.quaternion.setFromUnitVectors(UP, delta.divideScalar(Math.max(.0001, length)));
    part.scale.set(1, Math.max(.0001, length), 1);
  };

  return {
    group,
    update(grab, progress, camera) {
      group.visible = !disposed && !!grab && Number.isFinite(progress) && progress >= 0 && progress < 1;
      if (!group.visible || !grab) return;
      if (![grab.leftGrip, grab.rightGrip, grab.normal].every(finitePoint)) { group.visible = false; return; }
      const p = THREE.MathUtils.clamp(progress, 0, 1);
      outward.set(grab.normal.x, 0, grab.normal.z);
      if (outward.lengthSq() < .001) { group.visible = false; return; }
      outward.normalize(); tangent.set(outward.z, 0, -outward.x);
      surfaceRotation.setFromRotationMatrix(basis.makeBasis(tangent, UP, outward));
      camera.getWorldPosition(cameraPosition); camera.getWorldQuaternion(cameraRotation);

      for (const arm of arms) {
        const late = arm.side > 0 ? .035 : 0;
        const reach = phase(p, .015 + late, .165 + late);
        const release = phase(p, .67 + late, .81 + late);
        arm.root.visible = p < .83 + late;
        const grip = arm.side < 0 ? grab.leftGrip : grab.rightGrip;
        local(arm.side * .36, -.76, -.24, start);
        destination.set(grip.x, grip.y, grip.z);
        arm.hand.position.copy(start).lerp(destination, reach);
        local(arm.side * .43, -.86, -.23, start);
        arm.hand.position.lerp(start, release);
        arm.hand.quaternion.copy(cameraRotation).slerp(surfaceRotation, reach * (1 - release));
        const curl = phase(p, .065 + late, .20 + late) * (1 - release);
        arm.fingers.forEach(({ finger, tip }, index) => {
          finger.rotation.x = -curl * (.16 + index * .008);
          tip.rotation.x = -curl * (.40 + index * .012);
        });
        arm.thumb.rotation.set(-curl * .15, arm.side * (.35 + curl * .35), arm.side * .12);
        arm.thumbTip.rotation.x = -curl * .35;

        // The raised shoulder and outward elbow form a two-bone arm. Camera
        // crouch during transfer keeps its reach human while both hands load.
        local(arm.side * .27, -.42 + reach * (1 - release) * .12, -.15, shoulderPoint);
        wristPoint.copy(arm.wrist.position).applyQuaternion(arm.hand.quaternion).add(arm.hand.position);
        direction.copy(wristPoint).sub(shoulderPoint);
        const distance = direction.length();
        if (distance < .001) direction.copy(outward).negate(); else direction.divideScalar(distance);
        // Extreme view angles can put the hidden sleeve origin beyond reach;
        // move only that shoulder origin rather than stretch either bone.
        const reachDistance = THREE.MathUtils.clamp(distance, .04, UPPER_LENGTH + FOREARM_LENGTH - .005);
        shoulderPoint.copy(wristPoint).addScaledVector(direction, -reachDistance);
        const along = (UPPER_LENGTH ** 2 - FOREARM_LENGTH ** 2 + reachDistance ** 2) / (2 * reachDistance);
        const height = Math.sqrt(Math.max(0, UPPER_LENGTH ** 2 - along ** 2));
        bend.copy(tangent).multiplyScalar(arm.side).addScaledVector(UP, -.55);
        bend.addScaledVector(direction, -bend.dot(direction)).normalize();
        if (bend.lengthSq() < .01) bend.copy(outward);
        elbowPoint.copy(shoulderPoint).addScaledVector(direction, along).addScaledVector(bend, height);
        arm.shoulder.position.copy(shoulderPoint); arm.elbow.position.copy(elbowPoint);
        segment(arm.upper, shoulderPoint, elbowPoint); segment(arm.forearm, wristPoint, elbowPoint);
        arm.cuff.position.copy(wristPoint).lerp(elbowPoint, .065);
        arm.cuff.quaternion.copy(arm.forearm.quaternion);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true; group.visible = false; group.removeFromParent();
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
    },
  };
}
