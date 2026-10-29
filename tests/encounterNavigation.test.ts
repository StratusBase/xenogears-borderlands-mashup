import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createWorld, getZone, isWalkable } from '../src/world.ts';
import { createNavigationState, navigateEnemy, segmentClear, type NavigationBounds } from '../src/encounter/navigation.ts';
import { EncounterDirector, ENCOUNTER, type EnemySpawn } from '../src/encounter/encounter.ts';

const bounds = { minX: -35, maxX: 35, minZ: -54, maxZ: 54 };

test('full-radius visibility route takes both small and heavy enemies around cover', () => {
  const colliders = [{ minX: -4, maxX: 4, minZ: -3, maxZ: 3 }];
  for (const radius of [0.6, 1.4]) {
    const state = createNavigationState(); let p = { x: -12, z: 0 };
    const target = { x: 12, z: 0 };
    assert.equal(segmentClear(p, target, radius, colliders, bounds), false);
    for (let i = 0; i < 200; i++) {
      const next = navigateEnemy(p, target, 5, 0.05, radius, colliders, bounds, state);
      assert.ok(segmentClear(p, next, radius, colliders, bounds));
      assert.ok(Math.hypot(next.x - p.x, next.z - p.z) <= 0.25001, 'no teleport or tunneling');
      p = next;
    }
    assert.ok(Math.hypot(p.x - target.x, p.z - target.z) < 0.1);
  }
});

test('routing respects an impassable footprint and zone boundaries', () => {
  const colliders = [{ minX: -2, maxX: 2, minZ: -54, maxZ: 54 }];
  const state = createNavigationState();
  const p = { x: -10, z: 0 };
  assert.deepEqual(navigateEnemy(p, { x: 10, z: 0 }, 5, 0.1, 1.4, colliders, bounds, state), p);
  const open: NavigationBounds[] = [];
  let result = p;
  for (let i = 0; i < 200; i++) result = navigateEnemy(result, { x: -80, z: -80 }, 8, 0.1, 1.4, open, bounds, state);
  assert.ok(result.x >= bounds.minX + 1.4 && result.z >= bounds.minZ + 1.4);
});

test('actual sandbox cover has traversable routes at rusher and heavy footprints', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ width: 0, height: 0,
    getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } });
  const world = createWorld(new THREE.Scene());
  try {
    for (const radius of [0.6, 1.4]) {
      let p = { x: -25, z: -10 }; const target = { x: -5, z: -10 }; const state = createNavigationState();
      for (let frame = 0; frame < 220; frame++) {
        p = navigateEnemy(p, target, 4, 0.05, radius, world.colliders, bounds, state);
        assert.ok(isWalkable(p.x, p.z, radius, world.colliders));
      }
      assert.ok(Math.hypot(p.x - target.x, p.z - target.z) < 0.1, `cover route stuck at ${JSON.stringify(p)}`);
    }
  } finally {
    world.dispose();
    if (original) Object.defineProperty(globalThis, 'document', original); else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('every staged spawn is clear and can navigate actual geometry to its gate approach', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ width: 0, height: 0,
    getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } });
  const world = createWorld(new THREE.Scene());
  try {
    for (const seed of [0, 1]) {
      const director = new EncounterDirector(seed); director.start();
      const all: EnemySpawn[] = [];
      const drainSpawns = () => director.drainActions().flatMap(a => a.type === 'spawn' ? a.enemies : []);
      const sentries = drainSpawns(); all.push(...sentries);
      sentries.forEach(s => director.enemyKilled(s.id));
      for (const relay of ENCOUNTER.relays) director.disableRelay(relay.id, 'pilot', relay);
      director.update(0.1, { mode: 'mech', position: ENCOUNTER.battleEntry });
      for (let wave = 0; wave < ENCOUNTER.battleGroups + 1; wave++) {
        const enemies = drainSpawns(); all.push(...enemies); enemies.forEach(s => director.enemyKilled(s.id));
      }
      assert.equal(all.length, 6 + 3 * ENCOUNTER.battleGroups);
      for (const spawn of all) {
        const radius = spawn.role === 'heavy' ? 1.4 : 0.6;
        assert.ok(isWalkable(spawn.x, spawn.z, radius, world.colliders), `blocked spawn ${spawn.id}`);
        const zone = getZone(spawn.x, spawn.z);
        const destination = zone.id === 'vault' ? { x: -40, z: 0 } : { x: 44, z: 0 };
        let point = { x: spawn.x, z: spawn.z }; const state = createNavigationState();
        for (let frame = 0; frame < 500; frame++) {
          point = navigateEnemy(point, destination, 5, 0.05, radius, world.colliders, zone.bounds, state);
          assert.ok(isWalkable(point.x, point.z, radius, world.colliders));
        }
        assert.ok(Math.hypot(point.x - destination.x, point.z - destination.z) < 0.1, `no gate route ${spawn.id}: ${JSON.stringify(point)}`);
      }
    }
  } finally {
    world.dispose();
    if (original) Object.defineProperty(globalThis, 'document', original); else Reflect.deleteProperty(globalThis, 'document');
  }
});
