import type { Mode } from './index';

export function ammoReserveCapacity(mode: Mode, magazine: number): number {
  const capacity = Number.isFinite(magazine) ? Math.max(1, Math.floor(magazine)) : 1;
  return Math.max(mode === 'pilot' ? 240 : 60, capacity * 8);
}

/** A reload transfers rounds instead of creating ammunition. */
export function reloadAmmo(ammo: number, reserve: number, magazine: number): { ammo: number; reserve: number; loaded: number } {
  const capacity = Math.max(1, Math.floor(Number.isFinite(magazine) ? magazine : 1));
  const current = Math.max(0, Math.min(capacity, Math.floor(Number.isFinite(ammo) ? ammo : 0)));
  const remaining = Math.max(0, Math.floor(Number.isFinite(reserve) ? reserve : 0));
  const loaded = Math.min(capacity - current, remaining);
  return { ammo: current + loaded, reserve: remaining - loaded, loaded };
}

/** A smaller weapon unloads excess rounds into the reserve, even above its refill target. */
export function fitMagazine(ammo: number, reserve: number, magazine: number): { ammo: number; reserve: number } {
  const capacity = Math.max(1, Math.floor(magazine));
  return { ammo: Math.min(ammo, capacity), reserve: reserve + Math.max(0, ammo - capacity) };
}
