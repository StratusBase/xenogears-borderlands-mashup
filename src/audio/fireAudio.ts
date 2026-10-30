import type { ElementType } from '../core/arsenal';
import { corrosiveABAudioRecipe } from './corrosiveAudio';
import type { ElementalAudioEvent,ElementalAudioOptions,ElementalVoice } from './elementalAudio';

/** A ignition/tear, B granular cooling crackle, C pressure release on actual explosive hits. */
export function fireABCAudioRecipe(element:ElementType,event:ElementalAudioEvent,options:ElementalAudioOptions={}):readonly ElementalVoice[]{
 if(element!=='fire')return corrosiveABAudioRecipe(element,event,options);
 const v=(wave:ElementalVoice['wave'],frequency:number,endFrequency:number,duration:number,gain:number,delay=0,extra:Partial<ElementalVoice>={}):ElementalVoice=>({wave,frequency,endFrequency,duration,gain,delay,attack:.003,...extra});
 if(event==='impact'&&options.splash)return[v('noise',2300,800,.13,.043,0,{texture:'crackle',filter:'bandpass',endFilter:900}),v('noise',950,400,.18,.022,.025,{texture:'air',filter:'lowpass',attack:.012})];
 if(event==='impact'){
  const broad=options.strength===1&&['sticky','rocket','orb','homing','lobber','splitter'].includes(options.delivery??'');
  return[v('noise',4200,1100,.025,.10,0,{texture:'crackle',filter:'bandpass'}),v('sine',broad?125:205,broad?34:61,broad?.20:.085,broad?.16:.10),
   v('noise',broad?1250:1800,500,broad?.40:.20,broad?.17:.11,.012,{texture:'air',filter:'lowpass',endFilter:380,attack:.015}),
   v('noise',2800,1100,broad?.46:.24,.075,.035,{texture:'crackle',filter:'bandpass',endFilter:850,attack:.015}),
   ...[.08,.18,.31].slice(0,broad?3:2).map((delay,i)=>v('noise',4200-i*500,900,.025,.029-i*.006,delay,{texture:'crackle',filter:'highpass'}))];
 }
 if(event==='status')return[v('noise',1900,600,.30,.027,0,{texture:'crackle',filter:'bandpass',attack:.025,endFilter:700}),v('noise',3600,1200,.025,.017,.075,{texture:'crackle',filter:'highpass'}),v('noise',2800,950,.018,.012,.21,{texture:'crackle',filter:'bandpass'})];
 if(event==='release')return[v('noise',950,350,.18,.022,0,{texture:'air',filter:'lowpass',attack:.025,endFilter:260})];
 return corrosiveABAudioRecipe(element,event,options);
}
