/** Engine-independent equipment and progression. No narrative state belongs here. */
import { DEFAULT_CHECKPOINT, normalizeCheckpoint, type CheckpointSave } from './checkpoints';
import { applyBrandModifiers, applyWeaponProfileStats, createWeaponSpec, isBrandId, normalizeItemMetadata, normalizeWeaponSpec, rollBrand, rollWeaponSpec, type BrandId, type WeaponSpec } from './arsenal';
export type { BrandId, ElementType, ProjectileType, WeaponSpec } from './arsenal';

export type Mode = 'pilot' | 'mech';
export type Slot = 'weapon' | 'shield' | 'reactor' | 'legs';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Stats {
  damage: number;
  fireRate: number;
  magazine: number;
  reload: number;
  maxHealth: number;
  maxShield: number;
  moveSpeed: number;
  heatCapacity: number;
  cooling: number;
}

export interface Item {
  id: string;
  name: string;
  slot: Slot;
  target: Mode;
  rarity: Rarity;
  level: number;
  stats: Partial<Stats>;
  affix: string | null;
  value: number;
  brand: BrandId;
  weapon?: WeaponSpec;
  mark?: 'favorite' | 'junk';
}

/** Only the current stock cycle is retained; six offers at each of three vendors. */
export interface VendingPurchaseBook { wave: number; offerIds: string[] }

export interface Progression {
  version: 1;
  inventory: Item[];
  loadouts: Record<Mode, Partial<Record<Slot, string>>>;
  credits: number;
  kills: number;
  wave: number;
  checkpoint?: CheckpointSave;
  vendingPurchases?: VendingPurchaseBook;
}

export const MAX_CREDITS = 1_000_000_000;
export const INVENTORY_CAPACITY = 200;

export const rarityColors: Record<Rarity, string> = {
  common: '#cbd1cf',
  uncommon: '#8ac953',
  rare: '#49bcf4',
  epic: '#c18bff',
  legendary: '#ffad42',
};

const modes: Mode[] = ['pilot', 'mech'];
const slots: Slot[] = ['weapon', 'shield', 'reactor', 'legs'];
const rarities: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const quality = [1, 1.15, 1.36, 1.65, 2.05];
const weaponKeys = ['damage', 'fireRate', 'magazine', 'reload'] as const;
const baseStats: Record<Mode, Stats> = {
  pilot: { damage: 20, fireRate: 5.5, magazine: 30, reload: 1.5, maxHealth: 100, maxShield: 0, moveSpeed: 7, heatCapacity: 100, cooling: 30 },
  mech: { damage: 75, fireRate: 1.4, magazine: 12, reload: 2.2, maxHealth: 420, maxShield: 0, moveSpeed: 5.5, heatCapacity: 100, cooling: 22 },
};
let fallbackId = 0;

function nextId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `item-${Date.now().toString(36)}-${++fallbackId}`;
}

function draw(rng: () => number): number {
  const value = rng();
  return Number.isFinite(value) ? Math.max(0, Math.min(0.999999999, value)) : 0;
}

function round(value: number, places = 1): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** A reproducible RNG for tuning and tests; production rolls use Math.random. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

