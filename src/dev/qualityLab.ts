import '../style.css';
import './qualityLab.css';
import * as THREE from 'three';
import { Game } from '../game';
import { ElementalPresentation } from '../rendering/quality/elementalPresentation';
import { ElementalStatus } from '../rendering/quality/elementalSurfaces';
import type { BallisticPresentation } from '../rendering/PlayerBallistics';
import type { EncounterEvent } from '../encounter/contracts';
import { createProgression, getStats, seededRandom, type Progression, type Mode } from '../core/index';
import { createWorkbenchWeapon, DEFAULT_WORKBENCH_CONFIG } from '../core/workbench';
import { getWeaponSpec, type ElementType, type ProjectileType, type WeaponSpec, type WeaponType, type BrandId } from '../core/arsenal';
import { resolveEquipmentAppearance } from '../core/appearance';
import { renderQualityAudioPreview } from '../audio/qualityAudio';
import { QualityPresentation } from '../rendering/quality/presentation';
import { QualityPerformance } from '../rendering/quality/performance';
import { applyQualityInk } from '../rendering/quality/target';
import { createQualityStatusCoating } from '../rendering/quality/statusCoating';
import type { ElementCoating } from '../rendering/ElementCoating';
import type { WeaponRig } from '../rendering/equipmentModels';
import type { BallisticHit } from '../rendering/PlayerBallistics';

/** Dev-only bridge. Production integration uses QualityPresentation's explicit public API. */
interface ReviewEnemy {statuses:Record<string,{expiresAt:number}>;maxHealth:number;id:number;mesh:THREE.Group;heavy:boolean;role?:string;health:number;shield:number;statusEffects:Map<ElementType,{update(dt:number,time?:number):void;dispose():void}>;statusCoatings:Map<ElementType,ElementCoating>}
interface ReviewGame {
 scene:THREE.Scene;camera:THREE.PerspectiveCamera;renderer:THREE.WebGLRenderer;
 comicRenderer:{render():void;outlineWidth:number};world:{parkedMech:THREE.Group};
 progression:Progression;pilotRig:WeaponRig;mechRig:WeaponRig;weapon:THREE.Group;
 mode:Mode;screen:string;time:number;yaw:number;pitch:number;soundEnabled:boolean;
 lastFiredAt:number;lastMuzzleIndex:number;emptyAt:number;muzzle:THREE.Mesh;reloadUntil:number;reloadStartedAt:number;nextShot:number;
 bodies:Record<Mode,{ammo:number;reserve:number;heat:number;overheated:boolean}>;
 testDummy:ReviewEnemy;enemies:ReviewEnemy[];ui:{setScreen(screen:string,state:Progression,mode:Mode):void};
 jumpMotion:{height:number};trainingTargets:boolean;
 tone(frequency:number,duration:number):void;fire():void;reload():void;start(capture?:boolean):void;resume(capture?:boolean):void;switchMode():void;
 clearCombat():void;makeEnemy(x:number,z:number,heavy:boolean):ReviewEnemy;
 refreshEquipmentVisuals():void;disposeObject(root:THREE.Object3D):void;
 updateTargetEffects(enemy:ReviewEnemy,dt:number):void;
 onBallisticHit(hit:BallisticHit):void;
 manualEvaluation:boolean;combatRandom:()=>number;driveEvaluation(input:{fire?:boolean;yaw?:number;pitch?:number}):void;stepEvaluation(dt:number):void;
 ballistics:{clear():void;setPresentation(presentation?:BallisticPresentation):void;shotSequence:number;flash(point:THREE.Vector3,spec:WeaponSpec,radius:number):void};
}

