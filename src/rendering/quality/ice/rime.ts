import * as THREE from 'three';
import { bodySurfaceSources as bodySources,surfaceKindOf as surfaceOf } from '../shared/surfaces';

const vertex=/* glsl */`varying vec3 vP;varying vec3 vN;varying vec3 vV;void main(){vP=position;vN=normal;vec4 p=modelViewMatrix*vec4(position+normal*.004,1.);vV=-p.xyz;gl_Position=projectionMatrix*p;}`;
const fragment=/* glsl */`
uniform vec3 centers[4],normals[4],metric;uniform float radii[4],ages[4],presence,kind;varying vec3 vP;varying vec3 vN;varying vec3 vV;
float h(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
void main(){float field=0.,veins=0.;vec3 p=vP*metric;float grain=noise(p*110.),coarse=noise(p*25.);
 for(int i=0;i<4;i++){
  vec3 delta=(vP-centers[i])*metric;vec3 n=normalize(normals[i]);vec3 right=normalize(cross(abs(n.y)<.85?vec3(0,1,0):vec3(0,0,1),n));vec3 along=cross(n,right);
  vec2 q=vec2(dot(delta,right),dot(delta,along))/max(.001,radii[i]);
  float alignment=smoothstep(.08,.72,dot(normalize(vN),n));float footprint=1.-smoothstep(.24,1.,length(q*vec2(.86,1.25))+coarse*.18);
  float reveal=smoothstep(-.1,.1,mix(-.9,1.2,smoothstep(0.,.26,ages[i]))-q.x);
  float stem=abs(q.y-.15*sin(q.x*4.)-.12*q.x);float branch=min(abs(q.y-.55*q.x-.10),abs(q.y+.38*q.x+.13));
  float lines=max(1.-smoothstep(.014,.065,stem),(1.-smoothstep(.014,.044,branch))*.75);
  float feather=pow(max(0.,cos(q.x*36.+q.y*18.)),10.)*(1.-smoothstep(.05,.55,stem));
  field=max(field,footprint*reveal*alignment*(.20+.48*grain+.30*lines));veins=max(veins,footprint*reveal*alignment*max(lines,feather*.6));
 }
 if(field<.06||presence<.005)discard;float frost=smoothstep(.16,.70,field);float edge=pow(1.-abs(dot(normalize(vN),normalize(vV))),3.);
 vec3 color=mix(vec3(.29,.46,.55),vec3(.83,.94,.97),.35+grain*.50+veins*.25);color+=vec3(.09,.12,.13)*edge;
 float alpha=(frost*(kind<.5?.22:kind<1.5?.40:.48)+veins*.14)*presence;if(alpha<.02)discard;gl_FragColor=vec4(color,min(.88,alpha));}`;
