import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CorrosiveStatus,corrosiveSources,corrosiveSurfaceOf,nearestCorrosiveSurface } from '../src/rendering/quality/corrosive/surfaces.ts';
import { CorrosiveResponse,CORROSIVE_AB_CAPACITY } from '../src/rendering/quality/corrosive/liquid.ts';
import { createCorrosiveReviewTarget } from '../src/rendering/quality/corrosive/reviewTargets.ts';
import { createEncounterEnemy } from '../src/rendering/encounterEnemy.ts';
import { ElementalPresentation } from '../src/rendering/quality/elementalPresentation.ts';
import { PlayerBallistics,type BallisticHit } from '../src/rendering/PlayerBallistics.ts';
import { createWeaponSpec,type ProjectileType } from '../src/core/arsenal.ts';
import { corrosiveABAudioRecipe } from '../src/audio/corrosiveAudio.ts';
import { elementalAudioRecipe,elementalEnvelope } from '../src/audio/elementalAudio.ts';

let originalDocument:PropertyDescriptor|undefined;
before(()=>{originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){}})})}});});
after(()=>{if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else Reflect.deleteProperty(globalThis,'document');});

function target(scene:THREE.Scene){const root=new THREE.Group();const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());mesh.userData.enemyId=7;mesh.userData.corrosiveSurface='armor';root.add(mesh);scene.add(root);return{root,mesh};}
const event=(root:THREE.Group)=>({target:root,point:new THREE.Vector3(0,0,.5),normal:new THREE.Vector3(0,0,1),spec:createWeaponSpec('sticky','corrosive','pilot'),phase:'detonate' as const,radius:2.5});
function rayHits(root:THREE.Group){root.updateWorldMatrix(true,true);return new THREE.Raycaster(new THREE.Vector3(0,1.6,6),new THREE.Vector3(0,0,-1)).intersectObject(root,true).filter(h=>h.object.userData.enemyId!==undefined).map(h=>({id:h.object.userData.enemyId,point:h.point.toArray(),distance:h.distance,critical:h.object.userData.critical}));}