/** Rolls real combat statistics. Weapon stats replace defaults; other slots add bonuses. */
export function rollItem(target: Mode, level: number, rng: () => number = Math.random, slot?: Slot, options?: { brand?: BrandId; weapon?: WeaponSpec }): Item {
  const tierRoll = draw(rng);
  const rarityIndex = tierRoll < 0.46 ? 0 : tierRoll < 0.73 ? 1 : tierRoll < 0.89 ? 2 : tierRoll < 0.975 ? 3 : 4;
  const itemSlot = slot ?? slots[Math.floor(draw(rng) * slots.length)]!;
  const safeLevel = Math.min(100, Math.max(1, Math.floor(Number.isFinite(level) ? level : 1)));
  const scaling = (1 + (safeLevel - 1) * 0.075) * quality[rarityIndex]!;
  const variance = 0.85 + draw(rng) * 0.3;
  const base = baseStats[target];
  let name: string;
  let stats: Partial<Stats>;
  let affix: string | null = null;

  switch (itemSlot) {
    case 'weapon':
      name = target === 'pilot' ? 'Salvage Rifle' : 'Siege Cannon';
      stats = {
        damage: round(base.damage * scaling * variance),
        fireRate: round(base.fireRate * (0.92 + draw(rng) * 0.2), 2),
        magazine: Math.max(1, Math.round(base.magazine * (0.85 + draw(rng) * 0.35))),
        reload: round(base.reload * (0.85 + draw(rng) * 0.3), 2),
      };
      break;
    case 'shield':
      name = target === 'pilot' ? 'Field Shield' : 'Bulwark Plating';
      stats = {
        maxShield: Math.round((target === 'pilot' ? 65 : 190) * scaling * variance),
        maxHealth: Math.round((target === 'pilot' ? 8 : 35) * scaling),
      };
      break;
    case 'reactor':
      name = target === 'pilot' ? 'Cooling Module' : 'Flux Reactor';
      stats = { heatCapacity: round(24 * scaling * variance), cooling: round(8 * scaling) };
      break;
    case 'legs':
      name = target === 'pilot' ? 'Runner Boots' : 'Servo Legs';
      stats = { moveSpeed: round(0.55 * Math.sqrt(scaling) * variance, 2), maxHealth: Math.round((target === 'pilot' ? 4 : 20) * scaling) };
      break;
  }

  if (rarityIndex > 0) {
    const affixIndex = Math.floor(draw(rng) * 3);
    if (itemSlot === 'weapon') {
      if (affixIndex === 0) { affix = 'Heavy'; stats.damage = round(stats.damage! * 1.25); stats.fireRate = round(stats.fireRate! * 0.9, 2); }
      if (affixIndex === 1) { affix = 'Rapid'; stats.fireRate = round(stats.fireRate! * 1.22, 2); stats.magazine = Math.round(stats.magazine! * 1.15); }
      if (affixIndex === 2) { affix = 'Quickdraw'; stats.reload = round(stats.reload! * 0.68, 2); stats.damage = round(stats.damage! * 1.08); }
    } else if (itemSlot === 'shield') {
      affix = affixIndex === 0 ? 'Fortified' : affixIndex === 1 ? 'Reinforced' : 'Lightweight';
      if (affixIndex === 0) stats.maxShield = Math.round(stats.maxShield! * 1.25);
      if (affixIndex === 1) stats.maxHealth = Math.round(stats.maxHealth! * 2);
      if (affixIndex === 2) stats.moveSpeed = 0.5;
    } else if (itemSlot === 'reactor') {
      affix = affixIndex === 0 ? 'Ventilated' : affixIndex === 1 ? 'High-capacity' : 'Balanced';
      if (affixIndex === 0) stats.cooling = round(stats.cooling! * 1.55);
      if (affixIndex === 1) stats.heatCapacity = round(stats.heatCapacity! * 1.55);
      if (affixIndex === 2) { stats.cooling = round(stats.cooling! * 1.2); stats.heatCapacity = round(stats.heatCapacity! * 1.2); }
    } else {
      affix = affixIndex === 0 ? 'Sprinter' : affixIndex === 1 ? 'Armored' : 'Trailrunner';
      if (affixIndex === 0) stats.moveSpeed = round(stats.moveSpeed! * 1.65, 2);
      if (affixIndex === 1) stats.maxHealth = Math.round(stats.maxHealth! * 2);
      if (affixIndex === 2) { stats.moveSpeed = round(stats.moveSpeed! * 1.3, 2); stats.maxHealth = Math.round(stats.maxHealth! * 1.3); }
    }
    name = `${affix} ${name}`;
  }

  const brand = isBrandId(options?.brand) ? options.brand : rollBrand(rng);
  let weapon: WeaponSpec | undefined;
  stats = applyBrandModifiers(stats, brand, itemSlot);
  if (itemSlot === 'weapon') {
    weapon = options?.weapon ? normalizeWeaponSpec(options.weapon, target) : rollWeaponSpec(brand, target, rng);
    stats = applyWeaponProfileStats(stats, weapon);
  }
  return {
    id: nextId(), name, slot: itemSlot, target, rarity: rarities[rarityIndex]!, level: safeLevel, stats, affix,
    value: Math.round(12 * safeLevel * quality[rarityIndex]! * (rarityIndex + 1)),
    brand, ...(weapon ? { weapon } : {}),
  };
}

export function createProgression(): Progression {
  const inventory: Item[] = [];
  const loadouts: Progression['loadouts'] = { pilot: {}, mech: {} };
  for (const target of modes) {
    for (const slot of target === 'pilot' ? ['weapon', 'shield'] as const : slots) {
      const item = rollItem(target, 1, () => 0.5, slot);
      item.id = `starter-${target}-${slot}`;
      item.rarity = 'common';
      item.affix = null;
      item.name = `${target === 'pilot' ? 'Field' : 'Mk I'} ${slot === 'weapon' ? (target === 'pilot' ? 'Rifle' : 'Cannon') : slot === 'shield' ? 'Shield' : slot === 'reactor' ? 'Reactor' : 'Servo Legs'}`;
      // Stable initial equipment makes the first run a consistent tuning baseline.
      item.stats = slot === 'weapon' ? { damage: baseStats[target].damage, fireRate: baseStats[target].fireRate, magazine: baseStats[target].magazine, reload: baseStats[target].reload }
        : slot === 'shield' ? { maxShield: target === 'pilot' ? 65 : 190, maxHealth: target === 'pilot' ? 8 : 35 }
        : slot === 'reactor' ? { heatCapacity: 24, cooling: 8 }
        : { moveSpeed: 0.55, maxHealth: 20 };
      item.value = 12;
      item.brand = 'ironvale';
      if (slot === 'weapon') item.weapon = createWeaponSpec(target === 'mech' ? 'slug' : 'bullet', 'kinetic', target);
      inventory.push(item);
      loadouts[target][slot] = item.id;
    }
  }
  return { version: 1, inventory, loadouts, credits: 0, kills: 0, wave: 1, checkpoint: { ...DEFAULT_CHECKPOINT } };
}

