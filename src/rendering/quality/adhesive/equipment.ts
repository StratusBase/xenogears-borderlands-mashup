import * as THREE from 'three';
import type {EquipmentAppearance} from '../../../core/appearance';
import {getWeaponElements,type WeaponSpec} from '../../../core/arsenal';
import {resinShaders,type ResinMaterialStyle} from './material';

function wetMaterial(style:ResinMaterialStyle){return new THREE.ShaderMaterial({name:'adhesive-equipment-resin',...resinShaders(style,'solid'),uniforms:{age:{value:0},life:{value:1000},resinVolume:{value:.80}},transparent:true,depthWrite:false,toneMapped:false});}
function overlay(group:THREE.Group){group.userData.comicOverlay=true;group.userData.presentationOnly=true;group.traverse(o=>{o.raycast=()=>{};});}
function ownedDispose(root:THREE.Object3D){const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();root.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});root.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}
export function insideWeapon(source:THREE.Object3D){for(let n:THREE.Object3D|null=source;n;n=n.parent){if(n.userData.equipmentSlot&&n.userData.equipmentSlot!=='weapon')return false;if(n.userData.visualOwner==='weapon'||n.userData.equipmentSlot==='weapon')return true;}return false;}
/** Local cartridge/hose only. Never moves a part, socket, muzzle or unrelated equipment slot. */
export class ResinEquipment {
 readonly groups:THREE.Group[]=[];private disposed=false;
 constructor(root:THREE.Object3D,appearance:EquipmentAppearance,style:ResinMaterialStyle='honey'){
  if(appearance.slot!=='weapon'||!appearance.equipped||!(appearance.element==='adhesive'||appearance.secondaryElement==='adhesive'))return;
  const candidates:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh&&insideWeapon(o)&&!o.userData.presentationOnly&&/(receiver|chamber|payload-tube|breech)/i.test(o.name))candidates.push(o);});
  const chosen=candidates.filter((o,i)=>!candidates.slice(0,i).some(p=>p.parent===o.parent)).slice(0,2);
  for(const source of chosen){
   const box=new THREE.Box3().setFromBufferAttribute(source.geometry.attributes.position as THREE.BufferAttribute),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),unit=THREE.MathUtils.clamp(Math.min(size.x,size.z)*.24,.035,.105),group=new THREE.Group();group.name='adhesive-caged-feed-module';source.add(group);group.position.set(center.x,box.max.y+unit*1.2,center.z);
   const metal=new THREE.MeshStandardMaterial({color:0x4b5550,roughness:.56,metalness:.35}),dark=new THREE.MeshStandardMaterial({color:0x263831,roughness:.75}),wet=wetMaterial(style);
   const add=(geometry:THREE.BufferGeometry,material:THREE.Material,at:THREE.Vector3)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(at);group.add(mesh);return mesh;};
   add(new THREE.CylinderGeometry(unit*.59,unit*.59,unit*2.1,12),wet,new THREE.Vector3());
   for(const y of [-1.1,1.1])add(new THREE.CylinderGeometry(unit*.72,unit*.72,unit*.18,12),metal,new THREE.Vector3(0,y*unit,0));
   for(let i=0;i<4;i++){const a=i*Math.PI*.5;add(new THREE.BoxGeometry(unit*.09,unit*2.05,unit*.09),dark,new THREE.Vector3(Math.cos(a)*unit*.64,0,Math.sin(a)*unit*.64));}
   const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(unit*.52,-unit*.65,0),new THREE.Vector3(unit*.95,-unit, -unit*.45),new THREE.Vector3(unit*.55,-unit*1.2,-Math.min(size.z*.42,unit*3))]);add(new THREE.TubeGeometry(curve,10,unit*.12,6,false),dark,new THREE.Vector3());
   const collar=add(new THREE.TorusGeometry(unit*.53,unit*.08,6,16),metal,new THREE.Vector3(unit*.55,-unit*1.2,-Math.min(size.z*.42,unit*3)));collar.rotation.y=.12;
   overlay(group);this.groups.push(group);
  }
 }
 dispose(){if(this.disposed)return;this.disposed=true;for(const group of this.groups)ownedDispose(group);this.groups.length=0;}
}
/** Adds only a resin shell and short weighted neck to the existing delivery carrier. */
export function decorateResinProjectile(root:THREE.Group,spec:WeaponSpec,style:ResinMaterialStyle='honey'){
 if(!getWeaponElements(spec).includes('adhesive'))return;
 const radius=(Number(root.userData.flightRadius)||.044)*(spec.element==='adhesive'?1:.6),group=new THREE.Group();group.name='adhesive-short-resin-neck';group.userData.presentationOnly=true;group.userData.comicOverlay=true;root.add(group);
 const material=wetMaterial(style),bulb=new THREE.Mesh(new THREE.SphereGeometry(radius,12,8),material);bulb.position.set(spec.element==='adhesive'?0:-radius*.8,0,radius*.7);bulb.scale.set(1,.90,1.5);group.add(bulb);
 const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(radius*.18,-radius*.12,-radius*1.8),new THREE.Vector3(radius*.26,-radius*.30,-radius*3.1)]),tail=new THREE.Mesh(new THREE.TubeGeometry(curve,12,radius*.20,6,false),material);tail.name='adhesive-weighted-tail';group.add(tail);root.userData.adhesiveTail=tail;root.userData.adhesiveTailBase=tail.geometry.attributes.position.array.slice();root.userData.adhesiveTailRadius=radius;
 overlay(group);
}
export function updateResinProjectile(root:THREE.Group,age:number){const tail=root.userData.adhesiveTail as THREE.Mesh|undefined,base=root.userData.adhesiveTailBase as Float32Array|undefined;if(!tail||!base)return;const positions=tail.geometry.attributes.position,r=Number(root.userData.adhesiveTailRadius)||.044;for(let i=0;i<positions.count;i++){const q=Math.min(1,Math.max(0,-base[i*3+2]/(r*3)));positions.setXYZ(i,base[i*3]+Math.sin(age*9+q*3)*r*.12*q,base[i*3+1]-Math.sin(age*7+q)*r*.08*q,base[i*3+2]);}positions.needsUpdate=true;tail.geometry.computeVertexNormals();}
export function resinTrail(start:THREE.Vector3,end:THREE.Vector3,style:ResinMaterialStyle='honey'){
 const root=new THREE.Group();root.name='adhesive-short-weighted-wake';const delta=end.clone().sub(start),distance=delta.length();if(distance<1e-7)return root;const direction=delta.divideScalar(distance),back=end.clone().addScaledVector(direction,-Math.min(.34,distance)),material=wetMaterial(style);
 const line=new THREE.Mesh(new THREE.CylinderGeometry(.003,.008,back.distanceTo(end),6),material);line.position.copy(back).add(end).multiplyScalar(.5);line.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);root.add(line);
 for(let i=0;i<2;i++){const bead=new THREE.Mesh(new THREE.SphereGeometry(.009-i*.002,8,6),material);bead.position.copy(end).addScaledVector(direction,-Math.min(distance,.10+i*.13));root.add(bead);}overlay(root);return root;
}