test('material binding rejects adversarial tags inside every equipment slot and overlay subtree',()=>{
 const root=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());body.userData.corrosiveSurface='cloth';root.add(body);
 for(const slot of['weapon','shield','reactor','legs']){const owner=new THREE.Group();owner.userData.equipmentSlot=slot;const mesh=body.clone();owner.add(mesh);root.add(owner);assert.equal(corrosiveSurfaceOf(mesh),undefined);}
 const overlay=body.clone();overlay.userData.comicOverlay=true;root.add(overlay);
 assert.deepEqual(corrosiveSources(root),[body]);assert.equal(corrosiveSurfaceOf(body),'cloth');
 const gear=new THREE.Group();gear.userData.equipmentSlot='weapon';gear.add(root);assert.deepEqual(corrosiveSources(root),[]);
});
test('skin, cloth and armor are selected by actual nearest struck surface',()=>{
 const root=new THREE.Group();for(const[type,x]of[['skin',-2],['cloth',0],['armor',2]]as const){const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());mesh.position.x=x;mesh.userData.corrosiveSurface=type;root.add(mesh);}
 for(const[type,x]of[['skin',-2],['cloth',0],['armor',2]]as const)assert.equal(nearestCorrosiveSurface(root,new THREE.Vector3(x,0,.5)).surface,type);
 assert.equal(nearestCorrosiveSurface(undefined,new THREE.Vector3()).surface,'ground');
});
test('collision points beneath armor project to the visible outer shell without modifying combat meshes',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
 const cloth=new THREE.Mesh(new THREE.BoxGeometry(1,1,.2),new THREE.MeshBasicMaterial());cloth.userData.corrosiveSurface='cloth';root.add(cloth);
 const plate=new THREE.Mesh(new THREE.BoxGeometry(1,1,.1),new THREE.MeshBasicMaterial());plate.position.z=.30;plate.userData.corrosiveSurface='armor';plate.raycast=()=>{};root.add(plate);
 const point=new THREE.Vector3(0,0,.12),normal=new THREE.Vector3(0,0,1),originalRaycast=plate.raycast,originalMaterial=plate.material;
 for(const angle of[0,.63]){root.rotation.y=angle;root.scale.set(1.3,.9,1.1);root.updateWorldMatrix(true,true);const world=point.clone().applyMatrix4(root.matrixWorld),direction=normal.clone().transformDirection(root.matrixWorld),resolved=nearestCorrosiveSurface(root,world,direction);
  assert.equal(resolved.source,plate);assert.equal(resolved.surface,'armor');assert.ok(resolved.point.distanceTo(new THREE.Vector3(0,0,.35).applyMatrix4(root.matrixWorld))<1e-6);assert.equal(plate.raycast,originalRaycast);assert.equal(plate.material,originalMaterial);
 }
 root.rotation.y=0;root.scale.setScalar(1);root.updateWorldMatrix(true,true);const response=new CorrosiveResponse(scene);response.impact({...event(root),point});response.update(.016);assert.equal(response.events[0].surface,'armor');assert.ok(response.events[0].point[2]>.34);
 const bubbles=response.group.getObjectByName('corrosive-ab-bubbles') as THREE.InstancedMesh,m=new THREE.Matrix4();for(let i=0;i<bubbles.count;i++){bubbles.getMatrixAt(i,m);assert.ok(new THREE.Vector3().setFromMatrixPosition(m).z>.35,'bubbles must sit outside the plate');}response.dispose();
});
test('human and armored human remain collision-equivalent with intact owned meshes',()=>{
 for(const armored of[false,true]){const visual=createEncounterEnemy(14,'rusher'),before=rayHits(visual.group),matrices=new Map<THREE.Object3D,number[]>();visual.group.traverse(o=>{if(o.userData.enemyId===14)matrices.set(o,o.matrix.toArray());});const display=createCorrosiveReviewTarget(visual.group,14,armored);
  assert.deepEqual(rayHits(visual.group),before);assert.ok(display.group.getObjectByName('human-intact-face'));assert.ok(corrosiveSources(visual.group).some(m=>corrosiveSurfaceOf(m)==='skin'));assert.ok(corrosiveSources(visual.group).some(m=>corrosiveSurfaceOf(m)==='cloth'));
  assert.equal(corrosiveSources(visual.group).some(m=>corrosiveSurfaceOf(m)==='armor'),armored);for(const[o,m]of matrices)assert.deepEqual(o.matrix.toArray(),m);display.dispose();assert.deepEqual(rayHits(visual.group),before);visual.dispose();
 }
});
test('surface overlays borrow geometry without changing substrate or ray hits; disposal is idempotent',()=>{
 const scene=new THREE.Scene(),{root,mesh}=target(scene),geometry=mesh.geometry,material=mesh.material,before=mesh.userData;let released=0;geometry.addEventListener('dispose',()=>released++);
 const status=new CorrosiveStatus(root);status.contact(new THREE.Vector3(0,0,.5));status.update(.016,2);assert.equal(status.bindings[0].mesh.geometry,geometry);assert.equal(mesh.material,material);assert.equal(mesh.userData,before);assert.equal(status.bindings[0].mesh.userData.enemyId,undefined);
 const time=status.bindings[0].material.uniforms.time.value;status.update(0,200);status.update(NaN,200);assert.equal(status.bindings[0].material.uniforms.time.value,time);status.setIntensity(0);status.update(.016,3);assert.equal(status.bindings[0].material.uniforms.presence.value,0);status.dispose();status.dispose();assert.equal(released,0);assert.equal(mesh.material,material);
});
test('corrosive input is immutable and burst/particle budgets stay bounded during sustained impact',()=>{
 const scene=new THREE.Scene(),{root}=target(scene),response=new CorrosiveResponse(scene),contact=event(root),before=JSON.stringify(contact.spec),point=contact.point.toArray(),normal=contact.normal.toArray();Object.freeze(contact.spec);
 for(let i=0;i<500;i++)response.impact(contact);const d=response.diagnostics;assert.equal(d.bursts,CORROSIVE_AB_CAPACITY.bursts);assert.equal(d.drops,CORROSIVE_AB_CAPACITY.drops);assert.ok(d.bubbles<=CORROSIVE_AB_CAPACITY.bubbles);assert.ok(d.residue<=CORROSIVE_AB_CAPACITY.residue);assert.equal(response.events.length,128);assert.deepEqual(contact.point.toArray(),point);assert.deepEqual(contact.normal.toArray(),normal);assert.equal(JSON.stringify(contact.spec),before);
 for(let i=0;i<40;i++)response.update(.1);assert.equal(response.diagnostics.bursts,0);assert.equal(response.diagnostics.drops,0);response.clear();assert.deepEqual(response.diagnostics,{bursts:0,drops:0,bubbles:0,residue:0,statuses:0});response.dispose();response.dispose();
});
test('invalid contact and paused updates cannot create NaNs or move live particles',()=>{
 const scene=new THREE.Scene(),{root}=target(scene),response=new CorrosiveResponse(scene);response.impact({...event(root),point:new THREE.Vector3(NaN,0,0)});assert.equal(response.events.length,0);response.impact({...event(root),normal:new THREE.Vector3(NaN,0,0)});response.update(.016);
 const pools=response.group.children.filter((o):o is THREE.InstancedMesh=>o instanceof THREE.InstancedMesh),before=pools.map(m=>Array.from(m.instanceMatrix.array));response.update(0);response.update(NaN);assert.deepEqual(pools.map(m=>Array.from(m.instanceMatrix.array)),before);for(const array of before)assert.ok(array.every(Number.isFinite));response.dispose();
});
test('unaffected and fully faded surfaces submit no overlay draw',()=>{
 const scene=new THREE.Scene(),{root}=target(scene),far=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());far.position.x=20;far.userData.corrosiveSurface='skin';root.add(far);const status=new CorrosiveStatus(root);assert.ok(status.bindings.every(b=>!b.mesh.visible));status.contact(new THREE.Vector3(0,0,.5),.3);assert.equal(status.bindings.find(b=>b.source===far)!.mesh.visible,false);assert.equal(status.bindings[0].mesh.visible,true);status.setIntensity(0);status.update(.016);assert.ok(status.bindings.every(b=>!b.mesh.visible));status.dispose();
});
test('attached bubbles follow translated and rotated armor, then disappear with a removed source',()=>{
 const scene=new THREE.Scene(),{root,mesh}=target(scene),response=new CorrosiveResponse(scene);response.impact(event(root));response.update(.016);const pool=response.group.getObjectByName('corrosive-ab-bubbles') as THREE.InstancedMesh,matrix=new THREE.Matrix4();pool.getMatrixAt(0,matrix);const before=new THREE.Vector3().setFromMatrixPosition(matrix);root.position.x=4;root.rotation.y=Math.PI/2;response.update(.016);pool.getMatrixAt(0,matrix);const after=new THREE.Vector3().setFromMatrixPosition(matrix);assert.ok(after.x-before.x>3.8);mesh.removeFromParent();response.update(.016);assert.equal(pool.count,0);response.dispose();
});
for(const projectile of['bullet','slug','spike','ricochet','homing','sticky','orb','beam','scatter','rocket','disc','arc','cluster']as ProjectileType[])test(`A+B preserves exact ${projectile} hits, trajectory, damage, fuse and frozen recipes`,()=>{
 function run(after:boolean){const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),{root}=target(scene),hits:unknown[]=[],positions:unknown[]=[];root.position.z=-6;const layer=new ElementalPresentation(scene,camera,{corrosiveAB:after}),ballistics=new PlayerBallistics(scene,{targets:()=>[{id:7,root,radius:1}],occluders:()=>[],hit:(hit:BallisticHit)=>hits.push({point:hit.point.toArray(),direction:hit.direction.toArray(),damage:hit.damage,critical:hit.critical,spec:{...hit.spec}})});ballistics.setPresentation(layer);const spec=createWeaponSpec(projectile,'corrosive','pilot');spec.secondaryElement='fire';const before=JSON.stringify(spec);ballistics.fire(new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,-1),spec,20,50);for(let i=0;i<360;i++){ballistics.update(1/120);layer.update(1/120,i/120,false,spec,'pilot');positions.push(scene.children.filter(o=>o.name.startsWith('quality-projectile-')).map(o=>({p:o.position.toArray(),q:o.quaternion.toArray()})));}assert.equal(JSON.stringify(spec),before);ballistics.clear();layer.dispose();return{hits,positions};}
 assert.deepEqual(run(true),run(false));
});
test('A+B audio changes only corrosive response events and keeps silent envelope endpoints',()=>{
 for(const element of['fire','ice','shock','gravity','radiation','adhesive']as const)for(const event of['shot','impact','status']as const)assert.deepEqual(corrosiveABAudioRecipe(element,event),elementalAudioRecipe(element,event));
 for(const event of['impact','status','release']as const){const voices=corrosiveABAudioRecipe('corrosive',event,{surface:'cloth',delivery:'sticky'});assert.ok(voices.length>0&&voices.length<=12);for(const v of voices){assert.ok(v.duration>0&&v.duration<1);assert.equal(elementalEnvelope(0,v),0);assert.equal(elementalEnvelope(v.duration,v),0);assert.ok([v.frequency,v.endFrequency,v.gain,v.delay].every(Number.isFinite));}}
 assert.notDeepEqual(corrosiveABAudioRecipe('corrosive','impact',{surface:'armor'}),corrosiveABAudioRecipe('corrosive','impact',{surface:'skin'}));
});
