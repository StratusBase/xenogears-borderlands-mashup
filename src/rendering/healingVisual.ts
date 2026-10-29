import * as THREE from 'three';
import type { Mode } from '../core/index';
import type { EquipmentLoadoutAppearance } from '../core/appearance';
import { createComicMaterial } from './materials';

export interface HealingVisual {
  group: THREE.Group;
  update(mode: Mode, progress: number, active: boolean): void;
}

const ease = (v: number) => { const t = THREE.MathUtils.clamp(v, 0, 1); return t * t * (3 - 2 * t); };
const stage = (p: number, start: number, peak: number, hold: number, end: number) =>
  ease((p - start) / (peak - start)) * (1 - ease((p - hold) / (end - hold)));

/** Foreground recovery props are independent from the lowered weapon's transform. */
export function createHealingVisual(pilotLook: EquipmentLoadoutAppearance, _mechLook: EquipmentLoadoutAppearance): HealingVisual {
  const group = new THREE.Group(); group.name = 'recovery-view'; group.visible = false;
  const pilot = new THREE.Group(), mech = new THREE.Group();
  group.add(pilot, mech);
  const dark = createComicMaterial(0x24343a), metal = createComicMaterial(0x9ba5a2);
  const glove = createComicMaterial(0x5d5045);
  const armor = createComicMaterial(pilotLook.shield.primary), cuff = createComicMaterial(pilotLook.shield.secondary);
  // Utility tools and uniform sleeves are independent of equipped reactor/shield paint.
  const utilityArmor = createComicMaterial(0x405c69);
  const white = createComicMaterial(0xe7e1cc);
  const green = new THREE.MeshBasicMaterial({ color: 0x75f3a7, toneMapped: false });
  const pulse = new THREE.MeshBasicMaterial({ color: 0x9bffd0, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false });

  function box(parent: THREE.Group, w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  function rod(parent: THREE.Group, radius: number, length: number, x: number, y: number, z: number, material: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 8), material);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  function strut(parent: THREE.Group, from: THREE.Vector3, to: THREE.Vector3, radius: number): void {
    const delta = to.clone().sub(from);
    const part = rod(parent, radius, delta.length(), 0, 0, 0, metal);
    part.position.copy(from).add(to).multiplyScalar(0.5);
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  }

  const forearm = new THREE.Group(); forearm.name = 'offered-forearm'; pilot.add(forearm);
  box(forearm, 0.4, 0.105, 0.13, -0.06, 0, 0, glove);
  box(forearm, 0.23, 0.13, 0.15, -0.07, 0, 0, armor);
  box(forearm, 0.04, 0.14, 0.16, 0.065, 0, 0, cuff);
  box(forearm, 0.13, 0.08, 0.13, 0.17, 0, 0, glove);
  for (const z of [-0.045, 0, 0.045]) box(forearm, 0.12, 0.035, 0.035, 0.245, 0.005, z, glove);
  box(forearm, 0.06, 0.05, 0.06, 0.16, 0, 0.09, glove);
  box(forearm, 0.055, 0.014, 0.065, 0.035, 0.075, 0, dark);

  const injectorHand = new THREE.Group(); injectorHand.name = 'injector-hand'; pilot.add(injectorHand);
  box(injectorHand, 0.13, 0.14, 0.1, 0, -0.065, 0.08, glove);
  box(injectorHand, 0.11, 0.14, 0.13, 0, -0.19, 0.09, utilityArmor);
  for (const y of [-0.075, -0.025, 0.025]) box(injectorHand, 0.12, 0.035, 0.055, 0.015, y, 0.01, glove);
  box(injectorHand, 0.045, 0.09, 0.08, -0.065, 0.02, 0.05, glove);
  const injector = new THREE.Group(); injector.name = 'medical-injector'; injectorHand.add(injector);
  // An open frame exposes the cartridge; the green fluid is real moving geometry.
  for (const x of [-0.057, 0.057]) box(injector, 0.018, 0.22, 0.08, x, 0, 0, white);
  for (const y of [-0.125, 0.125]) rod(injector, 0.073, 0.035, 0, y, 0, metal);
  const fluid = rod(injector, 0.044, 0.19, 0, 0, 0, green); fluid.name = 'injector-cartridge';
  rod(injector, 0.025, 0.055, 0, 0.17, 0, white);
  rod(injector, 0.006, 0.08, 0, 0.23, 0, metal);
  const plunger = new THREE.Group(); plunger.name = 'injector-plunger'; injector.add(plunger);
  rod(plunger, 0.015, 0.09, 0, 0, 0, metal);
  rod(plunger, 0.065, 0.025, 0, -0.055, 0, dark);
  const injectionLight = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), pulse);
  injectionLight.userData.comicOverlay = true; injectionLight.position.set(0, 0.27, 0); injector.add(injectionLight);

  const arms: { root: THREE.Group; elbow: THREE.Group; tool: THREE.Group; contact: THREE.Group; side: number }[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.name = `repair-arm-${side}`; mech.add(arm);
    const elbow = new THREE.Group(); elbow.position.set(side * 0.18, 0.045, -0.18); arm.add(elbow);
    box(arm, 0.13, 0.14, 0.18, 0, 0, 0, utilityArmor);
    strut(arm, new THREE.Vector3(), elbow.position, 0.035);
    const joint = rod(elbow, 0.07, 0.12, 0, 0, 0, dark); joint.rotation.x = Math.PI / 2;
    strut(elbow, new THREE.Vector3(), new THREE.Vector3(side * 0.20, 0.07, -0.2), 0.027);
    const tool = new THREE.Group(); tool.name = `repair-driver-${side}`;
    tool.position.set(side * 0.20, 0.07, -0.2); elbow.add(tool);
    box(tool, 0.1, 0.12, 0.17, 0, 0, 0, utilityArmor);
    const drive = rod(tool, 0.045, 0.16, 0, 0.025, -0.12, metal); drive.rotation.x = Math.PI / 2;
    box(tool, 0.11, 0.035, 0.05, 0, 0.025, -0.20, dark);
    for (const x of [-0.05, 0.05]) box(tool, 0.025, 0.08, 0.07, x, 0.025, -0.23, metal);
    const contact = new THREE.Group(); contact.name = 'repair-contact-pulse'; tool.add(contact);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.009, 5, 12), pulse);
    ring.position.set(0, 0.025, -0.26); ring.userData.comicOverlay = true; contact.add(ring);
    for (let index = 0; index < 3; index++) {
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.016, 5, 4), pulse);
      spark.userData.comicOverlay = true;
      spark.position.set(Math.cos(index * 2.1) * 0.07, 0.025 + Math.sin(index * 2.1) * 0.07, -0.26);
      contact.add(spark);
    }
    arms.push({ root: arm, elbow, tool, contact, side });
  }

  return {
    group,
    update(mode, rawProgress, active) {
      group.visible = active;
      if (!active) return;
      const p = THREE.MathUtils.clamp(rawProgress, 0, 1);
      const present = stage(p, 0, 0.18, 0.78, 1);
      const contact = stage(p, 0.20, 0.37, 0.64, 0.82);
      const press = stage(p, 0.34, 0.46, 0.64, 0.79);
      pilot.visible = mode === 'pilot'; mech.visible = mode === 'mech';
      forearm.position.set(-0.20 - (1 - present) * 0.40, -0.12 - (1 - present) * 0.8, -0.85);
      forearm.rotation.z = 0.10 - (1 - present) * 0.3;
      injectorHand.position.set(0.036 + (1 - present) * 0.5 - contact * 0.035, -0.284 - (1 - present) * 0.7 + contact * 0.035, -0.85);
      injectorHand.rotation.z = 0.70 + (1 - present) * 0.4;
      plunger.position.y = -0.18 + press * 0.075;
      fluid.scale.y = 1 - press * 0.65;
      fluid.position.y = press * 0.06;
      injectionLight.visible = press > 0.65;
      injectionLight.scale.setScalar(0.75 + Math.sin(p * 62) * 0.2);
      for (const arm of arms) {
        arm.root.position.set(arm.side * (0.52 + (1 - present) * 0.5), -0.49 - (1 - present) * 0.7, -0.59);
        arm.root.rotation.y = arm.side * (0.15 + (1 - present) * 0.7);
        arm.elbow.rotation.y = -arm.side * (1 - contact) * 0.45;
        arm.tool.rotation.z = arm.side * press * Math.sin(p * 25) * 0.45;
        arm.contact.visible = press > 0.65;
        arm.contact.scale.setScalar(1 + Math.sin(p * 65) * 0.15);
      }
    },
  };
}
