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
import {createElementalProjectile} from '../src/rendering/quality/elementalFlight.ts';

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

test('first A+B remains selectable, and the lightning revision keeps secondary size records exact',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),spec=createWeaponSpec('sticky','shock'),{root}=target(scene);
 const a=new ShockResponse(scene,camera,'prototype'),b=new ShockResponse(scene,camera,'lightning');
 const event={target:root,point:new THREE.Vector3(0,1.5,-2.8),normal:new THREE.Vector3(0,0,1),spec,radius:2.5,phase:'detonate' as const,energy:70};
 a.impact(event);b.impact(event);assert.ok(b.events[0].size.reach>a.events[0].size.reach);assert.equal(b.events[0].size.heavy,true);
 for(const exposure of [.01,.10,.35,.75,1]){const splash={...event,phase:'contact' as const,origin:event.point,primary:false,energy:70*exposure,exposure};a.splash(splash);b.splash(splash);assert.deepEqual(a.events.at(-1)?.size,b.events.at(-1)?.size);}
 assert.equal(a.segments.meshes.length,3);assert.equal(b.segments.meshes.length,2);a.dispose();b.dispose();
});
test('revised camera-facing filaments stay outside five support planes and keep finite matrices',()=>{
 for(const normal of [new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,.65,.76).normalize(),new THREE.Vector3(1,0,0)]){
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(2,3,4);const layer=new ShockResponse(scene,camera),point=new THREE.Vector3(0,2,0);
  layer.impact({point,normal,spec:createWeaponSpec('rocket','shock'),phase:'detonate',radius:2.5,energy:70});
  for(let tick=0;tick<20;tick++){
   layer.update(1/60);const mesh=layer.segments.meshes[0];
   for(let i=0;i<mesh.count;i++){const matrix=new THREE.Matrix4();mesh.getMatrixAt(i,matrix);assert.ok(matrix.elements.every(Number.isFinite));for(const y of [-.5,.5]){const endpoint=new THREE.Vector3(0,y,0).applyMatrix4(matrix);assert.ok(endpoint.sub(point).dot(normal)>.01);}}
  }layer.dispose();
 }
});
test('old and revised profiles yield identical real rifle and heavy projectile outcomes',()=>{
 for(const delivery of ['bullet','sticky','rocket','beam','scatter','slug','arc'] as const){
  function run(profile:'prototype'|'lightning'){
   const scene=new THREE.Scene(),list=[target(scene,'cloth',1),target(scene,'armor',2,1.2)],layer=new ShockPresentation(scene,new THREE.PerspectiveCamera(),profile),hits:unknown[]=[];
   const engine=new PlayerBallistics(scene,{targets:()=>list,occluders:()=>[],hit:e=>hits.push({id:e.targetId,damage:e.damage,point:e.point.toArray(),spec:e.spec})});engine.setPresentation(layer);const spec=createWeaponSpec(delivery,'shock');spec.spread=0;
   engine.fire(new THREE.Vector3(0,1.5,2),new THREE.Vector3(0,0,-1),spec,70);for(let i=0;i<240;i++){engine.update(1/120);layer.update(1/120,i/120,false,spec,'pilot');}engine.clear();layer.dispose();return hits;
  }assert.deepEqual(run('lightning'),run('prototype'),delivery);
 }
});

test('confirmed chain filaments vary per event while retaining exactly the confirmed endpoints',()=>{
 const scene=new THREE.Scene(),{root}=target(scene),camera=new THREE.PerspectiveCamera(),layer=new ShockResponse(scene,camera),spec=createWeaponSpec('bullet','shock');
 const event={start:new THREE.Vector3(-2,1.5,-2.8),end:new THREE.Vector3(0,1.5,-2.8),target:root,spec,energy:7,exposure:.35};
 function connector(){const mesh=layer.segments.meshes[0],matrices:number[][]=[];for(let i=mesh.count-16;i<mesh.count;i++){const matrix=new THREE.Matrix4();mesh.getMatrixAt(i,matrix);matrices.push(matrix.toArray());}return matrices;}
 layer.chain(event);layer.update(.01);const first=connector();layer.chain(event);layer.update(.01);const second=connector();assert.notDeepEqual(second,first);assert.deepEqual(event.start.toArray(),[-2,1.5,-2.8]);assert.deepEqual(event.end.toArray(),[0,1.5,-2.8]);assert.ok(first.flat().every(Number.isFinite)&&second.flat().every(Number.isFinite));layer.dispose();
});

