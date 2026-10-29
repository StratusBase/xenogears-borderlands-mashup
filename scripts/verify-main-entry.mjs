import{mkdir,writeFile,readdir,readFile}from'node:fs/promises';
import{createHash}from'node:crypto';
const{chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const url=process.env.INTEGRATED_MAIN_URL??'http://127.0.0.1:5198/';
const out=new URL('../artifacts/integrated/',import.meta.url).pathname;await mkdir(out,{recursive:true});
const bundle=[];const assets=new URL('../dist-quality/assets/',import.meta.url);for(const file of(await readdir(assets)).filter(file=>file.endsWith('.js')).sort())bundle.push({file,sha256:createHash('sha256').update(await readFile(new URL(file,assets))).digest('hex')});
const options={headless:true,args:process.platform==='darwin'?['--use-angle=metal']:[]};if(process.env.CHROME_EXECUTABLE)options.executablePath=process.env.CHROME_EXECUTABLE;
const b=await chromium.launch(options);
const p=await b.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});const errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto(url);await p.getByRole('button',{name:/enter proving ground/i}).click();await p.waitForTimeout(400);await p.keyboard.down('KeyW');await p.waitForTimeout(250);await p.keyboard.up('KeyW');const ammoBefore=Number(await p.locator('.ammo-count').textContent());await p.mouse.down();await p.waitForTimeout(70);await p.mouse.up();await p.waitForFunction(before=>Number(document.querySelector('.ammo-count')?.textContent)<before,ammoBefore);const ammoAfter=Number(await p.locator('.ammo-count').textContent());await p.screenshot({path:out+'main-default.png'});
 await p.keyboard.press('Escape');await p.waitForTimeout(100);
 const originalButtons=await p.getByRole('button').allTextContents();const enhanced=p.getByRole('button',{name:/visuals.*enhanced/i});await enhanced.click();await p.screenshot({path:out+'main-legacy-menu.png'});
 const legacyVisible=await p.getByRole('button',{name:/visuals.*legacy/i}).count();if(legacyVisible!==1)throw Error('Legacy toggle did not persist');
 await p.getByRole('button',{name:/sound.*on/i}).click();const muted=await p.getByRole('button',{name:/sound.*off/i}).count();if(muted!==1)throw Error('Mute label mismatch');
 await p.getByRole('button',{name:/visuals.*legacy/i}).click();if(await p.getByRole('button',{name:/sound.*off/i}).count()!==1)throw Error('Visual toggle changed mute');
 await p.getByRole('button',{name:/sound.*off/i}).click();await p.getByRole('button',{name:/^resume/i}).click();await p.waitForTimeout(200);await p.screenshot({path:out+'main-restored.png'});
 if(errors.length)throw Error(errors.join('\n'));const result={capturedAt:new Date().toISOString(),url,browser:b.version(),bundle,defaultEnhanced:true,normalControls:true,ammoBefore,ammoAfter,legacyToggle:true,mutePersistsAcrossToggle:true,restored:true,errors,pauseButtons:originalButtons};await writeFile(out+'main-entry.json',JSON.stringify(result,null,2)+'\n');console.log(result);
}finally{await b.close();}
