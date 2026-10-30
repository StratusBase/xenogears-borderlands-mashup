import http from 'node:http';
import { readFile,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';

// Local recording export only. No browser internals, external service, microphone or credentials.
const out=resolve(process.env.ICE_CAPTURE_ROOT??'artifacts/ice-prototype'),build=join(out,'build'),origin=process.env.ICE_CAPTURE_ORIGIN??'http://127.0.0.1:5233',port=Number(process.env.ICE_CAPTURE_PORT??5234);
if(!out.startsWith(resolve('artifacts')+'/')||!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)||!Number.isInteger(port)||port<1024||port>65535)throw new Error('Local artifacts directory, loopback origin and valid port required');
const helper=`const anchor=document.querySelector('#record-download'),button=document.createElement('button');button.textContent='Save recorded clip locally';button.hidden=true;anchor.after(button);new MutationObserver(()=>{button.hidden=!anchor.href.startsWith('blob:');button.textContent='Save recorded clip locally'}).observe(anchor,{attributes:true});button.addEventListener('click',async()=>{button.disabled=true;try{const name=document.querySelector('#human-target').value+'-'+document.querySelector('#human-version').value;const blob=await(await fetch(anchor.href)).blob();const response=await fetch('http://127.0.0.1:${port}/capture/'+name,{method:'POST',headers:{'Content-Type':'video/webm'},body:blob});if(!response.ok)throw new Error(await response.text());button.textContent='Saved '+name+' locally';document.querySelector('#signoff-state').textContent='Saved live gameplay and sound: '+name+' ('+blob.size+' bytes)';}catch(error){document.querySelector('#signoff-state').textContent='Export error: '+error;}finally{button.disabled=false;}});`;
await writeFile(join(build,'capture-export.js'),helper);
const htmlPath=join(build,'ice-lab.html');let html=await readFile(htmlPath,'utf8');if(!html.includes('capture-export.js'))await writeFile(htmlPath,html.replace('</body>','<script type="module" src="/capture-export.js"></script></body>'));
const allowed=new Set(['cloth-before','cloth-after','armor-before','armor-after']);
http.createServer(async(req,res)=>{
 if(req.headers.origin!==origin){res.writeHead(403);res.end('Local review origin required');return;}
 res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 const name=req.url?.replace('/capture/','');if(req.method!=='POST'||!req.url?.startsWith('/capture/')||!allowed.has(name)){res.writeHead(400);res.end('Unknown review clip');return;}
 try{const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>50*1024*1024)throw new Error('Review clip exceeds 50 MB');chunks.push(chunk);}if(bytes<1000)throw new Error('Empty recording');await writeFile(join(out,name+'.webm'),Buffer.concat(chunks));res.writeHead(201,{'Content-Type':'application/json'});res.end(JSON.stringify({name,bytes}));}
 catch(error){res.writeHead(400);res.end(String(error));}
}).listen(port,'127.0.0.1',()=>console.log(`Local recording export ready on 127.0.0.1:${port}; compiled game assets are unchanged.`));
