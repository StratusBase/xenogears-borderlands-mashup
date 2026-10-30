import * as THREE from 'three';
import { bodySurfaceSources, surfaceKindOf, type SurfaceStatusVisual } from '../shared/surfaces';

import { prototypeVertex,prototypeFragment } from './prototypeSurface';
const vertex=prototypeVertex;
const fragment=/* glsl */`
 uniform vec3 centers[3],uaxes[3],vaxes[3],normals[3];uniform float radii[3],ages[3],seeds[3],presence,kind;
 varying vec3 vWorld;
 float noise(float n){return fract(sin(n*127.1+311.7)*43758.5453);}
 float stroke(vec2 p,vec2 a,vec2 b){vec2 ab=b-a;float t=clamp(dot(p-a,ab)/max(dot(ab,ab),.00001),0.,1.);return length(p-a-ab*t);}
 void main(){float core=0.,ion=0.,halo=0.,nodes=0.;
  for(int i=0;i<3;i++){
   vec3 delta=vWorld-centers[i];float radius=max(.002,radii[i]);vec2 p=vec2(dot(delta,uaxes[i]),dot(delta,vaxes[i]))/radius;
   float gate=(1.-smoothstep(.78,1.,length(p)))*(1.-smoothstep(.18,.48,abs(dot(delta,normals[i]))/radius));if(gate<.002)continue;
   float age=ages[i],seed=seeds[i],epoch=floor(age*8.),reveal=smoothstep(0.,.08,age-length(p)*.09),aftermath=smoothstep(.15,.80,age);
   vec2 n1=vec2(-.38,.23),n2=vec2(.29,-.35),n3=vec2(.38,.33);
   n1+=vec2(noise(seed)-.5,noise(seed+4.)-.5)*.45;n2+=vec2(noise(seed+8.)-.5,noise(seed+12.)-.5)*.40;n3+=vec2(noise(seed+16.)-.5,noise(seed+20.)-.5)*.35;
   for(int branch=0;branch<7;branch++){
    float b=float(branch),salt=seed+b*29.,blink=smoothstep(.18,.85,sin(age*(13.+noise(salt)*8.)+salt));
    float charge=mix(1.,.28+.72*blink,aftermath)*(.55+.45*noise(salt+3.));
    vec2 origin=branch<3?vec2(0.):branch<5?n1:branch==5?n2:n3;
    vec2 end=branch==0?n1:branch==1?n2:branch==2?n3:branch==3?vec2(-.83,.48):branch==4?vec2(-.51,-.48):branch==5?vec2(.64,-.76):vec2(.78,.57);
    if(kind>.5&&branch>=3){end=origin+vec2(branch==4?-.37:branch==6?.32:0.,branch==3?.43:branch==5?-.38:0.);}
    vec2 direction=normalize(end-origin),side=vec2(-direction.y,direction.x),previous=origin;
    for(int j=1;j<=10;j++){
     float q=float(j)/10.,bend=(noise(salt+float(j)*3.77+epoch*.43)-.5)*.16;
     bend+=(noise(salt+floor(float(j)*.5)*9.1)-.5)*.11;
     vec2 next=mix(origin,end,q)+side*bend*sin(q*3.14159);
     float d=stroke(p,previous,next),width=(.028-.018*q)*(branch<3?1.:.60),aa=max(fwidth(d)*.55,.0025);
     float runner=.35+.65*exp(-pow((q-fract(age*1.7+salt*.17))*9.,2.));
     core=max(core,(1.-smoothstep(width*.20-aa,width*.65+aa,d))*charge*runner*gate*reveal);
     ion=max(ion,exp(-d*d/(width*width*3.))*charge*gate*reveal);
     halo=max(halo,exp(-d*d/(width*width*24.))*.28*charge*gate*reveal);
     if(j==4||j==7){vec2 joint=next+side*(j==4?.13:-.10)+direction*.08;float f=stroke(p,next,joint);float fine=1.-smoothstep(.003,.010,f);core=max(core,fine*.50*charge*gate*reveal);}
     previous=next;
    }
    float node=length(p-origin),island=exp(-node*node*190.)*charge*gate*reveal;
    nodes=max(nodes,island);halo=max(halo,exp(-node*node*38.)*.35*charge*gate*reveal);
   }
  }
  float a=clamp(core+ion*.64+halo+nodes,0.,1.)*presence;if(a<.006)discard;
  vec3 color=mix(vec3(.015,.10,.62),vec3(.77,.96,1.),clamp(core+nodes,0.,1.));gl_FragColor=vec4(color,a);
 }
`;
interface Anchor {local:THREE.Vector3;normal:THREE.Vector3;u:THREE.Vector3;radius:number;age:number;seed:number}
export interface ShockBinding {source:THREE.Mesh;mesh:THREE.Mesh;material:THREE.ShaderMaterial;anchors:(Anchor|null)[]}
/** Borrowed visible geometry, world-unit masks and target-local anchors. No material/body mutation. */
export class ShockSurface implements SurfaceStatusVisual{
 readonly group=new THREE.Group();readonly bindings:ShockBinding[]=[];
 private intensity=1;private next=0;private disposed=false;
 constructor(readonly root:THREE.Group,sources=bodySurfaceSources(root),readonly profile:'prototype'|'lightning'='lightning'){
  this.group.name='shock-live-wire-surface';this.group.userData.comicOverlay=true;this.group.userData.presentationOnly=true;root.add(this.group);
  for(const source of sources){
   const material=new THREE.ShaderMaterial({name:'shock-live-wire-charge',vertexShader:vertex,fragmentShader:profile==='prototype'?prototypeFragment:fragment,transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
    uniforms:{worldNormal:{value:new THREE.Matrix3()},centers:{value:Array.from({length:3},()=>new THREE.Vector3(1e4,1e4,1e4))},uaxes:{value:Array.from({length:3},()=>new THREE.Vector3(1,0,0))},vaxes:{value:Array.from({length:3},()=>new THREE.Vector3(0,1,0))},normals:{value:Array.from({length:3},()=>new THREE.Vector3(0,0,1))},radii:{value:[.002,.002,.002]},ages:{value:[0,0,0]},seeds:{value:[0,0,0]},presence:{value:1},kind:{value:surfaceKindOf(source)==='armor'?1:0}}});
   const mesh=new THREE.Mesh(source.geometry,material);mesh.name='shock-local-charge-overlay';mesh.visible=false;mesh.raycast=()=>{};mesh.userData.comicOverlay=true;mesh.userData.presentationOnly=true;mesh.userData.borrowedGeometry=true;mesh.renderOrder=3;source.add(mesh);this.bindings.push({source,mesh,material,anchors:[null,null,null]});
  }
 }
 contact(point:THREE.Vector3,normal:THREE.Vector3,radius:number,source?:THREE.Mesh,seed=0,secondary=false):void{
  if(this.disposed||!Number.isFinite(point.lengthSq())||!Number.isFinite(radius)||radius<=0)return;
  const slot=secondary?2:this.next++%2;this.root.updateWorldMatrix(true,true);
  for(const b of this.bindings){
   if(source&&source!==b.source&&(surfaceKindOf(source)??'armor')!==(surfaceKindOf(b.source)??'armor'))continue;
   const bounds=new THREE.Box3().setFromBufferAttribute(b.source.geometry.attributes.position as THREE.BufferAttribute).applyMatrix4(b.source.matrixWorld);
   if(bounds.distanceToPoint(point)>radius)continue;
   const inverse=b.source.matrixWorld.clone().invert(),n=normal.clone().normalize(),u=new THREE.Vector3(0,1,0).cross(n).normalize();if(u.lengthSq()<.1)u.set(1,0,0);
   b.anchors[slot]={local:point.clone().applyMatrix4(inverse),normal:n.applyMatrix3(new THREE.Matrix3().getNormalMatrix(b.source.matrixWorld).invert()).normalize(),u:u.transformDirection(inverse),radius,age:0,seed};b.mesh.visible=true;
  }
  this.upload();
 }
 update(dt:number):void{if(this.disposed||!Number.isFinite(dt)||dt<=0)return;for(const b of this.bindings)for(const a of b.anchors)if(a)a.age+=Math.min(.1,dt);this.upload();}
 private upload():void{
  for(const b of this.bindings){
   b.source.updateWorldMatrix(true,false);const uniforms=b.material.uniforms,normalMatrix=new THREE.Matrix3().getNormalMatrix(b.source.matrixWorld);uniforms.worldNormal.value.copy(normalMatrix);uniforms.presence.value=this.intensity;
   b.mesh.visible=b.anchors.some(Boolean)&&this.intensity>0;
   for(let i=0;i<3;i++){const a=b.anchors[i];if(!a)continue;const n=uniforms.normals.value[i] as THREE.Vector3,u=uniforms.uaxes.value[i] as THREE.Vector3;
    uniforms.centers.value[i].copy(a.local).applyMatrix4(b.source.matrixWorld);n.copy(a.normal).applyMatrix3(normalMatrix).normalize();u.copy(a.u).transformDirection(b.source.matrixWorld);u.addScaledVector(n,-u.dot(n)).normalize();uniforms.vaxes.value[i].crossVectors(n,u).normalize();uniforms.radii.value[i]=a.radius;uniforms.ages.value[i]=a.age;uniforms.seeds.value[i]=a.seed;
   }
  }
 }
 setIntensity(value:number):void{if(Number.isFinite(value)){this.intensity=THREE.MathUtils.clamp(value,0,1);this.upload();}}
 dispose():void{if(this.disposed)return;this.disposed=true;for(const b of this.bindings){b.mesh.removeFromParent();b.material.dispose();}this.group.removeFromParent();}
}
