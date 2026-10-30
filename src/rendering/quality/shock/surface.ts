import * as THREE from 'three';
import { corrosiveSources, corrosiveSurfaceOf, type CorrosiveStatusVisual } from '../corrosive/surfaces';

const vertex=/* glsl */`uniform mat3 worldNormal;varying vec3 vWorld;void main(){vec4 world=modelMatrix*vec4(position,1.);world.xyz+=normalize(worldNormal*normal)*.008;vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`;
const fragment=/* glsl */`
 uniform vec3 centers[3],uaxes[3],vaxes[3],normals[3];uniform float radii[3],ages[3],seeds[3],presence,kind;
 varying vec3 vWorld;
 float line(vec2 p,vec2 a,vec2 b){vec2 ab=b-a;float t=clamp(dot(p-a,ab)/dot(ab,ab),0.,1.);return length(p-a-ab*t);}
 void main(){float core=0.,blue=0.,knots=0.;
  for(int i=0;i<3;i++){
   vec3 delta=vWorld-centers[i];float radius=max(.002,radii[i]);vec2 p=vec2(dot(delta,uaxes[i]),dot(delta,vaxes[i]))/radius;
   float gate=(1.-smoothstep(.68,1.,length(p)))*(1.-smoothstep(.16,.32,abs(dot(delta,normals[i]))/radius));
   float age=ages[i],seed=seeds[i],reveal=smoothstep(-.1,.05,age*8.-(p.x*.5+.5));
   float blink=.18+.82*smoothstep(.10,.70,sin(age*18.+seed*4.));float distance=4.;
   for(int branch=0;branch<3;branch++){
    float b=float(branch);vec2 q=branch==0?p:branch==1?vec2(p.y,-p.x)*1.3+vec2(.2,.1):vec2(-p.x,p.y)*1.8+vec2(.6,-.25);
    vec2 previous=vec2(-.80,.24*sin(seed+b));
    for(int j=1;j<6;j++){float k=float(j);vec2 next=vec2(-.80+k*.32,.30*sin(k*2.27+seed+b));distance=min(distance,line(q,previous,next));previous=next;}
   }
   float moving=fract(age*1.8+seed*.13),hot=.25+.75*exp(-pow((p.x*.5+.5-moving)*8.,2.));
   float width=mix(.027,.016,kind);core=max(core,(1.-smoothstep(width*.30,width,distance))*gate*reveal*blink*hot);
   blue=max(blue,(1.-smoothstep(width,width*2.8,distance))*gate*reveal*(.3+.7*blink));
   vec2 node=vec2(-.28,.24*sin(2.27+seed));knots=max(knots,(1.-smoothstep(.018,.065,length(p-node)))*gate*blink*reveal);
  }
  float a=max(blue*.50,max(core,knots)) * presence;if(a<.012)discard;
  vec3 color=mix(vec3(.035,.23,.95),vec3(.77,.95,1.),clamp(core+knots,0.,1.));gl_FragColor=vec4(color,a);
 }
`;
interface Anchor {local:THREE.Vector3;normal:THREE.Vector3;u:THREE.Vector3;radius:number;age:number;seed:number}
export interface ShockBinding {source:THREE.Mesh;mesh:THREE.Mesh;material:THREE.ShaderMaterial;anchors:(Anchor|null)[]}
/** Borrowed visible geometry, world-unit masks and target-local anchors. No material/body mutation. */
export class ShockSurface implements CorrosiveStatusVisual{
 readonly group=new THREE.Group();readonly bindings:ShockBinding[]=[];
 private intensity=1;private next=0;private disposed=false;
 constructor(readonly root:THREE.Group,sources=corrosiveSources(root)){
  this.group.name='shock-live-wire-surface';this.group.userData.comicOverlay=true;this.group.userData.presentationOnly=true;root.add(this.group);
  for(const source of sources){
   const material=new THREE.ShaderMaterial({name:'shock-live-wire-charge',vertexShader:vertex,fragmentShader:fragment,transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
    uniforms:{worldNormal:{value:new THREE.Matrix3()},centers:{value:Array.from({length:3},()=>new THREE.Vector3(1e4,1e4,1e4))},uaxes:{value:Array.from({length:3},()=>new THREE.Vector3(1,0,0))},vaxes:{value:Array.from({length:3},()=>new THREE.Vector3(0,1,0))},normals:{value:Array.from({length:3},()=>new THREE.Vector3(0,0,1))},radii:{value:[.002,.002,.002]},ages:{value:[0,0,0]},seeds:{value:[0,0,0]},presence:{value:1},kind:{value:corrosiveSurfaceOf(source)==='armor'?1:0}}});
   const mesh=new THREE.Mesh(source.geometry,material);mesh.name='shock-local-charge-overlay';mesh.visible=false;mesh.raycast=()=>{};mesh.userData.comicOverlay=true;mesh.userData.presentationOnly=true;mesh.userData.borrowedGeometry=true;mesh.renderOrder=3;source.add(mesh);this.bindings.push({source,mesh,material,anchors:[null,null,null]});
  }
 }
 contact(point:THREE.Vector3,normal:THREE.Vector3,radius:number,source?:THREE.Mesh,seed=0,secondary=false):void{
  if(this.disposed||!Number.isFinite(point.lengthSq())||!Number.isFinite(radius)||radius<=0)return;
  const slot=secondary?2:this.next++%2;this.root.updateWorldMatrix(true,true);
  for(const b of this.bindings){
   if(source&&source!==b.source&&(corrosiveSurfaceOf(source)??'armor')!==(corrosiveSurfaceOf(b.source)??'armor'))continue;
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
