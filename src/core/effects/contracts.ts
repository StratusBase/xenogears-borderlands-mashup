/** Plain simulation contracts: no renderer, camera, DOM or audio dependencies. */
export interface EffectVector {x:number;y:number;z:number}
export interface EffectBounds {minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number}
export interface EffectBody {radius:number;halfHeight:number}
export type EffectId=string;
export const finiteVector=(p:EffectVector)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z);
export const copyVector=(p:EffectVector):EffectVector=>({x:p.x,y:p.y,z:p.z});
export const distance3=(a:EffectVector,b:EffectVector)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
