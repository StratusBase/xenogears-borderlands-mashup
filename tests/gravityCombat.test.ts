import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as THREE from 'three';
import {createProgression} from '../src/core/index';
import {createWeaponSpec,type WeaponSpec} from '../src/core/arsenal';
import {createStatusState} from '../src/core/statusEffects';
import {createEnemyBrain} from '../src/encounter/enemyBehavior';
import {createNavigationState} from '../src/encounter/navigation';
import {effectWorldSolids,navigationAtHeight} from '../src/world';
import {effectBodyClear,sweepEffectBody} from '../src/core/effects/shared/collision';
import type {TraversalCollider} from '../src/core/ledgeClimb';
import {PlayerBallistics,type BallisticWorldImpact} from '../src/rendering/PlayerBallistics';
import {GRAVITY_COMBAT_POLICY} from '../src/core/effects/gravity/combat';

const css=registerHooks({load(url,context,next){return url.endsWith('.css')?{format:'module',source:'',shortCircuit:true}:next(url,context);}});
const {Game}=await import('../src/game');css.deregister();

/** Actual Game host ports, damage, AI, impact and tick methods; only drawing/UI are inert. */
function fixture(solids:TraversalCollider[]=[],enabled=true){
 const game=Object.create(Game.prototype) as any,scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(0,1.8,8);scene.add(camera);
 const measurements:any[]=[],published:any[]=[],procs:any[]=[],impacts:BallisticWorldImpact[]=[],attacks:{at:number;id:number}[]=[];let draws=0,playerDamage=0;
 Object.assign(game,{scene,camera,enemies:[],projectiles:[],time:0,screen:'none',respawnUntil:0,mode:'pilot',trainingTargets:false,
  world:{traversalColliders:solids,colliders:solids,effectColliders:effectWorldSolids(solids),occluders:[]},
  gravityFieldsEnabled:enabled,enemyFallSpeed:new Map(),ray:new THREE.Raycaster(),progression:createProgression(),waveActive:false,
  bodies:{pilot:{health:10000,shield:0,heat:0,ammo:100,reserve:100,overheated:false}},gamepad:{fire:false},
  testDummy:{id:-1,mesh:new THREE.Group(),statuses:createStatusState(),statusEffects:new Map(),statusCoatings:new Map()},combatRandom:()=>{draws++;return 0;},
  onEvaluationProc:(event:unknown)=>procs.push(event),measure:(event:unknown)=>measurements.push({...event as object,at:game.time}),emitEncounter(){},
  presentation:{gravity:(snapshot:unknown,events:unknown[])=>published.push(structuredClone({snapshot,events})),enemyHit(){},enemyAttack(root:THREE.Group){attacks.push({at:game.time,id:game.enemies.find((e:any)=>e.mesh===root)?.id});},release(){}},
  showEnemyDamage(){},hurtPlayer:(amount:number)=>{playerDamage+=amount;},burst(){},save(){},addDrop(){},addCashDrop(){},addHealthDrop(){},finishMeasurement(){},
  encounter:{snapshot:{phase:'idle'},reset(){},enemyKilled(){}},ui:{clearFeedback(){}},
  updatePlayer(){},updateReloadFoley(){},updateEncounter(){},updateDrops(){},updateRecoveryAction(){},updateEffects(){},updateSimulationPresentation(){},applyWeaponPose(){},
  weaponPose:{advance(){}},weapon:new THREE.Group(),shooting:false,updateProjectiles(){},
 });
 game.gravityCombat=game.createGravityCombat();
 function actor(id:number,x:number,z:number,boss=false,heavy=false){
  const root=new THREE.Group(),half=heavy?2.35:1.3,geometry=new THREE.BoxGeometry(heavy?2.2:1,half*2,.8),material=new THREE.MeshBasicMaterial();
  const mesh=new THREE.Mesh(geometry,material);mesh.position.y=half;mesh.userData.enemyId=id;root.add(mesh);root.position.set(x,0,z);scene.add(root);
  const enemy={id,mesh:root,health:100000,maxHealth:100000,shield:0,maxShield:0,heavy,boss,role:'flanker',home:root.position.clone(),gravityPoint:null,
   brain:createEnemyBrain('flanker',boss,id),navigation:createNavigationState(),lastPhase:'advance',statuses:createStatusState(),statusEffects:new Map(),statusCoatings:new Map(),
   bars:{group:new THREE.Group(),update(){},dispose(){}},visual:{update(){},dispose(){root.removeFromParent();geometry.dispose();material.dispose();}}};
  root.add(enemy.bars.group);game.enemies.push(enemy);root.updateWorldMatrix(true,true);return enemy;
 }
 const ballistics=new PlayerBallistics(scene,{targets:()=>game.enemies.map((e:any)=>({id:e.id,root:e.mesh,radius:e.heavy?1.6:.85})),occluders:()=>game.world.occluders,
  hit:event=>game.onBallisticHit(event),worldImpact:event=>{impacts.push(structuredClone(event));game.onBallisticWorldImpact(event);}});game.ballistics=ballistics;
 function impact(id=1,spec:WeaponSpec=createWeaponSpec('sticky','gravity'),point={x:0,y:5,z:-6},normal={x:0,y:0,z:1}){
  const event:BallisticWorldImpact={projectileId:id,phase:'detonate',spec,point,normal,energy:60,radius:spec.blastRadius};game.onBallisticWorldImpact(event);return event;
 }
 function step(seconds:number){for(let n=0;n<Math.round(seconds*120);n++)game.simulate(1/120);}
 return{game,scene,camera,actor,impact,step,measurements,published,procs,attacks,impacts,get draws(){return draws;},get playerDamage(){return playerDamage;},
  dispose(){ballistics.clear();game.gravityCombat.dispose();for(const e of game.enemies)e.visual.dispose();for(const p of game.projectiles){p.mesh.geometry.dispose();p.mesh.material.dispose();}}};
}

