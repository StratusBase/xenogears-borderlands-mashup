import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createProgression,type Mode} from '../src/core/index.ts';
import {resolveEquipmentAppearance,type EquipmentAppearance} from '../src/core/appearance.ts';
import {createWeaponSpec} from '../src/core/arsenal.ts';
import {createEquipmentWeapon,createEquipmentCharacter,disposeEquipmentModel} from '../src/rendering/equipmentModels.ts';
import {createDroppedItemModel} from '../src/rendering/dropModels.ts';
import {updateEquipmentEffects,disposeEquipmentEffects} from '../src/rendering/equipmentEffects.ts';
import {RadiationEquipment} from '../src/rendering/quality/radiation/equipment.ts';
import {createGameElements} from '../src/rendering/quality/gameElements.ts';
import {radiationEquipmentProfile} from '../src/rendering/quality/radiation/equipmentProfile.ts';
import {weaponPreviewFrame} from '../src/rendering/previewFraming.ts';
let originalDocument:PropertyDescriptor|undefined;
before(()=>{originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},clearRect(){},fillText(){}})})}});});
after(()=>{if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else Reflect.deleteProperty(globalThis,'document');});
const brands=['ironvale','prism','kestrel','rebound','tackwork','nullward','cindergrid','voltaic']as const;
function look(mode:Mode){const value=resolveEquipmentAppearance(createProgression(),mode);value.weapon={...value.weapon,equipped:true,element:'radiation',projectile:'rocket',weaponType:'launcher'};return value;}
function find(root:THREE.Object3D,name:string){const all:THREE.Object3D[]=[];root.traverse(o=>{if(o.name===name)all.push(o);});return all;}
for(const mode of ['pilot','mech']as const)test(`${mode} chamber mounts clear real manufacturer/delivery hardware, preserve materials/muzzles and never bind another element`,()=>{
 for(const brand of brands)for(const [weaponType,projectile]of [['pistol','bullet'],['smg','bullet'],['rifle','bullet'],['shotgun','scatter'],['sniper','beam'],['launcher','rocket'],['launcher','sticky'],['rifle','beam']]as const)for(const variant of [0,1,2]){
  const appearance=look(mode);appearance.weapon={...appearance.weapon,brand,weaponType,projectile,variant,element:'fire',secondaryElement:'radiation'};
  const rig=createEquipmentWeapon(mode,appearance.weapon,appearance);rig.group.updateWorldMatrix(true,true);const muzzles=rig.muzzles.map(m=>m.getWorldPosition(new THREE.Vector3()).toArray()),originals:{mesh:THREE.Mesh;geo:THREE.BufferGeometry;mat:THREE.Material|THREE.Material[];ray:THREE.Mesh['raycast']}[]=[];rig.group.traverse(o=>{if(o instanceof THREE.Mesh)originals.push({mesh:o,geo:o.geometry,mat:o.material,ray:o.raycast});});
  const v=new RadiationEquipment(rig.group,appearance.weapon);assert.equal(v.groups.length,mode==='pilot'?1:2);assert.ok(v.groups.every(g=>g.parent?.userData.equipmentElementSurface==='radiation'&&g.parent?.name==='element-chamber-1'));assert.ok(v.diagnostics.devices.every(d=>d.secondary&&d.flecks===0));
  v.shot(createWeaponSpec(projectile,'fire',mode));for(let i=1;i<=60;i++)v.update(i/60,1/60);assert.deepEqual(rig.muzzles.map(m=>m.getWorldPosition(new THREE.Vector3()).toArray()),muzzles);
  for(const o of originals){assert.equal(o.mesh.geometry,o.geo);assert.equal(o.mesh.material,o.mat);assert.equal(o.mesh.raycast,o.ray);}
  // The cap's base is above every overlapping physical part measured in the same assembly coordinates.
  for(const g of v.groups){g.updateWorldMatrix(true,false);const base=g.parent!.parent!.worldToLocal(g.getWorldPosition(new THREE.Vector3()));assert.ok(base.y>=g.userData.radiationMount.clearance+.0009);}
  v.dispose();assert.equal(find(rig.group,'radiation-shielded-isotope-insert').length,0);disposeEquipmentModel(rig.group);
 }
});
test('equipped, preview/parked and dropped views share counts and preserve weapon framing',()=>{
 const scene=new THREE.Scene(),layer=createGameElements(scene,new THREE.PerspectiveCamera());layer.audio.setEnabled(false);
 for(const mode of ['pilot','mech']as const){const appearance=look(mode),rig=createEquipmentWeapon(mode,appearance.weapon,appearance),actor=createEquipmentCharacter(mode,appearance),frame=weaponPreviewFrame(actor);
  scene.add(rig.group,actor);layer.weapon(rig.group,appearance.weapon);updateEquipmentEffects(actor,1/60,.1);assert.equal(find(rig.group,'radiation-shielded-isotope-insert').length,mode==='pilot'?1:2);assert.equal(find(actor,'radiation-shielded-isotope-insert').length,mode==='pilot'?1:2);assert.deepEqual(weaponPreviewFrame(actor),frame);
  const state=createProgression(),item={...state.inventory.find(i=>i.target===mode&&i.slot==='weapon')!,weapon:createWeaponSpec('rocket','radiation',mode)};const drop=createDroppedItemModel(item);scene.add(drop);updateEquipmentEffects(drop,1/60,.1);assert.equal(find(drop,'radiation-shielded-isotope-insert').length,1,'a dropped weapon is one physical cannon, rather than the cockpit pair');
  for(const root of [rig.group,actor,drop]){layer.release(root);disposeEquipmentModel(root);}
 }
 layer.dispose();
});
test('charge is shot-driven, time/pause stable, bounded and has distinct rapid/heavy/secondary responses',()=>{
 const appearance=look('pilot'),rig=createEquipmentWeapon('pilot',appearance.weapon,appearance),v=new RadiationEquipment(rig.group,appearance.weapon);v.update(1,1/60);v.shot();assert.equal(v.diagnostics.shotAge,0);assert.ok(v.diagnostics.devices[0].drawInstances>v.diagnostics.devices[0].slits*3);
 const mesh=find(rig.group,'radiation-contained-slits-and-fallout')[0]as THREE.InstancedMesh,paint=Array.from(mesh.instanceColor!.array);v.update(2,0);assert.deepEqual(Array.from(mesh.instanceColor!.array),paint);v.update(1,1/60);assert.equal(v.diagnostics.shotAge,0);
 for(let i=1;i<=100;i++)v.update(1+i/60,1/60);assert.equal(v.diagnostics.devices[0].drawInstances,v.diagnostics.devices[0].slits*3);assert.notDeepEqual(Array.from(mesh.instanceColor!.array),paint);
 for(let i=0;i<100;i++)v.shot();assert.ok(mesh.count<=13);const p=appearance.weapon,rapid=radiationEquipmentProfile({...p,projectile:'bullet',weaponType:'smg'}),heavy=radiationEquipmentProfile(p),secondary=radiationEquipmentProfile(p,true);assert.ok(rapid.decay<heavy.decay&&rapid.peak<heavy.peak);assert.equal(secondary.flecks,0);assert.ok(secondary.slits<heavy.slits&&secondary.decay<heavy.decay);v.dispose();v.dispose();disposeEquipmentModel(rig.group);
});
test('shared device geometry survives another live weapon release and is disposed with the last owner',()=>{
 const a=look('pilot'),one=createEquipmentWeapon('pilot',a.weapon,a),two=createEquipmentWeapon('pilot',a.weapon,a),x=new RadiationEquipment(one.group,a.weapon),y=new RadiationEquipment(two.group,a.weapon),geometry=(find(two.group,'radiation-contained-slits-and-fallout')[0]as THREE.Mesh).geometry;let released=0;geometry.addEventListener('dispose',()=>released++);x.dispose();assert.equal(released,0);y.shot();y.update(.1,1/60);assert.equal(released,0);y.dispose();assert.equal(released,1);disposeEquipmentModel(one.group);disposeEquipmentModel(two.group);
});

