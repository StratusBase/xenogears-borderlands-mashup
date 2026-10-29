import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import * as THREE from 'three';
import { createProgression, type Mode } from '../src/core/index.ts';
import { resolveEquipmentAppearance } from '../src/core/appearance.ts';
import { createWeaponSpec } from '../src/core/arsenal.ts';
import { createEquipmentCharacter, createEquipmentWeapon, disposeEquipmentModel, type WeaponRig } from '../src/rendering/equipmentModels.ts';
import { PlayerBallistics } from '../src/rendering/PlayerBallistics.ts';
import { updateEquipmentEffects } from '../src/rendering/equipmentEffects.ts';
import { GamePresentation } from '../src/rendering/quality/GamePresentation.ts';
import { SimulationWeaponPose } from '../src/rendering/SimulationWeaponPose.ts';

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

function fixture(mode: Mode) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  camera.position.set(0, mode === 'pilot' ? 1.8 : 4.4, 7);
  scene.add(camera);
  const root = new THREE.Group(); camera.add(root);
  const progression = createProgression();
  const pilotLook = resolveEquipmentAppearance(progression, 'pilot');
  const mechLook = resolveEquipmentAppearance(progression, 'mech');
  const pilotRig = createEquipmentWeapon('pilot', pilotLook.weapon, pilotLook);
  const mechRig = createEquipmentWeapon('mech', mechLook.weapon, mechLook);
  pilotRig.group.position.z -= 0.30; pilotRig.group.scale.setScalar(0.75);
  mechRig.group.position.z -= 0.40;
  root.add(pilotRig.group, mechRig.group);
  pilotRig.group.visible = mode === 'pilot'; mechRig.group.visible = mode === 'mech';
  const parkedMech = createEquipmentCharacter('mech', mechLook); scene.add(parkedMech);

  const target = new THREE.Group(); target.position.set(0, camera.position.y, -15);
  const targetMesh = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 0.5), new THREE.MeshBasicMaterial());
  targetMesh.userData.enemyId = 41; target.add(targetMesh); scene.add(target);
  let time = 0;
  const hits: { at: number; point: number[]; direction: number[]; damage: number; critical: boolean }[] = [];
  const ballistics = new PlayerBallistics(scene, {
    targets: () => [{ id: 41, root: target, radius: 4 }], occluders: () => [],
    hit: hit => hits.push({ at: time, point: hit.point.toArray(), direction: hit.direction.toArray(), damage: hit.damage, critical: hit.critical }),
  });
  const presentation = new GamePresentation({ scene, camera, weaponRoot: root, ballistics, comicRenderer: { outlineWidth: 3 } });
  presentation.equipment({ pilotRig, mechRig, pilotLook, mechLook, parkedMech });
  presentation.setSoundEnabled(false); presentation.setEnabled(true);
  const pose = new SimulationWeaponPose();
  return { scene, camera, root, pilotRig, mechRig, ballistics, presentation, pose, hits,
    setTime(value: number) { time = value; },
    dispose() {
      presentation.dispose(); ballistics.clear();
      for (const object of [pilotRig.group, mechRig.group, parkedMech]) disposeEquipmentModel(object);
      targetMesh.geometry.dispose(); (targetMesh.material as THREE.Material).dispose();
    },
  };
}

function transforms(root: THREE.Group, pilotRig: WeaponRig, mechRig: WeaponRig) {
  root.updateWorldMatrix(true, true);
  return {
    root: root.matrixWorld.toArray(),
    muzzles: [...pilotRig.muzzles, ...mechRig.muzzles].map(muzzle => muzzle.matrixWorld.toArray()),
    reloadParts: [pilotRig.magazine, pilotRig.bolt, pilotRig.supportHand, ...mechRig.breeches, ...mechRig.barrels]
      .filter((part): part is THREE.Group => !!part)
      .map(part => ({ matrix: part.matrixWorld.toArray(), visible: part.visible })),
  };
}

/** Render calls use the real presentation owner. Only the 60Hz simulation owns pose and firing. */
function fireAcrossCadence(mode: Mode, renderHz: number) {
  const f = fixture(mode);
  const spec = { ...createWeaponSpec(mode === 'pilot' ? 'bullet' : 'slug', 'kinetic', mode), spread: 0 };
  const origins: number[][] = [], poses: ReturnType<typeof transforms>[] = [];
  let renderCredit = 0, lastRenderTime = 0;
  try {
    f.pose.apply({ mode, time: 0, moving: false, reloadProgress: 0, recoveryProgress: 0,
      recoveryActive: false, pilotAmmo: 30, mechAmmo: 12 }, f.root, f.pilotRig, f.mechRig);
    for (let frame = 1; frame <= 120; frame++) {
      const time = frame / 60; f.setTime(time);
      const input = { mode, time, moving: frame % 48 < 24, reloadProgress: 0,
        recoveryProgress: 0, recoveryActive: false, pilotAmmo: 30, mechAmmo: 12 };
      f.ballistics.update(1 / 60);
      if (frame % 15 === 1) {
        const rig = mode === 'pilot' ? f.pilotRig : f.mechRig;
        const index = mode === 'mech' ? origins.length % rig.muzzles.length : 0;
        const origin = rig.muzzles[index].getWorldPosition(new THREE.Vector3());
        origins.push(origin.toArray());
        const end = new THREE.Vector3(0, f.camera.position.y + 0.1, -15);
        f.ballistics.fire(origin, end.sub(origin).normalize(), spec, 17);
        f.pose.kick(mode);
      }
      // Match Game: fire from the prior simulation-owned local socket pose,
      // then decay/apply the new pose once at the end of this active tick.
      f.pose.advance(1 / 60);
      f.pose.apply(input, f.root, f.pilotRig, f.mechRig);
      poses.push(transforms(f.root, f.pilotRig, f.mechRig));
      renderCredit += renderHz / 60;
      while (renderCredit >= 1) {
        const dt = time - lastRenderTime;
        f.presentation.update({ dt, time, paused: false, mode, distance: 0, grounded: true, spec });
        updateEquipmentEffects(mode === 'pilot' ? f.pilotRig.group : f.mechRig.group, dt, time);
        f.scene.updateMatrixWorld(true);
        lastRenderTime = time; renderCredit--;
      }
    }
    for (let frame = 121; frame <= 150; frame++) { f.setTime(frame / 60); f.ballistics.update(1 / 60); }
    return { origins, poses, hits: f.hits, recoil: f.pose.recoil };
  } finally { f.dispose(); }
}

