import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CorrosiveResponse } from '../src/rendering/quality/corrosive/liquid.ts';
import { CorrosiveStatus } from '../src/rendering/quality/corrosive/surfaces.ts';
import { createWeaponSpec } from '../src/core/arsenal.ts';

function fixture(motion:'directional'|'previous'){
 const scene=new THREE.Scene(),root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,.2),new THREE.MeshBasicMaterial());mesh.userData.corrosiveSurface='armor';root.add(mesh);scene.add(root);
 const response=new CorrosiveResponse(scene,undefined,motion),spec=createWeaponSpec('sticky','corrosive');return{root,mesh,response,event:{point:new THREE.Vector3(0,0,.1),normal:new THREE.Vector3(0,0,1),target:root,spec,radius:2.5,phase:'detonate' as const,energy:70}};
}
test('the rupture advects away from the origin, deforms beyond uniform scaling, and freezes when paused',()=>{
 const f=fixture('directional');f.response.impact(f.event);const burst=f.response.group.children.find(o=>o instanceof THREE.Mesh&&o.visible) as THREE.Mesh;
 f.response.update(.025);const onset=Array.from(burst.geometry.attributes.position.array);f.response.update(.075);const stretch=Array.from(burst.geometry.attributes.position.array);f.response.update(.10);const curl=Array.from(burst.geometry.attributes.position.array);
 const extent=(p:number[])=>p.filter((_,i)=>i%3===0);assert.ok(Math.max(...extent(stretch))>Math.abs(Math.min(...extent(stretch)))*1.4,'one leading stream must dominate');
 const ratio=stretch.reduce((sum,p,i)=>sum+p*onset[i],0)/onset.reduce((sum,p)=>sum+p*p,0);assert.ok(stretch.some((p,i)=>Math.abs(p-onset[i]*ratio)>.01),'animation must deform rather than inflate one static shape');assert.notDeepEqual(curl,stretch);assert.ok(curl.every(Number.isFinite));
 f.response.update(0);f.response.update(NaN);assert.deepEqual(Array.from(burst.geometry.attributes.position.array),curl);assert.equal(burst.material instanceof THREE.ShaderMaterial&&burst.material.uniforms.size.value,f.response.events[0].size);f.response.dispose();
});
test('previous and directional modes retain identical size, falloff, contact metadata and secondary particle transforms',()=>{
 const runs=[];
 for(const mode of['previous','directional']as const){const f=fixture(mode);f.response.impact(f.event);f.response.splash({...f.event,origin:new THREE.Vector3(),primary:false,exposure:.18,energy:12.6,phase:'contact'});f.response.update(.05);
  const splashOnly=fixture(mode);splashOnly.response.splash({...splashOnly.event,origin:new THREE.Vector3(),primary:false,exposure:.18,energy:12.6,phase:'contact'});splashOnly.response.update(.05);
  runs.push({events:f.response.events,secondary:splashOnly.response.group.children.filter((o):o is THREE.InstancedMesh=>o instanceof THREE.InstancedMesh).map(m=>({count:m.count,matrix:Array.from(m.instanceMatrix.array)}))});f.response.dispose();splashOnly.response.dispose();}
 assert.deepEqual(runs[0],runs[1]);
});
test('directional coating has per-contact reveal clocks while secondary coating keeps its prior shape and radius',()=>{
 const f=fixture('directional'),status=new CorrosiveStatus(f.root,true);status.contact(f.event.point,.5,f.mesh,new THREE.Vector3(1,.25,0));const b=status.bindings[0];assert.equal(b.ages[0],0);assert.equal(b.smears[0],1);assert.equal(b.radii[0],.5);
 status.update(.05,200);assert.equal(b.ages[0],.05);status.contact(f.event.point,.07,f.mesh);assert.equal(b.smears[1],0);assert.equal(b.radii[1],.07);assert.equal(b.ages[1],1);status.update(0,999);assert.equal(b.ages[0],.05);status.dispose();f.response.dispose();
});
