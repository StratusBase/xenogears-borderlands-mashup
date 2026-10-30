import * as THREE from 'three';
import {bodySurfaceSources,surfaceKindOf,type SurfaceStatusVisual} from '../shared/surfaces';
import {honeyLight,HONEY_PALETTE,type ResinMaterialStyle} from './material';

export interface ResinContact {source:THREE.Mesh;point:THREE.Vector3;normal:THREE.Vector3;radius:number;secondary:boolean}
const vertex=/* glsl */`varying vec3 vP,vN,vShadeN,vV;void main(){vP=position;vN=normal;vShadeN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position+normal*.006,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`;
const honeyVertex=/* glsl */`varying vec3 vP,vN,vShadeN,vV;varying mat3 vCoatBasis;void main(){vCoatBasis=normalMatrix;vP=position;vN=normal;vShadeN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position+normal*.006,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`;
const fragment=/* glsl */`
uniform vec3 centers[4],normals[4],metric;uniform float radii[4],ages[4],presence,skin;varying vec3 vP,vN,vShadeN,vV;
void main(){float field=0.,rim=0.;for(int i=0;i<4;i++){
 vec3 d=(vP-centers[i])*metric,n=normalize(normals[i]);vec3 right=normalize(cross(abs(n.y)<.85?vec3(0,1,0):vec3(0,0,1),n));vec3 along=cross(n,right);
 vec2 q=vec2(dot(d,right),dot(d,along))/max(.001,radii[i]);q.y+=q.x*.18;
 float shape=min(length((q-vec2(.12,-.03))*vec2(.90,1.25)),min(length((q-vec2(-.27,.10))*vec2(1.5,1.65)),length((q-vec2(.03,-.38))*vec2(2.1,1.2))));
 shape+=sin(q.x*14.+q.y*7.)*.014;float reveal=smoothstep(-.1,.1,mix(-.85,1.15,smoothstep(0.,.18,ages[i]))-q.x);
 float a=(1.-smoothstep(.74,1.,shape))*reveal*smoothstep(.06,.50,dot(normalize(vN),n));field=max(field,a);rim=max(rim,(1.-smoothstep(.035,.13,abs(shape-.82)))*a);
 }if(field<.02||presence<.005)discard;
 vec3 n=normalize(vShadeN),v=normalize(vV);float shine=pow(max(0.,dot(n,normalize(v+vec3(-.5,.8,1.)))),70.);vec3 c=mix(vec3(.19,.065,.008),vec3(.58,.24,.020),field*.70);c=mix(c,vec3(.93,.60,.14),rim*.55);c+=vec3(1.,.91,.62)*shine*.38;
 gl_FragColor=vec4(c,field*presence*(skin>.5?.35:.60));}`;

// Same footprint/reveal as the previous material. Only optical depth, opacity and virtual coat normals change.
const honeyFragment=/* glsl */`
uniform vec3 centers[4],normals[4],metric;uniform float radii[4],ages[4],presence,skin;
varying vec3 vP,vN,vShadeN,vV;varying mat3 vCoatBasis;${honeyLight}
void main(){float field=0.,opticalDepth=0.,edgeInk=0.;vec3 coatNormal=normalize(vShadeN);for(int i=0;i<4;i++){
 vec3 d=(vP-centers[i])*metric,n=normalize(normals[i]);vec3 right=normalize(cross(abs(n.y)<.85?vec3(0,1,0):vec3(0,0,1),n));vec3 along=cross(n,right);
 vec2 q=vec2(dot(d,right),dot(d,along))/max(.001,radii[i]);q.y+=q.x*.18;
 vec2 q0=q-vec2(.12,-.03),q1=q-vec2(-.27,.10),q2=q-vec2(.03,-.38);
 vec3 distances=vec3(length(q0*vec2(.90,1.25)),length(q1*vec2(1.5,1.65)),length(q2*vec2(2.1,1.2)));
 float shape=min(distances.x,min(distances.y,distances.z));
 vec2 tilt=distances.x<=distances.y&&distances.x<=distances.z?q0*vec2(.81,1.5625):distances.y<=distances.z?q1*vec2(2.25,2.7225):q2*vec2(4.41,1.44);
 shape+=sin(q.x*14.+q.y*7.)*.014;float reveal=smoothstep(-.1,.1,mix(-.85,1.15,smoothstep(0.,.18,ages[i]))-q.x);
 float a=(1.-smoothstep(.74,1.,shape))*reveal*smoothstep(.06,.50,dot(normalize(vN),n));
 if(a>field){field=a;opticalDepth=clamp(1.-pow(max(0.,shape)/.99,1.5),.06,1.);edgeInk=smoothstep(.78,.90,shape);coatNormal=normalize(vCoatBasis*(n*sqrt(max(.08,1.-shape*shape))+right*tilt.x*.55+along*tilt.y*.55));}
 }if(field<.02||presence<.005)discard;
 float depth=opticalDepth;vec3 color=honeyColor(coatNormal,normalize(vV),depth);color=mix(color,vec3(${HONEY_PALETTE.outline.join(',')}),edgeInk*.88);
 gl_FragColor=vec4(color,smoothstep(.02,.12,field)*presence*(skin>.5?.35:honeyOpacity(depth)));
}`;

