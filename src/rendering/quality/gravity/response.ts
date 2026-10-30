import * as THREE from 'three';
import {GRAVITY_PROTOTYPE} from '../../../core/effects/gravity/profile';
import {gravityActive,type GravityEvent,type GravityFields,type GravityWell} from '../../../core/effects/gravity/field';
import type {ElementalAudio} from '../../../audio/elementalAudio';
import type {BallisticPresentationImpact} from '../../PlayerBallistics';
import type {ElementModule,ElementResponse} from '../shared/composedPresentation';
import {EffectVariationSequence} from '../shared/variation';
import {gravityAudioRecipe} from '../../../audio/gravityAudio';
import {infallDistance,flowEnvelope,pressureProfile,samplePressure,type PressureProfile} from './flow';
import {GravityLens} from './lens';

export const GRAVITY_VFX_CAPACITY=Object.freeze({wells:3,lanes:8,segments:24,grains:144,holds:32,events:128,wakes:12,history:24});
type Snapshot=ReturnType<GravityFields['snapshot']>;
export interface GravityVisualOptions {seed?:number}
export interface GravityView extends ElementResponse {setDistortionEnabled?(enabled:boolean):void;sync(state:Snapshot):void;event(event:GravityEvent):void;readonly diagnostics:Record<string,unknown>}
interface Visual {id:string;group:THREE.Group;well:GravityWell;folds:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;core:THREE.Mesh;wakes:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;profile:PressureProfile;lens:GravityLens;endAge:number;pulse:number;bedBeat:number}
const foldVertex=`attribute float visibility;varying vec3 vLocal;varying float vVisibility;varying vec2 vUv;void main(){vLocal=position;vVisibility=visibility;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const foldFragment=`uniform float presence,time,seed,wake,bodyScale;uniform int bodyCount;uniform vec3 bodies[12];varying vec3 vLocal;varying float vVisibility;varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
void main(){float x=vUv.x,y=vUv.y;float drift=sin(x*12.-time*17.+seed)*.08;float a=exp(-pow((y-.30-drift)/.11,2.)),b=exp(-pow((y-.59+drift*.6)/.16,2.)),c=exp(-pow((y-.78-drift*.4)/.07,2.));float vapor=noise(vec2(x*16.-time*9.+seed,y*8.));float ends=smoothstep(0.,.25,x)*(1.-smoothstep(.72,1.,x));float haze=exp(-pow((y-.5)/.32,2.))*.14;float density=(a*.7+b+c*.35+haze)*mix(.16,1.,vapor)*ends;
float targetClear=1.;for(int i=0;i<12;i++){if(i>=bodyCount)break;vec3 gap=(vLocal-bodies[i])*bodyScale;gap.y*=.55;targetClear=min(targetClear,smoothstep(.48,.85,length(gap)));}
vec3 color=mix(vec3(.32,.15,.59),vec3(.72,.48,1.),vapor);float alpha=presence*vVisibility*density*mix(.40,.18,wake)*mix(.08,1.,targetClear);gl_FragColor=vec4(color,alpha);}`;
const coreVertex=`varying vec3 vN,vV;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vV=-p.xyz;vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*p;}`;
const coreFragment=`uniform float presence,pulse;varying vec3 vN,vV;void main(){float facing=max(0.,dot(normalize(vN),normalize(vV)));float rim=1.-smoothstep(.015,.15,facing);float inner=(1.-smoothstep(.17,.31,facing))*(1.-rim);vec3 c=vec3(.0015,.0007,.004)+vec3(.16,.052,.26)*inner+vec3(.85,.51,1.)*rim*(.8+.2*pulse);gl_FragColor=vec4(c,presence);}`;
const particleVertex=`attribute float opacity;attribute vec3 tint;varying float vA;varying vec3 vC;void main(){vA=opacity;vC=tint;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`;
const particleFragment=`varying float vA;varying vec3 vC;void main(){if(vA<.01)discard;gl_FragColor=vec4(vC,vA);}`;
const GRIT=[new THREE.Color(0xb39a77),new THREE.Color(0x493246),new THREE.Color(0xc9a0eb)];
function geometry(lanes:number,segments:number){const positions=new Float32Array(lanes*(segments+1)*6),uv=new Float32Array(lanes*(segments+1)*4),indices:number[]=[];for(let lane=0;lane<lanes;lane++)for(let i=0;i<=segments;i++){const k=lane*(segments+1)+i;uv.set([i/segments,0,i/segments,1],k*4);if(i<segments){const v=k*2;indices.push(v,v+1,v+2,v+1,v+3,v+2);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setAttribute('visibility',new THREE.BufferAttribute(new Float32Array(positions.length/3).fill(1),1));g.setIndex(indices);return g;}
function cosmetic<T extends THREE.Object3D>(object:T):T{object.userData.presentationOnly=true;object.userData.comicOverlay=true;object.raycast=()=>{};object.frustumCulled=false;return object;}
function material(seed:number,wake=false){return new THREE.ShaderMaterial({vertexShader:foldVertex,fragmentShader:foldFragment,uniforms:{presence:{value:1},time:{value:0},pulse:{value:0},seed:{value:seed%4096},wake:{value:wake?1:0},bodyCount:{value:0},bodyScale:{value:1},bodies:{value:Array.from({length:12},()=>new THREE.Vector3())}},transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});}

/** Read-only source presentation. Placement, membership, damage, bodies and clocks remain gameplay-owned. */
export class GravityResponse implements GravityView {
 readonly group=cosmetic(new THREE.Group());readonly events:GravityEvent[]=[];
 private visuals=new Map<string,Visual>();private state:Snapshot={wells:[],members:[]};private disposed=false;private variation:EffectVariationSequence;
 private history:{id:string;seed:number;variant:number;widths:number[];lengths:number[];durations:number[];scale:number}[]=[];private updates=0;private distortionEnabled=true;
 private dummy=new THREE.Object3D();private grains:THREE.InstancedMesh;private alpha:THREE.InstancedBufferAttribute;private tint:THREE.InstancedBufferAttribute;
 private p=new THREE.Vector3();private next=new THREE.Vector3();private tangent=new THREE.Vector3();private side=new THREE.Vector3();private view=new THREE.Vector3();private cameraPosition=new THREE.Vector3();private center=new THREE.Vector3();
 constructor(private readonly scene:THREE.Scene,private camera:THREE.Camera,private audio:ElementalAudio,options:GravityVisualOptions={}){
  this.variation=new EffectVariationSequence(options.seed);this.group.name='gravity-well-presentation';scene.add(this.group);
  const g=new THREE.IcosahedronGeometry(1,0);this.alpha=new THREE.InstancedBufferAttribute(new Float32Array(GRAVITY_VFX_CAPACITY.grains),1);this.tint=new THREE.InstancedBufferAttribute(new Float32Array(GRAVITY_VFX_CAPACITY.grains*3),3);g.setAttribute('opacity',this.alpha);g.setAttribute('tint',this.tint);
  this.grains=cosmetic(new THREE.InstancedMesh(g,new THREE.ShaderMaterial({vertexShader:particleVertex,fragmentShader:particleFragment,transparent:true,depthWrite:false,toneMapped:false}),GRAVITY_VFX_CAPACITY.grains));this.grains.name='gravity-inward-grit';this.grains.count=0;this.group.add(this.grains);
 }
 setDistortionEnabled(enabled:boolean):void{if(this.disposed)return;this.distortionEnabled=enabled;this.draw();}
 impact(_event:BallisticPresentationImpact):void{/* Existing carrier presentation owns the projectile/contact. */}
 event(event:GravityEvent):void{
  if(this.disposed)return;this.events.push(event);if(this.events.length>GRAVITY_VFX_CAPACITY.events)this.events.shift();
  const well='well'in event?event.well:undefined,distance=well?this.center.set(well.center.x,well.center.y,well.center.z).distanceTo(this.camera.getWorldPosition(this.cameraPosition)):0;
  if(event.kind==='pulse'){this.audio.cue('gravity','impact',{splash:true,strength:.6,distance});const v=this.visuals.get(event.well.id);if(v)v.pulse=1;}
  if(event.kind==='end'){this.audio.cue('gravity','release',{distance});const v=this.visuals.get(event.well.id);if(v&&v.endAge<0)v.endAge=0;}
 }
 sync(state:Snapshot):void{
  if(this.disposed)return;this.state=state;const ids=new Set(state.wells.map(w=>w.id));for(const v of this.visuals.values())if(!ids.has(v.id)&&v.endAge<0)v.endAge=0;
  for(const well of state.wells){let v=this.visuals.get(well.id);if(!v){if(this.visuals.size>=GRAVITY_VFX_CAPACITY.wells)this.remove([...this.visuals.values()].find(v=>v.endAge>=0)??this.visuals.values().next().value!);v=this.create(well);this.visuals.set(well.id,v);}v.well=well;}
  // One geometry write per authoritative snapshot. update() only advances the cosmetic end envelope and audio cues.
  this.draw();
 }
 private create(well:GravityWell):Visual{
  const profile=pressureProfile(this.variation.next(4,'gravity-well'),new THREE.Vector3(well.normal.x,well.normal.y,well.normal.z),new THREE.Vector3().subVectors(well.deployment?.destination??well.center,well.point).length()/(well.radius/6));
  const group=cosmetic(new THREE.Group());group.name=`gravity-source-${well.id}`;this.group.add(group);
  const folds=cosmetic(new THREE.Mesh(geometry(GRAVITY_VFX_CAPACITY.lanes,GRAVITY_VFX_CAPACITY.segments),material(profile.seed)));folds.name='gravity-pressure-folds';folds.renderOrder=3;group.add(folds);
  const core=cosmetic(new THREE.Mesh(new THREE.IcosahedronGeometry(GRAVITY_PROTOTYPE.coreRadius,2),new THREE.ShaderMaterial({vertexShader:coreVertex,fragmentShader:coreFragment,uniforms:{presence:{value:1},pulse:{value:0}},transparent:true,toneMapped:false})));core.name='gravity-dark-core';group.add(core);
  const lens=new GravityLens(this.scene);group.add(lens.mesh);
  const wakes=cosmetic(new THREE.Mesh(geometry(GRAVITY_VFX_CAPACITY.wakes,8),material(profile.seed+719,true)));wakes.name='gravity-member-pressure';wakes.renderOrder=3;group.add(wakes);
  this.history.push({id:well.id,seed:profile.seed,variant:profile.variant,widths:profile.lanes.map(l=>l.width),lengths:profile.lanes.map(l=>l.length),durations:profile.lanes.map(l=>l.duration),scale:well.radius/6});if(this.history.length>GRAVITY_VFX_CAPACITY.history)this.history.shift();
  return{id:well.id,group,well,folds,core,wakes,profile,lens,endAge:-1,pulse:1,bedBeat:-1};
 }
 update(dt:number,_time:number):void{
  if(this.disposed||!Number.isFinite(dt)||dt<=0)return;
  for(const v of [...this.visuals.values()]){v.pulse=Math.max(0,v.pulse-dt*7);if(v.endAge>=0){v.endAge+=dt;if(v.endAge>=.45){this.remove(v);continue;}}
   const beat=Math.floor(v.well.age/.55);if(gravityActive(v.well)&&v.endAge<0&&beat!==v.bedBeat){v.bedBeat=beat;this.audio.cue('gravity','status',{strength:.55,distance:v.group.position.distanceTo(this.camera.getWorldPosition(this.cameraPosition))});}
  }
 }
 private ribbon(v:Visual){
  const positions=v.folds.geometry.attributes.position as THREE.BufferAttribute,visibility=v.folds.geometry.attributes.visibility as THREE.BufferAttribute,segments=GRAVITY_VFX_CAPACITY.segments;
  this.view.copy(this.cameraPosition).sub(v.group.position).divideScalar(v.well.radius/6);
  for(let index=0;index<v.profile.lanes.length;index++){
   const lane=v.profile.lanes[index],age=v.well.age+(v.endAge>=0?v.endAge:0),phase=(age/lane.duration+lane.offset)%1,head=infallDistance(phase)*lane.length,window=lane.window*lane.length;
   for(let segment=0;segment<=segments;segment++){
    const u=segment/segments,d=head-window*(1-u);samplePressure(lane,d,this.p);samplePressure(lane,d+.015,this.next);
    this.tangent.copy(this.next).sub(this.p).normalize();this.next.copy(this.view).sub(this.p).normalize();const projected=Math.sqrt(Math.max(0,1-Math.pow(this.tangent.dot(this.next),2)));this.side.crossVectors(this.tangent,this.next).normalize();if(this.side.lengthSq()<.01)this.side.set(1,0,0);
    const torn=1+.14*Math.sin(u*33+lane.roughness)+.08*Math.sin(u*71+lane.roughness*2),width=d<=0?0:lane.width*Math.min(1,u*7)*(1-u*.74)*torn*(v.endAge>=0?Math.max(0,1-v.endAge/.45):1),k=(index*(segments+1)+segment)*2;
    const envelope=flowEnvelope(phase,lane.duration)*Math.min(1,projected/.15);visibility.setX(k,envelope);visibility.setX(k+1,envelope);positions.setXYZ(k,this.p.x-this.side.x*width,this.p.y-this.side.y*width,this.p.z-this.side.z*width);positions.setXYZ(k+1,this.p.x+this.side.x*width*.82,this.p.y+this.side.y*width*.82,this.p.z+this.side.z*width*.82);
   }
  }positions.needsUpdate=true;visibility.needsUpdate=true;
 }
 private memberWakes(v:Visual){
  const positions=v.wakes.geometry.attributes.position as THREE.BufferAttribute,scale=v.well.radius/6;let lane=0;
  for(const m of this.state.members){if(m.wellId!==v.id||lane>=GRAVITY_VFX_CAPACITY.wakes)continue;const x=(m.position.x-v.well.center.x)/scale,y=(m.position.y-v.well.center.y)/scale,z=(m.position.z-v.well.center.z)/scale;this.p.set(x,y,z);const distance=this.p.length(),held=m.phase==='held',length=held?.45:Math.min(1.6,distance*.55);this.tangent.copy(this.p).normalize();this.next.copy(this.view).sub(this.p).normalize();const projected=Math.sqrt(Math.max(0,1-Math.pow(this.tangent.dot(this.next),2)));this.side.crossVectors(this.tangent,this.next).normalize();if(this.side.lengthSq()<.01)this.side.set(1,0,0);
   // Along the body edge, not a closed waist ring or a full core-to-body tether.
   for(let i=0;i<=8;i++){const u=i/8,offset=(1-u)*length-.12,curve=Math.sin(u*Math.PI)*.18,px=x+this.tangent.x*offset+this.side.x*(.45+curve),py=y+this.tangent.y*offset-.18,pz=z+this.tangent.z*offset+this.side.z*(.45+curve),width=Math.sin(u*Math.PI)*(held?.025:.055),k=(lane*9+i)*2;positions.setXYZ(k,px-this.side.x*width,py-this.side.y*width,pz-this.side.z*width);positions.setXYZ(k+1,px+this.side.x*width,py+this.side.y*width,pz+this.side.z*width);}lane++;
  }
  v.wakes.geometry.setDrawRange(0,lane*8*6);positions.needsUpdate=true;
 }
 private draw(){
  this.updates++;let count=0;this.camera.getWorldPosition(this.cameraPosition);
  for(const v of this.visuals.values()){
   const w=v.well,scale=w.radius/6,ending=v.endAge>=0,travel=w.deployment,elapsed=travel?travel.elapsed+w.age:w.age,presence=Math.min(1,elapsed/.05)*(ending?Math.max(0,1-v.endAge/.45):1),pressure=gravityActive(w)?Math.min(1,w.age/.16):0;
   v.group.position.set(w.center.x,w.center.y,w.center.z);v.group.scale.setScalar(scale);v.core.rotation.set(w.age*.13,w.age*.21,w.age*.07);v.core.scale.setScalar((1-v.pulse*.12)*(ending?Math.max(.02,1-v.endAge/.17):1));
   for(const mesh of [v.core,v.folds,v.wakes]){(mesh.material as THREE.ShaderMaterial).uniforms.presence.value=presence;(mesh.material as THREE.ShaderMaterial).uniforms.pulse.value=v.pulse;}
   v.folds.material.uniforms.time.value=w.age;v.wakes.material.uniforms.time.value=w.age;v.lens.sync(w,this.state.members,this.camera,this.distortionEnabled?presence:0,v.endAge);
   v.folds.material.uniforms.presence.value=presence*pressure;v.wakes.material.uniforms.presence.value=presence*pressure;
   let bodyCount=0;const bodies=v.folds.material.uniforms.bodies.value as THREE.Vector3[];for(const member of this.state.members)if(member.wellId===v.id&&bodyCount<12)bodies[bodyCount++].set((member.position.x-w.center.x)/scale,(member.position.y-w.center.y)/scale,(member.position.z-w.center.z)/scale);v.folds.material.uniforms.bodyCount.value=bodyCount;v.folds.material.uniforms.bodyScale.value=scale;
   this.ribbon(v);this.memberWakes(v);
   for(let i=0;i<48&&count<GRAVITY_VFX_CAPACITY.grains;i++){
    const lane=v.profile.lanes[i%v.profile.lanes.length],phase=(w.age/(lane.duration*1.05)+i*.618+lane.offset)%1;samplePressure(lane,infallDistance(phase)*lane.length,this.p);this.p.x+=Math.sin(i*7.3)*.09;this.p.y+=Math.cos(i*3.7)*.12;this.p.z+=Math.sin(i*2.9)*.09;if(ending){this.p.y-=v.endAge*v.endAge*3;const limit=-Math.hypot(w.center.x-w.point.x,w.center.y-w.point.y,w.center.z-w.point.z)/scale+.06,dot=this.p.x*w.normal.x+this.p.y*w.normal.y+this.p.z*w.normal.z;if(dot<limit){this.p.x+=w.normal.x*(limit-dot);this.p.y+=w.normal.y*(limit-dot);this.p.z+=w.normal.z*(limit-dot);}}
    this.dummy.position.set(w.center.x+this.p.x*scale,w.center.y+this.p.y*scale,w.center.z+this.p.z*scale);this.dummy.rotation.set(i+w.age,i*.4+w.age*.7,w.age*.8);this.dummy.scale.setScalar((i%5===0?.045:.018+(i%3)*.008)*scale);this.dummy.updateMatrix();this.grains.setMatrixAt(count,this.dummy.matrix);
    this.alpha.setX(count,presence*pressure*Math.min(1,phase*8)*(1-Math.pow(phase,6))*.95);const color=GRIT[i%5===0?0:i%4===0?2:1];this.tint.setXYZ(count,color.r,color.g,color.b);count++;
   }
  }
  this.grains.count=count;this.grains.instanceMatrix.needsUpdate=true;this.alpha.needsUpdate=true;this.tint.needsUpdate=true;
 }
 private remove(v:Visual){v.lens.dispose();v.group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});v.group.removeFromParent();this.visuals.delete(v.id);}
 get diagnostics(){return{wells:this.visuals.size,grains:this.grains.count,heldContours:0,sources:[...this.visuals.values()].map(v=>({id:v.id,center:v.group.position.toArray(),corePresence:(v.core.material as THREE.ShaderMaterial).uniforms.presence.value,pressurePresence:v.folds.material.uniforms.presence.value,lensRadius:v.lens.mesh.scale.x,lensVisible:v.lens.mesh.visible,lensReady:v.lens.mesh.material.uniforms.ready.value,coreRadius:(v.core.geometry as THREE.IcosahedronGeometry).parameters.radius*v.core.scale.x*v.well.radius/6})),foldVertices:[...this.visuals.values()].reduce((sum,v)=>sum+v.folds.geometry.attributes.position.count,0),geometryUpdates:this.updates,profiles:this.history.map(p=>({...p,widths:[...p.widths],lengths:[...p.lengths],durations:[...p.durations]}))};}
 clear():void{for(const v of [...this.visuals.values()])this.remove(v);this.state={wells:[],members:[]};this.grains.count=0;this.events.length=0;this.history.length=0;this.variation.reset();this.updates=0;}
 dispose():void{if(this.disposed)return;this.clear();this.grains.geometry.dispose();(this.grains.material as THREE.Material).dispose();this.grains.dispose();this.group.removeFromParent();this.disposed=true;}
}
export function gravityModule(onCreate?:(response:GravityResponse)=>void,options:GravityVisualOptions={}):ElementModule{return{recipe:gravityAudioRecipe,create:({scene,camera,audio})=>{const response=new GravityResponse(scene,camera,audio,options);onCreate?.(response);return response;}};}
