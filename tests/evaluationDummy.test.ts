import assert from 'node:assert/strict';
import test from 'node:test';
import { createProgression, type Mode } from '../src/core/index.ts';
import { createWorkbenchWeapon, normalizeWorkbenchConfig } from '../src/core/workbench.ts';
import { simulateDummy } from '../src/diagnostics/dummySimulation.ts';

function fixture(projectile: 'beam' | 'bullet' | 'arc' = 'bullet', mode: Mode = 'pilot', element: 'kinetic' | 'fire' = 'kinetic') {
  const state = createProgression();
  const weapon = createWorkbenchWeapon(normalizeWorkbenchConfig({ projectile, target: mode, element, guaranteedStatus: true }));
  state.inventory.push(weapon); state.loadouts[mode].weapon = weapon.id;
  return state;
}

test('dummy baseline replays byte-identically and conserves ammunition without mutating loadouts or leaking DOM', () => {
  const state = fixture('bullet'), before = JSON.stringify(state), originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const options = { state, mode: 'pilot' as const, seed: 42, duration: 4, drainSeconds: 1 };
  const a = simulateDummy(options), b = simulateDummy(options);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'document'), originalDocument);
  assert.equal(a.magazineRemaining + a.reserveRemaining + a.ammoUsed, 30 + 240);
  assert.equal(a.totalDamage, a.directDamage + a.statusDamage);
  assert.equal(a.targetTtk, null);
  assert.equal(a.damageReceived, 0);
  assert.equal(a.provenance, 'simulated');
});

test('real critical regions and released-trigger damage are distinct from body direct damage', () => {
  const state = fixture('beam');
  const body = simulateDummy({ state, mode: 'pilot', seed: 9, duration: 1, drainSeconds: 0, distance: 5 });
  const critical = simulateDummy({ state, mode: 'pilot', seed: 9, duration: 1, drainSeconds: 0, distance: 5, criticalAim: true });
  assert.ok(critical.criticalDamage > body.criticalDamage);
  assert.ok(critical.totalDamage > body.totalDamage);
  const fire = simulateDummy({ state: fixture('beam', 'pilot', 'fire'), mode: 'pilot', seed: 4, duration: 1, drainSeconds: 5, distance: 5 });
  assert.ok(fire.statusDamage > 0);
  assert.ok(fire.totalDamage > fire.firingWindowDps * fire.firingSeconds);
  assert.equal(fire.practicalDps, fire.totalDamage / fire.durationSeconds);
});

test('actual arc cutoff creates a near/far practical damage tradeoff', () => {
  const state = fixture('arc');
  const near = simulateDummy({ state, mode: 'pilot', seed: 2, duration: 1, drainSeconds: 0, distance: 12 });
  const far = simulateDummy({ state, mode: 'pilot', seed: 2, duration: 1, drainSeconds: 0, distance: 30 });
  assert.ok(near.totalDamage > 0);
  assert.equal(far.totalDamage, 0);
  assert.equal(near.shots, far.shots);
});

test('rolled elemental procs replay from the supplied seed while seed variation changes status output', () => {
  const state = fixture('beam', 'pilot', 'fire');
  state.inventory.find(item => item.id === state.loadouts.pilot.weapon)!.weapon!.statusChance = 0.35;
  const a = simulateDummy({ state, mode: 'pilot', seed: 11, duration: 3, drainSeconds: 5, distance: 5 });
  const replay = simulateDummy({ state, mode: 'pilot', seed: 11, duration: 3, drainSeconds: 5, distance: 5 });
  const b = simulateDummy({ state, mode: 'pilot', seed: 27, duration: 3, drainSeconds: 5, distance: 5 });
  assert.deepEqual(a, replay);
  assert.equal(a.shots, b.shots);
  assert.notEqual(a.statusDamage, b.statusDamage);
});

test('mech heat locks count trigger-blocked time and sustained fire includes reload and finite reserve', () => {
  const state = fixture('beam', 'mech');
  const result = simulateDummy({ state, mode: 'mech', seed: 3, duration: 30, drainSeconds: 0 });
  assert.ok(result.heatBlockedSeconds > 0);
  assert.ok(result.reloadSeconds > 0);
  assert.equal(result.magazineRemaining + result.reserveRemaining + result.ammoUsed, 18 + 144);
  assert.ok(result.heatBlockedSeconds <= result.durationSeconds);
});

test('invalid clocks, seeds, and distance are rejected before fixture setup', () => {
  const state = fixture();
  for (const change of [{ seed: -1 }, { duration: NaN }, { duration: 0 }, { drainSeconds: -1 }, { distance: Infinity }]) {
    assert.throws(() => simulateDummy({ state, mode: 'pilot', seed: 1, ...change }), RangeError);
  }
});
