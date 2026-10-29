import type { Mode } from '../core/index';
import type { EncounterEvent, EncounterPhase, EnemyRole, Point2 } from './contracts';

export interface EnemySpawn extends Point2 {
  readonly id: string;
  readonly role: EnemyRole;
  readonly boss: boolean;
  readonly health: number;
  readonly shield: number;
}
export interface RelayDefinition extends Point2 { readonly id: string; readonly radius: number; readonly name: string }

/** Fixed spaces and bounded waves; no narrative state and no save-schema changes. */
export const ENCOUNTER = Object.freeze({
  name: 'BREACH / BREAK / SALVAGE',
  recommendedSeconds: [180, 300] as const,
  /** Versioned active-combat budget. Groups advance on kills, never on a clock. */
  version: 'relay-break-v3',
  vitalityScale: 1.3,
  battleGroups: 6,
  relays: Object.freeze([
    Object.freeze({ id: 'vault-relay-a', name: 'West defense relay', x: -59, z: 8, radius: 3.5 }),
    Object.freeze({ id: 'vault-relay-b', name: 'South defense relay', x: -70, z: 18, radius: 3.5 }),
  ] satisfies RelayDefinition[]),
  boarding: Object.freeze({ x: -29, z: 0 }),
  battleEntry: Object.freeze({ x: 44, z: 0, radius: 10 }),
  reward: Object.freeze({ x: 69, z: -8 }),
});

export interface EncounterSnapshot {
  readonly phase: EncounterPhase;
  readonly run: number;
  readonly elapsed: number;
  readonly objective: string;
  readonly kills: number;
  readonly remainingEnemies: number;
  readonly disabledRelays: readonly string[];
  readonly activeRelayIds: readonly string[];
  readonly wave: number;
}

export type EncounterAction =
  | { type: 'spawn'; enemies: readonly EnemySpawn[] }
  | { type: 'phase'; phase: EncounterPhase }
  | { type: 'reward' }
  | { type: 'event'; event: EncounterEvent };

const objectives: Record<EncounterPhase, string> = {
  idle: 'N / D-pad Up: start a 3–5 minute run. Test equipment at the dummy first.',
  infiltration: 'PILOT · Enter the Service Vault through the west gate. Clear its sentries.',
  defenses: 'PILOT · E / Y at both marked relays to disable heavy-range defenses.',
  boarding: 'Return to the frame at the west gate. F / LB to board; cross the east gate.',
  battle: 'MECH · Break six mixed-role squads. Use cover to recharge shields and vent heat.',
  boss: 'MINI-BOSS · Dodge the charged volley; circle to its glowing rear core during recovery.',
  loot: 'SALVAGE · Collect the guaranteed upgrade near the fallen heavy with E / Y.',
  complete: 'RUN COMPLETE · Equip the upgrade, restock at vending, then N / D-pad Up to replay.',
};

/** Deterministic stage orchestration. Kill IDs, rather than total counts, prevent dummy/old kills advancing it. */
export class EncounterDirector {
  private phase: EncounterPhase = 'idle';
  private run = 0;
  private elapsed = 0;
  private kills = 0;
  private wave = 0;
  private readonly alive = new Set<string>();
  private readonly relays = new Set<string>();
  private readonly actions: EncounterAction[] = [];

  constructor(readonly seed = 1) {}

  get snapshot(): EncounterSnapshot {
    return {
      phase: this.phase, run: this.run, elapsed: this.elapsed, kills: this.kills, wave: this.wave,
      objective: objectives[this.phase], remainingEnemies: this.alive.size,
      disabledRelays: [...this.relays],
      activeRelayIds: this.phase === 'defenses' ? ENCOUNTER.relays.filter(relay => !this.relays.has(relay.id)).map(relay => relay.id) : [],
    };
  }

  start(): boolean {
    if (this.phase !== 'idle' && this.phase !== 'complete') return false;
    this.run++; this.elapsed = 0; this.kills = 0; this.wave = 0;
    this.alive.clear(); this.relays.clear(); this.actions.length = 0;
    this.transition('infiltration');
    this.spawn([
      this.enemy('vault-rusher', 'rusher', -47, 0, 175, 0),
      this.enemy('vault-flanker', 'flanker', -61, 0, 210, 35),
      this.enemy('vault-guard', 'flanker', -69, 11, 210, 35),
    ]);
    return true;
  }

