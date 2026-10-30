import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import * as THREE from 'three';
import { createWeaponSpec, type ElementType } from '../src/core/arsenal.ts';
import type { BallisticPresentationImpact } from '../src/rendering/PlayerBallistics.ts';
import { ElementalImpacts, ELEMENTAL_IMPACT_CAPACITY } from '../src/rendering/quality/elementalImpacts.ts';
import { ElementalPresentation } from '../src/rendering/quality/elementalPresentation.ts';
import { AdhesivePresentation } from '../src/rendering/quality/adhesive/presentation.ts';
import { FirePresentation } from '../src/rendering/quality/fire/presentation.ts';
import { IcePresentation } from '../src/rendering/quality/ice/presentation.ts';
import { ShockPresentation } from '../src/rendering/quality/shock/ShockPresentation.ts';
import { ComposedElementalPresentation } from '../src/rendering/quality/shared/composedPresentation.ts';

let originalDocument: PropertyDescriptor | undefined;
before(() => {
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {} }) }) } });
});
after(() => { if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document'); });
function event(element: ElementType = 'kinetic', stage: 'cluster-burst' | 'bomblet' = 'cluster-burst'): BallisticPresentationImpact {
  return { spec: createWeaponSpec('cluster', element), point: new THREE.Vector3(0, .3, -4), normal: new THREE.Vector3(0, 1, 0), radius: 3, phase: 'detonate', stage, energy: 20 };
}
function shards(impacts: ElementalImpacts): THREE.InstancedMesh { return impacts.group.getObjectByName('elemental-shard-pool') as THREE.InstancedMesh; }
function size(mesh: THREE.InstancedMesh, index: number): THREE.Vector3 {
  const matrix = new THREE.Matrix4(); mesh.getMatrixAt(index, matrix);
  return new THREE.Vector3().setFromMatrixScale(matrix);
}
function snapshot(impacts: ElementalImpacts) {
  return impacts.group.children.map(child => {
    const mesh = child as THREE.InstancedMesh;
    return { name: mesh.name, count: mesh.count, matrix: Array.from(mesh.instanceMatrix.array).slice(0, mesh.count * 16), tint: Array.from(mesh.geometry.getAttribute('fxTint').array).slice(0, mesh.count * 3) };
  });
}

test('Cluster gets a brief readable physical flash and fragments, with smaller secondary bursts', () => {
  const parent = new ElementalImpacts(new THREE.Scene()), child = new ElementalImpacts(new THREE.Scene());
  parent.delivery(event()); child.delivery(event('kinetic', 'bomblet'));
  const parentMesh = shards(parent), childMesh = shards(child);
  assert.ok(parentMesh.count >= 6 && childMesh.count >= 4);
  assert.ok(size(parentMesh, 0).length() > .5, 'The parent cue must be materially more visible than the old tiny sparks');
  assert.ok(size(childMesh, 0).length() < size(parentMesh, 0).length());
  assert.equal((parentMesh.material as THREE.Material).depthTest, true);
  assert.equal((parentMesh.material as THREE.Material).depthWrite, false);
  for (const layer of [parent, child]) {
    layer.update(.1); layer.update(.03);
    for (let i = 0; i < shards(layer).count; i++) assert.ok(size(shards(layer), i).length() < .2, 'The large flash must already be gone');
    for (let i = 0; i < 4; i++) layer.update(.1);
    assert.equal(layer.activeCount, 0); layer.dispose();
  }
});

test('delivery guard leaves noncluster effects and their existing cosmetic sequence exact', () => {
  const control = new ElementalImpacts(new THREE.Scene()), candidate = new ElementalImpacts(new THREE.Scene());
  const ordinary = { ...event('ice'), spec: createWeaponSpec('rocket', 'ice') };
  candidate.delivery(ordinary); candidate.delivery({ ...event(), phase: 'contact' }); candidate.delivery({ ...event(), stage: undefined });
  assert.equal(candidate.activeCount, 0);
  control.impact(ordinary); candidate.impact(ordinary);
  assert.deepEqual(snapshot(candidate), snapshot(control)); control.dispose(); candidate.dispose();
});

test('delivery cosmetics vary per event, pause with the shared clock and retain the existing fixed pool limits', () => {
  const impacts = new ElementalImpacts(new THREE.Scene()), resources = [...impacts.group.children];
  impacts.delivery(event()); const first = snapshot(impacts);
  for (const dt of [0, -1, NaN, Infinity]) impacts.update(dt);
  assert.deepEqual(snapshot(impacts), first);
  impacts.clear(); impacts.delivery(event()); assert.notDeepEqual(snapshot(impacts), first);
  for (let i = 0; i < 400; i++) impacts.delivery(event('kinetic', i % 2 ? 'bomblet' : 'cluster-burst'));
  assert.deepEqual(impacts.group.children, resources);
  assert.ok(impacts.activeCount <= Object.values(ELEMENTAL_IMPACT_CAPACITY).reduce((sum, capacity) => sum + capacity, 0));
  assert.equal(impacts.group.children.length, 7);
  impacts.dispose(); assert.equal(impacts.activeCount, 0); impacts.delivery(event()); assert.equal(impacts.activeCount, 0);
});

test('pure, dual and composed adapters route one physical cue per Cluster stage, including CorrosiveAB', () => {
  const cases: { element: ElementType; create(scene: THREE.Scene, camera: THREE.Camera): ElementalPresentation }[] = [
    { element: 'kinetic', create: (scene, camera) => new ElementalPresentation(scene, camera) },
    { element: 'corrosive', create: (scene, camera) => new ElementalPresentation(scene, camera, { corrosiveAB: true }) },
    { element: 'fire', create: (scene, camera) => new FirePresentation(scene, camera) },
    { element: 'ice', create: (scene, camera) => new IcePresentation(scene, camera) },
    { element: 'shock', create: (scene, camera) => new ShockPresentation(scene, camera) },
    { element: 'adhesive', create: (scene, camera) => new AdhesivePresentation(scene, camera) },
    { element: 'gravity', create: (scene, camera) => new ComposedElementalPresentation(scene, camera, {}) },
  ];
  for (const variant of cases) for (const dual of [false, true]) {
    const layer = variant.create(new THREE.Scene(), new THREE.PerspectiveCamera());
    let deliveries = 0; const original = layer.impacts.delivery.bind(layer.impacts);
    layer.impacts.delivery = value => { deliveries++; original(value); };
    const spec = { ...event(variant.element).spec, ...(dual ? { secondaryElement: variant.element === 'corrosive' ? 'fire' as const : 'corrosive' as const } : {}) };
    for (const stage of ['cluster-burst', 'bomblet'] as const) layer.impact({ ...event(variant.element, stage), spec });
    assert.equal(deliveries, 2, `${variant.element}/${dual ? 'dual' : 'pure'} must present exactly once for each authoritative stage`);
    assert.ok(shards(layer.impacts).count >= 10, `${variant.element} must retain the physical cue even when it replaces generic element impacts`);
    assert.equal(layer.audio.unlocked, false); layer.dispose();
  }
});
