import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import * as THREE from 'three';
import { createHash } from 'node:crypto';
import { createProgression, type Mode, type Slot } from '../src/core/index.ts';
import { resolveEquipmentAppearance, type EquipmentAppearance, type EquipmentLoadoutAppearance } from '../src/core/appearance.ts';
import { createEquipmentCharacter, createEquipmentWeapon, disposeEquipmentModel } from '../src/rendering/equipmentModels.ts';

let originalDocument: PropertyDescriptor | undefined;
before(() => {
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {} }) }) },
  });
});
after(() => {
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else Reflect.deleteProperty(globalThis, 'document');
});

function look(mode: Mode, forms: Partial<Record<Slot, EquipmentAppearance['form']>> = {}): EquipmentLoadoutAppearance {
  const appearance = resolveEquipmentAppearance(createProgression(), mode);
  for (const slot of ['weapon', 'shield', 'reactor', 'legs'] as const) {
    appearance[slot] = { ...appearance[slot], equipped: true, variant: 0, form: forms[slot] ?? 'standard', key: `fixture:${mode}:${slot}:${forms[slot] ?? 'standard'}` };
  }
  return appearance;
}

function descendantsOf(root: THREE.Object3D, target: THREE.Object3D): boolean {
  for (let ancestor: THREE.Object3D | null = target; ancestor; ancestor = ancestor.parent) if (ancestor === root) return true;
  return false;
}

for (const mode of ['pilot', 'mech'] as const) {
  test(`${mode} weapon affixes change physical silhouette and operating assemblies`, () => {
    const models = ['standard', 'heavy', 'rapid', 'compact'].map(form => createEquipmentWeapon(mode, look(mode, { weapon: form as EquipmentAppearance['form'] }).weapon));
    const [standard, heavy, rapid, compact] = models;
    const size = (root: THREE.Object3D) => new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
    assert.ok(size(heavy.group).z > size(compact.group).z * 1.6, 'Heavy long barrels must visibly exceed compact gun length');
    assert.ok(size(heavy.group).x > size(compact.group).x, 'The heavy receiver must be broader');
    assert.ok(rapid.group.getObjectByName('rotary-barrel'));
    assert.ok(rapid.group.getObjectByName(mode === 'pilot' ? 'weapon-drum-magazine' : 'cannon-ammunition-drum'));
    assert.ok(!standard.group.getObjectByName('rotary-barrel'));
    assert.ok(compact.group.getObjectByName(mode === 'pilot' ? 'folded-stock-spine' : 'compact-cannon-cell'));
    assert.ok(heavy.group.getObjectByName('heavy-muzzle-brake'));
    assert.equal(standard.barrels.length, mode === 'pilot' ? 1 : 2);
    assert.equal(rapid.barrels.length, mode === 'pilot' ? 1 : 2, 'Rotary tubes remain one animated assembly per side');
    models.forEach(model => disposeEquipmentModel(model.group));
  });

  test(`${mode} reload homes and muzzle locations refer to real movable model parts`, () => {
    const appearance = look(mode, { weapon: 'heavy' });
    const rig = createEquipmentWeapon(mode, appearance.weapon, appearance);
    assert.equal(rig.muzzles.length, rig.barrels.length);
    rig.barrels.forEach((barrel, index) => {
      assert.deepEqual(barrel.position.toArray(), rig.barrelHomes[index].toArray());
      assert.notEqual(barrel.position, rig.barrelHomes[index]);
      assert.ok(descendantsOf(barrel, rig.muzzles[index]));
      const prior = rig.muzzles[index].getWorldPosition(new THREE.Vector3());
      barrel.position.z += 0.15;
      const moved = rig.muzzles[index].getWorldPosition(new THREE.Vector3());
      assert.ok(Math.abs(moved.z - prior.z - 0.15) < 0.000001);
    });
    if (mode === 'pilot') {
      assert.deepEqual(rig.group.position.toArray(), [0.34, -0.30, -0.65]);
      assert.ok(rig.magazine && rig.bolt && rig.supportHand);
      assert.deepEqual(rig.magazine.position.toArray(), rig.magazineHome!.toArray());
    } else {
      assert.equal(rig.breeches.length, 2);
      rig.breeches.forEach((breech, index) => {
        assert.deepEqual(breech.position.toArray(), rig.breechHomes[index].toArray());
        const hatch = breech.getObjectByName('breech-hatch') as THREE.Mesh;
        hatch.geometry.computeBoundingBox();
        const bounds = hatch.geometry.boundingBox!;
        assert.ok(Math.abs(hatch.position.z + bounds.max.z) < 0.000001, 'Hinge must lie on the actual rear hatch edge');
        assert.ok(Math.abs(hatch.position.y + bounds.min.y) < 0.000001, 'Resting hatch bottom must sit on its hinge height');
      });
    }
    disposeEquipmentModel(rig.group);
  });

  test(`${mode} full actor includes every equipped slot and omits empty add-on assemblies`, () => {
    const loadout = look(mode, { shield: 'fortified', reactor: 'capacity', legs: 'armored' });
    const actor = createEquipmentCharacter(mode, loadout);
    assert.deepEqual(actor.children.map(child => child.name), ['legs', 'torso', 'head', 'arms']);
    const bounds = new THREE.Box3().setFromObject(actor);
    assert.ok(Math.abs(bounds.min.y) < 0.000001, 'Actor feet must be grounded at y0');
    assert.ok(bounds.max.y > (mode === 'pilot' ? 1.7 : 5.8));
    for (const slot of ['shield', 'reactor', 'legs'] as const) {
      assert.ok(actor.getObjectByName(`equipment-${slot}`), `${slot} needs visible geometry`);
    }
    assert.ok(actor.getObjectByName(mode === 'pilot' ? 'equipment-weapon' : 'equipment-weapon-left'));
    assert.ok(actor.getObjectByName(mode === 'pilot' ? 'armored-pilot-shin' : 'armored-shin-plate'));
    assert.ok(actor.getObjectByName('high-capacity-battery'));
    assert.ok(actor.getObjectByName('fortified-arm-shield'));
    for (const descriptor of Object.values(loadout)) descriptor.equipped = false;
    const empty = createEquipmentCharacter(mode, loadout);
    let equippedAssemblies = 0;
    empty.traverse(object => { if (object.userData.equipmentSlot) equippedAssemblies++; });
    assert.equal(equippedAssemblies, 0);
    assert.ok(empty.getObjectByName(mode === 'pilot' ? 'pilot-jacket' : 'torso-chassis'));
    disposeEquipmentModel(actor);
    disposeEquipmentModel(empty);
  });
}

