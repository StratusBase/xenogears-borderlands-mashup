import * as THREE from 'three';
import type {Mode} from '../../../core/index';
import type {ElementalAudio} from '../../../audio/elementalAudio';
import type {BallisticPresentationImpact} from '../../PlayerBallistics';
import {EffectVariationSequence} from '../shared/variation';
import {nearestVisibleSurface} from '../shared/surfaces';
import {surfaceContactFrame} from '../shared/contactFrame';
import {gravityCoreMaterial} from './coreMaterial';
import {isGravitySpike} from './spikeFlight';
import {gravityVapor,gravityCosmetic} from './vapor';
import {GRAVITY_TIMING} from './timing';
import {GravitySpikeStatus,type SpikeContact} from './spikeStatus';

const CAPACITY=24,LIFETIME=GRAVITY_TIMING.spike.contactLifetime;
interface Wisp {mesh:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;from:THREE.Vector3;size:number;delay:number;duration:number;roll:number}
interface Puncture {group:THREE.Group;core:THREE.Mesh<THREE.IcosahedronGeometry,THREE.ShaderMaterial>;wisps:Wisp[];age:number;radius:number;weight:number;attached:boolean;seed:number}
/** Fleeting pressure punctures, never a force source, proc or full damaging well. */
export class GravitySpikeImpacts {
 private contacts=new WeakMap<THREE.Group,SpikeContact>();
 private impacts:Puncture[]=[];private variation:EffectVariationSequence;private history:{seed:number;radius:number;secondary:boolean;normal:number[];surface:string}[]=[];private disposed=false;
 private cameraPosition=new THREE.Vector3();private cameraRotation=new THREE.Quaternion();private ownerRotation=new THREE.Quaternion();
 constructor(private scene:THREE.Scene,private camera:THREE.Camera,private audio:ElementalAudio,seed?:number){this.variation=new EffectVariationSequence(seed);}
 impact(event:BallisticPresentationImpact,mode:Mode):void{
  if(this.disposed)return;if(event.target&&!isGravitySpike(event.spec))this.contacts.delete(event.target);if(!isGravitySpike(event.spec))return;
  const contact=nearestVisibleSurface(event.target,event.point,event.normal),choice=this.variation.next(5,'spike-contact'),secondary=event.spec.element!=='gravity',weight=secondary?.62:1,radius=choice.range(1,.095,.125)*(secondary?.68:1),group=gravityCosmetic(new THREE.Group());group.name='gravity-spike-pressure-puncture';group.position.copy(contact.point).addScaledVector(contact.normal,radius*.95+.018);group.quaternion.copy(surfaceContactFrame(contact.normal,contact.point,choice.seed,this.camera).rotation);this.scene.add(group);
  // Borrow only the pose of the visible armor/cloth source, never its buffers or material.
  const source=contact.source;source?.attach(group);if(event.target)this.contacts.set(event.target,{source:source??event.target,point:(source??event.target).worldToLocal(group.getWorldPosition(new THREE.Vector3())),normal:contact.normal.clone().transformDirection(new THREE.Matrix4().copy((source??event.target).matrixWorld).invert()),seed:choice.seed,weight});
  const core=gravityCosmetic(new THREE.Mesh(new THREE.IcosahedronGeometry(radius,2),gravityCoreMaterial(.7)));core.material.depthWrite=false;core.name='gravity-spike-contact-core';group.add(core);
  const wisps:Wisp[]=[];for(let i=0;i<3+choice.variant%2;i++){
   const angle=choice.range(10+i,0,Math.PI*2),reach=choice.range(20+i,.38,.75)*(secondary?.68:1),from=new THREE.Vector3(Math.cos(angle)*reach,Math.sin(angle)*reach*choice.range(30+i,.45,.9),choice.range(40+i,.08,.24)),mesh=gravityCosmetic(new THREE.Mesh(new THREE.PlaneGeometry(1,1),gravityVapor(choice.seed+i*97)));
   mesh.name='gravity-spike-inward-vapor';group.add(mesh);wisps.push({mesh,from,size:choice.range(50+i,.14,.22)*(secondary?.68:1),delay:choice.range(60+i,0,.055),duration:choice.range(70+i,GRAVITY_TIMING.spike.wispMin,GRAVITY_TIMING.spike.wispMax),roll:angle+choice.range(80+i,-.7,.7)});
  }
  const v:Puncture={group,core,wisps,age:0,radius,weight,attached:!!source,seed:choice.seed};this.impacts.push(v);while(this.impacts.length>CAPACITY)this.remove(this.impacts[0]);this.draw(v);
  this.history.push({seed:choice.seed,radius,secondary,normal:contact.normal.toArray(),surface:contact.surface});if(this.history.length>32)this.history.shift();
  this.audio.impact('gravity',{mode,delivery:event.spec.projectile,distance:event.point.distanceTo(this.camera.getWorldPosition(this.cameraPosition)),strength:event.stage==='bomblet'?.55:event.phase==='detonate'?1:.72});
 }
 update(dt:number):void{if(this.disposed||!Number.isFinite(dt)||dt<=0)return;for(const v of [...this.impacts]){v.age+=dt;let ancestor:THREE.Object3D|null=v.group;while(ancestor?.parent)ancestor=ancestor.parent;if(v.age>=LIFETIME||v.attached&&ancestor!==this.scene){this.remove(v);continue;}this.draw(v);}}
 status(root:THREE.Group){return new GravitySpikeStatus(root,this.camera,()=>this.contacts.get(root));}
 private draw(v:Puncture){
  const corePresence=Math.min(1,v.age/.035)*(1-THREE.MathUtils.smoothstep(v.age,GRAVITY_TIMING.spike.coreFadeStart,GRAVITY_TIMING.spike.coreFadeEnd));v.core.material.uniforms.presence.value=corePresence*v.weight;v.core.scale.setScalar(1-.50*THREE.MathUtils.smoothstep(v.age,.08,GRAVITY_TIMING.spike.coreFadeEnd));
  this.camera.getWorldQuaternion(this.cameraRotation);v.group.getWorldQuaternion(this.ownerRotation).invert();
  for(const w of v.wisps){const t=THREE.MathUtils.clamp((v.age-w.delay)/w.duration,0,1),distance=Math.pow(1-t,1.65);w.mesh.position.copy(w.from).multiplyScalar(distance);w.mesh.position.z+=v.radius*.14;const size=w.size*(.75+.25*(1-t));w.mesh.position.z=Math.max(w.mesh.position.z,size*.92-v.radius*.95); w.mesh.quaternion.copy(this.ownerRotation).multiply(this.cameraRotation);const towards=w.mesh.position.clone().negate().applyQuaternion(w.mesh.quaternion.clone().invert());w.mesh.rotateZ(Math.atan2(-towards.x,towards.y));w.mesh.scale.set(size,size*1.5,1);w.mesh.material.opacity=Math.sin(t*Math.PI)*1.05*v.weight;w.mesh.material.uniforms.time.value=v.age;}
 }
 private remove(v:Puncture){v.group.removeFromParent();v.group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});this.impacts.splice(this.impacts.indexOf(v),1);}
 get diagnostics(){return{active:this.impacts.length,capacity:CAPACITY,history:this.history.map(p=>({...p,normal:[...p.normal]}))};}
 clear(){for(const v of [...this.impacts])this.remove(v);this.history.length=0;this.contacts=new WeakMap();this.variation.reset();}
 dispose(){if(this.disposed)return;this.clear();this.disposed=true;}
}
