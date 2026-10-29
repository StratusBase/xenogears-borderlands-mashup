import * as THREE from 'three';
import { createComicMaterial } from './materials';

export interface EncounterObjectiveVisual {
  readonly group: THREE.Group;
  update(active: boolean, complete: boolean, time: number): void;
  dispose(): void;
}

/** World marker; interaction distances and objective ownership stay in the game. */
export function createEncounterObjective(kind: 'relay' | 'extract', id: string): EncounterObjectiveVisual {
  const group = new THREE.Group(); group.name = `encounter-objective-${id}`;
  group.userData.objectiveId = id; group.userData.objectiveKind = kind;
  const dark = createComicMaterial(0x29333c), paint = createComicMaterial(kind === 'relay' ? 0xd87938 : 0x3c9198);
  const steel = createComicMaterial(0x96a5a1);
  const glow = new THREE.MeshBasicMaterial({ color: 0xffc458, toneMapped: false });
  const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0xffd778, transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false });
  const materials = new Set<THREE.Material>([dark, paint, steel, glow, beaconMaterial]);
  const geometries = new Set<THREE.BufferGeometry>();
  function mesh(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], warning = false) {
    const object = new THREE.Mesh(geometry, material); object.name = name; object.position.set(...position);
    object.castShadow = !warning; object.receiveShadow = !warning;
    if (warning) { object.userData.comicOverlay = true; object.raycast = () => {}; }
    geometries.add(geometry); group.add(object); return object;
  }
  function box(name: string, size: [number, number, number], position: [number, number, number], material: THREE.Material) {
    return mesh(name, new THREE.BoxGeometry(...size), material, position);
  }
  box('objective-base', [1.55, 0.32, 1.35], [0, 0.16, 0], dark);
  box('objective-column', [0.72, 1.1, 0.55], [0, 0.75, -0.05], paint);
  const panel = box('objective-console', [1.15, 0.45, 0.79], [0, 1.47, 0.10], dark);
  panel.rotation.x = -0.15;
  box('objective-status-strip', [0.84, 0.16, 0.045], [0, 1.52, 0.522], glow);
  for (const side of [-1, 1]) box(`objective-guard-${side}`, [0.12, 0.61, 0.75], [side * 0.57, 1.41, 0.10], steel);
  if (kind === 'relay') {
    box('relay-mast', [0.12, 1.54, 0.12], [0, 2.0, -0.34], steel);
    const antenna = mesh('relay-antenna', new THREE.TorusGeometry(0.37, 0.065, 5, 12), paint, [0, 2.57, -0.34]);
    antenna.rotation.y = 0.35;
    box('relay-antenna-core', [0.15, 0.15, 0.12], [0, 2.57, -0.24], glow);
  } else {
    box('extract-lockbox', [0.94, 0.46, 0.65], [0, 1.93, 0.02], paint);
    box('extract-lock', [0.17, 0.26, 0.06], [0, 1.94, 0.38], glow);
  }
  const beacon = mesh('objective-beacon', new THREE.OctahedronGeometry(0.28), beaconMaterial, [0, 3.5, 0], true);
  // The marker floats vertically around the beacon. Ground paint belongs to
  // the terrain shader, so objectives add no separate near-ground surface.
  const ring = mesh('objective-ring', new THREE.RingGeometry(0.37, 0.42, 16), beaconMaterial, [0, 3.5, 0], true);
  // Physical consoles remain visible because world collision and cover persist
  // throughout sandbox use, replay preparation, and every encounter phase.
  beacon.visible = false; ring.visible = false;
  group.userData.objectiveActive = false; group.userData.objectiveComplete = false;
  glow.color.set(0x586a68);
  let disposed = false;
  return {
    group,
    update(active, complete, time) {
      if (disposed) return;
      group.userData.objectiveActive = active; group.userData.objectiveComplete = complete;
      glow.color.set(complete ? 0x71edb3 : active ? 0xffc458 : 0x586a68);
      beacon.visible = active && !complete; ring.visible = active && !complete;
      beacon.rotation.y = time * 1.5; beacon.position.y = 3.4 + Math.sin(time * 2) * 0.14;
      ring.position.y = beacon.position.y; ring.rotation.y = time * 1.5;
      beaconMaterial.opacity = 0.55 + Math.sin(time * 3) * 0.16;
    },
    dispose() {
      if (disposed) return;
      disposed = true; group.removeFromParent();
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    },
  };
}
