import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import glyphs from '../src/rendering/quality/fire/hybridGlyphs.json';
import {createHybridGlyph,createHybridCardGeometry,animateHybridGlyph,hybridContactFrame,FireHybrid,FIRE_HYBRID_CAPACITY,type FireGlyph} from '../src/rendering/quality/fire/hybrid.ts';
import {FirePresentation} from '../src/rendering/quality/fire/presentation.ts';
import {ElementalPresentation} from '../src/rendering/quality/elementalPresentation.ts';
import {PlayerBallistics,type BallisticHit} from '../src/rendering/PlayerBallistics.ts';
import {createWeaponSpec,type ProjectileType} from '../src/core/arsenal.ts';

test('Hybrid flame artwork has complete colored paths, finite triangulation and distinct A and C silhouettes',()=>{
 assert.equal(glyphs.a.length,2);assert.equal(glyphs.c.length,2);assert.equal(glyphs.contact.length,1);
 for(const glyph of [...glyphs.a,...glyphs.c,...glyphs.contact]){
  assert.deepEqual(glyph.layers.map(l=>l.band),[0,1,2,3]);
  for(const layer of glyph.layers)for(const path of layer.paths){assert.equal(path[0][0],'M');assert.equal(path.at(-1)![0],'Z');assert.ok(path.flatMap(c=>c.slice(1)).every(Number.isFinite));}
  const geometry=createHybridGlyph(glyph as FireGlyph);assert.ok(geometry.attributes.position.count>12&&geometry.attributes.position.count<60000);assert.ok(Array.from(geometry.attributes.position.array).every(Number.isFinite));geometry.dispose();
 }
 assert.notDeepEqual(glyphs.a,glyphs.c);
});
test('The actual hybrid mesh bends fork tips through unequal curved paths, while contact roots remain fixed',()=>{
 for(const explosive of [false,true]){
  const g=createHybridCardGeometry();animateHybridGlyph(g,.07,.6,explosive);const first=Array.from(g.attributes.position.array);animateHybridGlyph(g,.23,.6,explosive);const second=Array.from(g.attributes.position.array);assert.notDeepEqual(first,second);assert.ok(second.every(Number.isFinite));
  const rest=g.userData.rest as Float32Array;for(let i=0;i<rest.length;i+=3)if(Math.abs(rest[i])+Math.abs(rest[i+1])<.000001){assert.equal(second[i],0);assert.equal(second[i+1],0);}
  const ratios=second.map((v,i)=>Math.abs(first[i])>.03?v/first[i]:NaN).filter(Number.isFinite);assert.ok(Math.max(...ratios)-Math.min(...ratios)>.1);g.dispose();
 }
});
test('Hybrid cards use a support-safe camera basis and bind to the visible source without changing it',()=>{
 const camera=new THREE.PerspectiveCamera();camera.position.set(0,2,5);camera.lookAt(0,1.4,0);
 for(const normal of [new THREE.Vector3(0,0,1),new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),new THREE.Vector3(0,.7,.7).normalize()]){
  const rotation=hybridContactFrame(camera,new THREE.Vector3(),normal),right=new THREE.Vector3(1,0,0).applyQuaternion(rotation),rise=new THREE.Vector3(0,1,0).applyQuaternion(rotation);assert.ok(Math.abs(right.dot(normal))<.00001);assert.ok(rise.dot(normal)>.10);assert.ok(rotation.toArray().every(Number.isFinite));
 }
 const scene=new THREE.Scene(),source=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());scene.add(source);const layer=new FireHybrid(scene,camera),geometry=source.geometry,material=source.material,raycast=source.raycast;
 layer.emit(new THREE.Vector3(0,0,.5),new THREE.Vector3(0,0,1),.7,false,0,source);layer.update(.1);const group=layer.group.children[0],before=group.position.clone();source.position.x=2;layer.update(.02);assert.ok(group.position.x-before.x>1.99);assert.equal(source.geometry,geometry);assert.equal(source.material,material);assert.equal(source.raycast,raycast);
 const live=(group.children as THREE.Mesh[]).filter(m=>m.visible);assert.ok(live.length>=2);for(const card of live){assert.equal(card.material instanceof THREE.ShaderMaterial,true);assert.equal((card.material as THREE.ShaderMaterial).depthWrite,false);assert.equal((card.material as THREE.ShaderMaterial).uniforms.support.value.z,1);}
 layer.dispose();assert.equal(source.geometry,geometry);assert.equal(source.material,material);
});
test('Hybrid primary pools are bounded, paused state is immutable and resources clear completely',()=>{
 const scene=new THREE.Scene(),layer=new FireHybrid(scene,new THREE.PerspectiveCamera());for(let i=0;i<40;i++)layer.emit(new THREE.Vector3(),new THREE.Vector3(0,0,1),.7,i%2===0,i);
 assert.equal(layer.activeCount,FIRE_HYBRID_CAPACITY);layer.update(.1);const before=layer.group.children.map(g=>g.children.map(m=>Array.from((m as THREE.Mesh).geometry.attributes.position.array)));layer.update(0);layer.update(NaN);assert.deepEqual(layer.group.children.map(g=>g.children.map(m=>Array.from((m as THREE.Mesh).geometry.attributes.position.array))),before);layer.clear();assert.equal(layer.activeCount,0);assert.ok(layer.group.children.every(g=>!g.visible));layer.dispose();layer.dispose();assert.equal(layer.group.parent,null);
});

