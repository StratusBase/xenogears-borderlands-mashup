import * as THREE from 'three';
import type {EffectVariation} from '../shared/variation';
import {GRAVITY_TIMING} from './timing';

const SAMPLES=64;
export interface PressureLane {readonly points:Float32Array;readonly distances:Float32Array;readonly length:number;readonly width:number;readonly duration:number;readonly offset:number;readonly window:number;readonly primary:boolean;readonly roughness:number}
export interface PressureProfile {readonly seed:number;readonly variant:number;readonly lanes:readonly PressureLane[]}
const TAU=Math.PI*2;
/** Travel timing, separate from curve shape. Finite speed grows from .7 to 1.3 lengths per duration. */
export function infallDistance(progress:number):number{const p=Math.max(0,Math.min(1,progress));return .7*p+.3*p*p;}
/** Fixed-time fade avoids whole-lane flashes at fast loop restarts. */
export function flowEnvelope(phase:number,duration:number):number{const elapsed=phase*duration;return Math.max(0,Math.min(1,elapsed/.035,(duration-elapsed)/.045));}
/** Build immutable cosmetic curves once per source. No simulation RNG, source movement or per-frame reroll. */
export function pressureProfile(variation:EffectVariation,normal:THREE.Vector3,clearance:number):PressureProfile{
 const lanes:PressureLane[]=[],rotation=variation.range(1,0,TAU),hand=variation.sample(2)>.5?1:-1;
 const layouts=[[-2.8,-.35,1.4],[-1.9,.1,2.7],[-.7,.95,3.4],[-2.3,.65,2.1]];
 for(let lane=0;lane<8;lane++){
  const primary=lane<3,dim=10+lane*12,angle=(primary?layouts[variation.variant][lane]:variation.range(dim,-Math.PI,Math.PI))+rotation+variation.range(dim+1,-.25,.25);
  const tilt=variation.range(dim+2,-.48,.65),direction=new THREE.Vector3(Math.cos(angle),tilt,Math.sin(angle)).normalize();
  // Incoming sheets stay in the open hemisphere; the exact contact plane also clips the cached curve.
  if(direction.dot(normal)<-.25)direction.addScaledVector(normal,-direction.dot(normal)-.25).normalize();
  const tangent=new THREE.Vector3().crossVectors(direction,normal);if(tangent.lengthSq()<.01)tangent.crossVectors(direction,new THREE.Vector3(0,0,1));if(tangent.lengthSq()<.01)tangent.set(1,0,0);tangent.normalize();
  const reach=variation.range(dim+3,primary?4.65:3.5,primary?5.8:5.4),bend=variation.range(dim+4,primary?1.6:.65,primary?2.65:1.45)*hand*(lane===1?-.7:1),phase=variation.range(dim+5,-.5,.5);
  const points=new Float32Array((SAMPLES+1)*3),distances=new Float32Array(SAMPLES+1);let length=0;
  for(let sample=0;sample<=SAMPLES;sample++){
   const u=sample/SAMPLES,r=THREE.MathUtils.lerp(reach,.39,u),p=direction.clone().multiplyScalar(r).addScaledVector(tangent,Math.sin(u*Math.PI*1.55+phase)*(1-u)*bend).addScaledVector(normal,Math.sin(u*Math.PI)*.24*(lane%2?1:-1));
   const floor=-clearance+.08;if(p.dot(normal)<floor)p.addScaledVector(normal,floor-p.dot(normal));
   points.set([p.x,p.y,p.z],sample*3);if(sample)length+=Math.hypot(p.x-points[(sample-1)*3],p.y-points[(sample-1)*3+1],p.z-points[(sample-1)*3+2]);distances[sample]=length;
  }
  lanes.push({points,distances,length,width:primary?variation.range(dim+6,.22,.30):variation.range(dim+6,.07,.11),duration:length/variation.range(dim+7,GRAVITY_TIMING.field.infallMin,GRAVITY_TIMING.field.infallMax),offset:(lane*.307+variation.range(dim+8,0,.21))%1,window:variation.range(dim+9,primary?.22:.16,primary?.36:.27),primary,roughness:variation.range(dim+10,0,TAU)});
 }
 return{seed:variation.seed,variant:variation.variant,lanes};
}
/** Interpolate by distance along the cached curve; no vector allocation in the frame loop. */
export function samplePressure(lane:PressureLane,distance:number,out:THREE.Vector3):THREE.Vector3{
 const d=Math.max(0,Math.min(lane.length,distance));let lo=0,hi=lane.distances.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(lane.distances[mid]<d)lo=mid;else hi=mid;}
 const a=lo*3,b=hi*3,t=(d-lane.distances[lo])/Math.max(1e-6,lane.distances[hi]-lane.distances[lo]);return out.set(THREE.MathUtils.lerp(lane.points[a],lane.points[b],t),THREE.MathUtils.lerp(lane.points[a+1],lane.points[b+1],t),THREE.MathUtils.lerp(lane.points[a+2],lane.points[b+2],t));
}
