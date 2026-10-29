import * as THREE from 'three';
import { createComicMaterial } from './materials';

export interface CheckpointStationVisual {
  readonly group: THREE.Group;
  setActive(active: boolean): void;
}

/** Geometry/materials use the world's disposer; ownedTextures records the local sign texture. */
export function createCheckpointStation(name: string): CheckpointStationVisual {
  const group = new THREE.Group();
  group.name = 'checkpoint-station';
  const dark = createComicMaterial(0x252934);
  const hull = createComicMaterial(0x286c76);
  const trim = createComicMaterial(0xe5d4b2);
  const status = new THREE.MeshBasicMaterial({ color: 0x5dd6e5, toneMapped: false });
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 640;
  const context = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const signMaterial = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  group.userData.ownedTextures = [texture];

  function box(partName: string, width: number, height: number, depth: number, x: number, y: number, z: number, material: THREE.Material | THREE.Material[]): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.name = partName;
    mesh.position.set(x, y, z);
    mesh.castShadow = material !== status;
    mesh.receiveShadow = material !== status;
    group.add(mesh);
    return mesh;
  }

  // All structural pieces meet at deliberate boundaries above a solid base.
  box('checkpoint-base', 0.9, 0.3, 0.9, 0, 0.15, 0, dark);
  box('checkpoint-body', 0.76, 1.6, 0.64, 0, 1.1, 0, hull);
  box('checkpoint-crown', 0.82, 0.18, 0.76, 0, 1.99, 0, trim);
  box('checkpoint-beacon', 0.26, 0.28, 0.26, 0, 2.22, 0, status);
  box('checkpoint-beacon-cap', 0.38, 0.1, 0.38, 0, 2.41, 0, dark);

  for (const side of [-1, 1]) {
    // Map the sign directly to each physical panel's outward face. A second
    // nearly coplanar text plane would flicker when viewed from a distance.
    const frontMaterials: THREE.Material[] = [dark, dark, dark, dark, dark, dark];
    frontMaterials[side > 0 ? 4 : 5] = signMaterial;
    box(`checkpoint-sign-${side > 0 ? 'front' : 'back'}`, 0.72, 0.86, 0.025, 0, 1.35, side * 0.3325, frontMaterials);

    const sideMaterials: THREE.Material[] = [dark, dark, dark, dark, dark, dark];
    sideMaterials[side > 0 ? 0 : 1] = signMaterial;
    box(`checkpoint-sign-${side > 0 ? 'right' : 'left'}`, 0.025, 0.86, 0.58, side * 0.3925, 1.35, 0, sideMaterials);

    for (const x of [-0.2, 0, 0.2]) {
      box('checkpoint-status-lamp', 0.11, 0.085, 0.035, x, 0.6, side * 0.3375, status);
    }
  }

  let activeState: boolean | undefined;
  const setActive = (active: boolean): void => {
    if (activeState === active) return;
    activeState = active;
    group.userData.active = active;
    const accent = active ? '#79ed91' : '#5dd6e5';
    status.color.set(accent);
    context.fillStyle = '#1e252d';
    context.fillRect(0, 0, 512, 640);
    context.fillStyle = accent;
    context.fillRect(0, 0, 512, 42);
    context.fillRect(0, 600, 512, 40);
    context.strokeStyle = accent;
    context.lineWidth = 8;
    context.strokeRect(20, 62, 472, 516);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#f5ead0';
    context.font = '900 77px Arial, sans-serif';
    context.fillText('AUTOSAVE', 256, 180, 440);
    context.font = 'bold 34px Arial, sans-serif';
    context.fillText('CHECKPOINT', 256, 258, 440);
    context.fillStyle = accent;
    context.font = '900 50px Arial, sans-serif';
    context.fillText(name.toUpperCase(), 256, 357, 440);
    context.fillStyle = '#f5ead0';
    context.font = 'bold 30px Arial, sans-serif';
    context.fillText(active ? 'ACTIVE CHECKPOINT' : 'APPROACH TO SAVE', 256, 475, 440);
    texture.needsUpdate = true;
  };
  setActive(false);
  return { group, setActive };
}
