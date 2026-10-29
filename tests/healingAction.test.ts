import assert from 'node:assert/strict';
import test from 'node:test';
import { HEAL_ANIMATION_DURATION, HEAL_APPLY_TIME, HealingAction } from '../src/core/healingAction.ts';
import type { Mode } from '../src/core/index.ts';

test('healing emits one application at the injection boundary and finishes at the animation boundary', () => {
  assert.equal(HEAL_APPLY_TIME, 0.55);
  assert.equal(HEAL_ANIMATION_DURATION, 1.2);
  const action = new HealingAction();
  assert.equal(action.active, false);
  assert.equal(action.mode, null);
  assert.equal(action.begin('pilot', 5), true);
  assert.equal(action.mode, 'pilot');
  assert.deepEqual(action.update(5.549), { apply: null, finished: false });
  assert.deepEqual(action.update(5.55), { apply: 'pilot', finished: false });
  assert.deepEqual(action.update(5.55), { apply: null, finished: false });
  assert.deepEqual(action.update(6.199), { apply: null, finished: false });
  assert.equal(action.active, true);
  assert.deepEqual(action.update(6.2), { apply: null, finished: true });
  assert.equal(action.active, false);
  assert.equal(action.mode, null);
  assert.deepEqual(action.update(7), { apply: null, finished: false });
});

test('a late frame crossing both thresholds still applies exactly once before clearing the action', () => {
  const action = new HealingAction();
  action.begin('mech', 10);
  assert.deepEqual(action.update(50), { apply: 'mech', finished: true });
  assert.equal(action.active, false);
  assert.equal(action.mode, null);
  assert.deepEqual(action.update(50), { apply: null, finished: false });
});

test('cancel before injection prevents delayed healing and a fresh action cannot inherit the old application', () => {
  const action = new HealingAction();
  action.begin('pilot', 0);
  action.update(0.4);
  action.cancel(); // Death or a reset cancels pending recovery.
  assert.equal(action.active, false);
  assert.equal(action.progress(0.5), 0);
  assert.deepEqual(action.update(2), { apply: null, finished: false });
  assert.equal(action.begin('mech', 2), true);
  assert.deepEqual(action.update(2.3), { apply: null, finished: false });
  assert.deepEqual(action.update(2 + HEAL_APPLY_TIME), { apply: 'mech', finished: false });
});

test('cancel after injection cannot emit another application or a stale finish signal', () => {
  const action = new HealingAction();
  action.begin('pilot', 0);
  assert.equal(action.update(0.6).apply, 'pilot');
  action.cancel();
  assert.deepEqual(action.update(1.2), { apply: null, finished: false });
  assert.equal(action.begin('pilot', 2), true);
  assert.deepEqual(action.update(3.3), { apply: 'pilot', finished: true });
});

test('repeated simulation timestamps keep animation and injection paused', () => {
  const action = new HealingAction();
  action.begin('pilot', 20);
  const heldProgress = action.progress(20.3);
  for (let iteration = 0; iteration < 100; iteration++) {
    assert.equal(action.progress(20.3), heldProgress);
    assert.deepEqual(action.update(20.3), { apply: null, finished: false });
  }
  assert.equal(action.active, true);
  assert.equal(action.update(20 + HEAL_APPLY_TIME).apply, 'pilot');
  assert.deepEqual(action.update(20 + HEAL_APPLY_TIME), { apply: null, finished: false });
});

test('begin refuses replacement while active without changing form, timing, or application state', () => {
  const action = new HealingAction();
  action.begin('pilot', 4);
  assert.equal(action.begin('mech', 4.4), false);
  assert.equal(action.mode, 'pilot');
  assert.ok(Math.abs(action.progress(4.6) - 0.5) < 1e-10);
  assert.equal(action.update(4 + HEAL_APPLY_TIME).apply, 'pilot');
  assert.equal(action.begin('mech', 4.8), false);
  assert.equal(action.update(4.9).apply, null);
  action.update(4 + HEAL_ANIMATION_DURATION);
  assert.equal(action.begin('mech', 6), true);
});

test('invalid starts and clocks never poison a valid pending action', () => {
  const action = new HealingAction();
  for (const now of [NaN, Infinity, -Infinity, -1, Number.MAX_VALUE, Number.MAX_SAFE_INTEGER]) {
    assert.equal(action.begin('pilot', now), false);
    assert.equal(action.active, false);
  }
  assert.equal(action.begin('invalid' as Mode, 0), false);
  assert.equal(action.begin('mech', 3), true);
  for (const now of [NaN, Infinity, -Infinity, -1, Number.MAX_VALUE]) {
    assert.equal(action.progress(now), 0);
    assert.deepEqual(action.update(now), { apply: null, finished: false });
    assert.equal(action.active, true);
    assert.equal(action.mode, 'mech');
  }
  assert.deepEqual(action.update(3 + HEAL_APPLY_TIME), { apply: 'mech', finished: false });
});

test('progress is bounded and rewinding the supplied clock cannot apply recovery twice', () => {
  const action = new HealingAction();
  assert.equal(action.progress(0), 0);
  action.begin('pilot', 10);
  assert.equal(action.progress(0), 0);
  assert.equal(action.progress(100), 1);
  assert.equal(action.active, true, 'Reading progress alone must not complete or apply recovery');
  assert.deepEqual(action.update(9), { apply: null, finished: false });
  assert.deepEqual(action.update(10.6), { apply: 'pilot', finished: false });
  assert.deepEqual(action.update(10.1), { apply: null, finished: false });
  assert.deepEqual(action.update(10.6), { apply: null, finished: false });
});
