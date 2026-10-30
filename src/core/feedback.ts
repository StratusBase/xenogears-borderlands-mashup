/** Damage feedback is independent of equipment, rendering, and narrative state. */
import { elementColors, type ElementType } from './arsenal';
export type DamageEffect = Exclude<ElementType, 'kinetic'> | 'corrosion' | 'frost' | 'bleed';

export const damagePalette = Object.freeze({
  normal: '#fff',
  critical: '#ff3b3b',
  fire: elementColors.fire,
  shock: elementColors.shock,
  corrosion: elementColors.corrosive,
  frost: elementColors.ice,
  bleed: '#9b1433',
  ice: elementColors.ice,
  corrosive: elementColors.corrosive,
  radiation: elementColors.radiation,
  gravity: elementColors.gravity,
  adhesive: elementColors.adhesive,
});

/** Status ticks keep their effect identity; direct critical hits are red. */
export function getDamageColor(damage: { critical: boolean; effect?: DamageEffect }): string {
  if (damage.effect) return damagePalette[damage.effect];
  return damage.critical ? damagePalette.critical : damagePalette.normal;
}
