import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWeaponSpec, type WeaponSpec } from '../src/core/arsenal.ts';
import { PlayerBallistics } from '../src/rendering/PlayerBallistics.ts';
import { GamePresentation } from '../src/rendering/quality/GamePresentation.ts';
import { createElementalBeam, createElementalProjectile, createElementalTrail } from '../src/rendering/quality/elementalFlight.ts';
import { ComposedElementalPresentation, type ElementModule, type ElementResponse } from '../src/rendering/quality/shared/composedPresentation.ts';

let documentDescriptor: PropertyDescriptor | undefined;
before(() => {
  documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {} }) }),
  } });
});
after(() => {
  if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor);
  else Reflect.deleteProperty(globalThis, 'document');
});

const start = new THREE.Vector3(2, 3, 4), end = new THREE.Vector3(-1, 5, -8);
const brand = 'ironvale' as const;
function dispose(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  root.removeFromParent();
}
function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  root.traverse(object => { if (object instanceof THREE.Mesh) result.push(object); });
  return result;
}
/** Compare actual visible generic geometry/materials, excluding the narrow test response. */
function genericSnapshot(root: THREE.Object3D, element?: string): unknown[] {
  root.updateWorldMatrix(true, true);
  return meshes(root).filter(mesh => !mesh.name.startsWith('test-') && (!element || mesh.userData.element === element)).map(mesh => ({
    name: mesh.name,
    parts: mesh.userData.authoredParts,
    element: mesh.userData.element,
    positions: Array.from(mesh.geometry.getAttribute('position').array),
    matrix: mesh.matrixWorld.toArray(),
    materials: (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(material => ({
      type: material.type,
      color: (material as THREE.MeshBasicMaterial).color?.getHex(),
      opacity: material.opacity,
      depthTest: material.depthTest,
      depthWrite: material.depthWrite,
    })),
  }));
}
function count(root: THREE.Object3D, name: string): number {
  let result = 0;
  root.traverse(object => { if (object.name === name) result++; });
  return result;
}
function neck(label: string): THREE.Group {
  const root = new THREE.Group(); root.name = `test-${label}-neck`;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(.006, .003, .08, 5), new THREE.MeshBasicMaterial({ color: 0xd9a13e }));
  mesh.name = `test-${label}-neck-mesh`; root.add(mesh);
  return root;
}
function thread(label: string, a: THREE.Vector3, b: THREE.Vector3): THREE.Group {
  const root = new THREE.Group(); root.name = `test-${label}-thread`;
  root.userData.start = a.toArray(); root.userData.end = b.toArray();
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 1, .004, 5, false), new THREE.MeshBasicMaterial({ color: 0xd9a13e }));
  mesh.name = `test-${label}-thread-mesh`; root.add(mesh);
  return root;
}
function response(label = 'live') {
  const calls = { decorate: 0, trail: 0, beam: 0, update: 0, dispose: 0 };
  const hooks: NonNullable<ElementModule['flight']> = {
    decorateProjectile(root) { calls.decorate++; root.add(neck(label)); },
    trail(a, b) { calls.trail++; return thread(label, a, b); },
    beam(a, b) { calls.beam++; return thread(`${label}-beam`, a, b); },
    updateProjectile(root, _dt, age) { calls.update++; root.userData.testFlightAge = age; },
  };
  const value: ElementResponse = { ...hooks, impact() {}, clear() {}, dispose() { calls.dispose++; } };
  return { calls, hooks, value };
}

