// Frozen equipment-only baseline from the normal game before the alignment pass.
import * as THREE from 'three';
import type {EquipmentAppearance} from '../../../core/appearance';
import {getWeaponElements,type WeaponSpec} from '../../../core/arsenal';

function tag(root:THREE.Object3D){root.userData.comicOverlay=true;root.userData.presentationOnly=true;root.traverse(o=>{o.raycast=()=>{};});}
function disposeOwned(root:THREE.Object3D){const geo=new Set<THREE.BufferGeometry>(),mats=new Set<THREE.Material>();root.traverse(o=>{if(o instanceof THREE.Mesh){geo.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);}});root.removeFromParent();for(const g of geo)g.dispose();for(const m of mats)m.dispose();}
export function radiationWeaponOwner(object:THREE.Object3D){
 let weapon=false;for(let n:THREE.Object3D|null=object;n;n=n.parent){if(n.userData.equipmentSlot&&n.userData.equipmentSlot!=='weapon')return false;if(n.userData.visualOwner&&n.userData.visualOwner!=='weapon'&&!weapon)return false;if(n.userData.equipmentSlot==='weapon'||n.userData.visualOwner==='weapon')weapon=true;}return weapon;
}
/** Small shielded chamber insert. Never changes a receiver, muzzle/socket or slot transform. */
export class BeforeRadiationEquipment {
 readonly groups:THREE.Group[]=[];private lamps:THREE.MeshBasicMaterial[]=[];private disposed=false;
 constructor(root:THREE.Object3D,appearance:EquipmentAppearance){
  if(!appearance.equipped||appearance.slot!=='weapon'||!(appearance.element==='radiation'||appearance.secondaryElement==='radiation'))return;
  const sources:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh&&radiationWeaponOwner(o)&&!o.userData.presentationOnly&&!o.userData.comicOverlay&&/(receiver|chamber|breech|payload-tube)/i.test(o.name))sources.push(o);});
  const chosen=sources.filter((m,i)=>!sources.slice(0,i).some(p=>p.parent===m.parent)).slice(0,2);
  for(const source of chosen){
   const bounds=new THREE.Box3().setFromBufferAttribute(source.geometry.attributes.position as THREE.BufferAttribute),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),unit=THREE.MathUtils.clamp(Math.min(size.x,size.z)*.20,.026,.085);
   const group=new THREE.Group();group.name='radiation-shielded-isotope-insert';group.position.set(bounds.min.x-unit*.45,center.y,center.z);group.rotation.z=Math.PI/2;source.add(group);
   const shield=new THREE.MeshStandardMaterial({color:0x3b453e,roughness:.72,metalness:.3}),ceramic=new THREE.MeshStandardMaterial({color:0xafa58a,roughness:.80}),glow=new THREE.MeshBasicMaterial({color:0xcbbb46,toneMapped:false});this.lamps.push(glow);
   const add=(geometry:THREE.BufferGeometry,material:THREE.Material,at:[number,number,number])=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...at);group.add(mesh);return mesh;};
   add(new THREE.BoxGeometry(unit*2.1,unit*.70,unit*1.50),shield,[0,0,0]);
   for(const x of[-.52,.52]){add(new THREE.BoxGeometry(unit*.54,unit*.27,unit*1.28),glow,[x*unit,unit*.38,0]);for(const z of[-.70,.70])add(new THREE.BoxGeometry(unit*.63,unit*.14,unit*.14),ceramic,[x*unit,unit*.48,z*unit]);}
   for(const z of[-.60,0,.60])add(new THREE.BoxGeometry(unit*2.3,unit*.85,unit*.12),shield,[0,unit*.04,z*unit]);tag(group);this.groups.push(group);
  }
 }
 update(time:number){if(!Number.isFinite(time))return;this.lamps.forEach((m,i)=>m.color.setRGB(.69+.055*Math.sin(time*2.1+i),.62+.05*Math.sin(time*2.1+i),.16));}
 dispose(){if(this.disposed)return;this.disposed=true;for(const g of this.groups)disposeOwned(g);this.groups.length=0;this.lamps.length=0;}
}
