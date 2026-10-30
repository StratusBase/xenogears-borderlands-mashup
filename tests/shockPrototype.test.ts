import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { shockSizing } from '../src/rendering/quality/shock/sizing.ts';
import { ShockResponse,SHOCK_CAPACITY } from '../src/rendering/quality/shock/response.ts';
import { ShockSurface } from '../src/rendering/quality/shock/surface.ts';
import { ShockPresentation } from '../src/rendering/quality/shock/ShockPresentation.ts';
import { shockPathPoint,createShockFan,animateShockFan } from '../src/rendering/quality/shock/paths.ts';
import { createWeaponSpec } from '../src/core/arsenal.ts';
import { PlayerBallistics } from '../src/rendering/PlayerBallistics.ts';
import { ElementalPresentation } from '../src/rendering/quality/elementalPresentation.ts';
import { shockABAudioRecipe } from '../src/audio/shockAudio.ts';
import { corrosiveABAudioRecipe } from '../src/audio/corrosiveAudio.ts';

function target(scene:THREE.Scene,kind='cloth',id=1,x=0){
 const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(.8,.8,.28),new THREE.MeshBasicMaterial({color:0x665060}));mesh.userData.corrosiveSurface=kind;mesh.userData.enemyId=id;mesh.name=`${kind}-front`;root.position.set(x,1.5,-3);root.add(mesh);scene.add(root);scene.updateMatrixWorld(true);return{root,mesh,id,radius:.45};
}
test('C is gated by actual heavy detonation, never rifle, sticky contact or secondary roles',()=>{
 for(const projectile of ['sticky','rocket','orb','cluster','homing'] as const){
  assert.equal(shockSizing({projectile,phase:'detonate',radius:2.5,energy:70}).heavy,true);
  for(const phase of ['contact','detonate'] as const)for(const role of ['splash','chain'] as const)assert.equal(shockSizing({projectile,phase,radius:4,energy:100,role}).heavy,false);
  assert.equal(shockSizing({projectile,phase:'contact',radius:3,energy:100}).heavy,false);
 }
 assert.equal(shockSizing({projectile:'bullet',phase:'detonate',radius:5,energy:100}).heavy,false);
 assert.equal(shockSizing({projectile:'rocket',phase:'detonate',radius:2,energy:20}).heavy,false);
});
test('secondary contact size follows existing exposure and channel weight without a second heavy burst',()=>{
 const primary=shockSizing({projectile:'sticky',phase:'detonate',radius:2.5,energy:70});
 const near=shockSizing({projectile:'sticky',phase:'contact',radius:2.5,energy:35,exposure:.5,role:'splash'}),edge=shockSizing({projectile:'sticky',phase:'contact',radius:2.5,energy:7,exposure:.1,role:'splash'});
 assert.ok(near.reach<primary.reach*.3&&near.patch<primary.patch*.5);assert.ok(edge.reach<near.reach&&edge.patch<near.patch&&edge.sparks<near.sparks);assert.equal(near.heavy,false);
 const secondary=shockSizing({projectile:'bullet',phase:'contact',radius:.3,energy:25,channelWeight:.62});assert.ok(secondary.reach<shockSizing({projectile:'bullet',phase:'contact',radius:.3,energy:25}).reach);
});
test('invalid/zero sizing inputs stay finite, bounded and non-emitting at zero exposure',()=>{
 for(const value of [NaN,Infinity,-Infinity]){const size=shockSizing({projectile:'rocket',phase:'detonate',radius:value,energy:value,exposure:value});assert.ok(Object.values(size).filter(v=>typeof v==='number').every(Number.isFinite));assert.ok(size.reach<2.5);}
 for(const zero of [{energy:0},{exposure:0},{channelWeight:0}])assert.equal(shockSizing({projectile:'bullet',phase:'contact',radius:.3,...zero}).paths,0);
});
test('leaders deform with time and stay outside their support frame on every lane',()=>{
 const first=new THREE.Vector3(),second=new THREE.Vector3();
 for(let lane=0;lane<5;lane++)for(let step=0;step<=40;step++)for(let i=0;i<=9;i++){
  shockPathPoint(first,lane,i/9,step*.01,1.3,1.2,.024);assert.ok(first.z>.06);assert.ok(first.toArray().every(Number.isFinite));
 }
 shockPathPoint(first,0,.55,.10,1.3,1,.014);shockPathPoint(second,0,.55,.20,1.3,1,.014);assert.ok(first.distanceTo(second)>.01);
});
test('heavy fan actually deforms and has no points behind its contact plane',()=>{
 const fan=createShockFan();animateShockFan(fan,.08,.7,1.2);const before=Float32Array.from(fan.geometry.attributes.position.array);
 animateShockFan(fan,.19,.7,1.2);assert.notDeepEqual(fan.geometry.attributes.position.array,before);
 for(let age=.01;age<.4;age+=.025){animateShockFan(fan,age,.7,1.2);const p=fan.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok(p.getZ(i)>.02);}
 fan.geometry.dispose();fan.material.dispose();
});
test('charge overlays borrow visible geometry and never acquire equipment or hidden proxy surfaces',()=>{
 const scene=new THREE.Scene(),{root,mesh}=target(scene);const armor=new THREE.Mesh(new THREE.BoxGeometry(.9,.85,.1),new THREE.MeshBasicMaterial());armor.name='outer-breastplate';armor.position.z=.20;armor.userData.corrosiveSurface='armor';root.add(armor);
 const weapon=new THREE.Group();weapon.userData.equipmentSlot='weapon';weapon.userData.visualOwner='weapon';const part=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());part.userData.corrosiveSurface='armor';weapon.add(part);root.add(weapon);
 const proxy=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false}));proxy.userData.enemyId=1;root.add(proxy);
 const material=mesh.material,geometry=mesh.geometry;let disposed=0;geometry.addEventListener('dispose',()=>disposed++);
 const layer=new ShockResponse(scene,new THREE.PerspectiveCamera()),spec=createWeaponSpec('bullet','shock');layer.impact({target:root,point:new THREE.Vector3(0,1.5,-2.6),normal:new THREE.Vector3(0,0,1),spec,radius:.3,phase:'contact',energy:25});
 const visual=layer.status(root);visual.update(.1);assert.equal(layer.events[0].surface,'armor');assert.equal(layer.events[0].source,'outer-breastplate');
 assert.ok(visual.bindings.every(b=>b.source!==part&&b.source!==proxy));assert.deepEqual(visual.bindings.filter(b=>b.mesh.visible).map(b=>b.source),[armor]);assert.equal(mesh.material,material);assert.equal(mesh.geometry,geometry);
 layer.dispose();assert.equal(disposed,0);assert.equal(mesh.material,material);
});
test('small surface patches stay in world units on moving non-uniform meshes',()=>{
 const scene=new THREE.Scene(),{root,mesh}=target(scene);mesh.scale.set(.1,3,.2);root.updateMatrixWorld(true);const point=mesh.localToWorld(new THREE.Vector3(0,0,.14));
 const visual=new ShockSurface(root);visual.contact(point,new THREE.Vector3(0,0,1),.035,mesh,1.3);visual.update(.1);
 const u=visual.bindings[0].material.uniforms;assert.equal(u.radii.value[0],.035);const old=u.centers.value[0].clone();root.position.x+=2;visual.update(.1);assert.ok(u.centers.value[0].distanceTo(old.clone().add(new THREE.Vector3(2,0,0)))<1e-6);
 const age=u.ages.value[0];visual.update(0);assert.equal(u.ages.value[0],age);visual.dispose();
});
test('a narrow armor-rib origin charges adjacent visible plate, while the shirt remains excluded',()=>{
 const scene=new THREE.Scene(),{root,mesh:shirt}=target(scene),plate=new THREE.Mesh(new THREE.BoxGeometry(.8,.7,.1),new THREE.MeshBasicMaterial()),rib=new THREE.Mesh(new THREE.BoxGeometry(.05,.5,.04),new THREE.MeshBasicMaterial());
 plate.position.z=.2;rib.position.z=.28;plate.userData.corrosiveSurface=rib.userData.corrosiveSurface='armor';root.add(plate,rib);root.updateMatrixWorld(true);
 const visual=new ShockSurface(root);visual.contact(rib.getWorldPosition(new THREE.Vector3()),new THREE.Vector3(0,0,1),.4,rib);visual.update(.1);
 const visible=visual.bindings.filter(b=>b.mesh.visible).map(b=>b.source);assert.ok(visible.includes(plate)&&visible.includes(rib));assert.equal(visible.includes(shirt),false);visual.dispose();
});
test('pausing the opt-in adapter freezes path matrices and surface ages; resume and disposal remain finite',()=>{
 const scene=new THREE.Scene(),{root}=target(scene),layer=new ShockPresentation(scene,new THREE.PerspectiveCamera()),spec=createWeaponSpec('bullet','shock');
 layer.impact({target:root,point:new THREE.Vector3(0,1.5,-2.8),normal:new THREE.Vector3(0,0,1),spec,radius:.3,phase:'contact',energy:25});const status=layer.status(root,'shock');status.update(.05);layer.update(.05,1,false,spec,'pilot');
 const before=layer.shock.segments.meshes.map(m=>Array.from(m.instanceMatrix.array));layer.update(.2,1,true,spec,'pilot');assert.deepEqual(layer.shock.segments.meshes.map(m=>Array.from(m.instanceMatrix.array)),before);layer.update(.02,1.02,false,spec,'pilot');assert.notDeepEqual(layer.shock.segments.meshes.map(m=>Array.from(m.instanceMatrix.array)),before);layer.dispose();
});
test('world charge uses actual elevated support and expires without disposing the world surface',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(0,4,3);const source=new THREE.Mesh(new THREE.BoxGeometry(3,.5,3),new THREE.MeshBasicMaterial());source.position.y=2;scene.add(source);source.updateWorldMatrix(true,false);
 let disposed=0;source.geometry.addEventListener('dispose',()=>disposed++);const layer=new ShockResponse(scene,camera),spec=createWeaponSpec('sticky','shock');
 layer.impact({point:new THREE.Vector3(0,2.25,0),normal:new THREE.Vector3(0,1,0),hitSurface:source,spec,radius:2.5,phase:'detonate',energy:70});
 let overlay:THREE.Mesh|undefined;source.traverse(o=>{if(o instanceof THREE.Mesh&&o.name==='shock-local-charge-overlay')overlay=o;});assert.ok(overlay);assert.equal((overlay.material as THREE.ShaderMaterial).uniforms.centers.value[0].y,2.25);
 for(let i=0;i<150;i++)layer.update(1/60);assert.equal(layer.diagnostics.worldSurfaces,0);assert.equal(source.children.length,0);layer.dispose();assert.equal(disposed,0);
});
test('fixed pools remain bounded during repeated hits and clear stops every presentation resource',()=>{
 const scene=new THREE.Scene(),{root}=target(scene),layer=new ShockResponse(scene,new THREE.PerspectiveCamera()),spec=createWeaponSpec('sticky','shock');
 for(let i=0;i<400;i++){layer.impact({point:new THREE.Vector3(0,1.5,-2.8),normal:new THREE.Vector3(0,0,1),target:root,spec,radius:2.5,phase:'detonate',energy:70});layer.update(1/120);}
 assert.ok(layer.diagnostics.bolts<=SHOCK_CAPACITY.bolts);assert.ok(layer.diagnostics.segments<=SHOCK_CAPACITY.segments);assert.equal(layer.events.length,SHOCK_CAPACITY.eventHistory);
 const diagnostics={...layer.diagnostics};layer.update(0);assert.deepEqual(layer.diagnostics,diagnostics);layer.clear();assert.equal(layer.diagnostics.bolts,0);assert.equal(layer.diagnostics.segments,0);assert.equal(layer.events.length,0);layer.dispose();
});
test('explicit confirmed-chain rendering is small, has no heavy fan and cannot mutate event/spec/targets',()=>{
 const scene=new THREE.Scene(),{root}=target(scene),layer=new ShockPresentation(scene,new THREE.PerspectiveCamera()),spec=createWeaponSpec('bullet','shock'),start=new THREE.Vector3(-2,1.5,-2.8),end=new THREE.Vector3(0,1.5,-2.8);
 const prior={start:start.toArray(),end:end.toArray(),spec:structuredClone(spec),matrix:root.matrix.toArray()};layer.confirmedChain({start,end,target:root,spec,energy:7,exposure:.35});layer.update(.02,1,false,spec,'pilot');
 assert.equal(layer.shock.events.length,1);assert.equal(layer.shock.events[0].role,'chain');assert.equal(layer.shock.events[0].size.heavy,false);assert.ok(layer.shock.events[0].size.reach<.22);
 assert.deepEqual({start:start.toArray(),end:end.toArray(),spec,matrix:root.matrix.toArray()},prior);layer.dispose();
});
test('secondary saturation cannot evict the primary capacitor fan or erase its main charge patch',()=>{
 const scene=new THREE.Scene(),{root}=target(scene),layer=new ShockResponse(scene,new THREE.PerspectiveCamera()),spec=createWeaponSpec('sticky','shock'),point=new THREE.Vector3(0,1.5,-2.8),normal=new THREE.Vector3(0,0,1);
 layer.impact({target:root,point,normal,spec,radius:2.5,phase:'detonate',energy:70});const primary=layer.events[0].size.patch;
 for(let i=0;i<40;i++)layer.splash({target:root,point,normal,spec,radius:2.5,phase:'contact',energy:7,exposure:.1,origin:point,primary:false});
 assert.equal(layer.diagnostics.heavyFans,1);const visual=layer.status(root);assert.ok(visual.bindings[0].anchors.some(a=>a?.radius===primary));layer.dispose();
});
test('real sticky engine keeps the original fuse/damage and emits one C primary with only small secondary responses',()=>{
 function run(after:boolean){const scene=new THREE.Scene(),primary=target(scene,'cloth',1),neighbor=target(scene,'armor',2,1.2),list=[primary,neighbor];
  const hits:unknown[]=[],layer=after?new ShockPresentation(scene,new THREE.PerspectiveCamera()):new ElementalPresentation(scene,new THREE.PerspectiveCamera(),{corrosiveAB:true});
  const engine=new PlayerBallistics(scene,{targets:()=>list,occluders:()=>[],hit:e=>hits.push({id:e.targetId,damage:e.damage,point:e.point.toArray(),spec:e.spec})});engine.setPresentation(layer);
  const spec=createWeaponSpec('sticky','shock');spec.spread=0;engine.fire(new THREE.Vector3(0,1.5,2),new THREE.Vector3(0,0,-1),spec,70);
  for(let i=0;i<200;i++){engine.update(1/120);layer.update(1/120,i/120,false,spec,'pilot');}
  const events=layer instanceof ShockPresentation?structuredClone(layer.shock.events):[];engine.clear();layer.dispose();return{hits,events,spec};
 }
 const before=run(false),after=run(true);assert.deepEqual(after.hits,before.hits);assert.deepEqual(after.spec,before.spec);assert.equal(after.events.filter(e=>e.size.heavy).length,1);assert.ok(after.events.some(e=>e.role==='splash'));assert.ok(after.events.filter(e=>e.role==='splash').every(e=>!e.size.heavy&&e.size.reach<.30));
});
test('existing renderers and all non-Shock audio recipes remain available and unchanged by default',()=>{
 const scene=new THREE.Scene(),old=new ElementalPresentation(scene,new THREE.PerspectiveCamera());assert.equal('shock' in old.diagnostics,false);old.dispose();
 for(const element of ['fire','ice','corrosive','gravity','adhesive','radiation'] as const)for(const event of ['impact','status','shot'] as const)assert.deepEqual(shockABAudioRecipe(element,event),corrosiveABAudioRecipe(element,event));
});
test('only confirmed heavy impact receives the capacitor bass; secondary/lingering audio stays brief and quiet',()=>{
 const small=shockABAudioRecipe('shock','impact',{delivery:'sticky',strength:.72}),heavy=shockABAudioRecipe('shock','impact',{delivery:'sticky',strength:1.05}),secondary=shockABAudioRecipe('shock','impact',{delivery:'sticky',splash:true}),status=shockABAudioRecipe('shock','status');
 assert.ok(heavy.some(v=>v.frequency<200));assert.ok(small.every(v=>v.frequency>200));assert.ok(secondary.length<small.length&&secondary.every(v=>v.gain<.06&&v.duration<=.06));assert.ok(status.every(v=>v.gain<.025&&v.duration<.04));
});
