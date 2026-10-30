// Frozen pre-finish A+B comparison only. Shared services remain shared.
import type {ProjectileType} from '../../../../core/arsenal';

export interface RadiationSizeInput {delivery:ProjectileType;phase:'contact'|'detonate';radius:number;energy?:number;exposure?:number;secondary?:boolean;channel?:number;targetSpan?:number}
const finite=(v:number|undefined,f:number,min:number,max:number)=>Number.isFinite(v)?Math.max(min,Math.min(max,v!)):f;
/** Visual dimensions only. Secondary recipients get deposition, never another primary bloom. */
export function radiationSizing(input:RadiationSizeInput){
 const exposure=finite(input.exposure,1,0,1),channel=finite(input.channel,1,0,1),energy=finite(input.energy,input.phase==='detonate'?65:20,0,100000),span=finite(input.targetSpan,2,.08,30);
 const broad=input.phase==='detonate',power=finite((energy/(broad||input.secondary?65:20))**.22,1,.52,1.35),strength=Math.sqrt(exposure)*channel;
 if(energy<=0||strength<=0)return{reach:0,deposit:0,rays:0,lobes:0,grains:0,grainSize:0,strength:0,life:0,broad};
 if(input.secondary)return{reach:0,deposit:Math.min(span*.15,(.035+.14*Math.sqrt(exposure)*power)*channel),rays:0,lobes:0,grains:Math.round((1+6*exposure)*channel),grainSize:(.007+.009*Math.sqrt(exposure))*channel,strength:exposure*channel,life:.46,broad};
 const compact:Record<ProjectileType,number>={bullet:.40,slug:.56,spike:.37,ricochet:.37,homing:.44,sticky:.32,orb:.42,beam:.26,scatter:.29,rocket:.36,disc:.43,arc:.24,cluster:.35};
 const reach=Math.min(span*.80,broad?Math.min(1.5,.40+.42*Math.sqrt(finite(input.radius,2.5,0,20))):compact[input.delivery])*power*strength;
 return{reach,deposit:Math.min(span*.32,reach*(broad?.38:.40)),rays:Math.max(2,Math.round((broad?7:4)*channel)),lobes:3,grains:Math.round((broad?26:12)*strength),grainSize:(broad?.022:.013)*Math.sqrt(power)*channel,strength,life:broad?.72:.46,broad};
}