test('production qualification is deliberate; secondary crush is .62 once with equal control and no equipment dependency',()=>{
 const a=fixture(),b=fixture();try{
  for(const type of ['bullet','beam','cluster','homing','disc'] as const)assert.equal(a.game.gravityCombat.qualifies(createWeaponSpec(type,'gravity')),false,type);
  assert.deepEqual(GRAVITY_COMBAT_POLICY.deliveries,['sticky','rocket','orb']);
  for(const type of GRAVITY_COMBAT_POLICY.deliveries)assert.equal(a.game.gravityCombat.qualifies(createWeaponSpec(type,'gravity')),true,type);
  a.impact();b.impact(1,{...createWeaponSpec('sticky','fire'),secondaryElement:'gravity'});
  const first=a.game.gravityDiagnostics.wells[0],second=b.game.gravityDiagnostics.wells[0];assert.equal(second.power,first.power*.62);assert.equal(second.radius,first.radius);assert.equal(second.captureRadius,first.captureRadius);
  const copied=a.game.gravityDiagnostics;copied.wells[0].center.y=-99;assert.notEqual(a.game.gravityDiagnostics.wells[0].center.y,-99);
 }finally{a.dispose();b.dispose();}
});

test('real Game tick deploys smoothly before pull, lifts real bodies/hitboxes, crushes through native damage and publishes once',()=>{
 const f=fixture();try{
  const enemy=f.actor(1,2,-4),boss=f.actor(2,-2,-4,true),heavy=f.actor(3,-3,-4,false,true);f.game.trainingTargets=true;
  f.impact();const start=f.game.gravityDiagnostics.wells[0].center.y;f.step(.1);
  assert.equal(enemy.mesh.position.y,0);assert.equal(f.measurements.filter(e=>e.type==='damage').length,0);
  assert.equal(f.game.gravityDiagnostics.wells[0].age,0);assert.equal(f.published.length,12);
  f.step(2);assert.ok(enemy.mesh.position.y>1);assert.equal(boss.mesh.position.y,0);assert.ok(f.game.gravityDiagnostics.members.some((m:any)=>m.targetId===heavy.id),JSON.stringify({state:f.game.gravityDiagnostics,heavy:heavy.mesh.position}));
  assert.ok(f.measurements.some(e=>e.type==='damage'&&e.source==='status'&&e.health>0));assert.ok(enemy.health<enemy.maxHealth);
  const bounds=new THREE.Box3().setFromObject(enemy.mesh);assert.ok(Math.abs(bounds.min.y-enemy.mesh.position.y)<1e-6);
  assert.equal(f.game.gravityDiagnostics.wells[0].center.y,start);assert.equal(new Set(f.game.gravityDiagnostics.members.map((m:any)=>m.targetId)).size,f.game.gravityDiagnostics.members.length);
  assert.ok(f.published.some(p=>p.events.some((e:any)=>e.kind==='spawn')));assert.ok(f.published.some(p=>p.events.some((e:any)=>e.kind==='pulse')));
  assert.ok(f.game.gravityCombat.status(enemy.id)!.dps>0);
 }finally{f.dispose();}
});

