/** Run after building/serving vite.quality.config.ts. Uses one browser and one compiled bundle. */
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=join(root,'artifacts/quality');await mkdir(out,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const options={headless:true,args:process.platform==='darwin'?['--use-angle=metal']:[]};
if(process.env.CHROME_EXECUTABLE)options.executablePath=process.env.CHROME_EXECUTABLE;
const browser=await chromium.launch(options);
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('404'))errors.push(message.text());});
try{
 await page.goto(process.env.QUALITY_REVIEW_URL??'http://127.0.0.1:5198/quality-lab.html');
 await page.waitForFunction(()=>window.qualityReview,{timeout:30000});await page.waitForTimeout(3000);
 const hardware=await page.evaluate(()=>{const gl=window.qualityReview.game.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR),version:gl.getParameter(gl.VERSION),timer:!!gl.getExtension('EXT_disjoint_timer_query_webgl2')};});
 const bundle=[];for(const file of (await readdir(join(root,'dist-quality/assets'))).filter(file=>file.endsWith('.js')).sort())bundle.push({file,sha256:createHash('sha256').update(await readFile(join(root,'dist-quality/assets',file))).digest('hex')});
 await page.evaluate(()=>{window.qualityReview.hidePanel();window.qualityReview.setFrozen(true);});
 for(const enabled of [false,true]){
  await page.evaluate(value=>window.qualityReview.setEnabled(value),enabled);
  for(const view of ['field','mech','enemy','weapon','cockpit']){
   await page.evaluate(value=>window.qualityReview.setView(value),view);await page.waitForTimeout(300);
   await page.screenshot({path:join(out,`${enabled?'reference':'original'}-${view}.png`)});
  }
 }
 await page.evaluate(()=>{window.qualityReview.setView('field');window.qualityReview.setEnabled(true);});
 const performance=await page.evaluate(()=>window.qualityReview.measurePair());
 assert.equal(performance.build,'local-production');assert.equal(performance.baseline.frames,180);assert.equal(performance.reference.frames,180);
 await writeFile(join(out,'performance.json'),JSON.stringify({capturedAt:new Date().toISOString(),hardware,bundle,...performance},null,2)+'\n');
 console.log('PERFORMANCE',JSON.stringify({hardware,baseline:performance.baseline,reference:performance.reference,repeat:performance.baselineRepeat}));
 // Real DOM input, mouse capture, combat shots and staged reload in the actual game.
 await page.evaluate(()=>{const q=window.qualityReview;q.showPanel();q.setEnabled(true);q.setFrozen(false);q.setView('enemy');q.resetAmmo();});
 await page.click('#quality-sound');await page.click('#quality-play');
 await page.waitForFunction(()=>document.pointerLockElement!==null);
 await page.evaluate(()=>window.qualityReview.hidePanel());
 await page.mouse.down();await page.waitForTimeout(60);
 const fired=await page.evaluate(()=>{const q=window.qualityReview;return {ammo:q.game.bodies.pilot.ammo,at:q.game.lastFiredAt,particles:q.presentation.feedback.activeParticleCount,voices:q.presentation.audio.activeVoiceCount,audioUnlocked:q.presentation.audio.unlocked};});
 await page.screenshot({path:join(out,'reference-firing.png')});await page.mouse.up();await page.waitForTimeout(150);
 const hits=await page.evaluate(()=>window.qualityReview.history.slice());
 assert.ok(fired.ammo<30,'mouse input must fire a real shot');assert.ok(fired.particles>0);assert.ok(fired.voices>0);assert.ok(fired.audioUnlocked);assert.ok(hits.length>0,'real ballistic impact must hit the sentry');
 await page.keyboard.press('KeyR');await page.waitForTimeout(500);
 const reload=await page.evaluate(()=>{const q=window.qualityReview,g=q.game;return {active:g.reloadUntil>g.time,progress:(g.time-g.reloadStartedAt)/1.5,magazine:g.pilotRig.magazine.position.toArray(),home:g.pilotRig.magazineHome.toArray()};});
 await page.screenshot({path:join(out,'reference-reload.png')});assert.ok(reload.active);assert.notDeepEqual(reload.magazine,reload.home);
 await page.waitForTimeout(1500);
 const pilotStart=await page.evaluate(()=>window.qualityReview.game.camera.position.toArray());
 await page.keyboard.down('KeyD');await page.waitForTimeout(500);await page.keyboard.up('KeyD');
 const pilotMove=await page.evaluate(()=>{const q=window.qualityReview;return {position:q.game.camera.position.toArray(),particles:q.presentation.feedback.activeParticleCount};});
 assert.ok(Math.hypot(pilotMove.position[0]-pilotStart[0],pilotMove.position[2]-pilotStart[2])>1,'pilot must move through real controls');
 // Exercise construction-specific payloads through the real equipment refresh and shots.
 for(const [element,projectile] of [['fire','bullet'],['ice','beam'],['corrosive','sticky'],['shock','arc']]){
  await page.evaluate(([element,projectile])=>{const q=window.qualityReview;q.setView('enemy');q.setPayload(element,projectile);q.resetAmmo();q.game.ballistics.clear();const e=q.game.enemies[0];for(const key of Object.keys(e.statuses))delete e.statuses[key];for(const x of e.statusEffects.values())x.dispose();e.statusEffects.clear();for(const x of e.statusCoatings.values())x.dispose();e.statusCoatings.clear();},[element,projectile]);
  await page.waitForTimeout(250);await page.mouse.down();await page.waitForTimeout(180);await page.mouse.up();
  await page.screenshot({path:join(out,`reference-${element}-${projectile}.png`)});
 }
 await page.evaluate(()=>{const q=window.qualityReview;q.setPayload('kinetic','bullet');q.game.ballistics.clear();const e=q.game.enemies[0];for(const key of Object.keys(e.statuses))delete e.statuses[key];for(const x of e.statusEffects.values())x.dispose();e.statusEffects.clear();for(const x of e.statusCoatings.values())x.dispose();e.statusCoatings.clear();q.game.trainingTargets=false;});
 const enemyBefore=await page.evaluate(()=>window.qualityReview.game.enemies[0].mesh.position.toArray());
 await page.waitForTimeout(700);
 const enemyMotion=await page.evaluate(()=>{const q=window.qualityReview,enemy=q.game.enemies[0];return {position:enemy.mesh.position.toArray(),phase:enemy.mesh.userData.animationPhase,leg:enemy.mesh.getObjectByName('sentry-left-leg').position.toArray()};});
 assert.ok(Math.hypot(enemyMotion.position[0]-enemyBefore[0],enemyMotion.position[2]-enemyBefore[2])>.05,'sentry must animate during real navigation');
 await page.screenshot({path:join(out,'reference-enemy-moving.png')});await page.evaluate(()=>{window.qualityReview.game.trainingTargets=true;});
 await page.keyboard.press('Escape');await page.waitForTimeout(80);
 await page.evaluate(()=>{window.qualityReview.setView('mech');window.qualityReview.setFrozen(false);});
 await page.keyboard.press('KeyF');await page.waitForTimeout(100);
 const mounted=await page.evaluate(()=>window.qualityReview.game.mode);assert.equal(mounted,'mech','F must mount actual mech');
 await page.evaluate(()=>{window.qualityReview.resetAmmo();window.qualityReview.showPanel();});await page.click('#quality-play');
 await page.waitForFunction(()=>document.pointerLockElement!==null);await page.evaluate(()=>window.qualityReview.hidePanel());
 const mechStart=await page.evaluate(()=>window.qualityReview.game.camera.position.toArray());
 await page.keyboard.down('KeyW');await page.waitForTimeout(650);await page.keyboard.up('KeyW');
 const mechMove=await page.evaluate(()=>{const q=window.qualityReview;return {position:q.game.camera.position.toArray(),particles:q.presentation.feedback.activeParticleCount,voices:q.presentation.audio.activeVoiceCount};});
 assert.ok(Math.hypot(mechMove.position[0]-mechStart[0],mechMove.position[2]-mechStart[2])>1);
 await page.mouse.down();await page.waitForTimeout(60);await page.screenshot({path:join(out,'reference-mech-firing.png')});await page.mouse.up();
 await page.keyboard.press('KeyR');await page.waitForTimeout(650);await page.screenshot({path:join(out,'reference-mech-reload.png')});await page.waitForTimeout(2000);
 await page.keyboard.press('Escape');await page.waitForTimeout(80);
 const paused=await page.evaluate(()=>{const q=window.qualityReview;return {voices:q.presentation.audio.activeVoiceCount,particles:q.presentation.feedback.activeParticleCount};});assert.equal(paused.voices,0);
 // Offline audition renders the exact live recipes/compressor, exported as PCM WAV.
 const audition=await page.evaluate(async()=>{
  const q=window.qualityReview;const buffer=await q.renderAudioPreview([
   {at:.25,event:'fire',options:{mode:'pilot'}},{at:.8,event:'reload-out',options:{mode:'pilot'}},{at:1.3,event:'reload-in',options:{mode:'pilot'}},{at:1.6,event:'reload-bolt',options:{mode:'pilot'}},{at:2.1,event:'step',options:{mode:'pilot'}},
   {at:2.7,event:'fire',options:{mode:'mech'}},{at:3.5,event:'reload-out',options:{mode:'mech'}},{at:4.1,event:'reload-in',options:{mode:'mech'}},{at:4.5,event:'reload-bolt',options:{mode:'mech'}},{at:5.1,event:'step',options:{mode:'mech'}},
   {at:5.65,event:'impact-metal'},{at:6.1,event:'impact-shield'},{at:6.6,event:'impact-dust'}],7.2);
  const samples=Array.from(buffer.getChannelData(0));return {rate:buffer.sampleRate,samples};
 });
 let peak=0,sum=0;const wav=Buffer.alloc(44+audition.samples.length*2);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(audition.rate,24);wav.writeUInt32LE(audition.rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
 audition.samples.forEach((sample,index)=>{peak=Math.max(peak,Math.abs(sample));sum+=sample*sample;wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,sample))*32767),44+index*2);});
 assert.ok(peak>.01&&peak<1,'audition must have non-silent, unclipped output');await writeFile(join(out,'reference-audio.wav'),wav);
 // Bounded renderer toggles after gameplay must restore original factories cleanly.
 await page.evaluate(()=>{const q=window.qualityReview;q.setFrozen(true);for(let i=0;i<4;i++){q.setEnabled(false);q.setEnabled(true);}q.setView('field');});
 await page.waitForTimeout(300);
 const restored=await page.evaluate(()=>{const q=window.qualityReview;return {sentries:q.game.scene.getObjectsByProperty('name','reference-sentry').length,mechs:q.game.scene.getObjectsByProperty('name','reference-mech-body').length};});
 assert.equal(restored.mechs,1);assert.equal(errors.length,0,errors.join('\n'));
 const validation={build:bundle,hardware,fired,hits,reload,pilotMove,mechMove,enemyMotion,mounted,paused,restored,audio:{duration:audition.samples.length/audition.rate,rate:audition.rate,peak,rms:Math.sqrt(sum/audition.samples.length)},errors};
 await writeFile(join(out,'gameplay-validation.json'),JSON.stringify(validation,null,2)+'\n');console.log('VALIDATION',JSON.stringify({...validation,build:undefined}));
}finally{await browser.close();}
