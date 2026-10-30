import {defineConfig} from 'vite';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const protectedFiles=['src/game.ts','src/world.ts','src/ui.ts','src/rendering/PlayerBallistics.ts','src/core/arsenal.ts','src/core/statusEffects.ts','src/rendering/quality/shock/sizing.ts','src/rendering/quality/shock/response.ts','src/rendering/quality/shock/capacitor.ts','src/audio/shockAudio.ts'];
export default defineConfig({define:{'import.meta.env.VITE_SHOCK_REVIEW':JSON.stringify('contact')},plugins:[{name:'shock-contact-provenance',generateBundle(){
 const sources=Object.fromEntries(protectedFiles.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
 this.emitFile({type:'asset',fileName:'provenance.json',source:JSON.stringify({checkpoint:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sources,before:'Spinning sticky Shock coil',current:'Fixed compact sticky Shock charge',protocol:'One compiled Game; balanced C directions in both modes; identical combat seed, inputs and fixtures; sound on; recording off while timing.'},null,2)});
}}],build:{outDir:'artifacts/shock-contact/build',rollupOptions:{input:['index.html','shock-lab.html']}},preview:{host:'127.0.0.1'}});
