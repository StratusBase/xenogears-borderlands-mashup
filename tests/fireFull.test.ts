import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWeaponSpec,type ProjectileType} from '../src/core/arsenal.ts';
import {createProgression} from '../src/core/index.ts';
import {resolveEquipmentAppearance} from '../src/core/appearance.ts';
import {createEquipmentWeapon,disposeEquipmentModel} from '../src/rendering/equipmentModels.ts';
import {ComposedElementalPresentation} from '../src/rendering/quality/shared/composedPresentation';
import type {FireElementResponse} from '../src/rendering/quality/fire/presentation';
import {FirePresentation} from '../src/rendering/quality/fire/presentation.ts';
import {ElementalPresentation} from '../src/rendering/quality/elementalPresentation.ts';
import {GamePresentation} from '../src/rendering/quality/GamePresentation.ts';
import {PlayerBallistics,type BallisticHit,type BallisticPresentation} from '../src/rendering/PlayerBallistics.ts';
import {FireEquipment} from '../src/rendering/quality/fire/equipment.ts';
import {FireResponse} from '../src/rendering/quality/fire/response.ts';
import {createFireProjectile,createFireTrail,updateFireProjectile} from '../src/rendering/quality/fire/flight.ts';
let doc:PropertyDescriptor|undefined;
before(()=>{doc=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){}})})}});});
after(()=>{if(doc)Object.defineProperty(globalThis,'document',doc);else Reflect.deleteProperty(globalThis,'document');});
const deliveries=['bullet','slug','spike','ricochet','homing','sticky','orb','beam','scatter','rocket','disc','arc','cluster'] as ProjectileType[];
for(const type of deliveries)test(`Full hybrid Fire preserves exact ${type} replay with both channel orders`,()=>{
 for(const secondary of [false,true]){
  function run(full:boolean){const scene=new THREE.Scene(),root=new THREE.Group(),plate=new THREE.Mesh(new THREE.BoxGeometry(1,1,.15),new THREE.MeshBasicMaterial());plate.position.z=-5;plate.userData.effectSurface='armor';root.add(plate);scene.add(root);
   const hits:unknown[]=[],positions:unknown[]=[];const layer=full?new FirePresentation(scene,new THREE.PerspectiveCamera(),{full:true,seed:7}):new ElementalPresentation(scene,new THREE.PerspectiveCamera(),{corrosiveAB:true});
   const sim=new PlayerBallistics(scene,{targets:()=>[{id:1,root,radius:1}],occluders:()=>[],hit:(h:BallisticHit)=>hits.push({point:h.point.toArray(),direction:h.direction.toArray(),damage:h.damage,spec:h.spec,critical:h.critical})});sim.setPresentation(layer);const spec=createWeaponSpec(type,secondary?'ice':'fire','pilot');spec.secondaryElement=secondary?'fire':'corrosive';const recipe=JSON.stringify(spec);sim.fire(new THREE.Vector3(),new THREE.Vector3(0,0,-1),spec,20,50);
   for(let i=0;i<300;i++){sim.update(1/120);layer.update(1/120,i/120,false,spec,'pilot');positions.push(scene.children.filter(o=>o.name.startsWith('quality-projectile-')).map(o=>({position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray()})));}
   assert.equal(JSON.stringify(spec),recipe);sim.clear();layer.dispose();return{hits,positions};
  }assert.deepEqual(run(true),run(false));
 }
});
for(const fireRole of ['primary','secondary'] as const)for(const mode of ['pilot','mech'] as const)for(const type of ['bullet','rocket','beam','sticky'] as const)test(`Fire ${fireRole}/${mode}/${type} heat remains on cartridges and preserves muzzle and every other slot`,()=>{
 const look=resolveEquipmentAppearance(createProgression(),mode),appearance={...look.weapon,equipped:true,element:fireRole==='primary'?'fire' as const:'ice' as const,secondaryElement:fireRole==='primary'?'ice' as const:'fire' as const,projectile:type};const rig=createEquipmentWeapon(mode,appearance,{...look,weapon:appearance});const root=rig.group;
 const armor=new THREE.Group();armor.userData.equipmentSlot='armor';const fake=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());fake.userData.equipmentElementSurface='fire';armor.add(fake);root.add(armor);root.updateWorldMatrix(true,true);
 const muzzles=rig.muzzles.map(m=>m.getWorldPosition(new THREE.Vector3()).toArray()),originals:{mesh:THREE.Mesh;geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[];raycast:THREE.Mesh['raycast']}[]=[];
 root.traverse(o=>{if(o instanceof THREE.Mesh)originals.push({mesh:o,geometry:o.geometry,material:o.material,raycast:o.raycast});});const v=new FireEquipment(root,appearance);assert.equal(v.sources.length,mode==='pilot'?3:6);assert.equal(fake.children.length,0);v.shot();for(let i=0;i<90;i++)v.update(1/60,i/60);
 assert.deepEqual(rig.muzzles.map(m=>m.getWorldPosition(new THREE.Vector3()).toArray()),muzzles);for(const s of originals){assert.equal(s.mesh.geometry,s.geometry);assert.equal(s.mesh.material,s.material);assert.equal(s.mesh.raycast,s.raycast);}v.dispose();assert.ok(originals.every(s=>s.mesh.children.length===0));disposeEquipmentModel(root);
});
test('Fire carrier replaces cones, shares a retained atlas, animates only children and preserves exact beam endpoints',()=>{
 const spec=createWeaponSpec('rocket','fire','pilot');spec.secondaryElement='ice';const root=createFireProjectile(spec,'ironvale');root.position.set(2,3,4);const matrix=root.matrix.clone();const parts:string[]=[];root.traverse(o=>parts.push(...o.userData.authoredParts??[]));assert.ok(parts.includes('ordnance-pressure-shell'));assert.ok(!parts.includes('incandescent-flame-head'));assert.ok(parts.includes('faceted-ice-dart'));
 const flames:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh&&o.name==='fire-hybrid-flowing-plume')flames.push(o as typeof flames[number]);});assert.equal(flames.length,3);assert.equal(flames[0].material.uniforms.atlas.value,flames[1].material.uniforms.atlas.value);const before=flames[0].material.uniforms.time.value;updateFireProjectile(root,.1,.5);assert.notEqual(flames[0].material.uniforms.time.value,before);assert.deepEqual(root.matrix,matrix);assert.deepEqual(root.position.toArray(),[2,3,4]);
 const a=new THREE.Vector3(1,2,3),b=new THREE.Vector3(-4,5,-9),beam=createFireTrail(a,b,{...spec,projectile:'beam'},'ironvale',true);assert.deepEqual(beam.userData.start,a.toArray());assert.deepEqual(beam.userData.end,b.toArray());
 for(const r of[root,beam])r.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
});

