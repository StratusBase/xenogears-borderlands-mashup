import * as THREE from 'three';
import type { ProjectileType } from '../../../core/arsenal';

export interface FireSizeInput {delivery:ProjectileType;phase:'contact'|'detonate';radius:number;energy?:number;exposure?:number;secondary?:boolean;channelWeight?:number;targetSpan?:number}
/** Presentation dimensions only. Exposure and energy come from the existing hit, never feed back into combat. */
export function fireSizing(input:FireSizeInput){
 const exposure=THREE.MathUtils.clamp(Number.isFinite(input.exposure)?input.exposure!:1,0,1);
 const power=THREE.MathUtils.clamp(Math.sqrt(Math.max(1,Number.isFinite(input.energy)?input.energy!:24)/28),.55,1.45);
 const channel=THREE.MathUtils.clamp(input.channelWeight??1,.1,1),strength=exposure*channel;
 const explosive=input.phase==='detonate'&&input.radius>0;
 const delivery=input.delivery==='scatter'?.64:input.delivery==='beam'||input.delivery==='arc'?.70:input.delivery==='slug'?1.12:1;
 const span=THREE.MathUtils.clamp(input.targetSpan??1.5,.3,2.2);
 const size=Math.min(explosive?1.50:1.08,Math.max(.22,span*(explosive?.78:.55)),(explosive?1.05+Math.min(5,input.radius)*.08:.72)*power*delivery)*Math.sqrt(channel);
 const secondary=!!input.secondary;
 return{explosive,strength,sheetSize:secondary||strength<=0?0:size,coatingRadius:(secondary?.075+.16*exposure:Math.min(.46,.25*power*delivery))*Math.sqrt(channel),
  emberCount:strength<=0?0:secondary?Math.max(2,Math.round(9*exposure*channel)):Math.round((explosive?30:17)*Math.sqrt(channel)),emberSize:(secondary?.010:.015)*(.7+.3*power),
  smokeCount:secondary?0:explosive?3:1,life:explosive?.86:.66,energy:power,exposure};
}
