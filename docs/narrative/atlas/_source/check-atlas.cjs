const {chromium}=require('/Users/steven/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');
const path=require('path');
const assert=require('assert');
const root=path.join(__dirname,'..');
const original=JSON.parse(fs.readFileSync(path.join(root,'story.json'),'utf8'));
const file='file://'+path.join(root,'machines-made-gods-atlas.html');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(file);
 await page.getByRole('heading',{name:'Machines made gods',exact:true}).waitFor();
 assert.equal(await page.locator('.node').count(),original.overview.length);
 assert.equal(await page.locator('#subfilters').isVisible(),false);
 await page.screenshot({path:path.join(root,'preview-desktop.png'),fullPage:true});
 for(const [view,kind] of [['history','event'],['campaign','event'],['cast','character']]){
  await page.locator(`[data-view="${view}"]`).click();
  const count=await page.locator('.node').count();
  assert(count>0);console.log(view,count);
 }
 await page.locator('[data-id="c10"]').click();
 assert.equal(await page.locator('#inspector h2').textContent(),'Nera Sen');
 await page.getByRole('button',{name:'Edit card',exact:true}).click();
 const editedTitle='Nera Sen <revision> & choice';
 await page.locator('#field-title').fill(editedTitle);
 await page.locator('#field-notes').fill('Test: <script> stays text. "Consent" & memory.');
 await page.getByRole('button',{name:'Apply edits',exact:true}).click();
 assert.equal(await page.locator('#inspector h2').textContent(),editedTitle);
 await page.reload();
 await page.locator('#search').fill('Nera Sen');
 await page.locator('[data-search-id="c10"]').click();
 assert.equal(await page.locator('#inspector h2').textContent(),editedTitle);
 // Export and open in a fresh browser context; edits must travel in the file.
 const downloaded=page.waitForEvent('download');await page.locator('#save').click();
 const dl=await downloaded;const exported=path.join(root,'qa-export.html');await dl.saveAs(exported);
 const newContext=await browser.newContext({viewport:{width:1440,height:1000}});
 const newPage=await newContext.newPage();newPage.on('pageerror',e=>errors.push(e.message));await newPage.goto('file://'+exported);
 await newPage.locator('#search').fill('Nera Sen');await newPage.locator('[data-search-id="c10"]').click();
 assert.equal(await newPage.locator('#inspector h2').textContent(),editedTitle);
 assert((await newPage.locator('#inspector').textContent()).includes('<script> stays text.'));
 await newContext.close();
 // Reject a true back edge that would turn the event graph into a cycle.
 await page.locator('#connect').click();await page.locator('#arrow-source').selectOption('p12');await page.locator('#arrow-target').selectOption('h01');await page.locator('#arrow-label').fill('Invalid cycle');await page.getByRole('button',{name:'Add arrow',exact:true}).click();assert((await page.locator('#arrow-error').textContent()).includes('causal loop'));await page.locator('[data-close]').click();
 // All world categories render and can be inspected.
 await page.locator('[data-view="world"]').click();
 for(const kind of ['machine','artifact','location','faction']){await page.locator(`[data-kind="${kind}"]`).click();assert.equal(await page.locator('.node').count(),original.nodes.filter(n=>n.kind===kind).length)}
 await page.locator('[data-view="questions"]').click();assert.equal(await page.locator('#map').isVisible(),false);assert.equal(await page.locator('#map-tools').isVisible(),false);await page.locator('#question-0').fill('Keep the first God unresolved.');
 // Add a new card, then remove it with cleanup of references.
 await page.locator('[data-view="campaign"]').click();const count=await page.locator('.node').count();await page.locator('#add').click();await page.locator('#new-title').fill('A new dawn test');await page.getByRole('button',{name:'Create card',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.locator('.node').count(),count+1);await page.getByRole('button',{name:'Edit card',exact:true}).click();page.once('dialog',d=>d.accept());await page.locator('#remove-card').click();assert.equal(await page.locator('.node').count(),count);
 // Import the original data and confirm the editor can return to a known revision.
 page.once('dialog',d=>d.accept());await page.locator('#file').setInputFiles(path.join(root,'story.json'));await page.getByRole('heading',{name:'Machines become makers',exact:true}).waitFor();
 // Responsive viewport without horizontal page overflow.
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:path.join(root,'preview-mobile.png'),fullPage:false});
 await page.setViewportSize({width:320,height:800});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'PASS',cards:original.nodes.length,causalEdges:original.edges.length,checks:['views','card editing','local persistence','portable HTML export','HTML escaping','cycle rejection','world categories','decision notes','add/remove cards','JSON import','390/320px layout'],errors}));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
