import assert from 'node:assert/strict';
import test from 'node:test';
import { EncounterDirector, ENCOUNTER, type EnemySpawn } from '../src/encounter/encounter.ts';

interface InstantRun { groups: readonly EnemySpawn[][]; rewardCount: number }

/** Complete every real objective immediately, without ever advancing the clock.
 * If a minimum-duration gate or delayed spawn is introduced, this walk stalls. */
function finishWithoutTime(director: EncounterDirector): InstantRun {
  assert.equal(director.start(), true);
  const groups: EnemySpawn[][] = [];
  let rewardCount = 0;
  for (let step = 0; step < 100; step++) {
    const actions = director.drainActions();
    rewardCount += actions.filter(action => action.type === 'reward').length;
    for (const action of actions) {
      if (action.type !== 'spawn') continue;
      assert.equal(action.enemies.length, 3, 'active combat stays bounded to one three-role squad');
      groups.push([...action.enemies]);
      for (const enemy of action.enemies) assert.equal(director.enemyKilled(enemy.id), true);
    }
    const { phase } = director.snapshot;
    if (phase === 'defenses') {
      for (const relay of ENCOUNTER.relays) assert.equal(director.disableRelay(relay.id, 'pilot', relay), true);
    } else if (phase === 'boarding') {
      director.update(0, { mode: 'mech', position: ENCOUNTER.battleEntry });
    } else if (phase === 'loot') {
      rewardCount += director.drainActions().filter(action => action.type === 'reward').length;
      assert.equal(director.collectReward('collected-inventory-upgrade'), true);
      assert.equal(director.snapshot.phase, 'complete');
      assert.equal(director.snapshot.elapsed, 0, 'combat/objectives, rather than a clock, determine completion');
      return { groups, rewardCount };
    }
  }
  throw new Error(`Zero-time objective walk stalled in ${director.snapshot.phase}`);
}

test('pacing comes from immediately advancing active squads, with no forced-time gate', () => {
  const director = new EncounterDirector(7);
  const result = finishWithoutTime(director);
  assert.equal(result.groups.length, ENCOUNTER.battleGroups + 2);
  assert.equal(result.rewardCount, 1);
  const enemies = result.groups.flat();
  assert.equal(enemies.length, 6 + 3 * ENCOUNTER.battleGroups);
  assert.equal(new Set(enemies.map(enemy => enemy.id)).size, enemies.length);
  assert.equal(director.snapshot.kills, enemies.length);
  assert.equal(enemies.filter(enemy => enemy.boss).length, 1);
  for (const squad of result.groups.slice(1, -1)) {
    assert.deepEqual(squad.map(enemy => enemy.role).sort(), ['flanker', 'heavy', 'rusher']);
  }
  assert.equal(director.enemyKilled('dummy'), false);
  assert.equal(director.collectReward('duplicate'), false);
});

test('the full active-combat budget repeats deterministically and does not escalate on replay', () => {
  const first = new EncounterDirector(8), second = new EncounterDirector(8);
  const firstRun = finishWithoutTime(first), secondRun = finishWithoutTime(second);
  assert.deepEqual(firstRun, secondRun, 'the entire run, including all later layouts, must reproduce');
  const replay = finishWithoutTime(first);
  const budget = (run: InstantRun) => run.groups.map(group => group.map(enemy => ({
    role: enemy.role, boss: enemy.boss, health: enemy.health, shield: enemy.shield,
  })));
  assert.deepEqual(budget(replay), budget(firstRun), 'earned gear must not trigger hidden difficulty escalation');
  assert.equal(new Set([...firstRun.groups.flat(), ...replay.groups.flat()].map(enemy => enemy.id)).size,
    2 * firstRun.groups.flat().length, 'replay enemies have fresh identities');
  assert.equal(first.snapshot.run, 2);
});
