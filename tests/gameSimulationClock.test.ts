import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import type { Game as GameInstance, EvaluationShot } from '../src/game.ts';
import { createProgression, getStats, type Mode } from '../src/core/index.ts';
import { resolveEquipmentAppearance } from '../src/core/appearance.ts';
import { createEquipmentCharacter, createEquipmentWeapon, disposeEquipmentModel } from '../src/rendering/equipmentModels.ts';
import { createEncounterEnemy } from '../src/rendering/encounterEnemy.ts';
import { PlayerBallistics } from '../src/rendering/PlayerBallistics.ts';
import { GamePresentation } from '../src/rendering/quality/GamePresentation.ts';
import { SimulationWeaponPose } from '../src/rendering/SimulationWeaponPose.ts';
import { decorateEnemy } from '../src/rendering/quality/actors.ts';
import { cacheDamageAnchors } from '../src/ui/damageAnchors.ts';
import type { DamageFeedbackContext, DamagePoint } from '../src/ui/damageNumbers.ts';
import { DamageNumberModel } from '../src/ui/damageNumbers.ts';
import type { DamageEffect } from '../src/core/feedback.ts';

// Browser styles have no effect on this headless Game orchestration regression.
const { Game } = await (async () => {
  const css = registerHooks({ load(url, context, nextLoad) {
    return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : nextLoad(url, context);
  } });
  try { return await import('../src/game.ts'); }
  finally { css.deregister(); }
})();

let originalDocument: PropertyDescriptor | undefined;
let originalWidth: PropertyDescriptor | undefined;
let originalHeight: PropertyDescriptor | undefined;
before(() => {
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  originalWidth = Object.getOwnPropertyDescriptor(globalThis, 'innerWidth');
  originalHeight = Object.getOwnPropertyDescriptor(globalThis, 'innerHeight');
  Object.defineProperty(globalThis, 'innerWidth', { configurable: true, value: 1280 });
  Object.defineProperty(globalThis, 'innerHeight', { configurable: true, value: 720 });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {} }) }),
  } });
});
after(() => {
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else Reflect.deleteProperty(globalThis, 'document');
  if (originalWidth) Object.defineProperty(globalThis, 'innerWidth', originalWidth); else Reflect.deleteProperty(globalThis, 'innerWidth');
  if (originalHeight) Object.defineProperty(globalThis, 'innerHeight', originalHeight); else Reflect.deleteProperty(globalThis, 'innerHeight');
});

/** Uses Game's actual stepping, firing, pose and render methods without a browser
 * renderer. Unrelated encounter/AI/UI systems are inert; real rigs, enemy hit
 * proxies, ballistics and quality controller remain active. */
