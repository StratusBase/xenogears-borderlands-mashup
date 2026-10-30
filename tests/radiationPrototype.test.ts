import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {RadiationResponse,RADIATION_CAPACITY} from '../src/rendering/quality/radiation/response.ts';
import {RadiationPresentation} from '../src/rendering/quality/radiation/presentation.ts';
import {createHumanReviewTarget} from '../src/dev/effects/shared/reviewTargets.ts';
import {RadiationEquipment} from '../src/rendering/quality/radiation/equipment.ts';
import {radiationSizing} from '../src/rendering/quality/radiation/sizing.ts';
import {radiationLobe} from '../src/rendering/quality/radiation/materials.ts';
import {ElementalPresentation} from '../src/rendering/quality/elementalPresentation.ts';
import {PlayerBallistics} from '../src/rendering/PlayerBallistics.ts';
import {createWeaponSpec,type ProjectileType} from '../src/core/arsenal.ts';
import {createProgression} from '../src/core/index.ts';
import {resolveEquipmentAppearance} from '../src/core/appearance.ts';
import {applyStatus,advanceStatuses,createStatusState,getStatusModifiers} from '../src/core/statusEffects.ts';
import {radiationFalloutAudioRecipe} from '../src/audio/radiationAudio.ts';
import {elementalAudioRecipe,elementalEnvelope} from '../src/audio/elementalAudio.ts';

