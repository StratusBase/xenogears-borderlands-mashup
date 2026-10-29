import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { corrosiveSizing } from '../src/rendering/quality/corrosive/sizing.ts';
import { CorrosiveResponse } from '../src/rendering/quality/corrosive/liquid.ts';
import { PlayerBallistics,type BallisticPresentationSplash } from '../src/rendering/PlayerBallistics.ts';
import { createWeaponSpec } from '../src/core/arsenal.ts';
import { ElementalPresentation } from '../src/rendering/quality/elementalPresentation.ts';
import { corrosiveABAudioRecipe } from '../src/audio/corrosiveAudio.ts';
import { CorrosiveStatus,nearestCorrosiveSurface } from '../src/rendering/quality/corrosive/surfaces.ts';

test('detonation size and particle budget respond to actual blast radius and energy within visual limits',()=>{
 const small=corrosiveSizing({projectile:'sticky',phase:'detonate',radius:.5,energy:20}),large=corrosiveSizing({projectile:'sticky',phase:'detonate',radius:4,energy:100}),capped=corrosiveSizing({projectile:'sticky',phase:'detonate',radius:1e8,energy:1e9});
 assert.ok(large.sheetRadius>small.sheetRadius*1.5);assert.ok(large.dropSize>small.dropSize);assert.ok(large.dropCount>small.dropCount);assert.ok(capped.sheetRadius<2.3&&capped.dropCount<=39);assert.ok(Object.values(capped).every(Number.isFinite));
});
test('secondary splash deposition is smaller with falloff and never instantiates a second full wave',()=>{
 const direct=corrosiveSizing({projectile:'sticky',phase:'detonate',radius:2.5,energy:70}),near=corrosiveSizing({projectile:'sticky',phase:'contact',radius:2.5,energy:35,exposure:.5,secondaryTarget:true}),edge=corrosiveSizing({projectile:'sticky',phase:'contact',radius:2.5,energy:8.4,exposure:.12,secondaryTarget:true});
 for(const splash of[near,edge]){assert.equal(splash.sheetRadius,0);assert.equal(splash.residueRadius,0);assert.ok(splash.coatingRadius<direct.coatingRadius*.35);assert.ok(splash.dropCount<direct.dropCount*.35);assert.ok(splash.dropSize<direct.dropSize);}
 assert.ok(edge.coatingRadius<near.coatingRadius&&edge.dropCount<near.dropCount&&edge.bubbleSize<near.bubbleSize);
});
test('target size and channel weight constrain coating while zero exposure produces no response',()=>{
 const normal=corrosiveSizing({projectile:'bullet',phase:'contact',radius:.3,energy:20,targetSpan:2}),tiny=corrosiveSizing({projectile:'bullet',phase:'contact',radius:.3,energy:20,targetSpan:.1}),secondary=corrosiveSizing({projectile:'bullet',phase:'contact',radius:.3,energy:20,channelWeight:.62});assert.ok(tiny.coatingRadius<=.0421);assert.ok(secondary.sheetRadius<normal.sheetRadius&&secondary.dropCount<normal.dropCount);
 const zero=corrosiveSizing({projectile:'sticky',phase:'contact',radius:3,exposure:0,secondaryTarget:true});assert.equal(zero.dropCount,0);assert.equal(zero.coatingRadius,0);
 for(const value of[NaN,Infinity,-Infinity])assert.ok(Object.values(corrosiveSizing({projectile:'bullet',phase:'contact',radius:value,energy:value,exposure:value})).every(Number.isFinite));
});
test('tiny coating radii remain world-unit radii on non-uniformly scaled display meshes',()=>{
 const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshBasicMaterial());mesh.scale.set(.1,3,.1);mesh.userData.corrosiveSurface='skin';root.add(mesh);const status=new CorrosiveStatus(root);status.contact(new THREE.Vector3(0,0,.1),.012,mesh);
 assert.equal(status.bindings[0].radii[0],.012,'must not inflate a small secondary patch to the old minimum .05 or divide it by the thinnest scale');assert.deepEqual(status.bindings[0].material.uniforms.metric.value.toArray(),[.1,3,.1]);status.dispose();
});
test('a small secondary mark lands on actual display triangles when the broad proxy projection misses',()=>{
 const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(.8,.6,.16),new THREE.MeshBasicMaterial());mesh.userData.corrosiveSurface='armor';mesh.raycast=()=>{};mesh.rotation.y=.2;root.add(mesh);
 const contact=nearestCorrosiveSurface(root,new THREE.Vector3(.8,0,.35),new THREE.Vector3(1,0,0));assert.equal(contact.source,mesh);assert.ok(contact.point.distanceTo(new THREE.Vector3(.8,0,.35))>.1);
 const status=new CorrosiveStatus(root);status.contact(contact.point.clone().addScaledVector(contact.normal,.012),.07,contact.source);assert.equal(status.bindings[0].mesh.visible,true);assert.equal(contact.surface,'armor');status.dispose();
});
test('actual unoccluded blast recipients receive their exact damage fraction; blocked targets receive no splash event',()=>{
 const scene=new THREE.Scene(),targets:{id:number;root:THREE.Group;radius:number}[]=[],covers:THREE.Object3D[]=[],hits:{id:number;damage:number}[]=[],events:BallisticPresentationSplash[]=[];
 for(const[id,x]of[[1,0],[2,1.2],[3,2.8],[4,-1.2]]){const root=new THREE.Group();root.position.set(x,1,-3);const mesh=new THREE.Mesh(new THREE.BoxGeometry(.6,.6,.6),new THREE.MeshBasicMaterial());mesh.userData.enemyId=id;root.add(mesh);scene.add(root);targets.push({id,root,radius:.4});}
 const wall=new THREE.Mesh(new THREE.BoxGeometry(.1,2,1),new THREE.MeshBasicMaterial());wall.position.set(-.5,1,-2.7);scene.add(wall);covers.push(wall);
 const layer=new ElementalPresentation(scene,new THREE.PerspectiveCamera(),{corrosiveAB:true}),capture=layer.splash!.bind(layer);
 const adapter={projectile:layer.projectile.bind(layer),trail:layer.trail.bind(layer),beam:layer.beam.bind(layer),impact:layer.impact.bind(layer),splash:(e:BallisticPresentationSplash)=>{events.push(e);capture(e);}};
 const ballistics=new PlayerBallistics(scene,{targets:()=>targets,occluders:()=>covers,hit:hit=>hits.push({id:hit.targetId,damage:hit.damage})});ballistics.setPresentation(adapter);const spec=createWeaponSpec('rocket','corrosive');spec.blastRadius=3;spec.spread=0;ballistics.fire(new THREE.Vector3(0,1,2),new THREE.Vector3(0,0,-1),spec,70);
 for(let i=0;i<180;i++)ballistics.update(1/120);
 assert.equal(events.length,2);assert.equal(events.some(e=>e.target===targets[3].root),false);for(const e of events){const id=targets.find(t=>t.root===e.target)!.id;assert.equal(e.energy,hits.find(h=>h.id===id)!.damage);assert.equal(e.exposure,e.energy/70);assert.equal(e.primary,false);}
 assert.ok(events[0].exposure>events[1].exposure);const reactions=layer.corrosive!.events.filter(e=>e.role==='splash');assert.equal(reactions.length,2);assert.ok(reactions.every(e=>e.size===0));assert.ok(reactions[0].coatingRadius>reactions[1].coatingRadius);ballistics.clear();layer.dispose();
});
test('one epicentre burst is kept for a sticky blast while all secondary recipients get only deposition',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());mesh.userData.corrosiveSurface='armor';root.add(mesh);scene.add(root);const response=new CorrosiveResponse(scene),spec=createWeaponSpec('sticky','corrosive');
 response.impact({point:new THREE.Vector3(0,0,.5),normal:new THREE.Vector3(0,0,1),target:root,spec,radius:2.5,phase:'detonate',energy:70});const burstCount=response.diagnostics.bursts;
 response.splash({point:new THREE.Vector3(0,0,.5),normal:new THREE.Vector3(0,0,1),target:root,origin:new THREE.Vector3(0,0,1),spec,radius:2.5,phase:'contact',energy:70,exposure:1,primary:true});assert.equal(response.diagnostics.bursts,burstCount);
 response.splash({point:new THREE.Vector3(0,0,.5),normal:new THREE.Vector3(0,0,1),target:root,origin:new THREE.Vector3(0,0,1),spec,radius:2.5,phase:'contact',energy:14,exposure:.2,primary:false});assert.equal(response.diagnostics.bursts,burstCount);assert.equal(response.events.at(-1)!.role,'splash');response.dispose();
});
test('a neighbor removed by an earlier blast callback receives neither damage nor splash feedback',()=>{
 const scene=new THREE.Scene(),targets:{id:number;root:THREE.Group;radius:number}[]=[],events:number[]=[],hits:number[]=[];
 for(const[id,x]of[[1,1],[2,-1]]){const root=new THREE.Group();root.position.set(x,1,0);const mesh=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5),new THREE.MeshBasicMaterial());mesh.userData.enemyId=id;root.add(mesh);scene.add(root);targets.push({id,root,radius:.3});}
 const ballistics=new PlayerBallistics(scene,{targets:()=>targets,occluders:()=>[],hit:hit=>{hits.push(hit.targetId);if(hit.targetId===1){targets[1].root.removeFromParent();targets.splice(1,1);}}});
 ballistics.setPresentation({projectile:()=>new THREE.Group(),trail:()=>new THREE.Group(),beam:()=>new THREE.Group(),impact(){},splash:e=>events.push(targets.find(t=>t.root===e.target)?.id??-1)});const spec=createWeaponSpec('orb','corrosive');spec.speed=20;spec.fuse=.1;spec.blastRadius=3;spec.spread=0;ballistics.fire(new THREE.Vector3(0,1,2),new THREE.Vector3(0,0,-1),spec,70);for(let i=0;i<30;i++)ballistics.update(1/120);assert.deepEqual(hits,[1]);assert.deepEqual(events,[1]);ballistics.clear();
});
test('a secondary wet contact sound has fewer voices and no epicentre bass transient',()=>{
 const primary=corrosiveABAudioRecipe('corrosive','impact',{delivery:'sticky'}),splash=corrosiveABAudioRecipe('corrosive','impact',{delivery:'sticky',splash:true});assert.ok(splash.length<primary.length);assert.ok(splash.every(v=>v.frequency>400&&v.gain<.1&&v.duration<=.2));
});
