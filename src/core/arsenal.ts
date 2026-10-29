import type { Item, Mode, Slot, Stats } from './index';

export type BrandId = 'ironvale' | 'prism' | 'kestrel' | 'rebound' | 'tackwork' | 'nullward' | 'cindergrid' | 'voltaic';
export type ElementType = 'kinetic' | 'fire' | 'ice' | 'radiation' | 'gravity' | 'corrosive' | 'shock' | 'adhesive';
export type ProjectileType = 'bullet' | 'slug' | 'spike' | 'ricochet' | 'homing' | 'sticky' | 'orb' | 'beam' | 'scatter' | 'rocket' | 'disc' | 'arc';
export type WeaponType = 'pistol' | 'smg' | 'rifle' | 'shotgun' | 'sniper' | 'launcher';
export type ProjectileTrail = 'clean' | 'tracer' | 'helix' | 'pulse' | 'comet' | 'ribbon';

export interface WeaponSpec {
  /** Family controls the physical receiver; delivery and elements stay independent. */
  weaponType?: WeaponType;
  secondaryElement?: ElementType;
  trail?: ProjectileTrail;
  visualVariant?: number;
  projectile: ProjectileType;
  element: ElementType;
  speed: number;
  pellets: number;
  /** Radians from the firing direction. */
  spread: number;
  bounces: number;
  /** Maximum steering rate in radians per second. */
  tracking: number;
  blastRadius: number;
  fuse: number;
  statusChance: number;
  /** Multiplies weapon damage to produce absolute status tick strength. */
  statusPower: number;
}

export interface BrandDefinition { readonly id: BrandId; readonly name: string; readonly color: string; readonly description: string }

export const brands: Readonly<Record<BrandId, BrandDefinition>> = Object.freeze({
  ironvale: Object.freeze({ id: 'ironvale', name: 'Ironvale', color: '#c47a4c', description: 'Hard-hitting slower guns; heavier shields, capacitors and armored locomotion. Kinetic bullets, slugs and heavy ordnance.' }),
  prism: Object.freeze({ id: 'prism', name: 'Prism', color: '#c6a9ff', description: 'Fast cycling and cooling; shield-efficient precision hardware. Energy beams, orbs and discs with cold or gravity control.' }),
  kestrel: Object.freeze({ id: 'kestrel', name: 'Kestrel', color: '#5cc9bd', description: 'Rapid fire, quick reloads and nimble legs trade away damage and protection. Light bullets, guided rounds and scatter weapons.' }),
  rebound: Object.freeze({ id: 'rebound', name: 'Rebound', color: '#f0ba59', description: 'Larger magazines and balanced durable modules. Ricochets and bouncing discs specialize in kinetic and electric fire.' }),
  tackwork: Object.freeze({ id: 'tackwork', name: 'Tackwork', color: '#e49b68', description: 'Punchy, slower-handling weapons and reinforced modules. Sticky charges, spikes and adhesive or corrosive payloads.' }),
  nullward: Object.freeze({ id: 'nullward', name: 'Nullward', color: '#9a8fd4', description: 'High-capacity shields and reactors support deliberate fire. Orbs, guided rounds and discs carry gravity and ice control.' }),
  cindergrid: Object.freeze({ id: 'cindergrid', name: 'Cindergrid', color: '#ff824b', description: 'High damage and aggressive cooling. Rockets, slugs and scatter payloads spread fire, radiation and corrosion.' }),
  voltaic: Object.freeze({ id: 'voltaic', name: 'Voltaic', color: '#73baff', description: 'Accelerated firing, cooling and servo response. Arcs, beams and spikes specialize in electric and radioactive payloads.' }),
});
export const brandList: readonly BrandDefinition[] = Object.freeze(Object.values(brands));

export const elementLabels: Readonly<Record<ElementType, string>> = Object.freeze({
  kinetic: 'Kinetic', fire: 'Fire', ice: 'Ice', radiation: 'Radiation', gravity: 'Gravity', corrosive: 'Corrosive', shock: 'Shock', adhesive: 'Adhesive',
});
export const elementColors: Readonly<Record<ElementType, string>> = Object.freeze({
  kinetic: '#ffe7a4', fire: '#ff8a24', ice: '#58e5f2', radiation: '#b7f34a', gravity: '#ad86ff', corrosive: '#67e04b', shock: '#4ca3ff', adhesive: '#ffc94f',
});
export const projectileLabels: Readonly<Record<ProjectileType, string>> = Object.freeze({
  bullet: 'Bullet', slug: 'Slug', spike: 'Spike', ricochet: 'Ricochet', homing: 'Homing round', sticky: 'Sticky charge', orb: 'Orb', beam: 'Beam', scatter: 'Scatter', rocket: 'Rocket', disc: 'Disc', arc: 'Arc',
});
export const weaponTypeLabels: Readonly<Record<WeaponType, string>> = Object.freeze({
  pistol: 'Pistol', smg: 'SMG', rifle: 'Rifle', shotgun: 'Shotgun', sniper: 'Sniper', launcher: 'Launcher',
});
export const projectileTrailLabels: Readonly<Record<ProjectileTrail, string>> = Object.freeze({
  clean: 'Clean', tracer: 'Tracer', helix: 'Helix', pulse: 'Pulse', comet: 'Comet', ribbon: 'Ribbon',
});