for(const projectile of ['bullet','slug','spike','ricochet','homing','sticky','orb','beam','scatter','rocket','disc','arc','cluster'] as ProjectileType[])test(`Hybrid A+C keeps exact ${projectile} combat, slot ownership and source geometry`,()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){}})})}});
 try{
  function replay(hybrid:boolean){const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),root=new THREE.Group(),plate=new THREE.Mesh(new THREE.BoxGeometry(1,1,.15),new THREE.MeshBasicMaterial());plate.position.set(0,0,-5);plate.userData.effectSurface='armor';root.add(plate);scene.add(root);
   const equipment=new THREE.Group();equipment.userData.equipmentSlot='weapon';const weapon=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());weapon.position.z=-3;equipment.add(weapon);root.add(equipment);weapon.updateMatrix();const geometry=weapon.geometry,material=weapon.material,matrix=weapon.matrix.clone();
   const presentation=hybrid?new FirePresentation(scene,camera,{hybrid:true}):new ElementalPresentation(scene,camera,{corrosiveAB:true});const hits:unknown[]=[],positions:unknown[]=[];
   const simulation=new PlayerBallistics(scene,{targets:()=>[{id:9,root,radius:1}],occluders:()=>[],hit:(hit:BallisticHit)=>hits.push({point:hit.point.toArray(),direction:hit.direction.toArray(),damage:hit.damage,spec:hit.spec,critical:hit.critical})});simulation.setPresentation(presentation);const spec=createWeaponSpec(projectile,'fire','pilot');spec.secondaryElement='corrosive';const recipe=JSON.stringify(spec);simulation.fire(new THREE.Vector3(),new THREE.Vector3(0,0,-1),spec,20,50);
   for(let i=0;i<300;i++){simulation.update(1/120);presentation.update(1/120,i/120,false,spec,'pilot');positions.push(scene.children.filter(o=>o.name.startsWith('quality-projectile-')).map(o=>o.position.toArray()));}
   assert.equal(JSON.stringify(spec),recipe);assert.equal(weapon.geometry,geometry);assert.equal(weapon.material,material);assert.deepEqual(weapon.matrix,matrix);assert.equal(weapon.children.length,0);simulation.clear();presentation.dispose();return{hits,positions};
  }
  assert.deepEqual(replay(true),replay(false));
 }finally{if(original)Object.defineProperty(globalThis,'document',original);else Reflect.deleteProperty(globalThis,'document');}
});
test('Hybrid C requires the real explosive detonation, and secondary splash never gets primary art',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){}})})}});
 try{const scene=new THREE.Scene(),root=new THREE.Group(),plate=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());plate.userData.effectSurface='armor';root.add(plate);scene.add(root);const layer=new FirePresentation(scene,new THREE.PerspectiveCamera(),{hybrid:true}),spec=createWeaponSpec('sticky','fire','pilot');const e={target:root,point:new THREE.Vector3(0,0,.5),normal:new THREE.Vector3(0,0,1),radius:2.5,spec,energy:28};
  layer.splash!({...e,phase:'detonate',origin:new THREE.Vector3(0,0,1),primary:false,exposure:.4});assert.equal(layer.fire.hybrid!.activeCount,0);layer.impact({...e,phase:'contact'});assert.equal(layer.fire.events.at(-1)!.explosive,false);layer.impact({...e,phase:'detonate'});assert.equal(layer.fire.events.at(-1)!.explosive,true);assert.equal(layer.fire.hybrid!.activeCount,2);layer.dispose();
 }finally{if(original)Object.defineProperty(globalThis,'document',original);else Reflect.deleteProperty(globalThis,'document');}
});

test('Preparing Fire restores the renderer target and adds no shot, status or source-body overlay',async()=>{
 const {FireResponse}=await import('../src/rendering/quality/fire/response.ts');const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),source=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());scene.add(source);const layer=new FireResponse(scene,camera,{hybrid:true}),children=[...scene.children],previous=new THREE.WebGLRenderTarget(2,2);let target:THREE.WebGLRenderTarget|null=previous;const compiled:THREE.Object3D[]=[];
 const renderer={initTexture(){},getRenderTarget:()=>target,setRenderTarget:(value:THREE.WebGLRenderTarget|null)=>{target=value;},compileAsync:async(object:THREE.Object3D)=>{compiled.push(object);return object;}} as unknown as THREE.WebGLRenderer;
 await layer.prepare(renderer,scene);assert.equal(target,previous);assert.equal(compiled.length,2);assert.equal(compiled[0],scene);assert.deepEqual(scene.children,children);assert.equal(source.children.length,0);assert.equal(layer.events.length,0);assert.equal(layer.diagnostics.statuses,0);assert.equal(layer.hybrid!.activeCount,0);await layer.prepare(renderer,scene);assert.equal(compiled.length,2);layer.dispose();previous.dispose();
});