interface Binding {source:THREE.Mesh;mesh:THREE.Mesh;material:THREE.ShaderMaterial;centers:THREE.Vector3[];normals:THREE.Vector3[];radii:number[];ages:number[];metric:THREE.Vector3;kind:number;active:boolean}
/** One response-owned material keeps its GPU programs alive between targets. Uniforms bind per draw. */
export class IceRimeMaterials {
 readonly material=new THREE.ShaderMaterial({name:'ice-local-rime',vertexShader:vertex,fragmentShader:fragment,uniforms:{centers:{value:Array.from({length:4},()=>new THREE.Vector3(1e4,1e4,1e4))},normals:{value:Array.from({length:4},()=>new THREE.Vector3(0,0,1))},radii:{value:[.001,.001,.001,.001]},ages:{value:[0,0,0,0]},metric:{value:new THREE.Vector3(1,1,1)},presence:{value:1},kind:{value:2}},transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 bind(binding:Binding,presence:number){const u=this.material.uniforms;u.centers.value=binding.centers;u.normals.value=binding.normals;u.radii.value=binding.radii;u.ages.value=binding.ages;u.metric.value=binding.metric;u.presence.value=presence;u.kind.value=binding.kind;this.material.uniformsNeedUpdate=true;}
 dispose(){this.material.dispose();}
}
/** Ice owns overlays, never the borrowed body geometry/materials or any combat status. */
export class IceRime {
 readonly group=new THREE.Group();readonly bindings:Binding[]=[];private next=0;private intensity=1;private disposed=false;
 private readonly materials:IceRimeMaterials;private readonly ownsMaterials:boolean;
 constructor(readonly root:THREE.Object3D,sources?:THREE.Mesh[],materials?:IceRimeMaterials){
  this.materials=materials??new IceRimeMaterials();this.ownsMaterials=!materials;
  this.group.name='ice-rime-bindings';this.group.userData.comicOverlay=true;this.group.userData.presentationOnly=true;root.add(this.group);
  for(const source of sources??bodySources(root as THREE.Group)){
   const centers=Array.from({length:4},()=>new THREE.Vector3(1e4,1e4,1e4)),normals=Array.from({length:4},()=>new THREE.Vector3(0,0,1)),radii=[.001,.001,.001,.001],ages=[0,0,0,0],kind=surfaceOf(source);
   const material=this.materials.material;
   const mesh=new THREE.Mesh(source.geometry,material);mesh.name='ice-local-rime';mesh.userData.comicOverlay=true;mesh.userData.presentationOnly=true;mesh.raycast=()=>{};mesh.visible=false;mesh.renderOrder=2;source.add(mesh);
   const binding:Binding={source,mesh,material,centers,normals,radii,ages,metric:new THREE.Vector3(1,1,1),kind:kind==='skin'?0:kind==='cloth'?1:2,active:false};
   mesh.onBeforeRender=(_renderer,_scene,_camera,_geometry,drawMaterial)=>{if(drawMaterial===material)this.materials.bind(binding,this.intensity);};this.bindings.push(binding);
  }
 }
 contact(point:THREE.Vector3,radius:number,source?:THREE.Mesh,normal=new THREE.Vector3(0,0,1)){
  if(this.disposed||!Number.isFinite(point.lengthSq())||!Number.isFinite(radius)||radius<=0)return;
  const slot=this.next++%4;this.root.updateWorldMatrix(true,true);
  for(const b of this.bindings){
   b.centers[slot].copy(point);b.source.worldToLocal(b.centers[slot]);b.ages[slot]=0;
   b.normals[slot].copy(normal).applyMatrix3(new THREE.Matrix3().getNormalMatrix(b.source.matrixWorld).invert()).normalize();
   const scale=b.source.getWorldScale(new THREE.Vector3()),metric=b.metric;metric.set(Math.abs(scale.x),Math.abs(scale.y),Math.abs(scale.z));
   const matching=!source||(surfaceOf(source)??'armor')===(surfaceOf(b.source)??'armor');b.radii[slot]=matching?Math.min(1.1,Math.max(.002,radius)):.00001;
   const bounds=new THREE.Box3().setFromBufferAttribute(b.source.geometry.attributes.position as THREE.BufferAttribute),closest=new THREE.Vector3();
   b.active=b.centers.some((center,i)=>center.clone().sub(bounds.clampPoint(center,closest)).multiply(metric).lengthSq()<=b.radii[i]**2);b.mesh.visible=b.active&&this.intensity>0;
  }
 }
 update(dt:number,_time?:number){if(this.disposed||!Number.isFinite(dt)||dt<=0)return;for(const b of this.bindings){for(let i=0;i<4;i++)b.ages[i]=Math.min(4,b.ages[i]+Math.min(.1,dt));b.mesh.visible=b.active&&this.intensity>0&&Boolean(b.source.parent);}}
 setIntensity(value:number){if(!Number.isFinite(value))return;this.intensity=THREE.MathUtils.clamp(value,0,1);for(const b of this.bindings)b.mesh.visible=b.active&&this.intensity>0;}
 dispose(){if(this.disposed)return;this.disposed=true;for(const b of this.bindings){b.mesh.onBeforeRender=()=>{};b.mesh.removeFromParent();}if(this.ownsMaterials)this.materials.dispose();this.group.removeFromParent();}
}
