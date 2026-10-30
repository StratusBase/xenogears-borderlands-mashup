import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {EffectVariationSequence} from '../src/rendering/quality/shared/variation';
import {infallDistance,pressureProfile,samplePressure} from '../src/rendering/quality/gravity/flow';
import {GravityResponse,GRAVITY_VFX_CAPACITY} from '../src/rendering/quality/gravity/response';
import {GravityReferenceResponse} from '../src/dev/effects/gravity/reference';
import {ElementalAudio} from '../src/audio/elementalAudio';
import type {GravityWell} from '../src/core/effects/gravity/field';
const well=(id='one',age=1):GravityWell=>({id,ownerId:'pilot',point:{x:0,y:3.2,z:-5},center:{x:0,y:3.2,z:-3.2},normal:{x:0,y:0,z:1},radius:6,captureRadius:1.16,duration:4.5,age,power:1});
test('infall timing has finite, increasing terminal speed rather than slowing near the core',()=>{
 const samples=Array.from({length:101},(_,i)=>infallDistance(i/100));assert.equal(samples[0],0);assert.equal(samples.at(-1),1);const differences=samples.slice(1).map((x,i)=>x-samples[i]);assert.ok(differences.every((d,i)=>d>0&&(i===0||d>=differences[i-1]-1e-10)));assert.ok(Math.max(...differences)<.019);assert.equal(infallDistance(-1),0);assert.equal(infallDistance(2),1);
});
test('one reproducible profile per event varies actual widths and curves, with support-plane clearance',()=>{
 const make=()=>{const sequence=new EffectVariationSequence(104729);return Array.from({length:6},()=>pressureProfile(sequence.next(4,'gravity-well'),new THREE.Vector3(0,1,0),1.8));},a=make(),b=make();assert.deepEqual(a,b);assert.equal(new Set(a.map(p=>p.seed)).size,6);assert.ok(new Set(a.map(p=>p.variant)).size>=3);assert.ok(new Set(a.map(p=>p.lanes[0].width)).size>1);assert.ok(new Set(a.map(p=>p.lanes[0].length)).size>1);
 for(const profile of a)for(const lane of profile.lanes){assert.ok(lane.length>0);assert.ok(Array.from(lane.points).every(Number.isFinite));for(let i=1;i<lane.points.length;i+=3)assert.ok(lane.points[i]>=-1.721);const p=new THREE.Vector3();for(let i=0;i<=100;i++){samplePressure(lane,lane.length*i/100,p);assert.ok(p.toArray().every(Number.isFinite));}}
});
test('view-parallel streams stay finite, source pose stays immutable, and update does not rebuild geometry twice',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),audio=new ElementalAudio(),v=new GravityResponse(scene,camera,audio,{seed:7}),state={wells:[well()],members:[{targetId:1,wellId:'one',position:{x:1,y:2,z:-3},velocity:{x:0,y:0,z:0},phase:'held'as const,slot:0}]},copy=structuredClone(state);
 v.sync(state);const n=v.diagnostics.geometryUpdates;v.update(1/60,1);assert.equal(v.diagnostics.geometryUpdates,n);for(const xyz of [[0,3.2,-3.2],[10,3.2,-3.2],[0,20,-3.2]]){camera.position.set(...xyz as [number,number,number]);v.sync(state);v.group.traverse(o=>{if(o instanceof THREE.Mesh){const p=o.geometry.attributes.position;assert.ok(Array.from(p.array).every(Number.isFinite));}});}assert.deepEqual(state,copy);assert.ok(v.diagnostics.grains<=GRAVITY_VFX_CAPACITY.grains);v.dispose();audio.dispose();
});
test('new pressure art and preserved thin reference emit the same authoritative audio cues',()=>{
 const run=(old:boolean)=>{const scene=new THREE.Scene(),audio=new ElementalAudio(),events:unknown[]=[];audio.cue=(element,event,options)=>{events.push({element,event,options});};const v=old?new GravityReferenceResponse(scene,new THREE.PerspectiveCamera(),audio):new GravityResponse(scene,new THREE.PerspectiveCamera(),audio,{seed:19});v.event({kind:'spawn',well:well('one',0)});for(let i=0;i<60;i++){v.sync({wells:[well('one',i/120)],members:[]});v.update(1/120,i/120);}v.event({kind:'pulse',well:well('one',.5)});v.event({kind:'end',well:well('one',.5)});v.sync({wells:[],members:[]});for(let i=0;i<90;i++){v.update(1/120,.5+i/120);v.sync({wells:[],members:[]});}assert.equal(v.diagnostics.wells,0);v.dispose();audio.dispose();return events;};assert.deepEqual(run(false),run(true));
});
test('cosmetic curve generation uses its own seeded sequence and never ambient randomness',()=>{
 const profiles=[],random=Math.random;Math.random=()=>{throw new Error('Ambient randomness consumed');};try{for(const seed of [104729,982451653]){const sequence=new EffectVariationSequence(seed);profiles.push(pressureProfile(sequence.next(4,'gravity-well'),new THREE.Vector3(0,1,0),1.8));}}finally{Math.random=random;}assert.notDeepEqual(profiles[0],profiles[1]);
});

test('the first sheet travels like the others and crush never deforms its path into a stationary pulse',()=>{
 const scene=new THREE.Scene(),audio=new ElementalAudio(),v=new GravityResponse(scene,new THREE.PerspectiveCamera(),audio,{seed:7}),state={wells:[well('one',.5)],members:[]};v.sync(state);v.update(.1,.5);v.sync(state);const mesh=v.group.getObjectByName('gravity-pressure-folds')as THREE.Mesh,positions=mesh.geometry.attributes.position,tip=()=>Array.from(positions.array.slice(48*3,50*3));const before=tip();v.event({kind:'pulse',well:state.wells[0]});v.sync(state);assert.deepEqual(tip(),before);state.wells[0].age=.9;v.sync(state);assert.notDeepEqual(tip(),before);v.dispose();audio.dispose();
});
test('the travelling core is visible at the authoritative center while pressure and bed wait for settle',()=>{
 const scene=new THREE.Scene(),audio=new ElementalAudio(),cues:unknown[]=[],v=new GravityResponse(scene,new THREE.PerspectiveCamera(),audio,{seed:7});audio.cue=(...args)=>{cues.push(args);};const w=well('deploying',0);w.point={x:0,y:0,z:0};w.normal={x:0,y:1,z:0};w.deployment={start:{x:0,y:.345,z:0},destination:{x:0,y:1.8,z:0},elapsed:.14,duration:.28};w.center={x:0,y:1.0725,z:0};const original=structuredClone(w);v.sync({wells:[w],members:[]});v.update(.1,0);let source=v.diagnostics.sources[0];assert.deepEqual(source.center,[0,1.0725,0]);assert.equal(source.corePresence,1);assert.equal(source.pressurePresence,0);assert.equal(cues.length,0);assert.deepEqual(w,original);
 w.deployment.elapsed=.28;w.center={...w.deployment.destination};w.age=.16;v.sync({wells:[w],members:[]});v.update(.01,.16);source=v.diagnostics.sources[0];assert.deepEqual(source.center,[0,1.8,0]);assert.equal(source.pressurePresence,1);assert.equal(cues.length,1);v.dispose();audio.dispose();
});