test('dense C exists only on confirmed heavy primaries; ordinary and secondary sizing stay exact',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),{root}=target(scene);
 const old=new ShockResponse(scene,camera,'lightning'),dense=new ShockResponse(scene,camera,'capacitor');
 for(const delivery of ['bullet','beam','scatter','slug','arc','sticky','rocket'] as const){
  const event={target:root,point:new THREE.Vector3(0,1.5,-2.8),normal:new THREE.Vector3(0,0,1),spec:createWeaponSpec(delivery,'shock'),phase:'contact' as const,radius:2.5,energy:70};
  old.clear();dense.clear();old.impact(event);dense.impact(event);old.update(.1);dense.update(.1);
  assert.equal(dense.diagnostics.capacitorBlades,0);assert.deepEqual(dense.events,old.events);
  assert.deepEqual(Array.from(dense.segments.meshes[0].instanceMatrix.array),Array.from(old.segments.meshes[0].instanceMatrix.array));
 }
 const primary={target:root,point:new THREE.Vector3(0,1.5,-2.8),normal:new THREE.Vector3(0,0,1),spec:createWeaponSpec('sticky','shock'),phase:'detonate' as const,radius:2.5,energy:70};
 old.clear();dense.clear();old.impact(primary);dense.impact(primary);dense.update(.1);assert.equal(dense.diagnostics.capacitorBlades,8);assert.equal(dense.diagnostics.capacitorShards,56);assert.deepEqual(dense.events,old.events);
 for(const exposure of [.01,.10,.35,.75,1]){const splash={...primary,phase:'contact' as const,origin:primary.point,primary:false,energy:70*exposure,exposure};old.splash(splash);dense.splash(splash);assert.deepEqual(dense.events.at(-1),old.events.at(-1));assert.equal(dense.diagnostics.capacitorBlades,8);}
 dense.clear();assert.equal(dense.diagnostics.capacitorBlades,0);assert.equal(dense.diagnostics.capacitorShards,0);old.dispose();dense.dispose();
});
test('dense C geometry is finite, varied, bounded and outside every support plane; pause/expiry/disposal work',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(0,3,4);const layer=new ShockResponse(scene,camera,'capacitor'),point=new THREE.Vector3(0,2,0),spec=createWeaponSpec('rocket','shock');
 let previous:number[]|undefined;
 for(const normal of [new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0),new THREE.Vector3(0,.65,.76).normalize()]){
  layer.impact({point,normal,spec,phase:'detonate',radius:2.5,energy:70});layer.update(.1);layer.group.updateMatrixWorld(true);
  const meshes:THREE.Mesh[]=[];layer.group.traverse(m=>{if(m instanceof THREE.Mesh&&m.name==='shock-capacitor-blades-and-shards'&&m.parent?.visible)meshes.push(m);});
  for(const mesh of meshes){const position=mesh.geometry.attributes.position;assert.equal(position.count,1200);for(let i=0;i<position.count;i++){const p=new THREE.Vector3().fromBufferAttribute(position,i);assert.ok(p.toArray().every(Number.isFinite));p.applyMatrix4(mesh.matrixWorld);}}
  const last=meshes.at(-1)!;for(let i=0;i<last.geometry.attributes.position.count;i++){const p=new THREE.Vector3().fromBufferAttribute(last.geometry.attributes.position,i).applyMatrix4(last.matrixWorld);assert.ok(p.sub(point).dot(normal)>.02);}
  const current=Array.from(last.geometry.attributes.position.array);if(previous)assert.notDeepEqual(current,previous);previous=current;layer.update(0);assert.deepEqual(Array.from(last.geometry.attributes.position.array),current);
  for(let i=0;i<40;i++)layer.update(1/60);assert.equal(layer.diagnostics.capacitorBlades,0);
 }
 for(let i=0;i<120;i++)layer.impact({point,normal:new THREE.Vector3(0,1,0),spec,phase:'detonate',radius:2.5,energy:70});assert.equal(layer.diagnostics.capacitorBlades,32);assert.equal(layer.diagnostics.capacitorVertices,4800);layer.dispose();assert.equal(layer.group.parent,null);
});

