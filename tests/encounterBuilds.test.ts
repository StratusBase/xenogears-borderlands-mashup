import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { getStats, seededRandom, type Mode } from '../src/core/index.ts';
import { createEvaluationFixture, type EvaluationBuildId } from '../src/diagnostics/fixtures.ts';
import { getWeaponSpec, getWeaponElements } from '../src/core/arsenal.ts';
import { applyEnemyDamage, shieldAdjustedDamage } from '../src/core/combat.ts';
import { applyStatus, advanceStatuses, createStatusState, getStatusModifiers } from '../src/core/statusEffects.ts';
import { reloadAmmo, ammoReserveCapacity } from '../src/core/ammo.ts';
import { createWorld, getZone, isWalkable } from '../src/world.ts';
import { EncounterDirector, ENCOUNTER, type EnemySpawn } from '../src/encounter/encounter.ts';
import { createEnemyBrain, updateEnemyBrain, staggerEnemy } from '../src/encounter/enemyBehavior.ts';
import { DEFAULT_WEAPON_BALANCE, effectiveProjectileDamage, heatPerShot, heatRecoveryFraction } from '../src/core/weaponBalance.ts';

/** Resource/completion smoke model, NOT live pacing evidence: 68% hit chance, 7s fire / 5s cover, 30% exposed-core aim.
 * Uses actual weapon, status, shield, heat, magazine and AI timing functions. Geometric aim,
 * splash/chain, pickup paths and incoming-projectile dodge are deliberately not claimed. */
function model(kind: EvaluationBuildId, seed = 7381) {
  const state = createEvaluationFixture(kind).state, random = seededRandom(seed), director = new EncounterDirector(seed);
  const pilot = getStats(state, 'pilot'), mech = getStats(state, 'mech');
  let now = 0, shots = 0, reloads = 0, heatBlocked = 0, statusDamage = 0, directDamage = 0, ammoCaches = 0;
  let mode: Mode = 'pilot';
  let stats = pilot, heat = 0, overheated = false, ammo = stats.magazine, reserve = ammoReserveCapacity(mode, stats.magazine);
  let nextShot = 0, reloadUntil = 0;
  let enemies: { spawn: EnemySpawn; health: number; maxHealth: number; shield: number; maxShield: number;
    brain: ReturnType<typeof createEnemyBrain>; statuses: ReturnType<typeof createStatusState> }[] = [];
  function resupply() { reserve = ammoReserveCapacity(mode, stats.magazine); ammoCaches++; }
  function actions() {
    for (const action of director.drainActions()) if (action.type === 'spawn') {
      // Each battle group has an ammunition cache in this model; report the requirement to the integration owner.
      if (mode === 'mech') resupply();
      enemies.push(...action.enemies.map((spawn, index) => ({ spawn, health: spawn.health, maxHealth: spawn.health,
        shield: spawn.shield, maxShield: spawn.shield, brain: createEnemyBrain(spawn.role, spawn.boss, index), statuses: createStatusState() })));
    }
  }
  director.start(); actions();
  // Walking between the existing zones and finding/interacting with terminals is an explicit model assumption.
  const travel = 84 / (pilot.moveSpeed * 1.2) + 83 / (mech.moveSpeed * 1.2) + 22;
  while (director.snapshot.phase !== 'loot' && now < 1200) {
    const dt = 0.05; now += dt;
    if (director.snapshot.phase === 'defenses') {
      for (const relay of ENCOUNTER.relays) director.disableRelay(relay.id, 'pilot', relay);
    }
    if (director.snapshot.phase === 'boarding') {
      mode = 'mech'; stats = mech; ammo = stats.magazine; heat = 0; overheated = false; reloadUntil = 0;
      director.update(dt, { mode, position: ENCOUNTER.battleEntry }); actions();
    }
    heat = Math.max(0, heat - stats.cooling * dt);
    if (overheated && heat < stats.heatCapacity * heatRecoveryFraction(mode, DEFAULT_WEAPON_BALANCE)) overheated = false;
    if (overheated) heatBlocked += dt;
    if (reloadUntil && now >= reloadUntil) { ({ ammo, reserve } = reloadAmmo(ammo, reserve, stats.magazine)); reloadUntil = 0; }
    const exposed = now % 12 < 7;
    for (const enemy of enemies) {
      // A fixed clear range makes AI timings deterministic; this is not a navigation simulation.
      const decision = updateEnemyBrain(enemy.brain, { dt, position: { x: 18, z: 0 }, player: { x: 0, z: 0 }, hasLineOfSight: exposed });
      for (const tick of advanceStatuses(enemy.statuses, now)) {
        const modifiers = getStatusModifiers(enemy.statuses, now);
        const result = applyEnemyDamage(enemy, shieldAdjustedDamage(enemy.shield, tick.damage * modifiers.incomingDamage, modifiers.shieldDamage));
        statusDamage += result.healthDamage + result.shieldDamage;
      }
      if (enemy.health <= 0) continue;
      // Rusher remains mobile in the real encounter; only heavy recovery matters for this damage model.
      enemy.brain.hitReaction = decision.presentation.hitReaction;
    }
    const target = enemies.find(enemy => enemy.health > 0);
    if (target && exposed && now >= nextShot && !reloadUntil && !overheated) {
      if (ammo === 0) { reloads++; reloadUntil = now + stats.reload; }
      else {
        ammo--; shots++; nextShot = now + 1 / stats.fireRate;
        heat += heatPerShot(mode, stats.fireRate, DEFAULT_WEAPON_BALANCE); if (heat >= stats.heatCapacity) overheated = true;
        const spec = getWeaponSpec(state.inventory.find(item => item.id === state.loadouts[mode].weapon));
        const projectileDamage = effectiveProjectileDamage(stats.damage, spec, DEFAULT_WEAPON_BALANCE);
        for (let pellet = 0; pellet < spec.pellets; pellet++) {
          if (random() >= 0.68) continue;
          const weak = target.spawn.role !== 'heavy' ? random() < 0.2
            : (target.brain.phase === 'recover' || target.brain.phase === 'stagger') && random() < 0.3;
          const coreOpen = target.brain.phase === 'recover' || target.brain.phase === 'stagger';
          const guard = target.spawn.role === 'heavy' ? coreOpen ? 1.15 : target.shield > 0 ? 0.55 : 1 : 1;
          for (const element of getWeaponElements(spec)) if (element !== 'kinetic' && random() < spec.statusChance) {
            applyStatus(target.statuses, element, now, projectileDamage * spec.statusPower);
          }
          const modifiers = getStatusModifiers(target.statuses, now);
          const damage = projectileDamage * guard * (weak ? target.spawn.role === 'heavy' ? 2.2 : 1.7 : 1) * modifiers.incomingDamage;
          const result = applyEnemyDamage(target, shieldAdjustedDamage(target.shield, damage, modifiers.shieldDamage));
          directDamage += result.healthDamage + result.shieldDamage;
          staggerEnemy(target.brain, weak);
        }
      }
    }
    const dead = enemies.filter(enemy => enemy.health <= 0);
    enemies = enemies.filter(enemy => enemy.health > 0);
    for (const enemy of dead) director.enemyKilled(enemy.spawn.id);
    actions();
    if (reserve === 0 && ammo === 0) throw new Error(`${kind}: exhausted ammunition at ${director.snapshot.phase}`);
  }
  return { kind, seconds: Math.round(now + travel), combatSeconds: Math.round(now), shots, reloads,
    heatBlocked: Math.round(heatBlocked), statusDamage: Math.round(statusDamage), directDamage: Math.round(directDamage),
    ammoCaches, kills: director.snapshot.kills, phase: director.snapshot.phase };
}

