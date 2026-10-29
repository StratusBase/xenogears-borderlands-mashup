import type { Item, Rarity } from './index';

type SortableItem = Pick<Item, 'id' | 'name' | 'rarity' | 'level'>;
const rarityRank: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
const textOrder = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

/** Stable across locales and saves; preserves the source array and item identities. */
export function sortInventoryItems<T extends SortableItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => rarityRank[b.rarity] - rarityRank[a.rarity]
    || b.level - a.level
    || textOrder(a.name.toLowerCase(), b.name.toLowerCase())
    || textOrder(a.name, b.name)
    || textOrder(a.id, b.id));
}
