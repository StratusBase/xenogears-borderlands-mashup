import assert from 'node:assert/strict';
import test from 'node:test';
import { DROP_CHANCES, getHealCooldownRemaining, healHealth, HEAL_COOLDOWN, HEALTH_PICKUP_FRACTION, rollEnemySupplies, SELF_HEAL_FRACTION, trySelfHeal, type HealthTarget } from '../src/core/recovery.ts';

test('drop chances are frozen and chance boundaries are strictly less than the configured rate', () => {
  assert.equal(Object.isFrozen(DROP_CHANCES), true);
  assert.deepEqual(DROP_CHANCES, { cash: 0.6, health: 0.18 });
  const boundary = [0.6, 0.18];
  assert.deepEqual(rollEnemySupplies(() => boundary.shift()!), { cash: false, health: false });
  const below = [0.599999, 0.179999];
  assert.deepEqual(rollEnemySupplies(() => below.shift()!), { cash: true, health: true });
  assert.deepEqual(rollEnemySupplies(() => -5), { cash: true, health: true });
  assert.deepEqual(rollEnemySupplies(() => 2), { cash: false, health: false });
});

test('cash and health rolls are independent, including one failed random draw', () => {
  for (const [values, expected] of [
    [[0.1, 0.9], { cash: true, health: false }],
    [[0.9, 0.1], { cash: false, health: true }],
    [[NaN, 0.1], { cash: false, health: true }],
    [[0.1, Infinity], { cash: true, health: false }],
  ] as const) {
    let draws = 0;
    assert.deepEqual(rollEnemySupplies(() => values[draws++]), expected);
    assert.equal(draws, 2);
  }
  let draws = 0;
  assert.deepEqual(rollEnemySupplies(() => {
    if (draws++ === 0) throw new Error('First roll unavailable');
    return 0.1;
  }), { cash: false, health: true });
  assert.equal(draws, 2);
  for (const value of [NaN, Infinity, -Infinity]) assert.deepEqual(rollEnemySupplies(() => value), { cash: false, health: false });
  assert.deepEqual(rollEnemySupplies(() => { throw new Error('No randomness'); }), { cash: false, health: false });
});

test('health pickups restore a fraction of maximum health and clamp to the actual missing amount', () => {
  const target = { health: 50, maxHealth: 200 };
  assert.equal(healHealth(target, HEALTH_PICKUP_FRACTION), 50);
  assert.equal(target.health, 100);
  target.health = 190;
  assert.equal(healHealth(target, HEALTH_PICKUP_FRACTION), 10);
  assert.equal(target.health, 200);
  assert.equal(healHealth(target, HEALTH_PICKUP_FRACTION), 0);
});

test('invalid fractions and invalid or dead targets never heal or mutate', () => {
  for (const fraction of [-1, 0, 1.01, NaN, Infinity, -Infinity]) {
    const target = { health: 50, maxHealth: 100 };
    assert.equal(healHealth(target, fraction), 0);
    assert.deepEqual(target, { health: 50, maxHealth: 100 });
  }
  for (const target of [
    { health: 0, maxHealth: 100 }, { health: -1, maxHealth: 100 },
    { health: 101, maxHealth: 100 }, { health: NaN, maxHealth: 100 },
    { health: 1, maxHealth: 0 }, { health: 1, maxHealth: Infinity },
    { health: 1, maxHealth: 1_000_000_001 },
  ]) {
    const before = { ...target };
    assert.equal(healHealth(target, 0.25), 0);
    assert.deepEqual(target, before);
    assert.equal(trySelfHeal(target, 10, 0).reason, 'invalid');
    assert.deepEqual(target, before);
  }
});

test('self-heal restores the configured fraction and starts exactly one cooldown', () => {
  assert.equal(HEAL_COOLDOWN, 20);
  assert.equal(SELF_HEAL_FRACTION, 0.35);
  const target = { health: 10, maxHealth: 100 };
  const first = trySelfHeal(target, 5, 0);
  assert.deepEqual(first, { healed: 35, readyAt: 25 });
  assert.equal(target.health, 45);
  assert.deepEqual(trySelfHeal(target, 5, first.readyAt), { healed: 0, readyAt: 25, reason: 'cooldown' });
  assert.deepEqual(trySelfHeal(target, 24.999, first.readyAt), { healed: 0, readyAt: 25, reason: 'cooldown' });
  assert.equal(target.health, 45);
  assert.deepEqual(trySelfHeal(target, 25, first.readyAt), { healed: 35, readyAt: 45 });
  assert.equal(target.health, 80);
});

test('a shared readyAt prevents switching bodies from bypassing self-heal cooldown', () => {
  const pilot: HealthTarget = { health: 10, maxHealth: 100 };
  const mech: HealthTarget = { health: 100, maxHealth: 400 };
  const first = trySelfHeal(pilot, 0, 0);
  assert.deepEqual(first, { healed: 35, readyAt: 20 });
  assert.deepEqual(trySelfHeal(mech, 1, first.readyAt), { healed: 0, readyAt: 20, reason: 'cooldown' });
  assert.equal(mech.health, 100);
  assert.deepEqual(trySelfHeal(mech, 20, first.readyAt), { healed: 140, readyAt: 40 });
  assert.equal(mech.health, 240);
});

test('full health consumes no cooldown, including while an earlier cooldown is running', () => {
  const target = { health: 100, maxHealth: 100 };
  assert.deepEqual(trySelfHeal(target, 5, 0), { healed: 0, readyAt: 0, reason: 'full' });
  assert.deepEqual(trySelfHeal(target, 5, 20), { healed: 0, readyAt: 20, reason: 'full' });
  target.health = 95;
  assert.deepEqual(trySelfHeal(target, 20, 20), { healed: 5, readyAt: 40 });
  assert.equal(target.health, 100);
});

test('invalid clocks are rejected without healing or poisoning the returned cooldown', () => {
  for (const [now, readyAt] of [
    [NaN, 0], [Infinity, 0], [-1, 0], [0, NaN], [0, Infinity], [0, -1],
    [Number.MAX_SAFE_INTEGER, 0],
  ]) {
    const target = { health: 10, maxHealth: 100 };
    const result = trySelfHeal(target, now, readyAt);
    assert.equal(result.reason, 'invalid');
    assert.equal(result.healed, 0);
    assert.ok(Number.isFinite(result.readyAt) && result.readyAt >= 0);
    assert.equal(target.health, 10);
  }
});

test('cooldown display is finite, never negative, and observes the exact ready boundary', () => {
  assert.equal(getHealCooldownRemaining(5, 20), 15);
  assert.equal(getHealCooldownRemaining(20, 20), 0);
  assert.equal(getHealCooldownRemaining(21, 20), 0);
  assert.equal(getHealCooldownRemaining(19.75, 20), 0.25);
  for (const [now, readyAt] of [[NaN, 20], [0, Infinity], [-1, 20], [0, -1], [0, Number.MAX_VALUE]]) {
    assert.equal(getHealCooldownRemaining(now, readyAt), 0);
  }
});
