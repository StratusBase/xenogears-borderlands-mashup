import * as THREE from 'three';
import type {EquipmentAppearance} from '../../../core/appearance';
import type {EquipmentEffectPresentation} from '../../equipmentEffects';
import {addBox,createQualityMaterial,mergeStaticMeshes} from '../primitives';
import {EffectVariationSequence} from '../shared/variation';
import {gravityCoreMaterial} from './coreMaterial';
import {GRAVITY_TIMING} from './timing';

interface Device {owner:THREE.Object3D;index:number;group:THREE.Group;core:THREE.Mesh<THREE.IcosahedronGeometry,THREE.ShaderMaterial>;wisps:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;radius:number;shotAt:number;kickGain:number;events:EffectVariationSequence;delivery:string}
interface Binding {source:THREE.Mesh;material:THREE.Material|THREE.Material[]}
function weaponOwned(object:THREE.Object3D){for(let n:THREE.Object3D|null=object;n;n=n.parent){if(n.userData.comicOverlay||n.userData.presentationOnly)return false;const owner=n.userData.visualOwner??n.userData.equipmentSlot;if(owner!==undefined)return owner==='weapon';}return false;}
function relative(object:THREE.Object3D,ancestor:THREE.Object3D){const pose=new THREE.Matrix4(),local=new THREE.Matrix4();for(let n:THREE.Object3D|null=object;n&&n!==ancestor;n=n.parent)pose.premultiply(n.matrixAutoUpdate?local.compose(n.position,n.quaternion,n.scale):n.matrix);return pose;}
function cosmetic<T extends THREE.Object3D>(o:T){o.userData.presentationOnly=true;o.userData.comicOverlay=true;o.raycast=()=>{};return o;}
function wispGeometry(){const p:number[]=[],uv:number[]=[],indices:number[]=[];for(let lane=0;lane<7;lane++)for(let i=0;i<=10;i++){const k=p.length/3;p.push(i/10,-1,lane,i/10,1,lane);uv.push(i/10,0,i/10,1);if(i<10)indices.push(k,k+1,k+2,k+1,k+3,k+2);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.boundingSphere=new THREE.Sphere(new THREE.Vector3(),9);return g;}
function wispMaterial(weight:number){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
 uniforms:{cycleRange:{value:new THREE.Vector2(GRAVITY_TIMING.equipment.cycleMin,GRAVITY_TIMING.equipment.cycleMax)},textureRate:{value:GRAVITY_TIMING.equipment.textureRate},time:{value:0},kick:{value:0},seed:{value:1},weight:{value:weight},idle:{value:weight===1?1:0}},
 vertexShader:`uniform float time,kick,seed,idle;uniform vec2 cycleRange;varying vec2 vUv;varying float vAlpha;float h(float p){return fract(sin(p*127.1+seed)*43758.5453);}void main(){float lane=position.z,u=position.x;float duration=mix(cycleRange.x,cycleRange.y,h(lane+1.)),clock=time/duration+h(lane+4.);float phase=fract(clock),epoch=floor(clock);float track=lane*71.+epoch*19.;float distance=clamp((.55*phase+.45*phase*phase)-(1.-u)*.38,0.,1.);float remaining=1.-distance;float angle=h(track+10.)*6.28318,tilt=mix(.25,1.40,h(track+20.)),reach=mix(5.5,8.0,h(track+30.));vec3 start=vec3(cos(angle)*sin(tilt),sin(angle)*sin(tilt),cos(tilt))*reach;vec3 p=start*remaining;p.xy+=vec2(-sin(angle),cos(angle))*sin(remaining*2.8+h(track+40.))*remaining*.06;p.z+=.28;vec4 view=modelViewMatrix*vec4(p,1.);vec2 tangent=normalize((modelViewMatrix*vec4(start,0.)).xy+vec2(.0001));float width=.35*(1.-u*.65)*length(modelViewMatrix[0].xyz);view.xy+=vec2(-tangent.y,tangent.x)*position.y*width;vUv=uv;vAlpha=smoothstep(0.,.16,phase)*(1.-smoothstep(.68,1.,phase))*(.50*idle+1.60*kick)*step(.001,distance)*step(h(track+50.),.62);gl_Position=projectionMatrix*view;}`,
 fragmentShader:`uniform float time,seed,weight,textureRate;varying vec2 vUv;varying float vAlpha;void main(){float x=vUv.x,y=vUv.y;float soft=exp(-pow((y-.5)/.23,2.));float vapor=.55+.24*sin(x*19.-time*textureRate+seed)*sin(y*7.+seed);float ends=smoothstep(0.,.40,x)*(1.-smoothstep(.55,1.,x));gl_FragColor=vec4(mix(vec3(.32,.15,.59),vec3(.63,.39,.88),vapor),soft*vapor*ends*vAlpha*weight);}`
});}

