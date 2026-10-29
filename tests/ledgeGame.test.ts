import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import { createProgression, getStats } from '../src/core/index';
import { JumpMotion } from '../src/core/jump';
import { LEDGE_CLIMB_DURATION, type TraversalCollider } from '../src/core/ledgeClimb';
import { SimulationWeaponPose } from '../src/rendering/SimulationWeaponPose';
import type { Game as GameType } from '../src/game';

const css = registerHooks({ load(url, context, next) {
  return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
} });
const { Game } = await import('../src/game');
css.deregister();

function harness() {
  const game = Object.create(Game.prototype) as GameType;
  const state = game as unknown as Record<string, any>;
  const progression = createProgression(), camera = new THREE.PerspectiveCamera(72, 1, .08, 350);
  camera.rotation.order = 'YXZ'; camera.position.set(0, 1.8, 1.8);
  const shelf: TraversalCollider = { minX: -3, maxX: 3, minZ: -2, maxZ: 1, minY: 0, maxY: 1.3, climbable: true };
  const rig = () => ({ group: new THREE.Group(), breeches: [], barrels: [], breechHomes: [], barrelHomes: [], muzzles: [] });
  const body = (mode: 'pilot' | 'mech') => ({ health: 100, shield: 0, ammo: getStats(progression, mode).magazine,
    reserve: 100, heat: 0, lastDamage: 0, overheated: false });
  Object.assign(state, {
    camera, progression, mode: 'pilot', screen: 'none', time: 0, respawnUntil: 0, yaw: 0, pitch: 0,
    jumpMotion: new JumpMotion(), climbIntentUntil: -Infinity, keys: new Set(),
    gamepad: { connected: false, lookX: 0, lookY: 0, moveX: 0, moveY: 0, aim: false, fire: false },
    mouse: { locked: false }, bodies: { pilot: body('pilot'), mech: body('mech') },
    recoveryAction: { active: false, progress: () => 0 }, reloadUntil: 0, dashUntil: 0,
    abilityUntil: { pilot: 0, mech: 0 }, healReadyAt: 0, nextShot: 0, lastZoneWarning: -10,
    world: { colliders: [shelf], traversalColliders: [shelf], parkedMech: new THREE.Group(), vendingMachines: [] },
    hasStarted: true, weaponBalance: {}, ui: { toast() {} }, presentation: undefined,
    pilotRig: rig(), mechRig: rig(), pilotGun: new THREE.Group(), mechGuns: new THREE.Group(),
    weapon: new THREE.Group(), weaponPose: new SimulationWeaponPose(), emptyAt: -Infinity,
    muzzle: new THREE.Group(), healingVisual: { update() {} }, lastFiredAt: -Infinity,
    presentationPosition: camera.position.clone(), presentationYaw: 0, presentationTime: 0, presentationGrounded: true,
    evaluationDriver: true, manualEvaluation: true, shooting: false, testDummy: {},
    activateNearbyCheckpoint() {}, measure() {}, updateEncounter() {}, updateEnemies() {}, updateTargetEffects() {},
    updateProjectiles() {}, updateDrops() {}, updateRecoveryAction() {}, updateEffects() {}, updateHUD() {},
    ballistics: { update() {} }, frames: 0, hudTime: 0,
  });
  return { game, state, camera, shelf, jump: state.jumpMotion as JumpMotion };
}

