import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, afterEach, before, test } from 'node:test';
import * as THREE from 'three';
import { createProgression, type Mode, type Slot } from '../src/core/index.ts';
import { resolveEquipmentAppearance, type EquipmentAppearance, type EquipmentLoadoutAppearance } from '../src/core/appearance.ts';
import { createHealingVisual, type HealingVisual } from '../src/rendering/healingVisual.ts';
import { disposeEquipmentModel } from '../src/rendering/equipmentModels.ts';

let originalDocument: PropertyDescriptor | undefined;
const models: THREE.Group[] = [];
const times = [0, 0.2, 0.46, 0.7, 0.95];

before(() => {
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {} }) }) },
  });
});

afterEach(() => {
  models.forEach(model => disposeEquipmentModel(model));
  models.length = 0;
});

after(() => {
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else Reflect.deleteProperty(globalThis, 'document');
});

function looks(): { pilot: EquipmentLoadoutAppearance; mech: EquipmentLoadoutAppearance } {
  const state = createProgression();
  const pilot = resolveEquipmentAppearance(state, 'pilot');
  const mech = resolveEquipmentAppearance(state, 'mech');
  // Distinct bracer paint makes unintended inheritance observable rather than
  // relying on a random equipment palette coincidentally differing from tools.
  pilot.shield = { ...pilot.shield, primary: 0x327e7c, secondary: 0xf2dfb5 };
  return { pilot, mech };
}

function visual(pilot: EquipmentLoadoutAppearance, mech: EquipmentLoadoutAppearance): HealingVisual {
  const result = createHealingVisual(pilot, mech);
  models.push(result.group);
  return result;
}

function changedSlot(look: EquipmentLoadoutAppearance, slot: Slot): EquipmentLoadoutAppearance {
  const forms: Partial<Record<Slot, EquipmentAppearance['form']>> = { weapon: 'heavy', reactor: 'capacity', legs: 'armored' };
  return {
    ...look,
    [slot]: {
      ...look[slot], key: `replacement:${look[slot].target}:${slot}`, equipped: true,
      form: forms[slot] ?? 'fortified', variant: 2,
      primary: 0xff00aa, secondary: 0x00ff33, accent: 0x6633ff, metal: 0x111177,
    },
  };
}

function materialColors(mesh: THREE.Mesh): (number | null)[] {
  return (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(material => {
    const color = (material as THREE.MeshBasicMaterial).color;
    return color instanceof THREE.Color ? color.getHex() : null;
  });
}

function geometryKey(geometry: THREE.BufferGeometry): string {
  const hash = createHash('sha256');
  const attributes = Object.entries(geometry.attributes).sort(([a], [b]) => a.localeCompare(b));
  for (const [name, attribute] of attributes) hash.update(JSON.stringify([name, attribute.itemSize, Array.from(attribute.array)]));
  hash.update(JSON.stringify(geometry.index ? Array.from(geometry.index.array) : null));
  return hash.digest('hex');
}

/** Actual model data, excluding generated UUIDs, material IDs, and shared texture IDs. */
function snapshot(root: THREE.Object3D, includeColors = true): unknown {
  const result: Record<string, unknown> = {
    name: root.name, type: root.type, visible: root.visible,
    position: root.position.toArray(), quaternion: root.quaternion.toArray(), scale: root.scale.toArray(),
  };
  if (root instanceof THREE.Mesh) {
    result.geometry = geometryKey(root.geometry);
    result.materials = (Array.isArray(root.material) ? root.material : [root.material]).map(material => ({
      type: material.type, opacity: material.opacity, transparent: material.transparent,
      depthTest: material.depthTest, depthWrite: material.depthWrite, side: material.side,
    }));
    if (includeColors) result.colors = materialColors(root);
  }
  result.children = root.children.map(child => snapshot(child, includeColors));
  return result;
}

function named(root: THREE.Object3D, name: string): THREE.Object3D {
  const part = root.getObjectByName(name);
  assert.ok(part, `Actual healing model is missing ${name}`);
  return part;
}

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  root.traverse(part => { if (part instanceof THREE.Mesh) result.push(part); });
  return result;
}

test('weapon, reactor, and leg swaps cannot recolor, reshape, or move any healing props in either form', () => {
  const base = looks();
  const reference = visual(base.pilot, base.mech);
  for (const target of ['pilot', 'mech'] as const) {
    for (const slot of ['weapon', 'reactor', 'legs'] as const) {
      const replacement = changedSlot(base[target], slot);
      const candidate = visual(target === 'pilot' ? replacement : base.pilot, target === 'mech' ? replacement : base.mech);
      for (const mode of ['pilot', 'mech'] as const) {
        for (const progress of times) {
          reference.update(mode, progress, true);
          candidate.update(mode, progress, true);
          assert.deepEqual(snapshot(candidate.group), snapshot(reference.group),
            `${target} ${slot} swap leaked into ${mode} recovery appearance at progress ${progress}`);
        }
      }
    }
  }
});

test('pilot shield paint changes only its offered bracer while injector, sleeve, and mech tools stay identical', () => {
  const base = looks();
  const shield = { ...base.pilot.shield, key: 'replacement:pilot:shield', primary: 0xd4236a, secondary: 0x4fe2ee };
  const reference = visual(base.pilot, base.mech);
  const candidate = visual({ ...base.pilot, shield }, base.mech);
  for (const mode of ['pilot', 'mech'] as Mode[]) {
    for (const progress of times) {
      reference.update(mode, progress, true);
      candidate.update(mode, progress, true);
      assert.deepEqual(snapshot(candidate.group, false), snapshot(reference.group, false), 'A paint-only shield change must preserve every recovery shape and animation transform');
      for (const name of ['injector-hand', 'medical-injector', 'repair-arm--1', 'repair-arm-1']) {
        assert.deepEqual(snapshot(named(candidate.group, name)), snapshot(named(reference.group, name)),
          `${name} inherited unrelated pilot shield paint at progress ${progress}`);
      }
      const before = meshes(named(reference.group, 'offered-forearm'));
      const after = meshes(named(candidate.group, 'offered-forearm'));
      assert.equal(after.length, before.length);
      let bracerSurfaces = 0;
      before.forEach((mesh, index) => {
        const expected = materialColors(mesh).map(color => {
          if (color === base.pilot.shield.primary) { bracerSurfaces++; return shield.primary; }
          if (color === base.pilot.shield.secondary) { bracerSurfaces++; return shield.secondary; }
          return color;
        });
        assert.deepEqual(materialColors(after[index]), expected, 'Only existing bracer-painted surfaces may inherit replacement shield colors');
      });
      assert.ok(bracerSurfaces > 0, 'Shield paint must actually reach the offered forearm bracer');
    }
  }
});
