/** Cosmetic entropy never consumes Math.random or a gameplay RNG. A fixed seed supports exact reviews. */
let fallbackSerial=0;
function hash(value:number){let x=value>>>0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return(x^(x>>>15))>>>0;}
function independentSeed(){const words=new Uint32Array(1);if(globalThis.crypto?.getRandomValues){globalThis.crypto.getRandomValues(words);return words[0];}return hash(++fallbackSerial*0x9e3779b9);}
export function cosmeticSample(seed:number,dimension:number){return hash((seed>>>0)^Math.imul(dimension+1,0x9e3779b9))/4294967296;}
export interface EffectVariation {readonly seed:number;readonly variant:number;sample(dimension:number):number;range(dimension:number,min:number,max:number):number}
/** One immutable choice per event; independent tracks avoid repeating explosive silhouettes between contacts. */
export class EffectVariationSequence {
 private cursor=0;private previous=new Map<string,number>();
 constructor(readonly seed=independentSeed()){}
 next(variants=1,track='impact'):EffectVariation {
  const count=Math.max(1,Math.floor(variants)),seed=hash(this.seed^Math.imul(++this.cursor,0x85ebca6b)),previous=this.previous.get(track);
  const variant=previous===undefined?Math.floor(cosmeticSample(seed,0)*count):count===1?0:(previous+1+Math.floor(cosmeticSample(seed,0)*(count-1)))%count;
  this.previous.set(track,variant);return Object.freeze({seed,variant,sample:(dimension:number)=>cosmeticSample(seed,dimension),range:(dimension:number,min:number,max:number)=>min+(max-min)*cosmeticSample(seed,dimension)});
 }
 reset(){this.cursor=0;this.previous.clear();}
}
