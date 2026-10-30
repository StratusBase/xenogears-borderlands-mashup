import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {ResinMask} from '../src/rendering/quality/adhesive/surfaces.ts';
import {createStainProfile} from '../src/rendering/quality/adhesive/stains.ts';
import {referenceVariedStainFragment,variedStainFragment,type ResinStainKernel} from '../src/rendering/quality/adhesive/stainShader.ts';
import {AdhesiveResponse} from '../src/rendering/quality/adhesive/response.ts';
import {createWeaponSpec} from '../src/core/arsenal.ts';

test('The same-build reference is the frozen ef0eeb8 varied honey kernel',()=>{
 assert.equal(createHash('sha256').update(referenceVariedStainFragment).digest('hex'),'0e4ccc9dc0595da9fd32422b8066e4f5b1b135eb5851fcf02b7eccab31cad4c1');
});

test('GPU activity and lobe counts follow actual contacts through coalescing and slot eviction',()=>{
 const scene=new THREE.Scene(),source=new THREE.Mesh(new THREE.BoxGeometry(2,2,.1),new THREE.MeshBasicMaterial());scene.add(source);const mask=new ResinMask(source),normal=new THREE.Vector3(0,0,1),right=new THREE.Vector3(1,0,0);
 function check(){for(let i=0;i<4;i++)assert.equal(mask.stainFrames[i].z,mask.profiles[i]?.lobes.length??0);}
 check();for(let i=0;i<20;i++){mask.contact(new THREE.Vector3(i%2?.3:0,0,.05),.3,normal,createStainProfile(i,i%5),right);mask.update(.2,1);check();}
 for(let i=0;i<12;i++){mask.contact(new THREE.Vector3(i*.07,0,.05),.03,normal,createStainProfile(i,0),right);check();}mask.dispose();
});

test('Reference and optimized kernels retain every profile, burst, particle pose and lifetime',()=>{
 function run(kernel:ResinStainKernel){
  const scene=new THREE.Scene(),root=new THREE.Group(),source=new THREE.Mesh(new THREE.BoxGeometry(1,1,.1),new THREE.MeshBasicMaterial());source.userData.effectSurface='armor';root.add(source);scene.add(root);
  const response=new AdhesiveResponse(scene,new THREE.PerspectiveCamera(),37391,'honey','varied',kernel),spec=createWeaponSpec('sticky','adhesive','pilot'),frames=[];
  for(let i=0;i<8;i++){const e={point:new THREE.Vector3(0,0,.1),normal:new THREE.Vector3(0,0,1),phase:'detonate' as const,radius:2.5,energy:70,spec,target:root};response.impact({...e,phase:'contact'});response.impact(e);response.splash({...e,origin:new THREE.Vector3(0,0,1),primary:false,exposure:.12});const status=response.status(root);
   for(let j=0;j<60;j++){status.update(1/60);response.update(1/60);frames.push(response.group.children.map(o=>o instanceof THREE.InstancedMesh?Array.from(o.instanceMatrix.array):{p:o.position.toArray(),q:o.quaternion.toArray(),s:o.scale.toArray(),visible:o.visible}));}}
  const result={events:structuredClone(response.events),stains:structuredClone(response.stainEvents),frames,diagnostics:response.diagnostics};response.dispose();return result;
 }assert.deepEqual(run('reference'),run('optimized'));
});

test('Dense contacts retain the exact reference kernel and stable occupancy does not rebuild materials',()=>{
 const source=new THREE.Mesh(new THREE.PlaneGeometry(4,2),new THREE.MeshBasicMaterial()),scene=new THREE.Scene();scene.add(source);const mask=new ResinMask(source),normal=new THREE.Vector3(0,0,1),right=new THREE.Vector3(1,0,0),profile=createStainProfile(8,2);
 mask.contact(new THREE.Vector3(-.12,0,0),.3,normal,profile,right);assert.equal(mask.material.fragmentShader,variedStainFragment);const fastVersion=mask.material.version;
 mask.contact(new THREE.Vector3(-.12,0,0),.3,normal,profile,right);assert.equal(mask.material.version,fastVersion);
 mask.contact(new THREE.Vector3(.12,0,0),.3,normal,profile,right);assert.equal(mask.material.fragmentShader,referenceVariedStainFragment);const denseVersion=mask.material.version;
 mask.contact(new THREE.Vector3(.12,0,0),.3,normal,profile,right);assert.equal(mask.material.version,denseVersion);
 mask.contact(new THREE.Vector3(0,0,0),2,normal,profile,right);assert.equal(mask.material.fragmentShader,variedStainFragment);mask.dispose();
});
