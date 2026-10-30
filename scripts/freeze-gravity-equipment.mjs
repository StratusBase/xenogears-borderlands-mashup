import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),dir=path.resolve(root,process.argv.includes('--dir')?process.argv[process.argv.indexOf('--dir')+1]:'artifacts/gravity-equipment'),source=path.join(dir,'source');
if(!dir.startsWith(path.join(root,'artifacts')+path.sep))throw new Error('Review archive must be under artifacts/');
fs.mkdirSync(source,{recursive:true});
for(const name of ['src','public','tests','scripts','package.json','package-lock.json','tsconfig.json','index.html','gravity-equipment.html','vite.gravity-equipment.config.ts','gravity-timing.html','vite.gravity-timing.config.ts','vite.gravity-integration.config.ts','vite.gravity-production-field.config.ts','tsconfig.tools.json'])if(fs.existsSync(path.join(root,name)))fs.cpSync(path.join(root,name),path.join(source,name),{recursive:true});
if(!fs.existsSync(path.join(source,'node_modules')))fs.symlinkSync(path.join(root,'node_modules'),path.join(source,'node_modules'),'dir');
function files(folder){return fs.readdirSync(folder,{withFileTypes:true}).flatMap(e=>e.name==='node_modules'?[]:e.isDirectory()?files(path.join(folder,e.name)):[path.join(folder,e.name)]);}
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.writeFileSync(path.join(dir,'source-provenance.json'),JSON.stringify({recordedUtc:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sources:Object.fromEntries(files(source).map(file=>[path.relative(source,file),hash(file)]))},null,2));
console.log('Frozen current source; build both equipment variants from this one archive.');