test('ordinary sticky wall contact retains actual fuse/spec and creates a production source without an initial target hit',()=>{
 const f=fixture([{minX:-4,maxX:4,minY:0,maxY:8,minZ:-6.1,maxZ:-5.9}]);try{
  const enemy=f.actor(1,2,-4);f.game.trainingTargets=true;
  const wall=new THREE.Mesh(new THREE.BoxGeometry(8,8,.2),new THREE.MeshBasicMaterial());wall.position.set(0,4,-6);f.scene.add(wall);wall.updateWorldMatrix(true,false);f.game.world.occluders.push(wall);
  const spec={...createWeaponSpec('sticky','gravity'),spread:0},copy=structuredClone(spec);
  f.game.ballistics.fire(new THREE.Vector3(0,4,0),new THREE.Vector3(0,0,-1),spec,60);f.step(.2);
  assert.equal(f.game.gravityDiagnostics.wells.length,0,'contact must not create the well');assert.equal(f.measurements.filter(e=>e.type==='damage').length,0);
  f.step(2);assert.equal(f.game.gravityDiagnostics.activations.spawned,1);assert.ok(enemy.mesh.position.y>.2);assert.deepEqual(spec,copy);
  const source=f.game.gravityDiagnostics.wells[0];assert.ok(source.center.z>-5);assert.ok(source.deployment.elapsed>=source.deployment.duration);
  wall.geometry.dispose();(wall.material as THREE.Material).dispose();
 }finally{f.dispose();}
});

test('qualifying Gravity replaces only the legacy proc while preserving sibling status RNG; bullets deliberately retain legacy pull',()=>{
 for(const delivery of ['sticky','bullet'] as const){const f=fixture();try{
  const enemy=f.actor(1,0,-4);f.actor(2,2,-4);
  const spec={...createWeaponSpec(delivery,'gravity'),secondaryElement:'fire' as const,statusChance:1};
  f.game.onBallisticHit({targetId:enemy.id,point:new THREE.Vector3(0,1.5,-4),direction:new THREE.Vector3(0,0,-1),damage:10,critical:false,spec});
  assert.equal(f.draws,2);assert.ok(enemy.statuses.fire);assert.equal(!!enemy.statuses.gravity,delivery==='bullet');
  assert.equal(f.procs.some(p=>p.element==='gravity'),delivery==='bullet');assert.equal(f.game.gravityDiagnostics.wells.length,0,'hit alone is never a detonation');
 }finally{f.dispose();}}
});

