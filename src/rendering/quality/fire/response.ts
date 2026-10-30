import * as THREE from 'three';
import type { BallisticPresentationImpact,BallisticPresentationSplash } from '../../PlayerBallistics';
import { projectVisibleSurface,surfaceKindOf as materialKind,nearestVisibleSurface as visibleContact,bodySurfaceSources as visibleSources,targetSurfaceSpan as targetSpan,type SurfaceKind } from '../shared/surfaces';
import { fireSizing } from './sizing';
import { FireHybrid } from './hybrid';
import {EffectVariationSequence} from '../shared/variation';
import {createFirePlume,disposeFirePlume} from './plume';
import {createFireProjectile,createFireTrail} from './flight';
import {createWeaponSpec} from '../../../core/arsenal';
import {fireImpactDirection} from './direction';
import { FIRE_LOBES,fireLobes,createFireVolumeGeometry,fireVolumeVertex,fireVolumeFragment,fireParticleVertex,fireParticleFragment } from './flame';
import { FireStatus,FireMask,type FireContact } from './surface';

export const FIRE_CAPACITY=Object.freeze({sheets:12,embers:256,tongues:96,smoke:24,scorches:16});
const UP=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1);
interface Sheet {mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;age:number;size:number;seed:number;life:number;explosive:boolean;lobes:THREE.Vector4[];active:boolean}
interface Particle {active:boolean;age:number;life:number;size:number;seed:number;position:THREE.Vector3;velocity:THREE.Vector3;drift:THREE.Vector3;anchor?:THREE.Mesh;local?:THREE.Vector3;normal:THREE.Vector3;localNormal?:THREE.Vector3;intensity:number}
interface Pool {mesh:THREE.InstancedMesh;items:Particle[];next:number;alpha:THREE.InstancedBufferAttribute;age:THREE.InstancedBufferAttribute;seed:THREE.InstancedBufferAttribute;support:THREE.InstancedBufferAttribute;supported:THREE.InstancedBufferAttribute}
/** Fixed-capacity, presentation-only A ignition + B aftermath + C actual detonation. */
export class FireResponse {
 private readonly variations:EffectVariationSequence;private warmPlume:ReturnType<typeof createFirePlume>|undefined;private warmFlight:THREE.Group|undefined;readonly hybrid:FireHybrid|undefined;private warmSurface:{source:THREE.Mesh;mask:FireMask}|undefined;private preparation:Promise<void>|undefined;
 readonly group=new THREE.Group();readonly events:{phase:string;role:string;explosive:boolean;surface:SurfaceKind;size:number;coatingRadius:number;embers:number;exposure:number;point:number[];variant?:number;seed?:number;direction?:ReturnType<typeof fireImpactDirection>}[]=[];
 private readonly sheets:Sheet[]=[];private readonly pools=new Map<string,Pool>();private readonly statuses=new Map<THREE.Group,FireStatus>();private contacts=new WeakMap<THREE.Group,FireContact[]>();
 private readonly scorches=new Map<THREE.Mesh,{mask:FireMask;age:number;next:number;contact:FireContact}>();private randomState=319;private serial=0;private nextSheet=0;private time=0;private disposed=false;private readonly dummy=new THREE.Object3D();
 constructor(scene:THREE.Scene,private readonly camera:THREE.Camera,private readonly options:{hybrid?:boolean;full?:boolean;seed?:number}={}){
  this.variations=new EffectVariationSequence(options.seed);
  if(options.hybrid)this.hybrid=new FireHybrid(scene,camera);
  this.group.name='fire-abc-response';this.group.userData.comicOverlay=true;this.group.userData.presentationOnly=true;scene.add(this.group);
  for(let i=0;i<FIRE_CAPACITY.sheets;i++){
   const lobes=Array.from({length:FIRE_LOBES},()=>new THREE.Vector4());
   const material=new THREE.ShaderMaterial({name:'fire-turbulent-combustion',forceSinglePass:true,vertexShader:fireVolumeVertex,fragmentShader:fireVolumeFragment,uniforms:{age:{value:1},seed:{value:0},explosive:{value:0},life:{value:.68},supported:{value:0},supportPlane:{value:new THREE.Vector4()},lobes:{value:lobes}},transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
   const mesh=new THREE.Mesh(createFireVolumeGeometry(),material);mesh.name='fire-turbulent-volume';mesh.visible=false;mesh.frustumCulled=false;mesh.raycast=()=>{};mesh.renderOrder=4;this.group.add(mesh);
   this.sheets.push({mesh,age:1,size:1,seed:0,life:.68,explosive:false,lobes,active:false});
  }
  this.pool('embers',FIRE_CAPACITY.embers,new THREE.BoxGeometry(1,1,1),0);this.pool('tongues',FIRE_CAPACITY.tongues,new THREE.PlaneGeometry(1,1,2,10),1);this.pool('smoke',FIRE_CAPACITY.smoke,new THREE.PlaneGeometry(1,1,2,8),2);
  if(options.full){const mesh=this.pools.get('embers')!.mesh;mesh.onBeforeRender=renderer=>{mesh.onBeforeRender=()=>{};queueMicrotask(()=>{if(!this.disposed)void this.prepare(renderer,scene).catch(e=>console.error('Fire shader preparation failed',e));});};}
 }
 private pool(name:string,count:number,geometry:THREE.BufferGeometry,kind:number){
  const alpha=new THREE.InstancedBufferAttribute(new Float32Array(count),1),age=new THREE.InstancedBufferAttribute(new Float32Array(count),1),seed=new THREE.InstancedBufferAttribute(new Float32Array(count),1);
  const support=new THREE.InstancedBufferAttribute(new Float32Array(count*4),4),supported=new THREE.InstancedBufferAttribute(new Float32Array(count),1);geometry.setAttribute('fxSupport',support);geometry.setAttribute('fxSupported',supported);
  geometry.setAttribute('fxAlpha',alpha);geometry.setAttribute('fxAge',age);geometry.setAttribute('fxSeed',seed);
  const material=new THREE.ShaderMaterial({name:`fire-${name}`,uniforms:{kind:{value:kind},hybrid:{value:this.hybrid?1:0},cel:{value:this.options.full?1:0}},vertexShader:fireParticleVertex,fragmentShader:fireParticleFragment,transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.name=`fire-${name}-pool`;mesh.count=0;mesh.frustumCulled=false;mesh.raycast=()=>{};mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.renderOrder=name==='smoke'?5:4;this.group.add(mesh);
  this.pools.set(name,{mesh,alpha,age,seed,support,supported,next:0,items:Array.from({length:count},()=>({active:false,age:0,life:1,size:1,seed:0,position:new THREE.Vector3(),velocity:new THREE.Vector3(),drift:new THREE.Vector3(),normal:Z.clone(),intensity:1}))});
 }
 private random(){this.randomState=(Math.imul(this.randomState,1664525)+1013904223)>>>0;return this.randomState/4294967296;}
 private emit(name:string,point:THREE.Vector3,size:number,life:number){const pool=this.pools.get(name)!,p=pool.items[pool.next++%pool.items.length];p.active=true;p.position.copy(point);p.velocity.set(0,0,0);p.drift.set(0,0,0);p.age=0;p.life=life;p.size=size;p.seed=this.random();p.anchor=undefined;p.local=undefined;p.localNormal=undefined;p.normal.copy(Z);p.intensity=1;return p;}
 impact(event:BallisticPresentationImpact){return this.present(event,false);}
 splash(event:BallisticPresentationSplash){if(!event.primary)return this.present(event,true);}
 private present(event:BallisticPresentationImpact,secondary:boolean):SurfaceKind{
  if(this.disposed||!Number.isFinite(event.point.lengthSq()))return'ground';
  const contact=visibleContact(event.target,event.point,event.normal),normal=contact.normal.clone().normalize();
  const sizes=fireSizing({delivery:event.spec.projectile,phase:event.phase,radius:event.radius,energy:event.energy,exposure:event.exposure,secondary,channelWeight:(event.spec.element==='fire'?1:.64)*(event.stage==='bomblet'?.32:1),targetSpan:targetSpan(event.target)});
  if(sizes.strength<=0)return contact.surface;
  const variation=this.variations.next(this.options.full?6:2,secondary?'secondary':sizes.explosive?'detonation':'contact'),direction=this.options.full?fireImpactDirection(variation):undefined;
  const point=contact.point.clone().addScaledVector(normal,.022),seed=this.options.full?variation.sample(1)*20:this.serial++*.731;
  this.events.push({phase:event.phase,role:secondary?'secondary':sizes.explosive?'detonation':'direct',explosive:sizes.explosive,surface:contact.surface,size:sizes.sheetSize,coatingRadius:sizes.coatingRadius,embers:sizes.emberCount,exposure:sizes.exposure,point:contact.point.toArray(),variant:variation.variant,seed:variation.seed,direction});if(this.events.length>128)this.events.shift();
  let along=UP.clone().addScaledVector(normal,-normal.y);
  if(along.lengthSq()<.01){along=this.camera.getWorldPosition(new THREE.Vector3()).sub(point);along.addScaledVector(normal,-along.dot(normal));if(along.lengthSq()<.01)along.set(0,0,1);}
  along.normalize();const right=along.clone().cross(normal).normalize(),basis=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,normal.clone().cross(right),normal));
  if(direction)right.multiplyScalar(direction.hand);
  if(sizes.sheetSize>0){
   if(!secondary)this.hybrid?.emit(contact.point,normal,sizes.sheetSize,sizes.explosive,seed,contact.source,this.options.full?variation.variant:0,direction);
   const sheet=this.sheets[this.nextSheet++%this.sheets.length];sheet.age=0;sheet.size=sizes.sheetSize*(this.hybrid?(this.options.full&&sizes.explosive?.31:.24):1);sheet.seed=seed;sheet.life=this.hybrid?.18:sizes.life;sheet.explosive=sizes.explosive;sheet.active=true;
   // Fire rises in world space; an underside redirects the plume beneath its support.
   const rise=UP.clone();if(normal.y<-.65)rise.addScaledVector(normal,-normal.y*1.7).normalize();
   let forward=normal.clone().addScaledVector(rise,-normal.dot(rise));
   if(forward.lengthSq()<.01){forward=this.camera.getWorldPosition(new THREE.Vector3()).sub(point);forward.addScaledVector(rise,-forward.dot(rise));}
   if(forward.lengthSq()<.01)forward.set(0,0,1);forward.normalize();
   const side=rise.clone().cross(forward).normalize(),rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side,rise,forward));
   sheet.mesh.visible=true;sheet.mesh.position.copy(point).addScaledVector(rise,sheet.size*.48).addScaledVector(normal,sheet.size*.12);sheet.mesh.quaternion.copy(rotation);sheet.mesh.scale.setScalar(sheet.size);sheet.mesh.updateMatrixWorld(true);
   const supportPoint=sheet.mesh.worldToLocal(contact.point.clone()),supportNormal=normal.clone().applyQuaternion(rotation.clone().invert());
   const uniforms=sheet.mesh.material.uniforms;uniforms.supportPlane.value.set(supportNormal.x,supportNormal.y,supportNormal.z,-supportPoint.dot(supportNormal));uniforms.supported.value=contact.source||event.hitSurface?1:0;uniforms.seed.value=seed;uniforms.explosive.value=sheet.explosive?1:0;uniforms.age.value=0;uniforms.life.value=sheet.life;
   fireLobes(0,seed,sheet.explosive,sheet.lobes);
  }
  for(let i=0;i<sizes.emberCount;i++){
   const p=this.emit('embers',point,sizes.emberSize*(this.hybrid&&!secondary?1.6:1)*(.65+this.random()*.7),secondary?.20+this.random()*.20:.42+this.random()*.52);
   const angle=this.random()*Math.PI*2;p.velocity.copy(right).multiplyScalar((this.random()-.35)*(secondary?.7:sizes.explosive?3.5:2.4));p.velocity.addScaledVector(normal,.6+this.random()*(secondary?.5:1.4));p.velocity.y+=.4+this.random()*1.1;p.velocity.addScaledVector(along,Math.sin(angle)*.25);
  }
  for(let i=0;i<sizes.smokeCount+(this.options.full&&sizes.explosive?1:0);i++){const p=this.emit('smoke',point,sizes.explosive?.50:.24,.55+this.random()*.30);p.velocity.copy(normal).multiplyScalar(.15);p.velocity.y+=.38;p.position.addScaledVector(right,(i-1)*.12);}
  if(contact.source&&event.target){
   const c:FireContact={root:event.target,source:contact.source,point:contact.point.clone(),normal:normal.clone(),radius:sizes.coatingRadius,secondary};
   const list=this.contacts.get(event.target)??[];list.push(c);while(list.length>3)list.shift();this.contacts.set(event.target,list);this.statuses.get(event.target)?.contact(c);
  }else if(event.hitSurface instanceof THREE.Mesh&&!secondary){
   let scorch=this.scorches.get(event.hitSurface);
   if(!scorch){if(this.scorches.size>=FIRE_CAPACITY.scorches){const [mesh,old]=this.scorches.entries().next().value!;old.mask.dispose();this.scorches.delete(mesh);}scorch={mask:new FireMask(event.hitSurface,'ground',!!this.options.full),age:0,next:0,contact:{source:event.hitSurface,point:new THREE.Vector3(),normal:new THREE.Vector3(),radius:sizes.coatingRadius,secondary:false}};this.scorches.set(event.hitSurface,scorch);}
   scorch.age=0;scorch.contact={source:event.hitSurface,point:event.hitSurface.worldToLocal(contact.point.clone()),normal:normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(event.hitSurface.matrixWorld).invert()).normalize(),radius:sizes.coatingRadius,secondary:false};scorch.mask.contact(contact.point,Math.min(.50,sizes.coatingRadius*1.3),normal);
  }
  this.upload(0);return contact.surface;
 }
 status(root:THREE.Group){
  const existing=this.statuses.get(root);if(existing)return existing;
  const status=new FireStatus(root,(contact,intensity)=>this.linger(contact,intensity),()=>this.statuses.delete(root),!!this.options.full);this.statuses.set(root,status);
  const contacts=this.contacts.get(root)??[];for(const contact of contacts)status.contact(contact);
  if(!contacts.length){const sources=visibleSources(root),source=sources.find(s=>/breastplate|shirt-torso|front-breastplate|torso/.test(s.name))??sources[0];if(source){source.updateWorldMatrix(true,false);const bounds=new THREE.Box3().setFromBufferAttribute(source.geometry.attributes.position as THREE.BufferAttribute),point=bounds.getCenter(new THREE.Vector3());point.z=bounds.max.z;point.applyMatrix4(source.matrixWorld);const normal=Z.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(source.matrixWorld)).normalize();status.contact({root,source,point,normal,radius:.12,secondary:true});}}
  return status;
 }
 private linger(contact:FireContact,intensity:number){
  const count=contact.secondary?1:2,normal=contact.normal.clone().normalize();
  let sideways=new THREE.Vector3(1,0,0).applyQuaternion(contact.source.getWorldQuaternion(new THREE.Quaternion()));sideways.addScaledVector(normal,-sideways.dot(normal));if(sideways.lengthSq()<.01)sideways=UP.clone().cross(normal);sideways.normalize();
  const climb=normal.clone().cross(sideways).normalize();if(climb.dot(UP)<0)climb.negate();
  for(let i=0;i<count;i++){
   // Scatter over a disk on the real visible material, rather than along one horizontal line.
   const angle=this.random()*Math.PI*2,radius=Math.sqrt(this.random())*contact.radius*.68;
   const candidate=contact.point.clone().addScaledVector(sideways,Math.cos(angle)*radius).addScaledVector(climb,Math.sin(angle)*radius);
   const projected=this.options.full?projectVisibleSurface([contact.source],candidate,normal):contact.root?visibleContact(contact.root,candidate,normal):undefined;
   const sameMaterial=projected?.source&&materialKind(projected.source)===materialKind(contact.source);
   const source=sameMaterial?projected!.source!:contact.source,surfacePoint=sameMaterial?projected!.point:contact.point,surfaceNormal=sameMaterial?projected!.normal:normal;
   const point=surfacePoint.clone().addScaledVector(surfaceNormal,.026);
   const p=this.emit('tongues',point,(contact.secondary?.075:.18)*(.75+this.random()*.6),.28+this.random()*.22);p.age=i===0?0:-(.025+this.random()*.05);p.anchor=source;p.local=source.worldToLocal(point.clone());p.normal.copy(surfaceNormal);p.localNormal=surfaceNormal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(source.matrixWorld).invert()).normalize();p.intensity=intensity;p.velocity.copy(surfaceNormal).multiplyScalar(.06);p.velocity.y+=.06;
  }
  if(this.random()<.55){const p=this.emit('embers',contact.point,.009,.40);p.velocity.copy(normal).multiplyScalar(.20);p.velocity.y=.4;}
 }
 update(dt:number){
  if(this.disposed||!Number.isFinite(dt)||dt<=0)return;const step=Math.min(.1,dt);this.time+=step;this.hybrid?.update(step);
  for(const sheet of this.sheets){if(!sheet.active)continue;sheet.age+=step;sheet.mesh.material.uniforms.age.value=sheet.age;fireLobes(sheet.age,sheet.seed,sheet.explosive,sheet.lobes);if(sheet.age>=sheet.life){sheet.active=false;sheet.mesh.visible=false;}}
  for(const [source,scorch] of this.scorches){scorch.age+=step;if(scorch.age>=2.8||!source.parent){scorch.mask.dispose();this.scorches.delete(source);}else{scorch.mask.update(step,this.time,Math.min(1,(2.8-scorch.age)*2));if(this.options.full&&scorch.age<1.25&&scorch.age>=scorch.next){scorch.next=scorch.age+.19;source.updateWorldMatrix(true,false);this.linger({...scorch.contact,point:scorch.contact.point.clone().applyMatrix4(source.matrixWorld),normal:scorch.contact.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(source.matrixWorld)).normalize()},(1-scorch.age/1.4)*.75);}}}
  this.upload(step);
 }
 private upload(dt:number){
  for(const [name,pool] of this.pools){let index=0;
   for(const p of pool.items){
    if(!p.active)continue;p.age+=dt;if(p.age>=p.life||p.anchor&&!p.anchor.parent){p.active=false;p.anchor=undefined;p.local=undefined;continue;}if(p.age<0)continue;
    p.drift.addScaledVector(p.velocity,dt);
    if(p.anchor&&p.local){p.anchor.updateWorldMatrix(true,false);p.position.copy(p.local).applyMatrix4(p.anchor.matrixWorld);if(p.localNormal)p.normal.copy(p.localNormal).applyMatrix3(new THREE.Matrix3().getNormalMatrix(p.anchor.matrixWorld)).normalize();this.dummy.position.copy(p.position).add(p.drift);const clearance=this.dummy.position.clone().sub(p.position).dot(p.normal);if(clearance<0)this.dummy.position.addScaledVector(p.normal,-clearance);}
    else this.dummy.position.copy(p.position).add(p.drift);
    if(name==='embers'){p.velocity.x+=Math.sin(p.age*13+p.seed*19)*dt*.35;p.velocity.z+=Math.cos(p.age*11+p.seed*17)*dt*.35;p.velocity.y-=dt*1.4;p.velocity.multiplyScalar(Math.exp(-dt*.8));this.dummy.quaternion.setFromUnitVectors(UP,p.velocity.clone().normalize());this.dummy.scale.set(p.size,p.size*(2+Math.min(3,p.velocity.length())),p.size);}
    else if(name==='smoke'){this.dummy.quaternion.copy(this.camera.getWorldQuaternion(new THREE.Quaternion()));this.dummy.scale.set(p.size*(1+p.age),p.size*1.5,1);}
    else{const direction=this.options.full&&p.normal.y<-.65?new THREE.Vector3(Math.cos(p.seed*13.),0,Math.sin(p.seed*13.)).addScaledVector(p.normal,.10).normalize():UP.clone().multiplyScalar(1-Math.abs(p.normal.y)).addScaledVector(p.normal,.55+.45*Math.abs(p.normal.y)).normalize();const toward=this.camera.getWorldPosition(new THREE.Vector3()).sub(this.dummy.position);toward.addScaledVector(direction,-toward.dot(direction)).normalize();const side=direction.clone().cross(toward).normalize();this.dummy.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side,direction,toward));this.dummy.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(Z,Math.sin(p.seed*17+p.age*8)*.20));this.dummy.scale.set(p.size*.95,p.size*(1.5+Math.sin(p.age*12+p.seed)*.18),p.size);}
    this.dummy.updateMatrix();pool.mesh.setMatrixAt(index,this.dummy.matrix);pool.supported.setX(index,p.anchor?1:0);pool.support.setXYZW(index,p.normal.x,p.normal.y,p.normal.z,-p.normal.dot(p.position)+.026);pool.alpha.setX(index,Math.min(1,(1-p.age/p.life)*3)*p.intensity);pool.age.setX(index,p.age);pool.seed.setX(index,p.seed);index++;
   }
   pool.mesh.count=index;pool.mesh.visible=index>0;pool.mesh.instanceMatrix.needsUpdate=true;pool.alpha.needsUpdate=true;pool.age.needsUpdate=true;pool.seed.needsUpdate=true;pool.support.needsUpdate=true;pool.supported.needsUpdate=true;
  }
 }
 /** Prepare exact offscreen shader variants without shooting, stepping combat, or displaying dummy effects. */
 prepare(renderer:THREE.WebGLRenderer,scene:THREE.Scene){
  return this.preparation??= (async()=>{
   await this.hybrid?.prepareTexture(renderer);if(this.disposed)return;
   const source=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()),mask=new FireMask(source,'armor');mask.material.uniforms.presence.value=0;this.warmSurface={source,mask};
   const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true,stencilBuffer:false}),previous=renderer.getRenderTarget();let ready:Promise<unknown>;
   if(this.options.full){this.warmPlume=createFirePlume(.7);this.warmFlight=new THREE.Group();for(const type of ['bullet','rocket','sticky']as const){const spec=createWeaponSpec(type,'fire','pilot');this.warmFlight.add(createFireProjectile(spec,'ironvale'),createFireTrail(new THREE.Vector3(),new THREE.Vector3(0,0,2),spec,'ironvale'));}this.warmFlight.add(createFireTrail(new THREE.Vector3(),new THREE.Vector3(0,0,2),createWeaponSpec('beam','fire','pilot'),'ironvale',true));}
   try{renderer.setRenderTarget(target);ready=Promise.all([renderer.compileAsync(scene,this.camera),renderer.compileAsync(mask.mesh,this.camera,scene),...(this.warmPlume?[renderer.compileAsync(this.warmPlume,this.camera,scene)]:[]),...(this.warmFlight?[renderer.compileAsync(this.warmFlight,this.camera,scene)]:[])]);}finally{renderer.setRenderTarget(previous);target.dispose();}
   await ready;
   if(this.options.full&&!this.disposed){
    // Metal backends may finish the render pipeline on its first draw, after compileAsync resolves.
    // Draw owned templates to a private pixel, never to the Game or a combat target.
    const probe=new THREE.Scene();probe.fog=scene.fog;const eye=new THREE.PerspectiveCamera(60,1,.01,100);eye.position.z=4;
    const add=(object:THREE.Object3D)=>{const copy=object.clone(true);copy.traverse(o=>{o.visible=true;o.frustumCulled=false;if(o instanceof THREE.InstancedMesh)o.count=1;});probe.add(copy);};
    add(mask.mesh);if(this.warmFlight)add(this.warmFlight);if(this.warmPlume)add(this.warmPlume);if(this.hybrid)add(this.hybrid.group);add(this.group);for(const root of scene.children)if(root!==this.group&&root!==this.hybrid?.group&&root.userData.presentationOnly&&root.userData.comicOverlay)add(root);
    const pixel=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true,stencilBuffer:false}),restore=renderer.getRenderTarget();try{renderer.setRenderTarget(pixel);renderer.render(probe,eye);}finally{renderer.setRenderTarget(restore);pixel.dispose();probe.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});}
   }
  })();
 }
 get diagnostics(){return{sheets:this.sheets.filter(s=>s.active).length,embers:this.pools.get('embers')!.items.filter(p=>p.active).length,tongues:this.pools.get('tongues')!.items.filter(p=>p.active).length,smoke:this.pools.get('smoke')!.items.filter(p=>p.active).length,scorches:this.scorches.size,statuses:this.statuses.size,...(this.hybrid?{authoredBursts:this.hybrid.activeCount}:{})};}
 clear(){this.hybrid?.clear();for(const sheet of this.sheets){sheet.active=false;sheet.mesh.visible=false;}for(const pool of this.pools.values()){for(const item of pool.items){item.active=false;item.anchor=undefined;item.local=undefined;}pool.next=0;pool.mesh.count=0;pool.mesh.visible=false;}for(const status of [...this.statuses.values()])status.dispose();for(const scorch of this.scorches.values())scorch.mask.dispose();this.scorches.clear();this.contacts=new WeakMap();this.variations.reset();this.events.length=0;this.nextSheet=0;this.serial=0;this.time=0;this.randomState=319;}
 dispose(){if(this.disposed)return;this.clear();this.disposed=true;this.hybrid?.dispose();if(this.warmFlight){this.warmFlight.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});this.warmFlight=undefined;}if(this.warmPlume){disposeFirePlume(this.warmPlume);this.warmPlume=undefined;}if(this.warmSurface){this.warmSurface.mask.dispose();this.warmSurface.source.geometry.dispose();(this.warmSurface.source.material as THREE.Material).dispose();this.warmSurface=undefined;}for(const sheet of this.sheets){sheet.mesh.geometry.dispose();sheet.mesh.material.dispose();}for(const pool of this.pools.values()){pool.mesh.geometry.dispose();(pool.mesh.material as THREE.Material).dispose();pool.mesh.dispose();}this.group.removeFromParent();}
}