test('Aligned launcher vents clear real barrel steel, keep their feed attached and heat only the firing mech barrel',()=>{
 const look=resolveEquipmentAppearance(createProgression(),'mech'),appearance={...look.weapon,equipped:true,element:'ice' as const,secondaryElement:'fire' as const,projectile:'rocket' as const,weaponType:'launcher' as const};
 const rig=createEquipmentWeapon('mech',appearance,look),visual=new FireEquipment(rig.group,appearance);rig.group.updateWorldMatrix(true,true);
 const ports:THREE.Object3D[]=[];rig.group.traverse(o=>{if(o.name==='fire-cartridge-exhaust')ports.push(o);});assert.equal(ports.length,2);
 for(const port of ports){const local=new THREE.Vector3().fromArray(port.userData.aperture),world=port.parent!.localToWorld(local.clone());assert.ok(local.y>port.userData.shellTop+.05);const ray=new THREE.Raycaster(world,new THREE.Vector3(0,-1,0));const steel=rig.group.getObjectsByProperty('name','launcher-wide-bore');assert.ok(ray.intersectObjects(steel,false).some(hit=>hit.distance>.04));assert.equal(port.parent!.userData.equipmentElementSurface,'fire');assert.ok(port.getObjectByName('fire-vent-feed-riser'));}
 visual.shot(0);visual.update(.03,1);let vents=visual.diagnostics.vents;assert.ok(vents[0].heat>.8);assert.equal(vents[1].heat,0);const first=vents[0].lean;visual.shot(1);visual.update(.03,1.03);vents=visual.diagnostics.vents;assert.ok(vents[1].heat>.8);
 const leans=new Set([first]);for(let i=0;i<8;i++){visual.shot(0);leans.add(visual.diagnostics.vents[0].lean);}assert.ok(leans.size>5);visual.dispose();assert.ok(ports.every(p=>p.parent===null));disposeEquipmentModel(rig.group);
});