test('an inactive mech rig gets its chamber mounts before a normal mode visibility switch',()=>{
 const appearance=look('mech'),rig=createEquipmentWeapon('mech',appearance.weapon,appearance),hiddenView=new THREE.Group();hiddenView.visible=false;hiddenView.add(rig.group);const visual=new RadiationEquipment(rig.group,appearance.weapon);assert.equal(visual.groups.length,2);hiddenView.visible=true;visual.shot();visual.update(.05,1/60);assert.ok(visual.groups.every(g=>g.visible));visual.dispose();disposeEquipmentModel(rig.group);
});

test('shared shot notification reaches only the bound weapon and schedules Radiation audio once',()=>{
 const scene=new THREE.Scene(),layer=createGameElements(scene,new THREE.PerspectiveCamera()),appearance=look('pilot'),a=createEquipmentWeapon('pilot',appearance.weapon,appearance),b=createEquipmentWeapon('pilot',appearance.weapon,appearance);scene.add(a.group,b.group);layer.audio.setEnabled(false);layer.weapon(a.group,appearance.weapon);layer.weapon(b.group,appearance.weapon);const audio:string[]=[];layer.audio.shot=(element)=>{audio.push(element);};layer.audio.flight=()=>{};
 layer.shot(createWeaponSpec('rocket','radiation','pilot'),'pilot',a.group);assert.deepEqual(audio,['radiation']);const fired=find(a.group,'radiation-contained-slits-and-fallout')[0]as THREE.InstancedMesh,idle=find(b.group,'radiation-contained-slits-and-fallout')[0]as THREE.InstancedMesh;assert.ok(fired.count>idle.count,'only the authoritative shot root gets discharge grains');layer.release(a.group);assert.equal(find(a.group,'radiation-shielded-isotope-insert').length,0);assert.equal(find(b.group,'radiation-shielded-isotope-insert').length,1);layer.dispose();disposeEquipmentModel(a.group);disposeEquipmentModel(b.group);
});

