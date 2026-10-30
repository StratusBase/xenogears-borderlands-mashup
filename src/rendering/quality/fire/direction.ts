import type {EffectVariation} from '../shared/variation';

export interface FireImpactDirection {readonly id:number;readonly hand:1|-1;readonly angle:number;readonly floorLean:number;readonly ceilingLean:number}
/** Pick once per real impact, never each frame. Six nonrepeating sectors retain upward body flow and safe support motion. */
export function fireImpactDirection(choice:EffectVariation):FireImpactDirection{
 const id=choice.variant%6,hand=(id%2===0?1:-1)as 1|-1,level=Math.floor(id/2);
 return Object.freeze({id,hand,angle:[.12,.53,.98][level]+choice.range(6,-.07,.07),floorLean:[-.34,.02,.34][level]+choice.range(7,-.06,.06),ceilingLean:choice.range(8,-.045,.045)});
}
