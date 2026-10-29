import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import * as THREE from 'three';
import { createProgression, rollItem, seededRandom } from '../src/core/index.ts';
import { brandList, createWeaponSpec, type ProjectileTrail, type WeaponType, type ProjectileType } from '../src/core/arsenal.ts';
import { describeItemAppearance, resolveEquipmentAppearance } from '../src/core/appearance.ts';
import { createEquipmentWeapon, disposeEquipmentModel } from '../src/rendering/equipmentModels.ts';
import { updateEquipmentEffects } from '../src/rendering/equipmentEffects.ts';
import { createProjectileVisual, createProjectileTrail, createBeamVisual } from '../src/rendering/weaponVisuals.ts';
import { PlayerBallistics } from '../src/rendering/PlayerBallistics.ts';

let originalDocument: PropertyDescriptor | undefined;
before(() => {
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {} }) }) } });
});
after(() => { if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document'); });

function geometryFingerprint(root: THREE.Object3D): string {
  const parts: unknown[] = [];
  root.updateMatrixWorld(true);
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object.userData.comicOverlay) return;
    parts.push([Array.from(object.geometry.getAttribute('position').array), object.matrixWorld.toArray()]);
  });
  return JSON.stringify(parts);
}
function cleanup(root: THREE.Object3D): void { disposeEquipmentModel(root); }

test('six weapon families and eight manufacturers produce physical differences at both actor scales', () => {
  const families: WeaponType[] = ['pistol', 'smg', 'rifle', 'shotgun', 'sniper', 'launcher'];
  for (const mode of ['pilot', 'mech'] as const) {
    const base = rollItem(mode, 1, seededRandom(14), 'weapon'); base.affix = null;
    const familyShapes = new Set<string>(), brandShapes = new Set<string>();
    for (const family of families) {
      const item = { ...base, weapon: { ...createWeaponSpec('bullet', 'corrosive', mode), weaponType: family } };
      const rig = createEquipmentWeapon(mode, describeItemAppearance(item));
      familyShapes.add(geometryFingerprint(rig.group)); cleanup(rig.group);
    }
    for (const brand of brandList) {
      const item = { ...base, brand: brand.id, weapon: { ...createWeaponSpec('bullet', 'corrosive', mode), weaponType: 'rifle' as const } };
      const rig = createEquipmentWeapon(mode, describeItemAppearance(item));
      brandShapes.add(geometryFingerprint(rig.group)); cleanup(rig.group);
    }
    assert.equal(familyShapes.size, families.length); assert.equal(brandShapes.size, brandList.length);
  }
});

test('changing only elemental cartridges preserves receiver, stock, grip and body paint', () => {
  const base = rollItem('pilot', 1, seededRandom(41), 'weapon'); base.affix = null;
  const looks = ['fire', 'ice', 'corrosive', 'shock'].map(element => describeItemAppearance({ ...base, weapon: { ...createWeaponSpec('bullet', element as 'fire'), weaponType: 'rifle', trail: 'tracer', visualVariant: 2 } }));
  const snapshots = looks.map(look => {
    const rig = createEquipmentWeapon('pilot', look);
    const names = ['weapon-receiver', 'weapon-stock', 'pistol-grip', 'weapon-box-magazine'];
    const snapshot = names.map(name => {
      const part = rig.group.getObjectByName(name) as THREE.Mesh;
      return [part.geometry.getAttribute('position').array, part.position.toArray(), (part.material as THREE.MeshToonMaterial).color.getHex()];
    });
    cleanup(rig.group); return snapshot;
  });
  snapshots.slice(1).forEach(snapshot => assert.deepEqual(snapshot, snapshots[0]));
});