test('Equipment-only Fire baseline retains full impacts and flight while changing only the equipment style',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),before=new FirePresentation(scene,camera,{full:true,equipment:'subtle'}),current=new FirePresentation(scene,camera,{full:true});
 assert.equal(before.fire.hybrid!==null,true);assert.equal(current.fire.hybrid!==null,true);const spec=createWeaponSpec('rocket','fire','pilot');for(const layer of [before,current]){const carrier=layer.projectile(spec,'ironvale');assert.equal(carrier.userData.fireStyle,'hybrid');carrier.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});layer.dispose();}
});

test('Fire reads explicit muzzle identity after hierarchy reorder and never maps an unknown chamber to arm zero',()=>{
 const look=resolveEquipmentAppearance(createProgression(),'mech'),appearance={...look.weapon,equipped:true,element:'fire' as const,projectile:'rocket' as const},rig=createEquipmentWeapon('mech',appearance);
 assert.deepEqual(rig.muzzles.map(m=>m.userData.equipmentMuzzleIndex),[0,1]);rig.group.children.reverse();
 const orphan=new THREE.Mesh(new THREE.BoxGeometry(.05,.09,.17),new THREE.MeshBasicMaterial());orphan.name='element-chamber-orphan';orphan.userData.equipmentElementSurface='fire';rig.group.add(orphan);
 const visual=new FireEquipment(rig.group,appearance);visual.shot(0);visual.update(.01,1);const vents=visual.diagnostics.vents;assert.ok(vents.find(v=>v.barrel===0)!.heat>.9);assert.equal(vents.find(v=>v.barrel===1)!.heat,0);assert.equal(vents.length,2);assert.equal(visual.diagnostics.unmappedSources,1);visual.dispose();disposeEquipmentModel(rig.group);
});
test('Repeated full Fire hits choose nonrepeating families, clear reproducibly, and never give secondary recipients primary art',()=>{
 const scene=new THREE.Scene(),layer=new FireResponse(scene,new THREE.PerspectiveCamera(),{full:true,hybrid:true,seed:17}),spec=createWeaponSpec('sticky','fire','pilot'),base={point:new THREE.Vector3(),normal:new THREE.Vector3(0,1,0),spec,radius:2,energy:28,phase:'detonate' as const};
 for(let i=0;i<8;i++)layer.impact(base);const events=structuredClone(layer.events);for(let i=1;i<events.length;i++){assert.notEqual(events[i].variant,events[i-1].variant);assert.notEqual(events[i].seed,events[i-1].seed);}layer.clear();for(let i=0;i<8;i++)layer.impact(base);assert.deepEqual(layer.events,events);layer.clear();layer.splash({...base,origin:new THREE.Vector3(),target:new THREE.Group(),primary:false,exposure:.3});assert.equal(layer.hybrid!.activeCount,0);layer.dispose();
});
test('Normal Enhanced composition enables full hybrid Fire, keeps corrosion, and retains a reversible Legacy path',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),weaponRoot=new THREE.Group();let active:BallisticPresentation|undefined;const p=new GamePresentation({scene,camera,weaponRoot,comicRenderer:{outlineWidth:3},ballistics:{setPresentation:v=>{active=v;}}});p.setEnabled(true);assert.ok(active instanceof ComposedElementalPresentation);assert.ok((active.responses.get('fire')as FireElementResponse).fire.hybrid);assert.ok(active.responses.has('radiation'));assert.ok(active.corrosive);const sample=active.projectile(createWeaponSpec('bullet','fire','pilot'),'ironvale');assert.equal(sample.userData.fireStyle,'hybrid');sample.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});p.setEnabled(false);assert.equal(active,undefined);p.setEnabled(true);assert.equal(p.enabled,true);p.dispose();
});

