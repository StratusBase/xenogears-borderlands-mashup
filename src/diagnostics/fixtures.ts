import { createProgression, equipItem, getStats, rollItem, seededRandom, type Item, type Mode, type Progression, type Slot } from '../core/index';
import type { BrandId } from '../core/arsenal';
import { createWorkbenchWeapon, normalizeWorkbenchConfig, workbenchCode, type WorkbenchConfig } from '../core/workbench';

export const EVALUATION_PROTOCOL = 'arsenal-evaluation-v1';
export const EVALUATION_SEEDS = [7, 41, 97] as const;
export type EvaluationBuildId = 'mobile-precision' | 'elemental-pressure' | 'heavy-control';
export interface EvaluationBuild {
  id: EvaluationBuildId;
  label: string;
  equipmentBrand: BrandId;
  pilot: Partial<WorkbenchConfig>;
  mech: Partial<WorkbenchConfig>;
}

/** Same level, rarity and rolled proc chances. Equipment is real, deterministically rolled gear. */
export const EVALUATION_BUILDS: readonly EvaluationBuild[] = [
  { id: 'mobile-precision', label: 'Mobile precision', equipmentBrand: 'kestrel',
    pilot: { brand: 'kestrel', weaponType: 'sniper', projectile: 'bullet', element: 'kinetic', affix: 'compact' },
    mech: { brand: 'kestrel', weaponType: 'sniper', projectile: 'slug', element: 'kinetic', affix: 'compact' } },
  { id: 'elemental-pressure', label: 'Sustained elemental pressure', equipmentBrand: 'voltaic',
    pilot: { brand: 'voltaic', weaponType: 'smg', projectile: 'arc', element: 'shock', secondaryElement: 'corrosive', affix: 'rapid' },
    mech: { brand: 'voltaic', weaponType: 'smg', projectile: 'arc', element: 'shock', secondaryElement: 'corrosive', affix: 'rapid' } },
  { id: 'heavy-control', label: 'Heavy explosive / control', equipmentBrand: 'ironvale',
    pilot: { brand: 'ironvale', weaponType: 'launcher', projectile: 'rocket', element: 'gravity', secondaryElement: 'fire', affix: 'heavy' },
    mech: { brand: 'ironvale', weaponType: 'launcher', projectile: 'rocket', element: 'gravity', secondaryElement: 'fire', affix: 'heavy' } },
];

export interface FixtureOverrides {
  pilot?: Partial<WorkbenchConfig>;
  mech?: Partial<WorkbenchConfig>;
  equipmentBrand?: BrandId;
  reactorBrand?: BrandId;
  legsBrand?: BrandId;
}
export interface EvaluationFixture {
  id: EvaluationBuildId;
  label: string;
  state: Progression;
  codes: Record<Mode, string>;
  configs: Record<Mode, WorkbenchConfig>;
  equipment: Record<Mode, Item[]>;
  stats: ReturnType<typeof fixtureStats>;
}
function fixtureStats(state: Progression) { return { pilot: getStats(state, 'pilot'), mech: getStats(state, 'mech') }; }

export function createEvaluationFixture(id: EvaluationBuildId, overrides: FixtureOverrides = {}): EvaluationFixture {
  const build = EVALUATION_BUILDS.find(candidate => candidate.id === id);
  if (!build) throw new Error(`Unknown evaluation build: ${id}`);
  const state = createProgression();
  // No dependence on current browser saves, previous loot, vendor stock, or IDs from crypto.
  state.inventory = []; state.loadouts = { pilot: {}, mech: {} }; state.credits = 0; state.kills = 0; state.wave = 1;
  const configs = {} as Record<Mode, WorkbenchConfig>;
  const codes = {} as Record<Mode, string>;
  const equipment = {} as Record<Mode, Item[]>;
  for (const mode of ['pilot', 'mech'] as const) {
    configs[mode] = normalizeWorkbenchConfig({ level: 5, rarity: 'rare', ...build[mode], ...overrides[mode], target: mode });
    codes[mode] = workbenchCode(configs[mode]);
    const weapon = createWorkbenchWeapon(configs[mode]);
    const items: Item[] = [weapon];
    for (const [index, slot] of (['shield', 'reactor', 'legs'] satisfies Slot[]).entries()) {
      // Independent seed per slot: changing a manufacturer cannot shift subsequent gear rolls.
      const brand = slot === 'reactor' && overrides.reactorBrand ? overrides.reactorBrand
        : slot === 'legs' && overrides.legsBrand ? overrides.legsBrand : overrides.equipmentBrand ?? build.equipmentBrand;
      const item = rollItem(mode, 5, seededRandom(1500 + index), slot, { brand });
      item.id = `evaluation-${mode}-${slot}`;
      items.push(item);
    }
    state.inventory.push(...items);
    for (const item of items) equipItem(state, item.id);
    equipment[mode] = items;
  }
  return { id, label: build.label, state, codes, configs, equipment, stats: fixtureStats(state) };
}
