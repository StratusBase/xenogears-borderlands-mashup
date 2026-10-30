import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {PlayerBallistics,type BallisticWorldImpact} from '../src/rendering/PlayerBallistics';
import {createWeaponSpec} from '../src/core/arsenal';
import {GravityFields} from '../src/core/effects/gravity/field';
import {GravityActivation} from '../src/core/effects/gravity/activation';
import {effectBodyClear,effectBodyPathClear,effectLineClear,sweepEffectBody} from '../src/core/effects/shared/collision';

test('real world-only sticky collision starts the same field without a renderer; preserves fuse and immutable spec',()=>{
 const scene=new THREE.Scene(),wall=new THREE.Mesh(new THREE.BoxGeometry(8,8,.2),new THREE.MeshBasicMaterial());wall.position.set(0,3,-4);scene.add(wall);wall.updateMatrixWorld();
 const fields=new GravityFields({targets:()=>[],move:(_t,p)=>p,visible:()=>true,clearCenter:()=>true,clearSourcePath:()=>true,damage:()=>{throw new Error('No target should take damage');}}),activation=new GravityActivation(fields),events:BallisticWorldImpact[]=[];
 const ballistics=new PlayerBallistics(scene,{targets:()=>[],occluders:()=>[wall],hit:()=>{throw new Error('World impact must not manufacture a target hit');}});
 ballistics.setWorldImpactHandler(e=>{assert.ok(Object.isFrozen(e));assert.ok(Object.isFrozen(e.point));assert.ok(Object.isFrozen(e.spec));events.push(e);activation.impact(e);});
 const spec={...createWeaponSpec('sticky','gravity'),spread:0},copy=structuredClone(spec);ballistics.fire(new THREE.Vector3(0,3,0),new THREE.Vector3(0,0,-1),spec,60);
 ballistics.update(.15);assert.equal(events.length,1);assert.equal(events[0].phase,'contact');assert.equal(fields.snapshot().wells.length,0);
 for(let i=0;i<180;i++)ballistics.update(1/120);assert.equal(events.filter(e=>e.phase==='detonate').length,1);assert.equal(events[0].projectileId,events[1].projectileId);
 assert.equal(fields.snapshot().wells.length,1);assert.ok(fields.snapshot().wells[0].deployment!.destination.z>-3);assert.deepEqual(spec,copy);ballistics.clear();fields.dispose();wall.geometry.dispose();(wall.material as THREE.Material).dispose();
});
test('an actually lifted collision target remains hittable by a different real gun while gravity crush continues',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(.8,2.4,.8),new THREE.MeshBasicMaterial());mesh.userData.enemyId=7;root.add(mesh);scene.add(root);root.position.set(2,1.2,-3);
 let health=200,crush=0,gun=0;
 const fields=new GravityFields({targets:()=>[{id:7,position:{x:root.position.x,y:root.position.y,z:root.position.z},radius:.4,halfHeight:1.2,alive:health>0}],clearCenter:c=>effectBodyClear(c,{radius:.24,halfHeight:.24},[]),clearSourcePath:(a,b,r)=>effectBodyPathClear(a,b,{radius:r,halfHeight:r},[]),visible:(c,t)=>effectLineClear(c,t.position,[]),move:(t,p)=>{const q=sweepEffectBody(t.position,p,t,[]);root.position.set(q.x,q.y,q.z);root.updateWorldMatrix(true,true);return q;},damage:(_id,n)=>{health-=n;crush+=n;}});
 fields.spawn({id:'lift',ownerId:'pilot',point:{x:0,y:3.6,z:-4},normal:{x:0,y:0,z:1}});for(let i=0;i<240;i++)fields.update(1/120);assert.ok(root.position.y>2.0);assert.ok(crush>0);const before=health;
 const b=new PlayerBallistics(scene,{targets:()=>[{id:7,root,radius:1.2}],occluders:()=>[],hit:e=>{health-=e.damage;gun+=e.damage;}});
 const origin=new THREE.Vector3(0,1.8,5),aim=root.position.clone().sub(origin).normalize();b.fire(origin,aim,{...createWeaponSpec('bullet','kinetic'),spread:0},17);for(let i=0;i<25;i++)b.update(1/120);
 assert.equal(gun,17);assert.equal(health,before-17);assert.equal(fields.snapshot().members[0].phase,'held');const earlier=crush;for(let i=0;i<80;i++)fields.update(1/120);assert.ok(crush>earlier);assert.ok(health<before-17);b.clear();fields.dispose();mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();
});
