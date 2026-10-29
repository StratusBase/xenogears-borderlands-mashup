/** Full-loop integration evidence. Ordinary Game, current fixtures/policy, public controls only. */
import '../style.css';
import { Game, type GameOptions, type EvaluationShot } from '../game';
import { getStats } from '../core/index';
import { ENCOUNTER } from '../encounter/encounter';
import type { CombatMeasurementEvent, EncounterEvent } from '../encounter/contracts';
import { createEvaluationFixture, EVALUATION_BUILDS, type EvaluationBuildId } from '../diagnostics/fixtures';
import { createEncounterPolicy } from '../diagnostics/encounterDriver';

const params=new URLSearchParams(location.search);
const build:EvaluationBuildId=EVALUATION_BUILDS.find(entry=>entry.id===params.get('build'))?.id??'mobile-precision';
const parsedSeed=Number(params.get('seed')??7),seed=Number.isInteger(parsedSeed)&&parsedSeed>=0&&parsedSeed<=0xffffffff?parsedSeed:7;
const fixture=createEvaluationFixture(build);
const forcedLegacy=params.get('presentation')==='legacy';
const measurements:CombatMeasurementEvent[]=[],encounterEvents:EncounterEvent[]=[];
const trajectories:EvaluationShot[]=[];
const runs:{number:number;origin:number;start:ReturnType<Game['getEncounterSnapshot']>;end?:ReturnType<Game['getEncounterSnapshot']>;outcome?:string;measurementStart:number;encounterStart:number}[]=[];
let policy=createEncounterPolicy(),active=false,lastPhase='idle',lastMode='pilot',milestones:string[]=[],seenShots=new Set<string>();
let outcome:string|null=null;
const options:GameOptions={initialProgression:fixture.state,saveKey:`dust-steel.integrated-encounter.${build}.${forcedLegacy?'legacy':'default'}.v1`,autoEncounters:false,encounterSeed:seed,evaluationDriver:true,manualEvaluation:true,
 onMeasurement(event){measurements.push(structuredClone(event));if(event.type==='finish'){outcome=event.outcome;active=false;const run=runs.at(-1);if(run){run.outcome=event.outcome;run.end=game.getEncounterSnapshot();}}if(event.type==='shot'){if(!seenShots.has(event.mode)){seenShots.add(event.mode);milestones.push(`first-${event.mode}-shot`);}if(game.getEncounterSnapshot().phase==='boss'&&!seenShots.has('boss')){seenShots.add('boss');milestones.push('first-boss-shot');}}},
 onEncounterEvent(event){encounterEvents.push(structuredClone(event));},
 onEvaluationShot(shot){trajectories.push(structuredClone(shot));},
};
if(forcedLegacy)Object.assign(options,{presentation:'legacy'});
const game=new Game(document.querySelector<HTMLElement>('#app')!,options);
const publicGame=game as Game&{readonly presentationMode?:'quality'|'legacy';readonly presentationDiagnostics?:unknown};
game.run();
const panel=document.createElement('aside');panel.setAttribute('aria-label','Integrated encounter verification');panel.style.cssText='position:fixed;z-index:120;left:14px;top:14px;max-width:360px;background:#12252bef;color:#e9e2c8;padding:14px;border:1px solid #6caaa2;font:12px/1.45 system-ui;';
const heading=document.createElement('strong');heading.textContent='INTEGRATED COMBAT LOOP';
const summary=document.createElement('p');summary.textContent=`${build} · seed ${seed} · ${ENCOUNTER.version} · ${forcedLegacy?'explicit legacy':'normal default presentation'}`;
const begin=document.createElement('button');begin.textContent='Begin full encounter';begin.style.cssText='display:block;background:#eadfbd;color:#203b36;padding:9px 12px;border:0;font:700 12px system-ui;';
const status=document.createElement('output');status.style.cssText='display:block;margin-top:10px;white-space:pre-wrap';
panel.append(heading,summary,begin,status);document.body.append(panel);
function presentation(){return{mode:publicGame.presentationMode??'unavailable',diagnostics:publicGame.presentationDiagnostics??null};}
function updateStatus(){const snapshot=game.getEncounterSnapshot();status.textContent=`${snapshot.phase.toUpperCase()} · ${snapshot.elapsed.toFixed(1)} s · ${snapshot.mode}\n${snapshot.enemies.length} hostiles · ${snapshot.kills} defeated\n${policy.reason}\n${outcome??'In progress'} · ${presentation().mode}`;}
function markChanges(){const s=game.getEncounterSnapshot();if(s.phase!==lastPhase){milestones.push(`phase-${s.phase}`);lastPhase=s.phase;}if(s.mode!==lastMode){milestones.push(`form-${s.mode}`);lastMode=s.mode;}if(s.phase==='boss'&&s.enemies.some(enemy=>enemy.boss)&&!seenShots.has('boss-visible')){seenShots.add('boss-visible');milestones.push('boss-visible');}}
function start(){
 if(active)throw new Error('The current integrated encounter is still active.');
 policy=createEncounterPolicy();outcome=null;seenShots=new Set();milestones=[];lastPhase='idle';lastMode='pilot';
 const previous=game.getEncounterSnapshot();runs.push({number:runs.length+1,origin:previous.time,start:previous,measurementStart:measurements.length,encounterStart:encounterEvents.length});
 active=true;game.startEncounter(seed);game.driveEvaluation(policy.input(game.getEncounterSnapshot(),1/60));game.stepEvaluation(1/60);markChanges();updateStatus();
 return read();
}
function stepChunk(count=60){
 if(!Number.isInteger(count)||count<1||count>600)throw new RangeError('Chunk size must be 1–600 simulation steps.');
 milestones=[];
 for(let frame=0;frame<count&&active;frame++){
  const before=game.getEncounterSnapshot();
  if(before.elapsed>=480){active=false;outcome='timeout';const run=runs.at(-1)!;run.outcome=outcome;run.end=before;break;}
  game.driveEvaluation(policy.input(before,1/60));game.stepEvaluation(1/60);markChanges();
  if(milestones.length)break;
 }
 game.driveEvaluation({});updateStatus();return read();
}
function read(){const snapshot=game.getEncounterSnapshot();return{active,outcome,milestones:[...milestones],reason:policy.reason,snapshot,presentation:presentation()};}
function exportEvidence(){return{protocol:'integrated-encounter-loop-v1',inputProvenance:'scripted-route-v1 through public Game.driveEvaluation/stepEvaluation; no teleport, damage/stat edits, enemy edits, or forced stage transitions',hardwareStatus:'NOT RUN',encounterVersion:ENCOUNTER.version,encounterConfiguration:ENCOUNTER,build,seed,fixture:{codes:fixture.codes,equipment:fixture.equipment,stats:fixture.stats},requestedPresentation:forcedLegacy?'legacy':'default',presentation:presentation(),runs:structuredClone(runs),measurements:structuredClone(measurements),encounterEvents:structuredClone(encounterEvents),trajectories:structuredClone(trajectories),current:game.getEncounterSnapshot(),currentStats:{pilot:getStats(game.getEncounterSnapshot().progression,'pilot'),mech:getStats(game.getEncounterSnapshot().progression,'mech')},reason:policy.reason};}
begin.addEventListener('click',()=>{start();begin.textContent='Start next encounter';});
Object.assign(window,{integratedEncounter:{game,start,stepChunk,read,exportEvidence,fixture:{codes:fixture.codes,equipment:fixture.equipment},hidePanel:()=>{panel.hidden=true;},showPanel:()=>{panel.hidden=false;}}});
updateStatus();