for (const adhesivePrimary of [true, false]) test(`trail-only replacement preserves generic projectile and beam with adhesive ${adhesivePrimary ? 'primary' : 'secondary'}`, () => {
  const own = response(), layer = new ComposedElementalPresentation(new THREE.Scene(), new THREE.PerspectiveCamera(), {
    adhesive: { replaceFlight: { trail: true }, create: () => own.value },
  });
  const spec: WeaponSpec = { ...createWeaponSpec('rocket', adhesivePrimary ? 'adhesive' : 'shock'), secondaryElement: adhesivePrimary ? 'shock' : 'adhesive' };
  const recipe = structuredClone(spec), endpoints = [start.toArray(), end.toArray()];
  const roots: THREE.Group[] = [];
  try {
    const projectile = layer.projectile(spec, brand), genericProjectile = createElementalProjectile(spec, brand);
    roots.push(projectile, genericProjectile);
    assert.ok(projectile.getObjectByName(`quality-${adhesivePrimary ? 'primary' : 'secondary'}-adhesive-payload`));
    assert.equal(count(projectile, 'test-live-neck'), 1);
    assert.deepEqual(genericSnapshot(projectile), genericSnapshot(genericProjectile));

    const trail = layer.trail(start, end, spec, brand), genericTrail = createElementalTrail(start, end, spec, brand);
    roots.push(trail, genericTrail);
    assert.ok(genericSnapshot(genericTrail, 'adhesive').length > 0, 'baseline actually contains the replaced channel');
    assert.equal(genericSnapshot(trail, 'adhesive').length, 0);
    assert.deepEqual(genericSnapshot(trail, 'shock'), genericSnapshot(genericTrail, 'shock'));
    assert.equal(count(trail, 'test-live-thread'), 1, 'one supplied trail replaces one generic adhesive contribution');
    assert.equal(own.calls.trail, 1);
    assert.deepEqual(trail.userData.start, endpoints[0]); assert.deepEqual(trail.userData.end, endpoints[1]);

    for (const jagged of [false, true]) {
      const beam = layer.beam(start, end, spec, jagged, brand), genericBeam = createElementalBeam(start, end, spec, jagged, brand);
      roots.push(beam, genericBeam);
      assert.ok(genericSnapshot(beam, 'adhesive').length > 0);
      assert.deepEqual(genericSnapshot(beam), genericSnapshot(genericBeam));
      assert.equal(count(beam, 'test-live-beam-thread'), 0);
    }
    assert.equal(own.calls.decorate, 1); assert.equal(own.calls.beam, 0);
    assert.deepEqual(spec, recipe); assert.deepEqual([start.toArray(), end.toArray()], endpoints);
  } finally { roots.forEach(dispose); layer.dispose(); }
});

for (const policy of [undefined, false, true] as const) test(`boolean ${String(policy)} retains its existing flight composition behavior`, () => {
  const own = response(), layer = new ComposedElementalPresentation(new THREE.Scene(), new THREE.PerspectiveCamera(), {
    adhesive: { replaceFlight: policy, create: () => own.value },
  });
  const spec: WeaponSpec = { ...createWeaponSpec('bullet', 'adhesive'), secondaryElement: 'ice' };
  const projectile = layer.projectile(spec, brand), trail = layer.trail(start, end, spec, brand), beam = layer.beam(start, end, spec, false, brand);
  const generic = [createElementalProjectile(spec, brand), createElementalTrail(start, end, spec, brand), createElementalBeam(start, end, spec, false, brand)];
  try {
    assert.equal(count(projectile, 'test-live-neck'), 1);
    for (const [index, root] of [projectile, trail, beam].entries()) {
      assert.ok(genericSnapshot(root, 'ice').length > 0, 'unrelated secondary channel remains');
      assert.deepEqual(genericSnapshot(root, 'ice'), genericSnapshot(generic[index], 'ice'));
      if (policy === true) assert.equal(genericSnapshot(root, 'adhesive').length, 0);
      else assert.deepEqual(genericSnapshot(root), genericSnapshot(generic[index]));
    }
    assert.equal(count(trail, 'test-live-thread'), policy === true ? 1 : 0);
    assert.equal(count(beam, 'test-live-beam-thread'), policy === true ? 1 : 0);
    assert.equal(own.calls.trail, policy === true ? 1 : 0); assert.equal(own.calls.beam, policy === true ? 1 : 0);
  } finally { [projectile, trail, beam, ...generic].forEach(dispose); layer.dispose(); }
});

