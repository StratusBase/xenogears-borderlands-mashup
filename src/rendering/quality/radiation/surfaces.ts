import * as THREE from 'three';
import {bodySurfaceSources,surfaceKindOf,type SurfaceStatusVisual} from '../shared/surfaces';
import {sampleSurfaceRoot,sampleSurfaceSource} from '../surfacePoseCache';

const vertex=/* glsl */`uniform mat3 worldNormalMatrix;varying vec3 vWorld,vNormal,vLocal;void main(){vec4 p=modelMatrix*vec4(position+normal*.0035,1.);vWorld=p.xyz;vLocal=position;vNormal=normalize(worldNormalMatrix*normal);gl_Position=projectionMatrix*viewMatrix*p;}`;
const fragment=/* glsl */`
uniform vec4 patches[4];uniform vec3 directions[4];uniform float ages[4],presence,kind,time;varying vec3 vWorld,vNormal,vLocal;
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
void main(){float field=0.,grain=0.,hot=0.;
 for(int i=0;i<4;i++){
  vec3 n=normalize(directions[i]),delta=vWorld-patches[i].xyz;float r=max(.001,patches[i].w);vec3 tangent=delta-n*dot(delta,n);
  float edge=length(tangent)/r;float coarse=hash(floor(vLocal*31.+float(i)*7.));float footprint=(1.-smoothstep(.30,.98,edge+(coarse-.5)*.20))*smoothstep(.10,.70,dot(normalize(vNormal),n));
  vec3 cell=floor(vLocal*(kind<1.5?40.:45.)+float(i)*13.);
  float reveal=smoothstep(0.,.10,ages[i])*(1.-smoothstep(2.4,4.8,ages[i]));float speck=(kind<.5?0.:1.)*step(kind<1.5?.940:.970,hash(cell));
  float blink=pow(.5+.5*sin(time*9.+hash(cell)*36.),16.);
  field=max(field,footprint*reveal);grain=max(grain,footprint*speck*reveal);hot=max(hot,footprint*speck*blink*reveal);
 }
 float alpha=presence*(field*(kind<.5?.025:kind<1.5?.10:.075)+grain*.65+hot*.30);if(alpha<.012)discard;
 vec3 base=kind>1.5?vec3(.96,.73,.035):vec3(1.10,.88,.12);vec3 color=mix(base,vec3(1.65,1.35,.37),smoothstep(.20,.80,hot));gl_FragColor=vec4(color,min(.70,alpha));}`;