function gameHarness(mode: Mode, quality: boolean) {
  const game = Object.create(Game.prototype) as GameInstance;
  const state = game as unknown as Record<string, unknown>;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(72, 1, .08, 350);
  camera.position.set(0, mode === 'pilot' ? 1.8 : 4.4, 7);
  camera.lookAt(0, 1.65, -12); scene.add(camera);
  const weapon = new THREE.Group(), pilotGun = new THREE.Group(), mechGuns = new THREE.Group();
  camera.add(weapon); weapon.add(pilotGun, mechGuns);
  const progression = createProgression();
  const pilotLook = resolveEquipmentAppearance(progression, 'pilot'), mechLook = resolveEquipmentAppearance(progression, 'mech');
  const pilotRig = createEquipmentWeapon('pilot', pilotLook.weapon, pilotLook), mechRig = createEquipmentWeapon('mech', mechLook.weapon, mechLook);
  pilotRig.group.position.z -= .30; pilotRig.group.scale.setScalar(.75); mechRig.group.position.z -= .40;
  pilotGun.add(pilotRig.group); mechGuns.add(mechRig.group);
  const parkedMech = createEquipmentCharacter('mech', mechLook); scene.add(parkedMech);
  const target = createEncounterEnemy(41, 'flanker'); target.group.position.set(0, 0, -12); scene.add(target.group);
  const shots: EvaluationShot[] = [];
  const hits: { at: number; damage: number; point: number[]; direction: number[]; critical: boolean }[] = [];
  const ballistics = new PlayerBallistics(scene, {
    targets: () => [{ id: 41, root: target.group, radius: .85 }], occluders: () => [],
    hit: hit => hits.push({ at: state.time as number, damage: hit.damage, point: hit.point.toArray(), direction: hit.direction.toArray(), critical: hit.critical }),
  });
  const presentation = new GamePresentation({ scene, camera, weaponRoot: weapon, ballistics, comicRenderer: { outlineWidth: 3 } });
  presentation.equipment({ pilotRig, mechRig, pilotLook, mechLook, parkedMech });
  presentation.enemy({ root: target.group, id: 41, role: 'flanker', heavy: false });
  presentation.setSoundEnabled(false); presentation.setEnabled(quality);
  const keys = new Set<string>();
  const makeBody = (bodyMode: Mode) => ({ health: 100, shield: 0, ammo: getStats(progression, bodyMode).magazine,
    reserve: 100, heat: 0, lastDamage: 0, overheated: false });
  const bodies = { pilot: makeBody('pilot'), mech: makeBody('mech') };
  Object.assign(state, {
    scene, camera, weapon, pilotGun, mechGuns, pilotRig, mechRig, progression, presentation, ballistics, bodies, keys, mode,
    world: { parkedMech, vendingMachines: [], occluders: [] }, enemies: [], testDummy: { id: 41, mesh: target.group },
    ray: new THREE.Raycaster(), muzzle: new THREE.Mesh(new THREE.SphereGeometry(.1), new THREE.MeshBasicMaterial()),
    weaponPose: new SimulationWeaponPose(), presentationPosition: camera.position.clone(), presentationTime: 0,
    presentationYaw: 0, presentationGrounded: true, jumpMotion: { height: 0 }, yaw: 0,
    pitch: camera.rotation.x, recoveryAction: { active: false, progress: () => 0 }, healingVisual: { update() {} },
    screen: 'none', time: 0, respawnUntil: 0, shooting: true, reloadUntil: 0, reloadStartedAt: 0, reloadFoleyStage: 0,
    nextShot: 0, lastFiredAt: -Infinity, emptyAt: -Infinity, lastDryClickAt: -Infinity, lastMuzzleIndex: 0, shotSequence: 0,
    soundEnabled: false, frames: 0, hudTime: 0, fps: 0, evaluationDriver: true,
    damageHeads: [], damageHead: new THREE.Vector3(), gamepad: { moveX: 0, moveY: 0, fire: false },
    ui: { toast() {}, updateFeedback() {} }, comicRenderer: { render() {} },
    onEvaluationShot: (shot: EvaluationShot) => shots.push(structuredClone(shot)),
    updatePlayer(dt: number) { bodies[mode].heat = Math.max(0, bodies[mode].heat - getStats(progression, mode).cooling * dt); },
    updateEncounter() {}, updateEnemies() {}, updateTargetEffects() {}, updateProjectiles() {}, updateDrops() {},
    updateRecoveryAction() {}, updateEffects() {}, measure() {}, updateHUD() {}, pollGamepad() {},
  });
  (state.applyWeaponPose as () => void).call(game); scene.updateMatrixWorld(true);
  return { game, state, keys, shots, hits,
    snapshot: () => ({ time: state.time, ammo: bodies[mode].ammo, heat: bodies[mode].heat,
      recoil: (state.weaponPose as SimulationWeaponPose).recoil, matrix: weapon.matrixWorld.toArray(),
      muzzles: [...pilotRig.muzzles, ...mechRig.muzzles].map(muzzle => muzzle.getWorldPosition(new THREE.Vector3()).toArray()) }),
    dispose() {
      presentation.dispose(); ballistics.clear(); target.dispose();
      for (const root of [pilotRig.group, mechRig.group, parkedMech]) disposeEquipmentModel(root);
      const muzzle = state.muzzle as THREE.Mesh; muzzle.geometry.dispose(); (muzzle.material as THREE.Material).dispose();
    },
  };
}

