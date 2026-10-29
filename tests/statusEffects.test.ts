import assert from 'node:assert/strict';
import test from 'node:test';
import { activeStatusElements, advanceStatuses, applyStatus, createStatusState, ELEMENT_STATUS, elementEffectDescriptions, getStatusDps, getStatusDuration, getStatusModifiers, STATUS_TICK_INTERVAL, type StatusState } from '../src/core/statusEffects.ts';
import { elementLabels, type ElementType } from '../src/core/arsenal.ts';
import { applyEnemyDamage } from '../src/core/combat.ts';

test('fire ticks at half-second boundaries, catches up late frames, and cannot double-tick at the same timestamp', () => {
  const state = createStatusState();
  assert.equal(applyStatus(state, 'fire', 0, 5), true);
  assert.deepEqual(advanceStatuses(state, 0.499999), []);
  assert.deepEqual(advanceStatuses(state, 0.5), [{ damage: 2.5, effect: 'fire' }]);
  assert.deepEqual(advanceStatuses(state, 0.5), []);
  assert.deepEqual(advanceStatuses(state, 3), [{ damage: 12.5, effect: 'fire' }]);
  assert.deepEqual(advanceStatuses(state, 7), [{ damage: 5, effect: 'fire' }]);
  assert.deepEqual(state, {});
  assert.deepEqual(advanceStatuses(state, 7), []);
});

test('refreshing a DoT preserves its next tick and strongest hit power', () => {
  const state = createStatusState();
  applyStatus(state, 'fire', 0, 8);
  applyStatus(state, 'fire', 0.9, 2);
  assert.deepEqual(advanceStatuses(state, 1), [{ damage: 8, effect: 'fire' }]);
  applyStatus(state, 'fire', 1.2, 10);
  assert.deepEqual(advanceStatuses(state, 2), [{ damage: 10, effect: 'fire' }]);
  assert.ok(activeStatusElements(state, 5).includes('fire'));
  assert.ok(!activeStatusElements(state, 5.2).includes('fire'));
});

test('radiation has bounded periodic damage and a death-pulse marker only while active', () => {
  const state = createStatusState();
  applyStatus(state, 'radiation', 0, 8);
  assert.equal(getStatusModifiers(state, 0).radiationPulse, true);
  assert.deepEqual(advanceStatuses(state, 5), [{ damage: 30, effect: 'radiation' }]);
  assert.equal(getStatusModifiers(state, 5).radiationPulse, false);
});

test('corrosive damages at half-second boundaries while vulnerability retains its four-second expiry', () => {
  const state = createStatusState();
  applyStatus(state, 'corrosive', 5, 10);
  assert.equal(getStatusModifiers(state, 5).incomingDamage, 1.3);
  assert.deepEqual(advanceStatuses(state, 5.499999), []);
  assert.deepEqual(advanceStatuses(state, 5.5), [{ damage: 3, effect: 'corrosive' }]);
  assert.deepEqual(advanceStatuses(state, 5.5), []);
  assert.deepEqual(advanceStatuses(state, 8.5), [{ damage: 18, effect: 'corrosive' }]);
  assert.equal(getStatusModifiers(state, 8.999).incomingDamage, 1.3);
  assert.deepEqual(advanceStatuses(state, 9), [{ damage: 3, effect: 'corrosive' }]);
  assert.equal(getStatusModifiers(state, 9).incomingDamage, 1);
  assert.deepEqual(state, {});
});

test('shock now damages actual health four times over two seconds while retaining shield and chain effects', () => {
  const state = createStatusState();
  const enemy = { health: 50, maxHealth: 50, shield: 0, maxShield: 0 };
  applyStatus(state, 'shock', 0, 10);
  assert.equal(getStatusModifiers(state, 0).shieldDamage, 1.6);
  assert.equal(getStatusModifiers(state, 0).chain, true);
  assert.deepEqual(advanceStatuses(state, 0.499999), []);
  for (const [now, health] of [[0.5, 46], [1, 42], [1.5, 38], [2, 34]]) {
    const ticks = advanceStatuses(state, now);
    assert.deepEqual(ticks, [{ effect: 'shock', damage: 4 }]);
    for (const tick of ticks) {
      const result = applyEnemyDamage(enemy, tick.damage);
      assert.equal(result.healthDamage, 4);
      assert.equal(result.shieldDamage, 0);
    }
    assert.equal(enemy.health, health);
    assert.deepEqual(advanceStatuses(state, now), []);
  }
  assert.deepEqual(state, {});
  assert.equal(getStatusModifiers(state, 2).chain, false);
  assert.equal(getStatusModifiers(state, 2).shieldDamage, 1);
  assert.deepEqual(advanceStatuses(state, 5), []);
});

