import * as THREE from 'three';
import { bodySurfaceSources, surfaceKindOf, type SurfaceStatusVisual } from '../shared/surfaces';

import { prototypeVertex,prototypeFragment } from './prototypeSurface';
const vertex=prototypeVertex;
const fragment=/* glsl */`
 uniform vec3 centers[3],uaxes[3],vaxes[3],normals[3];uniform float radii[3],ages[3],seeds[3],presence,kind;
 varying vec3 vWorld;
 float noise(float n){return fract(sin(n*127.1+311.7)*43758.5453);}
 float stroke(vec2 p,vec2 a,vec2 b){vec2 ab=b-a;float t=clamp(dot(p-a,ab)/max(dot(ab,ab),.00001),0.,1.);return length(p-a-ab*t);}
 void main(){float core=0.,ion=0.,halo=0.;
  for(int i=0;i<3;i++){
   vec3 delta=vWorld-centers[i];float radius=max(.002,radii[i]);vec2 p=vec2(dot(delta,uaxes[i]),dot(delta,vaxes[i]))/radius;
   float gate=(1.-smoothstep(.77,1.,length(p)))*(1.-smoothstep(.18,.48,abs(dot(delta,normals[i]))/radius));
   if(gate<.002)continue;
   float age=ages[i],seed=seeds[i],epoch=floor(age*7.),pulse=.38+.62*pow(max(0.,sin(age*23.+seed)),2.);
   float reveal=smoothstep(0.,.09,age-length(p)*.09),dist=3.,runner=0.;
   for(int branch=0;branch<5;branch++){
    float b=float(branch),angle=branch==0?.32:branch==1?3.85:branch==2?-1.22:branch==3?1.65:2.48;
    angle+=(noise(seed+b*9.)-.5)*.45;vec2 direction=vec2(cos(angle),sin(angle)),side=vec2(-direction.y,direction.x);
    float extent=branch==0?.97:branch==1?.79:branch==2?.88:.62;vec2 previous=vec2(0.);
    for(int j=1;j<=7;j++){
     float q=float(j)/7.,jitter=(noise(seed+float(j)*3.77+b*27.+epoch*.73)-.5)*.32*sin(q*3.14159);
     vec2 next=direction*q*extent+side*jitter;
     float d=stroke(p,previous,next);dist=min(dist,d);
     // Fine forks actually join the parent conductor; they are not independent spokes.
     if(j==3||j==5){vec2 tip=next+side*(j==3?.21:-.26)+direction*.17;dist=min(dist,stroke(p,next,tip));}
     float hot=exp(-pow((q-fract(age*1.9+seed*.11+b*.17))*9.,2.));runner=max(runner,exp(-d*d*1000.)*hot);
     previous=next;
    }
   }
   float aa=max(fwidth(dist)*.6,.003),width=mix(.027,.023,kind),flash=exp(-age*22.);
   float c=1.-smoothstep(width*.28-aa,width*.62+aa,dist),e=exp(-dist*dist/(width*width*2.4)),h=exp(-dist*dist/(width*width*22.));
   core=max(core,(c*(.65+.35*pulse)+runner*.6)*gate*reveal);
   ion=max(ion,e*gate*reveal*(.42+.58*pulse));halo=max(halo,(h*.25+exp(-dot(p,p)*14.)*flash*.35)*gate*reveal);
  }
  float a=clamp(core+ion*.65+halo,0.,1.)*presence;if(a<.006)discard;
  vec3 color=mix(vec3(.025,.19,.94),vec3(.82,.97,1.),clamp(core+ion*.17,0.,1.));gl_FragColor=vec4(color,a);
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
