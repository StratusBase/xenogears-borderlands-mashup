import * as THREE from 'three';

interface Pose {
  readonly world: THREE.Matrix4;
  readonly local: THREE.Matrix4;
  readonly inverse: THREE.Matrix4;
  readonly normal: THREE.Matrix3;
  readonly trs: Float64Array;
  revision: number;
  inverseRevision: number;
  normalRevision: number;
  parent: THREE.Object3D | null;
  parentRevision: number;
  autoLocal: boolean;
  autoWorld: boolean;
}

export interface SurfaceRootPose { readonly matrixWorld: THREE.Matrix4; readonly inverseMatrixWorld: THREE.Matrix4 }
export interface SurfaceSourcePose { readonly matrixWorld: THREE.Matrix4; readonly normalMatrix: THREE.Matrix3 }

// Weak ownership: replacing a rig or disposing a target cannot retain its meshes.
// Matrices below are presentation-owned copies. Never publish them to Object3D.
const poses = new WeakMap<THREE.Object3D, Pose>();
const roots = new WeakMap<THREE.Object3D, SurfaceRootPose>();
const sources = new WeakMap<THREE.Object3D, SurfaceSourcePose>();
let revision = 0;
const counts = { worldCompositions: 0, inversions: 0, normalMatrices: 0, localChecks: 0 };

function matrixChanged(a: THREE.Matrix4, b: THREE.Matrix4): boolean {
  for (let i = 0; i < 16; i++) if (a.elements[i] !== b.elements[i]) return true;
  return false;
}

function trsChanged(object: THREE.Object3D, previous: Float64Array): boolean {
  const p = object.position, q = object.quaternion, s = object.scale;
  return previous[0] !== p.x || previous[1] !== p.y || previous[2] !== p.z ||
    previous[3] !== q.x || previous[4] !== q.y || previous[5] !== q.z || previous[6] !== q.w ||
    previous[7] !== s.x || previous[8] !== s.y || previous[9] !== s.z;
}

function rememberTrs(object: THREE.Object3D, previous: Float64Array): void {
  const p = object.position, q = object.quaternion, s = object.scale;
  previous[0] = p.x; previous[1] = p.y; previous[2] = p.z;
  previous[3] = q.x; previous[4] = q.y; previous[5] = q.z; previous[6] = q.w;
  previous[7] = s.x; previous[8] = s.y; previous[9] = s.z;
}

/** Mirrors Three's updateWorldMatrix algebra without writing local/world matrices or dirty flags. */
function poseOf(object: THREE.Object3D): Pose {
  let pose = poses.get(object);
  if (!pose) {
    pose = { world: new THREE.Matrix4(), local: new THREE.Matrix4(), inverse: new THREE.Matrix4(), normal: new THREE.Matrix3(),
      trs: new Float64Array(10).fill(NaN), revision: -1, inverseRevision: -1, normalRevision: -1,
      parent: null, parentRevision: -1, autoLocal: object.matrixAutoUpdate, autoWorld: object.matrixWorldAutoUpdate };
    poses.set(object, pose);
  }
  counts.localChecks++;
  if (!object.matrixWorldAutoUpdate) {
    if (pose.revision < 0 || pose.autoWorld || matrixChanged(pose.world, object.matrixWorld)) {
      pose.world.copy(object.matrixWorld); pose.revision = ++revision;
    }
    pose.autoWorld = false;
    return pose;
  }
  const parent = object.parent ? poseOf(object.parent) : null;
  const localChanged = pose.revision < 0 || pose.autoLocal !== object.matrixAutoUpdate ||
    (object.matrixAutoUpdate ? trsChanged(object, pose.trs) : matrixChanged(pose.local, object.matrix));
  const worldChanged = !pose.autoWorld || localChanged || pose.parent !== object.parent || pose.parentRevision !== (parent?.revision ?? 0);
  if (localChanged) {
    if (object.matrixAutoUpdate) {
      pose.local.compose(object.position, object.quaternion, object.scale); rememberTrs(object, pose.trs);
    } else pose.local.copy(object.matrix);
  }
  if (worldChanged) {
    if (parent) pose.world.multiplyMatrices(parent.world, pose.local); else pose.world.copy(pose.local);
    pose.revision = ++revision; counts.worldCompositions++;
  }
  pose.parent = object.parent; pose.parentRevision = parent?.revision ?? 0;
  pose.autoLocal = object.matrixAutoUpdate; pose.autoWorld = true;
  return pose;
}

/** Borrow this presentation-owned matrix for reading only; no inverse/normal work or Object3D writes. */
export function sampleSurfaceWorldMatrix(object: THREE.Object3D): THREE.Matrix4 { return poseOf(object).world; }

/** Checks current pose, including same-time parent/bone/manual-matrix edits. No clock-based invalidation. */
export function sampleSurfaceRoot(root: THREE.Object3D): SurfaceRootPose {
  const pose = poseOf(root);
  if (pose.inverseRevision !== pose.revision) {
    pose.inverse.copy(pose.world).invert(); pose.inverseRevision = pose.revision; counts.inversions++;
  }
  let value = roots.get(root);
  if (!value) { value = { matrixWorld: pose.world, inverseMatrixWorld: pose.inverse }; roots.set(root, value); }
  return value;
}

export function sampleSurfaceSource(source: THREE.Object3D): SurfaceSourcePose {
  const pose = poseOf(source);
  if (pose.normalRevision !== pose.revision) {
    pose.normal.getNormalMatrix(pose.world); pose.normalRevision = pose.revision; counts.normalMatrices++;
  }
  let value = sources.get(source);
  if (!value) { value = { matrixWorld: pose.world, normalMatrix: pose.normal }; sources.set(source, value); }
  return value;
}

export function surfacePoseCacheDiagnostics(): Readonly<typeof counts> { return { ...counts }; }
export function resetSurfacePoseCacheDiagnostics(): void { counts.worldCompositions = counts.inversions = counts.normalMatrices = counts.localChecks = 0; }
