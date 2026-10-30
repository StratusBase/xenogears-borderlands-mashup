import type { Item, Stats } from './index';
import { elementColors, elementLabels, getWeaponSpec, getWeaponElements, getHitStatusChance, getHitStatusPower, getDamagePacketCount, getClusterBombletFuseRange, type ElementType, type WeaponSpec } from './arsenal';
import { ELEMENT_STATUS, elementEffectDescriptions, getStatusDps, getStatusDuration } from './statusEffects';
import { DEFAULT_WEAPON_BALANCE, effectiveProjectileDamage, hasSecondaryElementCost, type WeaponBalanceRules } from './weaponBalance';

export interface CardDelta {
  /** Selected value minus equipped value, in the metric's displayed units. */
  amount: number;
  direction: 'up' | 'down' | 'equal';
  /** Null for an equal value; absence of a comparison uses a null delta instead. */
  better: boolean | null;
  display: string;
}

export interface CardMetric {
  key: keyof Stats | 'spread' | 'burstDps' | 'sustainedDps';
  label: string;
  value: number;
  display: string;
  unit: string;
  delta: CardDelta | null;
  description: string;
}

export interface CardSpec {
  key: 'speed' | 'bounces' | 'tracking' | 'fuse' | 'blastRadius' | 'splitCount' | 'splitDelay';
  label: string;
  value: number;
  display: string;
  unit: string;
}

export interface CardStatus {
  element: ElementType;
  label: string;
  color: string;
  chancePercent: number;
  chanceDisplay: string;
  chanceDelta: CardDelta | null;
  duration: number;
  durationDisplay: string;
  /** Base damage each second from one successful proc; never expected total weapon DPS. */
  dps: number | null;
  dpsDisplay: string;
  dpsDelta: CardDelta | null;
  dpsLabel: 'DMG/s';
  effect: string;
  description: string;
}

export interface WeaponCardModel {
  burstDps: CardMetric;
  sustainedDps: CardMetric;
  damagePerPellet: number;
  pellets: number;
  damagePerTrigger: number;
}

export interface ItemCardModel {
  comparison: boolean;
  weapon: WeaponCardModel | null;
  stats: CardMetric[];
  secondary: CardSpec[];
  status: CardStatus | null;
  statuses: CardStatus[];
}

const statInfo: Record<keyof Stats, { label: string; unit: string; maximum: number }> = {
  damage: { label: 'Damage', unit: '', maximum: 100_000 },
  fireRate: { label: 'Fire rate', unit: '/s', maximum: 30 },
  magazine: { label: 'Magazine', unit: '', maximum: 999 },
  reload: { label: 'Reload', unit: 's', maximum: 30 },
  maxHealth: { label: 'Health', unit: '', maximum: 100_000 },
  maxShield: { label: 'Shield', unit: '', maximum: 100_000 },
  moveSpeed: { label: 'Move speed', unit: 'm/s', maximum: 40 },
  heatCapacity: { label: 'Heat capacity', unit: '', maximum: 10_000 },
  cooling: { label: 'Cooling', unit: '/s', maximum: 10_000 },
};
const statOrder: (keyof Stats)[] = ['maxShield', 'maxHealth', 'heatCapacity', 'cooling', 'moveSpeed', 'damage', 'fireRate', 'magazine', 'reload'];

function validStat(item: Item, key: keyof Stats): boolean {
  const value = item.stats?.[key];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= statInfo[key].maximum;
}

function stat(item: Item, key: keyof Stats): number {
  return validStat(item, key) ? item.stats[key]! : 0;
}

function number(value: number, precision = 1): string {
  return Number(value.toFixed(precision)).toString();
}

function withUnit(value: string, unit: string): string {
  return unit ? `${value}${unit === '/s' ? '' : ' '}${unit}` : value;
}

