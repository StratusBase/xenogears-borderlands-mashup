import * as THREE from 'three';
import type { Mode } from '../core/index';
import type { EquipmentAppearance, EquipmentLoadoutAppearance } from '../core/appearance';
import { elementColors } from '../core/arsenal';
import { createComicMaterial } from './materials';
import { disposeEquipmentEffects } from './equipmentEffects';

export interface WeaponRig {
  group: THREE.Group;
  magazine?: THREE.Group;
  bolt?: THREE.Group;
  supportHand?: THREE.Group;
  breeches: THREE.Group[];
  barrels: THREE.Group[];
  magazineHome?: THREE.Vector3;
  boltHome?: THREE.Vector3;
  supportHandHome?: THREE.Vector3;
  breechHomes: THREE.Vector3[];
  barrelHomes: THREE.Vector3[];
  muzzles: THREE.Object3D[];
}

interface Palette {
  primary: THREE.Material;
  secondary: THREE.Material;
  metal: THREE.Material;
  dark: THREE.Material;
  accent: THREE.Material;
}

type PaletteColors = Pick<EquipmentAppearance, 'primary' | 'secondary' | 'metal' | 'accent'>;

// The wearer/chassis is a separate visual owner. Equipment appearance never
// supplies its jacket, helmet, body frame, cockpit glass, or bare hands.
const BODY_COLORS: Readonly<Record<Mode, Readonly<PaletteColors>>> = Object.freeze({
  pilot: Object.freeze({ primary: 0x405c69, secondary: 0xc9bb99, metal: 0x859293, accent: 0x74e2d5 }),
  mech: Object.freeze({ primary: 0x327e7c, secondary: 0xe5d4ad, metal: 0x859293, accent: 0x74e2d5 }),
});

function palette(appearance: Readonly<PaletteColors>): Palette {
  return {
    primary: createComicMaterial(appearance.primary),
    secondary: createComicMaterial(appearance.secondary),
    metal: createComicMaterial(appearance.metal),
    dark: createComicMaterial(0x273238),
    accent: new THREE.MeshBasicMaterial({ color: appearance.accent }),
  };
}

function group(name: string, parent?: THREE.Object3D): THREE.Group {
  const result = new THREE.Group();
  result.name = name;
  parent?.add(result);
  return result;
}

function box(parent: THREE.Object3D, name: string, size: readonly [number, number, number], position: readonly [number, number, number], material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent: THREE.Object3D, name: string, radius: number, length: number, position: readonly [number, number, number], material: THREE.Material, axis: 'x' | 'y' | 'z' = 'y', sides = 8): THREE.Mesh {
  const original = new THREE.CylinderGeometry(radius, radius, length, sides, 1);
  const geometry = original.toNonIndexed();
  original.dispose();
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function slotGroup(parent: THREE.Object3D, slot: string, appearance: EquipmentAppearance): THREE.Group {
  const result = group(`equipment-${slot}`, parent);
  result.userData.equipmentSlot = slot;
  result.userData.visualOwner = slot;
  result.userData.appearanceKey = appearance.key;
  result.userData.form = appearance.form;
  return result;
}

function familyShape(appearance: EquipmentAppearance): { width: number; height: number; length: number } {
  switch (appearance.weaponType) {
    case 'pistol': return { width: .86, height: .92, length: .63 };
    case 'smg': return { width: .91, height: 1.08, length: .81 };
    case 'shotgun': return { width: 1.15, height: .95, length: 1.18 };
    case 'sniper': return { width: .82, height: .87, length: 1.4 };
    case 'launcher': return { width: 1.45, height: 1.38, length: 1.1 };
    default: return { width: 1, height: 1, length: 1 };
  }
}

/** Manufacturer hardware is independent of the installed elemental cartridge. */
function makerHardware(root: THREE.Group, a: EquipmentAppearance, p: Palette, width: number, height: number, length: number): void {
  const details = group(`manufacturer-${a.brand ?? 'ironvale'}`, root);
  const v = a.visualVariant ?? a.variant;
  details.userData.visualVariant = v;
  switch (a.brand) {
    case 'prism':
      for (const s of [-1, 1]) box(details, 'prism-emitter-fork', [.035, height * .70, length * .9], [s * (width / 2 + .04), .035, -length * .12], p.secondary).rotation.z = s * -.2;
      break;
    case 'kestrel':
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) box(details, 'kestrel-cooling-fin', [.065, .035, length * .45], [s * (width / 2 + .03), -height * .22 + i * .065, -.04], p.metal);
      break;
    case 'rebound':
      for (const s of [-1, 1]) {
        cylinder(details, 'rebound-recoil-rail', .025, length * .85, [s * (width / 2 + .055), .01, 0], p.metal, 'z');
        for (let i = 0; i < 4; i++) cylinder(details, 'rebound-recoil-spring', .05, .025, [s * (width / 2 + .055), .01, (i - 1.5) * length * .17], p.secondary, 'z');
      }
      break;
    case 'tackwork':
      cylinder(details, 'tackwork-payload-reservoir', height * .45, length * .55, [-width / 2 - height * .35, 0, -.025], p.secondary, 'z');
      for (const s of [-1, 1]) box(details, 'tackwork-reservoir-clamp', [.05, height * 1.15, .07], [-width / 2 - height * .35, 0, s * length * .18], p.dark);
      break;
    case 'nullward':
      for (const s of [-1, 1]) box(details, 'nullward-field-paddle', [.04, height * 1.25, length * .62], [s * (width / 2 + .06), .06, -.04], p.secondary).rotation.z = s * .27;
      break;
    case 'cindergrid':
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) box(details, 'cindergrid-heat-sink', [.11, height * .8, .045], [s * (width / 2 + .035), .01, -length * .24 + i * length * .22], p.metal).rotation.z = s * -.16;
      break;
    case 'voltaic':
      for (const s of [-1, 1]) {
        cylinder(details, 'voltaic-capacitor', .075, height * 1.1, [s * (width / 2 + .07), .015, length * .08], p.secondary);
        cylinder(details, 'voltaic-terminal', .035, .045, [s * (width / 2 + .07), height * .60, length * .08], p.metal);
      }
      break;
    default:
      for (const s of [-1, 1]) {
        box(details, 'ironvale-reinforced-cheek', [.045, height * .74, length * .65], [s * (width / 2 + .023), -.01, .015], p.secondary);
        for (let i = 0; i < 3; i++) cylinder(details, 'ironvale-rivet', .017, .012, [s * (width / 2 + .052), .025, (i - 1) * length * .22], p.metal, 'x', 6);
      }
  }
  if (v % 2 === 1) box(details, 'variant-side-brace', [.035, height * .48, length * .9], [width / 2 + .11, -.03, 0], p.dark).rotation.x = .11;
  if (v >= 2) cylinder(details, 'variant-balance-weight', .075, .14, [0, -height * .65, length * .3], p.secondary, 'x');
  const family = a.weaponType ?? 'rifle';
  if (family === 'sniper') {
    cylinder(details, 'sniper-telescopic-optic', .075, .42, [0, height / 2 + .14, -.03], p.dark, 'z');
    cylinder(details, 'sniper-objective-lens', .067, .018, [0, height / 2 + .14, -.25], p.accent, 'z');
    for (const s of [-1, 1]) box(details, 'sniper-folded-bipod', [.03, .045, .34], [s * width * .4, -height * .55, -.18], p.metal);
  } else if (family === 'shotgun') {
    cylinder(details, 'shotgun-underbarrel-feed', .058, length * .9, [0, -height * .55, -length * .2], p.metal, 'z');
    box(details, 'shotgun-pump-grip', [width * .8, .11, .24], [0, -height * .7, -length * .36], p.dark);
  } else if (family === 'launcher') {
    cylinder(details, 'launcher-payload-tube', width * .40, length * 1.1, [0, height * .25, -length * .25], p.secondary, 'z', 10);
    box(details, 'launcher-folding-sight', [.025, .3, .08], [-width * .6, height * .63, -.12], p.dark);
  } else if (family === 'pistol') {
    box(details, 'pistol-short-slide', [width * .9, .06, length * .83], [0, height * .58, -.015], p.metal);
  } else if (family === 'smg') {
    box(details, 'smg-vertical-foregrip', [.085, .25, .12], [0, -height * .75, -length * .36], p.dark);
  }
}

