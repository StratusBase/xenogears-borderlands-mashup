import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {EffectVariation} from '../shared/variation';

interface Charge {material:THREE.MeshBasicMaterial;seed:number;weight:number}
const charges=new WeakMap<THREE.Group,Charge[]>();
function releaseMeshes(root:THREE.Object3D):void{
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),meshes:THREE.Mesh[]=[];
 root.traverse(o=>{if(o instanceof THREE.Mesh){meshes.push(o);geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
 meshes.forEach(m=>m.removeFromParent());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
/** Retain the carrier's root transform and channel offsets. Replace the circular
 * housing and Shock's spinning payload with a compact fixed rectangular device. */
export function installShockStickyCharge(root:THREE.Group,profile:EffectVariation):void{
 if(root.userData.projectile!=='sticky')return;
 const states:Charge[]=[];
 if(!root.children.some(o=>o.userData.element==='shock'))return;
 const carrier=root.getObjectByName('quality-physical-carrier');if(carrier)releaseMeshes(carrier);
 for(const old of [...root.children]){
  if(old.userData.element!=='shock')continue;
  const secondary=old.name.includes('secondary'),weight=secondary?.76:1,scale=secondary?.60:1;
  const charge=new THREE.Group();charge.name='shock-fixed-sticky-charge';charge.position.copy(old.position);charge.scale.setScalar(scale);
  charge.userData={...old.userData,presentationOnly:true,cosmeticSeed:profile.seed};
  // The generic flight updater may retain the detached old payload until this
  // projectile is collected. Its motion no longer affects any visible object.
  old.removeFromParent();releaseMeshes(old);root.add(charge);
  const add=(name:string,color:number,pieces:THREE.BufferGeometry[],opacity=1)=>{
   const geometry=mergeGeometries(pieces,false)!;pieces.forEach(g=>g.dispose());
   const material=new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthTest:true,depthWrite:false,toneMapped:false});
   material.name=name;const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.raycast=()=>{};mesh.userData.comicOverlay=true;charge.add(mesh);return material;
  };
  const box=(x:number,y:number,z:number,w:number,h:number,d:number)=>new THREE.BoxGeometry(w,h,d).translate(x,y,z);
  const spacing=profile.range(1,.027,.032),height=profile.range(2,.048,.060);
  // Local -Z is the visible back of the existing +Z travelling sticky carrier.
  add('shock-sticky-insulator',0x1b2b43,[box(0,0,-.108,.102,.088,.054)]);
  add('shock-sticky-electrodes',0x3185cb,[box(-spacing,0,-.139,.012,height,.010),box(spacing,0,-.139,.012,height*.84,.010)],.90*weight);
  const material=add('shock-sticky-charge-light',0xd7f6ff,[box(-spacing,height*.20,-.146,.006,.015,.004),box(spacing,-height*.18,-.146,.006,.011,.004)],.8*weight);
  states.push({material,seed:profile.range(3,0,Math.PI*2),weight});
 }
 if(states.length)charges.set(root,states);
}
/** Sample the existing projectile age; no rotation, new clock, or fuse ownership. */
export function animateShockStickyCharge(root:THREE.Group,dt:number,age:number):void{
 if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(age)||age<0)return;
 for(const c of charges.get(root)??[])c.material.opacity=(.64+.25*Math.sin(age*31+c.seed)**2)*c.weight;
}