  update(dt: number, player: { mode: Mode; position: Point2 }): void {
    if (Number.isFinite(dt) && dt > 0 && this.phase !== 'idle' && this.phase !== 'complete') this.elapsed += Math.min(dt, 1);
    if (this.phase === 'boarding' && player.mode === 'mech' && player.position.x > 35
      && Math.hypot(player.position.x - ENCOUNTER.battleEntry.x, player.position.z - ENCOUNTER.battleEntry.z) <= ENCOUNTER.battleEntry.radius) {
      this.transition('battle'); this.wave = 1; this.spawnBattle();
    }
  }

  disableRelay(id: string, mode: Mode, position: Point2): boolean {
    if (this.phase !== 'defenses' || mode !== 'pilot' || this.relays.has(id)) return false;
    if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
    const relay = ENCOUNTER.relays.find(candidate => candidate.id === id);
    if (!relay || Math.hypot(position.x - relay.x, position.z - relay.z) > relay.radius) return false;
    this.relays.add(id);
    this.actions.push({ type: 'event', event: { type: 'defense-disabled', id } });
    if (this.relays.size === ENCOUNTER.relays.length) this.transition('boarding');
    return true;
  }

  enemyKilled(id: string): boolean {
    if (!this.alive.delete(id)) return false;
    this.kills++;
    if (this.alive.size) return true;
    if (this.phase === 'infiltration') this.transition('defenses');
    else if (this.phase === 'battle' && this.wave < ENCOUNTER.battleGroups) { this.wave++; this.spawnBattle(); }
    else if (this.phase === 'battle') {
      this.transition('boss');
      this.spawn([
        this.enemy('boss', 'heavy', 70, -9, 2100, 650, true),
        this.enemy('boss-rusher', 'rusher', 55, -11, 300, 0),
        this.enemy('boss-flanker', 'flanker', 76, 4, 310, 70),
      ]);
    } else if (this.phase === 'boss') {
      this.transition('loot'); this.actions.push({ type: 'reward' });
    }
    return true;
  }

  collectReward(itemId: string): boolean {
    if (this.phase !== 'loot' || !itemId) return false;
    this.actions.push({ type: 'event', event: { type: 'reward-collected', itemId } });
    this.transition('complete');
    return true;
  }

  /** Death/abandon clears only transient encounter state. Inventory/checkpoints stay owned by the game. */
  reset(): void {
    this.alive.clear(); this.relays.clear(); this.elapsed = 0; this.kills = 0; this.wave = 0;
    this.actions.length = 0; this.transition('idle');
  }

  drainActions(): EncounterAction[] { return this.actions.splice(0); }

  private transition(phase: EncounterPhase): void {
    this.phase = phase;
    this.actions.push({ type: 'phase', phase }, { type: 'event', event: { type: 'encounter-phase', phase, run: this.run } });
  }
  private spawn(enemies: EnemySpawn[]): void {
    for (const enemy of enemies) this.alive.add(enemy.id);
    this.actions.push({ type: 'spawn', enemies });
  }
  private enemy(id: string, role: EnemyRole, x: number, z: number, health: number, shield: number, boss = false): EnemySpawn {
    // The same bounded combat budget applies to every build and replay. Player
    // damage, proc rates, equipment and save data are never normalized here.
    const stage = this.phase === 'infiltration' ? 1.45 : this.phase === 'boss' ? 1.6 : 2;
    return { id: `run-${this.run}:${id}`, role, x, z, health: Math.round(health * ENCOUNTER.vitalityScale * stage), shield: Math.round(shield * ENCOUNTER.vitalityScale * stage), boss };
  }
  private spawnBattle(): void {
    const side = ((this.seed >>> 0) + this.run) % 2 ? 1 : -1;
    const layout = (this.wave - 1) % 4;
    const positions: readonly (readonly [number, number])[][] = [
      [[51, 2], [70, 8 * side], [72, -5]],
      [[53, -10], [77, 9 * side], [66, 8]],
      [[48, -9], [68, -14], [77, 9]],
      [[54, 9], [77, -9], [68, 2]],
    ];
    const [rusher, flanker, heavy] = positions[layout];
    this.spawn([
      this.enemy(`battle-${this.wave}-rusher`, 'rusher', ...rusher, 330, 0),
      this.enemy(`battle-${this.wave}-flanker`, 'flanker', ...flanker, 460, 85),
      // Shield-heavy protection keeps shock and rear-core positioning valuable;
      // extending hull alone disproportionately taxes sustained elemental fire.
      this.enemy(`battle-${this.wave}-heavy`, 'heavy', ...heavy, 320, 700),
    ]);
  }
}
