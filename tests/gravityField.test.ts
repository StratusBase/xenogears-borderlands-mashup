import {test} from 'node:test';import assert from 'node:assert/strict';
import {GravityFields,type GravityTarget} from '../src/core/effects/gravity/field';
import {GravityActivation} from '../src/core/effects/gravity/activation';
import {effectBodyClear,effectLineClear,sweepEffectBody,supportedEffectPose} from '../src/core/effects/shared/collision';
import type {EffectBounds,EffectVector} from '../src/core/effects/contracts';
import {createWeaponSpec} from '../src/core/arsenal';

function fixture(solids:EffectBounds[]=[],tuning:ConstructorParameters<typeof GravityFields>[1]={}){
 const targets:GravityTarget[]=[],damage:{id:number;amount:number;source:string}[]=[];
 const fields=new GravityFields({targets:()=>targets,move:(t,p)=>{t.position=sweepEffectBody(t.position,p,t,solids);return t.position;},visible:(c,t)=>effectLineClear(c,t.position,solids),clearCenter:(c,r)=>effectBodyClear(c,{radius:r,halfHeight:r},solids),capturePosition:(p,t)=>supportedEffectPose(p,t,solids),damage:(id,amount,s)=>damage.push({id,amount,source:s.id})},tuning);
 return{targets,damage,fields,add:(id:number,x:number,y:number,z:number)=>{const target={id,position:{x,y,z},radius:.4,halfHeight:1.2,alive:true};targets.push(target);return target;},step:(seconds:number)=>{for(let i=0;i<Math.round(seconds*120);i++)fields.update(1/120);}};
}
const floor={id:'floor',ownerId:'pilot',point:{x:0,y:0,z:0},normal:{x:0,y:1,z:0}};
test('well placement offsets every real contact face and shares the actual 3D center',()=>{
 const f=fixture();for(const [id,point,normal]of [['floor',{x:0,y:0,z:0},{x:0,y:1,z:0}],['wall',{x:0,y:3,z:-5},{x:0,y:0,z:1}],['ceiling',{x:2,y:6,z:0},{x:0,y:-1,z:0}]]as const){const source={id,ownerId:'pilot',point:{...point},normal:{...normal}},copy=structuredClone(source),well=f.fields.spawn(source)!;assert.deepEqual(source,copy);assert.ok(Math.abs(Math.hypot(well.center.x-point.x,well.center.y-point.y,well.center.z-point.z)-1.8)<1e-8);well.center.x=999;assert.notEqual(f.fields.snapshot().wells.find(w=>w.id===id)!.center.x,999);}
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
 const f=fixture();const target=f.add(1,1,1.2,0);f.fields.spawn(floor);f.fields.spawn({...floor,id:'second'});f.step(1);
 assert.equal(f.fields.snapshot().members.length,1);assert.equal(f.damage.length,2);assert.ok(f.damage.every(d=>d.source==='floor'));
 target.alive=false;f.step(.75);assert.equal(f.fields.snapshot().members.length,0);assert.equal(f.damage.length,2);
});
test('bounded source replacement, invalid tuning and rejected solid placement are explicit',()=>{
 const f=fixture([], {maxFields:2,maxEvents:6});for(let i=0;i<9;i++)f.fields.spawn({...floor,id:`source-${i}`});assert.equal(f.fields.snapshot().wells.length,2);assert.ok(f.fields.events.length<=6);
 assert.throws(()=>fixture([],{radius:NaN}));const blocked=new GravityFields({targets:()=>[],move:(t,p)=>p,visible:()=>true,clearCenter:()=>false,damage:()=>{}});assert.equal(blocked.spawn(floor),undefined);
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
 const fields=new GravityFields({targets:()=>[body],visible:()=>true,clearCenter:()=>true,damage:()=>{},move:(t,p)=>{body.position=sweepEffectBody(t.position,p,t,[ceiling]);return body.position;}});
 fields.spawn({...floor,point:{x:0,y:4,z:0}});fields.update(.1);assert.ok(fields.snapshot().members[0].velocity.y>0);fields.clear();fields.update(.15);assert.ok(fields.owns(1));for(let i=0;i<240;i++)fields.update(1/120);assert.equal(fields.owns(1),false);assert.ok(Math.abs(body.position.y-1.2)<.001);
});
