import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createWorld } from '../src/world.ts';
import { upgradeReferenceMech } from '../src/rendering/quality/actors.ts';

test('the actual parked legacy and quality mech soles meet the terrain without changing the collision layout',()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})}});
  let world:ReturnType<typeof createWorld>;
  try { world=createWorld(new THREE.Scene()); }
  finally { if(previous)Object.defineProperty(globalThis,'document',previous);else Reflect.deleteProperty(globalThis,'document'); }
  const colliders=structuredClone(world.colliders),root=world.parkedMech;
  root.updateWorldMatrix(true,true);
  const feet:THREE.Mesh[]=[];
  root.traverse(object=>{if(object instanceof THREE.Mesh&&object.name==='base-foot')feet.push(object);});
  assert.equal(feet.length,2);
  for(const foot of feet){
    const bounds=new THREE.Box3().setFromObject(foot,true);
    assert.ok(Math.abs(bounds.min.y)<1e-5,`Legacy foot floats at ${bounds.min.y}`);
    assert.equal(foot.castShadow,true);
  }
  const quality=upgradeReferenceMech(root);
  root.updateWorldMatrix(true,true);
  const bounds=new THREE.Box3().setFromObject(quality.group,true);
  assert.ok(bounds.min.y<=1e-5&&bounds.min.y>=-.04,`Reference sole must meet terrain with at most a small contact overlap: ${bounds.min.y}`);
  assert.deepEqual(world.colliders,colliders,'Ground contact is an asset placement fix, never a collision-layout change');
  quality.dispose();
  assert.deepEqual(world.colliders,colliders);
  world.dispose();
});