const initial=createProgression();
for(const mode of ['pilot','mech'] as const){
 const item=createWorkbenchWeapon({...DEFAULT_WORKBENCH_CONFIG,target:mode,level:1,rarity:'common',projectile:mode==='mech'?'slug':'bullet'},`quality-reference-${mode}`);
 item.name=mode==='pilot'?'R / 07 — field rifle':'B / 12 — siege cannon';
 initial.inventory.push(item);initial.loadouts[mode].weapon=item.id;
}
const game=new Game(document.querySelector<HTMLElement>('#app')!,{initialProgression:initial,saveKey:'dust-steel.quality-review.v1',autoEncounters:false,trainingTargets:false,onEncounterEvent:handleEncounterEvent,evaluationDriver:true,presentation:'legacy'});
const g=game as unknown as ReviewGame;
let quality:QualityPresentation|null=null;
let elemental:ElementalPresentation|null=null;
let elementalEnabled=location.pathname.endsWith('elemental-lab.html');
let benchDrive=false,lastElementalTime=0;
let restoreInk:(()=>void)|null=null;
let enabled=false, frozen=false, sound=false, runningPair=false;
let selectedView='field';
let lastRender=performance.now(),previousPosition=g.camera.position.clone(),previousYaw=g.yaw,wasGrounded=true;
let lastReloadProgress=0;
const knownCoatings=new WeakSet<ElementCoating>();
const perf=new QualityPerformance(g.renderer);
const originalRender=g.comicRenderer.render.bind(g.comicRenderer);
const originalSwitch=g.switchMode.bind(g),originalTone=g.tone.bind(g);
g.tone=(frequency,duration)=>{if(!quality)originalTone(frequency,duration);};
const originalFire=g.fire.bind(g), originalReload=g.reload.bind(g), originalHit=g.onBallisticHit.bind(g);
const originalFlash=g.ballistics.flash.bind(g.ballistics), originalDispose=g.disposeObject.bind(g),originalRefresh=g.refreshEquipmentVisuals.bind(g);
const originalUpdateEffects=g.updateTargetEffects.bind(g);
const history:{point:number[];critical:boolean;damage:number;targetId:number;spec:WeaponSpec;at:number}[]=[];
const recentImpacts:{time:number;point:THREE.Vector3}[]=[];
function handleEncounterEvent(event:EncounterEvent){
 if(!quality)return;
 if(event.type==='enemy-phase'&&event.phase==='attack'){
  const enemy=g.enemies.find(candidate=>candidate.id===event.id);if(!enemy)return;
  quality.actorFire(enemy.mesh,g.time);
  if(event.role!=='rusher')quality.audio.play('fire',{mode:enemy.heavy?'mech':'pilot',distance:enemy.mesh.position.distanceTo(g.camera.position)});
 }
 if(event.type==='enemy-hit'){const enemy=g.enemies.find(candidate=>candidate.id===event.id);if(enemy)quality.actorHit(enemy.mesh,g.time);}
}
function impactOnce(event:{point:THREE.Vector3;normal?:THREE.Vector3;mode:Mode;kind:'metal'|'dust'|'shield';strength?:number}){
 if(!quality)return;
 while(recentImpacts.length&&g.time-recentImpacts[0].time>.035)recentImpacts.shift();
 if(recentImpacts.some(previous=>previous.point.distanceToSquared(event.point)<.0064))return;
 recentImpacts.push({time:g.time,point:event.point.clone()});if(recentImpacts.length>64)recentImpacts.shift();
 quality.impact(event);
}

