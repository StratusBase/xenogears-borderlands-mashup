import * as THREE from 'three';
import { createComicMaterial } from './materials';

export interface TestDummyVisual {
  readonly group: THREE.Group;
  readonly radius: number;
  /** Model-local aiming point; all anchors follow the root's placement. */
  readonly aimPoint: THREE.Vector3;
  readonly damageAnchor: THREE.Vector3;
  dispose(): void;
}

/** Fixed, grounded range hardware. It carries no enemy AI, vital bars or reward state. */
export function createTestDummy(id: number): TestDummyVisual {
  const group = new THREE.Group();
  group.name = 'permanent-test-dummy';
  group.userData.fixedTestDummy = true;
  const dark = createComicMaterial(0x27363d), steel = createComicMaterial(0x8b9b97);
  const paint = createComicMaterial(0xdda844), cream = createComicMaterial(0xe7ddba);
  const red = createComicMaterial(0xdf453c);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>([dark, steel, paint, cream, red]);
  const textures: THREE.Texture[] = [];

  function mesh(name: string, geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], position: [number, number, number], damageable = false, critical = false): THREE.Mesh {
    const object = new THREE.Mesh(geometry, material);
    object.name = name; object.position.set(...position);
    object.castShadow = true; object.receiveShadow = true;
    if (damageable) { object.userData.enemyId = id; object.userData.critical = critical; }
    geometries.add(geometry);
    (Array.isArray(material) ? material : [material]).forEach(value => materials.add(value));
    group.add(object); return object;
  }
  function box(name: string, size: [number, number, number], position: [number, number, number], material: THREE.Material | THREE.Material[], damageable = false) {
    return mesh(name, new THREE.BoxGeometry(...size), material, position, damageable);
  }
  function targetCircle(name: string, radius: number, depth: number, y: number, z: number, material: THREE.Material, critical = false): void {
    const cylinder = mesh(name, new THREE.CylinderGeometry(radius, radius, depth, 24, 1), material, [0, y, z], true, critical);
    cylinder.rotation.x = Math.PI / 2;
  }
  function bullseye(name: string, y: number, size: number): void {
    // Solid, flush tiers avoid coplanar target graphics and preserve real hit regions.
    targetCircle(`${name}-outer`, size, 0.04, y, 0.21, dark);
    targetCircle(`${name}-white`, size * 0.78, 0.035, y, 0.2475, cream);
    targetCircle(`${name}-inner`, size * 0.51, 0.03, y, 0.28, dark);
    targetCircle(`${name}-critical`, size * 0.31, 0.04, y, 0.315, red, true);
  }

  box('dummy-grounded-base', [1.9, 0.22, 1.4], [0, 0.11, 0], dark);
  box('dummy-fixed-spine', [0.34, 4.99, 0.32], [0, 2.715, -0.28], steel);
  for (const side of [-1, 1]) {
    box('dummy-foot-bolt', [0.16, 0.12, 0.16], [side * 0.72, 0.28, 0.48], steel);
    const brace = box('dummy-ground-brace', [0.15, 0.72, 0.15], [side * 0.37, 0.51, -0.20], steel);
    brace.rotation.z = side * -0.66;
  }
  box('dummy-body-target', [1.86, 2.5, 0.38], [0, 2.3, 0], paint, true);
  box('dummy-upper-target', [1.12, 0.88, 0.38], [0, 4.21, 0], cream, true);
  box('dummy-neck', [0.32, 0.22, 0.28], [0, 3.66, -0.04], steel);
  for (const side of [-1, 1]) {
    box('dummy-shoulder-flange', [0.30, 0.43, 0.38], [side * 1.08, 3.12, 0], dark, true);
    box('dummy-side-strike-strip', [0.13, 1.46, 0.08], [side * 0.72, 2.2, 0.23], steel, true);
  }
  bullseye('dummy-pilot-bullseye', 2.3, 0.59);
  bullseye('dummy-mech-bullseye', 4.35, 0.40);

  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#21362f'; ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = '#e7d7a8'; ctx.lineWidth = 9; ctx.strokeRect(14, 14, 996, 228);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff0cf'; ctx.font = '900 69px Arial, sans-serif';
  ctx.fillText('TRAINING DUMMY', 512, 92, 940);
  ctx.fillStyle = '#77dec3'; ctx.font = 'bold 29px Arial, sans-serif';
  ctx.fillText('UNLIMITED TARGET  /  RED CENTERS = CRITICAL', 512, 177, 932);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4; textures.push(texture);
  const sign = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  box('dummy-nameplate', [2.9, 0.68, 0.16], [0, 5.3, -0.28], [dark, dark, dark, dark, sign, dark]);
  group.userData.ownedTextures = textures;

  let disposed = false;
  return {
    group, radius: 1.35, aimPoint: new THREE.Vector3(0, 2.3, 0.335), damageAnchor: new THREE.Vector3(0, 4.95, 0.4),
    dispose() {
      if (disposed) return;
      disposed = true; group.removeFromParent();
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); textures.forEach(value => value.dispose());
    },
  };
}