for(const rotation of [0,Math.PI/2,.72,Math.PI])test(`World Fire wisps remain attached to actual support triangles at rotation ${rotation}`,()=>{
 const scene=new THREE.Scene(),support=new THREE.Mesh(new THREE.BoxGeometry(3,.30,3),new THREE.MeshBasicMaterial());support.rotation.x=rotation;scene.add(support);support.updateWorldMatrix(true,false);const normal=new THREE.Vector3(0,1,0).transformDirection(support.matrixWorld),point=new THREE.Vector3(0,.15,0).applyMatrix4(support.matrixWorld),geometry=support.geometry,material=support.material,raycast=support.raycast;
 const layer=new FireResponse(scene,new THREE.PerspectiveCamera(),{full:true,hybrid:true,seed:11});layer.impact({hitSurface:support,point,normal,radius:.3,energy:28,phase:'contact',spec:createWeaponSpec('bullet','fire','pilot')});for(let i=0;i<24;i++)layer.update(1/60);const pool=layer.group.getObjectByName('fire-tongues-pool') as THREE.InstancedMesh;assert.ok(pool.count>0);const matrix=new THREE.Matrix4();for(let i=0;i<pool.count;i++){pool.getMatrixAt(i,matrix);const p=new THREE.Vector3().setFromMatrixPosition(matrix);assert.ok(p.clone().sub(point).dot(normal)>=.02);assert.equal(pool.geometry.getAttribute('fxSupported').getX(i),1);}
 layer.dispose();assert.equal(support.geometry,geometry);assert.equal(support.material,material);assert.equal(support.raycast,raycast);assert.equal(support.children.length,0);
});

test('Full Fire warms private HalfFloat templates without firing, changing a Game target, or disposing borrowed resources',async()=>{
 const scene=new THREE.Scene(),body=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());scene.add(body);const layer=new FireResponse(scene,new THREE.PerspectiveCamera(),{full:true,hybrid:true,seed:1}),children=[...scene.children],original=new THREE.WebGLRenderTarget(2,2);let target:THREE.WebGLRenderTarget|null=original,draws=0;
 const renderer={initTexture(){},getRenderTarget:()=>target,setRenderTarget:(v:THREE.WebGLRenderTarget|null)=>{target=v;},compileAsync:async()=>{},render:(probe:THREE.Scene)=>{assert.notEqual(probe,scene);assert.equal(target!.texture.type,THREE.HalfFloatType);draws++;}} as unknown as THREE.WebGLRenderer;
 await layer.prepare(renderer,scene);assert.equal(draws,1);assert.equal(target,original);assert.deepEqual(scene.children,children);assert.equal(body.children.length,0);assert.equal(layer.events.length,0);assert.equal(layer.diagnostics.statuses,0);await layer.prepare(renderer,scene);assert.equal(draws,1);layer.dispose();assert.equal(body.children.length,0);original.dispose();
});

test('Fire gives authoritative cluster bomblets a smaller primary burst without changing the recipe',()=>{const scene=new THREE.Scene(),layer=new FireResponse(scene,new THREE.PerspectiveCamera(),{full:true,hybrid:true,seed:8}),spec=createWeaponSpec('cluster','fire','pilot'),e={point:new THREE.Vector3(),normal:new THREE.Vector3(0,1,0),spec,radius:2,energy:28,phase:'detonate' as const};const recipe=JSON.stringify(spec);layer.impact(e);const size=layer.events.at(-1)!.size;layer.impact({...e,stage:'bomblet'});assert.ok(layer.events.at(-1)!.size<size*.7);assert.equal(JSON.stringify(spec),recipe);layer.dispose();});