function syncAssets(){
 if(!quality)return;
 const pilot=resolveEquipmentAppearance(g.progression,'pilot'),mech=resolveEquipmentAppearance(g.progression,'mech');
 quality.weapon(g.pilotRig,pilot.weapon,'pilot');quality.weapon(g.mechRig,mech.weapon,'mech');quality.mech(g.world.parkedMech);
 for(const enemy of g.enemies)if(!enemy.heavy&&(!enemy.role||enemy.role==='flanker'))quality.enemy(enemy.mesh,enemy.id,false);
 syncElemental();
}
function targets(){return[g.testDummy,...g.enemies];}
function clearStatuses(){
 for(const enemy of targets()){
  for(const coating of enemy.statusCoatings.values())coating.dispose();enemy.statusCoatings.clear();
  for(const effect of enemy.statusEffects.values())effect.dispose();enemy.statusEffects.clear();
 }
}
function syncElemental(){
 if(!elemental)return;
 const pilot=resolveEquipmentAppearance(g.progression,'pilot'),mech=resolveEquipmentAppearance(g.progression,'mech');
 elemental.weapon(g.pilotRig.group,pilot.weapon);elemental.weapon(g.mechRig.group,mech.weapon);elemental.weapon(g.world.parkedMech,mech.weapon);
}
function setElementalEnabled(value:boolean){
 clearStatuses();elemental?.dispose();elemental=null;g.ballistics.setPresentation(undefined);elementalEnabled=value;
 if(value&&enabled){elemental=new ElementalPresentation(g.scene,g.camera);g.ballistics.setPresentation(elemental);elemental.audio.setEnabled(sound);if(sound)void elemental.audio.unlock();syncElemental();}
 document.querySelector('#elemental-toggle')?.setAttribute('aria-pressed',String(value));
 const button=document.querySelector('#elemental-toggle');if(button)button.textContent=value?'Elemental quality on':'Original elemental effects';updateLabel();
}
function setEnabled(value:boolean){
 if(enabled===value)return;
 for(const enemy of targets()){
  for(const coating of enemy.statusCoatings.values())coating.dispose();enemy.statusCoatings.clear();
  for(const effect of enemy.statusEffects.values())effect.dispose();enemy.statusEffects.clear();
 }
 elemental?.dispose();elemental=null;g.ballistics.setPresentation(undefined);
 quality?.dispose();quality=null;restoreInk?.();restoreInk=null;enabled=value;recentImpacts.length=0;
 if(enabled){restoreInk=applyQualityInk(g.comicRenderer);quality=new QualityPresentation({scene:g.scene,camera:g.camera});quality.audio.setEnabled(sound);if(sound)void quality.audio.unlock();syncAssets();if(elementalEnabled)setElementalEnabled(true);}
 document.querySelector('#quality-toggle')?.setAttribute('aria-pressed',String(enabled));
 const toggle=document.querySelector('#quality-toggle');if(toggle)toggle.textContent=enabled?'Reference assets':'Original assets';
 updateLabel();
}
g.switchMode=()=>{const before=g.mode;originalSwitch();if(before!==g.mode){quality?.audio.play('mount',{mode:g.mode});previousPosition.copy(g.camera.position);}};
g.fire=()=>{const before=g.lastFiredAt,emptyBefore=g.emptyAt;originalFire();if(quality&&emptyBefore!==g.emptyAt&&g.lastFiredAt===before)quality.audio.play('dry',{mode:g.mode});if(quality&&g.lastFiredAt!==before){
 const item=g.progression.inventory.find(item=>item.id===g.progression.loadouts[g.mode].weapon);
 quality.fire({mode:g.mode,rig:g.mode==='pilot'?g.pilotRig:g.mechRig,muzzleIndex:g.lastMuzzleIndex,element:getWeaponSpec(item).element});
 elemental?.shot(getWeaponSpec(item),g.mode);
}};
g.reload=()=>{const before=g.reloadUntil;originalReload();if(quality&&g.reloadUntil!==before){lastReloadProgress=0;quality.reload(g.mode,'out');}};
g.onBallisticHit=hit=>{
 const target=g.enemies.find(enemy=>enemy.id===hit.targetId);const shielded=target&&target.shield>0;
 if(!elemental)impactOnce({point:hit.point,normal:hit.direction.clone().negate(),mode:g.mode,kind:shielded?'shield':'metal'});
 if(target)quality?.actorHit(target.mesh,g.time);
 history.push({point:hit.point.toArray(),critical:hit.critical,damage:hit.damage,targetId:hit.targetId,spec:structuredClone(hit.spec),at:g.time});if(history.length>2000)history.shift();
 originalHit(hit);
};
g.ballistics.flash=(point,spec,radius)=>{
 // Called by the actual ballistic collision, including terrain and cover.
 if(!elemental)impactOnce({point,mode:g.mode,kind:point.y<.2?'dust':'metal',strength:Math.max(.65,Math.min(1,radius))});originalFlash(point,spec,radius);
};
g.disposeObject=root=>{elemental?.release(root);quality?.release(root);originalDispose(root);};
g.refreshEquipmentVisuals=()=>{
 elemental?.release(g.pilotRig.group);elemental?.release(g.mechRig.group);elemental?.release(g.world.parkedMech);
 quality?.release(g.pilotRig.group);quality?.release(g.mechRig.group);quality?.release(g.world.parkedMech);
 originalRefresh();syncAssets();
};
g.updateTargetEffects=(enemy,dt)=>{
 originalUpdateEffects(enemy,dt);
 if(elemental){
  for(const[element,effect]of enemy.statusEffects){
   if(effect instanceof ElementalStatus){const remaining=enemy.statuses[element]?.expiresAt-g.time;effect.setIntensity(Math.min(1,Math.max(0,remaining/.2)));continue;}
   effect.dispose();enemy.statusCoatings.get(element)?.dispose();enemy.statusCoatings.delete(element);
   const visual=elemental.status(enemy.mesh,element);visual.update(dt,g.time);enemy.statusEffects.set(element,visual);
  }return;
 }
 if(!quality||!enemy.mesh.getObjectByName('reference-sentry'))return;
 for(const [element,coating]of enemy.statusCoatings){
  if(knownCoatings.has(coating))continue;
  coating.dispose();const replacement=createQualityStatusCoating(enemy.mesh,element);knownCoatings.add(replacement);enemy.statusCoatings.set(element,replacement);
 }
};

