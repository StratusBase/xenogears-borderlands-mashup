import {chromium} from '/Users/steven/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const version=process.env.FOOTSTEP_VERSION??'after';
const browser=await chromium.launch({headless:true,executablePath:'/Users/steven/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});await page.goto(process.env.CORROSIVE_REVIEW_URL??'http://127.0.0.1:5203/corrosive-lab.html');await page.waitForFunction(()=>!!window.corrosiveReview);
 await page.evaluate(()=>{const r=window.corrosiveReview;r.fixture('human','bullet');r.clean(false);});await page.getByRole('button',{name:/Enable sound|Sound enabled/}).click();
 await page.evaluate(()=>{const r=window.corrosiveReview;r.layer.audio.setEnabled(false);r.clean();r.play();window.walkSteps=[];const audio=r.g.presentation.quality.audio,play=audio.play.bind(audio);audio.play=(event,options)=>{if(event==='step'||event==='land')window.walkSteps.push({at:r.g.time,event,options,position:r.g.camera.position.toArray()});play(event,options);};});
 const metadata=await page.evaluate(()=>window.corrosiveReview.startRecording());const controls=[];
 async function move(moveX,moveY,duration){const at=await page.evaluate(({moveX,moveY})=>{const r=window.corrosiveReview;r.game.driveEvaluation({moveX,moveY,fire:false,yaw:r.g.yaw,pitch:r.g.pitch});return r.g.time;},{moveX,moveY});controls.push({at,moveX,moveY,duration});await page.waitForTimeout(duration);}
 await move(0,0,600);await move(1,0,700);await move(0,0,700);await move(-1,0,700);await move(0,0,700);await move(0,1,700);await move(0,0,800);
 const steps=await page.evaluate(()=>window.walkSteps),encoded=await page.evaluate(()=>window.corrosiveReview.stopRecording()),bytes=Buffer.from(encoded,'base64');assert.equal(bytes.subarray(0,4).toString('hex'),'1a45dfa3');assert.ok(steps.length>0);
 if(version==='after')for(const step of steps)assert.ok(controls.some((control,i)=>(control.moveX||control.moveY)&&step.at>=control.at-.035&&step.at<(controls[i+1]?.at??Infinity)+.035),'Footstep must occur during actual movement');
 await writeFile(`artifacts/corrosive-ab/footsteps/${version}.webm`,bytes);await writeFile(`artifacts/corrosive-ab/footsteps/${version}.json`,JSON.stringify({capturedAt:new Date().toISOString(),version,metadata,controls,steps,elementalLayerMuted:true,source:'Actual Game.run movement and final physical WebAudio bus, native clock. No sound replacement.'},null,2));console.log(version,'steps',steps.length,'bytes',bytes.length);
}finally{await browser.close();}
