import * as THREE from 'three';
import type {EquipmentAppearance} from '../../../core/appearance';
import type {EquipmentEffectPresentation} from '../../equipmentEffects';
import {createFirePlume,updateFirePlume,disposeFirePlume} from './plume';
import {FireEquipmentVent} from './equipmentVent';

export type FireEquipmentStyle='vented'|'subtle';

function isFireHardware(mesh:THREE.Mesh){
 if(mesh.userData.equipmentElementSurface!=='fire')return false;
 for(let n:THREE.Object3D|null=mesh;n;n=n.parent){if(n.userData.comicOverlay)return false;const owner=n.userData.visualOwner??n.userData.equipmentSlot;if(owner!==undefined)return owner==='weapon';}
 return false;
}
const vertex=`varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*.0007,1.);}`;
const fragment=/* glsl */`
 uniform float time,heat,seed,aligned;uniform vec3 lo,size;varying vec3 p;
 float h(vec3 q){q=fract(q*.1031);q+=dot(q,q.yxz+33.33);return fract((q.x+q.y)*q.z);}
 void main(){vec3 q=(p-lo)/size;float grain=h(floor(q*vec3(19.,13.,23.))+seed);
 float edge=1.-smoothstep(.02,.11,min(min(q.x,1.-q.x),min(q.z,1.-q.z)));
 float seam=step(.78,grain)*(.35+.65*heat);float pulse=.82+.18*sin(time*7.+q.y*9.+seed);
 float hot=max(edge*.72,seam*.62)*pulse*mix(1.,.12+.88*heat,aligned);vec3 c=mix(vec3(.055,.029,.023),vec3(.98,.14,.005),hot);c=mix(c,vec3(1.,.62,.06),hot*heat*.6);
 gl_FragColor=vec4(c,mix(.45+hot*.28,.90,aligned));}`;

