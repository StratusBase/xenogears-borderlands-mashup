/** Measurement only: callers report actual damage removed and simulation time.
 * No gameplay defaults, balance constants, wall clock, or random draws live here.
 */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type MeasurementScenario = 'dummy' | 'encounter';
export type MeasurementProvenance = 'simulated' | 'browser' | 'hardware';
export type MeasurementOutcome = 'complete' | 'failed' | 'timeout' | 'aborted';

export interface MeasurementMetadata {
  runId: string;
  scenario: MeasurementScenario;
  provenance: MeasurementProvenance;
  seed: number;
  buildId: string;
  buildCodes: { pilot: string; mech: string };
  /** Full encounter/fixture version and controls, not just the seed. */
  configuration: JsonValue;
  /** Exact equipped items/stat snapshot; WS1 only describes the weapons. */
  equipment: JsonValue;
  sourceFingerprint: string;
  protocol: string;
}

export type MeasurementEvent =
  | { type: 'target-spawn'; at: number; targetId: string; health: number; shield: number }
  | { type: 'damage'; at: number; targetId: string; target: 'dummy' | 'enemy'; health: number; shield: number; source: 'direct' | 'status' | 'ability'; critical?: boolean }
  | { type: 'target-killed'; at: number; targetId: string }
  | { type: 'received'; at: number; health: number; shield: number }
  | { type: 'shot'; at: number; mode: 'pilot' | 'mech'; ammo: number }
  /** Interval ending at `at`. Menus/paused frames must not produce intervals. */
  | { type: 'interval'; at: number; dt: number; heatBlocked: boolean; reloading: boolean }
  | { type: 'finish'; at: number; outcome: MeasurementOutcome };

export interface TargetMeasurement {
  targetId: string;
  spawnedAt: number | null;
  firstDamageAt: number | null;
  killedAt: number | null;
  damage: number;
  /** Null for the permanent dummy, surviving targets, or missing spawn data. */
  ttkFromSpawn: number | null;
  ttkFromFirstDamage: number | null;
}

export interface MeasurementSnapshot {
  metadata: MeasurementMetadata;
  duration: number;
  damage: { total: number; health: number; shield: number; direct: number; status: number; ability: number; critical: number };
  /** Accepted damage / elapsed active simulation seconds, including reload/heat. */
  practicalDps: number;
  received: { health: number; shield: number; total: number };
  ammo: { pilot: number; mech: number; total: number };
  shots: { pilot: number; mech: number; total: number };
  heatBlockedSeconds: number;
  reloadSeconds: number;
  targets: TargetMeasurement[];
  kills: number;
  outcome: MeasurementOutcome | null;
  rejectedEvents: number;
}

export const MEASUREMENT_TARGET_LIMIT = 1024;
const MAX_VALUE = Number.MAX_SAFE_INTEGER;
const MAX_METADATA_LENGTH = 131_072;
const outcomes: readonly MeasurementOutcome[] = ['complete', 'failed', 'timeout', 'aborted'];
const validId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 512;
const bounded = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_VALUE;
const sumValid = (...values: number[]): boolean => bounded(values.reduce((total, value) => total + value, 0));
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function isJson(value: unknown, depth = 0): value is JsonValue {
  if (depth > 24) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 4096 && value.every(entry => isJson(entry, depth + 1));
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const entries = Object.entries(value);
  return entries.length <= 4096 && entries.every(([, entry]) => isJson(entry, depth + 1));
}

function metadataCopy(metadata: MeasurementMetadata): MeasurementMetadata {
  if (!metadata || !validId(metadata.runId) || !validId(metadata.buildId) || !validId(metadata.sourceFingerprint) || !validId(metadata.protocol)
    || !['dummy', 'encounter'].includes(metadata.scenario) || !['simulated', 'browser', 'hardware'].includes(metadata.provenance)
    || !Number.isInteger(metadata.seed) || metadata.seed < 0 || metadata.seed > 0xffff_ffff
    || !metadata.buildCodes || !validId(metadata.buildCodes.pilot) || !validId(metadata.buildCodes.mech)
    || !isJson(metadata.configuration) || !isJson(metadata.equipment)) throw new TypeError('Invalid evaluation metadata');
  const serialized = JSON.stringify(metadata);
  if (serialized.length > MAX_METADATA_LENGTH) throw new TypeError('Evaluation metadata exceeds size limit');
  return JSON.parse(serialized) as MeasurementMetadata;
}

/** Bounded aggregate recorder. No per-shot history is retained. A full run must
 * fit 1024 distinct targets; overflow rejects explicitly instead of silently
 * dropping earlier TTK evidence. A run clock starts at zero, before first fire.
 */
export class CombatMeasurement {
  private readonly metadata: MeasurementMetadata;
  private readonly targets = new Map<string, TargetMeasurement>();
  private at = 0;
  private lastIntervalEnd = 0;
  private damage = { total: 0, health: 0, shield: 0, direct: 0, status: 0, ability: 0, critical: 0 };
  private received = { health: 0, shield: 0, total: 0 };
  private ammo = { pilot: 0, mech: 0, total: 0 };
  private shots = { pilot: 0, mech: 0, total: 0 };
  private heatBlockedSeconds = 0;
  private reloadSeconds = 0;
  private kills = 0;
  private outcome: MeasurementOutcome | null = null;
  private rejectedEvents = 0;

