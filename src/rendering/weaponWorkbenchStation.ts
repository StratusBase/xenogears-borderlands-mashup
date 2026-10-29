import * as THREE from 'three';
import { createComicMaterial } from './materials';

/** A physical sandbox fixture, distinct from the trade cabinets and repair terminal. */
export function createWeaponWorkbenchStation(): { group: THREE.Group; textures: THREE.Texture[] } {
  const group = new THREE.Group();
  group.name = 'sandbox-weapon-workbench';
  group.userData.sandboxWorkbench = true;
  const dark = createComicMaterial(0x26333c), metal = createComicMaterial(0x7d9390);
  const orange = createComicMaterial(0xd98b39), light = new THREE.MeshBasicMaterial({ color: 0x70d7c3 });
  function box(name: string, size: [number, number, number], position: [number, number, number], material: THREE.Material | THREE.Material[]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = name; mesh.position.set(...position); mesh.castShadow = material !== light; mesh.receiveShadow = true; group.add(mesh); return mesh;
  }
  box('workbench-top', [3.8, 0.22, 1.8], [0, 1.12, 0], metal);
  box('workbench-front-apron', [3.8, 0.32, 0.16], [0, 0.85, 0.82], orange);
  for (const x of [-1.55, 1.55]) for (const z of [-0.64, 0.64]) box('workbench-leg', [0.23, 1.01, 0.23], [x, 0.505, z], dark);
  box('workbench-tool-back', [3.7, 1.34, 0.15], [0, 1.9, -0.72], dark);
  box('workbench-control-housing', [0.95, 0.55, 0.24], [1.12, 1.58, 0.32], orange);
  box('workbench-control-screen', [0.72, 0.32, 0.025], [1.12, 1.62, 0.453], light);
  for (let i = 0; i < 3; i++) {
    box('workbench-part-rest', [0.09, 0.20, 0.30], [-1.15 + i * 0.52, 1.33, -0.12], dark);
    box('workbench-component', [0.40, 0.19 + i * 0.07, 0.42], [-1.15 + i * 0.52, 1.51 + i * 0.035, -0.12], i % 2 ? metal : orange);
  }
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#213b37'; ctx.fillRect(0, 0, 1024, 256); ctx.strokeStyle = '#f0d899'; ctx.lineWidth = 8; ctx.strokeRect(14, 14, 996, 228);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff1ce'; ctx.font = '900 63px Arial'; ctx.fillText('WEAPON WORKBENCH', 512, 94);
  ctx.fillStyle = '#73ddc5'; ctx.font = 'bold 31px Arial'; ctx.fillText('SANDBOX LAB  /  E TO USE  /  K QUICK ACCESS', 512, 177);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  box('workbench-nameplate', [3.8, 0.85, 0.18], [0, 2.64, -0.69], [dark, dark, dark, dark, sign, dark]);
  group.userData.ownedTextures = [texture];
  return { group, textures: [texture] };
}
