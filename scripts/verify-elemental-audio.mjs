/** Render original elemental overlays, separate from the physical weapon report, in the real browser audio graph. */
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=join(root,'artifacts/elemental/audio');
await mkdir(out,{recursive:true});
const{chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const launch={headless:true};if(process.env.CHROME_EXECUTABLE)launch.executablePath=process.env.CHROME_EXECUTABLE;
const browser=await chromium.launch(launch),page=await browser.newPage();const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const base=process.env.ELEMENTAL_AUDIO_REVIEW_URL??'http://127.0.0.1:5197';
const source=await readFile(join(root,'src/audio/elementalAudio.ts'));
const elements=['kinetic','fire','ice','corrosive','gravity','adhesive','radiation','shock'];
const deliveries={kinetic:'bullet',fire:'rocket',ice:'beam',corrosive:'slug',gravity:'orb',adhesive:'sticky',radiation:'scatter',shock:'arc'};
try{
 await page.route('**/__elemental_audio_review__',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><title>Elemental audio verification</title><button id="unlock">Enable original elemental sound</button>'}));
 await page.goto(`${base}/__elemental_audio_review__`);
 await page.evaluate(async()=>{
  const module=await import('/src/audio/elementalAudio.ts');window.elementalAudioModule=module;window.elementalAudioReview=new module.ElementalAudio();
  document.querySelector('#unlock').addEventListener('click',()=>{void window.elementalAudioReview.unlock();});
 });
 const locked=await page.evaluate(()=>({unlocked:window.elementalAudioReview.unlocked,voices:window.elementalAudioReview.activeVoiceCount}));assert.equal(locked.unlocked,false);assert.equal(locked.voices,0);
 await page.click('#unlock');await page.waitForFunction(()=>window.elementalAudioReview.unlocked);
 const live=await page.evaluate(elements=>{
  const audio=window.elementalAudioReview;
  for(const element of elements){audio.equipment(element,true,{distance:1});audio.status(element,true,{distance:5});}
  for(let i=0;i<50;i++){audio.shot(elements[i%8],{delivery:'rocket',mode:'mech'});audio.impact(elements[i%8],{distance:4});}
  audio.update(.016);return{unlocked:audio.unlocked,voices:audio.activeVoiceCount,loops:audio.activeLoopCount};
 },elements);
 assert.equal(live.unlocked,true);assert.ok(live.voices>0&&live.voices<=32);assert.equal(live.loops,14);
 const lifecycle=await page.evaluate(elements=>{
  const audio=window.elementalAudioReview;audio.pause();const pause=audio.activeVoiceCount;audio.update(0);const frozen=audio.activeVoiceCount;
  audio.update(.25);audio.update(.25);const resumed=audio.activeVoiceCount;
  audio.setEnabled(false);const muted=audio.activeVoiceCount;audio.update(.25);const mutedUpdate=audio.activeVoiceCount;
  audio.setEnabled(true);audio.update(.25);const unmuted=audio.activeVoiceCount;audio.pause();
  for(const element of elements){audio.equipment(element,false);audio.status(element,false);}const loops=audio.activeLoopCount;
  return{pause,frozen,resumed,muted,mutedUpdate,unmuted,loops};
 },elements);
 assert.equal(lifecycle.pause,0);assert.equal(lifecycle.frozen,0);assert.ok(lifecycle.resumed>0);assert.equal(lifecycle.muted,0);assert.equal(lifecycle.mutedUpdate,0);assert.ok(lifecycle.unmuted>0);assert.equal(lifecycle.loops,0);
 const results=[];
 for(const element of elements){
  const delivery=deliveries[element];
  const events=[{at:.15,event:'equipment'},{at:.65,event:'equipment'},{at:1.15,event:'shot'},{at:1.5,event:'flight'},{at:2.1,event:'impact'},...Array.from({length:6},(_,i)=>({at:3.2+i*.42,event:'status'})),{at:6.1,event:'release'}].map(event=>({...event,element,options:{delivery,mode:'pilot',strength:1,distance:0}}));
  const rendered=await page.evaluate(async events=>{
   const buffer=await window.elementalAudioModule.renderElementalAudioPreview(events,8);
   return{rate:buffer.sampleRate,samples:Array.from(buffer.getChannelData(0))};
  },events);
  const wav=Buffer.alloc(44+rendered.samples.length*2);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rendered.rate,24);wav.writeUInt32LE(rendered.rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
  let peak=0,sum=0,clips=0,nonSilent=0,crossings=0,previous=0;
  rendered.samples.forEach((sample,index)=>{peak=Math.max(peak,Math.abs(sample));sum+=sample*sample;if(Math.abs(sample)>=.999)clips++;if(Math.abs(sample)>.0005)nonSilent++;if(previous*sample<0)crossings++;previous=sample;wav.writeInt16LE(Math.round(Math.min(1,Math.max(-1,sample))*32767),44+index*2);});
  assert.ok(peak>.01&&peak<.33,`${element}: audible, finite output with physical-report headroom`);assert.equal(clips,0);assert.ok(nonSilent>100);
  const record={element,delivery,file:`${element}.wav`,label:'Elemental overlays only; physical weapon report is supplied separately by QualityAudio',duration:rendered.samples.length/rendered.rate,sampleRate:rendered.rate,peak,rms:Math.sqrt(sum/rendered.samples.length),clippedSamples:clips,nonSilentSamples:nonSilent,zeroCrossings:crossings,sha256:createHash('sha256').update(wav).digest('hex'),events};
  await writeFile(join(out,record.file),wav);results.push(record);
 }
 assert.equal(new Set(results.map(result=>result.sha256)).size,8,'All eight rendered signatures differ');
 const disposed=await page.evaluate(()=>{const audio=window.elementalAudioReview;audio.dispose();return{unlocked:audio.unlocked,voices:audio.activeVoiceCount,loops:audio.activeLoopCount};});assert.deepEqual(disposed,{unlocked:false,voices:0,loops:0});assert.deepEqual(errors,[]);
 const report={capturedAt:new Date().toISOString(),source:'src/audio/elementalAudio.ts',sourceSha256:createHash('sha256').update(source).digest('hex'),browser:await browser.version(),locked,live,lifecycle,disposed,results,errors};
 await writeFile(join(out,'audio-validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({live,lifecycle,disposed,results:results.map(({element,peak,rms,clippedSamples})=>({element,peak,rms,clippedSamples})),errors},null,2));
}finally{await browser.close();}
