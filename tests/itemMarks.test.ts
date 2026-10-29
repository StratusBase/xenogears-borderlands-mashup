import assert from 'node:assert/strict';
import test from 'node:test';
import { canSellItem, createProgression, deserializeProgression, equipItem, getJunkSaleSummary, getStats, isItemEquipped, MAX_CREDITS, rollItem, seededRandom, sellItem, sellJunk, serializeProgression, setItemMark, type Item } from '../src/core/index.ts';

function spare(state: ReturnType<typeof createProgression>, value = 25): Item {
  const item = rollItem('pilot', 1, seededRandom(state.inventory.length), 'weapon');
  item.value = value;
  state.inventory.push(item);
  return item;
}

test('favorite and junk marks are exclusive, reversible, and preserve combat stats across saves', () => {
  const state = createProgression();
  const item = spare(state);
  const stats = getStats(state, 'pilot');
  assert.equal(setItemMark(state, item.id, 'favorite'), true);
  assert.equal(item.mark, 'favorite');
  assert.equal(canSellItem(state, item.id), false);
  assert.equal(sellItem(state, item.id), false);
  assert.equal(setItemMark(state, item.id, 'junk'), true);
  assert.equal(item.mark, 'junk');
  assert.equal(canSellItem(state, item.id), true);
  const loaded = deserializeProgression(serializeProgression(state))!;
  assert.equal(loaded.inventory.at(-1)!.mark, 'junk');
  assert.deepEqual(getStats(loaded, 'pilot'), stats);
  assert.equal(setItemMark(state, item.id, null), true);
  assert.equal(Object.hasOwn(item, 'mark'), false);
  assert.equal(setItemMark(state, 'missing', 'favorite'), false);
  assert.equal(setItemMark(state, item.id, 'unknown' as 'junk'), false);
});

test('equipped items reject junk marks, remain protected from sale, and equipping junk clears its mark', () => {
  const state = createProgression();
  const original = state.loadouts.pilot.weapon!;
  assert.equal(isItemEquipped(state, original), true);
  assert.equal(setItemMark(state, original, 'junk'), false);
  assert.equal(setItemMark(state, original, 'favorite'), true);
  const item = spare(state);
  setItemMark(state, item.id, 'junk');
  assert.equal(equipItem(state, item.id), true);
  assert.equal(item.mark, undefined);
  assert.equal(isItemEquipped(state, item.id), true);
  assert.equal(canSellItem(state, item.id), false);
  assert.equal(sellItem(state, item.id), false);
  assert.equal(sellItem(state, original), false, 'An unequipped favorite still needs explicit unmarking');
  setItemMark(state, original, null);
  assert.equal(sellItem(state, original), true);
  assert.equal(state.inventory.some(candidate => candidate.id === original), false);
  assert.equal(state.credits, 12);
});

test('bulk junk selling removes only unprotected marked gear and pays exactly once', () => {
  const state = createProgression();
  const junkA = spare(state, 25), junkB = spare(state, 40), favorite = spare(state, 200), normal = spare(state, 70);
  setItemMark(state, junkA.id, 'junk'); setItemMark(state, junkB.id, 'junk'); setItemMark(state, favorite.id, 'favorite');
  const equipped = state.inventory.find(item => item.id === state.loadouts.mech.weapon)!;
  equipped.mark = 'junk'; // A hand-authored state must not bypass equipped protection.
  state.credits = 10;
  assert.deepEqual(getJunkSaleSummary(state), { count: 2, value: 65, canSell: true });
  assert.deepEqual(sellJunk(state), { sold: 2, earned: 65 });
  assert.equal(state.credits, 75);
  assert.ok(state.inventory.includes(favorite) && state.inventory.includes(normal) && state.inventory.includes(equipped));
  assert.ok(!state.inventory.includes(junkA) && !state.inventory.includes(junkB));
  assert.deepEqual(sellJunk(state), { sold: 0, earned: 0 });
  assert.equal(state.credits, 75);
});

test('bulk selling is all-or-nothing at the wallet cap and on malformed values', () => {
  const state = createProgression();
  const a = spare(state, 10), b = spare(state, 20);
  setItemMark(state, a.id, 'junk'); setItemMark(state, b.id, 'junk');
  state.credits = MAX_CREDITS - 25;
  const before = serializeProgression(state);
  assert.deepEqual(getJunkSaleSummary(state), { count: 2, value: 30, canSell: false });
  assert.deepEqual(sellJunk(state), { sold: 0, earned: 0 });
  assert.equal(serializeProgression(state), before);
  state.credits = MAX_CREDITS - 30;
  assert.deepEqual(sellJunk(state), { sold: 2, earned: 30 });
  assert.equal(state.credits, MAX_CREDITS);

  const corrupt = createProgression();
  const good = spare(corrupt, 10), bad = spare(corrupt, NaN);
  setItemMark(corrupt, good.id, 'junk'); setItemMark(corrupt, bad.id, 'junk');
  assert.deepEqual(sellJunk(corrupt), { sold: 0, earned: 0 });
  assert.ok(corrupt.inventory.includes(good) && corrupt.inventory.includes(bad));
  assert.equal(corrupt.credits, 0);
});

test('readonly transaction properties prevent both individual and bulk partial sales', () => {
  for (const property of ['credits', 'inventory']) {
    const state = createProgression();
    const item = spare(state);
    setItemMark(state, item.id, 'junk');
    Object.defineProperty(state, property, { writable: false });
    assert.equal(canSellItem(state, item.id), false);
    assert.equal(sellItem(state, item.id), false);
    assert.deepEqual(sellJunk(state), { sold: 0, earned: 0 });
    assert.equal(state.credits, 0);
    assert.ok(state.inventory.includes(item));
  }
});

test('legacy and malformed mark metadata recover independently without erasing gear, money, or checkpoints', () => {
  const state = createProgression();
  state.credits = 4321;
  state.checkpoint = { id: 'yard-crossing', mode: 'mech' };
  const favorite = spare(state), junk = spare(state);
  setItemMark(state, favorite.id, 'favorite'); setItemMark(state, junk.id, 'junk');
  assert.deepEqual(deserializeProgression(serializeProgression(state)), state);
  const raw = JSON.parse(serializeProgression(state));
  raw.inventory[0].mark = 'junk';
  raw.inventory[1].mark = { favorite: true };
  raw.vendingPurchases = { wave: -3, offerIds: ['not-valid'] };
  const loaded = deserializeProgression(JSON.stringify(raw))!;
  assert.ok(loaded);
  assert.equal(loaded.inventory[0].mark, undefined, 'Loaded equipped junk becomes ordinary equipped gear');
  assert.equal(loaded.inventory[1].mark, undefined);
  assert.equal(loaded.inventory.find(item => item.id === favorite.id)?.mark, 'favorite');
  assert.equal(loaded.inventory.find(item => item.id === junk.id)?.mark, 'junk');
  assert.equal(loaded.credits, state.credits);
  assert.deepEqual(loaded.checkpoint, state.checkpoint);
  assert.deepEqual(loaded.loadouts, state.loadouts);
  assert.equal(loaded.vendingPurchases, undefined);
  for (const item of raw.inventory) delete item.mark;
  delete raw.vendingPurchases;
  const legacy = deserializeProgression(JSON.stringify(raw))!;
  assert.ok(legacy && legacy.inventory.every(item => item.mark === undefined));
  assert.deepEqual(legacy.inventory.map(item => item.stats), state.inventory.map(item => item.stats));
  assert.equal(legacy.credits, state.credits);
});
