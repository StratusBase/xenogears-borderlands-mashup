import type { Item, Mode, Rarity, Stats } from './index';
import {
  applyBrandModifiers, applyWeaponProfileStats, createWeaponSpec, isBrandId, isElementType,
  isProjectileTrail, isProjectileType, isWeaponType, weaponTypeLabels,
  type BrandId, type ElementType, type ProjectileTrail, type ProjectileType, type WeaponType,
} from './arsenal';

/** Deliberately independent controls: a rifle may fire rockets or an icy beam. */
export interface WorkbenchConfig {
  target: Mode;
  brand: BrandId;
  weaponType: WeaponType;
  projectile: ProjectileType;
  element: ElementType;
  secondaryElement: ElementType | 'none';
  trail: ProjectileTrail;
  visualVariant: number;
  affix: 'standard' | 'heavy' | 'rapid' | 'compact';
  level: number;
  rarity: Rarity;
  guaranteedStatus: boolean;
}

export const DEFAULT_WORKBENCH_CONFIG: Readonly<WorkbenchConfig> = Object.freeze({
  target: 'pilot', brand: 'ironvale', weaponType: 'rifle', projectile: 'bullet', element: 'kinetic',
  secondaryElement: 'none', trail: 'tracer', visualVariant: 0, affix: 'standard', level: 5, rarity: 'rare', guaranteedStatus: false,
});

const rarities: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const affixes = ['standard', 'heavy', 'rapid', 'compact'] as const;
const qualities: Record<Rarity, number> = { common: 1, uncommon: 1.15, rare: 1.36, epic: 1.65, legendary: 2.05 };

/** UI drafts and pasted codes cannot produce NaNs, duplicate channels or unsafe stats. */
export function normalizeWorkbenchConfig(raw: Partial<WorkbenchConfig> = {}): WorkbenchConfig {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const defaults = DEFAULT_WORKBENCH_CONFIG;
  const element = isElementType(value.element) ? value.element : defaults.element;
  const secondaryElement = isElementType(value.secondaryElement) && value.secondaryElement !== 'kinetic' && value.secondaryElement !== element ? value.secondaryElement : 'none';
  return {
    target: value.target === 'mech' ? 'mech' : 'pilot',
    brand: isBrandId(value.brand) ? value.brand : defaults.brand,
    weaponType: isWeaponType(value.weaponType) ? value.weaponType : defaults.weaponType,
    projectile: isProjectileType(value.projectile) ? value.projectile : defaults.projectile,
    element, secondaryElement,
    trail: isProjectileTrail(value.trail) ? value.trail : defaults.trail,
    visualVariant: typeof value.visualVariant === 'number' && Number.isFinite(value.visualVariant) ? Math.min(3, Math.max(0, Math.floor(value.visualVariant))) : defaults.visualVariant,
    affix: affixes.includes(value.affix as WorkbenchConfig['affix']) ? value.affix! : defaults.affix,
    level: typeof value.level === 'number' && Number.isFinite(value.level) ? Math.min(100, Math.max(1, Math.floor(value.level))) : defaults.level,
    rarity: rarities.includes(value.rarity as Rarity) ? value.rarity! : defaults.rarity,
    guaranteedStatus: value.guaranteedStatus === true,
  };
}

const familyStats: Readonly<Record<WeaponType, Pick<Stats, 'damage' | 'fireRate' | 'magazine' | 'reload'>>> = {
  pistol: { damage: 32, fireRate: 3.2, magazine: 12, reload: 1.1 },
  smg: { damage: 12, fireRate: 10, magazine: 40, reload: 1.6 },
  rifle: { damage: 20, fireRate: 5.5, magazine: 30, reload: 1.5 },
  shotgun: { damage: 31, fireRate: 1.6, magazine: 8, reload: 2.1 },
  sniper: { damage: 65, fireRate: 1.1, magazine: 6, reload: 2 },
  launcher: { damage: 70, fireRate: 0.8, magazine: 4, reload: 2.7 },
};

