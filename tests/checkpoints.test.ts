import assert from 'node:assert/strict';
import test from 'node:test';
import { CHECKPOINTS, DEFAULT_CHECKPOINT, getCheckpoint, nearestCheckpoint, normalizeCheckpoint, type CheckpointId } from '../src/core/checkpoints.ts';
import { createProgression, deserializeProgression, rollItem, seededRandom, serializeProgression, type Mode } from '../src/core/index.ts';

test('checkpoint registry is unique, deeply frozen, and resolves only known IDs', () => {
  assert.equal(CHECKPOINTS.length, 5);
  assert.equal(new Set(CHECKPOINTS.map(definition => definition.id)).size, 5);
  assert.equal(Object.isFrozen(CHECKPOINTS), true);
  assert.equal(Object.isFrozen(DEFAULT_CHECKPOINT), true);
  for (const definition of CHECKPOINTS) {
    assert.equal(getCheckpoint(definition.id), definition);
    assert.equal(Object.isFrozen(definition), true);
    assert.equal(Object.isFrozen(definition.station), true);
    assert.equal(Object.isFrozen(definition.spawn), true);
    assert.equal(Object.isFrozen(definition.parkedMech), true);
    assert.ok(definition.radius > 0 && Number.isFinite(definition.radius));
  }
  assert.equal(getCheckpoint('not-a-station'), undefined);
  assert.equal(getCheckpoint(null), undefined);
  assert.equal(getCheckpoint(0), undefined);
});

test('a legacy version-one save migrates its missing checkpoint without losing equipment or currency', () => {
  const legacy = createProgression();
  delete legacy.checkpoint;
  legacy.credits = 12345;
  legacy.kills = 64;
  legacy.wave = 12;
  legacy.inventory.push(rollItem('mech', 12, seededRandom(91)));
  const loaded = deserializeProgression(serializeProgression(legacy));
  assert.ok(loaded);
  assert.deepEqual(loaded, { ...legacy, checkpoint: DEFAULT_CHECKPOINT });
  assert.equal(loaded.version, 1);
});

test('valid checkpoint and active form round-trip through the existing save schema', () => {
  for (const definition of CHECKPOINTS) {
    for (const mode of ['pilot', 'mech'] as const) {
      if (definition.allowed !== 'both' && definition.allowed !== mode) continue;
      const state = createProgression();
      state.credits = 999;
      state.checkpoint = { id: definition.id, mode };
      const loaded = deserializeProgression(serializeProgression(state));
      assert.deepEqual(loaded, state);
    }
  }
});

test('malformed, unknown, and mode-incompatible checkpoint metadata defaults independently', () => {
  const state = createProgression();
  state.credits = 777;
  state.inventory.push(rollItem('pilot', 3, seededRandom(8)));
  for (const checkpoint of [
    null, 'yard-service', [], {}, { id: 'unknown', mode: 'pilot' },
    { id: 'yard-crossing' }, { id: 'yard-service', mode: 'invalid' },
    { id: 'vault-entry', mode: 'mech' }, { id: 'heavy-entry', mode: 'pilot' },
    { id: 'heavy-depot', mode: 'pilot' }, { id: 1, mode: 'pilot' },
  ]) {
    const loaded = deserializeProgression(JSON.stringify({ ...state, checkpoint }));
    assert.deepEqual(loaded, { ...state, checkpoint: DEFAULT_CHECKPOINT });
  }
  const brokenWallet = JSON.stringify({ ...state, credits: -1, checkpoint: null });
  assert.equal(deserializeProgression(brokenWallet), null, 'Checkpoint recovery must not relax validation of unrelated progress');
});

test('normalization always returns an independent save object rather than mutable registry/default state', () => {
  const first = normalizeCheckpoint(undefined);
  const second = normalizeCheckpoint(undefined);
  first.mode = 'mech';
  assert.deepEqual(second, DEFAULT_CHECKPOINT);
  assert.equal(DEFAULT_CHECKPOINT.mode, 'pilot');
  const input = { id: 'yard-crossing', mode: 'mech' };
  const normalized = normalizeCheckpoint(input);
  input.mode = 'pilot';
  assert.deepEqual(normalized, { id: 'yard-crossing', mode: 'mech' });
  assert.deepEqual(createProgression().checkpoint, DEFAULT_CHECKPOINT);
});

test('station activation chooses the compatible station only inside its inclusive radius', () => {
  for (const definition of CHECKPOINTS) {
    const compatible: Mode = definition.allowed === 'both' ? 'pilot' : definition.allowed;
    assert.equal(nearestCheckpoint(definition.station, compatible)?.id, definition.id);
    assert.equal(nearestCheckpoint({ x: definition.station.x + definition.radius, z: definition.station.z }, compatible)?.id, definition.id);
    assert.equal(nearestCheckpoint({ x: definition.station.x + definition.radius + 0.001, z: definition.station.z }, compatible), undefined);
    if (definition.allowed === 'both') assert.equal(nearestCheckpoint(definition.station, 'mech')?.id, definition.id);
    else assert.equal(nearestCheckpoint(definition.station, definition.allowed === 'pilot' ? 'mech' : 'pilot'), undefined);
  }
  assert.equal(nearestCheckpoint({ x: 20, z: -30 }, 'pilot'), undefined);
  for (const position of [{ x: NaN, z: 0 }, { x: 0, z: Infinity }, { x: -Infinity, z: 16 }]) {
    assert.equal(nearestCheckpoint(position, 'pilot'), undefined);
  }
  assert.equal(nearestCheckpoint(CHECKPOINTS[0].station, 'invalid' as Mode), undefined);
});

test('saved respawn selection stays independent from whichever station is now nearest', () => {
  const saved = normalizeCheckpoint({ id: 'yard-crossing', mode: 'pilot' });
  const deathPosition = getCheckpoint('vault-entry')!.station;
  assert.equal(nearestCheckpoint(deathPosition, 'pilot')!.id, 'vault-entry');
  assert.equal(getCheckpoint(saved.id)?.id, 'yard-crossing');
  assert.deepEqual(saved, { id: 'yard-crossing' as CheckpointId, mode: 'pilot' });
});