/** Installed containment cells on the existing moving barrel. All source parts are borrowed intact. */
export class GravityEquipment implements EquipmentEffectPresentation {
 readonly devices:Device[]=[];readonly bindings:Binding[]=[];readonly weight:number;
 private materials=new Set<THREE.Material>();private geometries=new Set<THREE.BufferGeometry>();private disposed=false;private time=0;
 constructor(readonly root:THREE.Object3D,readonly appearance:EquipmentAppearance,private released:()=>void=()=>{}){
  this.weight=appearance.element==='gravity'?1:.62;
  if(!appearance.equipped||appearance.slot!=='weapon'||!(appearance.element==='gravity'||appearance.secondaryElement==='gravity'))return;
  const assemblies=new Map<THREE.Object3D,THREE.Mesh[]>(),muzzles:THREE.Object3D[]=[];
  root.traverse(o=>{if(o.name==='weapon-muzzle'&&weaponOwned(o))muzzles.push(o);if(!(o instanceof THREE.Mesh)||o.userData.equipmentElementSurface!=='gravity'||!weaponOwned(o))return;let owner=o.parent;while(owner&&owner!==root&&owner.name!=='weapon-barrel-assembly')owner=owner.parent;if(owner?.name!=='weapon-barrel-assembly')return;const parts=assemblies.get(owner)??[];parts.push(o);assemblies.set(owner,parts);});
  const substrate=createQualityMaterial(0x292435,'metal'),hardware=createQualityMaterial(0x77717e,'metal');this.materials.add(substrate);this.materials.add(hardware);
  for(const [owner,sources]of assemblies){
   const sockets:THREE.Object3D[]=[];owner.traverse(o=>{if(o.name==='weapon-muzzle'&&weaponOwned(o))sockets.push(o);});if(sockets.length!==1)continue;const socket=sockets[0],tag=socket.userData.equipmentMuzzleIndex,index=Number.isInteger(tag)&&tag>=0?tag:muzzles.indexOf(socket);if(index<0)continue;const delivery=String(socket?.userData.equipmentProjectile??appearance.projectile??'bullet');
   for(const source of sources){this.bindings.push({source,material:source.material});source.material=substrate;}
   const chamber=sources.find(s=>s.name.startsWith('element-chamber'))??sources[0],chamberBox=new THREE.Box3().setFromBufferAttribute(chamber.geometry.attributes.position as THREE.BufferAttribute).applyMatrix4(relative(chamber,owner)),center=chamberBox.getCenter(new THREE.Vector3());
   // Sample the real barrel cross-section at the chamber, including wide/rotary bores.
   // Retain every original part: put the new cell outside enclosing geometry instead of painting inside it.
   const section=new THREE.Box3();owner.traverse(o=>{if(!(o instanceof THREE.Mesh)||!weaponOwned(o)||o.userData.equipmentElementSurface)return;const b=new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position as THREE.BufferAttribute).applyMatrix4(relative(o,owner));if(b.min.z<=center.z&&b.max.z>=center.z)section.union(b);});
   if(section.isEmpty())section.copy(chamberBox);
   const heavy=['sticky','rocket','homing','cluster'].includes(delivery),energy=['orb','beam','arc'].includes(delivery),unit=THREE.MathUtils.clamp((section.max.y-section.min.y)*.14,.045,.065),radius=unit*(heavy?1.14:energy?1.23:.85)*.65*(this.weight<1?.70:1),assemblyX=relative(owner,root).elements[12],side=muzzles.length>1?(assemblyX<0?1:-1):-1;
   const group=cosmetic(new THREE.Group());group.name='gravity-contained-equipment-core';group.position.set(side*(Math.max(Math.abs(section.min.x),Math.abs(section.max.x))+radius*.55),section.max.y-radius*.10,center.z+radius*.35);const normal=new THREE.Vector3(side*.65,.55,.50).normalize(),along=new THREE.Vector3(0,0,-1),right=new THREE.Vector3().crossVectors(along,normal).normalize();along.crossVectors(normal,right).normalize();group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,along,normal));owner.add(group);
   const cage=cosmetic(new THREE.Group());group.add(cage);
   // A recessed port and axial cradle make the core a contained chamber, not a free-floating well.
   addBox(cage,'gravity-chamber-cradle',[radius*2.8,radius*4.2,radius*.8],[0,0,-radius*.65],hardware,radius*.18);
   const lip=new THREE.Mesh(new THREE.RingGeometry(radius*.72,radius*1.34,16),hardware);lip.name='gravity-recessed-port';lip.position.z=radius*.48;cage.add(lip);
   addBox(cage,'gravity-cell-feed-spine',[radius*.48,radius*(heavy?2.4:energy?.9:1.6),radius*.30],[0,-radius*(heavy?2.9:2.3),-radius*.65],hardware,radius*.06);
   mergeStaticMeshes(cage);cage.traverse(o=>{cosmetic(o);if(o instanceof THREE.Mesh){this.geometries.add(o.geometry);o.castShadow=false;}});
   const material=gravityCoreMaterial(.45),geometry=new THREE.IcosahedronGeometry(radius,2),core=cosmetic(new THREE.Mesh(geometry,material));core.name='gravity-equipment-dark-core';core.position.z=-radius*.10;core.renderOrder=1;group.add(core);this.materials.add(material);this.geometries.add(geometry);
   const wisps=cosmetic(new THREE.Mesh(wispGeometry(),wispMaterial(this.weight)));wisps.name='gravity-equipment-inward-wisps';wisps.scale.setScalar(radius);wisps.renderOrder=2;wisps.frustumCulled=false;group.add(wisps);this.materials.add(wisps.material);this.geometries.add(wisps.geometry);
   const events=new EffectVariationSequence(((appearance.visualVariant??appearance.variant)+1)*104729+index*7919),profile=events.next(4,'equipment');wisps.material.uniforms.seed.value=profile.seed%4096;
   this.devices.push({owner,index,group,core,wisps,radius,shotAt:-100,kickGain:1,events,delivery});
  }
 }
 shot(muzzleIndex?:number){if(this.disposed||muzzleIndex===undefined&&this.devices.length>1)return;for(const d of this.devices){if(muzzleIndex!==undefined&&d.index!==muzzleIndex)continue;d.shotAt=this.time;d.kickGain=d.events.next(4,'equipment').range(1,.86,1);}}
 update(dt:number,time:number){if(this.disposed||!Number.isFinite(time)||!Number.isFinite(dt)||dt<0)return;if(time<this.time)this.reset();this.time=time;for(const d of this.devices){const pulse=Math.exp(-Math.max(0,time-d.shotAt)*GRAVITY_TIMING.equipment.kickDecay)*d.kickGain;d.core.scale.setScalar(1-pulse*.12*this.weight);d.core.material.uniforms.pulse.value=pulse*this.weight;d.wisps.material.uniforms.kick.value=pulse;d.wisps.material.uniforms.time.value=time;}}

 get diagnostics(){return{devices:this.devices.length,weight:this.weight,cells:this.devices.map(d=>({index:d.index,delivery:d.delivery,radius:d.radius,pulse:d.core.material.uniforms.pulse.value,seed:d.wisps.material.uniforms.seed.value,world:d.group.getWorldPosition(new THREE.Vector3()).toArray()}))};}
 reset(){for(const d of this.devices){d.shotAt=-100;d.wisps.material.uniforms.kick.value=0;}}
 dispose(){if(this.disposed)return;this.disposed=true;for(const b of this.bindings)if(this.materials.has(b.source.material as THREE.Material))b.source.material=b.material;for(const d of this.devices)d.group.removeFromParent();this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.devices.length=0;this.bindings.length=0;this.released();}
}
