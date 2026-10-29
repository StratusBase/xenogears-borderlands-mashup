import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { focusedStation } from '../src/rendering/focusedInteraction.ts';

test('E offers no station for empty space, an out-of-reach station, or a physical obstruction', () => {
  const terminal = new THREE.Group(); terminal.userData.serviceTerminal = true;
  const surface = new THREE.Mesh(); terminal.add(surface);
  assert.equal(focusedStation([], 4), null);
  assert.equal(focusedStation([{ object: surface, distance: 4.01 }], 4), null);
  assert.equal(focusedStation([{ object: new THREE.Mesh(), distance: 1 }, { object: surface, distance: 2 }], 4), null);
  assert.deepEqual(focusedStation([{ object: surface, distance: 4 }], 4), { kind: 'service' });
});

test('a ray hitting a workbench or vendor physical child resolves the owning station, never a proximity fallback', () => {
  for (const kind of ['weapons', 'medical', 'mech', 'workbench'] as const) {
    const group = new THREE.Group();
    if (kind === 'workbench') group.userData.sandboxWorkbench = true; else group.userData.vendorType = kind;
    const surface = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1), new THREE.MeshBasicMaterial());
    group.add(surface); group.position.z = -3; group.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, -1));
    assert.deepEqual(focusedStation(ray.intersectObject(group, true), 4), kind === 'workbench' ? { kind } : { kind: 'vending', vendor: kind });
    ray.set(new THREE.Vector3(), new THREE.Vector3(1, 0, 0));
    assert.equal(focusedStation(ray.intersectObject(group, true), 4), null);
    surface.geometry.dispose(); (surface.material as THREE.Material).dispose();
  }
});

test('nonphysical overlays are skipped, while hidden ancestors and invalid ranges never activate menus', () => {
  const vendor = new THREE.Group(); vendor.userData.vendorType = 'weapons';
  const glow = new THREE.Group(); glow.userData.comicOverlay = true;
  const surface = new THREE.Mesh(), overlay = new THREE.Mesh(); vendor.add(surface, glow); glow.add(overlay);
  assert.deepEqual(focusedStation([{ object: overlay, distance: 1 }, { object: surface, distance: 2 }], 4), { kind: 'vending', vendor: 'weapons' });
  vendor.visible = false;
  assert.equal(focusedStation([{ object: surface, distance: 2 }], 4), null);
  vendor.visible = true;
  for (const range of [0, -1, NaN, Infinity]) assert.equal(focusedStation([{ object: surface, distance: 2 }], range), null);
});
