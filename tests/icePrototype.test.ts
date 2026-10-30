import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { IceResponse,ICE_CAPACITY } from '../src/rendering/quality/ice/response.ts';
import { IceRime } from '../src/rendering/quality/ice/rime.ts';
import { IcePresentation } from '../src/rendering/quality/ice/presentation.ts';
import { iceSizing } from '../src/rendering/quality/ice/sizing.ts';
import { ElementalPresentation } from '../src/rendering/quality/elementalPresentation.ts';
import { PlayerBallistics } from '../src/rendering/PlayerBallistics.ts';
import { createWeaponSpec,type ProjectileType } from '../src/core/arsenal.ts';
import { applyStatus,advanceStatuses,createStatusState,getStatusModifiers } from '../src/core/statusEffects.ts';
import { icePlateAudioRecipe } from '../src/audio/iceAudio.ts';
import { elementalAudioRecipe,elementalEnvelope } from '../src/audio/elementalAudio.ts';

function target(scene:THREE.Scene){const root=new THREE.Group(),cloth=new THREE.Mesh(new THREE.BoxGeometry(1,1,.2),new THREE.MeshBasicMaterial());cloth.userData.corrosiveSurface='cloth';cloth.userData.enemyId=7;root.add(cloth);const armor=new THREE.Mesh(new THREE.BoxGeometry(1,1,.12),new THREE.MeshBasicMaterial());armor.position.z=.28;armor.userData.corrosiveSurface='armor';armor.raycast=()=>{};root.add(armor);scene.add(root);return{root,cloth,armor};}
const event=(root?:THREE.Group)=>({target:root,point:new THREE.Vector3(0,0,.11),normal:new THREE.Vector3(0,0,1),spec:createWeaponSpec('sticky','ice','pilot'),phase:'detonate' as const,radius:2.5,energy:70});
const matrices=(r:IceResponse)=>r.group.children.filter((m):m is THREE.InstancedMesh=>m instanceof THREE.InstancedMesh).map(m=>Array.from(m.instanceMatrix.array));
test('ice deposits on outer armor, borrows geometry and rejects every equipment slot',()=>{
 const scene=new THREE.Scene(),{root,cloth,armor}=target(scene),geometry=armor.geometry,material=armor.material,originalRay=armor.raycast;
 for(const slot of['weapon','shield','reactor','legs']){const owner=new THREE.Group();owner.userData.equipmentSlot=slot;const mesh=armor.clone();owner.add(mesh);root.add(owner);}
 const response=new IceResponse(scene);response.impact(event(root));const status=response.status(root);status.update(.1);assert.equal(response.events[0].surface,'armor');assert.ok(response.events[0].point[2]>.33);
 assert.equal(status.bindings.length,2);assert.ok(status.bindings.filter(b=>b.mesh.visible).every(b=>b.source===armor));assert.equal(status.bindings.find(b=>b.source===armor)!.mesh.geometry,geometry);assert.equal(armor.material,material);assert.equal(armor.raycast,originalRay);assert.equal(cloth.material instanceof THREE.MeshBasicMaterial,true);
 let disposed=0;geometry.addEventListener('dispose',()=>disposed++);response.dispose();assert.equal(disposed,0);assert.equal(armor.material,material);
});
test('ice plates have unequal release times, real translation/rotation, bounded particles and frozen pause state',()=>{
 const scene=new THREE.Scene(),{root}=target(scene),r=new IceResponse(scene);r.impact(event(root));const initial=matrices(r);r.update(.1);const moving=matrices(r);assert.notDeepEqual(moving,initial);r.update(0);r.update(NaN);assert.deepEqual(matrices(r),moving);assert.ok(moving.flat().every(Number.isFinite));
 const plates=(r as unknown as {plates:{items:{active:boolean;delay:number;released:boolean;rotation:THREE.Quaternion}[]}}).plates.items.filter(p=>p.active);assert.ok(new Set(plates.map(p=>p.delay)).size>2);assert.ok(plates.some(p=>p.released)&&plates.some(p=>!p.released));
 for(let i=0;i<300;i++)r.impact(event(root));assert.equal(r.diagnostics.plates,ICE_CAPACITY.plates);assert.equal(r.diagnostics.flakes,ICE_CAPACITY.flakes);assert.equal(r.events.length,ICE_CAPACITY.events);
 for(let i=0;i<40;i++)r.update(.1);assert.equal(r.diagnostics.plates,0);assert.equal(r.diagnostics.flakes,0);r.clear();assert.deepEqual(r.diagnostics,{plates:0,flakes:0,rimes:0});r.dispose();r.dispose();
});
test('secondary ice uses exposure/energy falloff and never spawns a primary plate fan',()=>{
 const base={projectile:'sticky' as const,phase:'detonate' as const,radius:2.5,energy:70};const direct=iceSizing(base),near=iceSizing({...base,secondary:true,exposure:.7}),edge=iceSizing({...base,secondary:true,exposure:.12,energy:12});
 assert.ok(direct.reach>0&&direct.plates>=4);assert.equal(near.plates,0);assert.equal(near.reach,0);assert.equal(edge.plates,0);assert.ok(edge.rime<near.rime&&near.rime<direct.rime);assert.ok(edge.flakes<near.flakes);
 const r=new IceResponse(new THREE.Scene());r.splash({...event(),origin:new THREE.Vector3(),exposure:.12,primary:false,target:new THREE.Group()});assert.equal(r.diagnostics.plates,0);assert.equal(r.events[0].role,'splash');r.dispose();
 for(const energy of[0,-1])assert.equal(iceSizing({...base,energy}).strength,0);
});
test('attached frost follows source transforms; fade, removal and release leave no borrowed resources behind',()=>{
 const scene=new THREE.Scene(),{root,armor}=target(scene),r=new IceResponse(scene);r.impact(event(root));const status=r.status(root),binding=status.bindings.find(b=>b.source===armor)!;root.position.x=4;root.rotation.y=.6;root.updateWorldMatrix(true,true);status.update(.1);
 assert.equal(binding.mesh.parent,armor);assert.ok(binding.mesh.getWorldPosition(new THREE.Vector3()).x>3);status.setIntensity(0);assert.equal(binding.mesh.visible,false);r.release(root);assert.equal(binding.mesh.parent,null);assert.equal(r.diagnostics.rimes,0);r.dispose();
});
test('all animated ice plate vertices stay outside floors, slopes and undersides through their full lifetime',()=>{
 for(const rotation of[0,.55,Math.PI]){const scene=new THREE.Scene(),mesh=new THREE.Mesh(new THREE.BoxGeometry(3,.3,3),new THREE.MeshBasicMaterial());mesh.position.y=2;mesh.rotation.x=rotation;scene.add(mesh);mesh.updateWorldMatrix(true,false);const normal=new THREE.Vector3(0,1,0).transformDirection(mesh.matrixWorld),point=mesh.localToWorld(new THREE.Vector3(0,.15,0)),r=new IceResponse(scene);
  r.impact({...event(),point,normal,hitSurface:mesh});const pool=r.group.getObjectByName('ice-release-plates') as THREE.InstancedMesh,matrix=new THREE.Matrix4();for(let tick=0;tick<75;tick++){r.update(.01);for(let i=0;i<pool.count;i++){pool.getMatrixAt(i,matrix);const vertices=pool.geometry.attributes.position;for(let v=0;v<vertices.count;v++){const p=new THREE.Vector3().fromBufferAttribute(vertices,v).applyMatrix4(matrix);assert.ok(p.sub(point).dot(normal)>=-.00001,`surface ${rotation}, tick ${tick}`);}}}
  assert.equal(r.events[0].normal[1]>0,rotation<Math.PI/2);r.dispose();
 }
});
test('rime input does not mutate contact/specs or advance its reveal on invalid/paused updates',()=>{
 const scene=new THREE.Scene(),{root}=target(scene),r=new IceResponse(scene),e=event(root),point=e.point.toArray(),normal=e.normal.toArray();Object.freeze(e.spec);r.impact(e);const status=r.status(root),ages=status.bindings.map(b=>[...b.ages]);status.update(0,99);status.update(NaN,99);assert.deepEqual(status.bindings.map(b=>b.ages),ages);assert.deepEqual(e.point.toArray(),point);assert.deepEqual(e.normal.toArray(),normal);r.dispose();
 const bare=new IceRime(new THREE.Group());bare.contact(new THREE.Vector3(NaN,0,0),1);bare.dispose();
});
for(const projectile of['bullet','slug','spike','ricochet','homing','sticky','orb','beam','scatter','rocket','disc','arc','cluster']as ProjectileType[])test(`ice prototype preserves complete ${projectile} hits, trajectories and status modifiers`,()=>{
 function replay(after:boolean){const scene=new THREE.Scene(),{root,armor}=target(scene);armor.removeFromParent();root.position.z=-6;const layer=after?new IcePresentation(scene,new THREE.PerspectiveCamera()):new ElementalPresentation(scene,new THREE.PerspectiveCamera(),{corrosiveAB:true}),hits:unknown[]=[],positions:unknown[]=[],modifiers:unknown[]=[],state=createStatusState();let time=0;
  const engine=new PlayerBallistics(scene,{targets:()=>[{id:7,root,radius:1}],occluders:()=>[],hit:hit=>{hits.push({point:hit.point.toArray(),direction:hit.direction.toArray(),damage:hit.damage,critical:hit.critical,spec:{...hit.spec}});applyStatus(state,'ice',time,20);layer.status(root,'ice');}});engine.setPresentation(layer);const spec=createWeaponSpec(projectile,'ice','pilot');spec.secondaryElement='fire';const before=JSON.stringify(spec);Object.freeze(spec);
  for(let i=0;i<600;i++){time=i/120;if([0,42,85].includes(i))engine.fire(new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,-1),spec,20,50);engine.update(1/120);advanceStatuses(state,time);layer.update(1/120,time,false,spec,'pilot');modifiers.push({state:structuredClone(state),modifiers:getStatusModifiers(state,time)});positions.push(scene.children.filter(o=>o.name.startsWith('quality-projectile-')).map(o=>({p:o.position.toArray(),q:o.quaternion.toArray()})));}
  assert.equal(JSON.stringify(spec),before);engine.clear();layer.dispose();return{hits,positions,modifiers};
 }assert.deepEqual(replay(true),replay(false));
});
test('ice audio has bounded soft envelopes and preserves recipes of other elements',()=>{
 for(const element of['fire','corrosive','shock','gravity','radiation','adhesive']as const)for(const event of['shot','impact','status']as const)assert.deepEqual(icePlateAudioRecipe(element,event),elementalAudioRecipe(element,event));
 for(const event of['equipment','shot','flight','impact','status','release']as const)for(const delivery of['bullet','sticky']as const)for(const surface of['cloth','armor']as const){const voices=icePlateAudioRecipe('ice',event,{delivery,surface});assert.ok(voices.length>0&&voices.length<=9);for(const voice of voices){assert.ok(voice.duration>0&&voice.duration<.5);assert.equal(elementalEnvelope(0,voice),0);assert.equal(elementalEnvelope(voice.duration,voice),0);assert.ok([voice.gain,voice.frequency,voice.endFrequency].every(Number.isFinite));}}
});

