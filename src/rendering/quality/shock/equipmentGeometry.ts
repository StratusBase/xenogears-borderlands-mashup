import * as THREE from 'three';
import type {EquipmentAppearance} from '../../../core/appearance';

export interface ShockAssembly {owner:THREE.Object3D;sources:THREE.Mesh[];index:number;side:number;delivery:string;variant:number}
export function shockWeaponOwned(object:THREE.Object3D):boolean{
 for(let node:THREE.Object3D|null=object;node;node=node.parent){if(node.userData.comicOverlay||node.userData.presentationOnly)return false;const slot=node.userData.visualOwner??node.userData.equipmentSlot;if(slot!==undefined)return slot==='weapon';}return false;
}
export function relativeEquipmentMatrix(object:THREE.Object3D,ancestor:THREE.Object3D,out=new THREE.Matrix4()):THREE.Matrix4{
 out.identity();for(let node:THREE.Object3D|null=object;node&&node!==ancestor;node=node.parent){if(node.matrixAutoUpdate)node.updateMatrix();out.premultiply(node.matrix);}return out;
}
export function shockAssemblies(root:THREE.Object3D,appearance:EquipmentAppearance):ShockAssembly[]{
 if(!appearance.equipped||appearance.slot!=='weapon'||!(appearance.element==='shock'||appearance.secondaryElement==='shock'))return[];
 const groups=new Map<THREE.Object3D,THREE.Mesh[]>(),muzzles:THREE.Object3D[]=[];
 root.traverse(o=>{if(o.name==='weapon-muzzle'&&shockWeaponOwned(o))muzzles.push(o);if(!(o instanceof THREE.Mesh)||o.userData.equipmentElementSurface!=='shock'||!shockWeaponOwned(o))return;let parent=o.parent;while(parent&&parent!==root&&parent.name!=='weapon-barrel-assembly')parent=parent.parent;if(!parent)return;const list=groups.get(parent)??[];list.push(o);groups.set(parent,list);});
 return[...groups].map(([owner,sources],index)=>{let socket:THREE.Object3D|undefined;owner.traverse(o=>{if(o.userData.equipmentElement==='shock'&&o.userData.equipmentProjectile)socket=o;});const muzzle=muzzles.findIndex(m=>{for(let n:THREE.Object3D|null=m;n;n=n.parent)if(n===owner)return true;return false;});return{owner,sources,index:muzzle<0?index:muzzle,side:muzzles.length>1&&muzzle===0?1:-1,delivery:String(socket?.userData.equipmentProjectile??appearance.projectile??'bullet'),variant:Number(socket?.userData.equipmentVariant??appearance.visualVariant??appearance.variant)||0};});
}
const core=/^(rifled-barrel|short-weapon-barrel|compact-barrel|heavy-long-barrel|sniper-precision-barrel|shotgun-twin-barrel|rotary-barrel|rotary-front-collar|rotary-rear-collar|launcher-wide-bore|launcher-muzzle-rim)$/;
export function assemblySolids(owner:THREE.Object3D):{source:THREE.Mesh;bounds:THREE.Box3}[]{const values:{source:THREE.Mesh;bounds:THREE.Box3}[]=[];owner.traverse(o=>{if(o instanceof THREE.Mesh&&core.test(o.name)&&shockWeaponOwned(o)){const bounds=new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position as THREE.BufferAttribute).applyMatrix4(relativeEquipmentMatrix(o,owner));values.push({source:o,bounds});}});return values;}
/** Only the Shock-owned collar changes. Match the actual barrel cross-section,
 * not a fixed radius shared by launchers, twin barrels and precision weapons. */