/** A barrel assembly always points toward local -Z. Its muzzle is part of that assembly. */
function barrel(parent: THREE.Object3D, appearance: EquipmentAppearance, p: Palette, scale: number, position: readonly [number, number, number]): { assembly: THREE.Group; muzzle: THREE.Object3D } {
  const assembly = group('weapon-barrel-assembly', parent);
  assembly.position.set(...position);
  let muzzleParent: THREE.Object3D = assembly;
  let muzzleZ: number;
  if (appearance.form === 'rapid') {
    const length = 0.68 * scale;
    for (let i = 0; i < 6; i++) {
      const angle = i / 6 * Math.PI * 2;
      const tube = group(`rotary-tube-${i}`, assembly);
      tube.position.set(Math.cos(angle) * 0.105 * scale, Math.sin(angle) * 0.105 * scale, 0);
      cylinder(tube, 'rotary-barrel', 0.034 * scale, length, [0, 0, -length / 2], p.metal, 'z');
      if (i === 0) muzzleParent = tube;
    }
    cylinder(assembly, 'rotary-front-collar', 0.163 * scale, 0.10 * scale, [0, 0, -length * 0.76], p.secondary, 'z', 12);
    cylinder(assembly, 'rotary-rear-collar', 0.18 * scale, 0.14 * scale, [0, 0, -0.06 * scale], p.primary, 'z', 12);
    muzzleZ = -length - 0.012 * scale;
  } else if (appearance.form === 'heavy') {
    cylinder(assembly, 'heavy-long-barrel', 0.09 * scale, 0.95 * scale, [0, 0, -0.475 * scale], p.metal, 'z');
    box(assembly, 'heavy-muzzle-brake', [0.27 * scale, 0.23 * scale, 0.20 * scale], [0, 0, -0.88 * scale], p.secondary);
    box(assembly, 'heavy-muzzle-bore', [0.11 * scale, 0.10 * scale, 0.018 * scale], [0, 0, -0.989 * scale], p.dark);
    muzzleZ = -1.008 * scale;
  } else if (appearance.form === 'compact') {
    cylinder(assembly, 'compact-barrel', 0.067 * scale, 0.29 * scale, [0, 0, -0.145 * scale], p.metal, 'z');
    cylinder(assembly, 'compact-muzzle', 0.085 * scale, 0.07 * scale, [0, 0, -0.285 * scale], p.dark, 'z');
    muzzleZ = -0.33 * scale;
  } else if (appearance.weaponType === 'launcher') {
    cylinder(assembly, 'launcher-wide-bore', .19 * scale, .64 * scale, [0, 0, -.32 * scale], p.metal, 'z', 10);
    cylinder(assembly, 'launcher-muzzle-rim', .23 * scale, .08 * scale, [0, 0, -.62 * scale], p.dark, 'z', 10);
    muzzleZ = -.675 * scale;
  } else if (appearance.weaponType === 'sniper') {
    cylinder(assembly, 'sniper-precision-barrel', .043 * scale, 1.04 * scale, [0, 0, -.52 * scale], p.metal, 'z');
    cylinder(assembly, 'sniper-suppressor', .077 * scale, .26 * scale, [0, 0, -.98 * scale], p.dark, 'z');
    muzzleZ = -1.12 * scale;
  } else if (appearance.weaponType === 'shotgun') {
    for (const s of [-1, 1]) cylinder(assembly, 'shotgun-twin-barrel', .063 * scale, .76 * scale, [s * .065 * scale, 0, -.38 * scale], p.metal, 'z');
    box(assembly, 'shotgun-muzzle-band', [.29 * scale, .17 * scale, .08 * scale], [0, 0, -.72 * scale], p.dark);
    muzzleZ = -.78 * scale;
  } else if (appearance.weaponType === 'pistol' || appearance.weaponType === 'smg') {
    const length = appearance.weaponType === 'pistol' ? .22 : .36;
    cylinder(assembly, 'short-weapon-barrel', .06 * scale, length * scale, [0, 0, -length * scale / 2], p.metal, 'z');
    cylinder(assembly, 'short-muzzle-collar', .075 * scale, .06 * scale, [0, 0, -length * scale], p.dark, 'z');
    muzzleZ = -(length + .04) * scale;
  } else {
    cylinder(assembly, 'rifled-barrel', 0.06 * scale, 0.54 * scale, [0, 0, -0.27 * scale], p.metal, 'z');
    cylinder(assembly, 'barrel-sleeve', 0.085 * scale, 0.28 * scale, [0, 0, -0.16 * scale], p.secondary, 'z');
    cylinder(assembly, 'muzzle-collar', 0.075 * scale, 0.07 * scale, [0, 0, -0.525 * scale], p.dark, 'z');
    muzzleZ = -0.575 * scale;
  }
  const muzzle = new THREE.Object3D();
  muzzle.name = 'weapon-muzzle';
  if (appearance.element && appearance.element !== 'kinetic') muzzle.userData.equipmentElement = appearance.element;
  muzzle.userData.equipmentVariant = appearance.visualVariant ?? appearance.variant;
  muzzle.userData.equipmentProjectile = appearance.projectile ?? 'bullet';
  muzzle.position.z = muzzleZ;
  muzzleParent.add(muzzle);
  const delivery = group(`delivery-${appearance.projectile ?? 'bullet'}`, assembly);
  if (appearance.projectile === 'beam' || appearance.projectile === 'arc') {
    for (const s of [-1, 1]) {
      box(delivery, 'energy-emitter-prong', [.035 * scale, .10 * scale, .24 * scale], [s * .11 * scale, 0, muzzleZ + .10 * scale], p.secondary);
      box(delivery, 'energy-emitter-tip', [.04 * scale, .065 * scale, .035 * scale], [s * .11 * scale, 0, muzzleZ - .005 * scale], p.accent);
    }
  } else if (appearance.projectile === 'orb') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.18 * scale, .035 * scale, 5, 12), p.secondary);
    ring.name = 'orb-field-focus'; ring.position.z = muzzleZ + .025 * scale; ring.castShadow = ring.receiveShadow = true; delivery.add(ring);
  } else if (appearance.projectile === 'disc' || appearance.projectile === 'ricochet') {
    box(delivery, 'disc-launch-slot', [.32 * scale, .065 * scale, .19 * scale], [0, 0, muzzleZ + .10 * scale], p.secondary);
    for (let i = 0; i < 3; i++) cylinder(delivery, 'disc-feed-platter', .115 * scale, .025 * scale, [.12 * scale, (.11 + i * .04) * scale, muzzleZ * .4], p.metal);
  } else if (appearance.projectile === 'sticky') {
    cylinder(delivery, 'sticky-injector-nozzle', .115 * scale, .14 * scale, [0, 0, muzzleZ + .06 * scale], p.secondary, 'z');
    cylinder(delivery, 'sticky-pressure-reservoir', .09 * scale, .27 * scale, [-.17 * scale, 0, muzzleZ * .45], p.metal, 'z');
  } else if (appearance.projectile === 'cluster') {
    cylinder(delivery, 'cluster-canister-sleeve', .16 * scale, .10 * scale, [0, 0, muzzleZ + .08 * scale], p.secondary, 'z', 12);
    for (let i = 0; i < 6; i++) {
      const angle = i / 6 * Math.PI * 2;
      cylinder(delivery, 'cluster-loading-cell', .039 * scale, .30 * scale, [Math.cos(angle) * .115 * scale, Math.sin(angle) * .115 * scale, muzzleZ * .47], p.metal, 'z', 6);
    }
  } else if (appearance.projectile === 'homing' || appearance.projectile === 'rocket') {
    for (const s of [-1, 1]) box(delivery, 'ordnance-guide-rail', [.055 * scale, .12 * scale, .40 * scale], [s * .14 * scale, .035 * scale, muzzleZ * .48], p.secondary);
    if (appearance.projectile === 'homing') box(delivery, 'guidance-seeker', [.09 * scale, .10 * scale, .13 * scale], [0, .16 * scale, muzzleZ * .4], p.accent);
  } else if (appearance.projectile === 'spike') {
    for (const s of [-1, 1]) box(delivery, 'spike-accelerator-rail', [.026 * scale, .06 * scale, .42 * scale], [s * .095 * scale, 0, muzzleZ * .48], p.secondary);
  } else if (appearance.projectile === 'slug' || appearance.projectile === 'scatter') {
    cylinder(delivery, appearance.projectile === 'slug' ? 'slug-pressure-sleeve' : 'scatter-spreader', (appearance.projectile === 'slug' ? .10 : .14) * scale, .18 * scale, [0, 0, muzzleZ + .10 * scale], p.secondary, 'z');
  }
  // Element cartridges own narrow heat-transfer bands and a small chamber.
  // Receiver, magazine, grip and manufacturer paint retain their own identity.
  const elements = [appearance.element, appearance.secondaryElement].filter((value, index, all) => value && value !== 'kinetic' && all.indexOf(value) === index);
  elements.forEach((element, index) => {
    const material = element === appearance.element ? p.accent : new THREE.MeshBasicMaterial({ color: elementColors[element!] });
    for (let band = 0; band < 2; band++) {
      const transfer = cylinder(assembly, `element-transfer-band-${index}-${band}`, (.10 + index * .018) * scale, .026 * scale, [0, 0, muzzleZ * (.56 + band * .13)], material, 'z', 10);
      transfer.userData.equipmentElementSurface = element;
    }
    const chamber = box(assembly, `element-chamber-${index}`, [.055 * scale, .09 * scale, .17 * scale], [(index === 0 ? -1 : 1) * .11 * scale, .025 * scale, muzzleZ * .28], material);
    chamber.userData.equipmentElementSurface = element;
    if (index > 0 || !muzzle.userData.equipmentElement) {
      const port = new THREE.Object3D(); port.name = 'weapon-secondary-element-port';
      port.position.set(.11 * scale, .025 * scale, muzzleZ * .28);
      port.userData.equipmentElement = element; port.userData.equipmentVariant = (appearance.visualVariant ?? appearance.variant) + 1;
      port.userData.equipmentProjectile = appearance.projectile ?? 'bullet'; assembly.add(port);
    }
  });
  return { assembly, muzzle };
}

