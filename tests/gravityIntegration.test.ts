import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createProgression,type Mode} from '../src/core/index';
import {resolveEquipmentAppearance} from '../src/core/appearance';
import {createWorkbenchWeapon,DEFAULT_WORKBENCH_CONFIG} from '../src/core/workbench';
import {getWeaponSpec,type ProjectileType} from '../src/core/arsenal';
import {createEquipmentCharacter,createEquipmentWeapon,disposeEquipmentModel,type WeaponRig} from '../src/rendering/equipmentModels';
import {updateEquipmentEffects} from '../src/rendering/equipmentEffects';
import {GamePresentation,type PresentationEquipment} from '../src/rendering/quality/GamePresentation';
import * as registry from '../src/rendering/quality/gameElements';

let originalDocument:PropertyDescriptor|undefined;
before(()=>{originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},clearRect(){},strokeRect(){},fillText(){}})})}});});
after(()=>{if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else Reflect.deleteProperty(globalThis,'document');});
const keys=(map:Map<unknown,unknown>)=>[...map.keys()].sort();

test('normal production registers equipment-only Gravity; its baseline removes only that capability',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),current=registry.createGameElements(scene,camera),baseline=registry.createGameElementsBeforeGravityEquipment(scene,camera);
 try{assert.deepEqual(keys(baseline.responses),keys(current.responses).filter(k=>k!=='gravity'));const gravity=current.responses.get('gravity')!;assert.equal(typeof gravity.equipment,'function');assert.equal(Reflect.get(gravity,'sync'),undefined);assert.equal(Reflect.get(gravity,'event'),undefined);assert.equal(gravity.status,undefined);assert.equal(gravity.decorateProjectile,undefined);assert.equal(gravity.confirmedPulse,undefined);assert.equal(scene.getObjectByName('gravity-well-presentation'),undefined);}finally{current.dispose();baseline.dispose();}
});

test('all production baselines retain Gravity defaults and explicit sibling options',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),options={fire:{full:false,hybrid:false},shock:{equipment:'legacy' as const}};
 const optional=(name:string):typeof registry.createGameElements[]=>{const factory=Reflect.get(registry,name);return typeof factory==='function'?[factory]:[];};
 for(const factory of [registry.createGameElements,registry.createGameElementsBeforeRadiation,registry.createGameElementsBeforeShock,registry.createGameElementsBeforeShockEquipment,registry.createGameElementsBeforeAdhesive,...optional('createGameElementsBeforeFire'),...optional('createGameElementsBeforeFireEquipment'),registry.createGameElementsBeforeGravityEquipment]){
  const layer=factory(scene,camera,options);try{const fire=layer.responses.get('fire');if(fire)assert.equal(Boolean(Reflect.get(fire,'fire').hybrid),false,factory.name);const shock=layer.responses.get('shock');if(shock)assert.equal(shock.equipment,undefined,factory.name);assert.equal(layer.responses.has('gravity'),factory!==registry.createGameElementsBeforeGravityEquipment,factory.name);}finally{layer.dispose();}
  const legacy=factory(scene,camera,{...options,gravity:{equipment:'legacy'}});try{assert.equal(legacy.responses.has('gravity'),false,factory.name);}finally{legacy.dispose();}
 }
});

