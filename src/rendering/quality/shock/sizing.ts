import type { ProjectileType } from '../../../core/arsenal';

export type ShockRole='direct'|'detonation'|'splash'|'chain';
export interface ShockSizingInput {projectile:ProjectileType;phase:'contact'|'detonate';radius:number;energy?:number;exposure?:number;channelWeight?:number;targetSpan?:number;role?:ShockRole}
export interface ShockSize {reach:number;patch:number;width:number;paths:number;sparks:number;heavy:boolean;strength:number;life:number}
const bound=(v:number|undefined,fallback:number,min:number,max:number)=>Number.isFinite(v)?Math.max(min,Math.min(max,v!)):fallback;
/** Cosmetic world-unit sizing. No target selection, radius, damage or status changes. */
export function shockSizing(input:ShockSizingInput):ShockSize{
 const exposure=bound(input.exposure,1,0,1),channel=bound(input.channelWeight,1,0,1),span=bound(input.targetSpan,2,.08,30);
 const energy=bound(input.energy,20,0,100000),power=bound((energy/25)**.19,1,.65,1.38),secondary=input.role==='splash'||input.role==='chain';
 if(energy<=0||exposure<=0||channel<=0)return{reach:0,patch:0,width:0,paths:0,sparks:0,heavy:false,strength:0,life:0};
 if(secondary){const fraction=Math.sqrt(exposure)*channel;return{reach:(.055+.14*fraction)*power,patch:Math.min(span*.14,(.035+.13*fraction)*power),width:.006*power*channel,paths:2,sparks:Math.round(2+4*exposure),heavy:false,strength:exposure*channel,life:.22};}
 const heavy=input.phase==='detonate'&&input.radius>=1.2&&energy>=35&&['sticky','rocket','cluster','orb','homing'].includes(input.projectile);
 const base=({bullet:.86,slug:.94,spike:.68,ricochet:.67,homing:.72,sticky:.46,orb:.68,beam:.42,scatter:.53,rocket:.49,disc:.71,arc:.49,cluster:.52}as const)[input.projectile];
 const reach=(heavy?Math.min(1.65,.55+.48*Math.sqrt(bound(input.radius,2.5,0,20))):base)*power*Math.sqrt(exposure)*channel;
 return{reach,patch:Math.min(span*.38,(heavy?.49:.33)*power*channel),width:(heavy?.030:.020)*Math.sqrt(power)*channel,paths:heavy?5:4,sparks:Math.round((heavy?24:10)*channel),heavy,strength:Math.sqrt(exposure)*channel,life:heavy?.43:.34};
}
