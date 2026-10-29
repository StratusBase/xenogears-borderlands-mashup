import '../style.css';
import './corrosiveLab.css';
import * as THREE from 'three';
import { Game,type EvaluationShot } from '../game';
import { createProgression,getStats,seededRandom,type Progression,type Mode } from '../core/index';
import { createWorkbenchWeapon,DEFAULT_WORKBENCH_CONFIG } from '../core/workbench';
import { getWeaponSpec,type ElementType,type ProjectileType } from '../core/arsenal';
import { ElementalPresentation } from '../rendering/quality/elementalPresentation';
import { GamePresentation } from '../rendering/quality/GamePresentation';
import { createCorrosiveReviewTarget } from '../rendering/quality/corrosive/reviewTargets';
import { QualityPerformance } from '../rendering/quality/performance';
import type { EncounterEnemyVisual } from '../rendering/encounterEnemy';
import type { BallisticHit } from '../rendering/PlayerBallistics';
import type { StatusState } from '../core/statusEffects';

interface ReviewTarget {id:number;mesh:THREE.Group;health:number;maxHealth:number;shield:number;maxShield:number;visual:EncounterEnemyVisual;statuses:StatusState;statusEffects:Map<ElementType,{dispose():void}>;statusCoatings:Map<ElementType,{dispose():void}>}
interface Bridge{
 scene:THREE.Scene;camera:THREE.PerspectiveCamera;renderer:THREE.WebGLRenderer;comicRenderer:{render():void};presentation:GamePresentation;
 progression:Progression;time:number;mode:Mode;screen:string;manualEvaluation:boolean;evaluationInput:unknown;trainingTargets:boolean;
 yaw:number;pitch:number;lastFiredAt:number;nextShot:number;reloadUntil:number;reloadStartedAt:number;emptyAt:number;combatRandom:()=>number;
 enemies:ReviewTarget[];bodies:Record<Mode,{ammo:number;reserve:number;heat:number;overheated:boolean}>;
 world:{parkedMech:THREE.Group};ballistics:{clear():void;shotSequence:number;activeCount:number};
 makeEnemy(x:number,z:number,heavy:boolean,role:'rusher'):ReviewTarget;refreshEquipmentVisuals():void;onBallisticHit(hit:BallisticHit):void;
 start(capture?:boolean):void;resume(capture?:boolean):void;ui:{setScreen(screen:string,progression:Progression,mode:Mode):void};
}
const progression=createProgression();
for(const mode of['pilot','mech']as const){const item=createWorkbenchWeapon({...DEFAULT_WORKBENCH_CONFIG,target:mode,element:'corrosive',level:1,rarity:'common',guaranteedStatus:true},`corrosive-ab-${mode}`);progression.inventory.push(item);progression.loadouts[mode].weapon=item.id;}
const shots:EvaluationShot[]=[],hits:unknown[]=[],measurements:unknown[]=[];
const game=new Game(document.querySelector<HTMLElement>('#app')!,{initialProgression:progression,saveKey:'dust-steel.corrosive-ab.review.v1',autoEncounters:false,trainingTargets:false,evaluationDriver:true,manualEvaluation:true,presentation:'legacy',onEvaluationShot:shot=>{shots.push(structuredClone(shot));},onMeasurement:event=>{if(measurements.length<8000)measurements.push(structuredClone(event));}});
const g=game as unknown as Bridge;
let after=true,selected:'human'|'armored'='human',delivery:ProjectileType='sticky',secondary:ElementType|'none'='none',layer:ElementalPresentation;
let bench=false,benchFire=true,moving=false,pairTargets:ReviewTarget[]=[],lastTime=0,tick=0;
const perf=new QualityPerformance(g.renderer);
function setVersion(value:boolean){
 game.setPresentationMode('legacy');after=value;
 g.presentation.setElementalFactory((scene,camera)=>{layer=new ElementalPresentation(scene,camera,{corrosiveAB:after});return layer;});
 game.setPresentationMode('quality');
 document.querySelector('#ab-version')?.setAttribute('aria-pressed',String(after));
 const button=document.querySelector('#ab-version');if(button)button.textContent=after?'A+B prototype':'Previous elemental pass';updateMark();
}
function weapon(){const mode=g.mode,id=g.progression.loadouts[mode].weapon!;const item=createWorkbenchWeapon({...DEFAULT_WORKBENCH_CONFIG,target:mode,element:'corrosive',secondaryElement:secondary,projectile:delivery,weaponType:delivery==='sticky'||delivery==='rocket'?'launcher':delivery==='scatter'?'shotgun':delivery==='beam'?'sniper':'rifle',brand:delivery==='sticky'?'tackwork':'ironvale',level:1,rarity:'common',guaranteedStatus:true},id);item.name=delivery==='sticky'?'CORROSIVE / PRESSURE CHARGE':'CORROSIVE / FIELD RIFLE';g.progression.inventory[g.progression.inventory.findIndex(i=>i.id===id)]=item;g.refreshEquipmentVisuals();const stats=getStats(g.progression,mode);g.bodies[mode].ammo=stats.magazine;g.bodies[mode].reserve=500;g.bodies[mode].heat=0;g.bodies[mode].overheated=false;}
function aimAt(target:THREE.Vector3){g.camera.lookAt(target);g.yaw=g.camera.rotation.y;g.pitch=g.camera.rotation.x;}
function fixture(kind:'human'|'armored'=selected,projectile:ProjectileType=delivery,count=2,move=false,mode:Mode='pilot',sizingLayout=false){
 bench=false;g.manualEvaluation=true;g.evaluationInput=undefined;game.resetEvaluation();selected=kind;delivery=projectile;moving=move;pairTargets=[];
 g.mode=mode;g.time=20;g.lastFiredAt=-Infinity;g.nextShot=20;g.reloadUntil=0;g.reloadStartedAt=0;g.emptyAt=-20;g.combatRandom=seededRandom(37391);g.ballistics.shotSequence=0;
 g.world.parkedMech.position.set(8,0,-5);g.world.parkedMech.rotation.y=-.6;
 for(let i=0;i<count;i++){
  const target=g.makeEnemy(sizingLayout?(i===0?-1.6:i===1?-3:1.3):i===0?-1.6:i===1?1.3:-4+(i-2)*1.35,sizingLayout?-2:-2-(i>1?3:0),false,'rusher');
  target.health=target.maxHealth=100000;target.shield=target.maxShield=0;
  const original=target.visual,look=createCorrosiveReviewTarget(target.mesh,target.id,sizingLayout?kind==='armored':i===0?kind==='armored':i%2===1);
  target.visual={...original,update(dt,time,state){original.update(dt,time,state);look.update(dt,time,state);},dispose(){look.dispose();original.dispose();}};
  g.enemies.push(target);g.scene.add(target.mesh);pairTargets.push(target);
 }
 g.trainingTargets=true;g.camera.position.set(-1.6,mode==='pilot'?1.75:4.1,sizingLayout?4.7:4.0);aimAt(new THREE.Vector3(-1.6,1.55,-2));weapon();g.screen='none';g.ui.setScreen('none',g.progression,g.mode);lastTime=g.time;
 shots.length=0;hits.length=0;measurements.length=0;layer!.clear();game.driveEvaluation({fire:false,yaw:g.yaw,pitch:g.pitch});game.stepEvaluation(1/240);
 document.querySelector<HTMLSelectElement>('#ab-target')!.value=kind;document.querySelector<HTMLSelectElement>('#ab-delivery')!.value=projectile;updateMark();
}
function updateMark(){const mark=document.querySelector('.corrosive-mark');if(mark)mark.innerHTML=`CORROSIVE / ${after?'A + B PROTOTYPE':'PREVIOUS PASS'}<span>${selected==='human'?'Clothed human':'Armored human'} · ${delivery} · actual Game / intact characters</span>`;}
const originalHit=g.onBallisticHit.bind(g);g.onBallisticHit=hit=>{hits.push({target:pairTargets.findIndex(t=>t.id===hit.targetId),at:g.time,point:hit.point.toArray(),direction:hit.direction.toArray(),damage:hit.damage,critical:hit.critical,spec:structuredClone(hit.spec)});originalHit(hit);};
const panel=document.createElement('aside');panel.className='corrosive-panel';panel.innerHTML=`<div class="eyebrow">CORROSIVE / LIVE MATERIAL STUDY</div><h1>Impact. Reaction.<br>Aftermath.</h1><p>Two human review targets. Same combat, new presentation. Characters stay intact.</p><button id="ab-version" aria-pressed="true">A+B prototype</button><label for="ab-target">Focus target</label><select id="ab-target"><option value="human">Clothed human</option><option value="armored">Armored human</option></select><label for="ab-delivery">Delivery</label><select id="ab-delivery"><option value="sticky">Sticky / large delayed rupture</option><option value="bullet">Rifle / compact wet bite</option><option value="slug">Slug / broad fan</option><option value="scatter">Scatter / multi-contact</option><option value="beam">Beam / sustained contact</option><option value="rocket">Rocket / rupture</option></select><button id="ab-sound">Enable sound</button><button id="ab-play">Play / capture mouse</button><button id="ab-single">Fire one shot</button><button id="ab-reset">Reset targets</button><output id="ab-cost">Warming renderer…</output><small>WASD move · LMB fire · R reload<br>Right-drag aim · P hide controls<br>Separate review save. No gore.</small>`;
const mark=document.createElement('div');mark.className='corrosive-mark';document.body.append(panel,mark);
document.querySelector('#ab-version')!.addEventListener('click',()=>{setVersion(!after);fixture();});
document.querySelector('#ab-target')!.addEventListener('change',event=>fixture((event.target as HTMLSelectElement).value as typeof selected));
document.querySelector('#ab-delivery')!.addEventListener('change',event=>fixture(selected,(event.target as HTMLSelectElement).value as ProjectileType));
document.querySelector('#ab-reset')!.addEventListener('click',()=>fixture());
const sizingButton=document.createElement('button');sizingButton.id='ab-sizing';sizingButton.textContent='Compare direct / near / edge';document.querySelector('#ab-reset')!.after(sizingButton);sizingButton.addEventListener('click',()=>fixture(selected,'sticky',3,false,'pilot',true));
document.querySelector('#ab-sound')!.addEventListener('click',async()=>{g.presentation.setSoundEnabled(true);await g.presentation.unlockAudio();document.querySelector('#ab-sound')!.textContent='Sound enabled';});
function play(){bench=false;g.evaluationInput=undefined;g.manualEvaluation=false;g.resume(false);}
document.querySelector('#ab-play')!.addEventListener('click',()=>{play();g.resume(true);});
document.querySelector('#ab-single')!.addEventListener('click',()=>{play();game.driveEvaluation({fire:true,yaw:g.yaw,pitch:g.pitch});game.stepEvaluation(1/60);g.evaluationInput=undefined;g.manualEvaluation=false;});
document.addEventListener('keydown',event=>{if(event.code==='KeyP')panel.hidden=!panel.hidden;});
const draw=g.comicRenderer.render.bind(g.comicRenderer);g.comicRenderer.render=()=>{
 if(bench){game.driveEvaluation({fire:benchFire,yaw:g.yaw,pitch:g.pitch});game.stepEvaluation(1/60);}
 if(moving){const target=pairTargets[0];if(target)target.mesh.position.x=-1.6+Math.sin((g.time-20)*2)*.45;}
 const start=perf.begin();draw();perf.end(start);lastTime=g.time;
 if(++tick%30===0){const c=perf.latest;document.querySelector('#ab-cost')!.textContent=`${c.frameMs.toFixed(2)} ms frame · ${c.submitMs.toFixed(2)} ms draw\n${c.calls} draws · ${Math.round(c.triangles/1000)}k triangles`;}
};
let recorder:MediaRecorder|undefined,mix:AudioContext|undefined,recordStream:MediaStream|undefined,chunks:BlobPart[]=[];
async function startRecording(){
 await g.presentation.unlockAudio();mix=new AudioContext();await mix.resume();const audio=mix.createMediaStreamDestination();
 for(const stream of g.presentation.recordingStreams())mix.createMediaStreamSource(stream).connect(audio);
 recordStream=g.renderer.domElement.captureStream(60);for(const track of audio.stream.getAudioTracks())recordStream.addTrack(track);
 const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')?'video/webm;codecs=vp9,opus':'video/webm;codecs=vp8,opus';
 chunks=[];recorder=new MediaRecorder(recordStream,{mimeType:mime,videoBitsPerSecond:9_000_000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.start(100);return{mime,audioTracks:recordStream.getAudioTracks().length,videoTracks:recordStream.getVideoTracks().length};
}
async function stopRecording():Promise<string>{const current=recorder!;await new Promise<void>(resolve=>{current.onstop=()=>resolve();current.stop();});const blob=new Blob(chunks,{type:current.mimeType});const result=await new Promise<string>(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',').at(-1)!);reader.readAsDataURL(blob);});recordStream?.getTracks().forEach(t=>t.stop());await mix?.close();recorder=undefined;return result;}
g.start(false);setVersion(true);fixture();
(window as unknown as {corrosiveReview:unknown}).corrosiveReview={game,g,perf,get layer(){return layer;},get after(){return after;},fixture,setVersion,shots,hits,measurements,
 sizingReview:()=>fixture('armored','sticky',3,false,'pilot',true),
 step:(dt:number,fire=false)=>{game.driveEvaluation({fire,yaw:g.yaw,pitch:g.pitch});game.stepEvaluation(dt);},
 aimSkin:()=>aimAt(new THREE.Vector3(-2.17,1.20,-1.90)),
 aimGround:()=>aimAt(new THREE.Vector3(-1.6,.01,-1.7)),
 setSecondary:(value:typeof secondary)=>{secondary=value;weapon();},
 setBench:(value:boolean,fire=true)=>{bench=value;benchFire=fire;g.manualEvaluation=true;},play,
 fireOne:()=>{game.driveEvaluation({fire:true,yaw:g.yaw,pitch:g.pitch});game.stepEvaluation(1/60);game.driveEvaluation({fire:false,yaw:g.yaw,pitch:g.pitch});},
 clean:(value=true)=>document.body.classList.toggle('corrosive-clean',value),startRecording,stopRecording,
 snapshot:()=>({time:g.time,mode:g.mode,body:{...g.bodies[g.mode]},shots:structuredClone(shots),hits:structuredClone(hits),targets:pairTargets.map(t=>({id:t.id,health:t.health,shield:t.shield,statuses:structuredClone(t.statuses)})),diagnostics:layer.diagnostics,presentation:g.presentation.diagnostics}),
};
window.addEventListener('pagehide',()=>perf.dispose());game.run();
