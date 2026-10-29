/** Small renderer-independent contract shared by combat, animation, and harnesses. */
export type EnemyRole = 'rusher' | 'flanker' | 'heavy';
export type EnemyPhase = 'advance' | 'windup' | 'attack' | 'recover' | 'stagger' | 'dead';
export interface Point2 { x: number; z: number }
export interface EnemyPresentation {
  phase: EnemyPhase;
  /** Normalized progress within the current phase. */
  phaseProgress: number;
  moving: boolean;
  shieldFraction: number;
  weakPointOpen: boolean;
  hitReaction: number;
}
export type EncounterPhase = 'idle' | 'infiltration' | 'defenses' | 'boarding' | 'battle' | 'boss' | 'loot' | 'complete';
export type EncounterEvent =
  | { type: 'enemy-phase'; id: number; role: EnemyRole; phase: EnemyPhase; position: Point2 }
  | { type: 'enemy-hit'; id: number; role: EnemyRole; weakPoint: boolean; shieldBroken: boolean }
  | { type: 'enemy-killed'; id: number; role: EnemyRole; boss: boolean }
  | { type: 'encounter-phase'; phase: EncounterPhase; run: number }
  | { type: 'defense-disabled'; id: string }
  | { type: 'reward-collected'; itemId: string };
export type EncounterEventListener = (event: EncounterEvent) => void;

/** Applied values (after shields/armor), simulation seconds; optional diagnostics only. */
export type CombatMeasurementEvent = { at: number } & (
  | { type: 'damage'; targetId: string; target: 'dummy' | 'enemy'; health: number; shield: number; source: 'direct' | 'status' | 'ability'; critical?: boolean }
  | { type: 'target-spawn'; targetId: string; health: number; shield: number }
  | { type: 'target-killed'; targetId: string }
  | { type: 'received'; health: number; shield: number }
  | { type: 'shot'; mode: 'pilot' | 'mech'; ammo: number }
  | { type: 'interval'; dt: number; heatBlocked: boolean; reloading: boolean }
  | { type: 'finish'; outcome: 'complete' | 'failed' | 'timeout' | 'aborted' }
);
export type CombatMeasurementPayload = CombatMeasurementEvent extends infer Event
  ? Event extends { at: number } ? Omit<Event, 'at'> : never : never;
