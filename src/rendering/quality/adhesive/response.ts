import * as THREE from 'three';
import type {BallisticPresentationImpact,BallisticPresentationSplash} from '../../PlayerBallistics';
import {nearestVisibleSurface,bodySurfaceSources,targetSurfaceSpan,type SurfaceKind} from '../shared/surfaces';
import {surfaceContactFrame,settleSurfaceParticle,type SurfaceSupport} from '../shared/contactFrame';
import {resinSizing} from './sizing';
import {createResinFold,deformResinFold,createResinProfile,RESIN_VARIANTS,type ResinProfile} from './resin';
import {resinShaders,type ResinMaterialStyle} from './material';
import {EffectVariationSequence} from '../shared/variation';
import {AdhesiveStatus,ResinMask,type ResinContact} from './surfaces';
import {createStainProfile,STAIN_VARIANTS,type ResinStainStyle} from './stains';

export const ADHESIVE_CAPACITY=Object.freeze({folds:10,drops:192,pads:96,surfaceMasks:16,statuses:32});
const Z=new THREE.Vector3(0,0,1),UP=new THREE.Vector3(0,1,0);
interface Anchor {source?:THREE.Mesh;root?:THREE.Group;local?:THREE.Vector3;localRotation?:THREE.Quaternion}
interface Fold extends Anchor {mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;active:boolean;age:number;life:number;seed:number;gravity:THREE.Vector3;profile:ResinProfile}
interface Drop extends Anchor {active:boolean;age:number;life:number;size:number;position:THREE.Vector3;velocity:THREE.Vector3;rotation:THREE.Quaternion;support?:SurfaceSupport;resting:boolean;owner?:AdhesiveStatus;intensity:number}
interface Pool {mesh:THREE.InstancedMesh;alpha:THREE.InstancedBufferAttribute;items:Drop[];next:number}
/** Consumes real combat events only. Owns cosmetic geometry, coats and pools; never applies gameplay. */
export class AdhesiveResponse {
 readonly group=new THREE.Group();readonly events:{phase:string;role:string;surface:SurfaceKind;reach:number;pad:number;drops:number;exposure:number;point:number[];normal:number[];visualSeed:number;variant:string}[]=[];
 readonly stainEvents:{seed:number;variant:string;mode:ResinStainStyle;phase:string;secondary:boolean;radius:number;angle:number;lobes:unknown}[]=[];
 private folds:Fold[]=[];private pools=new Map<string,Pool>();private statuses=new Map<THREE.Group,AdhesiveStatus>();private contacts=new WeakMap<THREE.Group,ResinContact[]>();private surfaces=new Map<THREE.Mesh,{mask:ResinMask;age:number}>();
 private serial=0;private nextFold=0;private randomState=513;private disposed=false;private dummy=new THREE.Object3D();private variations:EffectVariationSequence;
 private stainVariations:EffectVariationSequence;
 constructor(scene:THREE.Scene,private camera:THREE.Camera,visualSeed?:number,private materialStyle:ResinMaterialStyle='honey',private stainStyle:ResinStainStyle='varied'){
  this.variations=new EffectVariationSequence(visualSeed);
  this.stainVariations=new EffectVariationSequence(this.variations.seed^0x7da315bf);
  this.group.name='adhesive-a-resin-response';this.group.userData.comicOverlay=true;this.group.userData.presentationOnly=true;scene.add(this.group);
  for(let i=0;i<ADHESIVE_CAPACITY.folds;i++){
   const material=new THREE.ShaderMaterial({name:'adhesive-thick-resin-fold',...resinShaders(materialStyle,'fold'),uniforms:{age:{value:1},life:{value:.72}},transparent:true,depthTest:true,depthWrite:false,side:THREE.FrontSide,toneMapped:false});
   const mesh=new THREE.Mesh(createResinFold(materialStyle==='honey'),material);mesh.name='adhesive-directional-fold';mesh.visible=false;mesh.frustumCulled=false;mesh.renderOrder=3;mesh.raycast=()=>{};this.group.add(mesh);this.folds.push({mesh,active:false,age:0,life:.72,seed:0,gravity:new THREE.Vector3(0,-1,0),profile:createResinProfile(0)});
  }
  this.pool('drops',ADHESIVE_CAPACITY.drops);this.pool('pads',ADHESIVE_CAPACITY.pads);
 }
 private pool(name:string,count:number){
  const geometry=new THREE.SphereGeometry(1,12,8),alpha=new THREE.InstancedBufferAttribute(new Float32Array(count),1);geometry.setAttribute('resinAlpha',alpha);
  const material=new THREE.ShaderMaterial({name:`adhesive-${name}`,...resinShaders(this.materialStyle,'particles'),transparent:true,depthTest:true,depthWrite:false,toneMapped:false});
  const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.name=`adhesive-${name}-pool`;mesh.count=0;mesh.frustumCulled=false;mesh.raycast=()=>{};mesh.renderOrder=3;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.group.add(mesh);
  this.pools.set(name,{mesh,alpha,next:0,items:Array.from({length:count},()=>({active:false,age:0,life:1,size:1,position:new THREE.Vector3(),velocity:new THREE.Vector3(),rotation:new THREE.Quaternion(),resting:false,intensity:1}))});
 }
 private random(){this.randomState=(Math.imul(this.randomState,1664525)+1013904223)>>>0;return this.randomState/4294967296;}
 private emit(name:string,point:THREE.Vector3,size:number,life:number){const pool=this.pools.get(name)!,p=pool.items[pool.next++%pool.items.length];p.active=true;p.age=0;p.life=life;p.size=size;p.position.copy(point);p.velocity.set(0,0,0);p.rotation.identity();p.source=undefined;p.root=undefined;p.local=undefined;p.localRotation=undefined;p.support=undefined;p.owner=undefined;p.resting=false;p.intensity=1;return p;}
 private anchor(item:Anchor,source:THREE.Mesh|undefined,point:THREE.Vector3,rotation:THREE.Quaternion,root?:THREE.Group){
  item.root=root;if(!source)return;source.updateWorldMatrix(true,false);item.source=source;item.local=source.worldToLocal(point.clone());item.localRotation=source.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation);
 }
 impact(event:BallisticPresentationImpact){return this.present(event,false);}
 splash(event:BallisticPresentationSplash){if(!event.primary)return this.present(event,true);}
 private present(event:BallisticPresentationImpact,secondary:boolean):SurfaceKind{
  if(this.disposed||!Number.isFinite(event.point.lengthSq()))return'ground';const contact=nearestVisibleSurface(event.target,event.point,event.normal),normal=contact.normal.clone().normalize();
  if(!contact.source&&event.hitSurface instanceof THREE.Mesh){const projected=contact.point.clone();if(settleSurfaceParticle(projected,0,{point:contact.point,normal,mesh:event.hitSurface}))contact.point.copy(projected).addScaledVector(normal,-.002);}
  const size=resinSizing({delivery:event.spec.projectile,phase:event.phase,radius:event.radius,energy:event.energy,exposure:event.exposure,secondary,channel:event.spec.element==='adhesive'?1:.62,targetSpan:targetSurfaceSpan(event.target)});if(size.strength<=0)return contact.surface;
  const variation=this.variations.next(RESIN_VARIANTS.length,secondary?'secondary':event.phase),seed=variation.seed,point=contact.point.clone().addScaledVector(normal,.014),source=contact.source??(event.hitSurface instanceof THREE.Mesh?event.hitSurface:undefined),frame=surfaceContactFrame(normal,point,variation.range(47,0,18),this.camera,!!source),basis=frame.rotation;
  this.randomState=seed;this.serial++;this.events.push({phase:event.phase,role:secondary?'secondary':event.phase==='detonate'?'detonation':'direct',surface:contact.surface,reach:size.reach,pad:size.pad,drops:size.drops,exposure:size.exposure,point:contact.point.toArray(),normal:normal.toArray(),visualSeed:seed,variant:RESIN_VARIANTS[variation.variant]});if(this.events.length>128)this.events.shift();
  const stainChoice=this.stainStyle==='varied'?this.stainVariations.next(STAIN_VARIANTS.length,secondary?'secondary':event.phase):undefined,right=stainChoice?new THREE.Vector3(1,0,0).applyQuaternion(basis):undefined;
  const down=new THREE.Vector3(0,-1,0).addScaledVector(normal,normal.y),along=right?normal.clone().cross(right):undefined,downAngle=right&&along&&down.lengthSq()>.01?Math.atan2(down.dot(along),down.dot(right)):undefined;
  const stain=stainChoice?createStainProfile(stainChoice.seed,stainChoice.variant,downAngle):undefined;
  if(stain){this.stainEvents.push({seed:stain.seed,variant:STAIN_VARIANTS[stain.variant],mode:this.stainStyle,phase:event.phase,secondary,radius:size.pad,angle:stain.angle,lobes:stain.lobes});if(this.stainEvents.length>128)this.stainEvents.shift();}
  if(size.reach>0){const f=this.folds[this.nextFold++%this.folds.length];f.active=true;f.age=0;f.life=size.life*variation.range(48,.93,1.07);f.seed=seed;f.profile=createResinProfile(seed,variation.variant);f.mesh.visible=true;f.mesh.position.copy(point);f.mesh.quaternion.copy(basis);f.mesh.scale.setScalar(size.reach);f.mesh.material.uniforms.age.value=0;f.mesh.material.uniforms.life.value=f.life;f.gravity.copy(UP).negate().applyQuaternion(basis.clone().invert());this.anchor(f,contact.source,point,basis,event.target);deformResinFold(f.mesh.geometry,0,seed,f.gravity,f.profile);}
  const support:SurfaceSupport|undefined=source&&Math.abs(normal.y)>.35?{mesh:source,point:contact.point.clone(),normal:normal.clone()}:undefined;
  for(let i=0;i<size.drops;i++){
   const p=this.emit('drops',point,size.dropSize*(.65+this.random()*.6),(secondary?.65:1.05)+this.random()*.25);p.root=event.target;p.support=support;
   const angle=this.random()<.75?-.4+this.random()*.9:2.6+this.random()*.7;
   p.velocity.set(Math.cos(angle)*1.2,Math.sin(angle)*.6,.55+this.random()*.7).normalize().applyQuaternion(basis).multiplyScalar(size.speed*(.5+this.random()*.5));
  }
  const pads=source||event.target||event.phase==='contact'?1:0;
  for(let i=0;i<pads;i++){
   const local=new THREE.Vector3(i===0?0:i===1?-.22:.15,i===0?0:i===1?.10:-.24,.006).multiplyScalar(size.pad).applyQuaternion(basis),at=point.clone().add(local),p=this.emit('pads',at,size.pad*(i===0?.48:.27),event.target?.parent?.75:2.8);
   p.rotation.copy(basis);this.anchor(p,source,at,basis,event.target);p.owner=event.target?this.statuses.get(event.target):undefined;
  }
  if(contact.source&&event.target){const c:ResinContact={source:contact.source,point:contact.point.clone(),normal:normal.clone(),radius:size.pad,secondary,stain,right};const list=this.contacts.get(event.target)??[];list.push(c);while(list.length>3)list.shift();this.contacts.set(event.target,list);this.statuses.get(event.target)?.contact(c);}
  else if(source&&!secondary){let record=this.surfaces.get(source);if(!record){if(this.surfaces.size>=ADHESIVE_CAPACITY.surfaceMasks){const[key,old]=this.surfaces.entries().next().value!;old.mask.dispose();this.surfaces.delete(key);}record={mask:new ResinMask(source,this.materialStyle,this.stainStyle),age:0};this.surfaces.set(source,record);}record.age=0;record.mask.contact(contact.point,size.pad,normal,stain,right);}
  this.upload(0);return contact.surface;
 }
 status(root:THREE.Group){
  const previous=this.statuses.get(root);if(previous)return previous;
  if(this.statuses.size>=ADHESIVE_CAPACITY.statuses)this.statuses.values().next().value!.dispose();
  const status=new AdhesiveStatus(root,(c,intensity)=>this.drip(c,intensity),()=>this.statuses.delete(root),this.materialStyle,this.stainStyle);this.statuses.set(root,status);
  const contacts=this.contacts.get(root)??[];for(const c of contacts)status.contact(c);
  if(!contacts.length){const source=bodySurfaceSources(root).find(s=>/breastplate|shirt-torso|front-breastplate|torso/.test(s.name));if(source){source.updateWorldMatrix(true,false);const bounds=new THREE.Box3().setFromBufferAttribute(source.geometry.attributes.position as THREE.BufferAttribute),p=bounds.getCenter(new THREE.Vector3());p.z=bounds.max.z;p.applyMatrix4(source.matrixWorld);status.contact({source,point:p,normal:Z.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(source.matrixWorld)).normalize(),radius:.075,secondary:true});}}
  for(const p of this.pools.get('pads')!.items)if(p.active&&p.root===root)p.owner=status;
  return status;
 }
 private drip(c:ResinContact,intensity:number){const at=c.point.clone().addScaledVector(c.normal,.024);at.y-=c.radius*.40;const p=this.emit('drops',at,Math.min(.032,c.radius*.11),1.2);p.velocity.copy(c.normal).multiplyScalar(.045);p.velocity.y=-.10;p.intensity=intensity;}
 update(dt:number){
  if(this.disposed||!Number.isFinite(dt)||dt<=0)return;const step=Math.min(.1,dt);
  for(const[root,status]of this.statuses)if(!root.parent)status.dispose();
  for(const f of this.folds){if(!f.active)continue;f.age+=step;if(f.age>=f.life||f.root&&!f.root.parent||f.source&&!f.source.parent){f.active=false;f.mesh.visible=false;f.source=undefined;f.root=undefined;continue;}
   if(f.source&&f.local&&f.localRotation){f.source.updateWorldMatrix(true,false);f.mesh.position.copy(f.local).applyMatrix4(f.source.matrixWorld);f.mesh.quaternion.copy(f.source.getWorldQuaternion(new THREE.Quaternion())).multiply(f.localRotation);f.gravity.copy(UP).negate().applyQuaternion(f.mesh.quaternion.clone().invert());}
   f.mesh.material.uniforms.age.value=f.age;deformResinFold(f.mesh.geometry,f.age,f.seed,f.gravity,f.profile);
  }
  for(const[source,record]of this.surfaces){record.age+=step;if(!source.parent||record.age>=2.8){record.mask.dispose();this.surfaces.delete(source);}else record.mask.update(step,Math.min(1,(2.8-record.age)*3));}
  this.upload(step);
 }
 private upload(dt:number){
  for(const[name,pool]of this.pools){let count=0;for(const p of pool.items){if(!p.active)continue;p.age+=dt;const lifetime=p.owner?Infinity:p.life,presence=p.owner?.presence??1;
    if(p.age>=lifetime||presence<=0||p.root&&!p.root.parent||p.source&&!p.source.parent){p.active=false;p.source=undefined;p.root=undefined;p.owner=undefined;p.support=undefined;continue;}
    if(p.source&&p.local){p.source.updateWorldMatrix(true,false);p.position.copy(p.local).applyMatrix4(p.source.matrixWorld);if(p.localRotation)p.rotation.copy(p.source.getWorldQuaternion(new THREE.Quaternion())).multiply(p.localRotation);}
    if(name==='drops'&&!p.resting){p.position.addScaledVector(p.velocity,dt);p.velocity.y-=dt*6.5;p.velocity.multiplyScalar(Math.exp(-dt*1.35));
     if(p.support&&dt>0&&p.velocity.dot(p.support.normal)<0&&settleSurfaceParticle(p.position,p.size,p.support)){p.velocity.set(0,0,0);p.resting=true;this.anchor(p,p.support.mesh,p.position,new THREE.Quaternion().setFromUnitVectors(Z,p.support.normal),p.root);}
     else if(p.position.y<.035&&(!p.support||p.position.y<p.support.point.y-.02)){p.position.y=.035;p.velocity.set(0,0,0);p.resting=true;}
    }
    this.dummy.position.copy(p.position);this.dummy.quaternion.copy(p.rotation);
    if(name==='pads'){const growth=.25+.75*(1-Math.exp(-p.age*18)),s=p.size*growth;this.dummy.scale.set(s*1.15,s*.87,s*(.10+.035*Math.sin(Math.min(p.age,1)*4)));}
    else{const speed=p.velocity.length();if(speed>.001)this.dummy.quaternion.setFromUnitVectors(UP,p.velocity.clone().normalize());this.dummy.scale.set(p.size,p.size*(1+Math.min(2,speed*.65)),p.size);}
    this.dummy.updateMatrix();pool.mesh.setMatrixAt(count,this.dummy.matrix);pool.alpha.setX(count,Math.min(1,(lifetime-p.age)*4)*presence*p.intensity*.95);count++;
   }pool.mesh.count=count;pool.mesh.visible=count>0;pool.mesh.instanceMatrix.needsUpdate=true;pool.alpha.needsUpdate=true;
  }
 }
 release(root:THREE.Object3D){this.statuses.get(root as THREE.Group)?.dispose();for(const f of this.folds)if(f.root===root){f.active=false;f.mesh.visible=false;f.root=undefined;f.source=undefined;}for(const pool of this.pools.values())for(const p of pool.items)if(p.root===root){p.active=false;p.root=undefined;p.source=undefined;p.owner=undefined;p.support=undefined;}this.upload(0);}
 get diagnostics(){return{folds:this.folds.filter(f=>f.active).length,drops:this.pools.get('drops')!.items.filter(p=>p.active).length,pads:this.pools.get('pads')!.items.filter(p=>p.active).length,statuses:this.statuses.size,surfaceMasks:this.surfaces.size};}
 clear(){for(const f of this.folds){f.active=false;f.mesh.visible=false;f.source=undefined;f.root=undefined;f.local=undefined;f.localRotation=undefined;}for(const pool of this.pools.values()){for(const p of pool.items){p.active=false;p.source=undefined;p.root=undefined;p.owner=undefined;p.support=undefined;p.local=undefined;p.localRotation=undefined;}pool.next=0;pool.mesh.count=0;pool.mesh.visible=false;}for(const s of [...this.statuses.values()])s.dispose();for(const r of this.surfaces.values())r.mask.dispose();this.surfaces.clear();this.contacts=new WeakMap();this.events.length=0;this.serial=0;this.nextFold=0;this.randomState=513;this.variations.reset();this.stainVariations.reset();this.stainEvents.length=0;}
 dispose(){if(this.disposed)return;this.clear();this.disposed=true;for(const f of this.folds){f.mesh.geometry.dispose();f.mesh.material.dispose();}for(const pool of this.pools.values()){pool.mesh.geometry.dispose();(pool.mesh.material as THREE.Material).dispose();pool.mesh.dispose();}this.group.removeFromParent();}
}
