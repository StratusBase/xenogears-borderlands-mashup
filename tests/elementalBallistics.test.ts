import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createWeaponSpec, type ElementType, type ProjectileType, type WeaponSpec } from '../src/core/arsenal.ts';
import { PlayerBallistics, type BallisticHit, type BallisticTarget, type BallisticPresentation, type BallisticPresentationImpact } from '../src/rendering/PlayerBallistics.ts';
import { createElementalProjectile, createElementalTrail, createElementalBeam, updateElementalProjectile } from '../src/rendering/quality/elementalFlight.ts';

const elements:ElementType[]=['kinetic','fire','ice','corrosive','shock','radiation','gravity','adhesive'];
const deliveries:ProjectileType[]=['bullet','slug','spike','ricochet','homing','sticky','orb','beam','scatter','rocket','disc','arc','cluster'];
function eventSnapshot(hit:BallisticHit){return{targetId:hit.targetId,point:hit.point.toArray(),direction:hit.direction.toArray(),damage:hit.damage,critical:hit.critical,spec:structuredClone(hit.spec)};}
function fixture(quality:boolean){
 const scene=new THREE.Scene(),targets:BallisticTarget[]=[],covers:THREE.Object3D[]=[],hits:ReturnType<typeof eventSnapshot>[]=[],impacts:BallisticPresentationImpact[]=[];
 let animationCalls=0;
 const adapter:BallisticPresentation={
  projectile:createElementalProjectile,trail:createElementalTrail,beam:createElementalBeam,
  impact:event=>impacts.push({...event,point:event.point.clone(),normal:event.normal.clone(),spec:structuredClone(event.spec)}),
  updateProjectile:(root,dt,age)=>{animationCalls++;updateElementalProjectile(root,dt,age);},
 };
 const ballistics=new PlayerBallistics(scene,{targets:()=>targets,occluders:()=>covers,hit:event=>hits.push(eventSnapshot(event))});
 if(quality)ballistics.setPresentation(adapter);
 const target=(id:number,position:[number,number,number],size:[number,number,number]=[1,1,1],critical=false)=>{
  const root=new THREE.Group();root.position.set(...position);root.userData.fixtureId=id;
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshBasicMaterial());mesh.userData.enemyId=id;mesh.userData.critical=critical;root.add(mesh);scene.add(root);
  const target={id,root,radius:Math.max(...size)/2};targets.push(target);return{...target,mesh};
 };
 const cover=(position:[number,number,number],size:[number,number,number])=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshBasicMaterial());mesh.position.set(...position);covers.push(mesh);scene.add(mesh);return mesh;
 };
 const trajectory=(projectile:ProjectileType)=>scene.children.filter(root=>root.name===`player-projectile-${projectile}`||root.name===`quality-projectile-${projectile}`).map(root=>({position:root.position.toArray(),quaternion:root.quaternion.toArray()}));
 const cleanup=()=>{
  ballistics.clear();const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  scene.traverse(object=>{if(!(object instanceof THREE.Mesh))return;geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);});
  geometries.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());
 };
 return{scene,targets,covers,hits,impacts,adapter,ballistics,target,cover,trajectory,cleanup,get animationCalls(){return animationCalls;}};
}
function spec(projectile:ProjectileType,element:ElementType,overrides:Partial<WeaponSpec>={}):WeaponSpec{
 return{...createWeaponSpec(projectile,element),spread:0,...overrides};
}
function directCase(quality:boolean,element:ElementType,projectile:ProjectileType,critical:boolean,cover=false){
 const f=fixture(quality),y=critical?2.2:1.25;
 const target=f.target(71,[0,y,-8],[1.1,.65,.8],critical);
 if(cover)f.cover([0,1.8,-3],[12,7,.2]);
 const recipe=spec(projectile,element,{secondaryElement:element==='shock'?'ice':'shock',trail:'helix',visualVariant:2});
 const before=structuredClone(recipe),trace:ReturnType<typeof f.trajectory>[]=[];
 f.ballistics.fire(new THREE.Vector3(0,y,0),new THREE.Vector3(0,0,-1),recipe,37,50,'voltaic');
 for(let i=0;i<33;i++){f.ballistics.update(.05);trace.push(f.trajectory(projectile));}
 assert.deepEqual(recipe,before,'presentation must never mutate a combat recipe');
 const impacts=f.impacts.map(event=>({point:event.point.toArray(),normal:event.normal.toArray(),phase:event.phase,targetId:event.target?.userData.fixtureId}));
 const result={hits:f.hits,trace,impacts,animationCalls:f.animationCalls};
 if(quality){
  assert.ok(impacts.length>0,'physical contact must provide authoritative presentation evidence');
  const contact=f.impacts.find(event=>event.phase===(projectile==='cluster'?'detonate':'contact'))!;assert.ok(contact);assert.ok(Math.abs(contact.normal.length()-1)<1e-7);
  assert.ok(contact.normal.z>.999,'front-face contact must face back toward the shooter');
  assert.equal(contact.target,cover?undefined:target.root);
  const surfaceZ=cover?-2.9:-7.6;
  if(projectile==='cluster')assert.ok(contact.point.z>=surfaceZ&&contact.point.z<surfaceZ+.1,'the parent burst stays on the near side of contact');
  else assert.ok(Math.abs(contact.point.z-surfaceZ)<1e-6);
  assert.equal(f.impacts.filter(event=>event.phase==='detonate').length,recipe.blastRadius>0?(projectile==='cluster'?recipe.split!.count+1:recipe.split?.count??1):0);
 }
 f.cleanup();return result;
}

