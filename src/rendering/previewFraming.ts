import * as THREE from 'three';

/** Ownership stops at the nearest explicitly tagged assembly; hands belong to the body. */
export function isWeaponPreviewMesh(object: THREE.Object3D): object is THREE.Mesh {
  if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh) return false;
  let owner: unknown;
  for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent) {
    if (ancestor.userData.comicOverlay === true || ancestor.userData.presentationOnly === true) return false;
    if (owner === undefined && ancestor.userData.visualOwner !== undefined) owner = ancestor.userData.visualOwner;
  }
  return owner === 'weapon';
}

/** Model-local physical bounds stay independent of particles, outlines and unrelated slots. */
export function weaponPreviewFrame(root: THREE.Object3D): { center: THREE.Vector3; radius: number } | null {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const bounds = new THREE.Box3();
  const transform = new THREE.Matrix4();
  root.traverse(object => {
    if (!isWeaponPreviewMesh(object) || !object.visible) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    if (!object.geometry.boundingBox || object.geometry.boundingBox.isEmpty()) return;
    transform.multiplyMatrices(inverse, object.matrixWorld);
    bounds.union(object.geometry.boundingBox.clone().applyMatrix4(transform));
  });
  if (bounds.isEmpty()) return null;
  const center = bounds.getCenter(new THREE.Vector3());
  const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
  if (![center.x, center.y, center.z, radius].every(Number.isFinite)) return null;
  return { center, radius: Math.max(0.12, radius) };
}
