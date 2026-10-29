import test from 'node:test';
import assert from 'node:assert/strict';
import { JumpMotion } from '../src/core/jump';

test('a second press arrests a fall, gains height, and a third press cannot fly', () => {
  const jump = new JumpMotion();
  assert.equal(jump.request('pilot'), true);
  jump.update(0.5);
  assert.ok(jump.velocity < 0);
  const height = jump.height;
  assert.equal(jump.request('pilot'), true);
  jump.update(0.15);
  assert.ok(jump.height > height);
  const velocity = jump.velocity;
  assert.equal(jump.request('pilot'), false);
  assert.equal(jump.velocity, velocity);
});

test('landing renews two jumps in either form; resetting removes airborne state', () => {
  for (const mode of ['pilot', 'mech'] as const) {
    const jump = new JumpMotion();
    jump.request(mode); jump.update(0.1); jump.request(mode);
    jump.update(1);
    assert.deepEqual([jump.height, jump.velocity, jump.used], [0, 0, 0]);
    assert.equal(jump.request(mode), true);
    jump.update(0.1); jump.reset();
    assert.deepEqual([jump.height, jump.velocity, jump.used], [0, 0, 0]);
  }
});

test('invalid and zero elapsed time do not consume a jump or advance it', () => {
  const jump = new JumpMotion(); jump.request('mech');
  const state = [jump.height, jump.velocity, jump.used];
  for (const dt of [0, -1, NaN, Infinity]) jump.update(dt);
  assert.deepEqual([jump.height, jump.velocity, jump.used], state);
});