function pilotWeapon(appearance: EquipmentAppearance, includeReloadHand = true): WeaponRig {
  const root = group('pilot-weapon-rig');
  root.position.set(0.34, -0.30, -0.65);
  root.userData.appearanceKey = appearance.key;
  root.userData.form = appearance.form;
  root.userData.visualOwner = 'weapon';
  const rig: WeaponRig = { group: root, breeches: [], barrels: [], breechHomes: [], barrelHomes: [], muzzles: [] };
  if (includeReloadHand) {
    const supportHand = group('weapon-support-hand', root);
    supportHand.userData.visualOwner = 'body';
    supportHand.position.set(-0.15, -0.15, -0.24);
    box(supportHand, 'support-glove', [0.15, 0.13, 0.18], [0, 0, 0], createComicMaterial(0x273238));
    box(supportHand, 'support-thumb', [0.06, 0.09, 0.10], [-0.08, 0.035, -0.01], createComicMaterial(BODY_COLORS.pilot.secondary));
    supportHand.visible = false;
    rig.supportHand = supportHand;
    rig.supportHandHome = supportHand.position.clone();
  }
  if (!appearance.equipped) return rig;
  const p = palette(appearance);
  const heavy = appearance.form === 'heavy';
  const compact = appearance.form === 'compact';
  const rapid = appearance.form === 'rapid';
  const shape = familyShape(appearance);
  const width = (heavy ? 0.43 : rapid ? 0.34 : compact ? 0.25 : 0.28) * shape.width;
  const height = (heavy ? 0.31 : rapid ? 0.27 : 0.22) * shape.height;
  const length = (heavy ? 0.80 : compact ? 0.43 : 0.62) * shape.length;
  box(root, 'weapon-receiver', [width, height, length], [0, 0, 0], p.primary);
  box(root, 'receiver-upper-rail', [width * 0.7, 0.07, length * 0.72], [0, height / 2 + 0.035, -0.035], p.secondary);
  box(root, 'pistol-grip', [0.12, 0.24, 0.15], [0, -height / 2 - 0.10, length * 0.27], p.dark).rotation.x = -0.16;
  if (appearance.weaponType === 'pistol') {
    box(root, 'pistol-beavertail', [.16, .05, .07], [0, -.03, length / 2 + .02], p.secondary);
  } else if (compact || appearance.weaponType === 'smg') {
    box(root, 'folded-stock-spine', [0.07, 0.08, 0.4], [width / 2 + 0.045, 0.02, 0.1], p.metal);
    box(root, 'folded-stock-pad', [0.09, 0.24, 0.10], [width / 2 + 0.045, -0.04, -0.12], p.secondary);
  } else {
    box(root, 'weapon-stock-neck', [0.12, 0.11, 0.14], [0, -0.015, length / 2 + 0.04], p.metal);
    box(root, 'weapon-stock', [heavy ? 0.29 : 0.19, heavy ? 0.32 : 0.25, heavy ? 0.14 : 0.18], [0, -0.02, length / 2 + (heavy ? 0.08 : 0.10)], p.secondary);
  }
  const magazine = group('weapon-magazine', root);
  magazine.position.set(0, -height / 2, -length * 0.12);
  if (rapid) {
    cylinder(magazine, 'weapon-drum-magazine', 0.205, 0.32, [0, -0.17, 0], p.secondary, 'x', 12);
    cylinder(magazine, 'drum-hub', 0.07, 0.34, [0, -0.17, 0], p.accent, 'x');
  } else {
    box(magazine, 'weapon-box-magazine', [heavy ? 0.22 : 0.15, heavy ? 0.37 : compact ? 0.23 : 0.31, heavy ? 0.25 : 0.18], [0, heavy ? -0.185 : compact ? -0.115 : -0.155, 0], p.metal);
    box(magazine, 'magazine-base', [heavy ? 0.25 : 0.18, 0.045, heavy ? 0.27 : 0.20], [0, heavy ? -0.39 : compact ? -0.25 : -0.33, 0], p.secondary);
  }
  const bolt = group('weapon-bolt', root);
  bolt.position.set(width / 2 + 0.025, height * 0.18, length * 0.05);
  box(bolt, 'bolt-slider', [0.055, 0.055, 0.21], [0, 0, 0], p.metal);
  box(bolt, 'bolt-handle', [0.085, 0.06, 0.055], [0.035, 0, 0.065], p.dark);
  const tube = barrel(root, appearance, p, 1, [0, 0, -length / 2]);
  makerHardware(root, appearance, p, width, height, length);
  if (appearance.variant === 0) {
    box(root, 'raised-optic', [0.14, 0.14, 0.2], [0, height / 2 + 0.14, -0.08], p.dark);
    box(root, 'optic-glass', [0.10, 0.07, 0.015], [0, height / 2 + 0.15, -0.188], p.accent);
  } else if (appearance.variant === 1) {
    box(root, 'carry-handle-front', [0.055, 0.11, 0.07], [0, height / 2 + 0.11, -0.16], p.metal);
    box(root, 'carry-handle-rear', [0.055, 0.11, 0.07], [0, height / 2 + 0.11, 0.15], p.metal);
    box(root, 'carry-handle-bridge', [0.065, 0.055, 0.38], [0, height / 2 + 0.19, 0], p.dark);
  } else {
    box(root, 'side-mounted-cell', [0.10, 0.16, 0.26], [-width / 2 - 0.05, 0, 0.05], p.secondary);
    box(root, 'receiver-status', [0.015, 0.055, 0.14], [-width / 2 - 0.108, 0.02, 0.04], p.accent);
  }
  rig.magazine = magazine;
  rig.bolt = bolt;
  rig.magazineHome = magazine.position.clone();
  rig.boltHome = bolt.position.clone();
  rig.barrels.push(tube.assembly);
  rig.barrelHomes.push(tube.assembly.position.clone());
  rig.muzzles.push(tube.muzzle);
  return rig;
}

