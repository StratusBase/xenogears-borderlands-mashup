import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorkbenchWeapon,DEFAULT_WORKBENCH_CONFIG} from '../src/core/workbench';
import {describeItemAppearance,resolveEquipmentAppearance} from '../src/core/appearance';
import {createProgression,type Mode} from '../src/core/index';
import type {ProjectileType} from '../src/core/arsenal';
import {createEquipmentWeapon,disposeEquipmentModel} from '../src/rendering/equipmentModels';
import {ElementalEquipment} from '../src/rendering/quality/elementalSurfaces';
import {GravityEquipment} from '../src/rendering/quality/gravity/equipment';
import {GravityEquipmentResponse,gravityEquipmentModule} from '../src/rendering/quality/gravity/equipmentModule';
import {ComposedElementalPresentation} from '../src/rendering/quality/shared/composedPresentation';

let originalDocument:PropertyDescriptor|undefined;before(()=>{originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},clearRect(){},fillText(){}})})}});});after(()=>{if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else Reflect.deleteProperty(globalThis,'document');});
function fixture(mode:Mode,delivery:ProjectileType='sticky',secondary=false,form:'standard'|'heavy'|'rapid'|'compact'='standard'){const item=createWorkbenchWeapon({...DEFAULT_WORKBENCH_CONFIG,target:mode,affix:form,element:secondary?'fire':'gravity',secondaryElement:secondary?'gravity':'corrosive',projectile:delivery,weaponType:delivery==='sticky'||delivery==='rocket'?'launcher':delivery==='slug'?'sniper':delivery==='scatter'?'shotgun':'rifle'},'gravity-test-'+mode);const appearance=describeItemAppearance(item),state=createProgression();state.inventory.push(item);state.loadouts[mode].weapon=item.id;return{appearance,rig:createEquipmentWeapon(mode,appearance,resolveEquipmentAppearance(state,mode))};}
function sockets(rig:ReturnType<typeof createEquipmentWeapon>){rig.group.updateMatrixWorld(true);return{parents:rig.muzzles.map(m=>m.parent),matrices:rig.muzzles.map(m=>m.matrixWorld.toArray()),homes:[...rig.barrelHomes,...rig.breechHomes].map(p=>p.toArray())};}
function resources(root:THREE.Object3D){const meshes:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});return meshes.map(mesh=>({mesh,parent:mesh.parent,geometry:mesh.geometry,material:mesh.material}));}

test('every gravity delivery preserves exact muzzles, source geometry, other channels and equipment slots',()=>{
 for(const mode of ['pilot','mech']as const)for(const delivery of ['bullet','slug','scatter','beam','orb','sticky','rocket','homing','cluster','disc','spike','arc','ricochet']as ProjectileType[])for(const secondary of [false,true])for(const form of ['standard','heavy','rapid','compact']as const){
  const {appearance,rig}=fixture(mode,delivery,secondary,form),before=sockets(rig),sources=resources(rig.group),visual=new GravityEquipment(rig.group,appearance);assert.equal(visual.devices.length,mode==='mech'?2:1,`${mode}/${delivery}`);
  visual.update(1/60,20);visual.shot(0);visual.update(.01,20.01);assert.deepEqual(sockets(rig),before);
  for(const b of sources){assert.equal(b.mesh.geometry,b.geometry);assert.equal(b.mesh.parent,b.parent);if(b.mesh.userData.equipmentElementSurface!=='gravity')assert.equal(b.mesh.material,b.material);}
  visual.dispose();visual.dispose();for(const b of sources)assert.equal(b.mesh.material,b.material);assert.equal(rig.group.getObjectByName('gravity-contained-equipment-core'),undefined);disposeEquipmentModel(rig.group);
 }
});
test('new cells sit outside actual wide/rotary barrel envelopes and stay behind the actual muzzle plane',()=>{
 for(const mode of ['pilot','mech']as const)for(const delivery of ['sticky','rocket','orb','bullet']as const){const {appearance,rig}=fixture(mode,delivery),visual=new GravityEquipment(rig.group,appearance);for(const d of visual.devices){const center=d.group.position;const ownerX=d.owner.getWorldPosition(new THREE.Vector3()).x-rig.group.getWorldPosition(new THREE.Vector3()).x;assert.ok(mode==='mech'&&ownerX<0?center.x>0:center.x<0);assert.ok(center.y>d.radius*.15);assert.ok(center.z<0);assert.ok(d.radius>.007&&d.radius<.06);const muzzle=rig.muzzles[d.index],muzzleZ=d.owner.worldToLocal(muzzle.getWorldPosition(new THREE.Vector3())).z;assert.ok(center.z-d.radius*3>muzzleZ);assert.equal(d.group.parent,d.owner);assert.equal(d.group.userData.presentationOnly,true);assert.equal(d.core.raycast(new THREE.Raycaster(),[]),undefined);}visual.dispose();disposeEquipmentModel(rig.group);}
});
test('only the firing mech gun responds; parked, preview, secondary and other slots stay isolated',()=>{
 const {appearance,rig}=fixture('mech'),parked=fixture('mech'),controller=new GravityEquipmentResponse(),visual=controller.equipment(rig.group,appearance),other=controller.equipment(parked.rig.group,parked.appearance);visual.update(.01,20);other.update(.01,20);controller.shot(rig.group,1);visual.update(.01,20.01);other.update(.01,20.01);assert.equal(visual.diagnostics.cells[0].pulse,0);assert.ok(visual.diagnostics.cells[1].pulse>.65);assert.ok(other.diagnostics.cells.every(c=>c.pulse===0));controller.release(rig.group);assert.equal(controller.equipmentOwners.size,1);controller.dispose();assert.equal(controller.equipmentOwners.size,0);disposeEquipmentModel(rig.group);disposeEquipmentModel(parked.rig.group);
});
test('nearest equipment ownership excludes falsely tagged armor and its children',()=>{
 const {appearance,rig}=fixture('pilot');const shield=new THREE.Group();shield.userData.equipmentSlot='shield';rig.barrels[0].add(shield);const fake=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());fake.name='element-chamber-fake';fake.userData.equipmentElementSurface='gravity';shield.add(fake);const original=fake.material,visual=new GravityEquipment(rig.group,appearance);assert.equal(fake.material,original);assert.equal(visual.bindings.length,3);visual.dispose();disposeEquipmentModel(rig.group);
});
test('recoil/reload transformations carry the attached cells without editing the source pose',()=>{
 const {appearance,rig}=fixture('pilot'),original=sockets(rig),visual=new GravityEquipment(rig.group,appearance),d=visual.devices[0],before=d.group.getWorldPosition(new THREE.Vector3());const local=d.group.matrix.clone();rig.barrels[0].position.z+=.17;rig.barrels[0].rotation.x=.3;visual.update(.1,21);rig.group.updateMatrixWorld(true);assert.ok(before.distanceTo(d.group.getWorldPosition(new THREE.Vector3()))>.1);assert.deepEqual(d.group.matrix.toArray(),local.toArray());assert.deepEqual(rig.barrelHomes.map(p=>p.toArray()),original.homes.slice(0,rig.barrelHomes.length));visual.dispose();disposeEquipmentModel(rig.group);
});
test('equipment-only module replaces gravity once while keeping the other channel and original material lifecycle',()=>{
 const {appearance,rig}=fixture('pilot','bullet',true),scene=new THREE.Scene(),layer=new ComposedElementalPresentation(scene,new THREE.PerspectiveCamera(),{gravity:gravityEquipmentModule()});scene.add(rig.group);const original=resources(rig.group);layer.weapon(rig.group,appearance);layer.weapon(rig.group,appearance);let cores=0;rig.group.traverse(o=>{if(o.name==='gravity-equipment-dark-core')cores++;});assert.equal(cores,1);assert.ok(rig.group.getObjectByName('quality-elemental-equipment'));layer.dispose();for(const b of original)assert.equal(b.mesh.material,b.material);disposeEquipmentModel(rig.group);
});

