import * as THREE from 'three';
import type { Mode } from '../core/index';
import type { WeaponRig } from './equipmentModels';
import { emptyKick, reloadPose } from './weaponMotion';

export interface SimulationWeaponPoseInput {
  mode: Mode;
  time: number;
  moving: boolean;
  reloadProgress: number;
  reloading?: boolean;
  recoveryProgress: number;
  recoveryActive: boolean;
  pilotAmmo: number;
  mechAmmo: number;
  emptyAge?: number;
}

/** Authoritative socket pose. Only simulation steps advance recoil; applying a
 * pose is idempotent and never consumes render time or random state. */
export class SimulationWeaponPose {
  private value = 0;
  get recoil(): number { return this.value; }
  kick(mode: Mode): void { this.value = mode === 'mech' ? 1 : 0.5; }
  reset(): void { this.value = 0; }
  advance(dt: number): void {
    if (Number.isFinite(dt) && dt > 0) this.value = THREE.MathUtils.damp(this.value, 0, 17, dt);
  }

  apply(input: SimulationWeaponPoseInput, root: THREE.Group, pilot: WeaponRig, mech: WeaponRig): void {
    const pose = reloadPose(input.mode, input.reloadProgress);
    const dry = emptyKick(input.emptyAge ?? Infinity);
    const bob = input.moving ? Math.sin(input.time * (input.mode === 'mech' ? 6 : 11)) * 0.018 : 0;
    root.position.set(0, bob - this.value * 0.08 - pose.lower, this.value * 0.15 - pose.forward);
    root.rotation.set(this.value * 0.075 + pose.pitch + dry * 0.09, pose.yaw, pose.roll - dry * 0.055);
    const p = input.recoveryProgress;
    const recovery = input.recoveryActive
      ? THREE.MathUtils.smoothstep(p, 0, 0.18) * (1 - THREE.MathUtils.smoothstep(p, 0.78, 1)) : 0;
    if (input.mode === 'pilot') {
      root.position.y -= recovery * 0.6;
      root.rotation.x -= recovery * 0.3;
      root.rotation.z += recovery * 0.18;
    } else {
      root.position.z -= recovery * 0.65;
      root.position.y -= recovery * 0.05;
      root.rotation.x -= recovery * 0.06;
    }
    if (pilot.magazine && pilot.magazineHome) {
      pilot.magazine.position.copy(pilot.magazineHome);
      pilot.magazine.position.x -= pose.magazineDrop * 0.12;
      pilot.magazine.position.y -= pose.magazineDrop;
      pilot.magazine.rotation.z = pose.magazineTilt;
    }
    if (pilot.bolt && pilot.boltHome) {
      pilot.bolt.position.copy(pilot.boltHome);
      pilot.bolt.position.z += pose.boltPull + (input.pilotAmmo === 0 ? 0.055 : 0);
    }
    if (pilot.supportHand && pilot.supportHandHome) {
      pilot.supportHand.visible = input.mode === 'pilot' && (input.reloading ?? input.reloadProgress > 0);
      pilot.supportHand.position.copy(pilot.supportHandHome);
      pilot.supportHand.position.x -= pose.magazineDrop * 0.12;
      pilot.supportHand.position.y -= pose.magazineDrop + (1 - pose.handReach) * 0.6;
      pilot.supportHand.rotation.z = pose.magazineTilt;
    }
    mech.breeches.forEach((breech, index) => {
      breech.position.copy(mech.breechHomes[index]);
      breech.rotation.x = pose.breechOpen + recovery * 0.45;
    });
    mech.barrels.forEach((barrel, index) => {
      barrel.position.copy(mech.barrelHomes[index]);
      barrel.position.z += pose.barrelBack + (input.mechAmmo === 0 ? 0.08 : 0);
    });
  }
}