function mechCannon(appearance: EquipmentAppearance): { group: THREE.Group; breech: THREE.Group; barrel: THREE.Group; muzzle: THREE.Object3D } {
  const root = group('mech-cannon');
  root.userData.visualOwner = 'weapon';
  const p = palette(appearance);
  const heavy = appearance.form === 'heavy';
  const compact = appearance.form === 'compact';
  const rapid = appearance.form === 'rapid';
  const shape = familyShape(appearance);
  const width = (heavy ? 0.65 : compact ? 0.40 : rapid ? 0.55 : 0.49) * shape.width;
  const length = (heavy ? 0.88 : compact ? 0.45 : 0.69) * shape.length;
  const height = (heavy ? 0.49 : compact ? 0.29 : 0.37) * shape.height;
  box(root, 'cannon-receiver', [width, height, length], [0, 0, -0.10], p.primary);
  box(root, 'cannon-under-brace', [width * 0.75, 0.12, length * 0.80], [0, -height / 2 - 0.06, -0.09], p.dark);
  box(root, 'cannon-top-armor', [width * 1.08, 0.10, length * 0.7], [0, height / 2 + 0.05, -0.12], p.secondary);
  const breech = group('cannon-breech', root);
  breech.position.set(0, height / 2 + 0.10, length * 0.25 + 0.135);
  box(breech, 'breech-hatch', [width * 1.08, 0.11, 0.27], [0, 0.055, -0.135], p.metal);
  box(breech, 'breech-handle', [0.18, 0.07, 0.08], [0, 0.145, -0.115], p.dark);
  if (rapid) {
    cylinder(root, 'cannon-ammunition-drum', 0.29, 0.29, [width / 2 + 0.12, -0.02, 0.04], p.secondary, 'x', 12);
  } else if (heavy) {
    box(root, 'heavy-cannon-side-magazine', [0.22, 0.31, 0.44], [-width / 2 - 0.11, -0.03, 0.02], p.secondary);
  } else if (compact) {
    box(root, 'compact-cannon-cell', [0.14, 0.22, 0.25], [width / 2 + 0.07, -0.02, 0.08], p.metal);
  }
  const tube = barrel(root, appearance, p, 1.45, [0, 0, -length / 2 - 0.10]);
  makerHardware(root, appearance, p, width, height, length);
  for (let index = 0; index <= appearance.variant; index++) {
    box(root, 'cannon-status-cell', [0.08, 0.025, 0.08], [(index - appearance.variant / 2) * 0.12, height / 2 + 0.112, -0.2], p.accent);
  }
  return { group: root, breech, barrel: tube.assembly, muzzle: tube.muzzle };
}

