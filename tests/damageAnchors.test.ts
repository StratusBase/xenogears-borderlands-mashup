import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createTestDummy } from '../src/rendering/testDummy.ts';
import { createEncounterEnemy } from '../src/rendering/encounterEnemy.ts';
import { cacheDamageAnchors, primaryDamageAnchor, sampleDamageAnchor } from '../src/ui/damageAnchors.ts';

test('both actual dummy critical disks are protected and select the matching pilot/mech label anchor', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ width: 0, height: 0,
    getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } });
  let dummy: ReturnType<typeof createTestDummy>;
  try { dummy = createTestDummy(-1); }
  finally { if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); }
  try {
    dummy.group.position.set(5, 0, -12);
    const anchors = cacheDamageAnchors(dummy.group);
    assert.equal(anchors.all.length, 2);
    assert.equal(primaryDamageAnchor(anchors, 'pilot')!.name, 'dummy-pilot-bullseye-critical');
    assert.equal(primaryDamageAnchor(anchors, 'mech')!.name, 'dummy-mech-bullseye-critical');
    const points = anchors.all.map(anchor => sampleDamageAnchor(anchor, new THREE.Vector3()));
    assert.deepEqual(points.map(point => point.y), [2.3, 4.35]);
    assert.ok(points.every(point => point.x === 5 && point.z === -11.685));
  } finally { dummy.dispose(); }
});

test('cached heads and closed rear cores follow actual role/boss scale and live poses without scans or source matrix writes', () => {
  for (const [role, boss] of [['flanker', false], ['rusher', false], ['heavy', false], ['heavy', true]] as const) {
    const visual = createEncounterEnemy(47, role, boss), anchors = cacheDamageAnchors(visual.group);
    try {
      const scale = role === 'heavy' ? boss ? 1.95 : 1.75 : 1;
      assert.ok(Math.abs(sampleDamageAnchor(anchors.primary!, new THREE.Vector3()).y - 2.25 * scale) < 1e-10);
      if (role === 'heavy') assert.ok(anchors.all.some(anchor => anchor.name === 'heavy-rear-weak-point'), 'Closed weakpoints still need protection');
      const body = visual.group.getObjectByName('enemy-animated-body')!;
      body.position.y = .13; body.rotation.x = .17;
      visual.group.position.set(3, .2, -14); visual.group.rotation.y = .4;
      const expected = visual.group.clone(true); expected.updateMatrixWorld(true);
      const sourceState = anchors.all.map(anchor => ({ anchor, matrix: anchor.matrix.toArray(), world: anchor.matrixWorld.toArray(), dirty: anchor.matrixWorldNeedsUpdate }));
      const originalTraverse = visual.group.traverse;
      visual.group.traverse = () => { throw new Error('Cached feedback projection must not scan the hierarchy'); };
      try {
        for (const anchor of anchors.all) {
          const actual = sampleDamageAnchor(anchor, new THREE.Vector3());
          const reference = expected.getObjectByName(anchor.name)!.getWorldPosition(new THREE.Vector3());
          assert.ok(actual.distanceTo(reference) < 1e-10);
        }
        for (const state of sourceState) {
          assert.deepEqual(state.anchor.matrix.toArray(), state.matrix); assert.deepEqual(state.anchor.matrixWorld.toArray(), state.world);
          assert.equal(state.anchor.matrixWorldNeedsUpdate, state.dirty);
        }
      } finally { visual.group.traverse = originalTraverse; }
    } finally { visual.dispose(); }
  }
});
