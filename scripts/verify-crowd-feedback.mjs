/** Fresh, paced actual-Game capacity arms. CPU/GPU costs and cosmetic clocks are reported separately. */
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const frameLimit=Number(process.env.CROWD_FRAMES??1200),smoke=frameLimit!==1200;
assert.ok(Number.isInteger(frameLimit)&&frameLimit>=150&&frameLimit<=3600);
const artifactLabel=process.env.CROWD_ARTIFACT_LABEL??(smoke?'smoke':'final');assert.match(artifactLabel,/^[a-z0-9-]+$/);const out=join(root,'artifacts/crowd-feedback',artifactLabel);await mkdir(out,{recursive:true});
const base=process.env.CROWD_FEEDBACK_URL??'http://127.0.0.1:5210/crowd-feedback-lab.html';
const allProfiles=[
 {id:'ordinary-dpr1',targets:3,dpr:1,cpuRate:1},
 {id:'crowded-dpr1',targets:12,dpr:1,cpuRate:1},
 {id:'ordinary-dpr175',targets:3,dpr:1.75,cpuRate:1},
 {id:'crowded-dpr175',targets:12,dpr:1.75,cpuRate:1},
 {id:'crowded-cpu4x-proxy',targets:12,dpr:1,cpuRate:4},
];
const selected=process.env.CROWD_PROFILES?.split(',');const profiles=allProfiles.filter(profile=>!selected||selected.includes(profile.id));assert.ok(profiles.length);
const captureEnabled=process.env.CROWD_CAPTURE!=='0'&&!smoke;
const bundle=[];for(const file of(await readdir(join(root,'dist-crowd/assets'))).filter(file=>file.endsWith('.js')).sort())bundle.push({file,sha256:createHash('sha256').update(await readFile(join(root,'dist-crowd/assets',file))).digest('hex')});
const source=[];if(process.env.CROWD_SOURCE_ROOT)for(const file of['src/dev/crowdFeedbackLab.ts','src/dev/crowdFeedbackTiming.ts','src/game.ts','src/ui.ts','src/ui/damageNumbers.ts','src/rendering/quality/crowdFeedbackPolicy.ts','src/rendering/quality/surfacePoseCache.ts','src/rendering/quality/statusCoating.ts','src/rendering/quality/elementalSurfaces.ts'])source.push({file,sha256:createHash('sha256').update(await readFile(join(process.env.CROWD_SOURCE_ROOT,file))).digest('hex')});
const frozenManifestPath=process.env.CROWD_SOURCE_MANIFEST??join(root,'artifacts/crowd-feedback/build-source.json');const frozenManifest=JSON.parse(await readFile(frozenManifestPath,'utf8'));
const report={protocol:'crowd-feedback-capacity-v1',status:'running',capturedAt:new Date().toISOString(),url:base,artifactLabel,smoke,frameLimit,bundle,source,sourceRoot:process.env.CROWD_SOURCE_ROOT??null,frozenManifestPath,frozenManifest,profiles:[],captures:[],errors:[],
 setup:'crowd-pressure-fixed-aim-v2: same3/12 live-AI high-health positions/roles, elemental-pressure gear, seed19/current balance and fire/heal rules as integratedStress, with explicit initial-yaw/pitch scripted aim compensation each tick. Actual shot recoil/muzzle pose unchanged.18 extra actual-ballistic sticky shots at frames1/61/121. All7 statuses re-proc each60frames through14s, then6s without new status re-procs/player fire; actual AI/defeat/recovery remain active. Recording-only evaluation flag enables uncapped measurement callbacks without replacing the fixture. Do not pool old2.5s policy results.',
 timing:{viewportCss:[1440,900],dpr:[1,1.75],simulationStep:1/60,targetDisplayedHz:60,warmupFrames:60,totalFrames:frameLimit,activeThroughFrame:840,arms:['classic-first','crowd','classic-repeat'],
  cpu:'gameFrameCpuMs encloses actual Game controls/step, synthetic capacity actions, UI flush and multipass draw plus measured GPU-query overhead. handlerCpuMs additionally includes diagnostic policy/state readback. Self scopes are exclusive nested timers; they must not be added to inclusive step/draw costs.',
  gpu:'One asynchronous disjoint-timer query per actual multipass comicRenderer.render. Each result is attached to its originating frame; unavailable/disjoint samples remain missing, never copied from an older frame.',
  clock:'60Hz-TARGET deadline pacing skips early native RAF callbacks; exactly one fixed1/60 simulation step per admitted callback and no multi-step catch-up. After a late callback, deadline alignment can admit an adjacent draw about8ms later, so this is not a hard inter-frame interval cap. Render/HUD delta uses actual admitted RAF interval, first1/60 and clamped to.25; it never drives simulation or feedback lifetimes. Under overload simulation slows while classic CSS/timers remain wall-clock; wall/simulation ratio is reported. Target-paced frame medians are not throughput.',
  browserCpu:'Read-only CDP aggregate Task/Script/Layout/RecalcStyle durations bracket each run. They include browser work outside Game callback timers and are not per-frame self costs.',
 },limits:['Synthetic capacity evidence, not an ordinary encounter/balance result.','DPR1.75 increases drawing-buffer load; it does not emulate another GPU.','CPU4x is a browser-main-thread pressure proxy; no physical midrange hardware claim.','Classic labels use wall-clock lifetimes; crowd labels use simulation time. Overloaded-profile readability comparisons retain that clock mismatch.','Screenshots use separate fresh pages at fixed simulation frames; no screenshot waits enter measured distributions.','Pose-cache counters include cached anchor work in both policies; classic surface recursion is not counted. They are not total transform-operation counters.'],hardwareStatus:'NOT RUN on a second device'};