function viewEquipment(root: THREE.Group, mode: Mode, loadout: EquipmentLoadoutAppearance): void {
  const modules = group('view-equipment-modules', root);
  // Module coordinates are camera-local while the pilot rifle retains its own
  // offset anchor. Recoil/reload still move the complete rig together.
  modules.position.copy(root.position).multiplyScalar(-1);
  if (loadout.shield.equipped) {
    const shield = slotGroup(modules, 'shield', loadout.shield), p = palette(loadout.shield);
    if (mode === 'pilot') {
      box(shield, 'shield-forearm-sleeve', [0.15, 0.14, 0.29], [-0.43, -0.48, -0.46], p.dark);
      if (loadout.shield.form === 'fortified') {
        box(shield, 'fortified-view-shield', [0.27, 0.32, 0.13], [-0.44, -0.34, -0.69], p.primary);
        box(shield, 'view-shield-emitter', [0.14, 0.15, 0.025], [-0.44, -0.31, -0.77], p.accent);
      } else if (loadout.shield.form === 'lightweight') {
        box(shield, 'lightweight-view-shield-fin', [0.08, 0.29, 0.20], [-0.44, -0.34, -0.69], p.primary).rotation.z = -0.30;
        cylinder(shield, 'lightweight-view-emitter', 0.073, 0.07, [-0.44, -0.40, -0.73], p.accent, 'z');
      } else {
        box(shield, 'view-shield-cuff', [0.21, 0.17, 0.20], [-0.43, -0.39, -0.65], p.primary);
        cylinder(shield, 'view-shield-projector', 0.07, 0.04, [-0.43, -0.34, -0.77], p.accent, 'z');
      }
    } else {
      for (const side of [-1, 1]) {
        const fortified = loadout.shield.form === 'fortified';
        box(shield, 'cockpit-shield-guard', [fortified ? 0.37 : 0.21, fortified ? 0.38 : 0.24, 0.24], [side * 1.06, -0.47, -1.10], p.primary);
        if (loadout.shield.form === 'lightweight') box(shield, 'cockpit-shield-wing', [0.07, 0.40, 0.40], [side * 1.16, -0.38, -1.10], p.secondary).rotation.z = side * -0.32;
        box(shield, 'cockpit-shield-status', [0.10, 0.05, 0.03], [side * 1.06, -0.37, -1.235], p.accent);
      }
    }
  }
  if (loadout.reactor.equipped) {
    const cooling = slotGroup(modules, 'reactor', loadout.reactor), p = palette(loadout.reactor);
    if (mode === 'pilot') {
      box(cooling, 'view-reactor-mount', [0.17, 0.065, 0.16], [0.51, -0.19, -0.62], p.metal);
      if (loadout.reactor.form === 'capacity') {
        box(cooling, 'view-battery-brick', [0.19, 0.26, 0.30], [0.61, -0.15, -0.65], p.primary);
        for (let i = 0; i < 3; i++) box(cooling, 'view-battery-cell', [0.055, 0.09, 0.04], [0.55 + i * 0.06, -0.08, -0.82], p.accent);
      } else if (loadout.reactor.form === 'vented') {
        box(cooling, 'view-cooling-core', [0.13, 0.22, 0.24], [0.60, -0.15, -0.64], p.primary);
        for (let i = 0; i < 4; i++) box(cooling, 'view-cooling-fin', [0.24, 0.028, 0.29], [0.61, -0.24 + i * 0.065, -0.66], p.metal);
      } else {
        box(cooling, 'view-standard-reactor', [0.14, 0.17, 0.24], [0.59, -0.17, -0.63], p.primary);
        box(cooling, 'view-reactor-indicator', [0.08, 0.04, 0.025], [0.59, -0.12, -0.765], p.accent);
      }
    } else {
      for (const side of [-1, 1]) {
        if (loadout.reactor.form === 'vented') {
          cylinder(cooling, 'view-vent-stack', 0.13, 0.47, [side * 1.05, -0.14, -1.05], p.primary);
          for (let i = 0; i < 3; i++) box(cooling, 'view-vent-fin', [0.32, 0.035, 0.33], [side * 1.05, -0.28 + i * 0.13, -1.05], p.metal);
        } else {
          const capacity = loadout.reactor.form === 'capacity';
          box(cooling, 'view-reactor-side-pod', [capacity ? 0.35 : 0.22, capacity ? 0.38 : 0.25, capacity ? 0.43 : 0.30], [side * 1.05, -0.15, -1.05], p.primary);
          box(cooling, 'view-reactor-status', [0.13, 0.06, 0.025], [side * 1.05, -0.08, capacity ? -1.28 : -1.215], p.accent);
        }
      }
    }
  }
  if (mode === 'mech' && loadout.legs.equipped) {
    const servos = slotGroup(modules, 'legs', loadout.legs), p = palette(loadout.legs);
    for (const side of [-1, 1]) {
      cylinder(servos, 'view-lower-servo-piston', 0.055, loadout.legs.form === 'sprinter' ? 0.49 : 0.34, [side * 0.58, -0.80, -1.30], p.metal);
      box(servos, 'view-servo-housing', [loadout.legs.form === 'armored' ? 0.23 : 0.13, 0.23, 0.19], [side * 0.58, -0.82, -1.30], p.primary);
    }
  }
}

