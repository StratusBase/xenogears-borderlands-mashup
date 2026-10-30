import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const out='artifacts/corrosive-ab/signoff', gallery=join(out,'build/review');
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const evidence=await json(join(out,'surfaces.json'));
assert.deepEqual(evidence.errors,[]);
const surfaces=evidence.surfaces;
assert.equal(surfaces.length,8);
for(const kind of ['raised','slope','ceiling','ledge']){
 const onset=surfaces.find(s=>s.case===kind&&s.stage==='onset'),settled=surfaces.find(s=>s.case===kind&&s.stage==='settled');
 assert.ok(onset&&settled);assert.equal(onset.contact.surface,kind==='raised'?'signoff-raised-platform':`signoff-${kind}`);
 assert.equal(onset.visibleSheets,1);assert.ok(onset.minimumSheetClearance>.01);
 assert.equal(onset.snapshot.shots.length,1);assert.equal(onset.snapshot.body.ammo,3);
 assert.equal(onset.snapshot.presentation.soundEnabled,true);assert.equal(onset.snapshot.presentation.qualityAudioUnlocked,true);assert.equal(onset.snapshot.presentation.elementalAudioUnlocked,true);
 assert.equal(settled.residues.length,2);
 for(const position of settled.residues){const distance=position.reduce((sum,v,i)=>sum+(v-settled.contact.point[i])*settled.contact.normal[i],0);assert.ok(Math.abs(distance-.012)<1e-5);}
}
const ledge=surfaces.find(s=>s.case==='ledge'&&s.stage==='settled');
assert.ok(ledge.drops.some(d=>d.position[0]>-.95&&d.position[1]<1.525&&!d.resting),'A real droplet must have fallen beyond the finite edge');
const ceiling=surfaces.find(s=>s.case==='ceiling'&&s.stage==='settled');
assert.ok(ceiling.drops.every(d=>d.position[1]<ceiling.contact.point[1]&&!d.resting));

