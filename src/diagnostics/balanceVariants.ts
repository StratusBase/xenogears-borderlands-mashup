import type { WeaponBalanceRules } from '../core/weaponBalance';

export const BALANCE_MATRIX_PROTOCOL = 'weapon-balance-matrix-v1';
export const BALANCE_MATRIX_SEEDS = [7, 8, 41, 97] as const;
export const BALANCE_VARIANTS = Object.freeze({
  baseline: Object.freeze({ secondaryElementCost: false, mechHeat: false }),
  'secondary-only': Object.freeze({ secondaryElementCost: true, mechHeat: false }),
  'heat-only': Object.freeze({ secondaryElementCost: false, mechHeat: true }),
  combined: Object.freeze({ secondaryElementCost: true, mechHeat: true }),
} satisfies Record<string, WeaponBalanceRules>);
export type BalanceVariant = keyof typeof BALANCE_VARIANTS;
export function balanceVariant(value: string | null): BalanceVariant {
  return value !== null && Object.hasOwn(BALANCE_VARIANTS, value) ? value as BalanceVariant : 'combined';
}