test('held enemies keep authoritative attacks/aim height while AI and direct impulses cannot overwrite field movement',()=>{
 const f=fixture();try{
  const enemy=f.actor(1,2,-4);f.game.trainingTargets=true;f.impact();f.step(2);const position=enemy.mesh.position.clone();
  f.game.trainingTargets=false;enemy.brain.phase='windup';enemy.brain.phaseTime=0;enemy.brain.phaseDuration=0;enemy.brain.aim={x:0,z:8};
  f.game.updateEnemies(1/60);assert.deepEqual(enemy.mesh.position.toArray(),position.toArray());assert.ok(f.game.projectiles.length>0);
  assert.equal(f.game.projectiles[0].mesh.position.y,position.y+1.7);f.game.displaceEnemy(enemy,10,0);assert.deepEqual(enemy.mesh.position.toArray(),position.toArray());
 }finally{f.dispose();}
});

test('another real gun hits the lifted mesh and retains independent native damage while crush continues',()=>{
 const f=fixture();try{
  const enemy=f.actor(1,2,-4);f.game.trainingTargets=true;f.impact();f.step(2);const before=enemy.health;
  const target=enemy.mesh.position.clone().add(new THREE.Vector3(0,1.3,0)),origin=new THREE.Vector3(0,2,5);
  f.game.ballistics.fire(origin,target.sub(origin).normalize(),{...createWeaponSpec('bullet','kinetic'),spread:0},17);f.step(.2);
  assert.ok(f.measurements.some(e=>e.type==='damage'&&e.source==='direct'&&e.health===17));assert.ok(enemy.health<=before-17);
  const then=enemy.health;f.step(.6);assert.ok(enemy.health<then);
 }finally{f.dispose();}
});

test('pause and presentation state cannot advance fields; expiry releases to floor and teardown forgets old bodies',()=>{
 const f=fixture();try{
  const enemy=f.actor(1,2,-4);f.game.trainingTargets=true;f.impact();f.step(2);assert.ok(enemy.mesh.position.y>1);
  const frozen=structuredClone(f.game.gravityDiagnostics);f.game.screen='pause';f.step(1);assert.deepEqual(f.game.gravityDiagnostics,frozen);
  f.game.screen='none';f.game.presentation=undefined;f.step(6);assert.ok(Math.abs(enemy.mesh.position.y)<.001);assert.equal(f.game.gravityDiagnostics.wells.length,0);assert.equal(f.game.gravityDiagnostics.members.length,0);
  f.impact(2);f.step(1);f.game.gravityCombat.reset();assert.deepEqual(f.game.gravityDiagnostics,{enabled:true,wells:[],members:[],activations:{attempts:0,spawned:0}});
 }finally{f.dispose();}
});

test('production world sweep blocks thin walls/ceilings/bounds and raised landings continue to fall after walking off',()=>{
 const platform={minX:-2,maxX:2,minY:0,maxY:2,minZ:-2,maxZ:2},ceiling={minX:-5,maxX:5,minY:7,maxY:7.1,minZ:-5,maxZ:5};
 const f=fixture([platform,ceiling]);try{
  const enemy=f.actor(1,0,0);enemy.mesh.position.y=3;
  for(let i=0;i<240;i++)f.game.settleEnemy(enemy,1/120);assert.ok(Math.abs(enemy.mesh.position.y-2)<.001);
  assert.equal(navigationAtHeight([platform],2,2.6).length,0);enemy.mesh.position.x=4;
  for(let i=0;i<240;i++)f.game.settleEnemy(enemy,1/120);assert.ok(Math.abs(enemy.mesh.position.y)<.001);
  const body={radius:.6,halfHeight:1.3},bounds=effectWorldSolids([{minX:1,maxX:1.01,minZ:-2,maxZ:2,minY:0,maxY:10},ceiling]);
  const hit=sweepEffectBody({x:0,y:2,z:0},{x:10,y:2,z:0},body,bounds);assert.ok(hit.x<.401);assert.ok(effectBodyClear(hit,body,bounds));
  assert.ok(sweepEffectBody({x:0,y:2,z:0},{x:0,y:10,z:0},body,bounds).y<=5.701);
  assert.ok(sweepEffectBody({x:89,y:2,z:10},{x:100,y:2,z:10},body,bounds).x<=89.401);
 }finally{f.dispose();}
});

