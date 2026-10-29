import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TEST_DUMMY_DPS_WINDOW, TEST_DUMMY_HISTORY_LIMIT, TestDummyMeter } from '../src/core/testDummy.ts';
import type { DamageEffect } from '../src/core/feedback.ts';

test('the permanent dummy records full damage beyond an enemy health pool and distinguishes direct, critical and status events', () => {
  const meter = new TestDummyMeter();
  assert.equal(meter.record(10_000, 1), true);
  assert.equal(meter.record(17, 1, true), true);
  assert.equal(meter.record(3.75, 1, false, 'radiation'), true);
  assert.deepEqual(meter.snapshot(1), {
    total: 10020.75, lastHit: 3.75, hitCount: 3, dps: 10020.75 / TEST_DUMMY_DPS_WINDOW,
    latestCritical: false, latestEffect: 'radiation', secondsSinceHit: 0,
    directTotal: 10017, statusTotal: 3.75, criticalTotal: 17,
  });
  meter.record(2, 1.5, true, 'shock');
  assert.equal(meter.snapshot(1.5).latestCritical, false);
  assert.equal(meter.snapshot(1.5).latestEffect, 'shock');
  assert.equal(meter.snapshot(1.5).criticalTotal, 17);
});

test('rolling DPS uses a fixed five-second window and falls to zero without erasing lifetime totals', () => {
  const meter = new TestDummyMeter();
  meter.record(100, 0);
  meter.record(50, 2);
  assert.equal(meter.snapshot(2).dps, 30);
  assert.equal(meter.snapshot(4.99).dps, 30);
  assert.equal(meter.snapshot(5).dps, 10);
  assert.equal(meter.snapshot(7).dps, 0);
  assert.equal(meter.snapshot(10).total, 150);
  assert.equal(meter.snapshot(10).lastHit, 50);
  assert.equal(meter.snapshot(10).secondsSinceHit, 8);
});

test('rapid scatter and simultaneous fractional status ticks remain accounted for within a bounded memory budget', () => {
  const meter = new TestDummyMeter();
  for (let frame = 0; frame < 1000; frame++) {
    const now = frame * 0.005;
    for (let pellet = 0; pellet < 12; pellet++) meter.record(0.25, now);
    meter.record(0.5, now, false, 'corrosive');
    meter.record(0.25, now, false, 'fire');
    assert.ok(meter.retainedSampleCount <= TEST_DUMMY_HISTORY_LIMIT);
  }
  assert.equal(meter.snapshot(4.995).total, 3750);
  assert.equal(meter.snapshot(4.995).hitCount, 14000);
  assert.equal(meter.snapshot(4.995).dps, 750);
  assert.equal(meter.snapshot(4.995).directTotal, 3000);
  assert.equal(meter.snapshot(4.995).statusTotal, 750);
  assert.equal(meter.snapshot(10).dps, 0);
});

test('invalid damage, metadata and clock input reject atomically and a paused clock does not age the meter', () => {
  const meter = new TestDummyMeter();
  meter.record(12.5, 2, true);
  const before = meter.snapshot(2);
  for (const damage of [0, -1, NaN, Infinity, -Infinity]) assert.equal(meter.record(damage, 3), false);
  for (const now of [-1, NaN, Infinity, 1, Number.MAX_VALUE]) assert.equal(meter.record(4, now), false);
  assert.equal(meter.record(4, 3, false, 'invalid' as DamageEffect), false);
  assert.equal(meter.record(4, 3, 1 as unknown as boolean), false);
  assert.deepEqual(meter.snapshot(2), before);
  assert.deepEqual(meter.snapshot(2), meter.snapshot(2));
  assert.deepEqual(meter.snapshot(NaN), before);
  assert.deepEqual(meter.snapshot(1), before);
  const detached = meter.snapshot(2); detached.total = 0;
  assert.equal(meter.snapshot(2).total, 12.5);
});

test('overflow is rejected and reset starts an independent measurement without a respawn or health state', () => {
  const meter = new TestDummyMeter();
  assert.equal(meter.record(Number.MAX_VALUE, 1), true);
  const before = meter.snapshot(1);
  assert.equal(meter.record(Number.MAX_VALUE, 2), false);
  assert.deepEqual(meter.snapshot(1), before);
  meter.clear();
  assert.equal(meter.retainedSampleCount, 0);
  assert.deepEqual(meter.snapshot(0), { total: 0, lastHit: 0, hitCount: 0, dps: 0,
    latestCritical: false, latestEffect: null, secondsSinceHit: null, directTotal: 0, statusTotal: 0, criticalTotal: 0 });
  assert.equal(meter.record(1.5, 0), true);
  assert.equal(meter.snapshot(0).total, 1.5);
});
