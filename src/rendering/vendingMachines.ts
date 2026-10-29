import * as THREE from 'three';
import { createProgression, type Item } from '../core/index';
import type { VendingType } from '../core/vending';
import { createComicMaterial } from './materials';
import { createDroppedItemModel } from './dropModels';
import { createHealthPickup } from './healthPickup';
import { disposeEquipmentModel } from './equipmentModels';

export interface VendingMachineVisual {
  readonly group: THREE.Group;
  readonly textures: THREE.Texture[];
}

export const vendingPlacements: readonly { id: VendingType; x: number; z: number }[] = [
  { id: 'weapons', x: -14, z: 10 },
  { id: 'medical', x: -9, z: 12 },
  { id: 'mech', x: -16, z: 19 },
];

/** Three original cabinet designs; all signs are mapped onto physical faces. */
export function createVendingMachine(type: VendingType): VendingMachineVisual {
  const root = new THREE.Group();
  root.name = `vending-${type}`;
  root.userData.vendorType = type;
  const textures: THREE.Texture[] = [];
  root.userData.ownedTextures = textures;
  const primary = createComicMaterial(type === 'weapons' ? 0xd77d2c : type === 'medical' ? 0xf0e7d2 : 0xdba82c);
  const secondary = createComicMaterial(type === 'weapons' ? 0x3a4549 : type === 'medical' ? 0x278c89 : 0x48555e);
  const dark = createComicMaterial(0x263039), metal = createComicMaterial(0x899695);
  const light = new THREE.MeshBasicMaterial({ color: type === 'medical' ? 0x75e7cb : 0xffce65 });

  function box(name: string, dimensions: [number, number, number], position: [number, number, number], material: THREE.Material | THREE.Material[]): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = material !== light;
    mesh.receiveShadow = material !== light;
    root.add(mesh);
    return mesh;
  }
  function cylinder(name: string, radius: number, height: number, position: [number, number, number], material: THREE.Material): void {
    const indexed = new THREE.CylinderGeometry(radius, radius, height, 8, 1);
    const geometry = indexed.toNonIndexed(); indexed.dispose(); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.position.set(...position); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
  }
  function header(title: string, subtitle: string, width: number, height: number, depth: number, y: number): void {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 384;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = type === 'weapons' ? '#b45f24' : type === 'medical' ? '#236a69' : '#b38221';
    ctx.fillRect(0, 0, 1024, 384);
    ctx.strokeStyle = '#f6e7bd'; ctx.lineWidth = 10; ctx.strokeRect(20, 20, 984, 344);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff1d6';
    ctx.font = `900 ${title.length > 14 ? 77 : 88}px Arial, sans-serif`;
    ctx.fillText(title, 512, 151, 934);
    ctx.font = 'bold 34px Arial, sans-serif'; ctx.fillText(subtitle, 512, 266, 924);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4; textures.push(texture);
    const panel = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    const faces: THREE.Material[] = [primary, primary, primary, primary, panel, primary];
    box('vendor-nameplate', [width, height, depth], [0, y, 0], faces);
  }
  function product(model: THREE.Group, x: number, floor: number, z: number, scale: number, turn = 0): void {
    model.scale.multiplyScalar(scale); model.rotation.y = turn; model.position.set(x, floor, z); root.add(model);
  }
  function displayItem(source: Item, id: string, affix = source.affix): THREE.Group {
    // Cabinet displays retain their authored size independently of miniature ground loot.
    return createDroppedItemModel({ ...source, id: `vendor-display-${id}`, affix, stats: { ...source.stats } }, source.target === 'pilot' ? 1.4 : 2);
  }
  const inventory = createProgression().inventory;
  const starter = (target: Item['target'], slot: Item['slot']) => inventory.find(item => item.target === target && item.slot === slot)!;

  if (type === 'weapons') {
    box('armory-base', [2.5, 0.32, 1.4], [0, 0.16, 0], dark);
    for (const side of [-1, 1]) box('armory-side-column', [0.22, 2.36, 1.2], [side * 1.1, 1.5, 0], primary);
    box('armory-back', [1.98, 2.36, 0.14], [0, 1.5, -0.52], dark);
    box('armory-lower-shelf', [1.98, 0.14, 1.03], [0, 0.58, 0.04], metal);
    box('armory-upper-shelf', [1.98, 0.14, 1.03], [0, 1.48, 0.04], metal);
    header('WEAPONS + AMMO', 'FIELD ARMORY / TRADE TERMINAL', 2.5, 0.5, 1.4, 2.93);
    product(displayItem(starter('pilot', 'weapon'), 'field-rifle'), 0, 0.65, 0.08, 0.95, Math.PI / 2);
    product(displayItem(starter('pilot', 'weapon'), 'rotary-rifle', 'Rapid'), 0, 1.55, 0.08, 0.95, Math.PI / 2);
    for (let i = 0; i < 7; i++) cylinder('armory-cartridge', 0.045, 0.16, [-0.48 + i * 0.16, 0.40, 0.39], i % 2 ? metal : primary);
    box('armory-ready-light', [1.42, 0.055, 0.055], [0, 2.6525, 0.625], light);
  } else if (type === 'medical') {
    box('medical-base', [2.3, 0.3, 1.3], [0, 0.15, 0], secondary);
    for (const side of [-1, 1]) box('medical-side-column', [0.20, 2.10, 1.1], [side * 0.95, 1.35, 0], primary);
    box('medical-back', [1.7, 2.10, 0.14], [0, 1.35, -0.47], secondary);
    box('medical-lower-shelf', [1.7, 0.14, 0.98], [0, 0.50, 0.02], primary);
    box('medical-upper-shelf', [1.7, 0.14, 0.98], [0, 1.47, 0.02], primary);
    header('HEALTH + SHIELDS', 'MEDICAL SUPPLY / TRADE TERMINAL', 2.3, 0.5, 1.3, 2.65);
    for (const side of [-1, 1]) {
      const pickup = createHealthPickup();
      const body = pickup.children[0] as THREE.Group; body.removeFromParent(); disposeEquipmentModel(pickup);
      body.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(body), size = bounds.getSize(new THREE.Vector3());
      body.scale.multiplyScalar(0.7 / Math.max(size.x, size.y, size.z)); body.updateMatrixWorld(true); bounds.setFromObject(body);
      body.position.sub(new THREE.Vector3(bounds.getCenter(new THREE.Vector3()).x, bounds.min.y, bounds.getCenter(new THREE.Vector3()).z));
      // Preserve normalization inside a separate shelf placement group.
      const placed = new THREE.Group(); placed.name = 'vendor-medical-case'; placed.add(body); product(placed, side * 0.40, 0.57, 0.06, 1);
    }
    product(displayItem(starter('pilot', 'shield'), 'shield'), 0, 1.54, 0.04, 0.9);
    box('medical-ready-light', [1.3, 0.055, 0.055], [0, 2.3725, 0.575], light);
  } else {
    box('mech-depot-base', [3.5, 0.4, 1.9], [0, 0.20, 0], dark);
    for (const side of [-1, 1]) {
      box('mech-depot-column', [0.24, 2.7, 1.6], [side * 1.55, 1.75, 0], primary);
      cylinder('mech-depot-hydraulic', 0.09, 2.30, [side * 1.37, 1.55, 0.63], metal);
    }
    box('mech-depot-back', [2.86, 2.7, 0.15], [0, 1.75, -0.71], secondary);
    box('mech-depot-lower-rack', [2.86, 0.16, 1.44], [0, 0.52, 0.03], metal);
    box('mech-depot-upper-rack', [2.86, 0.16, 1.44], [0, 1.76, 0.03], metal);
    header('MECH PARTS', 'CANNONS / REACTORS / SERVO LEGS', 3.5, 0.6, 1.9, 3.4);
    product(displayItem(starter('mech', 'weapon'), 'cannon', 'Heavy'), -0.60, 0.60, 0.12, 0.72, Math.PI / 2);
    product(displayItem(starter('mech', 'legs'), 'servos', 'Armored'), 0.80, 0.60, 0.04, 0.53);
    product(displayItem(starter('mech', 'reactor'), 'reactor', 'Ventilated'), 0, 1.84, 0.05, 0.50);
    box('mech-depot-ready-light', [2.5, 0.075, 0.065], [0, 3.0625, 0.835], light);
  }
  return { group: root, textures };
}