test('explicit old-prototype option disables new ownership without disabling legacy gravity status',()=>{
 const f=fixture([],false);try{
  const enemy=f.actor(1,0,-4);f.impact();assert.equal(f.game.gravityDiagnostics.wells.length,0);
  f.game.onBallisticHit({targetId:enemy.id,point:new THREE.Vector3(0,1.5,-4),direction:new THREE.Vector3(0,0,-1),damage:10,critical:false,spec:{...createWeaponSpec('sticky','gravity'),statusChance:1}});
  assert.ok(enemy.statuses.gravity);assert.ok(enemy.gravityPoint);assert.equal(f.game.gravityDiagnostics.enabled,false);
 }finally{f.dispose();}
});

test('normal host places floor/wall/underside sources in the same swept world and rejects an obstructed route',()=>{
 for(const surface of [
  {point:{x:0,y:0,z:0},normal:{x:0,y:1,z:0},solids:[]},
  {point:{x:0,y:4,z:-5.9},normal:{x:0,y:0,z:1},solids:[{minX:-4,maxX:4,minY:0,maxY:8,minZ:-6.1,maxZ:-5.9}]},
  {point:{x:0,y:8,z:0},normal:{x:0,y:-1,z:0},solids:[{minX:-4,maxX:4,minY:8,maxY:8.2,minZ:-4,maxZ:4}]},
 ]){const f=fixture(surface.solids);try{
   f.impact(1,createWeaponSpec('rocket','gravity'),surface.point,surface.normal);const first=f.game.gravityDiagnostics.wells[0];assert.ok(first);
   const start={...first.center};f.step(.1);const middle=f.game.gravityDiagnostics.wells[0];
   assert.equal(middle.age,0);assert.notDeepEqual(middle.center,start);assert.notDeepEqual(middle.center,middle.deployment.destination);
   f.step(.2);const final=f.game.gravityDiagnostics.wells[0];assert.deepEqual(final.center,final.deployment.destination);
   assert.ok(effectBodyClear(final.center,{radius:.32,halfHeight:.32},f.game.world.effectColliders));
  }finally{f.dispose();}}
 const blocked=fixture([{minX:-20,maxX:20,minY:0,maxY:20,minZ:-20,maxZ:20}]);try{blocked.impact();assert.equal(blocked.game.gravityDiagnostics.wells.length,0);}finally{blocked.dispose();}
});

test('native crush death credits one kill and cannot resurrect a removed body; combat teardown clears every owner',()=>{
 const f=fixture();try{
  const doomed=f.actor(1,2,-4),survivor=f.actor(2,-2,-4);doomed.health=1;f.game.trainingTargets=true;f.impact();f.step(1.5);
  assert.equal(f.game.progression.kills,1);assert.equal(f.game.enemies.some((e:any)=>e.id===doomed.id),false);
  assert.equal(f.game.gravityDiagnostics.members.some((m:any)=>m.targetId===doomed.id),false);assert.equal(doomed.mesh.parent,null);
  assert.ok(f.game.gravityDiagnostics.members.some((m:any)=>m.targetId===survivor.id));
  f.game.clearCombat();assert.equal(f.game.enemies.length,0);assert.equal(f.game.gravityDiagnostics.wells.length,0);assert.equal(f.game.gravityDiagnostics.members.length,0);
  const replacement=f.actor(3,2,-4);f.step(1);assert.equal(replacement.health,replacement.maxHealth);assert.equal(replacement.mesh.position.y,0);
 }finally{f.dispose();}
});

