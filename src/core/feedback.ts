/** Damage feedback is independent of equipment, rendering, and narrative state. */
import type { ElementType } from './arsenal';
export type DamageEffect = Exclude<ElementType, 'kinetic'> | 'corrosion' | 'frost' | 'bleed';

export const damagePalette = Object.freeze({
  normal: '#fff',
  critical: '#ff3b3b',
  fire: '#ff8a24',
  shock: '#4ca3ff',
  corrosion: '#67e04b',
  frost: '#58e5f2',
  bleed: '#9b1433',
  ice: '#58e5f2',
  corrosive: '#67e04b',
  radiation: '#b7f34a',
  gravity: '#ad86ff',
  adhesive: '#ffc94f',
});

/** Status ticks keep their effect identity; direct critical hits are red. */
export function getDamageColor(damage: { critical: boolean; effect?: DamageEffect }): string {
  if (damage.effect) return damagePalette[damage.effect];
  return damage.critical ? damagePalette.critical : damagePalette.normal;
}
