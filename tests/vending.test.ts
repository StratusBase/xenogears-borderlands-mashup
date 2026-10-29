import assert from 'node:assert/strict';
import test from 'node:test';
import { createProgression, deserializeProgression, INVENTORY_CAPACITY, MAX_CREDITS, sellItem, serializeProgression } from '../src/core/index.ts';
import { getVendingOffers, getVendingServicePrices, purchaseVendingItem, type VendingType } from '../src/core/vending.ts';

const types: VendingType[] = ['weapons', 'medical', 'mech'];

test('vendor stock is deterministic, independent of wallet and view calls, and scoped to the correct gear', () => {
  const state = createProgression();
  const before = serializeProgression(state);
  const ids = new Set<string>();
  for (const type of types) {
    const first = getVendingOffers(state, type), second = getVendingOffers(state, type);
    assert.deepEqual(second, first);
    assert.equal(first.length, 6);
    assert.equal(new Set(first.map(offer => offer.id)).size, 6);
    for (const offer of first) {
      assert.equal(offer.item.id, offer.id);
      assert.equal(offer.item.target, type === 'mech' ? 'mech' : 'pilot');
      if (type !== 'mech') assert.equal(offer.item.slot, type === 'weapons' ? 'weapon' : 'shield');
      assert.ok(Number.isSafeInteger(offer.price) && offer.price > 0);
      assert.ok(offer.item.value <= Math.floor(offer.price * 0.5));
      ids.add(offer.id);
    }
    if (type === 'mech') assert.deepEqual([...new Set(first.map(offer => offer.item.slot))].sort(), ['legs', 'reactor', 'shield', 'weapon']);
    const rich = { ...state, credits: MAX_CREDITS, kills: 500 };
    assert.deepEqual(getVendingOffers(rich, type), first);
    first[0].price = 1; first[0].item.stats.maxHealth = 99_999;
    assert.deepEqual(getVendingOffers(state, type), second, 'Returned display objects cannot alter future stock or prices');
  }
  assert.equal(ids.size, 18);
  assert.equal(serializeProgression(state), before);
});

test('new waves refresh stock and unique IDs while generated item levels stay within their cap', () => {
  const state = createProgression();
  const first = getVendingOffers(state, 'weapons');
  state.wave = 2;
  const second = getVendingOffers(state, 'weapons');
  assert.ok(second.every(offer => offer.item.level === 2 && !first.some(old => old.id === offer.id)));
  assert.notDeepEqual(second.map(offer => offer.item.stats), first.map(offer => offer.item.stats));
  state.wave = 1_000_000;
  assert.ok(getVendingOffers(state, 'mech').every(offer => offer.item.level === 100));
});

test('buying delivers the exact advertised item, charges once, and preserves the equipped loadout', () => {
  for (const type of types) {
    const state = createProgression(); state.credits = 1000;
    const offer = getVendingOffers(state, type)[0];
    const loadouts = structuredClone(state.loadouts);
    const count = state.inventory.length;
    const purchase = purchaseVendingItem(state, type, offer.id);
    assert.equal(purchase.ok, true);
    assert.equal(purchase.spent, offer.price);
    assert.deepEqual(purchase.item, offer.item);
    assert.equal(state.credits, 1000 - offer.price);
    assert.equal(state.inventory.length, count + 1);
    assert.equal(state.inventory.at(-1), purchase.item);
    assert.deepEqual(state.loadouts, loadouts);
    assert.ok(!getVendingOffers(state, type).some(candidate => candidate.id === offer.id));
    assert.equal(purchaseVendingItem(state, type, offer.id).ok, false);
    assert.deepEqual(deserializeProgression(serializeProgression(state)), state);
  }
});

test('the bounded purchase book prevents rebuying all sold stock after saving, and resets only for a new wave', () => {
  let state = createProgression(); state.credits = 100_000;
  const purchased: { type: VendingType; id: string }[] = [];
  for (const type of types) {
    for (const offer of getVendingOffers(state, type)) {
      const purchase = purchaseVendingItem(state, type, offer.id);
      assert.equal(purchase.ok, true);
      const beforeSale = state.credits;
      assert.equal(sellItem(state, offer.id), true);
      assert.ok(state.credits - beforeSale <= Math.floor(purchase.spent * 0.5));
      purchased.push({ type, id: offer.id });
    }
    assert.deepEqual(getVendingOffers(state, type), []);
  }
  assert.equal(state.vendingPurchases?.offerIds.length, 18);
  state = deserializeProgression(serializeProgression(state))!;
  const before = serializeProgression(state);
  for (const { type, id } of purchased) assert.equal(purchaseVendingItem(state, type, id).ok, false);
  assert.equal(serializeProgression(state), before);
  state.wave++;
  assert.equal(getVendingOffers(state, 'weapons').length, 6);
  const next = getVendingOffers(state, 'weapons')[0];
  assert.equal(purchaseVendingItem(state, 'weapons', next.id).ok, true);
  assert.deepEqual(state.vendingPurchases, { wave: 2, offerIds: [next.id] });
});

