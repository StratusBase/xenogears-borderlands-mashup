import assert from 'node:assert/strict';
import { before,after,test } from 'node:test';
import * as THREE from 'three';
import { ElementalEquipment,ElementalStatus,ELEMENTAL_SURFACE_RECIPES,SURFACE_ELEMENTS } from '../src/rendering/quality/elementalSurfaces.ts';
import { createEquipmentWeapon,disposeEquipmentModel } from '../src/rendering/equipmentModels.ts';
import { createProgression } from '../src/core/index.ts';
import { resolveEquipmentAppearance } from '../src/core/appearance.ts';
import { createEncounterEnemy } from '../src/rendering/encounterEnemy.ts';
import { decorateEnemy } from '../src/rendering/quality/actors.ts';

let originalDocument:PropertyDescriptor|undefined;
before(()=>{originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){}})})}});});
after(()=>{if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else Reflect.deleteProperty(globalThis,'document');});
function meshes(root:THREE.Object3D):THREE.Mesh[]{const result:THREE.Mesh[]=[];root.traverse(object=>{if(object instanceof THREE.Mesh)result.push(object);});return result;}
function snapshot(root:THREE.Object3D){root.updateWorldMatrix(true,true);return meshes(root).map(mesh=>({mesh,geometry:mesh.geometry,material:mesh.material,matrix:mesh.matrixWorld.toArray(),data:JSON.stringify(mesh.userData)}));}
function rayHits(root:THREE.Object3D){root.updateWorldMatrix(true,true);return [.35,1.4,2.25].flatMap(y=>[-.6,0,.6].map(x=>new THREE.Raycaster(new THREE.Vector3(x,y,6),new THREE.Vector3(0,0,-1)).intersectObject(root,true).map(hit=>({name:hit.object.name,distance:hit.distance,id:hit.object.userData.enemyId,critical:hit.object.userData.critical}))));}

for(const mode of ['pilot','mech']as const){
 test(`${mode} seven equipment elements preserve unrelated resources, sockets and exact reversible slot ownership`,()=>{
  for(const element of SURFACE_ELEMENTS){
   const loadout=resolveEquipmentAppearance(createProgression(),mode);loadout.weapon={...loadout.weapon,element,equipped:true,projectile:'bullet'};
   const rig=createEquipmentWeapon(mode,loadout.weapon,loadout);
   // Maliciously similar tags below unrelated visual owners cannot acquire weapon effects.
   for(const owner of ['shield','reactor','legs','body']){const group=new THREE.Group();group.userData.visualOwner=owner;const mesh=new THREE.Mesh(new THREE.BoxGeometry(.03,.03,.03),new THREE.MeshBasicMaterial());mesh.userData.equipmentElementSurface=element;group.add(mesh);rig.group.add(group);}
   const original=snapshot(rig.group),sockets=rig.muzzles.map(socket=>socket.matrixWorld.toArray());
   const effect=new ElementalEquipment(rig.group,loadout.weapon);effect.update(.016,3);
   assert.equal(effect.overlays.length,mode==='pilot'?3:6);assert.ok(effect.activeAccentCount>0&&effect.activeAccentCount<=20);
   const selected=new Set(effect.overlays.map(overlay=>overlay.parent));
   for(const entry of original){
    assert.equal(entry.mesh.geometry,entry.geometry);assert.deepEqual(entry.mesh.matrixWorld.toArray(),entry.matrix);assert.equal(JSON.stringify(entry.mesh.userData),entry.data);
    if(!selected.has(entry.mesh))assert.equal(entry.mesh.material,entry.material,`Unrelated owner ${entry.mesh.name} changed`);
    else assert.notEqual(entry.mesh.material,entry.material,'Physical cartridge substrate must differ from legacy flat neon');
   }
   for(const overlay of effect.overlays){assert.equal(overlay.geometry,(overlay.parent as THREE.Mesh).geometry);assert.equal(overlay.userData.enemyId,undefined);assert.equal(overlay.userData.borrowedGeometry,true);const material=overlay.material as THREE.ShaderMaterial;assert.ok(material.depthTest);assert.equal(material.depthWrite,false);assert.equal(material.uniforms.elementKind.value,ELEMENTAL_SURFACE_RECIPES[element].index);}
   assert.deepEqual(rig.muzzles.map(socket=>socket.matrixWorld.toArray()),sockets);
   let disposedGeometry=0;for(const overlay of effect.overlays)overlay.geometry.addEventListener('dispose',()=>disposedGeometry++);
   effect.dispose();effect.dispose();assert.equal(disposedGeometry,0);
   original.forEach(entry=>{assert.equal(entry.mesh.geometry,entry.geometry);assert.equal(entry.mesh.material,entry.material);assert.equal(JSON.stringify(entry.mesh.userData),entry.data);});
   disposeEquipmentModel(rig.group);
  }
 });
}
test('dual element cartridges remain separate, delivery changes the response without touching the receiver',()=>{
 const loadout=resolveEquipmentAppearance(createProgression(),'pilot');loadout.weapon={...loadout.weapon,element:'corrosive',secondaryElement:'shock',equipped:true,projectile:'sticky',visualVariant:3};
 const rig=createEquipmentWeapon('pilot',loadout.weapon,loadout),before=snapshot(rig.group);
 const effect=new ElementalEquipment(rig.group,loadout.weapon);assert.equal(effect.overlays.length,6);
 for(const overlay of effect.overlays){assert.equal(overlay.userData.element,(overlay.parent as THREE.Mesh).userData.equipmentElementSurface);}
 const receivers=before.filter(entry=>/receiver|stock|grip|magazine/.test(entry.mesh.name));assert.ok(receivers.length>4);receivers.forEach(entry=>assert.equal(entry.mesh.material,entry.material));
 effect.dispose();disposeEquipmentModel(rig.group);
});
test('all lingering material responses remain readable, preserve real hit events and never dispose borrowed armor',()=>{
 const visual=createEncounterEnemy(51,'flanker'),actor=decorateEnemy(visual.group,51);
 const before=rayHits(visual.group),original=snapshot(visual.group);
 const effects=SURFACE_ELEMENTS.map(element=>new ElementalStatus(visual.group,element));
 for(const effect of effects){
  assert.ok(effect.overlays.length>0&&effect.overlays.length<=6);assert.ok(effect.activeAccentCount<=10);
  for(const overlay of effect.overlays){const source=overlay.parent as THREE.Mesh;assert.equal(overlay.geometry,source.geometry);assert.equal(overlay.userData.enemyId,undefined);assert.equal(source.userData.enemyId,undefined);assert.ok(!/optic|red|weakpoint/.test(source.name));}
  effect.update(.016,3.4);
 }
 assert.deepEqual(rayHits(visual.group),before);
 original.forEach(entry=>{assert.equal(entry.mesh.geometry,entry.geometry);assert.equal(entry.mesh.material,entry.material);assert.equal(JSON.stringify(entry.mesh.userData),entry.data);});
 let destroyed=0;for(const effect of effects)for(const overlay of effect.overlays)overlay.geometry.addEventListener('dispose',()=>destroyed++);
 effects.forEach(effect=>{effect.dispose();effect.dispose();});assert.equal(destroyed,0);assert.deepEqual(rayHits(visual.group),before);
 actor.dispose();visual.dispose();
});
test('surface clocks and accent transforms freeze at dt zero; kinetic is a no-op',()=>{
 const loadout=resolveEquipmentAppearance(createProgression(),'pilot');loadout.weapon={...loadout.weapon,element:'fire',equipped:true};
 const rig=createEquipmentWeapon('pilot',loadout.weapon),effect=new ElementalEquipment(rig.group,loadout.weapon);effect.update(.016,2);
 const values=effect.overlays.map(mesh=>(mesh.material as THREE.ShaderMaterial).uniforms.time.value);
 const accents=meshes(effect.group).filter((mesh):mesh is THREE.InstancedMesh=>mesh instanceof THREE.InstancedMesh),transforms=accents.map(mesh=>Array.from(mesh.instanceMatrix.array));
 effect.update(0,99);effect.update(NaN,99);
 assert.deepEqual(effect.overlays.map(mesh=>(mesh.material as THREE.ShaderMaterial).uniforms.time.value),values);assert.deepEqual(accents.map(mesh=>Array.from(mesh.instanceMatrix.array)),transforms);
 effect.dispose();effect.update(1,99);
 const kinetic=new ElementalEquipment(rig.group,{...loadout.weapon,element:'kinetic',secondaryElement:undefined});assert.equal(kinetic.overlays.length,0);assert.equal(kinetic.activeAccentCount,0);kinetic.dispose();
 const empty=new ElementalEquipment(rig.group,{...loadout.weapon,equipped:false});assert.equal(empty.overlays.length,0);empty.dispose();disposeEquipmentModel(rig.group);
});
test('legacy heavy armor uses the same controlled response without covering its critical core or shield lights',()=>{
 const visual=createEncounterEnemy(89,'heavy'),before=rayHits(visual.group);
 const effect=new ElementalStatus(visual.group,'ice');assert.ok(effect.overlays.length>0&&effect.overlays.length<=6);
 for(const overlay of effect.overlays){const source=overlay.parent as THREE.Mesh;assert.equal(source.userData.critical,false);assert.ok(!/core|light|visor|muzzle/.test(source.name));}
 assert.deepEqual(rayHits(visual.group),before);effect.dispose();visual.dispose();
});

