import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createWeaponSpec } from '../src/core/arsenal.ts';
import { createProjectileVisual, createProjectileTrail } from '../src/rendering/weaponVisuals.ts';
import { createElementalProjectile, createElementalTrail, updateElementalProjectile } from '../src/rendering/quality/elementalFlight.ts';
import { ElementalPresentation } from '../src/rendering/quality/elementalPresentation.ts';
import { AdhesivePresentation } from '../src/rendering/quality/adhesive/presentation.ts';
import { resinShaders } from '../src/rendering/quality/adhesive/material.ts';
import { ShockPresentation } from '../src/rendering/quality/shock/ShockPresentation.ts';

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  root.traverse(value => { if (value instanceof THREE.Mesh) result.push(value); });
  return result;
}
function parts(root: THREE.Object3D): string[] {
  return meshes(root).flatMap(mesh => [mesh.name, ...(mesh.userData.authoredParts ?? [])]);
}
function dispose(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  for (const mesh of meshes(root)) {
    geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
  }
  geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); root.removeFromParent();
}

test('MIRV bomblets have one readable casing rather than miniature multipod carriers in both renderers', () => {
  for (const factory of [createProjectileVisual, createElementalProjectile]) for (const mode of ['pilot', 'mech'] as const) {
    const original = { ...createWeaponSpec('cluster', 'fire', mode), secondaryElement: 'corrosive' as const };
    const spec = Object.freeze({ ...original, split: Object.freeze({ ...original.split! }) });
    const carrier = factory(spec, 'cindergrid'), child = factory(spec, 'cindergrid', 'bomblet');
    assert.equal(child.userData.projectile, 'cluster');
    assert.equal(child.userData.element, 'fire'); assert.equal(child.userData.secondaryElement, 'corrosive');
    assert.equal(child.userData.clusterRole, 'bomblet');
    assert.ok(parts(child).includes('cluster-bomblet-casing'));
    assert.ok(parts(child).includes('cluster-bomblet-band'));
    assert.ok(child.getObjectByName('cluster-bomblet-fuse-light'));
    assert.equal(parts(child).some(name => name.includes('submunition-casing')), false);
    assert.ok(parts(carrier).some(name => name.includes('submunition-casing')));
    if (factory === createElementalProjectile) {
      assert.ok(child.getObjectByName('quality-primary-fire-payload'));
      assert.ok(child.getObjectByName('quality-secondary-corrosive-payload'));
    }
    assert.deepEqual(spec, original); dispose(carrier); dispose(child);
  }
});

test('bomblet wisps stay local and retain both payload channels without rocket exhaust', () => {
  const start = new THREE.Vector3(3, 1, -4), end = new THREE.Vector3(3, 1, -8);
  const spec = { ...createWeaponSpec('cluster', 'fire'), secondaryElement: 'shock' as const, trail: 'comet' as const };
  for (const factory of [createProjectileTrail, createElementalTrail]) {
    const root = factory(start, end, spec, 'cindergrid', 'bomblet'); root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    assert.ok(bounds.getSize(new THREE.Vector3()).length() < .2, 'A whole flight-step comet would hide the small physical bomblet');
    assert.ok(bounds.getCenter(new THREE.Vector3()).distanceTo(end) < .15);
    assert.equal(meshes(root).length, 2, 'Each payload retains a separate wisp');
    assert.ok(parts(root).every(name => !name.includes('payload-wake') && !name.includes('comet-delivery-taper')));
    assert.deepEqual(start.toArray(), [3, 1, -4]); assert.deepEqual(end.toArray(), [3, 1, -8]); dispose(root);
  }
});

