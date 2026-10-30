import * as THREE from 'three';
import { corrosiveSources as visibleBodySources,corrosiveSurfaceOf as materialKind,type CorrosiveSurface as SurfaceKind } from '../corrosive/surfaces';

export interface FireContact {root?:THREE.Group;source:THREE.Mesh;point:THREE.Vector3;normal:THREE.Vector3;radius:number;secondary:boolean}
const vertex=/* glsl */`varying vec3 vP,vN;void main(){vP=position;vN=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*.007,1.);}`;
const fragment=/* glsl */`
 uniform float time,presence,skin;uniform vec3 metric,centers[4],normals[4];uniform float radii[4],ages[4];varying vec3 vP,vN;
 float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
 float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 void main(){float n=noise(vP*24.),fine=noise(vP*82.);float field=0.,heat=0.;
 for(int i=0;i<4;i++){vec3 d=(vP-centers[i])*metric;float r=length(d*vec3(1.,.86,1.));float deposit=1.-smoothstep(radii[i]*.24,radii[i],r+(n-.45)*radii[i]*.30);deposit*=smoothstep(.02,.30,dot(normalize(vN),normals[i]));
 float reveal=smoothstep(0.,.12,ages[i]);field=max(field,deposit*reveal);heat=max(heat,deposit*exp(-ages[i]*.65));}
 if(field<.015||presence<.001)discard;
 float ember=smoothstep(.66,.85,fine)*smoothstep(.42,.75,n)*heat;float flicker=.65+.35*sin(time*13.+vP.y*47.+vP.x*31.);
 vec3 soot=vec3(.055,.026,.015);vec3 c=mix(soot,vec3(.88,.15,.014),ember*flicker);c=mix(c,vec3(1.,.60,.08),pow(ember*flicker,2.));
 float alpha=field*(skin>.5?.22:.62)*presence+ember*.25*presence;gl_FragColor=vec4(c,min(.80,alpha));}
`;

/** Cosmetic soot/embers on borrowed visible geometry. Original materials, raycasts and geometry stay untouched. */
export class FireMask {
 readonly mesh:THREE.Mesh;readonly material:THREE.ShaderMaterial;readonly centers=Array.from({length:4},()=>new THREE.Vector3(1e4,1e4,1e4));
 readonly normals=Array.from({length:4},()=>new THREE.Vector3(0,0,1));readonly radii=[.001,.001,.001,.001];readonly ages=[10,10,10,10];private next=0;private disposed=false;
 constructor(readonly source:THREE.Mesh,kind:SurfaceKind){
  this.material=new THREE.ShaderMaterial({name:`fire-cinderbrand-${kind}`,vertexShader:vertex,fragmentShader:fragment,uniforms:{time:{value:0},presence:{value:1},skin:{value:kind==='skin'?1:0},metric:{value:new THREE.Vector3(1,1,1)},centers:{value:this.centers},normals:{value:this.normals},radii:{value:this.radii},ages:{value:this.ages}},transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  this.mesh=new THREE.Mesh(source.geometry,this.material);this.mesh.name='fire-local-soot-and-embers';this.mesh.userData.comicOverlay=true;this.mesh.userData.presentationOnly=true;this.mesh.raycast=()=>{};this.mesh.renderOrder=2;source.add(this.mesh);
 }
 contact(point:THREE.Vector3,radius:number,normal:THREE.Vector3){
  const slot=this.next++%4;this.source.updateWorldMatrix(true,false);this.centers[slot].copy(point);this.source.worldToLocal(this.centers[slot]);this.radii[slot]=THREE.MathUtils.clamp(radius,.005,.7);this.ages[slot]=0;
  this.normals[slot].copy(normal).applyMatrix3(new THREE.Matrix3().getNormalMatrix(this.source.matrixWorld).invert()).normalize();this.update(0,0,1);
 }
 update(dt:number,time:number,presence:number){if(this.disposed)return;for(let i=0;i<4;i++)this.ages[i]+=Math.max(0,dt);this.source.updateWorldMatrix(true,false);this.source.getWorldScale(this.material.uniforms.metric.value as THREE.Vector3);this.material.uniforms.time.value=time;this.material.uniforms.presence.value=presence;this.mesh.visible=presence>0;}
 dispose(){if(this.disposed)return;this.disposed=true;this.mesh.removeFromParent();this.material.dispose();}
}

export class FireStatus {
 readonly group=new THREE.Group();readonly bindings=new Map<THREE.Mesh,FireMask>();readonly contacts:FireContact[]=[];
 private intensity=1;private time=0;private emitAt=0;private disposed=false;
 constructor(readonly root:THREE.Group,private readonly linger:(contact:FireContact,intensity:number)=>void,private readonly released:()=>void){
  this.group.name='fire-cinderbrand-status';this.group.userData.comicOverlay=true;this.group.userData.presentationOnly=true;root.add(this.group);
 }
 contact(contact:FireContact){
  const sources=visibleBodySources(this.root);if(this.disposed||!sources.includes(contact.source))return;
  const kind=materialKind(contact.source)??'armor',bounds=new THREE.Box3(),closest=new THREE.Vector3();
  // A button or raised rib may be the nearest visible triangle. Extend the cosmetic mask
  // over nearby parts of that same material, while armor never coats the clothing beneath.
  for(const source of sources){
   if((materialKind(source)??'armor')!==kind)continue;source.updateWorldMatrix(true,false);bounds.setFromBufferAttribute(source.geometry.attributes.position as THREE.BufferAttribute).applyMatrix4(source.matrixWorld);bounds.clampPoint(contact.point,closest);if(closest.distanceTo(contact.point)>contact.radius)continue;
   let mask=this.bindings.get(source);if(!mask){if(this.bindings.size>=5){const [oldSource,old]=this.bindings.entries().next().value!;old.dispose();this.bindings.delete(oldSource);}mask=new FireMask(source,kind);this.bindings.set(source,mask);}
   mask.contact(contact.point,contact.radius,contact.normal);
  }
  this.contacts.push({...contact,root:this.root,point:contact.source.worldToLocal(contact.point.clone()),normal:contact.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(contact.source.matrixWorld).invert()).normalize()});while(this.contacts.length>3)this.contacts.shift();
 }
 update(dt:number,time?:number){
  if(this.disposed||!Number.isFinite(dt)||dt<=0)return;this.time+=Math.min(.1,dt);const displayTime=Number.isFinite(time)?time!:this.time;
  for(const mask of this.bindings.values())mask.update(Math.min(.1,dt),displayTime,this.intensity);
  if(this.intensity<=.02||this.time<this.emitAt)return;this.emitAt=this.time+.15;
  for(const contact of this.contacts.slice(-2)){
   if(!contact.source.parent)continue;contact.source.updateWorldMatrix(true,false);
   this.linger({...contact,point:contact.point.clone().applyMatrix4(contact.source.matrixWorld),normal:contact.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(contact.source.matrixWorld)).normalize()},this.intensity);
  }
 }
 setIntensity(value:number){if(!Number.isFinite(value))return;this.intensity=THREE.MathUtils.clamp(value,0,1);for(const mask of this.bindings.values())mask.material.uniforms.presence.value=this.intensity;}
 dispose(){if(this.disposed)return;this.disposed=true;for(const mask of this.bindings.values())mask.dispose();this.bindings.clear();this.contacts.length=0;this.group.removeFromParent();this.released();}
}
