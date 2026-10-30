import {test} from 'node:test';import assert from 'node:assert/strict';
import {GravityFields,type GravityTarget} from '../src/core/effects/gravity/field';
import {GravityActivation} from '../src/core/effects/gravity/activation';
import {effectBodyClear,effectBodyPathClear,effectLineClear,sweepEffectBody,supportedEffectPose} from '../src/core/effects/shared/collision';
import type {EffectBounds,EffectVector} from '../src/core/effects/contracts';
import {createWeaponSpec} from '../src/core/arsenal';

function fixture(solids:EffectBounds[]=[],tuning:ConstructorParameters<typeof GravityFields>[1]={}){
 const targets:GravityTarget[]=[],damage:{id:number;amount:number;source:string}[]=[];
 const fields=new GravityFields({targets:()=>targets,move:(t,p)=>{t.position=sweepEffectBody(t.position,p,t,solids);return t.position;},visible:(c,t)=>effectLineClear(c,t.position,solids),clearCenter:(c,r)=>effectBodyClear(c,{radius:r,halfHeight:r},solids),clearSourcePath:(a,b,r)=>effectBodyPathClear(a,b,{radius:r,halfHeight:r},solids),capturePosition:(p,t)=>supportedEffectPose(p,t,solids),damage:(id,amount,s)=>damage.push({id,amount,source:s.id})},tuning);
 return{targets,damage,fields,add:(id:number,x:number,y:number,z:number)=>{const target={id,position:{x,y,z},radius:.4,halfHeight:1.2,alive:true};targets.push(target);return target;},step:(seconds:number)=>{for(let i=0;i<Math.round(seconds*120);i++)fields.update(1/120);}};
}
const floor={id:'floor',ownerId:'pilot',point:{x:0,y:0,z:0},normal:{x:0,y:1,z:0}};
test('well placement offsets every real contact face and shares the actual 3D center',()=>{
 const f=fixture();for(const [id,point,normal]of [['floor',{x:0,y:0,z:0},{x:0,y:1,z:0}],['wall',{x:0,y:3,z:-5},{x:0,y:0,z:1}],['ceiling',{x:2,y:6,z:0},{x:0,y:-1,z:0}]]as const){const source={id,ownerId:'pilot',point:{...point},normal:{...normal}},copy=structuredClone(source),well=f.fields.spawn(source)!;assert.deepEqual(source,copy);assert.ok(Math.abs(Math.hypot(well.center.x-point.x,well.center.y-point.y,well.center.z-point.z)-.345)<1e-8);assert.ok(Math.abs(Math.hypot(well.deployment!.destination.x-point.x,well.deployment!.destination.y-point.y,well.deployment!.destination.z-point.z)-1.8)<1e-8);well.center.x=999;assert.notEqual(f.fields.snapshot().wells.find(w=>w.id===id)!.center.x,999);}
 assert.equal(f.fields.spawn({...floor,id:'bad',normal:{x:0,y:0,z:0}}),undefined);
});
test('all compass directions converge, lift, hold at distinct positions and take crush',()=>{
 const f=fixture();for(const [id,x,z]of [[1,4,0],[2,0,4],[3,-4,0],[4,0,-4]])f.add(id,x,1.2,z);
 f.fields.spawn({...floor,id:'high',point:{x:0,y:3.2,z:-1},normal:{x:0,y:0,z:1}});f.step(2);
 const state=f.fields.snapshot();assert.equal(state.members.length,4);assert.ok(state.members.every(m=>m.phase==='held'&&m.position.y>1.6));
 assert.equal(new Set(state.members.map(m=>JSON.stringify(m.position))).size,4);assert.ok(f.damage.length>=8);
 assert.equal(f.fields.owns(1),true);assert.ok(f.targets.every(t=>t.position.y>1.6));
});
test('3D eligibility excludes a distant height, includes late arrivals, and does not pull through cover',()=>{
 const wall={minX:1,maxX:1.2,minY:0,maxY:7,minZ:-6,maxZ:6},f=fixture([wall]);f.add(1,3,1.2,0);f.add(2,-2,9,0);const late=f.add(3,-9,1.2,0);
 f.fields.spawn(floor);f.step(.5);assert.equal(f.fields.snapshot().members.length,0);late.position={x:-3,y:1.2,z:0};f.step(.5);assert.deepEqual(f.fields.snapshot().members.map(m=>m.targetId),[3]);assert.ok(f.damage.every(d=>d.id===3));
});
test('pause freezes gameplay clocks, capture poses and damage; expiry releases targets to collision-aware landing',()=>{
 const f=fixture();f.add(1,2,1.2,0);f.fields.spawn({...floor,point:{x:0,y:3.4,z:0}});f.step(2);const before=structuredClone(f.fields.snapshot()),count=f.damage.length;for(let i=0;i<100;i++)f.fields.update(.1,true);assert.deepEqual(f.fields.snapshot(),before);assert.equal(f.damage.length,count);
 f.step(5);assert.equal(f.fields.snapshot().wells.length,0);assert.equal(f.fields.snapshot().members.length,0);assert.ok(Math.abs(f.targets[0].position.y-1.2)<.001);
});
test('one source owns each target; overlap never duplicates crush or resurrects dead targets',()=>{
 const f=fixture();const target=f.add(1,1,1.2,0);f.fields.spawn(floor);f.fields.spawn({...floor,id:'second'});f.step(1.28);
 assert.equal(f.fields.snapshot().members.length,1);assert.equal(f.damage.length,2);assert.ok(f.damage.every(d=>d.source==='floor'));
 target.alive=false;f.step(.75);assert.equal(f.fields.snapshot().members.length,0);assert.equal(f.damage.length,2);
});
test('bounded source replacement, invalid tuning and rejected solid placement are explicit',()=>{
 const f=fixture([], {maxFields:2,maxEvents:6});for(let i=0;i<9;i++)f.fields.spawn({...floor,id:`source-${i}`});assert.equal(f.fields.snapshot().wells.length,2);assert.ok(f.fields.events.length<=6);
 assert.throws(()=>fixture([],{radius:NaN}));const blocked=new GravityFields({targets:()=>[],move:(t,p)=>p,visible:()=>true,clearCenter:()=>false,clearSourcePath:()=>false,damage:()=>{}});assert.equal(blocked.spawn(floor),undefined);
});
test('swept 3D body collision stops thin walls and low ceilings without tunneling; clear directions slide',()=>{
 const body={radius:.4,halfHeight:1.2},solids=[{minX:1,maxX:1.01,minY:0,maxY:8,minZ:-4,maxZ:4},{minX:-4,maxX:.5,minY:4,maxY:4.1,minZ:-4,maxZ:4}];
 let end=sweepEffectBody({x:0,y:1.2,z:0},{x:20,y:1.2,z:2},body,solids);assert.ok(end.x<.601);assert.ok(end.z>1.9);
 end=sweepEffectBody({x:-1,y:1.2,z:0},{x:-1,y:8,z:0},body,solids);assert.ok(end.y<2.801);assert.ok(effectBodyClear(end,body,solids));
 assert.equal(effectLineClear({x:0,y:2,z:0},{x:3,y:2,z:0},solids),false);
});
test('activation only creates a bounded gravity detonation source, independent of art and duplicate callbacks',()=>{
 const f=fixture(),activation=new GravityActivation(f.fields),spec=createWeaponSpec('sticky','gravity','pilot');
 const event={projectileId:1,phase:'contact' as const,point:{x:0,y:0,z:0},normal:{x:0,y:1,z:0},spec,energy:60,radius:spec.blastRadius};
 activation.impact(event);assert.equal(f.fields.snapshot().wells.length,0);activation.impact({...event,phase:'detonate'});activation.impact({...event,phase:'detonate'});assert.equal(f.fields.snapshot().wells.length,1);
 activation.impact({...event,phase:'detonate',projectileId:2,spec:{...spec,element:'fire'}});assert.equal(f.fields.snapshot().wells.length,1);
});

