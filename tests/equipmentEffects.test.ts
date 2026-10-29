import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import * as THREE from 'three';
import { createProgression, rollItem, seededRandom } from '../src/core/index.ts';
import { createWeaponSpec } from '../src/core/arsenal.ts';
import { resolveEquipmentAppearance } from '../src/core/appearance.ts';
import { createEquipmentCharacter, createEquipmentWeapon, disposeEquipmentModel } from '../src/rendering/equipmentModels.ts';
import { updateEquipmentEffects } from '../src/rendering/equipmentEffects.ts';

let originalDocument: PropertyDescriptor | undefined;
before(() => {
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {} }) }) } });
});
after(() => { if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document'); });

test('elemental equipment effects attach to the actual weapon sockets once, without adding a trait to armor', () => {
  for (const mode of ['pilot', 'mech'] as const) {
    const state = createProgression();
    const item = rollItem(mode, 2, seededRandom(24), 'weapon', { weapon: createWeaponSpec('bullet', 'corrosive', mode) });
    const look = resolveEquipmentAppearance(state, mode, item);
    assert.equal(look.weapon.element, 'corrosive');
    assert.equal(look.shield.element, undefined);
    const actor = createEquipmentCharacter(mode, look);
    const rig = createEquipmentWeapon(mode, look.weapon, look);
    for (const model of [actor, rig.group]) {
      updateEquipmentEffects(model, 0.1, 0.1);
      const before: THREE.Object3D[] = [];
      model.traverse(object => { if (object.name === 'equipment-element-effect') before.push(object); });
      assert.equal(before.length, mode === 'pilot' ? 1 : 2);
      for (const effect of before) assert.equal(effect.parent?.userData.equipmentElement, 'corrosive');
      updateEquipmentEffects(model, 0.1, 0.2);
      const after: THREE.Object3D[] = [];
      model.traverse(object => { if (object.name === 'equipment-element-effect') after.push(object); });
      assert.deepEqual(after, before, 'Frame updates must reuse particle pools');
      let released = 0;
      before.forEach(effect => effect.traverse(object => {
        if (object instanceof THREE.InstancedMesh) object.addEventListener('dispose', () => released++);
      }));
      disposeEquipmentModel(model);
      assert.ok(released > 0, 'Rebuilding equipment must release instance buffers as well as ordinary geometry');
      assert.ok(before.every(effect => effect.parent === null));
    }
  }
});

test('kinetic weapons and non-elemental armor do not receive misleading elemental effects', () => {
  const look = resolveEquipmentAppearance(createProgression(), 'pilot');
  const actor = createEquipmentCharacter('pilot', look);
  updateEquipmentEffects(actor, 0.1, 0.1);
  assert.equal(actor.getObjectByName('equipment-element-effect'), undefined);
  disposeEquipmentModel(actor);
});
