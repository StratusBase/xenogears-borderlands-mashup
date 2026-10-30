// Frozen pre-finish A+B comparison only. Shared services remain shared.
import {elementalAudioRecipe,type ElementalAudioEvent,type ElementalAudioOptions,type ElementalVoice} from '../../../../audio/elementalAudio';
import {RADIATION_TIMING as T} from './timing';
import type {ElementType} from '../../../../core/arsenal';

/** A's dry flash -> B's granular release -> sparse, quiet counter-like decay. Shared engine only. */
export function radiationFalloutAudioRecipe(element:ElementType,event:ElementalAudioEvent,options:ElementalAudioOptions={}):readonly ElementalVoice[]{
 if(element!=='radiation')return elementalAudioRecipe(element,event,options);
 const v=(wave:ElementalVoice['wave'],frequency:number,endFrequency:number,duration:number,gain:number,delay=0,extra:Partial<ElementalVoice>={}):ElementalVoice=>({wave,frequency,endFrequency,duration,gain,delay,attack:.003,...extra});
 const broad=['sticky','rocket','orb','homing','cluster'].includes(options.delivery??''),metal=options.surface==='armor';
 if(event==='impact'&&options.splash)return[v('noise',1900,1300,.022,.037,0,{filter:'bandpass',texture:'crackle'}),v('noise',2100,1100,.070,.018,.035,{filter:'bandpass',texture:'air',endFilter:800})];
 if(event==='impact')return[
  v('triangle',broad?170:270,70,broad?.12:.07,.13),
  v('noise',metal?4100:2900,1700,.027,.13,0,{filter:'bandpass',texture:'crackle',endFilter:1200}),
  v('noise',1500,520,broad?.33:.18,.075,T.release,{filter:'bandpass',texture:'air',attack:.025,endFilter:420}),
  ...[.075,.14,.23].slice(0,broad?3:2).map((delay,i)=>v('noise',2400-i*220,1300,.016,.026-i*.006,delay,{filter:'bandpass',texture:'crackle'})),
  v('sine',metal?710:490,160,.07,.027,.025),
 ];
 if(event==='status')return[v('noise',2300,1800,.015,.013,0,{filter:'bandpass',texture:'crackle'}),v('noise',1900,1500,.012,.008,.15,{filter:'bandpass',texture:'crackle'}),v('sine',146,142,.20,.006,.025,{warble:8,warbleDepth:.018,attack:.03})];
 if(event==='equipment')return[v('sine',160,159,.15,.004,0,{attack:.035}),v('noise',1800,1500,.012,.004,.08,{filter:'bandpass',texture:'crackle'})];
 if(event==='release')return[v('noise',1400,650,.11,.022,0,{filter:'bandpass',texture:'air',attack:.02,endFilter:500})];
 if(event==='shot')return[v('noise',3100,1800,.035,.029,0,{filter:'bandpass',texture:'crackle'}),v('triangle',820,390,.055,.015,.006)];
 return[v('noise',2600,1400,.09,.018,0,{filter:'bandpass',texture:'air',attack:.015,endFilter:900})];
}