/** Only authored heat-transfer bands/chambers. No receiver recolor, new muzzle, light or attachment transform. */
export class FireEquipment implements EquipmentEffectPresentation {
 readonly group=new THREE.Group();
 readonly sources:THREE.Mesh[]=[];
 private overlays:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>[]=[];
 private readonly ventCaps:THREE.Mesh[]=[];private readonly ventGeometry:THREE.BufferGeometry[]=[];
 private readonly ventMaterial=new THREE.MeshBasicMaterial({name:'fire-chamber-dark-vent-baffles',color:0x302a24,toneMapped:false});
 private flames:{mesh:ReturnType<typeof createFirePlume>;offset:number}[]=[];
 private readonly vents:FireEquipmentVent[]=[];
 private readonly barrelHeat=new Map<number,number>();
 private readonly overlayBarrels=new Map<THREE.Mesh,number>();
 private heat=0;private clock=0;private disposed=false;
 constructor(root:THREE.Object3D,readonly appearance:EquipmentAppearance,private readonly released:()=>void=()=>{},readonly style:FireEquipmentStyle='vented'){
  this.group.name='fire-hybrid-equipment';this.group.userData.comicOverlay=true;this.group.userData.presentationOnly=true;root.add(this.group);
  if(!appearance.equipped)return;
  root.traverse(o=>{if(o instanceof THREE.Mesh&&!(o instanceof THREE.InstancedMesh)&&isFireHardware(o)&&o.geometry.attributes.normal)this.sources.push(o);});
  for(const [i,source]of this.sources.entries()){
   let assembly:THREE.Object3D|null=source.parent;while(assembly&&assembly!==root&&assembly.name!=='weapon-barrel-assembly')assembly=assembly.parent;
   const socket=assembly?.name==='weapon-barrel-assembly'?assembly.getObjectsByProperty('name','weapon-muzzle').find(o=>Number.isInteger(o.userData.equipmentMuzzleIndex)):undefined;
   const barrel=socket?.userData.equipmentMuzzleIndex??-1;this.barrelHeat.set(barrel,0);
   const box=new THREE.Box3().setFromBufferAttribute(source.geometry.attributes.position as THREE.BufferAttribute),size=box.getSize(new THREE.Vector3()).max(new THREE.Vector3(.0001,.0001,.0001));
   const material=new THREE.ShaderMaterial({name:'fire-local-heat-transfer',vertexShader:vertex,fragmentShader:fragment,uniforms:{time:{value:0},heat:{value:0},aligned:{value:style==='vented'?1:0},seed:{value:i+appearance.variant*.71},lo:{value:box.min.clone()},size:{value:size}},transparent:true,depthWrite:false,depthTest:true,toneMapped:false});
   const mesh=new THREE.Mesh(source.geometry,material);mesh.name='fire-cartridge-hot-seams';mesh.userData.comicOverlay=true;mesh.userData.presentationOnly=true;mesh.raycast=()=>{};mesh.renderOrder=2;source.add(mesh);this.overlays.push(mesh);this.overlayBarrels.set(mesh,barrel);
   // Chamber vents, not the muzzle or the whole barrel. Delivery governs the amount of escaping heat.
   if(!source.name.includes('chamber'))continue;
   if(style==='vented'){if(barrel>=0)this.vents.push(new FireEquipmentVent(source,barrel,appearance.projectile??'bullet',appearance.form));continue;}
   const capGeometry=new THREE.BoxGeometry(size.x*.13,Math.max(.002,size.y*.055),size.z*.72);this.ventGeometry.push(capGeometry);
   for(const side of [-1,1]){const cap=new THREE.Mesh(capGeometry,this.ventMaterial);cap.name='fire-chamber-vent-baffle';cap.position.set(box.getCenter(new THREE.Vector3()).x+side*size.x*.40,box.max.y+.002,box.getCenter(new THREE.Vector3()).z);cap.userData.comicOverlay=true;cap.userData.presentationOnly=true;cap.raycast=()=>{};source.add(cap);this.ventCaps.push(cap);}
   for(let j=0;j<2;j++){const flame=createFirePlume(i*2.3+j*1.7+appearance.variant,j);flame.position.set(box.getCenter(new THREE.Vector3()).x+(j?1:-1)*size.x*.22,box.max.y,box.getCenter(new THREE.Vector3()).z+(j?-.22:.18)*size.z);flame.rotation.set(j?.25:-.18,0,Math.PI/2+(j?.16:-.20));source.add(flame);this.flames.push({mesh:flame,offset:j*.9+i});}
  }
  this.update(0,0);
 }
 shot(muzzleIndex?:number){this.heat=1;for(const barrel of this.barrelHeat.keys())if(muzzleIndex===undefined||barrel===muzzleIndex)this.barrelHeat.set(barrel,1);for(const vent of this.vents)if(muzzleIndex===undefined||vent.barrelIndex===muzzleIndex)vent.shot();}
 update(dt:number,time:number){if(this.disposed||!Number.isFinite(dt)||dt<0)return;this.clock=Number.isFinite(time)?time:this.clock+dt;this.heat*=Math.exp(-dt*2.4);
  for(const [barrel,heat]of this.barrelHeat)this.barrelHeat.set(barrel,heat*Math.exp(-dt*2.4));
  for(const overlay of this.overlays){overlay.material.uniforms.time.value=this.clock;overlay.material.uniforms.heat.value=this.style==='subtle'?this.heat:this.barrelHeat.get(this.overlayBarrels.get(overlay)!)??0;}
  for(const vent of this.vents)vent.update(dt,this.clock);
  const broad=['rocket','sticky','orb','cluster','homing'].includes(this.appearance.projectile??'bullet'),variant=this.appearance.visualVariant??this.appearance.variant;
  for(const {mesh,offset}of this.flames){const flicker=.85+.15*Math.sin(this.clock*11.+offset*4.);const length=(broad?.034:.020)+(broad?.095:.060)*this.heat;mesh.scale.set(length*flicker,(.014+this.heat*.021)*(offset%2?.8:1),1);mesh.material.opacity=.32+this.heat*.55;updateFirePlume(mesh,this.clock+offset,(.25+.65*this.heat));mesh.rotation.z=Math.PI/2+Math.sin(this.clock*5.+offset+variant)*.2;}
 }
 get diagnostics(){return{style:this.style,sources:this.sources.length,unmappedSources:[...this.overlayBarrels.values()].filter(index=>index<0).length,vents:this.vents.map(v=>v.diagnostics)};}
 dispose(){if(this.disposed)return;this.disposed=true;for(const mesh of this.overlays){mesh.removeFromParent();mesh.material.dispose();}for(const vent of this.vents)vent.dispose();this.vents.length=0;this.barrelHeat.clear();this.overlayBarrels.clear();for(const f of this.flames)disposeFirePlume(f.mesh);for(const cap of this.ventCaps)cap.removeFromParent();for(const geometry of this.ventGeometry)geometry.dispose();this.ventMaterial.dispose();this.ventCaps.length=0;this.ventGeometry.length=0;this.overlays=[];this.flames=[];this.group.removeFromParent();this.released();}
}
