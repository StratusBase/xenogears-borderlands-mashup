import * as THREE from 'three';
import type { BallisticPresentationImpact,BallisticPresentationSplash } from '../../PlayerBallistics';
import { nearestVisibleSurface as visibleContact,targetSurfaceSpan as targetSpan,type SurfaceKind as Surface } from '../shared/surfaces';
import { surfaceContactFrame as surfaceFrame,settleSurfaceParticle as settle,type SurfaceSupport as Support } from '../shared/contactFrame';
import { EffectVariationSequence } from '../shared/variation';
import { icePlateArrangement,icePlateGeometry,layeredIceFragment,layeredIceVertex,previousIceFragment,previousIceVertex,type IcePlateStyle } from './plates';
import { iceSizing } from './sizing';
import { IceRime,IceRimeMaterials } from './rime';

export const ICE_CAPACITY=Object.freeze({plates:80,flakes:192,rimeTargets:32,events:128});
const Z=new THREE.Vector3(0,0,1);
interface Particle {active:boolean;age:number;life:number;size:number;seed:number;position:THREE.Vector3;rotation:THREE.Quaternion;velocity:THREE.Vector3;spin:THREE.Vector3;delay:number;released:boolean;resting:boolean;anchor?:THREE.Mesh;local?:THREE.Vector3;localRotation?:THREE.Quaternion;support?:Support;restRotation:THREE.Quaternion}
interface Pool {mesh:THREE.InstancedMesh;items:Particle[];alpha:THREE.InstancedBufferAttribute;seeds?:THREE.InstancedBufferAttribute;next:number}
interface RimeEntry {visual:IceRime;bound:boolean;remaining:number}
function particle():Particle{return{active:false,age:0,life:1,size:1,seed:0,position:new THREE.Vector3(),rotation:new THREE.Quaternion(),velocity:new THREE.Vector3(),spin:new THREE.Vector3(),delay:0,released:false,resting:false,restRotation:new THREE.Quaternion()};}
export interface IceResponseOptions {plateStyle?:IcePlateStyle;variationSeed?:number}
/** B's independent plate release + A's localized frost. Presentation consumes events only. */
export class IceResponse {
 readonly group=new THREE.Group();readonly events:{phase:string;role:'direct'|'detonation'|'splash';surface:Surface;point:number[];normal:number[];reach:number;rime:number;plates:number;flakes:number;exposure:number;energy?:number}[]=[];
 private plates:Pool;private flakes:Pool;private rimes=new Map<THREE.Object3D,RimeEntry>();private randomState=731;private serial=0;private disposed=false;private dummy=new THREE.Object3D();
 private variation:EffectVariationSequence;
 readonly rimeMaterials=new IceRimeMaterials();
 constructor(scene:THREE.Scene,private camera?:THREE.Camera,private options:IceResponseOptions={}){
  this.variation=new EffectVariationSequence(options.variationSeed);
  this.group.name='ice-plate-rime-response';this.group.userData.presentationOnly=true;this.group.userData.comicOverlay=true;scene.add(this.group);
  this.plates=this.pool('ice-release-plates',ICE_CAPACITY.plates,icePlateGeometry());this.flakes=this.pool('ice-release-flakes',ICE_CAPACITY.flakes,new THREE.OctahedronGeometry(1,0));
 }
 private pool(name:string,count:number,geometry:THREE.BufferGeometry):Pool{
  const alpha=new THREE.InstancedBufferAttribute(new Float32Array(count),1);geometry.setAttribute('iceAlpha',alpha);
  const layered=name==='ice-release-plates'&&this.options.plateStyle!=='previous';
  const seeds=layered?new THREE.InstancedBufferAttribute(new Float32Array(count),1):undefined;if(seeds)geometry.setAttribute('iceSeed',seeds);
  const material=new THREE.ShaderMaterial({name,vertexShader:layered?layeredIceVertex:previousIceVertex,fragmentShader:layered?layeredIceFragment:previousIceFragment,transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.name=name;mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;mesh.raycast=()=>{};mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.group.add(mesh);
  return{mesh,alpha,seeds,items:Array.from({length:count},particle),next:0};
 }
 private random(){this.randomState=(Math.imul(this.randomState,1664525)+1013904223)>>>0;return this.randomState/4294967296;}
 private emit(pool:Pool,point:THREE.Vector3,size:number,life:number){
  const p=pool.items[pool.next++%pool.items.length];p.active=true;p.age=0;p.size=size;p.seed=0;p.life=life;p.position.copy(point);p.rotation.identity();p.velocity.set(0,0,0);p.spin.set(0,0,0);p.delay=0;p.released=false;p.resting=false;p.anchor=undefined;p.local=undefined;p.localRotation=undefined;p.support=undefined;p.restRotation.identity();return p;
 }
 private rime(root:THREE.Object3D,source?:THREE.Mesh){
  let entry=this.rimes.get(root);if(entry){entry.remaining=2.2;return entry;}
  // Never evict a Game-owned live status; cosmetic ground marks may be reclaimed.
  if(this.rimes.size>=ICE_CAPACITY.rimeTargets){const oldest=[...this.rimes].find(([,e])=>!e.bound);if(!oldest)return;oldest[1].visual.dispose();}
  const visual=new IceRime(root,source?[source]:undefined,this.rimeMaterials);entry={visual,bound:false,remaining:2.2};this.rimes.set(root,entry);
  const dispose=visual.dispose.bind(visual);visual.dispose=()=>{dispose();this.rimes.delete(root);};return entry;
 }
 status(root:THREE.Group):IceRime{
  let entry=this.rimes.get(root);
  if(!entry)entry=this.rime(root);
  // Status ownership may exceed the cosmetic budget; do not drop a real condition's visual.
  if(!entry){const visual=new IceRime(root,undefined,this.rimeMaterials);entry={visual,bound:true,remaining:0};this.rimes.set(root,entry);const dispose=visual.dispose.bind(visual);visual.dispose=()=>{dispose();this.rimes.delete(root);};}
  entry.bound=true;return entry.visual;
 }
 impact(event:BallisticPresentationImpact){return this.present(event,false);}
 splash(event:BallisticPresentationSplash){if(!event.primary)return this.present(event,true);}
 private present(event:BallisticPresentationImpact,secondary:boolean):Surface{
  if(this.disposed||!Number.isFinite(event.point.lengthSq()))return'ground';
  const resolved=visibleContact(event.target,event.point,event.normal),source=resolved.source??(event.hitSurface instanceof THREE.Mesh?event.hitSurface:undefined),normal=resolved.normal;
  const sizing=iceSizing({projectile:event.spec.projectile,phase:event.phase,radius:event.radius,energy:event.energy,exposure:event.exposure,secondary,channel:event.spec.element==='ice'?1:.62,targetSpan:targetSpan(event.target)});
  if(sizing.strength<=0)return resolved.surface;
  const point=resolved.point.clone().addScaledVector(normal,.012),frame=surfaceFrame(normal,point,this.serial++*.731,this.camera,Boolean(source||event.phase==='contact'));
  const support:Support|undefined=source?{point:resolved.point.clone(),normal:normal.clone(),mesh:source}:undefined;
  const root=event.target??source;if(root){const r=this.rime(root,event.target?undefined:source);r?.visual.contact(resolved.point,sizing.rime,source,normal);}
  this.events.push({phase:event.phase,role:secondary?'splash':event.phase==='detonate'?'detonation':'direct',surface:resolved.surface,point:resolved.point.toArray(),normal:normal.toArray(),reach:sizing.reach,rime:sizing.rime,plates:sizing.plates,flakes:sizing.flakes,exposure:event.exposure??1,energy:event.energy});if(this.events.length>ICE_CAPACITY.events)this.events.shift();
  const variation=this.options.plateStyle==='previous'||!sizing.plates?undefined:this.variation.next(3,event.phase);
  for(let i=0;i<sizing.plates;i++){
   const offset=new THREE.Vector3((i===0?.14:i===1?-.20:i===2?.05:i===3?-.30:.03)*sizing.reach,(i%2?.10:-.12)*sizing.reach,0).applyQuaternion(frame.rotation);
   let at=resolved.point.clone().add(offset),plateSource=source,plateNormal=normal;
   if(event.target){const projected=visibleContact(event.target,at,normal);at=projected.point;plateSource=projected.source;plateNormal=projected.normal;}
   else if(source){source.updateWorldMatrix(true,false);const ray=new THREE.Raycaster(at.clone().addScaledVector(normal,.3),normal.clone().negate(),0,.6),hits:THREE.Intersection[]=[];THREE.Mesh.prototype.raycast.call(source,ray,hits);if(!hits.length)continue;at=hits[0].point;}
   const arrangement=variation?icePlateArrangement(variation,i):undefined;
   if(arrangement){
    const candidate=resolved.point.clone().add(new THREE.Vector3(arrangement.offset.x*sizing.reach,arrangement.offset.y*sizing.reach,0).applyQuaternion(frame.rotation));
    if(event.target){const projected=visibleContact(event.target,candidate,normal);at=projected.point;plateSource=projected.source;plateNormal=projected.normal;}
    else if(source){const ray=new THREE.Raycaster(candidate.addScaledVector(normal,.3),normal.clone().negate(),0,.6),hits:THREE.Intersection[]=[];THREE.Mesh.prototype.raycast.call(source,ray,hits);if(hits.length)at=hits[0].point;}
   }
   const plateSize=sizing.plateSize*(i===0?1.18:.72+this.random()*.33);at.addScaledVector(plateNormal,Math.max(.012,plateSize*.055+.003));const p=this.emit(this.plates,at,plateSize,.64+this.random()*.14);
   p.rotation.setFromUnitVectors(Z,plateNormal).multiply(new THREE.Quaternion().setFromAxisAngle(Z,-.45+this.random()*.65));p.restRotation.copy(p.rotation);p.delay=.025+i*.023;
   p.velocity.set(i===0?1.55:i===1?-.90:i===3?-.5:.65+this.random()*.55,.25+this.random()*.38,.45+this.random()*.3).normalize().applyQuaternion(frame.rotation).multiplyScalar(sizing.speed*(i===0?1.2:.65+this.random()*.35));
   p.spin.set(2.5+this.random()*1.7,-1.4+this.random()*2.8,-1.3+this.random()*2.6);p.support=support;
   if(arrangement){
    p.rotation.setFromUnitVectors(Z,plateNormal).multiply(new THREE.Quaternion().setFromAxisAngle(Z,arrangement.yaw));p.restRotation.copy(p.rotation);p.seed=arrangement.seed;p.spin.copy(arrangement.spin);
    const local=p.velocity.clone().applyQuaternion(frame.rotation.clone().invert()),length=Math.hypot(local.x,local.y);local.x=Math.cos(arrangement.direction)*length;local.y=Math.sin(arrangement.direction)*length;p.velocity.copy(local.applyQuaternion(frame.rotation));
   }
   if(plateSource){plateSource.updateWorldMatrix(true,false);p.anchor=plateSource;p.local=plateSource.worldToLocal(at.clone());p.localRotation=plateSource.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(p.rotation);}
  }
  for(let i=0;i<sizing.flakes;i++){
   const p=this.emit(this.flakes,point,sizing.flakeSize*(.55+this.random()*.8),secondary?.30+this.random()*.20:.48+this.random()*.32);
   const choice=this.random();p.velocity.set(choice<.76?.6+this.random():-.35-this.random()*.6,-.25+this.random()*.8,.3+this.random()*.8).normalize().applyQuaternion(frame.rotation).multiplyScalar(sizing.speed*(.55+this.random()));p.spin.set(this.random()*2,this.random()*2,this.random()*2);p.released=true;p.support=support;
  }
  this.upload(0);return resolved.surface;
 }
 update(dt:number){if(this.disposed||!Number.isFinite(dt)||dt<=0)return;const step=Math.min(.1,dt);this.upload(step);for(const[root,entry]of [...this.rimes]){
  if(!root.parent){entry.visual.dispose();continue;}if(!entry.bound){entry.remaining-=step;entry.visual.update(step);entry.visual.setIntensity(Math.min(1,entry.remaining/.3));if(entry.remaining<=0)entry.visual.dispose();}
 }}
 private upload(dt:number){
  for(const pool of[this.plates,this.flakes]){let count=0;const plate=pool===this.plates;
   for(const p of pool.items){if(!p.active)continue;p.age+=dt;if(p.age>=p.life){p.active=false;p.anchor=undefined;p.support=undefined;continue;}
    if(p.resting&&p.anchor&&p.local&&p.localRotation){if(!p.anchor.parent){p.active=false;continue;}p.anchor.updateWorldMatrix(true,false);p.position.copy(p.local).applyMatrix4(p.anchor.matrixWorld);p.rotation.copy(p.anchor.getWorldQuaternion(new THREE.Quaternion())).multiply(p.localRotation);}
    if(!p.released){if(p.anchor&&p.local&&p.localRotation){if(!p.anchor.parent){p.active=false;continue;}p.anchor.updateWorldMatrix(true,false);p.position.copy(p.local).applyMatrix4(p.anchor.matrixWorld);p.rotation.copy(p.anchor.getWorldQuaternion(new THREE.Quaternion())).multiply(p.localRotation);}if(p.age>=p.delay){p.released=true;p.anchor=undefined;}}
    if(p.released&&!p.resting){p.position.addScaledVector(p.velocity,dt);p.velocity.y-=dt*6.5;p.rotation.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(p.spin.x*dt,p.spin.y*dt,p.spin.z*dt)));
     if(p.support){const local=p.support.normal.clone().applyQuaternion(p.rotation.clone().invert()),growth=THREE.MathUtils.smoothstep(p.age,0,.045);const extent=plate?p.size*((Math.abs(local.x)*1.03+Math.abs(local.y)*.71)*growth+Math.abs(local.z)*.055):p.size;
      const returning=p.velocity.dot(p.support.normal)<0;
      if(settle(p.position,extent,p.support)&&returning&&p.support.normal.y>.3){p.resting=true;p.velocity.set(0,0,0);p.rotation.copy(p.restRotation);p.position.addScaledVector(p.support.normal,(plate?p.size*.055:p.size)-extent);if(p.support.mesh){p.anchor=p.support.mesh;p.local=p.anchor.worldToLocal(p.position.clone());p.localRotation=p.anchor.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(p.rotation);}}}
     if(p.position.y<.025&&(!p.support||p.position.y<p.support.point.y-.02)){p.position.y=.025;p.velocity.set(0,0,0);p.resting=true;}
    }
    this.dummy.position.copy(p.position);this.dummy.quaternion.copy(p.rotation);const growth=plate?THREE.MathUtils.smoothstep(p.age,0,.045):1;
    this.dummy.scale.set(p.size*growth,p.size*growth,plate?p.size:p.size*.6);this.dummy.updateMatrix();pool.mesh.setMatrixAt(count,this.dummy.matrix);pool.alpha.setX(count,Math.min(1,(p.life-p.age)/.15)*.97);pool.seeds?.setX(count,p.seed);count++;
   }
   pool.mesh.count=count;pool.mesh.visible=count>0;pool.mesh.instanceMatrix.needsUpdate=true;pool.alpha.needsUpdate=true;if(pool.seeds)pool.seeds.needsUpdate=true;
  }
 }
 get diagnostics(){return{plates:this.plates.items.filter(p=>p.active).length,flakes:this.flakes.items.filter(p=>p.active).length,rimes:this.rimes.size};}
 release(root:THREE.Object3D){this.rimes.get(root)?.visual.dispose();}
 clear(){for(const pool of[this.plates,this.flakes]){for(const p of pool.items){p.active=false;p.anchor=undefined;p.support=undefined;}pool.next=0;pool.mesh.count=0;pool.mesh.visible=false;}for(const entry of[...this.rimes.values()])entry.visual.dispose();this.events.length=0;this.serial=0;this.randomState=731;this.variation.reset();}
 dispose(){if(this.disposed)return;this.clear();this.disposed=true;for(const pool of[this.plates,this.flakes]){pool.mesh.geometry.dispose();(pool.mesh.material as THREE.Material).dispose();pool.mesh.dispose();}this.rimeMaterials.dispose();this.group.removeFromParent();}
}
