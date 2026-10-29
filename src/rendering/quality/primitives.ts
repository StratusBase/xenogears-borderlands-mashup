import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBandTexture, createComicToonMaterial } from '../materials';

export type QualityMaterialKind = 'paint' | 'metal' | 'rubber' | 'glass' | 'light';

/** Deliberately quiet surfaces: edge bevels carry the highlights; seams carry the ink. */
export function createQualityMaterial(color: THREE.ColorRepresentation, kind: QualityMaterialKind = 'paint'): THREE.Material {
  if (kind === 'light') return new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const bands = createBandTexture();
  const material = createComicToonMaterial({ color, gradientMap: bands });
  material.name = `quality-${kind}`;
  if (kind === 'metal') material.emissive.set(0x10191c).multiplyScalar(0.13);
  if (kind === 'glass') { material.emissive.set(color).multiplyScalar(0.14); }
  // The band map belongs to this material, unlike the legacy shared maps.
  material.addEventListener('dispose', () => bands.dispose());
  return material;
}

export function bevelBox(size: readonly [number, number, number], bevel = 0.05): THREE.BufferGeometry {
  const radius = Math.max(0.00001, Math.min(bevel, ...size.map(value => value * .23)));
  return new RoundedBoxGeometry(...size, 1, radius);
}

export function addBox(parent: THREE.Object3D, name: string, size: readonly [number, number, number], position: readonly [number, number, number], material: THREE.Material, bevel = .045): THREE.Mesh {
  const mesh = new THREE.Mesh(bevel > 0 ? bevelBox(size, bevel) : new THREE.BoxGeometry(...size), material);
  mesh.name = name; mesh.position.set(...position); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh);
  return mesh;
}

export function addCylinder(parent: THREE.Object3D, name: string, radius: number, length: number, position: readonly [number, number, number], material: THREE.Material, axis: 'x' | 'y' | 'z' = 'y', sides = 10): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, sides), material);
  mesh.name = name; mesh.position.set(...position);
  if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh);
  return mesh;
}

/** Batch only direct, rigid children; joints, sockets, and slot boundaries stay intact. */
export function mergeStaticMeshes(root: THREE.Group): void {
  const buckets = new Map<THREE.Material, THREE.Mesh[]>();
  for (const child of [...root.children]) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material) || child.children.length || child.userData.keepSeparate) continue;
    const bucket = buckets.get(child.material) ?? []; bucket.push(child); buckets.set(child.material, bucket);
  }
  for (const [material, meshes] of buckets) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map(mesh => {
      mesh.updateMatrix();
      const copy = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      copy.applyMatrix4(mesh.matrix); return copy;
    });
    const merged = mergeGeometries(geometries, false);
    geometries.forEach(geometry => geometry.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = `batch-${material.name || material.type}`;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.authoredParts = meshes.map(part => part.name);
    // This helper is for decorative parts. The original hit proxies own raycasts.
    mesh.raycast = () => {};
    root.add(mesh);
    meshes.forEach(part => { part.removeFromParent(); part.geometry.dispose(); });
  }
}
