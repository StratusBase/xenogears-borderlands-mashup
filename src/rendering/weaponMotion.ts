import type { Mode } from '../core/index';

export interface ReloadPose {
  lower: number; forward: number; pitch: number; yaw: number; roll: number;
  magazineDrop: number; magazineTilt: number; boltPull: number;
  breechOpen: number; barrelBack: number; handReach: number;
}

const ease = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const stage = (p: number, start: number, peak: number, hold: number, end: number) =>
  ease((p - start) / (peak - start)) * (1 - ease((p - hold) / (end - hold)));

/** A simulation-clock timeline: pausing freezes the pose, and cancellation returns to rest. */
export function reloadPose(mode: Mode, progress: number): ReloadPose {
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const present = stage(p, 0, 0.13, 0.80, 1);
  if (mode === 'pilot') {
    return {
      lower: present * -0.32, forward: present * 0.65,
      pitch: present * 0.18, yaw: present * -0.24, roll: present * -0.36,
      magazineDrop: stage(p, 0.14, 0.31, 0.50, 0.73) * 0.5,
      magazineTilt: stage(p, 0.18, 0.34, 0.51, 0.73) * 0.65,
      boltPull: stage(p, 0.73, 0.82, 0.86, 0.95) * 0.12,
      handReach: stage(p, 0.05, 0.20, 0.70, 0.96), breechOpen: 0, barrelBack: 0,
    };
  }
  return {
    lower: present * 0.12, forward: present * 0.65, pitch: present * -0.09, yaw: 0, roll: 0,
    magazineDrop: 0, magazineTilt: 0, boltPull: 0, handReach: 0,
    breechOpen: stage(p, 0.06, 0.28, 0.68, 0.91),
    barrelBack: stage(p, 0.12, 0.36, 0.62, 0.89) * 0.34,
  };
}

export function emptyKick(age: number): number {
  return age >= 0 && age < 0.28 ? Math.sin(age / 0.28 * Math.PI) * Math.exp(-age * 6) : 0;
}
