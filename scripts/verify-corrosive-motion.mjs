import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/steven/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE??'/Users/steven/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',args:['--use-angle=metal']});
const base='artifacts/corrosive-ab/',results=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(process.env.CORROSIVE_REVIEW_URL??'http://127.0.0.1:5203/corrosive-lab.html');await page.waitForFunction(()=>!!window.corrosiveReview);
 for(const kind of['human','armored'])for(const motion of['previous','directional']){
  await page.evaluate(({kind,motion})=>{const r=window.corrosiveReview;r.setMotion(motion);r.fixture(kind,'sticky');r.clean();r.fireOne();for(let i=0;i<360;i++){r.step(1/120);if(r.layer.corrosive.events.some(e=>e.phase==='detonate'))return;}throw Error('Expected actual sticky detonation');},{kind,motion});
  const onset=await page.evaluate(()=>window.corrosiveReview.g.time),frames=[];
  for(const [name,at]of[['onset',.025],['stretch',.10],['curl',.20],['breakup',.33],['settled',.65]]){
   const state=await page.evaluate(({onset,at})=>{const r=window.corrosiveReview;while(r.g.time<onset+at-1/240)r.step(1/240);const burst=r.layer.corrosive.group.children.find(o=>o.name==='corrosive-ab-crown'&&o.visible);return{at:r.g.time-onset,geometry:burst?Array.from(burst.geometry.attributes.position.array):[],events:r.layer.corrosive.events,snapshot:r.snapshot()};},{onset,at});
   await page.waitForTimeout(35);const file=`${kind}-${motion}-${name}.png`;await page.screenshot({path:base+file});frames.push({name,file,...state});
  }
  results.push({kind,motion,frames});
 }
 for(const kind of['human','armored']){
  const previous=results.find(r=>r.kind===kind&&r.motion==='previous'),after=results.find(r=>r.kind===kind&&r.motion==='directional');
  assert.deepEqual(after.frames.map(f=>f.events),previous.frames.map(f=>f.events),'Sizing, counts, surface contacts and actual exposure must match exactly');
  const normalize=s=>({...s,diagnostics:undefined,presentation:undefined,targets:s.targets.map(({id,...t})=>t)});
  assert.deepEqual(after.frames.map(f=>normalize(f.snapshot)),previous.frames.map(f=>normalize(f.snapshot)),'Visual motion must preserve full gameplay outcomes');
  assert.notDeepEqual(after.frames[0].geometry,after.frames[1].geometry,'Liquid must deform between onset and stretch');assert.notDeepEqual(after.frames[1].geometry,after.frames[2].geometry,'Liquid must keep deforming through curl');
  assert.ok(after.frames.flatMap(f=>f.geometry).every(Number.isFinite));
 }
 assert.deepEqual(errors,[]);await writeFile(base+'motion-review.json',JSON.stringify({capturedAt:new Date().toISOString(),protocol:'Actual Game, same compiled build, exact sticky fuse/damage/status pipeline. Screenshots step the real simulation to matching times. Deformed geometry, event sizing and complete gameplay states compared between previous and directional modes.',results,errors},null,2)+'\n');console.log('PASS fluid motion / exact retained size, falloff and gameplay',results.length);
}finally{await browser.close();}
