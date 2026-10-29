/** Preserve old comparison tools on the production simulation-clock contract. */
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const options={headless:true,args:process.platform==='darwin'?['--use-angle=metal']:[]};if(process.env.CHROME_EXECUTABLE)options.executablePath=process.env.CHROME_EXECUTABLE;
const browser=await chromium.launch(options),errors=[],results=[];
try{
 for(const lab of ['quality-lab.html','elemental-lab.html']){
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL(lab,process.env.INTEGRATED_LAB_BASE??'http://127.0.0.1:5198/').href);await page.waitForFunction(()=>window.qualityReview);
  for(const mode of ['pilot','mech']){
   const arms=[];
   for(const enabled of [false,true,false]){
    await page.evaluate(({enabled,mode})=>{const q=window.qualityReview;q.setEnabled(enabled);q.setElementalEnabled(enabled);q.resetElementalFixture('fire','bullet','rifle',mode,'ironvale');q.hidePanel();}, {enabled,mode});
    const state=await page.evaluate(async()=>{
     const q=window.qualityReview,g=q.game;
     g.driveEvaluation({fire:false,yaw:g.yaw,pitch:g.pitch});g.stepEvaluation(.1);
     g.scene.updateMatrixWorld(true);const rig=g.mode==='pilot'?g.pilotRig:g.mechRig,muzzles=rig.muzzles.map(m=>m.matrixWorld.toArray());
     g.driveEvaluation({fire:true,yaw:g.yaw,pitch:g.pitch});g.stepEvaluation(1/60);g.driveEvaluation({fire:false,yaw:g.yaw,pitch:g.pitch});
     for(let i=0;i<36;i++){g.stepEvaluation(1/60);await new Promise(requestAnimationFrame);}
     return{body:{...g.bodies[g.mode]},time:g.time,muzzles,hits:q.history.map(({targetId,...hit})=>hit),statuses:Object.keys(g.enemies[0].statuses)};
    });
    assert.ok(state.hits.length>0,`${lab}/${mode} must cause an actual hit`);assert.ok(state.statuses.includes('fire'));arms.push({enabled,state});
   }
   assert.deepEqual(arms[1].state,arms[0].state,`${lab}/${mode}: reference changed muzzle/hit/combat trace`);assert.deepEqual(arms[2].state,arms[0].state,`${lab}/${mode}: legacy repeat drifted`);results.push({lab,mode,arms});
  }
  await page.close();
 }
 assert.equal(errors.length,0,errors.join('\n'));
 const assets=new URL('../dist-quality/assets/',import.meta.url),bundle=[];for(const file of(await readdir(assets)).filter(f=>f.endsWith('.js')).sort())bundle.push({file,sha256:createHash('sha256').update(await readFile(new URL(file,assets))).digest('hex')});
 await writeFile(new URL('../artifacts/integrated/review-labs.json',import.meta.url),JSON.stringify({capturedAt:new Date().toISOString(),bundle,results,errors},null,2)+'\n');console.log('PASS',{labs:2,forms:2,arms:12,exactMuzzlesAndHits:true,errors});
}finally{await browser.close();}
