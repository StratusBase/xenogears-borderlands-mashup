import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import * as THREE from 'three';
import { createWorld } from '../src/world.ts';

const scene = new THREE.Scene();
let world: ReturnType<typeof createWorld>;
const CONTACT_TOLERANCE = 0.00001;

before(() => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement(tag: string) {
        assert.equal(tag, 'canvas');
        return {
          width: 0, height: 0,
          getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }),
        };
      },
    },
  });
  try {
    world = createWorld(scene);
    scene.updateMatrixWorld(true);
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

after(() => world?.dispose());

function actualMesh(name: string): THREE.Mesh {
  const object = scene.getObjectByName(name);
  assert.ok(object instanceof THREE.Mesh, `Missing actual world mesh ${name}`);
  return object;
}

function actualBounds(mesh: THREE.Mesh): THREE.Box3 {
  const bounds = new THREE.Box3().setFromObject(mesh, true);
  assert.ok(!bounds.isEmpty(), `${mesh.name}: empty bounds`);
  assert.ok([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite), `${mesh.name}: nonfinite bounds`);
  return bounds;
}

function overlap(aMin: number, aMax: number, bMin: number, bMax: number): number {
  return Math.min(aMax, bMax) - Math.max(aMin, bMin);
}

for (const gate of ['yard', 'pilot', 'mech']) {
  test(`${gate} gate posts meet their beam at a true butt joint without a floating gap or intersecting side faces`, () => {
    const beam = actualBounds(actualMesh(`${gate}-gate-beam`));
    for (const side of ['left', 'right']) {
      const mesh = actualMesh(`${gate}-gate-post-${side}`);
      const post = actualBounds(mesh);
      assert.equal(mesh.castShadow, true, `${mesh.name}: contact must be checked on the actual depth caster`);
      assert.ok(post.min.y <= CONTACT_TOLERANCE && post.max.y > 0, `${mesh.name}: post must stand on the terrain`);
      const jointGap = beam.min.y - post.max.y;
      assert.ok(Math.abs(jointGap) <= CONTACT_TOLERANCE,
        `${mesh.name}: beam underside ${beam.min.y} must meet post top ${post.max.y}, gap=${jointGap}`);
      const contactWidth = overlap(post.min.x, post.max.x, beam.min.x, beam.max.x);
      const contactDepth = overlap(post.min.z, post.max.z, beam.min.z, beam.max.z);
      assert.ok(contactWidth > CONTACT_TOLERANCE && contactDepth > CONTACT_TOLERANCE,
        `${mesh.name}: matching heights must also have a real horizontal contact footprint`);
      const verticalOverlap = overlap(post.min.y, post.max.y, beam.min.y, beam.max.y);
      assert.ok(verticalOverlap <= CONTACT_TOLERANCE,
        `${mesh.name}: overlapping vertical extents create duplicate coplanar exterior side faces`);
    }
  });
}

test('all interior rock depth casters genuinely intersect the terrain after their actual transforms', () => {
  const rocks: THREE.Mesh[] = [];
  scene.traverse(object => {
    if (/^ground-rock-\d+$/.test(object.name) && object instanceof THREE.Mesh) rocks.push(object);
  });
  assert.equal(rocks.length, 4, 'Every interior rock must be included in contact verification');
  for (let index = 0; index < 4; index++) {
    const mesh = actualMesh(`ground-rock-${index}`);
    const bounds = actualBounds(mesh);
    assert.equal(mesh.castShadow, true, `${mesh.name}: rendered geometry must also cast its contact shadow`);
    assert.ok(bounds.min.y <= 0, `${mesh.name}: lowest transformed vertex floats ${bounds.min.y} above terrain`);
    assert.ok(bounds.max.y > 0, `${mesh.name}: terrain burial must leave the visible rock above ground`);
  }
});