test('rapid shock reprocs preserve half-second cadence and strongest power without creating parallel stacks', () => {
  const state = createStatusState();
  applyStatus(state, 'shock', 0, 10);
  applyStatus(state, 'shock', 0.49, 2);
  assert.deepEqual(advanceStatuses(state, 0.5), [{ effect: 'shock', damage: 4 }]);
  applyStatus(state, 'shock', 0.74, 20);
  applyStatus(state, 'shock', 0.9, 1);
  assert.deepEqual(advanceStatuses(state, 0.99999), []);
  assert.deepEqual(advanceStatuses(state, 1), [{ effect: 'shock', damage: 8 }]);
  assert.deepEqual(advanceStatuses(state, 3), [{ effect: 'shock', damage: 24 }]);
  assert.deepEqual(state, {});
  applyStatus(state, 'shock', 3.1, 5);
  assert.deepEqual(advanceStatuses(state, 3.59999), []);
  assert.deepEqual(advanceStatuses(state, 3.6), [{ effect: 'shock', damage: 2 }]);
});

test('every periodic element preserves its per-second potency through fractional starts, expiry, and late catch-up', () => {
  for (const [element, coefficient, duration] of [['fire', 1, 4], ['radiation', 0.75, 5], ['corrosive', 0.6, 4], ['shock', 0.8, 2]] as const) {
    for (const start of [0.1, 7.3, 1000.123]) {
      const state = createStatusState();
      applyStatus(state, element, start, 10);
      assert.deepEqual(advanceStatuses(state, start + 0.49999), []);
      const first = advanceStatuses(state, start + 0.5);
      assert.equal(first[0].damage, 10 * coefficient * 0.5);
      const rest = advanceStatuses(state, start + duration);
      const total = first.reduce((sum, tick) => sum + tick.damage, 0) + rest.reduce((sum, tick) => sum + tick.damage, 0);
      assert.ok(Math.abs(total - 10 * coefficient * duration) < 1e-9, `${element} retains the expiry tick at start ${start}`);
      assert.deepEqual(state, {});
      assert.deepEqual(advanceStatuses(state, start + duration + 1), []);

      const late = createStatusState(); applyStatus(late, element, start, 10);
      assert.ok(Math.abs(advanceStatuses(late, start + 100)[0].damage - total) < 1e-9);
    }
  }
});

test('corrosive reprocs cannot postpone ticks or downgrade an existing stronger acid effect', () => {
  const state = createStatusState();
  applyStatus(state, 'corrosive', 0, 10);
  applyStatus(state, 'corrosive', 0.9, 2);
  assert.deepEqual(advanceStatuses(state, 1), [{ damage: 6, effect: 'corrosive' }]);
  applyStatus(state, 'corrosive', 1.1, 20);
  assert.deepEqual(advanceStatuses(state, 2), [{ damage: 12, effect: 'corrosive' }]);
  assert.deepEqual(advanceStatuses(state, 10), [{ damage: 36, effect: 'corrosive' }]);
  assert.deepEqual(state, {});
});

test('ice slows, repeated procs briefly freeze, and both VFX and mechanics end at their own boundaries', () => {
  const state = createStatusState();
  applyStatus(state, 'ice', 0, 3);
  assert.equal(getStatusModifiers(state, 0).moveSpeed, 0.55);
  assert.equal(getStatusModifiers(state, 0).frozen, false);
  applyStatus(state, 'ice', 0.1, 3);
  assert.equal(getStatusModifiers(state, 0.89).frozen, true);
  assert.equal(getStatusModifiers(state, 0.89).moveSpeed, 0);
  assert.equal(getStatusModifiers(state, 0.9).frozen, false);
  assert.equal(getStatusModifiers(state, 0.9).moveSpeed, 0.55);
  assert.deepEqual(activeStatusElements(state, 3.1), []);
  assert.equal(getStatusModifiers(state, 3.1).moveSpeed, 1);
});

