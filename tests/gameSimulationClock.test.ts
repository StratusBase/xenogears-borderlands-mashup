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

// Browser styles have no effect on this headless Game orchestration regression.
const { Game } = await (async () => {
  const css = registerHooks({ load(url, context, nextLoad) {
    return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : nextLoad(url, context);
  } });
  try { return await import('../src/game.ts'); }
  finally { css.deregister(); }
})();

let originalDocument: PropertyDescriptor | undefined;
before(() => {
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {} }) }),
  } });
});
after(() => {
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else Reflect.deleteProperty(globalThis, 'document');
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
    gamepad: { moveX: 0, moveY: 0, fire: false }, ui: { toast() {} }, comicRenderer: { render() {} },
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
