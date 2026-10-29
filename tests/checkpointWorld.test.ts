import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import * as THREE from 'three';
import { CHECKPOINTS, getCheckpoint, nearestCheckpoint } from '../src/core/checkpoints.ts';
import { checkZoneAccess, type Mode } from '../src/core/index.ts';
import { createWorld, getZone, isWalkable } from '../src/world.ts';

const scene = new THREE.Scene();
let world: ReturnType<typeof createWorld>;
const actorRadius: Record<Mode, number> = { pilot: 0.48, mech: 1.4 };

before(() => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement(tag: string) {
        assert.equal(tag, 'canvas');
        return {
          width: 0, height: 0,
          getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }),
        };
      },
    },
  });
  try {
    world = createWorld(scene);
    scene.updateMatrixWorld(true);
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

after(() => world?.dispose());

test('every checkpoint respawn clears actual world obstacles and obeys the saved form access rule', () => {
  for (const definition of CHECKPOINTS) {
    for (const mode of ['pilot', 'mech'] as const) {
      if (!checkZoneAccess(mode, definition.allowed)) continue;
      const { x, z } = definition.spawn;
      assert.equal(checkZoneAccess(mode, getZone(x, z).allowed), true, `${definition.id}: ${mode} respawn must remain in a permitted zone`);
      assert.equal(isWalkable(x, z, actorRadius[mode], world.colliders), true, `${definition.id}: ${mode} spawn overlaps actual world geometry`);
      assert.equal(nearestCheckpoint({ x, z }, mode)?.id, definition.id, `${definition.id}: spawn must remain within its station's activation radius`);
    }
  }
});

test('checkpoint station bases remain visible physical obstacles at their actual registry positions', () => {
  assert.equal(world.checkpointStations.size, CHECKPOINTS.length);
  for (const definition of CHECKPOINTS) {
    const visual = world.checkpointStations.get(definition.id);
    assert.ok(visual, `${definition.id}: missing station visual`);
    assert.deepEqual([visual.group.position.x, visual.group.position.z], [definition.station.x, definition.station.z]);
    const base = visual.group.getObjectByName('checkpoint-base');
    assert.ok(base instanceof THREE.Mesh, `${definition.id}: station must have real base geometry`);
    const bounds = new THREE.Box3().setFromObject(base, true);
    assert.ok(bounds.min.y <= 0.00001 && bounds.max.y > 0, `${definition.id}: station base must meet the ground`);
    for (const mode of ['pilot', 'mech'] as const) {
      assert.equal(isWalkable(definition.station.x, definition.station.z, actorRadius[mode], world.colliders), false,
        `${definition.id}: physical clearance must not be restored by removing its collider`);
    }
  }
});

test('shared and vault checkpoint parking stays mech-clear in the shared yard', () => {
  for (const id of ['yard-service', 'yard-crossing', 'vault-entry'] as const) {
    const definition = getCheckpoint(id)!;
    const { x, z } = definition.parkedMech;
    assert.equal(getZone(x, z).allowed, 'both', `${id}: pilot must be able to reach the parked frame before mounting`);
    assert.equal(isWalkable(x, z, actorRadius.mech, world.colliders), true, `${id}: parked mech overlaps world geometry`);
  }
  assert.deepEqual(getCheckpoint('yard-service')!.parkedMech, { x: 6, z: 8 });
  assert.deepEqual(getCheckpoint('yard-crossing')!.parkedMech, { x: -4, z: 0 });
  assert.deepEqual(getCheckpoint('vault-entry')!.parkedMech, { x: -29, z: 0 });
});

test('heavy checkpoint mech pads have sufficient physical clearance even when the parked frame is hidden', () => {
  for (const id of ['heavy-entry', 'heavy-depot'] as const) {
    const { x, z } = getCheckpoint(id)!.parkedMech;
    assert.equal(getZone(x, z).allowed, 'mech');
    assert.equal(isWalkable(x, z, actorRadius.mech, world.colliders), true, `${id}: mech-sized pad clearance is required independently of visibility`);
  }
});