test('corrosive vulnerability, shock shield damage/chain, gravity pull, and adhesive slow have real independent modifiers', () => {
  const state = createStatusState();
  applyStatus(state, 'corrosive', 0, 3);
  applyStatus(state, 'shock', 0, 3);
  applyStatus(state, 'gravity', 0, 3);
  applyStatus(state, 'adhesive', 0, 3);
  assert.deepEqual(getStatusModifiers(state, 0), {
    moveSpeed: 0.6, incomingDamage: 1.3, shieldDamage: 1.6, frozen: false, pull: true, chain: true, radiationPulse: false,
  });
  assert.equal(getStatusModifiers(state, 2).chain, false);
  assert.equal(getStatusModifiers(state, 2).shieldDamage, 1);
  assert.equal(getStatusModifiers(state, 3).moveSpeed, 1);
  assert.equal(getStatusModifiers(state, 3).pull, false);
  assert.equal(getStatusModifiers(state, 4).incomingDamage, 1);
  const ticks = advanceStatuses(state, 5);
  assert.equal(ticks.length, 2, 'Acid and shock contribute DoT among these states');
  assert.ok(Math.abs(ticks.find(tick => tick.effect === 'corrosive')!.damage - 7.2) < 1e-9);
  assert.ok(Math.abs(ticks.find(tick => tick.effect === 'shock')!.damage - 4.8) < 1e-9);
  assert.deepEqual(state, {});
});

test('effect descriptions cover the complete public element catalog', () => {
  assert.deepEqual(Object.keys(elementEffectDescriptions).sort(), Object.keys(elementLabels).sort());
  assert.ok(Object.values(elementEffectDescriptions).every(description => description.length > 20));
});

test('the immutable element catalog and public helpers share exact combat potency, durations, and controls', () => {
  assert.equal(STATUS_TICK_INTERVAL, 0.5);
  assert.equal(Object.isFrozen(ELEMENT_STATUS), true);
  assert.deepEqual(Object.keys(ELEMENT_STATUS).sort(), Object.keys(elementLabels).sort());
  for (const element of Object.keys(ELEMENT_STATUS) as ElementType[]) {
    const info = ELEMENT_STATUS[element];
    assert.equal(Object.isFrozen(info), true);
    assert.equal(getStatusDuration(element), info.duration);
    assert.equal(getStatusDps(element, 10), info.dpsMultiplier * 10);
  }
  for (const element of ['kinetic', 'ice', 'gravity', 'adhesive'] as const) assert.equal(getStatusDps(element, 10), 0);
  for (const power of [NaN, Infinity, -1, 0, 1_000_001]) assert.equal(getStatusDps('shock', power), 0);
  assert.equal(getStatusDps('unknown' as ElementType, 10), 0);
  assert.equal(getStatusDuration('unknown' as ElementType), 0);
});

test('paused clocks hold status effects and invalid inputs cannot poison state', () => {
  const state = createStatusState();
  for (const element of ['kinetic', 'invalid', '__proto__'] as ElementType[]) assert.equal(applyStatus(state, element, 0, 3), false);
  for (const now of [NaN, Infinity, -1, Number.MAX_VALUE, Number.MAX_SAFE_INTEGER]) assert.equal(applyStatus(state, 'fire', now, 3), false);
  for (const power of [NaN, Infinity, -1, 0, 1_000_001]) assert.equal(applyStatus(state, 'fire', 0, power), false);
  assert.deepEqual(state, {});
  applyStatus(state, 'fire', 2, 5);
  const snapshot = structuredClone(state);
  for (let index = 0; index < 20; index++) assert.deepEqual(advanceStatuses(state, 2.25), []);
  assert.deepEqual(state, snapshot);
  assert.deepEqual(advanceStatuses(state, NaN), []);
  assert.deepEqual(state, snapshot);
  assert.deepEqual(activeStatusElements(state, Infinity), []);
  assert.equal(getStatusModifiers(state, NaN).moveSpeed, 1);
  assert.deepEqual(advanceStatuses(state, 2.5), [{ effect: 'fire', damage: 2.5 }]);
  const afterTick = structuredClone(state);
  for (let index = 0; index < 20; index++) assert.deepEqual(advanceStatuses(state, 2.5), []);
  assert.deepEqual(state, afterTick);
});

test('corrupt status entries are removed without emitting unsafe damage', () => {
  const state = { fire: { power: Infinity, expiresAt: 4, nextTickAt: 1, stacks: 1, frozenUntil: 0 } } as StatusState;
  assert.deepEqual(activeStatusElements(state, 1), []);
  assert.deepEqual(advanceStatuses(state, 1), []);
  assert.deepEqual(state, {});
});