test('actual Game jump grabs a nearby ledge, frees both hands, and lands with two renewed jumps', () => {
  const { game, state, camera, jump } = harness();
  jump.used = 2; state.reloadUntil = 10;
  game.driveEvaluation({ jump: true });
  assert.ok(state.ledgeClimb, 'A grab must remain possible after both jumps are spent');
  assert.equal(state.reloadUntil, 0);
  const ammo = state.body.ammo;
  for (const action of ['fire', 'reload', 'ability', 'heal', 'switchMode', 'interact']) state[action].call(game);
  assert.equal(state.mode, 'pilot'); assert.equal(state.body.ammo, ammo); assert.equal(state.reloadUntil, 0);
  game.stepEvaluation(.25);
  assert.equal(state.playerGrounded, false); assert.equal(state.pilotGun.visible, false);
  for (let step = 0; step < 70; step++) game.stepEvaluation(1 / 60);
  assert.equal(state.ledgeClimb, undefined);
  assert.equal(jump.height, 1.3); assert.equal(jump.used, 0); assert.equal(jump.velocity, 0);
  assert.equal(state.playerGrounded, true); assert.equal(state.pilotGun.visible, true);
  assert.ok(Math.abs(camera.position.y - 3.1) < 1e-9);
  game.driveEvaluation({ jump: true });
  assert.equal(jump.used, 1); assert.ok(jump.velocity > 0);
});

test('walking on the top keeps support; stepping off falls and cannot mount a mech in the air', () => {
  const { game, state, camera, jump } = harness();
  camera.position.set(0, 3.1, 0); jump.height = 1.3;
  game.driveEvaluation({}); game.stepEvaluation(.2);
  assert.equal(jump.height, 1.3);
  state.switchMode.call(game); assert.equal(state.mode, 'pilot');
  game.driveEvaluation({ moveX: 1 });
  for (let step = 0; step < 100; step++) game.stepEvaluation(1 / 60);
  assert.ok(camera.position.x > 4); assert.equal(jump.height, 0); assert.equal(camera.position.y, 1.8);
});

test('normal jump from a platform hits an overhead underside and returns to the same support', () => {
  const { game, state, camera, jump } = harness();
  camera.position.set(0, 3.1, 0); jump.height = 1.3;
  state.world.traversalColliders.push({ minX: -2, maxX: 2, minZ: -2, maxZ: 1, minY: 3.5, maxY: 4 });
  game.driveEvaluation({ jump: true });
  for (let step = 0; step < 60; step++) {
    game.stepEvaluation(1 / 60);
    assert.ok(camera.position.y <= 3.5 + 1e-9, 'Head crossed the ceiling');
  }
  assert.equal(jump.height, 1.3); assert.equal(jump.used, 0);
});

test('climb poses use only simulation time, freeze on pause, and reset at checkpoint placement', () => {
  const run = (draws: number) => {
    const { game, state, camera, jump } = harness();
    game.driveEvaluation({ jump: true });
    for (let tick = 0; tick < 35; tick++) {
      game.stepEvaluation(1 / 60);
      for (let draw = 0; draw < draws; draw++) game.renderEvaluation(1 / 144, false);
    }
    const pose = () => [state.time, state.climbProgress, jump.height, ...camera.position.toArray(), ...camera.rotation.toArray(), ...state.weapon.position.toArray()];
    const before = pose(); state.screen = 'pause';
    for (let tick = 0; tick < 20; tick++) { game.stepEvaluation(.05); game.renderEvaluation(1 / 60, false); }
    assert.deepEqual(pose(), before);
    state.screen = 'none'; game.stepEvaluation(1 / 60); assert.ok(state.climbProgress > before[1]);
    state.placeAtCheckpoint.call(game);
    assert.equal(state.ledgeClimb, undefined); assert.equal(jump.height, 0); assert.equal(jump.used, 0);
    assert.equal(camera.rotation.z, 0); assert.equal(camera.position.y, 1.8);
    return before;
  };
  assert.deepEqual(run(0), run(3));
  assert.ok(LEDGE_CLIMB_DURATION > 1);
});

test('buffered jump intention catches an approaching edge, while normal walking never grabs it', () => {
  for (const jumpIntent of [false, true]) {
    const { game, state, camera } = harness();
    camera.position.z = 2.15;
    game.driveEvaluation({ moveY: -1, jump: jumpIntent });
    for (let tick = 0; tick < 15; tick++) game.stepEvaluation(1 / 60);
    assert.equal(!!state.ledgeClimb, jumpIntent);
    if (!jumpIntent) assert.ok(camera.position.z >= 1.48);
  }
});
