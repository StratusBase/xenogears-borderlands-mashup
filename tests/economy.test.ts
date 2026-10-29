import assert from 'node:assert/strict';
import test from 'node:test';
import { createProgression, deserializeProgression, rollItem, seededRandom, sellItem, serializeProgression } from '../src/core/index.ts';
import { creditWallet, getSupplyPrices, INVENTORY_CAPACITY, MAX_CREDITS, purchaseSupply, rollCashValue, spendCredits, type SupplyKind } from '../src/core/economy.ts';

test('cash rolls are bounded integers, scale with targets and level, and tolerate bad random values', () => {
  assert.equal(rollCashValue(1, false, () => 0.5), 12);
  assert.equal(rollCashValue(1, true, () => 0.5), 24);
  assert.ok(rollCashValue(10, false, () => 0.5) > rollCashValue(1, false, () => 0.5));
  for (const level of [-1, 0, 1, 50, 100, 10000, NaN, Infinity]) {
    for (const random of [-100, 0, 0.5, 1, 100, NaN, Infinity]) {
      const amount = rollCashValue(level, true, () => random);
      assert.ok(Number.isSafeInteger(amount) && amount >= 1 && amount <= 243);
    }
  }
  assert.equal(rollCashValue(1, false, () => { throw new Error('No entropy'); }), 12);
});

test('wallet collection and spending reject malformed amounts without changing the balance', () => {
  const state = createProgression();
  state.credits = 100;
  for (const amount of [-1, 0, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, MAX_CREDITS + 1]) {
    assert.equal(creditWallet(state, amount), false);
    assert.equal(spendCredits(state, amount), false);
    assert.equal(state.credits, 100);
  }
  assert.equal(creditWallet(state, 12), true);
  assert.equal(state.credits, 112);
  assert.equal(spendCredits(state, 113), false);
  assert.equal(state.credits, 112);
  assert.equal(spendCredits(state, 112), true);
  assert.equal(state.credits, 0);
});

test('wallet cap rejects the entire pickup or sale instead of silently losing money or equipment', () => {
  const state = createProgression();
  state.credits = MAX_CREDITS - 5;
  assert.equal(creditWallet(state, 6), false);
  assert.equal(state.credits, MAX_CREDITS - 5);
  const item = rollItem('pilot', 1, seededRandom(3));
  state.inventory.push(item);
  assert.equal(sellItem(state, item.id), false);
  assert.ok(state.inventory.includes(item));
  assert.equal(creditWallet(state, 5), true);
  assert.equal(state.credits, MAX_CREDITS);
  assert.equal(creditWallet(state, 1), false);
  assert.ok(deserializeProgression(serializeProgression(state)));
});

test('corrupt wallet balances are never repaired through an economic transaction', () => {
  for (const balance of [-1, 0.5, NaN, Infinity, MAX_CREDITS + 1]) {
    const state = createProgression();
    state.credits = balance;
    assert.equal(creditWallet(state, 1), false);
    assert.equal(spendCredits(state, 1), false);
    assert.equal(purchaseSupply(state, 'repair').ok, false);
    assert.equal(Object.is(state.credits, balance), true);
  }
});

test('supply prices have stable entry costs and bounded level scaling', () => {
  assert.deepEqual(getSupplyPrices(1), { repair: 25, pilotCache: 90, mechCache: 150 });
  const later = getSupplyPrices(10), initial = getSupplyPrices(1);
  assert.ok(later.repair > initial.repair && later.pilotCache > initial.pilotCache && later.mechCache > initial.mechCache);
  assert.deepEqual(getSupplyPrices(1000000), getSupplyPrices(100));
  for (const level of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => getSupplyPrices(level), RangeError);
});

test('cache purchase charges exactly once and grants one item for the correct loadout', () => {
  for (const [kind, target, price] of [['pilot-cache', 'pilot', 90], ['mech-cache', 'mech', 150]] as const) {
    const state = createProgression();
    state.credits = 500;
    const count = state.inventory.length;
    const loadouts = structuredClone(state.loadouts);
    const purchase = purchaseSupply(state, kind, 1, seededRandom(42));
    assert.equal(purchase.ok, true);
    assert.equal(purchase.spent, price);
    assert.equal(state.credits, 500 - price);
    assert.equal(state.inventory.length, count + 1);
    assert.equal(purchase.item?.target, target);
    assert.equal(state.inventory.at(-1), purchase.item);
    assert.deepEqual(state.loadouts, loadouts, 'Buying does not silently equip equipment');
    assert.deepEqual(deserializeProgression(serializeProgression(state)), state);
  }
});

