import { isElementType, type ElementType } from './arsenal';

export type StatusElement = Exclude<ElementType, 'kinetic'>;
export interface ActiveStatus {
  power: number;
  expiresAt: number;
  nextTickAt: number;
  stacks: number;
  frozenUntil: number;
}
export type StatusState = Partial<Record<StatusElement, ActiveStatus>>;
export interface StatusTick { damage: number; effect: StatusElement }
export interface StatusModifiers {
  moveSpeed: number;
  incomingDamage: number;
  shieldDamage: number;
  frozen: boolean;
  pull: boolean;
  chain: boolean;
  radiationPulse: boolean;
}

export const STATUS_TICK_INTERVAL = 0.5;
export interface ElementStatusInfo {
  readonly duration: number;
  /** Base damage per second divided by the proc's absolute power. */
  readonly dpsMultiplier: number;
  readonly moveSpeed: number;
  readonly incomingDamage: number;
  readonly shieldDamage: number;
  readonly freezeAfterProcs: number;
  readonly freezeDuration: number;
  readonly pull: boolean;
  readonly chain: boolean;
  readonly radiationPulse: boolean;
}

function statusInfo(values: Partial<ElementStatusInfo>): Readonly<ElementStatusInfo> {
  return Object.freeze({ duration: 0, dpsMultiplier: 0, moveSpeed: 1, incomingDamage: 1, shieldDamage: 1,
    freezeAfterProcs: 0, freezeDuration: 0, pull: false, chain: false, radiationPulse: false, ...values });
}

/** Combat, item cards and active-target readouts share these exact effect values. */
export const ELEMENT_STATUS: Readonly<Record<ElementType, Readonly<ElementStatusInfo>>> = Object.freeze({
  kinetic: statusInfo({}),
  fire: statusInfo({ duration: 4, dpsMultiplier: 1 }),
  ice: statusInfo({ duration: 3, moveSpeed: 0.55, freezeAfterProcs: 2, freezeDuration: 0.8 }),
  radiation: statusInfo({ duration: 5, dpsMultiplier: 0.75, radiationPulse: true }),
  gravity: statusInfo({ duration: 3, moveSpeed: 0.65, pull: true }),
  corrosive: statusInfo({ duration: 4, dpsMultiplier: 0.6, incomingDamage: 1.3 }),
  shock: statusInfo({ duration: 2, dpsMultiplier: 0.8, shieldDamage: 1.6, chain: true }),
  adhesive: statusInfo({ duration: 3, moveSpeed: 0.6 }),
});

export function getStatusDuration(element: ElementType): number {
  return isElementType(element) ? ELEMENT_STATUS[element].duration : 0;
}

export function getStatusDps(element: ElementType, power: number): number {
  return isElementType(element) && validPower(power) ? power * ELEMENT_STATUS[element].dpsMultiplier : 0;
}

function percentage(value: number): number { return Math.round(value * 100); }
export const elementEffectDescriptions: Readonly<Record<ElementType, string>> = Object.freeze({
  kinetic: 'Direct impact. Kinetic slugs, spikes and rockets stagger targets.',
  fire: `Burns for ${ELEMENT_STATUS.fire.duration} seconds, dealing damage every ${STATUS_TICK_INTERVAL} seconds.`,
  ice: `Slows movement to ${percentage(ELEMENT_STATUS.ice.moveSpeed)}% for ${ELEMENT_STATUS.ice.duration} seconds. A second proc freezes for ${ELEMENT_STATUS.ice.freezeDuration} seconds.`,
  radiation: `Deals damage every ${STATUS_TICK_INTERVAL} seconds for ${ELEMENT_STATUS.radiation.duration} seconds. Irradiated deaths pulse nearby targets.`,
  gravity: `Pulls toward the impact point and slows movement to ${percentage(ELEMENT_STATUS.gravity.moveSpeed)}% for ${ELEMENT_STATUS.gravity.duration} seconds.`,
  corrosive: `Acid damages every ${STATUS_TICK_INTERVAL} seconds for ${ELEMENT_STATUS.corrosive.duration} seconds and increases incoming damage by ${percentage(ELEMENT_STATUS.corrosive.incomingDamage - 1)}%.`,
  shock: `Deals electric damage every ${STATUS_TICK_INTERVAL} seconds for ${ELEMENT_STATUS.shock.duration} seconds. Increases shield damage by ${percentage(ELEMENT_STATUS.shock.shieldDamage - 1)}%. Procs chain damage to one nearby target.`,
  adhesive: `Slows movement to ${percentage(ELEMENT_STATUS.adhesive.moveSpeed)}% for ${ELEMENT_STATUS.adhesive.duration} seconds.`,
});

