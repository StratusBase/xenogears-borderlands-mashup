/** Compiled, fresh-page capacity profiles. CPU throttling is a proxy, never a midrange GPU claim. */
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=join(root,'artifacts/integrated');
await mkdir(out,{recursive:true});
const base=process.env.INTEGRATED_STRESS_URL??'http://127.0.0.1:5198/integrated-stress-lab.html';
const reportPath=join(out,'stress.json');
const profiles=[
 {id:'ordinary-capacity-dpr1',targets:3,dpr:1,cpuRate:1},
 {id:'crowded-capacity-dpr1',targets:12,dpr:1,cpuRate:1},
 {id:'ordinary-capacity-dpr175',targets:3,dpr:1.75,cpuRate:1},
 {id:'crowded-capacity-dpr175',targets:12,dpr:1.75,cpuRate:1},
 {id:'crowded-capacity-cpu4x-proxy',targets:12,dpr:1,cpuRate:4},
];
const sourcePaths=['src/dev/integratedStressLab.ts','src/rendering/quality/GamePresentation.ts','src/rendering/quality/elementalPresentation.ts','src/game.ts','src/world.ts','src/ui.ts'];
const source=[];for(const file of sourcePaths){try{source.push({file,sha256:createHash('sha256').update(await readFile(join(root,file))).digest('hex')});}catch{/* Missing optional source will be evident from bundle evidence. */}}
const bundle=[];try{for(const file of(await readdir(join(root,'dist-quality/assets'))).filter(file=>file.endsWith('.js')).sort())bundle.push({file,sha256:createHash('sha256').update(await readFile(join(root,'dist-quality/assets',file))).digest('hex')});}catch{/* Developer URLs can still provide source manifests. */}
let existingManifest=null;
for(const path of ['artifacts/integrated/source-manifest.json','artifacts/integrated/build-manifest.json','dist-quality/source-manifest.json']){
 try{existingManifest={path,contents:JSON.parse(await readFile(join(root,path),'utf8'))};break;}catch{/* Optional provenance artifact. */}
}
const report={
 protocol:'integrated-crowd-capacity-v1',status:'running',capturedAt:new Date().toISOString(),url:base,
 provenance:'synthetic-capacity-fixture',bundle,source,existingManifest,platform:process.platform,node:process.version,
 viewportCss:[1440,900],simulationStep:1/60,sampleFrames:120,warmupFrames:30,expectedSimulationFrames:150,
 capacitySetup:'3 or 12 high-health live targets with actual enemy AI and all seven initial real status states. Normal player fire/heat/reload/heal plus 18 direct actual-ballistic sticky shots in three volleys. Extra volley shots consume no player ammo.',
 limits:[
  'Synthetic capacity evidence; not an ordinary encounter, campaign balance, or clear-time result.',
  'Renderer runs on the recorded local GPU. DPR 1.75 increases drawing-buffer work but does not emulate a different GPU.',
  'CDP CPU rate 4 throttles browser main-thread work only. It is a CPU-pressure proxy, not physical midrange-hardware verification.',
  'One existing Game simulation step of 1/60 second per displayed frame; the 150-frame run covers 2.5 simulation seconds, not a frame-rate-duration benchmark.',
  'GPU results depend on clock/thermal/background load; repeated legacy arms show drift and are retained.',
  'CPU render submission excludes some simulation/presentation work; RAF frame intervals include that work and scheduling.',
 ],
 profiles:[],errors:[],summary:[],
};
const persist=async()=>writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
await persist();
const{chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const options={headless:true,args:process.platform==='darwin'?['--use-angle=metal']:[]};
if(process.env.CHROME_EXECUTABLE)options.executablePath=process.env.CHROME_EXECUTABLE;
const browser=await chromium.launch(options);
report.browser=browser.version();await persist();
function compact(sample){return{
 frameMs:sample.frameMs,submitMs:sample.submitMs,gpuMs:sample.gpuMs,
 calls:sample.calls,triangles:sample.triangles,geometries:sample.geometries,textures:sample.textures,
 viewport:sample.viewport,dpr:sample.dpr,
};}
function summarize(profile){
 const[first,quality,repeat]=profile.arms;
 return{profile:profile.id,targets:profile.targets,dpr:profile.dpr,cpuRate:profile.cpuRate,
  labels:['legacy-first','quality','legacy-repeat'],
  legacyFirst:compact(first.result.sample),quality:compact(quality.result.sample),legacyRepeat:compact(repeat.result.sample),
  delta:{frameMedianMs:quality.result.sample.frameMs.median-first.result.sample.frameMs.median,
   frameP95Ms:quality.result.sample.frameMs.p95-first.result.sample.frameMs.p95,
   cpuSubmitMedianMs:quality.result.sample.submitMs.median-first.result.sample.submitMs.median,
   gpuMedianMs:quality.result.sample.gpuMs&&first.result.sample.gpuMs?quality.result.sample.gpuMs.median-first.result.sample.gpuMs.median:null,
   callsMedian:quality.result.sample.calls.median-first.result.sample.calls.median,
   trianglesMedian:quality.result.sample.triangles.median-first.result.sample.triangles.median},
  simulationOutcome:profile.arms.map(arm=>({label:arm.label,frames:arm.result.frames,seconds:arm.result.simulationSeconds,targets:arm.result.targets.length,health:arm.result.snapshot.body.health,shield:arm.result.snapshot.body.shield,ammo:arm.result.snapshot.body.ammo,heat:arm.result.snapshot.body.heat,mode:arm.result.mode,diagnostics:arm.result.diagnostics})),
 };
}
async function runArm(profile,label,presentation){
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:profile.dpr});
 const page=await context.newPage(),errors=[];
 let cdp;
 page.on('pageerror',error=>errors.push({type:'pageerror',message:error.message}));
 page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('404'))errors.push({type:'console',message:message.text()});});
 page.on('response',response=>{if(response.status()>=400&&!new URL(response.url()).pathname.endsWith('/favicon.ico'))errors.push({type:'http',status:response.status(),url:response.url()});});
 try{
  cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile.cpuRate});
  const url=new URL(base);url.searchParams.set('crowd',String(profile.targets));if(presentation==='legacy')url.searchParams.set('presentation','legacy');
  const response=await page.goto(url.href);assert.equal(response?.status(),200,`${profile.id}/${label} must load the compiled lab`);
  await page.waitForFunction(()=>window.integratedStress,{timeout:30000});
  const initial=await page.evaluate(()=>{
   const{game}=window.integratedStress,canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2')??canvas.getContext('webgl');
   const ext=gl.getExtension('WEBGL_debug_renderer_info');
   return{mode:game.presentationMode,diagnostics:game.presentationDiagnostics,snapshot:game.getEncounterSnapshot(),
    hardware:{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),version:gl.getParameter(gl.VERSION),timer:!!gl.getExtension('EXT_disjoint_timer_query_webgl2'),userAgent:navigator.userAgent,devicePixelRatio},
    canvas:{width:canvas.width,height:canvas.height}};
  });
  assert.equal(initial.mode,presentation,`${profile.id}/${label} must use requested presentation`);
  assert.equal(initial.snapshot.enemies.length,profile.targets);assert.equal(initial.hardware.devicePixelRatio,profile.dpr);
  assert.deepEqual(initial.canvas,{width:Math.floor(1440*profile.dpr),height:Math.floor(900*profile.dpr)});
  await page.locator('#stress-enable').click();
  if(presentation==='quality')await page.waitForFunction(()=>{const d=window.integratedStress.game.presentationDiagnostics;return d?.qualityAudioUnlocked&&d?.elementalAudioUnlocked;},{timeout:10000});
  const started=Date.now();const result=await page.evaluate(()=>window.integratedStress.measure());
  assert.equal(result.frames,150,`${profile.id}/${label} must drive exactly 150 simulation frames`);
  assert.equal(result.sample.frames,120);assert.ok(Math.abs(result.simulationSeconds-2.5)<1e-9);
  assert.equal(result.targets.length,profile.targets);assert.equal(result.snapshot.enemies.length,profile.targets);assert.equal(result.syntheticVolleys.length,18);
  assert.equal(result.mode,presentation);assert.equal(result.diagnostics.mode,presentation);assert.equal(result.diagnostics.soundEnabled,true);
  if(presentation==='quality'){assert.equal(result.diagnostics.qualityAudioUnlocked,true);assert.equal(result.diagnostics.elementalAudioUnlocked,true);assert.equal(result.diagnostics.audioError,null);assert.ok(result.diagnostics.trackedEnemies>=profile.targets);}
  assert.deepEqual(result.sample.viewport,[Math.floor(1440*profile.dpr),Math.floor(900*profile.dpr)]);assert.equal(result.sample.dpr,profile.dpr);
  for(const key of ['frameMs','submitMs','calls','triangles']){assert.ok(Number.isFinite(result.sample[key].median));assert.ok(result.sample[key].median>0);assert.ok(result.sample[key].p95>=result.sample[key].median);}
  if(initial.hardware.timer)assert.ok(result.sample.gpuMs&&result.sample.gpuMs.median>0,'hardware GPU queries should produce samples');
  const screenshot=`stress-${profile.id}-${label}.png`;await page.screenshot({path:join(out,screenshot)});
  assert.equal(errors.length,0,`${profile.id}/${label}: ${JSON.stringify(errors)}`);
  return{label,presentation,url:url.href,cpuPressureProxy:profile.cpuRate>1,initial,result,screenshot,wallClockMs:Date.now()-started,errors};
 }catch(error){
  report.errors.push({profile:profile.id,label,message:String(error),errors});await persist();throw error;
 }finally{try{await cdp?.send('Emulation.setCPUThrottlingRate',{rate:1});}catch{/* Page may have closed after a renderer error. */}await context.close();}
}
try{
 for(const profile of profiles){
  const evidence={...profile,arms:[]};report.profiles.push(evidence);await persist();
  for(const[label,mode]of[['legacy-first','legacy'],['quality','quality'],['legacy-repeat','legacy']]){
   const arm=await runArm(profile,label,mode);evidence.arms.push(arm);await persist();
   const s=arm.result.sample;console.log('STRESS',profile.id,label,JSON.stringify({frames:arm.result.frames,frame:s.frameMs.median,p95:s.frameMs.p95,cpu:s.submitMs.median,gpu:s.gpuMs?.median,calls:s.calls.median,triangles:s.triangles.median,geometries:s.geometries,textures:s.textures}));
  }
  report.summary.push(summarize(evidence));await persist();
 }
 // Verify no build artifact changed between arms of the matched run.
 for(const entry of bundle){const bytes=await readFile(join(root,'dist-quality/assets',entry.file));assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,`compiled artifact drifted: ${entry.file}`);}
 report.status='complete';report.completedAt=new Date().toISOString();await persist();
 console.log('PASS',JSON.stringify({profiles:report.profiles.length,arms:report.profiles.reduce((n,p)=>n+p.arms.length,0),errors:report.errors,capacityOnly:true,cpuProxy:true}));
}catch(error){report.status='failed';report.failure=String(error);await persist();throw error;}
finally{await browser.close();}