/** Camera-local models; handles and their home vectors share the same local parent space. */
export function createEquipmentWeapon(mode: Mode, appearance: EquipmentAppearance, loadout?: EquipmentLoadoutAppearance): WeaponRig {
  if (mode === 'pilot') {
    const result = pilotWeapon(appearance);
    if (loadout) viewEquipment(result.group, mode, loadout);
    return result;
  }
  const root = group('mech-weapon-rig');
  root.userData.appearanceKey = appearance.key;
  root.userData.form = appearance.form;
  root.userData.visualOwner = 'weapon';
  const result: WeaponRig = { group: root, breeches: [], barrels: [], breechHomes: [], barrelHomes: [], muzzles: [] };
  if (appearance.equipped) {
    for (const side of [-1, 1]) {
      const cannon = mechCannon(appearance);
      cannon.group.position.set(side * 0.8, -0.55, -0.55);
      root.add(cannon.group);
      result.breeches.push(cannon.breech);
      result.breechHomes.push(cannon.breech.position.clone());
      result.barrels.push(cannon.barrel);
      result.barrelHomes.push(cannon.barrel.position.clone());
      result.muzzles.push(cannon.muzzle);
    }
  }
  if (loadout) viewEquipment(root, mode, loadout);
  return result;
}

function mechLegs(parent: THREE.Group, appearance: EquipmentAppearance, base: Palette): void {
  for (const side of [-1, 1]) {
    box(parent, 'base-foot', [0.90, 0.44, 1.35], [side * 0.74, 0.22, 0.22], base.dark);
    box(parent, 'lower-leg-frame', [0.56, 1.10, 0.62], [side * 0.72, 0.99, 0], base.metal);
    cylinder(parent, 'knee-joint', 0.29, 0.68, [side * 0.70, 1.65, 0], base.dark, 'x');
    box(parent, 'upper-leg-frame', [0.54, 0.82, 0.64], [side * 0.63, 2.12, 0], base.dark);
  }
  mechLegEquipment(parent, appearance);
}

function mechLegEquipment(parent: THREE.Group, appearance: EquipmentAppearance): void {
  if (!appearance.equipped) return;
  const addon = slotGroup(parent, 'legs', appearance), p = palette(appearance);
  for (const side of [-1, 1]) {
    if (appearance.form === 'sprinter') {
      box(addon, 'sprinter-forward-toe', [0.60, 0.19, 1.55], [side * 0.74, 0.19, 0.40], p.primary);
      box(addon, 'sprinter-shin-fin', [0.22, 1.30, 0.92], [side * 0.74, 1.01, 0.18], p.secondary).rotation.x = -0.13;
      cylinder(addon, 'sprinter-calf-thruster', 0.24, 0.62, [side * 0.74, 1.15, -0.60], p.primary, 'z');
      cylinder(addon, 'sprinter-exhaust', 0.15, 0.025, [side * 0.74, 1.15, -0.9225], p.accent, 'z');
    } else if (appearance.form === 'armored') {
      box(addon, 'armored-foot-cap', [1.16, 0.35, 1.25], [side * 0.74, 0.47, 0.35], p.primary);
      box(addon, 'armored-shin-plate', [0.99, 1.27, 0.37], [side * 0.73, 1.06, 0.45], p.primary);
      box(addon, 'armored-knee-plate', [1.08, 0.52, 0.33], [side * 0.70, 1.73, 0.49], p.secondary);
    } else {
      box(addon, 'servo-shin-guard', [0.74, 1.0, 0.26], [side * 0.73, 1.02, 0.38], p.primary);
      box(addon, 'servo-toe-plate', [0.93, 0.18, 0.82], [side * 0.74, 0.49, 0.47], p.secondary);
    }
    for (let i = 0; i <= appearance.variant; i++) box(addon, 'leg-calibration-cell', [0.14, 0.13, 0.08], [side * 0.74, 0.76 + i * 0.20, appearance.form === 'standard' ? 0.55 : 0.63], p.accent);
  }
}

function pilotLegEquipment(parent: THREE.Group, appearance: EquipmentAppearance): void {
  if (!appearance.equipped) return;
  const addon = slotGroup(parent, 'legs', appearance), p = palette(appearance);
  for (const side of [-1, 1]) {
    if (appearance.form === 'sprinter') {
      box(addon, 'sprinter-toe', [0.18, 0.12, 0.40], [side * 0.13, 0.09, 0.10], p.primary);
      box(addon, 'sprinter-calf-fin', [0.07, 0.35, 0.28], [side * 0.19, 0.40, -0.02], p.secondary);
    } else if (appearance.form === 'armored') {
      box(addon, 'armored-boot', [0.25, 0.19, 0.36], [side * 0.13, 0.22, 0.08], p.primary);
      box(addon, 'armored-pilot-shin', [0.24, 0.34, 0.10], [side * 0.13, 0.43, 0.13], p.primary);
      box(addon, 'armored-pilot-knee', [0.25, 0.15, 0.10], [side * 0.13, 0.64, 0.14], p.secondary);
    } else {
      box(addon, 'field-boot-cuff', [0.22, 0.14, 0.23], [side * 0.13, 0.26, 0], p.primary);
      box(addon, 'field-shin-plate', [0.17, 0.26, 0.07], [side * 0.13, 0.43, 0.12], p.secondary);
    }
    for (let i = 0; i <= appearance.variant; i++) {
      const buckleZ = appearance.form === 'armored' ? (i === 0 ? 0.2725 : 0.1925) : appearance.form === 'sprinter' ? (i === 0 ? 0.2275 : 0.1325) : 0.1275;
      box(addon, 'pilot-boot-buckle', [0.18, 0.03, 0.025], [side * 0.13, 0.19 + i * 0.065, buckleZ], p.metal);
    }
  }
}

