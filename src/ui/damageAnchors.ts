import * as THREE from 'three';
import type { Mode } from '../core/index';
import { sampleSurfaceWorldMatrix } from '../rendering/quality/surfacePoseCache';

export interface DamageAnchors {
  readonly all: readonly THREE.Object3D[];
  readonly primary?: THREE.Object3D;
  readonly pilot?: THREE.Object3D;
  readonly mech?: THREE.Object3D;
}

/** Cache once when an actor or its art is created. Closed heavy cores remain
 * protected; both permanent dummy disks are included independently. */
export function cacheDamageAnchors(root: THREE.Object3D): DamageAnchors {
  const all: THREE.Object3D[] = [];
  let primary: THREE.Object3D | undefined, pilot: THREE.Object3D | undefined, mech: THREE.Object3D | undefined;
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object.name === 'enemy-head' || object.name === 'sentry-critical-optic'
      || object.userData.critical === true || object.userData.weakPoint === true) all.push(object);
    if (object.name === 'enemy-head' || object.name === 'sentry-critical-optic') primary = object;
    if (object.name === 'dummy-pilot-bullseye-critical') pilot = object;
    if (object.name === 'dummy-mech-bullseye-critical') mech = object;
  });
  return { all, primary: primary ?? pilot ?? all[0], pilot, mech };
}
export function primaryDamageAnchor(anchors: DamageAnchors, mode: Mode): THREE.Object3D | undefined {
  return (mode === 'mech' ? anchors.mech : anchors.pilot) ?? anchors.primary;
}
/** Reads current ancestor TRS/manual matrices into presentation-owned copies.
 * No hierarchy scan, source matrix publication, inversion or normal calculation. */
export function sampleDamageAnchor(anchor: THREE.Object3D, target: THREE.Vector3): THREE.Vector3 {
  return target.setFromMatrixPosition(sampleSurfaceWorldMatrix(anchor));
}