test('bomblet fuse animation uses authoritative state, pauses, and never moves the projectile root', () => {
  const root = createElementalProjectile(createWeaponSpec('cluster', 'fire'), 'cindergrid', 'bomblet');
  root.position.set(1, 2, 3); root.quaternion.setFromEuler(new THREE.Euler(.2, .3, .4));
  root.userData.clusterInitialFuse = 1.2; root.userData.clusterFuse = .8;
  const pose = { p: root.position.toArray(), q: root.quaternion.toArray(), s: root.scale.toArray() };
  updateElementalProjectile(root, 1 / 60, .4);
  const carrier = root.getObjectByName('quality-physical-carrier')!, light = root.getObjectByName('cluster-bomblet-fuse-light') as THREE.Mesh;
  const rotation = carrier.rotation.toArray(), opacity = (light.material as THREE.MeshBasicMaterial).opacity;
  root.userData.clusterFuse = .1; updateElementalProjectile(root, 0, 1.1);
  assert.deepEqual(carrier.rotation.toArray(), rotation); assert.equal((light.material as THREE.MeshBasicMaterial).opacity, opacity);
  root.userData.clusterSettled = true; updateElementalProjectile(root, 1 / 60, 1.1);
  assert.deepEqual(carrier.rotation.toArray(), rotation, 'The casing must stop tumbling after authoritative settlement');
  assert.deepEqual({ p: root.position.toArray(), q: root.quaternion.toArray(), s: root.scale.toArray() }, pose);
  assert.ok(Number.isFinite((light.material as THREE.MeshBasicMaterial).opacity)); dispose(root);
});

test('bomblet role remains available through production and adhesive adapters', () => {
  for (const factory of [() => new ElementalPresentation(new THREE.Scene(), new THREE.PerspectiveCamera()), () => new AdhesivePresentation(new THREE.Scene(), new THREE.PerspectiveCamera())]) {
    const layer = factory(), spec = { ...createWeaponSpec('cluster', 'adhesive'), secondaryElement: 'corrosive' as const };
    const root = layer.projectile(spec, 'tackwork', 'bomblet');
    assert.equal(root.userData.clusterRole, 'bomblet'); assert.ok(parts(root).includes('cluster-bomblet-casing'));
    const trail = layer.trail(new THREE.Vector3(), new THREE.Vector3(0, 0, 4), spec, 'tackwork', 'bomblet');
    assert.ok(new THREE.Box3().setFromObject(trail).getSize(new THREE.Vector3()).length() < .2);
    dispose(root); dispose(trail); layer.dispose();
  }
});

test('secondary blast audio is quieter per event while both independent channels are routed once', () => {
  const layer = new ElementalPresentation(new THREE.Scene(), new THREE.PerspectiveCamera());
  const calls: { element: string; strength: number | undefined }[] = [];
  layer.impacts.impact = () => {};
  layer.audio.impact = (element, options = {}) => { calls.push({ element, strength: options.strength }); };
  const event = { point: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0), spec: { ...createWeaponSpec('cluster', 'fire'), secondaryElement: 'corrosive' as const }, phase: 'detonate' as const, radius: 3 };
  layer.impact({ ...event, stage: 'cluster-burst' });
  layer.impact({ ...event, stage: 'bomblet' });
  assert.deepEqual(calls.map(call => call.element), ['fire', 'corrosive', 'fire', 'corrosive']);
  assert.ok(calls[2].strength! < calls[0].strength!); assert.ok(calls[3].strength! < calls[1].strength!);
  assert.equal(layer.audio.unlocked, false, 'Source review and muted evaluation must not unlock browser audio');
  layer.dispose();
});


test('MIRV role forwarding preserves the selected upstream resin material on projectile and carrier wake', () => {
  const spec = { ...createWeaponSpec('cluster', 'adhesive'), secondaryElement: 'corrosive' as const };
  for (const material of ['previous', 'honey'] as const) {
    const layer = new AdhesivePresentation(new THREE.Scene(), new THREE.PerspectiveCamera(), { material });
    const child = layer.projectile(spec, 'tackwork', 'bomblet');
    const resin = child.getObjectByName('adhesive-short-resin-neck')!;
    assert.ok(resin); assert.equal(child.userData.clusterRole, 'bomblet');
    const expected = resinShaders(material, 'solid').fragmentShader;
    for (const mesh of meshes(resin)) assert.equal((mesh.material as THREE.ShaderMaterial).fragmentShader, expected);
    const wake = layer.trail(new THREE.Vector3(), new THREE.Vector3(0, 0, 1), spec, 'tackwork', 'carrier');
    const ownedWake = wake.children.filter((value): value is THREE.Mesh => value instanceof THREE.Mesh);
    assert.ok(ownedWake.length > 0);
    for (const mesh of ownedWake) assert.equal((mesh.material as THREE.ShaderMaterial).fragmentShader, expected);
    dispose(child); dispose(wake); layer.dispose();
  }
});


