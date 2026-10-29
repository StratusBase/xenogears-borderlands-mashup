import test from 'node:test';
import assert from 'node:assert/strict';
import { FootstepCadence } from '../src/rendering/quality/footsteps.ts';
import { qualityAudioRecipe } from '../src/audio/qualityAudio.ts';

test('footfalls stay displacement-driven and have the same cadence at 30, 60 and 144 Hz',()=>{
 function run(hz:number){const gait=new FootstepCadence(),events:number[]=[];for(let i=1;i<=hz*4;i++){const time=i/hz,event=gait.update({dt:1/hz,time,distance:7/hz,grounded:true,paused:false,mode:'pilot'});if(event)events.push(time);}return events;}
 const baseline=run(60);assert.ok(baseline.length>=8&&baseline.length<=10);for(const hz of[30,144]){const current=run(hz);assert.equal(current.length,baseline.length);current.forEach((at,i)=>assert.ok(Math.abs(at-baseline[i])<.08));}
});
test('no footfalls while stopped, airborne, paused, teleported, dashing or on a zero-delta draw',()=>{
 const gait=new FootstepCadence();for(const override of[{distance:0},{grounded:false},{paused:true},{distance:15},{dt:0},{distance:.6,dt:.01}])for(let i=0;i<90;i++)assert.equal(gait.update({dt:1/60,time:i/60,distance:.1,grounded:true,paused:false,mode:'pilot',...override}),undefined);
 assert.equal(gait.update({dt:1/60,time:NaN,distance:1,grounded:true,paused:false,mode:'pilot'}),undefined);
});
test('landing is one contact, and stopped/mode transitions cannot carry queued steps',()=>{
 const gait=new FootstepCadence();assert.equal(gait.update({dt:.016,time:1,distance:0,grounded:true,paused:false,landed:true,mode:'pilot'})?.kind,'land');
 assert.equal(gait.update({dt:.016,time:1.016,distance:0,grounded:true,paused:false,mode:'pilot'}),undefined);
 for(let i=0;i<20;i++)gait.update({dt:.016,time:2+i*.016,distance:.1,grounded:true,paused:false,mode:'pilot'});
 assert.equal(gait.update({dt:.016,time:3,distance:0,grounded:true,paused:false,mode:'pilot'}),undefined);assert.equal(gait.update({dt:.016,time:3.016,distance:.1,grounded:true,paused:false,mode:'pilot'}),undefined);
 assert.equal(gait.update({dt:.016,time:3.032,distance:.1,grounded:true,paused:false,mode:'mech'}),undefined);
});
test('pilot sand footsteps use short unpitched Foley with deterministic variations and quiet gains',()=>{
 const first=qualityAudioRecipe('step',{mode:'pilot',footstepVariant:0}),other=qualityAudioRecipe('step',{mode:'pilot',footstepVariant:3});assert.ok(first.every(v=>v.wave==='noise'));assert.ok(first.every(v=>v.gain<=.055&&v.duration<=.10));assert.notDeepEqual(first,other);assert.deepEqual(first,qualityAudioRecipe('step',{mode:'pilot',footstepVariant:7}));
 const mech=qualityAudioRecipe('step',{mode:'mech'});assert.ok(mech.some(v=>v.wave==='sine'));assert.ok(Math.max(...mech.map(v=>v.duration))>Math.max(...first.map(v=>v.duration)));
});