function delta(value: number, equipped: number | undefined, lowerBetter: boolean, unit: string, precision: number): CardDelta | null {
  if (equipped === undefined) return null;
  const raw = value - equipped;
  const equal = Math.abs(raw) <= 1e-9 * Math.max(1, Math.abs(value), Math.abs(equipped));
  const amount = equal ? 0 : raw;
  const deltaPrecision = equal ? precision : Math.max(precision, Math.min(9, Math.ceil(-Math.log10(Math.abs(amount)))));
  return {
    amount,
    direction: equal ? 'equal' : amount > 0 ? 'up' : 'down',
    better: equal ? null : lowerBetter ? amount < 0 : amount > 0,
    display: equal ? '' : withUnit(`${amount > 0 ? '+' : '−'}${number(Math.abs(amount), deltaPrecision)}`, unit),
  };
}

function metric(key: CardMetric['key'], label: string, value: number, equipped: number | undefined, unit = '', lowerBetter = false, precision = 1, description = ''): CardMetric {
  return { key, label, value, display: withUnit(number(value, precision), unit), unit, delta: delta(value, equipped, lowerBetter, unit, precision), description };
}

function weaponNumbers(item: Item, spec: WeaponSpec, rules: WeaponBalanceRules) {
  const triggerDamage = effectiveProjectileDamage(stat(item, 'damage'), spec, rules);
  const packetCount = getDamagePacketCount(spec);
  const splitCount = packetCount > 1 ? spec.split!.count : 1;
  const damage = triggerDamage / packetCount;
  const projectiles = spec.pellets * packetCount;
  const rate = stat(item, 'fireRate');
  const magazine = stat(item, 'magazine');
  const reload = stat(item, 'reload');
  const damagePerTrigger = triggerDamage * spec.pellets;
  const burst = damagePerTrigger * rate;
  const cycle = rate > 0 && magazine > 0 ? magazine / rate + reload : 0;
  const sustained = cycle > 0 ? damagePerTrigger * magazine / cycle : 0;
  return { damage, projectiles, splitCount, packetCount, rate, magazine, reload, damagePerTrigger, burst, sustained, spread: spec.spread * 180 / Math.PI };
}

function statusCard(spec: WeaponSpec, damage: number, equipped?: CardStatus): CardStatus {
  const info = ELEMENT_STATUS[spec.element];
  const power = getHitStatusPower(damage, spec);
  const applied = getStatusDuration(spec.element) > 0 && power > 0;
  const duration = applied ? getStatusDuration(spec.element) : 0;
  const dps = applied && info.dpsMultiplier > 0 ? getStatusDps(spec.element, power) : null;
  const chancePercent = spec.element === 'kinetic' ? 0 : getHitStatusChance(spec) * 100;
  const movement = `${number(info.moveSpeed * 100)}% move`;
  const seconds = `${number(duration)} s`;
  let effect: string;
  switch (spec.element) {
    case 'kinetic': effect = spec.projectile === 'cluster' ? 'Blast damage' : ['slug', 'spike', 'rocket'].includes(spec.projectile) ? 'Impact stagger' : 'Direct impact'; break;
    case 'fire': effect = `Burn · ${seconds}`; break;
    case 'radiation': effect = `Death pulse · ${seconds}`; break;
    case 'corrosive': effect = `+${number((info.incomingDamage - 1) * 100)}% incoming · ${seconds}`; break;
    case 'ice': effect = `${movement} · ${seconds}; repeat freeze ${number(info.freezeDuration)} s`; break;
    case 'gravity': effect = `Pull · ${movement} · ${seconds}`; break;
    case 'shock': effect = `+${number((info.shieldDamage - 1) * 100)}% shield damage · chain · ${seconds}`; break;
    case 'adhesive': effect = `${movement} · ${seconds}`; break;
  }
  if (spec.element !== 'kinetic' && !applied) effect = 'No status effect';
  return {
    element: spec.element, label: elementLabels[spec.element], color: elementColors[spec.element],
    chancePercent, chanceDisplay: `${number(chancePercent)}%`,
    chanceDelta: spec.element === 'kinetic' ? null : delta(chancePercent, equipped?.chancePercent, false, '%', 1),
    duration, durationDisplay: seconds,
    dps, dpsDisplay: dps === null ? '' : withUnit(number(dps, 2), '/s'),
    dpsDelta: dps === null ? null : delta(dps, equipped ? equipped.dps ?? 0 : undefined, false, '/s', 2),
    dpsLabel: 'DMG/s', effect,
    description: `${spec.element === 'kinetic' && spec.projectile === 'cluster' ? 'Blast damage from the parent burst and bomblets; no direct-hit damage or critical hits.' : elementEffectDescriptions[spec.element]}${dps === null ? '' : ' Base DoT per proc excludes vulnerability, critical hits, shields, splash and other effects. Reprocs refresh; they do not add separate damage stacks.'}`,
  };
}