test('dual elemental idle effects attach only to cartridge surfaces, leaving broad gun surfaces uncoated', () => {
  for (const mode of ['pilot', 'mech'] as const) {
    const item = rollItem(mode, 1, seededRandom(25), 'weapon');
    item.weapon = { ...createWeaponSpec('orb', 'corrosive', mode), secondaryElement: 'shock' };
    const look = resolveEquipmentAppearance(createProgression(), mode, item);
    const rig = createEquipmentWeapon(mode, look.weapon, look);
    const receiver = rig.group.getObjectByName(mode === 'pilot' ? 'weapon-receiver' : 'cannon-receiver')!;
    updateEquipmentEffects(rig.group, .2, .2);
    const elements = new Set<string>(); let overlays = 0;
    rig.group.traverse(object => {
      if (object.userData.elementCoating) {
        overlays++; elements.add(object.userData.element);
        assert.equal(object.parent?.userData.equipmentElementSurface, object.userData.element);
      }
    });
    assert.deepEqual([...elements].sort(), ['corrosive', 'shock']);
    assert.equal(overlays, mode === 'pilot' ? 6 : 12);
    assert.equal(receiver.children.filter(child => child.userData.elementCoating).length, 0);
    cleanup(rig.group);
  }
});

test('same-element rifles preserve delivery silhouettes and expose six genuinely different trail geometries', () => {
  const deliveries: ProjectileType[] = ['bullet', 'slug', 'spike', 'ricochet', 'homing', 'sticky', 'orb', 'scatter', 'rocket', 'disc'];
  const silhouettes = new Set<string>();
  for (const projectile of deliveries) {
    const root = createProjectileVisual({ ...createWeaponSpec(projectile, 'corrosive'), weaponType: 'rifle' }, 'tackwork');
    // Cosmetic projectile geometry is excluded from comic outlines, but still differs physically.
    root.userData.comicOverlay = false; silhouettes.add(geometryFingerprint(root)); cleanup(root);
  }
  assert.equal(silhouettes.size, deliveries.length);
  const styles: ProjectileTrail[] = ['clean', 'tracer', 'helix', 'pulse', 'comet', 'ribbon'];
  const trails = new Set<string>();
  for (const trail of styles) {
    const root = createProjectileTrail(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, -3), { ...createWeaponSpec('bullet', 'corrosive'), trail }, 'tackwork');
    trails.add(JSON.stringify(root.children.map(child => [(child as THREE.Mesh).geometry.type, Array.from((child as THREE.Mesh).geometry.getAttribute('position').array), child.position.toArray(), child.quaternion.toArray()])));
    cleanup(root);
  }
  assert.equal(trails.size, styles.length);
});

test('instant beams honor trail and dual-color choices, and both hit payloads survive the real simulation', () => {
  const spec = { ...createWeaponSpec('beam', 'corrosive'), secondaryElement: 'shock' as const, trail: 'helix' as const, visualVariant: 3, spread: 0 };
  const visual = createBeamVisual(new THREE.Vector3(), new THREE.Vector3(0, 0, -5), spec, false, 'voltaic');
  const hues = new Set(visual.children.filter(child => child.name === 'beam-core').map(child => ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).color.getHex()));
  assert.equal(hues.size, 2); assert.ok(visual.children.length > 20); cleanup(visual);
  const scene = new THREE.Scene(), target = new THREE.Group(); target.position.z = -3;
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()); body.userData.enemyId = 1; target.add(body); scene.add(target);
  let hits = 0;
  const ballistics = new PlayerBallistics(scene, { targets: () => [{ id: 1, root: target, radius: 1 }], occluders: () => [], hit: event => { hits++; assert.equal(event.damage, 17); assert.equal(event.spec.secondaryElement, 'shock'); } });
  ballistics.fire(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), spec, 17, undefined, 'voltaic');
  assert.equal(hits, 1); assert.ok(scene.getObjectByName('player-ballistic-impact-corrosive')); assert.ok(scene.getObjectByName('player-ballistic-impact-shock'));
  ballistics.clear(); assert.equal(scene.children.length, 1);
  body.geometry.dispose(); (body.material as THREE.Material).dispose();
});
