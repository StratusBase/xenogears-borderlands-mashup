import { elementalAudioRecipe,type ElementalVoice,type ElementalAudioEvent,type ElementalAudioOptions } from './elementalAudio';
import type { ElementType } from '../core/arsenal';

/** Dense cold contact, staggered plate clicks, then quiet granular rime. */
export function icePlateAudioRecipe(element:ElementType,event:ElementalAudioEvent,options:ElementalAudioOptions={}):readonly ElementalVoice[]{
 if(element!=='ice')return elementalAudioRecipe(element,event,options);
 const v=(wave:ElementalVoice['wave'],frequency:number,endFrequency:number,duration:number,gain:number,delay=0,extra:Partial<ElementalVoice>={}):ElementalVoice=>({wave,frequency,endFrequency,duration,gain,delay,attack:.003,...extra});
 const broad=['sticky','rocket','orb','homing','cluster'].includes(options.delivery??''),armor=options.surface==='armor';
 if(event==='impact'&&options.splash)return[v('noise',2200,1200,.085,.050,0,{filter:'bandpass',texture:'crackle',endFilter:900}),v('triangle',840,530,.055,.020,.023)];
 if(event==='impact')return[
  v('triangle',broad?185:290,72,broad?.13:.075,.13),
  v('noise',armor?3400:2300,1100,.055,.16,0,{filter:'bandpass',texture:'crackle',endFilter:800}),
  ...[.025,.057,.103,.17].slice(0,broad?4:2).map((delay,i)=>v('noise',3100-i*270,1100,.055-i*.006,.075-i*.009,delay,{filter:'bandpass',texture:'crackle',endFilter:1000})),
  v('sine',armor?1840:1310,740,.085,.026,.048),
  v('noise',3900,1700,broad?.28:.16,.045,.07,{filter:'highpass',texture:'air',attack:.014,endFilter:1700}),
 ];
 if(event==='status')return[v('noise',2400,1500,.12,.018,0,{filter:'bandpass',texture:'crackle',attack:.015,endFilter:1100}),v('noise',4000,2500,.075,.011,.13,{filter:'highpass',texture:'air'})];
 if(event==='release')return[v('noise',2700,1100,.16,.030,0,{filter:'bandpass',texture:'crackle',attack:.006,endFilter:800})];
 if(event==='equipment')return[v('noise',1500,1500,.12,.006,0,{filter:'bandpass',texture:'air',attack:.035})];
 if(event==='shot')return[v('noise',3300,1800,.085,.035,0,{filter:'highpass',texture:'air',attack:.008,endFilter:1600}),v('triangle',1650,1050,.045,.013)];
 return[v('noise',3000,1800,.10,.020,0,{filter:'highpass',texture:'air',attack:.015,endFilter:1600})];
}
