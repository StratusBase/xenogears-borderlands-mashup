import type {WeaponSpec,ProjectileType} from '../../arsenal';
import {getWeaponElements} from '../../arsenal';
import type {EffectVector} from '../contracts';
import type {GravityFields} from './field';

export interface GravityImpact {
 projectileId:number;phase:'contact'|'detonate';point:EffectVector;normal:EffectVector;spec:Readonly<WeaponSpec>;energy:number;radius:number;
}
export interface GravityActivationPolicy {deliveries?:readonly ProjectileType[];secondaryPower?:number}
/** First prototype: one well per gravity blast detonation; automatic bullets do not carpet the world in wells. */
export class GravityActivation {
 private seen=new Set<number>();
 constructor(private fields:GravityFields,private ownerId='pilot',private policy:GravityActivationPolicy={}){}
 qualifies(spec:Readonly<WeaponSpec>):boolean{return getWeaponElements(spec).includes('gravity')&&spec.blastRadius>0&&(!this.policy.deliveries||this.policy.deliveries.includes(spec.projectile));}
 impact(event:Readonly<GravityImpact>):boolean{
  if(event.phase!=='detonate'||!this.qualifies(event.spec)||this.seen.has(event.projectileId))return false;
  this.seen.add(event.projectileId);if(this.seen.size>128)this.seen.delete(this.seen.values().next().value!);
  const weight=event.spec.element==='gravity'?1:this.policy.secondaryPower??1;
  return !!this.fields.spawn({id:`gravity-${event.projectileId}`,ownerId:this.ownerId,point:event.point,normal:event.normal,power:Math.max(.35,Math.min(1.6,event.energy/60))*weight,scale:Math.max(.65,Math.min(1.25,event.spec.blastRadius/3))});
 }
 clear():void{this.seen.clear();}
}
