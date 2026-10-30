import * as THREE from 'three';
import {gravityActive,type GravityWell,type GravityMember} from '../../../core/effects/gravity/field';
import {bindSceneColor,markSceneColorSurface} from '../shared/sceneColor';
import {GRAVITY_TIMING} from './timing';

/** Cosmetic envelope only. The dark core and the authoritative collision/force radius never change. */
export function lensRadius(age:number):number{const t=Math.max(0,Math.min(1,age/GRAVITY_TIMING.field.collapse));return .54+2.16*Math.pow(1-t,2);}
const vertex=`varying vec3 vWorld,vNormal,vView;void main(){vec4 world=modelMatrix*vec4(position,1.);vec4 view=viewMatrix*world;vWorld=world.xyz;vView=view.xyz;vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*view;}`;
const fragment=`uniform sampler2D sceneColor,sceneDepth;uniform vec2 resolution;uniform float ready,presence,age,nearPlane,farPlane,centerDistance,pixelRatio,projectionFactor,worldRadius,collapse;uniform vec3 contact,face;uniform mat4 inverseProjection,cameraWorld;uniform int bodyCount;uniform vec3 bodies[12];varying vec3 vWorld,vNormal,vView;
float distanceAt(float depth){return (nearPlane*farPlane)/(farPlane-(farPlane-nearPlane)*depth);}
vec3 worldAt(vec2 uv,float depth){vec4 v=inverseProjection*vec4(uv*2.-1.,depth*2.-1.,1.);v/=v.w;return (cameraWorld*v).xyz;}
float bodyClear(vec3 world){float clear=1.;for(int i=0;i<12;i++){if(i>=bodyCount)break;vec3 gap=world-bodies[i];gap.y*=.33;clear=min(clear,smoothstep(.62,1.03,length(gap)));}return clear;}
void main(){if(dot(vWorld-contact,face)<.025)discard;float facing=max(0.,dot(normalize(vNormal),normalize(-vView)));float soft= smoothstep(0.,.13,facing);float rim=exp(-pow((facing-.16)/.15,2.))*.018*(.6+.4*sin(vWorld.x*4.+vWorld.y*5.+age*12.));vec3 violet=vec3(.43,.25,.72);
 if(ready<.5){gl_FragColor=vec4(violet,rim*presence);return;}
 vec2 uv=gl_FragCoord.xy/resolution;float depth=texture2D(sceneDepth,uv).r;float frontDistance=-vView.z;float originalDistance=distanceAt(depth);float behind=smoothstep(frontDistance-.05,frontDistance+.12,originalDistance);vec3 world=worldAt(uv,depth);float clear=bodyClear(world);
 vec2 radial=normalize(vNormal.xy+vec2(.00001));vec2 turn=vec2(-radial.y,radial.x);float projectedRadius=worldRadius*projectionFactor*resolution.y/max(.1,centerDistance);float pixels=min(mix(2.,18.,pow(max(0.,1.-age/collapse),2.))*pixelRatio,projectedRadius*.16);float bend=sin(facing*3.14159)*soft*behind*clear;vec2 offset=(radial+turn*sin(age*18.+facing*7.)*.12)*pixels/resolution*bend;
 float boundary=smoothstep(0.,.015,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y)));vec2 sampleUv=clamp(uv+offset*boundary,vec2(.001),vec2(.999));float shifted=texture2D(sceneDepth,sampleUv).r;float shiftedDistance=distanceAt(shifted);float allowed=smoothstep(frontDistance-.05,frontDistance+.12,shiftedDistance)*bodyClear(worldAt(sampleUv,shifted));sampleUv=mix(uv,sampleUv,allowed);
 vec3 color=texture2D(sceneColor,sampleUv).rgb;float glow=rim*behind*clear;color=mix(color,violet,glow);gl_FragColor=vec4(color,presence*soft*behind*clear*.9);}`;

