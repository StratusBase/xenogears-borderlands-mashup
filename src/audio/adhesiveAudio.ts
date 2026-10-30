import type {ElementType} from '../core/arsenal';
import {corrosiveABAudioRecipe} from './corrosiveAudio';
import type {ElementalAudioEvent,ElementalAudioOptions,ElementalVoice} from './elementalAudio';

/** Tack Resin A, scheduled by the existing shared engine, buses and voice limits. */
export function adhesiveResinAudioRecipe(element:ElementType,event:ElementalAudioEvent,options:ElementalAudioOptions={}):readonly ElementalVoice[]{
 if(element!=='adhesive')return corrosiveABAudioRecipe(element,event,options);
 const v=(wave:ElementalVoice['wave'],frequency:number,endFrequency:number,duration:number,gain:number,delay=0,extra:Partial<ElementalVoice>={}):ElementalVoice=>({wave,frequency,endFrequency,duration,gain,delay,attack:.004,...extra});
 const heavy=options.mode==='mech',pitch=heavy?.80:1,broad=options.strength===1&&['sticky','rocket','orb','homing','cluster'].includes(options.delivery??'');let voices:ElementalVoice[];
 if(event==='impact'&&options.splash)voices=[v('noise',780,280,.11,.030,0,{texture:'liquid',filter:'lowpass'}),v('triangle',220,98,.10,.015,.015)];
 else if(event==='impact')voices=[v('noise',1100,330,.09,broad?.14:.095,0,{texture:'liquid',filter:'lowpass'}),v('sine',broad?112:175,broad?43:72,broad?.18:.09,broad?.12:.072),v('noise',850,220,broad?.34:.20,broad?.09:.055,.025,{texture:'liquid',filter:'bandpass',endFilter:250,attack:.015}),v('triangle',330,135,broad?.21:.12,.025,.08,{warble:4.5,warbleDepth:.025})];
 else if(event==='status')voices=[v('noise',430,180,.13,.014,0,{texture:'liquid',filter:'lowpass',attack:.018}),v('sine',310,140,.065,.009,.07)];
 else if(event==='release')voices=[v('noise',1050,260,.16,.026,0,{texture:'liquid',filter:'bandpass',endFilter:280}),v('triangle',270,125,.11,.012,.02)];
 else if(event==='equipment')voices=[v('noise',340,180,.10,.007,0,{texture:'liquid',filter:'lowpass',attack:.02})];
 else if(event==='shot')voices=[v('noise',780,280,.12,.036,0,{texture:'liquid',filter:'bandpass'}),v('triangle',185,102,.09,.021,.01)];
 else voices=[v('noise',650,260,.15,.024,0,{texture:'liquid',filter:'lowpass',attack:.025})];
 return voices.map(voice=>({...voice,frequency:voice.frequency*pitch,endFrequency:voice.endFrequency*pitch,gain:voice.gain*(heavy?1.08:1)}));
}