test('first-person nonweapon modules are physically present only for equipped slots', () => {
  const pilot = look('pilot', { shield: 'fortified', reactor: 'vented' });
  const mech = look('mech', { shield: 'lightweight', reactor: 'capacity', legs: 'sprinter' });
  const pilotRig = createEquipmentWeapon('pilot', pilot.weapon, pilot);
  const mechRig = createEquipmentWeapon('mech', mech.weapon, mech);
  assert.ok(pilotRig.group.getObjectByName('fortified-view-shield'));
  assert.ok(pilotRig.group.getObjectByName('view-cooling-fin'));
  assert.ok(mechRig.group.getObjectByName('cockpit-shield-wing'));
  assert.ok(mechRig.group.getObjectByName('view-reactor-side-pod'));
  assert.ok(mechRig.group.getObjectByName('view-lower-servo-piston'));
  pilot.shield.equipped = false;
  const noShield = createEquipmentWeapon('pilot', pilot.weapon, pilot);
  assert.ok(!noShield.group.getObjectByName('equipment-shield'));
  [pilotRig, mechRig, noShield].forEach(model => disposeEquipmentModel(model.group));
});

test('independent model calls do not share disposable geometry or material instances', () => {
  const appearance = look('mech', { weapon: 'rapid', shield: 'fortified', reactor: 'vented', legs: 'sprinter' });
  const first = createEquipmentCharacter('mech', appearance);
  const second = createEquipmentCharacter('mech', appearance);
  const firstGeometry = new Set<THREE.BufferGeometry>(), firstMaterials = new Set<THREE.Material>();
  first.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    firstGeometry.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => firstMaterials.add(material));
  });
  second.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    assert.ok(!firstGeometry.has(object.geometry));
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) assert.ok(!firstMaterials.has(material));
  });
  let disposedGeometry = 0, disposedMaterials = 0;
  firstGeometry.forEach(geometry => geometry.addEventListener('dispose', () => disposedGeometry++));
  firstMaterials.forEach(material => material.addEventListener('dispose', () => disposedMaterials++));
  disposeEquipmentModel(first);
  assert.equal(disposedGeometry, firstGeometry.size);
  assert.equal(disposedMaterials, firstMaterials.size);
  disposeEquipmentModel(second);
});

type VisualOwner = Slot | 'body';
const visualOwners: VisualOwner[] = ['body', 'weapon', 'shield', 'reactor', 'legs'];

