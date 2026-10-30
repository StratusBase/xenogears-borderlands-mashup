import '../style.css';
import './shockLab.css';
import * as THREE from 'three';
import { Game, type EvaluationShot } from '../game';
import { createProgression, getStats, seededRandom, type Mode, type Progression } from '../core/index';
import { createWorkbenchWeapon, DEFAULT_WORKBENCH_CONFIG } from '../core/workbench';
import type { ElementType, ProjectileType } from '../core/arsenal';
import type { StatusState } from '../core/statusEffects';
import { ElementalPresentation } from '../rendering/quality/elementalPresentation';
import { ShockPresentation } from '../rendering/quality/shock/ShockPresentation';
import type { GamePresentation } from '../rendering/quality/GamePresentation';
import { createHumanReviewTarget } from './effects/shared/reviewTargets';
import { QualityPerformance, distribution } from '../rendering/quality/performance';
import type { EncounterEnemyVisual } from '../rendering/encounterEnemy';
import type { BallisticHit, BallisticPresentationImpact } from '../rendering/PlayerBallistics';

document.body.classList.add('shock-vfx-review');
// Isolated evaluation entry. All shots, reloads, collisions, damage and statuses still run in Game.
interface Target {
 id:number; mesh:THREE.Group; health:number; maxHealth:number; shield:number; maxShield:number;
 visual:EncounterEnemyVisual; statuses:StatusState;
}
interface Bridge {
 scene:THREE.Scene; camera:THREE.PerspectiveCamera; renderer:THREE.WebGLRenderer;
 comicRenderer:{render():void;resize(w:number,h:number,dpr:number):void}; presentation:GamePresentation;
 progression:Progression; time:number; mode:Mode; screen:string; manualEvaluation:boolean; trainingTargets:boolean;
 yaw:number; pitch:number; lastFiredAt:number; nextShot:number; reloadUntil:number; reloadStartedAt:number; reloadFoleyStage:number; emptyAt:number;
 combatRandom:()=>number; enemies:Target[]; bodies:Record<Mode,{ammo:number;reserve:number;heat:number;overheated:boolean}>;
 world:{occluders:THREE.Object3D[];parkedMech:THREE.Group;traversalColliders:{minX:number;maxX:number;minZ:number;maxZ:number;minY?:number;maxY?:number}[]}; ballistics:{shotSequence:number;activeCount:number};
 jumpMotion:{height:number;reset():void};
 freshBodies():Bridge['bodies'];respawnUntil:number;
 makeEnemy(x:number,z:number,heavy:boolean,role:'rusher'):Target; refreshEquipmentVisuals():void; onBallisticHit(hit:BallisticHit):void;
 tracer(start:THREE.Vector3,end:THREE.Vector3,color:number):void;hurtTarget(target:Target,damage:number,cause?:string,critical?:boolean,source?:string):{healthDamage:number;shieldDamage:number;killed:boolean};
 start(capture?:boolean):void; ui:{setScreen(screen:string,progression:Progression,mode:Mode):void};
}
type SurfaceCase='raised'|'slope'|'ceiling'|'ledge'|'wall';
type SceneCase='crowd-rifle'|'crowd-sticky'|'crowd-and-surfaces';
const progression=createProgression(), item=createWorkbenchWeapon({...DEFAULT_WORKBENCH_CONFIG,element:'shock',guaranteedStatus:true},'shock-ab');
progression.inventory.push(item); progression.loadouts.pilot.weapon=item.id;
const shots:EvaluationShot[]=[], hits:unknown[]=[], contacts:{phase:string;point:number[];normal:number[];surface?:string;target:number;at:number}[]=[];
const chains:unknown[]=[];let activeHit:BallisticHit|undefined,pendingChain:{start:THREE.Vector3;end:THREE.Vector3}|undefined;
const game=new Game(document.querySelector<HTMLElement>('#app')!,{initialProgression:progression,saveKey:'dust-steel.shock.prototype.v1',evaluationDriver:true,manualEvaluation:true,autoEncounters:false,trainingTargets:false,presentation:'legacy',soundEnabled:true,onEvaluationShot:shot=>shots.push(structuredClone(shot))});
const g=game as unknown as Bridge;
g.renderer.setPixelRatio(1);g.renderer.setSize(innerWidth,innerHeight);g.comicRenderer.resize(innerWidth,innerHeight,1);
const perf=new QualityPerformance(g.renderer);
let layer:ElementalPresentation, targets:Target[]=[], probe:THREE.Mesh|undefined, before=false, busy=false;
let vantage:THREE.Mesh|undefined,vantageBounds:Bridge['world']['traversalColliders'][number]|undefined;
let sceneCase:SceneCase='crowd-rifle', surfaceCase:SurfaceCase='raised', bench=false, benchFrame=0, frozen=true;
let directionSequenceReady=false;
let study:'surface'|'human'='surface',studyDelivery:ProjectileType='bullet',studyTarget=0,showPrevious=false;
const simulationCosts:number[]=[], peaks={bolts:0,segments:0,heavyFans:0,worldSurfaces:0,statuses:0,capacitorBlades:0,capacitorShards:0,capacitorVertices:0,physicalVoices:0,elementalVoices:0};
function shockLayer(){return layer instanceof ShockPresentation?layer.shock:undefined;}
let pendingSurface:{phase:'launch'|'wait'|'onset'|'settled';frame:number;requestAt:number;case:SurfaceCase;initialShots?:number;initialContacts?:number}|undefined;
const errors:string[]=[], surfaceResults:unknown[]=[], performanceResults:unknown[]=[];
window.addEventListener('error',event=>errors.push(event.message));
window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
const ui=document.createElement('aside');ui.className='signoff-panel';ui.innerHTML=`<strong>SHOCK / C DIRECTION VARIATION</strong><p>Actual Game · live sound · Reset restarts the study; Next heavy hit continues the sequence.</p>
<label>Target<select id="study-target"><option value="0">Clothed human</option><option value="1">Armored human</option><option value="skin">Exposed forearm</option></select></label>
<label>Delivery<select id="study-delivery"><option value="bullet">Rifle</option><option value="sticky">Sticky / heavy</option><option value="rocket">Rocket / heavy</option><option value="beam">Beam</option><option value="scatter">Scatter</option><option value="slug">Slug</option><option value="arc">Arc</option></select></label>
<button id="study-run">Reset & fire study</button><button id="direction-next">Next heavy hit / freeze</button><button id="study-linger">Show lingering charge</button><button id="study-live">Play target shot with sound</button><button id="study-repeat">Play repeated target hits</button><button id="study-version" aria-pressed="false">View right-biased C</button>
<label>Surface case<select id="surface-case"><option value="raised">Raised platform</option><option value="wall">Vertical wall</option><option value="slope">Sloped face</option><option value="ceiling">Ceiling / underside</option><option value="ledge">Finite ledge</option></select></label>
<button id="surface-run">Fire surface test</button><button id="surface-settle">Show surface aftermath</button><button id="surface-live">Play surface shot with sound</button>
<label>Performance scene<select id="perf-scene"><option value="crowd-rifle">Six humans / rifle</option><option value="crowd-sticky">Six humans / sticky</option><option value="crowd-and-surfaces">Six humans + raised surface / sticky</option></select></label>
<button id="perf-run">Run matched comparison with sound</button><button id="crowd-live">Play crowded scene with sound</button>
<button id="record-start">Record live gameplay with sound</button><button id="record-stop" disabled>Stop recording</button><a id="record-download" hidden download="shock-ab.webm">Download gameplay recording</a><textarea id="record-data" aria-label="Recording export" hidden></textarea>
<output id="signoff-state">Ready · before = right-biased C · current = balanced directions</output><details><summary>Raw verification results</summary><pre id="signoff-results">{}</pre></details>`;
document.body.append(ui);
const caption=document.createElement('div');caption.className='signoff-caption';document.body.append(caption);
function state(text:string){document.querySelector('#signoff-state')!.textContent=text;}
function publish(){document.querySelector('#signoff-results')!.textContent=JSON.stringify({surfaces:surfaceResults,studies:studyResults,performance:performanceResults,directions:shockLayer()?.directions??[],directionSeed:shockLayer()?.directionSeed,errors},null,2);}
const studyResults:unknown[]=[];
function aim(point:THREE.Vector3){g.camera.lookAt(point);g.yaw=g.camera.rotation.y;g.pitch=g.camera.rotation.x;}
function removeProbe(){if(!probe)return;g.world.occluders.splice(g.world.occluders.indexOf(probe),1);probe.removeFromParent();probe.geometry.dispose();(probe.material as THREE.Material).dispose();probe=undefined;}
function removeVantage(){if(!vantage)return;g.world.occluders.splice(g.world.occluders.indexOf(vantage),1);g.world.traversalColliders.splice(g.world.traversalColliders.indexOf(vantageBounds!),1);vantage.removeFromParent();vantage.geometry.dispose();(vantage.material as THREE.Material).dispose();vantage=undefined;vantageBounds=undefined;}
function standOnPlatform(x:number,z:number){
 vantage=new THREE.Mesh(new THREE.BoxGeometry(2.4,1.4,2),new THREE.MeshToonMaterial({color:0x4a5b57}));vantage.name='signoff-shooter-platform';vantage.position.set(x,.7,z);vantage.castShadow=vantage.receiveShadow=true;g.scene.add(vantage);g.world.occluders.push(vantage);
 vantageBounds={minX:x-1.2,maxX:x+1.2,minZ:z-1,maxZ:z+1,minY:0,maxY:1.4};g.world.traversalColliders.push(vantageBounds);g.jumpMotion.height=1.4;g.camera.position.set(x,3.2,z);g.scene.updateMatrixWorld(true);
}
function response(old:boolean){
 game.setPresentationMode('legacy');before=old;
 g.presentation.setElementalFactory((scene,camera)=>{
  layer=new ShockPresentation(scene,camera,'capacitor',{capacitorDirection:old?'legacy':'balanced',cosmeticSeed:37391});
  const impact=layer.impact.bind(layer);layer.impact=(event:BallisticPresentationImpact)=>{contacts.push({phase:event.phase,point:event.point.toArray(),normal:event.normal.toArray(),surface:event.hitSurface?.name,target:targets.findIndex(t=>t.mesh===event.target),at:g.time});impact(event);};
  return layer;
 });
 game.setPresentationMode('quality');g.presentation.setSoundEnabled(true);
}
function setup(old:boolean,delivery:ProjectileType,count=6){
 bench=false;frozen=true;pendingSurface=undefined;liveScene=undefined;directionSequenceReady=false;g.manualEvaluation=true;game.resetEvaluation();removeProbe();removeVantage();g.jumpMotion.reset();response(old);targets=[];
 g.mode='pilot';g.trainingTargets=true;g.bodies=g.freshBodies();g.respawnUntil=0;g.time=20;g.lastFiredAt=-Infinity;g.nextShot=20;g.reloadUntil=0;g.reloadStartedAt=0;g.reloadFoleyStage=0;g.emptyAt=-20;
 g.combatRandom=seededRandom(37391);g.ballistics.shotSequence=0;g.world.parkedMech.position.set(8,0,-5);
 for(let i=0;i<count;i++){
  const target=g.makeEnemy(-4.0+(i%3)*2.1,-2-Math.floor(i/3)*2.2,false,'rusher');target.health=target.maxHealth=100000;target.shield=target.maxShield=0;
  const original=target.visual,look=createHumanReviewTarget(target.mesh,target.id,i%2===1);
  target.visual={...original,update(dt,time,presentation){original.update(dt,time,presentation);look.update(dt,time,presentation);},dispose(){look.dispose();original.dispose();}};
  g.enemies.push(target);g.scene.add(target.mesh);targets.push(target);
 }
 const weapon=createWorkbenchWeapon({...DEFAULT_WORKBENCH_CONFIG,target:'pilot',element:'shock',projectile:delivery,weaponType:['sticky','rocket'].includes(delivery)?'launcher':delivery==='scatter'?'shotgun':'rifle',brand:delivery==='sticky'?'tackwork':'ironvale',level:1,rarity:'common',guaranteedStatus:true},item.id);
 g.progression.inventory[g.progression.inventory.findIndex(i=>i.id===item.id)]=weapon;g.refreshEquipmentVisuals();const stats=getStats(g.progression,'pilot');g.bodies.pilot.ammo=stats.magazine;g.bodies.pilot.reserve=500;
 g.bodies.pilot.heat=0;g.bodies.pilot.overheated=false;g.camera.position.set(-1.8,1.8,5.4);aim(new THREE.Vector3(-1.9,1.55,-2));
 g.screen='none';g.ui.setScreen('none',g.progression,'pilot');shots.length=0;hits.length=0;contacts.length=0;chains.length=0;layer.clear();
 game.driveEvaluation({fire:false,yaw:g.yaw,pitch:g.pitch});game.stepEvaluation(1/240);g.scene.updateMatrixWorld(true);
}
// Observe the confirmed original chain; never duplicate its recipient selection or damage calculation.
const originalTracer=g.tracer.bind(g),originalHurt=g.hurtTarget.bind(g);
g.tracer=(start,end,color)=>{if(activeHit&&color===0x4ca3ff){pendingChain={start:start.clone(),end:end.clone()};if(layer instanceof ShockPresentation)return;}originalTracer(start,end,color);};
g.hurtTarget=(target,damage,cause,critical,source)=>{
 const result=originalHurt(target,damage,cause,critical,source);
 if(cause==='shock'&&activeHit&&pendingChain){const event={...pendingChain,target:target.mesh,spec:activeHit.spec,energy:damage,exposure:Math.min(1,damage/activeHit.damage)};
  chains.push({at:g.time,target:targets.indexOf(target),damage,result:{...result},start:event.start.toArray(),end:event.end.toArray(),exposure:event.exposure});
  g.presentation.confirmedShockChain(event);pendingChain=undefined;
 }return result;
};
const originalHit=g.onBallisticHit.bind(g);g.onBallisticHit=hit=>{hits.push({target:targets.findIndex(t=>t.id===hit.targetId),at:g.time,point:hit.point.toArray(),direction:hit.direction.toArray(),damage:hit.damage,critical:hit.critical,spec:structuredClone(hit.spec)});activeHit=hit;try{originalHit(hit);}finally{activeHit=undefined;pendingChain=undefined;}};
function solid(name:string,size:[number,number,number],position:[number,number,number],slope=0){
 probe=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshToonMaterial({color:0x8b8171}));probe.name=name;probe.position.set(...position);probe.rotation.x=slope;probe.castShadow=probe.receiveShadow=true;g.scene.add(probe);g.world.occluders.push(probe);g.scene.updateMatrixWorld(true);return probe;
}
function surfaceFixture(kind:SurfaceCase){
 setup(showPrevious,'sticky',0);study='surface';surfaceCase=kind;let point:THREE.Vector3;
 if(kind==='wall'){
  const mesh=solid('signoff-wall',[3.3,3,.35],[-1.6,1.5,-2]);point=mesh.localToWorld(new THREE.Vector3(0,0,.175));g.camera.position.set(-1.6,1.8,3.2);
 }else if(kind==='ceiling'){
  const mesh=solid('signoff-ceiling',[3.3,.35,2.8],[-1.6,3.6,-2]);point=mesh.localToWorld(new THREE.Vector3(0,-.175,0));g.camera.position.set(-1.6,1.8,3.2);
 }else if(kind==='slope'){
  const mesh=solid('signoff-slope',[3.2,.30,3.0],[-1.6,1.5,-2],.55);point=mesh.localToWorld(new THREE.Vector3(0,.15,0));standOnPlatform(-1.6,3.4);
 }else{
  const edge=kind==='ledge',mesh=solid(edge?'signoff-ledge':'signoff-raised-platform',[edge?1.3:3.4,.45,2.6],[-1.6,1.3,-2]);
  point=mesh.localToWorld(new THREE.Vector3(edge?.52:0,.225,0));standOnPlatform(edge?-1.0:-1.6,3.2);
 }
 aim(point);game.driveEvaluation({fire:false,yaw:g.yaw,pitch:g.pitch});game.stepEvaluation(1/240);
 caption.innerHTML=`${kind.toUpperCase()} / ACTUAL STICKY COLLISION<span>A+B / C heavy · real projectile and fuse · sound enabled</span>`;
}
function snapshot(){return{time:g.time,body:{...g.bodies.pilot},shots:structuredClone(shots),hits:structuredClone(hits),chains:structuredClone(chains),targets:targets.map(t=>({health:t.health,shield:t.shield,statuses:structuredClone(t.statuses)})),contacts:structuredClone(contacts),directions:structuredClone(shockLayer()?.directions??[]),diagnostics:layer.diagnostics,presentation:g.presentation.diagnostics};}
function humanFixture(){
 studyDelivery=(document.querySelector('#study-delivery') as HTMLSelectElement).value as ProjectileType;const targetValue=(document.querySelector('#study-target') as HTMLSelectElement).value;studyTarget=targetValue==='1'?1:0;
 setup(showPrevious,studyDelivery,3);study='human';g.camera.position.set(targets[studyTarget].mesh.position.x,1.8,4);
 const point=targets[studyTarget].mesh.position.clone().add(new THREE.Vector3(targetValue==='skin'?-.56:0,targetValue==='skin'?1.20:1.55,targetValue==='skin'?.10:0));aim(point);
 game.driveEvaluation({fire:false,yaw:g.yaw,pitch:g.pitch});game.stepEvaluation(1/240);
 caption.innerHTML=`SHOCK / ${showPrevious?'RIGHT-BIASED C':'VARIED C / A+B'}<span>${targetValue==='skin'?'Exposed forearm':studyTarget===0?'Clothed human':'Armored human'} · ${studyDelivery} · real Game / intact characters</span>`;
}
function humanAudit(){const surface=targets[studyTarget].mesh.getObjectByName('shock-live-wire-surface');const bindings:unknown[]=[];
 targets[studyTarget].mesh.traverse(mesh=>{if(mesh instanceof THREE.Mesh&&mesh.name==='shock-local-charge-overlay'&&mesh.visible){const u=(mesh.material as THREE.ShaderMaterial).uniforms;bindings.push({source:mesh.parent?.name,kind:mesh.parent?.userData.corrosiveSurface,radii:[...u.radii.value],ages:[...u.ages.value]});}});
 return{target:studyTarget,delivery:studyDelivery,previous:showPrevious,directions:structuredClone(shockLayer()?.directions??[]),events:structuredClone(shockLayer()?.events??[]),bindings,statusVisual:!!surface,snapshot:snapshot()};
}
function surfaceAudit(){
 const contact=contacts.find(c=>c.phase==='contact'&&c.surface===probe?.name);
 if(!contact)throw new Error(`Shot did not hit ${probe?.name}; actual contacts: ${contacts.map(c=>c.surface).join(', ')}`);
 const shock=shockLayer();let minimum=Infinity,visibleFans=shock?.diagnostics.heavyFans??0;
 if(shock){shock.group.updateWorldMatrix(true,true);shock.group.traverse(mesh=>{
  if(!(mesh instanceof THREE.Mesh)||!mesh.visible)return;for(let parent:THREE.Object3D|null=mesh.parent;parent;parent=parent.parent)if(!parent.visible)return;
  const positions=mesh.geometry.attributes.position,normal=new THREE.Vector3().fromArray(contact.normal),origin=new THREE.Vector3().fromArray(contact.point);
  if(mesh instanceof THREE.InstancedMesh){if(mesh.name==='shock-lightning-filaments'){for(let j=0;j<mesh.count;j++){const m=new THREE.Matrix4();mesh.getMatrixAt(j,m);m.premultiply(mesh.matrixWorld);for(const y of [-.5,.5]){const p=new THREE.Vector3(0,y,0).applyMatrix4(m);minimum=Math.min(minimum,p.sub(origin).dot(normal));}}return;}for(let j=0;j<mesh.count;j++){const m=new THREE.Matrix4();mesh.getMatrixAt(j,m);m.premultiply(mesh.matrixWorld);for(let i=0;i<positions.count;i++){const p=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(m);minimum=Math.min(minimum,p.sub(origin).dot(normal));}}}
  else if(mesh.name==='shock-capacitor-blades-and-shards'){for(let i=0;i<positions.count;i++){const p=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);minimum=Math.min(minimum,p.sub(origin).dot(normal));}}
  else if(mesh.name==='shock-heavy-capacitor-fan'){if(mesh.material instanceof THREE.ShaderMaterial&&mesh.material.name==='shock-contact-corona')return;for(let i=0;i<positions.count;i++){const p=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);minimum=Math.min(minimum,p.sub(origin).dot(normal));}}
 });}
 const overlays:unknown[]=[];probe?.traverse(mesh=>{if(mesh instanceof THREE.Mesh&&mesh.name==='shock-local-charge-overlay'){const u=(mesh.material as THREE.ShaderMaterial).uniforms;overlays.push({visible:mesh.visible,centers:u.centers.value.map((p:THREE.Vector3)=>p.toArray()),radii:[...u.radii.value],source:mesh.parent?.name});}});
 return{case:surfaceCase,contact,visibleFans,minimumClearance:Number.isFinite(minimum)?minimum:null,overlays,events:shock?.events??[],snapshot:snapshot()};
}
async function unlock(){g.presentation.setSoundEnabled(true);await g.presentation.unlockAudio();const d=g.presentation.diagnostics;if(!d.qualityAudioUnlocked||!d.elementalAudioUnlocked)throw new Error('Both audio buses must be unlocked');}
async function fireSurface(){
 surfaceFixture((document.querySelector('#surface-case') as HTMLSelectElement).value as SurfaceCase);await unlock();
 pendingSurface={phase:'launch',frame:0,requestAt:performance.now(),case:surfaceCase};frozen=false;state('Firing actual sticky projectile…');
}
async function fireStudy(){humanFixture();await unlock();pendingSurface={phase:'launch',frame:0,requestAt:performance.now(),case:surfaceCase};frozen=false;state('Firing actual target study…');}
async function nextDirectionStudy(){
 if(!directionSequenceReady){humanFixture();directionSequenceReady=true;}
 if(!['sticky','rocket'].includes(studyDelivery))throw new Error('Choose Sticky or Rocket for the direction sequence');
 await unlock();pendingSurface={phase:'launch',frame:0,requestAt:performance.now(),case:surfaceCase,initialShots:shots.length,initialContacts:contacts.length};frozen=false;state('Firing next real heavy shot without resetting the effect sequence…');
}
function shotStep(fire:boolean){game.driveEvaluation({fire,yaw:g.yaw,pitch:g.pitch});game.stepEvaluation(1/60);}
function updateSurface(){
 if(!pendingSurface)return;const p=pendingSurface;
 if(p.phase==='launch'){shotStep(true);p.frame++;if(shots.length>(p.initialShots??0)){p.phase='wait';p.frame=0;}if(p.frame>360)throw new Error('No real shot after reload/cadence wait');return;}
 shotStep(false);p.frame++;
 const phase=study==='surface'||['sticky','rocket'].includes(studyDelivery)?'detonate':'contact';
 if(p.phase==='wait'&&contacts.slice(p.initialContacts??0).some(e=>e.phase===phase)){p.phase='onset';p.frame=0;}
 if(p.phase==='onset'&&p.frame>=6){
  pendingSurface=undefined;frozen=true;
  if(study==='human'){const result={stage:'onset',...humanAudit()};studyResults.push(result);publish();state(`Human study frozen +100 ms · ${result.bindings.length} visible charge bindings · ${result.events.filter(e=>e.size.heavy).length} heavy events`);}
  else{const result={stage:'onset',...surfaceAudit()};surfaceResults.push(result);publish();state(`${surfaceCase}: impact frozen +100 ms · ${result.visibleFans} capacitor fans · clearance ${result.minimumClearance?.toFixed(4)} m`);}
 }
 if(p.frame>300)throw new Error('No sticky detonation on requested surface');
}
function settleSurface(){for(let i=0;i<48;i++)shotStep(false);const result={stage:'settled',...surfaceAudit()};surfaceResults.push(result);publish();state(`${surfaceCase}: settled at +900 ms · ${result.overlays.length} surface charge bindings`);}
function lingerStudy(){for(let i=0;i<36;i++)shotStep(false);studyResults.push({stage:'linger',...humanAudit()});publish();state('Human study: lingering charge at +700 ms');}
function crowdedFixture(old:boolean,scene:SceneCase){
 setup(old,scene==='crowd-rifle'?'bullet':'sticky');
 if(scene==='crowd-and-surfaces'){solid('signoff-benchmark-raised-top',[3,.45,2.0],[-1.7,.9,1.25]);standOnPlatform(-1.8,5.4);}
 caption.innerHTML=`${scene.toUpperCase()} / ${old?'RIGHT-BIASED C':'VARIED C / A+B'}<span>Six clothed / armored humans · standard cadence and reload · live sound</span>`;
}
function benchmarkAim(frame:number){
 const slot=Math.floor(frame/90)%6;
 g.camera.position.set(-1.8,sceneCase==='crowd-and-surfaces'?3.2:1.8,5.4);
 if(sceneCase==='crowd-and-surfaces'&&slot%2===0)aim(new THREE.Vector3(-1.7,1.125,1.25));
 else{const target=targets[slot];aim(target.mesh.position.clone().add(new THREE.Vector3(0,1.55,0)));}
}
function collectPeak(){const d=shockLayer()?.diagnostics??{bolts:0,segments:0,heavyFans:0,worldSurfaces:0,statuses:0,capacitorBlades:0,capacitorShards:0,capacitorVertices:0},a=g.presentation.diagnostics;for(const key of ['bolts','segments','heavyFans','worldSurfaces','statuses','capacitorBlades','capacitorShards','capacitorVertices'] as const)peaks[key]=Math.max(peaks[key],d[key]);peaks.physicalVoices=Math.max(peaks.physicalVoices,a.physicalVoices);peaks.elementalVoices=Math.max(peaks.elementalVoices,a.elementalVoices);}
function normalized(s:ReturnType<typeof snapshot>){return{time:s.time,body:s.body,shots:s.shots,hits:s.hits,chains:s.chains,targets:s.targets,contacts:s.contacts};}
async function compare(){
 if(busy)return;busy=true;performanceResults.length=0;sceneCase=(document.querySelector('#perf-scene') as HTMLSelectElement).value as SceneCase;
 const runs:unknown[]=[];
 try{
  for(const [label,old] of [['before',true],['current',false],['before-repeat',true]] as const){
   crowdedFixture(old,sceneCase);await unlock();benchFrame=0;simulationCosts.length=0;for(const key of Object.keys(peaks) as (keyof typeof peaks)[])peaks[key]=0;
   state(`${sceneCase} / ${label}: 120 warm-up + 720 measured frames · sound on · capture off`);
   const promise=perf.measure(label,720,120);bench=true;frozen=false;const started=performance.now(),cost=await promise;bench=false;frozen=true;
   runs.push({label,wallMs:performance.now()-started,cost,simulationMs:distribution(simulationCosts.slice(120)),peaks:{...peaks},snapshot:snapshot()});
  }
  const typed=runs as {label:string;snapshot:ReturnType<typeof snapshot>}[];
  const equal=typed.every(r=>JSON.stringify(normalized(r.snapshot))===JSON.stringify(normalized(typed[0].snapshot)));
  const targetsHit=new Set((typed[1].snapshot.hits as {target:number}[]).map(h=>h.target).filter(i=>i>=0)).size;
  const result={scene:sceneCase,runs,combatEqual:equal,targetsHit,protocol:{warmup:120,frames:720,simulationStep:1/60,sound:true,recording:false,visibility:document.visibilityState}};
  performanceResults.push(result);publish();state(`${equal&&targetsHit>=3?'PASS':'FAIL'} / ${sceneCase}: three matched runs complete · ${targetsHit} targets hit · combat ${equal?'identical':'DIFFERENT'}`);
 }finally{busy=false;bench=false;frozen=true;}
}
let liveScene:'surface'|'crowd'|'human'|'repeat-human'|undefined,liveFrame=0;
async function liveHuman(){humanFixture();await unlock();pendingSurface=undefined;liveScene='human';liveFrame=0;frozen=false;state('Live human shot · native timing · sound on');}
async function liveRepeat(){humanFixture();await unlock();pendingSurface=undefined;liveScene='repeat-human';liveFrame=0;frozen=false;state('Repeated hits on one human · native timing · live sound');}
async function liveSurface(){surfaceFixture((document.querySelector('#surface-case') as HTMLSelectElement).value as SurfaceCase);await unlock();pendingSurface=undefined;liveScene='surface';liveFrame=0;frozen=false;state('Live surface shot · native timing · sound on');}
async function liveCrowd(){sceneCase=(document.querySelector('#perf-scene') as HTMLSelectElement).value as SceneCase;crowdedFixture(false,sceneCase);await unlock();liveScene='crowd';liveFrame=0;frozen=false;state('Live crowded firing · native timing · sound on');}
let recorder:MediaRecorder|undefined,recordStream:MediaStream|undefined,mix:AudioContext|undefined,chunks:BlobPart[]=[];
async function startRecording(){
 await unlock();mix=new AudioContext();await mix.resume();const audio=mix.createMediaStreamDestination();
 for(const stream of g.presentation.recordingStreams())mix.createMediaStreamSource(stream).connect(audio);
 recordStream=g.renderer.domElement.captureStream(60);for(const track of audio.stream.getAudioTracks())recordStream.addTrack(track);
 const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')?'video/webm;codecs=vp9,opus':'video/webm;codecs=vp8,opus';
 chunks=[];recorder=new MediaRecorder(recordStream,{mimeType:mime,videoBitsPerSecond:9_000_000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.start(100);
 (document.querySelector('#record-stop') as HTMLButtonElement).disabled=false;state('Recording real final audio buses and WebGL canvas');
}
async function stopRecording(){
 await new Promise<void>(resolve=>{recorder!.onstop=()=>resolve();recorder!.stop();});const link=document.querySelector('#record-download') as HTMLAnchorElement;
 const blob=new Blob(chunks,{type:recorder!.mimeType});link.href=URL.createObjectURL(blob);link.hidden=false;
 const exportData=await new Promise<string>(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.readAsDataURL(blob);});document.querySelector('#record-data')!.textContent=exportData;
 recordStream?.getTracks().forEach(t=>t.stop());await mix?.close();recorder=undefined;
 (document.querySelector('#record-stop') as HTMLButtonElement).disabled=true;publish();state('Gameplay recording ready · live audio · no replacement or normalization');
}
function guard(action:()=>void|Promise<void>){return()=>{void Promise.resolve().then(action).catch(error=>{errors.push(String(error));state(`ERROR: ${error}`);publish();});};}
document.querySelector('#surface-run')!.addEventListener('click',guard(fireSurface));
document.querySelector('#surface-settle')!.addEventListener('click',guard(settleSurface));
document.querySelector('#surface-live')!.addEventListener('click',guard(liveSurface));
document.querySelector('#perf-run')!.addEventListener('click',guard(compare));
document.querySelector('#crowd-live')!.addEventListener('click',guard(liveCrowd));
document.querySelector('#record-start')!.addEventListener('click',guard(startRecording));
document.querySelector('#record-stop')!.addEventListener('click',guard(stopRecording));
document.querySelector('#study-run')!.addEventListener('click',guard(fireStudy));
document.querySelector('#direction-next')!.addEventListener('click',guard(nextDirectionStudy));
document.querySelector('#study-linger')!.addEventListener('click',guard(lingerStudy));
document.querySelector('#study-live')!.addEventListener('click',guard(liveHuman));
document.querySelector('#study-repeat')!.addEventListener('click',guard(liveRepeat));
document.querySelector('#study-version')!.addEventListener('click',()=>{showPrevious=!showPrevious;const button=document.querySelector('#study-version')!;button.setAttribute('aria-pressed',String(showPrevious));button.textContent=showPrevious?'View varied C':'View right-biased C';});
const draw=g.comicRenderer.render.bind(g.comicRenderer);let previous=performance.now();
g.comicRenderer.render=()=>{
 const now=performance.now(),dt=Math.min(.05,(now-previous)/1000);previous=now;
 const updateStart=performance.now();
 if(bench){benchmarkAim(benchFrame++);shotStep(true);simulationCosts.push(performance.now()-updateStart);collectPeak();}
 else if(pendingSurface)updateSurface();
 else if(liveScene&&!frozen){
  if(liveScene==='crowd')benchmarkAim(Math.floor(liveFrame/1.5));
  game.driveEvaluation({fire:liveScene==='crowd'||liveScene==='repeat-human'||liveFrame===0,yaw:g.yaw,pitch:g.pitch});game.stepEvaluation(Math.max(1/240,dt));liveFrame++;
 }
 const start=perf.begin();draw();perf.end(start);
};
g.start(false);surfaceFixture('raised');publish();
const gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
const metadata={userAgent:navigator.userAgent,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),viewport:[innerWidth,innerHeight],dpr:g.renderer.getPixelRatio(),before:'3660665 / right-biased dense C',current:'Balanced eight-direction dense C',entry:'Actual Game evaluation driver / isolated review save / raised-health human fixtures'};
const meta=document.createElement('script');meta.type='application/json';meta.id='signoff-metadata';meta.textContent=JSON.stringify(metadata);document.body.append(meta);
window.addEventListener('pagehide',()=>perf.dispose());game.run();
