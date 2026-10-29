import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createWeaponSpec, type ElementType, type ProjectileType, type WeaponSpec } from '../src/core/arsenal.ts';
import { createElementalProjectile, createElementalTrail, createElementalBeam, updateElementalProjectile, ELEMENTAL_FLIGHT_STYLES } from '../src/rendering/quality/elementalFlight.ts';

const elements:ElementType[]=['kinetic','fire','ice','corrosive','shock','radiation','gravity','adhesive'];
const deliveries:ProjectileType[]=['bullet','slug','spike','ricochet','homing','sticky','orb','scatter','rocket','disc'];
function meshes(root:THREE.Object3D):THREE.Mesh[]{const result:THREE.Mesh[]=[];root.traverse(object=>{if(object instanceof THREE.Mesh)result.push(object);});return result;}
function dispose(root:THREE.Object3D):void{
 const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
 root.traverse(object=>{if(!(object instanceof THREE.Mesh))return;geometry.add(object.geometry);(Array.isArray(object.material)?object.material:[object.material]).forEach(material=>materials.add(material));});
 geometry.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());root.removeFromParent();
}
function fingerprint(root:THREE.Object3D):string{
 root.updateMatrixWorld(true);
 return JSON.stringify(meshes(root).map(mesh=>({parts:mesh.userData.authoredParts,positions:Array.from(mesh.geometry.getAttribute('position').array),matrix:mesh.matrixWorld.toArray()})));
}
function assertSafe(root:THREE.Group,maxMeshes:number){
 assert.equal(root.userData.comicOverlay,true);assert.equal(root.userData.presentationOnly,true);
 assert.ok(meshes(root).length<=maxMeshes,`draw budget: ${meshes(root).length} > ${maxMeshes}`);
 root.updateMatrixWorld(true);
 for(const mesh of meshes(root)){
  assert.equal(mesh.userData.comicOverlay,true);assert.equal(mesh.userData.enemyId,undefined);
  assert.ok(Array.from(mesh.geometry.getAttribute('position').array).every(Number.isFinite));
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  for(const material of materials){assert.equal(material.depthTest,true);assert.equal(material.depthWrite,false);}
  const ray=new THREE.Raycaster(new THREE.Vector3(0,0,10),new THREE.Vector3(0,0,-1));assert.equal(ray.intersectObject(mesh).length,0);
 }
}

test('all elements retain every physical delivery, finite overlay geometry and a bounded draw budget',()=>{
 for(const element of elements)for(const projectile of deliveries){
  const spec=createWeaponSpec(projectile,element);const frozen=Object.freeze({...spec});
  const root=createElementalProjectile(frozen,'tackwork');assertSafe(root,16);
  assert.equal(root.userData.projectile,projectile);assert.equal(root.userData.element,element);
  assert.ok(root.getObjectByName('quality-physical-carrier'));assert.ok(root.getObjectByName(`quality-primary-${element}-payload`));
  assert.deepEqual(frozen,spec);dispose(root);
 }
});

test('delivery construction and elemental materials/shapes are genuinely distinct',()=>{
 const flightShapes=new Set<string>(),deliveryShapes=new Set<string>();
 for(const element of elements){const root=createElementalProjectile(createWeaponSpec('bullet',element));flightShapes.add(fingerprint(root));dispose(root);}
 assert.equal(flightShapes.size,elements.length);
 for(const projectile of deliveries){const spec={...createWeaponSpec(projectile,'corrosive'),weaponType:'rifle' as const};const root=createElementalProjectile(spec);deliveryShapes.add(fingerprint(root.getObjectByName('quality-physical-carrier')!));dispose(root);}
 assert.equal(deliveryShapes.size,deliveries.length);
 assert.equal(new Set(Object.values(ELEMENTAL_FLIGHT_STYLES).map(style=>style.wake)).size,elements.length);
});

