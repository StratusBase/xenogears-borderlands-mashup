import '../style.css';
import './fireLab.css';
import * as THREE from 'three';
import {Game,type EvaluationShot} from '../game';
import {createProgression,getStats,seededRandom,type Progression,type Mode} from '../core/index';
import {createWorkbenchWeapon,DEFAULT_WORKBENCH_CONFIG} from '../core/workbench';
import type {ElementType,ProjectileType} from '../core/arsenal';
import type {StatusState} from '../core/statusEffects';
import {ElementalPresentation} from '../rendering/quality/elementalPresentation';
import {FirePresentation} from '../rendering/quality/fire/presentation';
import {createCorrosiveReviewTarget} from '../rendering/quality/corrosive/reviewTargets';
import {QualityPerformance,distribution} from '../rendering/quality/performance';
import type {GamePresentation} from '../rendering/quality/GamePresentation';
import type {EncounterEnemyVisual} from '../rendering/encounterEnemy';
import type {BallisticHit,BallisticPresentationImpact} from '../rendering/PlayerBallistics';

interface Target{id:number;mesh:THREE.Group;health:number;maxHealth:number;shield:number;maxShield:number;visual:EncounterEnemyVisual;statuses:StatusState}
interface Bridge{
 scene:THREE.Scene;camera:THREE.PerspectiveCamera;renderer:THREE.WebGLRenderer;comicRenderer:{render():void;resize(w:number,h:number,dpr:number):void};presentation:GamePresentation;
 progression:Progression;time:number;mode:Mode;screen:string;manualEvaluation:boolean;evaluationInput:unknown;trainingTargets:boolean;
 yaw:number;pitch:number;lastFiredAt:number;nextShot:number;reloadUntil:number;reloadStartedAt:number;reloadFoleyStage:number;emptyAt:number;respawnUntil:number;combatRandom:()=>number;
 enemies:Target[];bodies:Record<Mode,{ammo:number;reserve:number;heat:number;overheated:boolean}>;world:{occluders:THREE.Object3D[];parkedMech:THREE.Group};ballistics:{shotSequence:number;activeCount:number};
 makeEnemy(x:number,z:number,heavy:boolean,role:'rusher'):Target;freshBodies():Bridge['bodies'];refreshEquipmentVisuals():void;onBallisticHit(hit:BallisticHit):void;start(capture?:boolean):void;resume(capture?:boolean):void;ui:{setScreen(screen:string,p:Progression,mode:Mode):void};
}
const hybridProof=document.documentElement.dataset.fireProof==='hybrid';
type Focus='human'|'armored';type Scenario='six-rifle'|'six-sticky'|'six-rocket';
const progression=createProgression();
for(const mode of ['pilot','mech'] as const){const item=createWorkbenchWeapon({...DEFAULT_WORKBENCH_CONFIG,target:mode,element:'fire',guaranteedStatus:true},`fire-review-${mode}`);progression.inventory.push(item);progression.loadouts[mode].weapon=item.id;}
const shots:EvaluationShot[]=[],hits:unknown[]=[],contacts:unknown[]=[],errors:string[]=[],visuals:unknown[]=[],performanceResults:unknown[]=[];
const game=new Game(document.querySelector<HTMLElement>('#app')!,{initialProgression:progression,saveKey:hybridProof?'dust-steel.fire-hybrid-ac.review.v1':'dust-steel.fire-abc.review.v1',evaluationDriver:true,manualEvaluation:true,soundEnabled:true,autoEncounters:false,trainingTargets:false,presentation:'legacy',onEvaluationShot:shot=>{if(shots.length<4000)shots.push(structuredClone(shot));}});
const g=game as unknown as Bridge;
function fixedResolution(){if(g.renderer.domElement.width===1440&&g.renderer.domElement.height===900&&g.renderer.getPixelRatio()===1)return;g.renderer.setPixelRatio(1);g.renderer.setSize(1440,900,false);g.comicRenderer.resize(1440,900,1);g.camera.aspect=1440/900;g.camera.updateProjectionMatrix();}
fixedResolution();Object.assign(g.renderer.domElement.style,{width:'100%',height:'100%',objectFit:'contain'});
const perf=new QualityPerformance(g.renderer);let layer:ElementalPresentation|FirePresentation,targets:Target[]=[],current=true,focus:Focus='human',delivery:ProjectileType='bullet',secondary:ElementType|'none'='none',bodyMode:Mode='pilot';
let live:'shot'|'crowd'|'free'|undefined,frozen=true,busy=false,preparing=false,bench=false,frame=0,scenario:Scenario='six-rifle',probe:THREE.Mesh|undefined;
let pending:{frame:number;phase:'launch'|'wait'|'release';explosive:boolean;wanted:string;freezeFrames:number}|undefined;
const simulationCosts:number[]=[],peaks={sheets:0,embers:0,tongues:0,smoke:0,statuses:0,art:0,physicalVoices:0,elementalVoices:0};
const ui=document.createElement('aside');ui.className='fire-panel';ui.innerHTML=`<strong>${hybridProof?'FIRE / HYBRID A + C PROOF':'FIRE / TURBULENT A + B + C'}</strong><p>Actual Game · clothed / armored humans · no gore</p>
<button id="fire-version" aria-pressed="true">Current / A+B+C</button><label for="fire-focus">Focus target</label><select id="fire-focus"><option value="human">Clothed human</option><option value="armored">Armored human</option></select>
<label for="fire-delivery">Delivery</label><select id="fire-delivery"><option value="bullet">Rifle / Flashover</option><option value="sticky">Sticky / Backdraft</option><option value="rocket">Rocket / Backdraft</option><option value="scatter">Scatter</option><option value="slug">Slug</option><option value="beam">Beam</option></select>
<label for="fire-delay">Freeze after contact / detonation</label><select id="fire-delay"><option value="3">50 ms / ignition</option><option selected value="6">100 ms / release</option><option value="15">250 ms / curl</option></select><button id="fire-shot">Fire one real shot / freeze peak</button><button id="fire-step">Advance flame 50 ms</button><button id="fire-aftermath">Show Cinderbrand aftermath</button><button id="fire-live">Replay shot with sound</button><button id="fire-free">Play freely / capture mouse</button>
<label for="fire-surface">Surface</label><select id="fire-surface"><option value="target">Target</option><option value="floor">Floor</option><option value="wall">Wall</option><option value="slope">Slope</option><option value="ceiling">Underside</option></select>
<label for="fire-scenario">Performance scene</label><select id="fire-scenario"><option value="six-rifle">Six humans / rifle</option><option value="six-sticky">Six humans / sticky</option><option value="six-rocket">Six humans / rocket</option></select>
<button id="fire-perf">Run matched comparison with sound</button><button id="fire-crowd">Play sustained fire with sound</button><button id="fire-freeze">Freeze current scene</button>
<button id="fire-record">Record live shot with sound</button><a id="fire-download" hidden download="fire-gameplay.webm">Download gameplay recording</a>
<output id="fire-state">Ready · isolated review save</output><details><summary>Raw review results</summary><pre id="fire-results">{}</pre></details>`;document.body.append(ui);
const caption=document.createElement('div');caption.className='fire-caption';document.body.append(caption);
function state(text:string){document.querySelector('#fire-state')!.textContent=text;}
function publish(){document.querySelector('#fire-results')!.textContent=JSON.stringify({visuals,performance:performanceResults,errors},null,2);}
function aim(point:THREE.Vector3){g.camera.lookAt(point);g.yaw=g.camera.rotation.y;g.pitch=g.camera.rotation.x;}
function removeProbe(){if(!probe)return;g.world.occluders.splice(g.world.occluders.indexOf(probe),1);probe.removeFromParent();probe.geometry.dispose();(probe.material as THREE.Material).dispose();probe=undefined;}
function response(after:boolean){
 game.setPresentationMode('legacy');current=after;
 g.presentation.setElementalFactory((scene,camera)=>{layer=hybridProof?new FirePresentation(scene,camera,{hybrid:after}):after?new FirePresentation(scene,camera):new ElementalPresentation(scene,camera,{corrosiveAB:true});const impact=layer.impact.bind(layer);layer.impact=event=>{if(recording)recordingEvents.push({phase:event.phase,videoSeconds:(performance.now()-recordStart)/1000,gameTime:g.time});if(contacts.length<4000)contacts.push({phase:event.phase,point:event.point.toArray(),normal:event.normal.toArray(),surface:event.hitSurface?.name,target:targets.findIndex(t=>t.mesh===event.target),at:g.time});impact(event);};return layer;});
 game.setPresentationMode('quality');g.presentation.setSoundEnabled(true);const button=document.querySelector('#fire-version')!;button.textContent=hybridProof?(current?'Current / hybrid A+C':'Before / puffy volume'):(current?'Current / A+B+C':'Before / prior Fire');button.setAttribute('aria-pressed',String(current));
}
function fixture(after=current,kind=focus,projectile=delivery,count=2,mode:Mode=bodyMode){
 live=undefined;bench=false;frozen=true;pending=undefined;g.manualEvaluation=true;game.resetEvaluation();removeProbe();response(after);targets=[];focus=kind;delivery=projectile;bodyMode=mode;
 g.mode=mode;g.trainingTargets=true;g.bodies=g.freshBodies();g.respawnUntil=0;g.time=20;g.lastFiredAt=-Infinity;g.nextShot=20;g.reloadUntil=0;g.reloadStartedAt=0;g.reloadFoleyStage=0;g.emptyAt=-20;g.combatRandom=seededRandom(37391);g.ballistics.shotSequence=0;g.world.parkedMech.position.set(8,0,-5);
 for(let i=0;i<count;i++){
  const x=count<=2?(i===0?-1.6:1.3):-4+(i%3)*2.1,z=count<=2?-2:-2-Math.floor(i/3)*2.2;
  const target=g.makeEnemy(x,z,false,'rusher');target.health=target.maxHealth=100000;target.shield=target.maxShield=0;
  const original=target.visual,look=createCorrosiveReviewTarget(target.mesh,target.id,i===0?kind==='armored':i%2===1);
  target.visual={...original,update(dt,time,s){original.update(dt,time,s);look.update(dt,time,s);},dispose(){look.dispose();original.dispose();}};g.enemies.push(target);g.scene.add(target.mesh);targets.push(target);
 }
 const id=g.progression.loadouts[mode].weapon!,item=createWorkbenchWeapon({...DEFAULT_WORKBENCH_CONFIG,target:mode,element:'fire',secondaryElement:secondary,projectile,weaponType:projectile==='sticky'||projectile==='rocket'?'launcher':projectile==='scatter'?'shotgun':'rifle',brand:projectile==='sticky'?'tackwork':'ironvale',level:1,rarity:'common',guaranteedStatus:true},id);
 g.progression.inventory[g.progression.inventory.findIndex(i=>i.id===id)]=item;g.refreshEquipmentVisuals();const stats=getStats(g.progression,mode);g.bodies[mode].ammo=stats.magazine;g.bodies[mode].reserve=500;g.bodies[mode].heat=0;g.bodies[mode].overheated=false;
 g.camera.position.set(count<=2?-1.6:-1.8,mode==='mech'?4.4:1.8,count<=2?4.4:5.4);aim(new THREE.Vector3(count<=2?-1.6:-1.9,1.55,-2));g.screen='none';g.ui.setScreen('none',g.progression,mode);shots.length=0;hits.length=0;contacts.length=0;layer.clear();
 game.driveEvaluation({fire:false,yaw:g.yaw,pitch:g.pitch});game.stepEvaluation(1/240);g.scene.updateMatrixWorld(true);document.querySelector<HTMLSelectElement>('#fire-focus')!.value=kind;document.querySelector<HTMLSelectElement>('#fire-delivery')!.value=projectile;
 caption.innerHTML=`FIRE / ${hybridProof?(after?'HYBRID A + C PROOF':'BEFORE / PUFFY VOLUME'):(after?'TURBULENT A + B · C EXPLOSIVE':'PRIOR RESPONSE')}<span>${kind==='human'?'Clothed':'Armored'} human · ${projectile} · actual Game / intact characters</span>`;
}
const originalHit=g.onBallisticHit.bind(g);g.onBallisticHit=hit=>{if(hits.length<4000)hits.push({target:targets.findIndex(t=>t.id===hit.targetId),at:g.time,point:hit.point.toArray(),direction:hit.direction.toArray(),damage:hit.damage,critical:hit.critical,spec:structuredClone(hit.spec)});originalHit(hit);};
function selectSurface(){
 const surface=document.querySelector<HTMLSelectElement>('#fire-surface')!.value;if(surface==='target')return surface;
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(3.2,.30,2.7),new THREE.MeshToonMaterial({color:0x8b8171}));mesh.castShadow=mesh.receiveShadow=true;mesh.name=`fire-review-${surface}`;
 if(surface==='floor'){mesh.position.set(-1.6,-.15,-1.5);aim(new THREE.Vector3(-1.6,0,-1.5));}
 else if(surface==='ceiling'){mesh.position.set(-1.6,3.5,-1.5);aim(new THREE.Vector3(-1.6,3.35,-1.5));}
 else{mesh.position.set(-1.6,1.5,-.8);mesh.rotation.x=surface==='wall'?Math.PI/2:.82;aim(mesh.position.clone());}
 g.scene.add(mesh);g.world.occluders.push(mesh);probe=mesh;game.driveEvaluation({fire:false,yaw:g.yaw,pitch:g.pitch});game.stepEvaluation(1/240);return surface;
}
function snapshot(){return{time:g.time,mode:g.mode,body:{...g.bodies[g.mode]},shots:structuredClone(shots),hits:structuredClone(hits),targets:targets.map(t=>({health:t.health,shield:t.shield,statuses:structuredClone(t.statuses)})),contacts:structuredClone(contacts),events:layer instanceof FirePresentation?structuredClone(layer.fire.events):[],diagnostics:layer.diagnostics,presentation:g.presentation.diagnostics};}
function step(fire=false,dt=1/60){game.driveEvaluation({fire,yaw:g.yaw,pitch:g.pitch});game.stepEvaluation(dt);}
async function unlock(){g.presentation.setSoundEnabled(true);await g.presentation.unlockAudio();const d=g.presentation.diagnostics;if(!d.qualityAudioUnlocked||!d.elementalAudioUnlocked)throw new Error('Both audio buses must be unlocked');}
async function prepare(){preparing=true;state('Preparing selected Fire shaders and atlas…');try{if(layer instanceof FirePresentation)await layer.fire.prepare(g.renderer,g.scene);}finally{preparing=false;}}
async function single(){fixture();const surface=selectSurface();await unlock();await prepare();pending={frame:0,phase:'launch',explosive:['sticky','rocket'].includes(delivery),wanted:surface,freezeFrames:Number(document.querySelector<HTMLSelectElement>('#fire-delay')!.value)};frozen=false;state('Firing actual projectile…');}
function advanceSingle(){
 if(!pending)return;const p=pending;if(p.phase==='launch'){step(true);p.phase='wait';return;}step(false);p.frame++;
 const log=contacts as {phase:string;surface?:string}[];if(p.phase==='wait'&&log.some(e=>e.phase===(p.explosive?'detonate':'contact'))){p.phase='release';p.frame=0;}
 if(p.phase==='release'&&p.frame>=p.freezeFrames){const result={focus,delivery,current,surface:p.wanted,stage:'release',snapshot:snapshot()};visuals.push(result);pending=undefined;frozen=true;publish();state(`${current?(hybridProof?'Hybrid A+C':'A+B+C'):'Before'} / ${focus} / ${delivery}: +${Math.round(p.freezeFrames/60*1000)} ms after actual ${p.explosive?'detonation':'contact'} · frozen for review`);}
 if(p.frame>300)throw new Error('Requested contact/detonation did not occur');
}
function aftermath(){for(let i=0;i<60;i++)step(false);visuals.push({focus,delivery,current,stage:'aftermath',snapshot:snapshot()});publish();state('Cinderbrand aftermath · actual authoritative Fire status');}
async function playShot(activate=true){fixture();selectSurface();await unlock();await prepare();if(activate){live='shot';frame=0;frozen=false;}state('Native timing · actual shot / fuse / live sound');}
async function free(){fixture();await unlock();await prepare();live='free';g.evaluationInput=undefined;g.manualEvaluation=false;frozen=false;g.resume(true);state('Play freely: WASD · mouse / arrows · LMB fire · R reload · Escape pause');}
function aimCrowd(n:number){const slot=Math.floor(n/90)%targets.length;aim(targets[slot].mesh.position.clone().add(new THREE.Vector3(0,1.55,0)));}
function setupCrowd(after:boolean){const projectile=scenario==='six-rifle'?'bullet':scenario==='six-sticky'?'sticky':'rocket';fixture(after,'human',projectile,6,'pilot');caption.innerHTML=`FIRE / ${scenario.toUpperCase()} / ${after?'A+B+C':'BEFORE'}<span>Six intact clothed / armored humans · same seed · live sound</span>`;}
function normalized(s:ReturnType<typeof snapshot>){return{time:s.time,mode:s.mode,body:s.body,shots:s.shots,hits:s.hits,targets:s.targets,contacts:s.contacts};}
async function compare(){
 if(busy)return;busy=true;performanceResults.length=0;scenario=document.querySelector<HTMLSelectElement>('#fire-scenario')!.value as Scenario;const runs:unknown[]=[];
 try{for(const [label,after] of [['before',false],['current',true],['before-repeat',false]] as const){
  setupCrowd(after);await unlock();frame=0;simulationCosts.length=0;for(const k of Object.keys(peaks) as (keyof typeof peaks)[])peaks[k]=0;
  state(`${scenario} / ${label}: 120 warmup + 720 measured displayed frames · sound on · capture off`);const promise=perf.measure(label,720,120);bench=true;frozen=false;const start=performance.now(),cost=await promise;bench=false;frozen=true;
  runs.push({label,wallMs:performance.now()-start,cost,simulationMs:distribution(simulationCosts.slice(120)),peaks:{...peaks},snapshot:snapshot()});
 }const typed=runs as {snapshot:ReturnType<typeof snapshot>}[],equal=typed.every(r=>JSON.stringify(normalized(r.snapshot))===JSON.stringify(normalized(typed[0].snapshot))),targetsHit=new Set((typed[1].snapshot.hits as {target:number}[]).map(h=>h.target).filter(t=>t>=0)).size;
 const result={scenario,runs,combatEqual:equal,targetsHit,protocol:{warmup:120,frames:720,simulationStep:1/60,sound:true,recording:false,visibility:document.visibilityState}};performanceResults.push(result);publish();state(`${equal&&targetsHit>=3?'PASS':'FAIL'} / ${scenario}: combat ${equal?'identical':'DIFFERENT'} · ${targetsHit} targets hit`);
 }finally{busy=false;bench=false;frozen=true;}
}
async function crowd(){scenario=document.querySelector<HTMLSelectElement>('#fire-scenario')!.value as Scenario;setupCrowd(true);await unlock();live='crowd';frame=0;frozen=false;state('Sustained fire · native timing · live sound');}
let recording=false,recordStart=0;const recordingEvents:{phase:string;videoSeconds:number;gameTime:number}[]=[];
async function record(){
 if(recording||busy)return;await playShot(false);recording=true;await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));const mix=new AudioContext();await mix.resume();const audio=mix.createMediaStreamDestination();for(const stream of g.presentation.recordingStreams())mix.createMediaStreamSource(stream).connect(audio);
 const stream=g.renderer.domElement.captureStream(30);for(const track of audio.stream.getAudioTracks())stream.addTrack(track);
 const type=MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')?'video/webm;codecs=vp8,opus':'video/webm;codecs=vp9,opus',chunks:BlobPart[]=[];const recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:6_000_000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 const link=document.querySelector<HTMLAnchorElement>('#fire-download')!;link.hidden=true;const button=document.querySelector<HTMLButtonElement>('#fire-record')!;button.disabled=true;recordingEvents.length=0;recordStart=performance.now();recorder.start(100);state('Preparing video encoder · gameplay held for 1 second…');await new Promise(resolve=>setTimeout(resolve,1000));live='shot';frame=0;frozen=false;state('Recording actual gameplay and both final sound buses…');
 await new Promise(resolve=>setTimeout(resolve,6500));await new Promise<void>(resolve=>{recorder.onstop=()=>resolve();recorder.stop();});
 const blob=new Blob(chunks,{type:recorder.mimeType});const reader=new FileReader();const data=await new Promise<string>((resolve,reject)=>{reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});link.href=data;link.download=`fire-${focus}-${delivery}.webm`;link.hidden=false;
 // Also expose a normal downloadable data link for tools that cannot save blob URLs.
 link.dataset.bytes=String(blob.size);stream.getTracks().forEach(t=>t.stop());await mix.close();button.disabled=false;recording=false;visuals.push({focus,delivery,current,stage:'live-recording',events:structuredClone(recordingEvents),snapshot:snapshot()});publish();state('Live-sound recording ready · no replacement or normalization');
}
function action(fn:()=>void|Promise<void>){return()=>{if(busy||recording||preparing)return;void Promise.resolve().then(fn).catch(error=>{errors.push(String(error));state(`ERROR: ${error}`);publish();});};}
document.querySelector('#fire-version')!.addEventListener('click',action(()=>fixture(!current)));
document.querySelector('#fire-focus')!.addEventListener('change',action(()=>fixture(current,document.querySelector<HTMLSelectElement>('#fire-focus')!.value as Focus)));
document.querySelector('#fire-delivery')!.addEventListener('change',action(()=>fixture(current,focus,document.querySelector<HTMLSelectElement>('#fire-delivery')!.value as ProjectileType)));
document.querySelector('#fire-step')!.addEventListener('click',action(()=>{if(!frozen||pending)return;for(let i=0;i<3;i++)step(false);visuals.push({focus,delivery,current,stage:'motion-step',snapshot:snapshot()});publish();state('Flame advanced 50 ms · actual Game simulation · frozen for review');}));
document.querySelector('#fire-freeze')!.addEventListener('click',action(()=>{g.manualEvaluation=true;frozen=true;live=undefined;pending=undefined;game.driveEvaluation({fire:false,yaw:g.yaw,pitch:g.pitch});visuals.push({focus,delivery,current,stage:'frozen-live-scene',snapshot:snapshot()});publish();state('Current scene frozen · actual Game state retained');}));
document.querySelector('#fire-shot')!.addEventListener('click',action(single));document.querySelector('#fire-aftermath')!.addEventListener('click',action(aftermath));document.querySelector('#fire-live')!.addEventListener('click',action(playShot));document.querySelector('#fire-free')!.addEventListener('click',action(free));document.querySelector('#fire-perf')!.addEventListener('click',action(compare));document.querySelector('#fire-crowd')!.addEventListener('click',action(crowd));document.querySelector('#fire-record')!.addEventListener('click',action(record));
window.addEventListener('error',e=>{errors.push(e.message);publish();});window.addEventListener('unhandledrejection',e=>{errors.push(String(e.reason));publish();});
const draw=g.comicRenderer.render.bind(g.comicRenderer);let previous=performance.now(),liveSeconds=0;
g.comicRenderer.render=()=>{
 fixedResolution();
 const now=performance.now(),dt=Math.min(.045,(now-previous)/1000);previous=now;const startUpdate=performance.now();
 if(bench){aimCrowd(frame++);step(true);simulationCosts.push(performance.now()-startUpdate);const d=g.presentation.diagnostics;peaks.physicalVoices=Math.max(peaks.physicalVoices,d.physicalVoices);peaks.elementalVoices=Math.max(peaks.elementalVoices,d.elementalVoices);if(layer instanceof FirePresentation){const f=layer.fire.diagnostics;peaks.art=Math.max(peaks.art,layer.fire.hybrid?.activeCount??0);for(const k of ['sheets','embers','tongues','smoke','statuses'] as const)peaks[k]=Math.max(peaks[k],f[k]);}}
 else if(pending)advanceSingle();else if(live&&!frozen&&live!=='free'){if(frame===0)liveSeconds=0;liveSeconds+=dt;if(live==='crowd')aimCrowd(Math.floor(liveSeconds*60));step(live==='crowd'||frame===0,Math.max(1/240,dt));frame++;}
 const start=perf.begin();draw();perf.end(start);
};
g.start(false);fixture();publish();
const gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');const meta=document.createElement('script');meta.type='application/json';meta.id='fire-metadata';meta.textContent=JSON.stringify({renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),userAgent:navigator.userAgent,viewport:[1440,900],browserViewportAtStartup:[innerWidth,innerHeight],dpr:1,before:hybridProof?'Previous puffy Fire volume':'Prior Fire ElementalPresentation',current:hybridProof?'Hybrid authored A+C primary impact proof':'FirePresentation A+B+C',entry:'Compiled actual Game evaluation driver, separate save, intact raised-health human fixtures',resolution:'Canvas and camera locked to 1440x900 DPR1 across browser window resizing; page may letterbox.'});document.body.append(meta);
window.addEventListener('pagehide',()=>perf.dispose());game.run();
