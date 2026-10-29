import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import * as THREE from 'three';
import { createWorld, getZone, isWalkable } from '../src/world.ts';

const PILOT_RADIUS = 0.48;
const MECH_RADIUS = 1.4;
const scene = new THREE.Scene();
let world: ReturnType<typeof createWorld>;

before(() => {
  // Scene construction needs canvas-backed signs, but these physics tests do not
  // render them. Keep the stub limited to that single drawing surface.
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement(tag: string) {
        assert.equal(tag, 'canvas');
        return {
          width: 0,
          height: 0,
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

function assertClearRoute(points: [number, number][], radius: number) {
  for (let segment = 1; segment < points.length; segment++) {
    const [fromX, fromZ] = points[segment - 1];
    const [toX, toZ] = points[segment];
    const steps = Math.ceil(Math.hypot(toX - fromX, toZ - fromZ) / 0.25);
    for (let step = 0; step <= steps; step++) {
      const fraction = step / steps;
      const x = fromX + (toX - fromX) * fraction;
      const z = fromZ + (toZ - fromZ) * fraction;
      assert.ok(isWalkable(x, z, radius, world.colliders), `Blocked route for radius ${radius} at (${x}, ${z})`);
    }
  }
}

test('access zones change at the actual gates, leaving both boundary lines in the shared yard', () => {
  for (const z of [-54, 0, 54]) {
    assert.equal(getZone(-35.001, z).allowed, 'pilot');
    assert.equal(getZone(-35, z).allowed, 'both');
    assert.equal(getZone(0, z).id, 'yard');
    assert.equal(getZone(35, z).allowed, 'both');
    assert.equal(getZone(35.001, z).allowed, 'mech');
  }
  assert.equal(getZone(-65, -18).id, 'vault');
  assert.equal(getZone(65, 18).id, 'badlands');
});

test('starting repair pad and boarding pad are clear at both pilot and mech sizes', () => {
  const { x, z } = world.parkedMech.position;
  assert.deepEqual([x, z], [6, 8]);
  assert.ok(Math.hypot(x, z - 16) <= 11, 'The initial frame must be within the boarding interaction range');
  for (const radius of [PILOT_RADIUS, MECH_RADIUS]) {
    assert.ok(isWalkable(0, 16, radius, world.colliders));
    assert.ok(isWalkable(x, z, radius, world.colliders));
    assertClearRoute([[0, 16], [x, z]], radius);
  }
});

test('continuous pilot and mech routes reach the correct ranges through the gate openings', () => {
  assertClearRoute([[0, 16], [0, 0], [-35, 0], [-60, 0]], PILOT_RADIUS);
  assertClearRoute([[0, 16], [0, 0], [35, 0], [70, 0]], MECH_RADIUS);
  assert.equal(getZone(-60, 0).allowed, 'pilot');
  assert.equal(getZone(70, 0).allowed, 'mech');
});

test('actual cover and gate posts block movement using the full actor footprint', () => {
  assert.equal(isWalkable(-15, -10, PILOT_RADIUS, world.colliders), false, 'Pilot cannot enter the central supply container');
  assert.equal(isWalkable(-15, -10, MECH_RADIUS, world.colliders), false, 'Mech cannot enter the central supply container');
  assert.equal(isWalkable(-19.4, -10, PILOT_RADIUS, world.colliders), true, 'Pilot fits beside the container');
  assert.equal(isWalkable(-19.4, -10, MECH_RADIUS, world.colliders), false, 'The larger frame clips the same container');
  assert.equal(isWalkable(35, 12, PILOT_RADIUS, world.colliders), false, 'A gate post is a physical obstacle');
  assert.equal(isWalkable(35, 10, PILOT_RADIUS, world.colliders), true);
  assert.equal(isWalkable(35, 10, MECH_RADIUS, world.colliders), false, 'Frame clearance matters beside the gate post');
});

test('world boundaries contain the complete actor and reject non-finite positions', () => {
  for (const radius of [PILOT_RADIUS, MECH_RADIUS]) {
    assert.equal(isWalkable(90 - radius, 0, radius, []), true);
    assert.equal(isWalkable(90 - radius + 0.001, 0, radius, []), false);
    assert.equal(isWalkable(-90 + radius - 0.001, 0, radius, []), false);
    assert.equal(isWalkable(0, 55 - radius + 0.001, radius, []), false);
    assert.equal(isWalkable(0, -55 + radius - 0.001, radius, []), false);
  }
  assert.equal(isWalkable(NaN, 0, PILOT_RADIUS, world.colliders), false);
  assert.equal(isWalkable(0, Infinity, PILOT_RADIUS, world.colliders), false);
  assert.equal(isWalkable(0, 0, -1, world.colliders), false);
});

test('supply-container walls stop shots at their visible surface without outline interference', () => {
  const ray = new THREE.Raycaster(new THREE.Vector3(-15, 1.6, 0), new THREE.Vector3(0, 0, -1), 0, 20);
  const hits = ray.intersectObjects(world.occluders, true);
  assert.ok(hits.length > 0, 'The supply container must be part of weapon occlusion');
  assert.ok(hits[0].object instanceof THREE.Mesh, 'Decorative outlines must not intercept weapon rays');
  assert.ok(Math.abs(hits[0].point.z - (-7.95)) < 0.00001);
});
