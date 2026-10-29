import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import * as THREE from 'three';
import { createEncounterEnemy } from '../src/rendering/encounterEnemy.ts';
import { createEncounterObjective } from '../src/rendering/encounterObjectives.ts';
import type { EnemyPresentation } from '../src/encounter/contracts.ts';
import { PlayerBallistics, type BallisticHit } from '../src/rendering/PlayerBallistics.ts';
import { createWeaponSpec } from '../src/core/arsenal.ts';

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
before(() => Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) },
}));
after(() => { if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document'); });

function state(patch: Partial<EnemyPresentation> = {}): EnemyPresentation {
  return { phase: 'advance', phaseProgress: 0, moving: false, shieldFraction: 1, weakPointOpen: false, hitReaction: 0, ...patch };
}

test('role silhouettes carry real hit regions and warnings cannot intercept ballistics', () => {
  for (const role of ['rusher', 'flanker', 'heavy'] as const) {
    const visual = createEncounterEnemy(21, role);
    assert.ok(visual.group.getObjectByName(role === 'rusher' ? 'rusher-blade--1' : role === 'flanker' ? 'flanker-rifle-barrel' : 'heavy-front-shield'));
    const head = visual.group.getObjectByName('enemy-head')!;
    assert.equal(head.userData.enemyId, 21); assert.equal(head.userData.critical, role !== 'heavy');
    visual.update(0.1, 1, state({ phase: 'windup', phaseProgress: 0.8 }));
    assert.equal(visual.group.getObjectByName('enemy-attack-warning')!.visible, true);
    const warning = visual.group.getObjectByName('enemy-warning-ring') as THREE.Mesh;
    assert.equal(warning.userData.enemyId, undefined);
    const intersections: THREE.Intersection[] = [];
    warning.raycast(new THREE.Raycaster(), intersections);
    assert.equal(intersections.length, 0);
    visual.dispose();
  }
});

test('heavy weak point and shutters follow the authoritative opening window', () => {
  const visual = createEncounterEnemy(7, 'heavy', true);
  const core = visual.group.getObjectByName('heavy-rear-weak-point')!;
  const shutter = visual.group.getObjectByName('heavy-core-shutter--1')!;
  visual.update(0.1, 0, state());
  assert.equal(core.userData.critical, false); assert.equal(shutter.position.x, -0.15);
  visual.update(0.1, 1, state({ phase: 'recover', weakPointOpen: true, shieldFraction: 0 }));
  assert.equal(core.userData.critical, true); assert.equal(shutter.position.x, -0.42);
  assert.equal(visual.group.userData.weakPointOpen, true);
  assert.ok(visual.group.getObjectByName('boss-command-fin-1'));
  visual.update(0.1, 2, state()); assert.equal(core.userData.critical, false);
  visual.dispose();
});

test('actual rear shots become critical only through the opened heavy cooling shutters', () => {
  const visual = createEncounterEnemy(7, 'heavy'), scene = new THREE.Scene(), hits: BallisticHit[] = [];
  scene.add(visual.group);
  const ballistics = new PlayerBallistics(scene, {
    targets: () => [{ id: 7, root: visual.group, radius: 1.6 }], occluders: () => [], hit: hit => hits.push(hit),
  });
  const beam = createWeaponSpec('beam', 'kinetic');
  for (const open of [false, true, false]) {
    visual.update(0.1, 1, state({ phase: open ? 'recover' : 'advance', weakPointOpen: open }));
    ballistics.fire(new THREE.Vector3(0.08, 1.65 * 1.75, -8), new THREE.Vector3(0, 0, 1), beam, 20);
    assert.equal(hits.at(-1)?.critical, open);
  }
  assert.equal(hits.length, 3);
  ballistics.clear(); visual.dispose();
});

test('hit and recovery poses move armor; visual cleanup is idempotent and preserves shared textures', () => {
  const visual = createEncounterEnemy(3, 'rusher');
  const scene = new THREE.Scene(); scene.add(visual.group);
  const body = visual.group.getObjectByName('enemy-animated-body')!;
  visual.update(0.1, 1, state({ hitReaction: 1, phase: 'stagger' }));
  assert.ok(body.position.z < 0); assert.ok(body.rotation.x < 0);
  let disposed = 0, sharedTextureDisposed = 0;
  const torso = visual.group.getObjectByName('enemy-torso') as THREE.Mesh<THREE.BoxGeometry, THREE.MeshToonMaterial>;
  torso.geometry.addEventListener('dispose', () => disposed++);
  torso.material.map!.addEventListener('dispose', () => sharedTextureDisposed++);
  visual.dispose(); visual.dispose();
  assert.equal(disposed, 1); assert.equal(sharedTextureDisposed, 0); assert.equal(visual.group.parent, null);
});

test('relay and extract markers show objective state independently from their solid models', () => {
  for (const kind of ['relay', 'extract'] as const) {
    const visual = createEncounterObjective(kind, 'test');
    assert.equal(visual.group.visible, true);
    assert.equal(visual.group.getObjectByName('objective-beacon')!.visible, false);
    assert.equal(visual.group.getObjectByName('objective-ring')!.visible, false);
    visual.group.updateMatrixWorld(true);
    visual.group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const bounds = new THREE.Box3().setFromObject(object);
      assert.ok(bounds.min.y < -0.000001 || bounds.max.y > 0.25, 'Objective hardware adds no shallow ground marking slab');
    });
    visual.update(true, false, 1); assert.equal(visual.group.visible, true);
    assert.equal(visual.group.getObjectByName('objective-beacon')!.visible, true);
    visual.update(false, true, 2); assert.equal(visual.group.visible, true);
    assert.equal(visual.group.getObjectByName('objective-beacon')!.visible, false);
    assert.equal(visual.group.userData.objectiveComplete, true);
    visual.update(false, false, 3);
    const visibleSolids: THREE.Mesh[] = [];
    visual.group.traverseVisible(object => {
      if (object instanceof THREE.Mesh && object.userData.comicOverlay !== true) visibleSolids.push(object);
    });
    assert.ok(visibleSolids.some(object => object.name === 'objective-console'), 'Inactive consoles remain visible to cover traces');
    visual.dispose(); visual.dispose();
  }
});
