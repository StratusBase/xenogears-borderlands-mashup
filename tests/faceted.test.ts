import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import * as THREE from 'three';
import { createWorld } from '../src/world.ts';

const mesas = [
  [-105, -47, 17, 19], [-91, -69, 21, 28], [-62, -79, 18, 24],
  [-29, -83, 24, 33], [8, -89, 20, 29], [43, -82, 22, 38],
  [81, -76, 19, 27], [108, -55, 26, 33], [117, -16, 16, 20],
  [111, 30, 21, 28], [87, 76, 28, 27], [42, 85, 22, 23],
  [-11, 89, 20, 20], [-61, 81, 29, 30], [-108, 51, 22, 30],
  [-118, 4, 21, 29],
] as const;
const scene = new THREE.Scene();
let world: ReturnType<typeof createWorld>;

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

function mesaMesh(name: string): THREE.Mesh<THREE.BufferGeometry> {
  const object = scene.getObjectByName(name);
  assert.ok(object instanceof THREE.Mesh, `Missing actual world mesh: ${name}`);
  return object;
}

function eachTriangle(mesh: THREE.Mesh<THREE.BufferGeometry>, visit: (positions: THREE.Vector3[], indices: number[]) => void): void {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  const count = geometry.index?.count ?? position.count;
  assert.equal(count % 3, 0, `${mesh.name}: incomplete triangle`);
  for (let offset = 0; offset < count; offset += 3) {
    const indices = [0, 1, 2].map(index => geometry.index?.getX(offset + index) ?? offset + index);
    const positions = indices.map(index => new THREE.Vector3().fromBufferAttribute(position, index));
    visit(positions, indices);
  }
}

function geometricNormal(positions: THREE.Vector3[]): THREE.Vector3 {
  return new THREE.Vector3().subVectors(positions[1], positions[0])
    .cross(new THREE.Vector3().subVectors(positions[2], positions[0]));
}

function assertClose(actual: number, expected: number, message: string, tolerance = 0.00001): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, received ${actual}`);
}

test('the actual world contains every independently testable mesa body and cap', () => {
  const names: string[] = [];
  scene.traverse(object => { if (/^mesa-(body|cap)-\d+$/.test(object.name)) names.push(object.name); });
  assert.equal(names.length, mesas.length * 2);
  assert.equal(new Set(names).size, mesas.length * 2);
  for (let index = 0; index < mesas.length; index++) {
    mesaMesh(`mesa-body-${index}`);
    mesaMesh(`mesa-cap-${index}`);
  }
});

test('every actual mesa triangle has finite unit vertex normals aligned with its true face', () => {
  for (let index = 0; index < mesas.length; index++) {
    for (const part of ['body', 'cap']) {
      const mesh = mesaMesh(`mesa-${part}-${index}`);
      const normal = mesh.geometry.getAttribute('normal');
      assert.ok(normal, `${mesh.name}: normals are required for receiver bias and lighting`);
      eachTriangle(mesh, (positions, indices) => {
        positions.forEach(position => assert.ok(position.toArray().every(Number.isFinite), `${mesh.name}: nonfinite vertex`));
        const face = geometricNormal(positions);
        assert.ok(face.lengthSq() > 1e-10, `${mesh.name}: degenerate triangle`);
        face.normalize();
        for (const vertexIndex of indices) {
          const vertexNormal = new THREE.Vector3().fromBufferAttribute(normal, vertexIndex);
          assert.ok(vertexNormal.toArray().every(Number.isFinite), `${mesh.name}: nonfinite normal`);
          assertClose(vertexNormal.length(), 1, `${mesh.name}: normal length`);
          assertClose(vertexNormal.dot(face), 1, `${mesh.name}: smooth or incorrect normal on planar face`);
        }
      });
    }
  }
});

test('faceting preserves mesa geometry bounds and placement with outward-facing closed surfaces', () => {
  for (let index = 0; index < mesas.length; index++) {
    const [x, z, radius, height] = mesas[index];
    for (const part of ['body', 'cap']) {
      const mesh = mesaMesh(`mesa-${part}-${index}`);
      // Cylinder primitives establish the existing shape; changing normal data
      // must not move the horizon, collision silhouette, or cap ledge.
      const reference = part === 'body'
        ? new THREE.CylinderGeometry(radius * 0.64, radius, height, 5 + index % 3, 1)
        : new THREE.CylinderGeometry(radius * 0.59, radius * 0.68, 1.6, 5 + index % 3);
      try {
        reference.computeBoundingBox();
        mesh.geometry.computeBoundingBox();
        for (const limit of ['min', 'max'] as const) {
          for (const axis of ['x', 'y', 'z'] as const) {
            assertClose(mesh.geometry.boundingBox![limit][axis], reference.boundingBox![limit][axis], `${mesh.name}: ${limit}.${axis}`);
          }
        }
      } finally {
        reference.dispose();
      }
      assertClose(mesh.position.x, x, `${mesh.name}: world x`);
      assertClose(mesh.position.z, z, `${mesh.name}: world z`);
      assertClose(mesh.position.y, part === 'body' ? height / 2 - 1 : height - 0.4, `${mesh.name}: world y`);
      assertClose(mesh.rotation.y, index * 0.64, `${mesh.name}: rotation`);
      eachTriangle(mesh, positions => {
        const face = geometricNormal(positions).normalize();
        const centroid = positions.reduce((sum, position) => sum.add(position), new THREE.Vector3()).divideScalar(3);
        assert.ok(face.dot(centroid) > 0.001, `${mesh.name}: inward-facing triangle`);
      });
    }
  }
});
