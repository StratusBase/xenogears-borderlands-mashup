import * as THREE from 'three';
import type { BallisticPresentationImpact,BallisticPresentationSplash } from '../../PlayerBallistics';
import { CorrosiveStatus,nearestCorrosiveSurface,corrosiveTargetSpan,type CorrosiveSurface } from './surfaces';
import { corrosiveSizing } from './sizing';
import { corrosiveSurfaceFrame,settleCorrosiveDrop,type CorrosiveSupport } from './surfaceFrame';
import { createCorrosiveSplashGeometry,animateCorrosiveRupture,ruptureVertex,ruptureFragment } from './rupture';
import { createPreviousCorrosiveSplashGeometry,previousRuptureVertex,previousRuptureFragment } from './previousRupture';
export { createCorrosiveSplashGeometry } from './rupture';
export type CorrosiveMotion='directional'|'previous';

export const CORROSIVE_AB_CAPACITY=Object.freeze({bursts:10,drops:256,bubbles:96,residue:24,vapor:32});
const Z=new THREE.Vector3(0,0,1),UP=new THREE.Vector3(0,1,0);
const particleVertex=/* glsl */`attribute float alpha;varying float vA;varying vec3 vN;varying vec3 vV;void main(){vA=alpha;vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);vV=-mv.xyz;vN=normalize(mat3(modelViewMatrix*instanceMatrix)*normal);gl_Position=projectionMatrix*mv;}`;
const particleFragment=/* glsl */`varying float vA;varying vec3 vN;varying vec3 vV;void main(){if(vA<.015)discard;vec3 n=normalize(vN),v=normalize(vV);float edge=pow(1.-abs(dot(n,v)),2.5);float light=dot(n,normalize(vec3(-.4,.8,1.)));float shine=pow(max(0.,dot(n,normalize(v+vec3(-.4,.8,1.)))),85.);vec3 c=mix(vec3(.018,.035,.0005),vec3(.22,.42,.008),smoothstep(-.3,.6,light));c=mix(c,vec3(.60,.84,.04),edge*.72);c+=vec3(.90,1.,.47)*shine*.65;gl_FragColor=vec4(c,vA);}`;
const bubbleFragment=/* glsl */`varying float vA;varying vec3 vN;varying vec3 vV;void main(){if(vA<.015)discard;vec3 n=normalize(vN),v=normalize(vV);float edge=pow(1.-abs(dot(n,v)),3.);float shine=pow(max(0.,dot(n,normalize(v+vec3(-.4,.8,1.)))),100.);vec3 c=mix(vec3(.17,.32,.007),vec3(.49,.67,.035),edge*.45);c+=vec3(.9,1.,.57)*shine*.55;gl_FragColor=vec4(c,vA*.68);}`;
const residueFragment=/* glsl */`
 varying vec2 vUv;varying float vA;void main(){vec2 p=vUv*2.-1.;float a=atan(p.y,p.x),r=length(p);float edge=.66+sin(a*7.)*.11+sin(a*13.+.7)*.065;float d=edge-r;if(d<0.)discard;float rim=1.-smoothstep(.015,.055,d);float glint=pow(max(0.,1.-length(p-vec2(-.2,.2))*3.),8.);vec3 c=mix(vec3(.10,.17,.008),vec3(.38,.54,.024),smoothstep(.04,.3,d));c=mix(c,vec3(.72,.88,.09),rim*.85);c+=vec3(.69,.80,.37)*glint;gl_FragColor=vec4(c,vA*(.65+rim*.3));}`;
