import assert from 'node:assert/strict';
import test from 'node:test';
import { EncounterDirector, ENCOUNTER, type EnemySpawn } from '../src/encounter/encounter.ts';
import { createEncounterReward } from '../src/encounter/rewards.ts';
import { createProgression, deserializeProgression, equipItem, getStats, serializeProgression } from '../src/core/index.ts';

function takeSpawn(director: EncounterDirector): readonly EnemySpawn[] {
  return director.drainActions().flatMap(action => action.type === 'spawn' ? action.enemies : []);
}
function clear(director: EncounterDirector, enemies: readonly EnemySpawn[]): void {
  for (const enemy of enemies) assert.equal(director.enemyKilled(enemy.id), true);
}
function reachBoarding(director: EncounterDirector): void {
  assert.equal(director.start(), true);
  clear(director, takeSpawn(director));
  for (const relay of ENCOUNTER.relays) assert.equal(director.disableRelay(relay.id, 'pilot', relay), true);
  director.drainActions();
}

test('encounter stages require real sentry kills, two pilot interactions, and a mech at the east gate', () => {
  const director = new EncounterDirector(143);
  assert.equal(director.snapshot.phase, 'idle');
  assert.equal(director.disableRelay(ENCOUNTER.relays[0].id, 'pilot', ENCOUNTER.relays[0]), false);
  director.start();
  const sentries = takeSpawn(director);
  assert.equal(sentries.length, 3);
  assert.equal(director.start(), false);
  assert.equal(director.enemyKilled('dummy'), false);
  assert.equal(director.enemyKilled(sentries[0].id), true);
  assert.equal(director.enemyKilled(sentries[0].id), false, 'a duplicate death must never advance stages');
  assert.equal(director.snapshot.phase, 'infiltration');
  clear(director, sentries.slice(1));
  assert.equal(director.snapshot.phase, 'defenses');
  const relay = ENCOUNTER.relays[0];
  assert.equal(director.disableRelay(relay.id, 'mech', relay), false);
  assert.equal(director.disableRelay(relay.id, 'pilot', { x: 0, z: 0 }), false);
  assert.equal(director.disableRelay(relay.id, 'pilot', { x: NaN, z: NaN }), false);
  assert.equal(director.disableRelay('fabricated', 'pilot', relay), false);
  assert.equal(director.disableRelay(relay.id, 'pilot', relay), true);
  assert.equal(director.disableRelay(relay.id, 'pilot', relay), false);
  assert.equal(director.snapshot.phase, 'defenses');
  assert.equal(director.disableRelay(ENCOUNTER.relays[1].id, 'pilot', ENCOUNTER.relays[1]), true);
  assert.equal(director.snapshot.phase, 'boarding');
  director.update(0.1, { mode: 'pilot', position: ENCOUNTER.battleEntry });
  assert.equal(director.snapshot.phase, 'boarding');
  director.update(0.1, { mode: 'mech', position: ENCOUNTER.boarding });
  assert.equal(director.snapshot.phase, 'boarding');
  director.update(0.1, { mode: 'mech', position: { x: 34.5, z: 0 } });
  assert.equal(director.snapshot.phase, 'boarding', 'entry radius must not start battle before crossing the gate');
  director.update(0.1, { mode: 'mech', position: ENCOUNTER.battleEntry });
  assert.equal(director.snapshot.phase, 'battle');
  assert.equal(takeSpawn(director).length, 3);
});