export function fitShockCollar(source:THREE.Mesh,assembly:ShockAssembly,solids:ReturnType<typeof assemblySolids>):THREE.BufferGeometry|undefined{
 if(!source.name.startsWith('element-transfer-band'))return;
 const before=new THREE.Box3().setFromBufferAttribute(source.geometry.attributes.position as THREE.BufferAttribute),pose=relativeEquipmentMatrix(source,assembly.owner),center=before.getCenter(new THREE.Vector3()).applyMatrix4(pose);let radius=0;
 for(const {bounds}of solids)if(center.z>=bounds.min.z-.003&&center.z<=bounds.max.z+.003)radius=Math.max(radius,Math.abs(bounds.min.x-center.x),Math.abs(bounds.max.x-center.x),Math.abs(bounds.min.y-center.y),Math.abs(bounds.max.y-center.y));
 // Mixed cartridges share the same axial positions. Use a raised partial
 // contact strap rather than burying Shock or masking the entire other band.
 let mixed=false;assembly.owner.traverse(o=>{if(!(o instanceof THREE.Mesh)||o===source||!o.name.startsWith('element-transfer-band')||!o.userData.equipmentElementSurface||o.userData.equipmentElementSurface==='shock'||!shockWeaponOwned(o))return;const bounds=new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position as THREE.BufferAttribute).applyMatrix4(relativeEquipmentMatrix(o,assembly.owner));if(center.z<bounds.min.z||center.z>bounds.max.z)return;mixed=true;radius=Math.max(radius,Math.abs(bounds.min.x-center.x),Math.abs(bounds.max.x-center.x),Math.abs(bounds.min.y-center.y),Math.abs(bounds.max.y-center.y));});
 if(radius<=0)return;radius=radius*1.065+.0015;
 const sx=new THREE.Vector3().setFromMatrixColumn(pose,0).length(),sz=new THREE.Vector3().setFromMatrixColumn(pose,2).length();if(sx<1e-6||sz<1e-6)return;
 const normal=new THREE.Vector3(assembly.side*.55,.84,0).transformDirection(pose.clone().invert()),theta=Math.atan2(normal.x,normal.z),start=mixed?theta-Math.PI/3:0,length=mixed?Math.PI*2/3:Math.PI*2;
 const base=new THREE.CylinderGeometry(1,1,before.max.y-before.min.y,mixed?5:10,1,false,start,length),geometry=base.toNonIndexed();base.dispose();geometry.scale(radius/sx,1,radius/sz);geometry.userData.shockArc={start,length};return geometry;
}
export function enclosedShockSource(source:THREE.Mesh,assembly:ShockAssembly,solids:ReturnType<typeof assemblySolids>):boolean{
 const box=new THREE.Box3().setFromBufferAttribute(source.geometry.attributes.position as THREE.BufferAttribute).applyMatrix4(relativeEquipmentMatrix(source,assembly.owner));return solids.some(s=>s.source!==source&&s.bounds.clone().expandByScalar(-.001).containsBox(box));
}
/** Raycast the real local geometry once. The resulting frame lives under that
 * source, so later recoil/reload/root motion cannot lag the attached terminals. */
export function shockTerminalFrame(source:THREE.Mesh,assembly:ShockAssembly){
 const pose=relativeEquipmentMatrix(source,assembly.owner),inverse=pose.clone().invert(),normal=new THREE.Vector3(assembly.side*.55,.84,0).transformDirection(inverse),box=new THREE.Box3().setFromBufferAttribute(source.geometry.attributes.position as THREE.BufferAttribute),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),probe=new THREE.Mesh(source.geometry,material),ray=new THREE.Raycaster(center.clone().addScaledVector(normal,size.length()*2),normal.clone().negate()),hits:THREE.Intersection[]=[];probe.updateMatrixWorld();THREE.Mesh.prototype.raycast.call(probe,ray,hits);material.dispose();const hit=hits[0];
 if(!hit?.face)return;normal.copy(hit.face.normal).normalize();const along=new THREE.Vector3(0,0,-1).transformDirection(inverse);along.addScaledVector(normal,-along.dot(normal)).normalize();if(along.lengthSq()<.5)along.set(0,1,0);const right=new THREE.Vector3().crossVectors(along,normal).normalize();along.crossVectors(normal,right).normalize();
 let unit=THREE.MathUtils.clamp(Math.max(size.x,size.z)*.065,.007,.026);if(source.name.startsWith('element-transfer-band'))unit=Math.min(unit,size.y*.45);const gap=unit*1.7;
 return{point:hit.point.clone().addScaledVector(normal,unit*.26),rotation:new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,along,normal)),unit,gap};
}