function pointCamera(position:readonly number[],target:readonly number[]){
 g.camera.position.set(position[0],position[1],position[2]);
 g.camera.lookAt(target[0],target[1],target[2]);g.pitch=g.camera.rotation.x;g.yaw=g.camera.rotation.y;
 previousPosition.copy(g.camera.position);previousYaw=g.yaw;
}
function setView(view:string){
 selectedView=view;
 g.mode=view==='cockpit'?'mech':'pilot';
 g.bodies[g.mode].heat=0;g.bodies[g.mode].overheated=false;g.reloadUntil=0;g.nextShot=g.time;
 g.world.parkedMech.position.set(4.5,0,-2.5);g.world.parkedMech.rotation.y=-.38;
 const enemy=g.enemies[0];if(enemy){enemy.mesh.position.set(-2.2,0,-.8);enemy.mesh.rotation.y=.12;}
 if(view==='mech')pointCamera([9,2.9,6.5],[4.5,3,-2.5]);
 else if(view==='enemy')pointCamera([-2.2,1.8,3.8],[-2.2,1.45,-.8]);
 else if(view==='weapon')pointCamera([0,1.8,8],[0,1.9,-15]);
 else if(view==='cockpit')pointCamera([0,4.4,8],[0,3,-15]);
 else pointCamera([0,1.8,8],[0,2.1,-4]);
 g.ui.setScreen('none',g.progression,g.mode);
 g.screen=frozen?'pause':'none';updateLabel();
}
function setFrozen(value:boolean){frozen=value;g.screen=frozen?'pause':'none';g.ui.setScreen('none',g.progression,g.mode);document.querySelector('#quality-freeze')?.setAttribute('aria-pressed',String(value));}
function setPayload(element:ElementType,projectile:ProjectileType='bullet',weaponType:WeaponType='rifle',secondaryElement:ElementType|'none'='none',brand:BrandId='ironvale'){
 const mode=g.mode;const oldId=g.progression.loadouts[mode].weapon!;
 const item=createWorkbenchWeapon({...DEFAULT_WORKBENCH_CONFIG,target:mode,element,projectile,weaponType,secondaryElement,brand,level:1,rarity:'common',guaranteedStatus:true},oldId);
 const index=g.progression.inventory.findIndex(entry=>entry.id===oldId);g.progression.inventory[index]=item;
 g.refreshEquipmentVisuals();g.bodies[mode].ammo=getStats(g.progression,mode).magazine;g.bodies[mode].heat=0;g.bodies[mode].overheated=false;
}
function resetElementalFixture(element:ElementType,projectile:ProjectileType='bullet',weaponType:WeaponType='rifle',mode:Mode='pilot',brand:BrandId='ironvale',secondary:ElementType|'none'='none'){
 benchDrive=false;g.manualEvaluation=true;g.ballistics.clear();elemental?.clear();clearStatuses();
 for(const enemy of [...g.enemies]){elemental?.release(enemy.mesh);quality?.release(enemy.mesh);}game.resetEvaluation();
 const target=g.makeEnemy(-2.2,-.8,false);target.health=target.maxHealth=100000;target.shield=0;g.enemies.push(target);g.scene.add(target.mesh);
 g.time=20;g.combatRandom=seededRandom(60729);g.ballistics.shotSequence=0;g.reloadUntil=0;g.reloadStartedAt=0;g.lastFiredAt=-Infinity;g.nextShot=20;g.emptyAt=-10;
 g.trainingTargets=true;setView('enemy');g.mode=mode;g.camera.position.y=mode==='mech'?4.4:1.8;
 if(mode==='mech')pointCamera([-2.2,4.4,8],[-2.2,1.45,-.8]);
 setPayload(element,projectile,weaponType,secondary,brand);const stats=getStats(g.progression,mode);g.bodies[mode].ammo=stats.magazine;g.bodies[mode].reserve=500;g.bodies[mode].heat=0;g.bodies[mode].overheated=false;
 previousPosition.copy(g.camera.position);lastElementalTime=g.time;history.length=0;recentImpacts.length=0;setFrozen(false);syncAssets();
}
function updateLabel(){const mark=document.querySelector('.quality-watermark');if(mark)mark.innerHTML=`${enabled?'REFERENCE':'ORIGINAL'}${elementalEnabled?' + ELEMENTAL':''} / ${selectedView.toUpperCase()}<span>Actual proving ground · same combat & collision</span>`;}

