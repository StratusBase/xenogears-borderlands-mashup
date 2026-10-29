import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createWeaponSpec, type ElementType } from '../src/core/arsenal.ts';
import type { BallisticPresentationImpact } from '../src/rendering/PlayerBallistics.ts';
import { ElementalImpacts, ELEMENTAL_IMPACT_CAPACITY } from '../src/rendering/quality/elementalImpacts.ts';
import { ElementalPresentation } from '../src/rendering/quality/elementalPresentation.ts';

const elements:ElementType[]=['kinetic','fire','ice','corrosive','shock','radiation','gravity','adhesive'];
const normalAxis=new THREE.Vector3(0,0,1);
function event(element:ElementType,options:Partial<BallisticPresentationImpact>={}):BallisticPresentationImpact{
 return{point:new THREE.Vector3(2,1,-3),normal:normalAxis.clone(),spec:createWeaponSpec('bullet',element),radius:.3,phase:'contact',...options};
}
function pools(impacts:ElementalImpacts):THREE.InstancedMesh[]{return impacts.group.children as THREE.InstancedMesh[];}
function pool(impacts:ElementalImpacts,kind:string):THREE.InstancedMesh{return impacts.group.getObjectByName(`elemental-${kind}-pool`) as THREE.InstancedMesh;}
function matrix(mesh:THREE.InstancedMesh,index=0):THREE.Matrix4{const value=new THREE.Matrix4();mesh.getMatrixAt(index,value);return value;}
function position(mesh:THREE.InstancedMesh,index=0):THREE.Vector3{return new THREE.Vector3().setFromMatrixPosition(matrix(mesh,index));}
function orientation(mesh:THREE.InstancedMesh,index=0):THREE.Quaternion{const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();matrix(mesh,index).decompose(p,q,s);return q;}
function snapshot(impacts:ElementalImpacts){return pools(impacts).map(mesh=>({name:mesh.name,count:mesh.count,visible:mesh.visible,matrices:Array.from(mesh.instanceMatrix.array).slice(0,mesh.count*16),alpha:Array.from(mesh.geometry.getAttribute('fxAlpha').array).slice(0,mesh.count)}));}
function near(actual:THREE.Vector3,expected:THREE.Vector3,message=''){assert.ok(actual.distanceTo(expected)<2e-5,`${message}: actual ${actual.toArray()}, expected ${expected.toArray()}`);}
function target(scene:THREE.Scene,id:number,at:[number,number,number]){
 const root=new THREE.Group();root.position.set(...at);const geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshBasicMaterial();
 const mesh=new THREE.Mesh(geometry,material);mesh.userData.enemyId=id;root.add(mesh);scene.add(root);return{root,mesh,geometry,material};
}
function cleanupTarget(value:ReturnType<typeof target>){value.geometry.dispose();value.material.dispose();value.root.removeFromParent();}

// Particle count/shape/motion identities are checked independently of their tint.
test('all eight contacts have distinct particle-kind composition and temporal shape signatures',()=>{
 const compositions=new Set<string>(),signatures=new Set<string>();
 for(const element of elements){const scene=new THREE.Scene(),impacts=new ElementalImpacts(scene);impacts.impact(event(element));impacts.update(.1);
  const composition=pools(impacts).filter(mesh=>mesh.count).map(mesh=>[mesh.name,mesh.count]);compositions.add(JSON.stringify(composition));
  const start=snapshot(impacts);impacts.update(.1);signatures.add(JSON.stringify([composition,start,snapshot(impacts)]));
  assert.ok(impacts.activeCount>0);impacts.dispose();assert.equal(scene.children.length,0);
 }
 assert.equal(compositions.size,elements.length,'Element identity should have an authored particle structure, not merely a different hue');
 assert.equal(signatures.size,elements.length);
});

