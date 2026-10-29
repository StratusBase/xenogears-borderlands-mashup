import { elementalAudioRecipe,type ElementalVoice,type ElementalAudioEvent,type ElementalAudioOptions } from './elementalAudio';
import type { ElementType } from '../core/arsenal';

/** A: pressure/wet sheet tear. B: uneven foam, sizzle and drip punctuation. */
export function corrosiveABAudioRecipe(element:ElementType,event:ElementalAudioEvent,options:ElementalAudioOptions={}):readonly ElementalVoice[]{
 if(element!=='corrosive'||!['impact','status','release'].includes(event))return elementalAudioRecipe(element,event,options);
 const broad=['sticky','rocket','orb','homing'].includes(options.delivery??''),armor=options.surface==='armor';
 const voice=(wave:ElementalVoice['wave'],frequency:number,endFrequency:number,duration:number,gain:number,delay=0,extra:Partial<ElementalVoice>={}):ElementalVoice=>({wave,frequency,endFrequency,duration,gain,delay,attack:.003,...extra});
 if(event==='impact'&&options.splash)return[voice('noise',1050,1050,.095,.07,0,{filter:'lowpass',texture:'liquid'}),voice('noise',1800,900,.20,.035,.016,{filter:'bandpass',texture:'liquid',endFilter:700}),voice('sine',640,170,.065,.018,.035)];
 if(event==='impact')return[
  voice('sine',broad?158:235,43,broad?.17:.10,.20),
  voice('noise',1250,1250,.16,.20,0,{filter:'lowpass',texture:'liquid',endFilter:480}),
  voice('noise',2600,2600,broad?.42:.24,.14,.018,{filter:'bandpass',texture:'liquid',attack:.012,endFilter:700}),
  voice('noise',armor?3900:2300,1200,.52,armor?.10:.065,.065,{filter:'bandpass',texture:'crackle',attack:.018,endFilter:900}),
  ...[0,.072,.16,.27,.39].map((delay,i)=>voice('sine',780-i*76,180-i*12,.075,.035-i*.003,.07+delay,{warble:18,warbleDepth:.07})),
  voice('noise',1550,1550,.68,.09,.13,{filter:'highpass',texture:'air',attack:.04,endFilter:730}),
 ];
 if(event==='status')return[
  voice('noise',armor?3100:1900,1500,.36,.047,0,{filter:'bandpass',texture:'liquid',attack:.024,endFilter:850}),
  voice('sine',690,140,.08,.036,.052),voice('sine',510,120,.10,.026,.19),
  voice('noise',620,620,.12,.031,.28,{filter:'lowpass',texture:'liquid'}),
 ];
 return[voice('sine',580,95,.17,.034),voice('noise',1400,1400,.22,.026,.03,{filter:'bandpass',texture:'liquid',endFilter:450})];
}