test('clearing a source releases living bodies to a normal landing; bad capacities and body data are rejected',()=>{
 const f=fixture();f.add(1,2,1.2,0);f.fields.spawn({...floor,point:{x:0,y:4,z:0}});f.step(2);assert.ok(f.targets[0].position.y>2);f.fields.clear();assert.equal(f.fields.snapshot().wells.length,0);assert.equal(f.fields.snapshot().members[0].phase,'fall');const damage=f.damage.length;f.step(3);assert.equal(f.fields.snapshot().members.length,0);assert.ok(Math.abs(f.targets[0].position.y-1.2)<.001);assert.equal(f.damage.length,damage);
 assert.throws(()=>fixture([],{maxFields:1.5}));assert.throws(()=>fixture([],{tickInterval:.00001}));const bad=f.add(2,0,1.2,0);bad.radius=NaN;f.fields.spawn({...floor,id:'again'});f.step(.1);assert.ok(f.fields.snapshot().members.every(m=>m.targetId!==2));
});

test('capture above raised support converges without pulling bodies into the platform',()=>{
 const box={minX:-1.5,maxX:1.5,minY:.4,maxY:.8,minZ:-1,maxZ:1},f=fixture([box]);for(const [id,x,z]of [[1,-3,0],[2,3,0],[3,0,-3],[4,0,3]])f.add(id,x,1.2,z);
 f.fields.spawn({...floor,point:{x:0,y:.8,z:0}});f.step(3);assert.equal(f.fields.snapshot().members.filter(m=>m.phase==='held').length,4);assert.ok(f.targets.every(t=>t.position.y>=2-1e-3&&effectBodyClear(t.position,t,[box])));f.fields.clear();f.step(3);assert.ok(f.targets.every(t=>Math.abs(t.position.y-2)<.001));
});
test('upward release into a ceiling keeps falling ownership until actual landing',()=>{
 const body:GravityTarget={id:1,position:{x:0,y:1.2,z:0},radius:.4,halfHeight:1.2,alive:true},ceiling={minX:-5,maxX:5,minY:2.8,maxY:3,minZ:-5,maxZ:5};
 const fields=new GravityFields({targets:()=>[body],visible:()=>true,clearCenter:()=>true,clearSourcePath:()=>true,damage:()=>{},move:(t,p)=>{body.position=sweepEffectBody(t.position,p,t,[ceiling]);return body.position;}});
 fields.spawn({...floor,point:{x:0,y:4,z:0}});fields.update(.2);fields.update(.18);assert.ok(fields.snapshot().members[0].velocity.y>0);fields.clear();fields.update(.15);assert.ok(fields.owns(1));for(let i=0;i<240;i++)fields.update(1/120);assert.equal(fields.owns(1),false);assert.ok(Math.abs(body.position.y-1.2)<.001);
});

