import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/steven/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=join(process.cwd(),'artifacts/corrosive-ab');await mkdir(out,{recursive:true});
const bundle=[];for(const name of await readdir('dist-corrosive/assets')){const data=await readFile(join('dist-corrosive/assets',name));bundle.push({name,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE??'/Users/steven/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',args:['--use-angle=metal']});
const errors=[];let context;
const url=process.env.CORROSIVE_REVIEW_URL??'http://127.0.0.1:5203/corrosive-lab.html';
async function setup(after,kind,delivery,count=2,move=false,mode='pilot'){
 await page.evaluate(({after,kind,delivery,count,move,mode})=>{const r=window.corrosiveReview;r.setMotion(after?'directional':'previous');r.fixture(kind,delivery,count,move,mode);r.clean();},{after,kind,delivery,count,move,mode});
 await page.locator('#ab-sound').evaluate(b=>{b.closest('aside').hidden=false;document.body.classList.remove('corrosive-clean');});
 await page.getByRole('button',{name:/Enable sound|Sound enabled/}).click();
 await page.evaluate(()=>window.corrosiveReview.clean());
 await page.waitForFunction(()=>window.corrosiveReview.g.presentation.diagnostics.qualityAudioUnlocked&&window.corrosiveReview.g.presentation.diagnostics.elementalAudioUnlocked);
}
async function shotUntilDetonation(){return page.evaluate(()=>{const r=window.corrosiveReview;r.fireOne();for(let i=0;i<360;i++){r.step(1/120);if(r.layer.corrosive.events.some(e=>e.phase==='detonate'))return r.snapshot();}throw new Error('No actual sticky detonation');});}
async function picture(name){await page.waitForTimeout(25);await page.screenshot({path:join(out,name+'.png')});return name+'.png';}
let page;
try{
 context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(url);await page.waitForFunction(()=>!!window.corrosiveReview);await page.waitForTimeout(600);
 const hardware=await page.evaluate(()=>{const gl=window.corrosiveReview.g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,userAgent:navigator.userAgent};});
 const visuals=[];
 for(const kind of['human','armored']){
  for(const after of[false,true]){
   await setup(after,kind,'sticky');const images=[];images.push(await picture(`${kind}-${after?'ab':'before'}-clean`));
   if(after){await shotUntilDetonation();await page.evaluate(()=>window.corrosiveReview.step(.035));images.push(await picture(`${kind}-ab-contact`));await page.evaluate(()=>window.corrosiveReview.step(.10));images.push(await picture(`${kind}-ab-splash`));await page.evaluate(()=>{for(let i=0;i<66;i++)window.corrosiveReview.step(1/120);});images.push(await picture(`${kind}-ab-reaction`));await page.evaluate(()=>window.corrosiveReview.step(.25));images.push(await picture(`${kind}-ab-residue`));}
   else{await page.evaluate(()=>{const r=window.corrosiveReview;r.fireOne();for(let i=0;i<166;i++)r.step(1/120);});images.push(await picture(`${kind}-before-splash`));await page.evaluate(()=>{for(let i=0;i<66;i++)window.corrosiveReview.step(1/120);});images.push(await picture(`${kind}-before-reaction`));}
   const snapshot=await page.evaluate(()=>window.corrosiveReview.snapshot());assert.ok(snapshot.hits.length>=3,'Real sticky contact and splash must hit real targets');assert.ok(snapshot.targets[0].statuses.corrosive);assert.equal(snapshot.body.ammo,3);
   const surfaceAudit=after?await page.evaluate(()=>{const r=window.corrosiveReview,effect=r.g.enemies[0].statusEffects.get('corrosive');return{events:r.layer.corrosive.events,visibleBindings:effect.bindings.filter(b=>b.mesh.visible).map(b=>({name:b.source.name,surface:b.source.userData.corrosiveSurface}))};}):null;
   if(after&&kind==='armored'){assert.ok(surfaceAudit.events.every(e=>e.surface==='armor'),'VFX must project to the outer armor');assert.ok(surfaceAudit.visibleBindings.length>0);assert.ok(surfaceAudit.visibleBindings.every(b=>b.surface==='armor'),'underlying skin/cloth must not acquire the armor coating');}
   visuals.push({kind,after,images,snapshot,surfaceAudit});console.log('VISUAL',kind,after?'A+B':'before');
  }
 }
 // Exposed arm: the existing hit proxies choose a real skin surface, not a whole-target label.
 await setup(true,'human','bullet');await page.evaluate(()=>{const r=window.corrosiveReview;r.aimSkin();r.fireOne();for(let i=0;i<20;i++)r.step(1/120);});
 const skin=await page.evaluate(()=>({snapshot:window.corrosiveReview.snapshot(),events:window.corrosiveReview.layer.corrosive.events}));assert.ok(skin.events.some(e=>e.surface==='skin'));skin.image=await picture('human-skin-contact');
 await setup(true,'human','bullet');await page.evaluate(()=>{const r=window.corrosiveReview;r.aimGround();r.fireOne();for(let i=0;i<30;i++)r.step(1/120);});const ground=await page.evaluate(()=>window.corrosiveReview.layer.corrosive.events);assert.ok(ground.some(e=>e.surface==='ground'));await picture('ground-ab-splat');
 // Moving attachment, secondary channel, mech socket and ordinary delivery coverage.
 const other=[];
 for(const test of[{kind:'human',delivery:'bullet',move:true},{kind:'armored',delivery:'scatter'},{kind:'human',delivery:'beam'},{kind:'armored',delivery:'rocket'},{kind:'armored',delivery:'bullet',mode:'mech'},{kind:'human',delivery:'slug',secondary:'fire'}]){
  await setup(true,test.kind,test.delivery,2,test.move??false,test.mode??'pilot');if(test.secondary)await page.evaluate(value=>window.corrosiveReview.setSecondary(value),test.secondary);
  await page.evaluate(()=>{const r=window.corrosiveReview;r.fireOne();for(let i=0;i<36;i++)r.step(1/120);});const snapshot=await page.evaluate(()=>window.corrosiveReview.snapshot());assert.ok(snapshot.hits.length>0,JSON.stringify(test));assert.ok(snapshot.targets[0].statuses.corrosive);other.push({...test,image:await picture(`coverage-${test.kind}-${test.delivery}-${test.mode??'pilot'}${test.secondary?'-dual':''}`),snapshot});
 }
 const pauseBefore=await page.evaluate(()=>window.corrosiveReview.layer.corrosive.group.children.filter(o=>o.isInstancedMesh).map(o=>Array.from(o.instanceMatrix.array)));await page.keyboard.press('Escape');const pauses=await page.evaluate(before=>{const r=window.corrosiveReview;const after=r.layer.corrosive.group.children.filter(o=>o.isInstancedMesh).map(o=>Array.from(o.instanceMatrix.array));return{screen:r.g.screen,frozen:JSON.stringify(after)===JSON.stringify(before),elementalVoices:r.g.presentation.diagnostics.elementalVoices,physicalVoices:r.g.presentation.diagnostics.physicalVoices};},pauseBefore);assert.equal(pauses.screen,'pause');assert.equal(pauses.frozen,true);assert.equal(pauses.elementalVoices,0);assert.equal(pauses.physicalVoices,0);
 // Identical fixed-step sustained firing; audio enabled, capture disabled while sampling.
 const performance=[];
 for(const test of[{id:'human-rifle',kind:'human',delivery:'bullet',count:2},{id:'armor-rifle',kind:'armored',delivery:'bullet',count:2},{id:'human-sticky',kind:'human',delivery:'sticky',count:2},{id:'armor-sticky',kind:'armored',delivery:'sticky',count:2},{id:'crowded-six-sticky',kind:'human',delivery:'sticky',count:6}]){
  const runs=[];
  for(const [label,after]of[['before',false],['ab',true],['before-repeat',false]]){
   await setup(after,test.kind,test.delivery,test.count);
   const result=await page.evaluate(async({label})=>{const r=window.corrosiveReview;const promise=r.perf.measure(label,360,90);r.setBench(true);const cost=await promise;r.setBench(false);return{cost,snapshot:r.snapshot()};},{label});runs.push({label,...result});
  }
  function normalized(snapshot){return{time:snapshot.time,body:snapshot.body,shots:snapshot.shots,hits:snapshot.hits,targets:snapshot.targets.map(({id,...target})=>target)};}
  assert.deepEqual(normalized(runs[1].snapshot),normalized(runs[0].snapshot),`${test.id}: presentation must preserve complete combat outcomes`);assert.deepEqual(normalized(runs[2].snapshot),normalized(runs[0].snapshot),`${test.id}: repeated baseline must be deterministic`);
  performance.push({...test,runs});await writeFile(join(out,'performance.partial.json'),JSON.stringify({hardware,bundle,performance},null,2));console.log('PERF',test.id,JSON.stringify(runs.map(r=>({label:r.label,frame:r.cost.frameMs,submit:r.cost.submitMs,calls:r.cost.calls,gpu:r.cost.gpuMs}))));
 }
 const result={capturedAt:new Date().toISOString(),url,browser:await browser.version(),hardware,bundle,viewport:[1440,900],dpr:1,protocol:'One compiled build, same target geometry, current sizing/falloff and combat seed, previous rupture -> directional rupture -> repeated previous rupture, 90 warmup + 360 measured displayed frames, one existing 1/60 Game simulation step per frame, normal cadence/heat/reload, sound enabled, no recording during timing.',visuals,skin,ground,other,pauses,performance,errors};
 await writeFile(join(out,'verification.json'),JSON.stringify(result,null,2)+'\n');assert.deepEqual(errors,[]);console.log('PASS',JSON.stringify({visuals:visuals.length,coverage:other.length,matchedPerformance:performance.length,skin:true,ground:true,pause:true,errors}));
}finally{await context?.close();await browser.close();}
