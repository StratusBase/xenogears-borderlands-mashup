import type { ProjectileType } from '../../../core/arsenal';

export interface CorrosiveSizingInput{
 projectile:ProjectileType;phase:'contact'|'detonate';radius:number;energy?:number;exposure?:number;
 secondaryTarget?:boolean;channelWeight?:number;targetSpan?:number;
}
export interface CorrosiveSizing{
 sheetRadius:number;coatingRadius:number;dropCount:number;dropSize:number;speed:number;
 bubbleCount:number;bubbleSize:number;vaporCount:number;residueRadius:number;life:number;strength:number;
}
const bounded=(value:number|undefined,fallback:number,min:number,max:number)=>Number.isFinite(value)?Math.max(min,Math.min(max,value!)):fallback;
/** World-unit scales. Secondary recipients get deposition, never a replay of the epicentre's sheet. */
export function corrosiveSizing(input:CorrosiveSizingInput):CorrosiveSizing{
 const blast=input.phase==='detonate',indirect=Boolean(input.secondaryTarget),exposure=bounded(input.exposure,1,0,1),channel=bounded(input.channelWeight,1,0,1);
 const energy=bounded(input.energy,blast?70:20,.01,100000),power=Math.max(.52,Math.min(1.35,(energy/(blast||indirect?70:20))**.22));
 if(exposure<=0||channel<=0||Number.isFinite(input.energy)&&input.energy!<=0)return{sheetRadius:0,coatingRadius:0,dropCount:0,dropSize:0,speed:0,bubbleCount:0,bubbleSize:0,vaporCount:0,residueRadius:0,life:0,strength:0};
 const radius=bounded(input.radius,blast?2.5:.3,0,20),span=bounded(input.targetSpan,2,.08,30);
 const contact=({bullet:.38,slug:.58,spike:.31,ricochet:.34,homing:.42,sticky:.42,orb:.44,beam:.23,scatter:.30,rocket:.42,disc:.42,arc:.23,cluster:.36}as const)[input.projectile];
 if(indirect){
  const wet=(.035+.15*Math.sqrt(exposure)*power)*channel;
  return{sheetRadius:0,coatingRadius:Math.min(wet,span*.15),dropCount:Math.round((2+7*exposure)*channel),dropSize:(.010+.010*Math.sqrt(exposure))*power*channel,
   speed:.40+exposure*.85,bubbleCount:Math.round((1+3*exposure)*channel),bubbleSize:(.012+.012*exposure)*power*channel,vaporCount:exposure>.55?1:0,residueRadius:0,life:.30+exposure*.28,strength:exposure*channel};
 }
 const sheet=(blast?Math.max(.40,Math.min(1.65,.35+.47*Math.sqrt(radius))):contact)*power*Math.sqrt(exposure)*channel;
 return{sheetRadius:sheet,coatingRadius:Math.min(blast?sheet*.55:sheet*.93,span*.42),dropCount:Math.round((blast?30:12)*Math.max(.3,Math.min(1.3,power))*Math.sqrt(exposure)*channel),
  dropSize:(blast?.042:.029)*Math.sqrt(power)*channel,speed:(blast?3.9:2.1)*Math.sqrt(power),bubbleCount:Math.round((blast?6:3)*Math.sqrt(exposure)*channel),bubbleSize:(blast?.034:.025)*Math.sqrt(power)*channel,
  vaporCount:blast?3:1,residueRadius:blast?sheet*.56:0,life:blast?.85:.58,strength:Math.sqrt(exposure)*channel};
}