test('secondary Radiation actually brightens and decays after a shot, while physical shielding participates in ink',()=>{
 const a=look('pilot');a.weapon={...a.weapon,element:'fire',secondaryElement:'radiation'};const rig=createEquipmentWeapon('pilot',a.weapon,a),v=new RadiationEquipment(rig.group,a.weapon);v.update(1,1/60);const mesh=find(rig.group,'radiation-contained-slits-and-fallout')[0]as THREE.InstancedMesh,idle=Array.from(mesh.instanceColor!.array);v.shot();const peak=Array.from(mesh.instanceColor!.array);assert.notDeepEqual(peak,idle);assert.ok(peak[0]>idle[0]);assert.equal(v.diagnostics.devices[0].flecks,0);assert.equal(mesh.userData.comicOverlay,true);for(const g of v.groups)for(const child of g.children)if(child!==mesh){assert.equal(child.userData.comicOverlay,undefined);assert.equal(child.userData.presentationOnly,true);}
 for(let i=1;i<=80;i++)v.update(1+i/60,1/60);assert.notDeepEqual(Array.from(mesh.instanceColor!.array),peak);v.dispose();disposeEquipmentModel(rig.group);
});

test('a disconnected high detail in a batched mesh cannot make a pilot chamber float',()=>{
 const a=look('pilot'),rig=createEquipmentWeapon('pilot',a.weapon,a),one=new THREE.BoxGeometry(.04,.04,.04).translate(-1,2,-1),two=new THREE.BoxGeometry(.04,.04,.04).translate(1,0,1),merged=mergeGeometries([one,two]);one.dispose();two.dispose();const packed=new THREE.Mesh(merged,new THREE.MeshBasicMaterial());rig.barrels[0].add(packed);const v=new RadiationEquipment(rig.group,a.weapon);assert.equal(v.groups.length,1);assert.ok(v.groups[0].userData.radiationMount.clearance<.4,'actual support stays on the weapon, not the far batch maximum at y=2');v.dispose();disposeEquipmentModel(rig.group);
});

test('primary firing retains sulfur rear viewports around smaller ivory cores',()=>{
 const a=look('mech'),rig=createEquipmentWeapon('mech',a.weapon,a),v=new RadiationEquipment(rig.group,a.weapon);v.shot();for(const o of find(rig.group,'radiation-contained-slits-and-fallout')){const mesh=o as THREE.InstancedMesh;const n=v.diagnostics.devices[0].slits,c=mesh.instanceColor!.array;assert.ok(c[n*3+2]<c[n*6+2]*.3,'rear yellow window cannot become the ivory core');assert.ok(c[n*3]>c[n*3+2]*8);assert.ok(mesh.count<=13);}v.dispose();disposeEquipmentModel(rig.group);
});