function target(scene:THREE.Scene){const root=new THREE.Group(),cloth=new THREE.Mesh(new THREE.BoxGeometry(1,1,.2),new THREE.MeshBasicMaterial());cloth.userData.effectSurface='cloth';cloth.userData.enemyId=7;root.add(cloth);const armor=new THREE.Mesh(new THREE.BoxGeometry(1,1,.12),new THREE.MeshBasicMaterial());armor.position.z=.28;armor.userData.effectSurface='armor';armor.raycast=()=>{};root.add(armor);scene.add(root);return{root,cloth,armor};}
function event(root?:THREE.Group){return{target:root,point:new THREE.Vector3(0,0,.11),normal:new THREE.Vector3(0,0,1),spec:createWeaponSpec('sticky','radiation','pilot'),phase:'detonate' as const,radius:2.5,energy:70};}
function matrices(r:RadiationResponse){return r.group.children.filter((o):o is THREE.InstancedMesh=>o instanceof THREE.InstancedMesh).map(o=>Array.from(o.instanceMatrix.array));}
test('radiation deposits only on visible outer material and borrows source geometry without changing slots',()=>{
 const scene=new THREE.Scene(),{root,cloth,armor}=target(scene),geometry=armor.geometry,material=armor.material,ray=armor.raycast;
 for(const slot of ['weapon','shield','reactor','legs']){const owner=new THREE.Group();owner.userData.equipmentSlot=slot;const copy=armor.clone();owner.add(copy);root.add(owner);}
 const r=new RadiationResponse(scene,new THREE.PerspectiveCamera());r.impact(event(root));const status=r.status(root);status.update(.1);assert.equal(r.events[0].surface,'armor');assert.ok(r.events[0].point[2]>.33);assert.equal(status.bindings.length,1);assert.equal(status.bindings[0].source,armor);assert.equal(status.bindings[0].mesh.geometry,geometry);assert.equal(armor.material,material);assert.equal(armor.raycast,ray);assert.equal(cloth.children.length,0);
 let disposed=0;geometry.addEventListener('dispose',()=>disposed++);r.dispose();assert.equal(disposed,0);assert.equal(armor.material,material);assert.equal(status.bindings.length,0);
});
test('radiation flash hands off to three unequal advecting lobes; paused clocks remain frozen and resources bounded',()=>{
 const scene=new THREE.Scene(),{root}=target(scene),r=new RadiationResponse(scene,new THREE.PerspectiveCamera());r.impact(event(root));const initial=matrices(r);r.update(.055);assert.notDeepEqual(matrices(r),initial);const sampled=matrices(r);r.update(0);r.update(NaN);assert.deepEqual(matrices(r),sampled);assert.ok(sampled.flat().every(Number.isFinite));
 assert.notDeepEqual(radiationLobe(.2,.3,0),radiationLobe(.2,.3,1));assert.ok(radiationLobe(.09,.3,0).growth>0&&radiationLobe(.09,.3,2).growth===0);
 r.update(.08);assert.ok(r.diagnostics.rays===0);assert.equal(r.diagnostics.clouds,3);
 for(let i=0;i<250;i++)r.impact(event(root));assert.equal(r.diagnostics.clouds,RADIATION_CAPACITY.clouds);assert.equal(r.diagnostics.grains,RADIATION_CAPACITY.grains);assert.equal(r.events.length,RADIATION_CAPACITY.events);
 for(let i=0;i<35;i++)r.update(.1);assert.equal(r.diagnostics.clouds,0);assert.equal(r.diagnostics.grains,0);r.clear();assert.deepEqual(r.diagnostics,{rays:0,clouds:0,grains:0,stars:0,residues:0,bindings:0});r.dispose();r.dispose();
});
test('radiation secondaries follow exposure, energy and channel falloff without a second flash or cloud',()=>{
 const input={delivery:'sticky' as const,phase:'detonate' as const,radius:2.5,energy:70},direct=radiationSizing(input),near=radiationSizing({...input,secondary:true,exposure:.7}),edge=radiationSizing({...input,secondary:true,exposure:.12,energy:12});
 assert.ok(direct.rays>=6&&direct.lobes===3);for(const x of[near,edge]){assert.equal(x.reach,0);assert.equal(x.lobes,0);assert.equal(x.rays,0);}assert.ok(edge.deposit<near.deposit&&near.deposit<direct.deposit);assert.ok(edge.grains<near.grains);assert.ok(radiationSizing({...input,channel:.62}).reach<direct.reach);
 const scene=new THREE.Scene(),{root}=target(scene),r=new RadiationResponse(scene,new THREE.PerspectiveCamera());r.splash({...event(root),target:root,primary:false,origin:new THREE.Vector3(),exposure:.2});assert.equal(r.diagnostics.rays,0);assert.equal(r.diagnostics.clouds,0);assert.ok(r.diagnostics.grains>0);r.dispose();for(const energy of[0,-1])assert.equal(radiationSizing({...input,energy}).strength,0);
});
test('radiation residue follows moving/nonuniform source poses and raised/sloped/underside contacts keep actual support',()=>{
 for(const angle of[0,.55,Math.PI]){const scene=new THREE.Scene(),mesh=new THREE.Mesh(new THREE.BoxGeometry(3,.3,3),new THREE.MeshBasicMaterial());mesh.position.set(0,2,0);mesh.rotation.x=angle;scene.add(mesh);mesh.updateWorldMatrix(true,false);const at=mesh.localToWorld(new THREE.Vector3(0,.15,0)),normal=new THREE.Vector3(0,1,0).transformDirection(mesh.matrixWorld),r=new RadiationResponse(scene,new THREE.PerspectiveCamera());r.impact({...event(),point:at.clone().addScaledVector(normal,.025),normal,hitSurface:mesh});assert.ok(new THREE.Vector3().fromArray(r.events[0].point).distanceTo(at)<1e-5);assert.ok(new THREE.Vector3().fromArray(r.events[0].normal).dot(normal)>.999);const stars=r.group.getObjectByName('radiation-stars')as THREE.InstancedMesh,matrix=new THREE.Matrix4();stars.getMatrixAt(0,matrix);for(const v of[[-1,-1],[-1,1],[1,-1],[1,1]])assert.ok(new THREE.Vector3(v[0],v[1],0).applyMatrix4(matrix).sub(at).dot(normal)>.010,'contact star stays wholly above its real support');r.dispose();}
 const scene=new THREE.Scene(),{root,armor}=target(scene),r=new RadiationResponse(scene,new THREE.PerspectiveCamera());r.impact(event(root));const status=r.status(root),binding=status.bindings[0],before=binding.world[0].clone();root.position.x=4;root.rotation.y=.6;root.scale.set(1.3,.7,1.5);status.update(.1);assert.ok(binding.world[0].x>3);assert.notDeepEqual(binding.world[0].toArray(),before.toArray());assert.ok(binding.world[0].w>0);status.setIntensity(0);assert.equal(binding.material.uniforms.presence.value,0);r.release(root);assert.equal(r.diagnostics.residues,0);r.dispose();
});
test('radiation equipment remains confined to the weapon slot, including spoofed tags under other slots',()=>{
 const root=new THREE.Group();root.userData.visualOwner='body';const weapon=new THREE.Group();weapon.userData.equipmentSlot='weapon';const receiver=new THREE.Mesh(new THREE.BoxGeometry(.3,.2,.5),new THREE.MeshBasicMaterial());receiver.name='element-chamber-0';receiver.userData.equipmentElementSurface='radiation';weapon.add(receiver);root.add(weapon);
 const wrong=new THREE.Group();wrong.userData.equipmentSlot='legs';const spoof=new THREE.Group();spoof.userData.visualOwner='weapon';const wrongReceiver=receiver.clone();spoof.add(wrongReceiver);wrong.add(spoof);root.add(wrong);
 const appearance={...resolveEquipmentAppearance(createProgression(),'pilot').weapon,element:'radiation' as const},pose=receiver.matrix.clone(),material=receiver.material,visual=new RadiationEquipment(root,appearance);assert.equal(visual.groups.length,1);assert.equal(visual.groups[0].parent,receiver);assert.equal(wrongReceiver.children.length,0);assert.deepEqual(receiver.matrix,pose);assert.equal(receiver.material,material);visual.dispose();assert.equal(receiver.children.length,0);
});
test('radiation pulse presents one primary release and only explicit recipients without mutating authoritative inputs',()=>{
 const scene=new THREE.Scene(),{root}=target(scene),r=new RadiationResponse(scene,new THREE.PerspectiveCamera()),spec=Object.freeze(createWeaponSpec('bullet','radiation','pilot')),point=new THREE.Vector3(0,1.5,0),prior=point.toArray();r.deathPulse({point,spec,energy:18,radius:5,recipients:[{target:root,point:new THREE.Vector3(0,0,.34),normal:new THREE.Vector3(0,0,1),exposure:1}]});assert.equal(r.events.filter(e=>e.role==='pulse').length,1);assert.equal(r.events.filter(e=>e.role==='splash').length,1);assert.equal(r.events[1].lobes,0);assert.deepEqual(point.toArray(),prior);assert.equal(spec.projectile,'bullet');r.dispose();
});
for(const delivery of ['bullet','slug','spike','ricochet','homing','sticky','orb','beam','scatter','rocket','disc','arc','cluster']as ProjectileType[])test(`radiation A+B preserves complete ${delivery} hits, trajectories and status state`,()=>{
 function replay(after:boolean){const scene=new THREE.Scene(),{root,armor}=target(scene);armor.removeFromParent();root.position.z=-6;const layer=after?new RadiationPresentation(scene,new THREE.PerspectiveCamera()):new ElementalPresentation(scene,new THREE.PerspectiveCamera(),{corrosiveAB:true}),hits:unknown[]=[],positions:unknown[]=[],statuses:unknown[]=[],state=createStatusState();let time=0;
  const engine=new PlayerBallistics(scene,{targets:()=>[{id:7,root,radius:1}],occluders:()=>[],hit:hit=>{hits.push({point:hit.point.toArray(),direction:hit.direction.toArray(),damage:hit.damage,critical:hit.critical,spec:{...hit.spec}});applyStatus(state,'radiation',time,20);layer.status(root,'radiation');}});engine.setPresentation(layer);const spec=createWeaponSpec(delivery,'radiation','pilot');spec.secondaryElement='corrosive';const before=JSON.stringify(spec);Object.freeze(spec);
  for(let i=0;i<600;i++){time=i/120;if([0,42,85].includes(i))engine.fire(new THREE.Vector3(),new THREE.Vector3(0,0,-1),spec,20,50);engine.update(1/120);advanceStatuses(state,time);layer.update(1/120,time,false,spec,'pilot');statuses.push({state:structuredClone(state),modifiers:getStatusModifiers(state,time)});positions.push(scene.children.filter(o=>o.name.startsWith('quality-projectile-')).map(o=>({p:o.position.toArray(),q:o.quaternion.toArray()})));}
  assert.equal(JSON.stringify(spec),before);engine.clear();layer.dispose();return{hits,positions,statuses};
 }assert.deepEqual(replay(true),replay(false));
});
test('radiation sound is bounded and unrelated recipes remain identical',()=>{
 for(const element of ['fire','ice','corrosive','shock','gravity','adhesive']as const)for(const e of['shot','impact','status']as const)assert.deepEqual(radiationFalloutAudioRecipe(element,e),elementalAudioRecipe(element,e));
 for(const e of['equipment','shot','flight','impact','status','release']as const)for(const delivery of['bullet','sticky']as const)for(const surface of['cloth','armor']as const){const voices=radiationFalloutAudioRecipe('radiation',e,{delivery,surface});assert.ok(voices.length>0&&voices.length<=8);for(const v of voices){assert.ok(v.duration>0&&v.duration<.5);assert.equal(elementalEnvelope(0,v),0);assert.equal(elementalEnvelope(v.duration,v),0);assert.ok([v.frequency,v.endFrequency,v.gain].every(Number.isFinite));}}
});

