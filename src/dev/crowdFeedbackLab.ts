/** Long real-Game capacity fixture. Synthetic setup is explicit; gameplay and accounting remain authoritative. */
import '../style.css';
import * as THREE from 'three';
import {Game,type EvaluationInput,type EvaluationShot} from '../game';
import {createEvaluationFixture} from '../diagnostics/fixtures';
import {applyStatus,type StatusState} from '../core/statusEffects';
import {createWeaponSpec,type ElementType,type WeaponSpec} from '../core/arsenal';
import type {CombatMeasurementEvent,CombatMeasurementPayload,EnemyRole} from '../encounter/contracts';
import type {BallisticHit} from '../rendering/PlayerBallistics';
import {isWalkable} from '../world';
import {setCrowdFeedbackMode,getCrowdFeedbackMode} from '../rendering/quality/crowdFeedbackPolicy';
import {surfacePoseCacheDiagnostics,resetSurfacePoseCacheDiagnostics} from '../rendering/quality/surfacePoseCache';
import {sampleDamageAnchor,type DamageAnchors} from '../ui/damageAnchors';
import {CrowdCpuScopes,CrowdGpuTimer,type CrowdGpuFrame} from './crowdFeedbackTiming';

type Body={health:number;shield:number;ammo:number;reserve:number;heat:number;overheated:boolean;lastDamage:number};
type Target={id:number;mesh:THREE.Group;health:number;maxHealth:number;shield:number;heavy:boolean;statuses:StatusState};
interface CapacityBridge{
 scene:THREE.Scene;camera:THREE.PerspectiveCamera;renderer:THREE.WebGLRenderer;comicRenderer:{render():void};
 enemies:Target[];readonly combatTargets:Target[];damageAnchors:WeakMap<THREE.Group,DamageAnchors>;mode:'pilot'|'mech';yaw:number;pitch:number;time:number;screen:string;body:Body;evaluationActive:boolean;
 world:{colliders:{minX:number;maxX:number;minZ:number;maxZ:number}[]};ui:object;
 makeEnemy(x:number,z:number,heavy:boolean,role:EnemyRole):Target;start(capture?:boolean):void;resume(capture?:boolean):void;
 measure(event:CombatMeasurementPayload):void;onBallisticHit(hit:BallisticHit):void;
 ballistics:{fire(origin:THREE.Vector3,direction:THREE.Vector3,spec:WeaponSpec,damage:number,...rest:unknown[]):void};
}
const params=new URLSearchParams(location.search),count=params.get('targets')==='3'?3:12;
const mode=params.get('feedback')==='classic'?'classic':'crowd';
const requestedPace=Number(params.get('pace')??60),pace=requestedPace===0?0:60;
setCrowdFeedbackMode(mode);resetSurfacePoseCacheDiagnostics();
const fixture=createEvaluationFixture('elemental-pressure');
const measurements:CombatMeasurementEvent[]=[],shots:EvaluationShot[]=[],hits:unknown[]=[],ballisticShots:unknown[]=[],synthetic:unknown[]=[],reprocs:unknown[]=[];
let measurementCallbacks=0,expectedMeasurements=0,recordingStarted=false;
const game=new Game(document.querySelector<HTMLElement>('#app')!,{
 initialProgression:fixture.state,saveKey:`dust-steel.crowd-feedback.${count}.${mode}.v1`,encounterSeed:19,
 evaluationDriver:true,manualEvaluation:true,autoEncounters:false,feedbackQuality:mode,
 onMeasurement:event=>{measurementCallbacks++;measurements.push(event);},onEvaluationShot:shot=>shots.push(structuredClone(shot)),
});
const g=game as unknown as CapacityBridge;
// Keep diagnostics armed through an ordinary defeat/finish so the rest of the
// capacity run still records actual calls. No combat event or amount is invented.
const originalMeasure=g.measure.bind(g);g.measure=event=>{if(recordingStarted){expectedMeasurements++;g.evaluationActive=true;}originalMeasure(event);};
const originalHit=g.onBallisticHit.bind(g);g.onBallisticHit=hit=>{
 hits.push({at:g.time,targetId:hit.targetId,point:hit.point.toArray(),direction:hit.direction.toArray(),damage:hit.damage,critical:hit.critical,spec:structuredClone(hit.spec)});originalHit(hit);
};
const originalFire=g.ballistics.fire.bind(g.ballistics);g.ballistics.fire=(origin,direction,spec,damage,...rest)=>{
 ballisticShots.push({at:g.time,origin:origin.toArray(),direction:direction.toArray(),spec:structuredClone(spec),damage});originalFire(origin,direction,spec,damage,...rest);
};
const initialElements=['fire','ice','corrosive','shock','radiation','gravity','adhesive']as const;
const positions:readonly[number,number][]=[[-8,-5],[-4,-5],[0,-5],[4,-5],[8,-5],[-8,-11],[-4,-11],[4,-11],[8,-11],[-8,-17],[-4,-17],[0,-17],[4,-17],[8,-17]];
for(const[x,z]of positions){
 if(g.enemies.length>=count)break;
 const role=(['rusher','flanker','heavy']as const)[g.enemies.length%3];if(!isWalkable(x,z,role==='heavy'?1.4:.6,g.world.colliders))continue;
 const target=g.makeEnemy(x,z,role==='heavy',role);target.health=target.maxHealth=100000;g.enemies.push(target);g.scene.add(target.mesh);
 for(const element of initialElements)applyStatus(target.statuses,element,0,1);
}
if(g.enemies.length!==count)throw new Error('Insufficient clear capacity fixture positions.');
g.mode='mech';g.camera.position.set(0,4.4,11);g.camera.lookAt(0,2,-7);g.yaw=g.camera.rotation.y;g.pitch=g.camera.rotation.x;g.camera.updateMatrixWorld(true);
g.start(false);
// Recording-only diagnostic switch. Unlike starting an encounter/dummy evaluation,
// this preserves the existing capacity fixture, live AI and ordinary control policy.
g.evaluationActive=true;recordingStarted=true;
const inputYaw=g.yaw,inputPitch=g.pitch;
const initial=game.getEncounterSnapshot(),initialSurfaceCounters=surfacePoseCacheDiagnostics();
const cpu=new CrowdCpuScopes();
const timingHooks=[
 [g,'updateTargetEffects','status'],[g,'updateHUD','hud'],[g.ui,'update','hudDom'],
 [g.ui,'setTargetStatuses','hudStatuses'],[g.ui,'hit','numberInput'],[g.ui,'updateFeedback','numberFlush'],
]as const;
const wrapped=timingHooks.map(([owner,name,scope])=>({name,scope,installed:cpu.wrap(owner,name,scope)}));
const canvas=g.renderer.domElement,gl=g.renderer.getContext()as WebGL2RenderingContext,gpu=new CrowdGpuTimer(gl);
const extension=gl.getExtension('WEBGL_debug_renderer_info');
const hardware={renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:extension?gl.getParameter(extension.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),version:gl.getParameter(gl.VERSION),timer:gpu.supported,userAgent:navigator.userAgent,dpr:devicePixelRatio,canvas:[canvas.width,canvas.height]};
const longTasks:{start:number;duration:number}[]=[];
let longTaskObserver:PerformanceObserver|undefined;
try{longTaskObserver=new PerformanceObserver(list=>{for(const entry of list.getEntries())longTasks.push({start:entry.startTime,duration:entry.duration});});longTaskObserver.observe({entryTypes:['longtask']});}catch{/* Unsupported browsers retain CPU/RAF/GPU measurements. */}
const numberRoot=document.querySelector<HTMLElement>('.damage-numbers')!,numberSelector='.damage-number,.crowd-damage-number';
const initialAllocated=numberRoot.querySelectorAll(numberSelector).length;
let domCreated=initialAllocated,domRemoved=0,peakDom=initialAllocated,peakUnhidden=0;
const mutations=new MutationObserver(records=>{for(const record of records){for(const node of record.addedNodes)if(node instanceof Element&&node.matches(numberSelector))domCreated++;for(const node of record.removedNodes)if(node instanceof Element&&node.matches(numberSelector))domRemoved++;}});
mutations.observe(numberRoot,{childList:true});
const button=document.createElement('button');button.textContent='Enable sound for crowd verification';button.id='crowd-enable';button.style.cssText='position:fixed;right:24px;top:145px;z-index:30;padding:10px;background:#ead4a4;color:#18272b;font:12px system-ui';button.onclick=()=>{g.resume(false);button.hidden=true;};document.body.append(button);
const banner=document.createElement('aside');banner.style.cssText='position:fixed;left:24px;top:180px;z-index:10;padding:6px 10px;background:#152329e8;color:#f0d695;border-left:3px solid #e1b359;font:11px system-ui;pointer-events:none';banner.textContent=`CAPACITY FIXTURE · ${count} live targets · 7 elements · ${mode.toUpperCase()} · ${pace?`${pace}Hz maximum`:'uncapped diagnostic'}`;document.body.append(banner);

