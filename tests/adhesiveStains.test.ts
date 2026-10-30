import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createStainProfile,stainDistance,stainArea,FIXED_STAIN_AREA,STAIN_VARIANTS} from '../src/rendering/quality/adhesive/stains.ts';
import {ResinMask} from '../src/rendering/quality/adhesive/surfaces.ts';
import {AdhesiveResponse} from '../src/rendering/quality/adhesive/response.ts';
import {createWeaponSpec} from '../src/core/arsenal.ts';

test('Stains are bounded connected fills without holes, with genuinely different outlines after rotation is removed',()=>{
 const signatures=new Set<string>(),counts=new Set<number>();
 for(let family=0;family<STAIN_VARIANTS.length;family++)for(let seed=1;seed<=20;seed++){
  const p=createStainProfile(seed,family);assert.deepEqual(p,createStainProfile(seed,family));assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.lobes[0]));counts.add(p.lobes.length);
  for(const l of p.lobes){assert.ok(Math.hypot(l.x/l.rx,l.y/l.ry)<1);assert.ok(Math.hypot(l.x,l.y)+Math.max(l.rx,l.ry)<=1.250001);}
  // Every ray from the common interior origin has exactly one exit: no holes or detached splats.
  for(let a=0;a<Math.PI*2;a+=.17){let outside=false;for(let r=0;r<=1.4;r+=.025){const inside=stainDistance(p,Math.cos(a)*r,Math.sin(a)*r)<=1;if(outside)assert.equal(inside,false);if(!inside)outside=true;}}
  const unrotated={...p,angle:0};signatures.add(Array.from({length:32},(_,i)=>{const a=i*Math.PI/16;let r=0;while(r<1.4&&stainDistance(unrotated,Math.cos(a)*r,Math.sin(a)*r)<1)r+=.025;return r.toFixed(2);}).join(','));
 }assert.deepEqual([...counts].sort(),[2,3,4]);assert.ok(signatures.size>90,'outlines must differ beyond rotating a fixed stamp');
});
test('Equal-energy coverage stays within 6 percent of the fixed coat and heavy lobes favor projected gravity',()=>{
 for(let family=0;family<5;family++)for(let seed=0;seed<30;seed++){
  const down=-Math.PI/2,p=createStainProfile(seed,family,down);assert.ok(Math.abs(stainArea(p.lobes)/FIXED_STAIN_AREA-1)<.06);
  if(seed<8){let covered=0;const step=2.6/80;for(let y=0;y<80;y++)for(let x=0;x<80;x++)if(stainDistance(p,-1.3+(x+.5)*step,-1.3+(y+.5)*step)<=1)covered++;assert.ok(Math.abs(covered*step*step/FIXED_STAIN_AREA-1)<.08,'independent Cartesian coverage check');}
  const mass=p.lobes.slice(1).reduce((v,l)=>({x:v.x+l.x*l.rx*l.ry,y:v.y+l.y*l.rx*l.ry}),{x:0,y:0}),angle=Math.atan2(mass.y,mass.x)+p.angle;assert.ok(Math.cos(angle-down)>=Math.cos(.780001));
 }
});
test('Repeated primary coats replace nearby coats; small secondary deposits retain the larger primary',()=>{
 const scene=new THREE.Scene(),source=new THREE.Mesh(new THREE.BoxGeometry(2,2,.1),new THREE.MeshBasicMaterial());scene.add(source);const mask=new ResinMask(source),normal=new THREE.Vector3(0,0,1),right=new THREE.Vector3(1,0,0),point=new THREE.Vector3(0,0,.05);
 for(let i=0;i<12;i++){mask.contact(point,.3,normal,createStainProfile(i,i%5),right);mask.update(.2,1);}assert.ok(mask.ages.some(a=>a>=.18&&a<10),'refresh keeps the revealed coat instead of sweeping from zero again');
 assert.equal(mask.radii.filter(r=>r>.01).length,1);const primary=mask.radii.findIndex(r=>r>.01),profile=mask.profiles[primary];for(let i=0;i<12;i++)mask.contact(point.clone().add(new THREE.Vector3(i*.06,0,0)),.05,normal,createStainProfile(90+i,0),right);assert.equal(mask.profiles[primary],profile);assert.equal(mask.radii[primary],.3);
 const before=mask.stainLobes.map(v=>v.toArray());mask.update(.1,1);source.position.x=2;source.rotation.y=.7;mask.update(.1,.6);assert.deepEqual(mask.stainLobes.map(v=>v.toArray()),before);const geometry=source.geometry,material=source.material;mask.dispose();assert.equal(source.geometry,geometry);assert.equal(source.material,material);
});
test('Contact-plane coordinates stay consistent across rotated and nonuniformly scaled source meshes',()=>{
 const scene=new THREE.Scene(),normal=new THREE.Vector3(0,0,1),right=new THREE.Vector3(1,0,0),point=new THREE.Vector3(0,0,0),offset=new THREE.Vector3(.1,.05,0),values=[];
 for(const angle of [0,.73]){const source=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial());source.rotation.z=angle;source.scale.set(2,.5,1.3);scene.add(source);const mask=new ResinMask(source);mask.contact(point,.3,normal,createStainProfile(9,2),right);source.updateWorldMatrix(true,false);
  const slot=mask.radii.findIndex(r=>r>.01),metric=source.getWorldScale(new THREE.Vector3()),d=source.worldToLocal(offset.clone()).sub(mask.centers[slot]).multiply(metric),n=mask.normals[slot].clone().divide(metric).normalize(),r=mask.tangents[slot].clone().multiply(metric).normalize(),up=n.clone().cross(r).normalize();values.push([d.dot(r),d.dot(up)]);mask.dispose();}
 assert.ok(Math.abs(values[0][0]-values[1][0])<1e-10&&Math.abs(values[0][1]-values[1][1])<1e-10);
});
test('Stain entropy preserves burst RNG, sizes, droplets, pad poses and expiry in fixed versus varied modes',()=>{
 function run(stains:'fixed'|'varied'){
  const scene=new THREE.Scene(),root=new THREE.Group(),source=new THREE.Mesh(new THREE.BoxGeometry(1,1,.1),new THREE.MeshBasicMaterial());source.userData.effectSurface='armor';root.add(source);scene.add(root);const response=new AdhesiveResponse(scene,new THREE.PerspectiveCamera(),37391,'honey',stains),spec=createWeaponSpec('sticky','adhesive','pilot'),frames=[];
  for(let i=0;i<10;i++){const e={point:new THREE.Vector3(0,0,.1),normal:new THREE.Vector3(0,0,1),phase:'detonate' as const,radius:2.5,energy:70,spec,target:root};response.impact({...e,phase:'contact'});response.impact(e);response.splash({...e,origin:new THREE.Vector3(0,0,1),primary:false,exposure:.12});const status=response.status(root);
   for(let j=0;j<60;j++){status.update(1/60);response.update(1/60);frames.push(response.group.children.map(o=>o instanceof THREE.InstancedMesh?Array.from(o.instanceMatrix.array):{p:o.position.toArray(),q:o.quaternion.toArray(),s:o.scale.toArray(),visible:o.visible}));}}
  const events=structuredClone(response.events),choices=response.stainEvents.filter(e=>e.phase==='detonate'&&!e.secondary);assert.ok(choices.every((e,i)=>!i||e.variant!==choices[i-1].variant));response.clear();assert.equal(response.stainEvents.length,0);response.dispose();return{events,frames};
 }assert.deepEqual(run('varied'),run('fixed'));
});