test('lingering gravity orbits retain projected curvature at pilot eye height instead of collapsing into bars',()=>{
 const visual=createEncounterEnemy(91,'flanker'),actor=decorateEnemy(visual.group,91),effect=new ElementalStatus(visual.group,'gravity');
 const pool=meshes(effect.group).find(mesh=>mesh instanceof THREE.InstancedMesh) as THREE.InstancedMesh;assert.ok(pool);
 const matrix=new THREE.Matrix4(),normal=new THREE.Vector3();
 for(const time of [0,1,4,9]){
  effect.update(.016,time);
  for(let i=0;i<pool.count;i++){
   pool.getMatrixAt(i,matrix);normal.set(0,0,1).transformDirection(matrix);
   assert.ok(Math.abs(normal.z)>.4,`Orbit ${i} at ${time}s needs visible projected area`);
  }
 }
 effect.dispose();actor.dispose();visual.dispose();
});

test('optional shared equipment presentation reaches any updated view and restores legacy lifecycle',async()=>{
 const {setEquipmentEffectFactory,updateEquipmentEffects,disposeEquipmentEffects}=await import('../src/rendering/equipmentEffects.ts');
 let updates=0,disposed=0,created=0;
 const restore=setEquipmentEffectFactory(()=>{created++;return{update(){updates++;},dispose(){disposed++;}};});
 const equipped=new THREE.Group(),preview=new THREE.Group(),drop=new THREE.Group();
 for(const root of[equipped,preview,drop]){updateEquipmentEffects(root,.016,1);updateEquipmentEffects(root,.016,2);}
 assert.equal(created,3);assert.equal(updates,6);
 disposeEquipmentEffects(drop);assert.equal(disposed,1);restore();assert.equal(disposed,3);
 updateEquipmentEffects(equipped,.016,3);assert.equal(updates,6,'restored default does not call quality adapter');disposeEquipmentEffects(equipped);disposeEquipmentEffects(preview);
});
