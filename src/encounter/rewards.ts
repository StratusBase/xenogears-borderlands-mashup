import { rollItem, seededRandom, type Item, type Progression, type Stats } from '../core/index';

/** A real inventory item: first-run cooling, then mobility and shields; existing rolls remain intact. */
export function createEncounterReward(progression: Progression, run: number, seed = 1): Item {
  const cycle = Math.max(0, Math.floor(run) - 1) % 3;
  const target = cycle === 1 ? 'pilot' : 'mech';
  const slot = cycle === 0 ? 'reactor' : cycle === 1 ? 'legs' : 'shield';
  const equipped = progression.inventory.find(item => item.id === progression.loadouts[target][slot]);
  const random = seededRandom((seed >>> 0) ^ Math.imul(Math.max(1, run), 0x45d9f3b));
  const item = rollItem(target, Math.min(100, Math.max(2, equipped?.level ?? 1)), random, slot,
    { brand: cycle === 0 ? 'prism' : cycle === 1 ? 'kestrel' : 'nullward' });
  item.rarity = 'rare'; item.affix = 'Range Salvage';
  item.name = cycle === 0 ? 'Salvaged Vent Reactor' : cycle === 1 ? 'Salvaged Dash Servos' : 'Salvaged Aegis Plating';
  item.value = Math.max(100, item.value);
  const upgrade = (key: keyof Stats, baseline: number, cap: number) => {
    item.stats[key] = Math.min(cap, Math.round(Math.max(baseline, (equipped?.stats[key] ?? 0) * 1.18) * 100) / 100);
  };
  if (slot === 'reactor') { upgrade('cooling', 14, 10000); upgrade('heatCapacity', 34, 10000); }
  else if (slot === 'legs') { upgrade('moveSpeed', 1.1, 40); upgrade('maxHealth', 12, 100000); }
  else { upgrade('maxShield', 270, 100000); upgrade('maxHealth', 55, 100000); }
  // Keep useful tertiary stats from the equipped module; the reward never destroys a tradeoff the player already chose.
  for (const [key, value] of Object.entries(equipped?.stats ?? {}) as [keyof Stats, number][]) {
    if (item.stats[key] === undefined) item.stats[key] = value;
  }
  return item;
}
