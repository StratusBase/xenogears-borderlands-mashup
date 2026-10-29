import type { Mode } from './index';

export type CheckpointId = 'yard-service' | 'yard-crossing' | 'vault-entry' | 'heavy-entry' | 'heavy-depot';

export interface CheckpointSave {
  id: CheckpointId;
  mode: Mode;
}

export interface CheckpointDefinition {
  readonly id: CheckpointId;
  readonly name: string;
  readonly station: Readonly<{ x: number; z: number }>;
  readonly spawn: Readonly<{ x: number; z: number; yaw: number }>;
  readonly parkedMech: Readonly<{ x: number; z: number }>;
  readonly allowed: 'both' | Mode;
  readonly radius: number;
}

function checkpoint(definition: CheckpointDefinition): CheckpointDefinition {
  Object.freeze(definition.station);
  Object.freeze(definition.spawn);
  Object.freeze(definition.parkedMech);
  return Object.freeze(definition);
}

export const CHECKPOINTS: readonly CheckpointDefinition[] = Object.freeze([
  checkpoint({
    id: 'yard-service', name: 'Service Pad', station: { x: -6, z: 16 },
    spawn: { x: 0, z: 16, yaw: 0 }, parkedMech: { x: 6, z: 8 }, allowed: 'both', radius: 7,
  }),
  checkpoint({
    id: 'yard-crossing', name: 'Yard Junction', station: { x: 4.5, z: 3 },
    spawn: { x: 0, z: 0, yaw: 0 }, parkedMech: { x: -4, z: 0 }, allowed: 'both', radius: 6,
  }),
  checkpoint({
    id: 'vault-entry', name: 'Service Vault', station: { x: -45, z: 6 },
    spawn: { x: -45, z: 0, yaw: 0 }, parkedMech: { x: -29, z: 0 }, allowed: 'pilot', radius: 7,
  }),
  checkpoint({
    id: 'heavy-entry', name: 'Heavy Range', station: { x: 44, z: 6 },
    spawn: { x: 44, z: 0, yaw: 0 }, parkedMech: { x: 44, z: 0 }, allowed: 'mech', radius: 7,
  }),
  checkpoint({
    id: 'heavy-depot', name: 'Heavy Depot', station: { x: 69, z: 15 },
    spawn: { x: 65, z: 14, yaw: 0 }, parkedMech: { x: 65, z: 14 }, allowed: 'mech', radius: 5.5,
  }),
]);

export const DEFAULT_CHECKPOINT: Readonly<CheckpointSave> = Object.freeze({ id: 'yard-service', mode: 'pilot' });

export function getCheckpoint(id: unknown): CheckpointDefinition | undefined {
  return typeof id === 'string' ? CHECKPOINTS.find(definition => definition.id === id) : undefined;
}

/** Invalid checkpoint metadata falls back independently of the rest of a saved game. */
export function normalizeCheckpoint(value: unknown): CheckpointSave {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const saved = value as Record<string, unknown>;
    const definition = getCheckpoint(saved.id);
    const mode = saved.mode;
    if (definition && (mode === 'pilot' || mode === 'mech') && (definition.allowed === 'both' || definition.allowed === mode)) {
      return { id: definition.id, mode };
    }
  }
  return { ...DEFAULT_CHECKPOINT };
}

/** Used for station activation only; respawning resolves the previously saved checkpoint ID. */
export function nearestCheckpoint(position: { x: number; z: number }, mode: Mode): CheckpointDefinition | undefined {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.z) || (mode !== 'pilot' && mode !== 'mech')) return undefined;
  let nearest: CheckpointDefinition | undefined;
  let nearestDistance = Infinity;
  for (const definition of CHECKPOINTS) {
    if (definition.allowed !== 'both' && definition.allowed !== mode) continue;
    const distance = Math.hypot(position.x - definition.station.x, position.z - definition.station.z);
    if (distance <= definition.radius && distance < nearestDistance) {
      nearest = definition;
      nearestDistance = distance;
    }
  }
  return nearest;
}
