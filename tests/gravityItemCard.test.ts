import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createProgression,type Item} from '../src/core/index';
import {createWeaponSpec,getWeaponSpec,type ElementType,type ProjectileType} from '../src/core/arsenal';
import {buildItemCard} from '../src/core/itemCard';
import {GravityCombat} from '../src/core/effects/gravity/combat';
import {GRAVITY_PROTOTYPE} from '../src/core/effects/gravity/profile';

const css=registerHooks({load(url,context,next){return url.endsWith('.css')?{format:'module',source:'',shortCircuit:true}:next(url,context);}});
const {GameUI}=await import('../src/ui');const {WeaponWorkbench}=await import('../src/ui/weaponWorkbench');css.deregister();

function weapon(delivery:ProjectileType,primary:ElementType='gravity',secondary?:Exclude<ElementType,'kinetic'>):Item{
 const item=createProgression().inventory.find(i=>i.slot==='weapon'&&i.target==='pilot')!;
 return{...item,stats:{damage:60,fireRate:5,magazine:10,reload:2},weapon:{...createWeaponSpec(delivery,primary),secondaryElement:secondary,statusChance:.35}};
}

test('Gravity ordnance cards describe deterministic wells and variable crush without changing direct weapon figures or saved specs',()=>{
 for(const delivery of ['sticky','rocket','orb']as const)for(const secondary of [false,true]){
  const item=weapon(delivery,secondary?'fire':'gravity',secondary?'gravity':undefined),copy=structuredClone(item),card=buildItemCard(item),status=card.statuses.find(s=>s.element==='gravity')!;
  assert.equal(status.chanceDisplay,'Every detonation');assert.equal(status.chancePercent,100);assert.equal(status.chanceDelta,null);
  assert.equal(status.duration,GRAVITY_PROTOTYPE.duration);assert.equal(status.durationDisplay,'4.5 s active');assert.equal(status.gravityWell?.deployment,GRAVITY_PROTOTYPE.deploymentDuration);
  assert.equal(status.gravityWell?.secondaryPower,secondary?.62:1);assert.equal(status.dps,null);assert.equal(status.dpsDelta,null);
  assert.match(status.effect,/Pull.*lift.*hold.*0\.28 s deploy/);assert.match(status.description,/remain hittable/);assert.match(status.description,/shot energy and distance exposure/);assert.match(status.description,/every 0\.5 s/);
  assert.doesNotMatch(status.effect,/65% move|3 s/);assert.doesNotMatch(status.description,/18.*DPS|per trigger;.*refresh/);
  if(secondary)assert.match(status.description,/62% crush power.*same reach and control/);
  assert.equal(card.weapon!.damagePerTrigger,secondary?51:60);assert.equal(card.weapon!.burstDps.value,secondary?255:300);assert.deepEqual(item,copy);
 }
});

test('card qualification matches the existing runtime policy across every delivery, zero blast and primary/secondary channel',()=>{
 const runtime=new GravityCombat({targets:()=>[],move:(_t,p)=>p,visible:()=>true,clearCenter:()=>true,clearSourcePath:()=>true,damage(){}});
 try{for(const delivery of ['bullet','slug','spike','ricochet','homing','sticky','orb','beam','scatter','rocket','disc','arc','cluster']as const)for(const secondary of [false,true])for(const blast of [undefined,0]){
  const item=weapon(delivery,secondary?'fire':'gravity',secondary?'gravity':undefined);if(blast===0)item.weapon!.blastRadius=0;
  const spec=getWeaponSpec(item),status=buildItemCard(item).statuses.find(s=>s.element==='gravity')!;
  assert.equal(!!status.gravityWell,runtime.qualifies(spec),`${delivery}/${secondary}/${blast}`);
 }}finally{runtime.dispose();}
});

