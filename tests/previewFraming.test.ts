import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import * as THREE from 'three';
import { createProgression } from '../src/core/index.ts';
import { resolveEquipmentAppearance } from '../src/core/appearance.ts';
import { weaponTypeLabels, type WeaponType } from '../src/core/arsenal.ts';
import { createWorkbenchWeapon, DEFAULT_WORKBENCH_CONFIG } from '../src/core/workbench.ts';
import { createEquipmentCharacter, disposeEquipmentModel } from '../src/rendering/equipmentModels.ts';
import { isWeaponPreviewMesh, weaponPreviewFrame } from '../src/rendering/previewFraming.ts';

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

test('weapon framing ignores body-owned hands, other slots, particles and comic overlays', () => {
  const root = new THREE.Group();
  const weapon = new THREE.Group(); weapon.userData.visualOwner = 'weapon'; root.add(weapon);
  const source = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4)); source.position.set(2, 1, -0.5); weapon.add(source);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100)); hand.userData.visualOwner = 'body'; weapon.add(hand);
  const body = new THREE.Mesh(new THREE.BoxGeometry(200, 200, 200)); body.userData.visualOwner = 'body'; root.add(body);
  const overlay = new THREE.Mesh(new THREE.BoxGeometry(300, 300, 300)); overlay.userData.comicOverlay = true; source.add(overlay);
  const particles = new THREE.InstancedMesh(new THREE.BoxGeometry(400, 400, 400), new THREE.MeshBasicMaterial(), 1); weapon.add(particles);
  const frame = weaponPreviewFrame(root)!;
  assert.deepEqual(frame.center.toArray(), [2, 1, -0.5]);
  assert.ok(Math.abs(frame.radius - Math.sqrt(21) / 2) < 1e-9);
  assert.equal(isWeaponPreviewMesh(hand), false);
  assert.equal(isWeaponPreviewMesh(source), true);
  assert.equal(isWeaponPreviewMesh(overlay), false);
  assert.equal(isWeaponPreviewMesh(particles), false);
  disposeEquipmentModel(root);
});

test('weapon frame stays in model-local coordinates through world transforms and does not include hidden geometry', () => {
  const root = new THREE.Group(); root.position.set(20, 10, -6); root.rotation.y = 0.7; root.scale.set(2, 3, 4);
  const source = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2)); source.userData.visualOwner = 'weapon'; source.position.set(1, 2, 3); root.add(source);
  const hidden = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100)); hidden.visible = false; hidden.userData.visualOwner = 'weapon'; root.add(hidden);
  const frame = weaponPreviewFrame(root)!;
  frame.center.toArray().forEach((value, index) => assert.ok(Math.abs(value - [1, 2, 3][index]) < 1e-9));
  assert.ok(Math.abs(frame.radius - Math.sqrt(3)) < 1e-9);
  disposeEquipmentModel(root);
  assert.equal(weaponPreviewFrame(new THREE.Group()), null);
});

for (const mode of ['pilot', 'mech'] as const) {
  test(`${mode} close-up frames every real weapon family without changing full-loadout geometry`, () => {
    const state = createProgression();
    for (const family of Object.keys(weaponTypeLabels) as WeaponType[]) {
      const item = createWorkbenchWeapon({ ...DEFAULT_WORKBENCH_CONFIG, target: mode, weaponType: family });
      const model = createEquipmentCharacter(mode, resolveEquipmentAppearance(state, mode, item));
      const initial = new THREE.Box3().setFromObject(model);
      const frame = weaponPreviewFrame(model);
      assert.ok(frame && frame.radius > 0 && Number.isFinite(frame.radius), family);
      assert.deepEqual(new THREE.Box3().setFromObject(model), initial, 'Measuring a close-up must preserve inventory framing');
      let weapons = 0;
      model.traverse(object => {
        if (!isWeaponPreviewMesh(object)) return;
        weapons++;
        // A body mesh must never hide an equipped weapon when unrelated geometry is hidden.
        for (let ancestor = object.parent; ancestor; ancestor = ancestor.parent) {
          if (ancestor instanceof THREE.Mesh) assert.ok(isWeaponPreviewMesh(ancestor), 'Weapon is parented under a hidden body mesh');
        }
      });
      assert.ok(weapons > 0);
      disposeEquipmentModel(model);
    }
  });
}
