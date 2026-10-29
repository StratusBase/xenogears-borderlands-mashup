import { getStats, type Mode, type Progression } from '../core/index';
import type { EvaluationInput } from '../game';
import type { EncounterPhase, EnemyRole, Point2 } from '../encounter/contracts';
import { ENCOUNTER } from '../encounter/encounter';
import { createNavigationState, navigateEnemy, segmentClear, type NavigationBounds } from '../encounter/navigation';

export interface EncounterPolicySnapshot {
  readonly phase: EncounterPhase;
  readonly time: number;
  readonly paused: boolean;
  readonly mode: Mode;
  readonly position: Point2 & { y: number };
  readonly body: { health: number; shield: number; ammo: number; reserve: number; overheated: boolean };
  readonly enemies: readonly { id: number; position: Point2; health: number; shield: number; role: EnemyRole; boss: boolean; weakPointOpen: boolean }[];
  readonly defenses: readonly { id: string; x: number; z: number; radius: number; disabled: boolean }[];
  readonly progression: Progression;
  readonly navigation?: readonly NavigationBounds[];
  readonly parkedMech?: Point2;
}

export const ENCOUNTER_POLICY_VERSION = 'scripted-route-v1';
export interface EncounterPolicy {
  readonly version: typeof ENCOUNTER_POLICY_VERSION;
  readonly reason: string;
  input(snapshot: EncounterPolicySnapshot, dt?: number): EvaluationInput;
}

const worldBounds: NavigationBounds = { minX: -90, maxX: 90, minZ: -55, maxZ: 55 };
const distance = (a: Point2, b: Point2) => Math.hypot(a.x - b.x, a.z - b.z);

/** Ordinary scripted controls for the real Game loop. No teleporting, health edits,
 * aim-spread overrides, enemy edits, or encounter stage transitions are available.
 * One identical policy applies to every evaluated build, independent of its code.
 * Perfect body aiming makes this a simulated input check, never a hardware test.
 */
