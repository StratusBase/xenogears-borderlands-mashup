import {shockABAudioRecipe} from './shockAudio';
import type {ElementalVoice,ElementalAudioEvent,ElementalAudioOptions} from './elementalAudio';
import type {ElementType} from '../core/arsenal';
import {EffectVariationSequence,type EffectVariation} from '../rendering/quality/shared/variation';
/** Existing A/B/C, equipment, status and release stay exact. The flight cue is
 * emitted at launch by the existing engine, not a positional travelling loop. */
function recipe(element:ElementType,event:ElementalAudioEvent,options:ElementalAudioOptions={}):readonly ElementalVoice[]{
 if(element!=='shock'||event!=='shot'&&event!=='flight')return shockABAudioRecipe(element,event,options);
 const beam=options.delivery==='beam'||options.delivery==='arc',precision=options.delivery==='slug'||options.delivery==='spike',broad=['rocket','homing','orb','cluster'].includes(options.delivery??'');
 const v=(wave:ElementalVoice['wave'],frequency:number,endFrequency:number,duration:number,gain:number,delay=0,extra:Partial<ElementalVoice>={}):ElementalVoice=>({wave,frequency,endFrequency,duration,gain,delay,attack:.002,...extra});
 if(event==='shot')return[v('noise',precision?4300:3600,1900,.016,beam?.060:.095,0,{filter:'bandpass',texture:'crackle',q:.8}),v('sawtooth',precision?1800:beam?1300:1450,precision?1450:beam?980:1050,beam?.045:.038,beam?.018:.022,.004,{filter:'lowpass',endFilter:2200,tremolo:67,tremoloDepth:.65,shape:'pluck'}),...(broad?[v('noise',1900,880,.065,.022,.010,{filter:'bandpass',texture:'air',attack:.007})]:[])];
 return[v('noise',precision?4100:beam?3100:3600,precision?2600:2000,beam?.065:broad?.080:.040,beam?.020:broad?.025:.022,.008,{filter:'bandpass',texture:'crackle',attack:.003,tremolo:81,tremoloDepth:.7})];
}
/** A presentation gets its own cosmetic audio sequence. Shot and launch tail
 * share one bounded pitch/time profile; no gameplay RNG or additional clock. */
export function createShockFlightAudioRecipe(seed?:number){
 const variation=new EffectVariationSequence(seed);let pending:EffectVariation|undefined;
 return(element:ElementType,event:ElementalAudioEvent,options:ElementalAudioOptions={}):readonly ElementalVoice[]=>{
  if(element!=='shock'||event!=='shot'&&event!=='flight')return shockABAudioRecipe(element,event,options);
  const choice=event==='shot'?variation.next(7,'shot'):pending??variation.next(7,'flight');pending=event==='shot'?choice:undefined;const mech=options.mode==='mech',pitch=choice.range(50,.96,1.045)*(mech?.78:1),time=choice.range(51,.94,1.06)*(mech?1.12:1),gain=choice.range(52,.94,1)*(mech?1.08:1);
  return recipe(element,event,options).map(v=>({...v,frequency:v.frequency*pitch,endFrequency:v.endFrequency*pitch,duration:v.duration*time,delay:v.delay*time,attack:v.attack*time,gain:v.gain*gain,...(v.tremolo?{tremolo:v.tremolo*choice.range(53,.92,1.08)}:{})}));
 };
}
export const shockFlightAudioRecipe=createShockFlightAudioRecipe();
