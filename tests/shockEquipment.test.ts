import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createProgression} from '../src/core/index.ts';
import {resolveEquipmentAppearance} from '../src/core/appearance.ts';
import {createEquipmentWeapon,createEquipmentItemModel,disposeEquipmentModel} from '../src/rendering/equipmentModels.ts';
import {ShockEquipment} from '../src/rendering/quality/shock/equipment.ts';
import {shockAssemblies,assemblySolids,relativeEquipmentMatrix} from '../src/rendering/quality/shock/equipmentGeometry.ts';
import {upgradeReferenceWeapon} from '../src/rendering/quality/weapon.ts';
import {createGameElements,createGameElementsBeforeShockEquipment} from '../src/rendering/quality/gameElements.ts';
import type {ShockElementResponse} from '../src/rendering/quality/shock/module.ts';
import {createWeaponSpec} from '../src/core/arsenal.ts';
import {updateEquipmentEffects} from '../src/rendering/equipmentEffects.ts';

let saved:PropertyDescriptor|undefined;before(()=>{saved=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},clearRect(){},fillText(){}})})}});});after(()=>{if(saved)Object.defineProperty(globalThis,'document',saved);else Reflect.deleteProperty(globalThis,'document');});
const families=['pistol','smg','rifle','shotgun','sniper','launcher']as const,forms=['standard','rapid','heavy','compact']as const;
function appearance(mode:'pilot'|'mech',family:typeof families[number]='rifle',form:typeof forms[number]='standard',delivery='bullet'){
 const look=resolveEquipmentAppearance(createProgression(),mode);look.weapon={...look.weapon,equipped:true,element:'shock',secondaryElement:undefined,weaponType:family,form,projectile:delivery as 'bullet',visualVariant:2};for(const slot of ['shield','reactor','legs']as const)look[slot]={...look[slot],equipped:true,element:'shock'};return look;
}
function resources(root:THREE.Object3D){const rows:{mesh:THREE.Mesh;geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[];matrix:number[]}[]=[];root.updateWorldMatrix(true,true);root.traverse(o=>{if(o instanceof THREE.Mesh)rows.push({mesh:o,geometry:o.geometry,material:o.material,matrix:o.matrix.elements.slice()});});return rows;}
for(const mode of ['pilot','mech']as const)for(const family of families)for(const form of forms)test(`Shock terminals fit and restore ${mode}/${family}/${form} without moving a muzzle or unrelated slot`,()=>{
 const look=appearance(mode,family,form,family==='launcher'?'sticky':'bullet'),rig=createEquipmentWeapon(mode,look.weapon,look);rig.group.position.set(2,1,3);rig.group.rotation.set(.2,.5,.1);rig.group.scale.set(.65,1.2,.9);const original=resources(rig.group),muzzles=rig.muzzles.map(m=>m.getWorldPosition(new THREE.Vector3()).toArray());let borrowedDisposals=0;for(const r of original)r.geometry.addEventListener('dispose',()=>borrowedDisposals++);
 const v=new ShockEquipment(rig.group,look.weapon);assert.equal(v.terminals.length,mode==='pilot'?1:2);assert.equal(v.bindings.length,mode==='pilot'?3:6);assert.ok(v.diagnostics.visibleSurfaces>=v.terminals.length*2);
 for(const row of original){const changed=row.mesh.geometry!==row.geometry;if(changed)assert.ok(row.mesh.userData.equipmentElementSurface==='shock'&&row.mesh.name.startsWith('element-transfer-band'));assert.deepEqual(row.mesh.matrix.elements,row.matrix);if(!v.bindings.some(b=>b.source===row.mesh))assert.equal(row.mesh.material,row.material);}
 for(const a of shockAssemblies(rig.group,look.weapon)){const solids=assemblySolids(a.owner);for(const s of a.sources.filter(s=>s.name.startsWith('element-transfer-band'))){const box=new THREE.Box3().setFromBufferAttribute(s.geometry.attributes.position as THREE.BufferAttribute).applyMatrix4(relativeEquipmentMatrix(s,a.owner)),z=s.position.z;for(const core of solids)if(z>=core.bounds.min.z&&z<=core.bounds.max.z){assert.ok(box.min.x<core.bounds.min.x&&box.max.x>core.bounds.max.x);}}}
 for(let frame=0;frame<90;frame++){rig.barrels[0].position.z-=.0002;rig.barrels[0].rotation.z+=.001;v.update(1/60,frame/60);rig.group.updateWorldMatrix(true,true);for(const binding of v.bindings)if(binding.overlay){assert.equal(binding.overlay.geometry,binding.source.geometry);assert.deepEqual(binding.overlay.matrixWorld.elements,binding.source.matrixWorld.elements);}for(const t of v.terminals){assert.equal(t.group.parent,t.host);assert.equal(t.lines.capacity,64);}}
 // Root/assembly poses were intentionally moved; muzzle points must follow only those exact poses.
 const current=rig.muzzles.map(m=>m.getWorldPosition(new THREE.Vector3()).toArray());assert.notDeepEqual(current,muzzles);assert.ok(v.terminals.every(t=>t.lines.activeCount<=64));v.dispose();v.dispose();assert.equal(borrowedDisposals,0);for(const r of original){assert.equal(r.mesh.geometry,r.geometry);assert.equal(r.mesh.material,r.material);}disposeEquipmentModel(rig.group);
});
test('mech shots pulse only the firing cannon, parked/idle cells never emit C, and pause freezes equipment',()=>{
 const look=appearance('mech','launcher','standard','sticky'),rig=createEquipmentWeapon('mech',look.weapon,look),v=new ShockEquipment(rig.group,look.weapon);v.update(1/60,20);v.shot(1);v.update(1/60,20+1/60);assert.equal(v.terminals[0].charge,1);assert.ok(v.terminals[1].charge<.2);assert.ok(v.terminals[1].lines.activeCount>=8);
 const state=()=>v.terminals.map(t=>({charge:t.charge,lamp:t.lamp.opacity,matrix:Array.from(t.lines.meshes[0].instanceMatrix.array)})),paused=state();v.update(0,20+1/60);assert.deepEqual(state(),paused);v.update(.1,20+.6);assert.ok(v.terminals.every(t=>t.charge>.25));assert.equal(rig.group.getObjectByName('shock-capacitor-blades-and-shards'),undefined);v.dispose();disposeEquipmentModel(rig.group);
});
test('preview/drop metadata yields the same terminal construction and seed as the equipped model',()=>{
 for(const mode of ['pilot','mech']as const){const look=appearance(mode,'launcher','standard','sticky'),rig=createEquipmentWeapon(mode,look.weapon,look),item=createEquipmentItemModel(mode,look.weapon),a=new ShockEquipment(rig.group,look.weapon),b=new ShockEquipment(item,{...look.weapon,key:'bound:arbitrary-instance',target:'pilot',form:'standard',brand:undefined,weaponType:undefined,visualVariant:undefined});assert.equal(a.terminals[0].assembly.delivery,b.terminals[0].assembly.delivery);assert.equal(a.terminals[0].seed,b.terminals[0].seed);assert.equal(a.terminals[0].gap,b.terminals[0].gap);a.dispose();b.dispose();disposeEquipmentModel(rig.group);disposeEquipmentModel(item);}
});
test('mixed production equipment replaces only Shock generic effects, keeps other channels and leaves impacts/audio independent',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),layer=createGameElements(scene,camera),look=appearance('pilot');look.weapon={...look.weapon,element:'fire',secondaryElement:'shock'};const rig=createEquipmentWeapon('pilot',look.weapon,look);scene.add(rig.group);const originals=resources(rig.group);layer.weapon(rig.group,look.weapon);const response=layer.responses.get('shock')as ShockElementResponse,v=response.equipmentOwners.get(rig.group)!;assert.ok(v);assert.equal(v.weight,.62);assert.ok(rig.group.getObjectByName(layer.responses.has('fire')?'fire-hybrid-equipment':'quality-fire-cartridge-accents'));assert.equal(rig.group.getObjectByName('quality-shock-cartridge-accents'),undefined);
 const beforeEvents=response.shock.events.length,calls:string[]=[];layer.audio.impact=e=>{calls.push(e);};layer.shot({...createWeaponSpec('bullet','fire'),secondaryElement:'shock'},'pilot',rig.group,0);for(let i=0;i<20;i++)updateEquipmentEffects(rig.group,1/60,i/60);assert.equal(response.shock.events.length,beforeEvents);assert.deepEqual(calls,[]);layer.release(rig.group);assert.equal(response.equipmentOwners.size,0);for(const r of originals){assert.equal(r.mesh.geometry,r.geometry);assert.equal(r.mesh.material,r.material);}layer.dispose();disposeEquipmentModel(rig.group);
});
test('reference upgrade and Shock restore exact originals in either disposal order',()=>{
 for(const shockFirst of [true,false]){const look=appearance('pilot','launcher','standard','sticky'),rig=createEquipmentWeapon('pilot',look.weapon,look),original=resources(rig.group),quality=upgradeReferenceWeapon(rig,look.weapon,'pilot'),v=new ShockEquipment(rig.group,look.weapon);if(shockFirst){v.dispose();quality.dispose();}else{quality.dispose();v.dispose();}for(const r of original){assert.equal(r.mesh.geometry,r.geometry);assert.equal(r.mesh.material,r.material);}disposeEquipmentModel(rig.group);}
});
test('mixed collars leave the other material exposed and surface paths land on the real facets',()=>{
 for(const primary of ['shock','corrosive']as const){const look=appearance('pilot');look.weapon={...look.weapon,element:primary,secondaryElement:primary==='shock'?'corrosive':'shock'};const rig=createEquipmentWeapon('pilot',look.weapon,look),original=resources(rig.group),v=new ShockEquipment(rig.group,look.weapon);
  for(const b of v.bindings.filter(b=>b.source.name.startsWith('element-transfer-band'))){assert.ok(b.source.geometry.userData.shockArc.length<Math.PI);const paths=b.overlay!.material.uniforms.paths.value as THREE.Vector3[];assert.equal(paths.length,21);for(const p of paths)assert.ok(Math.hypot(p.x,p.z)>.09,'wire must sit on the raised strap, not inside the barrel');}
  assert.ok(v.terminals[0].group.position.length()>.09);v.dispose();for(const r of original){assert.equal(r.mesh.geometry,r.geometry);assert.equal(r.mesh.material,r.material);}disposeEquipmentModel(rig.group);
 }
});
test('equipment-only review pins impact entropy without changing the production registry or response',()=>{
 const layers=[createGameElementsBeforeShockEquipment,createGameElements].map(factory=>factory(new THREE.Scene(),new THREE.PerspectiveCamera(),{shock:{cosmeticSeed:37391}}));
 const responses=layers.map(l=>(l.responses.get('shock')as ShockElementResponse).shock);assert.equal(responses[0].directionSeed,37391);assert.equal(responses[1].directionSeed,37391);assert.deepEqual([...layers[0].responses.keys()],[...layers[1].responses.keys()]);for(const l of layers)l.dispose();
});
