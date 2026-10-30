import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import ts from 'typescript';
import * as THREE from 'three';
import {applyEnemyDamage,shieldAdjustedDamage} from '../src/core/combat.ts';
import {seededRandom,createProgression} from '../src/core/index.ts';
import {applyStatus,createStatusState,getStatusModifiers} from '../src/core/statusEffects.ts';
import {createWeaponSpec,getWeaponElements,getHitStatusChance,getHitStatusPower,elementColors,type WeaponSpec} from '../src/core/arsenal.ts';
import {createEnemyBrain} from '../src/encounter/enemyBehavior.ts';
import {GamePresentation} from '../src/rendering/quality/GamePresentation.ts';
import {ComposedElementalPresentation} from '../src/rendering/quality/shared/composedPresentation.ts';
import {createGameElementsBeforeShock} from '../src/rendering/quality/gameElements.ts';
import type {ShockElementResponse} from '../src/rendering/quality/shock/module.ts';
import {resolveEquipmentAppearance} from '../src/core/appearance.ts';
import {createEquipmentWeapon,disposeEquipmentModel} from '../src/rendering/equipmentModels.ts';
import {updateEquipmentEffects} from '../src/rendering/equipmentEffects.ts';
import {ElementalImpacts} from '../src/rendering/quality/elementalImpacts.ts';