const panel=document.createElement('aside');panel.className='quality-review';panel.innerHTML=`
 <div class="kicker">DUST // STEEL · QUALITY TARGET</div><h1>Built to carry weight.</h1>
 <p>R / 07 field rifle · single optic sentry · six meter industrial chassis.</p>
 <button id="quality-toggle" aria-pressed="true">Reference assets</button><button id="elemental-toggle" aria-pressed="true">Elemental quality on</button>
 <label for="quality-view">Gameplay camera</label><select id="quality-view"><option value="field">Field / all three references</option><option value="enemy">Sentry / weakpoint & materials</option><option value="mech">Mech / construction & contact</option><option value="weapon">Rifle / first person</option><option value="cockpit">Mech / cockpit cannons</option></select>
 <button id="quality-play">Play / capture mouse</button><button id="quality-sound" aria-pressed="false">Enable sound</button>
 <details><summary>Review controls</summary><button id="quality-freeze" aria-pressed="false">Freeze / resume pose</button><label for="quality-element">Payload</label><select id="quality-element"><option value="kinetic">Kinetic / uncoated</option><option value="fire">Fire / heat cartridge</option><option value="ice">Ice / cooling cartridge</option><option value="corrosive">Corrosion / pressure cartridge</option><option value="shock">Shock / conductor bands</option><option value="radiation">Radiation / isotope chamber</option><option value="gravity">Gravity / compression rings</option><option value="adhesive">Adhesive / resin reservoir</option></select><button id="quality-benchmark">Measure original + reference</button></details>
 <output id="quality-cost">Warming the renderer…</output><small>WASD move · LMB fire · R reload · F mount<br>Right-drag aim · I loadout · N encounter<br>P hides this panel. Saves stay separate.</small>`;
const watermark=document.createElement('div');watermark.className='quality-watermark';document.body.append(watermark,panel);
document.querySelector('#elemental-toggle')!.addEventListener('click',()=>setElementalEnabled(!elementalEnabled));
document.querySelector('#quality-toggle')!.addEventListener('click',()=>setEnabled(!enabled));
document.querySelector<HTMLSelectElement>('#quality-view')!.addEventListener('change',event=>setView((event.target as HTMLSelectElement).value));
document.querySelector('#quality-play')!.addEventListener('click',()=>{frozen=false;g.resume(true);});
document.querySelector('#quality-freeze')!.addEventListener('click',()=>setFrozen(!frozen));
Object.defineProperty(g,'soundEnabled',{configurable:true,get:()=>sound,set:(value:boolean)=>{
 sound=Boolean(value);if(elemental){elemental.audio.setEnabled(sound);if(sound)void elemental.audio.unlock();}if(quality){quality.audio.setEnabled(sound);if(sound)void quality.audio.unlock();}
 const button=document.querySelector('#quality-sound')!;button.textContent=sound?'Sound enabled':'Enable sound';button.setAttribute('aria-pressed',String(sound));
}});
document.querySelector('#quality-sound')!.addEventListener('click',()=>{g.soundEnabled=!sound;});
document.querySelector<HTMLSelectElement>('#quality-element')!.addEventListener('change',event=>setPayload((event.target as HTMLSelectElement).value as ElementType));
document.addEventListener('keydown',event=>{if(event.code==='KeyP'&&!(event.target instanceof HTMLInputElement)){panel.hidden=!panel.hidden;}});