const vaporFragment=/* glsl */`varying vec2 vUv;varying float vA;void main(){float y=vUv.y;float center=.5+sin(y*10.)*.13;float width=.10+.10*sin(y*8.);float a=(1.-smoothstep(width*.3,width,abs(vUv.x-center)))*sin(y*3.14159)*vA*.15;if(a<.003)discard;gl_FragColor=vec4(.36,.47,.12,a);}`;
interface Burst{mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;age:number;size:number;active:boolean;seed:number;gravity:THREE.Vector3;lift:number}
interface Drop{position:THREE.Vector3;velocity:THREE.Vector3;age:number;life:number;size:number;active:boolean;target?:THREE.Mesh;local?:THREE.Vector3;normal?:THREE.Vector3;seed:number;surface:CorrosiveSurface;support?:CorrosiveSupport;resting?:boolean}
interface Contact{point:THREE.Vector3;radius:number;source?:THREE.Mesh;direction?:THREE.Vector3}
interface Pool{mesh:THREE.InstancedMesh;alpha:THREE.InstancedBufferAttribute;items:Drop[];next:number}
/** All expanding geometry is scene-owned, depth-tested and excluded from collision/ink. */
export class CorrosiveResponse{
 readonly events:{phase:'contact'|'detonate';role:'direct'|'detonation'|'splash';surface:CorrosiveSurface;size:number;coatingRadius:number;dropCount:number;exposure:number;energy?:number;point:number[]}[]=[];
 readonly group=new THREE.Group();private bursts:Burst[]=[];private crown=createPreviousCorrosiveSplashGeometry();private pools=new Map<string,Pool>();private serial=0;private randomState=73;private disposed=false;
 private contacts=new WeakMap<THREE.Group,Contact[]>();private statuses=new Map<THREE.Group,CorrosiveStatus>();private dummy=new THREE.Object3D();private burstNext=0;
 constructor(scene:THREE.Scene,private camera?:THREE.Camera,private motion:CorrosiveMotion='directional'){
  this.group.name='corrosive-ab-response';this.group.userData.comicOverlay=true;this.group.userData.presentationOnly=true;scene.add(this.group);
  for(let i=0;i<CORROSIVE_AB_CAPACITY.bursts;i++){
   const material=new THREE.ShaderMaterial({name:'corrosive-ab-torn-liquid-sheet',uniforms:{age:{value:1},size:{value:1},seed:{value:i*.73}},vertexShader:motion==='directional'?ruptureVertex:previousRuptureVertex,fragmentShader:motion==='directional'?ruptureFragment:previousRuptureFragment,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
   const mesh=new THREE.Mesh(motion==='directional'?createCorrosiveSplashGeometry():this.crown,material);mesh.name='corrosive-ab-crown';mesh.raycast=()=>{};mesh.visible=false;mesh.frustumCulled=false;mesh.renderOrder=3;this.group.add(mesh);this.bursts.push({mesh,age:1,size:1,active:false,seed:i*.73,gravity:new THREE.Vector3(0,-1,0),lift:0});
  }
  this.pool('drops',CORROSIVE_AB_CAPACITY.drops,new THREE.IcosahedronGeometry(1,2));this.pool('bubbles',CORROSIVE_AB_CAPACITY.bubbles,new THREE.SphereGeometry(1,10,7));this.pool('residue',CORROSIVE_AB_CAPACITY.residue,new THREE.PlaneGeometry(2,2),true);this.pool('vapor',CORROSIVE_AB_CAPACITY.vapor,new THREE.PlaneGeometry(2,2),true);
 }
 private pool(name:string,count:number,geometry:THREE.BufferGeometry,residue=false):void{
  const alpha=new THREE.InstancedBufferAttribute(new Float32Array(count),1);geometry.setAttribute('alpha',alpha);
  const material=new THREE.ShaderMaterial({name:`corrosive-ab-${name}`,vertexShader:residue?'attribute float alpha;varying float vA;varying vec2 vUv;void main(){vA=alpha;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}':particleVertex,fragmentShader:name==='vapor'?vaporFragment:residue?residueFragment:name==='bubbles'?bubbleFragment:particleFragment,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.name=`corrosive-ab-${name}`;mesh.raycast=()=>{};mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;mesh.renderOrder=residue?1:4;this.group.add(mesh);
  const items=Array.from({length:count},():Drop=>({position:new THREE.Vector3(),velocity:new THREE.Vector3(),age:0,life:1,size:1,active:false,seed:0,surface:'ground'}));this.pools.set(name,{mesh,alpha,items,next:0});
 }
 private random():number{this.randomState=(Math.imul(this.randomState,1664525)+1013904223)>>>0;return this.randomState/4294967296;}
 private emit(name:string,point:THREE.Vector3,size:number,life:number):Drop{
  const pool=this.pools.get(name)!,p=pool.items[pool.next++%pool.items.length];p.active=true;p.position.copy(point);p.velocity.set(0,0,0);p.size=size;p.life=life;p.age=0;p.seed=this.random();p.target=undefined;p.local=undefined;p.normal=undefined;p.support=undefined;p.resting=false;return p;
 }
 impact(event:BallisticPresentationImpact):CorrosiveSurface{
  return this.present(event,false);
 }
 splash(event:BallisticPresentationSplash):CorrosiveSurface|undefined{
  if(event.primary)return;return this.present(event,true);
 }
 private present(event:BallisticPresentationImpact,indirect:boolean):CorrosiveSurface{
  if(this.disposed||!Number.isFinite(event.point.lengthSq()))return'ground';
  const normal=event.normal.clone();if(!Number.isFinite(normal.lengthSq())||normal.lengthSq()<.001)normal.copy(UP);normal.normalize();
  const contact=nearestCorrosiveSurface(event.target,event.point,normal),{source,surface}=contact,broad=event.phase==='detonate';normal.copy(contact.normal);
  const sizing=corrosiveSizing({projectile:event.spec.projectile,phase:event.phase,radius:event.radius,energy:event.energy,exposure:event.exposure,secondaryTarget:indirect,channelWeight:event.spec.element!=='corrosive'?.62:1,targetSpan:corrosiveTargetSpan(event.target)}),size=sizing.sheetRadius;
  if(sizing.strength<=0)return surface;
  this.events.push({phase:event.phase,role:indirect?'splash':broad?'detonation':'direct',surface,size,coatingRadius:sizing.coatingRadius,dropCount:sizing.dropCount,exposure:event.exposure??1,energy:event.energy,point:contact.point.toArray()});if(this.events.length>128)this.events.shift();
  const point=contact.point.clone().addScaledVector(normal,.012);
  const basis=new THREE.Quaternion().setFromUnitVectors(Z,normal),seed=(this.serial%17)*.731;
  const frame=this.motion==='directional'&&!indirect?corrosiveSurfaceFrame(normal,point,seed,this.camera,Boolean(source||event.hitSurface||event.phase==='contact')):undefined;
  if(frame)basis.copy(frame.rotation);
  const support:CorrosiveSupport|undefined=frame&&frame.lift>0?{point:contact.point.clone(),normal:normal.clone(),mesh:source??(event.hitSurface instanceof THREE.Mesh?event.hitSurface:undefined)}:undefined;
  const flowDirection=new THREE.Vector3(1,.25,0).applyQuaternion(basis).normalize();
  if(size>0){const burst=this.bursts[this.burstNext++%this.bursts.length];burst.age=0;burst.size=size;burst.seed=seed;burst.lift=frame?.lift??0;this.serial++;burst.active=true;burst.mesh.visible=true;burst.mesh.position.copy(point);burst.mesh.quaternion.copy(basis);burst.gravity.set(0,-1,0).applyQuaternion(basis.clone().invert());burst.mesh.material.uniforms.seed.value=seed;burst.mesh.material.uniforms.age.value=0;burst.mesh.material.uniforms.size.value=size;if(this.motion==='directional')animateCorrosiveRupture(burst.mesh.geometry,0,seed,burst.gravity,burst.lift);}
  const count=sizing.dropCount;
  for(let i=0;i<count;i++){
   const choice=this.random(),angle=this.motion==='directional'&&!indirect?(choice<.70?-.18+this.random()*.75:choice<.87?2.80+this.random()*.66:4.55+this.random()*.55):(choice<.52?2.40+this.random()*1.28:choice<.91?-.63+this.random()*.97:4.0+this.random()*1.1),r=.65+this.random()*.8;
   const direction=new THREE.Vector3(Math.cos(angle)*1.5,Math.sin(angle)*.9,.3+this.random()*.8).normalize().applyQuaternion(basis);
   const drop=this.emit('drops',point,sizing.dropSize*(.55+this.random()*.70),sizing.life*(.65+this.random()*.45));drop.velocity.copy(direction).multiplyScalar(sizing.speed*r);drop.surface=surface;drop.support=support;
  }
  if(source){
   const patchRadius=sizing.coatingRadius;
   const status=this.statuses.get(event.target!);status?.contact(point,patchRadius,source,indirect?undefined:flowDirection);
   const contacts=this.contacts.get(event.target!)??[];contacts.push({point:point.clone(),radius:patchRadius,source,direction:indirect?undefined:flowDirection.clone()});while(contacts.length>4)contacts.shift();this.contacts.set(event.target!,contacts);
   for(let i=0;i<sizing.bubbleCount;i++){
    const p=this.emit('bubbles',point,sizing.bubbleSize*(.65+this.random()*.7),indirect?.35+this.random()*.30:1.1+this.random()*1.0);
    const scatter=Math.min(.24,patchRadius*.7),offset=new THREE.Vector3((this.random()-.5)*scatter*2,(this.random()-.5)*scatter*1.7,0).applyQuaternion(basis);p.position.add(offset);
    p.target=source;p.local=source.worldToLocal(p.position.clone());p.normal=normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(source.matrixWorld).invert()).normalize();p.surface=surface;
   }
   for(let i=0;i<sizing.vaporCount;i++){const p=this.emit('vapor',point,indirect?.08:.25,indirect?.38:1.1+this.random()*.5);p.position.x+=(i-1)*(indirect?.035:.15);p.target=source;p.local=source.worldToLocal(p.position.clone());p.normal=normal.clone();p.surface=surface;}
  }
  const residue=!event.target?broad?sizing.residueRadius:Math.min(.22,size*.55):sizing.residueRadius;
  if(residue>0){const floor=point.clone();if(!support)floor.y=.025;else{floor.copy(support.point);settleCorrosiveDrop(floor,.01,support);}const p=this.emit('residue',floor,residue,2.8);p.normal=support?normal.clone():UP.clone();
   if(support?.mesh){p.target=support.mesh;p.local=support.mesh.worldToLocal(floor.clone());p.normal.applyMatrix3(new THREE.Matrix3().getNormalMatrix(support.mesh.matrixWorld).invert()).normalize();}
  }
  this.upload(0);return surface;
 }
 status(root:THREE.Group):CorrosiveStatus{
  const previous=this.statuses.get(root);if(previous)return previous;
  const status=new CorrosiveStatus(root,this.motion==='directional'),contacts=this.contacts.get(root)??[];for(const contact of contacts)status.contact(contact.point,contact.radius,contact.source,contact.direction);
  // Splash status may reach a neighbor without a direct collision event. React on its real torso surface.
  if(!contacts.length){const binding=status.bindings.find(b=>/breastplate|shirt-torso|front-breastplate|torso/.test(b.source.name))??status.bindings[0];if(binding){const box=new THREE.Box3().setFromBufferAttribute(binding.source.geometry.attributes.position as THREE.BufferAttribute),point=box.getCenter(new THREE.Vector3());point.z=box.max.z;binding.source.updateWorldMatrix(true,false);point.applyMatrix4(binding.source.matrixWorld);status.contact(point,.10,binding.source);}}
  const dispose=status.dispose.bind(status);status.dispose=()=>{dispose();this.statuses.delete(root);};this.statuses.set(root,status);return status;
 }
 update(dt:number):void{if(this.disposed||!Number.isFinite(dt)||dt<=0)return;const step=Math.min(.1,dt);for(const burst of this.bursts){if(!burst.active)continue;burst.age+=step;burst.mesh.material.uniforms.age.value=burst.age;if(this.motion==='directional')animateCorrosiveRupture(burst.mesh.geometry,burst.age,burst.seed,burst.gravity,burst.lift);if(burst.age>=.54){burst.active=false;burst.mesh.visible=false;}}this.upload(step);}
 private upload(dt:number):void{
  for(const[name,pool]of this.pools){let count=0;
   for(const p of pool.items){if(!p.active)continue;p.age+=dt;if(p.age>=p.life){p.active=false;p.target=undefined;p.support=undefined;continue;}
    if(p.target&&p.local){if(!p.target.parent){p.active=false;p.target=undefined;p.support=undefined;p.local=undefined;continue;}p.target.updateWorldMatrix(true,false);p.position.copy(p.local).applyMatrix4(p.target.matrixWorld);}
    if(name==='drops'&&!p.resting){p.position.addScaledVector(p.velocity,dt);p.velocity.y-=dt*6.5;
     if(p.support&&dt>0&&p.velocity.dot(p.support.normal)<0&&settleCorrosiveDrop(p.position,p.size,p.support)){p.velocity.set(0,0,0);p.resting=true;if(p.support.mesh){p.target=p.support.mesh;p.local=p.target.worldToLocal(p.position.clone());}}
     else if(p.position.y<.04&&(!p.support||p.position.y<p.support.point.y-.02)){p.position.y=.035;p.velocity.multiplyScalar(0);}
    }
    const worldNormal=p.target&&p.normal?p.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(p.target.matrixWorld)).normalize():p.normal??Z;
    const t=p.age/p.life;this.dummy.position.copy(p.position);this.dummy.quaternion.identity();
    if(name==='residue'){this.dummy.quaternion.setFromUnitVectors(Z,worldNormal);this.dummy.scale.set(p.size*(.65+.35*Math.min(1,t*10)),p.size,1);}
    else if(name==='vapor'){if(this.camera)this.dummy.quaternion.copy(this.camera.getWorldQuaternion(new THREE.Quaternion()));this.dummy.position.y+=.20+p.age*.23;this.dummy.position.x+=Math.sin(p.age*2+p.seed*8)*.07;this.dummy.scale.set(p.size,.32+p.age*.15,1);}
    else if(name==='bubbles'){
     const inflate=.40+.60*Math.sin(Math.min(1,t*2)*Math.PI*.5);const pulse=1+.09*Math.sin(p.age*11+p.seed*8);
     this.dummy.position.addScaledVector(worldNormal,p.size*.65*inflate);this.dummy.scale.setScalar(p.size*inflate*pulse);
    }else{const speed=p.velocity.length();if(speed>.01)this.dummy.quaternion.setFromUnitVectors(UP,p.velocity.clone().normalize());this.dummy.scale.set(p.size,p.size*(1+Math.min(2,speed*.35)),p.size);}
    this.dummy.updateMatrix();pool.mesh.setMatrixAt(count,this.dummy.matrix);pool.alpha.setX(count,name==='residue'?Math.min(1,(1-t)*4)*.85:Math.min(1,(1-t)*4)*.94);count++;
   }pool.mesh.count=count;pool.mesh.visible=count>0;pool.mesh.instanceMatrix.needsUpdate=true;pool.alpha.needsUpdate=true;
  }
 }
 get diagnostics(){return{bursts:this.bursts.filter(b=>b.active).length,drops:this.pools.get('drops')!.items.filter(p=>p.active).length,bubbles:this.pools.get('bubbles')!.items.filter(p=>p.active).length,residue:this.pools.get('residue')!.items.filter(p=>p.active).length,statuses:this.statuses.size};}
 clear():void{for(const b of this.bursts){b.active=false;b.mesh.visible=false;}for(const p of this.pools.values()){for(const item of p.items){item.active=false;item.target=undefined;item.support=undefined;}p.next=0;p.mesh.count=0;p.mesh.visible=false;}for(const status of[...this.statuses.values()])status.dispose();this.contacts=new WeakMap();this.events.length=0;this.serial=0;this.randomState=73;this.burstNext=0;}
 dispose():void{if(this.disposed)return;this.clear();this.disposed=true;this.crown.dispose();for(const b of this.bursts){b.mesh.material.dispose();if(this.motion==='directional')b.mesh.geometry.dispose();}for(const p of this.pools.values()){p.mesh.geometry.dispose();(p.mesh.material as THREE.Material).dispose();p.mesh.dispose();}this.group.removeFromParent();}
}