interface Frame extends CrowdGpuFrame{
 simTime:number;wallTimeMs:number;rafMs:number;renderDelta:number;stepCpuMs:number;fixtureCpuMs:number;drawCpuMs:number;glSubmitCpuMs:number;gameFrameCpuMs:number;handlerCpuMs:number;
 self:Record<string,number>;calls:number;triangles:number;geometries:number;textures:number;domLabels:number;domUnhiddenLabels:number;surface:ReturnType<typeof surfacePoseCacheDiagnostics>;
 feedback:unknown;body:Body;targetState:number[][];screen:string;mode:string;camera:number[];yaw:number;pitch:number;
}
const frames:Frame[]=[];
let started=false,running=false,skippedRafs=0,startWall=0,endWall=0;
let drawingFrame:Frame|null=null;
const originalDraw=g.comicRenderer.render.bind(g.comicRenderer);
g.comicRenderer.render=()=>{
 if(!drawingFrame){originalDraw();return;}
 const began=cpu.enter('gpuInstrumentation');gpu.begin(drawingFrame);if(began)cpu.leave();
 const start=performance.now();originalDraw();drawingFrame.glSubmitCpuMs=performance.now()-start;
 const ended=cpu.enter('gpuInstrumentation');gpu.end();if(ended)cpu.leave();
};
function fixtureActions(frame:number){
 if(frame>1&&frame<=840&&(frame-1)%60===0){for(const target of g.enemies)for(const element of initialElements)applyStatus(target.statuses,element,g.time,1);reprocs.push({frame,time:g.time,targets:g.enemies.map(target=>target.id),elements:initialElements});}
 if(frame===1||frame===61||frame===121){
  const elements:ElementType[]=['fire','ice','corrosive','gravity','adhesive','shock'];
  for(const[index,element]of elements.entries()){
   if(!g.enemies.length)break;
   const spec=createWeaponSpec('sticky',element,'mech'),target=g.enemies[index%g.enemies.length];
   const origin=new THREE.Vector3((index-2.5)*.24,3.8,8),end=target.mesh.position.clone().add(new THREE.Vector3(0,target.heavy?2.5:1.5,0));
   g.ballistics.fire(origin,end.sub(origin).normalize(),spec,1);synthetic.push({frame,time:g.time,element,targetId:target.id});
  }
 }
}
function oneFrame(frame:number,rafMs:number){
 const handlerStart=performance.now(),snapshot=game.getEncounterSnapshot();
 const input:EvaluationInput={fire:frame<=840,yaw:inputYaw,pitch:inputPitch,heal:snapshot.body.health<250};
 const renderDelta=rafMs?Math.min(.25,rafMs/1000):1/60;
 const entry:Frame={frame,gpuMs:null,simTime:0,wallTimeMs:0,rafMs,renderDelta,stepCpuMs:0,fixtureCpuMs:0,drawCpuMs:0,glSubmitCpuMs:0,gameFrameCpuMs:0,handlerCpuMs:0,self:{},calls:0,triangles:0,geometries:0,textures:0,domLabels:0,domUnhiddenLabels:0,surface:surfacePoseCacheDiagnostics(),feedback:null,body:{...g.body},targetState:[],screen:g.screen,mode:g.mode,camera:g.camera.position.toArray(),yaw:g.yaw,pitch:g.pitch};
 const workStart=performance.now();cpu.begin();
 const stepStart=performance.now();game.driveEvaluation(input);game.stepEvaluation(1/60);entry.stepCpuMs=performance.now()-stepStart;
 const fixtureStart=performance.now();fixtureActions(frame);entry.fixtureCpuMs=performance.now()-fixtureStart;
 g.renderer.info.autoReset=false;g.renderer.info.reset();
 const drawStart=performance.now();drawingFrame=entry;game.renderEvaluation(renderDelta,true);drawingFrame=null;entry.drawCpuMs=performance.now()-drawStart;
 entry.self=cpu.end();entry.gameFrameCpuMs=performance.now()-workStart;
 entry.simTime=g.time;entry.wallTimeMs=performance.now()-startWall;entry.calls=g.renderer.info.render.calls;entry.triangles=g.renderer.info.render.triangles;
 entry.geometries=g.renderer.info.memory.geometries;entry.textures=g.renderer.info.memory.textures;entry.domLabels=numberRoot.childElementCount;entry.domUnhiddenLabels=[...numberRoot.children].filter(node=>!(node as HTMLElement).hidden).length;peakDom=Math.max(peakDom,entry.domLabels);peakUnhidden=Math.max(peakUnhidden,entry.domUnhiddenLabels);
 entry.surface=surfacePoseCacheDiagnostics();entry.feedback=game.feedbackDiagnostics;entry.body={...g.body};
 // Packed numeric rows avoid allocating seven nested status objects per target
 // per frame while retaining every authoritative value for exact comparison.
 entry.targetState=g.enemies.map(target=>{const row=[target.id,target.mesh.position.x,target.mesh.position.y,target.mesh.position.z,target.health,target.shield];for(const element of initialElements){const status=target.statuses[element];if(status)row.push(1,status.power,status.expiresAt,status.nextTickAt,status.stacks,status.frozenUntil);else row.push(0,0,0,0,0,0);}return row;});
 entry.screen=g.screen;entry.mode=g.mode;entry.camera=g.camera.position.toArray();entry.yaw=g.yaw;entry.pitch=g.pitch;
 entry.handlerCpuMs=performance.now()-handlerStart;frames.push(entry);
}
async function run(frameLimit=1200){
 if(started)throw new Error('Use a fresh page for each measured or captured arm.');
 if(!Number.isInteger(frameLimit)||frameLimit<1||frameLimit>3600)throw new RangeError('Expected 1–3600 frames.');
 started=true;running=true;startWall=performance.now();let lastAdmitted=0,lastPace=0;
 await new Promise<void>((resolve,reject)=>{
  function next(timestamp:number){
   try{
    const interval=1000/60;
    if(pace&&lastPace&&timestamp-lastPace<interval-.3){skippedRafs++;requestAnimationFrame(next);return;}
    if(pace)lastPace=lastPace?lastPace+interval*Math.max(1,Math.floor((timestamp-lastPace+.3)/interval)):timestamp;
    const rafMs=lastAdmitted?timestamp-lastAdmitted:0;lastAdmitted=timestamp;
    oneFrame(frames.length+1,rafMs);
    if(frames.length>=frameLimit){endWall=performance.now();running=false;resolve();}else requestAnimationFrame(next);
   }catch(error){running=false;reject(error);}
  }
  requestAnimationFrame(next);
 });
 // Query completion stays outside recorded frames and never advances gameplay.
 for(let waits=0;gpu.pendingCount&&waits<180;waits++){await new Promise(requestAnimationFrame);gpu.poll();}
 await Promise.resolve();return evidence();
}
function labelBounds(){
 const all=[...numberRoot.querySelectorAll<HTMLElement>(numberSelector)];
 const labels=all.filter(node=>{const style=getComputedStyle(node);return!node.hidden&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>.01;}).map(node=>{
  const root=node.getBoundingClientRect();let left=root.left,top=root.top,right=root.right,bottom=root.bottom;
  // Include overflowing cue/value content instead of trusting an estimated row width.
  for(const child of node.querySelectorAll('span,strong,svg')){const rect=child.getBoundingClientRect();if(rect.width&&rect.height){left=Math.min(left,rect.left);top=Math.min(top,rect.top);right=Math.max(right,rect.right);bottom=Math.max(bottom,rect.bottom);}}
  return{text:node.textContent,kind:node.dataset.damageKind,eventKind:node.dataset.eventKind,amount:node.dataset.damageAmount,events:node.dataset.damageEvents,x:left,y:top,width:right-left,height:bottom-top,rootBounds:{x:root.x,y:root.y,width:root.width,height:root.height}};
 }).filter(rect=>rect.width>0&&rect.height>0&&rect.x+rect.width>0&&rect.y+rect.height>0&&rect.x<innerWidth&&rect.y<innerHeight);
 const heads=g.combatTargets.flatMap(target=>(g.damageAnchors.get(target.mesh)?.all??[]).map(anchor=>{const point=sampleDamageAnchor(anchor,new THREE.Vector3()).project(g.camera);return{id:target.id,anchor:anchor.name,clipZ:point.z,x:(point.x+1)*innerWidth/2-28,y:(1-point.y)*innerHeight/2-14,width:56,height:62};})).filter(head=>head.clipZ>=-1&&head.clipZ<=1&&head.x>=-28&&head.x<=innerWidth&&head.y>=-14&&head.y<=innerHeight);
 const reticle={x:innerWidth/2-48,y:innerHeight/2-48,width:96,height:96};
 const hudZones=[...document.querySelectorAll<HTMLElement>('.location-block,.encounter-block,.objective-block,.vitals-block,.weapon-block,.ability-block,.test-dummy-readout,.toast-stack')].filter(node=>!node.hidden&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden').map(node=>{const rect=node.getBoundingClientRect();return{selector:node.className,x:rect.x,y:rect.y,width:rect.width,height:rect.height};}).filter(rect=>rect.width>0&&rect.height>0);
 const intersects=(a:{x:number;y:number;width:number;height:number},b:{x:number;y:number;width:number;height:number})=>Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y);
 let overlappingPairs=0;const overlapped=new Set<number>();
 for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++)if(intersects(labels[i],labels[j])){overlappingPairs++;overlapped.add(i);overlapped.add(j);}
 return{allocated:all.length,visible:labels.length,labels,overlappingPairs,labelsWithOverlap:overlapped.size,reticle,heads,headSource:'actual Game cached critical/head anchors including both dummy disks',hudZones,reticleOverlaps:labels.filter(label=>intersects(label,reticle)).length,headOverlaps:labels.filter(label=>heads.some(head=>intersects(label,head))).length,hudOverlaps:labels.filter(label=>hudZones.some(zone=>intersects(label,zone))).length};
}
function evidence(){return{
 protocol:'crowd-feedback-capacity-v1',provenance:'synthetic-capacity-fixture',feedbackQuality:game.feedbackQuality,surfaceMode:getCrowdFeedbackMode(),count,pace,frameCount:frames.length,simulationStep:1/60,wallClockMs:endWall-startWall,simulationSeconds:g.time,skippedRafs,hardware,wrapped,
 fixture:{version:'crowd-pressure-fixed-aim-v2',build:'elemental-pressure',seed:19,codes:fixture.codes,stats:fixture.stats,initialElements,activeFrames:840,totalFrames:1200,syntheticStickyShots:18,targetHealth:100000,inputYaw,inputPitch,policy:'scripted input compensates aim to captured initial yaw/pitch each tick; actual shot recoil/muzzle pose unchanged; heal below250; cease fire and added re-procs after14s; actual AI/defeat/recovery continue',targetStateRow:'[id,x,y,z,health,shield, then six values per initialElements entry: active,power,expiresAt,nextTickAt,stacks,frozenUntil]'},
 initial,initialSurfaceCounters,current:game.getEncounterSnapshot(),feedback:game.feedbackDiagnostics,presentation:game.presentationDiagnostics,surface:surfacePoseCacheDiagnostics(),
 measurements,measurementAccounting:{expected:expectedMeasurements,callbacks:measurementCallbacks,retained:measurements.length,dropped:expectedMeasurements-measurements.length},shots,hits,ballisticShots,synthetic,reprocs,frames,longTasks:longTasks.filter(task=>task.start>=startWall&&task.start<=endWall),
 dom:{initialAllocated,created:domCreated,removed:domRemoved,peakAllocated:peakDom,peakUnhidden,finalAllocated:numberRoot.childElementCount,finalUnhidden:[...numberRoot.children].filter(node=>!(node as HTMLElement).hidden).length},gpu:{supported:gpu.supported,...gpu.diagnostics,pending:gpu.pendingCount},running,
};}
Object.assign(window,{crowdFeedback:{game,measure:run,capture:async(frame:number)=>{const result=await run(frame);return{...result,labelBounds:labelBounds()};},read:evidence,hardware}});
window.addEventListener('pagehide',()=>{mutations.disconnect();longTaskObserver?.disconnect();gpu.dispose();g.renderer.info.autoReset=true;},{once:true});
