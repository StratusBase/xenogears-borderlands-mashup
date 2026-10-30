import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const protectedFiles=['src/game.ts','src/world.ts','src/ui.ts','src/rendering/PlayerBallistics.ts','src/core/arsenal.ts','src/core/statusEffects.ts','src/rendering/quality/corrosive/sizing.ts','src/audio/corrosiveAudio.ts'];
export default defineConfig({plugins:[{name:'shock-review-provenance',generateBundle(){
 const sources=Object.fromEntries(protectedFiles.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
 this.emitFile({type:'asset',fileName:'provenance.json',source:JSON.stringify({checkpoint:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sources,before:'First A+B ShockPresentation / prototype profile',current:'Branching lightning ShockPresentation / lightning profile',protocol:'Same compiled Game, inputs, seed, weapons, targets, actual chain decisions, physics and simulation clocks; sound on; capture off while timing.'},null,2)});
}}],build:{outDir:'artifacts/shock-lightning/refined-build',rollupOptions:{input:['index.html','shock-lab.html']}},server:{host:'127.0.0.1'},preview:{host:'127.0.0.1'}});
