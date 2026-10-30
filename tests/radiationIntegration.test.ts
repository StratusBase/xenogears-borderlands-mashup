import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import ts from 'typescript';
import * as THREE from 'three';
import {applyEnemyDamage} from '../src/core/combat.ts';
import {createProgression,seededRandom,rollItem} from '../src/core/index.ts';
import {applyStatus,createStatusState,getStatusModifiers} from '../src/core/statusEffects.ts';
import {elementColors,createWeaponSpec} from '../src/core/arsenal.ts';
import {rollEnemySupplies} from '../src/core/recovery.ts';
import {rollCashValue} from '../src/core/economy.ts';
import {createEnemyBrain,staggerEnemy} from '../src/encounter/enemyBehavior.ts';
import {GamePresentation} from '../src/rendering/quality/GamePresentation.ts';
import {ElementalPresentation} from '../src/rendering/quality/elementalPresentation.ts';
import {ComposedElementalPresentation} from '../src/rendering/quality/shared/composedPresentation.ts';
import type {RadiationElementResponse} from '../src/rendering/quality/radiation/presentation.ts';

let documentBefore:PropertyDescriptor|undefined;
before(()=>{documentBefore=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},clearRect(){},fillText(){}})})}});});
after(()=>{if(documentBefore)Object.defineProperty(globalThis,'document',documentBefore);else Reflect.deleteProperty(globalThis,'document');});
const css=registerHooks({load(url,context,next){return url.endsWith('.css')?{format:'module',source:'',shortCircuit:true}:next(url,context);}});
const {Game}=await import('../src/game.ts');css.deregister();
const oldCode=readFileSync(new URL('./fixtures/radiationHurtEnemyBefore.txt',import.meta.url),'utf8').replace('private hurtEnemy(','function beforeHurtEnemy(');
const output=ts.transpileModule(oldCode,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const beforeHurtEnemy=new Function('THREE','applyEnemyDamage','getStatusModifiers','staggerEnemy','rollEnemySupplies','rollCashValue','rollItem','elementColors',output+'\nreturn beforeHurtEnemy;')(THREE,applyEnemyDamage,getStatusModifiers,staggerEnemy,rollEnemySupplies,rollCashValue,rollItem,elementColors);

function replay(before:boolean,enabled:boolean,nested:boolean,irradiated=true,cause?:'radiation'){
 const game=Object.create(Game.prototype)as any,events:unknown[]=[],drops:unknown[]=[],bursts:number[]=[],pulses:any[]=[],lineChecks:unknown[]=[],all:any[]=[];let rngCalls=0;
 const rng=seededRandom(37391);
 function actor(id:number,x:number,z:number,hp=100){const mesh=new THREE.Group();mesh.position.set(x,0,z);const a={id,mesh,health:hp,maxHealth:hp,shield:0,maxShield:0,heavy:false,role:'rusher',brain:createEnemyBrain('rusher',false,id),statuses:createStatusState(),statusEffects:new Map(),statusCoatings:new Map(),bars:{update(){},dispose(){}},visual:{dispose(){mesh.removeFromParent();}}};all.push(a);return a;}
 const source=actor(1,0,0),near=actor(2,2,0,nested?10:100),blocked=actor(3,0,-3),far=actor(4,6,0),edge=actor(5,5,0);near.shield=near.maxShield=nested?0:4;
 if(irradiated)applyStatus(source.statuses,'radiation',20,10);if(nested)applyStatus(near.statuses,'radiation',20,5);
 const dummy=actor(-1,30,0);Object.assign(game,{enemies:[source,near,blocked,far,edge],testDummy:dummy,time:20,progression:createProgression(),waveActive:false,combatRandom:()=>{rngCalls++;return rng();},
  presentation:{enemyHit(){},release(){},handlesPulse:()=>enabled,confirmedPulse:(e:any)=>{pulses.push({point:e.point.toArray(),energy:e.energy,radius:e.radius,recipients:e.recipients.map((r:any)=>({id:r.target===near.mesh?2:all.find(a=>a.mesh===r.target)?.id,point:r.point.toArray(),exposure:r.exposure}))});return true;}},
  measure:(e:unknown)=>events.push(structuredClone(e)),emitEncounter:(e:unknown)=>events.push(structuredClone(e)),burst:(_p:unknown,_c:unknown,n:number)=>bursts.push(n),
  clearLine:(a:THREE.Vector3,b:THREE.Vector3)=>{lineChecks.push([a.toArray(),b.toArray()]);return b.z!==-3;},
  addCashDrop:(amount:number,at:THREE.Vector3)=>drops.push({cash:amount,at:at.toArray()}),addHealthDrop:(at:THREE.Vector3)=>drops.push({health:true,at:at.toArray()}),
  addDrop:(item:any,at:THREE.Vector3)=>{const{id,...data}=item;drops.push({item:data,at:at.toArray()});},showEnemyDamage:(a:any,damage:number)=>events.push({shown:a.id,damage}),save(){},
 });game.hurtEnemy=before?beforeHurtEnemy:(Game.prototype as any).hurtEnemy;
 const result=game.hurtEnemy(source,100,cause,false,'status');
 return{combat:{result,events,drops,rngCalls,lines:lineChecks,kills:game.progression.kills,wave:game.progression.wave,vitals:all.map(a=>({id:a.id,health:a.health,shield:a.shield,statuses:structuredClone(a.statuses)})),remaining:game.enemies.map((a:any)=>a.id)},bursts,pulses};
}
for(const nested of [false,true])for(const enabled of[false,true])test(`actual death path preserves complete prior combat/loot/line checks and RNG calls; nested=${nested}, Enhanced=${enabled}`,()=>{
 const before=replay(true,false,nested),after=replay(false,enabled,nested);assert.deepEqual(after.combat,before.combat);
 if(enabled){assert.equal(after.bursts.filter(n=>n===14).length,0);assert.equal(after.pulses.length,nested?2:1);assert.ok(after.pulses.every(p=>p.radius===5));const parent=after.pulses.find(p=>p.energy===18)!;assert.ok(parent.recipients.some((r:any)=>r.id===5),'the exact five-meter boundary stays eligible');assert.ok(parent.recipients.every((r:any)=>r.id!==3&&r.id!==4),'blocked and out-of-range recipients excluded');assert.ok(parent.recipients.every((r:any)=>r.exposure===1),'no invented distance falloff');}
 else{assert.deepEqual(after.bursts,before.bursts);assert.deepEqual(after.pulses,[]);}
});
test('nonirradiated death stays unchanged and a radiation cause still triggers the existing pulse',()=>{
 const prior=replay(true,false,false,false),current=replay(false,true,false,false);assert.deepEqual(current.combat,prior.combat);assert.equal(current.pulses.length,0);
 const cause=replay(false,true,false,false,'radiation');assert.equal(cause.pulses.length,1);
});
test('normal Enhanced factory registers radiation exclusively, retains corrosion and cleans statuses on mode changes',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),weaponRoot=new THREE.Group();let active:ElementalPresentation|undefined;
 const owner=new GamePresentation({scene,camera,weaponRoot,comicRenderer:{outlineWidth:3},ballistics:{setPresentation(v){active=v as ElementalPresentation;}}});owner.setSoundEnabled(false);owner.setEnabled(true);
 assert.ok(active instanceof ComposedElementalPresentation);const module=active.responses.get('radiation')as RadiationElementResponse;assert.ok(module);assert.ok(active.corrosive);assert.equal(owner.handlesPulse('radiation'),true);
 const target=new THREE.Group(),armor=new THREE.Mesh(new THREE.BoxGeometry(1,1,.2),new THREE.MeshBasicMaterial());armor.userData.effectSurface='armor';target.add(armor);scene.add(target);
 active.impact({point:new THREE.Vector3(0,0,.1),normal:new THREE.Vector3(0,0,1),spec:createWeaponSpec('rocket','radiation'),phase:'contact',radius:.3,energy:50,target});assert.equal(active.impacts.activeCount,0);assert.equal(module.radiation.events.length,0);
 const status=owner.status(target,'radiation')!;assert.equal(status,owner.status(target,'radiation'));assert.equal(owner.diagnostics.statuses,1);
 assert.equal(owner.confirmedPulse({element:'radiation',point:new THREE.Vector3(0,1.5,0),radius:5,energy:18,recipients:[{target,point:new THREE.Vector3(0,0,.1),normal:new THREE.Vector3(0,0,1),exposure:1}]}),true);
 assert.equal(module.radiation.events.filter(e=>e.role==='pulse').length,1);assert.equal(module.radiation.events[1].lobes,0);owner.setEnabled(false);assert.equal(owner.handlesPulse('radiation'),false);assert.equal(owner.confirmedPulse({element:'radiation',point:new THREE.Vector3(),radius:5,energy:18,recipients:[]}),false);assert.equal(module.radiation.diagnostics.residues,0);owner.dispose();
});