test('Repeated same-point Fire impacts select visibly different left/right/up bearings once per event',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(0,2,6);camera.lookAt(0,1.4,0);const layer=new FireResponse(scene,camera,{full:true,hybrid:true,seed:37391}),spec=createWeaponSpec('bullet','fire','pilot'),point=new THREE.Vector3(0,1.4,0),normal=new THREE.Vector3(0,0,1),bearings:number[]=[];
 for(let i=0;i<10;i++){layer.impact({point,normal,spec,radius:.3,energy:28,phase:'contact'});layer.update(.1);layer.hybrid!.group.updateWorldMatrix(true,true);const burst=layer.hybrid!.group.children[i],cards=(burst.children as THREE.Mesh[]).filter(m=>m.visible&&m.name.includes('a_tear'));cards.sort((a,b)=>Math.abs(b.scale.x)-Math.abs(a.scale.x));const direction=new THREE.Vector3(1,0,0).transformDirection(cards[0].matrixWorld);bearings.push(Math.atan2(direction.y,direction.x));const before=cards[0].scale.x;layer.update(.02);assert.equal(Math.sign(cards[0].scale.x),Math.sign(before),'event handedness does not reroll during animation');}
 assert.ok(bearings.some(a=>Math.cos(a)<-.4),'leftward impacts');assert.ok(bearings.some(a=>Math.cos(a)>.4),'rightward impacts');assert.ok(bearings.some(a=>Math.sin(a)>.7),'steep upward impacts');for(let i=1;i<bearings.length;i++)assert.ok(Math.abs(bearings[i]-bearings[i-1])>.10,'consecutive real impacts must not share the same bearing');layer.dispose();
});

test('Captured Fire cluster flight survives a Legacy toggle without reviving disposed world effects',()=>{
 const scene=new THREE.Scene(),p=new FirePresentation(scene,new THREE.PerspectiveCamera(),{full:true}),sim=new PlayerBallistics(scene,{targets:()=>[],occluders:()=>[],hit:()=>{}});sim.setPresentation(p);sim.fire(new THREE.Vector3(0,5,0),new THREE.Vector3(0,0,-1),createWeaponSpec('cluster','fire','pilot'),20,50);const carrier=scene.children.find(o=>o.name==='quality-projectile-cluster')!;const plume=carrier.getObjectByName('fire-hybrid-flowing-plume')as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;const atlas=plume.material.uniforms.atlas.value as THREE.Texture;let disposed=0;atlas.addEventListener('dispose',()=>disposed++);sim.setPresentation(undefined);p.dispose();
 for(let i=0;i<240&&!scene.children.some(o=>o.userData.clusterRole==='bomblet');i++)sim.update(1/120);const children=scene.children.filter(o=>o.userData.clusterRole==='bomblet');assert.ok(children.length>=2);for(const child of children)assert.equal(child.userData.fireStyle,'hybrid');const flame=children[0].getObjectByName('fire-hybrid-flowing-plume')as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;sim.update(.04);const time=flame.material.uniforms.time.value;sim.update(.04);assert.ok(flame.material.uniforms.time.value>time);assert.equal(p.fire.group.parent,null);assert.equal(disposed,0,'live payloads retain their own atlas');sim.clear();assert.equal(disposed,1);
});

test('A registered flight replacement can intentionally omit a live payload and fall back safely after disposal',()=>{const scene=new THREE.Scene(),layer=new ComposedElementalPresentation(scene,new THREE.PerspectiveCamera(),{ice:{replaceFlight:true,create:()=>({impact(){},clear(){},dispose(){}})}}),spec=createWeaponSpec('bullet','ice','pilot');const live=layer.projectile(spec,'ironvale');assert.equal(live.getObjectByName('quality-primary-ice-payload'),undefined);layer.dispose();const fallback=layer.projectile(spec,'ironvale');assert.ok(fallback.getObjectByName('quality-primary-ice-payload'));for(const root of[live,fallback])root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});});
