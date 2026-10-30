import * as THREE from 'three';
import {createWeaponSpec,type WeaponSpec} from '../../../core/arsenal';
import type {BallisticPresentationImpact,BallisticPresentationSplash} from '../../PlayerBallistics';
import {nearestVisibleSurface,targetSurfaceSpan,type SurfaceKind} from '../shared/surfaces';
import {surfaceContactFrame,settleSurfaceParticle,type SurfaceSupport} from '../shared/contactFrame';
import {radiationSizing} from './sizing';
import {radiationParticleMaterial,radiationLobe} from './materials';
import {RadiationResidue} from './surfaces';
import {RADIATION_TIMING as T} from './timing';
import {EffectVariationSequence} from '../shared/variation';

export const RADIATION_CAPACITY=Object.freeze({rays:96,clouds:48,grains:256,stars:96,residueTargets:32,events:128});
const Z=new THREE.Vector3(0,0,1),UP=new THREE.Vector3(0,1,0);
const DEATH_PULSE_SPEC=Object.freeze(createWeaponSpec('orb','radiation','pilot'));
interface Particle {active:boolean;age:number;life:number;seed:number;size:number;strength:number;lane:number;position:THREE.Vector3;origin:THREE.Vector3;velocity:THREE.Vector3;rotation:THREE.Quaternion;basis:THREE.Quaternion;normal:THREE.Vector3;support?:SurfaceSupport;anchor?:THREE.Mesh;local?:THREE.Vector3;resting:boolean;delay:number}
interface Pool {mesh:THREE.InstancedMesh;items:Particle[];next:number;alpha:THREE.InstancedBufferAttribute;age:THREE.InstancedBufferAttribute;seed:THREE.InstancedBufferAttribute;plane:THREE.InstancedBufferAttribute}
interface ResidueEntry {visual:RadiationResidue;bound:boolean;remaining:number}
export interface RadiationPulseEvent {point:THREE.Vector3;spec?:WeaponSpec;energy:number;radius:number;recipients:readonly {target:THREE.Group;point:THREE.Vector3;normal:THREE.Vector3;exposure:number}[]}
export interface RadiationVisualEvent {phase:string;role:'direct'|'detonation'|'splash'|'pulse';surface:SurfaceKind;point:number[];normal:number[];reach:number;deposit:number;rays:number;lobes:number;grains:number;exposure:number;energy?:number}
/** Presentation only: one A onset, one B release, then localized residue. Never applies combat effects. */
export class RadiationResponse {
 readonly group=new THREE.Group();readonly events:RadiationVisualEvent[]=[];
 private splashCues=0;private splashAudible=false;get lastSplashAudible(){return this.splashAudible;}
 private impactMerged=false;get lastImpactMerged(){return this.impactMerged;}
 private pools=new Map<string,Pool>();private residues=new Map<THREE.Object3D,ResidueEntry>();private serial=0;private rng=647;private disposed=false;private dummy=new THREE.Object3D();private elapsed=0;private variation:EffectVariationSequence;private recent=new WeakMap<THREE.Object3D,{at:number;point:THREE.Vector3;delivery:string;event?:RadiationVisualEvent}>();
 private cameraRotation=new THREE.Quaternion();private eye=new THREE.Vector3();private side=new THREE.Vector3();private facing=new THREE.Vector3();private motion=new THREE.Vector3();private localMotion=new THREE.Vector3();private turn=new THREE.Quaternion();private frameMatrix=new THREE.Matrix4();
 constructor(scene:THREE.Scene,private camera:THREE.Camera,cosmeticSeed?:number){
  this.variation=new EffectVariationSequence(cosmeticSeed);
  this.group.name='radiation-ab-response';this.group.userData.comicOverlay=true;this.group.userData.presentationOnly=true;scene.add(this.group);
  this.pool('rays',RADIATION_CAPACITY.rays,new THREE.PlaneGeometry(1,1),0);this.pool('clouds',RADIATION_CAPACITY.clouds,new THREE.PlaneGeometry(2,2,4,4),1);this.pool('grains',RADIATION_CAPACITY.grains,new THREE.OctahedronGeometry(1,0),2);this.pool('stars',RADIATION_CAPACITY.stars,new THREE.PlaneGeometry(2,2),3);
 }
 private pool(name:string,count:number,geometry:THREE.BufferGeometry,kind:number){
  const alpha=new THREE.InstancedBufferAttribute(new Float32Array(count),1),age=new THREE.InstancedBufferAttribute(new Float32Array(count),1),seed=new THREE.InstancedBufferAttribute(new Float32Array(count),1),plane=new THREE.InstancedBufferAttribute(new Float32Array(count*4),4);
  geometry.setAttribute('radAlpha',alpha);geometry.setAttribute('radAge',age);geometry.setAttribute('radSeed',seed);geometry.setAttribute('radPlane',plane);
  const mesh=new THREE.InstancedMesh(geometry,radiationParticleMaterial(kind),count);mesh.name=`radiation-${name}`;mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;mesh.raycast=()=>{};mesh.renderOrder=kind===1?4:5;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.group.add(mesh);
  this.pools.set(name,{mesh,next:0,alpha,age,seed,plane,items:Array.from({length:count},()=>({active:false,age:0,life:1,seed:0,size:1,strength:1,lane:0,position:new THREE.Vector3(),origin:new THREE.Vector3(),velocity:new THREE.Vector3(),rotation:new THREE.Quaternion(),basis:new THREE.Quaternion(),normal:Z.clone(),resting:false,delay:0}))});
 }
 private random(){this.rng=(Math.imul(this.rng,1664525)+1013904223)>>>0;return this.rng/4294967296;}
 private emit(name:string,point:THREE.Vector3,size:number,life:number){const pool=this.pools.get(name)!;let slot=-1;for(let i=0;i<pool.items.length;i++){const at=(pool.next+i)%pool.items.length;if(!pool.items[at].active){slot=at;break;}}if(slot<0){slot=0;for(let i=1;i<pool.items.length;i++)if(pool.items[i].age/pool.items[i].life>pool.items[slot].age/pool.items[slot].life)slot=i;}pool.next=(slot+1)%pool.items.length;const p=pool.items[slot];p.active=true;p.age=0;p.life=life;p.seed=this.random();p.size=size;p.strength=1;p.lane=0;p.position.copy(point);p.origin.copy(point);p.velocity.set(0,0,0);p.rotation.identity();p.basis.identity();p.normal.copy(Z);p.support=undefined;p.anchor=undefined;p.local=undefined;p.resting=false;p.delay=0;return p;}
 private residue(root:THREE.Object3D){
  const old=this.residues.get(root);if(old){old.remaining=2.4;return old;}
  if(this.residues.size>=RADIATION_CAPACITY.residueTargets){const unbound=[...this.residues.values()].find(e=>!e.bound);if(!unbound)return;unbound.visual.dispose();}
  const entry:ResidueEntry={visual:new RadiationResidue(root,()=>this.residues.delete(root)),bound:false,remaining:2.4};this.residues.set(root,entry);return entry;
 }
 status(root:THREE.Group){const entry=this.residue(root);if(!entry)return new RadiationResidue(new THREE.Group());entry.bound=true;entry.visual.seed();return entry.visual;}
 impact(event:BallisticPresentationImpact){this.impactMerged=false;if(event.phase==='contact'&&event.spec.projectile==='rocket'&&event.spec.blastRadius>0)return;return this.present(event,false);}
 splash(event:BallisticPresentationSplash){this.splashAudible=false;if(event.primary)return;const surface=this.present(event,true);if(surface!==undefined&&this.splashCues<3){this.splashCues++;this.splashAudible=true;}return surface;}
 private present(event:BallisticPresentationImpact,secondary:boolean,pulse=false):SurfaceKind|undefined{
  if(this.disposed||!Number.isFinite(event.point.lengthSq()))return'ground';
  const contact=nearestVisibleSurface(event.target,event.point,event.normal),source=contact.source??(event.hitSurface instanceof THREE.Mesh?event.hitSurface:undefined),normal=contact.normal;
  if(!event.target&&source){const projected=contact.point.clone();if(settleSurfaceParticle(projected,.010,{point:contact.point,normal,mesh:source}))contact.point.copy(projected).addScaledVector(normal,-.012);}
  const size=radiationSizing({delivery:event.spec.projectile,phase:event.phase,radius:event.radius,energy:event.energy,exposure:event.exposure,secondary,channel:event.spec.element==='radiation'?1:.62,targetSpan:targetSurfaceSpan(event.target)});
  if(size.strength<=0)return;
  const owner=event.target??source;if(!secondary&&event.phase==='contact'&&owner&&['scatter','beam'].includes(event.spec.projectile)){const recent=this.recent.get(owner);if(recent&&recent.delivery===event.spec.projectile&&this.elapsed-recent.at<(event.spec.projectile==='scatter'?.035:.065)&&recent.point.distanceToSquared(contact.point)<.36){this.impactMerged=true;if(recent.event)recent.event.energy=Math.min(100000,(recent.event.energy??0)+Math.max(0,event.energy??0));
    for(let i=0;i<2;i++){const p=this.emit('grains',contact.point,size.grainSize*(.8+this.random()*.5),.55+this.random()*.45);p.velocity.copy(normal).multiplyScalar(.4).add(new THREE.Vector3((this.random()-.5)*.5,.12,(this.random()-.5)*.3));p.strength=size.strength;}
    if(source)this.residue(event.target??source)?.visual.contact(contact.point,size.deposit,source,normal);this.upload(0);return contact.surface;}
   this.recent.set(owner,{at:this.elapsed,point:contact.point.clone(),delivery:event.spec.projectile});}
  const variation=this.variation.next(3,'radiation'),point=contact.point.clone().addScaledVector(normal,.015),seed=variation.sample(1),frame=surfaceContactFrame(normal,point,seed,this.camera,Boolean(source||event.phase==='contact'));
  // Lock the release into a readable surface tangent once; camera movement never steers existing dust.
  const right=new THREE.Vector3(1,0,0).applyQuaternion(this.camera.getWorldQuaternion(new THREE.Quaternion()));right.addScaledVector(normal,-right.dot(normal));const up=UP.clone().addScaledVector(normal,-UP.dot(normal));
  if(right.lengthSq()>.001){right.normalize().multiplyScalar(variation.variant===1?-1:1).addScaledVector(up,.22+variation.sample(2)*.15).normalize();const across=new THREE.Vector3().crossVectors(normal,right).normalize();frame.rotation.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,across,normal));}
  const support:SurfaceSupport|undefined=source?{point:contact.point.clone(),normal:normal.clone(),mesh:source}:undefined;
  this.events.push({phase:event.phase,role:pulse?'pulse':secondary?'splash':event.phase==='detonate'?'detonation':'direct',surface:contact.surface,point:contact.point.toArray(),normal:normal.toArray(),reach:size.reach,deposit:size.deposit,rays:size.rays,lobes:size.lobes,grains:size.grains,exposure:event.exposure??1,energy:event.energy});if(owner&&!secondary&&['scatter','beam'].includes(event.spec.projectile)){const recent=this.recent.get(owner);if(recent)recent.event=this.events[this.events.length-1];}if(this.events.length>RADIATION_CAPACITY.events)this.events.shift();
  for(let i=0;i<size.rays;i++){
   const angle=(i===0?.30:i===1?-.20:i===2?.88:i===3?2.95:(i-4)*.62+.02)+variation.range(10+i,-.20,.20),direction=new THREE.Vector3(Math.cos(angle),Math.sin(angle)*.7,.18+this.random()*.18).normalize().applyQuaternion(frame.rotation);
   const p=this.emit('rays',point,size.reach*(i===0?1.2:i===3?.36:.55+this.random()*.30),size.broad?T.broadFlash:T.flash);p.velocity.copy(direction);p.normal.copy(normal);p.strength=size.strength;
  }
  if(size.rays){const p=this.emit('stars',point,size.reach*(size.broad?.10:.17),T.core);p.lane=1;p.basis.copy(frame.rotation);p.normal.copy(normal);p.strength=size.strength;}
  for(let i=0;i<size.lobes;i++){const p=this.emit('clouds',point,size.reach,i===2?T.wisp:size.life);p.seed=seed;p.lane=i;p.basis.copy(frame.rotation);p.normal.copy(normal);p.support=event.target?undefined:support;p.strength=size.strength;}
  if(!secondary)for(let i=0;i<(size.broad?6:3);i++){const p=this.emit('stars',point,(size.broad?.052:.032)*Math.min(1.25,size.reach/(size.broad?1.1:.4))*(.8+this.random()*.4),.6+this.random()*.85);p.delay=.09+this.random()*.35;p.lane=0;p.velocity.set((this.random()-.20)*1.5,(this.random()-.35)*.6,.14+this.random()*.45).applyQuaternion(frame.rotation).multiplyScalar(size.reach);p.strength=size.strength;}
  for(let i=0;i<size.grains;i++){
   const p=this.emit('grains',point,size.grainSize*(.8+this.random()*.85),secondary?.24+this.random()*.26:.75+this.random()*.55),choice=this.random();
   p.velocity.set(choice<.75?.4+this.random():-.25-this.random()*.45,(this.random()-.35)*.85,.30+this.random()*.75).normalize().applyQuaternion(frame.rotation).multiplyScalar((secondary?.65:1.3)*(.55+this.random()));p.support=support;p.strength=size.strength;
  }
  if(source){const root=event.target??source;this.residue(root)?.visual.contact(contact.point,size.deposit,source,normal);}
  this.upload(0);return contact.surface;
 }
 /** Call only with the combat-owned pulse's actual point and selected recipients. No radius query here. */
 deathPulse(event:RadiationPulseEvent){
  const spec={...(event.spec??DEATH_PULSE_SPEC),element:'radiation' as const,secondaryElement:undefined};this.present({point:event.point,normal:UP.clone(),spec,radius:event.radius,energy:event.energy,phase:'detonate'},false,true);
  for(const r of event.recipients)this.present({point:r.point,normal:r.normal,spec,radius:event.radius,energy:event.energy*r.exposure,exposure:r.exposure,target:r.target,phase:'detonate'},true);
 }
 update(dt:number){
  if(this.disposed||!Number.isFinite(dt)||dt<=0)return;const step=Math.min(.1,dt);this.elapsed+=step;this.splashCues=0;this.upload(step);
  for(const [root,entry] of [...this.residues]){if(!root.parent){entry.visual.dispose();continue;}if(!entry.bound){entry.remaining-=step;entry.visual.update(step);entry.visual.setIntensity(Math.min(1,entry.remaining/.35));if(entry.remaining<=0)entry.visual.dispose();}}
 }
 private upload(dt:number){
  const cameraRotation=this.camera.getWorldQuaternion(this.cameraRotation),eye=this.camera.getWorldPosition(this.eye);
  for(const [name,pool]of this.pools){let count=0;
   for(const p of pool.items){if(!p.active)continue;p.age+=dt;if(p.age>=p.life){p.active=false;p.anchor=undefined;p.support=undefined;continue;}
    let alpha=1;this.dummy.position.copy(p.position);this.dummy.quaternion.identity();
    if(name==='rays'){
     const growth=1-Math.exp(-p.age*105),length=p.size*growth,side=this.side.copy(eye).sub(p.origin).cross(p.velocity).normalize();if(side.lengthSq()<.001)side.copy(UP).cross(p.velocity).normalize();
     const facing=this.facing.copy(p.velocity).cross(side).normalize();this.dummy.quaternion.setFromRotationMatrix(this.frameMatrix.makeBasis(p.velocity,side,facing));this.dummy.position.copy(p.origin).addScaledVector(p.velocity,length*.5);this.dummy.scale.set(length,Math.max(.012,p.size*.070)*(1-p.age/p.life),1);alpha=1-THREE.MathUtils.smoothstep(p.age/p.life,.38,1);
    }else if(name==='clouds'){
     const lobe=radiationLobe(p.age,p.seed,p.lane),weight=p.lane===0?.48:p.lane===1?.28:.19;
     const motion=this.motion.set(lobe.x*p.size,lobe.y*p.size,lobe.z*p.size).applyQuaternion(p.basis);this.dummy.position.copy(p.origin).add(motion);const rise=p.normal.y<-.65?-.10:.15;this.dummy.position.y+=lobe.t*rise;
     const direction=this.localMotion.set(p.lane===1?-1:1,.18,0).applyQuaternion(p.basis).applyQuaternion(this.turn.copy(cameraRotation).invert()),roll=Math.atan2(direction.y,direction.x);this.dummy.quaternion.copy(cameraRotation).multiply(this.turn.setFromAxisAngle(Z,roll+lobe.turn+(p.seed-.5)*.35));
     const radius=p.size*weight*lobe.growth;if(p.support)this.dummy.position.addScaledVector(p.normal,radius*.65);this.dummy.scale.set(radius*(p.lane===2?1.65:1.15)*lobe.stretch,radius*(p.lane===0?.90:p.lane===1?1:.62),1);
     alpha=Math.min(1,lobe.t/.045)*Math.min(1,(p.life-p.age)/.24)*(p.lane===0?.80:p.lane===1?.55:.27);
    }else if(name==='stars'){
     const t=Math.max(0,p.age-p.delay);this.dummy.position.copy(p.origin).addScaledVector(p.velocity,t);this.dummy.quaternion.copy(p.lane===1?p.basis:cameraRotation);this.dummy.scale.setScalar(p.size);
     alpha=p.lane===1?1-THREE.MathUtils.smoothstep(p.age,T.coreHold,p.life):p.age<p.delay?0:THREE.MathUtils.smoothstep(Math.sin(t*(11+p.seed*6)+p.seed*9),.12,.35)*Math.min(1,t/.04)*Math.min(1,(p.life-p.age)/.25);
    }else{
     if(p.anchor&&p.local){if(!p.anchor.parent){p.active=false;p.anchor=undefined;continue;}p.anchor.updateWorldMatrix(true,false);p.position.copy(p.local).applyMatrix4(p.anchor.matrixWorld);}
     if(!p.resting){p.position.addScaledVector(p.velocity,dt);p.velocity.multiplyScalar(Math.exp(-dt*1.5));p.velocity.y-=dt*1.6;
      if(p.support&&p.velocity.dot(p.support.normal)<0&&settleSurfaceParticle(p.position,p.size,p.support)){p.resting=true;p.velocity.set(0,0,0);p.anchor=p.support.mesh;if(p.anchor)p.local=p.anchor.worldToLocal(p.position.clone());}
      // No invented ground plane: grains without a real supporting contact disperse in air.
     }
     this.dummy.position.copy(p.position);const spin=p.resting?0:p.age;this.dummy.rotation.set(p.seed*4+spin*2,p.seed*6+spin*3,p.seed*9);this.dummy.scale.set(p.size,p.size*.72,p.size*.24);alpha=Math.min(1,(p.life-p.age)/.20);
    }
    this.dummy.updateMatrix();pool.mesh.setMatrixAt(count,this.dummy.matrix);pool.alpha.setX(count,alpha*p.strength);pool.age.setX(count,p.age);pool.seed.setX(count,p.seed);
    if(p.support)pool.plane.setXYZW(count,p.support.normal.x,p.support.normal.y,p.support.normal.z,-p.support.point.dot(p.support.normal));else pool.plane.setXYZW(count,0,0,0,0);count++;
   }
   pool.mesh.count=count;pool.mesh.visible=count>0;pool.mesh.instanceMatrix.needsUpdate=true;for(const a of[pool.alpha,pool.age,pool.seed,pool.plane])a.needsUpdate=true;
  }
 }
 get diagnostics(){return{rays:this.pools.get('rays')!.mesh.count,clouds:this.pools.get('clouds')!.mesh.count,grains:this.pools.get('grains')!.mesh.count,stars:this.pools.get('stars')!.mesh.count,residues:this.residues.size,bindings:[...this.residues.values()].reduce((n,e)=>n+e.visual.bindings.length,0)};}
 release(root:THREE.Object3D){this.residues.get(root)?.visual.dispose();}
 clear(){for(const p of this.pools.values()){for(const item of p.items){item.active=false;item.anchor=undefined;item.support=undefined;}p.next=0;p.mesh.count=0;p.mesh.visible=false;}for(const entry of [...this.residues.values()])entry.visual.dispose();this.events.length=0;this.splashCues=0;this.splashAudible=false;this.serial=0;this.rng=647;this.elapsed=0;this.variation.reset();this.recent=new WeakMap();}
 dispose(){if(this.disposed)return;this.clear();this.disposed=true;for(const p of this.pools.values()){p.mesh.geometry.dispose();(p.mesh.material as THREE.Material).dispose();p.mesh.dispose();}this.group.removeFromParent();}
}
