import * as THREE from 'three';

export type CorrosiveSurface = 'skin' | 'cloth' | 'armor' | 'ground';
export interface CorrosiveStatusVisual {
 readonly group:THREE.Group;
 update(dt:number,time?:number):void;
 setIntensity(value:number):void;
 dispose():void;
}
const surfaces=new Set<CorrosiveSurface>(['skin','cloth','armor','ground']);
export function corrosiveSurfaceOf(object:THREE.Object3D):CorrosiveSurface|undefined {
 let surface:CorrosiveSurface|undefined;
 for(let node:THREE.Object3D|null=object;node;node=node.parent){
  if(node.userData.equipmentSlot||node.userData.visualOwner&&node.userData.visualOwner!=='body')return;
  if(!surface&&surfaces.has(node.userData.corrosiveSurface))surface=node.userData.corrosiveSurface;
 }return surface;
}
export function corrosiveSources(root:THREE.Group):THREE.Mesh[]{
 const explicit:THREE.Mesh[]=[],fallback:THREE.Mesh[]=[];
 root.traverse(object=>{
  if(!(object instanceof THREE.Mesh)||object instanceof THREE.InstancedMesh||!object.geometry.attributes.normal)return;
  for(let n:THREE.Object3D|null=object;n;n=n.parent)if(n.userData.comicOverlay||n.userData.equipmentSlot||n.userData.visualOwner&&n.userData.visualOwner!=='body')return;
  if(corrosiveSurfaceOf(object)){explicit.push(object);return;}
  const materials=Array.isArray(object.material)?object.material:[object.material];
  if(materials.some(m=>m.name==='quality-paint')&&!/optic|muzzle|light|warning/i.test(object.name))fallback.push(object);
 });return explicit.length?explicit:fallback.slice(0,6);
}
export function corrosiveTargetSpan(root?:THREE.Group):number{
 if(!root)return 2;root.updateWorldMatrix(true,true);const bounds=new THREE.Box3(),part=new THREE.Box3();
 for(const source of corrosiveSources(root))bounds.union(part.setFromBufferAttribute(source.geometry.attributes.position as THREE.BufferAttribute).applyMatrix4(source.matrixWorld));
 if(bounds.isEmpty())return 2;const size=bounds.getSize(new THREE.Vector3());return Math.max(.08,Math.min(size.x,size.y));
}
export interface CorrosiveContact {source?:THREE.Mesh;surface:CorrosiveSurface;point:THREE.Vector3;normal:THREE.Vector3}
/** Resolve presentation on the visible outer shell; the authoritative collision remains untouched. */
export function nearestCorrosiveSurface(root:THREE.Group|undefined,point:THREE.Vector3,normal=new THREE.Vector3(0,0,1)):CorrosiveContact{
 const direction=normal.clone();if(!Number.isFinite(direction.lengthSq())||direction.lengthSq()<.001)direction.set(0,1,0);direction.normalize();
 if(!root)return{surface:'ground',point:point.clone(),normal:direction};
 let source:THREE.Mesh|undefined,best=Infinity;const box=new THREE.Box3(),closest=new THREE.Vector3();
 root.updateWorldMatrix(true,true);
 const sources=corrosiveSources(root),ray=new THREE.Raycaster(point.clone().addScaledVector(direction,.75),direction.clone().negate(),0,1.5),hits:THREE.Intersection[]=[];
 for(const mesh of sources){
  // Display meshes intentionally opt out of combat raycasts. Use the stock routine only for this local VFX projection.
  THREE.Mesh.prototype.raycast.call(mesh,ray,hits);
 }
 hits.sort((a,b)=>a.distance-b.distance);
 const hit=hits.find(h=>h.point.distanceToSquared(point)<.75*.75);
 if(hit){source=hit.object as THREE.Mesh;const faceNormal=hit.face?.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(source.matrixWorld)).normalize()??direction;
  if(faceNormal.dot(direction)<0)faceNormal.negate();return{source,surface:corrosiveSurfaceOf(source)??'armor',point:hit.point.clone(),normal:faceNormal};}
 // A broad combat proxy can extend past the display silhouette. A missed projection
 // must still land on real triangles; keeping the proxy point loses small splats.
 const triangle=new THREE.Triangle();let surfacePoint=point.clone(),surfaceNormal=direction.clone();
 for(const mesh of sources){
  const positions=mesh.geometry.attributes.position,index=mesh.geometry.index;
  box.setFromBufferAttribute(positions as THREE.BufferAttribute).applyMatrix4(mesh.matrixWorld);
  if(box.clampPoint(point,closest).distanceToSquared(point)>best)continue;
  const count=index?.count??positions.count;
  for(let i=0;i+2<count;i+=3){
   triangle.a.fromBufferAttribute(positions,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);
   triangle.b.fromBufferAttribute(positions,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);
   triangle.c.fromBufferAttribute(positions,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);
   triangle.closestPointToPoint(point,closest);const distance=closest.distanceToSquared(point);
   if(distance<best){best=distance;source=mesh;surfacePoint.copy(closest);triangle.getNormal(surfaceNormal);if(surfaceNormal.dot(direction)<0)surfaceNormal.negate();}
  }
 }
 return{source,surface:source?corrosiveSurfaceOf(source)??'armor':'armor',point:surfacePoint,normal:surfaceNormal};
}
const vertex=/* glsl */`
 varying vec3 vP;varying vec3 vN;varying vec3 vView;
 void main(){vP=position;vec4 mv=modelViewMatrix*vec4(position+normal*.006,1.);vN=normalize(normalMatrix*normal);vView=-mv.xyz;gl_Position=projectionMatrix*mv;}
`;
const fragment=/* glsl */`
 uniform float time,presence,kind;uniform vec3 metric;uniform vec3 centers[4],directions[4];uniform float radii[4],ages[4],smears[4];
 varying vec3 vP;varying vec3 vN;varying vec3 vView;
 float h(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
 float n(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
 void main(){
  float noise=n(vP*16.),fine=n(vP*43.);float field=0.;
  for(int i=0;i<4;i++){
   vec3 delta=(vP-centers[i])*metric;float d=length(delta*vec3(1.,.85,1.));
   float deposit=1.-smoothstep(radii[i]*.33,radii[i],d+noise*radii[i]*.22);
   if(smears[i]>.5){
    float along=dot(delta,directions[i])/radii[i],across=length(delta-directions[i]*dot(delta,directions[i]))/radii[i];
    float head=mix(.08,.96,smoothstep(.0,.23,ages[i]));float tail=mix(.04,.64,smoothstep(.04,.30,ages[i]));
    float width=mix(.045,.42,smoothstep(.015,.32,ages[i]));
    float taper=1.-smoothstep(.12,1.,max(0.,along));
    float smear=smoothstep(-tail-.10,-tail,along)*(1.-smoothstep(head-.12,head,along));
    smear*=1.-smoothstep(width*.55,width,across/(.45+.55*taper)+noise*.04);
    deposit*=smear;
   }
   field=max(field,deposit);
  }
  float island=field*(.20+.80*noise);float wet=smoothstep(.28,.49,island);float rim=smoothstep(.20,.28,island)*(1.-smoothstep(.28,.36,island));
  float run=n(vec3(vP.x*32.,vP.y*2.+time*.20,vP.z*32.));wet=max(wet,field*smoothstep(.73,.88,run)*.74);
  if(field<.015||presence<.001)discard;
  vec3 normal=normalize(vN),view=normalize(vView);float fres=pow(1.-abs(dot(normal,view)),3.);
  vec3 halfV=normalize(normalize(vec3(-.4,.7,1.))+view);float glint=pow(max(0.,dot(normal,halfV)),85.);
  float cell=n(vP*34.);float pit=kind>1.5?smoothstep(.56,.76,cell)*wet:0.;
  vec3 c=mix(vec3(.025,.060,.001),vec3(.18,.34,.007),.3+.7*fine);
  c=mix(c,vec3(.008,.016,.001),pit*.95);c=mix(c,vec3(.51,.74,.025),rim*.90);
  c+=vec3(.25,.40,.035)*fres*.30+vec3(.86,.97,.63)*glint*.55*wet;
  float foam=pow(max(0.,sin(vP.y*95.+sin(vP.x*80.)*3.+time*3.)),24.)*smoothstep(.58,.82,fine)*field;
  c=mix(c,vec3(.69,.88,.20),foam*.45);
  float a=max(wet*(kind<.5?.52:kind<1.5?.66:.86),rim*.88)*presence;
  if(a<.018)discard;gl_FragColor=vec4(c,a);
 }
`;
interface Binding {source:THREE.Mesh;mesh:THREE.Mesh;material:THREE.ShaderMaterial;centers:THREE.Vector3[];radii:number[];ages:number[];directions:THREE.Vector3[];smears:number[];active:boolean}
/** Borrowed geometry is never displaced, recolored or disposed. No injury or destruction shader. */
export class CorrosiveStatus implements CorrosiveStatusVisual {
 readonly group=new THREE.Group();readonly bindings:Binding[]=[];
 private intensity=1;private disposed=false;private time=0;private next=0;
 constructor(readonly root:THREE.Group,private directional=false){
  this.group.name='corrosive-ab-surface-bindings';this.group.userData.comicOverlay=true;root.add(this.group);
  for(const source of corrosiveSources(root)){
   const surface=corrosiveSurfaceOf(source)??'armor',centers=Array.from({length:4},()=>new THREE.Vector3(1e4,1e4,1e4)),radii=[.001,.001,.001,.001],ages=[1,1,1,1],directions=Array.from({length:4},()=>new THREE.Vector3(1,0,0)),smears=[0,0,0,0];
   const material=new THREE.ShaderMaterial({name:`corrosive-ab-${surface}-coating`,vertexShader:vertex,fragmentShader:fragment,
    uniforms:{time:{value:0},presence:{value:1},kind:{value:surface==='skin'?0:surface==='cloth'?1:2},metric:{value:new THREE.Vector3(1,1,1)},centers:{value:centers},radii:{value:radii},ages:{value:ages},directions:{value:directions},smears:{value:smears}},
    transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
   const mesh=new THREE.Mesh(source.geometry,material);mesh.name='corrosive-ab-wet-surface';mesh.userData.comicOverlay=true;mesh.userData.presentationOnly=true;mesh.raycast=()=>{};mesh.renderOrder=2;mesh.visible=false;source.add(mesh);
   this.bindings.push({source,mesh,material,centers,radii,ages,directions,smears,active:false});
  }
 }
 contact(point:THREE.Vector3,radius=.55,source?:THREE.Mesh,direction?:THREE.Vector3):void{
  if(this.disposed||!Number.isFinite(point.lengthSq()))return;const slot=this.next++%4;this.root.updateWorldMatrix(true,true);
  for(const b of this.bindings){
   b.centers[slot].copy(point);b.source.worldToLocal(b.centers[slot]);
   b.smears[slot]=this.directional&&direction?1:0;b.ages[slot]=b.smears[slot]?0:1;
   if(direction)b.directions[slot].copy(direction).applyQuaternion(b.source.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
   const scale=b.source.getWorldScale(new THREE.Vector3()),metric=b.material.uniforms.metric.value as THREE.Vector3;metric.set(Math.abs(scale.x),Math.abs(scale.y),Math.abs(scale.z));
   const sameSurface=!source||(corrosiveSurfaceOf(source)??'armor')===(corrosiveSurfaceOf(b.source)??'armor');b.radii[slot]=sameSurface?Math.max(.002,Math.min(1.1,radius)):.00001;
   const bounds=new THREE.Box3().setFromBufferAttribute(b.source.geometry.attributes.position as THREE.BufferAttribute),closest=new THREE.Vector3(),delta=new THREE.Vector3();
   b.active=b.centers.some((center,i)=>{bounds.clampPoint(center,closest);return delta.copy(center).sub(closest).multiply(metric).lengthSq()<=b.radii[i]*b.radii[i];});b.mesh.visible=b.active&&this.intensity>0;
  }
 }
 update(dt:number,time?:number):void{if(this.disposed||!Number.isFinite(dt)||dt<=0)return;this.time=Number.isFinite(time)?time!:this.time+Math.min(.1,dt);for(const b of this.bindings){for(let i=0;i<4;i++)b.ages[i]=Math.min(1,b.ages[i]+Math.min(.1,dt));b.mesh.visible=b.active&&this.intensity>0;b.material.uniforms.time.value=this.time;b.material.uniforms.presence.value=this.intensity;}}
 setIntensity(value:number):void{if(Number.isFinite(value))this.intensity=THREE.MathUtils.clamp(value,0,1);}
 dispose():void{if(this.disposed)return;this.disposed=true;for(const b of this.bindings){b.mesh.removeFromParent();b.material.dispose();}this.group.removeFromParent();}
}
