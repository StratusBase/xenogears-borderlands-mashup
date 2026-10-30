import test from 'node:test';
import assert from 'node:assert/strict';
import {GpuFrameTimer,type GpuFrameSample} from '../src/rendering/quality/gpuTiming.ts';
import {QualityPerformance} from '../src/rendering/quality/performance.ts';
import {CrowdGpuTimer} from '../src/dev/crowdFeedbackTiming.ts';
import type * as THREE from 'three';

function fixture(){
 type Q={id:number;ready:number;ns:number;deleted:boolean};
 let tick=0,serial=0,active:Q|null=null;const state={disjoint:false,lost:false,delay:1,flipOnResult:false};const queries:Q[]=[];
 const gl={QUERY_RESULT_AVAILABLE:1,QUERY_RESULT:2,CURRENT_QUERY:3,getExtension:()=>({TIME_ELAPSED_EXT:4,GPU_DISJOINT_EXT:5}),isContextLost:()=>state.lost,getParameter:()=>state.disjoint,getQuery:()=>active,
 createQuery:()=>{const q={id:++serial,ready:Infinity,ns:serial*1e6,deleted:false};queries.push(q);return q;},beginQuery:(_target:number,q:Q)=>{assert.equal(active,null);active=q;},endQuery:()=>{assert.ok(active);active.ready=tick+state.delay;active=null;},getQueryParameter:(q:Q,p:number)=>{if(p===1)return q.ready<=tick;if(state.flipOnResult)state.disjoint=true;return q.ns;},deleteQuery:(q:Q)=>{q.deleted=true;}} as unknown as WebGL2RenderingContext;
 const renderer={getContext:()=>gl,domElement:{width:1440,height:900},getPixelRatio:()=>1,info:{autoReset:true,reset:()=>{},render:{calls:7,triangles:20},memory:{geometries:3,textures:2}}}as unknown as THREE.WebGLRenderer;
 return{gl,renderer,state,queries,advance:()=>tick++,frame:(p:QualityPerformance)=>{tick++;const start=p.begin();p.end(start);},setReady:()=>queries.forEach(q=>q.ready=0)};
}
test('shared timer preserves the crowd compatibility export and credits batched results once',()=>{
 assert.equal(CrowdGpuTimer,GpuFrameTimer);const f=fixture(),timer=new GpuFrameTimer(f.gl),frames:GpuFrameSample[]=[];f.state.delay=3;
 for(let i=0;i<3;i++){const frame={frame:i,gpuMs:null};frames.push(frame);timer.begin(frame);timer.end();f.advance();}
 f.setReady();timer.poll();assert.deepEqual(frames.map(f=>f.gpuMs),[1,2,3]);timer.poll();assert.equal(timer.diagnostics.resolved,3);assert.ok(f.queries.every(q=>q.deleted));timer.dispose();
});
test('unique GPU samples exclude warmup and old epochs and keep the final-frame promise boundary',async()=>{
 const f=fixture(),p=new QualityPerformance(f.renderer);f.state.delay=4;f.frame(p);const promise=p.measure('A',30,2);let settled=false;void promise.then(()=>settled=true);
 for(let i=0;i<31;i++)f.frame(p);await Promise.resolve();assert.equal(settled,false);f.frame(p);const a=await promise;
 assert.equal(a.frames,30);assert.equal(a.gpuTiming!.requested,30);assert.ok(a.gpuTiming!.pending>0);assert.ok(a.gpuTiming!.samples.every(s=>s.frame>=4));assert.equal(new Set(a.gpuTiming!.samples.map(s=>s.frame)).size,a.gpuTiming!.resolved);
 const frozen=JSON.stringify(a),bPromise=p.measure('B',30,0);for(let i=0;i<30;i++)f.frame(p);const b=await bPromise;assert.ok(b.gpuTiming!.samples.every(s=>s.frame>33));assert.notEqual(a.gpuTiming!.epoch,b.gpuTiming!.epoch);assert.equal(JSON.stringify(a),frozen);assert.equal(a.viewport[0],1440);p.dispose();
});
test('unavailable results never become unique samples through the last-value display latch',async()=>{
 const f=fixture(),p=new QualityPerformance(f.renderer);f.frame(p);f.frame(p);assert.equal(p.latest.gpuMs,1);f.state.delay=10000;
 const promise=p.measure('delayed',30,0);for(let i=0;i<30;i++)f.frame(p);const r=await promise;assert.ok(r.gpuMs!==null);assert.equal(r.gpuTiming!.resolved,0);assert.equal(r.gpuTiming!.samples.length,0);assert.equal(r.gpuUniqueMs,null);assert.ok(r.gpuTiming!.skipped>0);assert.ok(r.gpuTiming!.coverage<.1);p.dispose();
});
test('disjoint detected after a result read invalidates both ready and pending queries',()=>{
 const f=fixture(),timer=new GpuFrameTimer(f.gl),a={frame:1,gpuMs:null},b={frame:2,gpuMs:null};timer.begin(a);timer.end();timer.begin(b);timer.end();f.advance();f.state.flipOnResult=true;timer.poll();assert.equal(a.gpuMs,null);assert.equal(b.gpuMs,null);assert.equal(timer.diagnostics.disjoint,2);assert.equal(timer.pendingCount,0);assert.ok(f.queries.every(q=>q.deleted));timer.dispose();
});
test('context loss and foreign/active queries remain missing instead of reusing a result',()=>{
 const f=fixture(),timer=new GpuFrameTimer(f.gl),a={frame:1,gpuMs:null},b={frame:2,gpuMs:null};assert.equal(timer.begin(a),true);assert.equal(timer.begin(b),false);timer.end();f.state.lost=true;timer.poll();assert.equal(timer.diagnostics.lost,1);assert.equal(a.gpuMs,null);assert.equal(timer.pendingCount,0);assert.equal(timer.begin({frame:3,gpuMs:null}),false);timer.dispose();
});
test('a foreign elapsed query is not ended and unsupported timers stay unavailable',()=>{
 const f=fixture(),external=f.gl.createQuery()!;f.gl.beginQuery(4,external);const timer=new GpuFrameTimer(f.gl),sample:GpuFrameSample={frame:1,gpuMs:null};
 assert.equal(timer.begin(sample),false);assert.equal(sample.gpuSkipped,true);timer.end();assert.equal(f.gl.getQuery(4,f.gl.CURRENT_QUERY),external);timer.dispose();f.gl.endQuery(4);f.gl.deleteQuery(external);
 const unsupported=new GpuFrameTimer({...f.gl,getExtension:()=>null}as unknown as WebGL2RenderingContext);assert.equal(unsupported.supported,false);assert.equal(unsupported.begin({frame:2,gpuMs:null}),false);unsupported.end();unsupported.dispose();
});