let documentBefore:PropertyDescriptor|undefined;
before(()=>{documentBefore=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},clearRect(){},fillText(){}})})}});});
after(()=>{if(documentBefore)Object.defineProperty(globalThis,'document',documentBefore);else Reflect.deleteProperty(globalThis,'document');});
const css=registerHooks({load(url,context,next){return url.endsWith('.css')?{format:'module',source:'',shortCircuit:true}:next(url,context);}});
const {Game}=await import('../src/game.ts');css.deregister();
const oldCode=readFileSync(new URL('./fixtures/shockOnBallisticHitBefore.txt',import.meta.url),'utf8').replace('private onBallisticHit(','function beforeHit(');
const output=ts.transpileModule(oldCode,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const beforeHit=new Function('THREE','getWeaponElements','getHitStatusChance','applyStatus','getHitStatusPower','getStatusModifiers','shieldAdjustedDamage','elementColors',output+'\nreturn beforeHit;')(THREE,getWeaponElements,getHitStatusChance,applyStatus,getHitStatusPower,getStatusModifiers,shieldAdjustedDamage,elementColors);
function replay(prior:boolean,enabled:boolean,blocked:boolean,heavy:boolean,secondary:boolean){
 const game=Object.create(Game.prototype)as any,rng=seededRandom(37391),damage:unknown[]=[],shown:unknown[]=[],procs:unknown[]=[],lines:unknown[]=[],tracers:unknown[]=[],chains:any[]=[];let draws=0;
 const actor=(id:number,x:number,z:number)=>{const mesh=new THREE.Group();mesh.position.set(x,0,z);mesh.rotation.y=.3;return{id,mesh,health:1000,maxHealth:1000,shield:id===2?9:3,maxShield:9,heavy:id===1&&heavy,brain:createEnemyBrain('rusher',false,id),statuses:createStatusState()};};
 const source=actor(1,0,0),near=actor(2,1.8,0),occluded=actor(3,.8,-2),edge=actor(4,6,0),far=actor(5,7,0),dummy=actor(-1,30,0),actors=[source,near,occluded,edge,far];
 Object.assign(game,{enemies:actors,testDummy:dummy,time:20,yaw:0,combatRandom:()=>{draws++;return rng();},onEvaluationProc:(p:unknown)=>procs.push(structuredClone(p)),
  clearLine:(a:THREE.Vector3,b:THREE.Vector3)=>{lines.push([a.toArray(),b.toArray()]);return !blocked&&b.z!==-2;},
  hurtTarget:(target:typeof source,amount:number,cause?:string,critical?:boolean)=>{damage.push({id:target.id,amount,cause,critical});return applyEnemyDamage(target,amount);},
  showEnemyDamage:(target:typeof source,amount:number,critical:boolean,cause?:string)=>shown.push({id:target.id,amount,critical,cause}),
  tracer:(a:THREE.Vector3,b:THREE.Vector3)=>tracers.push([a.toArray(),b.toArray()]),
  presentation:{confirmedShockChain:(e:any)=>{if(enabled)chains.push({id:actors.find(a=>a.mesh===e.target)?.id,start:e.start.toArray(),end:e.end.toArray(),energy:e.energy,exposure:e.exposure});return enabled;}},
 });
 const spec=Object.freeze({...createWeaponSpec('bullet',secondary?'fire':'shock'),secondaryElement:secondary?'shock' as const:undefined,statusChance:1});
 const hit={targetId:1,point:new THREE.Vector3(0,1.5,.1),direction:new THREE.Vector3(0,0,-1),damage:61,critical:true,spec};
 (prior?beforeHit:(Game.prototype as any).onBallisticHit).call(game,hit);
 return{combat:{damage,shown,procs,lines,draws,vitals:actors.map(a=>({id:a.id,health:a.health,shield:a.shield,statuses:structuredClone(a.statuses)}))},tracers,chains};
}
for(const enabled of [false,true])for(const blocked of [false,true])for(const heavy of [false,true])for(const secondary of [false,true])test(`actual Shock hit preserves prior damage, recipients, procs, cover and RNG; Enhanced=${enabled}, blocked=${blocked}, heavy=${heavy}, secondary=${secondary}`,()=>{
 const a=replay(true,false,blocked,heavy,secondary),b=replay(false,enabled,blocked,heavy,secondary);assert.deepEqual(b.combat,a.combat);
 if(enabled&&!blocked){assert.equal(b.chains.length,1);assert.equal(b.chains[0].id,2);assert.equal(b.tracers.length,0);const applied=(b.combat.damage as {id:number;amount:number}[]).find(e=>e.id===2)!;assert.equal(b.chains[0].energy,applied.amount);assert.equal(b.chains[0].exposure,applied.amount/61);}
 else{assert.deepEqual(b.tracers,a.tracers);assert.equal(b.chains.length,0);}
});
function owner(){const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();let layer:ComposedElementalPresentation|undefined;const presentation=new GamePresentation({scene,camera,weaponRoot:new THREE.Group(),comicRenderer:{outlineWidth:3},ballistics:{setPresentation(p){layer=p as ComposedElementalPresentation;}}});presentation.setSoundEnabled(false);presentation.setEnabled(true);return{scene,camera,presentation,get layer(){return layer!;}};}
test('normal default composes approved Shock once alongside other effects and retains Legacy chain fallback',()=>{
 const f=owner(),otherModules=[...f.layer.responses.keys()].filter(e=>e!=='shock');assert.ok(f.layer.responses.has('shock'));assert.ok(f.layer.corrosive);
 const shock=(f.layer.responses.get('shock')as ShockElementResponse).shock,root=new THREE.Group(),armor=new THREE.Mesh(new THREE.BoxGeometry(1,1,.2),new THREE.MeshBasicMaterial());armor.userData.effectSurface='armor';root.add(armor);f.scene.add(root);
 const calls:string[]=[];f.layer.audio.impact=(element)=>{calls.push(element);};const spec=createWeaponSpec('sticky','shock'),point=new THREE.Vector3(0,0,.1);
 f.layer.impact({target:root,point,normal:new THREE.Vector3(0,0,1),spec,radius:2.5,phase:'detonate',energy:70});assert.equal(shock.diagnostics.capacitorBlades,8);assert.deepEqual(calls,['shock']);assert.equal(f.layer.impacts.activeCount,0);
 const event={start:new THREE.Vector3(0,0,2),end:point,target:root,spec,energy:7,exposure:.1};assert.equal(f.presentation.confirmedShockChain(event),true);const chain=shock.events.at(-1)!;assert.equal(chain.role,'chain');assert.equal(chain.size.heavy,false);assert.ok(chain.size.reach<shock.events[0].size.reach*.3);
 f.presentation.setEnabled(false);assert.equal(f.presentation.confirmedShockChain(event),false);assert.equal(shock.diagnostics.bolts,0);
 f.presentation.setElementalFactory(createGameElementsBeforeShock);f.presentation.setEnabled(true);assert.equal(f.presentation.confirmedShockChain(event),false);assert.deepEqual([...f.layer.responses.keys()],otherModules);f.presentation.dispose();
});
test('mixed Shock impacts keep the original fallback element channel weight in either order',()=>{
 for(const primary of ['shock','ice']as const){const secondary=primary==='shock'?'ice':'shock',f=owner(),reference=new ElementalImpacts(new THREE.Scene()),spec:WeaponSpec={...createWeaponSpec('bullet',primary),secondaryElement:secondary};
  const event={point:new THREE.Vector3(0,1.5,0),normal:new THREE.Vector3(0,0,1),spec,radius:.3,phase:'contact' as const,energy:25};
  f.layer.impact(event);reference.impact(event,new Set(['shock']));f.layer.impacts.update(.05);reference.update(.05);
  const matrices=(impacts:ElementalImpacts)=>{const pools=(impacts as unknown as {pools:Map<string,{mesh:THREE.InstancedMesh}>}).pools;return[...pools].map(([kind,p])=>({kind,count:p.mesh.count,matrices:Array.from(p.mesh.instanceMatrix.array)}));};
  assert.deepEqual(matrices(f.layer.impacts),matrices(reference));f.presentation.dispose();reference.dispose();
 }
});
test('zero-energy Cluster carrier notifications cannot replay a preceding heavy Shock sound or burst',()=>{
 const f=owner(),calls:string[]=[],spec=createWeaponSpec('cluster','shock');f.layer.audio.impact=e=>{calls.push(e);};
 const event={point:new THREE.Vector3(0,1.5,0),normal:new THREE.Vector3(0,1,0),spec,radius:2.5,phase:'detonate' as const,energy:70};f.layer.impact(event);assert.deepEqual(calls,['shock']);
 const shock=(f.layer.responses.get('shock')as ShockElementResponse).shock,count=shock.events.length;
 f.layer.impact({...event,stage:'cluster-burst',energy:0});assert.deepEqual(calls,['shock']);assert.equal(shock.events.length,count);f.presentation.dispose();
});
test('production Shock equipment retains every unrelated slot, borrowed mesh and pilot/mech muzzle through rebind and Legacy toggles',()=>{
 for(const mode of ['pilot','mech']as const){const f=owner(),look=resolveEquipmentAppearance(createProgression(),mode);look.weapon={...look.weapon,equipped:true,element:'shock',secondaryElement:undefined,projectile:'sticky'};for(const slot of ['shield','reactor','legs']as const)look[slot]={...look[slot],equipped:true,element:'shock'};
  const rig=createEquipmentWeapon(mode,look.weapon,look);f.scene.add(rig.group);rig.group.position.set(2,3,4);rig.group.rotation.set(.2,.4,.1);rig.group.updateWorldMatrix(true,true);
  const muzzles=rig.muzzles.map(m=>m.getWorldPosition(new THREE.Vector3()).toArray()),originals:{mesh:THREE.Mesh;geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[];matrix:number[]}[]=[];
  rig.group.traverse(o=>{if(o instanceof THREE.Mesh)originals.push({mesh:o,geometry:o.geometry,material:o.material,matrix:o.matrix.elements.slice()});});
  for(let cycle=0;cycle<2;cycle++){f.layer.weapon(rig.group,look.weapon);for(let i=0;i<30;i++)updateEquipmentEffects(rig.group,1/60,i/60);rig.group.updateWorldMatrix(true,true);assert.deepEqual(rig.muzzles.map(m=>m.getWorldPosition(new THREE.Vector3()).toArray()),muzzles);for(const s of originals){if(s.mesh.geometry!==s.geometry)assert.ok(s.mesh.userData.equipmentElementSurface==='shock'&&s.mesh.name.startsWith('element-transfer-band'));let node:THREE.Object3D|null=s.mesh,owner:unknown;while(node&&owner===undefined){owner=node.userData.visualOwner??node.userData.equipmentSlot;node=node.parent;}if(owner!=='weapon'||s.mesh.userData.equipmentElementSurface!=='shock')assert.equal(s.mesh.material,s.material);assert.deepEqual(s.mesh.matrix.elements,s.matrix);}rig.group.traverse(o=>{if(o.name==='elemental-shock-surface-presentation'){let node=o.parent;while(node&&node!==rig.group){assert.ok(!['shield','reactor','legs'].includes(node.userData.visualOwner??node.userData.equipmentSlot));node=node.parent;}}});f.layer.release(rig.group);for(const s of originals){assert.equal(s.mesh.material,s.material);assert.equal(s.mesh.geometry,s.geometry);}f.presentation.setEnabled(false);f.presentation.setEnabled(true);}
  f.presentation.dispose();disposeEquipmentModel(rig.group);
 }
});