/** Owns only the borrowed source's overlay material, never its geometry or original material. */
export class ResinMask {
 readonly mesh:THREE.Mesh;readonly material:THREE.ShaderMaterial;private next=0;private disposed=false;
 readonly centers=Array.from({length:4},()=>new THREE.Vector3(1e4,1e4,1e4));readonly normals=Array.from({length:4},()=>new THREE.Vector3(0,0,1));readonly radii=[.001,.001,.001,.001];readonly ages=[10,10,10,10];
 constructor(readonly source:THREE.Mesh,materialStyle:ResinMaterialStyle='honey'){
  this.material=new THREE.ShaderMaterial({name:'adhesive-source-bound-resin',vertexShader:materialStyle==='honey'?honeyVertex:vertex,fragmentShader:materialStyle==='honey'?honeyFragment:fragment,uniforms:{centers:{value:this.centers},normals:{value:this.normals},radii:{value:this.radii},ages:{value:this.ages},metric:{value:new THREE.Vector3(1,1,1)},presence:{value:1},skin:{value:surfaceKindOf(source)==='skin'?1:0}},transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  this.mesh=new THREE.Mesh(source.geometry,this.material);this.mesh.name='adhesive-local-resin-mask';this.mesh.visible=false;this.mesh.userData.comicOverlay=true;this.mesh.userData.presentationOnly=true;this.mesh.raycast=()=>{};this.mesh.renderOrder=2;source.add(this.mesh);
 }
 contact(point:THREE.Vector3,radius:number,normal:THREE.Vector3){if(this.disposed||!Number.isFinite(point.lengthSq())||!Number.isFinite(radius)||radius<=0)return;this.source.updateWorldMatrix(true,false);const slot=this.next++%4;this.centers[slot].copy(this.source.worldToLocal(point.clone()));this.normals[slot].copy(normal).applyMatrix3(new THREE.Matrix3().getNormalMatrix(this.source.matrixWorld).invert()).normalize();this.radii[slot]=Math.min(1.1,radius);this.ages[slot]=0;this.update(0,1);}
 update(dt:number,presence:number){if(this.disposed)return;for(let i=0;i<4;i++)this.ages[i]+=Math.max(0,dt);this.source.getWorldScale(this.material.uniforms.metric.value as THREE.Vector3);this.material.uniforms.presence.value=presence;this.mesh.visible=presence>0&&!!this.source.parent;}
 dispose(){if(this.disposed)return;this.disposed=true;this.mesh.removeFromParent();this.material.dispose();}
}
interface AnchoredContact {contact:ResinContact;local:THREE.Vector3;normal:THREE.Vector3}
/** Game owns status duration and expiry. This class only presents its supplied intensity. */
export class AdhesiveStatus implements SurfaceStatusVisual {
 readonly group=new THREE.Group();readonly bindings=new Map<THREE.Mesh,ResinMask>();private contacts:AnchoredContact[]=[];private intensity=1;private clock=0;private nextDrip=.65;private disposed=false;
 constructor(readonly root:THREE.Group,private drip:(contact:ResinContact,intensity:number)=>void,private released:()=>void,private materialStyle:ResinMaterialStyle='honey'){this.group.name='adhesive-tack-resin-status';this.group.userData.comicOverlay=true;this.group.userData.presentationOnly=true;root.add(this.group);}
 get presence(){return this.disposed?0:this.intensity;}
 contact(c:ResinContact){
  if(this.disposed||!bodySurfaceSources(this.root).includes(c.source))return;const kind=surfaceKindOf(c.source)??'armor';c.source.updateWorldMatrix(true,false);
  this.contacts.push({contact:c,local:c.source.worldToLocal(c.point.clone()),normal:c.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(c.source.matrixWorld).invert()).normalize()});while(this.contacts.length>3)this.contacts.shift();
  const bounds=new THREE.Box3(),close=new THREE.Vector3();let added=0;
  const sources=bodySurfaceSources(this.root).sort((a,b)=>a===c.source?-1:b===c.source?1:0);
  for(const source of sources){if((surfaceKindOf(source)??'armor')!==kind)continue;source.updateWorldMatrix(true,false);bounds.setFromBufferAttribute(source.geometry.attributes.position as THREE.BufferAttribute).applyMatrix4(source.matrixWorld);if(bounds.clampPoint(c.point,close).distanceToSquared(c.point)>c.radius*c.radius)continue;
   let mask=this.bindings.get(source);if(!mask){if(this.bindings.size>=8)continue;mask=new ResinMask(source,this.materialStyle);this.bindings.set(source,mask);}mask.contact(c.point,c.radius,c.normal);if(++added>=6)break;
  }
 }
 update(dt:number,_time?:number){if(this.disposed||!Number.isFinite(dt)||dt<=0)return;const step=Math.min(.1,dt);this.clock+=step;for(const mask of this.bindings.values())mask.update(step,this.intensity);
  if(this.clock>=this.nextDrip&&this.intensity>.05){this.nextDrip=this.clock+.9;const a=[...this.contacts].reverse().find(a=>!a.contact.secondary&&a.contact.source.parent);if(a){const source=a.contact.source;source.updateWorldMatrix(true,false);this.drip({...a.contact,point:a.local.clone().applyMatrix4(source.matrixWorld),normal:a.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(source.matrixWorld)).normalize()},this.intensity);}}
 }
 setIntensity(value:number){if(!Number.isFinite(value))return;this.intensity=THREE.MathUtils.clamp(value,0,1);for(const mask of this.bindings.values())mask.update(0,this.intensity);}
 dispose(){if(this.disposed)return;this.disposed=true;for(const mask of this.bindings.values())mask.dispose();this.bindings.clear();this.contacts=[];this.group.removeFromParent();this.released();}
}
