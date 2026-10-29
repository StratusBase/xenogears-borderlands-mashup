import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEnemyDamage, shieldAdjustedDamage } from '../src/core/combat.ts';

test('shield amplification consumes the boosted portion without amplifying health overflow', () => {
  const enemy = { health: 100, maxHealth: 100, shield: 50, maxShield: 50 };
  const delivered = shieldAdjustedDamage(enemy.shield, 40, 1.6);
  const hit = applyEnemyDamage(enemy, delivered);
  assert.equal(hit.shieldDamage, 50);
  assert.equal(hit.healthDamage, 8.75); // 31.25 of the original 40 damage broke the shield.
  assert.equal(enemy.health, 91.25);
});

test('shield-only hits, bare health, and invalid inputs stay bounded', () => {
  assert.equal(shieldAdjustedDamage(100, 20, 1.6), 32);
  assert.equal(shieldAdjustedDamage(0, 20, 1.6), 20);
  assert.equal(shieldAdjustedDamage(10, 30), 30);
  assert.equal(shieldAdjustedDamage(10, 30, NaN), 30);
  assert.equal(shieldAdjustedDamage(NaN, 30, 1.6), 0);
  assert.equal(shieldAdjustedDamage(10, -30, 1.6), 0);
  assert.equal(shieldAdjustedDamage(10, Infinity, 1.6), 0);
});
