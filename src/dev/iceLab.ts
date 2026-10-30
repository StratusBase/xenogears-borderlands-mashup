import '../style.css';
import './iceLab.css';
import * as THREE from 'three';
import { Game, type EvaluationShot } from '../game';
import { createProgression, getStats, seededRandom, type Mode, type Progression } from '../core/index';
import { createWorkbenchWeapon, DEFAULT_WORKBENCH_CONFIG } from '../core/workbench';
import type { ElementType, ProjectileType } from '../core/arsenal';
import type { StatusState } from '../core/statusEffects';
import { ElementalPresentation } from '../rendering/quality/elementalPresentation';
import { IcePresentation } from '../rendering/quality/ice/presentation';
import type { IceResponse } from '../rendering/quality/ice/response';
import type { GamePresentation } from '../rendering/quality/GamePresentation';
import { createCorrosiveReviewTarget } from '../rendering/quality/corrosive/reviewTargets';
import { QualityPerformance, distribution } from '../rendering/quality/performance';
import type { EncounterEnemyVisual } from '../rendering/encounterEnemy';
import type { BallisticHit, BallisticPresentationImpact } from '../rendering/PlayerBallistics';

// Isolated evaluation entry. All shots, reloads, collisions, damage and statuses still run in Game.
interface Target {
 id:number; mesh:THREE.Group; health:number; maxHealth:number; shield:number; maxShield:number;
 visual:EncounterEnemyVisual; statuses:StatusState;
}
interface Bridge {
 scene:THREE.Scene; camera:THREE.PerspectiveCamera; renderer:THREE.WebGLRenderer;
 comicRenderer:{render():void;resize(w:number,h:number,dpr:number):void}; presentation:GamePresentation;
 progression:Progression; time:number; mode:Mode; screen:string; manualEvaluation:boolean; trainingTargets:boolean;
 yaw:number; pitch:number; lastFiredAt:number; nextShot:number; reloadUntil:number; reloadStartedAt:number; reloadFoleyStage:number; emptyAt:number;evaluationInput:unknown;
 combatRandom:()=>number; enemies:Target[]; bodies:Record<Mode,{ammo:number;reserve:number;heat:number;overheated:boolean}>;
 world:{occluders:THREE.Object3D[];parkedMech:THREE.Group;traversalColliders:{minX:number;maxX:number;minZ:number;maxZ:number;minY?:number;maxY?:number}[]}; ballistics:{shotSequence:number;activeCount:number};
 jumpMotion:{height:number;reset():void};
 freshBodies():Bridge['bodies'];respawnUntil:number;
 makeEnemy(x:number,z:number,heavy:boolean,role:'rusher'):Target; refreshEquipmentVisuals():void; onBallisticHit(hit:BallisticHit):void;
 start(capture?:boolean):void;resume(capture?:boolean):void; ui:{setScreen(screen:string,progression:Progression,mode:Mode):void};
}
type SurfaceCase='raised'|'slope'|'ceiling'|'ledge';
type SceneCase='crowd-rifle'|'crowd-sticky'|'crowd-and-surfaces';
const progression=createProgression();for(const mode of ['pilot','mech']as const){const item=createWorkbenchWeapon({...DEFAULT_WORKBENCH_CONFIG,target:mode,element:'ice',guaranteedStatus:true},`ice-prototype-${mode}`);progression.inventory.push(item);progression.loadouts[mode].weapon=item.id;}
const shots:EvaluationShot[]=[], hits:unknown[]=[], contacts:{phase:string;point:number[];normal:number[];surface?:string;target:number;at:number}[]=[];
const game=new Game(document.querySelector<HTMLElement>('#app')!,{initialProgression:progression,saveKey:'dust-steel.ice.plates.v1',evaluationDriver:true,manualEvaluation:true,autoEncounters:false,trainingTargets:false,presentation:'legacy',onEvaluationShot:shot=>shots.push(structuredClone(shot))});
const g=game as unknown as Bridge;
g.renderer.setPixelRatio(1);g.renderer.setSize(innerWidth,innerHeight);g.comicRenderer.resize(innerWidth,innerHeight,1);
const perf=new QualityPerformance(g.renderer);
let layer:ElementalPresentation & {ice?:IceResponse}, targets:Target[]=[], probe:THREE.Mesh|undefined, before=false, busy=false;
let vantage:THREE.Mesh|undefined,vantageBounds:Bridge['world']['traversalColliders'][number]|undefined;
let sceneCase:SceneCase='crowd-rifle', surfaceCase:SurfaceCase='raised', bench=false, benchFrame=0, frozen=true;
let handsOn=false;
let benchmarkResizes=0,benchmarkHidden=0;
function benchmarkViewport(){g.renderer.setPixelRatio(1);g.renderer.setSize(1440,900);g.camera.aspect=1440/900;g.camera.updateProjectionMatrix();g.comicRenderer.resize(1440,900,1);}
window.addEventListener('resize',()=>{if(busy){benchmarkResizes++;benchmarkViewport();}});
document.addEventListener('visibilitychange',()=>{if(busy&&document.visibilityState!=='visible')benchmarkHidden++;});
const simulationCosts:number[]=[], peaks={plates:0,flakes:0,rimes:0,physicalVoices:0,elementalVoices:0};
let pendingSurface:{phase:'launch'|'wait'|'onset'|'settled';frame:number;requestAt:number;case:SurfaceCase}|undefined;
const errors:string[]=[], surfaceResults:unknown[]=[], performanceResults:unknown[]=[];
const humanResults:unknown[]=[];let pendingHuman:{phase:'launch'|'wait'|'peak';frame:number}|undefined;
window.addEventListener('error',event=>errors.push(event.message));
window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
const ui=document.createElement('aside');ui.className='signoff-panel';ui.innerHTML=`<strong>ICE / LAYERED PLATE REVIEW</strong><p>Actual Game · unchanged sizing/counts · live sound</p>
<label for="human-target">Human target</label><select id="human-target"><option value="cloth">Clothed human</option><option value="armor">Armored human</option></select>
<label for="human-version">Ice presentation</label><select id="human-version"><option value="after">Layered plates / pale edges</option><option value="before">Previous plates / cyan material</option></select>
<label for="human-delivery">Delivery</label><select id="human-delivery"><option value="sticky">Sticky / delayed release</option><option value="bullet">Rifle / compact</option><option value="scatter">Scatter</option><option value="beam">Beam</option><option value="slug">Slug</option><option value="rocket">Rocket</option></select>
<label for="human-mode">Shooter</label><select id="human-mode"><option value="pilot">Pilot</option><option value="mech">Mech</option></select>
<button id="human-shot">Fire human snapshot</button><button id="human-aftermath">Show frost aftermath</button><button id="human-live">Play human scene with sound</button><button id="human-control">Take control / move and fire</button>
<label for="surface-case">Surface case</label><select id="surface-case"><option value="raised">Raised platform</option><option value="slope">Sloped face</option><option value="ceiling">Ceiling / underside</option><option value="ledge">Finite ledge</option></select>
<button id="surface-run">Fire surface test</button><button id="surface-settle">Show settled droplets</button><button id="surface-live">Play surface shot with sound</button>
<label>Performance scene<select id="perf-scene"><option value="crowd-rifle">Six humans / rifle</option><option value="crowd-sticky">Six humans / sticky</option><option value="crowd-and-surfaces">Six humans + raised surface / sticky</option></select></label>
<button id="perf-run">Run matched comparison with sound</button><button id="crowd-live">Play crowded scene with sound</button>
<button id="record-start">Record live gameplay with sound</button><button id="record-stop" disabled>Stop recording</button><a id="record-download" hidden download="ice-prototype.webm">Download gameplay recording</a>
<output id="signoff-state">Ready · previous plate-rime vs arrangement/material pass</output><details><summary>Live verification state</summary><pre id="live-diagnostics">{}</pre></details><details><summary>Raw verification results</summary><pre id="signoff-results">{}</pre></details>`;
document.body.append(ui);
const caption=document.createElement('div');caption.className='signoff-caption';document.body.append(caption);
function state(text:string){document.querySelector('#signoff-state')!.textContent=text;}
function publish(){document.querySelector('#signoff-results')!.textContent=JSON.stringify({humans:humanResults,surfaces:surfaceResults,performance:performanceResults,errors},null,2);}
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
  layer=new IcePresentation(scene,camera,{plateStyle:old?'previous':'layered',variationSeed:37391});
  const impact=layer.impact.bind(layer);layer.impact=(event:BallisticPresentationImpact)=>{contacts.push({phase:event.phase,point:event.point.toArray(),normal:event.normal.toArray(),surface:event.hitSurface?.name,target:targets.findIndex(t=>t.mesh===event.target),at:g.time});impact(event);};
  return layer;
 });
 game.setPresentationMode('quality');g.presentation.setSoundEnabled(true);
}
function setup(old:boolean,delivery:ProjectileType,count=6,mode:Mode='pilot'){
 handsOn=false;bench=false;frozen=true;pendingSurface=undefined;pendingHuman=undefined;liveScene=undefined;g.manualEvaluation=true;game.resetEvaluation();removeProbe();removeVantage();g.jumpMotion.reset();response(old);targets=[];
 g.mode=mode;g.trainingTargets=true;g.bodies=g.freshBodies();g.respawnUntil=0;g.time=20;g.lastFiredAt=-Infinity;g.nextShot=20;g.reloadUntil=0;g.reloadStartedAt=0;g.reloadFoleyStage=0;g.emptyAt=-20;
 g.combatRandom=seededRandom(37391);g.ballistics.shotSequence=0;g.world.parkedMech.position.set(8,0,-5);
 for(let i=0;i<count;i++){
  const target=g.makeEnemy(-4.0+(i%3)*2.1,-2-Math.floor(i/3)*2.2,false,'rusher');target.health=target.maxHealth=100000;target.shield=target.maxShield=0;
  const original=target.visual,look=createCorrosiveReviewTarget(target.mesh,target.id,i%2===1);
  target.visual={...original,update(dt,time,presentation){original.update(dt,time,presentation);look.update(dt,time,presentation);},dispose(){look.dispose();original.dispose();}};
  g.enemies.push(target);g.scene.add(target.mesh);targets.push(target);
 }
 const id=g.progression.loadouts[mode].weapon!,weapon=createWorkbenchWeapon({...DEFAULT_WORKBENCH_CONFIG,target:mode,element:'ice',projectile:delivery,weaponType:delivery==='sticky'?'launcher':'rifle',brand:delivery==='sticky'?'tackwork':'ironvale',level:1,rarity:'common',guaranteedStatus:true},id);
 g.progression.inventory[g.progression.inventory.findIndex(i=>i.id===id)]=weapon;g.refreshEquipmentVisuals();const stats=getStats(g.progression,mode);g.bodies[mode].ammo=stats.magazine;g.bodies[mode].reserve=500;
 g.bodies[mode].heat=0;g.bodies[mode].overheated=false;g.camera.position.set(-1.8,mode==='pilot'?1.8:4.4,5.4);aim(new THREE.Vector3(-1.9,1.55,-2));
 g.screen='none';g.ui.setScreen('none',g.progression,mode);shots.length=0;hits.length=0;contacts.length=0;layer.clear();
 game.driveEvaluation({fire:false,yaw:g.yaw,pitch:g.pitch});game.stepEvaluation(1/240);g.scene.updateMatrixWorld(true);
}
const originalHit=g.onBallisticHit.bind(g);g.onBallisticHit=hit=>{hits.push({target:targets.findIndex(t=>t.id===hit.targetId),at:g.time,point:hit.point.toArray(),direction:hit.direction.toArray(),damage:hit.damage,critical:hit.critical,spec:structuredClone(hit.spec)});originalHit(hit);};
function solid(name:string,size:[number,number,number],position:[number,number,number],slope=0){
 probe=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshToonMaterial({color:0x8b8171}));probe.name=name;probe.position.set(...position);probe.rotation.x=slope;probe.castShadow=probe.receiveShadow=true;g.scene.add(probe);g.world.occluders.push(probe);g.scene.updateMatrixWorld(true);return probe;
}
function surfaceFixture(kind:SurfaceCase){
 setup(false,'sticky',0);surfaceCase=kind;let point:THREE.Vector3;
 if(kind==='ceiling'){
  const mesh=solid('signoff-ceiling',[3.3,.35,2.8],[-1.6,3.6,-2]);point=mesh.localToWorld(new THREE.Vector3(0,-.175,0));g.camera.position.set(-1.6,1.8,3.2);
 }else if(kind==='slope'){
  const mesh=solid('signoff-slope',[3.2,.30,3.0],[-1.6,1.5,-2],.55);point=mesh.localToWorld(new THREE.Vector3(0,.15,0));standOnPlatform(-1.6,3.4);
 }else{
  const edge=kind==='ledge',mesh=solid(edge?'signoff-ledge':'signoff-raised-platform',[edge?1.3:3.4,.45,2.6],[-1.6,1.3,-2]);
  point=mesh.localToWorld(new THREE.Vector3(edge?.52:0,.225,0));standOnPlatform(edge?-1.0:-1.6,3.2);
 }
 aim(point);game.driveEvaluation({fire:false,yaw:g.yaw,pitch:g.pitch});game.stepEvaluation(1/240);
 caption.innerHTML=`${kind.toUpperCase()} / ACTUAL STICKY COLLISION<span>Current response · real projectile and fuse · sound enabled</span>`;
}
function snapshot(){return{time:g.time,mode:g.mode,body:{...g.bodies[g.mode]},shots:structuredClone(shots),hits:structuredClone(hits),targets:targets.map(t=>({health:t.health,shield:t.shield,statuses:structuredClone(t.statuses)})),contacts:structuredClone(contacts),diagnostics:layer.diagnostics,presentation:g.presentation.diagnostics};}
function humanFixture(){
 const delivery=(document.querySelector('#human-delivery')as HTMLSelectElement).value as ProjectileType,mode=(document.querySelector('#human-mode')as HTMLSelectElement).value as Mode,old=(document.querySelector('#human-version')as HTMLSelectElement).value==='before',armored=(document.querySelector('#human-target')as HTMLSelectElement).value==='armor';
 setup(old,delivery,2,mode);const target=targets[armored?1:0];g.camera.position.set(target.mesh.position.x,mode==='pilot'?1.8:4.4,4.2);aim(target.mesh.position.clone().add(new THREE.Vector3(0,1.55,0)));game.driveEvaluation({fire:false,yaw:g.yaw,pitch:g.pitch});game.stepEvaluation(1/240);
 caption.innerHTML=`ICE / ${old?'PREVIOUS PLATES':'LAYERED PLATES'}<span>${armored?'Armored human':'Clothed human'} · ${delivery} · ${mode} · actual Game / intact characters</span>`;return{delivery,mode,armored,old};
}
function humanAudit(stage:string){const audit={stage,selection:{target:(document.querySelector('#human-target')as HTMLSelectElement).value,version:(document.querySelector('#human-version')as HTMLSelectElement).value,delivery:(document.querySelector('#human-delivery')as HTMLSelectElement).value,mode:g.mode},events:layer.ice?.events??[],snapshot:snapshot()};humanResults.push(structuredClone(audit));publish();return audit;}
async function humanShot(){humanFixture();await unlock();pendingHuman={phase:'launch',frame:0};frozen=false;state('Firing real human contact…');}
function updateHuman(){
 if(!pendingHuman)return;const p=pendingHuman;if(p.phase==='launch'){shotStep(true);p.phase='wait';return;}shotStep(false);p.frame++;
 const delivery=(document.querySelector('#human-delivery')as HTMLSelectElement).value,ready=delivery==='sticky'?contacts.some(c=>c.phase==='detonate'):contacts.length>0;
 if(p.phase==='wait'&&ready){p.phase='peak';p.frame=0;}
 if(p.phase==='peak'&&p.frame>=11){pendingHuman=undefined;frozen=true;humanAudit('peak');state(`Human peak: ${layer.ice?.diagnostics.plates??0} plates · ${layer.ice?.diagnostics.rimes??0} rime bindings · ${hits.length} actual hits`);}
 if(p.frame>360)throw new Error('No human contact');
}
function humanAftermath(){for(let i=0;i<42;i++)shotStep(false);humanAudit('aftermath');state(`Frost aftermath · ${layer.ice?.diagnostics.plates??0} plates · ${layer.ice?.diagnostics.rimes??0} local rime bindings`);}
async function liveHuman(){humanFixture();await unlock();pendingHuman=undefined;liveScene='human';liveFrame=0;frozen=false;state('Live human firing · native timing · real weapon and ice sound');}
async function takeControl(){humanFixture();await unlock();pendingHuman=undefined;liveScene=undefined;handsOn=true;frozen=false;g.evaluationInput=null;g.manualEvaluation=false;g.resume(true);state('Hands-on mode · WASD move · mouse or arrows aim · LMB fire · R reload · Esc pause');}
function surfaceAudit(){
 const contact=contacts.find(c=>c.phase==='contact'&&c.surface===probe?.name);if(!contact)throw new Error(`Shot missed ${probe?.name}`);
 return{case:surfaceCase,contact,ice:layer.ice!.diagnostics,snapshot:snapshot()};
}
async function unlock(){g.presentation.setSoundEnabled(true);await g.presentation.unlockAudio();const d=g.presentation.diagnostics;if(!d.qualityAudioUnlocked||!d.elementalAudioUnlocked)throw new Error('Both audio buses must be unlocked');}
async function fireSurface(){
 surfaceFixture((document.querySelector('#surface-case') as HTMLSelectElement).value as SurfaceCase);await unlock();
 pendingSurface={phase:'launch',frame:0,requestAt:performance.now(),case:surfaceCase};frozen=false;state('Firing actual sticky projectile…');
}
function shotStep(fire:boolean){game.driveEvaluation({fire,yaw:g.yaw,pitch:g.pitch});game.stepEvaluation(1/60);}
function updateSurface(){
 if(!pendingSurface)return;const p=pendingSurface;
 if(p.phase==='launch'){shotStep(true);p.phase='wait';return;}
 shotStep(false);p.frame++;
 if(p.phase==='wait'&&layer.ice!.events.some(e=>e.phase==='detonate')){p.phase='onset';p.frame=0;}
 if(p.phase==='onset'&&p.frame>=6){const result={stage:'onset',...surfaceAudit()};surfaceResults.push(result);pendingSurface=undefined;frozen=true;publish();state(`${surfaceCase}: impact frozen 100 ms after real detonation · ${result.ice.plates} plates · ${result.ice.rimes} local frost bindings`);}
 if(p.frame>300)throw new Error('No sticky detonation on requested surface');
}
function settleSurface(){for(let i=0;i<48;i++)shotStep(false);const result={stage:'settled',...surfaceAudit()};surfaceResults.push(result);publish();state(`${surfaceCase}: settled at +900 ms · ${result.ice.plates} plates · ${result.ice.rimes} frost bindings`);}
function crowdedFixture(old:boolean,scene:SceneCase){
 setup(old,scene==='crowd-rifle'?'bullet':'sticky');
 if(scene==='crowd-and-surfaces'){solid('signoff-benchmark-raised-top',[3,.45,2.0],[-1.7,.9,1.25]);standOnPlatform(-1.8,5.4);}
 caption.innerHTML=`${scene.toUpperCase()} / ${old?'PREVIOUS PLATES':'LAYERED PLATES'}<span>Six clothed / armored humans · standard cadence and reload · live sound</span>`;
}
function benchmarkAim(frame:number){
 const slot=Math.floor(frame/90)%6;
 g.camera.position.set(-1.8,sceneCase==='crowd-and-surfaces'?3.2:1.8,5.4);
 if(sceneCase==='crowd-and-surfaces'&&slot%2===0)aim(new THREE.Vector3(-1.7,1.125,1.25));
 else{const target=targets[slot];aim(target.mesh.position.clone().add(new THREE.Vector3(0,1.55,0)));}
}
function collectPeak(){const d=layer.ice?.diagnostics??{plates:0,flakes:0,rimes:0},a=g.presentation.diagnostics;for(const key of ['plates','flakes','rimes'] as const)peaks[key]=Math.max(peaks[key],d[key]);peaks.physicalVoices=Math.max(peaks.physicalVoices,a.physicalVoices);peaks.elementalVoices=Math.max(peaks.elementalVoices,a.elementalVoices);}
function normalized(s:ReturnType<typeof snapshot>){return{time:s.time,body:s.body,shots:s.shots,hits:s.hits,targets:s.targets,contacts:s.contacts};}
async function compare(){
 if(busy)return;busy=true;performanceResults.length=0;sceneCase=(document.querySelector('#perf-scene') as HTMLSelectElement).value as SceneCase;
 benchmarkResizes=0;benchmarkHidden=document.visibilityState==='visible'?0:1;
 const runs:unknown[]=[];
 try{
  for(const [label,old] of [['before',true],['current',false],['before-repeat',true]] as const){
   benchmarkViewport();
   crowdedFixture(old,sceneCase);await unlock();benchFrame=0;simulationCosts.length=0;for(const key of Object.keys(peaks) as (keyof typeof peaks)[])peaks[key]=0;
   state(`${sceneCase} / ${label}: 120 warm-up + 720 measured frames · sound on · capture off`);
   const promise=perf.measure(label,720,120);bench=true;frozen=false;const started=performance.now(),cost=await promise;bench=false;frozen=true;
   runs.push({label,wallMs:performance.now()-started,cost,simulationMs:distribution(simulationCosts.slice(120)),peaks:{...peaks},snapshot:snapshot()});
  }
  const typed=runs as {label:string;snapshot:ReturnType<typeof snapshot>}[];
  const equal=typed.every(r=>JSON.stringify(normalized(r.snapshot))===JSON.stringify(normalized(typed[0].snapshot)));
  const targetsHit=new Set((typed[1].snapshot.hits as {target:number}[]).map(h=>h.target).filter(i=>i>=0)).size;
  const result={scene:sceneCase,runs,combatEqual:equal,targetsHit,protocol:{warmup:120,frames:720,simulationStep:1/60,sound:true,recording:false,visibility:document.visibilityState,benchmarkResizes,benchmarkHidden}};
  performanceResults.push(result);publish();state(`${benchmarkResizes||benchmarkHidden?'INVALID / window changed':equal&&targetsHit>=3?'PASS':'FAIL'} / ${sceneCase}: three matched runs complete · ${targetsHit} targets hit · combat ${equal?'identical':'DIFFERENT'}`);
 }finally{busy=false;bench=false;frozen=true;}
}
let liveScene:'surface'|'crowd'|'human'|undefined,liveFrame=0;
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
 link.href=URL.createObjectURL(new Blob(chunks,{type:recorder!.mimeType}));link.hidden=false;recordStream?.getTracks().forEach(t=>t.stop());await mix?.close();recorder=undefined;
 (document.querySelector('#record-stop') as HTMLButtonElement).disabled=true;state('Gameplay recording ready · live audio · no replacement or normalization');
}
function guard(action:()=>void|Promise<void>){return()=>{void Promise.resolve().then(action).catch(error=>{errors.push(String(error));state(`ERROR: ${error}`);publish();});};}
document.querySelector('#surface-run')!.addEventListener('click',guard(fireSurface));
document.querySelector('#human-shot')!.addEventListener('click',guard(humanShot));
document.querySelector('#human-aftermath')!.addEventListener('click',guard(humanAftermath));
document.querySelector('#human-live')!.addEventListener('click',guard(liveHuman));
document.querySelector('#human-control')!.addEventListener('click',guard(takeControl));
document.querySelector('#surface-settle')!.addEventListener('click',guard(settleSurface));
document.querySelector('#surface-live')!.addEventListener('click',guard(liveSurface));
document.querySelector('#perf-run')!.addEventListener('click',guard(compare));
document.querySelector('#crowd-live')!.addEventListener('click',guard(liveCrowd));
document.querySelector('#record-start')!.addEventListener('click',guard(startRecording));
document.querySelector('#record-stop')!.addEventListener('click',guard(stopRecording));
const draw=g.comicRenderer.render.bind(g.comicRenderer);let previous=performance.now(),diagnosticTick=0;
g.comicRenderer.render=()=>{
 const now=performance.now(),dt=Math.min(.05,(now-previous)/1000);previous=now;
 const updateStart=performance.now();
 if(handsOn){/* Game.run owns ordinary native input and simulation. */}
 else if(bench){benchmarkAim(benchFrame++);shotStep(true);simulationCosts.push(performance.now()-updateStart);collectPeak();}
 else if(pendingSurface)updateSurface();
 else if(pendingHuman)updateHuman();
 else if(liveScene&&!frozen){
  if(liveScene==='crowd')benchmarkAim(Math.floor(liveFrame/1.5));
  game.driveEvaluation({fire:liveScene==='crowd'||liveScene==='human'||liveFrame===0,yaw:g.yaw,pitch:g.pitch});game.stepEvaluation(Math.max(1/240,dt));liveFrame++;
 }
 const start=perf.begin();draw();perf.end(start);
 if(++diagnosticTick%30===0){let matrixHash=2166136261;if(layer.ice)for(const mesh of layer.ice.group.children)if(mesh instanceof THREE.InstancedMesh){const words=new Uint32Array(mesh.instanceMatrix.array.buffer);for(const word of words)matrixHash=Math.imul(matrixHash^word,16777619);}document.querySelector('#live-diagnostics')!.textContent=JSON.stringify({screen:g.screen,time:g.time,handsOn,position:g.camera.position.toArray(),ammo:g.bodies[g.mode].ammo,ice:layer.ice?.diagnostics??null,matrixHash:matrixHash>>>0,audio:g.presentation.diagnostics});}
};
g.start(false);surfaceFixture('raised');publish();
const gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
const metadata={userAgent:navigator.userAgent,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),viewport:[innerWidth,innerHeight],dpr:g.renderer.getPixelRatio(),before:'previous-plate-rime',current:'layered-plates',entry:'Actual Game evaluation driver / isolated review save / raised-health human fixtures'};
const meta=document.createElement('script');meta.type='application/json';meta.id='signoff-metadata';meta.textContent=JSON.stringify(metadata);document.body.append(meta);
window.addEventListener('pagehide',()=>perf.dispose());game.run();
