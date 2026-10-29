import assert from 'node:assert/strict';
import test from 'node:test';
import { createProgression } from '../src/core/index.ts';
import { createEncounterPolicy, type EncounterPolicySnapshot } from '../src/diagnostics/encounterDriver.ts';
import { segmentClear } from '../src/encounter/navigation.ts';

function snapshot(change: Partial<EncounterPolicySnapshot> = {}): EncounterPolicySnapshot {
  return {
    phase: 'infiltration', time: 0, paused: false, mode: 'pilot', position: { x: 0, y: 1.8, z: 16 },
    body: { health: 108, shield: 65, ammo: 30, reserve: 240, overheated: false },
    enemies: [], defenses: [], progression: createProgression(), navigation: [], ...change,
  };
}
function movement(input: ReturnType<ReturnType<typeof createEncounterPolicy>['input']>) {
  const yaw = input.yaw ?? 0, x = input.moveX ?? 0, z = input.moveY ?? 0;
  return { x: Math.cos(yaw) * x + Math.sin(yaw) * z, z: -Math.sin(yaw) * x + Math.cos(yaw) * z };
}

test('policy routes ordinary movement toward the west gate and reproduces identical controls', () => {
  const state = snapshot();
  const a = createEncounterPolicy(), b = createEncounterPolicy();
  const first = a.input(state), again = b.input(state);
  assert.deepEqual(first, again);
  const world = movement(first);
  assert.ok(world.x < 0 && world.z < 0);
  assert.ok(Math.hypot(first.moveX!, first.moveY!) <= 1.000001);
  assert.equal(first.fire, false);
  assert.equal(first.sprint, true);
});

test('cover blocks firing while navigation provides a swept-clear approach', () => {
  const boxes = [{ minX: -47, maxX: -45, minZ: -4, maxZ: 4 }];
  const state = snapshot({ position: { x: -40, y: 1.8, z: 0 }, enemies: [{ id: 1, role: 'flanker', boss: false, health: 100, shield: 0, weakPointOpen: true, position: { x: -52, z: 0 } }], navigation: boxes });
  const policy = createEncounterPolicy(), input = policy.input(state, 0.1), world = movement(input);
  assert.equal(input.fire, false);
  assert.ok(Math.hypot(world.x, world.z) > 0);
  const next = { x: state.position.x + world.x * 7 * 0.1, z: state.position.z + world.z * 7 * 0.1 };
  assert.equal(segmentClear(state.position, next, 0.48, boxes, { minX: -90, maxX: 35, minZ: -55, maxZ: 55 }), true);
  assert.match(policy.reason, /Route around cover/);
});

test('relay and boarding actions require actual proximity and respect the current form', () => {
  const policy = createEncounterPolicy();
  const defenses = [{ id: 'a', x: -59, z: 8, radius: 3.5, disabled: false }];
  assert.equal(policy.input(snapshot({ phase: 'defenses', position: { x: -53, y: 1.8, z: 8 }, defenses })).interact, undefined);
  assert.equal(policy.input(snapshot({ phase: 'defenses', position: { x: -57, y: 1.8, z: 8 }, defenses })).interact, true);
  assert.equal(policy.input(snapshot({ phase: 'boarding', position: { x: -50, y: 1.8, z: 0 } })).switchMode, undefined);
  assert.equal(policy.input(snapshot({ phase: 'boarding', position: { x: -29, y: 1.8, z: 1 } })).switchMode, true);
  const mech = policy.input(snapshot({ phase: 'boarding', mode: 'mech', position: { x: -29, y: 4.4, z: 0 } }));
  assert.equal(mech.switchMode, undefined);
  assert.ok(movement(mech).x > 0);
});

test('combat fire requires range, healing uses actual equipped maximum, and only nearby mech attacks use ability', () => {
  const enemy = { id: 2, role: 'heavy' as const, boss: true, health: 500, shield: 0, weakPointOpen: true, position: { x: 60, z: 0 } };
  const pilot = createEncounterPolicy().input(snapshot({ position: { x: -40, y: 1.8, z: 0 }, body: { health: 50, shield: 0, ammo: 10, reserve: 50, overheated: false }, enemies: [{ ...enemy, position: { x: -50, z: 0 } }] }));
  assert.equal(pilot.fire, true); assert.equal(pilot.heal, true); assert.equal(pilot.ability, false);
  const mechState = snapshot({ phase: 'boss', mode: 'mech', position: { x: 50, y: 4.4, z: 0 }, enemies: [enemy] });
  const near = createEncounterPolicy().input(mechState);
  assert.equal(near.fire, true); assert.equal(near.ability, true);
  const far = createEncounterPolicy().input({ ...mechState, position: { x: 40, y: 4.4, z: 0 } });
  assert.equal(far.fire, false); assert.equal(far.ability, false);
});

test('paused, finished, and incomplete snapshots do not create unsolicited actions', () => {
  const policy = createEncounterPolicy();
  for (const state of [snapshot({ paused: true }), snapshot({ phase: 'complete' }), snapshot({ navigation: undefined })]) {
    assert.deepEqual(policy.input(state), { moveX: 0, moveY: 0, sprint: false, fire: false });
  }
  assert.throws(() => policy.input(snapshot(), 0), RangeError);
  assert.throws(() => policy.input(snapshot(), NaN), RangeError);
});

test('salvage collection aims at the actual drop height and only interacts within pickup range', () => {
  const policy = createEncounterPolicy();
  const near = policy.input(snapshot({ phase: 'loot', mode: 'mech', position: { x: 65, y: 4.4, z: -8 } }));
  assert.equal(near.interact, true); assert.equal(near.fire, false); assert.ok(near.pitch! < 0);
  const far = policy.input(snapshot({ phase: 'loot', mode: 'mech', position: { x: 55, y: 4.4, z: -8 } }));
  assert.equal(far.interact, undefined); assert.ok(movement(far).x > 0);
});