test('radiation merges simultaneous scatter contacts for art only and keeps varied primary releases',()=>{
 const scene=new THREE.Scene(),{root}=target(scene),r=new RadiationResponse(scene,new THREE.PerspectiveCamera()),spec=createWeaponSpec('scatter','radiation','pilot');
 for(let i=0;i<8;i++)r.impact({...event(root),spec,phase:'contact',energy:6});assert.equal(r.events.length,1);assert.equal(r.diagnostics.clouds,3);assert.equal(r.events[0].energy,48);assert.equal(r.lastImpactMerged,true);assert.ok(r.diagnostics.grains>12);
 r.update(.05);r.impact({...event(root),spec,phase:'contact',energy:6});assert.equal(r.events.length,2);assert.equal(r.diagnostics.clouds,6);
 r.clear();r.impact(event(root));r.update(.2);const a=matrices(r);r.update(1);r.impact(event(root));r.update(.2);assert.notDeepEqual(matrices(r),a);r.dispose();
});

test('a rocket contact and immediate detonation produce only one radiation bloom and cue opportunity',()=>{
 const scene=new THREE.Scene(),{root}=target(scene),r=new RadiationResponse(scene,new THREE.PerspectiveCamera(),37391),spec=createWeaponSpec('rocket','radiation','pilot');assert.ok(spec.blastRadius>0);
 assert.equal(r.impact({...event(root),spec,phase:'contact'}),undefined);assert.equal(r.events.length,0);assert.equal(r.diagnostics.clouds,0);
 assert.equal(r.impact({...event(root),spec,phase:'detonate'}),'armor');assert.equal(r.events.length,1);assert.equal(r.diagnostics.clouds,3);
 r.splash({...event(root),spec,target:root,primary:false,origin:new THREE.Vector3(),exposure:.3});assert.equal(r.events[1].lobes,0);assert.equal(r.diagnostics.clouds,3);
 const nonExplosive={...spec,blastRadius:0};assert.equal(r.impact({...event(root),spec:nonExplosive,phase:'contact'}),'armor');r.dispose();
});
test('radiation keeps a visible core through release and finite late scintillation beyond the old smoke lifetime',()=>{
 const scene=new THREE.Scene(),{root}=target(scene),r=new RadiationResponse(scene,new THREE.PerspectiveCamera(),37391);r.impact(event(root));r.update(.1);r.update(.083);assert.ok(r.diagnostics.stars>0);assert.ok(r.diagnostics.clouds>0);
 for(let i=0;i<10;i++)r.update(.1);assert.ok(r.diagnostics.clouds>0);const frozen=matrices(r);r.update(0);assert.deepEqual(matrices(r),frozen);
 for(let i=0;i<10;i++)r.update(.1);assert.equal(r.diagnostics.clouds,0);assert.equal(r.diagnostics.stars,0);r.dispose();
});

