export interface EnemyVitals {
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
}

export interface EnemyDamageResult {
  healthDamage: number;
  shieldDamage: number;
  /** True only when this hit transitions a living enemy to dead. */
  killed: boolean;
}

const MAX_COMBAT_VALUE = 1_000_000_000;

/** Shield bonuses spend only the damage needed to break a shield; overflow
 * returns to ordinary health damage rather than carrying the shield bonus. */
export function shieldAdjustedDamage(shield: number, damage: number, multiplier = 1): number {
  if (!Number.isFinite(shield) || shield < 0 || !Number.isFinite(damage) || damage <= 0) return 0;
  const factor = Number.isFinite(multiplier) && multiplier > 0 ? Math.min(8, multiplier) : 1;
  if (damage * factor <= shield) return damage * factor;
  return shield + Math.max(0, damage - shield / factor);
}

function bounded(value: number, minimum = 0): boolean {
  return Number.isFinite(value) && value >= minimum && value <= MAX_COMBAT_VALUE;
}

/** Shield absorbs first; overflow reaches health. Invalid hits never heal or mutate. */
export function applyEnemyDamage(vitals: EnemyVitals, damage: number): EnemyDamageResult {
  const noDamage: EnemyDamageResult = { healthDamage: 0, shieldDamage: 0, killed: false };
  if (!bounded(damage) || damage <= 0
    || !bounded(vitals.maxHealth, Number.MIN_VALUE) || !bounded(vitals.maxShield)
    || !bounded(vitals.health) || vitals.health > vitals.maxHealth
    || !bounded(vitals.shield) || vitals.shield > vitals.maxShield
    || vitals.health === 0) return noDamage;
  const shieldDamage = Math.min(vitals.shield, damage);
  const healthDamage = Math.min(vitals.health, damage - shieldDamage);
  vitals.shield -= shieldDamage;
  vitals.health -= healthDamage;
  return { shieldDamage, healthDamage, killed: vitals.health === 0 };
}
