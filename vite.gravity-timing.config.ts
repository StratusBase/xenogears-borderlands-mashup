import {defineConfig,transformWithEsbuild} from 'vite';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const root=process.cwd(),referenceRoot=process.env.GRAVITY_REFERENCE_ROOT??root;
/** Immutable earlier field timing. Equipment and authoritative simulation are shared by both arms. */
export const gravityTimingReference={name:'gravity-timing-reference',resolveId(id:string){if(id.startsWith('virtual:gravity-timing-'))return '\0'+id;},async load(id:string){
 if(!id.startsWith('\0virtual:gravity-timing-'))return;
 const name=id.slice('\0virtual:gravity-timing-'.length),file=`src/rendering/quality/gravity/${name==='response'?'response':name}.ts`,source=execFileSync('git',['show',`6c51dd0:${file}`],{cwd:referenceRoot,encoding:'utf8'});
 const rewritten=source.replace(/from '(\.[^']+)'/g,(_match,specifier:string)=>`from '${['./flow','./lens'].includes(specifier)?'virtual:gravity-timing-'+specifier.slice(2):path.resolve(root,'src/rendering/quality/gravity',specifier)}'`);
 return transformWithEsbuild(rewritten,file,{loader:'ts'});
}};
export default defineConfig({plugins:[gravityTimingReference],build:{outDir:'artifacts/gravity-integration/build',rollupOptions:{input:['index.html','gravity-timing.html']}},server:{host:'127.0.0.1'},preview:{host:'127.0.0.1'}});