test('plate material pass preserves every delivery size/count/lifetime, secondary mark and flake trajectory',()=>{
 for(const projectile of['bullet','slug','spike','ricochet','homing','sticky','orb','beam','scatter','rocket','disc','arc','cluster'] as ProjectileType[])for(const secondary of[false,true])for(const phase of['contact','detonate'] as const){
  function trace(style:'previous'|'layered'){
   const scene=new THREE.Scene(),{root}=target(scene),r=new IceResponse(scene,undefined,{plateStyle:style,variationSeed:37391});
   const e={...event(root),phase,spec:createWeaponSpec(projectile,'ice','pilot'),exposure:secondary?.37:1};
   if(secondary)r.splash({...e,target:root,primary:false,origin:e.point.clone()});else r.impact(e);
   const internals=r as unknown as {plates:{items:{active:boolean;size:number;life:number;delay:number;velocity:THREE.Vector3}[]};flakes:{items:{active:boolean;size:number;life:number;position:THREE.Vector3;velocity:THREE.Vector3}[]}};
   const plates=internals.plates.items.filter(p=>p.active).map(p=>({size:p.size,life:p.life,delay:p.delay,speed:p.velocity.length()}));
   const flakes=internals.flakes.items.filter(p=>p.active).map(p=>({size:p.size,life:p.life,p:p.position.toArray(),v:p.velocity.toArray()}));
   const geometry=(r.group.getObjectByName('ice-release-plates') as THREE.InstancedMesh).geometry.attributes.position.array.slice();
   const result={events:structuredClone(r.events),plates,flakes,geometry};r.dispose();return result;
  }
  const a=trace('previous'),b=trace('layered');
  assert.deepEqual(b.events,a.events);assert.deepEqual(b.flakes,a.flakes);assert.deepEqual(b.geometry,a.geometry);assert.equal(b.plates.length,a.plates.length);
  for(let i=0;i<a.plates.length;i++){assert.equal(b.plates[i].size,a.plates[i].size);assert.equal(b.plates[i].life,a.plates[i].life);assert.equal(b.plates[i].delay,a.plates[i].delay);assert.ok(Math.abs(b.plates[i].speed-a.plates[i].speed)<1e-10);}
 }
});

test('layered events vary reproducibly without changing particle budgets or rerolling on pause',()=>{
 function run(){const scene=new THREE.Scene(),{root}=target(scene),r=new IceResponse(scene,undefined,{variationSeed:37391}),out:number[][]=[];
  for(let shot=0;shot<4;shot++){r.impact(event(root));r.update(.183);const mesh=r.group.getObjectByName('ice-release-plates') as THREE.InstancedMesh;out.push(Array.from(mesh.instanceMatrix.array));const snapshot=Array.from(mesh.instanceMatrix.array);r.update(0);assert.deepEqual(Array.from(mesh.instanceMatrix.array),snapshot);r.update(1);}
  r.dispose();return out;
 }const a=run();assert.deepEqual(run(),a);assert.notDeepEqual(a[0],a[1]);assert.notDeepEqual(a[1],a[2]);
});