test('boolean full replacement may omit absent live hooks, then restores generic flight after disposal', () => {
  const layer = new ComposedElementalPresentation(new THREE.Scene(), new THREE.PerspectiveCamera(), {
    adhesive: { replaceFlight: true, create: () => ({ impact() {}, clear() {}, dispose() {} }) },
  });
  const spec = createWeaponSpec('bullet', 'adhesive'), roots: THREE.Group[] = [];
  const build = () => [layer.projectile(spec, brand), layer.trail(start, end, spec, brand), layer.beam(start, end, spec, false, brand)];
  try {
    const live = build(); roots.push(...live);
    for (const root of live) assert.equal(genericSnapshot(root, 'adhesive').length, 0);
    layer.dispose();
    const retained = build(); roots.push(...retained);
    for (const root of retained) assert.ok(genericSnapshot(root, 'adhesive').length > 0);
  } finally { roots.forEach(dispose); if (layer.responses.size) layer.dispose(); }
});

test('an in-flight trail-only module retains static hooks through the real Legacy lifecycle', () => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const live = response('live'), retained = response('retained'), world = new THREE.Group(); world.name = 'test-world-response';
  const sim = new PlayerBallistics(scene, { targets: () => [], occluders: () => [], hit() {} });
  const owner = new GamePresentation({ scene, camera, weaponRoot: new THREE.Group(), ballistics: sim, comicRenderer: { outlineWidth: 3 } });
  let layer!: ComposedElementalPresentation;
  owner.setSoundEnabled(false);
  owner.setElementalFactory((activeScene, activeCamera) => {
    layer = new ComposedElementalPresentation(activeScene, activeCamera, { adhesive: {
      replaceFlight: { trail: true }, flight: retained.hooks,
      create() {
        scene.add(world);
        return { ...live.value, dispose() { live.value.dispose(); world.removeFromParent(); } };
      },
    } });
    return layer;
  });
  const spec: WeaponSpec = { ...createWeaponSpec('bullet', 'adhesive'), secondaryElement: 'shock' };
  const recipe = structuredClone(spec), roots: THREE.Group[] = [];
  try {
    owner.setEnabled(true);
    sim.fire(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, 0, -1), spec, 20, 80);
    const carrier = scene.children.find(object => object.name === 'quality-projectile-bullet')!;
    assert.ok(carrier.getObjectByName('quality-primary-adhesive-payload'));
    assert.equal(count(carrier, 'test-live-neck'), 1);
    sim.update(1 / 120);
    assert.equal(live.calls.trail, 1); assert.equal(retained.calls.trail, 0);
    owner.setEnabled(false);
    assert.equal(owner.mode, 'legacy'); assert.equal(sim.activeCount, 1);
    assert.equal(world.parent, null); assert.equal(live.calls.dispose, 1); assert.equal(layer.responses.size, 0);
    const liveCallsAtDisposal = { ...live.calls };

    sim.update(1 / 120);
    assert.equal(retained.calls.trail, 1); assert.equal(retained.calls.update, 1);
    assert.deepEqual(live.calls, liveCallsAtDisposal, 'captured shots never reenter the disposed world response');
    const capturedTrail = scene.children.find(object => !!object.getObjectByName('test-retained-thread'))!;
    assert.ok(capturedTrail);
    assert.equal(count(capturedTrail, 'test-retained-thread'), 1);
    assert.equal(genericSnapshot(capturedTrail, 'adhesive').length, 0);
    assert.ok(genericSnapshot(capturedTrail, 'shock').length > 0);

    const projectile = layer.projectile(spec, brand), beam = layer.beam(start, end, spec, false, brand);
    const baselineProjectile = createElementalProjectile(spec, brand), baselineBeam = createElementalBeam(start, end, spec, false, brand);
    roots.push(projectile, beam, baselineProjectile, baselineBeam);
    assert.equal(count(projectile, 'test-retained-neck'), 1);
    assert.deepEqual(genericSnapshot(projectile), genericSnapshot(baselineProjectile));
    assert.deepEqual(genericSnapshot(beam), genericSnapshot(baselineBeam));
    assert.equal(retained.calls.beam, 0, 'the static beam hook does not opt into replacement');
    assert.equal(retained.calls.dispose, 0, 'static hooks do not acquire world-response ownership');
    assert.deepEqual(spec, recipe);
  } finally { roots.forEach(dispose); sim.clear(); owner.dispose(); }
});