for(const element of elements)for(const projectile of deliveries){
 test(`${element}/${projectile}: complete head/body hit events and flight transforms equal the legacy renderer`,()=>{
  for(const critical of[false,true]){
   const legacy=directCase(false,element,projectile,critical),quality=directCase(true,element,projectile,critical);
   assert.ok(legacy.hits.length>0,'fixture must be struck by the real simulation');
   assert.equal(legacy.hits[0].critical,projectile==='cluster'?false:critical);
   if(projectile==='cluster'){
    const packets=createWeaponSpec('cluster',element).split!.count+1;
    assert.ok(legacy.hits.length>=1&&legacy.hits.length<=packets,'the parent plus each bomblet can hit a target at most once');
    assert.ok(legacy.hits.every(hit=>hit.damage<=37/packets+1e-9&&!hit.critical),'all Cluster packets use their bounded blast share without contact/headshot damage');
    assert.ok(legacy.hits.reduce((sum,hit)=>sum+hit.damage,0)<=37+1e-9,'splash falloff can reduce but never multiply the shot budget');
    assert.ok(legacy.hits.every(hit=>hit.spec.element===element&&hit.spec.secondaryElement===(element==='shock'?'ice':'shock')),'both independent channels survive the split');
   }
   assert.deepEqual(quality.hits,legacy.hits,'IDs, exact points/directions, critical flags, damage and complete recipes must match');
   assert.deepEqual(quality.trace,legacy.trace,'homing, gravity, reflection, attachment and lifetime must match');
  }
 });
}

test('cover occludes all elements and delivery families with the same contact normal and no combat hits',()=>{
 for(const element of elements)for(const projectile of deliveries){
  const legacy=directCase(false,element,projectile,false,true),quality=directCase(true,element,projectile,false,true);
  assert.deepEqual(legacy.hits,[]);assert.deepEqual(quality.hits,legacy.hits);assert.deepEqual(quality.trace,legacy.trace);
 }
});

for(const projectile of['ricochet','disc']as const)test(`${projectile}: reflected hits use identical wall normals, trajectories and reduced damage for every element`,()=>{
 for(const element of elements){
  const run=(quality:boolean)=>{const f=fixture(quality);f.cover([2,1,-2],[.1,5,10]);f.target(2,[-2,1,-6],[1.4,1.4,1.4]);
   f.ballistics.fire(new THREE.Vector3(0,1,0),new THREE.Vector3(1,0,-1),spec(projectile,element,{speed:40,bounces:1}),20);
   const trace=[];for(let i=0;i<10;i++){f.ballistics.update(.05);trace.push(f.trajectory(projectile));}
   const result={hits:f.hits,trace,impacts:f.impacts.map(event=>({phase:event.phase,normal:event.normal.toArray(),point:event.point.toArray(),target:event.target?.userData.fixtureId}))};f.cleanup();return result;};
  const baseline=run(false),quality=run(true);assert.equal(baseline.hits.length,1);assert.equal(baseline.hits[0].damage,17);assert.ok(baseline.hits[0].direction[0]<0);
  assert.deepEqual(quality.hits,baseline.hits);assert.deepEqual(quality.trace,baseline.trace);assert.deepEqual(quality.impacts[0].normal,[-1,0,0]);
 }
});

