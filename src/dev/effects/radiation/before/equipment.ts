// Frozen pre-finish A+B comparison only. Shared services remain shared.
import * as THREE from 'three';
import type {EquipmentAppearance} from '../../../../core/appearance';
import {getWeaponElements,type WeaponSpec} from '../../../../core/arsenal';

function tag(root:THREE.Object3D){root.userData.comicOverlay=true;root.userData.presentationOnly=true;root.traverse(o=>{o.raycast=()=>{};});}
function disposeOwned(root:THREE.Object3D){const geo=new Set<THREE.BufferGeometry>(),mats=new Set<THREE.Material>();root.traverse(o=>{if(o instanceof THREE.Mesh){geo.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);}});root.removeFromParent();for(const g of geo)g.dispose();for(const m of mats)m.dispose();}
export function radiationWeaponOwner(object:THREE.Object3D){
 let weapon=false;for(let n:THREE.Object3D|null=object;n;n=n.parent){if(n.userData.equipmentSlot&&n.userData.equipmentSlot!=='weapon')return false;if(n.userData.visualOwner&&n.userData.visualOwner!=='weapon'&&!weapon)return false;if(n.userData.equipmentSlot==='weapon'||n.userData.visualOwner==='weapon')weapon=true;}return weapon;
}
/** Small shielded chamber insert. Never changes a receiver, muzzle/socket or slot transform. */
export class RadiationEquipment {
 readonly groups:THREE.Group[]=[];private lamps:THREE.MeshBasicMaterial[]=[];private disposed=false;
 constructor(root:THREE.Object3D,appearance:EquipmentAppearance){
  if(!appearance.equipped||appearance.slot!=='weapon'||!(appearance.element==='radiation'||appearance.secondaryElement==='radiation'))return;
  const sources:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh&&radiationWeaponOwner(o)&&!o.userData.presentationOnly&&!o.userData.comicOverlay&&/(receiver|chamber|breech|payload-tube)/i.test(o.name))sources.push(o);});
  const chosen=sources.filter((m,i)=>!sources.slice(0,i).some(p=>p.parent===m.parent)).slice(0,2);
  for(const source of chosen){
   const bounds=new THREE.Box3().setFromBufferAttribute(source.geometry.attributes.position as THREE.BufferAttribute),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),unit=THREE.MathUtils.clamp(Math.min(size.x,size.z)*.20,.026,.085);
   const group=new THREE.Group();group.name='radiation-shielded-isotope-insert';group.position.set(bounds.max.x+unit*.45,center.y,center.z);group.rotation.z=-Math.PI/2;source.add(group);
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
export function decorateRadiationProjectile(root:THREE.Group,spec:WeaponSpec){
 if(!getWeaponElements(spec).includes('radiation'))return;const radius=(Number(root.userData.flightRadius)||.035)*(spec.element==='radiation'?1:.6),group=new THREE.Group(),material=new THREE.MeshBasicMaterial({color:0xf4e58f,toneMapped:false});group.name='radiation-compact-isotope-core';
 const core=new THREE.Mesh(new THREE.OctahedronGeometry(radius*.65,0),material);core.scale.set(.65,.65,1.6);group.add(core);
 for(let i=0;i<2;i++){const fleck=new THREE.Mesh(new THREE.BoxGeometry(radius*.16,radius*.16,radius*.32),material);fleck.position.set((i===0?-1:1)*radius*.55,0,-radius*(1.6+i*1.1));group.add(fleck);}tag(group);root.add(group);
}
/** Finite small wake. The engine still owns every start/end, carrier pose and collision. */
export function radiationTrail(start:THREE.Vector3,end:THREE.Vector3,secondary=false){
 const root=new THREE.Group();root.name='radiation-short-dash-wake';const delta=end.clone().sub(start),distance=delta.length();if(distance<1e-6)return root;const direction=delta.divideScalar(distance),length=Math.min(distance,.64),weight=secondary?.62:1;
 const material=new THREE.MeshBasicMaterial({color:0xe3d265,transparent:true,opacity:.65,toneMapped:false,depthWrite:false});
 for(let i=0;i<3;i++){const at=end.clone().addScaledVector(direction,-Math.min(distance,length*(.15+i*.31))),mesh=new THREE.Mesh(new THREE.OctahedronGeometry((.010-i*.002)*weight,0),material);mesh.position.copy(at);mesh.scale.set(1,1,2.3);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);root.add(mesh);}tag(root);return root;
}

/** Endpoints stay exact; no containment rings or full-length fog sheath. */
export function radiationBeam(start:THREE.Vector3,end:THREE.Vector3,secondary=false){
 const root=new THREE.Group();root.name='radiation-precise-beam';root.userData.start=start.toArray();root.userData.end=end.toArray();const delta=end.clone().sub(start),length=delta.length();if(length<1e-6)return root;
 const beam=new THREE.Mesh(new THREE.CylinderGeometry(secondary?.004:.007,secondary?.004:.007,length,5),new THREE.MeshBasicMaterial({color:0xf8edb2,toneMapped:false,transparent:true,opacity:.86,depthWrite:false}));beam.position.copy(start).addScaledVector(delta,.5);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());root.add(beam);root.add(radiationTrail(start,end,secondary));tag(root);return root;
}