test('production mixed carriers retain their exact primary/secondary identity and casing while replacing owned payloads once',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 const owner=new GamePresentation({scene,camera,weaponRoot:new THREE.Group(),comicRenderer:{outlineWidth:3},ballistics:{setPresentation(){}}});owner.setSoundEnabled(false);owner.setEnabled(true);
 const active=(owner as any).elements as ComposedElementalPresentation;
 for(const primary of ['radiation','fire','corrosive']as const)for(const secondary of ['radiation','fire','corrosive']as const){if(primary===secondary)continue;const spec=Object.freeze({...createWeaponSpec('rocket',primary),secondaryElement:secondary});const root=active.projectile(spec,'ironvale');assert.equal(root.userData.element,primary);assert.equal(root.userData.secondaryElement,secondary);assert.deepEqual(root.userData.visualElements,[primary,secondary]);let isotope=0;root.traverse(o=>{if(o.name==='radiation-compact-isotope-core')isotope++;assert.notEqual(o.name,'quality-primary-radiation-payload');assert.notEqual(o.name,'quality-secondary-radiation-payload');});assert.equal(isotope,Number(primary==='radiation'||secondary==='radiation'));assert.ok(root.getObjectByName('quality-physical-carrier'));const pose=root.matrix.clone();active.updateProjectile(root,1/60,.2);assert.deepEqual(root.matrix,pose);root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});}
 owner.dispose();
});

