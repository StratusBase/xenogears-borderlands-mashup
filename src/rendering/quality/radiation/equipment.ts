import * as THREE from 'three';
import type {EquipmentAppearance} from '../../../core/appearance';
import {getWeaponElements,type WeaponSpec} from '../../../core/arsenal';
import {EffectVariationSequence} from '../shared/variation';
import {radiationEquipmentProfile} from './equipmentProfile';
import {retainRadiationHardware,releaseRadiationHardware,cosmeticEquipment,hardwareBoxes,radiationMountHeight} from './equipmentHardware';

function tag(root:THREE.Object3D){root.userData.comicOverlay=true;root.userData.presentationOnly=true;root.traverse(o=>{o.raycast=()=>{};});}
export function radiationWeaponOwner(object:THREE.Object3D){
 let weapon=false;for(let n:THREE.Object3D|null=object;n;n=n.parent){if(n.userData.equipmentSlot&&n.userData.equipmentSlot!=='weapon')return false;if(n.userData.visualOwner&&n.userData.visualOwner!=='weapon'&&!weapon)return false;if(n.userData.equipmentSlot==='weapon'||n.userData.visualOwner==='weapon')weapon=true;}return weapon;
}
const OCHRE=new THREE.Color(0x8a6a1c),SULFUR=new THREE.Color(0xf5df3d),IVORY=new THREE.Color(0xfff3c4);
type Profile=ReturnType<typeof radiationEquipmentProfile>;
interface Device {source:THREE.Mesh;group:THREE.Group;slits:THREE.InstancedMesh;material:THREE.MeshBasicMaterial;profile:Profile;appearance:EquipmentAppearance;secondary:boolean;mech:boolean;size:THREE.Vector3;seed:number}
function weaponVisible(object:THREE.Object3D){if(!radiationWeaponOwner(object))return false;for(let o:THREE.Object3D|null=object;o;o=o.parent){if(o.userData.comicOverlay||o.userData.presentationOnly)return false;if(o.userData.visualOwner==='weapon'||o.userData.equipmentSlot==='weapon')return true;if(!o.visible)return false;}return false;}
function nearestWeapon(object:THREE.Object3D){for(let o:THREE.Object3D|null=object;o;o=o.parent)if(o.userData.visualOwner==='weapon')return o;return undefined;}
function mechConstruction(source:THREE.Object3D){for(let o:THREE.Object3D|null=source;o;o=o.parent)if(o.name==='mech-cannon'||o.userData.equipmentMode==='mech')return true;return false;}
/** Same authored Radiation chamber in every view, one cap per barrel, no receiver/optic reskin. */
export class RadiationEquipment {
 readonly groups:THREE.Group[]=[];
 private devices:Device[]=[];private hardware?:ReturnType<typeof retainRadiationHardware>;
 private elapsed=0;private lastTime=0;private shotAge=Infinity;private lastShot=-Infinity;private hold=0;private disposed=false;
 private variation:EffectVariationSequence;private discharge?:ReturnType<EffectVariationSequence['next']>;
 constructor(root:THREE.Object3D,private appearance:EquipmentAppearance){
  this.variation=new EffectVariationSequence((appearance.visualVariant??appearance.variant)*104729+797);
  if(!appearance.equipped||appearance.slot!=='weapon'||!(appearance.element==='radiation'||appearance.secondaryElement==='radiation'))return;
  const sources:THREE.Mesh[]=[],physical:THREE.Mesh[]=[];root.updateWorldMatrix(true,true);
  root.traverse(o=>{if(!(o instanceof THREE.Mesh)||o instanceof THREE.InstancedMesh||!o.geometry.attributes.position||!weaponVisible(o))return;physical.push(o);if(/^element-chamber-\d+$/.test(o.name)&&o.userData.equipmentElementSurface==='radiation')sources.push(o);});
  const parents=new Set<THREE.Object3D>();
  for(const source of sources){
   if(!source.parent||parents.has(source.parent))continue;parents.add(source.parent);this.hardware??=retainRadiationHardware();
   const parent=source.parent,toParent=new THREE.Matrix4().copy(parent.matrixWorld).invert(),bounds=new THREE.Box3().setFromBufferAttribute(source.geometry.attributes.position as THREE.BufferAttribute).applyMatrix4(new THREE.Matrix4().multiplyMatrices(toParent,source.matrixWorld)),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
   const secondary=source.name!=='element-chamber-0',mech=mechConstruction(source),metadata=parent.getObjectByName('weapon-muzzle')?.userData,localAppearance={...appearance,weaponType:metadata?.equipmentWeaponType??appearance.weaponType,form:metadata?.equipmentForm??appearance.form},profile=radiationEquipmentProfile(localAppearance,secondary,mech),u=size.x,w=size.x*1.18,length=size.z*1.12,h=u*.25;
   // A heavy cannon uses a bounded, solid containment housing above its barrel, never thin posts.
   const surfaceTop=radiationMountHeight(source,physical,center,w,length,bounds.max.y);
   let top=surfaceTop;
   if(mech){const armor=physical.find(m=>m.name==='cannon-top-armor'&&nearestWeapon(m)===nearestWeapon(source));if(armor){const b=new THREE.Box3().setFromBufferAttribute(armor.geometry.attributes.position as THREE.BufferAttribute).applyMatrix4(new THREE.Matrix4().multiplyMatrices(toParent,armor.matrixWorld));top=Math.max(top,Math.min(b.max.y,surfaceTop+u*2.5));}}
   const group=new THREE.Group();group.name='radiation-shielded-isotope-insert';group.userData.radiationMount={source:source.name,secondary,clearance:top};source.add(group);
   // Exact parent-frame mount compensation, including rotated/nonuniformly scaled source meshes.
   group.matrixAutoUpdate=false;group.matrix.copy(source.matrix).invert().multiply(new THREE.Matrix4().makeTranslation(center.x,top+.001,center.z));
   const box=(x:number,y:number,z:number,sx:number,sy:number,sz:number)=>({position:new THREE.Vector3(x,y,z),size:new THREE.Vector3(sx,sy,sz)});
   const bridge=mech?Math.max(h*1.3,top+.001-surfaceTop):h*1.3;
   group.add(hardwareBoxes(this.hardware.geometry,this.hardware.shield,[box(0,h*.5,0,w,h,length),box(-w*.46,h*.95,0,w*.1,h*.5,length),box(w*.46,h*.95,0,w*.1,h*.5,length),box(0,-bridge*.5,0,w*.92,bridge,length*.85)]));
   group.add(hardwareBoxes(this.hardware.geometry,this.hardware.ceramic,[box(0,h*.8,-length*.44,w*.94,h*.5,length*.12),box(0,h*.8,length*.44,w*.94,h*.5,length*.12)]));
   const material=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),slits=new THREE.InstancedMesh(this.hardware.geometry,material,13);slits.name='radiation-contained-slits-and-fallout';slits.userData.comicOverlay=true;slits.instanceMatrix.setUsage(THREE.DynamicDrawUsage);slits.frustumCulled=false;group.add(slits);
   const seed=Number(metadata?.equipmentVariant??appearance.visualVariant??appearance.variant)*.73+(secondary?1.7:0);
   this.devices.push({source,group,slits,material,profile,appearance:localAppearance,secondary,mech,size:new THREE.Vector3(w,h,length),seed});this.groups.push(group);cosmeticEquipment(group);
  }
  this.paint();
 }
 shot(spec?:WeaponSpec){if(this.disposed||!this.devices.length)return;const interval=this.elapsed-this.lastShot;this.lastShot=this.elapsed;this.shotAge=0;this.discharge=this.variation.next(3,'equipment-discharge');for(const d of this.devices)d.profile=radiationEquipmentProfile(d.appearance,d.secondary,d.mech,spec);this.hold=this.devices[0].profile.beam?Math.min(.5,Math.max(.12,Number.isFinite(interval)?interval*1.1:.12)):this.devices[0].profile.hold;this.paint();}
 /** Time is the existing view/game clock. A repeated render or paused dt cannot advance the charge. */
 update(time:number,dt?:number){if(this.disposed||!Number.isFinite(time)||dt!==undefined&&(!Number.isFinite(dt)||dt<=0))return;const step=Math.min(.1,Math.max(0,time-this.lastTime));this.lastTime=time;if(!step)return;this.elapsed+=step;this.shotAge+=step;this.paint();}
 private paint(){
  const matrix=new THREE.Matrix4(),color=new THREE.Color(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion();
  for(const d of this.devices){const p=d.profile,{x:w,y:h,z:length}=d.size,charge=this.shotAge<=this.hold?1:Math.exp(-(this.shotAge-this.hold)/p.decay),tick=Math.max(0,1-((this.elapsed+d.seed)%(1.3+(d.seed%1)))/.06),light=(.76+.06*Math.sin(this.elapsed*3.77+d.seed));
   for(let i=0;i<p.slits;i++){const delay=p.heavy?i*.045:0,tail=Math.exp(-Math.max(0,this.shotAge-this.hold-delay)/p.decay),hot=charge>.005?tail*p.peak:(i===Math.floor((this.elapsed+d.seed)/(1.3+(d.seed%1)))%p.slits?tick*.95:0);position.set((i-(p.slits-1)*.5)*w*.25,h*1.02,0);scale.set(w*.17,h*.16,length*(p.beam?.72:.78-i*.045));d.slits.setMatrixAt(i,matrix.compose(position,rotation,scale));if(d.secondary)color.copy(OCHRE).lerp(SULFUR,Math.min(1,.45+hot*.9)).multiplyScalar(.6+hot*.4);else color.copy(OCHRE).lerp(SULFUR,Math.min(1,.62+hot*.36)).multiplyScalar(.78+hot*.22);d.slits.setColorAt(i,color);
    // A short rear-facing viewport keeps the same contained source legible at shallow cockpit/preview angles.
    position.set((i-(p.slits-1)*.5)*w*.25,h*.60,length*.505+.0005);scale.set(w*.17,h*.72,length*.008);d.slits.setMatrixAt(p.slits+i,matrix.compose(position,rotation,scale));d.slits.setColorAt(p.slits+i,color);
    // A small ivory core is surrounded by the sulfur well; the rear viewport remains yellow at peak.
    position.set((i-(p.slits-1)*.5)*w*.25,h*1.125,0);scale.set(w*.065,h*.045,length*(p.beam?.55:.58-i*.035));d.slits.setMatrixAt(p.slits*2+i,matrix.compose(position,rotation,scale));if(!d.secondary)color.copy(OCHRE).lerp(SULFUR,light).lerp(IVORY,Math.min(.82,Math.max(0,(hot-.35)/.65)));d.slits.setColorAt(p.slits*2+i,color);}
   const life=p.heavy?.46:.30,age=this.shotAge,grains=this.discharge&&age<life?p.flecks:0;
   for(let i=0;i<grains;i++){const choice=this.discharge!,t=age/life,shrink=Math.max(0,1-t),unit=w*.065*shrink;position.set(choice.range(i+4,-.3,.3)*w+choice.range(i+14,-.022,.022)*t,h*1.2+Math.sin(t*Math.PI*.7)*(.018+(d.mech?.025:.012)),choice.range(i+24,-.3,.3)*length-(.015+choice.sample(i+34)*.025)*t);scale.set(unit,unit*.55,unit*(1.2+choice.sample(i+44)));d.slits.setMatrixAt(p.slits*3+i,matrix.compose(position,rotation,scale));d.slits.setColorAt(p.slits*3+i,color.copy(SULFUR).lerp(IVORY,.55).multiplyScalar(shrink));}
   d.slits.count=p.slits*3+grains;d.slits.instanceMatrix.needsUpdate=true;if(d.slits.instanceColor)d.slits.instanceColor.needsUpdate=true;
  }
 }
 get diagnostics(){return{groups:this.devices.length,shotAge:Number.isFinite(this.shotAge)?this.shotAge:null,devices:this.devices.map(d=>({source:d.source.name,secondary:d.secondary,mech:d.mech,delivery:d.profile.delivery,slits:d.profile.slits,flecks:d.profile.flecks,drawInstances:d.slits.count}))};}
 dispose(){if(this.disposed)return;this.disposed=true;for(const d of this.devices){d.group.removeFromParent();d.slits.dispose();d.material.dispose();d.group.traverse(o=>{if(o instanceof THREE.InstancedMesh&&o!==d.slits)o.dispose();});}if(this.hardware)releaseRadiationHardware(this.hardware);this.devices=[];this.groups.length=0;}
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
