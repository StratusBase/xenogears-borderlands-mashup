import { damagePalette, type DamageEffect } from './feedback';

export const TEST_DUMMY_DPS_WINDOW = 5;
export const TEST_DUMMY_SAMPLE_INTERVAL = 0.01;
export const TEST_DUMMY_HISTORY_LIMIT = 512;
const WINDOW_SAMPLES = Math.round(TEST_DUMMY_DPS_WINDOW / TEST_DUMMY_SAMPLE_INTERVAL);

export interface TestDummySnapshot {
  total: number;
  lastHit: number;
  /** All accepted damage events, including elemental ticks. */
  hitCount: number;
  /** Trailing five-second damage / five seconds, sampled at 10 ms resolution. */
  dps: number;
  latestCritical: boolean;
  latestEffect: DamageEffect | null;
  secondsSinceHit: number | null;
  directTotal: number;
  statusTotal: number;
  /** Direct critical damage only; elemental ticks retain their own identity. */
  criticalTotal: number;
}

function validEffect(effect: unknown): effect is DamageEffect {
  return typeof effect === 'string' && effect !== 'normal' && effect !== 'critical' && Object.hasOwn(damagePalette, effect);
}

function timeSample(now: number): number | null {
  if (!Number.isFinite(now) || now < 0) return null;
  const sample = Math.floor(now / TEST_DUMMY_SAMPLE_INTERVAL);
  return Number.isSafeInteger(sample) ? sample : null;
}

/** Accounting for an immortal fixture, independent of health, rewards and progression.
 * The caller supplies simulation time, so paused menus cannot age the damage window.
 * Aggregation keeps sustained scatter fire bounded without discarding damage events.
 */
export class TestDummyMeter {
  private readonly samples = new Map<number, number>();
  private total = 0;
  private directTotal = 0;
  private statusTotal = 0;
  private criticalTotal = 0;
  private lastHit = 0;
  private hitCount = 0;
  private lastAt: number | null = null;
  private latestCritical = false;
  private latestEffect: DamageEffect | null = null;

  /** Useful for asserting or profiling the recorder's constant memory budget. */
  get retainedSampleCount(): number { return this.samples.size; }

  record(damage: number, now: number, critical = false, effect?: DamageEffect): boolean {
    const sample = timeSample(now);
    if (!Number.isFinite(damage) || damage <= 0 || sample === null || typeof critical !== 'boolean'
      || (effect !== undefined && !validEffect(effect)) || (this.lastAt !== null && now < this.lastAt)
      || !Number.isFinite(this.total + damage) || this.hitCount >= Number.MAX_SAFE_INTEGER) return false;
    const firstSample = sample - WINDOW_SAMPLES + 1;
    for (const index of this.samples.keys()) if (index < firstSample) this.samples.delete(index);
    this.samples.set(sample, (this.samples.get(sample) ?? 0) + damage);
    this.total += damage;
    if (effect) this.statusTotal += damage;
    else {
      this.directTotal += damage;
      if (critical) this.criticalTotal += damage;
    }
    this.lastHit = damage;
    this.hitCount++;
    this.lastAt = now;
    this.latestEffect = effect ?? null;
    this.latestCritical = !effect && critical;
    return true;
  }

  snapshot(now: number): TestDummySnapshot {
    // Invalid/rewound observations cannot invent a different simulation clock.
    const time = timeSample(now) === null ? this.lastAt ?? 0 : Math.max(now, this.lastAt ?? 0);
    const sample = timeSample(time)!;
    const firstSample = sample - WINDOW_SAMPLES + 1;
    let recentDamage = 0;
    for (const [index, damage] of this.samples) if (index >= firstSample && index <= sample) recentDamage += damage;
    return {
      total: this.total, lastHit: this.lastHit, hitCount: this.hitCount,
      dps: recentDamage / TEST_DUMMY_DPS_WINDOW,
      latestCritical: this.latestCritical, latestEffect: this.latestEffect,
      secondsSinceHit: this.lastAt === null ? null : time - this.lastAt,
      directTotal: this.directTotal, statusTotal: this.statusTotal, criticalTotal: this.criticalTotal,
    };
  }

  clear(): void {
    this.samples.clear();
    this.total = this.directTotal = this.statusTotal = this.criticalTotal = this.lastHit = this.hitCount = 0;
    this.lastAt = null; this.latestCritical = false; this.latestEffect = null;
  }
}
