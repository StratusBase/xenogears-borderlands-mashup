import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import * as THREE from 'three';
import {createProgression} from '../src/core/index.ts';
import {resolveEquipmentAppearance} from '../src/core/appearance.ts';
import {createWeaponSpec} from '../src/core/arsenal.ts';
import {createEquipmentWeapon,createEquipmentCharacter,disposeEquipmentModel} from '../src/rendering/equipmentModels.ts';
import {createEncounterEnemy} from '../src/rendering/encounterEnemy.ts';
import {PlayerBallistics,type BallisticPresentation} from '../src/rendering/PlayerBallistics.ts';
import {updateEquipmentEffects} from '../src/rendering/equipmentEffects.ts';
import {GamePresentation,type PresentationEquipment} from '../src/rendering/quality/GamePresentation.ts';
import {ElementalPresentation} from '../src/rendering/quality/elementalPresentation.ts';

let originalDocument:PropertyDescriptor|undefined;
before(()=>{originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){}})})}});});
after(()=>{if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else Reflect.deleteProperty(globalThis,'document');});
function fixture(){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),weaponRoot=new THREE.Group();scene.add(camera);camera.add(weaponRoot);
 const pilotLook=resolveEquipmentAppearance(createProgression(),'pilot'),mechLook=resolveEquipmentAppearance(createProgression(),'mech');
 pilotLook.weapon={...pilotLook.weapon,equipped:true,element:'fire',projectile:'bullet'};
 mechLook.weapon={...mechLook.weapon,equipped:true,element:'corrosive',projectile:'slug'};
 const pilotRig=createEquipmentWeapon('pilot',pilotLook.weapon,pilotLook),mechRig=createEquipmentWeapon('mech',mechLook.weapon,mechLook),parkedMech=createEquipmentCharacter('mech',mechLook);
 weaponRoot.add(pilotRig.group,mechRig.group);scene.add(parkedMech);
 const binding:PresentationEquipment={pilotRig,mechRig,pilotLook,mechLook,parkedMech};
 const renderer={outlineWidth:3};let active:BallisticPresentation|undefined;
 const controller=new GamePresentation({scene,camera,weaponRoot,comicRenderer:renderer,ballistics:{setPresentation(value){active=value;}}});
 return{scene,camera,weaponRoot,binding,renderer,controller,get active(){return active;},dispose(){controller.dispose();for(const root of[pilotRig.group,mechRig.group,parkedMech])disposeEquipmentModel(root);}};
}
function resources(root:THREE.Object3D){const result:{mesh:THREE.Mesh;geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[];visible:boolean}[]=[];root.traverse(object=>{if(object instanceof THREE.Mesh)result.push({mesh:object,geometry:object.geometry,material:object.material,visible:object.visible});});return result;}
function assertResources(snapshot:ReturnType<typeof resources>){for(const entry of snapshot){assert.equal(entry.mesh.geometry,entry.geometry);assert.equal(entry.mesh.material,entry.material);assert.equal(entry.mesh.visible,entry.visible);}}

test('production presentation has no startup side effects and repeated legacy toggles restore original equipment and ink',()=>{
 const f=fixture();const originals=[f.binding.pilotRig.group,f.binding.mechRig.group,f.binding.parkedMech].map(resources);
 assert.equal(f.controller.mode,'legacy');assert.equal(f.active,undefined);assert.equal(f.renderer.outlineWidth,3);
 f.controller.equipment(f.binding);assert.equal(f.active,undefined);
 for(let i=0;i<3;i++){
  f.controller.setEnabled(true);assert.equal(f.controller.mode,'quality');assert.ok(f.active);assert.equal(f.renderer.outlineWidth,1.85);
  assert.equal(f.controller.diagnostics.equipment,3);assert.equal(f.controller.diagnostics.qualityAudioUnlocked,false);assert.equal(f.controller.diagnostics.elementalAudioUnlocked,false);
  f.controller.setEnabled(false);assert.equal(f.active,undefined);assert.equal(f.renderer.outlineWidth,3);originals.forEach(assertResources);
 }
 f.dispose();f.controller.dispose();f.controller.setEnabled(true);assert.equal(f.controller.mode,'legacy');
});