test('homing intercepts the same off-axis target with matching exact flight state and hits for every element',()=>{
 for(const element of elements){
  const run=(quality:boolean)=>{const f=fixture(quality);f.target(1,[3,1,-10]);f.ballistics.fire(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-1),spec('homing',element,{speed:20,tracking:4}),20);const trace=[];
   for(let i=0;i<16;i++){f.ballistics.update(.05);trace.push(f.trajectory('homing'));}const result={hits:f.hits,trace};f.cleanup();return result;};
  const baseline=run(false),quality=run(true);assert.equal(baseline.hits.length,1);assert.deepEqual(quality,baseline);
 }
});

test('moving sticky attachments, pause and delayed detonation stay identical for every element',()=>{
 for(const element of elements){
  const run=(quality:boolean)=>{const f=fixture(quality),target=f.target(1,[0,1,-3]);f.ballistics.fire(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-1),spec('sticky',element,{speed:20,fuse:.4}),20);
   f.ballistics.update(.15);assert.equal(f.hits.length,1);assert.equal(f.hits[0].damage,4);
   const atContact=f.trajectory('sticky'),animation=f.animationCalls,impactCount=f.impacts.length;
   f.ballistics.update(0);assert.deepEqual(f.trajectory('sticky'),atContact);assert.equal(f.animationCalls,animation);assert.equal(f.impacts.length,impactCount);
   target.root.position.x=3;f.ballistics.update(.1);const attached=f.trajectory('sticky');assert.ok(Math.abs(attached[0].position[0]-3)<1e-6);
   f.ballistics.update(.4);const result={hits:f.hits,atContact,attached,active:f.ballistics.activeCount,impacts:f.impacts.map(event=>({point:event.point.toArray(),phase:event.phase,target:event.target?.userData.fixtureId}))};
   assert.equal(f.hits.length,2);assert.equal(f.hits[1].critical,false);assert.equal(f.ballistics.activeCount,0);
   if(quality){assert.deepEqual(result.impacts.map(event=>event.phase),['contact','detonate']);assert.equal(result.impacts[1].target,1);assert.ok(Math.abs(result.impacts[1].point[0]-3)<1e-6);}
   f.cleanup();return result;};
  const baseline=run(false),quality=run(true);assert.deepEqual(quality.hits,baseline.hits);assert.deepEqual(quality.atContact,baseline.atContact);assert.deepEqual(quality.attached,baseline.attached);assert.equal(quality.active,baseline.active);
 }
});

test('sticky payloads fall from a removed target without introducing delayed hits through the presentation adapter',()=>{
 for(const element of elements){
  const run=(quality:boolean)=>{const f=fixture(quality),target=f.target(1,[0,1,-3]);f.ballistics.fire(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-1),spec('sticky',element,{speed:20,fuse:.5}),20);
   f.ballistics.update(.15);const before=f.trajectory('sticky');f.targets.length=0;target.root.removeFromParent();f.ballistics.update(.1);const falling=f.trajectory('sticky');assert.ok(falling[0].position[1]<before[0].position[1]);
   f.ballistics.update(.6);const result={hits:f.hits,falling,active:f.ballistics.activeCount};target.mesh.geometry.dispose();(target.mesh.material as THREE.Material).dispose();f.cleanup();return result;};
  const baseline=run(false),quality=run(true);assert.equal(baseline.hits.length,1);assert.deepEqual(quality,baseline);
 }
});

test('arc chains preserve exact hop order, endpoints and cover blocking for every element',()=>{
 for(const element of elements){
  const run=(quality:boolean)=>{const f=fixture(quality);f.target(1,[0,1,-4]);f.target(2,[3,1,-4]);f.target(3,[-3,1,-4]);f.cover([-1.5,1,-3.75],[.2,3,2]);
   f.ballistics.fire(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-1),spec('arc',element),20);
   const result={hits:f.hits,impacts:f.impacts.map(event=>({point:event.point.toArray(),normal:event.normal.toArray(),target:event.target?.userData.fixtureId}))};f.cleanup();return result;};
  const baseline=run(false),quality=run(true);assert.deepEqual(baseline.hits.map(hit=>hit.targetId),[1,2]);assert.deepEqual(quality.hits,baseline.hits);
  assert.deepEqual(quality.impacts.map(event=>event.target),[1,2]);quality.impacts.forEach((impact,index)=>{assert.deepEqual(impact.point,quality.hits[index].point);assert.ok(Math.abs(new THREE.Vector3(...impact.normal).length()-1)<1e-7);});
 }
});

