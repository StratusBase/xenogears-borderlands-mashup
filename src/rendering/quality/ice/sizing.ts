import type { ProjectileType } from '../../../core/arsenal';

export interface IceSizingInput {projectile:ProjectileType;phase:'contact'|'detonate';radius:number;energy?:number;exposure?:number;secondary?:boolean;channel?:number;targetSpan?:number}
const bound=(v:number|undefined,fallback:number,min:number,max:number)=>Number.isFinite(v)?Math.max(min,Math.min(max,v!)):fallback;
/** Visual world units only. Neighbors receive deposition, never another primary release. */
export function iceSizing(input:IceSizingInput){
 const broad=input.phase==='detonate',exposure=bound(input.exposure,1,0,1),channel=bound(input.channel,1,0,1),span=bound(input.targetSpan,2,.08,30);
 const energy=bound(input.energy,broad?70:20,0,100000),power=bound((energy/(broad||input.secondary?70:20))**.20,1,.55,1.35),strength=Math.sqrt(exposure)*channel;
 const empty={reach:0,rime:0,plates:0,plateSize:0,flakes:0,flakeSize:0,speed:0,strength:0};if(energy<=0||strength<=0)return empty;
 if(input.secondary)return{reach:0,rime:Math.min(span*.14,(.025+.14*Math.sqrt(exposure)*power)*channel),plates:0,plateSize:0,flakes:Math.round((1+5*exposure)*channel),flakeSize:(.008+.009*Math.sqrt(exposure))*channel,speed:.4+exposure*.5,strength:exposure*channel};
 const compact=({bullet:.31,slug:.45,spike:.29,ricochet:.29,homing:.35,sticky:.32,orb:.36,beam:.19,scatter:.23,rocket:.34,disc:.35,arc:.18,cluster:.30}as const)[input.projectile];
 const reach=(broad?Math.min(1.3,.30+.38*Math.sqrt(bound(input.radius,2.5,0,20))):compact)*power*strength;
 return{reach,rime:Math.min(span*.40,reach*(broad?.63:1.05)),plates:Math.max(1,Math.round((broad?5:input.projectile==='beam'||input.projectile==='arc'?2:3)*strength)),plateSize:Math.min(span*.17,reach*(broad?.26:.29)),flakes:Math.round((broad?24:9)*strength),flakeSize:(broad?.023:.014)*Math.sqrt(power)*channel,speed:(broad?2.5:1.45)*Math.sqrt(power),strength};
}
