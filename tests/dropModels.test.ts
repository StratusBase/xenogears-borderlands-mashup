import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createProgression, rollItem, seededRandom, type Item, type Mode, type Slot } from '../src/core/index.ts';
import { describeItemAppearance, resolveEquipmentAppearance } from '../src/core/appearance.ts';
import { createEquipmentCharacter, disposeEquipmentModel } from '../src/rendering/equipmentModels.ts';
import { createDroppedItemModel } from '../src/rendering/dropModels.ts';

let originalDocument: PropertyDescriptor | undefined;
before(() => {
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {} }) }) } });
});
after(() => { if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document'); });

function shapeSnapshot(root: THREE.Object3D): string[] {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert(), parts: string[] = [];
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry as THREE.BufferGeometry;
    const materials = (Array.isArray(object.material) ? object.material : [object.material]).map(material => {
      const color = material as THREE.MeshToonMaterial;
      return { type: material.type, color: color.color?.getHex(), map: color.map?.uuid ?? null, gradient: color.gradientMap?.uuid ?? null };
    });
    const data = {
      name: object.name,
      attributes: Object.fromEntries((Object.entries(geometry.attributes) as [string, THREE.BufferAttribute][]).map(([key, attribute]) => [key, Array.from(attribute.array)])),
      index: geometry.index ? Array.from(geometry.index.array) : null,
      matrix: new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld).toArray().map(number => Math.round(number * 1e7) / 1e7), materials,
    };
    parts.push(createHash('sha256').update(JSON.stringify(data)).digest('hex'));
  });
  return parts.sort();
}

const affixes: Record<Slot, (string | null)[]> = {
  weapon: [null, 'Heavy', 'Rapid', 'Quickdraw'], shield: [null, 'Fortified', 'Lightweight'], reactor: [null, 'Ventilated', 'High-capacity'], legs: [null, 'Sprinter', 'Armored'],
};

for (const mode of ['pilot', 'mech'] as const) {
  for (const slot of ['weapon', 'shield', 'reactor', 'legs'] as const) {
    test(`${mode} ${slot} drops use their exact equipped geometry, material and internal transforms`, () => {
      for (const affix of affixes[slot]) {
        const item = rollItem(mode, 3, seededRandom(71), slot); item.affix = affix;
        const saved = structuredClone(item);
        const actor = createEquipmentCharacter(mode, resolveEquipmentAppearance(createProgression(), mode, item));
        const equipped = actor.getObjectByName(slot === 'weapon' && mode === 'mech' ? 'equipment-weapon-left' : `equipment-${slot}`)!;
        const drop = createDroppedItemModel(item);
        assert.deepEqual(shapeSnapshot(drop.children[0]), shapeSnapshot(equipped));
        assert.equal(drop.name, `item-drop-${item.id}`);
        assert.equal(drop.userData.appearanceKey, describeItemAppearance(item).key);
        assert.equal(drop.userData.equipmentSlot, slot);
        assert.equal(drop.userData.equipmentMode, mode);
        assert.deepEqual(item, saved, 'Constructing a pickup must not mutate the inventory item');
        assert.ok(!drop.getObjectByName('support-glove') && !drop.getObjectByName('pilot-upper-arm') && !drop.getObjectByName('torso-chassis'));
        const bounds = new THREE.Box3().setFromObject(drop), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
        assert.ok(Math.abs(bounds.min.y) < 1e-6);
        assert.ok(Math.abs(center.x) < 1e-6 && Math.abs(center.z) < 1e-6);
        assert.ok(Math.abs(Math.max(size.x, size.y, size.z) - (mode === 'pilot' ? 0.55 : 0.75)) < 1e-6);
        assert.ok(shapeSnapshot(drop.children[0]).length > 1, 'A specific equipment assembly must replace the generic loot box');
        disposeEquipmentModel(drop); disposeEquipmentModel(actor);
      }
    });
  }
}

test('disposing an item drop does not dispose the independently rendered equipped model', () => {
  const item: Item = rollItem('mech', 2, seededRandom(13), 'weapon');
  const actor = createEquipmentCharacter('mech', resolveEquipmentAppearance(createProgression(), 'mech', item));
  const drop = createDroppedItemModel(item);
  let actorDisposals = 0;
  actor.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.addEventListener('dispose', () => actorDisposals++);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.addEventListener('dispose', () => actorDisposals++);
  });
  disposeEquipmentModel(drop);
  assert.equal(actorDisposals, 0);
  disposeEquipmentModel(actor);
});
