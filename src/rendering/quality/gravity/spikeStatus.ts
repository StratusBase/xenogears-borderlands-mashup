import * as THREE from 'three';
import {ElementalStatus} from '../elementalSurfaces';
import type {SurfaceStatusVisual} from '../shared/surfaces';
import {gravityCosmetic,gravityVapor} from './vapor';
import {cosmeticSample} from '../shared/variation';
import {GRAVITY_TIMING} from './timing';

export interface SpikeContact {source:THREE.Object3D;point:THREE.Vector3;normal:THREE.Vector3;seed:number;weight:number}
/** Existing authoritative status controls duration/intensity. Latest contact picks
 * only its visual style; a non-spike hit restores the exact legacy response. */
export class GravitySpikeStatus implements SurfaceStatusVisual {
 readonly group=gravityCosmetic(new THREE.Group());
 private legacy?:ElementalStatus;private wisps:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>[]=[];private intensity=1;private disposed=false;private elapsed=0;
 private rotation=new THREE.Quaternion();private origin=new THREE.Vector3();private normal=new THREE.Vector3();
 constructor(private root:THREE.Group,private camera:THREE.Camera,private contact:()=>SpikeContact|undefined){this.group.name='gravity-control-status';root.add(this.group);this.update(0,0);}
 setIntensity(value:number){this.intensity=THREE.MathUtils.clamp(value,0,1);this.legacy?.setIntensity(value);}
 update(dt:number,time?:number){
  if(this.disposed||!Number.isFinite(dt)||dt<0)return;this.elapsed+=dt;const contact=this.contact();
  if(!contact){for(const w of this.wisps)w.visible=false;if(!this.legacy)this.legacy=new ElementalStatus(this.root,'gravity');this.legacy.setIntensity(this.intensity);this.legacy.update(dt,time);return;}
  if(this.legacy){this.legacy.dispose();this.legacy=undefined;}
  if(!this.wisps.length)for(let i=0;i<3;i++){const mesh=gravityCosmetic(new THREE.Mesh(new THREE.PlaneGeometry(1,1),gravityVapor(contact.seed+i*83)));mesh.name='gravity-control-inward-haze';this.wisps.push(mesh);this.group.add(mesh);}
  contact.source.updateWorldMatrix(true,false);this.group.updateWorldMatrix(true,false);this.origin.copy(contact.point).applyMatrix4(contact.source.matrixWorld);this.normal.copy(contact.normal).transformDirection(contact.source.matrixWorld);this.camera.getWorldQuaternion(this.rotation);
  const inverse=this.group.getWorldQuaternion(new THREE.Quaternion()).invert();this.rotation.premultiply(inverse);
  const tangent=new THREE.Vector3().crossVectors(this.normal,Math.abs(this.normal.y)>.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0)).normalize(),along=new THREE.Vector3().crossVectors(this.normal,tangent).normalize();
  for(let i=0;i<this.wisps.length;i++){
   const w=this.wisps[i],seed=contact.seed+i*83,t=(this.elapsed/GRAVITY_TIMING.spike.statusCycle+cosmeticSample(seed,1))%1,angle=cosmeticSample(seed,2)*Math.PI*2,distance=.30*Math.pow(1-t,1.5),position=this.origin.clone().addScaledVector(tangent,Math.cos(angle)*distance).addScaledVector(along,Math.sin(angle)*distance*.65).addScaledVector(this.normal,.18);
   this.group.worldToLocal(position);w.position.copy(position);w.quaternion.copy(this.rotation);const toward=this.group.worldToLocal(this.origin.clone()).sub(w.position).applyQuaternion(w.quaternion.clone().invert());w.rotateZ(Math.atan2(-toward.x,toward.y));w.scale.set(.18,.27,1);w.visible=true;w.material.opacity=Math.sin(t*Math.PI)*.4*this.intensity*contact.weight;w.material.uniforms.time.value=this.elapsed;
  }
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.legacy?.dispose();for(const w of this.wisps){w.geometry.dispose();w.material.dispose();}this.wisps.length=0;this.group.removeFromParent();}
}
