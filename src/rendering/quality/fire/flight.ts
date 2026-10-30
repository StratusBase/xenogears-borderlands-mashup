import * as THREE from 'three';
import type {WeaponSpec,BrandId} from '../../../core/arsenal';
import {createElementalProjectile,createElementalTrail,createElementalBeam,updateElementalProjectile} from '../elementalFlight';
import {EffectVariationSequence} from '../shared/variation';
import {createFirePlume,updateFirePlume} from './plume';

const variations=new EffectVariationSequence();
const plumes=new WeakMap<THREE.Group,ReturnType<typeof createFirePlume>[]>();
const X=new THREE.Vector3(1,0,0);
function removeGenericFire(root:THREE.Group){
 const remove:THREE.Object3D[]=[];root.traverse(o=>{if(o!==root&&o.userData.element==='fire'&&(o.parent===root||o.parent?.userData.element!=='fire'))remove.push(o);});
 for(const object of remove){object.removeFromParent();object.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});}
 root.userData.fireStyle='hybrid';return root;
}
function flame(root:THREE.Group,at:THREE.Vector3,direction:THREE.Vector3,length:number,width:number,seed:number,cell:number,roll:number){
 const mesh=createFirePlume(seed,cell);mesh.position.copy(at);mesh.quaternion.setFromUnitVectors(X,direction);mesh.rotateX(roll);mesh.scale.set(length,width,width);root.add(mesh);updateFirePlume(mesh,.12+seed*.01);return mesh;
}
/** Retain the exact existing physical casing and unrelated elemental channel; replace Fire's cones only. */
export function createFireProjectile(spec:WeaponSpec,brand:BrandId,existing?:THREE.Group){return decorateFireProjectile(existing??createElementalProjectile(spec,brand),spec);}
export function decorateFireProjectile(root:THREE.Group,spec:WeaponSpec){
 removeGenericFire(root);
 if(spec.element==='fire'){const placeholder=root.getObjectByName('quality-primary-kinetic-payload');if(placeholder){placeholder.removeFromParent();placeholder.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});}}
 const r=Number(root.userData.flightRadius)||.05,choice=variations.next(2,'projectile'),broad=['sticky','orb','rocket','homing','cluster'].includes(spec.projectile),secondary=spec.element!=='fire',scale=secondary?.60:1;
 const z=spec.projectile==='disc'||spec.projectile==='ricochet'?0:broad?.16:.11;
 const list:ReturnType<typeof createFirePlume>[]=[];
 for(let i=0;i<(broad?3:2);i++){const a=i*Math.PI/(broad?1.5:2),at=new THREE.Vector3(secondary?-r*.7:0,0,z);const dir=new THREE.Vector3(choice.range(4+i,-.13,.13),choice.range(8+i,-.12,.12),-1).normalize();list.push(flame(root,at,dir,r*(broad?4.2:3.4)*scale,r*(broad?1.8:1.25)*scale,choice.sample(2+i)*9,choice.variant+i,a));}
 plumes.set(root,list);root.userData.fireVariation=choice.seed;return root;
}
export function updateFireProjectile(root:THREE.Group,dt:number,age:number){if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(age))return;updateElementalProjectile(root,dt,age);animateFirePayload(root,dt,age);}
export function animateFirePayload(root:THREE.Group,dt:number,age:number){if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(age))return;for(const [i,p]of (plumes.get(root)??[]).entries())updateFirePlume(p,age+i*.27);}

/** The precision line remains exact. Authored forked wakes break around it; their endpoints never feed collision. */
export function createFireTrail(start:THREE.Vector3,end:THREE.Vector3,spec:WeaponSpec,brand:BrandId,beam=false,jagged=false,existing?:THREE.Group|boolean){
 const root=existing===true?new THREE.Group():removeGenericFire(existing instanceof THREE.Group?existing:(beam?createElementalBeam(start,end,spec,jagged,brand):createElementalTrail(start,end,spec,brand))),delta=end.clone().sub(start),distance=delta.length();if(!Number.isFinite(distance)||distance<1e-6)return root;
 const direction=delta.clone().normalize(),choice=variations.next(2,beam?'beam':'trail'),broad=['sticky','orb','rocket','homing','cluster'].includes(spec.projectile),secondary=spec.element!=='fire',weight=secondary?.6:1;
 const count=beam?Math.min(7,Math.max(2,Math.ceil(distance/2.6))):broad?2:1,width=(beam?.035:broad?.028:spec.projectile==='scatter'?.007:.012)*weight;
 for(let i=0;i<count;i++){const t=beam?(i+.7)/(count+1):.75-i*.40,at=start.clone().addScaledVector(delta,t);const length=Math.min(beam?.65:broad?.28:.16,distance*.40)*weight;const p=flame(root,at,direction.clone().negate(),length,width,choice.sample(i+2)*8,choice.variant+i,choice.range(12+i,0,Math.PI));p.material.opacity=spec.trail==='clean'?.32:beam?.78:.62;}
 // A hairline supports beam precision while its surrounding Fire is curved, broken and asymmetric.
 if(beam){const geometry=new THREE.CylinderGeometry(.004*weight,.004*weight,distance,4),material=new THREE.MeshBasicMaterial({color:0xffcc73,transparent:true,opacity:.62,depthWrite:false,toneMapped:false});const line=new THREE.Mesh(geometry,material);line.position.copy(start).addScaledVector(delta,.5);line.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);line.userData.comicOverlay=true;line.raycast=()=>{};root.add(line);}
 root.userData.start=start.toArray();root.userData.end=end.toArray();root.userData.fireVariation=choice.seed;return root;
}