test('every cache rarity and level resells for at most half its paid price without changing dropped gear', () => {
  for (const kind of ['pilot-cache', 'mech-cache'] as const) {
    for (const level of [1, 4, 8, 18, 50, 100, 1000000]) {
      for (const random of [0, 0.5, 0.8, 0.94, 0.99]) {
        const state = createProgression();
        state.credits = 100000;
        const initialCount = state.inventory.length;
        const purchase = purchaseSupply(state, kind, level, () => random);
        assert.equal(purchase.ok, true);
        assert.ok(purchase.item!.value <= Math.floor(purchase.spent * 0.5));
        const loaded = deserializeProgression(serializeProgression(state))!;
        assert.equal(loaded.inventory.at(-1)!.value, purchase.item!.value, 'Resale cap survives normal saves');
        assert.equal(sellItem(loaded, purchase.item!.id), true);
        assert.equal(loaded.inventory.length, initialCount);
        assert.ok(loaded.credits <= 100000 - Math.ceil(purchase.spent * 0.5), 'Buy-and-sell must always lose at least half the paid price');
      }
    }
  }
  assert.equal(rollItem('pilot', 100, () => 0, 'weapon').value, 1200, 'High-level world drops retain their original resale progression');
});

test('repair purchase only authorizes the service and does not add equipment', () => {
  const state = createProgression();
  state.credits = 25;
  const inventory = structuredClone(state.inventory);
  assert.deepEqual(purchaseSupply(state, 'repair', 1), { ok: true, spent: 25 });
  assert.equal(state.credits, 0);
  assert.deepEqual(state.inventory, inventory);
  assert.equal(purchaseSupply(state, 'repair', 1).ok, false);
});

test('insufficient funds, full inventory, invalid requests, and generation failures never charge', () => {
  const state = createProgression();
  state.credits = 89;
  let randomCalls = 0;
  const random = () => { randomCalls++; return 0.5; };
  assert.equal(purchaseSupply(state, 'pilot-cache', 1, random).ok, false);
  assert.equal(randomCalls, 0);
  assert.equal(state.credits, 89);
  state.credits = 1000;
  const before = serializeProgression(state);
  for (const level of [0, -1, 1.5, NaN, Infinity]) assert.equal(purchaseSupply(state, 'pilot-cache', level, random).ok, false);
  assert.equal(purchaseSupply(state, 'unknown' as SupplyKind, 1, random).ok, false);
  assert.equal(purchaseSupply(state, 'pilot-cache', 1, () => { throw new Error('Failed roll'); }).ok, false);
  assert.equal(serializeProgression(state), before);
  const seeded = seededRandom(81);
  while (state.inventory.length < INVENTORY_CAPACITY) state.inventory.push(rollItem('pilot', 1, seeded));
  const fullCount = state.inventory.length;
  assert.equal(purchaseSupply(state, 'mech-cache', 1, random).ok, false);
  assert.equal(state.credits, 1000);
  assert.equal(state.inventory.length, fullCount);
  assert.equal(randomCalls, 0);
  assert.equal(purchaseSupply(state, 'repair', 1).ok, true, 'Storage capacity does not prevent repairs');
});

test('a failed equipment delivery refunds payment in full', () => {
  const state = createProgression();
  state.credits = 150;
  Object.freeze(state.inventory);
  const result = purchaseSupply(state, 'mech-cache', 1, seededRandom(5));
  assert.equal(result.ok, false);
  assert.equal(result.spent, 0);
  assert.equal(state.credits, 150);
  assert.match(result.reason!, /refunded/);
});

test('version-one saves retain old balances and need no economy migration', () => {
  const old = createProgression();
  old.credits = 234;
  const raw = serializeProgression(old);
  assert.equal(JSON.parse(raw).version, 1);
  const loaded = deserializeProgression(raw)!;
  assert.equal(loaded.credits, 234);
  assert.equal(creditWallet(loaded, 24), true);
  assert.equal(purchaseSupply(loaded, 'pilot-cache', 1, seededRandom(9)).ok, true);
  assert.equal(loaded.credits, 168);
  assert.deepEqual(deserializeProgression(serializeProgression(loaded)), loaded);
});