interface Patch {local:THREE.Vector3;normal:THREE.Vector3;radius:number;age:number}
interface Binding {source:THREE.Mesh;mesh:THREE.Mesh;material:THREE.ShaderMaterial;patches:Patch[];world:THREE.Vector4[];directions:THREE.Vector3[];ages:number[];next:number}
/** Localized fluorescent residue. Geometry is borrowed; only owned meshes/materials are disposed. */
export class RadiationResidue implements SurfaceStatusVisual {
 readonly group=new THREE.Group();readonly bindings:Binding[]=[];private intensity=1;private time=0;private disposed=false;
 constructor(readonly root:THREE.Object3D,private onDispose?:()=>void){this.group.name='radiation-local-fallout';this.group.userData.comicOverlay=true;this.group.userData.presentationOnly=true;root.add(this.group);}
 contact(point:THREE.Vector3,radius:number,source:THREE.Mesh,normal:THREE.Vector3,expand=true){
  if(this.disposed||radius<=0||!Number.isFinite(point.lengthSq())||!source.parent)return;
  let binding=this.bindings.find(b=>b.source===source);
  if(!binding){
   if(this.bindings.length>=4){if(!expand)return;const old=this.bindings.reduce((a,b)=>Math.min(...a.patches.map(p=>p.age))>Math.min(...b.patches.map(p=>p.age))?a:b);old.mesh.removeFromParent();old.material.dispose();this.bindings.splice(this.bindings.indexOf(old),1);}
   const world=Array.from({length:4},()=>new THREE.Vector4(1e5,1e5,1e5,.001)),directions=Array.from({length:4},()=>new THREE.Vector3(0,0,1)),ages=[0,0,0,0],surface=surfaceKindOf(source),kind=surface==='skin'?0:surface==='cloth'?1:2;
   const material=new THREE.ShaderMaterial({name:`radiation-fluorescence-${surface??'ground'}`,uniforms:{patches:{value:world},directions:{value:directions},ages:{value:ages},presence:{value:this.intensity},kind:{value:kind},time:{value:0},worldNormalMatrix:{value:new THREE.Matrix3()}},vertexShader:vertex,fragmentShader:fragment,transparent:true,depthTest:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,toneMapped:false});
   const mesh=new THREE.Mesh(source.geometry,material);mesh.name='radiation-borrowed-surface';mesh.matrixAutoUpdate=false;mesh.raycast=()=>{};mesh.userData.comicOverlay=true;mesh.userData.presentationOnly=true;mesh.renderOrder=3;this.group.add(mesh);
   binding={source,mesh,material,patches:[],world,directions,ages,next:0};this.bindings.push(binding);
  }
  const pose=sampleSurfaceSource(source),inverse=pose.matrixWorld.clone().invert(),local=point.clone().applyMatrix4(inverse),localNormal=normal.clone().applyMatrix3(pose.normalMatrix.clone().invert()).normalize();
  const patch={local,normal:localNormal,radius:Math.max(.008,Math.min(1,radius)),age:0};binding.patches[binding.next++%4]=patch;this.update(0);
  // Thin ribs/pockets must not confine the entire mark to their narrow geometry.
  // Spread only across nearby visible meshes of the SAME material class; depth still comes from the real source surfaces.
  if(expand&&this.root instanceof THREE.Group){const kind=surfaceKindOf(source),box=new THREE.Box3(),near=bodySurfaceSources(this.root).filter(s=>s!==source&&surfaceKindOf(s)===kind).map(s=>({source:s,distance:box.setFromBufferAttribute(s.geometry.attributes.position as THREE.BufferAttribute).applyMatrix4(sampleSurfaceSource(s).matrixWorld).distanceToPoint(point)})).filter(p=>p.distance<radius).sort((a,b)=>a.distance-b.distance);for(const p of near.slice(0,3))this.contact(point,radius,p.source,normal,false);}

 }
 seed(){
  if(this.bindings.length)return;const sources=bodySurfaceSources(this.root as THREE.Group),source=sources.find(s=>/breastplate|shirt-torso|torso/.test(s.name))??sources[0];if(!source)return;
  const pose=sampleSurfaceSource(source),box=new THREE.Box3().setFromBufferAttribute(source.geometry.attributes.position as THREE.BufferAttribute),at=box.getCenter(new THREE.Vector3());at.z=box.max.z;
  this.contact(at.applyMatrix4(pose.matrixWorld),.09,source,new THREE.Vector3(0,0,1).applyMatrix3(pose.normalMatrix).normalize());
 }
 setIntensity(value:number){if(Number.isFinite(value))this.intensity=THREE.MathUtils.clamp(value,0,1);for(const b of this.bindings)b.material.uniforms.presence.value=this.intensity;}
 update(dt:number){
  if(this.disposed||!Number.isFinite(dt)||dt<0)return;this.time+=Math.min(.1,dt);const rootPose=sampleSurfaceRoot(this.root);
  for(const b of this.bindings){
   b.mesh.visible=!!b.source.parent&&b.source.visible;if(!b.mesh.visible)continue;const pose=sampleSurfaceSource(b.source);b.mesh.matrix.multiplyMatrices(rootPose.inverseMatrixWorld,pose.matrixWorld);b.mesh.matrixWorldNeedsUpdate=true;
   for(let i=0;i<b.patches.length;i++){const p=b.patches[i];p.age+=Math.min(.1,dt);const point=p.local.clone().applyMatrix4(pose.matrixWorld);b.world[i].set(point.x,point.y,point.z,p.radius);b.directions[i].copy(p.normal).applyMatrix3(pose.normalMatrix).normalize();b.ages[i]=p.age;}
   b.material.uniforms.worldNormalMatrix.value.copy(pose.normalMatrix);b.material.uniforms.time.value=this.time;b.material.uniforms.presence.value=this.intensity;
  }
 }
 dispose(){if(this.disposed)return;this.disposed=true;for(const b of this.bindings){b.mesh.removeFromParent();b.material.dispose();}this.bindings.length=0;this.group.removeFromParent();this.onDispose?.();}
}