const performance=[];
const normalize=s=>({time:s.time,body:s.body,shots:s.shots,hits:s.hits,targets:s.targets,contacts:s.contacts});
for(const id of ['crowd-rifle','crowd-sticky','crowd-and-surfaces']){
 const result=(await json(join(out,`${id}.json`))).performance[0];
 assert.equal(result.scene,id);assert.equal(result.combatEqual,true);assert.ok(result.targetsHit>=3);assert.equal(result.protocol.sound,true);assert.equal(result.protocol.recording,false);assert.equal(result.protocol.visibility,'visible');
 assert.equal(result.runs.length,3);
 for(const run of result.runs){
  assert.equal(run.cost.frames,720);assert.deepEqual(run.cost.viewport,[1440,900]);assert.equal(run.cost.dpr,1);
  assert.deepEqual(normalize(run.snapshot),normalize(result.runs[0].snapshot));
  assert.ok(run.peaks.physicalVoices>0&&run.peaks.elementalVoices>0);
  assert.equal(run.snapshot.targets.length,6);assert.ok(run.snapshot.body.reserve<500,'Normal auto-reload must run');
 }
 performance.push(result);
}
const provenance=await json(join(out,'build/provenance.json'));
for(const [path,record] of Object.entries(provenance.sources))assert.equal(hash(await readFile(path)),record.current,`Frozen source drift: ${path}`);
const boundaries={};
for(const path of ['src/game.ts','src/world.ts','src/ui.ts','src/rendering/PlayerBallistics.ts','src/rendering/quality/corrosive/sizing.ts','src/audio/corrosiveAudio.ts']){
 const current=await readFile(path),baseline=execFileSync('git',['show',`83e8ccd:${path}`]);assert.deepEqual(current,baseline);boundaries[path]=hash(current);
}
const bundle=[];for(const name of await readdir(join(out,'build/assets'))){const bytes=await readFile(join(out,'build/assets',name));bundle.push({name,bytes:bytes.length,sha256:hash(bytes)});}
const audio=await json(join(out,'audio-measurements.json'));assert.ok(audio.peak>.05);assert.equal(audio.clippedSamples,0);assert.ok(audio.duration>=7);
const testLog=await readFile(join(out,'tests.log'),'utf8');assert.match(testLog,/pass 655/);assert.match(testLog,/fail 0/);
const metadata=await json(join(out,'browser-metadata.json'));
const result={capturedAt:new Date().toISOString(),metadata,provenance,bundle,boundaries,surfaces,performance,audio,tests:{pass:655,fail:0},productionBuild:true,
 protocol:'Same compiled build, current normal Game and real collision, six stationary raised-health human review targets, seed 37391. Pre-floor-fix 328a175 response -> current 83e8ccd response -> repeated baseline. 120 warmup + 720 measured displayed frames, one existing 1/60 Game step per frame. Normal cadence, heat, auto-reload and statuses. Both actual audio buses unlocked and voiced. Recording disabled during measurement. Separate recording uses native wall-clock timing.',
 limitations:['Controlled real-Game evaluation fixture, not a complete AI encounter or all authored level geometry.','Apple M5 Max / Chrome / 1440x900 DPR 1 only; lower-end, high-DPI and mobile not measured.','Display pacing can hide work; simulation, renderer submission and GPU time are reported separately. Baseline drift prevents attributing small differences solely to this fix.','An initial run with active enemy AI was rejected for nonidentical replay and excluded. Accepted runs use the existing training-target mode.','Chrome recording had an Opus packet-header warning during export. The playable MP4 retains 7.2 seconds of decoded live audio with no normalization or replacement.'],
};
await writeFile(join(out,'verification.json'),JSON.stringify(result,null,2)+'\n');
await mkdir(gallery,{recursive:true});
for(const file of ['verification.json','crowd-live.mp4','crowd-live.wav',...['raised','slope','ceiling','ledge'].flatMap(k=>[`${k}-onset.jpg`,`${k}-settled.jpg`]),'crowd-live.jpg'])await copyFile(join(out,file),join(gallery,file));
const number=x=>x.toFixed(2), phases=['before','current','before-repeat'];
const rows=performance.map(p=>`<tr><th>${p.scene}</th><td>${p.runs.map(r=>number(r.cost.frameMs.median)).join(' / ')}</td><td>${p.runs.map(r=>number(r.cost.frameMs.p95)).join(' / ')}</td><td>${p.runs.map(r=>number(r.simulationMs.median)).join(' / ')}</td><td>${p.runs.map(r=>number(r.cost.submitMs.median)).join(' / ')}</td><td>${p.runs.map(r=>number(r.cost.gpuMs.median)).join(' / ')}</td></tr>`).join('');
await writeFile(join(gallery,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Corrosive · Final gameplay verification</title><style>body{margin:0;background:#101a17;color:#ece9d5;font:15px/1.5 system-ui,sans-serif}main{max-width:1220px;margin:auto;padding:36px 24px}h1{font-size:40px;margin:10px 0}h2{margin-top:35px}.eyebrow{color:#cbe76b;letter-spacing:.12em;font-weight:700;font-size:12px}p{max-width:900px;color:#b9c8b6}a{color:#d2e797}.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}figure{margin:0;background:#1e2c22;padding:12px}figure img{display:block;width:100%;height:auto}figcaption{margin:8px 0;color:#d4e6bb}details img{width:100%}video{width:100%;max-height:690px;background:#000}table{border-collapse:collapse;font-size:12px;width:100%}td,th{padding:10px;border-bottom:1px solid #4d5b42;text-align:left}.scroll{overflow:auto}.badge{display:inline-block;padding:6px 12px;border:1px solid #879f54;color:#d6ed93;margin:5px 6px 5px 0}@media(max-width:700px){.grid{grid-template-columns:1fr}}</style><main><div class="eyebrow">CORROSIVE / FINAL GAMEPLAY VERIFICATION · 30 OCTOBER 2026</div><h1>Surface contact. Crowd pressure. Live sound.</h1><p>Captured from the compiled game using its actual weapons, swept collision, sticky fuse, damage, status and reload systems. These are controlled human review fixtures with raised health, inside the proving ground. Characters stay intact. No painted effects.</p><span class="badge">4 surface cases passed</span><span class="badge">9 matched timing runs</span><span class="badge">655 tests passed</span><span class="badge">Combat outcomes identical</span><h2>Surface edge cases</h2><div class="grid">${[['raised','Raised platform','Residue stays 12 mm above the actual 1.525 m top.'],['slope','Sloped face','Splash and residue follow the actual tilted normal.'],['ceiling','Ceiling / underside','Splash projects down into the room; droplets fall away.'],['ledge','Finite ledge','Droplets pass the edge instead of resting on an infinite plane.']].map(([k,title,text])=>`<figure><img src="${k}-onset.jpg" alt="Actual ${title} sticky impact"><figcaption><strong>${title}</strong> — ${text}</figcaption><details><summary>See settled state at +900 ms</summary><img src="${k}-settled.jpg" alt="${title} settled state"></details></figure>`).join('')}</div><h2>Matched performance with sound</h2><p>Each cell is ${phases.join(' / ')} in milliseconds. Same compiled build, six clothed/armored humans, seed, camera sequence and weapon. 120 warm-up + 720 measured displayed frames per run; one 1/60 Game step per frame. Both audio buses active, capture off.</p><div class="scroll"><table><thead><tr><th>Scene</th><th>Frame median</th><th>Frame p95</th><th>Simulation median</th><th>Draw CPU median</th><th>GPU median</th></tr></thead><tbody>${rows}</tbody></table></div><p>All nine runs preserve full shots, hits, health/status state, ammo, reload outcomes and contact metadata. The rifle struck three front targets; sticky scenes affected all six. Same 8.3 ms frame median; current p95 is 0.1–0.2 ms above the initial baseline. Baseline drift and display pacing limit causal conclusions. Apple M5 Max, Chrome, 1440 × 900, DPR 1; lower-end/mobile/high-DPI are unmeasured.</p><h2>Actual gameplay with recorded sound</h2><video controls preload="metadata" poster="crowd-live.jpg" src="crowd-live.mp4"></video><p>Native wall-clock game timing, final physical + elemental WebAudio buses. No replacement, normalization, slow motion or painted effects. Canvas recording omits the HTML HUD; the stills include it. Decoded sound: ${number(audio.duration)} s, peak ${number(audio.peak)}, RMS ${audio.rms.toFixed(4)}, zero clipped PCM samples. Chrome export emitted an Opus packet warning; the playable MP4 retains the decoded sound.</p><p><a href="verification.json">Full raw measurements, source fingerprints and boundary checks</a> · <a href="/corrosive-signoff.html">Run the compiled verification scene</a> · <a href="/">Normal game</a></p></main></html>`);
console.log(JSON.stringify({surfaces:4,matchedRuns:9,combatIdentical:true,audio:audio.duration,tests:655,report:join(out,'verification.json'),gallery:'http://127.0.0.1:5210/review/'}));
