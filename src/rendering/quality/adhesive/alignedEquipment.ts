import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {EquipmentAppearance} from '../../../core/appearance';
import {createBandTexture,createComicToonMaterial} from '../../materials';
import {EffectVariationSequence} from '../shared/variation';
import {resinShaders,type ResinMaterialStyle} from './material';
import {insideWeapon} from './equipment';

export type ResinEquipmentStyle='previous'|'aligned';
function barrelRadius(barrel:THREE.Object3D,scale:number){
 const inverse=barrel.matrixWorld.clone().invert(),bounds=new THREE.Box3();barrel.traverse(o=>{if(o instanceof THREE.Mesh&&!o.userData.presentationOnly&&/^(rifled-barrel|barrel-sleeve|launcher-wide-bore|shotgun-twin-barrel|shotgun-muzzle-band|heavy-long-barrel|heavy-muzzle-brake|compact-barrel|compact-muzzle|rotary-barrel|rotary-front-collar|sniper-precision-barrel|sniper-suppressor|short-weapon-barrel|short-muzzle-collar)$/.test(o.name)){const b=new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position as THREE.BufferAttribute);b.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));bounds.union(b);}});
 return bounds.isEmpty()?.09*scale:THREE.MathUtils.clamp(Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x),Math.abs(bounds.min.y),Math.abs(bounds.max.y)),.06*scale,.25*scale);
}
interface Feed {group:THREE.Group;piston:THREE.Mesh;home:THREE.Vector3;resin:THREE.Mesh;unit:number;reload?:THREE.Object3D;reloadHome?:THREE.Vector3;reloadRotation?:THREE.Euler;material:THREE.ShaderMaterial}
/** A protected longitudinal feed and connected applicator. Existing construction/sockets never move. */
export class AlignedResinEquipment {
 readonly groups:THREE.Group[]=[];readonly shotEvents:{seed:number;gain:number}[]=[];
 private feeds:Feed[]=[];private originals:{source:THREE.Mesh;material:THREE.Material|THREE.Material[]}[]=[];private geometries=new Set<THREE.BufferGeometry>();private materials=new Set<THREE.Material>();private ramp:THREE.DataTexture|undefined;private disposed=false;private pressure=0;private variation:EffectVariationSequence;
 constructor(root:THREE.Object3D,appearance:EquipmentAppearance,style:ResinMaterialStyle='honey'){
  let seed=2166136261;for(const c of appearance.key)seed=Math.imul(seed^c.charCodeAt(0),16777619);this.variation=new EffectVariationSequence(seed>>>0);
  if(appearance.slot!=='weapon'||!appearance.equipped||!(appearance.element==='adhesive'||appearance.secondaryElement==='adhesive'))return;
  const barrels:THREE.Object3D[]=[];root.traverse(o=>{if(o.name==='weapon-barrel-assembly'&&insideWeapon(o))barrels.push(o);});
  this.ramp=createBandTexture();const toon=(color:number)=>{const m=createComicToonMaterial({color,gradientMap:this.ramp});this.materials.add(m);return m;},steel=toon(0x60736b),ceramic=toon(appearance.secondary||0xdccda8),rubber=toon(0x1c2c29);
  root.traverse(o=>{if(o instanceof THREE.Mesh&&insideWeapon(o)&&o.userData.equipmentElementSurface==='adhesive'&&!o.userData.presentationOnly){this.originals.push({source:o,material:o.material});o.material=/chamber/.test(o.name)?rubber:steel;}});
  for(const barrel of barrels.slice(0,2)){
   barrel.updateWorldMatrix(true,true);let muzzle:THREE.Object3D|undefined;barrel.traverse(o=>{if(!muzzle&&o.name==='weapon-muzzle')muzzle=o;});if(!muzzle)continue;
   const at=barrel.worldToLocal(muzzle.getWorldPosition(new THREE.Vector3())),length=Math.abs(at.z);if(length<.03)continue;
   const secondary=appearance.element!=='adhesive',scale=appearance.target==='mech'||barrel.parent?.name==='mech-cannon'?1.45:1,inner=scale>1&&root.worldToLocal(barrel.getWorldPosition(new THREE.Vector3())).x<0?1:-1,side=secondary?-inner:inner,unit=THREE.MathUtils.clamp(length*.09,.031*scale,.070*scale)*(secondary?.72:1),tankLength=Math.min(Math.max(length*.58,unit*5.3),.40*scale)*(secondary?.82:1),radius=barrelRadius(barrel,scale);
   const group=new THREE.Group();group.name='adhesive-aligned-caged-feed';group.userData.presentationOnly=true;barrel.add(group);this.groups.push(group);
   // Read the authored receiver bounds in barrel-local coordinates. Mount behind the barrel,
   // on its camera-facing shoulder; the board's side-on cylinder must also read in first person.
   const receiver=barrel.parent?.getObjectByName(scale>1?'cannon-receiver':'weapon-receiver') as THREE.Mesh|undefined;
   receiver?.updateWorldMatrix(true,false);
   const receiverBox=receiver?new THREE.Box3().setFromBufferAttribute(receiver.geometry.attributes.position as THREE.BufferAttribute).applyMatrix4(new THREE.Matrix4().multiplyMatrices(barrel.matrixWorld.clone().invert(),receiver.matrixWorld)):new THREE.Box3(new THREE.Vector3(-radius,-radius,0),new THREE.Vector3(radius,radius,length*.6));
   const center=new THREE.Vector3(side*(Math.max(Math.abs(receiverBox.min.x),Math.abs(receiverBox.max.x))+unit*1.18),receiverBox.max.y+unit*(secondary?1.12:.22),Math.max(tankLength*.43,receiverBox.min.z+tankLength*.48)),angle=new THREE.Euler(.10,-side*.28,0),feedMatrix=new THREE.Matrix4().compose(center,new THREE.Quaternion().setFromEuler(angle),new THREE.Vector3(1,1,1)),parts=new Map<THREE.Material,THREE.BufferGeometry[]>();
   const part=(g:THREE.BufferGeometry,m:THREE.Material,p:THREE.Vector3,rotation?:THREE.Euler,feed=false)=>{if(rotation)g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(rotation));g.translate(p.x,p.y,p.z);if(feed)g.applyMatrix4(feedMatrix);const list=parts.get(m)??[];list.push(g);parts.set(m,list);};
   for(const z of [-1,1]){part(new THREE.CylinderGeometry(unit*1.08,unit*1.08,unit*.36,12),rubber,new THREE.Vector3(0,0,z*tankLength*.49),new THREE.Euler(Math.PI/2,0,0),true);part(new THREE.TorusGeometry(unit*.99,unit*.075,6,12),steel,new THREE.Vector3(0,0,z*tankLength*.39),undefined,true);}
   for(const z of [-1,1])part(new THREE.TorusGeometry(unit*.88,unit*.055,6,12),rubber,new THREE.Vector3(0,0,z*tankLength*.13),undefined,true);
   for(let i=0;i<4;i++){const a=(i+.5)*Math.PI/2;part(new THREE.BoxGeometry(unit*.15,unit*.15,tankLength*.90),rubber,new THREE.Vector3(Math.cos(a)*unit*.94,Math.sin(a)*unit*.94,0),new THREE.Euler(0,0,a),true);}
   for(const z of [-1,1])part(new THREE.BoxGeometry(unit*.48,unit*.70,unit*.40),steel,new THREE.Vector3(0,-unit*1.1,z*tankLength*.31),undefined,true);
   // Bounded, ribbed pressure hose visibly connects the rear cartridge outlet to the applicator.
   const inlet=new THREE.Vector3(side*(radius+.024*scale),-radius*.52,at.z*.79),outlet=new THREE.Vector3(0,-unit*.52,tankLength*.43).applyMatrix4(feedMatrix),bend=outlet.clone().lerp(inlet,.44);bend.x=side*Math.max(Math.abs(center.x),radius+unit);bend.y=-Math.max(radius,unit)*1.35;
   const hose=new THREE.CatmullRomCurve3([outlet,bend,inlet]);part(new THREE.TubeGeometry(hose,18,unit*.21,7,false),rubber,new THREE.Vector3());
   for(let i=0;i<7;i++){const t=.10+i*.13,q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),hose.getTangent(t));part(new THREE.TorusGeometry(unit*.23,unit*.045,5,8),steel,hose.getPoint(t),new THREE.Euler().setFromQuaternion(q));}
   for(const p of [outlet,inlet])part(new THREE.BoxGeometry(unit*.5,unit*.48,unit*.5),steel,p);
   // A hollow stepped rear-of-muzzle collar keeps the existing bore/socket open.
   for(const [fraction,m,r]of [[.75,rubber,1.06],[.79,ceramic,1.08],[.84,rubber,1.04]]as const)part(new THREE.TorusGeometry(radius*r,unit*(m===ceramic?.20:.12),6,14),m,new THREE.Vector3(0,0,at.z*fraction));
   for(const [material,pieces]of parts){const geometry=mergeGeometries(pieces,false)!;for(const g of pieces)g.dispose();geometry.computeBoundingBox();const origin=geometry.boundingBox!.getCenter(new THREE.Vector3());geometry.translate(-origin.x,-origin.y,-origin.z);this.geometries.add(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(origin);mesh.name='adhesive-feed-hardware';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
   // The cartridge deliberately shares the projectile honey program. Its persistent material
   // keeps short-lived rifle shots from deleting/recompiling that program on every shot.
   const wet=new THREE.ShaderMaterial({name:'adhesive-honey-feed',...resinShaders(style,'solid'),uniforms:{pressure:{value:0},age:{value:0},life:{value:1000},resinVolume:{value:.79}},transparent:true,depthWrite:false,toneMapped:false});this.materials.add(wet);
   const geometry=new THREE.CylinderGeometry(unit*.83,unit*.83,tankLength*.94,16,1,true);geometry.rotateX(Math.PI/2);this.geometries.add(geometry);const resin=new THREE.Mesh(geometry,wet);resin.name='adhesive-honey-cartridge';resin.position.copy(center);resin.rotation.copy(angle);resin.renderOrder=3;resin.userData.comicOverlay=true;group.add(resin);
   const pistonGeometry=new THREE.CylinderGeometry(unit*.38,unit*.38,unit*.52,8);pistonGeometry.rotateX(Math.PI/2);this.geometries.add(pistonGeometry);const piston=new THREE.Mesh(pistonGeometry,steel);piston.name='adhesive-pressure-valve';piston.position.copy(new THREE.Vector3(0,0,tankLength*.57).applyMatrix4(feedMatrix));piston.rotation.copy(angle);group.add(piston);
   let owner:THREE.Object3D|null=barrel.parent;const reload=owner?.getObjectByName(scale>1?'cannon-breech':'weapon-magazine');
   this.feeds.push({group,piston,home:piston.position.clone(),resin,unit,reload,reloadHome:reload?.position.clone(),reloadRotation:reload?.rotation.clone(),material:wet});
   group.traverse(o=>{o.userData.presentationOnly=true;o.raycast=()=>{};});
  }
 }
 shot(){if(this.disposed||!this.feeds.length)return;const choice=this.variation.next(3,'pressure');this.pressure=choice.range(1,.72,1);this.shotEvents.push({seed:choice.seed,gain:this.pressure});if(this.shotEvents.length>32)this.shotEvents.shift();}
 update(dt:number,_time:number){if(this.disposed||!Number.isFinite(dt)||dt<=0)return;this.pressure*=Math.exp(-Math.min(dt,.1)*16);
  for(const f of this.feeds){const reload=f.reload&&f.reloadHome?THREE.MathUtils.clamp(f.reload.position.distanceTo(f.reloadHome)*3+Math.abs(f.reload.rotation.x-(f.reloadRotation?.x??0))*.7+Math.abs(f.reload.rotation.z-(f.reloadRotation?.z??0))*.4,0,1):0;f.piston.position.copy(f.home);f.piston.position.z+=f.unit*(reload*.40-this.pressure*.18);f.resin.scale.set(1+this.pressure*.018,1-this.pressure*.025,1);f.material.uniforms.pressure.value=this.pressure;}
 }
 clear(){if(this.disposed)return;this.pressure=0;this.shotEvents.length=0;this.variation.reset();this.update(.000001,0);}
 dispose(){if(this.disposed)return;this.disposed=true;for(const o of this.originals)o.source.material=o.material;this.originals=[];for(const g of this.groups)g.removeFromParent();this.groups.length=0;this.feeds=[];for(const g of this.geometries)g.dispose();for(const m of this.materials)m.dispose();this.geometries.clear();this.materials.clear();this.ramp?.dispose();}
}
