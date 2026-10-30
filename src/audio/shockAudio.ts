import { elementalAudioRecipe,type ElementalVoice,type ElementalAudioEvent,type ElementalAudioOptions } from './elementalAudio';
import { corrosiveABAudioRecipe } from './corrosiveAudio';
import type { ElementType } from '../core/arsenal';

/** A: compact snap/zip. B: intermittent quiet charge. C: bass/body only at confirmed heavy detonation. */
export function shockABAudioRecipe(element:ElementType,event:ElementalAudioEvent,options:ElementalAudioOptions={}):readonly ElementalVoice[]{
 if(element!=='shock')return corrosiveABAudioRecipe(element,event,options);
 const v=(wave:ElementalVoice['wave'],frequency:number,endFrequency:number,duration:number,gain:number,delay=0,extra:Partial<ElementalVoice>={}):ElementalVoice=>({wave,frequency,endFrequency,duration,gain,delay,attack:.002,...extra});
 if(event==='impact'&&options.splash)return[v('noise',4100,2100,.035,.055,0,{filter:'bandpass',texture:'crackle'}),v('triangle',1200,430,.060,.022,.008,{shape:'pluck'})];
 if(event==='impact'){
  // Caller explicitly supplies strength > 1 for the existing heavy detonation; a sticky contact is small.
  const heavy=(options.strength??1)>1,armor=options.surface==='armor';
  return[v('noise',armor?5200:4100,1700,.018,.16,0,{filter:'bandpass',texture:'crackle'}),v('sawtooth',1700,240,heavy?.13:.085,.065,.006,{filter:'lowpass',endFilter:550,tremolo:61,tremoloDepth:.65}),v('noise',3300,900,heavy?.24:.13,.075,.025,{filter:'bandpass',texture:'crackle',endFilter:900}),v('noise',4900,1900,.025,.032,.095,{filter:'highpass',texture:'crackle'}),...(heavy?[v('sine',135,43,.17,.16,.002),v('noise',850,350,.15,.07,.015,{filter:'lowpass',texture:'air',endFilter:300})]:[])];
 }
 if(event==='status')return[v('noise',3600,1600,.019,.023,0,{filter:'bandpass',texture:'crackle'}),v('triangle',850,410,.038,.010,.027,{shape:'pluck'}),v('noise',2800,1200,.012,.012,.135,{filter:'bandpass',texture:'crackle'})];
 if(event==='equipment')return[v('noise',2700,1300,.012,.008,0,{filter:'bandpass',texture:'crackle'})];
 if(event==='release')return[v('noise',1700,600,.055,.018,0,{filter:'bandpass',texture:'crackle',endFilter:600})];
 return elementalAudioRecipe(element,event,options);
}