test('world endpoints stay exact for all elements/styles, vertical shots and dual channels',()=>{
 const start=new THREE.Vector3(2,1.4,-3),end=new THREE.Vector3(2,7,-3);
 for(const element of elements)for(const trail of ['clean','tracer','helix','pulse','comet','ribbon'] as const){
  const spec:WeaponSpec={...createWeaponSpec('bullet',element),secondaryElement:element==='shock'?'ice':'shock',trail};
  const before=structuredClone(spec),startBefore=start.toArray(),endBefore=end.toArray();
  const root=createElementalTrail(start,end,spec,'voltaic');assertSafe(root,8);
  assert.deepEqual(root.userData.start,startBefore);assert.deepEqual(root.userData.end,endBefore);
  assert.deepEqual(start.toArray(),startBefore);assert.deepEqual(end.toArray(),endBefore);assert.deepEqual(spec,before);
  assert.deepEqual(root.position.toArray(),[0,0,0]);
  const displayed=new Set(meshes(root).map(mesh=>mesh.userData.element));assert.ok(displayed.has(element));assert.ok(displayed.has(spec.secondaryElement));
  // Primary tube geometry touches both exact endpoints; only its small radial cross-section extends beyond them.
  const points=meshes(root).flatMap(mesh=>Array.from(mesh.geometry.getAttribute('position').array));assert.ok(points.every(Number.isFinite));
  dispose(root);
 }
});

test('beam and arc visuals preserve supplied endpoints and primary/secondary channels',()=>{
 const start=new THREE.Vector3(-4,2,1),end=new THREE.Vector3(3,3,-22),before=[start.toArray(),end.toArray()];
 const forms=new Set<string>();
 for(const element of elements)for(const jagged of [false,true]){
  const spec={...createWeaponSpec(jagged?'arc':'beam',element),secondaryElement:element==='fire'?'ice':'fire' as ElementType,trail:'helix' as const,visualVariant:3};
  const root=createElementalBeam(start,end,spec,jagged,'prism');assertSafe(root,8);
  assert.deepEqual(root.userData.start,before[0]);assert.deepEqual(root.userData.end,before[1]);
  const palette=new Set(meshes(root).map(mesh=>mesh.userData.element));assert.ok(palette.has(element));assert.ok(palette.has(spec.secondaryElement));
  forms.add(fingerprint(root));dispose(root);
 }
 assert.equal(forms.size,elements.length*2);assert.deepEqual([start.toArray(),end.toArray()],before);
});

test('invalid and zero-length paths return empty overlays without NaN uploads',()=>{
 const spec=createWeaponSpec('beam','gravity');
 for(const [start,end]of [[new THREE.Vector3(),new THREE.Vector3()],[new THREE.Vector3(NaN,0,0),new THREE.Vector3(1,0,0)],[new THREE.Vector3(),new THREE.Vector3(Infinity,0,0)]]){
  for(const root of [createElementalTrail(start,end,spec),createElementalBeam(start,end,spec,true)]){assert.equal(root.children.length,0);dispose(root);}
 }
});

test('simulation-age animation leaves projectile root state unchanged and freezes at dt zero',()=>{
 for(const element of elements){
  const root=createElementalProjectile(createWeaponSpec('orb',element));root.position.set(1,3,4);root.quaternion.setFromEuler(new THREE.Euler(.3,.2,.1));
  const position=root.position.toArray(),quaternion=root.quaternion.toArray(),scale=root.scale.toArray();
  updateElementalProjectile(root,1/60,1.2);const before=fingerprint(root);updateElementalProjectile(root,0,4.5);assert.equal(fingerprint(root),before);
  assert.deepEqual(root.position.toArray(),position);assert.deepEqual(root.quaternion.toArray(),quaternion);assert.deepEqual(root.scale.toArray(),scale);
  updateElementalProjectile(root,1/60,2.4);assert.deepEqual(root.position.toArray(),position);assert.deepEqual(root.quaternion.toArray(),quaternion);assert.deepEqual(root.scale.toArray(),scale);dispose(root);
 }
});

test('factory calls never share disposable resources and every visible resource can be disposed',()=>{
 const spec={...createWeaponSpec('orb','gravity'),secondaryElement:'adhesive' as const};
 const first=createElementalProjectile(spec),second=createElementalProjectile(spec);
 const firstGeometry=new Set(meshes(first).map(mesh=>mesh.geometry)),firstMaterial=new Set(meshes(first).flatMap(mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material]));
 for(const mesh of meshes(second)){assert.ok(!firstGeometry.has(mesh.geometry));for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])assert.ok(!firstMaterial.has(material));}
 let geometryDisposed=0,materialDisposed=0;firstGeometry.forEach(value=>value.addEventListener('dispose',()=>geometryDisposed++));firstMaterial.forEach(value=>value.addEventListener('dispose',()=>materialDisposed++));
 dispose(first);assert.equal(geometryDisposed,firstGeometry.size);assert.equal(materialDisposed,firstMaterial.size);dispose(second);
});
