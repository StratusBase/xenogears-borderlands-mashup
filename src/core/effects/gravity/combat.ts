import type {WeaponSpec} from '../../arsenal';
import {GravityActivation,type GravityImpact} from './activation';
import {GravityFields,type GravityPorts,type GravityTuning} from './field';

/** Provisional production policy. Control/reach stay equal; secondary crush is weighted once. */
export const GRAVITY_COMBAT_POLICY=Object.freeze({deliveries:Object.freeze(['sticky','rocket','orb'] as const),secondaryPower:.62});
export type GravitySnapshot=ReturnType<GravityFields['snapshot']>;

/** One combat owner; rendering receives copied snapshots/events and cannot advance it. */
export class GravityCombat {
 private fields:GravityFields;
 private activation:GravityActivation;
 private attempts=0;
 private spawns=0;
 constructor(private readonly ports:GravityPorts,private readonly tuning:Partial<GravityTuning>={}){
  this.fields=new GravityFields(ports,tuning);
  this.activation=new GravityActivation(this.fields,'player',GRAVITY_COMBAT_POLICY);
 }
 qualifies(spec:Readonly<WeaponSpec>):boolean{return this.activation.qualifies(spec);}
 impact(event:Readonly<GravityImpact>):void{
  if(event.phase!=='detonate'||!this.qualifies(event.spec))return;
  this.attempts++;if(this.activation.impact(event))this.spawns++;
 }
 update(dt:number):void{this.fields.update(dt);}
 owns(id:number):boolean{return this.fields.owns(id);}
 snapshot():GravitySnapshot{return this.fields.snapshot();}
 status(id:number){
  const state=this.snapshot(),member=state.members.find(m=>m.targetId===id),well=state.wells.find(w=>w.id===member?.wellId);
  if(!member||!well)return;
  const p=member.position,c=well.center,exposure=Math.max(.2,1-Math.hypot(p.x-c.x,p.y-c.y,p.z-c.z)/well.radius);
  return{remaining:well.duration-well.age,dps:this.fields.tuning.crushDps*well.power*exposure,phase:member.phase};
 }
 drainEvents(){return this.fields.events.splice(0);}
 get diagnostics(){return{...this.snapshot(),activations:{attempts:this.attempts,spawned:this.spawns}};}
 /** Encounter teardown removes/resets bodies together. Not used for art switches or pause. */
 reset():void{
  this.fields.dispose();this.fields=new GravityFields(this.ports,this.tuning);
  this.activation=new GravityActivation(this.fields,'player',GRAVITY_COMBAT_POLICY);this.attempts=0;this.spawns=0;
 }
 dispose():void{this.fields.dispose();this.activation.clear();}
}
