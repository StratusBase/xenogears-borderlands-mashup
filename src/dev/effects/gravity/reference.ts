/** Frozen thin-strand renderer from 6f1ff2d, kept only for same-build review comparisons. */
import * as THREE from 'three';
import {GRAVITY_PROTOTYPE} from '../../../core/effects/gravity/profile';
import type {GravityEvent,GravityFields,GravityWell} from '../../../core/effects/gravity/field';
import type {ElementalAudio} from '../../../audio/elementalAudio';
import type {BallisticPresentationImpact} from '../../../rendering/PlayerBallistics';
import type {ElementModule,ElementResponse} from '../../../rendering/quality/shared/composedPresentation';
import {gravityAudioRecipe} from '../../../audio/gravityAudio';

export const GRAVITY_VFX_CAPACITY=Object.freeze({wells:3,lanes:8,segments:24,grains:144,holds:32,events:128});
type Snapshot=ReturnType<GravityFields['snapshot']>;
interface Visual {id:string;group:THREE.Group;well:GravityWell;folds:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;core:THREE.Mesh;arcs:THREE.Mesh[];mark:THREE.Mesh;fade:number;ending:boolean;bedBeat:number;pulse:number}
const Z=new THREE.Vector3(0,0,1),UP=new THREE.Vector3(0,1,0);
// Unequal solid-angle paths and timings: no radial rosette, paired spokes or leaf-shaped width envelope.
const FLOW_PATHS=[[-.92,.48,.08,.055],[.78,.12,.64,.035],[-.3,-.72,.8,.08],[.12,.85,-.5,.028],[.65,-.5,-.3,.065],[-.8,-.25,-.55,.04],[.35,.55,.75,.09],[.05,-.4,-.95,.045]] as const;
const foldVertex=`varying vec2 vUv;varying vec3 vView;void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.);vView=-p.xyz;gl_Position=projectionMatrix*p;}`;
const foldFragment=`uniform float presence,pulse;varying vec2 vUv;varying vec3 vView;void main(){float across=abs(vUv.y*2.-1.);float edge=smoothstep(.65,.98,across);float ends=smoothstep(0.,.12,vUv.x)*(1.-smoothstep(.75,1.,vUv.x));float alpha=(.32+.63*edge)*ends*presence;if(alpha<.01)discard;vec3 n=normalize(cross(dFdx(vView),dFdy(vView)));float light=dot(n,normalize(vec3(-.4,.7,.8)));vec3 c=mix(vec3(.075,.025,.14),vec3(.43,.19,.74),smoothstep(-.1,.7,light));c=mix(c,vec3(.78,.62,.98),edge*.90);c+=vec3(.20,.13,.28)*pulse*edge;gl_FragColor=vec4(c,alpha);}`;
const coreVertex=`varying vec3 vN,vV;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vV=-p.xyz;vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*p;}`;
const coreFragment=`uniform float pulse,presence;varying vec3 vN,vV;void main(){vec3 n=normalize(vN),v=normalize(vV);float rim=pow(1.-max(0.,dot(n,v)),3.5);float lit=max(0.,dot(n,normalize(vec3(-.4,.8,.9))));vec3 c=mix(vec3(.010,.006,.025),vec3(.065,.035,.12),step(.55,lit));c+=vec3(.71,.40,.98)*rim*(.75+pulse*.4);gl_FragColor=vec4(c,presence);}`;
const particleVertex=`attribute float opacity;attribute vec3 tint;varying float vA;varying vec3 vC;void main(){vA=opacity;vC=tint;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`;
const particleFragment=`varying float vA;varying vec3 vC;void main(){if(vA<.01)discard;gl_FragColor=vec4(vC,vA);}`;
function foldGeometry(){const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
 for(let lane=0;lane<GRAVITY_VFX_CAPACITY.lanes;lane++)for(let i=0;i<=GRAVITY_VFX_CAPACITY.segments;i++){positions.push(0,0,0,0,0,0);uvs.push(i/GRAVITY_VFX_CAPACITY.segments,0,i/GRAVITY_VFX_CAPACITY.segments,1);if(i<GRAVITY_VFX_CAPACITY.segments){const k=(lane*(GRAVITY_VFX_CAPACITY.segments+1)+i)*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);return g;
}
function cosmetic<T extends THREE.Object3D>(object:T):T{object.userData.presentationOnly=true;object.userData.comicOverlay=true;object.raycast=()=>{};object.frustumCulled=false;return object;}

/** Read-only rendering of authoritative fields and bodies; never applies movement or damage. */
export class GravityReferenceResponse implements ElementResponse {
 readonly group=cosmetic(new THREE.Group());readonly events:GravityEvent[]=[];
 private visuals=new Map<string,Visual>();private state:Snapshot={wells:[],members:[]};private clock=0;private disposed=false;
 private dummy=new THREE.Object3D();private grains:THREE.InstancedMesh;private holds:THREE.InstancedMesh;private alpha:THREE.InstancedBufferAttribute;private tint:THREE.InstancedBufferAttribute;
 constructor(scene:THREE.Scene,private camera:THREE.Camera,private audio:ElementalAudio){
  this.group.name='gravity-well-presentation';scene.add(this.group);
  const g=new THREE.IcosahedronGeometry(1,0);this.alpha=new THREE.InstancedBufferAttribute(new Float32Array(GRAVITY_VFX_CAPACITY.grains),1);this.tint=new THREE.InstancedBufferAttribute(new Float32Array(GRAVITY_VFX_CAPACITY.grains*3),3);g.setAttribute('opacity',this.alpha);g.setAttribute('tint',this.tint);
  this.grains=cosmetic(new THREE.InstancedMesh(g,new THREE.ShaderMaterial({vertexShader:particleVertex,fragmentShader:particleFragment,transparent:true,depthWrite:false,toneMapped:false}),GRAVITY_VFX_CAPACITY.grains));this.grains.name='gravity-inward-grit';this.grains.count=0;this.group.add(this.grains);
  this.holds=cosmetic(new THREE.InstancedMesh(new THREE.TorusGeometry(.62,.011,4,28,Math.PI*1.2),new THREE.MeshBasicMaterial({color:0xad86df,transparent:true,opacity:.38,depthWrite:false,toneMapped:false}),GRAVITY_VFX_CAPACITY.holds));this.holds.name='gravity-capture-contours';this.holds.count=0;this.group.add(this.holds);
 }
 impact(_event:BallisticPresentationImpact):void{/* The base carrier owns compact per-shot contacts; persistent wells come only from simulation state. */}
 event(event:GravityEvent):void{
  if(this.disposed)return;this.events.push(event);if(this.events.length>GRAVITY_VFX_CAPACITY.events)this.events.shift();
  const well='well'in event?event.well:undefined,distance=well?new THREE.Vector3(well.center.x,well.center.y,well.center.z).distanceTo(this.camera.getWorldPosition(new THREE.Vector3())):0;
  if(event.kind==='pulse'){this.audio.cue('gravity','impact',{splash:true,strength:.6,distance});const entry=this.visuals.get(event.well.id);if(entry)entry.pulse=1;}
  if(event.kind==='end'){this.audio.cue('gravity','release',{distance});const entry=this.visuals.get(event.well.id);if(entry)entry.ending=true;}
 }
 sync(state:Snapshot):void{
  if(this.disposed)return;this.state=state;
  const ids=new Set(state.wells.map(w=>w.id));for(const v of this.visuals.values())if(!ids.has(v.id))v.ending=true;
  for(const well of state.wells){let visual=this.visuals.get(well.id);if(!visual){if(this.visuals.size>=GRAVITY_VFX_CAPACITY.wells){const old=[...this.visuals.values()].find(v=>v.ending)??this.visuals.values().next().value!;this.remove(old);}visual=this.create(well);this.visuals.set(well.id,visual);}visual.well=well;visual.ending=false;}
  this.draw();
 }
 private create(well:GravityWell):Visual{
  const group=cosmetic(new THREE.Group());group.name=`gravity-source-${well.id}`;this.group.add(group);
  const material=new THREE.ShaderMaterial({vertexShader:foldVertex,fragmentShader:foldFragment,uniforms:{presence:{value:1},pulse:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});const folds=cosmetic(new THREE.Mesh(foldGeometry(),material));folds.name='gravity-inward-streaks';folds.renderOrder=3;group.add(folds);
  const core=cosmetic(new THREE.Mesh(new THREE.IcosahedronGeometry(GRAVITY_PROTOTYPE.coreRadius,2),new THREE.ShaderMaterial({vertexShader:coreVertex,fragmentShader:coreFragment,uniforms:{pulse:{value:0},presence:{value:1}},transparent:true,toneMapped:false})));core.name='gravity-dark-core';group.add(core);
  const arcs=[.68,1.04].map((r,i)=>{const arc=cosmetic(new THREE.Mesh(new THREE.TorusGeometry(r,i?.015:.023,4,40,Math.PI*(i?.72:1.22)),new THREE.MeshBasicMaterial({color:i?0x9c6acd:0xd8c0fa,transparent:true,opacity:.7,depthWrite:false,toneMapped:false})));arc.rotation.set(.75+i*.9,.4,.3);arc.scale.set(1,i?.67:1.12,1);group.add(arc);return arc;});
  const mark=cosmetic(new THREE.Mesh(new THREE.RingGeometry(.28,.34,40,1,0,Math.PI*1.35),new THREE.MeshBasicMaterial({color:0x8a58bb,transparent:true,opacity:.32,depthWrite:false,side:THREE.DoubleSide,toneMapped:false})));mark.name='gravity-contact-marker';this.group.add(mark);
  return{id:well.id,group,well,folds,core,arcs,mark,fade:1,ending:false,bedBeat:-1,pulse:1};
 }
 update(dt:number,_time:number):void{
  if(this.disposed||!Number.isFinite(dt)||dt<=0)return;this.clock+=dt;
  for(const v of [...this.visuals.values()]){v.pulse=Math.max(0,v.pulse-dt*7);if(v.ending){v.fade=Math.max(0,v.fade-dt*4);if(!v.fade){this.remove(v);continue;}}
   const beat=Math.floor(v.well.age/.55);if(!v.ending&&beat!==v.bedBeat){v.bedBeat=beat;this.audio.cue('gravity','status',{strength:.55,distance:v.group.position.distanceTo(this.camera.getWorldPosition(new THREE.Vector3()))});}
  }this.draw();
 }
 private draw(){
  let grainCount=0;
  for(const v of this.visuals.values()){
   const w=v.well,scale=w.radius/6,age=w.age,presence=v.fade*Math.min(1,age/.12),center=new THREE.Vector3(w.center.x,w.center.y,w.center.z),normal=new THREE.Vector3(w.normal.x,w.normal.y,w.normal.z);
   v.group.position.copy(center);v.group.scale.setScalar(scale);v.core.rotation.set(age*.2,age*.3,age*.13);v.core.scale.setScalar(1+v.pulse*.08);
   for(const mesh of [v.core,v.folds]){const m=mesh.material as THREE.ShaderMaterial;m.uniforms.presence.value=presence;m.uniforms.pulse.value=v.pulse;}
   v.arcs.forEach((arc,i)=>{arc.rotation.z=age*(i?-.8:.6);(arc.material as THREE.MeshBasicMaterial).opacity=presence*(i?.4:.75);});
   v.mark.position.set(w.point.x,w.point.y,w.point.z).addScaledVector(normal,.014);v.mark.quaternion.setFromUnitVectors(Z,normal);v.mark.scale.setScalar(scale*(.95+v.pulse*.15));(v.mark.material as THREE.MeshBasicMaterial).opacity=presence*.3;
   const positions=v.folds.geometry.attributes.position as THREE.BufferAttribute;
   for(let lane=0;lane<GRAVITY_VFX_CAPACITY.lanes;lane++){
    const path=FLOW_PATHS[lane],direction=new THREE.Vector3(path[0],path[1],path[2]).normalize();
    if(direction.dot(normal)<-.35)direction.addScaledVector(normal,-direction.dot(normal)-.35).normalize();
    const tangent=new THREE.Vector3().crossVectors(direction,UP).normalize(),progress=(age*(.46+lane*.037)+lane*.271)%1;
    const start=.04+progress*.69,end=Math.min(.99,start+.16+(lane%3)*.047),reach=3.1+(lane%3)*.41;
    const point=(q:number)=>{const r=.16+Math.pow(1-q,1.25)*reach,turn=q*(1.0+(lane%3)*.37);return direction.clone().multiplyScalar(Math.cos(turn)*r).addScaledVector(tangent,Math.sin(turn)*r).addScaledVector(UP,Math.sin(q*Math.PI+lane)*.12*(1-q));};
    for(let segment=0;segment<=GRAVITY_VFX_CAPACITY.segments;segment++){
     const u=segment/GRAVITY_VFX_CAPACITY.segments,q=start+(end-start)*u,p=point(q),next=point(Math.min(1,q+.01)),directionAt=next.sub(p).normalize(),side=new THREE.Vector3().crossVectors(directionAt,UP).normalize();if(side.lengthSq()<.01)side.set(1,0,0);side.applyAxisAngle(directionAt,.65+lane*.71+age*(lane%2?.9:-.65));
     const width=path[3]*(.75+.25*(1-q))*Math.min(1,u*9)*(1-u*.78),index=(lane*(GRAVITY_VFX_CAPACITY.segments+1)+segment)*2;
     positions.setXYZ(index,p.x-side.x*width,p.y-side.y*width,p.z-side.z*width);positions.setXYZ(index+1,p.x+side.x*width,p.y+side.y*width,p.z+side.z*width);
    }
   }positions.needsUpdate=true;
   for(let i=0;i<48&&grainCount<GRAVITY_VFX_CAPACITY.grains;i++){
    const phase=(age*(.42+(i%5)*.06)+i*.618)%1,angle=i*2.39996+age*.4,r=(1-phase)*(1.65+(i%7)*.18)+.20;
    const p=new THREE.Vector3(Math.cos(angle)*r,Math.sin(angle*1.7)*r*.46,Math.sin(angle)*r);if(p.dot(normal)<-1.05)p.addScaledVector(normal,-p.dot(normal)-1.05);
    this.dummy.position.copy(center).addScaledVector(p,scale);this.dummy.rotation.set(i+age*1.1,i*.4+age*.7,age*.8);this.dummy.scale.setScalar((i%6===0?.045:.018+(i%3)*.005)*scale);this.dummy.updateMatrix();this.grains.setMatrixAt(grainCount,this.dummy.matrix);
    this.alpha.setX(grainCount,presence*Math.sin(phase*Math.PI)*.8);const color=i%6===0?new THREE.Color(0x816953):i%4===0?new THREE.Color(0xaa84d2):new THREE.Color(0x322737);this.tint.setXYZ(grainCount,color.r,color.g,color.b);grainCount++;
   }
  }
  this.grains.count=grainCount;this.grains.instanceMatrix.needsUpdate=true;this.alpha.needsUpdate=true;this.tint.needsUpdate=true;
  let count=0;for(const member of this.state.members){if(!member.wellId||count>=GRAVITY_VFX_CAPACITY.holds)continue;this.dummy.position.set(member.position.x,member.position.y-.25,member.position.z);this.dummy.rotation.set(Math.PI/2+.15,member.slot,.1);this.dummy.scale.setScalar(member.phase==='held'?1:.6);this.dummy.updateMatrix();this.holds.setMatrixAt(count++,this.dummy.matrix);}this.holds.count=count;this.holds.instanceMatrix.needsUpdate=true;
 }
 private remove(v:Visual){v.group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});v.mark.geometry.dispose();(v.mark.material as THREE.Material).dispose();v.mark.removeFromParent();v.group.removeFromParent();this.visuals.delete(v.id);}
 get diagnostics(){return{wells:this.visuals.size,grains:this.grains.count,heldContours:this.holds.count,foldVertices:[...this.visuals.values()].reduce((sum,v)=>sum+v.folds.geometry.attributes.position.count,0)};}
 clear():void{for(const v of [...this.visuals.values()])this.remove(v);this.state={wells:[],members:[]};this.grains.count=0;this.holds.count=0;this.events.length=0;this.clock=0;}
 dispose():void{if(this.disposed)return;this.clear();for(const mesh of [this.grains,this.holds]){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();mesh.dispose();}this.group.removeFromParent();this.disposed=true;}
}
export function gravityReferenceModule(onCreate?:(response:GravityReferenceResponse)=>void):ElementModule{return{recipe:gravityAudioRecipe,create:({scene,camera,audio})=>{const response=new GravityReferenceResponse(scene,camera,audio);onCreate?.(response);return response;}};}