export function getStats(state: Progression, mode: Mode): Stats {
  const result = { ...baseStats[mode] };
  for (const slot of slots) {
    const id = state.loadouts[mode][slot];
    const item = state.inventory.find(candidate => candidate.id === id && candidate.target === mode && candidate.slot === slot);
    if (!item) continue;
    for (const key of Object.keys(item.stats) as (keyof Stats)[]) {
      const value = item.stats[key]!;
      if (slot === 'weapon' && (weaponKeys as readonly string[]).includes(key)) result[key] = value;
      else result[key] += value;
    }
  }
  return result;
}

export function equipItem(state: Progression, id: string): boolean {
  const item = state.inventory.find(candidate => candidate.id === id);
  if (!item || !writableProperty(state.loadouts[item.target], item.slot)) return false;
  if (item.mark === 'junk') {
    const descriptor = Object.getOwnPropertyDescriptor(item, 'mark');
    if (descriptor && !descriptor.configurable) return false;
    delete item.mark;
  }
  state.loadouts[item.target][item.slot] = item.id;
  return true;
}

function writableProperty(object: object, key: string): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor ? 'value' in descriptor && descriptor.writable === true : Object.isExtensible(object);
}

export function isItemEquipped(state: Progression, id: string): boolean {
  return modes.some(mode => Object.values(state.loadouts[mode]).includes(id));
}

export function setItemMark(state: Progression, id: string, mark: 'favorite' | 'junk' | null): boolean {
  if (mark !== null && mark !== 'favorite' && mark !== 'junk') return false;
  const item = state.inventory.find(candidate => candidate.id === id);
  if (!item || mark === 'junk' && isItemEquipped(state, id)) return false;
  if (mark === null) {
    const descriptor = Object.getOwnPropertyDescriptor(item, 'mark');
    if (descriptor && !descriptor.configurable) return false;
    delete item.mark;
  } else {
    if (!writableProperty(item, 'mark')) return false;
    item.mark = mark;
  }
  return true;
}

function validSaleValue(value: number): boolean { return Number.isSafeInteger(value) && value >= 0 && value <= MAX_CREDITS; }
function validWallet(state: Progression): boolean { return validSaleValue(state.credits); }
function canCommitSale(state: Progression): boolean { return writableProperty(state, 'inventory') && writableProperty(state, 'credits'); }

export function canSellItem(state: Progression, id: string): boolean {
  const item = state.inventory.find(candidate => candidate.id === id);
  return !!item && item.mark !== 'favorite' && !isItemEquipped(state, id) && validWallet(state)
    && validSaleValue(item.value) && state.credits <= MAX_CREDITS - item.value && canCommitSale(state);
}

export function sellItem(state: Progression, id: string): boolean {
  if (!canSellItem(state, id)) return false;
  const item = state.inventory.find(candidate => candidate.id === id)!;
  const remaining = state.inventory.filter(candidate => candidate.id !== id);
  state.inventory = remaining;
  state.credits += item.value;
  return true;
}

export interface JunkSaleSummary { count: number; value: number; canSell: boolean }

/** Favorites and equipped pieces are excluded even if marks came from a hand-authored state. */
export function getJunkSaleSummary(state: Progression): JunkSaleSummary {
  const junk = state.inventory.filter(item => item.mark === 'junk' && !isItemEquipped(state, item.id));
  const valid = junk.every(item => validSaleValue(item.value));
  const total = valid ? junk.reduce((sum, item) => sum + item.value, 0) : 0;
  const value = Number.isSafeInteger(total) ? total : 0;
  return { count: junk.length, value, canSell: junk.length > 0 && valid && Number.isSafeInteger(total)
    && validWallet(state) && state.credits <= MAX_CREDITS - total && canCommitSale(state) };
}

/** Sells the complete eligible set or nothing; overflowing wallets never lose equipment. */
export function sellJunk(state: Progression): { sold: number; earned: number } {
  const summary = getJunkSaleSummary(state);
  if (!summary.canSell) return { sold: 0, earned: 0 };
  const remaining = state.inventory.filter(item => item.mark !== 'junk' || isItemEquipped(state, item.id));
  state.inventory = remaining;
  state.credits += summary.value;
  return { sold: summary.count, earned: summary.value };
}

