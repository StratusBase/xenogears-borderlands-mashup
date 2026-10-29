import assert from 'node:assert/strict';
import test from 'node:test';
import { MouseLook, type MouseLookEnvironment } from '../src/input/mouse.ts';

class FakeDocument extends EventTarget {
  pointerLockElement: EventTarget | null = null;
  exits = 0;
  exitPointerLock(): void {
    this.exits++;
    this.pointerLockElement = null;
    this.dispatchEvent(new Event('pointerlockchange'));
  }
}

function setup(request: (document: FakeDocument, canvas: EventTarget) => void | Promise<void> = (document, canvas) => {
  document.pointerLockElement = canvas;
  document.dispatchEvent(new Event('pointerlockchange'));
}) {
  const document = new FakeDocument(), window = new EventTarget();
  const canvas = new EventTarget() as EventTarget & { requestPointerLock: () => void | Promise<void> };
  let calls = 0;
  canvas.requestPointerLock = () => { calls++; return request(document, canvas); };
  const moves: number[][] = [], changes: boolean[] = [], failures: string[] = [];
  const mouse = new MouseLook(canvas as unknown as HTMLElement, {
    look: (dx, dy) => moves.push([dx, dy]),
    lockedChanged: locked => changes.push(locked),
    lockFailed: message => failures.push(message),
  }, { document, window } satisfies MouseLookEnvironment);
  return { document, window, canvas, mouse, moves, changes, failures, calls: () => calls };
}

function mouseEvent(type: string, data: Partial<{ button: number; buttons: number; clientX: number; clientY: number; movementX: number; movementY: number }> = {}): Event {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, data);
  return event;
}

test('capture is synchronous, requires enablement, and never requests automatically', () => {
  const fixture = setup();
  fixture.mouse.requestLock();
  assert.equal(fixture.calls(), 0);
  fixture.mouse.setEnabled(true);
  assert.equal(fixture.calls(), 0);
  fixture.mouse.requestLock();
  assert.equal(fixture.calls(), 1);
  assert.equal(fixture.mouse.locked, true);
  fixture.mouse.requestLock();
  assert.equal(fixture.calls(), 1);
  assert.deepEqual(fixture.changes, [true]);
  fixture.mouse.dispose();
});

test('native capture uses document movement deltas exactly once', () => {
  const fixture = setup();
  fixture.mouse.setEnabled(true);
  fixture.mouse.requestLock();
  fixture.document.dispatchEvent(mouseEvent('mousemove', { movementX: 13, movementY: -7, clientX: 0, clientY: 0 }));
  fixture.window.dispatchEvent(mouseEvent('mousemove', { movementX: 13, movementY: -7, clientX: 0, clientY: 0, buttons: 2 }));
  assert.deepEqual(fixture.moves, [[13, -7]]);
  fixture.mouse.dispose();
});

test('unlocked right-drag uses client-coordinate deltas when movementX/Y are zero', () => {
  const fixture = setup();
  fixture.mouse.setEnabled(true);
  fixture.canvas.dispatchEvent(mouseEvent('mousedown', { button: 2, clientX: 100, clientY: 80 }));
  fixture.window.dispatchEvent(mouseEvent('mousemove', { buttons: 2, clientX: 120, clientY: 76, movementX: 0, movementY: 0 }));
  fixture.window.dispatchEvent(mouseEvent('mousemove', { buttons: 2, clientX: 127, clientY: 89, movementX: 0, movementY: 0 }));
  assert.deepEqual(fixture.moves, [[20, -4], [7, 13]]);
  fixture.window.dispatchEvent(mouseEvent('mouseup', { button: 2 }));
  fixture.window.dispatchEvent(mouseEvent('mousemove', { buttons: 2, clientX: 200, clientY: 200 }));
  assert.equal(fixture.moves.length, 2);
  fixture.mouse.dispose();
});

test('left click never starts drag or causes automatic mouse capture', () => {
  const fixture = setup();
  fixture.mouse.setEnabled(true);
  fixture.canvas.dispatchEvent(mouseEvent('mousedown', { button: 0, clientX: 10, clientY: 10 }));
  fixture.window.dispatchEvent(mouseEvent('mousemove', { buttons: 1, clientX: 30, clientY: 40 }));
  assert.equal(fixture.calls(), 0);
  assert.equal(fixture.moves.length, 0);
  fixture.mouse.dispose();
});

test('release and disable clear stale drag coordinates and ignore subsequent movement', () => {
  const fixture = setup();
  fixture.mouse.setEnabled(true);
  fixture.canvas.dispatchEvent(mouseEvent('mousedown', { button: 2, clientX: 100, clientY: 80 }));
  fixture.mouse.release();
  fixture.window.dispatchEvent(mouseEvent('mousemove', { buttons: 2, clientX: 200, clientY: 200 }));
  assert.equal(fixture.moves.length, 0);
  fixture.canvas.dispatchEvent(mouseEvent('mousedown', { button: 2, clientX: 200, clientY: 200 }));
  fixture.mouse.setEnabled(false);
  fixture.window.dispatchEvent(mouseEvent('mousemove', { buttons: 2, clientX: 300, clientY: 300 }));
  assert.equal(fixture.moves.length, 0);
  fixture.mouse.setEnabled(true);
  fixture.window.dispatchEvent(mouseEvent('mousemove', { buttons: 2, clientX: 400, clientY: 400 }));
  assert.equal(fixture.moves.length, 0);
  fixture.mouse.dispose();
});