test('all enemy roles remain tracked, but only supported flanker receives the reference geometry and released actors stay released',()=>{
 const f=fixture();const actors=[createEncounterEnemy(1,'flanker'),createEncounterEnemy(2,'rusher'),createEncounterEnemy(3,'heavy',true)];actors.forEach(a=>f.scene.add(a.group));
 const originals=actors.map(a=>resources(a.group));
 actors.forEach((a,i)=>f.controller.enemy({root:a.group,id:i+1,role:(['flanker','rusher','heavy']as const)[i],heavy:i===2}));
 f.controller.setEnabled(true);
 assert.ok(actors[0].group.getObjectByName('reference-sentry'));assert.equal(actors[1].group.getObjectByName('reference-sentry'),undefined);assert.equal(actors[2].group.getObjectByName('reference-sentry'),undefined);
 assertResources(originals[1]);assertResources(originals[2]);assert.equal(f.controller.diagnostics.trackedEnemies,3);
 for(const actor of actors)f.controller.release(actor.group);
 assert.equal(f.controller.diagnostics.trackedEnemies,0);originals.forEach(assertResources);
 f.controller.setEnabled(false);f.controller.setEnabled(true);actors.forEach(a=>assert.equal(a.group.getObjectByName('reference-sentry'),undefined));
 f.dispose();actors.forEach(a=>a.dispose());
});

test('release before gear replacement prevents stale rigs and parked chassis from returning after a mode toggle',()=>{
 const f=fixture();f.controller.equipment(f.binding);f.controller.setEnabled(true);
 for(const root of[f.binding.pilotRig.group,f.binding.mechRig.group,f.binding.parkedMech])f.controller.release(root);
 f.controller.setEnabled(false);f.controller.setEnabled(true);
 assert.equal(f.controller.diagnostics.equipment,0);assert.equal(f.binding.parkedMech.getObjectByName('reference-mech-body'),undefined);assert.equal(f.binding.pilotRig.group.getObjectByName('reference-pilot-construction'),undefined);
 f.dispose();
});

test('automatic shared equipment presentation can become explicit and restore the exact original cartridge material',()=>{
 const f=fixture(),elements=new ElementalPresentation(f.scene,f.camera),root=f.binding.pilotRig.group;
 const originals=resources(root);const tagged=originals.filter(x=>x.mesh.userData.equipmentElementSurface);assert.ok(tagged.length>0);
 updateEquipmentEffects(root,.016,1);tagged.forEach(x=>assert.notEqual(x.mesh.material,x.material));
 elements.weapon(root,f.binding.pilotLook.weapon);updateEquipmentEffects(root,.016,2);
 elements.release(root);assertResources(originals);
 elements.dispose();f.dispose();
});

test('active quality projectiles continue their real collision after a live legacy toggle without restoring disposed effect roots',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),weaponRoot=new THREE.Group();scene.add(camera);camera.add(weaponRoot);
 const target=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());mesh.userData.enemyId=81;target.position.set(0,.5,-2);target.add(mesh);scene.add(target);
 const hits:number[]=[];const ballistics=new PlayerBallistics(scene,{targets:()=>[{id:81,root:target,radius:.85}],occluders:()=>[],hit:hit=>hits.push(hit.damage)});
 const controller=new GamePresentation({scene,camera,weaponRoot,ballistics,comicRenderer:{outlineWidth:3}});controller.setEnabled(true);
 const spec={...createWeaponSpec('bullet','fire'),speed:30,spread:0};ballistics.fire(new THREE.Vector3(0,.5,0),new THREE.Vector3(0,0,-1),spec,17);assert.equal(ballistics.activeCount,1);
 controller.setEnabled(false);assert.equal(ballistics.activeCount,1);ballistics.update(.2);assert.deepEqual(hits,[17]);assert.equal(ballistics.activeCount,0);
 assert.equal(scene.getObjectByName('elemental-quality-impacts'),undefined);assert.equal(scene.getObjectByName('quality-presentation-feedback'),undefined);
 controller.dispose();ballistics.clear();mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();
});

test('muted preference survives presentation toggles and paused updates freeze existing status animations',async()=>{
 const f=fixture();f.controller.setSoundEnabled(false);f.controller.setEnabled(true);await f.controller.unlockAudio();assert.equal(f.controller.diagnostics.audioUnlocked,false);
 const actor=createEncounterEnemy(19,'flanker');f.scene.add(actor.group);f.controller.enemy({root:actor.group,id:19,role:'flanker',heavy:false});
 const status=f.controller.status(actor.group,'ice')!;status.update(.1,1);
 const snapshots=()=>resources(actor.group).flatMap(({mesh})=>mesh instanceof THREE.InstancedMesh?[Array.from(mesh.instanceMatrix.array)]:[]);
 const before=snapshots();f.controller.update({dt:0,time:1,paused:true,mode:'pilot',distance:0,grounded:true,spec:createWeaponSpec('bullet','ice')});assert.deepEqual(snapshots(),before);assert.equal(f.controller.diagnostics.physicalVoices,0);assert.equal(f.controller.diagnostics.elementalVoices,0);
 f.controller.setEnabled(false);f.controller.setEnabled(true);assert.equal(f.controller.diagnostics.soundEnabled,false);
 f.controller.release(actor.group);f.dispose();actor.dispose();
});
