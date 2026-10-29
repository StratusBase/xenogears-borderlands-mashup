import * as THREE from 'three';
import { getWeaponElements, type ElementType } from '../../core/arsenal';
import type { BallisticPresentationImpact } from '../PlayerBallistics';

type Kind='patch'|'shard'|'drop'|'spark'|'ring'|'strand'|'flame';
const palette:Record<ElementType,number>={kinetic:0xc7b89b,fire:0xff8c26,ice:0xa8eeff,corrosive:0x9cda37,shock:0x8fcaff,radiation:0xe4e473,gravity:0xbc91e6,adhesive:0xe9bb68};
const index:Record<ElementType,number>={kinetic:0,fire:1,ice:2,corrosive:3,shock:4,radiation:5,gravity:6,adhesive:7};
export const ELEMENTAL_IMPACT_CAPACITY=Object.freeze({patch:48,shard:80,drop:64,spark:96,ring:32,strand:32,flame:64});
interface Particle{active:boolean;age:number;life:number;size:THREE.Vector3;position:THREE.Vector3;velocity:THREE.Vector3;rotation:THREE.Quaternion;color:THREE.Color;element:ElementType;seed:number;target?:THREE.Group;local?:THREE.Vector3;normal?:THREE.Vector3;localRotation?:THREE.Quaternion}
interface Pool{mesh:THREE.InstancedMesh;items:Particle[];next:number;alpha:THREE.InstancedBufferAttribute;tint:THREE.InstancedBufferAttribute;effect:THREE.InstancedBufferAttribute}
const zAxis=new THREE.Vector3(0,0,1);
function shader(patch:boolean):THREE.ShaderMaterial{
 return new THREE.ShaderMaterial({name:patch?'ElementalSurfaceResidue':'ElementalImpactParticles',transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,
  vertexShader:`attribute float fxAlpha;attribute vec3 fxTint;attribute float fxElement;varying vec2 vUv;varying float vAlpha;varying vec3 vTint;varying float vElement;void main(){vUv=uv;vAlpha=fxAlpha;vTint=fxTint;vElement=fxElement;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec2 vUv;varying float vAlpha;varying vec3 vTint;varying float vElement;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){float a=vAlpha;vec3 c=vTint;${patch?`vec2 q=vUv*2.-1.;float r=length(q);float angle=atan(q.y,q.x);float edge=.79+sin(angle*7.)*.055+sin(angle*13.)*.028;float mask=1.-smoothstep(edge-.12,edge,r);float fleck=h(floor(vUv*35.));
 if(vElement<.5){mask*=smoothstep(.15,.65,r)*.6;}
 else if(vElement<1.5){c=mix(vec3(.075,.055,.04),c,smoothstep(.65,.82,r)*.45);mask*=.65;}
 else if(vElement<2.5){float crack=1.-smoothstep(.012,.045,abs(sin(angle*3.+r*5.))*r);mask*=max(crack*.7,smoothstep(.55,.8,r)*.45);}
 else if(vElement<3.5){float bead=pow(max(0.,1.-length(q-vec2(-.23,.25))*3.),8.);c=mix(c,vec3(.92,1.,.68),bead*.7);mask*=.63+fleck*.18;}
 else if(vElement<4.5){mask*=pow(max(0.,cos(angle*6.+r*18.)),12.);}
 else if(vElement<5.5){mask*=smoothstep(.025,.07,abs(r-.55))*.2+.4*(1.-smoothstep(.025,.06,abs(r-.58)));}
 else if(vElement<6.5){c=mix(vec3(.06,.035,.12),c,smoothstep(.35,.8,r));mask*=.55;}
 else{float thin=sin(angle*5.+r*2.);mask*=.63; c=mix(c,vec3(1.,.9,.62),pow(max(0.,1.-length(q-vec2(-.25,.3))*3.),8.)*.6);}
 a*=mask;`:''}if(a<.008)discard;gl_FragColor=vec4(c,a);}`});
}
/** Surface-oriented contact, splats, shatter and residue. Fixed pools never participate in collision. */
export class ElementalImpacts{
 readonly group=new THREE.Group();private pools=new Map<Kind,Pool>();private randomState=0x41aef;private dummy=new THREE.Object3D();private disposed=false;
 constructor(scene:THREE.Scene){
  this.group.name='elemental-quality-impacts';this.group.userData.comicOverlay=true;this.group.userData.presentationOnly=true;scene.add(this.group);
  const geometry:Record<Kind,THREE.BufferGeometry>={patch:new THREE.PlaneGeometry(2,2),shard:new THREE.IcosahedronGeometry(1,0),drop:new THREE.IcosahedronGeometry(1,1),spark:new THREE.BoxGeometry(1,1,1),ring:new THREE.TorusGeometry(1,.025,4,24),strand:new THREE.CylinderGeometry(1,1,1,5),flame:new THREE.ConeGeometry(1,1,5)};
  for(const kind of Object.keys(ELEMENTAL_IMPACT_CAPACITY)as Kind[]){const count=ELEMENTAL_IMPACT_CAPACITY[kind],alpha=new THREE.InstancedBufferAttribute(new Float32Array(count),1),tint=new THREE.InstancedBufferAttribute(new Float32Array(count*3),3),effect=new THREE.InstancedBufferAttribute(new Float32Array(count),1);
   geometry[kind].setAttribute('fxAlpha',alpha);geometry[kind].setAttribute('fxTint',tint);geometry[kind].setAttribute('fxElement',effect);
   const mesh=new THREE.InstancedMesh(geometry[kind],shader(kind==='patch'),count);mesh.name=`elemental-${kind}-pool`;mesh.count=0;mesh.frustumCulled=false;mesh.raycast=()=>{};mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.group.add(mesh);
   const items=Array.from({length:count},():Particle=>({active:false,age:0,life:1,size:new THREE.Vector3(),position:new THREE.Vector3(),velocity:new THREE.Vector3(),rotation:new THREE.Quaternion(),color:new THREE.Color(),element:'kinetic',seed:0}));this.pools.set(kind,{mesh,items,next:0,alpha,tint,effect});}
 }
 get activeCount():number{return[...this.pools.values()].reduce((n,p)=>n+p.items.filter(x=>x.active).length,0);}
 private random():number{this.randomState=(Math.imul(this.randomState,1664525)+1013904223)>>>0;return this.randomState/4294967296;}
 private emit(kind:Kind,point:THREE.Vector3,element:ElementType,life:number,size:readonly[number,number,number]):Particle{
  const pool=this.pools.get(kind)!,p=pool.items[pool.next];pool.next=(pool.next+1)%pool.items.length;p.active=true;p.age=0;p.life=life;p.position.copy(point);p.size.set(...size);p.rotation.identity();p.velocity.set(0,0,0);p.color.setHex(palette[element]);p.element=element;p.target=undefined;p.local=undefined;p.normal=undefined;p.localRotation=undefined;p.seed=this.random();return p;
 }
 impact(event:BallisticPresentationImpact):void{
  if(this.disposed||!Number.isFinite(event.point.lengthSq()))return;
  const normal=event.normal.clone().normalize();if(!Number.isFinite(normal.lengthSq())||normal.lengthSq()<.5)normal.set(0,1,0);
  const radius=Number.isFinite(event.radius)?Math.max(0,Math.min(15,event.radius)):0;
  const point=event.point.clone().addScaledVector(normal,.018),scale=Math.min(1.65,event.phase==='detonate'?.75+radius*.15:.72),elements=getWeaponElements(event.spec);
  for(const[elementNumber,element]of elements.entries()){
   const s=scale*(elementNumber?.65:1),life=element==='fire'?2.2:element==='shock'?.4:element==='gravity'?1.3:element==='kinetic'?.9:3.1;
   const patch=this.emit('patch',point,element,life,[s*.34,s*.34,1]);patch.rotation.setFromUnitVectors(zAxis,normal);
   if(event.target?.parent){event.target.updateWorldMatrix(true,false);patch.target=event.target;patch.local=event.target.worldToLocal(point.clone());patch.normal=normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(event.target.matrixWorld).invert()).normalize();}
   const count=element==='ice'?9:element==='corrosive'||element==='adhesive'?7:element==='fire'?8:element==='kinetic'?5:element==='radiation'?3:6;
   for(let i=0;i<count;i++){
    const angle=i/count*Math.PI*2+this.random()*.3;let direction=new THREE.Vector3(Math.cos(angle),Math.sin(angle),.4+this.random()).normalize().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(zAxis,normal));
    if(element==='fire')direction.y=Math.abs(direction.y)+.7;
    const kind:Kind=element==='ice'?'shard':element==='corrosive'||element==='adhesive'?'drop':element==='fire'?'flame':element==='gravity'?'shard':'spark';
    const size=element==='ice'?.065:kind==='spark'?.012:kind==='flame'?.055:.045;
    const p=this.emit(kind,point,element,element==='ice'?.65:element==='fire'?.65:.45+this.random()*.25,[size*s,size*s*(element==='ice'?2.8:kind==='flame'?3:1),size*s]);
    p.velocity.copy(direction).multiplyScalar((element==='gravity'?.65:element==='adhesive'?1.1:2.7)*s);p.rotation.setFromUnitVectors(kind==='spark'?zAxis:new THREE.Vector3(0,1,0),direction);
    if(kind==='spark')p.size.z=.11*s;
   }
   if(element==='gravity'||element==='radiation'||element==='shock')for(let i=0;i<2;i++){
    const ring=this.emit('ring',point,element,element==='gravity'?.9:.55,[s*(.25+i*.13),s*(.25+i*.13),s*(.25+i*.13)]);ring.rotation.setFromUnitVectors(zAxis,normal);ring.age=-i*.045;
   }
   if(element==='adhesive'||event.spec.projectile==='sticky')for(let i=0;i<4;i++){
    const a=i/4*Math.PI*2;const strand=this.emit('strand',point,element,1.4,[.009*s,.18*s,.009*s]);strand.rotation.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(Math.cos(a)*.6,Math.sin(a)*.6,.3).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(zAxis,normal)));strand.position.addScaledVector(normal,.035);
    if(event.target?.parent){strand.target=event.target;strand.local=event.target.worldToLocal(strand.position.clone());strand.normal=normal.clone();strand.localRotation=event.target.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(strand.rotation);}
   }
  }
  this.upload(0);
 }
 update(dt:number):void{if(this.disposed||!Number.isFinite(dt)||dt<=0)return;const elapsed=Math.min(.1,dt);this.upload(elapsed);}
 private upload(dt:number):void{
  for(const[kind,pool]of this.pools){let count=0;for(const p of pool.items){if(!p.active)continue;p.age+=dt;if(p.age>=p.life){p.active=false;p.target=undefined;continue;}if(p.age<0)continue;
   const t=p.age/p.life;
   if(p.target&&p.local&&p.normal){if(p.target.parent){p.target.updateWorldMatrix(true,false);p.position.copy(p.local).applyMatrix4(p.target.matrixWorld);const normal=p.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(p.target.matrixWorld)).normalize();if(p.localRotation)p.rotation.copy(p.target.getWorldQuaternion(new THREE.Quaternion())).multiply(p.localRotation);else p.rotation.setFromUnitVectors(zAxis,normal);}else p.target=undefined;}
   if(kind!=='patch'&&kind!=='ring'&&kind!=='strand'){p.position.addScaledVector(p.velocity,dt);if(p.element==='gravity')p.velocity.multiplyScalar(Math.exp(-dt*6));else p.velocity.y-=dt*(p.element==='fire'?-1.1:p.element==='shock'?0:7);}
   this.dummy.position.copy(p.position);this.dummy.quaternion.copy(p.rotation);this.dummy.scale.copy(p.size);
   if(kind==='ring')this.dummy.scale.multiplyScalar(p.element==='gravity'?1.7*(1-t)+.1:.5+t*2);
   if(kind==='patch')this.dummy.scale.multiplyScalar(.65+Math.min(1,t*9)*.35);
   if(kind==='strand')this.dummy.scale.y*=1+Math.sin(t*Math.PI)*.9;
   if(kind==='flame')this.dummy.scale.multiplyScalar(Math.max(.05,1-t*.8));
   this.dummy.updateMatrix();pool.mesh.setMatrixAt(count,this.dummy.matrix);pool.alpha.setX(count,kind==='patch'?Math.min(1,(1-t)*3)*.75:Math.min(1,(1-t)*2)*.85);pool.tint.setXYZ(count,p.color.r,p.color.g,p.color.b);pool.effect.setX(count,index[p.element]);count++;
  }pool.mesh.count=count;pool.mesh.visible=count>0;pool.mesh.instanceMatrix.needsUpdate=true;pool.alpha.needsUpdate=pool.tint.needsUpdate=pool.effect.needsUpdate=true;}
 }
 clear():void{for(const pool of this.pools.values()){for(const p of pool.items){p.active=false;p.target=undefined;}pool.mesh.count=0;pool.mesh.visible=false;}}
 dispose():void{if(this.disposed)return;this.disposed=true;this.clear();for(const p of this.pools.values()){p.mesh.geometry.dispose();(p.mesh.material as THREE.Material).dispose();p.mesh.dispose();}this.group.removeFromParent();}
}
