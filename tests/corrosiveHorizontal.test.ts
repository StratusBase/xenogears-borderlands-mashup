import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CorrosiveResponse} from '../src/rendering/quality/corrosive/liquid.ts';
import {corrosiveSurfaceFrame,settleCorrosiveDrop} from '../src/rendering/quality/corrosive/surfaceFrame.ts';
import {PlayerBallistics,type BallisticPresentationImpact} from '../src/rendering/PlayerBallistics.ts';
import {createWeaponSpec} from '../src/core/arsenal.ts';

const UP=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1);
function platform(height:number,normal=UP){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.position.set(0,height,0);mesh.quaternion.setFromUnitVectors(Z,normal);const scene=new THREE.Scene();scene.add(mesh);scene.updateMatrixWorld(true);return{scene,mesh};}
function firstBurst(r:CorrosiveResponse){return r.group.children.find(o=>o.name==='corrosive-ab-crown'&&o.visible) as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;}

test('floors, sloped tops and undersides keep the entire moving sheet outside the contact plane',()=>{
 for(const normal of[UP,new THREE.Vector3(0,1,1).normalize(),new THREE.Vector3(0,-1,0)])for(const height of[0,2.5]){
  const{scene,mesh}=platform(height,normal),camera=new THREE.PerspectiveCamera();camera.position.set(3,height+1.8,5);const response=new CorrosiveResponse(scene,camera);
  response.impact({point:mesh.position.clone(),normal:normal.clone(),hitSurface:mesh,spec:createWeaponSpec('rocket','corrosive'),radius:2.5,phase:'detonate',energy:70});const burst=firstBurst(response);let peak=0;
  for(let i=0;i<50;i++){response.update(.01);burst.updateWorldMatrix(true,false);const p=burst.geometry.attributes.position;for(let j=0;j<p.count;j++){const world=new THREE.Vector3().fromBufferAttribute(p,j).multiplyScalar(burst.material.uniforms.size.value).applyMatrix4(burst.matrixWorld);const distance=world.sub(mesh.position).dot(normal);assert.ok(distance>.01,`vertex behind surface at ${height}, frame ${i}: ${distance}`);peak=Math.max(peak,distance);}}
  assert.ok(peak>.25,'floor impact must have readable outward lift, not lie flat');response.dispose();mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();
 }
});
test('the ground spray direction reads across the approach and remains fixed after the camera moves',()=>{
 for(const at of[[0,1.8,6],[6,1.8,0],[0,1.8,-6],[0,6,0]]){
  const camera=new THREE.PerspectiveCamera();camera.position.set(...at as [number,number,number]);const frame=corrosiveSurfaceFrame(UP,new THREE.Vector3(),0,camera),outward=Z.clone().applyQuaternion(frame.rotation),across=new THREE.Vector3(1,0,0).applyQuaternion(frame.rotation);assert.ok(outward.dot(UP)>.9999);
  const approach=camera.position.clone().setY(0);if(approach.lengthSq())assert.ok(Math.abs(across.dot(approach.normalize()))<1e-8);
 }
 const{scene,mesh}=platform(0),camera=new THREE.PerspectiveCamera();camera.position.set(0,1.8,6);const response=new CorrosiveResponse(scene,camera);response.impact({point:new THREE.Vector3(),normal:UP,hitSurface:mesh,spec:createWeaponSpec('rocket','corrosive'),radius:2.5,phase:'contact'});const burst=firstBurst(response),before=burst.quaternion.toArray();camera.position.set(6,1.8,0);response.update(.1);assert.deepEqual(burst.quaternion.toArray(),before,'the frozen contact frame is not a camera-facing billboard');response.dispose();
});
test('raised-surface residue stays at its impact elevation and launched drops do not get pinned at birth',()=>{
 const{scene,mesh}=platform(2.5),response=new CorrosiveResponse(scene);response.impact({point:mesh.position.clone().addScaledVector(UP,.025),normal:UP,hitSurface:mesh,spec:createWeaponSpec('rocket','corrosive'),radius:2.5,phase:'detonate',energy:70});
 const residue=response.group.getObjectByName('corrosive-ab-residue') as THREE.InstancedMesh,drops=response.group.getObjectByName('corrosive-ab-drops') as THREE.InstancedMesh,m=new THREE.Matrix4();residue.getMatrixAt(0,m);assert.ok(Math.abs(new THREE.Vector3().setFromMatrixPosition(m).y-2.512)<1e-6,'residue must use the real top, not world y=.025 or a hovering projectile-center offset');
 drops.getMatrixAt(0,m);const born=new THREE.Vector3().setFromMatrixPosition(m);response.update(.05);drops.getMatrixAt(0,m);assert.ok(new THREE.Vector3().setFromMatrixPosition(m).y>born.y+.01,'fresh spray must launch out of the surface');
 response.dispose();
});
test('droplets settle on a finite raised top and can fall past its edges',()=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,.2,2),new THREE.MeshBasicMaterial()),scene=new THREE.Scene();mesh.position.y=2.4;scene.add(mesh);scene.updateMatrixWorld(true);const support={point:new THREE.Vector3(0,2.5,0),normal:UP,mesh};
 const inside=new THREE.Vector3(.5,2.48,.5);assert.equal(settleCorrosiveDrop(inside,.03,support),true);assert.ok(Math.abs(inside.y-2.532)<1e-6);
 const outside=new THREE.Vector3(1.5,2.48,0),before=outside.clone();assert.equal(settleCorrosiveDrop(outside,.03,support),false);assert.deepEqual(outside,before);
});
test('the real sticky collision supplies its exact support mesh at contact and delayed detonation',()=>{
 const{scene,mesh}=platform(2.5),events:BallisticPresentationImpact[]=[],hits:unknown[]=[],ballistics=new PlayerBallistics(scene,{targets:()=>[],occluders:()=>[mesh],hit:e=>hits.push(e)});
 ballistics.setPresentation({projectile:()=>new THREE.Group(),trail:()=>new THREE.Group(),beam:()=>new THREE.Group(),impact:e=>events.push(e)});const spec=createWeaponSpec('sticky','corrosive');spec.fuse=.15;spec.speed=40;spec.spread=0;const before=JSON.stringify(spec);
 ballistics.fire(new THREE.Vector3(0,4,2),new THREE.Vector3(0,-1,-1).normalize(),spec,70);for(let i=0;i<120;i++)ballistics.update(1/120);
 assert.ok(events.some(e=>e.phase==='contact'));assert.ok(events.some(e=>e.phase==='detonate'));assert.ok(events.every(e=>e.hitSurface===mesh));assert.ok(events[0].normal.dot(UP)>.9999);assert.equal(JSON.stringify(spec),before);assert.deepEqual(hits,[]);ballistics.clear();
});
test('vertical contact frame and airborne bursts retain their prior orientation and avoid invented floating supports',()=>{
 const camera=new THREE.PerspectiveCamera();camera.position.set(5,2,6);const seed=.731,expected=new THREE.Quaternion().setFromAxisAngle(Z,Math.sin(seed*2.7)*.35);const wall=corrosiveSurfaceFrame(Z,new THREE.Vector3(),seed,camera);assert.deepEqual(wall.rotation.toArray(),expected.toArray());assert.equal(wall.lift,0);
 const airborne=corrosiveSurfaceFrame(UP,new THREE.Vector3(0,4,0),seed,camera,false);assert.equal(airborne.lift,0);
 const scene=new THREE.Scene(),response=new CorrosiveResponse(scene,camera);response.impact({point:new THREE.Vector3(0,4,0),normal:UP,spec:createWeaponSpec('orb','corrosive'),radius:2.5,phase:'detonate',energy:70});const residue=response.group.getObjectByName('corrosive-ab-residue') as THREE.InstancedMesh,m=new THREE.Matrix4();residue.getMatrixAt(0,m);assert.ok(new THREE.Vector3().setFromMatrixPosition(m).y<.03);response.dispose();
});
