import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { decorateEnemy, upgradeReferenceMech } from '../src/rendering/quality/actors.ts';

function legacyEnemy(): THREE.Group {
  const group = new THREE.Group();
  const sizes = [[1,1.1,.8,0,1.45,0],[.65,.55,.65,0,2.25,0],[.48,.14,.05,0,2.27,.34],[.32,.95,.4,-.33,.45,0],[.32,.95,.4,.33,.45,0],[.28,.35,.95,.73,1.6,.25],[.3,.75,.4,-.68,1.35,0]];
  sizes.forEach(([w,h,d,x,y,z],index) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial());
    mesh.name=`legacy-hit-${index}`; mesh.position.set(x,y,z); mesh.userData.enemyId=9;
    mesh.userData.critical=index===1||index===2; group.add(mesh);
  });
  return group;
}

function raySnapshot(group:THREE.Group) {
  group.updateMatrixWorld(true);
  return [1.4,2.25,.4].map(y => {
    const ray = new THREE.Raycaster(new THREE.Vector3(0,y,5),new THREE.Vector3(0,0,-1));
    return ray.intersectObject(group,true).map(hit=>({name:hit.object.name,distance:hit.distance,critical:hit.object.userData.critical}));
  });
}

test('reference enemy preserves gameplay collision/critical hits while animating display and restoring legacy rendering',()=>{
  const root=legacyEnemy(), originals=[...root.children] as THREE.Mesh[];
  const materials=originals.map(mesh=>mesh.material), before=raySnapshot(root);
  const matrices=originals.map(mesh=>mesh.matrixWorld.toArray()), geometries=originals.map(mesh=>mesh.geometry);
  const presentation=decorateEnemy(root,9);
  presentation.update(2,.016,2.6,.025,.1);
  assert.deepEqual(raySnapshot(root),before,'new armor must never intercept or extend combat hits');
  originals.forEach((mesh,index)=>{
    assert.equal(mesh.geometry,geometries[index]); assert.deepEqual(mesh.matrixWorld.toArray(),matrices[index]);
    assert.equal(mesh.visible,true,'swept collision requires visible proxies');
    assert.equal((mesh.material as THREE.Material).colorWrite,false); assert.equal(mesh.userData.enemyId,9);
  });
  const optic=root.getObjectByName('sentry-upper-suspension'); assert.ok(optic);
  assert.equal(root.getObjectByName('sentry-muzzle-flash')!.visible,true);
  assert.deepEqual(root.position.toArray(),[0,0,0]); assert.deepEqual(root.scale.toArray(),[1,1,1]);
  assert.throws(()=>decorateEnemy(root,9),/already attached/);
  presentation.dispose(); presentation.dispose();
  assert.deepEqual(root.children,originals); originals.forEach((mesh,index)=>assert.equal(mesh.material,materials[index]));
  assert.deepEqual(raySnapshot(root),before);
});

test('reference mech preserves every equipment-owned mesh/material/world transform and controls only body',()=>{
  const root=new THREE.Group(); root.position.set(6,.15,8); root.rotation.y=-.45;
  for(const slot of ['weapon','shield','reactor','legs']){
    const owner=new THREE.Group(); owner.name=`equipment-${slot}`; owner.userData.equipmentSlot=slot; owner.userData.visualOwner=slot;
    owner.position.set(slot.length,.4,-.6); owner.rotation.x=.17;
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(.2,.3,.4),new THREE.MeshBasicMaterial({color:0x332244})); owner.add(mesh); root.add(owner);
  }
  const chassis=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshBasicMaterial()); chassis.position.y=4; root.add(chassis);
  root.updateMatrixWorld(true);
  const slots=root.children.filter(child=>child.userData.equipmentSlot).map(owner=>({owner,matrix:owner.matrixWorld.toArray(),mesh:owner.children[0] as THREE.Mesh,geometry:(owner.children[0] as THREE.Mesh).geometry,material:(owner.children[0] as THREE.Mesh).material}));
  const presentation=upgradeReferenceMech(root); presentation.update(5,.016,5,.1,.1); root.updateMatrixWorld(true);
  for(const entry of slots){
    assert.equal(entry.owner.parent,root); assert.deepEqual(entry.owner.matrixWorld.toArray(),entry.matrix);
    assert.equal(entry.mesh.geometry,entry.geometry); assert.equal(entry.mesh.material,entry.material); assert.equal(entry.mesh.visible,true);
  }
  assert.equal(chassis.visible,false); assert.deepEqual(root.position.toArray(),[6,.15,8]); assert.equal(root.rotation.y,-.45);
  let draws=0; presentation.group.traverse(object=>{if(object instanceof THREE.Mesh)draws++}); assert.ok(draws<=32,`rigid batching budget: ${draws} draws`);
  const before=presentation.group.children.map(child=>({position:child.position.toArray(),quaternion:child.quaternion.toArray()}));
  presentation.update(8,0,10,0,0); presentation.group.children.forEach((child,index)=>assert.deepEqual({position:child.position.toArray(),quaternion:child.quaternion.toArray()},before[index]));
  presentation.dispose(); assert.equal(chassis.visible,true); assert.equal(root.getObjectByName('reference-mech-body'),undefined);
});