test('unknown IDs, wrong vendors, insufficient money, and full storage never charge or reserve stock', () => {
  const state = createProgression();
  const offer = getVendingOffers(state, 'weapons')[0];
  state.credits = offer.price - 1;
  let before = serializeProgression(state);
  assert.equal(purchaseVendingItem(state, 'weapons', offer.id).ok, false);
  assert.equal(serializeProgression(state), before);
  state.credits = 1000;
  before = serializeProgression(state);
  for (const [type, id] of [['medical', offer.id], ['unknown', offer.id], ['weapons', 'vending:1:weapons:6'], ['weapons', 'vending:2:weapons:0']] as const) {
    assert.equal(purchaseVendingItem(state, type as VendingType, id).ok, false);
    assert.equal(serializeProgression(state), before);
  }
  const prototype = state.inventory[0];
  while (state.inventory.length < INVENTORY_CAPACITY) state.inventory.push({ ...prototype, id: `capacity-${state.inventory.length}` });
  before = serializeProgression(state);
  assert.equal(purchaseVendingItem(state, 'weapons', offer.id).ok, false);
  assert.equal(serializeProgression(state), before);
});

test('malformed balances, readonly delivery properties, and invalid stock levels cannot partially commit a purchase', () => {
  for (const balance of [NaN, Infinity, -1, 1.5, MAX_CREDITS + 1]) {
    const state = createProgression(); state.credits = balance;
    const offer = getVendingOffers(state, 'weapons')[0];
    const count = state.inventory.length;
    assert.equal(purchaseVendingItem(state, 'weapons', offer.id).ok, false);
    assert.ok(Object.is(state.credits, balance));
    assert.equal(state.inventory.length, count);
    assert.equal(state.vendingPurchases, undefined);
  }
  for (const property of ['inventory', 'credits', 'vendingPurchases']) {
    const state = createProgression(); state.credits = 1000;
    const offer = getVendingOffers(state, 'weapons')[0];
    Object.defineProperty(state, property, { value: state[property as keyof typeof state], writable: false, enumerable: true });
    const before = serializeProgression(state);
    assert.equal(purchaseVendingItem(state, 'weapons', offer.id).ok, false);
    assert.equal(serializeProgression(state), before);
  }
  for (const wave of [0, -1, 1.5, NaN, Infinity, 1_000_001]) {
    const state = createProgression(); state.wave = wave; state.credits = 1000;
    assert.deepEqual(getVendingOffers(state, 'weapons'), []);
    assert.equal(purchaseVendingItem(state, 'weapons', 'vending:1:weapons:0').ok, false);
    assert.equal(state.credits, 1000);
  }
});

test('purchase metadata repairs independently, deduplicates valid entries, and cannot reserve unrelated stock', () => {
  const state = createProgression(); state.credits = 777;
  const raw = JSON.parse(serializeProgression(state));
  raw.vendingPurchases = { wave: 1, offerIds: ['vending:1:weapons:0', null, 'vending:1:weapons:0', 'vending:1:mech:5', 'vending:1:mech:6', 'vending:2:weapons:1', '__proto__'] };
  const loaded = deserializeProgression(JSON.stringify(raw))!;
  assert.ok(loaded);
  assert.deepEqual(loaded.vendingPurchases, { wave: 1, offerIds: ['vending:1:weapons:0', 'vending:1:mech:5'] });
  assert.equal(getVendingOffers(loaded, 'weapons').length, 5);
  assert.equal(getVendingOffers(loaded, 'medical').length, 6);
  assert.equal(getVendingOffers(loaded, 'mech').length, 5);
  assert.deepEqual(loaded.inventory, state.inventory);
  assert.equal(loaded.credits, 777);
  for (const metadata of [null, [], {}, { wave: -1, offerIds: [] }, { wave: 2, offerIds: [] }, { wave: 1, offerIds: 'bad' }]) {
    raw.vendingPurchases = metadata;
    const recovered = deserializeProgression(JSON.stringify(raw))!;
    assert.ok(recovered);
    assert.equal(recovered.vendingPurchases, undefined);
    assert.equal(recovered.credits, 777);
    assert.deepEqual(recovered.inventory, state.inventory);
  }
});

test('service prices use separate ammo and repair costs with bounded valid level scaling', () => {
  const initial = getVendingServicePrices(1);
  assert.deepEqual(initial, { pilotAmmo: 12, mechAmmo: 20, medical: 25, mechRepair: 45 });
  const later = getVendingServicePrices(10);
  for (const key of Object.keys(initial) as (keyof typeof initial)[]) {
    assert.ok(later[key] > initial[key]);
    assert.ok(Number.isSafeInteger(later[key]));
  }
  assert.deepEqual(getVendingServicePrices(1_000_000), getVendingServicePrices(100));
  for (const level of [0, -1, 0.5, NaN, Infinity]) assert.throws(() => getVendingServicePrices(level), RangeError);
});
