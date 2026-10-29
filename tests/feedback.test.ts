import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { getDamageColor, type DamageEffect } from '../src/core/feedback.ts';
import { createEnemyBars } from '../src/rendering/enemyBars.ts';

test('direct hit feedback is pure white and critical feedback is red', () => {
  assert.equal(getDamageColor({ critical: false }), '#fff');
  assert.equal(getDamageColor({ critical: true }), '#ff3b3b');
});

test('status damage keeps its effect color even when critical is true', () => {
  const effects: [DamageEffect, string][] = [
    ['fire', '#ff8a24'], ['shock', '#4ca3ff'], ['corrosion', '#67e04b'], ['frost', '#58e5f2'], ['bleed', '#9b1433'],
  ];
  for (const [effect, color] of effects) {
    assert.equal(getDamageColor({ critical: false, effect }), color);
    assert.equal(getDamageColor({ critical: true, effect }), color);
  }
  assert.equal(new Set(effects.map(([, color]) => color)).size, 5);
});

test('enemy health drains left-to-right inside an unchanged container', () => {
  const bars = createEnemyBars();
  bars.group.position.set(4, 3, -8);
  bars.group.scale.setScalar(1.85);
  bars.update(100, 100, 0, 0);
  const track = bars.group.getObjectByName('health-track')!;
  const fill = bars.group.getObjectByName('health-fill')!;
  const fullTrack = new THREE.Box3().setFromObject(track);
  const fullFill = new THREE.Box3().setFromObject(fill);
  const fullWidth = fullFill.getSize(new THREE.Vector3()).x;
  bars.update(25, 100, 0, 0);
  const depletedTrack = new THREE.Box3().setFromObject(track);
  const depletedFill = new THREE.Box3().setFromObject(fill);
  assert.ok(Math.abs(depletedFill.min.x - fullFill.min.x) < 1e-6, 'left fill endpoint stays fixed');
  assert.ok(Math.abs(depletedFill.getSize(new THREE.Vector3()).x - fullWidth / 4) < 1e-6);
  assert.deepEqual(depletedTrack.min.toArray(), fullTrack.min.toArray());
  assert.deepEqual(depletedTrack.max.toArray(), fullTrack.max.toArray());
  bars.update(0, 100, 0, 0);
  assert.equal(fill.visible, false);
  assert.equal(track.visible, true);
  assert.deepEqual(new THREE.Box3().setFromObject(track).min.toArray(), fullTrack.min.toArray());
  bars.dispose();
});

test('depleted shields retain a dark track; only unshielded enemies hide the row', () => {
  const bars = createEnemyBars();
  const shieldRow = bars.group.getObjectByName('shield-row')!;
  const shieldTrack = bars.group.getObjectByName('shield-track')!;
  const shieldFill = bars.group.getObjectByName('shield-fill')!;
  bars.update(100, 100, 0, 50);
  assert.equal(shieldRow.visible, true);
  assert.equal(shieldTrack.visible, true);
  assert.equal(shieldFill.visible, false);
  bars.update(100, 100, 0, 0);
  assert.equal(shieldRow.visible, false);
  bars.update(100, 100, 80, 50);
  assert.equal(shieldRow.visible, true);
  assert.equal(shieldFill.scale.x, 1, 'overfilled values clamp to a full track');
  bars.dispose();
});

test('enemy bars preserve overlay depth testing without writing depth or generating ink', () => {
  const bars = createEnemyBars();
  assert.equal(bars.group.userData.comicOverlay, true);
  bars.group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    assert.equal(object.userData.comicOverlay, true);
    const material = object.material as THREE.MeshBasicMaterial;
    assert.equal(material.depthWrite, false);
    assert.equal(material.depthTest, true);
  });
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1));
  assert.equal(ray.intersectObject(bars.group, true).length, 0, 'UI bars must not block weapon shots');
  assert.doesNotThrow(() => { bars.dispose(); bars.dispose(); });
});