  constructor(metadata: MeasurementMetadata) { this.metadata = metadataCopy(metadata); }

  record(event: MeasurementEvent): boolean {
    if (!event || typeof event !== 'object' || this.outcome !== null || !bounded(event.at) || event.at < this.at) return this.reject();
    switch (event.type) {
      case 'target-spawn': {
        if (!validId(event.targetId) || !bounded(event.health) || !bounded(event.shield) || !sumValid(event.health, event.shield)
          || this.targets.has(event.targetId) || this.targets.size >= MEASUREMENT_TARGET_LIMIT) return this.reject();
        this.targets.set(event.targetId, { targetId: event.targetId, spawnedAt: event.at, firstDamageAt: null,
          killedAt: null, damage: 0, ttkFromSpawn: null, ttkFromFirstDamage: null });
        break;
      }
      case 'damage': {
        if (!validId(event.targetId) || event.target !== (this.metadata.scenario === 'dummy' ? 'dummy' : 'enemy')
          || !bounded(event.health) || !bounded(event.shield) || !['direct', 'status', 'ability'].includes(event.source)
          || (event.critical !== undefined && typeof event.critical !== 'boolean')) return this.reject();
        const amount = event.health + event.shield;
        const target = this.targets.get(event.targetId);
        if (amount <= 0 || !sumValid(this.damage.total, amount) || (target?.killedAt !== null && target?.killedAt !== undefined)
          || (!target && this.targets.size >= MEASUREMENT_TARGET_LIMIT)) return this.reject();
        const entry = target ?? { targetId: event.targetId, spawnedAt: null, firstDamageAt: null, killedAt: null,
          damage: 0, ttkFromSpawn: null, ttkFromFirstDamage: null };
        entry.firstDamageAt ??= event.at;
        entry.damage += amount;
        this.targets.set(event.targetId, entry);
        this.damage.total += amount;
        this.damage.health += event.health;
        this.damage.shield += event.shield;
        this.damage[event.source] += amount;
        if (event.source === 'direct' && event.critical) this.damage.critical += amount;
        break;
      }
      case 'target-killed': {
        const target = this.targets.get(event.targetId);
        if (this.metadata.scenario === 'dummy' || !target || target.killedAt !== null) return this.reject();
        target.killedAt = event.at;
        target.ttkFromSpawn = target.spawnedAt === null ? null : event.at - target.spawnedAt;
        target.ttkFromFirstDamage = target.firstDamageAt === null ? null : event.at - target.firstDamageAt;
        this.kills++;
        break;
      }
      case 'received': {
        if (!bounded(event.health) || !bounded(event.shield) || !sumValid(this.received.total, event.health, event.shield)) return this.reject();
        this.received.health += event.health;
        this.received.shield += event.shield;
        this.received.total += event.health + event.shield;
        break;
      }
      case 'shot': {
        if (!['pilot', 'mech'].includes(event.mode) || !bounded(event.ammo) || !Number.isInteger(event.ammo)
          || !sumValid(this.ammo.total, event.ammo) || !sumValid(this.shots.total, 1)) return this.reject();
        this.ammo[event.mode] += event.ammo;
        this.ammo.total += event.ammo;
        this.shots[event.mode]++;
        this.shots.total++;
        break;
      }
      case 'interval': {
        if (!bounded(event.dt) || event.dt > event.at || event.at - event.dt < this.lastIntervalEnd - 1e-9
          || typeof event.heatBlocked !== 'boolean' || typeof event.reloading !== 'boolean'
          || !sumValid(this.heatBlockedSeconds, event.heatBlocked ? event.dt : 0)
          || !sumValid(this.reloadSeconds, event.reloading ? event.dt : 0)) return this.reject();
        if (event.heatBlocked) this.heatBlockedSeconds += event.dt;
        if (event.reloading) this.reloadSeconds += event.dt;
        this.lastIntervalEnd = event.at;
        break;
      }
      case 'finish': {
        if (!outcomes.includes(event.outcome)) return this.reject();
        this.outcome = event.outcome;
        break;
      }
      default: return this.reject();
    }
    this.at = event.at;
    return true;
  }

  /** Detached snapshots may be annotated/exported without changing the recorder. */
  snapshot(): MeasurementSnapshot {
    return clone({ metadata: this.metadata, duration: this.at, damage: this.damage,
      practicalDps: this.at > 0 ? this.damage.total / this.at : 0,
      received: this.received, ammo: this.ammo, shots: this.shots,
      heatBlockedSeconds: this.heatBlockedSeconds, reloadSeconds: this.reloadSeconds,
      targets: [...this.targets.values()], kills: this.kills, outcome: this.outcome, rejectedEvents: this.rejectedEvents });
  }

  toJSON(): MeasurementSnapshot { return this.snapshot(); }

  private reject(): false {
    this.rejectedEvents = Math.min(MAX_VALUE, this.rejectedEvents + 1);
    return false;
  }
}