/** Snapshot actual uploaded mesh data and world transforms, ignoring random resource IDs. */
function modelSnapshot(root: THREE.Group, firstPerson: boolean): Record<VisualOwner, Record<string, string>> {
  const result = { body: {}, weapon: {}, shield: {}, reactor: {}, legs: {} } as Record<VisualOwner, Record<string, string>>;
  root.updateMatrixWorld(true);
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    let owner: VisualOwner = firstPerson ? 'weapon' : 'body';
    for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent) {
      if (ancestor.name === 'weapon-support-hand') { owner = 'body'; break; }
      const declared = ancestor.userData.visualOwner ?? ancestor.userData.equipmentSlot;
      if (visualOwners.includes(declared)) { owner = declared; break; }
    }
    const path: string[] = [];
    for (let current: THREE.Object3D | null = object; current; current = current.parent) {
      const ordinal = current.parent?.children.filter(child => child.name === current!.name).indexOf(current) ?? 0;
      path.unshift(`${current.name || current.type}[${ordinal}]`);
    }
    const materials = (Array.isArray(object.material) ? object.material : [object.material]).map(material => {
      const colored = material as THREE.MeshToonMaterial;
      return {
        type: material.type, color: colored.color?.toArray(), emissive: colored.emissive?.toArray(),
        opacity: material.opacity, transparent: material.transparent, side: material.side,
        depthTest: material.depthTest, depthWrite: material.depthWrite, toneMapped: material.toneMapped,
        map: colored.map?.uuid ?? null, gradient: colored.gradientMap?.uuid ?? null,
        customProgram: material.customProgramCacheKey(),
      };
    });
    const content = {
      geometry: {
        type: object.geometry.type,
        index: object.geometry.index ? Array.from(object.geometry.index.array) : null,
        attributes: Object.fromEntries((Object.entries(object.geometry.attributes) as [string, THREE.BufferAttribute][]).map(([key, attribute]) => [key, { itemSize: attribute.itemSize, normalized: attribute.normalized, array: Array.from(attribute.array) }])),
        groups: object.geometry.groups,
      },
      materials, matrix: object.matrixWorld.toArray(), visible: object.visible,
      castShadow: object.castShadow, receiveShadow: object.receiveShadow,
    };
    result[owner][path.join('/')] = createHash('sha256').update(JSON.stringify(content)).digest('hex');
  });
  return result;
}

function changedPieces(before: Record<string, string>, after: Record<string, string>): string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => before[key] !== after[key]).sort();
}

const alternateForms: Record<Slot, EquipmentAppearance['form'][]> = {
  weapon: ['heavy', 'rapid', 'compact'], shield: ['fortified', 'lightweight'], reactor: ['vented', 'capacity'], legs: ['sprinter', 'armored'],
};

for (const mode of ['pilot', 'mech'] as const) {
  for (const firstPerson of [false, true]) {
    test(`${mode} ${firstPerson ? 'first-person rig' : 'full actor'} slot isolation preserves every unrelated mesh, material and transform`, () => {
      const original = look(mode);
      const make = (loadout: EquipmentLoadoutAppearance) => firstPerson
        ? createEquipmentWeapon(mode, loadout.weapon, loadout).group
        : createEquipmentCharacter(mode, loadout);
      const baseline = make(original);
      const before = modelSnapshot(baseline, firstPerson);
      for (const slot of ['weapon', 'shield', 'reactor', 'legs'] as const) {
        for (const form of [...alternateForms[slot], 'empty'] as const) {
          const replacement = structuredClone(original);
          replacement[slot] = {
            ...replacement[slot], key: `replacement:${slot}:${form}`, equipped: form !== 'empty',
            form: form === 'empty' ? 'standard' : form, variant: 2,
            primary: 0x7733aa, secondary: 0x33aa77, accent: 0xf12288, metal: 0xaaa133,
          };
          const candidate = make(replacement);
          const after = modelSnapshot(candidate, firstPerson);
          for (const unrelated of visualOwners.filter(owner => owner !== slot)) {
            assert.deepEqual(changedPieces(before[unrelated], after[unrelated]), [], `${mode} ${firstPerson ? 'viewmodel' : 'actor'} ${slot}/${form} changed unrelated ${unrelated} pieces`);
          }
          if (Object.keys(before[slot]).length > 0) {
            assert.ok(changedPieces(before[slot], after[slot]).length > 0, `${slot}/${form} must actually alter its own visible geometry or material`);
          }
          disposeEquipmentModel(candidate);
        }
      }
      disposeEquipmentModel(baseline);
    });
  }
}