let tick=0;
g.comicRenderer.render=()=>{
 if(benchDrive){g.driveEvaluation({fire:true,yaw:g.yaw,pitch:g.pitch});g.stepEvaluation(1/60);}
 const now=performance.now(),dt=Math.min(.05,(now-lastRender)/1000);lastRender=now;
 if(quality){
  syncAssets();g.muzzle.visible=false;
  const distance=Math.hypot(g.camera.position.x-previousPosition.x,g.camera.position.z-previousPosition.z);
  const grounded=g.jumpMotion.height<=.001;
  quality.update({dt,time:g.time,paused:g.screen!=='none',mode:g.mode,distance,grounded,landed:grounded&&!wasGrounded,weaponRoot:g.weapon,turn:g.yaw-previousYaw});
  if(g.reloadUntil>0){const p=(g.time-g.reloadStartedAt)/getStats(g.progression,g.mode).reload;
   if(p>=.64&&lastReloadProgress<.64)quality.reload(g.mode,'in');if(p>=.82&&lastReloadProgress<.82)quality.reload(g.mode,'bolt');lastReloadProgress=p;}
  previousPosition.copy(g.camera.position);previousYaw=g.yaw;wasGrounded=grounded;
 }
 const item=g.progression.inventory.find(item=>item.id===g.progression.loadouts[g.mode].weapon);
 elemental?.update(Math.max(0,g.time-lastElementalTime),g.time,g.screen!=='none',getWeaponSpec(item),g.mode);lastElementalTime=g.time;
 const start=perf.begin();originalRender();perf.end(start);
 if(++tick%30===0){const c=perf.latest;document.querySelector('#quality-cost')!.textContent=`${c.calls} draws · ${Math.round(c.triangles/1000)}k triangles\n${c.submitMs.toFixed(1)} ms submission · ${c.frameMs.toFixed(1)} ms frame`};
};
async function measurePair(){
 if(runningPair)throw new Error('A matched performance pair is already running.');runningPair=true;
 const previous={enabled,frozen,view:selectedView};setFrozen(true);setView('field');
 try{
  setEnabled(false);const baseline=await perf.measure('original / field',180,90);
  setEnabled(true);const reference=await perf.measure('reference / field',180,90);
  setEnabled(false);const baselineRepeat=await perf.measure('original repeat / field',180,60);
  const result={scene:'quality-field-v1',build:import.meta.env.DEV?'vite-development':'local-production',userAgent:navigator.userAgent,baseline,reference,baselineRepeat};
  (window as unknown as {qualityBenchmark:unknown}).qualityBenchmark=result;
  document.querySelector('#quality-cost')!.textContent=`Original ${baseline.frameMs.median.toFixed(2)} ms\nReference ${reference.frameMs.median.toFixed(2)} ms\n${baseline.calls.median} → ${reference.calls.median} draws`;return result;
 }finally{runningPair=false;setEnabled(previous.enabled);setView(previous.view);setFrozen(previous.frozen);}
}
document.querySelector('#quality-benchmark')!.addEventListener('click',()=>{void measurePair();});

// Review fixtures use actual game enemies, actual equipment and actual shots.
const sentry=g.makeEnemy(-2.2,-.8,false);sentry.health=100000;sentry.shield=0;g.enemies.push(sentry);g.scene.add(sentry.mesh);
g.trainingTargets=true;g.soundEnabled=false;g.start(false);setEnabled(true);setView('field');document.querySelector('#elemental-toggle')!.setAttribute('aria-pressed',String(elementalEnabled));document.querySelector('#elemental-toggle')!.textContent=elementalEnabled?'Elemental quality on':'Original elemental effects';
(window as unknown as {qualityReview:unknown}).qualityReview={game:g,setEnabled,setView,setFrozen,setPayload,measurePair,perf,history,
 setElementalEnabled,get elemental(){return elemental;},get elementalEnabled(){return elementalEnabled;},
 resetElementalFixture,
 setBenchDrive:(value:boolean)=>{benchDrive=value;g.manualEvaluation=value;},clearStatuses,
 get enabled(){return enabled;},get presentation(){return quality;},fire:()=>g.fire(),reload:()=>g.reload(),
 resetAmmo:()=>{g.bodies[g.mode].ammo=getStats(g.progression,g.mode).magazine;g.bodies[g.mode].reserve=500;g.bodies[g.mode].heat=0;g.bodies[g.mode].overheated=false;g.nextShot=g.time;},
 renderAudioPreview:renderQualityAudioPreview,hidePanel:()=>{panel.hidden=true;},showPanel:()=>{panel.hidden=false;},
};
window.addEventListener('pagehide',()=>{elemental?.dispose();quality?.dispose();perf.dispose();});
game.run();