test('unsupported Gravity cards retain their old proc chance, duration and movement description',()=>{
 for(const delivery of ['bullet','beam','cluster']as const){
  const card=buildItemCard(weapon(delivery)),status=card.status!;
  assert.equal(status.gravityWell,undefined);assert.equal(status.duration,3);assert.equal(status.effect,'Pull · 65% move · 3 s');assert.equal(status.dps,null);
  if(delivery!=='cluster'){assert.equal(status.chanceDisplay,'35%');assert.equal(status.chancePercent,35);}else assert.ok(status.chancePercent>0&&status.chancePercent<35);
 }
});

test('mixed Gravity changes only its row: every sibling keeps exact existing status values, text and direct weapon figures',()=>{
 for(const delivery of ['sticky','rocket','orb']as const)for(const other of ['fire','ice','radiation','corrosive','shock','adhesive']as const){
  const withGravity=buildItemCard(weapon(delivery,other,'gravity')),withoutGravity=buildItemCard(weapon(delivery,other,other==='fire'?'ice':'fire'));
  assert.deepEqual(withGravity.statuses.find(s=>s.element===other),withoutGravity.statuses.find(s=>s.element===other));
  assert.deepEqual(withGravity.weapon,withoutGravity.weapon);assert.deepEqual(withGravity.stats,withoutGravity.stats);assert.deepEqual(withGravity.secondary,withoutGravity.secondary);
 }
});

test('well cards never compare deterministic source creation against a proc chance or inherit false child-proc wording',()=>{
 const rocket=weapon('rocket'),bullet=weapon('bullet');assert.equal(buildItemCard(rocket,bullet).status!.chanceDelta,null);assert.equal(buildItemCard(bullet,rocket).status!.chanceDelta,null);
 rocket.weapon!.split={count:3,delay:.3,spread:.15};rocket.weapon!.secondaryElement='fire';const card=buildItemCard(rocket),gravity=card.statuses.find(s=>s.element==='gravity')!,fire=card.statuses.find(s=>s.element==='fire')!;
 assert.match(gravity.description,/One source per projectile detonation, not per trigger/);assert.doesNotMatch(gravity.description,/successful child proc|per-child chance/);assert.match(fire.description,/successful child proc/);
});

class NodeStub {
 children:NodeStub[]=[];className='';title='';style={setProperty(){}};classList={add(){}};private ownText='';
 set textContent(value:string){this.ownText=value;}get textContent():string{return this.ownText+this.children.map(c=>c.textContent).join(' ');}
 get childElementCount(){return this.children.length;}append(...nodes:NodeStub[]){this.children.push(...nodes);}setAttribute(){}
}
function titles(node:NodeStub):string[]{return[node.title,...node.children.flatMap(titles)];}
test('Workbench and inventory/loot renderers show well activation and active duration without chance or refresh labels',()=>{
 const before=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>new NodeStub(),createElementNS:()=>new NodeStub()}});
 try{for(const item of [weapon('rocket'),weapon('sticky','fire','gravity')]){
  const status=buildItemCard(item).statuses.find(s=>s.element==='gravity')!;
  const inventory=(GameUI.prototype as any).renderCardStatus.call({},status)as NodeStub,workbench=(WeaponWorkbench.prototype as any).statusStrip.call({},status)as NodeStub;
  for(const node of [inventory,workbench]){assert.match(node.textContent,/VARIABLE CRUSH/);assert.match(node.textContent,/Every detonation/);assert.match(node.textContent,/4\.5/);assert.doesNotMatch(node.textContent,/35%|65% move|CONTROL|chance/);assert.doesNotMatch(titles(node).join(' '),/Repeated procs refresh|Chance per impact/);}
 }
 const legacy=(GameUI.prototype as any).renderCardStatus.call({},buildItemCard(weapon('bullet')).status)as NodeStub;
 assert.match(legacy.textContent,/CONTROL/);assert.match(legacy.textContent,/35%.*chance/);assert.match(titles(legacy).join(' '),/Repeated procs refresh/);
 }finally{if(before)Object.defineProperty(globalThis,'document',before);else Reflect.deleteProperty(globalThis,'document');}
});