export function defaultWeaponType(projectile: ProjectileType): WeaponType {
  if (projectile === 'scatter') return 'shotgun';
  if (projectile === 'rocket' || projectile === 'orb' || projectile === 'sticky') return 'launcher';
  if (projectile === 'slug' || projectile === 'spike') return 'sniper';
  if (projectile === 'ricochet' || projectile === 'arc') return 'smg';
  return 'rifle';
}

const profiles: Record<BrandId, { projectiles: readonly ProjectileType[]; elements: readonly ElementType[] }> = {
  ironvale: { projectiles: ['bullet', 'slug', 'scatter', 'rocket'], elements: ['kinetic', 'kinetic', 'corrosive'] },
  prism: { projectiles: ['beam', 'orb', 'disc'], elements: ['ice', 'gravity', 'kinetic'] },
  kestrel: { projectiles: ['bullet', 'homing', 'scatter'], elements: ['kinetic', 'ice'] },
  rebound: { projectiles: ['ricochet', 'disc', 'bullet'], elements: ['kinetic', 'shock'] },
  tackwork: { projectiles: ['sticky', 'spike', 'rocket'], elements: ['adhesive', 'corrosive'] },
  nullward: { projectiles: ['orb', 'homing', 'disc'], elements: ['gravity', 'ice'] },
  cindergrid: { projectiles: ['rocket', 'scatter', 'slug'], elements: ['fire', 'radiation', 'corrosive'] },
  voltaic: { projectiles: ['arc', 'beam', 'spike'], elements: ['shock', 'radiation'] },
};

const modifiers: Record<BrandId, Record<Slot, Partial<Stats>>> = {
  ironvale: { weapon: { damage: 1.18, fireRate: 0.88, reload: 1.08 }, shield: { maxShield: 1.18, maxHealth: 1.15 }, reactor: { heatCapacity: 1.18, cooling: 0.9 }, legs: { moveSpeed: 0.9, maxHealth: 1.3 } },
  prism: { weapon: { damage: 1.02, fireRate: 1.08, reload: 0.88 }, shield: { maxShield: 1.1, maxHealth: 0.95 }, reactor: { cooling: 1.22, heatCapacity: 1.05 }, legs: { moveSpeed: 1.1, maxHealth: 0.9 } },
  kestrel: { weapon: { damage: 0.9, fireRate: 1.25, reload: 0.83, magazine: 1.1 }, shield: { maxShield: 0.85, maxHealth: 0.9 }, reactor: { cooling: 1.12, heatCapacity: 0.9 }, legs: { moveSpeed: 1.35, maxHealth: 0.8 } },
  rebound: { weapon: { damage: 1.06, magazine: 1.15, reload: 0.95 }, shield: { maxShield: 1.05, maxHealth: 1.08 }, reactor: { heatCapacity: 1.12, cooling: 1.1 }, legs: { moveSpeed: 1.08, maxHealth: 1.12 } },
  tackwork: { weapon: { damage: 1.12, reload: 1.12, magazine: 0.9 }, shield: { maxHealth: 1.25, maxShield: 1.08 }, reactor: { heatCapacity: 1.2, cooling: 0.95 }, legs: { maxHealth: 1.25, moveSpeed: 0.95 } },
  nullward: { weapon: { damage: 1.1, fireRate: 0.92 }, shield: { maxShield: 1.22, maxHealth: 1.05 }, reactor: { heatCapacity: 1.25, cooling: 1.05 }, legs: { maxHealth: 1.18, moveSpeed: 1.06 } },
  cindergrid: { weapon: { damage: 1.16, fireRate: 0.94 }, shield: { maxHealth: 1.12, maxShield: 1.08 }, reactor: { cooling: 1.3, heatCapacity: 0.9 }, legs: { maxHealth: 1.12, moveSpeed: 1.12 } },
  voltaic: { weapon: { fireRate: 1.18, damage: 0.94, magazine: 1.08, reload: 0.9 }, shield: { maxShield: 1.12, maxHealth: 1.03 }, reactor: { cooling: 1.18, heatCapacity: 1.08 }, legs: { moveSpeed: 1.22, maxHealth: 1.02 } },
};