/** One replaceable, zero-resale test item. No random draws or inventory mutations. */
export function createWorkbenchWeapon(raw: WorkbenchConfig, id?: string): Item {
  const config = normalizeWorkbenchConfig(raw);
  const weapon = createWeaponSpec(config.projectile, config.element, config.target);
  weapon.weaponType = config.weaponType;
  weapon.trail = config.trail;
  weapon.visualVariant = config.visualVariant;
  if (config.secondaryElement !== 'none') weapon.secondaryElement = config.secondaryElement;
  const hasStatus = config.element !== 'kinetic' || config.secondaryElement !== 'none';
  weapon.statusChance = hasStatus ? config.guaranteedStatus ? 1 : 0.35 : 0;
  weapon.statusPower = hasStatus ? 0.25 : 0;
  const base = familyStats[config.weaponType];
  const scaling = (1 + (config.level - 1) * 0.075) * qualities[config.rarity];
  let stats: Partial<Stats> = {
    damage: base.damage * scaling * (config.target === 'mech' ? 3.4 : 1),
    fireRate: base.fireRate * (config.target === 'mech' ? 0.42 : 1),
    magazine: Math.max(1, Math.round(base.magazine * (config.target === 'mech' ? 0.6 : 1))),
    reload: base.reload * (config.target === 'mech' ? 1.25 : 1),
  };
  stats = applyWeaponProfileStats(applyBrandModifiers(stats, config.brand, 'weapon'), weapon);
  const affix = config.affix === 'heavy' ? 'Heavy' : config.affix === 'rapid' ? 'Rapid' : config.affix === 'compact' ? 'Quickdraw' : null;
  if (affix === 'Heavy') { stats.damage! *= 1.25; stats.fireRate! *= 0.9; }
  if (affix === 'Rapid') { stats.fireRate! *= 1.22; stats.magazine = Math.max(1, Math.round(stats.magazine! * 1.15)); }
  if (affix === 'Quickdraw') { stats.reload! *= 0.68; stats.damage! *= 1.08; }
  for (const key of ['damage', 'fireRate', 'reload'] as const) stats[key] = Math.max(0.1, Math.round(stats[key]! * 100) / 100);
  return {
    id: id ?? `sandbox-workbench-${config.target}`, name: `Test ${weaponTypeLabels[config.weaponType]}${config.target === 'mech' ? ' / Mech' : ''}`,
    target: config.target, slot: 'weapon', rarity: config.rarity, level: config.level, brand: config.brand,
    stats, weapon, affix, value: 0,
  };
}

/** Stable readable code for feedback about an exact permutation, not an item ID. */
export function workbenchCode(raw: WorkbenchConfig): string {
  const c = normalizeWorkbenchConfig(raw);
  return ['WS1', c.target, c.brand, c.weaponType, c.projectile, c.element, c.secondaryElement, c.trail,
    c.visualVariant, c.affix, c.level, c.rarity, c.guaranteedStatus ? 'proc100' : 'rolled'].join(':');
}

export function parseWorkbenchCode(raw: string): WorkbenchConfig | null {
  if (typeof raw !== 'string') return null;
  const fields = raw.trim().split(':');
  if (fields.length !== 13 || fields[0] !== 'WS1') return null;
  const [, target, brand, weaponType, projectile, element, secondaryElement, trail, variant, affix, level, rarity, status] = fields;
  if ((target !== 'pilot' && target !== 'mech') || !isBrandId(brand) || !isWeaponType(weaponType) || !isProjectileType(projectile)
    || !isElementType(element) || (secondaryElement !== 'none' && (!isElementType(secondaryElement) || secondaryElement === 'kinetic' || secondaryElement === element))
    || !isProjectileTrail(trail) || !/^[0-3]$/.test(variant) || !affixes.includes(affix as WorkbenchConfig['affix'])
    || !/^([1-9]|[1-9][0-9]|100)$/.test(level) || !rarities.includes(rarity as Rarity) || (status !== 'proc100' && status !== 'rolled')) return null;
  return normalizeWorkbenchConfig({ target, brand, weaponType, projectile, element, secondaryElement: secondaryElement as WorkbenchConfig['secondaryElement'], trail,
    visualVariant: Number(variant), affix: affix as WorkbenchConfig['affix'], level: Number(level), rarity: rarity as Rarity, guaranteedStatus: status === 'proc100' });
}