test('bounded battle waves lead to one mini-boss reward and collection unlocks replay', () => {
  const director = new EncounterDirector(42);
  reachBoarding(director);
  director.update(0.1, { mode: 'mech', position: ENCOUNTER.battleEntry });
  for (let wave = 1; wave <= ENCOUNTER.battleGroups; wave++) {
    assert.equal(director.snapshot.phase, 'battle');
    assert.equal(director.snapshot.wave, wave);
    const squad = takeSpawn(director);
    assert.equal(squad.length, 3);
    assert.deepEqual(squad.map(enemy => enemy.role).sort(), ['flanker', 'heavy', 'rusher']);
    clear(director, squad);
  }
  assert.equal(director.snapshot.phase, 'boss');
  const finalGroup = takeSpawn(director);
  assert.equal(finalGroup.filter(enemy => enemy.boss).length, 1);
  const boss = finalGroup.find(enemy => enemy.boss)!;
  director.enemyKilled(boss.id);
  assert.equal(director.snapshot.phase, 'boss', 'adds are part of the final clear');
  clear(director, finalGroup.filter(enemy => !enemy.boss));
  assert.equal(director.snapshot.phase, 'loot');
  assert.equal(director.snapshot.kills, 6 + 3 * ENCOUNTER.battleGroups);
  const actions = director.drainActions();
  assert.equal(actions.filter(action => action.type === 'reward').length, 1);
  assert.equal(director.enemyKilled(boss.id), false);
  assert.equal(director.collectReward(''), false);
  assert.equal(director.start(), false, 'an uncollected upgrade cannot be silently discarded');
  assert.equal(director.collectReward('actual-inventory-item'), true);
  assert.equal(director.collectReward('actual-inventory-item'), false);
  assert.equal(director.snapshot.phase, 'complete');
  assert.equal(director.start(), true);
  assert.equal(director.snapshot.run, 2);
  assert.equal(director.snapshot.kills, 0);
  assert.equal(director.snapshot.disabledRelays.length, 0);
  assert.equal(director.enemyKilled(boss.id), false, 'stale kills from the previous run cannot advance replay');
});

test('reset clears transient encounter state and seed reproduces waves without scaling difficulty on replay', () => {
  const first = new EncounterDirector(6), second = new EncounterDirector(6);
  first.start(); second.start();
  const initialSpawns = takeSpawn(first);
  assert.deepEqual(initialSpawns, takeSpawn(second));
  first.update(0.25, { mode: 'pilot', position: { x: 0, z: 0 } });
  assert.equal(first.snapshot.elapsed, 0.25);
  first.update(NaN, { mode: 'pilot', position: { x: 0, z: 0 } });
  assert.equal(first.snapshot.elapsed, 0.25);
  first.reset();
  assert.equal(first.snapshot.phase, 'idle');
  assert.equal(first.snapshot.elapsed, 0);
  assert.equal(first.snapshot.remainingEnemies, 0);
  assert.equal(first.start(), true);
  assert.equal(takeSpawn(first)[0].health, initialSpawns[0].health);
});

test('guaranteed rewards improve practical stats, equip normally, and round-trip in version-one saves', () => {
  const state = createProgression();
  const initial = serializeProgression(state);
  for (let run = 1; run <= 6; run++) {
    const reward = createEncounterReward(state, run, 411);
    assert.equal(reward.rarity, 'rare');
    const before = getStats(state, reward.target);
    state.inventory.push(reward);
    assert.equal(equipItem(state, reward.id), true);
    const after = getStats(state, reward.target);
    if (reward.slot === 'reactor') assert.ok(after.cooling > before.cooling && after.heatCapacity > before.heatCapacity);
    else if (reward.slot === 'legs') assert.ok(after.moveSpeed > before.moveSpeed);
    else assert.ok(after.maxShield > before.maxShield);
    assert.deepEqual(deserializeProgression(serializeProgression(state)), state);
  }
  assert.notEqual(serializeProgression(state), initial);
  assert.equal(state.inventory.length, 12, 'rewards add items instead of replacing player equipment');
  assert.equal(state.version, 1);
  assert.equal(state.credits, 0);
  assert.equal(state.kills, 0);
});

test('reward generation does not mutate the prior inventory or loadout', () => {
  const state = createProgression();
  const previous = serializeProgression(state);
  createEncounterReward(state, 1, 123);
  assert.equal(serializeProgression(state), previous);
});
