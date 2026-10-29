import { rarityColors, type Item, type Mode, type Progression, type Rarity, type Slot, type Stats } from './index';
import { elementColors, getWeaponSpec, normalizeItemMetadata, type BrandId, type ElementType, type ProjectileTrail, type ProjectileType, type WeaponType } from './arsenal';

export interface EquipmentAppearance {
  key: string;
  equipped: boolean;
  target: Mode;
  slot: Slot;
  form: 'standard' | 'heavy' | 'rapid' | 'compact' | 'fortified' | 'lightweight' | 'vented' | 'capacity' | 'sprinter' | 'armored';
  variant: number;
  primary: number;
  secondary: number;
  accent: number;
  metal: number;
  /** Only an actual elemental trait supplies this; rarity never implies an element. */
  element?: ElementType;
  brand?: BrandId;
  weaponType?: WeaponType;
  projectile?: ProjectileType;
  trail?: ProjectileTrail;
  visualVariant?: number;
  secondaryElement?: ElementType;
}

export type EquipmentLoadoutAppearance = Record<Slot, EquipmentAppearance>;

const slots: readonly Slot[] = ['weapon', 'shield', 'reactor', 'legs'];
const statKeys: readonly (keyof Stats)[] = [
  'cooling', 'damage', 'fireRate', 'heatCapacity', 'magazine', 'maxHealth', 'maxShield', 'moveSpeed', 'reload',
];
const palettes = [
  { primary: 0x278b8c, secondary: 0xe5d4ad },
  { primary: 0xc4603d, secondary: 0x415b62 },
  { primary: 0xe7dab6, secondary: 0x455b62 },
  { primary: 0x405c69, secondary: 0xdcb34c },
  { primary: 0xd5a541, secondary: 0x3c686c },
] as const;
const forms: Record<string, EquipmentAppearance['form']> = {
  Heavy: 'heavy', Rapid: 'rapid', Quickdraw: 'compact',
  Fortified: 'fortified', Reinforced: 'fortified', Lightweight: 'lightweight',
  Ventilated: 'vented', 'High-capacity': 'capacity',
  Sprinter: 'sprinter', Trailrunner: 'sprinter', Armored: 'armored',
};

function hash(value: string): number {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193);
  }
  return result >>> 0;
}

function validItem(item: unknown): item is Item {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return false;
  const value = item as Partial<Item>;
  if (typeof value.id !== 'string' || !value.id || (value.target !== 'pilot' && value.target !== 'mech')
    || !slots.includes(value.slot as Slot) || typeof value.rarity !== 'string' || !Object.hasOwn(rarityColors, value.rarity)
    || (value.affix !== null && typeof value.affix !== 'string')
    || value.stats === null || typeof value.stats !== 'object' || Array.isArray(value.stats)) return false;
  return Object.entries(value.stats).every(([key, stat]) => statKeys.includes(key as keyof Stats) && typeof stat === 'number' && Number.isFinite(stat));
}

/** Item identity and actual combat rolls determine the look; resale/label metadata do not. */
export function describeItemAppearance(item: Item): EquipmentAppearance {
  const stats = statKeys.filter(key => item.stats[key] !== undefined).map(key => [key, item.stats[key]]);
  const brand = normalizeItemMetadata(item, item.brand, item.weapon).brand;
  const weapon = item.slot === 'weapon' ? getWeaponSpec(item) : null;
  const key = `equipment-v2:${JSON.stringify([item.id, item.target, item.slot, item.rarity, item.affix, stats, brand, weapon])}`;
  // Payload color and trail never reroll the receiver, furniture or base paint.
  const bodyKey = weapon ? JSON.stringify([item.id, item.target, item.slot, item.rarity, item.affix, stats, brand, weapon.weaponType, weapon.projectile, weapon.visualVariant]) : key;
  const seed = hash(bodyKey);
  const palette = palettes[seed % palettes.length];
  const form = item.affix !== null && Object.hasOwn(forms, item.affix) ? forms[item.affix] : 'standard';
  return {
    key, equipped: true, target: item.target, slot: item.slot, form,
    variant: (seed >>> 5) % 3,
    primary: palette.primary, secondary: palette.secondary,
    accent: Number.parseInt((weapon && weapon.element !== 'kinetic' ? elementColors[weapon.element] : rarityColors[item.rarity]).slice(1), 16), metal: 0x859293,
    ...(weapon && weapon.element !== 'kinetic' ? { element: weapon.element } : {}),
    ...(weapon ? { brand, weaponType: weapon.weaponType, projectile: weapon.projectile, trail: weapon.trail, visualVariant: weapon.visualVariant,
      ...(weapon.secondaryElement ? { secondaryElement: weapon.secondaryElement } : {}),
    } : {}),
  };
}

function fallback(target: Mode, slot: Slot): EquipmentAppearance {
  const key = `equipment-v1:empty:${target}:${slot}`;
  const secondary: Record<Slot, number> = { weapon: 0x87918d, shield: 0xadb2a3, reactor: 0x697f7e, legs: 0x747a77 };
  return {
    key, equipped: false, target, slot, form: 'standard', variant: hash(key) % 3,
    primary: target === 'pilot' ? 0x5c696e : 0x4e5e62,
    secondary: secondary[slot], accent: 0xadb4a9, metal: 0x859293,
  };
}

/** A selected preview is an appearance override, never an equipment mutation. */
export function resolveEquipmentAppearance(state: Progression, mode: Mode, previewItem?: Item): EquipmentLoadoutAppearance {
  const result = {} as EquipmentLoadoutAppearance;
  const preview = validItem(previewItem) && previewItem.target === mode ? previewItem : undefined;
  for (const slot of slots) {
    const id = state.loadouts[mode]?.[slot];
    const equipped = state.inventory.find(item => validItem(item) && item.id === id && item.target === mode && item.slot === slot);
    const item = preview?.slot === slot ? preview : equipped;
    result[slot] = item ? describeItemAppearance(item) : fallback(mode, slot);
  }
  return result;
}