function run(mode: Mode, quality: boolean, renderHz: number) {
  const fixture = gameHarness(mode, quality);
  let renderCredit = 0;
  try {
    for (let tick = 0; tick < 180; tick++) {
      if (tick % 48 < 24) fixture.keys.add('KeyW'); else fixture.keys.clear();
      fixture.game.stepEvaluation(1 / 60);
      renderCredit += renderHz / 60;
      while (renderCredit >= 1) { fixture.game.renderEvaluation(1 / Math.max(1, renderHz), true); renderCredit--; }
    }
    const frozen = fixture.snapshot(); fixture.state.screen = 'pause';
    for (let draw = 0; draw < 144; draw++) { fixture.game.renderEvaluation(1 / 144, true); fixture.game.stepEvaluation(1 / 60); }
    assert.deepEqual(fixture.snapshot(), frozen, 'Paused Game methods advanced simulation state');
    return { shots: fixture.shots, hits: fixture.hits, state: frozen };
  } finally { fixture.dispose(); }
}

for (const mode of ['pilot', 'mech'] as const) {
  test(`actual ${mode} Game firing is identical in legacy/quality at zero/30/60/144Hz rendering`, () => {
    const expected = run(mode, false, 0);
    assert.ok(expected.shots.length > 2, 'Exercise repeated authoritative Game.fire calls');
    assert.ok(expected.hits.length > 2, 'Exercise real ballistic enemy contacts');
    assert.notDeepEqual(expected.shots[0].origin, expected.shots[1].origin, 'Exercise changing authored recoil/bob poses');
    for (const quality of [false, true]) for (const renderHz of [0, 30, 60, 144]) {
      assert.deepEqual(run(mode, quality, renderHz), expected, `${quality ? 'quality' : 'legacy'} at ${renderHz}Hz changed combat`);
    }
  });
}

test('crowd HUD reuses the adjacent station query while classic keeps both queries and identical prompts', () => {
  const updateHUD = (Game.prototype as unknown as Record<string, (this: GameInstance) => void>).updateHUD;
  for (const focus of [undefined, { kind: 'workbench' }, { kind: 'service' }, { kind: 'vending', vendor: 'weapons' }, { kind: 'vending', vendor: 'unknown' }]) {
    const results = [];
    for (const quality of ['classic', 'crowd']) {
      const fixture = gameHarness('pilot', false); let queries = 0, displayed: unknown;
      const vendor = { id: 'weapons' };
      Object.assign(fixture.state, {
        world: { parkedMech: new THREE.Group(), vendingMachines: [vendor] },
        focusedStation() { queries++; return focus; }, aimedDrop() {}, nearestCash() {}, nearestHealth() {},
        targetedEnemy() {}, shopAvailable() { return true; }, encounterHUD() {},
        encounter: { snapshot: { phase: 'idle', activeRelayIds: [] } }, activeInput: 'keyboard', mouse: { locked: false },
        healReadyAt: 0, healingUntil: 0, lastHealingAmount: 0, fps: 60,
        ui: { feedbackQuality: quality, update(data: unknown) { displayed = data; }, setShop() {}, setLootComparison() {}, setTestDummy() {}, setTargetStatuses() {} },
      });
      try { updateHUD.call(fixture.game); assert.equal(queries, quality === 'classic' ? 2 : 1); results.push(displayed); }
      finally { fixture.dispose(); }
    }
    assert.deepEqual(results[0], results[1], `Station ${JSON.stringify(focus)} changed the actual HUD output`);
  }
});