test('production radiation equipment preserves pilot/mech muzzles and borrowed surfaces across release and rebind',async()=>{
 const {createEquipmentWeapon,disposeEquipmentModel}=await import('../src/rendering/equipmentModels.ts');const {resolveEquipmentAppearance}=await import('../src/core/appearance.ts');
 for(const mode of ['pilot','mech']as const){const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),look=resolveEquipmentAppearance(createProgression(),mode);look.weapon={...look.weapon,equipped:true,element:'radiation',secondaryElement:'fire'};const rig=createEquipmentWeapon(mode,look.weapon,look);scene.add(rig.group);rig.group.position.set(2,3,4);rig.group.rotation.set(.2,.4,.1);rig.group.updateWorldMatrix(true,true);const muzzles=rig.muzzles.map(m=>m.getWorldPosition(new THREE.Vector3()).toArray()),originals:{mesh:THREE.Mesh;geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[];raycast:THREE.Mesh['raycast']}[]=[];rig.group.traverse(o=>{if(o instanceof THREE.Mesh)originals.push({mesh:o,geometry:o.geometry,material:o.material,raycast:o.raycast});});
 let layer:ComposedElementalPresentation|undefined;const owner=new GamePresentation({scene,camera,weaponRoot:new THREE.Group(),comicRenderer:{outlineWidth:3},ballistics:{setPresentation(p){layer=p as ComposedElementalPresentation;}}});owner.setSoundEnabled(false);owner.setEnabled(true);
 for(let cycle=0;cycle<2;cycle++){layer!.weapon(rig.group,look.weapon);assert.ok(rig.group.getObjectByName('radiation-shielded-isotope-insert'));for(let i=0;i<30;i++)layer!.update(1/60,i/60,false,createWeaponSpec('bullet','radiation',mode),mode);assert.deepEqual(rig.muzzles.map(m=>m.getWorldPosition(new THREE.Vector3()).toArray()),muzzles);for(const s of originals){assert.equal(s.mesh.geometry,s.geometry);/* The unchanged generic Fire fallback temporarily owns its tagged chamber material. */if(s.mesh.userData.equipmentElementSurface!=='fire')assert.equal(s.mesh.material,s.material);assert.equal(s.mesh.raycast,s.raycast);}layer!.release(rig.group);for(const s of originals)assert.equal(s.mesh.material,s.material,'release restores every borrowed source, including the generic Fire fallback');assert.equal(rig.group.getObjectByName('radiation-shielded-isotope-insert'),undefined);}
 owner.dispose();disposeEquipmentModel(rig.group);}
});
