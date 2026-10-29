import { INVENTORY_CAPACITY, MAX_CREDITS, rollItem, type Item, type Progression } from './index';

export { INVENTORY_CAPACITY, MAX_CREDITS } from './index';
export type SupplyKind = 'repair' | 'pilot-cache' | 'mech-cache';
export interface SupplyPurchaseResult {
  ok: boolean;
  item?: Item;
  spent: number;
  reason?: string;
}

function validBalance(balance: number): boolean {
  return Number.isSafeInteger(balance) && balance >= 0 && balance <= MAX_CREDITS;
}

function validAmount(amount: number): boolean {
  return Number.isSafeInteger(amount) && amount > 0 && amount <= MAX_CREDITS;
}

function supplyLevel(level: number): number | null {
  return Number.isSafeInteger(level) && level > 0 ? Math.min(100, level) : null;
}

/** Cash is a pickup reward; no wallet mutation happens until the caller collects it. */
export function rollCashValue(level: number, heavy: boolean, rng: () => number = Math.random): number {
  const safeLevel = Math.min(100, Math.max(1, Math.floor(Number.isFinite(level) ? level : 1)));
  let random = 0.5;
  try {
    const value = rng();
    if (Number.isFinite(value)) random = Math.max(0, Math.min(1, value));
  } catch { /* A failed random source still yields a bounded pickup reward. */ }
  return Math.max(1, Math.round((heavy ? 24 : 12) * (1 + (safeLevel - 1) * 0.075) * (0.8 + random * 0.4)));
}

/** Rejects an overflowing credit in full, so the caller can leave its pickup uncollected. */
export function creditWallet(state: Progression, amount: number): boolean {
  if (!validBalance(state.credits) || !validAmount(amount) || state.credits > MAX_CREDITS - amount) return false;
  state.credits += amount;
  return true;
}

export function spendCredits(state: Progression, amount: number): boolean {
  if (!validBalance(state.credits) || !validAmount(amount) || state.credits < amount) return false;
  state.credits -= amount;
  return true;
}

/** Supplies and rewards share the equipment level cap; invalid levels have no price. */
export function getSupplyPrices(level: number): { repair: number; pilotCache: number; mechCache: number } {
  const safeLevel = supplyLevel(level);
  if (safeLevel === null) throw new RangeError('Supply level must be a positive safe integer.');
  const scaling = 1 + (safeLevel - 1) * 0.08;
  return { repair: Math.round(25 * scaling), pilotCache: Math.round(90 * scaling), mechCache: Math.round(150 * scaling) };
}

/** Authorizes one repair or delivers one cache. The game applies repair effects itself. */
export function purchaseSupply(
  state: Progression,
  kind: SupplyKind,
  level: number = state.wave,
  rng: () => number = Math.random,
): SupplyPurchaseResult {
  const fail = (reason: string): SupplyPurchaseResult => ({ ok: false, spent: 0, reason });
  if (kind !== 'repair' && kind !== 'pilot-cache' && kind !== 'mech-cache') return fail('Unknown supply type.');
  const safeLevel = supplyLevel(level);
  if (safeLevel === null) return fail('Supply level is invalid.');
  if (!validBalance(state.credits)) return fail('Wallet balance is invalid.');
  const prices = getSupplyPrices(safeLevel);
  const cost = kind === 'repair' ? prices.repair : kind === 'pilot-cache' ? prices.pilotCache : prices.mechCache;
  if (!validAmount(cost)) return fail('Supply price is invalid.');
  if (state.credits < cost) return fail('Not enough credits.');
  if (kind === 'repair') {
    if (!spendCredits(state, cost)) return fail('Payment could not be completed.');
    return { ok: true, spent: cost };
  }
  if (!Array.isArray(state.inventory) || state.inventory.length >= INVENTORY_CAPACITY) return fail('Equipment storage is full. Sell unused gear first.');
  let item: Item;
  try {
    item = rollItem(kind === 'pilot-cache' ? 'pilot' : 'mech', safeLevel, rng);
    // Shop rewards retain their rolled combat stats, but cannot be resold for
    // more than half the purchase price. World-drop resale remains unchanged.
    item.value = Math.min(item.value, Math.floor(cost * 0.5));
  } catch {
    return fail('Equipment could not be generated. Your credits were retained.');
  }
  if (!spendCredits(state, cost)) return fail('Payment could not be completed.');
  try {
    state.inventory.push(item);
  } catch {
    // Reward delivery must succeed before a purchase is considered complete.
    state.credits += cost;
    return fail('Equipment storage is unavailable. Your credits were refunded.');
  }
  return { ok: true, item, spent: cost };
}