test('deployment travels smoothly along each face normal before any pull, ownership, pulse or crush',()=>{
 for(const source of [floor,{...floor,point:{x:0,y:3,z:-5},normal:{x:0,y:0,z:1}},{...floor,point:{x:0,y:6,z:0},normal:{x:0,y:-1,z:0}}]){
  const f=fixture(),target=f.add(1,2,1.2,0),initial={...target.position},spawn=f.fields.spawn(source)!;const travel=spawn.deployment!;assert.equal(spawn.age,0);assert.deepEqual(spawn.center,travel.start);const offsets:number[]=[];
  for(let i=0;i<33;i++){f.fields.update(1/120);const w=f.fields.snapshot().wells[0];offsets.push(Math.hypot(w.center.x-source.point.x,w.center.y-source.point.y,w.center.z-source.point.z));assert.equal(w.age,0);assert.deepEqual(target.position,initial);assert.equal(f.fields.owns(1),false);assert.equal(f.damage.length,0);assert.equal(f.fields.events.filter(e=>e.kind==='pulse').length,0);}
  const speeds=offsets.slice(1).map((x,i)=>x-offsets[i]);assert.ok(speeds.every(d=>d>0));assert.ok(speeds[0]<speeds[15]&&speeds.at(-1)!<speeds[15]);assert.ok(Math.max(...speeds)<.08);f.step(.05);const settled=f.fields.snapshot().wells[0];assert.deepEqual(settled.center,travel.destination);assert.ok(settled.age>0&&settled.age<.05);assert.equal(settled.deployment!.elapsed,travel.duration);
  const copied=f.fields.snapshot();copied.wells[0].deployment!.destination.x=999;assert.notEqual(f.fields.snapshot().wells[0].deployment!.destination.x,999);
 }
});
test('deployment keeps the full active lifetime and first crush exactly one cadence after settle',()=>{
 const f=fixture();f.add(1,2,1.2,0);f.fields.spawn(floor);f.step(.275);assert.equal(f.fields.snapshot().members.length,0);assert.equal(f.damage.length,0);f.step(.5);assert.equal(f.damage.length,0);f.step(1/120);assert.equal(f.damage.length,1);f.step(3.99);assert.equal(f.fields.snapshot().wells.length,1);f.step(.025);assert.equal(f.fields.snapshot().wells.length,0);
});
test('a clear endpoint cannot authorize deployment through a thin intervening solid',()=>{
 const wall={minX:-3,maxX:3,minY:.85,maxY:.86,minZ:-3,maxZ:3},f=fixture([wall]);assert.equal(effectBodyClear({x:0,y:1.8,z:0},{radius:.32,halfHeight:.32},[wall]),true);assert.equal(f.fields.spawn(floor),undefined);assert.equal(f.fields.snapshot().wells.length,0);
});
test('deployment pauses, clears and evicts without leaking ownership or delayed damage',()=>{
 const f=fixture([],{maxFields:1});f.add(1,2,1.2,0);f.fields.spawn(floor);f.step(.1);const state=f.fields.snapshot();f.fields.update(.2,true);assert.deepEqual(f.fields.snapshot(),state);f.fields.spawn({...floor,id:'second'});assert.deepEqual(f.fields.snapshot().wells.map(w=>w.id),['second']);assert.equal(f.fields.snapshot().members.length,0);f.fields.clear();f.step(1);assert.equal(f.damage.length,0);assert.equal(f.fields.snapshot().wells.length,0);f.fields.spawn({...floor,id:'third'});f.fields.dispose();f.step(1);assert.equal(f.fields.snapshot().wells.length,0);assert.equal(f.damage.length,0);
});
test('settle overshoot carries into active age across different legal update chunks',()=>{
 const a=fixture(),b=fixture();a.fields.spawn(floor);b.fields.spawn(floor);for(const dt of [.2,.18])a.fields.update(dt);for(const dt of [.14,.14,.1])b.fields.update(dt);const x=a.fields.snapshot().wells[0],y=b.fields.snapshot().wells[0];assert.deepEqual(x.center,y.center);assert.ok(Math.abs(x.age-.1)<1e-8&&Math.abs(x.age-y.age)<1e-8);
});