for (const mode of ['pilot', 'mech'] as const) {
  test(`${mode} actual muzzle transforms and ballistic contacts are independent of zero/30/60/144Hz presentation`, () => {
    const noDraw = fireAcrossCadence(mode, 0);
    assert.equal(noDraw.origins.length, 8); assert.equal(noDraw.hits.length, 8);
    assert.notDeepEqual(noDraw.poses[0], noDraw.poses[1], 'The fixture must exercise recoil decay and moving pose rather than a constant origin');
    for (const hz of [30, 60, 144]) assert.deepEqual(fireAcrossCadence(mode, hz), noDraw, `${hz}Hz rendering changed simulation-owned firing`);
  });
}

test('full pose application is idempotent through reload, empty, recovery and mode changes', () => {
  const f = fixture('pilot');
  try {
    for (const mode of ['pilot', 'mech'] as const) {
      f.pose.kick(mode); f.pose.advance(0.03);
      const input = { mode, time: 1.25, moving: true, reloadProgress: 0.42, reloading: true,
        recoveryProgress: 0.45, recoveryActive: true, pilotAmmo: 0, mechAmmo: 0, emptyAge: 0.13 };
      f.pose.apply(input, f.root, f.pilotRig, f.mechRig);
      const expected = transforms(f.root, f.pilotRig, f.mechRig);
      for (let draw = 0; draw < 144; draw++) {
        f.pose.apply(input, f.root, f.pilotRig, f.mechRig);
        assert.deepEqual(transforms(f.root, f.pilotRig, f.mechRig), expected, 'Reapplying a frozen simulation pose compounded a transform');
      }
    }
  } finally { f.dispose(); }
});

test('simulation recoil preserves authored amplitudes and one decay per active tick', () => {
  const f = fixture('pilot');
  try {
    const rest = { mode: 'pilot' as const, time: 0, moving: false, reloadProgress: 0,
      recoveryProgress: 0, recoveryActive: false, pilotAmmo: 30, mechAmmo: 12 };
    f.pose.kick('pilot'); f.pose.apply(rest, f.root, f.pilotRig, f.mechRig);
    assert.deepEqual(f.root.position.toArray(), [0, -0.04, 0.075]);
    assert.deepEqual(f.root.rotation.toArray().slice(0, 3).map(value => value === 0 ? 0 : value), [0.0375, 0, 0]);
    f.pose.advance(1 / 60);
    assert.ok(Math.abs(f.pose.recoil - 0.5 * Math.exp(-17 / 60)) < 1e-15);
    f.pose.kick('mech');
    f.pose.apply({ ...rest, mode: 'mech' }, f.root, f.pilotRig, f.mechRig);
    assert.deepEqual(f.root.position.toArray(), [0, -0.08, 0.15]);
    assert.deepEqual(f.root.rotation.toArray().slice(0, 3).map(value => value === 0 ? 0 : value), [0.075, 0, 0]);
  } finally { f.dispose(); }
});

test('pause does not decay recoil and reset restores the authored rest pose', () => {
  const f = fixture('mech');
  try {
    const rest = { mode: 'mech' as const, time: 0, moving: false, reloadProgress: 0,
      recoveryProgress: 0, recoveryActive: false, pilotAmmo: 30, mechAmmo: 12 };
    f.pose.apply(rest, f.root, f.pilotRig, f.mechRig);
    const authored = transforms(f.root, f.pilotRig, f.mechRig);
    f.pose.kick('mech'); f.pose.advance(0.08);
    const recoil = f.pose.recoil;
    f.pose.apply(rest, f.root, f.pilotRig, f.mechRig);
    const paused = transforms(f.root, f.pilotRig, f.mechRig);
    assert.notDeepEqual(paused, authored, 'A real recoil offset must be present before pause');
    for (let draw = 0; draw < 144; draw++) { f.pose.advance(0); f.pose.apply(rest, f.root, f.pilotRig, f.mechRig); }
    assert.equal(f.pose.recoil, recoil); assert.deepEqual(transforms(f.root, f.pilotRig, f.mechRig), paused);
    f.pose.reset(); assert.equal(f.pose.recoil, 0);
    f.pose.apply(rest, f.root, f.pilotRig, f.mechRig);
    assert.deepEqual(transforms(f.root, f.pilotRig, f.mechRig), authored);
  } finally { f.dispose(); }
});