function reactor(parent: THREE.Group, appearance: EquipmentAppearance, pilot: boolean): void {
  if (!appearance.equipped) return;
  const addon = slotGroup(parent, 'reactor', appearance), p = palette(appearance);
  const scale = pilot ? 0.24 : 1;
  addon.scale.setScalar(scale);
  addon.position.set(0, pilot ? 1.2 : 3.68, pilot ? -0.22 : -0.84);
  box(addon, 'reactor-spine-mount', [0.50, 0.90, pilot ? 0.36 : 0.18], [0, 0, pilot ? 0.16 : 0.04], p.dark);
  if (appearance.form === 'vented') {
    box(addon, 'vented-reactor-core', [1.15, 1.15, 0.66], [0, 0, -0.29], p.primary);
    for (const side of [-1, 1]) {
      cylinder(addon, 'cooling-exhaust-stack', 0.23, 1.9, [side * 0.69, 0.36, -0.36], p.secondary);
      cylinder(addon, 'exhaust-collar', 0.29, 0.16, [side * 0.69, 1.28, -0.36], p.metal);
    }
    for (let i = 0; i < 4; i++) box(addon, 'reactor-cooling-fin', [1.6, 0.09, 0.77], [0, -0.36 + i * 0.25, -0.40], p.metal);
  } else if (appearance.form === 'capacity') {
    box(addon, 'high-capacity-battery', [1.72, 1.54, 0.96], [0, -0.10, -0.45], p.primary);
    for (const side of [-1, 1]) box(addon, 'capacity-side-cell', [0.40, 1.05, 0.69], [side * 1.02, -0.14, -0.40], p.secondary);
    box(addon, 'battery-retaining-belt', [2.49, 0.18, 1.03], [0, -0.20, -0.45], p.dark);
  } else {
    box(addon, 'standard-reactor-pack', [1.13, 1.19, 0.60], [0, 0, -0.26], p.primary);
    for (let i = 0; i < 3; i++) box(addon, 'reactor-vent', [0.80, 0.10, 0.07], [0, -0.32 + i * 0.30, -0.60], p.metal);
  }
  const chargeZ = appearance.form === 'capacity' ? -0.96 : appearance.form === 'vented' ? -0.65 : -0.59;
  for (let i = 0; i <= appearance.variant; i++) box(addon, 'reactor-charge-cell', [0.18, 0.14, 0.06], [(i - appearance.variant / 2) * 0.30, 0.38, chargeZ], p.accent);
}

function shields(parent: THREE.Group, appearance: EquipmentAppearance, pilot: boolean): void {
  if (!appearance.equipped) return;
  const addon = slotGroup(parent, 'shield', appearance), p = palette(appearance);
  addon.scale.setScalar(pilot ? 0.22 : 1);
  addon.position.y = pilot ? 1.28 : 3.95;
  if (appearance.form === 'fortified') {
    box(addon, 'fortified-arm-shield', [0.45, 1.65, 1.12], [-1.98, -0.42, 0.28], p.primary);
    box(addon, 'fortified-shoulder-rampart', [1.40, 0.49, 1.46], [-1.48, 0.48, 0], p.secondary);
    cylinder(addon, 'fortified-projector', 0.29, 0.08, [-2.25, -0.20, 0.32], p.accent, 'x');
  } else if (appearance.form === 'lightweight') {
    for (const side of [-1, 1]) {
      box(addon, 'lightweight-shield-wing', [0.25, 0.98, 1.34], [side * 1.75, 0.35, -0.15], p.primary).rotation.z = side * -0.38;
      cylinder(addon, 'lightweight-emitter', 0.19, 0.17, [side * 1.86, -0.28, 0.22], p.accent, 'x');
    }
  } else {
    for (const side of [-1, 1]) {
      box(addon, 'shield-shoulder-carrier', [0.88, 0.29, 1.03], [side * 1.49, 0.42, 0], p.primary);
      cylinder(addon, 'shield-projector', 0.31, 0.15, [side * 1.97, 0.22, 0.05], p.secondary, 'x');
      cylinder(addon, 'shield-projector-core', 0.16, 0.17, [side * 1.99, 0.22, 0.05], p.accent, 'x');
    }
  }
  box(addon, 'shield-capacitor-mount', [0.22, 0.95, 0.14], [-1.85, -0.20, -0.30], p.dark);
  for (let i = 0; i <= appearance.variant; i++) box(addon, 'shield-capacitor', [0.20, 0.19, 0.28], [-1.85, -0.48 + i * 0.27, -0.47], p.metal);
}

