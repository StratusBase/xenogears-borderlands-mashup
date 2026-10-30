import * as THREE from 'three';
import type { WeaponSpec } from '../../../core/arsenal';
import type { BallisticPresentationImpact, BallisticPresentationSplash } from '../../PlayerBallistics';
import { nearestVisibleSurface,targetSurfaceSpan,type SurfaceKind } from '../shared/surfaces';
import { surfaceContactFrame } from '../shared/contactFrame';
import { LightningSegments,lightningPathPoint,lightningNoise,createLightningCorona,animateLightningCorona } from './lightning';
import { ShockSurface } from './surface';
import { shockSizing,type ShockSize,type ShockRole } from './sizing';
import { ShockSegments,shockPathPoint,createShockFan,animateShockFan } from './paths';

export interface ShockChainEvent {start:THREE.Vector3;end:THREE.Vector3;target:THREE.Group;spec:Readonly<WeaponSpec>;energy:number;exposure:number}
interface Contact {point:THREE.Vector3;normal:THREE.Vector3;radius:number;source?:THREE.Mesh;seed:number;secondary:boolean}
interface Bolt {active:boolean;age:number;size:ShockSize;seed:number;point:THREE.Vector3;frame:THREE.Quaternion;fan:ReturnType<typeof createShockFan>;connection?:{start:THREE.Vector3;end:THREE.Vector3}}
export const SHOCK_CAPACITY=Object.freeze({bolts:12,segments:1600,worldSurfaces:16,contactsPerTarget:3,eventHistory:192});
export interface ShockEvent {role:ShockRole;phase:'contact'|'detonate';point:number[];surface:SurfaceKind;source?:string;size:ShockSize;energy?:number;exposure:number}
/** A+B read-only response. C is strictly gated by the existing event's explosive energy/phase. */
export class ShockResponse{
 readonly group=new THREE.Group();readonly events:ShockEvent[]=[];readonly segments:ShockSegments|LightningSegments;
 private bolts:Bolt[]=[];private next=0;private secondaryNext=0;private serial=0;private disposed=false;
 private contacts=new WeakMap<THREE.Group,Contact[]>();private statuses=new Map<THREE.Group,ShockSurface>();
 private worlds=new Map<THREE.Mesh,{visual:ShockSurface;root:THREE.Group;age:number}>();
 private a=new THREE.Vector3();private b=new THREE.Vector3();private p=new THREE.Vector3();private localA=new THREE.Vector3();private localB=new THREE.Vector3();private branchDelta=new THREE.Vector3();
 constructor(scene:THREE.Scene,private camera:THREE.Camera,readonly profile:'prototype'|'lightning'='lightning'){
  this.segments=profile==='prototype'?new ShockSegments(SHOCK_CAPACITY.segments):new LightningSegments(SHOCK_CAPACITY.segments);
  this.group.name='shock-ab-response';this.group.userData.comicOverlay=true;this.group.userData.presentationOnly=true;scene.add(this.group);this.group.add(this.segments.group);
  for(let i=0;i<SHOCK_CAPACITY.bolts;i++){const fan=profile==='prototype'?createShockFan():createLightningCorona();this.group.add(fan);this.bolts.push({active:false,age:1,size:shockSizing({projectile:'bullet',phase:'contact',radius:.3}),seed:0,point:new THREE.Vector3(),frame:new THREE.Quaternion(),fan});}
 }
 impact(event:BallisticPresentationImpact):SurfaceKind{return this.present(event,event.phase==='detonate'?'detonation':'direct');}
 private slot(secondary:boolean):Bolt{return this.bolts[secondary?4+this.secondaryNext++%(this.bolts.length-4):this.next++%4];}
 splash(event:BallisticPresentationSplash):SurfaceKind|undefined{if(event.primary)return;return this.present(event,'splash');}
 private present(event:BallisticPresentationImpact,role:ShockRole):SurfaceKind{
  if(this.disposed||!Number.isFinite(event.point.lengthSq()))return'ground';
  const contact=nearestVisibleSurface(event.target,event.point,event.normal),normal=contact.normal.clone().normalize(),seed=(this.serial++%97)*.731;
  const size=shockSizing({projectile:event.spec.projectile,phase:event.phase,radius:event.radius,energy:event.energy,exposure:event.exposure,channelWeight:event.spec.element==='shock'?1:.62,targetSpan:targetSurfaceSpan(event.target),role});
  if(size.strength<=0)return contact.surface;
  const secondary=role==='splash'||role==='chain';
  // The approved boards have a long dominant primary leader and torso-scale charge.
  // Only cosmetic primary coverage grows; existing secondary energy/size curves stay exact.
  if(this.profile==='lightning'&&!secondary){size.reach*=size.heavy?1.30:1.48;size.patch=Math.min(targetSurfaceSpan(event.target)*.55,size.patch*1.6);}
  const bolt=this.slot(secondary);bolt.active=true;bolt.age=0;bolt.size=size;bolt.seed=seed;bolt.point.copy(contact.point).addScaledVector(normal,.014);bolt.frame.copy(surfaceContactFrame(normal,contact.point,seed,this.camera).rotation);bolt.connection=undefined;bolt.fan.visible=this.profile==='lightning'||size.heavy;bolt.fan.position.copy(bolt.point);bolt.fan.quaternion.copy(bolt.frame);
  this.animateFlash(bolt);
  this.events.push({role,phase:event.phase,point:contact.point.toArray(),surface:contact.surface,source:contact.source?.name??event.hitSurface?.name,size:{...size},energy:event.energy,exposure:event.exposure??1});if(this.events.length>SHOCK_CAPACITY.eventHistory)this.events.shift();
  const deposit:Contact={point:contact.point.clone(),normal,radius:size.patch,source:contact.source,seed,secondary};
  if(event.target&&contact.source){
   const list=this.contacts.get(event.target)??[];list.push(deposit);const direct=list.filter(c=>!c.secondary).slice(-2),indirect=list.filter(c=>c.secondary).slice(-1);this.contacts.set(event.target,[...direct,...indirect]);
   this.statuses.get(event.target)?.contact(deposit.point,normal,size.patch,contact.source,seed,secondary);
  }else if(event.hitSurface instanceof THREE.Mesh){
   const source=event.hitSurface;let world=this.worlds.get(source);
   if(!world){
    if(this.worlds.size>=SHOCK_CAPACITY.worldSurfaces){const[first]=this.worlds;first[1].visual.dispose();first[1].root.removeFromParent();this.worlds.delete(first[0]);}
    const root=new THREE.Group();root.name='shock-world-charge-owner';this.group.add(root);world={visual:new ShockSurface(root,[source],this.profile),root,age:0};this.worlds.set(source,world);
   }
   world.age=0;world.visual.setIntensity(1);world.visual.contact(contact.point,normal,size.patch,source,seed);
  }
  this.draw();return contact.surface;
 }
 /** Called only for the confirmed existing chain. No queries or damage occur in this method. */
 chain(event:ShockChainEvent):void{
  if(this.disposed||!Number.isFinite(event.start.lengthSq())||!Number.isFinite(event.end.lengthSq()))return;
  const normal=event.start.clone().sub(event.end).normalize(),contact=nearestVisibleSurface(event.target,event.end,normal);
  this.present({point:event.end,normal,spec:event.spec,phase:'contact',radius:.15,target:event.target,energy:event.energy,exposure:event.exposure},'chain');
  const bolt=this.slot(true);bolt.active=true;bolt.age=0;bolt.seed=this.serial*.7;bolt.size=shockSizing({projectile:event.spec.projectile,phase:'contact',radius:.1,energy:event.energy,exposure:event.exposure,role:'chain'});bolt.size.paths=1;bolt.size.life=.13;bolt.connection={start:event.start.clone(),end:contact.point.clone().addScaledVector(contact.normal,.014)};bolt.fan.visible=false;
 }
 status(root:THREE.Group):ShockSurface{
  const old=this.statuses.get(root);if(old)return old;const visual=new ShockSurface(root,undefined,this.profile);
  for(const c of this.contacts.get(root)??[])visual.contact(c.point,c.normal,c.radius,c.source,c.seed,c.secondary);
  const dispose=visual.dispose.bind(visual);visual.dispose=()=>{dispose();this.statuses.delete(root);};this.statuses.set(root,visual);return visual;
 }
 update(dt:number):void{
  if(this.disposed||!Number.isFinite(dt)||dt<=0)return;const step=Math.min(.1,dt);
  for(const bolt of this.bolts)if(bolt.active){bolt.age+=step;if(bolt.age>=bolt.size.life){bolt.active=false;bolt.fan.visible=false;}}
  for(const[source,world]of this.worlds){world.age+=step;if(world.age>=1.3||!source.parent){world.visual.dispose();world.root.removeFromParent();this.worlds.delete(source);}else{world.visual.update(step);world.visual.setIntensity(Math.min(1,(1.3-world.age)*4));}}
  this.draw();
 }
 private animateFlash(bolt:Bolt):void{
  if(this.profile==='prototype'){if(bolt.size.heavy)animateShockFan(bolt.fan,bolt.age,bolt.seed,bolt.size.reach);}
  else animateLightningCorona(bolt.fan,bolt.age,bolt.seed,bolt.size.reach,bolt.size.heavy);
 }
 private drawLightning(bolt:Bolt,alpha:number):void{
  const {size,seed,age}=bolt,secondary=size.reach<.3;
  const pulse=.70+.30*Math.sin(age*85+seed)**2;
  const place=(out:THREE.Vector3,p:THREE.Vector3)=>out.copy(p).applyQuaternion(bolt.frame).add(bolt.point);
  for(let lane=0;lane<size.paths;lane++){
   const count=secondary?8:16;lightningPathPoint(this.localA,lane,0,age,seed,size.reach,size.width);
   for(let i=1;i<=count;i++){
    const q=i/count;lightningPathPoint(this.localB,lane,q,age,seed,size.reach,size.width);
    place(this.a,this.localA);place(this.b,this.localB);
    const taper=.40+.60*(1-q)**.75;
    this.segments.add(this.a,this.b,size.width*(lane===0?1.12:.44)*taper,alpha*pulse);this.localA.copy(this.localB);
   }
   if(secondary)continue;
   // Parent-attached irregular forks: secondary VFX never inherit these large branches.
   for(let fork=0;fork<(lane===0?3:2);fork++){
    const rootQ=.24+fork*.21;lightningPathPoint(this.p,lane,rootQ,age,seed,size.reach,size.width);this.localA.copy(this.p);
    const angle=lane*.91+fork*1.87+seed*.23,extent=size.reach*(.16+.04*fork)*(lane===0?1:.65),head=THREE.MathUtils.smoothstep(age,.018+rootQ*.02,.060+rootQ*.02);
    for(let i=1;i<=6;i++){
     const q=Math.min(i/6,head),kink=lightningNoise(q,seed+fork*71+lane,Math.floor(age*25))*extent;
     this.localB.copy(this.p).add(this.branchDelta.set(Math.cos(angle)*extent*q-Math.sin(angle)*kink,Math.sin(angle)*extent*q+Math.cos(angle)*kink,q*extent*.18));
     place(this.a,this.localA);place(this.b,this.localB);this.segments.add(this.a,this.b,size.width*.22*(1-.8*q),alpha*pulse*.8);this.localA.copy(this.localB);
    }
   }
  }
  for(let i=0;i<size.sparks;i++){
   const angle=i*2.399+seed,t=age*2.2,q=.10+(i%7)*.065;
   this.localA.set(Math.cos(angle)*(q+t*.55)*size.reach,Math.sin(angle)*(q+t*.55)*size.reach*.75,.06+size.width*3+age*size.reach*.6);
   this.localB.copy(this.localA).add(this.branchDelta.set(Math.cos(angle),Math.sin(angle),.25).multiplyScalar(size.reach*(.016+.025*(i%3))));
   place(this.a,this.localA);place(this.b,this.localB);this.segments.add(this.a,this.b,size.width*.15,alpha*.8);
  }
 }
 private draw():void{
  this.segments.begin();
  for(const bolt of this.bolts){if(!bolt.active)continue;const{age,size,seed}=bolt,alpha=1-THREE.MathUtils.smoothstep(age,size.life*.35,size.life);
   if(bolt.connection){
    const {start,end}=bolt.connection;this.a.copy(start);
    for(let i=1;i<=10;i++){const q=i/10;this.b.copy(start).lerp(end,q);this.b.y+=Math.sin(i*2.4+seed+Math.floor(age*40))*.025*Math.sin(q*Math.PI);this.segments.add(this.a,this.b,size.width*.60,alpha*.72);this.a.copy(this.b);}continue;
   }
   this.animateFlash(bolt);if(this.profile==='lightning'){this.drawLightning(bolt,alpha);continue;}
   for(let lane=0;lane<size.paths;lane++){
    shockPathPoint(this.a,lane,0,age,seed,size.reach,size.width).applyQuaternion(bolt.frame).add(bolt.point);
    for(let i=1;i<=9;i++){shockPathPoint(this.b,lane,i/9,age,seed,size.reach,size.width).applyQuaternion(bolt.frame).add(bolt.point);this.segments.add(this.a,this.b,size.width*(1-.60*i/9)*(lane===0?1:.62),alpha);this.a.copy(this.b);}
   }
   for(let i=0;i<size.sparks;i++){
    const angle=i*2.399+seed,q=.25+(i%7)/10,t=age*2.7;
    this.a.set(Math.cos(angle)*(q+t)*size.reach*.65,Math.sin(angle)*(q+t)*size.reach*.50,.08+size.width*3+Math.abs(Math.sin(angle))*t*.25);
    this.b.copy(this.a).add(new THREE.Vector3(Math.cos(angle)*.045,Math.sin(angle)*.045,.025));this.a.applyQuaternion(bolt.frame).add(bolt.point);this.b.applyQuaternion(bolt.frame).add(bolt.point);this.segments.add(this.a,this.b,size.width*.28,alpha*.70);
   }
  }
  this.segments.upload();
 }
 get diagnostics(){return{bolts:this.bolts.filter(b=>b.active).length,heavyFans:this.bolts.filter(b=>b.active&&b.size.heavy).length,segments:this.segments.activeCount,statuses:this.statuses.size,worldSurfaces:this.worlds.size};}
 clear():void{for(const bolt of this.bolts){bolt.active=false;bolt.fan.visible=false;}for(const visual of[...this.statuses.values()])visual.dispose();for(const world of this.worlds.values()){world.visual.dispose();world.root.removeFromParent();}this.worlds.clear();this.contacts=new WeakMap();this.next=0;this.secondaryNext=0;this.serial=0;this.events.length=0;this.segments.begin();this.segments.upload();}
 dispose():void{if(this.disposed)return;this.clear();this.disposed=true;this.segments.dispose();for(const bolt of this.bolts){bolt.fan.geometry.dispose();bolt.fan.material.dispose();}this.group.removeFromParent();}
}
