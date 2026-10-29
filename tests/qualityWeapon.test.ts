import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import * as THREE from 'three';
import { createProgression, type Mode } from '../src/core/index.ts';
import { resolveEquipmentAppearance, type EquipmentAppearance } from '../src/core/appearance.ts';
import { createEquipmentWeapon, disposeEquipmentModel, type WeaponRig } from '../src/rendering/equipmentModels.ts';
import { upgradeReferenceWeapon } from '../src/rendering/quality/weapon.ts';

let originalDocument: PropertyDescriptor | undefined;
before(() => {
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {} }) }) } });
});
after(() => { if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document'); });

function sockets(rig: WeaponRig): unknown {
  rig.group.updateWorldMatrix(true, true);
  return {
    muzzleParents: rig.muzzles.map(muzzle => muzzle.parent),
    muzzleMatrices: rig.muzzles.map(muzzle => muzzle.matrixWorld.toArray()),
    barrelHomes: rig.barrelHomes.map(home => home.toArray()), breechHomes: rig.breechHomes.map(home => home.toArray()),
    magazineHome: rig.magazineHome?.toArray(), boltHome: rig.boltHome?.toArray(), handHome: rig.supportHandHome?.toArray(),
  };
}
function meshResources(root: THREE.Object3D): { mesh: THREE.Mesh; geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }[] {
  const resources: ReturnType<typeof meshResources> = [];
  root.traverse(object => { if (object instanceof THREE.Mesh) resources.push({ mesh: object, geometry: object.geometry, material: object.material }); });
  return resources;
}

for (const mode of ['pilot', 'mech'] as const) {
  test(`${mode} reference art retains exact muzzle matrices and restores original resources`, () => {
    for (const form of ['standard', 'heavy', 'rapid', 'compact'] as const) {
      const loadout = resolveEquipmentAppearance(createProgression(), mode);
      loadout.weapon = { ...loadout.weapon, equipped: true, form, weaponType: 'rifle' };
      const rig = createEquipmentWeapon(mode, loadout.weapon, loadout);
      const before = sockets(rig), resources = meshResources(rig.group), children = rig.group.children.slice();
      const quality = upgradeReferenceWeapon(rig, loadout.weapon);
      assert.deepEqual(sockets(rig), before, 'Art must not move a gameplay muzzle, parent or reload home');
      assert.equal(upgradeReferenceWeapon(rig, loadout.weapon), quality, 'Repeated attachment must be idempotent');
      rig.barrels[0].position.z += .17;
      const animated = rig.muzzles[0].getWorldPosition(new THREE.Vector3());
      assert.ok(Math.abs(animated.z - (before as { muzzleMatrices: number[][] }).muzzleMatrices[0][14] - .17) < 1e-6);
      rig.barrels[0].position.copy(rig.barrelHomes[0]);
      quality.dispose(); quality.dispose();
      assert.deepEqual(rig.group.children, children);
      for (const entry of resources) { assert.equal(entry.mesh.geometry, entry.geometry); assert.equal(entry.mesh.material, entry.material); }
      disposeEquipmentModel(rig.group);
    }
  });

  test(`${mode} reference art leaves body and every other equipment slot untouched`, () => {
    const loadout = resolveEquipmentAppearance(createProgression(), mode);
    for (const entry of Object.values(loadout)) entry.equipped = true;
    const rig = createEquipmentWeapon(mode, loadout.weapon, loadout);
    const untouched = meshResources(rig.group).filter(({ mesh }) => {
      for (let parent: THREE.Object3D | null = mesh; parent; parent = parent.parent) {
        const owner = parent.userData.visualOwner ?? parent.userData.equipmentSlot;
        if (owner) return owner !== 'weapon';
      }
      return false;
    }).map(entry => ({ ...entry, matrix: entry.mesh.matrix.toArray(), position: entry.mesh.position.toArray() }));
    assert.ok(untouched.length > 0);
    const upgrade = upgradeReferenceWeapon(rig, loadout.weapon);
    for (const entry of untouched) {
      assert.equal(entry.mesh.geometry, entry.geometry); assert.equal(entry.mesh.material, entry.material);
      assert.deepEqual(entry.mesh.matrix.toArray(), entry.matrix); assert.deepEqual(entry.mesh.position.toArray(), entry.position);
    }
    const originalCount = meshResources(rig.group).length;
    upgrade.dispose();
    assert.ok(originalCount - meshResources(rig.group).length <= 12, 'Rigid fitments must remain batched');
    disposeEquipmentModel(rig.group);
  });
}

test('reference element cartridges change locally while receiver, optics, stock and magazine keep their materials', () => {
  const colors: number[][] = [];
  for (const element of ['fire', 'ice', 'corrosive', 'shock'] as const) {
    const loadout = resolveEquipmentAppearance(createProgression(), 'pilot');
    const look: EquipmentAppearance = { ...loadout.weapon, equipped: true, weaponType: 'rifle', form: 'standard', element, accent: element === 'fire' ? 0xff5533 : 0x33ffff };
    const rig = createEquipmentWeapon('pilot', look), upgrade = upgradeReferenceWeapon(rig, look);
    colors.push(['weapon-receiver', 'weapon-stock', 'pistol-grip', 'weapon-box-magazine'].map(name => ((rig.group.getObjectByName(name) as THREE.Mesh).material as THREE.MeshToonMaterial).color.getHex()));
    const cartridge = rig.group.getObjectByName('element-transfer-band-0-0') as THREE.Mesh;
    assert.equal(cartridge.userData.equipmentElementSurface, element);
    assert.equal((cartridge.material as THREE.MeshBasicMaterial).color.getHex(), look.accent);
    upgrade.dispose(); disposeEquipmentModel(rig.group);
  }
  colors.slice(1).forEach(color => assert.deepEqual(color, colors[0]));
});

test('camera-facing reference stock and reflex optic contain real openings', () => {
  const loadout = resolveEquipmentAppearance(createProgression(), 'pilot');
  const look = { ...loadout.weapon, equipped: true, weaponType: 'rifle' as const, form: 'standard' as const, variant: 0 };
  const rig = createEquipmentWeapon('pilot', look), art = upgradeReferenceWeapon(rig, look);
  rig.group.updateWorldMatrix(true, true);
  const optic = rig.group.getObjectByName('raised-optic') as THREE.Mesh;
  const center = optic.getWorldPosition(new THREE.Vector3());
  const ray = new THREE.Raycaster(center.clone().add(new THREE.Vector3(0, 0, 1)), new THREE.Vector3(0, 0, -1));
  assert.equal(ray.intersectObject(optic, false).length, 0, 'The reflex window must be an actual aperture, not painted black');
  const stock = rig.group.getObjectByName('weapon-stock') as THREE.Mesh;
  const gap = stock.localToWorld(new THREE.Vector3(0, 0, -.19));
  ray.set(gap.clone().add(new THREE.Vector3(-1, 0, 0)), new THREE.Vector3(1, 0, 0));
  assert.equal(ray.intersectObject(stock, false).length, 0, 'Stock should have a genuine cutout between its rails');
  stock.geometry.computeBoundingBox();
  assert.ok(stock.geometry.boundingBox!.max.z < 0, 'The near-camera shoulder pad must be pulled forward from the legacy block');
  art.dispose(); disposeEquipmentModel(rig.group);
});