function draw(rng: () => number): number {
  const value = rng();
  return Number.isFinite(value) ? Math.max(0, Math.min(0.999999999, value)) : 0;
}
function hash(value: string): number {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) result = Math.imul(result ^ value.charCodeAt(index), 0x01000193);
  return result >>> 0;
}
export function isBrandId(value: unknown): value is BrandId { return typeof value === 'string' && Object.hasOwn(brands, value); }
export function isElementType(value: unknown): value is ElementType { return typeof value === 'string' && Object.hasOwn(elementLabels, value); }
export function isProjectileType(value: unknown): value is ProjectileType { return typeof value === 'string' && Object.hasOwn(projectileLabels, value); }
export function isWeaponType(value: unknown): value is WeaponType { return typeof value === 'string' && Object.hasOwn(weaponTypeLabels, value); }
export function isProjectileTrail(value: unknown): value is ProjectileTrail { return typeof value === 'string' && Object.hasOwn(projectileTrailLabels, value); }
export function rollBrand(rng: () => number = Math.random): BrandId { return brandList[Math.floor(draw(rng) * brandList.length)].id; }

export function applyBrandModifiers(stats: Partial<Stats>, brand: BrandId, slot: Slot): Partial<Stats> {
  const result = { ...stats };
  for (const [key, multiplier] of Object.entries(modifiers[brand][slot])) {
    const stat = key as keyof Stats;
    if (result[stat] === undefined) continue;
    const next = result[stat]! * multiplier;
    result[stat] = stat === 'magazine' ? Math.max(1, Math.round(next)) : Math.round(next * 100) / 100;
  }
  return result;
}

/** Valid explicit archetypes are also used by the weapon demonstration room. */
export function createWeaponSpec(projectile: ProjectileType, element: ElementType, mode: Mode = 'pilot'): WeaponSpec {
  const spec: WeaponSpec = { weaponType: defaultWeaponType(projectile), trail: 'tracer', visualVariant: 0, projectile, element, speed: mode === 'mech' ? 135 : 155, pellets: 1, spread: 0.008, bounces: 0, tracking: 0, blastRadius: 0, fuse: 0, statusChance: element === 'kinetic' ? 0 : 0.35, statusPower: element === 'kinetic' ? 0 : 0.25 };
  if (projectile === 'slug') { spec.speed = 105; spec.spread = 0.003; }
  if (projectile === 'spike') { spec.speed = 100; spec.spread = 0.012; }
  if (projectile === 'ricochet') { spec.speed = 140; spec.bounces = 3; }
  if (projectile === 'homing') { spec.speed = 62; spec.tracking = 3.2; spec.spread = 0.02; }
  if (projectile === 'sticky') { spec.speed = 55; spec.fuse = 1.15; spec.blastRadius = mode === 'mech' ? 3.8 : 2.5; }
  if (projectile === 'orb') { spec.speed = 42; spec.blastRadius = mode === 'mech' ? 3.5 : 2.2; }
  if (projectile === 'beam') { spec.speed = 260; spec.spread = 0; }
  if (projectile === 'scatter') { spec.speed = 125; spec.pellets = mode === 'mech' ? 8 : 6; spec.spread = 0.11; }
  if (projectile === 'rocket') { spec.speed = 58; spec.blastRadius = mode === 'mech' ? 6 : 4.2; spec.spread = 0.018; }
  if (projectile === 'disc') { spec.speed = 88; spec.bounces = 2; spec.spread = 0.005; }
  if (projectile === 'arc') { spec.speed = 180; spec.tracking = 1.2; spec.spread = 0.015; }
  return spec;
}

const bounds = {
  speed: [4, 260], pellets: [1, 12], spread: [0, 0.4], bounces: [0, 5], tracking: [0, 8], blastRadius: [0, 10], fuse: [0, 5], statusChance: [0, 1], statusPower: [0, 2],
} satisfies Record<'speed' | 'pellets' | 'spread' | 'bounces' | 'tracking' | 'blastRadius' | 'fuse' | 'statusChance' | 'statusPower', readonly [number, number]>;