const persist=()=>writeFile(join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');await persist();
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const launch={headless:true,args:process.platform==='darwin'?['--use-angle=metal']:[]};if(process.env.CHROME_EXECUTABLE)launch.executablePath=process.env.CHROME_EXECUTABLE;
const browser=await chromium.launch(launch);report.browser=browser.version();
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function exact(actual,expected,label){
 if(JSON.stringify(actual)===JSON.stringify(expected))return;
 let index=null;if(Array.isArray(actual)&&Array.isArray(expected))index=actual.findIndex((value,i)=>JSON.stringify(value)!==JSON.stringify(expected[i]));
 const detail=index===null?{actual,expected}:{index,actual:actual[index],expected:expected[index],actualLength:actual.length,expectedLength:expected.length};
 assert.fail(`${label}: ${JSON.stringify(detail).slice(0,3500)}`);
}
function distribution(values){const data=values.filter(Number.isFinite).sort((a,b)=>a-b);const at=p=>data[Math.ceil((data.length-1)*p)]??0;return{count:data.length,min:data[0]??0,median:at(.5),p95:at(.95),p99:at(.99),max:data.at(-1)??0};}
function frameSummary(rows){
 const keys=['rafMs','renderDelta','stepCpuMs','fixtureCpuMs','drawCpuMs','glSubmitCpuMs','gameFrameCpuMs','handlerCpuMs','calls','triangles','geometries','textures','domLabels','domUnhiddenLabels'];const summary={frames:rows.length};
 for(const key of keys)summary[key]=distribution(rows.map(frame=>frame[key]));summary.gpuMs=distribution(rows.map(frame=>frame.gpuMs).filter(value=>value!==null));
 summary.harnessOutsideGameMs=distribution(rows.map(frame=>frame.handlerCpuMs-frame.gameFrameCpuMs));
 summary.numberTotalCpuMs=distribution(rows.map(frame=>(frame.self.numberInput??0)+(frame.self.numberFlush??0)));summary.hudTotalCpuMs=distribution(rows.map(frame=>(frame.self.hud??0)+(frame.self.hudDom??0)+(frame.self.hudStatuses??0)));
 summary.self={};for(const key of new Set(rows.flatMap(frame=>Object.keys(frame.self))))summary.self[key]=distribution(rows.map(frame=>frame.self[key]??0));
 summary.renderDeltaClampedFrames=rows.filter(frame=>frame.rafMs>250).length;summary.longFrameTails={};for(const key of['rafMs','gameFrameCpuMs','handlerCpuMs','gpuMs'])summary.longFrameTails[key]=Object.fromEntries([16.7,25,33.3,50,100].map(limit=>[String(limit),rows.filter(frame=>frame[key]!==null&&frame[key]>limit).length]));return summary;
}
function resultSummary(result){
 const warmup=Math.min(60,Math.floor(result.frames.length/3)),measured=result.frames.slice(warmup);
 return{feedbackQuality:result.feedbackQuality,surfaceMode:result.surfaceMode,frameCount:result.frameCount,simulationSeconds:result.simulationSeconds,wallClockMs:result.wallClockMs,wallToSimulationRatio:result.wallClockMs/(result.simulationSeconds*1000),skippedRafs:result.skippedRafs,
  afterWarmup:frameSummary(measured),active:frameSummary(measured.filter(frame=>frame.frame<=840)),decay:frameSummary(measured.filter(frame=>frame.frame>840)),fullCrowdActive:frameSummary(measured.filter(frame=>frame.frame<=840&&frame.targetState.length===result.count)),
  dom:result.dom,feedback:result.feedback,visualAccounting:{acceptedEvents:result.feedback.receivedEvents,renderedEvents:result.feedback.renderedEvents,unpresentedEvents:result.feedback.unpresentedEvents??0,resetCancelledEvents:result.feedback.resetCancelledEvents??0,acceptedDamage:result.feedback.receivedDamage,renderedDamage:result.feedback.renderedDamage,unpresentedDamage:result.feedback.unpresentedDamage,resetCancelledDamage:result.feedback.resetCancelledDamage??0},edgeFallback:{records:result.feedback.edgeRecords??null,maxQueueDelaySeconds:result.feedback.maxQueueDelay??null},surface:result.surface,gpu:result.gpu,longTasks:result.longTasks,measurementAccounting:result.measurementAccounting,
  measurements:{events:result.measurements.length,shots:result.measurements.filter(event=>event.type==='shot').length,enemyDirect:result.measurements.filter(event=>event.type==='damage'&&event.target==='enemy'&&event.source==='direct').length,enemyStatus:result.measurements.filter(event=>event.type==='damage'&&event.target==='enemy'&&event.source==='status').length,finishes:result.measurements.filter(event=>event.type==='finish')},
  targetsAtEnd:result.current.enemies.length,firstMissingTargetFrame:result.frames.find(frame=>frame.targetState.length!==result.count)?.frame??null,
 };
}
function metrics(raw){return Object.fromEntries(raw.metrics.map(metric=>[metric.name,metric.value]));}
function metricDelta(before,after){const result={};for(const key of['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration'])result[`${key}Ms`]=before[key]===undefined||after[key]===undefined?null:(after[key]-before[key])*1000;for(const key of['LayoutCount','RecalcStyleCount','JSHeapUsedSize','JSHeapTotalSize'])result[key]=before[key]===undefined||after[key]===undefined?null:after[key]-before[key];return result;}
function signatures(result){return{
 scene:{mode:result.initial.mode,position:result.initial.position,yaw:result.initial.yaw,pitch:result.initial.pitch,parkedMech:result.initial.parkedMech,body:result.initial.body,simulationPose:result.initial.simulationPose,weaponBalance:result.initial.weaponBalance,enemies:result.initial.enemies,navigation:result.initial.navigation,loadouts:result.initial.progression.loadouts},
 shots:result.shots,hits:result.hits,ballisticShots:result.ballisticShots,measurements:result.measurements,synthetic:result.synthetic,reprocs:result.reprocs,
 frames:result.frames.map(frame=>({frame:frame.frame,time:frame.simTime,body:frame.body,targets:frame.targetState,screen:frame.screen,mode:frame.mode,camera:frame.camera,yaw:frame.yaw,pitch:frame.pitch})),
};}
function validate(result,profile,feedback,limit){
 assert.equal(result.frameCount,limit);assert.equal(result.frames.length,limit);assert.ok(Math.abs(result.simulationSeconds-limit/60)<1e-8);assert.equal(result.initial.mode,'mech');
 assert.equal(result.feedbackQuality,feedback);assert.equal(result.surfaceMode,feedback);assert.equal(result.initial.enemies.length,profile.targets);assert.equal(result.hardware.dpr,profile.dpr);assert.deepEqual(result.hardware.canvas,[Math.floor(1440*profile.dpr),Math.floor(900*profile.dpr)]);
 assert.equal(result.measurementAccounting.dropped,0);assert.equal(result.measurementAccounting.expected,result.measurementAccounting.callbacks);assert.equal(result.measurements.length,result.measurementAccounting.retained);assert.ok(result.shots.length>0);assert.equal(result.shots.length,result.measurements.filter(event=>event.type==='shot').length);
 assert.ok(result.measurements.some(event=>event.type==='damage'&&event.target==='enemy'&&event.source==='direct'));assert.ok(result.measurements.some(event=>event.type==='damage'&&event.target==='enemy'&&event.source==='status'));assert.equal(result.synthetic.length,18);assert.equal(result.ballisticShots.length,result.shots.length+18);
 for(const hook of result.wrapped)assert.equal(hook.installed,true,`missing exclusive timing hook ${hook.name}`);
 if(result.hardware.timer){assert.ok(result.gpu.resolved>limit*.9,'GPU samples must be frame-associated and available');assert.equal(result.gpu.pending,0);}
 assert.equal(result.presentation.soundEnabled,true);assert.equal(result.presentation.qualityAudioUnlocked,true);assert.equal(result.presentation.elementalAudioUnlocked,true);assert.equal(result.presentation.audioError,null);
 if(feedback==='crowd'){
  assert.equal(result.dom.initialAllocated,40);assert.ok(result.dom.peakUnhidden<=40);assert.equal(result.feedback.pooledNodes,40);assert.equal(result.feedback.timersPerEvent,0);
  for(const key of['resetCancelledDamage','resetCancelledEvents','unpresentedEvents'])assert.ok(Number.isFinite(result.feedback[key]),`missing frozen lifecycle diagnostic ${key}`);
  const cancelledDamage=result.feedback.resetCancelledDamage??0,cancelledEvents=result.feedback.resetCancelledEvents??0,unpresentedEvents=result.feedback.unpresentedEvents??0;
  assert.ok(Math.abs(result.feedback.receivedDamage-result.feedback.renderedDamage-result.feedback.unpresentedDamage-cancelledDamage)<1e-7,'accepted visual amount must equal rendered + unpresented + intentional reset cancellation');
  assert.equal(result.feedback.receivedEvents,result.feedback.renderedEvents+unpresentedEvents+cancelledEvents,'accepted visual event accounting must be conserved');
  if(limit===1200){assert.equal(result.feedback.pending,0,'six-second quiet tail must drain queued rows');assert.equal(unpresentedEvents,0);assert.equal(result.feedback.renderedEvents+cancelledEvents,result.feedback.receivedEvents,'each accepted visual event must be presented or explicitly reset-cancelled');assert.ok(Math.abs(result.feedback.unpresentedDamage)<1e-7,'no visual damage amount may remain unpresented after the quiet tail');}
 }
}
async function newArm(profile,feedback){
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:profile.dpr}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push({type:'pageerror',message:error.message}));page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('404'))errors.push({type:'console',message:message.text()});});
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile.cpuRate});await cdp.send('Performance.enable');
 const url=new URL(base);url.searchParams.set('targets',String(profile.targets));url.searchParams.set('feedback',feedback);url.searchParams.set('pace','60');
 await page.goto(url.href);await page.waitForFunction(()=>window.crowdFeedback,undefined,{timeout:30000});await page.locator('#crowd-enable').click();
 await page.waitForFunction(()=>{const value=window.crowdFeedback.game.presentationDiagnostics;return value?.qualityAudioUnlocked&&value?.elementalAudioUnlocked;},undefined,{timeout:10000});
 return{context,page,cdp,errors,url:url.href};
}
async function runArm(profile,label,feedback){
 const arm=await newArm(profile,feedback);
 try{
  const before=metrics(await arm.cdp.send('Performance.getMetrics'));const result=await arm.page.evaluate(frames=>window.crowdFeedback.measure(frames),frameLimit);const after=metrics(await arm.cdp.send('Performance.getMetrics'));
  const file=`${profile.id}-${label}.json.gz`;await writeFile(join(out,file),gzipSync(JSON.stringify({label,url:arm.url,result,errors:arm.errors,cdpMetrics:{before,after,delta:metricDelta(before,after)}})));
  validate(result,profile,feedback,frameLimit);assert.deepEqual(arm.errors,[]);
  const summary={label,feedback,url:arm.url,evidence:file,hardware:result.hardware,...resultSummary(result),cdpMetrics:metricDelta(before,after),errors:arm.errors};
  console.log('ARM',profile.id,label,JSON.stringify({frames:result.frameCount,cpuP95:summary.active.gameFrameCpuMs.p95,gpuP95:summary.active.gpuMs.p95,statusP95:summary.active.self.status?.p95,numbersP95:summary.active.numberTotalCpuMs.p95,visiblePeak:result.dom.peakUnhidden,events:result.measurements.length,defeats:summary.measurements.finishes,wallRatio:summary.wallToSimulationRatio}));return{summary,result};
 }catch(error){report.errors.push({profile:profile.id,label,message:String(error),browserErrors:arm.errors});await persist();throw error;}
 finally{await arm.context.close();}
}
async function capture(profile,feedback,frame){
 const arm=await newArm(profile,feedback);
 try{
  const result=await arm.page.evaluate(frame=>window.crowdFeedback.capture(frame),frame);validate(result,profile,feedback,frame);
  const prefix=`capture-${profile.id}-${feedback}-f${frame}`,image=`${prefix}.png`,file=`${prefix}.json.gz`;
  await arm.page.screenshot({path:join(out,image)});assert.deepEqual(arm.errors,[]);await writeFile(join(out,file),gzipSync(JSON.stringify({url:arm.url,result,errors:arm.errors})));
  const summary={profile:profile.id,feedback,frame,simulationSeconds:result.simulationSeconds,wallClockMs:result.wallClockMs,image,evidence:file,bounds:result.labelBounds,feedbackDiagnostics:result.feedback,combatSignature:digest(signatures(result))};
  console.log('CAPTURE',profile.id,feedback,frame,JSON.stringify({visible:summary.bounds.visible,allocated:summary.bounds.allocated,pairs:summary.bounds.overlappingPairs,reticle:summary.bounds.reticleOverlaps,heads:summary.bounds.headOverlaps,hud:summary.bounds.hudOverlaps}));return summary;
 }finally{await arm.context.close();}
}
function comparison(profile){const[first,crowd,repeat]=profile.arms;return{profile:profile.id,targets:profile.targets,dpr:profile.dpr,cpuRate:profile.cpuRate,
 activeCpuP95:[first.active.gameFrameCpuMs.p95,crowd.active.gameFrameCpuMs.p95,repeat.active.gameFrameCpuMs.p95],activeCpuP99:[first.active.gameFrameCpuMs.p99,crowd.active.gameFrameCpuMs.p99,repeat.active.gameFrameCpuMs.p99],activeGpuP95:[first.active.gpuMs.p95,crowd.active.gpuMs.p95,repeat.active.gpuMs.p95],activeRafP95:[first.active.rafMs.p95,crowd.active.rafMs.p95,repeat.active.rafMs.p95],visiblePeaks:[first.dom.peakUnhidden,crowd.dom.peakUnhidden,repeat.dom.peakUnhidden],wallToSimulationRatios:[first.wallToSimulationRatio,crowd.wallToSimulationRatio,repeat.wallToSimulationRatio],parity:profile.parity};}
