import type { Mode } from './index';
import { isElementType, type WeaponSpec } from './arsenal';

/** Explicit switches permit paired diagnostic runs without rewriting rolled gear. */
export interface WeaponBalanceRules {
  readonly secondaryElementCost: boolean;
  readonly mechHeat: boolean;
}

export const DEFAULT_WEAPON_BALANCE: Readonly<WeaponBalanceRules> = Object.freeze({ secondaryElementCost: true, mechHeat: true });
export const BASELINE_WEAPON_BALANCE: Readonly<WeaponBalanceRules> = Object.freeze({ secondaryElementCost: false, mechHeat: false });
export const SECONDARY_ELEMENT_DAMAGE_MULTIPLIER = 0.85;
export const MECH_HEAT_BUDGET_PER_SECOND = 120;

/** Kinetic plus a secondary status keeps kinetic impact behavior and pays the same cost.
 * Invalid, duplicate, or kinetic secondary metadata is not an additional channel.
 */
export function hasSecondaryElementCost(spec: WeaponSpec, rules: WeaponBalanceRules = DEFAULT_WEAPON_BALANCE): boolean {
  return rules.secondaryElementCost && isElementType(spec.element)
    && isElementType(spec.secondaryElement) && spec.secondaryElement !== 'kinetic' && spec.secondaryElement !== spec.element;
}

/** Apply once to raw damage when creating a shot, before projectile, splash, chain,
 * critical and proc-power calculations. Never bake this value into saved item stats
 * or reapply it to each subsequent collision/status event.
 */
export function effectiveProjectileDamage(rawDamage: number, spec: WeaponSpec, rules: WeaponBalanceRules = DEFAULT_WEAPON_BALANCE): number {
  if (!Number.isFinite(rawDamage) || rawDamage < 0) return 0;
  return rawDamage * (hasSecondaryElementCost(spec, rules) ? SECONDARY_ELEMENT_DAMAGE_MULTIPLIER : 1);
}

/** One charge per successful trigger, regardless of pellets or subsequent targets.
 * Invalid rates conservatively retain the prior charge instead of creating free heat.
 */
export function heatPerShot(mode: Mode, fireRate: number, rules: WeaponBalanceRules = DEFAULT_WEAPON_BALANCE): number {
  if (mode === 'pilot') return 8;
  if (!rules.mechHeat || !Number.isFinite(fireRate) || fireRate <= 0) return 31;
  return Math.min(31, MECH_HEAT_BUDGET_PER_SECOND / fireRate);
}

/** An overheated weapon unlocks strictly below this fraction of its own capacity. */
export function heatRecoveryFraction(mode: Mode, rules: WeaponBalanceRules = DEFAULT_WEAPON_BALANCE): number {
  return mode === 'mech' && rules.mechHeat ? 0.45 : 0.3;
}
