import type { Mode } from '../../core/index';

/** Presentation impulse: pilot returns quickly; heavy equipment has a later, longer settle. */
export function qualityRecoilEnvelope(mode:Mode,age:number):number{
 const duration=mode==='mech'?.43:.17;
 if(!Number.isFinite(age)||age<0||age>=duration)return 0;
 const t=age/duration;
 return Math.sin(Math.PI*Math.sqrt(t))*Math.exp(-2*t);
}
