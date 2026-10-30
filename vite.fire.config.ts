import {defineConfig} from 'vite';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sources:Record<string,string>={};
export default defineConfig({plugins:[{name:'fire-measured-source-provenance',enforce:'pre',transform(code,id){if(id.startsWith(process.cwd()+'/src/'))sources[id.slice(process.cwd().length+1)]=createHash('sha256').update(code).digest('hex');},generateBundle(){this.emitFile({type:'asset',fileName:'provenance.json',source:JSON.stringify({builtAt:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),protocol:'Both Fire modes in one compiled build; hashes describe the source actually supplied to Vite, including concurrent shared work.',sources},null,2)});}}],build:{outDir:'artifacts/fire-prototype/build',rollupOptions:{input:['index.html','fire-lab.html']}},server:{host:'127.0.0.1'},preview:{host:'127.0.0.1'}});
