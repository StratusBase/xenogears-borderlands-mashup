import assert from 'node:assert/strict';
import test from 'node:test';
import { DamageNumberModel, DamageNumberLayout, DamageNumberPresentation, DAMAGE_NUMBER_LIMITS, formatDamageAmount,
  type DamageNumberEvent, type DamagePlacement } from '../src/ui/damageNumbers.ts';

function event(overrides: Partial<DamageNumberEvent> = {}): DamageNumberEvent {
  return { amount: 3.25, at: 0, critical: false, kind: 'status', effect: 'fire', targetId: 'enemy-a',
    position: { x: .5, y: .5 }, head: { x: .5, y: .5 }, ...overrides };
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} differs from ${expected}`); }

test('500ms status ticks use fixed per-target windows with exact element breakdown; direct chains and criticals remain individual', () => {
  const model = new DamageNumberModel();
  model.push(event()); model.push(event({ at: .5, amount: 4.75 }));
  assert.equal(model.records.length, 1); assert.equal(model.records[0].amount, 8); assert.equal(model.records[0].events, 2);
  model.push(event({ at: .65 })); // Boundary must open a fresh bounded window.
  model.push(event({ targetId: 'enemy-b' })); model.push(event({ effect: 'shock' }));
  model.push(event({ effect: 'shock', kind: 'direct' })); model.push(event({ effect: 'shock', kind: 'direct', at: 1 / 60 }));
  model.push(event({ effect: undefined, critical: true, kind: 'direct', at: 1 / 60 }));
  model.push(event({ effect: undefined, critical: true, kind: 'direct' }));
  assert.equal(model.records.length, 7); assert.equal(model.diagnostics.mergedEvents, 2);
  assert.deepEqual(model.records[0].breakdown, { fire: { amount: 8, events: 2 }, shock: { amount: 3.25, events: 1 } });
  assert.equal(model.records[0].effect, undefined, 'Mixed elements retain their breakdown instead of adopting one element');
  assert.equal(model.records.filter(record => record.kind === 'direct').length, 4);
  assert.equal(model.records.filter(record => record.critical).length, 2);
  assert.equal(model.records[0].mergeUntil, .65, 'Refreshing a tick must not extend its collection window');
});

test('same-tick same-target salvos tally pellets while consecutive ticks/critical/effect/target stay separate', () => {
  const model = new DamageNumberModel();
  for (const amount of [3.25, 4.5, 5.75]) model.push(event({ amount, kind: 'direct', effect: undefined }));
  model.push(event({ amount: 7, at: 1 / 60, kind: 'direct', effect: undefined }));
  model.push(event({ amount: 8, kind: 'direct', effect: undefined, critical: true }));
  model.push(event({ amount: 9, kind: 'direct', effect: undefined, critical: true }));
  model.push(event({ amount: 10, kind: 'direct', effect: 'shock' }));
  model.push(event({ amount: 11, kind: 'direct', effect: undefined, targetId: 'enemy-b' }));
  assert.equal(model.records.length, 5);
  assert.equal(model.records[0].amount, 13.5); assert.equal(model.records[0].events, 3);
  assert.equal(model.records[1].at, 1 / 60); assert.equal(model.records[1].events, 1);
  const critical = model.records.find(record => record.critical)!;
  assert.equal(critical.amount, 17); assert.equal(critical.events, 2); assert.equal(critical.kind, 'direct');
  assert.equal(model.diagnostics.salvoMergedEvents, 3);
  close(model.records.reduce((sum, record) => sum + record.amount, 0), model.diagnostics.receivedDamage);
});

test('12 targets with four DoTs for14s plus direct fire retain exact totals and drain within the6s decay tail', () => {
  const model = new DamageNumberModel(), layout = new DamageNumberLayout();
  const heads = Array.from({ length: 12 }, (_, i) => ({ x: .11 + i % 6 * .153, y: .25 + Math.floor(i / 6) * .36 }));
  let total = 0, maxPending = 0;
  for (let frame = 0; frame <= 1200; frame++) {
    const now = frame / 60;
    if (frame <= 840 && frame % 30 === 0) for (let i = 0; i < 12; i++) for (const effect of ['fire', 'shock', 'corrosive', 'radiation'] as const) {
      model.push(event({ targetId: i, effect, at: now, amount: 2.25, position: heads[i], head: heads[i] })); total += 2.25;
    }
    if (frame <= 840 && frame % 12 === 0) {
      const i = Math.floor(frame / 12) % 12;
      model.push(event({ targetId: i, at: now, amount: 17.5, kind: 'direct', effect: undefined, critical: frame % 36 === 0, position: heads[i], head: heads[i] })); total += 17.5;
    }
    model.advance(now);
    for (const placement of layout.place(model.records, now, 1440, 900, heads)) model.presented(placement.record, now);
    maxPending = Math.max(maxPending, model.diagnostics.pending);
  }
  assert.equal(model.records.length, 0); assert.equal(model.diagnostics.unpresentedDamage, 0);
  assert.equal(model.diagnostics.renderedEvents, model.diagnostics.receivedEvents); close(model.diagnostics.renderedDamage, total);
  assert.equal(model.diagnostics.overflowEvents, 0); assert.ok(maxPending < 24, `Pending labels grew to ${maxPending}`);
});

test('queue lifetimes begin when presented, then stay fixed while exact accepted amounts reconcile', () => {
  const model = new DamageNumberModel();
  model.push(event({ amount: .1 })); model.push(event({ amount: .2, at: .5 }));
  model.advance(5); assert.equal(model.records.length, 1, 'A queued amount cannot disappear before presentation');
  model.presented(model.records[0], 5);
  assert.equal(formatDamageAmount(model.records[0].amount), '0.3');
  assert.equal(formatDamageAmount(2.5575), '2.56'); assert.equal(formatDamageAmount(1.664), '1.66');
  assert.equal(formatDamageAmount(18.75, 'direct'), '19'); assert.equal(formatDamageAmount(.0000321), '0.000032');
  assert.equal(model.records[0].visibleAt, 5);
  model.advance(6.09); assert.equal(model.records.length, 1);
  model.advance(6.11); assert.equal(model.records.length, 0);
  close(model.diagnostics.receivedDamage, .3); close(model.diagnostics.renderedDamage, .3); close(model.diagnostics.retiredDamage, .3);
  assert.equal(model.diagnostics.receivedEvents, model.diagnostics.renderedEvents);
  assert.equal(model.diagnostics.unpresentedDamage, 0);
});

test('artificial saturation is bounded and uses counted reason-specific overflow tallies without losing damage', () => {
  const model = new DamageNumberModel(); let sum = 0;
  for (let i = 0; i < 5000; i++) {
    const amount = .25 + i % 7; sum += amount;
    model.push(event({ amount, targetId: `enemy-${i}`, kind: i % 2 ? 'direct' : 'status', critical: i % 3 === 0,
      effect: i % 5 === 0 ? 'shock' : i % 5 === 1 ? 'corrosive' : undefined }));
  }
  assert.ok(model.diagnostics.overflowEvents > 0);
  assert.ok(model.records.length <= DAMAGE_NUMBER_LIMITS.records + 27, 'Overflow cannot create an unbounded backlog');
  const ordinary = model.records.filter(record => !record.overflow);
  assert.ok(ordinary.every(record => record.events === 1), 'Ordinary direct/target rows must retain their event identity');
  assert.ok(model.records.filter(record => record.overflow).every(record => !record.critical || record.kind === 'direct'));
  close(model.records.reduce((total, record) => total + record.amount, 0), sum);
  for (const record of model.records) model.presented(record, 10);
  close(model.diagnostics.renderedDamage, sum); assert.equal(model.diagnostics.renderedEvents, 5000);
  model.advance(12); assert.equal(model.records.length, 0); close(model.diagnostics.retiredDamage, sum);
});

function rectangle(placement: DamagePlacement) {
  return { left: placement.x - placement.width / 2, right: placement.x + placement.width / 2,
    top: placement.y - placement.height / 2 - DAMAGE_NUMBER_LIMITS.float, bottom: placement.y + placement.height / 2 };
}
function overlaps(a: ReturnType<typeof rectangle>, b: ReturnType<typeof rectangle>): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
test('crowded lanes protect heads and reticle throughout upward travel, with bounded placement after resize', () => {
  const model = new DamageNumberModel(), layout = new DamageNumberLayout();
  for (let i = 0; i < 40; i++) model.push(event({ targetId: i, kind: i % 3 ? 'status' : 'direct', critical: i % 7 === 0 }));
  for (const [width, height] of [[1600, 900], [800, 600], [640, 360]]) {
    const placements = layout.place(model.records, .1, width, height);
    assert.ok(placements.length >= (width < 800 ? 2 : 4) && placements.length <= DAMAGE_NUMBER_LIMITS.nodes);
    const reticle = { left: width / 2 - 48, right: width / 2 + 48, top: height / 2 - 48, bottom: height / 2 + 48 };
    const head = { left: width / 2 - 28, right: width / 2 + 28, top: height / 2 - 14, bottom: height / 2 + 48 };
    for (const placement of placements) {
      const rect = rectangle(placement);
      assert.ok(rect.left >= 0 && rect.right <= width && rect.top >= 0 && rect.bottom <= height);
      assert.ok(Math.abs(placement.x - width / 2) < 200, 'A crowded target must not scatter labels into remote corners');
      assert.equal(overlaps(rect, reticle), false); assert.equal(overlaps(rect, head), false);
    }
    for (let a = 0; a < placements.length; a++) for (let b = a + 1; b < placements.length; b++) assert.equal(overlaps(rectangle(placements[a]), rectangle(placements[b])), false);
  }
});

test('fresh critical/direct hits outrank a sustained status backlog and avoid moving non-hit heads', () => {
  const model = new DamageNumberModel(), layout = new DamageNumberLayout();
  for (let i = 0; i < 100; i++) model.push(event({ targetId: i }));
  model.push(event({ targetId: 'critical', at: 2, critical: true, kind: 'direct', effect: undefined }));
  model.push(event({ targetId: 'direct', at: 2, kind: 'direct', effect: undefined }));
  const freshHead = { x: .6, y: .4 };
  const placements = layout.place(model.records, 2, 1600, 900, [freshHead]);
  assert.equal(placements[0].record.targetId, 'critical'); assert.equal(placements[1].record.targetId, 'direct');
  const head = { left: freshHead.x * 1600 - 28, right: freshHead.x * 1600 + 28, top: freshHead.y * 900 - 14, bottom: freshHead.y * 900 + 48 };
  assert.ok(placements.every(placement => !overlaps(rectangle(placement), head)));
});

test('dense1440×900 labels stay outside title/live-data/dummy/vitals/ammo HUD footprints', () => {
  const model = new DamageNumberModel(), layout = new DamageNumberLayout();
  for (let i = 0; i < 120; i++) model.push(event({ targetId: i, kind: i % 3 ? 'status' : 'direct',
    position: { x: .08 + i % 7 * .14, y: .1 + Math.floor(i / 7) % 5 * .15 },
    head: { x: .08 + i % 7 * .14, y: .1 + Math.floor(i / 7) % 5 * .15 } }));
  const placements = layout.place(model.records, .1, 1440, 900);
  assert.ok(placements.length >= 4 && placements.length <= 40);
  const hud = [
    { left: 0, right: 370, top: 0, bottom: 220 }, { left: 1120, right: 1440, top: 0, bottom: 180 },
    { left: 555, right: 885, top: 110, bottom: 235 }, { left: 0, right: 340, top: 665, bottom: 900 },
    { left: 1100, right: 1440, top: 695, bottom: 900 }, { left: 600, right: 840, top: 695, bottom: 900 },
  ];
  assert.ok(placements.every(placement => hud.every(area => !overlaps(rectangle(placement), area))));
  const active = layout.place(model.records, .3, 1440, 900, [], { encounterGuide: true, toasts: 4 });
  const expanded = [{ left: 36, right: 636, top: 140, bottom: 310 }, { left: 1020, right: 1440, top: 166, bottom: 466 }];
  assert.ok(active.length > 0);
  assert.ok(active.every(placement => expanded.every(area => !overlaps(rectangle(placement), area))));
  const hiddenAgain = layout.place(model.records, .3, 1440, 900, [], { encounterGuide: false, toasts: 0 });
  assert.ok(hiddenAgain.length >= active.length, 'Hidden HUD overlays must release reserved game-view space');
});

test('a gone corner target is explicitly shown at the nearest safe edge after250ms and fully drains20quietseconds', () => {
  for (const point of [{ x: .02, y: .05 }, { x: .98, y: .05 }, { x: .02, y: .95 }, { x: .98, y: .95 }]) {
    const model = new DamageNumberModel(), layout = new DamageNumberLayout();
    model.push(event({ amount: 37, targetId: 'gone-target', kind: 'direct', effect: undefined, critical: true,
      head: point, position: { x: point.x, y: point.y < .5 ? .1 : .9 } }));
    let sawEdge = false, firstPresented = Infinity;
    for (let frame = 0; frame <= 1200; frame++) {
      const now = frame / 60; model.advance(now);
      const placements = layout.place(model.records, now, 1440, 900, []); // Target is gone; no subsequent hits or head refresh.
      for (const placement of placements) {
        assert.equal(placement.record.targetId, 'gone-target'); assert.equal(placement.record.amount, 37);
        assert.equal(placement.record.critical, true); assert.equal(placement.record.kind, 'direct');
        if (placement.edge) {
          sawEdge = true; assert.ok(placement.direction.length > 0); assert.ok(now >= .25);
          if (point.y < .5) assert.ok(placement.y < 450, 'Choose the closest upper safe boundary, never a remote lower gutter');
          else assert.ok(placement.y > 450, 'Choose the closest lower safe boundary, never a remote upper gutter');
        }
        model.presented(placement.record, now, placement.edge); firstPresented = Math.min(firstPresented, now);
      }
    }
    assert.equal(sawEdge, true); assert.ok(firstPresented <= .3);
    assert.equal(model.records.length, 0); assert.equal(model.diagnostics.pending, 0);
    assert.equal(model.diagnostics.unpresentedDamage, 0); assert.equal(model.diagnostics.receivedDamage, 37);
    assert.equal(model.diagnostics.renderedDamage, 37); assert.equal(model.diagnostics.resetCancelledDamage, 0);
    assert.equal(model.diagnostics.edgeRecords, 1);
  }
});

class FakeNode {
  children: FakeNode[] = []; parent?: FakeNode; hidden = false; className = ''; textContent = ''; title = '';
  dataset: Record<string, string> = {};
  style = { setProperty() {}, transform: '', opacity: '', width: '' };
  classList = { add() {}, remove() {}, toggle() {} };
  constructor(readonly fragment = false) {}
  append(...nodes: FakeNode[]) { for (const node of nodes) { if (node.fragment) this.append(...node.children); else { node.parent = this; this.children.push(node); } } }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
  setAttribute() {}
  getBoundingClientRect(): never { throw new Error('Feedback must never force layout'); }
}
test('visible numbers stay at their birth position through head motion, new hits and merged status ticks', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => new FakeNode(), createDocumentFragment: () => new FakeNode(true),
  } });
  const layer = new FakeNode();
  const presentation = new DamageNumberPresentation(layer as unknown as HTMLElement, new FakeNode() as unknown as HTMLElement);
  const origin = { x: .55, y: .47 };
  try {
    presentation.push(event({ targetId: 'human', position: { ...origin }, head: { ...origin } }));
    presentation.update(0, 1440, 900, false, [{ targetId: 'human', ...origin }]);
    const record = presentation.model.records[0], node = layer.children.find(candidate => candidate.dataset.feedbackId === String(record.id))!;
    const translation = () => node.style.transform.match(/translate3d\(([-\d.]+)px,([-\d.]+)px,0\)/)!.slice(1).map(Number);
    const [birthX, birthY] = translation(), birthLane = record.lane;
    for (let frame = 1; frame <= 45; frame++) {
      const at = frame / 60, head = { x: origin.x + Math.sin(frame * .4) * .05, y: origin.y + Math.cos(frame * .3) * .04 };
      if (frame % 12 === 0) presentation.push(event({ targetId: 'human', at, amount: 12, kind: 'direct', critical: true, head, position: head }));
      if (frame === 18 || frame === 36) presentation.push(event({ targetId: 'human', at, amount: 4.75, head, position: head }));
      presentation.update(at, 1440, 900, false, [{ targetId: 'human', ...head }]);
      const [x, y] = translation();
      assert.equal(x, birthX, `Frame ${frame}: an existing number must not follow the head or switch lanes`);
      assert.ok(Math.abs(y - (birthY - DAMAGE_NUMBER_LIMITS.float * at / DAMAGE_NUMBER_LIMITS.statusLifetime)) <= .011,
        `Frame ${frame}: only the existing upward float may move a number`);
      assert.equal(record.lane, birthLane); assert.equal(node.hidden, false);
    }
    assert.equal(record.amount, 12.75); assert.equal(record.events, 3);
  } finally {
    presentation.dispose();
    if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('new critical hits avoid the full reserved travel of already visible numbers', () => {
  const model = new DamageNumberModel(), layout = new DamageNumberLayout();
  model.push(event({ head: { x: .55, y: .47 }, position: { x: .55, y: .47 } }));
  const original = { ...layout.place(model.records, 0, 1440, 900)[0] };
  model.presented(original.record, 0);
  model.push(event({ at: .1, critical: true, kind: 'direct', head: { x: .55, y: .47 }, position: { x: .55, y: .47 } }));
  const next = layout.place(model.records, .1, 1440, 900);
  const retained = next.find(placement => placement.record.id === original.record.id)!;
  assert.equal(retained.x, original.x); assert.equal(retained.y, original.y);
  assert.equal(next[0].record.critical, true, 'New critical hits still outrank the waiting status queue');
  assert.equal(overlaps(rectangle(next[0]), rectangle(retained)), false);
});

test('feedback owns its spawn coordinates and merged visible rows keep the original anchor', () => {
  const model = new DamageNumberModel(), point = { x: .55, y: .47 };
  model.push(event({ position: point, head: point }));
  const record = model.records[0]; model.presented(record, 0);
  point.x = .8; point.y = .2;
  model.push(event({ at: .3, amount: 2, position: point, head: point }));
  assert.deepEqual(record.position, { x: .55, y: .47 }); assert.deepEqual(record.head, { x: .55, y: .47 });
  assert.equal(record.amount, 5.25); assert.equal(record.events, 2);
});

test('DOM nodes are pooled once; crowd feedback schedules no timers and freezes with the simulation clock', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document'), originalTimer = globalThis.setTimeout;
  let created = 0, timers = 0;
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement() { created++; return new FakeNode(); }, createDocumentFragment: () => new FakeNode(true),
  } });
  globalThis.setTimeout = ((..._args: unknown[]) => { timers++; throw new Error('No per-event timer is allowed'); }) as unknown as typeof setTimeout;
  const layer = new FakeNode(), crosshair = new FakeNode();
  let presentation: DamageNumberPresentation | undefined;
  try {
    presentation = new DamageNumberPresentation(layer as unknown as HTMLElement, crosshair as unknown as HTMLElement);
    const originals = [...layer.children], initialCreated = created;
    for (let frame = 0; frame < 150; frame++) {
      const at = frame / 60;
      for (let i = 0; i < 6; i++) presentation.push(event({ targetId: i, at, amount: .25 }));
      presentation.update(at, 1600, 900, false);
    }
    assert.equal(created, initialCreated); assert.equal(layer.children.length, DAMAGE_NUMBER_LIMITS.nodes); assert.deepEqual(layer.children, originals);
    assert.equal(timers, 0); assert.equal(presentation.diagnostics.receivedEvents, 900);
    const before = presentation.diagnostics, transforms = layer.children.map(node => node.style.transform);
    for (let frame = 0; frame < 144; frame++) presentation.update(149 / 60, 1600, 900, true);
    assert.deepEqual(presentation.diagnostics, before); assert.deepEqual(layer.children.map(node => node.style.transform), transforms);
    presentation.update(149 / 60, 800, 600, false); assert.equal(created, initialCreated, 'Resize must reuse the pool in CSS pixels');
    presentation.dispose(); assert.equal(layer.children.length, 0);
  } finally {
    presentation?.dispose(); globalThis.setTimeout = originalTimer;
    if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('pause then explicit reset cancels only unpresented amounts, retains cumulative accounting/IDs and starts a fresh dummy window', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => new FakeNode(), createDocumentFragment: () => new FakeNode(true),
  } });
  const presentation = new DamageNumberPresentation(new FakeNode() as unknown as HTMLElement, new FakeNode() as unknown as HTMLElement);
  try {
    presentation.push(event({ amount: 3, targetId: 'dummy' })); presentation.update(0, 1440, 900, false);
    const oldId = presentation.model.records[0].id;
    presentation.push(event({ amount: 7, targetId: 'pending', at: .1 }));
    presentation.update(.1, 1440, 900, true);
    assert.equal(presentation.diagnostics.receivedDamage, 10); assert.equal(presentation.diagnostics.renderedDamage, 3);
    presentation.clear('test-dummy-reset');
    assert.equal(presentation.diagnostics.resetCancelledDamage, 7); assert.equal(presentation.diagnostics.resetCancelledEvents, 1);
    assert.equal(presentation.diagnostics.lastResetReason, 'test-dummy-reset');
    presentation.push(event({ amount: 5, targetId: 'dummy', at: .2 }));
    const fresh = presentation.model.records[0];
    assert.ok(fresh.id > oldId); assert.equal(fresh.amount, 5); assert.equal(fresh.events, 1);
    assert.deepEqual(fresh.breakdown, { fire: { amount: 5, events: 1 } });
    presentation.update(.2, 1440, 900, false);
    const totals = presentation.diagnostics;
    assert.equal(totals.receivedDamage, 15); assert.equal(totals.renderedDamage, 8); assert.equal(totals.unpresentedDamage, 0);
    assert.equal(totals.receivedDamage, totals.renderedDamage + totals.unpresentedDamage + totals.resetCancelledDamage);
    assert.equal(totals.receivedEvents, totals.renderedEvents + totals.unpresentedEvents + totals.resetCancelledEvents);
  } finally {
    presentation.dispose();
    if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document');
  }
});
