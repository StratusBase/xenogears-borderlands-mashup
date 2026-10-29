import '../style.css';
import * as THREE from 'three';
import {Game,type EvaluationInput} from '../game';
import {createEvaluationFixture} from '../diagnostics/fixtures';
import {applyStatus,activeStatusElements,type StatusState} from '../core/statusEffects';
import {createWeaponSpec,type ElementType} from '../core/arsenal';
import {isWalkable} from '../world';
import {QualityPerformance} from '../rendering/quality/performance';
import type {EnemyRole} from '../encounter/contracts';

type StressTarget={id:number;mesh:THREE.Group;health:number;maxHealth:number;heavy:boolean;statuses:StatusState};
/** Explicit capacity fixture only. Main entry and full-encounter validation use public interfaces. */
interface StressBridge{
 scene:THREE.Scene;camera:THREE.PerspectiveCamera;renderer:THREE.WebGLRenderer;comicRenderer:{render():void};
 world:{colliders:{minX:number;maxX:number;minZ:number;maxZ:number}[]};
 enemies:StressTarget[];mode:'pilot'|'mech';yaw:number;pitch:number;time:number;screen:string;
 makeEnemy(x:number,z:number,heavy:boolean,role:EnemyRole):StressTarget;
 start(capture?:boolean):void;resume(capture?:boolean):void;ballistics:{fire(origin:THREE.Vector3,direction:THREE.Vector3,spec:ReturnType<typeof createWeaponSpec>,damage:number):void};
}
const params=new URLSearchParams(location.search);
const count=params.get('crowd')==='12'?12:3;
const legacy=params.get('presentation')==='legacy';
const fixture=createEvaluationFixture('elemental-pressure');
const game=new Game(document.querySelector<HTMLElement>('#app')!,{
 initialProgression:fixture.state,saveKey:`dust-steel.integrated-stress.${count}.${legacy?'legacy':'quality'}`,
 encounterSeed:19,evaluationDriver:true,manualEvaluation:true,autoEncounters:false,
 ...(legacy?{presentation:'legacy' as const}:{}),
});
const g=game as unknown as StressBridge;
const fixturePositions:readonly[ number,number][]=[[-8,-5],[-4,-5],[0,-5],[4,-5],[8,-5],[-8,-11],[-4,-11],[4,-11],[8,-11],[-8,-17],[-4,-17],[0,-17],[4,-17],[8,-17]];
for(const[x,z]of fixturePositions){if(g.enemies.length>=count)break;const role=(['rusher','flanker','heavy']as const)[g.enemies.length%3];if(!isWalkable(x,z,role==='heavy'?1.4:.6,g.world.colliders))continue;
 const target=g.makeEnemy(x,z,role==='heavy',role);target.health=target.maxHealth=100000;g.enemies.push(target);g.scene.add(target.mesh);
 for(const element of['fire','ice','corrosive','shock','radiation','gravity','adhesive']as const)applyStatus(target.statuses,element,0,1);
}
if(g.enemies.length!==count)throw new Error('Insufficient clear capacity fixture positions.');
g.mode='mech';g.camera.position.set(0,4.4,11);g.camera.lookAt(0,2,-7);g.yaw=g.camera.rotation.y;g.pitch=g.camera.rotation.x;
g.start(false);
const perf=new QualityPerformance(g.renderer);const render=g.comicRenderer.render.bind(g.comicRenderer);
let running=false,frames=0,finished=false;
const applied:Array<{at:number;element:ElementType}> = [];
function frame(){
 const snapshot=game.getEncounterSnapshot();
 const input:EvaluationInput={fire:true,yaw:g.yaw,pitch:g.pitch,heal:snapshot.body.health<250};game.driveEvaluation(input);game.stepEvaluation(1/60);frames++;
 // Identical synthetic sticky volleys use actual ballistics/collision/detonation;
 // they represent capacity beyond the ordinary three-target squad and consume no player ammo.
 if(frames===1||frames===61||frames===121){
  // Re-proc through the real status API so all seven remain stacked during the
  // capacity sample, including shock's unchanged two-second duration.
  if(frames>1)for(const target of g.enemies)for(const element of['fire','ice','corrosive','shock','radiation','gravity','adhesive']as const)applyStatus(target.statuses,element,g.time,1);
  const elements:ElementType[]=['fire','ice','corrosive','gravity','adhesive','shock'];
  for(const[index,element]of elements.entries()){
   const spec=createWeaponSpec('sticky',element,'mech'),target=g.enemies[index%g.enemies.length];
   const origin=new THREE.Vector3((index-2.5)*.24,3.8,8),end=target.mesh.position.clone().add(new THREE.Vector3(0,target.heavy?2.5:1.5,0));
   g.ballistics.fire(origin,end.sub(origin).normalize(),spec,1);applied.push({at:g.time,element});
  }
 }
}
g.comicRenderer.render=()=>{if(running)frame();const start=perf.begin();render();perf.end(start);};
const banner=document.createElement('div');banner.style.cssText='position:fixed;left:24px;top:145px;z-index:20;padding:8px 12px;background:#152329e8;color:#f0d695;border-left:3px solid #e1b359;font:11px system-ui;pointer-events:none';banner.textContent=`CAPACITY FIXTURE · ${count} live targets · 7 stacked elements · sticky volleys · ${legacy?'LEGACY':'ENHANCED'}`;document.body.append(banner);
async function measure(){if(running||finished)throw new Error('Use a fresh page for each timing run.');running=true;const sample=await perf.measure(`${count} targets / ${legacy?'legacy':'quality'}`,120,30);running=false;finished=true;
 return{sample,frames,simulationSeconds:g.time,mode:game.presentationMode,diagnostics:game.presentationDiagnostics,snapshot:game.getEncounterSnapshot(),syntheticVolleys:applied,
  targets:g.enemies.map(target=>({id:target.id,position:target.mesh.position.toArray(),health:target.health,statuses:activeStatusElements(target.statuses,g.time)})),
  provenance:'synthetic-capacity-fixture',notes:'High-health targets prevent disposal churn. Actual enemy AI, normal player firing/heat/reload/heal, all seven statuses re-procced through the real status API at 1 and 2 seconds, and 18 additional actual-ballistic sticky shots. Additional volley shots do not consume player ammo. Not a normal encounter result or midrange hardware test.'};
}
const begin=document.createElement('button');begin.textContent='Enable sound for stress run';begin.id='stress-enable';begin.style.cssText='position:fixed;right:24px;top:145px;z-index:30;padding:10px;background:#ead4a4;color:#18272b;font:12px system-ui';begin.onclick=()=>{g.resume(false);begin.hidden=true;};document.body.append(begin);
Object.assign(window,{integratedStress:{game,measure,perf}});
window.addEventListener('pagehide',()=>perf.dispose(),{once:true});game.run();