test('all six normal human wall slots converge without wall clipping, stacking or standing on the wall',()=>{
 const wall={minX:-8,maxX:8,minY:0,maxY:7,minZ:-5.2,maxZ:-5},f=fixture([wall]);try{
  for(let id=1;id<=6;id++)f.actor(id,(id-3.5)*.8,-3.6);
  f.game.trainingTargets=true;f.impact(1,{...createWeaponSpec('sticky','gravity'),blastRadius:2}, {x:0,y:4.4,z:-5});f.step(3.5);
  const snapshot=f.game.gravityDiagnostics;assert.equal(snapshot.members.length,6);assert.ok(snapshot.members.every((m:any)=>m.phase==='held'));
  for(const enemy of f.game.enemies){assert.ok(enemy.mesh.position.y<wall.maxY);assert.ok(effectBodyClear(f.game.gravityTarget(enemy).position,f.game.gravityTarget(enemy),f.game.world.effectColliders));}
  for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)assert.ok(f.game.enemies[i].mesh.position.distanceTo(f.game.enemies[j].mesh.position)>1.2,'body slots retain separation');
 }finally{f.dispose();}
});

test('sustained native crush does not restart a held ranged enemy windup or suppress its actual attack',()=>{
 const f=fixture();try{
  const enemy=f.actor(1,2,-4);f.game.trainingTargets=true;f.impact();f.step(2);
  assert.equal(f.game.gravityDiagnostics.members[0].phase,'held');f.game.trainingTargets=false;
  enemy.brain.phase='advance';enemy.brain.phaseTime=0;enemy.brain.cooldown=0;const began=f.game.time;
  f.step(1.2);
  const shots=f.attacks.filter(a=>a.at>began&&a.id===enemy.id);assert.ok(shots.length>0,'the real enemy brain must finish its >.5s windup and attack');
  const hitTicks=f.measurements.filter(e=>e.type==='damage'&&e.source==='status'&&e.targetId===String(enemy.id)&&e.at>began&&e.at<shots[0].at);
  assert.ok(hitTicks.length>=2,'at least two actual crush damage ticks must land during the windup');
  assert.ok(shots[0].at-began>.8);assert.ok(enemy.health<enemy.maxHealth);assert.equal(f.game.gravityDiagnostics.members[0].phase,'held');
 }finally{f.dispose();}
});

test('direct enemy sticky/rocket/orb contacts detonate through normal callbacks even when the initial hit kills',()=>{
 for(const delivery of ['sticky','rocket','orb'] as const)for(const lethal of [false,true]){
  const f=fixture();try{
   const target=f.actor(1,0,-4);f.actor(2,1.7,-4);if(lethal)target.health=.1;f.game.trainingTargets=true;
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));floor.rotation.x=-Math.PI/2;f.scene.add(floor);floor.updateWorldMatrix(true,false);f.game.world.occluders.push(floor);
   const spec={...createWeaponSpec(delivery,'gravity'),spread:0},copy=structuredClone(spec);
   f.game.ballistics.fire(new THREE.Vector3(0,1.3,4),new THREE.Vector3(0,0,-1),spec,60);
   if(delivery==='sticky'){f.step(.25);assert.equal(f.game.gravityDiagnostics.activations.spawned,0,'sticky contact keeps its fuse');}
   f.step(3);assert.equal(f.game.gravityDiagnostics.activations.spawned,1,`${delivery}, lethal=${lethal}, ${JSON.stringify({impacts:f.impacts,state:f.game.gravityDiagnostics})}`);
   assert.ok(f.measurements.some(e=>e.type==='damage'&&e.source==='direct'&&e.targetId==='1'));
   assert.deepEqual(spec,copy);if(lethal)assert.equal(f.game.enemies.some((e:any)=>e.id===target.id),false);
   floor.geometry.dispose();(floor.material as THREE.Material).dispose();
  }finally{f.dispose();}
 }
});
