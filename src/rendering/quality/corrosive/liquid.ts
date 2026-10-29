import * as THREE from 'three';
import type { BallisticPresentationImpact,BallisticPresentationSplash } from '../../PlayerBallistics';
import { CorrosiveStatus,nearestCorrosiveSurface,corrosiveTargetSpan,type CorrosiveSurface } from './surfaces';
import { corrosiveSizing } from './sizing';

export const CORROSIVE_AB_CAPACITY=Object.freeze({bursts:10,drops:256,bubbles:96,residue:24,vapor:32});
const Z=new THREE.Vector3(0,0,1),UP=new THREE.Vector3(0,1,0);
const vertex=/* glsl */`
 attribute float film;attribute vec3 flow;uniform float age,size,seed;
 varying vec2 vUv;varying vec3 vN;varying vec3 vView;varying float vFilm;varying float vFlow;
 void main(){
  vFilm=film;vUv=uv;vFlow=flow.x;float opening=1.-pow(1.-clamp(age/.16,0.,1.),2.);
  vec3 p=position*(.035+.965*opening)*size;
  p+=flow*max(0.,age-.055)*(.2+.8*uv.y)*size;
  p.y-=3.6*age*age*(.3+.7*uv.y);
  vec4 mv=modelViewMatrix*vec4(p,1.);vN=normalize(normalMatrix*normal);vView=-mv.xyz;gl_Position=projectionMatrix*mv;
 }
`;
const fragment=/* glsl */`
 uniform float age,seed;varying vec2 vUv;varying vec3 vN;varying vec3 vView;varying float vFilm;varying float vFlow;
 void main(){
  // Loss begins at the free edge; never punch repeated interior holes through the liquid.
  float start=vFlow<0.?.075:vFlow>.5?.18:.11;
  float end=vFlow<0.?.25:vFlow>.5?.43:.32;
  float notches=max(max(max(0.,1.-abs(vUv.x-.16)/.045)*.29,max(0.,1.-abs(vUv.x-.54)/.028)*.43),max(0.,1.-abs(vUv.x-.79)/.067)*.21);
  float freeEdge=1.-smoothstep(start,end,age)*.78-notches*smoothstep(.045,.14,age);
  if(vFilm<.5&&vUv.y>freeEdge)discard;
  float lip=pow(vUv.y,18.);float sideEdge=1.-smoothstep(.0,.045,min(vUv.x,1.-vUv.x));
  vec3 n=normalize(vN),view=normalize(vView);float light=dot(n,normalize(vec3(-.4,.7,1.)));
  vec3 c=mix(vec3(.013,.032,.0008),vec3(.20,.39,.005),smoothstep(-.4,.7,light));
  c=mix(c,vec3(.43,.68,.013),lip*.85);
  c=mix(c,vec3(.025,.045,.001),sideEdge*.25);
  float streak=pow(max(0.,1.-abs(vUv.x-(.22+.12*sin(vUv.y*3.+seed)))*18.),6.);
  float glint=pow(max(0.,dot(n,normalize(view+vec3(-.4,.7,1.)))),90.);
  c+=vec3(.64,.78,.40)*(streak*.43+glint*.52);
  if(vUv.y<.12)c=mix(c,vec3(.93,1.,.65),1.-smoothstep(.018,.06,age));
  float alpha=(.84+.10*lip)*(1.-smoothstep(.30,.46,age));if(alpha<.015)discard;
  gl_FragColor=vec4(c,alpha);
 }
`;
/** Three unequal, folded open fans and curved rivulets. No full-circle crown or repeated petals. */
export function createCorrosiveSplashGeometry():THREE.BufferGeometry{
 const positions:number[]=[],uv:number[]=[],film:number[]=[],flow:number[]=[],indices:number[]=[];
 const fans=[
  {angles:[2.60,3.40],lengths:[.10,.43,.78,.92,.84,.64,.44,.22,.06],flow:[-.55,-.08,.72]},
  {angles:[-.80,.50],lengths:[.20,.60,1.05,1.15,.74,.62,.87,.58,.28],flow:[.72,-.18,1.05]},
  {angles:[4.20,5.10],lengths:[.08,.26,.60,.76,.65,.56,.34,.16,.08],flow:[.15,-.55,.48]},
 ];
 for(const fan of fans){const segments=32,rings=7,base=positions.length/3;
  for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){
   const u=i/segments,t=j/rings,a=THREE.MathUtils.lerp(fan.angles[0],fan.angles[1],u);
   const knot=u*(fan.lengths.length-1),k=Math.min(fan.lengths.length-2,Math.floor(knot)),f=knot-k;
   const edge=THREE.MathUtils.lerp(fan.lengths[k],fan.lengths[k+1],f*f*(3-2*f));
   const r=.012+t*edge;positions.push(Math.cos(a)*r*1.22,Math.sin(a)*r*.80,.26*t+.16*Math.sin(u*Math.PI)*Math.sin(t*Math.PI));
   uv.push(u,t);film.push(0);flow.push(...fan.flow);
   if(j<rings&&i<segments){const x=base+j*(segments+1)+i;indices.push(x,x+1,x+segments+1,x+1,x+segments+2,x+segments+1);}
  }
 }
 const rivulets=[[[0,0,0],[-.55,.08,.16],[-1.02,.25,.33],[-1.35,.02,.47]],[[0,0,0],[.45,-.04,.10],[.96,-.12,.29],[1.30,-.36,.46]],[[0,0,0],[.12,-.30,.10],[.27,-.62,.23],[.07,-1.06,.34]]];
 for(const [number,points]of rivulets.entries()){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),base=positions.length/3,velocity=fans[number].flow;
  for(let i=0;i<=20;i++){const t=i/20,p=curve.getPoint(t),tangent=curve.getTangent(t),side=new THREE.Vector3(-tangent.y,tangent.x,0).normalize(),width=.026*(1-t)+.004;
   for(const sign of[-1,1]){positions.push(p.x+side.x*width*sign,p.y+side.y*width*sign,p.z);uv.push(sign<0?0:1,t);film.push(1);flow.push(...velocity);}
   if(i<20){const x=base+i*2;indices.push(x,x+1,x+2,x+1,x+3,x+2);}
  }
  const bead=new THREE.SphereGeometry(.035+number*.006,8,6);bead.translate(...points[3] as [number,number,number]);const offset=positions.length/3;
  for(let i=0;i<bead.attributes.position.count;i++){const a=bead.attributes.position;positions.push(a.getX(i),a.getY(i),a.getZ(i));uv.push(.5,1);film.push(2);flow.push(...velocity);}for(const index of bead.index!.array)indices.push(offset+index);bead.dispose();
 }
 const g=new THREE.BufferGeometry();g.name='corrosive-folded-liquid-fans-v2';g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('film',new THREE.Float32BufferAttribute(film,1));g.setAttribute('flow',new THREE.Float32BufferAttribute(flow,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
const particleVertex=/* glsl */`attribute float alpha;varying float vA;varying vec3 vN;varying vec3 vV;void main(){vA=alpha;vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);vV=-mv.xyz;vN=normalize(mat3(modelViewMatrix*instanceMatrix)*normal);gl_Position=projectionMatrix*mv;}`;
const particleFragment=/* glsl */`varying float vA;varying vec3 vN;varying vec3 vV;void main(){if(vA<.015)discard;vec3 n=normalize(vN),v=normalize(vV);float edge=pow(1.-abs(dot(n,v)),2.5);float light=dot(n,normalize(vec3(-.4,.8,1.)));float shine=pow(max(0.,dot(n,normalize(v+vec3(-.4,.8,1.)))),85.);vec3 c=mix(vec3(.018,.035,.0005),vec3(.22,.42,.008),smoothstep(-.3,.6,light));c=mix(c,vec3(.60,.84,.04),edge*.72);c+=vec3(.90,1.,.47)*shine*.65;gl_FragColor=vec4(c,vA);}`;
const bubbleFragment=/* glsl */`varying float vA;varying vec3 vN;varying vec3 vV;void main(){if(vA<.015)discard;vec3 n=normalize(vN),v=normalize(vV);float edge=pow(1.-abs(dot(n,v)),3.);float shine=pow(max(0.,dot(n,normalize(v+vec3(-.4,.8,1.)))),100.);vec3 c=mix(vec3(.17,.32,.007),vec3(.49,.67,.035),edge*.45);c+=vec3(.9,1.,.57)*shine*.55;gl_FragColor=vec4(c,vA*.68);}`;
const residueFragment=/* glsl */`
 varying vec2 vUv;varying float vA;void main(){vec2 p=vUv*2.-1.;float a=atan(p.y,p.x),r=length(p);float edge=.66+sin(a*7.)*.11+sin(a*13.+.7)*.065;float d=edge-r;if(d<0.)discard;float rim=1.-smoothstep(.015,.055,d);float glint=pow(max(0.,1.-length(p-vec2(-.2,.2))*3.),8.);vec3 c=mix(vec3(.10,.17,.008),vec3(.38,.54,.024),smoothstep(.04,.3,d));c=mix(c,vec3(.72,.88,.09),rim*.85);c+=vec3(.69,.80,.37)*glint;gl_FragColor=vec4(c,vA*(.65+rim*.3));}`;
const vaporFragment=/* glsl */`varying vec2 vUv;varying float vA;void main(){float y=vUv.y;float center=.5+sin(y*10.)*.13;float width=.10+.10*sin(y*8.);float a=(1.-smoothstep(width*.3,width,abs(vUv.x-center)))*sin(y*3.14159)*vA*.15;if(a<.003)discard;gl_FragColor=vec4(.36,.47,.12,a);}`;
interface Burst{mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;age:number;size:number;active:boolean}
interface Drop{position:THREE.Vector3;velocity:THREE.Vector3;age:number;life:number;size:number;active:boolean;target?:THREE.Mesh;local?:THREE.Vector3;normal?:THREE.Vector3;seed:number;surface:CorrosiveSurface}
interface Contact{point:THREE.Vector3;radius:number;source?:THREE.Mesh}
interface Pool{mesh:THREE.InstancedMesh;alpha:THREE.InstancedBufferAttribute;items:Drop[];next:number}
/** All expanding geometry is scene-owned, depth-tested and excluded from collision/ink. */
export class CorrosiveResponse{
 readonly events:{phase:'contact'|'detonate';role:'direct'|'detonation'|'splash';surface:CorrosiveSurface;size:number;coatingRadius:number;dropCount:number;exposure:number;energy?:number;point:number[]}[]=[];
 readonly group=new THREE.Group();private bursts:Burst[]=[];private crown=createCorrosiveSplashGeometry();private pools=new Map<string,Pool>();private serial=0;private randomState=73;private disposed=false;
 private contacts=new WeakMap<THREE.Group,Contact[]>();private statuses=new Map<THREE.Group,CorrosiveStatus>();private dummy=new THREE.Object3D();private burstNext=0;
 constructor(scene:THREE.Scene,private camera?:THREE.Camera){
  this.group.name='corrosive-ab-response';this.group.userData.comicOverlay=true;this.group.userData.presentationOnly=true;scene.add(this.group);
  for(let i=0;i<CORROSIVE_AB_CAPACITY.bursts;i++){
   const material=new THREE.ShaderMaterial({name:'corrosive-ab-torn-liquid-sheet',uniforms:{age:{value:1},size:{value:1},seed:{value:i*.73}},vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
   const mesh=new THREE.Mesh(this.crown,material);mesh.name='corrosive-ab-crown';mesh.raycast=()=>{};mesh.visible=false;mesh.frustumCulled=false;mesh.renderOrder=3;this.group.add(mesh);this.bursts.push({mesh,age:1,size:1,active:false});
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
  const pool=this.pools.get(name)!,p=pool.items[pool.next++%pool.items.length];p.active=true;p.position.copy(point);p.velocity.set(0,0,0);p.size=size;p.life=life;p.age=0;p.seed=this.random();p.target=undefined;p.local=undefined;p.normal=undefined;return p;
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
  if(size>0){const burst=this.bursts[this.burstNext++%this.bursts.length];burst.age=0;burst.size=size;burst.active=true;burst.mesh.visible=true;burst.mesh.position.copy(point);burst.mesh.quaternion.setFromUnitVectors(Z,normal);burst.mesh.material.uniforms.seed.value=(this.serial++%17)*.731;burst.mesh.material.uniforms.age.value=0;burst.mesh.material.uniforms.size.value=size;}
  const count=sizing.dropCount;
  const basis=new THREE.Quaternion().setFromUnitVectors(Z,normal);
  for(let i=0;i<count;i++){
   const choice=this.random(),angle=choice<.52?2.40+this.random()*1.28:choice<.91?-.63+this.random()*.97:4.0+this.random()*1.1,r=.65+this.random()*.8;
   const direction=new THREE.Vector3(Math.cos(angle)*1.5,Math.sin(angle)*.9,.3+this.random()*.8).normalize().applyQuaternion(basis);
   const drop=this.emit('drops',point,sizing.dropSize*(.55+this.random()*.70),sizing.life*(.65+this.random()*.45));drop.velocity.copy(direction).multiplyScalar(sizing.speed*r);drop.surface=surface;
  }
  if(source){
   const patchRadius=sizing.coatingRadius;
   const status=this.statuses.get(event.target!);status?.contact(point,patchRadius,source);
   const contacts=this.contacts.get(event.target!)??[];contacts.push({point:point.clone(),radius:patchRadius,source});while(contacts.length>4)contacts.shift();this.contacts.set(event.target!,contacts);
   for(let i=0;i<sizing.bubbleCount;i++){
    const p=this.emit('bubbles',point,sizing.bubbleSize*(.65+this.random()*.7),indirect?.35+this.random()*.30:1.1+this.random()*1.0);
    const scatter=Math.min(.24,patchRadius*.7),offset=new THREE.Vector3((this.random()-.5)*scatter*2,(this.random()-.5)*scatter*1.7,0).applyQuaternion(basis);p.position.add(offset);
    p.target=source;p.local=source.worldToLocal(p.position.clone());p.normal=normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(source.matrixWorld).invert()).normalize();p.surface=surface;
   }
   for(let i=0;i<sizing.vaporCount;i++){const p=this.emit('vapor',point,indirect?.08:.25,indirect?.38:1.1+this.random()*.5);p.position.x+=(i-1)*(indirect?.035:.15);p.target=source;p.local=source.worldToLocal(p.position.clone());p.normal=normal.clone();p.surface=surface;}
  }
  const residue=!event.target?broad?sizing.residueRadius:Math.min(.22,size*.55):sizing.residueRadius;
  if(residue>0){const floor=point.clone();floor.y=.025;const p=this.emit('residue',floor,residue,2.8);p.normal=UP.clone();}
  this.upload(0);return surface;
 }
 status(root:THREE.Group):CorrosiveStatus{
  const previous=this.statuses.get(root);if(previous)return previous;
  const status=new CorrosiveStatus(root),contacts=this.contacts.get(root)??[];for(const contact of contacts)status.contact(contact.point,contact.radius,contact.source);
  // Splash status may reach a neighbor without a direct collision event. React on its real torso surface.
  if(!contacts.length){const binding=status.bindings.find(b=>/breastplate|shirt-torso|front-breastplate|torso/.test(b.source.name))??status.bindings[0];if(binding){const box=new THREE.Box3().setFromBufferAttribute(binding.source.geometry.attributes.position as THREE.BufferAttribute),point=box.getCenter(new THREE.Vector3());point.z=box.max.z;binding.source.updateWorldMatrix(true,false);point.applyMatrix4(binding.source.matrixWorld);status.contact(point,.10,binding.source);}}
  const dispose=status.dispose.bind(status);status.dispose=()=>{dispose();this.statuses.delete(root);};this.statuses.set(root,status);return status;
 }
 update(dt:number):void{if(this.disposed||!Number.isFinite(dt)||dt<=0)return;const step=Math.min(.1,dt);for(const burst of this.bursts){if(!burst.active)continue;burst.age+=step;burst.mesh.material.uniforms.age.value=burst.age;if(burst.age>=.54){burst.active=false;burst.mesh.visible=false;}}this.upload(step);}
 private upload(dt:number):void{
  for(const[name,pool]of this.pools){let count=0;
   for(const p of pool.items){if(!p.active)continue;p.age+=dt;if(p.age>=p.life){p.active=false;p.target=undefined;continue;}
    if(p.target&&p.local){if(!p.target.parent){p.active=false;continue;}p.target.updateWorldMatrix(true,false);p.position.copy(p.local).applyMatrix4(p.target.matrixWorld);}
    if(name==='drops'){p.position.addScaledVector(p.velocity,dt);p.velocity.y-=dt*6.5;if(p.position.y<.04){p.position.y=.035;p.velocity.multiplyScalar(0);}}
    const worldNormal=p.target&&p.normal?p.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(p.target.matrixWorld)).normalize():p.normal??Z;
    const t=p.age/p.life;this.dummy.position.copy(p.position);this.dummy.quaternion.identity();
    if(name==='residue'){this.dummy.quaternion.setFromUnitVectors(Z,p.normal??UP);this.dummy.scale.set(p.size*(.65+.35*Math.min(1,t*10)),p.size,1);}
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
 clear():void{for(const b of this.bursts){b.active=false;b.mesh.visible=false;}for(const p of this.pools.values()){for(const item of p.items){item.active=false;item.target=undefined;}p.next=0;p.mesh.count=0;p.mesh.visible=false;}for(const status of[...this.statuses.values()])status.dispose();this.contacts=new WeakMap();this.events.length=0;this.serial=0;this.randomState=73;this.burstNext=0;}
 dispose():void{if(this.disposed)return;this.clear();this.disposed=true;this.crown.dispose();for(const b of this.bursts)b.mesh.material.dispose();for(const p of this.pools.values()){p.mesh.geometry.dispose();(p.mesh.material as THREE.Material).dispose();p.mesh.dispose();}this.group.removeFromParent();}
}