function secondarySpecs(spec: WeaponSpec): CardSpec[] {
  const result: CardSpec[] = [];
  const add = (key: CardSpec['key'], label: string, value: number, unit: string) => result.push({ key, label, value, unit, display: withUnit(number(value, 2), unit) });
  const instant = spec.projectile === 'beam' || spec.projectile === 'arc';
  if (!instant) add('speed', 'Velocity', spec.speed, 'm/s');
  if ((spec.projectile === 'ricochet' || spec.projectile === 'disc') && spec.bounces > 0) add('bounces', 'Bounces', spec.bounces, '');
  if ((spec.projectile === 'homing' || spec.projectile === 'orb') && spec.tracking > 0) add('tracking', 'Tracking', spec.tracking, 'rad/s');
  const split = !instant ? spec.split : undefined;
  const mirv = spec.projectile === 'cluster' && split !== undefined;
  if (split) {
    add('splitCount', mirv ? 'Bomblets' : 'Children', split.count, '');
    add('splitDelay', mirv ? 'Stagger window' : 'Split delay', split.delay, 's');
  }
  if (mirv) {
    const fuse = getClusterBombletFuseRange(spec);
    add('fuse', 'Bomblet fuses', fuse.min, 's');
    result[result.length - 1].display = `${number(fuse.min, 2)}–${number(fuse.max, 2)} s`;
  } else if ((spec.projectile === 'sticky' || split) && spec.fuse > 0) add('fuse', split ? 'Child fuse' : 'Fuse', spec.fuse, 's');
  if (!instant && spec.blastRadius > 0) add('blastRadius', mirv ? 'Blast radius' : split ? 'Child blast radius' : 'Blast radius', spec.blastRadius, 'm');
  return result;
}

/** Presentation only. Derives effective projectile damage from the unchanged roll;
 * the optional rules let diagnostic cards describe the same paired combat run.
 */