export function checkZoneAccess(mode: Mode, zone: 'both' | Mode): boolean {
  return zone === 'both' || zone === mode;
}

export function serializeProgression(state: Progression): string {
  return JSON.stringify(state);
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function integer(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

/** New metadata recovers independently; malformed entries cannot erase valid purchases. */
export function normalizeVendingPurchases(raw: unknown): VendingPurchaseBook | undefined {
  if (!record(raw) || !integer(raw.wave, 1, 1_000_000) || !Array.isArray(raw.offerIds)) return undefined;
  const offerIds = new Set<string>();
  const prefix = `vending:${raw.wave}:`;
  for (const id of raw.offerIds) {
    if (typeof id === 'string' && id.startsWith(prefix) && /^vending:[1-9]\d{0,6}:(weapons|medical|mech):[0-5]$/.test(id)) offerIds.add(id);
    if (offerIds.size === 18) break;
  }
  return { wave: raw.wave, offerIds: [...offerIds] };
}

const statBounds: Record<keyof Stats, [number, number]> = {
  damage: [0.1, 100000], fireRate: [0.1, 30], magazine: [1, 999], reload: [0.1, 30],
  maxHealth: [0, 100000], maxShield: [0, 100000], moveSpeed: [0, 40], heatCapacity: [0, 10000], cooling: [0, 10000],
};

/** Fail closed: the caller can start fresh without trusting malformed persisted data. */
export function deserializeProgression(raw: string | null): Progression | null {
  if (!raw || raw.length > 1_000_000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.version !== 1 || !Array.isArray(value.inventory) || value.inventory.length > 512 || !record(value.loadouts)) return null;
    if (!integer(value.credits, 0, MAX_CREDITS) || !integer(value.kills, 0, 1_000_000_000) || !integer(value.wave, 1, 1_000_000)) return null;
    const inventory: Item[] = [];
    const ids = new Set<string>();
    for (const entry of value.inventory) {
      if (!record(entry) || typeof entry.id !== 'string' || !entry.id || entry.id.length > 120 || ids.has(entry.id)) return null;
      if (typeof entry.name !== 'string' || !entry.name || entry.name.length > 120) return null;
      if (!slots.includes(entry.slot as Slot) || !modes.includes(entry.target as Mode) || !rarities.includes(entry.rarity as Rarity)) return null;
      if (!integer(entry.level, 1, 100) || !integer(entry.value, 0, 1_000_000) || !record(entry.stats)) return null;
      if (entry.affix !== null && (typeof entry.affix !== 'string' || entry.affix.length > 80)) return null;
      const stats: Partial<Stats> = {};
      for (const [key, stat] of Object.entries(entry.stats)) {
        if (!Object.hasOwn(statBounds, key)) return null;
        const [minimum, maximum] = statBounds[key as keyof Stats];
        if (typeof stat !== 'number' || !Number.isFinite(stat) || stat < minimum || stat > maximum || (key === 'magazine' && !Number.isInteger(stat))) return null;
        stats[key as keyof Stats] = stat;
      }
      if (entry.slot === 'weapon' && weaponKeys.some(key => stats[key] === undefined)) return null;
      ids.add(entry.id);
      const identity = { id: entry.id, target: entry.target as Mode, slot: entry.slot as Slot };
      const mark = entry.mark === 'favorite' || entry.mark === 'junk' ? entry.mark : undefined;
      inventory.push({ ...identity, name: entry.name, rarity: entry.rarity as Rarity, level: entry.level, value: entry.value, stats, affix: entry.affix as string | null, ...normalizeItemMetadata(identity, entry.brand, entry.weapon), ...(mark ? { mark } : {}) });
    }
    const loadouts: Progression['loadouts'] = { pilot: {}, mech: {} };
    for (const mode of modes) {
      const saved = value.loadouts[mode];
      if (!record(saved)) return null;
      for (const [slot, id] of Object.entries(saved)) {
        if (!slots.includes(slot as Slot) || typeof id !== 'string') return null;
        const item = inventory.find(candidate => candidate.id === id);
        if (!item || item.target !== mode || item.slot !== slot) return null;
        loadouts[mode][slot as Slot] = id;
        if (item.mark === 'junk') delete item.mark;
      }
      if (!loadouts[mode].weapon) return null;
    }
    const purchases = normalizeVendingPurchases(value.vendingPurchases);
    return { version: 1, inventory, loadouts, credits: value.credits, kills: value.kills, wave: value.wave, checkpoint: normalizeCheckpoint(value.checkpoint),
      ...(purchases && purchases.wave <= value.wave ? { vendingPurchases: purchases } : {}) };
  } catch {
    return null;
  }
}
