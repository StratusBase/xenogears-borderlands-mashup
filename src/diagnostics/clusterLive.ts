/** Controlled actual-Game diagnostics. These choices never change ordinary gameplay. */
import type { EvaluationInput, EvaluationShot, EvaluationProc, Game } from '../game';
import { getStats, rollItem, seededRandom, type Item, type Mode } from '../core/index';
import { createWeaponSpec, type ElementType } from '../core/arsenal';
import { createEvaluationFixture } from './fixtures';
import { CombatMeasurement, type MeasurementEvent, type MeasurementSnapshot } from './measurement';
import { segmentClear, type NavigationBounds } from '../encounter/navigation';

export const CLUSTER_LIVE_PROTOCOL = 'cluster-live-encounter-v1';
export const CLUSTER_LIVE_POLICY = 'scripted-route-v1/offensive-ability-disabled';
export const CLUSTER_LIVE_STEP = 1 / 60;
export const CLUSTER_LIVE_TIMEOUT = 480;
export const CLUSTER_LIVE_SEEDS = [7, 8, 41] as const;
export const CLUSTER_LIVE_DELIVERIES = ['cluster', 'rocket', 'scatter'] as const;
export const CLUSTER_LIVE_PAYLOADS = ['kinetic', 'corrosive-fire', 'ice'] as const;
export type ClusterLiveDelivery = typeof CLUSTER_LIVE_DELIVERIES[number];
export type ClusterLivePayload = typeof CLUSTER_LIVE_PAYLOADS[number];
export type ClusterLiveArm = 'baseline' | 'final';
export interface ClusterLiveJob { fixtureSource: 'workbench' | 'loot'; arm: ClusterLiveArm; delivery: ClusterLiveDelivery; payload: ClusterLivePayload; seed: number }
export type ClusterLiveSnapshot = ReturnType<Game['getEncounterSnapshot']>;
export type ClusterLiveContext = 'grouped' | 'spread' | 'covered' | 'none';
export interface ClusterLiveForm {
  elapsedSeconds: number; combatSeconds: number; aliveEnemySeconds: number; frozenEnemySeconds: number; slowedEnemySeconds: number;
  attackEvents: number; successfulProcs: Record<string, number>; shots: number; ammo: number; directDamage: number; statusDamage: number; abilityDamage: number;
  receivedHealth: number; receivedShield: number; kills: number; heatBlockedSeconds: number; reloadSeconds: number;
  contexts: Record<ClusterLiveContext, { seconds: number; shots: number }>;
}
export interface ClusterLiveLaunch extends EvaluationShot {
  context: ClusterLiveContext; enemyCount: number; targetId: number | null; range: number | null; nearbyEnemies: number;
}
export interface ClusterLiveEvidence {
  protocol: typeof CLUSTER_LIVE_PROTOCOL; job: ClusterLiveJob; sourceFingerprint: string;
  measurement: MeasurementSnapshot; events: MeasurementEvent[]; eventModes: Mode[]; inputs: EvaluationInput[];
  launches: ClusterLiveLaunch[]; procs: EvaluationProc[]; forms: Record<Mode, ClusterLiveForm>; encounter: ClusterLiveSnapshot;
  encounterEvents: { at: number; event: unknown }[]; initialEquipment: Record<Mode, Item[]>;
  droppedTraceEvents: number; skippedDummyEvents: number; hardwareStatus: 'NOT RUN';
  controls: typeof CLUSTER_LIVE_POLICY; frameCount: number; renderedFrames: number;
  technicalInterruption?: { reason: string; at: number; frameCount: number; expectedSeconds: number; actualSeconds: number };
  limitations: string[];
}
export const clusterClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export const clusterCanonical = (value: unknown): string => JSON.stringify(value, (_key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
  ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);
export function clusterLiveJobs(arm: ClusterLiveArm): ClusterLiveJob[] {
  return [
    ...CLUSTER_LIVE_DELIVERIES.flatMap(delivery => CLUSTER_LIVE_PAYLOADS.flatMap(payload => CLUSTER_LIVE_SEEDS.map(seed => ({ arm, delivery, payload, seed, fixtureSource: 'workbench' as const })))),
    ...CLUSTER_LIVE_DELIVERIES.flatMap(delivery => CLUSTER_LIVE_SEEDS.map(seed => ({ arm, delivery, payload: 'corrosive-fire' as const, seed, fixtureSource: 'loot' as const }))),
  ];
}
export function clusterLiveFixture(job: Pick<ClusterLiveJob, 'delivery' | 'payload' | 'fixtureSource'>) {
  const element: ElementType = job.payload === 'corrosive-fire' ? 'corrosive' : job.payload;
  const controls = { brand: 'ironvale' as const, weaponType: 'launcher' as const, projectile: job.delivery, element,
    secondaryElement: job.payload === 'corrosive-fire' ? 'fire' as const : 'none' as const,
    affix: 'standard' as const, level: 5, rarity: 'rare' as const, trail: 'tracer' as const, guaranteedStatus: false };
  const fixture = createEvaluationFixture('heavy-control', { pilot: controls, mech: controls });
  if (job.fixtureSource === 'loot') {
    for (const mode of ['pilot', 'mech'] as const) {
      const spec = createWeaponSpec(job.delivery, 'corrosive', mode); spec.secondaryElement = 'fire'; spec.weaponType = 'launcher';
      // Seed2 produces an ordinary rare Rapid weapon. Independent of encounter/proc seed and delivery.
      const weapon = rollItem(mode, 5, seededRandom(2), 'weapon', { brand: 'ironvale', weapon: spec });
      if (weapon.rarity !== 'rare') throw new Error('Frozen ordinary-loot stat seed no longer produces rare gear.');
      const old = fixture.equipment[mode].find(item => item.slot === 'weapon')!; weapon.id = old.id;
      fixture.state.inventory[fixture.state.inventory.findIndex(item => item.id === old.id)] = weapon;
      fixture.equipment[mode][fixture.equipment[mode].findIndex(item => item.slot === 'weapon')] = weapon;
      fixture.stats[mode] = getStats(fixture.state, mode);
    }
  }
  return fixture;
}
export function emptyClusterLiveForm(): ClusterLiveForm {
  return { elapsedSeconds: 0, combatSeconds: 0, aliveEnemySeconds: 0, frozenEnemySeconds: 0, slowedEnemySeconds: 0,
    attackEvents: 0, successfulProcs: {}, shots: 0, ammo: 0, directDamage: 0, statusDamage: 0, abilityDamage: 0, receivedHealth: 0, receivedShield: 0,
    kills: 0, heatBlockedSeconds: 0, reloadSeconds: 0, contexts: { grouped: { seconds: 0, shots: 0 }, spread: { seconds: 0, shots: 0 }, covered: { seconds: 0, shots: 0 }, none: { seconds: 0, shots: 0 } } };
}
const worldBounds: NavigationBounds = { minX: -90, maxX: 90, minZ: -55, maxZ: 55 };
export function clusterLiveContext(snapshot: ClusterLiveSnapshot, aimPoint?: { x: number; z: number }) {
  const alive = snapshot.enemies.filter(enemy => enemy.health > 0);
  const anchor = aimPoint ?? snapshot.position;
  const target = [...alive].sort((a, b) => Math.hypot(a.position.x - anchor.x, a.position.z - anchor.z) - Math.hypot(b.position.x - anchor.x, b.position.z - anchor.z) || a.id - b.id)[0];
  if (!target) return { context: 'none' as const, enemyCount: 0, targetId: null, range: null, nearbyEnemies: 0 };
  const range = Math.hypot(target.position.x - snapshot.position.x, target.position.z - snapshot.position.z);
  // Identical reference radius across all three delivery arms, independent of weapon tuning.
  const radius = snapshot.mode === 'pilot' ? 2.2 : 3.2;
  const nearbyEnemies = alive.filter(enemy => enemy.id !== target.id && Math.hypot(enemy.position.x - target.position.x, enemy.position.z - target.position.z) <= radius).length;
  const visible = segmentClear(snapshot.position, target.position, 0, snapshot.navigation ?? [], worldBounds);
  return { context: !visible ? 'covered' as const : nearbyEnemies ? 'grouped' as const : 'spread' as const, enemyCount: alive.length, targetId: target.id, range, nearbyEnemies };
}
export function recordClusterLiveEvent(form: ClusterLiveForm, event: MeasurementEvent): void {
  if (event.type === 'shot') { form.shots++; form.ammo += event.ammo; }
  if (event.type === 'damage') {
    const amount = event.health + event.shield;
    if (event.source === 'direct') form.directDamage += amount;
    if (event.source === 'status') form.statusDamage += amount;
    if (event.source === 'ability') form.abilityDamage += amount;
  }
  if (event.type === 'received') { form.receivedHealth += event.health; form.receivedShield += event.shield; }
  if (event.type === 'target-killed') form.kills++;
  if (event.type === 'interval') { if (event.heatBlocked) form.heatBlockedSeconds += event.dt; if (event.reloading) form.reloadSeconds += event.dt; }
}
/** A menu interruption is a technical disposition, never a weapon balance failure. */
export function clusterLiveClockIssue(evidence: ClusterLiveEvidence): string | null {
  if (!Number.isInteger(evidence.frameCount) || evidence.frameCount < 0 || !Number.isFinite(evidence.measurement?.duration)) return 'Invalid frame or simulation-clock evidence.';
  const expected = evidence.frameCount * CLUSTER_LIVE_STEP, actual = evidence.measurement.duration;
  // Reward collection may finish in driveEvaluation before that final input's step.
  if (Math.abs(expected - actual) > CLUSTER_LIVE_STEP + 1e-6)
    return `Fixed60Hz clock mismatch: ${evidence.frameCount} frames expect ${expected.toFixed(6)}s; measurement saved ${actual.toFixed(6)}s${evidence.encounter?.paused ? '; final Game snapshot is paused' : ''}.`;
  if (Math.abs(evidence.encounter.time - actual) > CLUSTER_LIVE_STEP + 1e-6) return 'Final Game time differs from the measurement clock.';
  return null;
}
export function validateClusterLiveEvidence(value: unknown, options: { allowClockIssue?: boolean } = {}): ClusterLiveEvidence {
  const evidence = value as ClusterLiveEvidence;
  function requireThat(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
  requireThat(evidence && evidence.protocol === CLUSTER_LIVE_PROTOCOL, 'Unknown live comparison protocol.');
  const job = evidence.job;
  requireThat(job && ['workbench', 'loot'].includes(job.fixtureSource) && ['baseline', 'final'].includes(job.arm) && CLUSTER_LIVE_DELIVERIES.includes(job.delivery) && CLUSTER_LIVE_PAYLOADS.includes(job.payload) && CLUSTER_LIVE_SEEDS.some(seed => seed === job.seed), 'Unknown matrix cell.');
  requireThat(/^sha256:[a-f0-9]{64}$/.test(evidence.sourceFingerprint) && evidence.measurement.metadata.sourceFingerprint === evidence.sourceFingerprint, 'Missing or mismatched source fingerprint.');
  requireThat(evidence.hardwareStatus === 'NOT RUN' && evidence.controls === CLUSTER_LIVE_POLICY && evidence.droppedTraceEvents === 0 && evidence.measurement.rejectedEvents === 0, 'Invalid control attestation or dropped/rejected events.');
  if (!options.allowClockIssue) requireThat(!clusterLiveClockIssue(evidence), clusterLiveClockIssue(evidence) ?? 'Invalid simulation clock.');
  const metadata = evidence.measurement.metadata;
  requireThat(metadata.protocol === CLUSTER_LIVE_PROTOCOL && metadata.scenario === 'encounter' && metadata.provenance === 'simulated' && metadata.seed === job.seed && metadata.buildId === `${job.fixtureSource}/${job.delivery}/${job.payload}` && metadata.runId === `cluster-live-${job.arm}-${job.fixtureSource}-${job.delivery}-${job.payload}-${job.seed}-1`, 'Measurement metadata differs from its matrix cell.');
  requireThat(['complete', 'failed', 'timeout', 'aborted'].includes(evidence.measurement.outcome ?? ''), 'Every attempt must retain a finished outcome.');
  requireThat(Array.isArray(evidence.events) && evidence.events.length > 0 && evidence.events.length < 100_000 && evidence.events.length === evidence.eventModes.length, 'Missing, capped or unlabelled event trace.');
  const replay = new CombatMeasurement(metadata);
  requireThat(evidence.events.every(event => replay.record(event)) && clusterCanonical(replay.snapshot()) === clusterCanonical(evidence.measurement), 'Event replay does not reproduce the saved measurement.');
  requireThat(evidence.inputs.length === evidence.frameCount && evidence.inputs.every(input => !input.ability), 'Input trace is incomplete or uses offensive abilities.');
  requireThat(evidence.launches.length === evidence.measurement.shots.total && evidence.measurement.ammo.total === evidence.measurement.shots.total, 'Launch trace or one-round-per-trigger accounting differs.');
  requireThat(evidence.measurement.damage.ability === 0, 'Offensive ability damage contaminated the weapon comparison.');
  requireThat(clusterCanonical(metadata.equipment) === clusterCanonical(evidence.initialEquipment), 'Starting equipment differs from the measurement metadata.');
  for (const mode of ['pilot', 'mech'] as const) {
    const initial = evidence.initialEquipment[mode];
    requireThat(initial.length === 4 && initial.every(item => ['weapon', 'shield', 'reactor', 'legs'].includes(item.slot)), 'Incomplete starting equipment.');
    requireThat(initial.every(item => clusterCanonical(evidence.encounter.progression.inventory.find(saved => saved.id === item.id)) === clusterCanonical(item)), 'Equipped fixture items were modified during the live run.');
    const expected = emptyClusterLiveForm();
    evidence.events.forEach((event, index) => { if (evidence.eventModes[index] === mode) recordClusterLiveEvent(expected, event); });
    for (const key of ['shots', 'ammo', 'directDamage', 'statusDamage', 'abilityDamage', 'receivedHealth', 'receivedShield', 'kills', 'heatBlockedSeconds', 'reloadSeconds'] as const)
      requireThat(Math.abs(expected[key] - evidence.forms[mode][key]) < 1e-6, `Per-form ${key} does not replay.`);
    requireThat(evidence.forms[mode].frozenEnemySeconds <= evidence.forms[mode].aliveEnemySeconds + 1e-6 && evidence.forms[mode].slowedEnemySeconds <= evidence.forms[mode].aliveEnemySeconds + 1e-6, 'Control uptime exceeds living enemy exposure.');
    const procCounts: Record<string, number> = {};
    for (const proc of evidence.procs.filter(proc => proc.mode === mode)) {
      requireThat(proc.projectile === job.delivery && proc.power > 0 && proc.chance >= 0 && proc.chance <= 1, 'Invalid successful status event.');
      procCounts[proc.element] = (procCounts[proc.element] ?? 0) + 1;
    }
    requireThat(clusterCanonical(procCounts) === clusterCanonical(evidence.forms[mode].successfulProcs), 'Successful status counts do not replay.');
    const weapon = initial.find(item => item.slot === 'weapon')!;
    requireThat(weapon.weapon?.projectile === job.delivery && weapon.weapon?.weaponType === 'launcher' && weapon.brand === 'ironvale', 'Delivery comparison changed its controlled receiver/manufacturer.');
    requireThat(weapon.weapon.element === (job.payload === 'corrosive-fire' ? 'corrosive' : job.payload) && weapon.weapon.secondaryElement === (job.payload === 'corrosive-fire' ? 'fire' : undefined), 'Saved independent payload differs from the selected comparison.');
    requireThat(evidence.launches.filter(launch => launch.mode === mode).every(launch => clusterCanonical(launch.spec) === clusterCanonical(weapon.weapon)), 'Fired specification differs from the starting saved weapon.');
  }
  if (evidence.measurement.outcome === 'complete') {
    requireThat(evidence.encounter.phase === 'complete' && evidence.encounter.enemies.length === 0 && evidence.encounter.disabledRelays.length === 2 && evidence.encounter.run === 1, 'A complete attempt must finish both relays, hostiles and reward on its first run.');
    const vitality = evidence.events.reduce((sum, event) => sum + (event.type === 'target-spawn' ? event.health + event.shield : 0), 0);
    requireThat(Math.abs(vitality - evidence.measurement.damage.total) < 1e-5, 'Applied damage does not reconcile to the spawned health plus shields.');
  }
  return evidence;
}
export function clusterLiveSummary(evidence: ClusterLiveEvidence) {
  return { job: evidence.job, sourceFingerprint: evidence.sourceFingerprint, outcome: evidence.measurement.outcome, seconds: evidence.measurement.duration,
    damage: evidence.measurement.damage, ammo: evidence.measurement.ammo, kills: evidence.measurement.kills, received: evidence.measurement.received,
    forms: evidence.forms, frameCount: evidence.frameCount, launches: evidence.launches.length, rejectedEvents: evidence.measurement.rejectedEvents,
    droppedTraceEvents: evidence.droppedTraceEvents, hardwareStatus: evidence.hardwareStatus };
}