/** Weapon metadata is optional on old saves; malformed metadata cannot erase the item. */
export function normalizeWeaponSpec(raw: unknown, mode: Mode = 'pilot'): WeaponSpec {
  const fallback = () => createWeaponSpec(mode === 'mech' ? 'slug' : 'bullet', 'kinetic', mode);
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return fallback();
  const value = raw as Record<string, unknown>;
  if (!isProjectileType(value.projectile) || !isElementType(value.element)) return fallback();
  const result = { projectile: value.projectile, element: value.element } as WeaponSpec;
  for (const key of Object.keys(bounds) as (keyof typeof bounds)[]) {
    const number = value[key];
    const [minimum, maximum] = bounds[key];
    if (typeof number !== 'number' || !Number.isFinite(number) || number < minimum || number > maximum
      || ((key === 'pellets' || key === 'bounces') && !Number.isInteger(number))) return fallback();
    result[key] = number;
  }
  // A corrupt cosmetic field must not discard a valid saved ballistic/stat roll.
  result.weaponType = isWeaponType(value.weaponType) ? value.weaponType : defaultWeaponType(result.projectile);
  result.trail = isProjectileTrail(value.trail) ? value.trail : 'tracer';
  result.visualVariant = typeof value.visualVariant === 'number' && Number.isInteger(value.visualVariant) && value.visualVariant >= 0 && value.visualVariant <= 3 ? value.visualVariant : 0;
  if (isElementType(value.secondaryElement) && value.secondaryElement !== 'kinetic' && value.secondaryElement !== result.element) result.secondaryElement = value.secondaryElement;
  return result;
}

/** Ordered unique payload channels; kinetic remains the direct-impact channel. */
export function getWeaponElements(spec: WeaponSpec): ElementType[] {
  const primary = isElementType(spec.element) ? spec.element : 'kinetic';
  return isElementType(spec.secondaryElement) && spec.secondaryElement !== 'kinetic' && spec.secondaryElement !== primary ? [primary, spec.secondaryElement] : [primary];
}

export function getWeaponSpec(item?: Item): WeaponSpec {
  return normalizeWeaponSpec(item?.slot === 'weapon' ? item.weapon : undefined, item?.target ?? 'pilot');
}

export function rollWeaponSpec(brand: BrandId, mode: Mode, rng: () => number = Math.random): WeaponSpec {
  const pool = profiles[brand];
  const projectile = pool.projectiles[Math.floor(draw(rng) * pool.projectiles.length)];
  const element = pool.elements[Math.floor(draw(rng) * pool.elements.length)];
  const result = createWeaponSpec(projectile, element, mode);
  result.speed = Math.round(Math.min(260, result.speed * (0.9 + draw(rng) * 0.2)) * 10) / 10;
  if (result.pellets > 1) result.pellets = Math.max(3, Math.min(12, result.pellets + Math.floor(draw(rng) * 3) - 1));
  if (result.spread > 0) result.spread = Math.round(result.spread * (0.8 + draw(rng) * 0.4) * 10000) / 10000;
  if (element !== 'kinetic') {
    result.statusChance = Math.round((0.2 + draw(rng) * 0.25) * 100) / 100;
    result.statusPower = Math.round((0.18 + draw(rng) * 0.2) * 100) / 100;
  }
  // Cosmetic variety reuses the already-rolled values and never consumes extra RNG.
  const identity = hash(`${brand}:${result.speed}:${result.spread}:${result.statusChance}`);
  result.visualVariant = identity % 4;
  const trails: readonly ProjectileTrail[] = ['clean', 'tracer', 'helix', 'pulse', 'comet', 'ribbon'];
  result.trail = trails[(identity >>> 5) % trails.length];
  return result;
}

/** Per-projectile damage keeps scatter from multiplying the entire rifle hit by its pellet count. */
export function applyWeaponProfileStats(stats: Partial<Stats>, spec: WeaponSpec): Partial<Stats> {
  const result = { ...stats };
  let damage = 1, fireRate = 1;
  if (spec.projectile === 'scatter') { damage = 1.4 / spec.pellets; fireRate = 0.8; }
  if (spec.projectile === 'rocket') { damage = 1.35; fireRate = 0.7; }
  if (spec.projectile === 'slug') { damage = 1.12; fireRate = 0.9; }
  if (spec.projectile === 'beam') { damage = 0.8; fireRate = 1.15; }
  if (spec.projectile === 'orb') { damage = 1.2; fireRate = 0.8; }
  if (spec.projectile === 'arc') { damage = 0.88; fireRate = 1.15; }
  if (spec.projectile === 'homing') damage = 0.9;
  if (result.damage !== undefined) result.damage = Math.max(0.1, Math.round(result.damage * damage * 100) / 100);
  if (result.fireRate !== undefined) result.fireRate = Math.max(0.1, Math.round(result.fireRate * fireRate * 100) / 100);
  return result;
}

export function normalizeItemMetadata(item: Pick<Item, 'id' | 'target' | 'slot'>, brand: unknown, weapon: unknown): { brand: BrandId; weapon?: WeaponSpec } {
  const assigned = isBrandId(brand) ? brand : item.id.startsWith('starter-') ? 'ironvale' : brandList[hash(`${item.id}:${item.target}:${item.slot}`) % brandList.length].id;
  return item.slot === 'weapon' ? { brand: assigned, weapon: normalizeWeaponSpec(weapon, item.target) } : { brand: assigned };
}