test('Shock forwards MIRV roles without changing its fixed sticky charge or consuming sticky variation', () => {
  const camera = new THREE.PerspectiveCamera(), options = { cosmeticSeed: 37391 };
  const layer = new ShockPresentation(new THREE.Scene(), camera, 'capacitor', options);
  const reference = new ShockPresentation(new THREE.Scene(), camera, 'capacitor', options);
  const legacy = new ShockPresentation(new THREE.Scene(), camera, 'capacitor', { ...options, stickyCharge: 'legacy' });
  const cluster = { ...createWeaponSpec('cluster', 'shock'), secondaryElement: 'fire' as const };
  const carrier = layer.projectile(cluster, 'voltaic', 'carrier'), bomblet = layer.projectile(cluster, 'voltaic', 'bomblet');
  assert.ok(parts(carrier).some(name => name.includes('submunition-casing')));
  assert.ok(parts(bomblet).includes('cluster-bomblet-casing'));
  assert.equal(parts(bomblet).some(name => name.includes('submunition-casing')), false);
  assert.equal(bomblet.userData.clusterRole, 'bomblet');
  assert.equal(bomblet.getObjectByName('shock-fixed-sticky-charge'), undefined);
  const sticky = { ...createWeaponSpec('sticky', 'shock'), secondaryElement: 'fire' as const };
  const fixed = layer.projectile(sticky, 'voltaic', 'carrier'), expected = reference.projectile(sticky, 'voltaic');
  const old = legacy.projectile(sticky, 'voltaic');
  assert.ok(fixed.getObjectByName('shock-fixed-sticky-charge'));
  assert.equal(old.getObjectByName('shock-fixed-sticky-charge'), undefined);
  assert.ok(old.getObjectByName('quality-primary-shock-payload'));
  const signature = (root: THREE.Group) => {
    root.updateMatrixWorld(true);
    return meshes(root).map(mesh => ({ name: mesh.name, positions: Array.from(mesh.geometry.attributes.position.array), matrix: mesh.matrixWorld.toArray(), materials: (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(material => ({ type: material.type, name: material.name, opacity: material.opacity, color: material instanceof THREE.MeshBasicMaterial ? material.color.getHex() : null })) }));
  };
  assert.deepEqual(signature(fixed), signature(expected), 'Cluster factory calls must leave the subsequent sticky charge identical to its current-main API');
  layer.updateProjectile(fixed, 1 / 60, .4); reference.updateProjectile(expected, 1 / 60, .4);
  assert.deepEqual(signature(fixed), signature(expected), 'Fixed sticky animation remains unchanged with the optional role argument');
  for (const root of [carrier, bomblet, fixed, expected, old]) dispose(root);
  legacy.dispose(); reference.dispose(); layer.dispose();
});

test('Adhesive adapter keeps upstream fixed/varied stain options alongside MIRV delivery', () => {
  for (const stains of ['fixed', 'varied'] as const) {
    const layer = new AdhesivePresentation(new THREE.Scene(), new THREE.PerspectiveCamera(), { visualSeed: 37391, material: 'honey', stains });
    const spec = createWeaponSpec('cluster', 'adhesive');
    layer.impact({ spec, point: new THREE.Vector3(0, .3, -4), normal: new THREE.Vector3(0, 1, 0), radius: 3, phase: 'detonate', stage: 'bomblet', energy: 20 });
    if (stains === 'fixed') assert.equal(layer.adhesive.stainEvents.length, 0);
    else { assert.ok(layer.adhesive.stainEvents.length > 0); assert.ok(layer.adhesive.stainEvents.every(event => event.mode === 'varied')); }
    assert.ok(layer.impacts.activeCount > 0, 'The owning element still routes the MIRV physical cue');
    layer.dispose();
  }
});