test('surface patches orient to horizontal, vertical and oblique authoritative normals',()=>{
 const scene=new THREE.Scene(),impacts=new ElementalImpacts(scene);
 for(const normal of[new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(-1,0,0),new THREE.Vector3(.3,.7,-.2).normalize()]){
  impacts.clear();const contact=event('corrosive',{normal});impacts.impact(contact);const patch=pool(impacts,'patch');assert.equal(patch.count,1);
  near(position(patch),contact.point.clone().addScaledVector(normal,.018),'contact offset');
  near(normalAxis.clone().applyQuaternion(orientation(patch)),normal,'surface normal');
 }
 impacts.dispose();
});

test('splats follow moved and rotated targets, including nested nonuniform transforms',()=>{
 const scene=new THREE.Scene(),carrier=new THREE.Group();carrier.position.set(3,.5,-1);carrier.rotation.set(.2,.4,-.15);carrier.scale.set(1.2,.8,1.1);scene.add(carrier);
 const value=target(scene,11,[1,2,-3]);carrier.add(value.root);value.root.rotation.set(-.1,.7,.2);value.root.scale.set(1.4,.65,1.2);scene.updateMatrixWorld(true);
 const localPoint=new THREE.Vector3(.12,.18,.5),worldPoint=value.root.localToWorld(localPoint.clone());
 const surfaceNormal=normalAxis.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(value.root.matrixWorld)).normalize();
 const impacts=new ElementalImpacts(scene);impacts.impact(event('corrosive',{point:worldPoint,normal:surfaceNormal,target:value.root}));
 const anchor=value.root.worldToLocal(worldPoint.clone().addScaledVector(surfaceNormal,.018));
 value.root.position.set(-2,1,-4);value.root.rotation.set(.4,-.8,.1);carrier.rotation.z=.35;scene.updateMatrixWorld(true);impacts.update(.04);
 near(position(pool(impacts,'patch')),anchor.clone().applyMatrix4(value.root.matrixWorld),'attached world point');
 const expectedNormal=normalAxis.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(value.root.matrixWorld)).normalize();
 near(normalAxis.clone().applyQuaternion(orientation(pool(impacts,'patch'))),expectedNormal,'transformed skin normal');
 impacts.dispose();cleanupTarget(value);carrier.removeFromParent();
});

test('adhesive threads stay attached to moving targets while their stretch remains presentation-only',()=>{
 const scene=new THREE.Scene(),value=target(scene,12,[1,1,-3]),impacts=new ElementalImpacts(scene);
 impacts.impact(event('adhesive',{point:new THREE.Vector3(1,1,-2.5),target:value.root}));const strand=pool(impacts,'strand');assert.equal(strand.count,4);
 const before=Array.from({length:strand.count},(_,i)=>position(strand,i));const rootBefore=value.root.matrixWorld.clone();
 value.root.position.x+=3;value.root.rotation.y=.65;scene.updateMatrixWorld(true);impacts.update(.04);
 for(let i=0;i<strand.count;i++)near(position(strand,i),before[i].clone().applyMatrix4(rootBefore.clone().invert()).applyMatrix4(value.root.matrixWorld),'thread attachment');
 impacts.dispose();cleanupTarget(value);
});

test('spark streaks align their actual long axis to emitted travel direction',()=>{
 const scene=new THREE.Scene(),impacts=new ElementalImpacts(scene);impacts.impact(event('shock'));
 const particlePools=(impacts as unknown as {pools:Map<string,{items:{active:boolean;velocity:THREE.Vector3;rotation:THREE.Quaternion}[]}>}).pools;
 for(const particle of particlePools.get('spark')!.items.filter(value=>value.active)){
  near(normalAxis.clone().applyQuaternion(particle.rotation),particle.velocity.clone().normalize(),'spark axis');
 }
 impacts.dispose();
});

