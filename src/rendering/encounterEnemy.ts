import * as THREE from 'three';
import { createComicMaterial } from './materials';
import type { EnemyPresentation, EnemyRole } from '../encounter/contracts';

export interface EncounterEnemyVisual {
  readonly group: THREE.Group;
  /** World-units relative to the enemy root, including the model's scale. */
  readonly aimPoint: THREE.Vector3;
  readonly damageAnchor: THREE.Vector3;
  update(dt: number, time: number, state: EnemyPresentation): void;
  dispose(): void;
}

/** Front is +Z. Only physical armor is damageable; warnings never intercept shots. */
export function createEncounterEnemy(id: number, role: EnemyRole, boss = false): EncounterEnemyVisual {
  const group = new THREE.Group();
  group.name = boss ? 'encounter-mini-boss' : `encounter-${role}`;
  group.userData.enemyRole = role;
  group.userData.boss = boss;
  const body = new THREE.Group(); body.name = 'enemy-animated-body'; group.add(body);
  const scale = role === 'heavy' ? (boss ? 1.95 : 1.75) : 1;
  body.scale.setScalar(scale);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const paint = createComicMaterial(role === 'rusher' ? 0xdf7531 : role === 'flanker' ? 0x409d9f : boss ? 0xb04830 : 0x9e7151);
  const dark = createComicMaterial(0x29333c), steel = createComicMaterial(0x929997), cream = createComicMaterial(0xf3d6a1);
  materials.add(paint); materials.add(dark); materials.add(steel); materials.add(cream);
  const light = new THREE.MeshBasicMaterial({ color: role === 'flanker' ? 0x77f0e4 : 0xffcd62, toneMapped: false });
  const coreLight = new THREE.MeshBasicMaterial({ color: 0xffb833, toneMapped: false });
  const warningMat = new THREE.MeshBasicMaterial({ color: 0xffcf4b, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const shieldMat = createComicMaterial(0x365773);
  materials.add(light); materials.add(coreLight); materials.add(warningMat); materials.add(shieldMat);

  function mesh(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], parent: THREE.Object3D = body, critical = false): THREE.Mesh {
    const object = new THREE.Mesh(geometry, material);
    object.name = name; object.position.set(...position); object.castShadow = true; object.receiveShadow = true;
    object.userData.enemyId = id; object.userData.critical = critical;
    geometries.add(geometry); materials.add(material); parent.add(object); return object;
  }
  function box(name: string, size: [number, number, number], position: [number, number, number], material: THREE.Material, parent: THREE.Object3D = body, critical = false) {
    return mesh(name, new THREE.BoxGeometry(...size), material, position, parent, critical);
  }
  function overlay(object: THREE.Mesh): THREE.Mesh {
    delete object.userData.enemyId; delete object.userData.critical;
    object.userData.comicOverlay = true; object.castShadow = false; object.receiveShadow = false;
    object.raycast = () => {}; object.renderOrder = 3; return object;
  }

  const hips = box('enemy-hip', [0.84, 0.35, 0.64], [0, 0.96, 0], dark);
  const torso = box('enemy-torso', [role === 'heavy' ? 1.25 : 0.88, 0.94, 0.7], [0, 1.59, 0], paint);
  box('enemy-chest-inset', [0.55, 0.48, 0.08], [0, 1.66, 0.392], dark);
  box('enemy-chest-status', [0.36, 0.11, 0.04], [0, 1.73, 0.449], light);
  const head = box('enemy-head', [role === 'heavy' ? 0.53 : 0.57, 0.43, 0.51], [0, 2.25, 0.02], dark, body, role !== 'heavy');
  box('enemy-visor', [0.42, 0.12, 0.045], [0, 2.26, 0.30], light, body, role !== 'heavy');
  box('enemy-neck', [0.26, 0.14, 0.28], [0, 1.98, 0], steel);

  const legs: THREE.Group[] = [], arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(side * 0.28, 0.92, 0); body.add(leg); legs.push(leg);
    box(`enemy-thigh-${side}`, [0.30, 0.43, 0.36], [0, -0.23, 0], dark, leg);
    box(`enemy-shin-${side}`, [role === 'heavy' ? 0.36 : 0.29, 0.43, 0.40], [0, -0.63, 0.01], paint, leg);
    box(`enemy-foot-${side}`, [0.37, 0.14, 0.64], [0, -0.85, 0.12], dark, leg);
    const arm = new THREE.Group(); arm.position.set(side * (role === 'heavy' ? 0.66 : 0.54), 1.84, 0); body.add(arm); arms.push(arm);
    box(`enemy-shoulder-${side}`, [role === 'heavy' ? 0.45 : 0.27, 0.40, 0.48], [0, -0.06, 0], paint, arm);
    box(`enemy-forearm-${side}`, [0.27, 0.59, 0.33], [side * 0.04, -0.51, 0.09], dark, arm);
  }

  let shield: THREE.Mesh | undefined, weakCore: THREE.Mesh | undefined;
  const shutters: THREE.Mesh[] = [];
  if (role === 'rusher') {
    torso.rotation.x = 0.10;
    for (const [index, side] of [-1, 1].entries()) {
      const blade = mesh(`rusher-blade-${side}`, new THREE.ConeGeometry(0.16, 0.86, 3), cream, [0, -0.74, 0.28], arms[index]);
      blade.rotation.x = -0.46;
      box(`rusher-cuff-light-${side}`, [0.30, 0.12, 0.38], [0, -0.47, 0.12], light, arms[index]);
    }
    box('rusher-turbine', [0.60, 0.62, 0.32], [0, 1.67, -0.48], dark);
    box('rusher-back-chevron', [0.38, 0.12, 0.06], [0, 1.73, -0.68], light);
    head.rotation.z = -0.10;
  } else if (role === 'flanker') {
    const gun = arms[1];
    box('flanker-rifle-stock', [0.26, 0.28, 0.92], [0.10, -0.43, 0.28], dark, gun);
    box('flanker-rifle-barrel', [0.12, 0.14, 0.73], [0.10, -0.39, 1.04], steel, gun);
    box('flanker-rifle-muzzle', [0.19, 0.21, 0.12], [0.10, -0.39, 1.46], light, gun);
    box('flanker-sight', [0.12, 0.16, 0.25], [0.10, -0.22, 0.50], light, gun);
    box('flanker-antenna', [0.05, 0.47, 0.05], [-0.22, 2.60, -0.10], steel);
    box('flanker-sensor', [0.18, 0.12, 0.16], [-0.22, 2.84, -0.10], light);
    box('flanker-pack', [0.77, 0.65, 0.26], [0, 1.52, -0.49], dark);
  } else {
    // The slab visually carries the front-facing damage reduction. The bright
    // rear core protrudes past the back armor so flanking shots can reach it.
    shield = box('heavy-front-shield', [1.55, 1.33, 0.19], [-0.10, 1.35, 0.65], shieldMat);
    box('heavy-shield-spine', [0.12, 1.39, 0.10], [-0.10, 1.35, 0.80], steel);
    for (const side of [-1, 1]) box(`heavy-shield-light-${side}`, [0.10, 0.95, 0.05], [side * 0.57 - 0.10, 1.35, 0.775], light);
    box('heavy-cannon', [0.36, 0.37, 1.23], [0.13, -0.40, 0.48], dark, arms[1]);
    box('heavy-cannon-muzzle', [0.31, 0.29, 0.09], [0.13, -0.40, 1.15], light, arms[1]);
    box('heavy-core-housing', [0.84, 0.82, 0.31], [0, 1.65, -0.46], dark);
    weakCore = mesh('heavy-rear-weak-point', new THREE.CylinderGeometry(0.24, 0.24, 0.18, 8), coreLight, [0, 1.65, -0.69]);
    weakCore.rotation.x = Math.PI / 2;
    weakCore.userData.weakPoint = true;
    for (const side of [-1, 1]) shutters.push(box(`heavy-core-shutter-${side}`, [0.28, 0.61, 0.08], [side * 0.15, 1.65, -0.81], paint));
    if (boss) {
      for (const side of [-1, 1]) {
        box(`boss-cooling-tower-${side}`, [0.29, 0.83, 0.42], [side * 0.43, 2.12, -0.48], paint);
        box(`boss-hot-vent-${side}`, [0.18, 0.46, 0.06], [side * 0.43, 2.14, -0.72], coreLight);
        const horn = mesh(`boss-command-fin-${side}`, new THREE.ConeGeometry(0.16, 0.48, 4), cream, [side * 0.34, 2.59, 0]);
        horn.rotation.z = side * -0.35;
      }
    }
  }

  const warning = new THREE.Group(); warning.name = 'enemy-attack-warning'; group.add(warning);
  const ring = overlay(mesh('enemy-warning-ring', new THREE.RingGeometry(0.76, 0.87, 32), warningMat, [0, 0.035, 0], warning));
  ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(scale);
  // A dotted ground arrow follows the locked windup facing. This is especially
  // helpful for a pilot reading the rusher's committed lunge direction.
  const arrowLength = role === 'heavy' ? 8 : role === 'flanker' ? 10 : 4.5;
  for (let step = 0; step < 5; step++) {
    const marker = overlay(box(`enemy-windup-mark-${step}`, [0.10 + step * 0.04, 0.025, 0.5], [0, 0.045, 1.4 + step * (arrowLength - 1.4) / 4], warningMat, warning));
    marker.rotation.y = 0;
  }
  const chargeLamp = overlay(mesh('enemy-windup-beacon', new THREE.OctahedronGeometry(0.20), warningMat, [0, (boss ? 5.8 : role === 'heavy' ? 4.9 : 3.2), 0], warning));
  warning.visible = false;

  let disposed = false;
  let walk = 0;
  return {
    group,
    aimPoint: new THREE.Vector3(0, (role === 'heavy' ? 1.6 : 1.7) * scale, 0),
    damageAnchor: new THREE.Vector3(0, (role === 'heavy' ? 2.9 : 3.1) * scale, 0),
    update(dt, time, state) {
      if (disposed) return;
      const progress = THREE.MathUtils.clamp(state.phaseProgress, 0, 1);
      const hit = THREE.MathUtils.clamp(state.hitReaction, 0, 1);
      const windup = state.phase === 'windup', attack = state.phase === 'attack';
      const recover = state.phase === 'recover', dead = state.phase === 'dead';
      group.userData.animationPhase = state.phase;
      group.userData.weakPointOpen = state.weakPointOpen;
      walk += Math.max(0, dt) * (role === 'heavy' ? 5 : 9);
      const stride = state.moving && !windup && !dead ? Math.sin(walk) * (role === 'rusher' ? 0.5 : 0.29) : 0;
      legs[0].rotation.x = stride; legs[1].rotation.x = -stride;
      body.position.y = state.moving ? Math.abs(Math.sin(walk)) * 0.045 : 0;
      body.position.z = -hit * 0.14;
      body.rotation.x = dead ? -Math.PI / 2 : (role === 'rusher' && windup ? -0.21 - progress * 0.22 : recover ? 0.12 : -hit * 0.20);
      body.rotation.z = state.phase === 'stagger' ? Math.sin(time * 36) * 0.07 * Math.max(hit, 0.35) : 0;
      hips.rotation.y = state.moving ? Math.sin(walk) * 0.04 : 0;
      arms[0].rotation.x = role === 'rusher' ? (windup ? -0.3 - progress * 1.0 : attack ? -1.4 : stride * -0.4) : recover ? 0.14 : 0;
      arms[1].rotation.x = role === 'rusher' ? (windup ? -0.3 - progress * 1.0 : attack ? -1.4 : stride * 0.4) : attack ? -0.15 : recover ? 0.18 : 0;
      warning.visible = windup || attack;
      warningMat.color.set(windup ? 0xffd25c : 0xff6048);
      warningMat.opacity = windup ? 0.30 + progress * 0.65 : 0.85 * (1 - progress);
      ring.scale.setScalar(scale * (windup ? 0.85 + progress * 0.35 : 1.2 + progress * 0.9));
      chargeLamp.rotation.y = time * 3; chargeLamp.scale.setScalar(0.6 + progress * 0.9);
      light.color.set(state.shieldFraction > 0 && role === 'heavy' ? 0x7fd4ff : windup ? 0xff7a37 : role === 'flanker' ? 0x77f0e4 : 0xffcd62);
      if (shield) {
        shield.rotation.x = recover ? 0.28 : 0;
        shield.position.y = 1.35 - (state.weakPointOpen ? 0.22 : 0);
        shieldMat.color.set(state.shieldFraction > 0 ? 0x365773 : 0x5b5550);
      }
      if (weakCore) {
        weakCore.userData.critical = state.weakPointOpen;
        coreLight.color.set(state.weakPointOpen ? 0xffe0a1 : 0xe75d2e);
        shutters.forEach((shutter, index) => {
          shutter.position.x = (index === 0 ? -1 : 1) * (state.weakPointOpen ? 0.42 : 0.15);
        });
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true; group.removeFromParent();
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    },
  };
}
