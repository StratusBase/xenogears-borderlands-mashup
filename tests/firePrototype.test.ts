import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWeaponSpec,type ProjectileType} from '../src/core/arsenal.ts';
import {PlayerBallistics,type BallisticHit} from '../src/rendering/PlayerBallistics.ts';
import {ElementalPresentation} from '../src/rendering/quality/elementalPresentation.ts';
import {FirePresentation} from '../src/rendering/quality/fire/presentation.ts';
import {FireResponse,FIRE_CAPACITY} from '../src/rendering/quality/fire/response.ts';
import {fireSizing} from '../src/rendering/quality/fire/sizing.ts';
import {FIRE_LOBES,fireLobes} from '../src/rendering/quality/fire/flame.ts';
import {fireABCAudioRecipe} from '../src/audio/fireAudio.ts';
import {corrosiveABAudioRecipe} from '../src/audio/corrosiveAudio.ts';
import {elementalEnvelope} from '../src/audio/elementalAudio.ts';

let originalDocument:PropertyDescriptor|undefined;
before(()=>{originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){}})})}});});
after(()=>{if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else Reflect.deleteProperty(globalThis,'document');});
function target(scene:THREE.Scene){const root=new THREE.Group(),cloth=new THREE.Mesh(new THREE.BoxGeometry(1,1,.2),new THREE.MeshBasicMaterial()),plate=new THREE.Mesh(new THREE.BoxGeometry(1,1,.1),new THREE.MeshBasicMaterial());cloth.userData.corrosiveSurface='cloth';cloth.userData.enemyId=7;plate.userData.corrosiveSurface='armor';plate.position.z=.30;plate.raycast=()=>{};root.add(cloth,plate);scene.add(root);return{root,cloth,plate};}
function event(root?:THREE.Group){return{target:root,point:new THREE.Vector3(0,0,.12),normal:new THREE.Vector3(0,0,1),spec:createWeaponSpec('bullet','fire','pilot'),phase:'contact' as const,radius:.3,energy:28};}

