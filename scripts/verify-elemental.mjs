/** Compiled actual-Game verification: every element, both forms, surface hits and matched active-fire timings. */
import{mkdir,writeFile,readdir,readFile}from'node:fs/promises';
import{resolve,dirname,join}from'node:path';import{fileURLToPath}from'node:url';import{createHash}from'node:crypto';import assert from'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=join(root,'artifacts/elemental');await mkdir(out,{recursive:true});
const{chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{}),args:process.platform==='darwin'?['--use-angle=metal']:[]});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});const errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});
const cases=[
 {element:'kinetic',projectile:'bullet',weaponType:'rifle',brand:'ironvale'},
 {element:'fire',projectile:'slug',weaponType:'shotgun',brand:'cindergrid'},
 {element:'ice',projectile:'beam',weaponType:'sniper',brand:'prism'},
 {element:'corrosive',projectile:'sticky',weaponType:'launcher',brand:'tackwork'},
 {element:'shock',projectile:'arc',weaponType:'smg',brand:'voltaic'},
 {element:'radiation',projectile:'scatter',weaponType:'shotgun',brand:'cindergrid'},
 {element:'gravity',projectile:'orb',weaponType:'launcher',brand:'nullward'},
 {element:'adhesive',projectile:'spike',weaponType:'smg',brand:'tackwork'},
];
const advance=async(seconds)=>page.evaluate(async(seconds)=>{const q=window.qualityReview,g=q.game;g.driveEvaluation({fire:false,yaw:g.yaw,pitch:g.pitch});for(let t=0;t<seconds-.00001;t+=1/60){g.stepEvaluation(Math.min(1/60,seconds-t));await new Promise(requestAnimationFrame);}},seconds);
async function reset(c,enabled=true,mode='pilot'){
 await page.evaluate(({c,enabled,mode})=>{const q=window.qualityReview;q.setBenchDrive(false);q.setElementalEnabled(enabled);q.resetElementalFixture(c.element,c.projectile,c.weaponType,mode,c.brand);q.hidePanel();}, {c,enabled,mode});
 await page.evaluate(()=>{document.querySelector('.toast-stack')?.replaceChildren();document.querySelectorAll('.damage-number').forEach(n=>n.remove());return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
}
function compareTrace(actual,expected,label){
 assert.deepEqual(actual.body,expected.body,`${label}: health/shield/ammo/reserve/heat`);assert.equal(actual.time,expected.time);assert.equal(actual.hits.length,expected.hits.length);
 let maxPointDelta=0;
 actual.hits.forEach((hit,i)=>{const reference=expected.hits[i];assert.deepEqual({...hit,point:[]},{...reference,point:[]},`${label}: hit ${i} values`);hit.point.forEach((value,j)=>{const delta=Math.abs(value-reference.point[j]);maxPointDelta=Math.max(maxPointDelta,delta);assert.ok(delta<=.0001,`${label}: hit location differs by ${delta}m`);});});
 return maxPointDelta;
}
async function shot(){await page.evaluate(()=>{const q=window.qualityReview,g=q.game;g.driveEvaluation({fire:true,yaw:g.yaw,pitch:g.pitch});g.stepEvaluation(1/60);g.driveEvaluation({fire:false,yaw:g.yaw,pitch:g.pitch});});}
try{
 await page.goto(process.env.ELEMENTAL_REVIEW_URL??'http://127.0.0.1:5198/elemental-lab.html');await page.waitForFunction(()=>window.qualityReview);await page.waitForTimeout(1600);
 await page.click('#quality-sound');await page.evaluate(()=>window.qualityReview.hidePanel());
 const hardware=await page.evaluate(()=>{const gl=window.qualityReview.game.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),timer:!!gl.getExtension('EXT_disjoint_timer_query_webgl2')};});
 const bundle=[];for(const file of(await readdir(join(root,'dist-quality/assets'))).filter(f=>f.endsWith('.js')).sort())bundle.push({file,sha256:createHash('sha256').update(await readFile(join(root,'dist-quality/assets',file))).digest('hex')});
 const visual=[];
 for(const c of cases){
  await reset(c);await advance(.25);await page.screenshot({path:join(out,`${c.element}-equipment.png`)});
  await shot();const flightTime=await page.evaluate(()=>{const q=window.qualityReview,s=q.game.progression.inventory.find(i=>i.id===q.game.progression.loadouts[q.game.mode].weapon).weapon;return s.projectile==='beam'||s.projectile==='arc'?1/240:Math.min(.06,1.1/s.speed);});await advance(flightTime);await page.screenshot({path:join(out,`${c.element}-flight.png`)});
  for(let n=0;n<90;n++){const hit=await page.evaluate(()=>window.qualityReview.history.length>0);if(hit)break;await advance(1/30);}
  const contact=await page.evaluate(()=>{const q=window.qualityReview;return{hits:q.history.slice(),diagnostics:q.elemental.diagnostics,audio:q.elemental.audio.unlocked,body:{...q.game.bodies.pilot},spec:q.game.progression.inventory.find(i=>i.id===q.game.progression.loadouts.pilot.weapon).weapon};});
  assert.ok(contact.hits.length,`${c.element} must cause an actual ballistic hit`);assert.equal(contact.spec.element,c.element);assert.ok(contact.audio);
  await page.screenshot({path:join(out,`${c.element}-impact.png`)});await advance(.75);
  const lingering=await page.evaluate(()=>({states:Object.keys(window.qualityReview.game.enemies[0].statuses),visuals:window.qualityReview.elemental.diagnostics}));
  if(c.element!=='kinetic')assert.ok(lingering.states.includes(c.element),`${c.element} must apply a real status`);
  await page.screenshot({path:join(out,`${c.element}-lingering.png`)});
  // Actual ground collision from a second, independent diagnostic shot.
  await reset({...c,projectile:'bullet',weaponType:'rifle'});await page.evaluate(()=>{const g=window.qualityReview.game;g.yaw=-.43;g.pitch=-.47;});await advance(.02);await shot();await advance(.15);
  const ground=await page.evaluate(()=>window.qualityReview.elemental.diagnostics.impacts);assert.ok(ground>0,`${c.element} ground collision must produce surface effects`);await page.screenshot({path:join(out,`${c.element}-ground.png`)});
  await reset(c,true,'mech');await shot();await advance(.2);await page.screenshot({path:join(out,`${c.element}-mech.png`)});
  const mech=await page.evaluate(()=>{const q=window.qualityReview;q.game.scene.updateMatrixWorld(true);return{ammo:q.game.bodies.mech.ammo,mode:q.game.mode,muzzles:q.game.mechRig.muzzles.map(m=>m.matrixWorld.elements.slice(12,15))};});assert.equal(mech.mode,'mech');
  visual.push({...c,contact,lingering,ground,mech});console.log('VISUAL',c.element,JSON.stringify({hits:contact.hits.length,status:lingering.states,ground}));
 }
 // Same compiled page, fixed 1/60 simulation steps, identical scene/camera/loadout and natural reload/heat.
 await writeFile(join(out,'visual-verification.json'),JSON.stringify({bundle,hardware,visual,errors},null,2)+'\n');
 const performance=[];
 for(const c of cases){const samples=[];
  for(const enabled of[false,true,false]){
   await reset(c,enabled);
   const result=await page.evaluate(async label=>{const q=window.qualityReview;q.setBenchDrive(true);const sample=await q.perf.measure(label,180,60);q.setBenchDrive(false);const trace={hits:q.history.map(h=>({...h,targetId:h.targetId===-1?'dummy':'sentry'})),body:{...q.game.bodies.pilot},time:q.game.time};return{sample,trace};},`${c.element}/${enabled?'quality':'legacy'}`);samples.push({enabled,...result});
  }
  const pointDelta=compareTrace(samples[1].trace,samples[0].trace,c.element);const repeatPointDelta=compareTrace(samples[2].trace,samples[0].trace,`${c.element}/repeat`);
  performance.push({...c,pointDelta,repeatPointDelta,baseline:samples[0],quality:samples[1],repeat:samples[2]});console.log('PERF',c.element,JSON.stringify(samples.map(s=>({quality:s.enabled,frame:s.sample.frameMs.median,gpu:s.sample.gpuMs?.median,calls:s.sample.calls.median,hits:s.trace.hits.length}))));
 }
 await reset(cases[1]);await shot();await advance(.08);await page.evaluate(()=>window.qualityReview.setFrozen(true));await page.waitForTimeout(100);
 const paused=await page.evaluate(()=>{const q=window.qualityReview;return{voices:q.elemental.audio.activeVoiceCount,active:q.elemental.impacts.activeCount,positions:JSON.stringify([...q.elemental.impacts.group.children].map(m=>Array.from(m.instanceMatrix.array)))};});await page.waitForTimeout(100);
 const frozen=await page.evaluate(()=>{const q=window.qualityReview;return{voices:q.elemental.audio.activeVoiceCount,active:q.elemental.impacts.activeCount,positions:JSON.stringify([...q.elemental.impacts.group.children].map(m=>Array.from(m.instanceMatrix.array)))};});assert.deepEqual(frozen,paused);assert.equal(paused.voices,0);
 // A second elemental channel may decorate only the weapon and its payload.
 await page.evaluate(()=>window.qualityReview.resetElementalFixture('corrosive','rocket','launcher','pilot','tackwork','fire'));await shot();await advance(.4);await page.screenshot({path:join(out,'dual-corrosive-fire.png')});
 assert.equal(errors.length,0,errors.join('\n'));const result={capturedAt:new Date().toISOString(),build:bundle,hardware,viewport:[1440,900],dpr:1,simulationStep:1/60,warmup:60,frames:180,visual,performance,pause:{voices:paused.voices,active:paused.active,frozen:true},errors};
 await writeFile(join(out,'verification.json'),JSON.stringify(result,null,2)+'\n');console.log('PASS',JSON.stringify({elements:visual.length,forms:2,matchedPairs:performance.length,pointToleranceMeters:.0001,errors}));
}finally{await browser.close();}