/** One mesh borrowing the compositor's existing input; no scene capture, render target or new clock. */
export class GravityLens {
 readonly mesh:THREE.Mesh<THREE.SphereGeometry,THREE.ShaderMaterial>;
 private unbind:()=>void;private disposed=false;private viewCenter=new THREE.Vector3();private selected:(GravityMember|undefined)[]=Array(12);private distances=new Float64Array(12);
 constructor(scene:THREE.Scene){
  const uniforms={sceneColor:{value:null as THREE.Texture|null},sceneDepth:{value:null as THREE.Texture|null},resolution:{value:new THREE.Vector2(1,1)},ready:{value:0},presence:{value:0},age:{value:0},collapse:{value:GRAVITY_TIMING.field.collapse},nearPlane:{value:.1},farPlane:{value:200},centerDistance:{value:1},pixelRatio:{value:1},projectionFactor:{value:1},worldRadius:{value:1},contact:{value:new THREE.Vector3()},face:{value:new THREE.Vector3(0,1,0)},inverseProjection:{value:new THREE.Matrix4()},cameraWorld:{value:new THREE.Matrix4()},bodyCount:{value:0},bodies:{value:Array.from({length:12},()=>new THREE.Vector3())}};
  this.mesh=new THREE.Mesh(new THREE.SphereGeometry(1,32,20),new THREE.ShaderMaterial({name:'GravityBackgroundLens',vertexShader:vertex,fragmentShader:fragment,uniforms,transparent:true,depthWrite:false,depthTest:true,toneMapped:false}));
  markSceneColorSurface(this.mesh);this.mesh.name='gravity-distortion-envelope';this.mesh.userData.presentationOnly=true;this.mesh.userData.comicOverlay=true;this.mesh.raycast=()=>{};this.mesh.frustumCulled=false;this.mesh.renderOrder=-10;
  this.unbind=bindSceneColor(scene,frame=>{uniforms.sceneColor.value=frame.color;uniforms.sceneDepth.value=frame.depth;uniforms.resolution.value.set(frame.width,frame.height);uniforms.pixelRatio.value=frame.pixelRatio??1;uniforms.ready.value=1;});
 }
 sync(well:Readonly<GravityWell>,members:readonly GravityMember[],camera:THREE.Camera,presence:number,endAge:number):void{
  if(this.disposed)return;const u=this.mesh.material.uniforms,perspective=camera as THREE.PerspectiveCamera;
  const settleFade=1-THREE.MathUtils.smoothstep(well.age,GRAVITY_TIMING.field.fadeStart,GRAVITY_TIMING.field.fadeEnd);this.mesh.visible=gravityActive(well)&&presence>0&&settleFade>0;this.mesh.scale.setScalar(lensRadius(well.age)*(endAge>=0?Math.max(0,1-endAge/.17):1));
  u.worldRadius.value=this.mesh.scale.x*well.radius/6;u.projectionFactor.value=camera.projectionMatrix.elements[5]*.5;
  u.presence.value=presence*settleFade*Math.min(1,well.age/.025);u.age.value=well.age;u.nearPlane.value=perspective.near??.1;u.farPlane.value=perspective.far??200;u.inverseProjection.value.copy(camera.projectionMatrixInverse);u.cameraWorld.value.copy(camera.matrixWorld);
  u.centerDistance.value=-this.viewCenter.set(well.center.x,well.center.y,well.center.z).applyMatrix4(camera.matrixWorldInverse).z;u.contact.value.set(well.point.x,well.point.y,well.point.z);u.face.value.set(well.normal.x,well.normal.y,well.normal.z);
  // Protect nearby affected bodies even when another overlapping well owns them.
  let count=0;for(const member of members){const p=member.position,d=(p.x-well.center.x)**2+(p.y-well.center.y)**2+(p.z-well.center.z)**2;if(count===12&&d>=this.distances[11])continue;let i=Math.min(count,11);while(i>0&&d<this.distances[i-1]){this.distances[i]=this.distances[i-1];this.selected[i]=this.selected[i-1];i--;}this.distances[i]=d;this.selected[i]=member;count=Math.min(12,count+1);}
  for(let i=0;i<count;i++){const p=this.selected[i]!.position;u.bodies.value[i].set(p.x,p.y,p.z);}u.bodyCount.value=count;
 }
 dispose():void{if(this.disposed)return;this.disposed=true;this.unbind();this.mesh.geometry.dispose();this.mesh.material.dispose();this.mesh.removeFromParent();}
}