test('stable wisp paths survive shots, secondary cells are smaller, and a clock rewind clears the kick',()=>{
 const primary=fixture('pilot','beam'),secondary=fixture('pilot','beam',true),a=new GravityEquipment(primary.rig.group,primary.appearance),b=new GravityEquipment(secondary.rig.group,secondary.appearance);assert.ok(b.devices[0].radius<a.devices[0].radius*.72);assert.equal(b.devices[0].wisps.material.uniforms.idle.value,0);const seed=a.diagnostics.cells[0].seed;a.update(.01,20);a.shot(0);a.update(.01,20.01);assert.equal(a.diagnostics.cells[0].seed,seed);assert.ok(a.devices[0].wisps.material.uniforms.kick.value>0);a.update(.01,0);assert.equal(a.devices[0].wisps.material.uniforms.kick.value,0);a.dispose();b.dispose();disposeEquipmentModel(primary.rig.group);disposeEquipmentModel(secondary.rig.group);
});
test('authoritative muzzle metadata survives reordered scene children; missing sockets never become gun zero',()=>{
 const {appearance,rig}=fixture('mech');rig.group.children.reverse();const v=new GravityEquipment(rig.group,appearance);for(const d of v.devices){assert.ok(rig.muzzles[d.index]);assert.equal(d.owner,rig.barrels[d.index]);}v.update(.01,20);v.shot();v.update(.01,20.01);assert.ok(v.diagnostics.cells.every(c=>c.pulse===0));v.dispose();rig.muzzles[0].removeFromParent();const missing=new GravityEquipment(rig.group,appearance);assert.deepEqual(missing.devices.map(d=>d.index),[1]);missing.dispose();disposeEquipmentModel(rig.group);
});
test('release in either mixed-channel order restores original resources without disposing borrowed buffers',()=>{
 for(const gravityFirst of [true,false]){const {appearance,rig}=fixture('pilot','bullet',true),original=resources(rig.group);let disposed=0;for(const r of original)r.geometry.addEventListener('dispose',()=>disposed++);const fire=new ElementalEquipment(rig.group,{...appearance,secondaryElement:undefined}),gravity=new GravityEquipment(rig.group,appearance);if(gravityFirst){gravity.dispose();fire.dispose();}else{fire.dispose();gravity.dispose();}assert.equal(disposed,0);for(const r of original){assert.equal(r.mesh.material,r.material);assert.equal(r.mesh.geometry,r.geometry);}disposeEquipmentModel(rig.group);}
});
test('hand-authored fixed matrices and a foreign material owner are not overwritten',()=>{
 const {appearance,rig}=fixture('pilot'),source=rig.group.getObjectByName('element-chamber-0')as THREE.Mesh;source.updateMatrix();source.matrixAutoUpdate=false;source.matrix.elements[12]-=.013;const fixed=source.matrix.toArray(),v=new GravityEquipment(rig.group,appearance);assert.deepEqual(source.matrix.toArray(),fixed);const foreign=new THREE.MeshBasicMaterial();source.material=foreign;v.dispose();assert.equal(source.material,foreign);foreign.dispose();disposeEquipmentModel(rig.group);
});