test('C directions cover all eight sectors per bag, avoid repeats and reproduce a review seed',async()=>{
 const {CapacitorDirectionSequence}=await import('../src/rendering/quality/shock/directions.ts');
 const a=new CapacitorDirectionSequence(37391),b=new CapacitorDirectionSequence(37391),sequence=Array.from({length:128},()=>a.next());
 assert.deepEqual(sequence,Array.from({length:128},()=>b.next()));
 for(let i=0;i<sequence.length;i+=8)assert.equal(new Set(sequence.slice(i,i+8).map(d=>d.sector)).size,8);
 for(let i=1;i<sequence.length;i++)assert.notEqual(sequence[i].sector,sequence[i-1].sector);
 assert.ok(sequence.every(d=>Number.isFinite(d.angle)&&Math.abs(d.angle-d.sector*Math.PI/4)<=.12));
 a.reset();assert.deepEqual(Array.from({length:8},()=>a.next()),sequence.slice(0,8));
});
test('real C geometry points both ways across repeated hits and leaves secondary shapes and sizes exact',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(0,1.5,4);const {root}=target(scene),spec=createWeaponSpec('sticky','shock'),point=new THREE.Vector3(0,1.5,-2.8),normal=new THREE.Vector3(0,0,1);
 const current=new ShockResponse(scene,camera,'capacitor',{cosmeticSeed:37391}),legacy=new ShockResponse(scene,camera,'capacitor',{capacitorDirection:'legacy',cosmeticSeed:37391});
 const event={target:root,point,normal,spec,phase:'detonate' as const,radius:2.5,energy:70},vectors:THREE.Vector3[]=[];
 for(let shot=0;shot<8;shot++){
  current.impact(event);current.update(.10);current.group.updateMatrixWorld(true);let mesh:THREE.Mesh|undefined;
  current.group.traverse(o=>{if(o instanceof THREE.Mesh&&o.name==='shock-capacitor-blades-and-shards'&&o.parent?.visible){const age=(o.material as THREE.ShaderMaterial).uniforms.age.value;if(Math.abs(age-.1)<1e-5)mesh=o;}});
  assert.ok(mesh);const p=mesh.geometry.attributes.position,center=new THREE.Vector3().fromBufferAttribute(p,66).add(new THREE.Vector3().fromBufferAttribute(p,71)).multiplyScalar(.5).applyMatrix4(mesh.matrixWorld).sub(point).normalize();vectors.push(center);
  for(let i=0;i<30;i++)current.update(1/60);
 }
 assert.equal(new Set(current.directions.map(d=>d.sector)).size,8);assert.ok(vectors.some(v=>v.x>.5)&&vectors.some(v=>v.x<-.5)&&vectors.some(v=>v.y>.5)&&vectors.some(v=>v.y<-.5));
 current.clear();legacy.clear();current.impact(event);legacy.impact(event);
 const splash={...event,phase:'contact' as const,origin:point,primary:false,energy:7,exposure:.1};current.splash(splash);legacy.splash(splash);current.update(.1);legacy.update(.1);
 assert.deepEqual(current.events,legacy.events);assert.equal(current.segments.activeCount,legacy.segments.activeCount);
 assert.deepEqual(Array.from(current.segments.meshes[0].instanceMatrix.array.slice(16*16)),Array.from(legacy.segments.meshes[0].instanceMatrix.array.slice(16*16)));
 current.dispose();legacy.dispose();
});

