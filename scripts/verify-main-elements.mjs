/** Default '/' only: ordinary workbench and mouse controls, DOM feedback, read-only CDP audio graph. */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=join(root,'artifacts/integrated');
await mkdir(out,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const launch={headless:true,args:process.platform==='darwin'?['--use-angle=metal']:[]};
if(process.env.CHROME_EXECUTABLE)launch.executablePath=process.env.CHROME_EXECUTABLE;
const base=process.env.MAIN_ELEMENTS_URL??'http://127.0.0.1:5198/';
const cases=[
 {element:'kinetic',brand:'ironvale',weaponType:'rifle',projectile:'bullet',trail:'tracer',affix:'standard',variant:'0'},
 {element:'fire',brand:'cindergrid',weaponType:'shotgun',projectile:'slug',trail:'comet',affix:'heavy',variant:'1'},
 {element:'ice',brand:'prism',weaponType:'sniper',projectile:'beam',trail:'clean',affix:'compact',variant:'2'},
 {element:'corrosive',brand:'tackwork',weaponType:'smg',projectile:'spike',trail:'ribbon',affix:'standard',variant:'3'},
 {element:'shock',brand:'voltaic',weaponType:'smg',projectile:'arc',trail:'helix',affix:'rapid',variant:'0'},
 {element:'radiation',brand:'cindergrid',weaponType:'shotgun',projectile:'scatter',trail:'comet',affix:'heavy',variant:'1'},
 {element:'gravity',brand:'nullward',weaponType:'launcher',projectile:'orb',trail:'pulse',affix:'standard',variant:'2'},
 {element:'adhesive',brand:'tackwork',weaponType:'launcher',projectile:'sticky',trail:'clean',affix:'heavy',variant:'3'},
];
const bundle=[];for(const file of(await readdir(join(root,'dist-quality/assets'))).filter(file=>file.endsWith('.js')).sort())bundle.push({file,sha256:createHash('sha256').update(await readFile(join(root,'dist-quality/assets',file))).digest('hex')});
const errors=[],results=[],browser=await chromium.launch(launch);
const number=text=>Number(String(text??'').replaceAll(',','').replace(/[^0-9.]/g,''))||0;
async function feedback(page){return page.evaluate(()=>({
 screen:document.querySelector('[data-screen]')?.getAttribute('data-screen'),mode:document.querySelector('[data-mode]')?.getAttribute('data-mode'),
 ammo:document.querySelector('.ammo-count')?.textContent,magazine:document.querySelector('.ammo-total')?.textContent,
 weapon:document.querySelector('.weapon-name')?.textContent,profile:document.querySelector('.weapon-profile-line')?.textContent,
 dummy:{visible:!document.querySelector('.test-dummy-readout')?.hidden,label:document.querySelector('.test-dummy-readout')?.getAttribute('aria-label'),kind:document.querySelector('.test-dummy-readout')?.getAttribute('data-damage-kind'),values:[...document.querySelectorAll('.dummy-readout-metric>strong')].map(node=>node.textContent)},
 statuses:[...document.querySelectorAll('.target-status-chip')].map(node=>({label:node.getAttribute('aria-label'),text:node.textContent})),
 damageNumbers:[...document.querySelectorAll('.damage-number,.crowd-damage-number')].filter(node=>!node.hidden).map(node=>({kind:node.getAttribute('data-damage-kind'),text:node.textContent})),
}));}
async function picture(page,element,phase){const file=`main-elements-${element}-${phase}.png`;await page.screenshot({path:join(out,file)});return file;}
async function fire(page){await page.mouse.down();await page.waitForTimeout(12);await page.mouse.up();}
try{
 for(const test of cases){
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  page.on('pageerror',error=>errors.push({element:test.element,type:'pageerror',message:error.message}));page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('404'))errors.push({element:test.element,type:'console',message:message.text()});});
  const audio={supported:false,contexts:[],changes:[],nodes:[],connections:0};const session=await page.context().newCDPSession(page);
  session.on('WebAudio.contextCreated',event=>audio.contexts.push(event.context));session.on('WebAudio.contextChanged',event=>audio.changes.push(event.context));session.on('WebAudio.audioNodeCreated',event=>audio.nodes.push(event.node));session.on('WebAudio.nodesConnected',()=>audio.connections++);
  try{await session.send('WebAudio.enable');audio.supported=true;}catch(error){audio.error=error.message;}
  await page.goto(base);await page.getByRole('button',{name:/enter proving ground/i}).click();await page.keyboard.press('KeyK');await page.getByRole('heading',{name:'WEAPON WORKBENCH'}).waitFor();
  for(const[label,value]of[['Loadout','pilot'],['Manufacturer',test.brand],['Weapon type',test.weaponType],['Assembly',test.affix],['Projectile',test.projectile],['Flight style',test.trail],['Primary element',test.element],['Secondary element','none'],['Design variant',test.variant],['Rarity','rare']])await page.getByLabel(label,{exact:true}).selectOption(value);
  await page.getByLabel('Weapon level',{exact:true}).fill('5');await page.getByLabel('Weapon level',{exact:true}).press('Tab');await page.getByLabel('Guaranteed status procs',{exact:true}).check();
  const code=await page.getByLabel('Build code; paste a code and select Load',{exact:true}).inputValue();assert.ok(code.includes(`:${test.projectile}:${test.element}:none:`));
  const images=[await picture(page,test.element,'workbench')];await page.getByRole('button',{name:/^EQUIP & TEST/}).click();await page.waitForFunction(()=>document.pointerLockElement!==null);await page.waitForTimeout(140);
  const before=await feedback(page);assert.equal(before.screen,'none');assert.equal(before.mode,'pilot');assert.equal(number(before.dummy.values[1]),0,'ordinary Reset & Test must clear the dummy');
  images.push(await picture(page,test.element,'equipment'));const shotAt=Date.now();const nodesBefore=audio.nodes.length;
  await fire(page);images.push(await picture(page,test.element,'delivery'));
  await page.waitForFunction(()=>Number(document.querySelectorAll('.dummy-readout-metric>strong')[1]?.textContent?.replaceAll(',',''))>0,undefined,{timeout:5000});
  const impact={observedAtMs:Date.now()-shotAt,...await feedback(page)};assert.equal(number(before.ammo)-number(impact.ammo),1,`${test.element}: normal firing must consume one shell/round`);assert.ok(number(impact.dummy.values[1])>0,`${test.element}: the real dummy must register damage`);
  if(test.element!=='kinetic')assert.ok(impact.statuses.some(status=>status.label?.startsWith(`${test.element[0].toUpperCase()+test.element.slice(1)}:`)),`${test.element}: guaranteed status must appear in the normal HUD`);
  images.push(await picture(page,test.element,'impact'));let delayed=null;
  if(test.projectile==='sticky'){
   await page.waitForTimeout(160);const armed={observedAtMs:Date.now()-shotAt,...await feedback(page)};assert.equal(number(armed.dummy.values[1]),number(impact.dummy.values[1]),'sticky charge must remain armed without early explosion damage');images.push(await picture(page,test.element,'armed'));
   await page.waitForFunction(first=>Number(document.querySelectorAll('.dummy-readout-metric>strong')[1]?.textContent?.replaceAll(',',''))>first,number(impact.dummy.values[1]),{timeout:3000});
   delayed={armed,detonated:{observedAtMs:Date.now()-shotAt,...await feedback(page)}};assert.ok(delayed.detonated.observedAtMs-impact.observedAtMs>=600,'sticky damage must have a meaningful delayed fuse');images.push(await picture(page,test.element,'detonation'));
  }
  await page.waitForTimeout(720);const lingering=await feedback(page);images.push(await picture(page,test.element,'lingering'));
  if(test.element!=='kinetic')assert.ok(lingering.statuses.some(status=>status.label?.startsWith(`${test.element[0].toUpperCase()+test.element.slice(1)}:`)),`${test.element}: status must linger after the impact`);
  if(['fire','corrosive','shock','radiation'].includes(test.element))assert.ok(number(lingering.dummy.values[1])>number(impact.dummy.values[1]),`${test.element}: normal damage-over-time feedback must increase`);
  const latestContexts=new Map(audio.contexts.map(context=>[context.contextId,context]));for(const context of audio.changes)latestContexts.set(context.contextId,context);
  audio.runningContexts=[...latestContexts.values()].filter(context=>context.contextState==='running');audio.nodesAfterShot=audio.nodes.length-nodesBefore;audio.sourceNodesByContext={};for(const node of audio.nodes.slice(nodesBefore))if(['AudioBufferSource','Oscillator'].includes(node.nodeType))audio.sourceNodesByContext[node.contextId]=(audio.sourceNodesByContext[node.contextId]??0)+1;assert.equal(audio.supported,true,'read-only Chromium audio graph must be available');assert.ok(audio.runningContexts.length>=2,'both production audio contexts must be running after normal gestures');for(const context of audio.runningContexts)assert.ok(audio.sourceNodesByContext[context.contextId]>0,'each production audio context must create actual sound sources after firing');
  const result={...test,url:page.url(),buildCode:code,before,impact,delayed,lingering,images,audio};results.push(result);await writeFile(join(out,`main-elements-${test.element}.json`),JSON.stringify(result,null,2)+'\n');console.log('ELEMENT',test.element,JSON.stringify({ammo:[before.ammo,impact.ammo],damage:[impact.dummy.values[1],lingering.dummy.values[1]],statuses:lingering.statuses.map(status=>status.label),audioContexts:audio.runningContexts.length,audioNodes:audio.nodesAfterShot,delayed:delayed&&[delayed.armed.observedAtMs,delayed.detonated.observedAtMs]}));
  await page.close();
 }
 const summary={protocol:'normal-main-ui-elemental-v1',capturedAt:new Date().toISOString(),url:base,browser:await browser.version(),bundle,viewport:[1440,900],dpr:1,provenance:'Default normal main entry. Trusted UI enter/workbench/select/equip/mouse fire; no injected Game access, private reads, state writes, custom controllers, or combat overrides. WebAudio CDP inspection is read-only.',hardwareStatus:'NOT RUN; this is functional visual/audio coverage, not a hardware or frame-rate measurement',elements:results,errors};
 await writeFile(join(out,'main-elements.json'),JSON.stringify(summary,null,2)+'\n');assert.deepEqual(errors,[]);assert.equal(results.length,8);console.log('PASS',JSON.stringify({elements:results.length,normalMain:true,defaultPresentation:true,stickyDelay:true,errors}));
}finally{await browser.close();}