test('sustained dual-element contact and detonation share seven bounded, collision-inert pools',()=>{
 const scene=new THREE.Scene(),impacts=new ElementalImpacts(scene);const resources=[...pools(impacts)];
 for(let i=0;i<320;i++)impacts.impact(event(elements[i%elements.length],{spec:{...createWeaponSpec(i%2?'sticky':'rocket',elements[i%elements.length]),secondaryElement:elements[(i+3)%elements.length]},phase:i%3?'contact':'detonate',radius:6}));
 const limit=Object.values(ELEMENTAL_IMPACT_CAPACITY).reduce((sum,n)=>sum+n,0);assert.ok(impacts.activeCount<=limit);assert.equal(impacts.group.children.length,7);assert.deepEqual(pools(impacts),resources);
 const ray=new THREE.Raycaster(new THREE.Vector3(2,1,2),new THREE.Vector3(0,0,-1));assert.deepEqual(ray.intersectObject(impacts.group,true),[]);
 for(const mesh of resources){const kind=mesh.name.split('-')[1] as keyof typeof ELEMENTAL_IMPACT_CAPACITY;assert.ok(mesh.count<=ELEMENTAL_IMPACT_CAPACITY[kind]);const material=mesh.material as THREE.Material;assert.equal(material.depthTest,true);assert.equal(material.depthWrite,false);assert.ok(Array.from(mesh.instanceMatrix.array).every(Number.isFinite));}
 impacts.dispose();
});

test('zero, negative and nonfinite dt freeze uploaded matrices, opacity and particle counts',()=>{
 const scene=new THREE.Scene(),impacts=new ElementalImpacts(scene);for(const element of elements)impacts.impact(event(element));const before=snapshot(impacts),active=impacts.activeCount;
 for(const dt of[0,-.1,NaN,Infinity,-Infinity])impacts.update(dt);
 assert.deepEqual(snapshot(impacts),before);assert.equal(impacts.activeCount,active);impacts.dispose();
});

test('invalid impact normal/radius are sanitized and invalid positions emit nothing',()=>{
 const scene=new THREE.Scene(),impacts=new ElementalImpacts(scene);
 for(const normal of[new THREE.Vector3(NaN,0,1),new THREE.Vector3(Infinity,0,0),new THREE.Vector3()])for(const radius of[NaN,Infinity,-Infinity]){
  impacts.clear();impacts.impact(event('gravity',{normal,radius,phase:'detonate'}));assert.ok(impacts.activeCount>0);
  for(const mesh of pools(impacts))assert.ok(Array.from(mesh.instanceMatrix.array).every(Number.isFinite),'invalid parameters may not enter an instance buffer');
 }
 impacts.clear();for(const point of[new THREE.Vector3(NaN,0,0),new THREE.Vector3(0,Infinity,0)])impacts.impact(event('fire',{point}));assert.equal(impacts.activeCount,0);impacts.dispose();
});

test('residue expires, detached targets release references and disposal never touches target geometry',()=>{
 const scene=new THREE.Scene(),value=target(scene,13,[0,0,0]),impacts=new ElementalImpacts(scene);let originalGeometryDisposals=0,originalMaterialDisposals=0;
 value.geometry.addEventListener('dispose',()=>originalGeometryDisposals++);value.material.addEventListener('dispose',()=>originalMaterialDisposals++);
 const originalPositions=Array.from(value.geometry.getAttribute('position').array),originalNormals=Array.from(value.geometry.getAttribute('normal').array),originalMatrix=value.mesh.matrix.toArray();
 for(const element of elements)impacts.impact(event(element,{target:value.root}));value.root.removeFromParent();impacts.update(.01);
 const runtime=impacts as unknown as {pools:Map<string,{items:{active:boolean;target?:THREE.Group}[]}>};for(const p of runtime.pools.values())assert.ok(p.items.every(item=>item.target===undefined));
 for(let i=0;i<35;i++)impacts.update(.1);assert.equal(impacts.activeCount,0);assert.ok(pools(impacts).every(mesh=>mesh.count===0&&!mesh.visible));
 let geometryDisposals=0,materialDisposals=0;for(const mesh of pools(impacts)){mesh.geometry.addEventListener('dispose',()=>geometryDisposals++);(mesh.material as THREE.Material).addEventListener('dispose',()=>materialDisposals++);}
 impacts.dispose();impacts.dispose();assert.equal(geometryDisposals,7);assert.equal(materialDisposals,7);assert.equal(originalGeometryDisposals,0);assert.equal(originalMaterialDisposals,0);
 assert.deepEqual(Array.from(value.geometry.getAttribute('position').array),originalPositions);assert.deepEqual(Array.from(value.geometry.getAttribute('normal').array),originalNormals);assert.deepEqual(value.mesh.matrix.toArray(),originalMatrix);
 assert.doesNotThrow(()=>{impacts.impact(event('fire'));impacts.update(.1);impacts.clear();});assert.equal(impacts.activeCount,0);cleanupTarget(value);
});