test('native loss emits false once, and release does not duplicate browser lockchange', () => {
  const fixture = setup();
  fixture.mouse.setEnabled(true);
  fixture.mouse.requestLock();
  fixture.document.pointerLockElement = null;
  fixture.document.dispatchEvent(new Event('pointerlockchange'));
  fixture.document.dispatchEvent(new Event('pointerlockchange'));
  assert.deepEqual(fixture.changes, [true, false]);
  fixture.mouse.requestLock();
  fixture.mouse.release();
  assert.deepEqual(fixture.changes, [true, false, true, false]);
  assert.equal(fixture.mouse.locked, false);
  assert.equal(fixture.document.pointerLockElement, null);
  fixture.mouse.dispose();
});

test('sync and promise rejections are handled, and duplicate error events notify once', async () => {
  const sync = setup(() => { throw new Error('Permission denied'); });
  sync.mouse.setEnabled(true);
  sync.mouse.requestLock();
  sync.document.dispatchEvent(new Event('pointerlockerror'));
  assert.equal(sync.failures.length, 1);
  assert.equal(sync.mouse.locked, false);
  sync.mouse.dispose();

  const asyncFailure = setup(() => Promise.reject(new Error('Permission denied')));
  asyncFailure.mouse.setEnabled(true);
  asyncFailure.mouse.requestLock();
  asyncFailure.document.dispatchEvent(new Event('pointerlockerror'));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(asyncFailure.failures.length, 1);
  assert.equal(asyncFailure.mouse.locked, false);
  asyncFailure.mouse.requestLock();
  await Promise.resolve();
  assert.equal(asyncFailure.failures.length, 2);
  asyncFailure.mouse.dispose();
});

test('a lock request completing after disable is released and does not reactivate input', async () => {
  let grant: (() => void) | undefined;
  const fixture = setup((document, canvas) => new Promise<void>(resolve => {
    grant = () => {
      document.pointerLockElement = canvas;
      document.dispatchEvent(new Event('pointerlockchange'));
      resolve();
    };
  }));
  fixture.mouse.setEnabled(true);
  fixture.mouse.requestLock();
  fixture.mouse.setEnabled(false);
  grant!();
  await Promise.resolve();
  assert.equal(fixture.document.pointerLockElement, null);
  assert.equal(fixture.mouse.locked, false);
  assert.deepEqual(fixture.changes, []);
  assert.deepEqual(fixture.failures, []);
  fixture.mouse.dispose();
});

test('release cancels a pending grant even while mouse input stays enabled', async () => {
  let grant: (() => void) | undefined;
  const fixture = setup((document, canvas) => new Promise<void>(resolve => {
    grant = () => {
      document.pointerLockElement = canvas;
      document.dispatchEvent(new Event('pointerlockchange'));
      resolve();
    };
  }));
  fixture.mouse.setEnabled(true);
  fixture.mouse.requestLock();
  fixture.mouse.release();
  grant!();
  await Promise.resolve();
  assert.equal(fixture.document.pointerLockElement, null);
  assert.equal(fixture.mouse.locked, false);
  assert.deepEqual(fixture.changes, []);
  fixture.mouse.dispose();
});

test('context menu is prevented, lost right-button state clears drag, and dispose removes handlers', () => {
  const fixture = setup();
  const context = mouseEvent('contextmenu');
  fixture.canvas.dispatchEvent(context);
  assert.equal(context.defaultPrevented, true);
  fixture.mouse.setEnabled(true);
  fixture.canvas.dispatchEvent(mouseEvent('mousedown', { button: 2, clientX: 10, clientY: 10 }));
  fixture.window.dispatchEvent(mouseEvent('mousemove', { buttons: 0, clientX: 20, clientY: 20 }));
  fixture.window.dispatchEvent(mouseEvent('mousemove', { buttons: 2, clientX: 30, clientY: 30 }));
  assert.deepEqual(fixture.moves, []);
  fixture.mouse.requestLock();
  fixture.mouse.dispose();
  const changes = [...fixture.changes];
  fixture.document.dispatchEvent(mouseEvent('mousemove', { movementX: 30, movementY: 20 }));
  fixture.document.pointerLockElement = fixture.canvas;
  fixture.document.dispatchEvent(new Event('pointerlockchange'));
  fixture.mouse.requestLock();
  assert.deepEqual(fixture.moves, []);
  assert.deepEqual(fixture.changes, changes);
  assert.equal(fixture.calls(), 1);
});