test('actual Game killing-hit feedback ignores disposed art anchors and retains the nonzero world impact/status position', () => {
  const fixture = gameHarness('pilot', false), visual = createEncounterEnemy(88, 'flanker');
  visual.group.position.set(8, 0, -12); (fixture.state.scene as THREE.Scene).add(visual.group);
  const art = decorateEnemy(visual.group, 88), anchors = cacheDamageAnchors(visual.group);
  const calls: { amount: number; critical: boolean; effect?: DamageEffect; position?: DamagePoint; context?: DamageFeedbackContext }[] = [];
  Object.assign(fixture.state, { damagePoint: new THREE.Vector3(), damageAnchors: new WeakMap([[visual.group, anchors]]), time: 3.25,
    ui: { hit(amount: number, critical: boolean, effect?: DamageEffect, position?: DamagePoint, context?: DamageFeedbackContext) {
      calls.push({ amount, critical, effect, position, context });
    } } });
  const show = (Game.prototype as unknown as { showEnemyDamage(this: GameInstance, target: unknown, amount: number,
    critical?: boolean, effect?: DamageEffect, impact?: THREE.Vector3, kind?: 'direct' | 'status'): void }).showEnemyDamage;
  const target = { id: 88, mesh: visual.group, heavy: false }, impact = new THREE.Vector3(8, 2.2, -11.7);
  try {
    show.call(fixture.game, target, 10, false, undefined, impact);
    assert.ok(calls.at(-1)!.context!.head, 'A live actor must use its actual cached head');
    art.dispose(); visual.dispose(); assert.equal(visual.group.parent, null);
    show.call(fixture.game, target, 42.75, true, undefined, impact);
    const killed = calls.at(-1)!, camera = fixture.state.camera as THREE.PerspectiveCamera;
    const projected = impact.clone().add(new THREE.Vector3(0, .2, 0)).project(camera);
    assert.equal(killed.context!.head, undefined); assert.equal(killed.amount, 42.75); assert.equal(killed.critical, true);
    assert.equal(killed.effect, undefined); assert.equal(killed.context!.kind, 'direct'); assert.equal(killed.context!.at, 3.25);
    assert.equal(killed.context!.targetId, visual.group.uuid);
    assert.deepEqual(killed.position, { x: (projected.x + 1) / 2, y: (1 - projected.y) / 2 });
    show.call(fixture.game, target, 3.5, false, 'fire', undefined, 'status');
    const status = calls.at(-1)!, fallback = new THREE.Vector3(8, 2.75, -12).project(camera);
    assert.equal(status.context!.head, undefined); assert.equal(status.context!.kind, 'status');
    assert.equal(status.amount, 3.5); assert.equal(status.critical, false); assert.equal(status.effect, 'fire');
    assert.deepEqual(status.position, { x: (fallback.x + 1) / 2, y: (1 - fallback.y) / 2 });
  } finally { art.dispose(); visual.dispose(); fixture.dispose(); }
});

test('actual dummy/combat reset boundaries explicitly clear feedback without resetting cumulative amounts or record IDs', () => {
  const fixture = gameHarness('pilot', false), model = new DamageNumberModel(), reasons: string[] = [];
  const dummy = fixture.state.testDummy as { statusEffects: Map<unknown, unknown>; statusCoatings: Map<unknown, unknown>; statuses: object };
  Object.assign(dummy, { statusEffects: new Map(), statusCoatings: new Map(), statuses: {} });
  Object.assign(fixture.state, { dummyMeter: { clear() {} }, finishMeasurement() {},
    encounter: { snapshot: { phase: 'idle' }, reset() {} }, projectiles: [],
    ui: { clearFeedback(reason: string) { reasons.push(reason); model.clear(reason); } } });
  const methods = Game.prototype as unknown as { resetTestDummy(this: GameInstance): void; clearCombat(this: GameInstance): void };
  try {
    const push = (amount: number, at: number) => model.push({ amount, at, targetId: 'dummy', kind: 'status', effect: 'fire', critical: false, position: { x: .5, y: .5 } });
    push(7, 0); const firstId = model.records[0].id;
    methods.resetTestDummy.call(fixture.game); assert.equal(model.records.length, 0); assert.equal(model.diagnostics.resetCancelledDamage, 7);
    push(10, .1); assert.ok(model.records[0].id > firstId);
    methods.clearCombat.call(fixture.game); assert.equal(model.records.length, 0);
    assert.deepEqual(reasons, ['test-dummy-reset', 'combat-cleared']);
    assert.equal(model.diagnostics.receivedDamage, 17); assert.equal(model.diagnostics.resetCancelledDamage, 17);
    push(5, .2); assert.equal(model.records[0].amount, 5); assert.equal(model.records[0].events, 1);
    assert.equal(model.diagnostics.receivedDamage, model.diagnostics.renderedDamage + model.diagnostics.unpresentedDamage + model.diagnostics.resetCancelledDamage);
  } finally { fixture.dispose(); }
});
