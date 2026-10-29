import assert from 'node:assert/strict';
import test from 'node:test';
import { GamepadInput, neutralGamepadFrame, type GamepadLike } from '../src/input/gamepad.ts';

function gamepad(options: {
  id?: string; index?: number; connected?: boolean; mapping?: string; axes?: number[];
  held?: number[]; values?: Record<number, number>;
} = {}): GamepadLike {
  return {
    id: options.id ?? 'Test standard controller',
    index: options.index ?? 0,
    connected: options.connected ?? true,
    mapping: options.mapping ?? 'standard',
    axes: options.axes ?? [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, (_, index) => {
      const value = options.values?.[index] ?? (options.held?.includes(index) ? 1 : 0);
      return { pressed: value >= 0.5, value };
    }),
  };
}

test('no controller produces a fully neutral frame without sharing pressed sets', () => {
  const input = new GamepadInput();
  assert.deepEqual(input.poll([null, undefined]), neutralGamepadFrame());
  const first = neutralGamepadFrame();
  first.pressed.add('jump');
  assert.equal(neutralGamepadFrame().pressed.size, 0);
});

test('moving backward cannot trigger the D-pad-only junk pickup action', () => {
  const input = new GamepadInput();
  const movement = input.poll([gamepad({ axes: [0, 1, 0, 0] })]);
  assert.equal(movement.pressed.has('down'), true);
  assert.equal(movement.pressed.has('lootJunk'), false);
  input.poll([gamepad()]);
  const dpad = input.poll([gamepad({ held: [13] })]);
  assert.equal(dpad.pressed.has('lootJunk'), true);
  assert.equal(input.poll([gamepad({ held: [13] })]).pressed.has('lootJunk'), false);
});

test('radial deadzone removes drift while preserving smoothly scaled analog magnitude', () => {
  const input = new GamepadInput();
  const drift = input.poll([gamepad({ axes: [0.1, -0.1, 0.08, 0.11] })]);
  assert.equal(drift.moveX, 0);
  assert.equal(drift.moveY, 0);
  assert.equal(drift.lookX, 0);
  assert.equal(drift.lookY, 0);
  const middle = input.poll([gamepad({ axes: [0.58, 0, 0, -0.58] })]);
  assert.ok(Math.abs(middle.moveX - 0.5) < 1e-10);
  assert.ok(Math.abs(middle.lookY + 0.5) < 1e-10);
  assert.equal(input.poll([gamepad({ axes: [0.16, 0] })]).moveX, 0);
});

test('diagonal sticks are circularly bounded and nonfinite readings cannot propagate', () => {
  const input = new GamepadInput();
  const diagonal = input.poll([gamepad({ axes: [1, -1, -3, 4] })]);
  assert.ok(Math.abs(Math.hypot(diagonal.moveX, diagonal.moveY) - 1) < 1e-10);
  assert.ok(Math.abs(Math.hypot(diagonal.lookX, diagonal.lookY) - 1) < 1e-10);
  assert.ok(diagonal.moveX > 0 && diagonal.moveY < 0);
  assert.ok(diagonal.lookX < 0 && diagonal.lookY > 0);
  const invalid = input.poll([gamepad({ axes: [NaN, Infinity, -Infinity] })]);
  assert.deepEqual([invalid.moveX, invalid.moveY, invalid.lookX, invalid.lookY], [0, 0, 0, 0]);
});

test('buttons generate rising edges, while fire, aim, and sprint remain held', () => {
  const input = new GamepadInput();
  const pad = gamepad({ held: [0, 1, 2, 6, 7, 10] });
  const first = input.poll([pad]);
  assert.deepEqual(first.pressed, new Set(['jump', 'confirm', 'back', 'heal', 'reload']));
  assert.equal(first.fire, true);
  assert.equal(first.aim, true);
  assert.equal(first.sprint, true);
  const held = input.poll([pad]);
  assert.equal(held.pressed.size, 0);
  assert.equal(held.fire, true);
  assert.equal(held.aim, true);
  assert.equal(held.sprint, true);
  input.poll([gamepad()]);
  assert.deepEqual(input.poll([pad]).pressed, first.pressed);
});

