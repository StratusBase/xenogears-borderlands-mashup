import assert from 'node:assert/strict';
import test from 'node:test';
import { applyEnemyDamage, type EnemyVitals } from '../src/core/combat.ts';

function enemy(): EnemyVitals { return { health: 100, maxHealth: 100, shield: 50, maxShield: 50 }; }

test('shield absorbs a hit completely before health changes', () => {
  const vitals = enemy();
  assert.deepEqual(applyEnemyDamage(vitals, 30), { healthDamage: 0, shieldDamage: 30, killed: false });
  assert.deepEqual(vitals, { health: 100, maxHealth: 100, shield: 20, maxShield: 50 });
});

test('a shield-breaking hit overflows into health without losing damage', () => {
  const vitals = enemy();
  assert.deepEqual(applyEnemyDamage(vitals, 70), { healthDamage: 20, shieldDamage: 50, killed: false });
  assert.equal(vitals.health, 80);
  assert.equal(vitals.shield, 0);
  assert.deepEqual(applyEnemyDamage(vitals, 25), { healthDamage: 25, shieldDamage: 0, killed: false });
  assert.equal(vitals.health, 55);
});

test('exact shield damage leaves health intact and unshielded targets receive health damage directly', () => {
  const vitals = enemy();
  assert.deepEqual(applyEnemyDamage(vitals, 50), { healthDamage: 0, shieldDamage: 50, killed: false });
  assert.equal(vitals.health, 100);
  assert.deepEqual(applyEnemyDamage(vitals, 40), { healthDamage: 40, shieldDamage: 0, killed: false });
});

test('lethal damage is bounded by remaining health and death is reported only once', () => {
  const vitals = enemy();
  assert.deepEqual(applyEnemyDamage(vitals, 1000), { healthDamage: 100, shieldDamage: 50, killed: true });
  assert.equal(vitals.health, 0);
  assert.equal(vitals.shield, 0);
  assert.deepEqual(applyEnemyDamage(vitals, 1000), { healthDamage: 0, shieldDamage: 0, killed: false });
});

test('negative, nonfinite, zero, and oversized damage neither heals nor mutates', () => {
  for (const damage of [-1, 0, NaN, Infinity, -Infinity, Number.MAX_VALUE, 1_000_000_001]) {
    const vitals = enemy();
    const before = { ...vitals };
    assert.deepEqual(applyEnemyDamage(vitals, damage), { healthDamage: 0, shieldDamage: 0, killed: false });
    assert.deepEqual(vitals, before);
  }
});

test('corrupt enemy vital bounds reject damage without partial mutation', () => {
  const corrupt: Partial<EnemyVitals>[] = [
    { health: -1 }, { health: 101 }, { health: NaN }, { maxHealth: 0 }, { maxHealth: Infinity },
    { shield: -1 }, { shield: 51 }, { shield: NaN }, { maxShield: -1 }, { maxShield: 1_000_000_001 },
  ];
  for (const values of corrupt) {
    const vitals = { ...enemy(), ...values };
    const before = { ...vitals };
    assert.deepEqual(applyEnemyDamage(vitals, 20), { healthDamage: 0, shieldDamage: 0, killed: false });
    assert.deepEqual(vitals, before);
  }
});

test('fractional combat values conserve applied damage and leave maximums unchanged', () => {
  const vitals = { health: 27.5, maxHealth: 27.5, shield: 4.25, maxShield: 4.25 };
  const hit = applyEnemyDamage(vitals, 10.5);
  assert.equal(hit.healthDamage + hit.shieldDamage, 10.5);
  assert.equal(vitals.health, 21.25);
  assert.equal(vitals.shield, 0);
  assert.equal(vitals.maxHealth, 27.5);
  assert.equal(vitals.maxShield, 4.25);
});