test('Fire size follows real energy, delivery, channel and secondary exposure; C requires a detonation',()=>{
 const input={delivery:'sticky' as const,phase:'contact' as const,radius:2.5,energy:28,targetSpan:1.5};
 const a=fireSizing(input),c=fireSizing({...input,phase:'detonate'}),low=fireSizing({...input,energy:4}),second=fireSizing({...input,phase:'detonate',secondary:true,exposure:.6}),edge=fireSizing({...input,phase:'detonate',secondary:true,exposure:.1});
 assert.equal(a.explosive,false);assert.equal(c.explosive,true);assert.ok(c.sheetSize>a.sheetSize);assert.ok(a.sheetSize>low.sheetSize);assert.equal(second.sheetSize,0);assert.ok(second.coatingRadius>edge.coatingRadius);assert.ok(second.emberCount>edge.emberCount);assert.ok(fireSizing({...input,channelWeight:.64}).sheetSize<a.sheetSize);assert.equal(fireSizing({...input,exposure:0}).emberCount,0);
});
test('Fire combustion parcels curl, separate and extinguish independently rather than scale a static strip',()=>{
 for(const explosive of[false,true]){
  const parcels=Array.from({length:FIRE_LOBES},()=>new THREE.Vector4());
  const samples=[.07,.18,.31,.46].map(t=>fireLobes(t,.7,explosive,parcels).map(v=>v.clone()));
  for(const frame of samples)assert.ok(frame.every(v=>v.toArray().every(Number.isFinite)));
  for(let i=1;i<FIRE_LOBES;i++){
   const a=samples[1][i].clone().sub(samples[0][i]),b=samples[2][i].clone().sub(samples[1][i]);
   assert.ok(Math.abs(a.x*b.z-a.z*b.x)>.00001,'parcel path must turn rather than follow a straight ray');
  }
  assert.notEqual(samples[1][0].w,samples[1][4].w);
  assert.ok(fireLobes(1.5,.7,explosive,parcels).every(v=>v.w===0));
 }
 const make=()=>Array.from({length:FIRE_LOBES},()=>new THREE.Vector4());
 assert.notDeepEqual(fireLobes(.2,.7,false,make()),fireLobes(.2,.7,true,make()));
});
test('Fire projects onto actual outer armor and excludes every equipment slot',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),{root,cloth,plate}=target(scene),response=new FireResponse(scene,camera);
 for(const slot of['weapon','shield','reactor','legs']){const owner=new THREE.Group(),fake=plate.clone();owner.userData.equipmentSlot=slot;fake.position.z=.8;owner.add(fake);root.add(owner);}
 const raycast=plate.raycast,geometry=plate.geometry,material=plate.material;let disposed=0;geometry.addEventListener('dispose',()=>disposed++);
 response.impact(event(root));const status=response.status(root);status.update(.016,20);response.update(.016);
 assert.equal(response.events[0].surface,'armor');assert.ok(response.events[0].point[2]>.34);assert.deepEqual([...status.bindings.keys()],[plate]);assert.equal(status.bindings.has(cloth),false);assert.equal(status.bindings.get(plate)!.mesh.geometry,geometry);assert.equal(plate.material,material);assert.equal(plate.raycast,raycast);
 const pool=response.group.getObjectByName('fire-tongues-pool') as THREE.InstancedMesh,m=new THREE.Matrix4();for(let i=0;i<pool.count;i++){pool.getMatrixAt(i,m);assert.ok(new THREE.Vector3().setFromMatrixPosition(m).z>.35);}
 response.dispose();response.dispose();assert.equal(disposed,0);assert.equal(plate.material,material);
});
test('Fire status follows a moving source and authoritative fading without modifying the body',()=>{
 const scene=new THREE.Scene(),{root,plate}=target(scene),response=new FireResponse(scene,new THREE.PerspectiveCamera());response.impact(event(root));const status=response.status(root);status.update(.02);response.update(.02);
 const pool=response.group.getObjectByName('fire-tongues-pool') as THREE.InstancedMesh,m=new THREE.Matrix4();pool.getMatrixAt(0,m);const before=new THREE.Vector3().setFromMatrixPosition(m);root.position.x=3;root.rotation.y=.5;response.update(.02);pool.getMatrixAt(0,m);const after=new THREE.Vector3().setFromMatrixPosition(m);assert.ok(after.x-before.x>2.8);
 status.setIntensity(0);status.update(.02);assert.equal(status.bindings.get(plate)!.material.uniforms.presence.value,0);status.dispose();response.update(.1);assert.equal(response.diagnostics.statuses,0);response.dispose();
});
test('Fire pools, diagnostics and ground scorches stay bounded; inputs and paused matrices stay unchanged',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),response=new FireResponse(scene,camera),e=event();Object.freeze(e.spec);const spec=JSON.stringify(e.spec),point=e.point.toArray(),normal=e.normal.toArray();
 response.impact({...e,point:new THREE.Vector3(NaN,0,0)});assert.equal(response.events.length,0);
 for(let i=0;i<300;i++)response.impact(e);const d=response.diagnostics;assert.equal(d.sheets,FIRE_CAPACITY.sheets);assert.equal(d.embers,FIRE_CAPACITY.embers);assert.ok(d.smoke<=FIRE_CAPACITY.smoke);assert.equal(response.events.length,128);assert.equal(JSON.stringify(e.spec),spec);assert.deepEqual(e.point.toArray(),point);assert.deepEqual(e.normal.toArray(),normal);
 response.update(.02);const pools=response.group.children.filter((m):m is THREE.InstancedMesh=>m instanceof THREE.InstancedMesh),before=pools.map(m=>Array.from(m.instanceMatrix.array));response.update(0);response.update(NaN);assert.deepEqual(pools.map(m=>Array.from(m.instanceMatrix.array)),before);assert.ok(before.every(a=>a.every(Number.isFinite)));
 for(let i=0;i<20;i++){const surface=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());scene.add(surface);response.impact({...e,hitSurface:surface});}assert.equal(response.diagnostics.scorches,FIRE_CAPACITY.scorches);
 response.clear();assert.deepEqual(response.diagnostics,{sheets:0,embers:0,tongues:0,smoke:0,scorches:0,statuses:0});response.dispose();
});
test('Fire adapter registers authoritative status lifecycle and forwards corrosive splash independently',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),{root}=target(scene),layer=new FirePresentation(scene,camera),spec=createWeaponSpec('sticky','fire','pilot');spec.secondaryElement='corrosive';
 const hit={...event(root),spec,phase:'detonate' as const,radius:2.5};layer.impact(hit);const status=layer.status(root,'fire');assert.equal(layer.status(root,'fire'),status);assert.equal(layer.diagnostics.statuses,1);assert.ok(layer.fire.events.length>0);assert.ok(layer.corrosive!.events.length>0);
 const fireBefore=layer.fire.events.length,acidBefore=layer.corrosive!.events.length;layer.splash!({...hit,target:root,origin:new THREE.Vector3(0,0,2),energy:12,exposure:.4,primary:false});assert.equal(layer.fire.events.length,fireBefore+1);assert.equal(layer.corrosive!.events.length,acidBefore+1);assert.equal(layer.fire.events.at(-1)!.size,0);
 status.update(.02);layer.update(.02,20,false,spec,'pilot');const live=layer.fire.diagnostics;layer.update(.2,21,true,spec,'pilot');assert.deepEqual(layer.fire.diagnostics,live);layer.release(root);assert.equal(layer.fire.diagnostics.statuses,0);layer.dispose();
});
for(const projectile of['bullet','slug','spike','ricochet','homing','sticky','orb','beam','scatter','rocket','disc','arc','cluster'] as ProjectileType[])test(`Fire A+B+C preserves exact ${projectile} hits, frozen recipes and trajectory`,()=>{
 function run(after:boolean){const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),{root}=target(scene),hits:unknown[]=[],positions:unknown[]=[];root.position.z=-6;
  const layer=after?new FirePresentation(scene,camera):new ElementalPresentation(scene,camera,{corrosiveAB:true});const ballistics=new PlayerBallistics(scene,{targets:()=>[{id:7,root,radius:1}],occluders:()=>[],hit:(hit:BallisticHit)=>hits.push({point:hit.point.toArray(),direction:hit.direction.toArray(),damage:hit.damage,critical:hit.critical,spec:{...hit.spec}})});ballistics.setPresentation(layer);
  const spec=createWeaponSpec(projectile,'fire','pilot');spec.secondaryElement='ice';const original=JSON.stringify(spec);ballistics.fire(new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,-1),spec,20,50);
  for(let i=0;i<360;i++){ballistics.update(1/120);layer.update(1/120,i/120,false,spec,'pilot');positions.push(scene.children.filter(o=>o.name.startsWith('quality-projectile-')).map(o=>({p:o.position.toArray(),q:o.quaternion.toArray()})));}
  assert.equal(JSON.stringify(spec),original);ballistics.clear();layer.dispose();return{hits,positions};
 }
 assert.deepEqual(run(true),run(false));
});
test('Fire sound keeps other elements intact, secondary quiet and status layers bounded',()=>{
 for(const element of['corrosive','ice','shock','gravity','radiation','adhesive'] as const)for(const event of['shot','impact','status','release'] as const)assert.deepEqual(fireABCAudioRecipe(element,event),corrosiveABAudioRecipe(element,event));
 const primary=fireABCAudioRecipe('fire','impact',{delivery:'sticky',strength:1}),secondary=fireABCAudioRecipe('fire','impact',{delivery:'sticky',splash:true});assert.ok(primary.reduce((s,v)=>s+v.gain,0)>secondary.reduce((s,v)=>s+v.gain,0)*3);assert.ok(secondary.every(v=>v.wave==='noise'));
 for(const event of['impact','status','release'] as const)for(const voice of fireABCAudioRecipe('fire',event)){assert.ok(voice.duration>0&&voice.duration<1);assert.ok(voice.gain<.2);assert.equal(elementalEnvelope(0,voice),0);assert.equal(elementalEnvelope(voice.duration,voice),0);}
});
