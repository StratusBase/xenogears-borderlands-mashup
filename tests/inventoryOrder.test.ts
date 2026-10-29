import test from 'node:test';
import assert from 'node:assert/strict';
import type { Rarity } from '../src/core/index.ts';
import { sortInventoryItems } from '../src/core/inventoryOrder.ts';

const entry = (id: string, rarity: Rarity, level: number, name = id) => ({ id, rarity, level, name });

test('inventory sorts rarity before level and then level descending within a rarity', () => {
  const items = [entry('common-high', 'common', 90), entry('rare-low', 'rare', 1), entry('epic', 'epic', 2),
    entry('legendary', 'legendary', 1), entry('rare-high', 'rare', 50), entry('uncommon', 'uncommon', 70)];
  assert.deepEqual(sortInventoryItems(items).map(item => item.id), ['legendary', 'epic', 'rare-high', 'rare-low', 'uncommon', 'common-high']);
});

test('equal quality and level resolve by name and then ID, independent of input order', () => {
  const items = [entry('z', 'rare', 5, 'Bravo'), entry('second', 'rare', 5, 'Alpha'), entry('first', 'rare', 5, 'Alpha')];
  assert.deepEqual(sortInventoryItems(items).map(item => item.id), ['first', 'second', 'z']);
  assert.deepEqual(sortInventoryItems([...items].reverse()).map(item => item.id), ['first', 'second', 'z']);
});

test('sorting never mutates the inventory array or equipment objects', () => {
  const first = Object.freeze(entry('first', 'common', 1));
  const second = Object.freeze(entry('second', 'epic', 1));
  const inventory = Object.freeze([first, second]);
  const sorted = sortInventoryItems(inventory);
  assert.notEqual(sorted, inventory);
  assert.deepEqual(inventory.map(item => item.id), ['first', 'second']);
  assert.equal(sorted[0], second);
  assert.equal(sorted[1], first);
});
