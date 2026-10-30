import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createResinFold,createResinProfile,deformResinFold,RESIN_VARIANTS} from '../src/rendering/quality/adhesive/resin.ts';
import {AdhesiveResponse} from '../src/rendering/quality/adhesive/response.ts';
import {createWeaponSpec} from '../src/core/arsenal.ts';

test('Optical thickness changes no resin vertex, normal, index, timing or contact-plane clearance',()=>{
 const previous=createResinFold(),honey=createResinFold(true),gravity=new THREE.Vector3(0,-.7,-.7);let min=1,max=0;
 for(let family=0;family<RESIN_VARIANTS.length;family++)for(let i=0;i<30;i++){
  const profile=createResinProfile(37391,family),age=i*.025;deformResinFold(previous,age,37391,gravity,profile);deformResinFold(honey,age,37391,gravity,profile);
  assert.deepEqual(honey.attributes.position.array,previous.attributes.position.array);assert.deepEqual(honey.attributes.normal.array,previous.attributes.normal.array);assert.deepEqual(honey.index!.array,previous.index!.array);
  for(const t of honey.attributes.resinThickness.array){assert.ok(Number.isFinite(t)&&t>=.079&&t<=1);min=Math.min(min,t);max=Math.max(max,t);}
 }assert.ok(max-min>.7,'thickness must distinguish substantial bodies from thin necks');previous.dispose();honey.dispose();
});
test('Material modes preserve exact event sizes, random profiles, pool poses, source anchors and expiry',()=>{
 function run(material:'previous'|'honey'){
  const scene=new THREE.Scene(),root=new THREE.Group(),plate=new THREE.Mesh(new THREE.BoxGeometry(1,1,.15),new THREE.MeshBasicMaterial());plate.userData.effectSurface='armor';root.add(plate);scene.add(root);
  const original=plate.material,geometry=plate.geometry,response=new AdhesiveResponse(scene,new THREE.PerspectiveCamera(),37391,material),spec=createWeaponSpec('sticky','adhesive','pilot'),frames:unknown[]=[];
  for(let n=0;n<5;n++){
   const event={point:new THREE.Vector3(0,0,.1),normal:new THREE.Vector3(0,0,1),target:root,spec,radius:2.5,phase:'detonate' as const,energy:70};response.impact(event);const status=response.status(root);response.splash({...event,origin:new THREE.Vector3(0,0,1),exposure:.12,primary:false});
   for(let i=0;i<55;i++){root.position.x+=.003;root.rotation.y+=.001;status.update(1/60);response.update(1/60);frames.push({diagnostics:response.diagnostics,poses:response.group.children.map(o=>o instanceof THREE.InstancedMesh?Array.from(o.instanceMatrix.array):{p:o.position.toArray(),q:o.quaternion.toArray(),s:o.scale.toArray(),visible:o.visible})});}
   status.setIntensity(0);response.update(1/60);status.dispose();
  }
  const events=structuredClone(response.events);assert.equal(plate.material,original);assert.equal(plate.geometry,geometry);response.dispose();return{events,frames};
 }assert.deepEqual(run('honey'),run('previous'));
});