const elements = (Object.keys(ELEMENT_STATUS) as ElementType[]).filter((element): element is StatusElement => element !== 'kinetic');
const MAX_POWER = 1_000_000;
function validPower(power: number): boolean { return Number.isFinite(power) && power > 0 && power <= MAX_POWER; }
function validTime(now: number): boolean { return Number.isFinite(now) && now >= 0 && now <= Number.MAX_SAFE_INTEGER; }
function validStatus(status: ActiveStatus | undefined): status is ActiveStatus {
  return !!status && validPower(status.power)
    && validTime(status.expiresAt) && validTime(status.nextTickAt) && Number.isInteger(status.stacks) && status.stacks >= 1 && status.stacks <= 3
    && validTime(status.frozenUntil);
}
export function createStatusState(): StatusState { return {}; }

/** Refreshes duration without delaying the next tick or allowing weaker hits to erase stronger effects. */
export function applyStatus(state: StatusState, element: ElementType, now: number, power: number): boolean {
  if (!isElementType(element) || element === 'kinetic' || !validTime(now) || now > Number.MAX_SAFE_INTEGER - 10 || !validPower(power)) return false;
  const info = ELEMENT_STATUS[element];
  const previous = state[element];
  const active = validStatus(previous) && previous.expiresAt > now ? previous : undefined;
  const stacks = info.freezeAfterProcs > 0 ? Math.min(3, (active?.stacks ?? 0) + 1) : 1;
  state[element] = {
    power: Math.max(power, active?.power ?? 0),
    expiresAt: now + info.duration, nextTickAt: active?.nextTickAt ?? now + STATUS_TICK_INTERVAL,
    stacks, frozenUntil: info.freezeAfterProcs > 0 && stacks >= info.freezeAfterProcs ? now + info.freezeDuration : active?.frozenUntil ?? 0,
  };
  return true;
}

/** Catch-up ticks are aggregated by element; repeated updates at the same time cannot double-apply them. */
export function advanceStatuses(state: StatusState, now: number): StatusTick[] {
  if (!validTime(now)) return [];
  const ticks: StatusTick[] = [];
  for (const element of elements) {
    const status = state[element];
    if (!validStatus(status)) { delete state[element]; continue; }
    if (ELEMENT_STATUS[element].dpsMultiplier > 0) {
      const until = Math.min(now, status.expiresAt);
      // Non-binary start times (for example 0.1s) must retain the final expiry tick.
      const tolerance = Math.min(1e-7, Number.EPSILON * Math.max(1, Math.abs(until), Math.abs(status.nextTickAt)) * 4);
      if (until + tolerance >= status.nextTickAt) {
        const count = Math.floor((Math.max(0, until - status.nextTickAt) + tolerance) / STATUS_TICK_INTERVAL) + 1;
        const damage = Math.min(1_000_000_000, getStatusDps(element, status.power) * count * STATUS_TICK_INTERVAL);
        status.nextTickAt += count * STATUS_TICK_INTERVAL;
        if (damage > 0) ticks.push({ damage, effect: element });
      }
    }
    if (now >= status.expiresAt) delete state[element];
  }
  return ticks;
}

export function activeStatusElements(state: StatusState, now: number): StatusElement[] {
  if (!validTime(now)) return [];
  return elements.filter(element => validStatus(state[element]) && state[element]!.expiresAt > now);
}

export function getStatusModifiers(state: StatusState, now: number): StatusModifiers {
  const active = new Set(activeStatusElements(state, now));
  const frozen = active.has('ice') && state.ice!.frozenUntil > now;
  let moveSpeed = 1, incomingDamage = 1, shieldDamage = 1;
  let pull = false, chain = false, radiationPulse = false;
  for (const element of active) {
    const info = ELEMENT_STATUS[element];
    moveSpeed = Math.min(moveSpeed, info.moveSpeed);
    incomingDamage *= info.incomingDamage; shieldDamage *= info.shieldDamage;
    pull ||= info.pull; chain ||= info.chain; radiationPulse ||= info.radiationPulse;
  }
  return {
    moveSpeed: frozen ? 0 : moveSpeed,
    incomingDamage, shieldDamage, frozen, pull, chain, radiationPulse,
  };
}
