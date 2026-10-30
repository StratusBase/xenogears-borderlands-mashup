import * as THREE from 'three';
import {getWeaponElements,type WeaponSpec} from '../../../core/arsenal';
import {elementalFlightFamilyScale,type ElementalPayloadAnchor} from '../elementalFlight';
import {EffectVariationSequence} from '../shared/variation';
import type {ElementModule} from '../shared/composedPresentation';
import {gravityCoreMaterial} from './coreMaterial';
import {gravityVapor,gravityCosmetic} from './vapor';

export const isGravitySpike=(spec:Readonly<WeaponSpec>)=>spec.projectile==='spike'&&getWeaponElements(spec).includes('gravity');
interface Flight {group:THREE.Group;vapor:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>[];radius:number;lastAge:number}
const flights=new WeakMap<THREE.Group,Flight>();
/** The real needle, transforms, other element and lifetime remain Ballistics-owned.
 * Retained hooks contain no scene resources and remain safe after a view switch. */
export function createGravitySpikeFlight(seed?:number):NonNullable<ElementModule['flight']>&{reset():void;setCamera(camera:THREE.Camera):void}{
 const variation=new EffectVariationSequence(seed);let camera:THREE.Camera|undefined;
 return{
  reset:()=>variation.reset(),setCamera:value=>{camera=value;},
  decorateProjectile(root,spec){
   if(!isGravitySpike(spec)||flights.has(root))return;const anchor=root.userData.elementalPayloadAnchors?.gravity as ElementalPayloadAnchor|undefined;if(!anchor?.omitted)return;
   const choice=variation.next(4,'spike-carrier'),r=anchor.radius,weight=anchor.secondary?.62:1,group=gravityCosmetic(new THREE.Group());group.name='gravity-spike-dark-payload';group.position.fromArray(anchor.position);group.userData.element='gravity';group.userData.seed=choice.seed;root.add(group);
   const material=gravityCoreMaterial(.72);material.depthWrite=false;material.uniforms.presence.value=anchor.secondary?.82:1;
   const core=gravityCosmetic(new THREE.Mesh(new THREE.IcosahedronGeometry(r*.92,2),material));core.name='gravity-spike-dark-core';core.scale.set(1,.88,1.35);group.add(core);
   const vapor:Flight['vapor']=[];for(let i=0;i<2;i++){const slice=gravityCosmetic(new THREE.Mesh(new THREE.PlaneGeometry(1,1),gravityVapor(choice.seed+i*71,.7*weight)));slice.name='gravity-spike-flight-mist';slice.position.set(i*r*.45,0,-r*(1.3+i*1.4));slice.scale.set(r*4,r*4,1);group.add(slice);vapor.push(slice);}
   flights.set(root,{group,vapor,radius:r,lastAge:-1});root.userData.gravitySpikeFlight={seed:choice.seed,secondary:anchor.secondary,weight};
  },
  updateProjectile(root,dt,age){const f=flights.get(root);if(!f||!Number.isFinite(age)||age<0||dt<=0||f.lastAge===age)return;f.lastAge=age;for(const mesh of f.vapor){mesh.material.uniforms.time.value=age;if(camera){const world=f.group.getWorldQuaternion(new THREE.Quaternion()),view=camera.getWorldQuaternion(new THREE.Quaternion());mesh.quaternion.copy(world.invert()).multiply(view);const direction=new THREE.Vector3(0,0,1).applyQuaternion(f.group.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(view.invert()),projected=Math.hypot(direction.x,direction.y);mesh.rotateZ(projected>.001?Math.atan2(-direction.x,direction.y):.4);mesh.scale.set(f.radius*4,f.radius*(3.4+projected*5),1);}}/* Let the common animator update sibling channels and casing. */},
  trail(start,end,spec){
   const group=gravityCosmetic(new THREE.Group());group.name='gravity-spike-pressure-wake';if(!isGravitySpike(spec)||!start.toArray().concat(end.toArray()).every(Number.isFinite))return group;
   const direction=end.clone().sub(start),distance=direction.length();if(distance<1e-6)return group;direction.divideScalar(distance);
   const seed=variation.seed,secondary=spec.element!=='gravity',weight=secondary?.62:1,scale=elementalFlightFamilyScale(spec),length=Math.min(distance,.9*scale),near=end.clone().addScaledVector(direction,-length);
   const width=.13*scale*(secondary?.65:1),mesh=gravityCosmetic(new THREE.Mesh(new THREE.PlaneGeometry(1,1),gravityVapor(seed,(spec.trail==='clean'?.3:.55)*weight)));mesh.position.copy(near).add(end).multiplyScalar(.5);if(camera){mesh.quaternion.copy(camera.getWorldQuaternion(new THREE.Quaternion()));const projected=direction.clone().applyQuaternion(mesh.quaternion.clone().invert()),factor=Math.hypot(projected.x,projected.y);mesh.rotateZ(factor>.001?Math.atan2(-projected.x,projected.y):0);mesh.scale.set(width,Math.max(width,length*factor),1);}else{mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);mesh.scale.set(width,length,1);}group.add(mesh);
   group.userData.gravitySpikeWake={seed,secondary,length};return group;
  }
 };
}