test('rocket splash hits exposed targets and stays blocked by impact cover for every element',()=>{
 for(const element of elements){
  const run=(quality:boolean)=>{const f=fixture(quality);f.cover([0,1,-3],[2,3,.2]);f.target(1,[1.5,1,-2.4],[.8,.8,.8]);f.target(2,[0,1,-4],[.8,.8,.8]);
   f.ballistics.fire(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-1),spec('rocket',element,{speed:30,blastRadius:4}),20);f.ballistics.update(.2);const result={hits:f.hits,phases:f.impacts.map(event=>event.phase)};f.cleanup();return result;};
  const baseline=run(false),quality=run(true);assert.ok(baseline.hits.some(hit=>hit.targetId===1));assert.ok(baseline.hits.every(hit=>hit.targetId!==2));assert.deepEqual(quality.hits,baseline.hits);assert.deepEqual(quality.phases,['contact','detonate']);
 }
});

test('switching presentation never clears active shots or changes their eventual hit events',()=>{
 const baseline=fixture(false),mixed=fixture(false);for(const f of[baseline,mixed])f.target(1,[0,1,-8]);
 const recipe=spec('bullet','shock',{speed:20});
 baseline.ballistics.fire(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-1),recipe,10);
 mixed.ballistics.fire(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-1),recipe,10);
 mixed.ballistics.setPresentation(mixed.adapter);assert.equal(mixed.ballistics.activeCount,1);
 for(const f of[baseline,mixed])f.ballistics.fire(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-1),recipe,12);
 assert.equal(mixed.ballistics.activeCount,2);mixed.ballistics.setPresentation(undefined);assert.equal(mixed.ballistics.activeCount,2);
 for(const f of[baseline,mixed])f.ballistics.update(.5);
 assert.equal(baseline.hits.length,2);assert.deepEqual(mixed.hits,baseline.hits);assert.equal(mixed.ballistics.activeCount,0);baseline.cleanup();mixed.cleanup();
});

test('cluster bomblets retain the carrier presentation across live toggles before and after contact deployment',()=>{
 for(const qualityAtFire of[false,true]){
  const baseline=fixture(qualityAtFire),mixed=fixture(qualityAtFire);
  const recipe=spec('cluster','corrosive',{secondaryElement:'fire',split:{...createWeaponSpec('cluster','corrosive').split!,delay:.2}});
  for(const f of[baseline,mixed]){
   f.target(1,[0,1,-16],[4,4,1]);
   f.ballistics.fire(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-1),recipe,60,50,'tackwork');
   f.ballistics.update(.1);
   assert.equal(f.ballistics.activeCount,1,'the carrier must keep flying until physical contact');
  }
  mixed.ballistics.setPresentation(qualityAtFire?undefined:mixed.adapter);
  for(const f of[baseline,mixed])f.ballistics.update(.2);
  assert.equal(mixed.ballistics.activeCount,recipe.split!.count);
  assert.equal(mixed.scene.children.filter(root=>root.name===`${qualityAtFire?'quality':'player'}-projectile-cluster`).length,recipe.split!.count,'child factories stay bound to the carrier presenter');
  mixed.ballistics.setPresentation(qualityAtFire?mixed.adapter:undefined);
  for(let frame=0;frame<90;frame++)for(const f of[baseline,mixed])f.ballistics.update(1/60);
  assert.ok(baseline.hits.length>0,'the parent burst must actually hit the physical target');
  assert.deepEqual(mixed.hits,baseline.hits,'render switches preserve child collision, damage and dual-element recipes');
  assert.deepEqual(mixed.impacts.map(event=>({point:event.point.toArray(),phase:event.phase})),baseline.impacts.map(event=>({point:event.point.toArray(),phase:event.phase})));
  assert.equal(mixed.ballistics.activeCount,0);
  baseline.cleanup();mixed.cleanup();
 }
});

test('pause and invalid dt never advance physical shots, animate projectiles or emit impacts',()=>{
 const f=fixture(true);f.target(1,[0,1,-8]);f.ballistics.fire(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-1),spec('rocket','gravity',{speed:20}),30);
 const before=f.trajectory('rocket');for(const dt of[0,-1,NaN,Infinity])f.ballistics.update(dt);
 assert.deepEqual(f.trajectory('rocket'),before);assert.equal(f.impacts.length,0);assert.equal(f.hits.length,0);assert.equal(f.animationCalls,0);assert.equal(f.ballistics.activeCount,1);f.cleanup();
});
