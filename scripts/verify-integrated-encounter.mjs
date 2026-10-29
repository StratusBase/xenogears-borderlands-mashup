/** Full real-Game integration loop: scripted route, actual loot pickup, DOM inventory equip, then combat again. */
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=join(root,'artifacts/integrated');await mkdir(out,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const options={headless:true,args:process.platform==='darwin'?['--use-angle=metal']:[]};if(process.env.CHROME_EXECUTABLE)options.executablePath=process.env.CHROME_EXECUTABLE;
const browser=await chromium.launch(options);
const base=process.env.INTEGRATED_ENCOUNTER_URL??'http://127.0.0.1:5198/integrated-encounter-lab.html';
const build=process.env.INTEGRATED_BUILD??'mobile-precision',seed=Number(process.env.INTEGRATED_SEED??7);
const bundle=[];try{for(const file of(await readdir(join(root,'dist-quality/assets'))).filter(file=>file.endsWith('.js')).sort())bundle.push({file,sha256:createHash('sha256').update(await readFile(join(root,'dist-quality/assets',file))).digest('hex')});}catch{/* Development URL runs still retain URL/source protocol and full traces. */}
const errors=[];
async function fresh(legacy=false){const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('404'))errors.push(message.text());});const url=new URL(base);url.searchParams.set('build',build);url.searchParams.set('seed',String(seed));if(legacy)url.searchParams.set('presentation','legacy');await page.goto(url.href);await page.waitForFunction(()=>window.integratedEncounter,{timeout:30000});return page;}
async function settle(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function capture(page,label){await settle(page);await page.screenshot({path:join(out,`encounter-${label}.png`)});}
async function begin(page){await page.evaluate(()=>window.integratedEncounter.showPanel());await page.getByRole('button',{name:/Begin full encounter|Start next encounter/}).click();await page.evaluate(()=>window.integratedEncounter.hidePanel());await settle(page);return page.evaluate(()=>window.integratedEncounter.read());}
function metric(events){return events.reduce((total,event)=>{if(event.type==='shot'){total.shots[event.mode]++;total.ammo[event.mode]+=event.ammo;}if(event.type==='damage'&&event.target==='enemy'){total.damage[event.source]+=event.health+event.shield;total.health+=event.health;total.shield+=event.shield;}if(event.type==='received'){total.receivedHealth+=event.health;total.receivedShield+=event.shield;}if(event.type==='target-killed')total.kills++;if(event.type==='interval'){if(event.heatBlocked)total.heatBlocked+=event.dt;if(event.reloading)total.reload+=event.dt;}return total;},{shots:{pilot:0,mech:0},ammo:{pilot:0,mech:0},damage:{direct:0,status:0,ability:0},health:0,shield:0,receivedHealth:0,receivedShield:0,kills:0,heatBlocked:0,reload:0});}
async function run(page,prefix,{stopAfterMechShot=false,screenshots=true}={}){
 const wallClockStarted=Date.now();let state=await begin(page),chunks=0,lastLogged='';const captured=new Set();
 if(screenshots)await capture(page,`${prefix}-start`);
 while(state.active&&chunks++<6000){
  state=await page.evaluate(()=>{const result=window.integratedEncounter.stepChunk(60);return{...result,snapshot:{...result.snapshot,navigation:undefined,progression:undefined}};});
  if(state.snapshot.phase!==lastLogged){lastLogged=state.snapshot.phase;console.log('PHASE',prefix,lastLogged,state.snapshot.elapsed.toFixed(2),state.snapshot.mode);}
  for(const milestone of state.milestones){
   if(screenshots&&!captured.has(milestone)){captured.add(milestone);await capture(page,`${prefix}-${milestone}`);}
   if(stopAfterMechShot&&milestone==='first-mech-shot'){await page.evaluate(()=>window.integratedEncounter.game.driveEvaluation({}));return{...state,stoppedAtMechShot:true,capturedMilestones:[...captured],wallClockMs:Date.now()-wallClockStarted};}
  }
  const boss=state.snapshot.enemies.find(enemy=>enemy.boss);if(screenshots&&boss&&state.snapshot.phase==='boss'&&state.reason.startsWith(`Engage heavy ${boss.id} `)&&!captured.has('boss-engaged')){captured.add('boss-engaged');await capture(page,`${prefix}-boss-engaged`);}
  // Give the real renderer/presentation a frame between deterministic input batches.
  await settle(page);
 }
 assert.ok(chunks<6000,`${prefix} exceeded bounded runner chunks`);
 return{...state,capturedMilestones:[...captured],wallClockMs:Date.now()-wallClockStarted};
}
try{
 const page=await fresh(false);const defaultMode=await page.evaluate(()=>window.integratedEncounter.read().presentation.mode);assert.equal(defaultMode,'quality','omitted presentation option must select quality by default');
 const first=await run(page,'quality');const firstEvidence=await page.evaluate(()=>window.integratedEncounter.exportEvidence());await writeFile(join(out,'encounter-quality-first.json'),JSON.stringify({capturedAt:new Date().toISOString(),bundle,...firstEvidence},null,2)+'\n');
 assert.equal(first.outcome,'complete',`quality run ended ${first.outcome}: ${first.reason}`);assert.equal(first.snapshot.phase,'complete');assert.equal(first.snapshot.enemies.length,0);assert.equal(first.snapshot.disabledRelays.length,2);
 for(const milestone of['first-pilot-shot','form-mech','boss-visible','first-boss-shot','phase-complete'])assert.ok(first.capturedMilestones.includes(milestone),`missing actual gameplay screenshot for ${milestone}`);
 assert.equal(firstEvidence.presentation.diagnostics.soundEnabled,true,'normal sound setting must remain enabled');assert.equal(firstEvidence.presentation.diagnostics.qualityAudioUnlocked,true,'physical feedback audio must unlock through the start gesture');assert.equal(firstEvidence.presentation.diagnostics.elementalAudioUnlocked,true,'elemental audio must unlock through the start gesture');assert.equal(firstEvidence.presentation.diagnostics.audioError,null,'audio initialization must succeed');
 const beforeEquip=await page.evaluate(()=>window.integratedEncounter.exportEvidence());const reward=beforeEquip.current.progression.inventory.find(item=>item.name==='Salvaged Vent Reactor');assert.ok(reward,'actual reward pickup must place the reactor in inventory');
 await page.keyboard.press('KeyI');await page.waitForSelector('.item-row');await page.locator('.item-row').filter({hasText:'Salvaged Vent Reactor'}).click();await capture(page,'reward-selected');
 const equipButton=page.locator('.card-actions .primary-button').filter({hasText:/^EQUIP/});assert.equal(await equipButton.isEnabled(),true);await equipButton.click();await capture(page,'reward-equipped');
 const afterEquip=await page.evaluate(()=>window.integratedEncounter.exportEvidence());assert.equal(afterEquip.current.progression.loadouts.mech.reactor,reward.id);
 for(const mode of['pilot','mech'])for(const slot of['weapon','shield','reactor','legs'])if(!(mode==='mech'&&slot==='reactor'))assert.equal(afterEquip.current.progression.loadouts[mode][slot],beforeEquip.current.progression.loadouts[mode][slot],`${mode}/${slot} must stay isolated`);
 assert.ok(afterEquip.currentStats.mech.cooling>beforeEquip.currentStats.mech.cooling||afterEquip.currentStats.mech.heatCapacity>beforeEquip.currentStats.mech.heatCapacity,'reward should improve a normal derived mech statistic');
 await page.keyboard.press('KeyI');await settle(page);if(await page.evaluate(()=>document.pointerLockElement!==null))await page.keyboard.press('Escape');
 const second=await run(page,'upgraded-second',{stopAfterMechShot:true});assert.equal(second.stoppedAtMechShot,true,'upgraded loadout must reach actual mech firing in the next encounter');
 const fullEvidence=await page.evaluate(()=>window.integratedEncounter.exportEvidence());assert.equal(fullEvidence.current.progression.loadouts.mech.reactor,reward.id);assert.equal(fullEvidence.runs.length,2);assert.equal(fullEvidence.current.run,2);
 await writeFile(join(out,'encounter-quality-loop.json'),JSON.stringify({capturedAt:new Date().toISOString(),bundle,beforeEquip:{loadouts:beforeEquip.current.progression.loadouts,stats:beforeEquip.currentStats},afterEquip:{loadouts:afterEquip.current.progression.loadouts,stats:afterEquip.currentStats},reward,secondRunCheck:second,...fullEvidence},null,2)+'\n');
 await page.close();
 const legacy=await fresh(true);assert.equal(await legacy.evaluate(()=>window.integratedEncounter.read().presentation.mode),'legacy');const legacyState=await run(legacy,'legacy',{screenshots:false});const legacyEvidence=await legacy.evaluate(()=>window.integratedEncounter.exportEvidence());await writeFile(join(out,'encounter-legacy-first.json'),JSON.stringify({capturedAt:new Date().toISOString(),bundle,...legacyEvidence},null,2)+'\n');assert.equal(legacyState.outcome,'complete',`legacy run ended ${legacyState.outcome}`);await legacy.close();
 const qualityMetrics=metric(firstEvidence.measurements),legacyMetrics=metric(legacyEvidence.measurements);
 const trajectoryParity={qualityCount:firstEvidence.trajectories.length,legacyCount:legacyEvidence.trajectories.length,exact:JSON.stringify(firstEvidence.trajectories)===JSON.stringify(legacyEvidence.trajectories)};
 assert.equal(trajectoryParity.qualityCount,qualityMetrics.shots.pilot+qualityMetrics.shots.mech,'every quality shot must have an exported trajectory');assert.equal(trajectoryParity.legacyCount,legacyMetrics.shots.pilot+legacyMetrics.shots.mech,'every legacy shot must have an exported trajectory');assert.ok(trajectoryParity.qualityCount>0,'trajectory equality must compare actual fired shots');
 const summary={protocol:'integrated-encounter-loop-v1',capturedAt:new Date().toISOString(),bundle,build,seed,encounterVersion:firstEvidence.encounterVersion,inputProvenance:firstEvidence.inputProvenance,hardwareStatus:'NOT RUN',timing:'duration is actual Game simulation seconds driven at 60 Hz; wallClockMs is accelerated verification runtime including screenshot waits, not a frame-rate benchmark',quality:{outcome:first.outcome,duration:first.snapshot.elapsed,wallClockMs:first.wallClockMs,kills:first.snapshot.kills,metrics:qualityMetrics,presentation:firstEvidence.presentation},legacy:{outcome:legacyState.outcome,duration:legacyState.snapshot.elapsed,wallClockMs:legacyState.wallClockMs,kills:legacyState.snapshot.kills,metrics:legacyMetrics,presentation:legacyEvidence.presentation},upgrade:{item:reward,isolated:true,before:beforeEquip.currentStats.mech,after:afterEquip.currentStats.mech,secondEncounterMechShot:true},differences:{duration:first.snapshot.elapsed-legacyState.snapshot.elapsed,metricsEqual:JSON.stringify(qualityMetrics)===JSON.stringify(legacyMetrics),measurementsEqual:JSON.stringify(firstEvidence.measurements)===JSON.stringify(legacyEvidence.measurements),trajectoryParity},errors};
 await writeFile(join(out,'encounter-summary.json'),JSON.stringify(summary,null,2)+'\n');assert.equal(errors.length,0,errors.join('\n'));assert.equal(trajectoryParity.exact,true,'quality and legacy must preserve every shot origin, direction, aim point and specification');assert.equal(summary.differences.measurementsEqual,true,'quality and legacy must preserve every applied damage, kill, ammunition, heat and reload event');console.log('PASS',JSON.stringify({qualitySeconds:summary.quality.duration,legacySeconds:summary.legacy.duration,metricsEqual:summary.differences.metricsEqual,trajectoryParity,kills:summary.quality.kills,secondEncounterMechShot:true,errors}));
}finally{await browser.close();}