function mechCharacter(loadout: EquipmentLoadoutAppearance): THREE.Group {
  const root = group('equipment-mech');
  root.userData.visualOwner = 'body';
  const legs = group('legs', root), torso = group('torso', root), head = group('head', root), arms = group('arms', root);
  const base = palette(BODY_COLORS.mech);
  mechLegs(legs, loadout.legs, base);
  box(torso, 'hip-chassis', [1.65, 0.65, 1.12], [0, 2.65, 0], base.dark);
  box(torso, 'torso-chassis', [2.16, 1.6, 1.48], [0, 3.76, 0], base.secondary);
  box(torso, 'cockpit-frame', [1.48, 0.86, 0.14], [0, 3.95, 0.81], base.dark);
  box(torso, 'cockpit-window', [1.19, 0.48, 0.05], [0, 4.04, 0.905], base.accent);
  box(torso, 'cockpit-lower-brace', [1.16, 0.17, 0.22], [0, 3.42, 0.82], base.primary);
  box(head, 'head-housing', [0.96, 0.72, 0.88], [0, 4.94, 0.08], base.secondary);
  box(head, 'neck-coupler', [0.48, 0.25, 0.50], [0, 4.57, 0.05], base.dark);
  box(head, 'sensor-visor', [0.69, 0.18, 0.07], [0, 4.98, 0.555], base.accent);
  box(head, 'antenna-stem', [0.08, 1.08, 0.08], [0.32, 5.61, 0], base.metal);
  box(head, 'antenna-tip', [0.18, 0.17, 0.18], [0.32, 6.07, 0], base.accent);
  for (const side of [-1, 1]) {
    box(arms, 'shoulder-chassis', [0.88, 0.84, 1.0], [side * 1.49, 4.06, 0], base.secondary);
    box(arms, 'upper-arm', [0.58, 1.04, 0.62], [side * 1.68, 3.30, 0], base.dark);
    box(arms, 'forearm-chassis', [0.73, 0.68, 0.90], [side * 1.71, 2.67, 0.14], base.metal);
    if (loadout.weapon.equipped) {
      const weapon = mechCannon(loadout.weapon);
      weapon.group.name = `equipment-weapon-${side < 0 ? 'left' : 'right'}`;
      weapon.group.userData.equipmentSlot = 'weapon';
      weapon.group.userData.appearanceKey = loadout.weapon.key;
      weapon.group.position.set(side * 1.71, 2.67, 0.56);
      weapon.group.rotation.y = Math.PI;
      arms.add(weapon.group);
    }
  }
  reactor(torso, loadout.reactor, false);
  shields(arms, loadout.shield, false);
  return root;
}

function pilotCharacter(loadout: EquipmentLoadoutAppearance): THREE.Group {
  const root = group('equipment-pilot');
  root.userData.visualOwner = 'body';
  const legs = group('legs', root), torso = group('torso', root), head = group('head', root), arms = group('arms', root);
  const base = palette(BODY_COLORS.pilot);
  for (const side of [-1, 1]) {
    box(legs, 'base-boot', [0.19, 0.22, 0.32], [side * 0.13, 0.11, 0.055], base.dark);
    box(legs, 'pilot-calf', [0.15, 0.38, 0.17], [side * 0.13, 0.39, 0], base.secondary);
    box(legs, 'pilot-thigh', [0.18, 0.34, 0.20], [side * 0.13, 0.73, 0], base.dark);
  }
  box(torso, 'pilot-hips', [0.39, 0.19, 0.25], [0, 0.91, 0], base.dark);
  box(torso, 'pilot-jacket', [0.48, 0.48, 0.29], [0, 1.22, 0], base.secondary);
  box(torso, 'pilot-vest', [0.36, 0.32, 0.07], [0, 1.22, 0.18], base.primary);
  box(torso, 'pilot-collar', [0.31, 0.09, 0.31], [0, 1.49, 0], base.primary);
  box(head, 'pilot-helmet', [0.28, 0.29, 0.28], [0, 1.69, 0], base.secondary);
  box(head, 'pilot-neck', [0.14, 0.08, 0.14], [0, 1.54, 0], base.dark);
  box(head, 'pilot-visor', [0.235, 0.085, 0.025], [0, 1.72, 0.1525], base.dark);
  box(head, 'pilot-visor-glass', [0.18, 0.035, 0.012], [0, 1.73, 0.171], base.accent);
  for (const side of [-1, 1]) {
    box(arms, 'pilot-upper-arm', [0.15, 0.31, 0.18], [side * 0.31, 1.25, 0], base.secondary).rotation.z = side * 0.10;
    box(arms, 'pilot-forearm', [0.14, 0.28, 0.17], [side * 0.34, 1.0, 0.10], base.primary).rotation.x = -0.38;
    box(arms, 'pilot-glove', [0.145, 0.15, 0.18], [side * 0.34, 0.86, 0.17], base.dark);
  }
  if (loadout.weapon.equipped) {
    const weapon = pilotWeapon(loadout.weapon, false);
    weapon.group.name = 'equipment-weapon';
    weapon.group.userData.equipmentSlot = 'weapon';
    weapon.group.position.set(0.25, 1.0, 0.26);
    weapon.group.rotation.y = Math.PI;
    weapon.group.scale.setScalar(0.65);
    arms.add(weapon.group);
  }
  pilotLegEquipment(legs, loadout.legs);
  reactor(torso, loadout.reactor, true);
  shields(arms, loadout.shield, true);
  return root;
}

/** Standalone equipment uses the exact same slot factories as the equipped actor. */
export function createEquipmentItemModel(mode: Mode, appearance: EquipmentAppearance): THREE.Group {
  let result: THREE.Group;
  if (appearance.slot === 'weapon') {
    result = mode === 'pilot' ? pilotWeapon(appearance, false).group : mechCannon(appearance).group;
    result.position.set(0, 0, 0);
  } else {
    const holder = new THREE.Group();
    if (appearance.slot === 'shield') shields(holder, appearance, mode === 'pilot');
    else if (appearance.slot === 'reactor') reactor(holder, appearance, mode === 'pilot');
    else if (mode === 'pilot') pilotLegEquipment(holder, appearance);
    else mechLegEquipment(holder, appearance);
    result = holder.children[0] as THREE.Group | undefined ?? new THREE.Group();
    result.removeFromParent();
  }
  result.userData.equipmentSlot = appearance.slot;
  result.userData.visualOwner = appearance.slot;
  result.userData.appearanceKey = appearance.key;
  return result;
}

/** The same full actor is used for the inventory turntable and the parked world frame. */
export function createEquipmentCharacter(mode: Mode, loadout: EquipmentLoadoutAppearance): THREE.Group {
  const root = mode === 'mech' ? mechCharacter(loadout) : pilotCharacter(loadout);
  root.userData.appearanceKey = ['weapon', 'shield', 'reactor', 'legs'].map(slot => loadout[slot as keyof EquipmentLoadoutAppearance].key).join('|');
  root.userData.equipmentMode = mode;
  return root;
}

/** Each call owns its geometry/materials; the app's immutable paint maps stay shared. */
export function disposeEquipmentModel(root: THREE.Object3D): void {
  disposeEquipmentEffects(root);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  root.removeFromParent();
}
