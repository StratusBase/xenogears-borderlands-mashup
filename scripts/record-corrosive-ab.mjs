import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/steven/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=join(process.cwd(),'artifacts/corrosive-ab');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE??'/Users/steven/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',args:['--use-angle=metal']});
const errors=[],results=[];
const bundle=JSON.parse(await readFile(join(out,'verification.json'),'utf8')).bundle;
async function verifyBuild(page){for(const file of bundle){const response=await page.request.get(new URL('assets/'+file.name,page.url()).href);assert.ok(response.ok());assert.equal(createHash('sha256').update(await response.body()).digest('hex'),file.sha256);}const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name));assert.ok(bundle.every(file=>resources.some(url=>url.endsWith('/'+file.name))),'Recording page must load the measured bundle');}
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(process.env.CORROSIVE_REVIEW_URL??'http://127.0.0.1:5203/corrosive-lab.html');await page.waitForFunction(()=>!!window.corrosiveReview);await page.waitForTimeout(500);
 await verifyBuild(page);
 for(const test of[{kind:'human',after:false,delivery:'sticky'},{kind:'human',after:true,delivery:'sticky'},{kind:'armored',after:false,delivery:'sticky'},{kind:'armored',after:true,delivery:'sticky'},{kind:'human',after:true,delivery:'bullet'},{kind:'armored',after:true,delivery:'bullet'}]){
  const name=`${test.kind}-${test.after?'ab':'before'}-${test.delivery}`;
  await page.evaluate(({after,kind,delivery})=>{const r=window.corrosiveReview;r.setVersion(after);r.fixture(kind,delivery);r.clean(false);},test);
  await page.getByRole('button',{name:/Enable sound|Sound enabled/}).click();
  await page.waitForFunction(()=>window.corrosiveReview.g.presentation.diagnostics.qualityAudioUnlocked&&window.corrosiveReview.g.presentation.diagnostics.elementalAudioUnlocked);
  await page.evaluate(()=>{const r=window.corrosiveReview;r.clean();r.play();});
  const recording=await page.evaluate(()=>window.corrosiveReview.startRecording());assert.equal(recording.audioTracks,1);assert.equal(recording.videoTracks,1);
  const start=Date.now();await page.waitForTimeout(500);
  const input=fire=>page.evaluate(fire=>{const r=window.corrosiveReview;r.game.driveEvaluation({fire,yaw:r.g.yaw,pitch:r.g.pitch});},fire);
  await input(true);await page.waitForTimeout(test.delivery==='bullet'?1300:90);await input(false);await page.waitForTimeout(test.delivery==='bullet'?900:2110);
  await input(true);await page.waitForTimeout(test.delivery==='bullet'?1300:90);await input(false);await page.waitForTimeout(test.delivery==='bullet'?2000:2700);
  const snapshot=await page.evaluate(()=>window.corrosiveReview.snapshot());const encoded=await page.evaluate(()=>window.corrosiveReview.stopRecording());
  const bytes=Buffer.from(encoded,'base64');assert.ok(bytes.length>10000,'Recorded clip must contain media, not a MIME fragment');assert.equal(bytes.subarray(0,4).toString('hex'),'1a45dfa3','Valid WebM EBML header');await writeFile(join(out,name+'.webm'),bytes);assert.ok(snapshot.hits.length>1);assert.equal(snapshot.presentation.audioError,null);
  results.push({...test,file:name+'.webm',wallTimeMs:Date.now()-start,recording,simulationSeconds:snapshot.time-20.004166666666666,shots:snapshot.shots.length,hits:snapshot.hits.length,final:snapshot});console.log('RECORDED',name,JSON.stringify(results.at(-1)));
 }
 await verifyBuild(page);assert.deepEqual(errors,[]);await writeFile(join(out,'recordings.json'),JSON.stringify({capturedAt:new Date().toISOString(),bundle,compiledAssetsVerifiedBeforeAndAfter:true,provenance:'Unmodified WebGL canvas captureStream(60), mixed capture taps on the actual physical and elemental final WebAudio buses. Native Game.run clock, normal scripted trigger inputs, no slow motion, rendered image edits, offline sound replacement, added VFX or simulation retiming. Review target vitals are raised to survive repeated shots; this is an isolated Game harness, not the normal main encounter.',results,errors},null,2)+'\n');
}finally{await browser.close();}
