import {copyVector,distance3,finiteVector,type EffectVector,type EffectBody,type EffectId} from '../contracts';
import {GRAVITY_PROTOTYPE} from './profile';

export interface GravityTarget extends EffectBody {id:number;position:EffectVector;alive:boolean}
export interface GravitySource {id:EffectId;ownerId:EffectId;point:EffectVector;normal:EffectVector;power?:number;scale?:number}
export interface GravityWell {id:EffectId;ownerId:EffectId;point:EffectVector;center:EffectVector;normal:EffectVector;radius:number;captureRadius:number;duration:number;age:number;power:number}
export interface GravityMember {targetId:number;wellId:EffectId|null;position:EffectVector;velocity:EffectVector;phase:'pull'|'held'|'fall';slot:number}
export type GravityEvent={kind:'spawn'|'pulse'|'end';well:GravityWell}|{kind:'capture'|'release';targetId:number;wellId:EffectId};
export interface GravityPorts {
 targets():readonly GravityTarget[];
 /** Must sweep the authoritative body and return its actual collision-resolved center. */
 move(target:GravityTarget,desired:EffectVector):EffectVector;
 visible(center:EffectVector,target:GravityTarget):boolean;
 clearCenter(center:EffectVector,radius:number):boolean;
 /** Optional world adapter for collision-valid capture poses above raised support. Never moves the body. */
 capturePosition?(desired:EffectVector,target:GravityTarget,well:Readonly<GravityWell>):EffectVector;
 damage(targetId:number,amount:number,source:Readonly<GravityWell>):void;
 event?(event:GravityEvent):void;
}
export interface GravityTuning {radius:number;duration:number;clearance:number;coreRadius:number;captureRadius:number;acceleration:number;maxSpeed:number;response:number;crushDps:number;tickInterval:number;maxFields:number;maxTargets:number;maxMembers:number;maxEvents:number;fallAcceleration:number;maxFallSpeed:number}
const cloneWell=(w:GravityWell):GravityWell=>({...w,point:copyVector(w.point),center:copyVector(w.center),normal:copyVector(w.normal)});
/** Authoritative deterministic well system. Renderer-independent and updated once per simulation tick. */
export class GravityFields {
 private wells=new Map<EffectId,GravityWell>();private members=new Map<number,GravityMember>();private pulses=new Map<EffectId,number>();private disposed=false;
 readonly events:GravityEvent[]=[];readonly tuning:Readonly<GravityTuning>;
 constructor(private ports:GravityPorts,tuning:Partial<GravityTuning>={}){
  const next={...GRAVITY_PROTOTYPE,...tuning};for(const [key,value]of Object.entries(next))if(!Number.isFinite(value)||value<=0)throw new Error(`Invalid gravity tuning: ${key}`);
  if(next.maxFields>8||next.maxTargets>128||next.maxMembers>32)throw new Error('Gravity capacity exceeds the prototype safety budget');
  for(const key of ['maxFields','maxTargets','maxMembers','maxEvents']as const)if(!Number.isSafeInteger(next[key]))throw new Error(`Gravity capacity must be an integer: ${key}`);
  if(next.tickInterval<1/120)throw new Error('Crush cadence exceeds the simulation tick budget');
  this.tuning=Object.freeze(next);
 }
 spawn(source:GravitySource):GravityWell|undefined{
  if(this.disposed||!source.id||!source.ownerId||!finiteVector(source.point)||!finiteVector(source.normal)||this.wells.has(source.id))return;
  const length=Math.hypot(source.normal.x,source.normal.y,source.normal.z);if(!Number.isFinite(length)||length<1e-6||source.power!==undefined&&(!Number.isFinite(source.power)||source.power<=0))return;
  const scale=Math.max(.55,Math.min(1.5,Number.isFinite(source.scale)?source.scale!:1)),normal={x:source.normal.x/length,y:source.normal.y/length,z:source.normal.z/length};
  let center:EffectVector|undefined;
  // Clearance is deliberate and collision-checked; never offset just the visible art.
  for(const multiplier of [1,1.25,1.5]){const d=this.tuning.clearance*scale*multiplier,candidate={x:source.point.x+normal.x*d,y:source.point.y+normal.y*d,z:source.point.z+normal.z*d};if(this.ports.clearCenter(candidate,this.tuning.coreRadius*scale)){center=candidate;break;}}
  if(!center)return;
  if(this.wells.size>=this.tuning.maxFields)this.end(this.wells.keys().next().value!);
  const well:GravityWell={id:source.id,ownerId:source.ownerId,point:copyVector(source.point),center,normal,radius:this.tuning.radius*scale,captureRadius:this.tuning.captureRadius*scale,duration:this.tuning.duration,age:0,power:Math.min(4,source.power??1)};
  this.wells.set(well.id,well);this.pulses.set(well.id,this.tuning.tickInterval);this.emit({kind:'spawn',well:cloneWell(well)});return cloneWell(well);
 }
 update(dt:number,paused=false):void{
  if(this.disposed||paused||!Number.isFinite(dt)||dt<=0)return;if(dt>.25)throw new Error('Gravity delta must be <= .25 seconds');
  const count=Math.ceil(dt*120),step=dt/count;for(let i=0;i<count;i++)this.advance(step);
 }
 private advance(dt:number){
  for(const well of [...this.wells.values()]){well.age+=dt;if(well.age>=well.duration-1e-8)this.end(well.id);}
  const seen=new Set<number>(),targets=[...this.ports.targets()].filter(t=>{if(!t.alive||!Number.isSafeInteger(t.id)||seen.has(t.id)||!finiteVector(t.position)||!Number.isFinite(t.radius)||!Number.isFinite(t.halfHeight)||t.radius<=0||t.halfHeight<=0)return false;seen.add(t.id);return true;}).sort((a,b)=>a.id-b.id).slice(0,this.tuning.maxTargets),valid=new Set(targets.map(t=>t.id));
  for(const id of this.members.keys())if(!valid.has(id))this.members.delete(id);
  for(const target of targets){
   let member=this.members.get(target.id),well=member?.wellId?this.wells.get(member.wellId):undefined;
   if(well&&(distance3(target.position,well.center)>well.radius+.1||!this.ports.visible(well.center,target))){this.release(member!);well=undefined;}
   if(!well){
    const counts=new Map<EffectId,number>();for(const m of this.members.values())if(m.wellId)counts.set(m.wellId,(counts.get(m.wellId)??0)+1);
    well=[...this.wells.values()].filter(w=>distance3(target.position,w.center)<=w.radius&&this.ports.visible(w.center,target)&&(counts.get(w.id)??0)<this.tuning.maxMembers).sort((a,b)=>distance3(target.position,a.center)/a.radius-distance3(target.position,b.center)/b.radius)[0];
    if(well){const used=new Set([...this.members.values()].filter(m=>m.wellId===well!.id).map(m=>m.slot));let slot=0;while(used.has(slot))slot++;
     member={targetId:target.id,wellId:well.id,position:copyVector(target.position),velocity:member?copyVector(member.velocity):{x:0,y:0,z:0},phase:'pull',slot};this.members.set(target.id,member);
    }
   }
   if(!member)continue;
   if(well){
    const desiredGoal=this.capturePoint(well,member.slot,target),goal=this.ports.capturePosition?.(desiredGoal,target,well)??desiredGoal;
    if(!finiteVector(goal))throw new Error('Gravity capture port returned a non-finite position');
    const delta={x:goal.x-target.position.x,y:goal.y-target.position.y,z:goal.z-target.position.z},distance=Math.hypot(delta.x,delta.y,delta.z);
    const speed=Math.min(this.tuning.maxSpeed,distance*this.tuning.response),factor=distance>1e-8?speed/distance:0,desired={x:delta.x*factor,y:delta.y*factor,z:delta.z*factor};
    const diff={x:desired.x-member.velocity.x,y:desired.y-member.velocity.y,z:desired.z-member.velocity.z},change=Math.hypot(diff.x,diff.y,diff.z),weight=change>0?Math.min(1,this.tuning.acceleration*dt/change):0;
    member.velocity.x+=diff.x*weight;member.velocity.y+=diff.y*weight;member.velocity.z+=diff.z*weight;
    const actual=this.move(target,member,dt);const held=distance3(actual,goal)<.18;
    if(held&&member.phase!=='held')this.emit({kind:'capture',targetId:target.id,wellId:well.id});member.phase=held?'held':'pull';
   }else{
    member.phase='fall';member.velocity.y=Math.max(-this.tuning.maxFallSpeed,member.velocity.y-this.tuning.fallAcceleration*dt);member.velocity.x*=Math.exp(-dt*7);member.velocity.z*=Math.exp(-dt*7);
    const old=target.position,descending=member.velocity.y<0,actual=this.move(target,member,dt);
    // A ceiling can stop upward release velocity; it must not be mistaken for landing.
    if(descending&&Math.abs(actual.y-old.y)<1e-7||actual.y<=target.halfHeight+.0002)this.members.delete(target.id);
   }
  }
  for(const well of this.wells.values()){
   let next=this.pulses.get(well.id)!;
   while(well.age+1e-8>=next){
    for(const member of this.members.values())if(member.wellId===well.id){const target=targets.find(t=>t.id===member.targetId);if(target&&this.ports.visible(well.center,{...target,position:member.position})){
     const exposure=Math.max(.2,1-distance3(member.position,well.center)/well.radius);this.ports.damage(target.id,this.tuning.crushDps*this.tuning.tickInterval*well.power*exposure,cloneWell(well));
    }}
    this.emit({kind:'pulse',well:cloneWell(well)});next+=this.tuning.tickInterval;
   }this.pulses.set(well.id,next);
  }
 }
 private move(target:GravityTarget,member:GravityMember,dt:number){
  const requested={x:target.position.x+member.velocity.x*dt,y:target.position.y+member.velocity.y*dt,z:target.position.z+member.velocity.z*dt},actual=this.ports.move(target,requested);
  if(!finiteVector(actual))throw new Error('Gravity collision port returned a non-finite position');
  for(const axis of ['x','y','z']as const)if(Math.abs(actual[axis]-requested[axis])>1e-6)member.velocity[axis]=0;
  member.position=copyVector(actual);return actual;
 }
 capturePoint(well:Readonly<GravityWell>,slot:number,body:EffectBody):EffectVector{
  const angle=(slot%6)*Math.PI/3,ring=Math.max(well.captureRadius,body.radius*2+.15),layer=Math.floor(slot/6);
  // Bodies hang below the mass center, leaving the core and heads readable. Ground contact clamps the low-well case.
  return{x:well.center.x+Math.cos(angle+layer*.45)*ring,y:Math.max(body.halfHeight,well.center.y-body.halfHeight*1.25+(layer?body.halfHeight*2+.15:0)),z:well.center.z+Math.sin(angle+layer*.45)*ring};
 }
 private release(member:GravityMember){if(member.wellId)this.emit({kind:'release',targetId:member.targetId,wellId:member.wellId});member.wellId=null;member.phase='fall';}
 end(id:EffectId):void{const well=this.wells.get(id);if(!well)return;this.wells.delete(id);this.pulses.delete(id);for(const m of this.members.values())if(m.wellId===id)this.release(m);this.emit({kind:'end',well:cloneWell(well)});}
 private emit(event:GravityEvent){this.events.push(event);if(this.events.length>this.tuning.maxEvents)this.events.shift();this.ports.event?.(event);}
 owns(targetId:number):boolean{return this.members.has(targetId);}
 snapshot(){return{wells:[...this.wells.values()].map(cloneWell),members:[...this.members.values()].map(m=>({...m,position:copyVector(m.position),velocity:copyVector(m.velocity)}))};}
 /** Stop sources while allowing existing bodies to finish their collision-aware fall. */
 clear():void{for(const id of [...this.wells.keys()])this.end(id);this.events.length=0;}
 /** Encounter teardown only: the host removes/resets target bodies in the same lifecycle. */
 dispose():void{if(this.disposed)return;this.clear();this.members.clear();this.disposed=true;}
}
