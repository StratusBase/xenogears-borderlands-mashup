import { EffectVariationSequence } from '../shared/variation';

export interface CapacitorDirection {readonly sector:number;readonly angle:number}
/** A shuffled eight-direction bag. Every eight heavy hits cover the full contact plane.
 * Prefer a clear turn between hits, with no repeated sector even across bag boundaries.
 * Choices are cosmetic, stable for the whole burst and separate from A+B/chain entropy.
 */
export class CapacitorDirectionSequence {
 private variation:EffectVariationSequence;private bag:number[]=[];private previous=-1;
 constructor(seed?:number){this.variation=new EffectVariationSequence(seed);}
 get seed(){return this.variation.seed;}
 next():CapacitorDirection{
  const profile=this.variation.next(8,'capacitor-direction');
  if(!this.bag.length)this.bag=Array.from({length:8},(_,sector)=>sector).sort((a,b)=>profile.sample(a+8)-profile.sample(b+8));
  const distance=(sector:number)=>this.previous<0?4:Math.min((sector-this.previous+8)%8,(this.previous-sector+8)%8);
  let index=this.bag.findIndex(sector=>distance(sector)>=2);
  if(index<0)index=this.bag.reduce((best,sector,i)=>distance(sector)>distance(this.bag[best])?i:best,0);
  const sector=this.bag.splice(index,1)[0];this.previous=sector;
  return Object.freeze({sector,angle:sector*Math.PI/4+profile.range(20,-.12,.12)});
 }
 reset():void{this.bag.length=0;this.previous=-1;this.variation.reset();}
}
