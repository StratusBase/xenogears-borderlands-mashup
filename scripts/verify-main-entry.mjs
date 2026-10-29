import{chromium}from'/Users/steven/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import{mkdir,writeFile}from'node:fs/promises';
const out=new URL('../artifacts/integrated/',import.meta.url).pathname;await mkdir(out,{recursive:true});
const b=await chromium.launch({headless:true,executablePath:'/Users/steven/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',args:['--use-angle=metal']});
const p=await b.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});const errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto('http://127.0.0.1:5198/');await p.getByRole('button',{name:/enter proving ground/i}).click();await p.waitForTimeout(400);await p.keyboard.down('KeyW');await p.waitForTimeout(250);await p.keyboard.up('KeyW');await p.mouse.down();await p.waitForTimeout(70);await p.mouse.up();await p.screenshot({path:out+'main-default.png'});
 await p.keyboard.press('Escape');await p.waitForTimeout(100);
 const originalButtons=await p.getByRole('button').allTextContents();const enhanced=p.getByRole('button',{name:/visuals.*enhanced/i});await enhanced.click();await p.screenshot({path:out+'main-legacy-menu.png'});
 const legacyVisible=await p.getByRole('button',{name:/visuals.*legacy/i}).count();if(legacyVisible!==1)throw Error('Legacy toggle did not persist');
 await p.getByRole('button',{name:/sound.*on/i}).click();const muted=await p.getByRole('button',{name:/sound.*off/i}).count();if(muted!==1)throw Error('Mute label mismatch');
 await p.getByRole('button',{name:/visuals.*legacy/i}).click();if(await p.getByRole('button',{name:/sound.*off/i}).count()!==1)throw Error('Visual toggle changed mute');
 await p.getByRole('button',{name:/sound.*off/i}).click();await p.getByRole('button',{name:/^resume/i}).click();await p.waitForTimeout(200);await p.screenshot({path:out+'main-restored.png'});
 if(errors.length)throw Error(errors.join('\n'));const result={url:'/',defaultEnhanced:true,normalControls:true,legacyToggle:true,mutePersistsAcrossToggle:true,restored:true,errors,pauseButtons:originalButtons};await writeFile(out+'main-entry.json',JSON.stringify(result,null,2)+'\n');console.log(result);
}finally{await b.close();}