export interface WorkbenchPreset { readonly id: string; readonly label: string; readonly config: Readonly<Partial<WorkbenchConfig>> }
/** Thirteen curated examples cover all makes, families, deliveries, elements and trail styles. */
export const WORKBENCH_PRESETS: readonly WorkbenchPreset[] = Object.freeze(([
  { id: 'foundry-sidearm', label: 'Ironvale / Foundry sidearm', config: { brand: 'ironvale', weaponType: 'pistol', projectile: 'bullet', element: 'kinetic', trail: 'tracer' } },
  { id: 'kiln-slugger', label: 'Cindergrid / Kiln slugger', config: { brand: 'cindergrid', weaponType: 'sniper', projectile: 'slug', element: 'fire', trail: 'comet', affix: 'heavy' } },
  { id: 'briar-injector', label: 'Tackwork / Briar injector', config: { brand: 'tackwork', weaponType: 'smg', projectile: 'spike', element: 'corrosive', secondaryElement: 'adhesive', trail: 'ribbon' } },
  { id: 'ricochet-carbine', label: 'Rebound / Ricochet carbine', config: { brand: 'rebound', weaponType: 'rifle', projectile: 'ricochet', element: 'shock', trail: 'helix' } },
  { id: 'hunting-swarm', label: 'Kestrel / Hunting swarm', config: { brand: 'kestrel', weaponType: 'pistol', projectile: 'homing', element: 'ice', trail: 'tracer', affix: 'compact' } },
  { id: 'gum-mortar', label: 'Tackwork / Gum mortar', config: { brand: 'tackwork', weaponType: 'launcher', projectile: 'sticky', element: 'adhesive', trail: 'clean' } },
  { id: 'singularity-orb', label: 'Nullward / Singularity orb', config: { brand: 'nullward', weaponType: 'launcher', projectile: 'orb', element: 'gravity', trail: 'pulse' } },
  { id: 'cryo-lens', label: 'Prism / Cryo lens', config: { brand: 'prism', weaponType: 'sniper', projectile: 'beam', element: 'ice', trail: 'clean' } },
  { id: 'reactor-scatter', label: 'Cindergrid / Reactor scatter', config: { brand: 'cindergrid', weaponType: 'shotgun', projectile: 'scatter', element: 'radiation', trail: 'comet' } },
  { id: 'acid-siege', label: 'Ironvale / Acid siege', config: { brand: 'ironvale', weaponType: 'launcher', projectile: 'rocket', element: 'corrosive', secondaryElement: 'fire', trail: 'ribbon', affix: 'heavy' } },
  { id: 'orbit-cutter', label: 'Rebound / Orbit cutter', config: { brand: 'rebound', weaponType: 'rifle', projectile: 'disc', element: 'kinetic', trail: 'pulse' } },
  { id: 'storm-repeater', label: 'Voltaic / Storm repeater', config: { brand: 'voltaic', weaponType: 'smg', projectile: 'arc', element: 'shock', trail: 'helix', affix: 'rapid' } },
  { id: 'ember-cluster', label: 'Cindergrid / Ember cluster', config: { brand: 'cindergrid', weaponType: 'launcher', projectile: 'cluster', element: 'fire', secondaryElement: 'corrosive', trail: 'comet' } },
] satisfies WorkbenchPreset[]).map((preset, index) => Object.freeze({ ...preset, config: Object.freeze({ ...DEFAULT_WORKBENCH_CONFIG, visualVariant: index % 4, ...preset.config }) })));