test('radiation spreads a localized armor mark from a narrow rib onto its adjacent outer plate, never the shirt underneath',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);const look=createHumanReviewTarget(root,7,true),r=new RadiationResponse(scene,new THREE.PerspectiveCamera(),37391);
 r.impact({...event(root),point:new THREE.Vector3(0,1.63,.30)});const visual=r.status(root);assert.ok(visual.bindings.some(b=>b.source.name==='breastplate-central-rib'));assert.ok(visual.bindings.some(b=>b.source.name==='human-intact-breastplate'));assert.ok(visual.bindings.every(b=>b.source.userData.effectSurface==='armor'));assert.ok(visual.bindings.length<=4);r.dispose();look.dispose();
});
test('radiation secondary sound opportunities are bounded and zero-strength recipients stay silent',()=>{
 const scene=new THREE.Scene(),{root}=target(scene),r=new RadiationResponse(scene,new THREE.PerspectiveCamera()),e={...event(root),target:root,primary:false,origin:new THREE.Vector3(),exposure:.4};let audible=0;
 for(let i=0;i<12;i++){r.splash(e);audible+=Number(r.lastSplashAudible);}assert.equal(audible,3);r.update(.016);r.splash({...e,exposure:0});assert.equal(r.lastSplashAudible,false);r.splash(e);assert.equal(r.lastSplashAudible,true);r.dispose();
});

