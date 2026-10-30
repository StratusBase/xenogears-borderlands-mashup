import type {ProjectileType} from '../../../core/arsenal';

export interface ResinSizingInput {delivery:ProjectileType;phase:'contact'|'detonate';radius:number;energy?:number;exposure?:number;secondary?:boolean;channel?:number;targetSpan?:number}
const bounded=(v:number|undefined,fallback:number,lo:number,hi:number)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,v!)):fallback;
/** Cosmetic world units. Secondary deposits never create the primary resin fold. */
export function resinSizing(input:ResinSizingInput){
 const broad=input.phase==='detonate',exposure=bounded(input.exposure,1,0,1),channel=bounded(input.channel,1,0,1),energy=bounded(input.energy,broad?70:20,0,100000),span=bounded(input.targetSpan,2,.08,30);
 const power=bounded((energy/(broad||input.secondary?70:20))**.20,1,.55,1.35),strength=Math.sqrt(exposure)*channel;
 if(energy<=0||strength<=0)return{reach:0,pad:0,drops:0,dropSize:0,speed:0,life:0,strength:0,exposure};
 if(input.secondary)return{reach:0,pad:Math.min(span*.12,(.025+.13*Math.sqrt(exposure)*power)*channel),drops:Math.round((1+3*exposure)*channel),dropSize:(.008+.007*Math.sqrt(exposure))*channel,speed:.25+exposure*.4,life:.55,strength:exposure*channel,exposure};
 const compact=({bullet:.28,slug:.40,spike:.29,ricochet:.26,homing:.34,sticky:.25,orb:.34,beam:.17,scatter:.21,rocket:.34,disc:.33,arc:.17,cluster:.28} as Record<ProjectileType,number>)[input.delivery]??.28;
 const reach=(broad?Math.min(1.25,.48+.29*Math.sqrt(bounded(input.radius,2.5,0,20))):compact)*power*strength;
 return{reach,pad:Math.min(span*.22,reach*(broad?.30:.55)),drops:Math.round((broad?8:input.delivery==='scatter'?2:4)*strength),dropSize:(broad?.025:.016)*Math.sqrt(power)*channel,speed:(broad?2.2:1.1)*Math.sqrt(power),life:broad?.72:.53,strength,exposure};
}