async function writeMarkdown(){
 const lines=['Crowd feedback verification','','Actual Game capacity fixtures, classic → crowd → classic repeated in one compiled build.','','| Profile | Whole Game+draw CPU p95, ms | GPU p95, ms | Peak unhidden labels |','| --- | --- | --- | --- |'];
 for(const item of report.summary??[])lines.push(`| ${item.profile} | ${item.activeCpuP95.map(value=>value.toFixed(2)).join(' / ')} | ${item.activeGpuP95.map(value=>value.toFixed(2)).join(' / ')} | ${item.visiblePeaks.join(' / ')} |`);
 lines.push('','Values use active frames after warmup. Full distributions, p99/max, long-frame tails, exclusive status/HUD/number timings, browser layout/style CPU and raw per-frame data are retained in verification.json and compressed arm traces.','','Every compared Game trajectory, actual ballistic hit, measurement event and per-frame body/target state is checked for exact equality. No measurement callback is dropped. Capacity targets have explicitly raised health; player health, AI, ammo, heat, healing and defeat retain ordinary behavior.','','Native RAF uses60Hz-TARGET deadline pacing with one fixed simulation step per admitted callback. After latency, an adjacent admission may occur about8ms later; this is not a hard inter-frame interval cap or a throughput measurement. CPU4x is a pressure proxy, DPR1.75 is drawing-buffer pressure, and no second-device hardware result is claimed. Classic labels age on wall time; crowd labels age on simulation time, so clock ratios under overload are reported rather than hidden.','','Screenshots use fresh separate pages at matched simulation frames and never interrupt timed arms.');
 await writeFile(join(out,'report.md'),lines.join('\n')+'\n');
}
try{
 for(const profile of profiles){
  const entry={...profile,arms:[],parity:null};report.profiles.push(entry);await persist();let reference=null;
  for(const[label,feedback]of[['classic-first','classic'],['crowd','crowd'],['classic-repeat','classic']]){
   const arm=await runArm(profile,label,feedback);entry.arms.push(arm.summary);const actual=signatures(arm.result);
   if(!reference)reference=actual;else for(const[key,value]of Object.entries(actual))exact(value,reference[key],`${profile.id}/${label}: exact ${key} parity`);
   await persist();
  }
  entry.parity={exact:true,hashes:Object.fromEntries(Object.entries(reference).map(([key,value])=>[key,digest(value)])),droppedMeasurementEvents:0};await persist();
 }
 if(captureEnabled){
  const crowded=allProfiles.find(profile=>profile.id==='crowded-dpr1');
  for(const frame of[180,600,1200]){const pair=[];for(const feedback of['classic','crowd']){const item=await capture(crowded,feedback,frame);report.captures.push(item);pair.push(item);await persist();}assert.equal(pair[0].combatSignature,pair[1].combatSignature,`capture frame${frame} must preserve combat`);}
  const ordinary=allProfiles.find(profile=>profile.id==='ordinary-dpr1');const pair=[];for(const feedback of['classic','crowd']){const item=await capture(ordinary,feedback,600);report.captures.push(item);pair.push(item);await persist();}assert.equal(pair[0].combatSignature,pair[1].combatSignature,'ordinary matched capture must preserve combat');
 }
 for(const item of bundle)assert.equal(createHash('sha256').update(await readFile(join(root,'dist-crowd/assets',item.file))).digest('hex'),item.sha256,`compiled artifact changed: ${item.file}`);
 report.summary=report.profiles.map(comparison);report.status='complete';report.completedAt=new Date().toISOString();await persist();await writeMarkdown();
 console.log('PASS',JSON.stringify({profiles:report.profiles.length,arms:report.profiles.length*3,captures:report.captures.length,exactCombatParity:true,droppedMeasurements:0,errors:report.errors}));
}catch(error){report.status='failed';report.failure=String(error);await persist();throw error;}
finally{await browser.close();}
