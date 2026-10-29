import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {createCorrosiveSplashGeometry,animateCorrosiveRupture} from '../src/rendering/quality/corrosive/rupture.ts';
import {corrosiveSizing} from '../src/rendering/quality/corrosive/sizing.ts';

const base='artifacts/corrosive-ab/horizontal/',ref='328a175',hash=s=>createHash('sha256').update(s).digest('hex');
const oldSource=execFileSync('git',['show',ref+':src/rendering/quality/corrosive/rupture.ts'],{encoding:'utf8'}),baselineFile=resolve(base,'baseline-rupture.ts');await writeFile(baselineFile,oldSource);
const module=await import(pathToFileURL(baselineFile).href),before=module.createCorrosiveSplashGeometry?module:module.default;
const oldGeometry=before.createCorrosiveSplashGeometry(),current=createCorrosiveSplashGeometry(),walls=[];
for(const seed of[0,.731,12.43])for(const gravity of[new THREE.Vector3(0,-1,0),new THREE.Vector3(-.4,-.916515138991168,0)])for(const age of[.025,.10,.20,.33,.40]){
 before.animateCorrosiveRupture(oldGeometry,age,seed,gravity);animateCorrosiveRupture(current,age,seed,gravity,0);assert.deepEqual(current.attributes.position.array,oldGeometry.attributes.position.array,'approved vertical motion must remain byte-identical');walls.push({seed,gravity:gravity.toArray(),age,sha256:hash(Buffer.from(current.attributes.position.array.buffer))});
}
const samples=[],size=corrosiveSizing({projectile:'rocket',phase:'detonate',radius:2.5,energy:70}).sheetRadius;
function measure(g){const p=g.attributes.position;let minimum=Infinity,below=0;for(let i=0;i<p.count;i++){const distance=.012+p.getZ(i)*size;minimum=Math.min(minimum,distance);if(distance<0)below++;}return{minimumWorldDistance:minimum,verticesBehindSurface:below,total:p.count};}
for(const age of[.025,.10,.20,.33,.40]){const gravity=new THREE.Vector3(0,0,-1);before.animateCorrosiveRupture(oldGeometry,age,.731,gravity);animateCorrosiveRupture(current,age,.731,gravity,1);const after=measure(current);assert.equal(after.verticesBehindSurface,0);samples.push({age,before:measure(oldGeometry),after});}
const sizing=await readFile('src/rendering/quality/corrosive/sizing.ts');assert.equal(hash(sizing),hash(execFileSync('git',['show',ref+':src/rendering/quality/corrosive/sizing.ts'])));
await writeFile(base+'geometry-comparison.json',JSON.stringify({capturedAt:new Date().toISOString(),baselineRef:ref,baselineSourceSHA256:hash(oldSource),wallSamplesIdentical:walls.length,walls,sizeParameter:size,normalOffset:.012,sizingSourceUnchanged:true,samples},null,2)+'\n');oldGeometry.dispose();current.dispose();console.log('PASS',walls.length,'exact wall geometry comparisons; no floor vertices behind the support; sizing source unchanged');
