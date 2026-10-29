import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import * as THREE from 'three';
import { createGroundMaterial, groundLayout } from '../src/rendering/ground.ts';
import { createWorld, getZone } from '../src/world.ts';

const scene = new THREE.Scene();
let world: ReturnType<typeof createWorld>;

before(() => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }),
      }),
    },
  });
  try {
    world = createWorld(scene);
    scene.updateMatrixWorld(true);
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

after(() => world?.dispose());

test('road crossings, hazard strips, lane dashes and pads all have the same physical ground height', () => {
  const terrain = scene.getObjectByName('terrain-surface');
  assert.ok(terrain instanceof THREE.Mesh);
  assert.equal(terrain.position.y, 0);
  assert.ok(terrain.geometry instanceof THREE.PlaneGeometry);
  assert.equal(world.occluders.filter(object => object === terrain).length, 1);

  const paintedLocations: [number, number][] = [
    [0, 1], [-20, 1], [0, -13], // Crossroads and both dash directions.
    [-35, 0], [-35, 3.2], [35, 0], [35, 3.2], // Both alternating hazard bands.
    [6, 11.7], [9.6, 8], [0, 16], // Boarding pad, its stripe, repair pad.
    [50, -4], // Heavy range ground patch.
  ];
  for (const [x, z] of paintedLocations) {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, 0.3, z), new THREE.Vector3(0, -1, 0), 0, 0.5);
    const hits = ray.intersectObjects(scene.children, true);
    assert.ok(hits.length > 0, `Missing terrain below paint at (${x}, ${z})`);
    assert.ok(hits.every(hit => hit.object === terrain), `Raised paint geometry remains at (${x}, ${z})`);
    assert.ok(hits.every(hit => Math.abs(hit.point.y) < 0.000001));
  }
});

test('the world contains no shallow marking slabs and no redundant line overlays', () => {
  const slabs: string[] = [];
  let lineCount = 0;
  scene.traverse(object => {
    if (object instanceof THREE.Line) lineCount++;
    if (!(object instanceof THREE.Mesh) || object.name === 'terrain-surface') return;
    const box = new THREE.Box3().setFromObject(object);
    if (box.min.y >= -0.000001 && box.max.y <= 0.25) slabs.push(object.name || object.geometry.type);
  });
  assert.deepEqual(slabs, [], 'Roads and pad paint must not create their own near-ground surfaces');
  assert.equal(lineCount, 0, 'Screen-space ink owns silhouettes without coplanar GL line overlays');
});

test('paint layout keeps access boundaries, boarding and repair interaction locations aligned', () => {
  for (const x of groundLayout.hazards.centers) {
    assert.equal(getZone(x, 0).allowed, 'both');
    assert.notEqual(getZone(x - 0.001, 0).allowed, getZone(x + 0.001, 0).allowed);
  }
  assert.equal(groundLayout.hazards.width, 1.15);
  assert.equal(groundLayout.hazards.length, 110);
  assert.deepEqual(groundLayout.boarding.center, [world.parkedMech.position.x, world.parkedMech.position.z]);
  assert.deepEqual(groundLayout.repair.center, [0, 16]);
});

test('the terrain shader retains its original map and toon lighting and adds paint only to albedo', () => {
  const map = new THREE.Texture();
  const gradient = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const material = createGroundMaterial({ color: 0xd99a44, map, gradientMap: gradient });
  const source = THREE.ShaderLib.toon;
  const shader = {
    uniforms: {},
    vertexShader: source.vertexShader,
    fragmentShader: source.fragmentShader,
  } as Parameters<THREE.MeshToonMaterial['onBeforeCompile']>[0];
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);

  assert.equal(material.map, map);
  assert.equal(material.gradientMap, gradient);
  assert.equal(material.normalMap, null);
  assert.equal(material.bumpMap, null);
  assert.equal(material.displacementMap, null);
  assert.equal(material.polygonOffset, false);
  assert.ok(shader.fragmentShader.includes('#include <map_fragment>'));
  assert.ok(shader.fragmentShader.includes('#include <lights_toon_fragment>'));
  assert.ok(shader.fragmentShader.includes('#include <shadowmap_pars_fragment>'));
  assert.ok(shader.fragmentShader.includes('fwidth(signedDistance)'));
  assert.ok(!shader.fragmentShader.includes('gl_FragDepth'));
  assert.ok(shader.vertexShader.includes('#include <project_vertex>'));
  assert.ok(shader.vertexShader.includes('vGroundXZ = (modelMatrix * vec4(transformed, 1.0)).xz;'));
  assert.deepEqual(shader.uniforms.groundRoadHorizontal.value.toArray(), [0, 1, 90, 7]);
  assert.deepEqual(shader.uniforms.groundRoadVertical.value.toArray(), [0, -19, 9, 35]);
  assert.deepEqual(shader.uniforms.groundHazards.value.toArray(), [-35, 35, 0.575, 55]);
  assert.equal(shader.uniforms.groundHazardStripePeriod.value, groundLayout.hazards.stripePeriod);
  material.dispose();
  map.dispose();
  gradient.dispose();
});
