import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import * as THREE from 'three';
import { createWorld, isWalkable } from '../src/world.ts';

const scene = new THREE.Scene();
let world: ReturnType<typeof createWorld>;
let originalDocument: PropertyDescriptor | undefined;
before(() => {
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => {
        const canvas = { width: 0, height: 0, paintedText: [] as string[], getContext: () => ({ fillRect() {}, strokeRect() {}, fillText(text: string) { canvas.paintedText.push(text); } }) };
        return canvas;
      },
    },
  });
  world = createWorld(scene); scene.updateMatrixWorld(true);
});
after(() => {
  world.dispose();
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document');
});

function belongsTo(object: THREE.Object3D, ancestor: THREE.Object3D): boolean {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) if (current === ancestor) return true;
  return false;
}

test('the three distinct vendors have physical nameplates, displayed equipment and grounded cabinet bases', () => {
  assert.deepEqual(world.vendingMachines.map(vendor => vendor.id), ['weapons', 'medical', 'mech']);
  const titles = { weapons: 'WEAPONS + AMMO', medical: 'HEALTH + SHIELDS', mech: 'MECH PARTS' };
  for (const vendor of world.vendingMachines) {
    const nameplate = vendor.group.getObjectByName('vendor-nameplate') as THREE.Mesh;
    assert.ok(nameplate.geometry instanceof THREE.BoxGeometry, 'The sign is an actual cabinet face, not a floating text plane');
    const material = (nameplate.material as THREE.Material[])[4] as THREE.MeshBasicMaterial;
    assert.ok(material.map);
    assert.ok((material.map.image as { paintedText: string[] }).paintedText.includes(titles[vendor.id]));
    const bounds = new THREE.Box3().setFromObject(vendor.group);
    assert.ok(Math.abs(bounds.min.y) < 1e-6);
    const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(vendor.group.quaternion);
    const approach = new THREE.Vector3(0, 0, 16).sub(vendor.position).normalize();
    assert.ok(facing.dot(approach) > 0.999, 'The nameplate must face the service approach');
    assert.equal(isWalkable(vendor.position.x, vendor.position.z, 0.48, world.colliders), false);
    assert.equal(isWalkable(vendor.position.x, vendor.position.z, 1.4, world.colliders), false);
    let lines = 0, displayedEquipment = 0;
    vendor.group.traverse(object => { if (object instanceof THREE.Line) lines++; if (object.name.startsWith('item-drop-')) displayedEquipment++; });
    assert.equal(lines, 0);
    assert.ok(displayedEquipment >= 1);
  }
});

test('vendor cabinets do not intersect one another and their actual meshes stop shots', () => {
  const bounds = world.vendingMachines.map(vendor => new THREE.Box3().setFromObject(vendor.group));
  for (let first = 0; first < bounds.length; first++) {
    for (let second = first + 1; second < bounds.length; second++) assert.equal(bounds[first].intersectsBox(bounds[second]), false);
    const vendor = world.vendingMachines[first];
    const front = new THREE.Vector3(0, 0, 1).applyQuaternion(vendor.group.quaternion);
    const origin = vendor.position.clone().addScaledVector(front, 2.5).setY(1.3);
    const hits = new THREE.Raycaster(origin, front.negate(), 0, 5).intersectObjects(world.occluders, true);
    assert.ok(hits.some(hit => belongsTo(hit.object, vendor.group)), `Missing physical shot occlusion for ${vendor.id}`);
  }
});

test('pilot and mech can reach a visible interaction approach for every vendor without leaving the service hub', () => {
  for (const [radius, range] of [[0.48, 4], [1.4, 7]]) {
    const queue: [number, number][] = [[0, 16]], visited = new Set(['0,16']);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const [x, z] = queue[cursor];
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx, nz = z + dz, key = `${nx},${nz}`;
        if (nx < -29 || nx > 4 || nz < 4 || nz > 30 || visited.has(key)) continue;
        if (![0.25, 0.5, 0.75, 1].every(step => isWalkable(x + dx * step, z + dz * step, radius, world.colliders))) continue;
        visited.add(key); queue.push([nx, nz]);
      }
    }
    for (const vendor of world.vendingMachines) {
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(vendor.group.quaternion);
      const reachable = queue.find(([x, z]) => {
        const distance = Math.hypot(x - vendor.position.x, z - vendor.position.z);
        if (distance > range || distance < 0.1) return false;
        if (world.vendingMachines.some(other => other !== vendor && Math.hypot(x - other.position.x, z - other.position.z) < distance)) return false;
        return new THREE.Vector3(x - vendor.position.x, 0, z - vendor.position.z).normalize().dot(forward) > 0.25;
      });
      assert.ok(reachable, `No reachable ${radius === 0.48 ? 'pilot' : 'mech'} interaction approach for ${vendor.id}`);
    }
  }
});

test('vendor shelf products and header lamps meet their supporting physical surfaces', () => {
  for (const vendor of world.vendingMachines) {
    const header = new THREE.Box3().setFromObject(vendor.group.getObjectByName('vendor-nameplate')!);
    const lamp = vendor.group.getObjectByName(vendor.id === 'weapons' ? 'armory-ready-light' : vendor.id === 'medical' ? 'medical-ready-light' : 'mech-depot-ready-light')!;
    const lightBounds = new THREE.Box3().setFromObject(lamp);
    assert.ok(Math.abs(header.min.y - lightBounds.max.y) < 1e-6, 'Status lamps must be mounted to the header');
    const shelves = vendor.group.children.filter(object => object.name.includes('shelf') || object.name.includes('-rack'))
      .map(object => new THREE.Box3().setFromObject(object).max.y);
    const products = vendor.group.children.filter(object => object.name.startsWith('item-drop-') || object.name === 'vendor-medical-case');
    assert.ok(products.length >= 2);
    for (const product of products) {
      const floor = new THREE.Box3().setFromObject(product).min.y;
      assert.ok(shelves.some(top => Math.abs(top - floor) < 1e-6), `${product.name} must rest on an actual shelf`);
    }
  }
});

test('world disposal releases each vendor-owned nameplate texture exactly once', () => {
  const isolated = new THREE.Scene(), instance = createWorld(isolated);
  const disposed: number[] = [];
  instance.vendingMachines.forEach((vendor, index) => {
    disposed[index] = 0;
    (vendor.group.userData.ownedTextures as THREE.Texture[]).forEach(texture => texture.addEventListener('dispose', () => disposed[index]++));
  });
  instance.dispose();
  assert.deepEqual(disposed, [1, 1, 1]);
  assert.equal(isolated.children.length, 0);
});
