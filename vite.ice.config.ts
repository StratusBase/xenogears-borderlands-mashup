import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const paths=['src/dev/iceLab.ts','src/rendering/quality/ice/presentation.ts','src/rendering/quality/ice/response.ts','src/rendering/quality/ice/rime.ts','src/rendering/quality/ice/sizing.ts','src/audio/iceAudio.ts','src/game.ts','src/world.ts','src/ui.ts','src/rendering/PlayerBallistics.ts','src/rendering/quality/elementalPresentation.ts','src/rendering/quality/elementalImpacts.ts'];
export default defineConfig({plugins:[{name:'ice-review-provenance',generateBundle(){this.emitFile({type:'asset',fileName:'provenance.json',source:JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),baseline:'Existing ElementalPresentation with approved corrosive enabled',current:'Opt-in IcePresentation adapter',sources:Object.fromEntries(paths.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]))},null,2)});}}],build:{outDir:'artifacts/ice-prototype/build',rollupOptions:{input:['ice-lab.html']}},server:{host:'127.0.0.1'},preview:{host:'127.0.0.1'}});