test('all eight C directions preserve outward clearance on floors, walls, slopes and undersides',()=>{
 const camera=new THREE.PerspectiveCamera();camera.position.set(1,3,4);const point=new THREE.Vector3(0,2,0),spec=createWeaponSpec('rocket','shock');
 for(const normal of [new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0),new THREE.Vector3(0,.65,.76).normalize()]){
  const layer=new ShockResponse(new THREE.Scene(),camera,'capacitor',{cosmeticSeed:37391});
  for(let i=0;i<8;i++){
   layer.impact({point,normal,spec,phase:'detonate',radius:2.5,energy:70});layer.update(.1);layer.group.updateMatrixWorld(true);
   layer.group.traverse(mesh=>{if(!(mesh instanceof THREE.Mesh)||mesh.name!=='shock-capacitor-blades-and-shards'||!mesh.parent?.visible)return;const p=mesh.geometry.attributes.position;for(let j=0;j<p.count;j++){const v=new THREE.Vector3().fromBufferAttribute(p,j).applyMatrix4(mesh.matrixWorld).sub(point);assert.ok(v.toArray().every(Number.isFinite)&&v.dot(normal)>.02);}});
  }assert.equal(new Set(layer.directions.map(d=>d.sector)).size,8);layer.dispose();
 }
});

test('fixed Shock sticky charge stays inside its carrier envelope, never rotates, and leaves the other channel intact',()=>{
 const scene=new THREE.Scene(),layer=new ShockPresentation(scene,new THREE.PerspectiveCamera(),'capacitor',{cosmeticSeed:37391});
 for(const spec of [createWeaponSpec('sticky','shock'),{...createWeaponSpec('sticky','fire'),secondaryElement:'shock' as const},{...createWeaponSpec('sticky','shock'),secondaryElement:'fire' as const}]){
  const frozen=structuredClone(spec),root=layer.projectile(spec,'ironvale'),reference=createElementalProjectile(spec,'ironvale');
  assert.deepEqual(spec,frozen);assert.deepEqual(root.userData,reference.userData);
  const fixed=root.getObjectByName('shock-fixed-sticky-charge');assert.ok(fixed);assert.ok(!root.children.some(c=>c.userData.element==='shock'&&c.name.includes('payload')));
  const bounds=new THREE.Box3().setFromObject(fixed),size=bounds.getSize(new THREE.Vector3());assert.ok(size.x<=.15&&size.y<=.15&&size.z<=.10);
  assert.deepEqual(root.scale.toArray(),reference.scale.toArray());
  root.position.set(1,2,3);root.rotation.set(.2,.4,.1);root.updateMatrixWorld(true);const before=fixed.matrixWorld.clone(),pose=root.matrix.clone();
  const light=fixed.getObjectByName('shock-sticky-charge-light') as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;let previous=light.material.opacity,changed=false;
  for(let i=1;i<90;i++){layer.updateProjectile(root,1/60,i/60);root.updateMatrixWorld(true);assert.deepEqual(fixed.matrixWorld.elements,before.elements);assert.deepEqual(root.matrix.elements,pose.elements);changed ||= light.material.opacity!==previous;previous=light.material.opacity;}
  assert.ok(changed);layer.updateProjectile(root,0,6);assert.equal(light.material.opacity,previous);
  const fire=root.children.find(c=>c.userData.element==='fire'),referenceFire=reference.children.find(c=>c.userData.element==='fire');
  if(fire&&referenceFire){const meshes=(o:THREE.Object3D)=>{const values:unknown[]=[];o.traverse(c=>{if(c instanceof THREE.Mesh)values.push({name:c.name,position:Array.from(c.geometry.attributes.position.array),color:c.material.color.getHex()});});return values;};assert.deepEqual(meshes(fire),meshes(referenceFire));}
 }
 layer.dispose();
});
test('fixed sticky decoration does not change other Shock deliveries or non-Shock sticky visuals',()=>{
 const layer=new ShockPresentation(new THREE.Scene(),new THREE.PerspectiveCamera());
 const signature=(root:THREE.Group)=>{const values:unknown[]=[];root.traverse(c=>{if(c instanceof THREE.Mesh)values.push({name:c.name,positions:Array.from(c.geometry.attributes.position.array),material:c.material.name});});return values;};
 for(const spec of [createWeaponSpec('rocket','shock'),createWeaponSpec('bullet','shock'),createWeaponSpec('sticky','fire')])assert.deepEqual(signature(layer.projectile(spec,'ironvale')),signature(createElementalProjectile(spec,'ironvale')));
 layer.dispose();
});