test('all standard face, shoulder, menu, and dpad buttons map to expected actions', () => {
  const expected = [
    [1, ['back', 'heal']], [2, ['reload']], [3, ['interact']], [4, ['switchMode']],
    [5, ['ability']], [8, ['inventory']], [9, ['pause']],
    [12, ['up', 'nextEncounter']], [13, ['down', 'lootJunk']], [14, ['left']], [15, ['right']],
  ] as const;
  for (const [index, actions] of expected) {
    assert.deepEqual(new GamepadInput().poll([gamepad({ held: [index] })]).pressed, new Set(actions));
  }
});

test('triggers activate at the threshold and release below it', () => {
  const input = new GamepadInput();
  const low = input.poll([gamepad({ values: { 6: 0.499, 7: 0.49 } })]);
  assert.equal(low.aim, false);
  assert.equal(low.fire, false);
  const active = input.poll([gamepad({ values: { 6: 0.5, 7: 0.501 } })]);
  assert.equal(active.aim, true);
  assert.equal(active.fire, true);
  const released = input.poll([gamepad({ values: { 6: 0, 7: 0 } })]);
  assert.equal(released.aim, false);
  assert.equal(released.fire, false);
});

test('disconnect and reconnect clear held controls and reset action edges', () => {
  const input = new GamepadInput();
  const pad = gamepad({ held: [0, 7], axes: [1, 0, 1, 0] });
  assert.equal(input.poll([pad]).pressed.has('jump'), true);
  assert.equal(input.poll([pad]).pressed.has('jump'), false);
  assert.deepEqual(input.poll([gamepad({ connected: false, held: [0, 7] })]), neutralGamepadFrame());
  assert.equal(input.poll([pad]).pressed.has('jump'), true);
  input.clear();
  assert.equal(input.poll([pad]).pressed.has('jump'), true);
});

test('first connected standard-mapped pad wins and selection changes reset edges', () => {
  const input = new GamepadInput();
  const unsupported = gamepad({ id: 'Unmapped', mapping: '', held: [7] });
  const disconnected = gamepad({ id: 'Gone', connected: false, held: [7] });
  const second = gamepad({ id: 'Controller two', index: 2, held: [0] });
  const third = gamepad({ id: 'Controller three', index: 3, held: [7] });
  const selected = input.poll([unsupported, disconnected, second, third]);
  assert.equal(selected.label, 'Controller two');
  assert.equal(selected.connected, true);
  assert.equal(selected.fire, false);
  assert.equal(selected.pressed.has('confirm'), true);
  const next = input.poll([gamepad({ id: 'Replacement', index: 0, held: [0] }), second]);
  assert.equal(next.label, 'Replacement');
  assert.equal(next.pressed.has('confirm'), true);
  const skipped = input.poll([unsupported]);
  assert.equal(skipped.connected, false);
  assert.equal(skipped.fire, false);
  assert.match(skipped.label, /standard mapping required/);
});

test('left stick navigation has edges and does not alter right-stick look', () => {
  const input = new GamepadInput();
  const up = gamepad({ axes: [0, -1, 0.8, -0.4] });
  const first = input.poll([up]);
  assert.equal(first.pressed.has('up'), true);
  assert.equal(first.pressed.has('nextEncounter'), false, 'walking forward must not spawn encounters');
  assert.ok(first.lookX > 0 && first.lookY < 0);
  assert.equal(input.poll([up]).pressed.has('up'), false);
  input.poll([gamepad()]);
  assert.equal(input.poll([up]).pressed.has('up'), true);
  assert.equal(input.poll([gamepad({ axes: [-1, 0] })]).pressed.has('left'), true);
});
