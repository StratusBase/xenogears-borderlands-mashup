import type {ElementType} from '../core/arsenal';
import {elementalAudioRecipe,type ElementalAudioEvent,type ElementalAudioOptions,type ElementalVoice} from './elementalAudio';

/** Short inward intake, restrained pressure bed and authoritative crush/release cues. */
export function gravityAudioRecipe(element:ElementType,event:ElementalAudioEvent,options:ElementalAudioOptions={}):readonly ElementalVoice[]{
 if(element!=='gravity')return elementalAudioRecipe(element,event,options);
 const voice=(wave:ElementalVoice['wave'],frequency:number,endFrequency:number,duration:number,gain:number,extra:Partial<ElementalVoice>={}):ElementalVoice=>({wave,frequency,endFrequency,duration,gain,attack:.008,delay:0,...extra});
 if(event==='impact')return options.splash?[voice('sine',118,48,.16,.065),voice('noise',550,210,.13,.025,{filter:'lowpass',shape:'swell',attack:.04})]:[voice('noise',1050,280,.24,.08,{filter:'bandpass',shape:'swell',attack:.08}),voice('sine',190,44,.30,.14,{delay:.035,attack:.012}),voice('triangle',330,78,.17,.025,{delay:.025,warble:4,warbleDepth:.12})];
 if(event==='status')return[voice('sine',66,75,.40,.016,{attack:.10,shape:'swell',tremolo:3,tremoloDepth:.28}),voice('noise',380,180,.20,.009,{filter:'lowpass',attack:.06,shape:'swell'})];
 if(event==='release')return[voice('noise',730,200,.30,.035,{filter:'lowpass',attack:.025,endFilter:150}),voice('sine',77,34,.30,.045,{attack:.02})];
 if(event==='equipment')return[voice('sine',90,105,.23,.006,{attack:.075,shape:'swell'})];
 return elementalAudioRecipe(element,event,options);
}