test('radiation routes the existing corrosive channel with its original secondary sizing',()=>{
 const scene=new THREE.Scene(),{root}=target(scene),camera=new THREE.PerspectiveCamera(),baseline=new ElementalPresentation(scene,camera,{corrosiveAB:true}),current=new RadiationPresentation(scene,camera),spec={...createWeaponSpec('sticky','radiation','pilot'),secondaryElement:'corrosive' as const},e={...event(root),spec};
 baseline.impact(e);current.impact(e);assert.equal(current.corrosive!.events[0].size,baseline.corrosive!.events[0].size);assert.equal(current.corrosive!.events[0].dropCount,baseline.corrosive!.events[0].dropCount);baseline.dispose();current.dispose();
});

test('a later material hit remains represented after an armor footprint fills the binding budget',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);const look=createHumanReviewTarget(root,7,true),r=new RadiationResponse(scene,new THREE.PerspectiveCamera());r.impact({...event(root),point:new THREE.Vector3(0,1.63,.30)});const visual=r.status(root),sleeve=root.getObjectByName('human-shirt-sleeve')as THREE.Mesh,material=sleeve.material,geometry=sleeve.geometry;
 visual.update(.1);visual.contact(new THREE.Vector3(-.50,1.44,.13),.15,sleeve,new THREE.Vector3(0,0,1));assert.ok(visual.bindings.some(b=>b.source===sleeve));assert.ok(visual.bindings.length<=4);assert.equal(sleeve.material,material);assert.equal(sleeve.geometry,geometry);r.dispose();look.dispose();
});