test('presentation routes distance audio through the world listener and nearest source per element',()=>{
 const scene=new THREE.Scene(),cameraParent=new THREE.Group(),camera=new THREE.PerspectiveCamera();cameraParent.position.set(20,0,0);camera.position.set(1,2,0);cameraParent.add(camera);scene.add(cameraParent);
 const nearTarget=target(scene,21,[24,2,0]),farTarget=target(scene,22,[48,2,0]),presentation=new ElementalPresentation(scene,camera);
 const statusCalls:{element:ElementType;active:boolean;distance?:number}[]=[],impactCalls:{element:ElementType;distance?:number;delivery?:string}[]=[];
 presentation.audio.status=(element,active,options={})=>{statusCalls.push({element,active,distance:options.distance});};
 presentation.audio.impact=(element,options={})=>{impactCalls.push({element,distance:options.distance,delivery:options.delivery});};
 presentation.status(nearTarget.root,'fire');presentation.status(farTarget.root,'fire');presentation.status(farTarget.root,'shock');
 const spec=createWeaponSpec('orb','gravity');presentation.update(.016,1,false,spec,'mech');
 assert.deepEqual(statusCalls.filter(call=>call.active),[{element:'fire',active:true,distance:3},{element:'shock',active:true,distance:27}]);assert.equal(presentation.diagnostics.statuses,3);
 presentation.impact(event('gravity',{point:new THREE.Vector3(24,2,1),spec}));assert.deepEqual(impactCalls,[{element:'gravity',distance:Math.sqrt(10),delivery:'orb'}]);
 farTarget.root.removeFromParent();statusCalls.length=0;presentation.update(.016,1.016,false,spec,'mech');assert.equal(presentation.diagnostics.statuses,1);assert.deepEqual(statusCalls.filter(call=>call.active),[{element:'fire',active:true,distance:3}]);
 let disposedGeometry=0;nearTarget.geometry.addEventListener('dispose',()=>disposedGeometry++);presentation.dispose();presentation.dispose();assert.equal(disposedGeometry,0);assert.equal(presentation.diagnostics.statuses,0);cleanupTarget(nearTarget);cleanupTarget(farTarget);
});

test('presentation pause freezes effects and stops audio without advancing equipment or status loops',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),presentation=new ElementalPresentation(scene,camera);scene.add(camera);
 const spec=createWeaponSpec('bullet','fire');presentation.impact(event('fire'));const before=snapshot(presentation.impacts);let pauses=0,updates=0,loops=0;
 presentation.audio.pause=()=>{pauses++;};presentation.audio.update=()=>{updates++;};presentation.audio.equipment=()=>{loops++;};presentation.audio.status=()=>{loops++;};
 presentation.update(.1,10,true,spec,'pilot');assert.equal(pauses,1);assert.equal(updates,0);assert.equal(loops,0);assert.deepEqual(snapshot(presentation.impacts),before);presentation.dispose();
});