test('the three tested level-five builds retain finite-ammo completion and distinct elemental behavior', t => {
  const results = (['mobile-precision', 'elemental-pressure', 'heavy-control'] as const).map(kind => model(kind));
  for (const result of results) {
    t.diagnostic(JSON.stringify({ validation: 'resource-smoke-model-not-live-pacing', ...result }));
    assert.equal(result.phase, 'loot');
    assert.equal(result.kills, 6 + 3 * ENCOUNTER.battleGroups);
    assert.equal(result.ammoCaches, ENCOUNTER.battleGroups + 1);
    // Actual 180–300s acceptance comes from fresh browser Game-loop evidence.
    // This policy invents cover/aim assumptions and must not stand in for it.
    assert.ok(Number.isFinite(result.seconds) && result.combatSeconds < 1200);
    assert.ok(result.shots > 40 && result.reloads > 0);
  }
  assert.equal(results[0].statusDamage, 0);
  assert.ok(results[1].statusDamage > 0 && results[2].statusDamage > 0);
  assert.ok(new Set(results.map(result => result.seconds)).size === 3, 'builds must make a practical difference');
  assert.deepEqual(model('elemental-pressure'), results[1], 'same combat seed must reproduce the model');
});

test('all encounter spawn footprints and interaction approaches fit the actual world for either flank seed', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ width: 0, height: 0,
    getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } });
  let world: ReturnType<typeof createWorld>;
  try { world = createWorld(new THREE.Scene()); }
  finally { if (original) Object.defineProperty(globalThis, 'document', original); else Reflect.deleteProperty(globalThis, 'document'); }
  try {
    for (const seed of [1, 2]) {
      const director = new EncounterDirector(seed); director.start();
      const spawned: EnemySpawn[] = [];
      while (director.snapshot.phase !== 'loot') {
        const batch = director.drainActions().flatMap(action => action.type === 'spawn' ? action.enemies : []);
        spawned.push(...batch);
        for (const enemy of batch) director.enemyKilled(enemy.id);
        if (director.snapshot.phase === 'defenses') for (const relay of ENCOUNTER.relays) director.disableRelay(relay.id, 'pilot', relay);
        if (director.snapshot.phase === 'boarding') director.update(0.1, { mode: 'mech', position: ENCOUNTER.battleEntry });
      }
      assert.equal(spawned.length, 6 + 3 * ENCOUNTER.battleGroups);
      for (const spawn of spawned) {
        assert.ok(isWalkable(spawn.x, spawn.z, spawn.role === 'heavy' ? 1.4 : 0.6, world!.colliders), `${spawn.id}: blocked spawn (${spawn.x},${spawn.z})`);
        assert.equal(getZone(spawn.x, spawn.z).allowed, spawn.id.includes('vault') ? 'pilot' : 'mech');
      }
    }
    assert.ok(isWalkable(ENCOUNTER.boarding.x, ENCOUNTER.boarding.z, 1.4, world!.colliders));
    assert.ok(isWalkable(ENCOUNTER.battleEntry.x, ENCOUNTER.battleEntry.z, 1.4, world!.colliders));
    for (const relay of ENCOUNTER.relays) assert.ok(isWalkable(relay.x + 2, relay.z, 0.48, world!.colliders));
  } finally { world!.dispose(); }
});
