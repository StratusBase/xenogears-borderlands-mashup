import type {EffectBody,EffectBounds,EffectVector} from '../contracts';
import {effectBodyClear,supportedEffectPose} from '../shared/collision';
import type {GravityWell} from './field';

/** Keep the capture ring on the contact's open side, without moving the core or stacking slots. */
export function gravityCapturePose(desired:EffectVector,body:EffectBody,well:Readonly<GravityWell>,solids:readonly EffectBounds[]):EffectVector{
 const n=well.normal,point=well.point,center=well.center,horizontal=Math.hypot(n.x,n.z);
 const ring=Math.max(well.captureRadius,body.radius*2+.15);
 const distance=(center.x-point.x)*n.x+(center.y-point.y)*n.y+(center.z-point.z)*n.z;
 // Translate the whole horizontal ring together at walls: clamping each rear slot alone compresses bodies.
 const vertical=desired.y-center.y,horizontalBudget=Math.sqrt(Math.max(0,well.radius*well.radius-vertical*vertical));
 const shift=horizontal>.5?Math.min(Math.max(0,body.radius+ring*horizontal+.004-distance),Math.max(0,horizontalBudget-ring)*.9):0;
 const result={x:desired.x+n.x*shift,y:desired.y+n.y*shift,z:desired.z+n.z*shift};
 const extent=body.radius*(Math.abs(n.x)+Math.abs(n.z))+body.halfHeight*Math.abs(n.y)+.002;
 const plane=(result.x-point.x)*n.x+(result.y-point.y)*n.y+(result.z-point.z)*n.z;
 const correction=Math.max(0,extent-plane);result.x+=n.x*correction;result.y+=n.y*correction;result.z+=n.z*correction;
 if(effectBodyClear(result,body,solids))return result;
 // Raised support may resolve a low goal, but do not lift a body onto a wall above the core.
 const supported=supportedEffectPose(result,body,solids);
 return supported.y<=well.center.y+body.halfHeight*.25&&effectBodyClear(supported,body,solids)?supported:result;
}
