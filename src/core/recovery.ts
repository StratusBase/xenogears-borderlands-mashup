export const DROP_CHANCES = Object.freeze({ cash: 0.6, health: 0.18 } as const);
export const HEAL_COOLDOWN = 20;
export const SELF_HEAL_FRACTION = 0.35;
export const HEALTH_PICKUP_FRACTION = 0.25;

export interface HealthTarget {
  health: number;
  maxHealth: number;
}

export interface SelfHealResult {
  healed: number;
  readyAt: number;
  reason?: 'full' | 'cooldown' | 'invalid';
}

const MAX_HEALTH = 1_000_000_000;
const MAX_TIME = Number.MAX_SAFE_INTEGER;

function validTarget(target: HealthTarget): boolean {
  return Number.isFinite(target.maxHealth) && target.maxHealth > 0 && target.maxHealth <= MAX_HEALTH
    && Number.isFinite(target.health) && target.health > 0 && target.health <= target.maxHealth;
}

function validTime(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= MAX_TIME;
}

function chance(rng: () => number, threshold: number): boolean {
  try {
    const value = rng();
    return Number.isFinite(value) && Math.max(0, Math.min(1, value)) < threshold;
  } catch {
    return false;
  }
}

/** Cash and health have separate rolls; a failed random draw does not affect the other. */
export function rollEnemySupplies(rng: () => number = Math.random): { cash: boolean; health: boolean } {
  const cash = chance(rng, DROP_CHANCES.cash);
  const health = chance(rng, DROP_CHANCES.health);
  return { cash, health };
}

/** Fractions are of maximum health. Dead targets cannot be revived by ordinary healing. */
export function healHealth(target: HealthTarget, fraction: number): number {
  if (!validTarget(target) || !Number.isFinite(fraction) || fraction <= 0 || fraction > 1 || target.health === target.maxHealth) return 0;
  const next = Math.min(target.maxHealth, target.health + target.maxHealth * fraction);
  const healed = next - target.health;
  if (healed > 0) target.health = next;
  return healed;
}

export function getHealCooldownRemaining(now: number, readyAt: number): number {
  return validTime(now) && validTime(readyAt) ? Math.max(0, readyAt - now) : 0;
}

/** The caller stores readyAt once for both pilot and mech; failed attempts never refresh it. */
export function trySelfHeal(target: HealthTarget, now: number, readyAt: number): SelfHealResult {
  const retainedReadyAt = validTime(readyAt) ? readyAt : 0;
  if (!validTarget(target) || !validTime(now) || now > MAX_TIME - HEAL_COOLDOWN || !validTime(readyAt)) {
    return { healed: 0, readyAt: retainedReadyAt, reason: 'invalid' };
  }
  if (target.health === target.maxHealth) return { healed: 0, readyAt, reason: 'full' };
  if (getHealCooldownRemaining(now, readyAt) > 0) return { healed: 0, readyAt, reason: 'cooldown' };
  const healed = healHealth(target, SELF_HEAL_FRACTION);
  return healed > 0 ? { healed, readyAt: now + HEAL_COOLDOWN } : { healed: 0, readyAt, reason: 'invalid' };
}