export function createEncounterPolicy(): EncounterPolicy {
  let reason = 'Waiting for encounter';
  let westGateVisited = false;
  let lastPhase: EncounterPhase | null = null;
  let cachedColliders: readonly NavigationBounds[] = [];
  const navigation = createNavigationState();

  return {
    version: ENCOUNTER_POLICY_VERSION,
    get reason() { return reason; },
    input(snapshot, dt = 1 / 60) {
      if (!Number.isFinite(dt) || dt <= 0 || dt > 0.25) throw new RangeError('Policy step must be in (0, 0.25].');
      const idle: EvaluationInput = { moveX: 0, moveY: 0, sprint: false, fire: false };
      if (snapshot.paused || snapshot.phase === 'idle' || snapshot.phase === 'complete' || snapshot.body.health <= 0) {
        reason = snapshot.paused ? 'Paused' : `Encounter ${snapshot.phase}`;
        return idle;
      }
      if (!snapshot.navigation) { reason = 'Waiting for navigation snapshot'; return idle; }
      // Snapshot arrays are defensive copies. Keep an immutable local copy so the
      // encounter navigator's visibility graph cache survives subsequent ticks.
      if (cachedColliders.length !== snapshot.navigation.length
        || snapshot.navigation.some((box, i) => !cachedColliders[i]
          || (['minX', 'maxX', 'minZ', 'maxZ'] as const).some(key => box[key] !== cachedColliders[i][key]))) {
        cachedColliders = snapshot.navigation.map(box => ({ ...box }));
        navigation.route = []; navigation.destination = null;
      }
      if (lastPhase !== snapshot.phase) {
        navigation.route = []; navigation.destination = null;
        if (snapshot.phase === 'infiltration') westGateVisited = snapshot.position.x < -32;
        lastPhase = snapshot.phase;
      }
      const stats = getStats(snapshot.progression, snapshot.mode);
      const heal = snapshot.body.health < stats.maxHealth * 0.65;
      const radius = snapshot.mode === 'pilot' ? 0.48 : 1.4;
      // These match zone access while retaining a conservative footprint margin.
      const bounds = snapshot.mode === 'pilot' ? { ...worldBounds, maxX: 35 } : { ...worldBounds, minX: -35 };

      function aim(point: Point2, height: number): Pick<EvaluationInput, 'yaw' | 'pitch'> {
        const dx = point.x - snapshot.position.x, dz = point.z - snapshot.position.z;
        return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(height - snapshot.position.y, Math.hypot(dx, dz)) };
      }
      function walk(destination: Point2, facing?: Pick<EvaluationInput, 'yaw' | 'pitch'>, sprint = false): EvaluationInput {
        const look = facing ?? aim(destination, snapshot.position.y);
        const speed = stats.moveSpeed * (sprint ? 1.55 : 1);
        const next = navigateEnemy(snapshot.position, destination, speed, dt, radius, cachedColliders, bounds, navigation);
        const dx = (next.x - snapshot.position.x) / (speed * dt), dz = (next.z - snapshot.position.z) / (speed * dt);
        const yaw = look.yaw ?? 0;
        // Inverse of the game's local-to-world yaw transform.
        return { ...idle, ...look, moveX: Math.cos(yaw) * dx - Math.sin(yaw) * dz,
          moveY: Math.sin(yaw) * dx + Math.cos(yaw) * dz, sprint, heal };
      }

      if (snapshot.phase === 'infiltration' && !westGateVisited) {
        if (distance(snapshot.position, ENCOUNTER.boarding) < 2 || snapshot.position.x < -32) westGateVisited = true;
        else { reason = 'Pilot route to west gate'; return walk(ENCOUNTER.boarding, undefined, true); }
      }
      if (snapshot.phase === 'defenses') {
        const relay = [...snapshot.defenses].filter(entry => !entry.disabled)
          .sort((a, b) => distance(a, snapshot.position) - distance(b, snapshot.position) || a.id.localeCompare(b.id))[0];
        if (!relay) { reason = 'Waiting for relay stage transition'; return { ...idle, heal }; }
        reason = `Disable ${relay.id}`;
        if (distance(snapshot.position, relay) <= relay.radius - 0.35) return { ...idle, ...aim(relay, 1.4), interact: true, heal };
        return walk(relay, undefined, true);
      }
      if (snapshot.phase === 'boarding') {
        if (snapshot.mode === 'pilot') {
          const frame = snapshot.parkedMech ?? ENCOUNTER.boarding;
          reason = 'Return through west gate and board frame';
          if (distance(snapshot.position, frame) < 3) return { ...idle, switchMode: true, heal };
          return walk(frame, undefined, true);
        }
        reason = 'Mech route through east gate';
        return walk(ENCOUNTER.battleEntry, undefined, true);
      }
      if (snapshot.phase === 'loot') {
        reason = 'Aim at and collect encounter salvage';
        const look = aim(ENCOUNTER.reward, 0.95);
        if (distance(snapshot.position, ENCOUNTER.reward) < 5) return { ...idle, ...look, interact: true, heal };
        return walk(ENCOUNTER.reward, look);
      }
      const enemy = [...snapshot.enemies].filter(entry => entry.health > 0)
        .sort((a, b) => distance(a.position, snapshot.position) - distance(b.position, snapshot.position) || a.id - b.id)[0];
      if (!enemy) { reason = 'Waiting for enemy wave'; return { ...idle, heal }; }
      const look = aim(enemy.position, enemy.role === 'heavy' ? 2.7 : 1.5);
      const range = distance(snapshot.position, enemy.position);
      const visible = segmentClear(snapshot.position, enemy.position, 0, cachedColliders, worldBounds);
      const fire = range <= 18 && visible;
      let destination = enemy.position;
      if (fire && range >= 8 && range <= 15) {
        // Alternate a short lateral strafe; collision routing still owns every step.
        const side = Math.floor(snapshot.time / 2.5) % 2 ? 1 : -1;
        const dx = (enemy.position.x - snapshot.position.x) / Math.max(range, 0.001);
        const dz = (enemy.position.z - snapshot.position.z) / Math.max(range, 0.001);
        destination = { x: snapshot.position.x - dz * side * 3, z: snapshot.position.z + dx * side * 3 };
      } else if (fire && range < 8) {
        const scale = 4 / Math.max(range, 0.01);
        destination = { x: snapshot.position.x + (snapshot.position.x - enemy.position.x) * scale,
          z: snapshot.position.z + (snapshot.position.z - enemy.position.z) * scale };
      }
      reason = `${visible ? 'Engage' : 'Route around cover to'} ${enemy.role} ${enemy.id} (${range.toFixed(1)} m)`;
      const movement = walk(destination, look);
      return { ...movement, fire, ability: snapshot.mode === 'mech' && range < 12 && visible };
    },
  };
}