function fixture(mode:Mode,delivery:ProjectileType,secondary:boolean){
 const state=createProgression();for(const target of ['pilot','mech']as const){const item=createWorkbenchWeapon({...DEFAULT_WORKBENCH_CONFIG,target,element:secondary?'fire':'gravity',secondaryElement:secondary?'gravity':'none',projectile:delivery,weaponType:delivery==='sticky'?'launcher':'rifle'},`gravity-integration-${target}`);state.inventory.push(item);state.loadouts[target].weapon=item.id;}
 const pilotLook=resolveEquipmentAppearance(state,'pilot'),mechLook=resolveEquipmentAppearance(state,'mech'),pilotRig=createEquipmentWeapon('pilot',pilotLook.weapon,pilotLook),mechRig=createEquipmentWeapon('mech',mechLook.weapon,mechLook),parkedMech=createEquipmentCharacter('mech',mechLook),binding:PresentationEquipment={pilotLook,mechLook,pilotRig,mechRig,parkedMech};
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),weaponRoot=new THREE.Group();scene.add(camera,parkedMech);camera.add(weaponRoot);weaponRoot.add(pilotRig.group,mechRig.group);const controller=new GamePresentation({scene,camera,weaponRoot,comicRenderer:{outlineWidth:3},ballistics:{setPresentation(){}}}),rig=mode==='pilot'?pilotRig:mechRig,spec=getWeaponSpec(state.inventory.find(i=>i.id===state.loadouts[mode].weapon));return{scene,controller,binding,rig,spec};
}
function muzzles(rig:WeaponRig){rig.group.updateWorldMatrix(true,true);return{parents:rig.muzzles.map(m=>m.parent),world:rig.muzzles.map(m=>m.matrixWorld.toArray()),local:rig.muzzles.map(m=>m.matrix.toArray()),homes:{barrels:rig.barrelHomes.map(p=>p.toArray()),breeches:rig.breechHomes.map(p=>p.toArray()),magazine:rig.magazineHome?.toArray(),bolt:rig.boltHome?.toArray(),supportHand:rig.supportHandHome?.toArray()}};}
function pulses(root:THREE.Object3D){const values:{index:number;pulse:number}[]=[];root.traverse(o=>{if(!(o instanceof THREE.Mesh)||o.name!=='gravity-equipment-dark-core')return;let assembly=o.parent;while(assembly&&assembly.name!=='weapon-barrel-assembly')assembly=assembly.parent;let index=-1;assembly?.traverse(n=>{if(n.name==='weapon-muzzle')index=n.userData.equipmentMuzzleIndex;});values.push({index,pulse:(o.material as THREE.ShaderMaterial).uniforms.pulse.value});});return values;}

test('normal GamePresentation preserves exact sockets, mixed slots, per-gun response and Legacy restoration',()=>{
 for(const mode of ['pilot','mech']as const)for(const delivery of ['bullet','sticky','beam']as const)for(const secondary of [false,true]){
  const f=fixture(mode,delivery,secondary),before=muzzles(f.rig),specBefore=structuredClone(f.spec),originals:{mesh:THREE.Mesh;geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[]}[]=[];f.rig.group.traverse(o=>{if(o instanceof THREE.Mesh)originals.push({mesh:o,geometry:o.geometry,material:o.material});});
  f.controller.equipment(f.binding);f.controller.setEnabled(true);assert.deepEqual(muzzles(f.rig),before);updateEquipmentEffects(f.rig.group,1/60,20);updateEquipmentEffects(f.binding.parkedMech,1/60,20);
  const index=mode==='mech'?1:0;f.controller.shot({mode,rig:f.rig,muzzleIndex:index,spec:f.spec});updateEquipmentEffects(f.rig.group,1/60,20.02);updateEquipmentEffects(f.binding.parkedMech,1/60,20.02);const values=pulses(f.rig.group);assert.equal(values.length,mode==='mech'?2:1);assert.ok(values.find(v=>v.index===index)!.pulse>.3);assert.ok(values.filter(v=>v.index!==index).every(v=>v.pulse===0));assert.ok(pulses(f.binding.parkedMech).every(v=>v.pulse===0));assert.deepEqual(f.spec,specBefore);assert.deepEqual(muzzles(f.rig),before);
  f.controller.setEnabled(false);assert.equal(pulses(f.rig.group).length,0);for(const o of originals){assert.equal(o.mesh.geometry,o.geometry);assert.equal(o.mesh.material,o.material);}assert.deepEqual(muzzles(f.rig),before);
  f.controller.setEnabled(true);assert.equal(pulses(f.rig.group).length,mode==='mech'?2:1);assert.deepEqual(muzzles(f.rig),before);f.controller.dispose();disposeEquipmentModel(f.binding.pilotRig.group);disposeEquipmentModel(f.binding.mechRig.group);disposeEquipmentModel(f.binding.parkedMech);
 }
});