export function buildItemCard(item: Item, equipped?: Item, rules: WeaponBalanceRules = DEFAULT_WEAPON_BALANCE): ItemCardModel {
  const comparison = !!equipped && equipped.slot === item.slot && equipped.target === item.target;
  const baseline = comparison ? equipped : undefined;
  if (item.slot !== 'weapon') {
    const stats = statOrder.filter(key => validStat(item, key) || !!baseline && validStat(baseline, key)).map(key => {
      const info = statInfo[key];
      const row = metric(key, key === 'maxHealth' && item.target === 'mech' ? 'Hull' : info.label, stat(item, key), baseline ? stat(baseline, key) : undefined, info.unit, key === 'reload', 2, 'Rolled equipment bonus, added to character totals.');
      if (row.value > 0) row.display = `+${row.display}`;
      return row;
    });
    return { comparison, weapon: null, stats, secondary: [], status: null, statuses: [] };
  }

  const spec = getWeaponSpec(item);
  const values = weaponNumbers(item, spec, rules);
  const previous = baseline ? weaponNumbers(baseline, getWeaponSpec(baseline), rules) : undefined;
  const costNotice = hasSecondaryElementCost(spec, rules) ? ' Includes the 15% secondary-element damage cost.' : '';
  const mirv = spec.projectile === 'cluster' && values.packetCount > 1;
  const splitNotice = mirv
    ? ` One parent burst and ${values.splitCount} bouncing bomblets share the carrier budget across ${values.packetCount} equal explosions. The carrier bursts on impact or when travel ends; bomblets explode after staggered fuses.`
    : values.splitCount > 1 ? ` Carrier deals no damage; its damage budget is shared across ${values.splitCount} children released after the split delay or on contact.` : '';
  const damage = metric('damage', mirv ? 'Blast budget' : 'Damage', values.damagePerTrigger, previous?.damagePerTrigger, '', false, 2,
    mirv
      ? `Blast budget per explosion × total explosion count. No direct-hit damage or critical hits. Actual damage depends on blast falloff, cover and target positions.${splitNotice}${costNotice}`
      : `Damage per ${values.splitCount > 1 ? 'child' : 'pellet'} × ${values.splitCount > 1 ? 'child' : 'pellet'} count. Comparison uses total direct damage per trigger, with every ${values.splitCount > 1 ? 'child' : 'pellet'} hitting.${splitNotice}${costNotice}`);
  damage.display = values.projectiles > 1 ? `${number(values.damage, 2)}×${values.projectiles}` : number(values.damage, 2);
  const stats = [
    damage,
    metric('spread', 'Spread', values.spread, previous?.spread, '°', true, 2, 'Maximum angle from the aim direction. Lower is tighter.'),
    metric('reload', 'Reload', values.reload, previous?.reload, 's', true, 2),
    metric('fireRate', 'Fire rate', values.rate, previous?.rate, '/s', false, 2),
    metric('magazine', 'Magazine', values.magazine, previous?.magazine),
  ];
  const weapon: WeaponCardModel = {
    damagePerPellet: values.damage, pellets: values.projectiles, damagePerTrigger: values.damagePerTrigger,
    burstDps: metric('burstDps', mirv ? 'Blast budget/s' : 'Direct DPS', values.burst, previous?.burst, '/s', false, 1,
      mirv
        ? `Total blast budget per trigger × fire rate, assuming every explosion reaches a target at full strength. Excludes reload, heat, travel/fuse delay, misses, cover, blast falloff, shields, chains and status damage.${splitNotice}${costNotice}`
        : `Damage per trigger × fire rate, with every ${values.splitCount > 1 ? 'child' : 'pellet'} hitting. Excludes reload, heat, misses, critical hits, shields, splash, chains and status damage.${splitNotice}${costNotice}`),
    sustainedDps: metric('sustainedDps', mirv ? 'Blast with reload' : 'With reload', values.sustained, previous?.sustained, '/s', false, 1,
      mirv
        ? `Total blast budget × magazine ÷ (magazine ÷ fire rate + reload), assuming every explosion reaches a target at full strength. Excludes heat, travel/fuse delay, misses, cover, blast falloff, shields, chains and status damage.${splitNotice}${costNotice}`
        : `Damage per trigger × magazine ÷ (magazine ÷ fire rate + reload). Excludes heat, misses, critical hits, shields, splash, chains and status damage.${splitNotice}${costNotice}`),
  };
  const previousSpec = baseline ? getWeaponSpec(baseline) : undefined;
  const previousStatuses = previousSpec && previous ? getWeaponElements(previousSpec).map(element => statusCard({ ...previousSpec, element }, previous.damage)) : [];
  const statuses = getWeaponElements(spec).map((element, index) => statusCard({ ...spec, element }, values.damage,
    previousStatuses.find(status => status.element === element) ?? (index === 0 ? previousStatuses[0]
      : previousSpec ? statusCard({ ...previousSpec, element: 'kinetic' }, 0) : undefined)));
  if (values.packetCount > 1) for (const status of statuses) status.description += mirv
    ? ` Each successful explosion proc uses the carrier's status strength, with blast falloff preserved. The per-explosion chance is shared across the parent burst and ${values.splitCount} bomblets; all ${values.packetCount} explosions reaching one target retain the saved carrier chance of at least one proc, independently per element.`
    : " Each successful child proc uses the carrier's status strength, with splash falloff preserved. The per-child chance shares the saved carrier chance; all children connecting in one impact stage retain that chance of at least one proc.";
  if (costNotice) for (const status of statuses) status.description += costNotice;
  return { comparison, weapon, stats, secondary: secondarySpecs(spec), status: statuses[0] ?? null, statuses };
}
