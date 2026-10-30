import type { ElementType, ProjectileType } from '../core/arsenal';
import type { Mode } from '../core/index';
import { qualityNoiseSamples } from './qualityAudio';

export type ElementalAudioEvent = 'equipment' | 'shot' | 'flight' | 'impact' | 'status' | 'release';
export interface ElementalAudioOptions {
  splash?:boolean;
  surface?: 'skin' | 'cloth' | 'armor' | 'ground';
  mode?: Mode;
  delivery?: ProjectileType;
  distance?: number;
  strength?: number;
}
export type ElementalNoiseKind = 'air' | 'liquid' | 'crackle';
export interface ElementalVoice {
  wave: 'noise' | 'sine' | 'triangle' | 'sawtooth';
  frequency: number;
  endFrequency: number;
  duration: number;
  gain: number;
  attack: number;
  delay: number;
  filter?: BiquadFilterType;
  endFilter?: number;
  q?: number;
  texture?: ElementalNoiseKind;
  shape?: 'decay' | 'swell' | 'pluck';
  tremolo?: number;
  tremoloDepth?: number;
  warble?: number;
  warbleDepth?: number;
  seed?: number;
}
const tone = (wave: ElementalVoice['wave'], frequency: number, endFrequency: number, duration: number, gain: number, delay = 0, extra: Partial<ElementalVoice> = {}): ElementalVoice =>
  ({wave, frequency, endFrequency, duration, gain, attack:.002,delay,...extra});
const noise = (frequency:number,duration:number,gain:number,filter:BiquadFilterType='lowpass',delay=0,extra:Partial<ElementalVoice>={}):ElementalVoice =>
  tone('noise',frequency,frequency,duration,gain,delay,{filter,texture:'air',...extra});

export const ELEMENTAL_AUDIO_ELEMENTS: readonly ElementType[] = Object.freeze(['kinetic','fire','ice','corrosive','gravity','adhesive','radiation','shock']);
export const ELEMENTAL_AUDIO_MAX_VOICES = 32;
export const ELEMENTAL_AUDIO_MAX_LOOPS = 14;

/** Original element foley; deliberately excludes the physical rifle/cannon report. */
export function elementalAudioRecipe(element:ElementType,event:ElementalAudioEvent,options:ElementalAudioOptions={}):readonly ElementalVoice[]{
  const source=recipes(element,event);
  // Delivery changes articulation and duration. Color never replaces the carrier's report.
  const heavy=options.mode==='mech', broad=['orb','rocket','homing'].includes(options.delivery??'');
  const beam=options.delivery==='beam'||options.delivery==='arc', sticky=options.delivery==='sticky';
  const pitch=heavy?.78:beam?1.13:sticky?.87:1;
  const length=(heavy?1.12:1)*(broad?1.15:beam?.82:1);
  return source.map(voice=>({...voice,frequency:voice.frequency*pitch,endFrequency:voice.endFrequency*pitch,
    duration:Math.min(.95,voice.duration*length),attack:Math.min(voice.duration*.45,voice.attack*length),
    delay:voice.delay*length,gain:voice.gain*(event==='equipment'?.6:heavy?1.08:1)}));
}
function recipes(element:ElementType,event:ElementalAudioEvent):ElementalVoice[]{
  if(element==='kinetic'){
    if(event==='shot')return[noise(4200,.035,.062,'highpass'),noise(1600,.065,.026,'bandpass',.018)];
    if(event==='flight')return[noise(2200,.08,.04,'bandpass',0,{attack:.02,shape:'swell'})];
    if(event==='impact')return[noise(4100,.026,.085,'highpass'),tone('sine',2640,2110,.09,.023,.006)];
    return[];
  }
  if(event==='equipment'){
    switch(element){
      case'fire':return[noise(1100,.23,.028,'lowpass',0,{texture:'crackle',attack:.025})];
      case'ice':return[tone('sine',4200,4110,.27,.014,0,{attack:.07}),noise(5800,.16,.014,'highpass',.055)];
      case'corrosive':return[noise(480,.21,.033,'lowpass',0,{texture:'liquid'}),tone('sine',440,170,.08,.014,.045)];
      case'gravity':return[tone('sine',72,103,.36,.028,0,{attack:.1,shape:'swell',warble:3.2,warbleDepth:.12})];
      case'adhesive':return[tone('triangle',180,117,.11,.02,0,{attack:.008}),noise(400,.14,.02,'lowpass',.025,{texture:'liquid'})];
      case'radiation':return[noise(6500,.009,.024,'highpass'),noise(4800,.012,.021,'highpass',.091),tone('sine',155,159,.25,.012,.025,{attack:.04,tremolo:27,tremoloDepth:.7})];
      case'shock':return[noise(3600,.022,.025,'bandpass',0,{texture:'crackle'}),tone('triangle',920,850,.13,.013,.016,{tremolo:74,tremoloDepth:.85})];
    }
  }
  if(event==='flight'){
    switch(element){
      case'fire':return[noise(1400,.17,.055,'lowpass',0,{attack:.025,shape:'swell',endFilter:350}),noise(5500,.022,.025,'highpass',.04,{texture:'crackle'})];
      case'ice':return[noise(5700,.18,.042,'highpass',0,{attack:.03,shape:'swell'}),tone('sine',4100,3200,.11,.016)];
      case'corrosive':return[noise(800,.16,.058,'bandpass',0,{texture:'liquid',attack:.018}),tone('sine',700,270,.11,.027)];
      case'gravity':return[tone('sine',61,173,.24,.07,0,{attack:.08,shape:'swell',warble:5.4,warbleDepth:.13}),noise(1200,.22,.028,'bandpass',0,{attack:.08,shape:'swell',endFilter:240})];
      case'adhesive':return[noise(500,.17,.04,'lowpass',0,{texture:'liquid'}),tone('triangle',480,170,.21,.035,0,{attack:.015,warble:9,warbleDepth:.08})];
      case'radiation':return[tone('triangle',760,880,.16,.022,0,{tremolo:39,tremoloDepth:.9}),noise(6500,.013,.026,'highpass',.04)];
      case'shock':return[noise(5900,.024,.047,'highpass',0,{texture:'crackle'}),tone('triangle',2300,710,.08,.026,.008,{tremolo:95,tremoloDepth:.9})];
    }
  }
  if(event==='shot'){
    switch(element){
      case'fire':return[noise(3300,.026,.15,'bandpass'),noise(1400,.25,.11,'lowpass',.008,{attack:.02,endFilter:450}),noise(5500,.035,.065,'highpass',.07,{texture:'crackle'}),noise(3600,.025,.03,'bandpass',.155,{texture:'crackle'})];
      case'ice':return[noise(6500,.034,.125,'highpass'),noise(3800,.16,.065,'highpass',.014,{attack:.016}),tone('sine',4700,4420,.15,.032,.02),tone('sine',6230,5870,.11,.021,.046)];
      case'corrosive':return[tone('sine',410,86,.085,.14),noise(900,.19,.12,'lowpass',.008,{texture:'liquid'}),tone('sine',930,360,.065,.052,.036),noise(3100,.045,.03,'bandpass',.085)];
      case'gravity':return[tone('sine',48,185,.22,.16,0,{attack:.085,shape:'swell',warble:3.5,warbleDepth:.1}),noise(1900,.24,.105,'bandpass',0,{attack:.08,shape:'swell',endFilter:280}),tone('triangle',280,62,.16,.05,.105,{attack:.014})];
      case'adhesive':return[tone('triangle',250,72,.14,.13),noise(710,.14,.11,'lowpass',0,{texture:'liquid'}),tone('sine',970,210,.18,.055,.014,{attack:.012,warble:7,warbleDepth:.08})];
      case'radiation':return[noise(7200,.01,.14,'highpass'),tone('triangle',870,905,.12,.046,.01,{tremolo:43,tremoloDepth:.9}),noise(6000,.012,.085,'highpass',.047),tone('sine',174,171,.19,.027,.02,{attack:.025,tremolo:31,tremoloDepth:.6})];
      case'shock':return[noise(6600,.014,.17,'highpass',0,{texture:'crackle'}),tone('sawtooth',1850,390,.075,.072,.004,{filter:'lowpass',tremolo:83,tremoloDepth:.8}),noise(3700,.021,.085,'bandpass',.04,{texture:'crackle'}),tone('sine',3300,850,.08,.02,.022)];
    }
  }
  if(event==='impact'){
    switch(element){
      case'fire':return[tone('sine',105,39,.18,.13),noise(1200,.52,.165,'lowpass',0,{attack:.012,endFilter:280}),noise(5600,.045,.085,'highpass',.052,{texture:'crackle'}),noise(4300,.03,.046,'bandpass',.17,{texture:'crackle'}),noise(4700,.025,.031,'highpass',.31,{texture:'crackle'})];
      case'ice':return[noise(6800,.025,.16,'highpass'),tone('sine',3160,2940,.13,.056,.014),tone('sine',4830,4600,.16,.042,.049),tone('sine',5720,5350,.18,.031,.112),tone('sine',7140,6520,.15,.023,.219),noise(5100,.37,.045,'highpass',.025,{attack:.03})];
      case'corrosive':return[tone('sine',330,58,.09,.18),noise(850,.24,.18,'lowpass',0,{texture:'liquid'}),noise(2200,.58,.13,'bandpass',.035,{attack:.034,endFilter:1200}),tone('sine',870,180,.08,.045,.094),tone('sine',590,120,.095,.035,.238),noise(4100,.035,.04,'highpass',.31)];
      case'gravity':return[tone('sine',175,31,.57,.21,0,{attack:.018,warble:4.4,warbleDepth:.13}),noise(1800,.4,.12,'bandpass',0,{attack:.16,shape:'swell',endFilter:180}),tone('triangle',310,76,.3,.065,.07,{attack:.04,warble:6.5,warbleDepth:.11})];
      case'adhesive':return[tone('triangle',270,49,.14,.17),noise(720,.18,.18,'lowpass',0,{texture:'liquid'}),tone('triangle',830,140,.31,.072,.02,{attack:.024,warble:8.5,warbleDepth:.09}),noise(360,.36,.065,'lowpass',.055,{texture:'liquid',attack:.025})];
      case'radiation':return[noise(6500,.014,.13,'highpass'),noise(5900,.013,.085,'highpass',.054),noise(7200,.012,.072,'highpass',.136),noise(5100,.016,.052,'highpass',.277),noise(2600,.48,.07,'bandpass',.014,{attack:.023}),tone('sine',185,171,.4,.056,0,{attack:.025,tremolo:29,tremoloDepth:.8})];
      case'shock':return[noise(5700,.015,.19,'highpass'),tone('sawtooth',3100,740,.12,.075,.007,{filter:'lowpass',tremolo:91,tremoloDepth:.9}),noise(3400,.028,.11,'bandpass',.035,{texture:'crackle'}),tone('triangle',960,480,.22,.066,.028,{tremolo:73,tremoloDepth:.93}),noise(6800,.016,.046,'highpass',.142)];
    }
  }
  if(event==='status'){
    switch(element){
      case'fire':return[noise(1200,.34,.052,'lowpass',0,{texture:'crackle',attack:.024}),noise(4100,.025,.031,'highpass',.092,{texture:'crackle'})];
      case'ice':return[noise(5700,.24,.024,'highpass',0,{attack:.045}),tone('sine',4900,4700,.08,.025,.026),tone('sine',6700,6250,.09,.015,.155)];
      case'corrosive':return[noise(2100,.41,.048,'bandpass',0,{attack:.025}),tone('sine',760,180,.075,.033,.05),noise(440,.11,.027,'lowpass',.17,{texture:'liquid'})];
      case'gravity':return[tone('sine',71,83,.42,.058,0,{attack:.075,shape:'swell',warble:4.5,warbleDepth:.17,tremolo:4.5,tremoloDepth:.62}),noise(420,.27,.022,'bandpass',.08,{attack:.06,shape:'swell'})];
      case'adhesive':return[tone('triangle',270,610,.21,.031,0,{attack:.018,warble:6.3,warbleDepth:.1}),noise(450,.22,.03,'lowpass',.032,{texture:'liquid',attack:.018})];
      case'radiation':return[noise(7000,.009,.042,'highpass'),noise(5600,.012,.027,'highpass',.177),tone('sine',163,165,.3,.019,.01,{attack:.045,tremolo:26,tremoloDepth:.82})];
      case'shock':return[noise(6200,.014,.043,'highpass',0,{texture:'crackle'}),tone('triangle',1780,1150,.055,.026,.021,{tremolo:87,tremoloDepth:.9}),noise(4100,.018,.021,'bandpass',.12,{texture:'crackle'})];
    }
  }
  switch(element){
    case'fire':return[noise(1800,.24,.035,'lowpass',0,{attack:.004,endFilter:290})];
    case'ice':return[tone('sine',5610,4620,.17,.026),tone('sine',7300,6640,.1,.014,.074)];
    case'corrosive':return[tone('sine',570,84,.14,.035),noise(2100,.19,.023,'bandpass',.025)];
    case'gravity':return[tone('sine',110,32,.33,.055,0,{attack:.015,warble:3,warbleDepth:.07})];
    case'adhesive':return[tone('triangle',680,99,.16,.052),noise(2800,.019,.036,'bandpass',.018)];
    case'radiation':return[noise(6000,.011,.027,'highpass'),tone('sine',168,123,.21,.022,.018,{attack:.017})];
    case'shock':return[noise(6900,.013,.038,'highpass'),tone('triangle',2300,390,.075,.022,.013)];
  }
}

/** Smooth attack/release, optional pressure swell or tremolo. Endpoints are exactly silent. */
export function elementalEnvelope(time:number,voice:ElementalVoice):number{
  if(!Number.isFinite(time)||time<=0||time>=voice.duration)return 0;
  const attack=Math.min(voice.duration*.48,Math.max(.0001,voice.attack));
  const rise=Math.min(1,time/attack),decay=Math.exp(-6.2*Math.max(0,time-attack)/(voice.duration-attack));
  const finish=Math.min(1,(voice.duration-time)/Math.min(.012,voice.duration*.25));
  const swell=voice.shape==='swell'?Math.sin(Math.PI*time/voice.duration)**.7:1;
  const tremolo=voice.tremolo?1-(voice.tremoloDepth??.5)*(.5+.5*Math.sin(time*Math.PI*2*voice.tremolo)):1;
  return Math.max(0,rise*decay*finish*swell*tremolo);
}

export function elementalNoiseSamples(length:number,kind:ElementalNoiseKind):Float32Array{
  const raw=qualityNoiseSamples(length,kind==='air'?0x5e3a:kind==='liquid'?0x9b1d:0xfa71);
  if(kind==='air')return raw;
  let colored=0,impulse=0;
  for(let i=0;i<raw.length;i++){
    if(kind==='liquid'){colored=colored*.94+raw[i]*.06;raw[i]=Math.max(-1,Math.min(1,colored*3.7));}
    else{impulse*=.82;if(Math.abs(raw[i])>.979)impulse=raw[i];raw[i]=impulse*.78+raw[i]*.13;}
  }
  return raw;
}
export function elementalAttenuation(options:ElementalAudioOptions={}):number{
  const strength=Number.isFinite(options.strength)?Math.min(2,Math.max(0,options.strength!)):1;
  const distance=Number.isFinite(options.distance)?Math.max(0,options.distance!):0;
  return strength/(1+(distance/11)**2);
}
interface ActiveVoice {source:AudioScheduledSourceNode;filter?:BiquadFilterNode;gain:GainNode;end:number}
interface Loop {element:ElementType;event:'equipment'|'status';options:ElementalAudioOptions;next:number;serial:number}
interface Bus {master:GainNode;compressor:DynamicsCompressorNode;limiter:WaveShaperNode;noise:Record<ElementalNoiseKind,AudioBuffer>}
function createBus(context:BaseAudioContext):Bus{
  const master=context.createGain();master.gain.value=.46;
  const compressor=context.createDynamicsCompressor();compressor.threshold.value=-14;compressor.knee.value=9;compressor.ratio.value=8;compressor.attack.value=.0015;compressor.release.value=.16;
  // Separate element overlays leave headroom for the already-authored mechanical report.
  const limiter=context.createWaveShaper();const curve=new Float32Array(1025);
  for(let i=0;i<curve.length;i++)curve[i]=.28*Math.tanh((i/(curve.length-1)*2-1)*2.5);
  limiter.curve=curve;limiter.oversample='2x';master.connect(compressor).connect(limiter).connect(context.destination);
  const noise=Object.fromEntries((['air','liquid','crackle']as const).map(kind=>{const buffer=context.createBuffer(1,context.sampleRate,context.sampleRate);buffer.getChannelData(0).set(elementalNoiseSamples(context.sampleRate,kind));return[kind,buffer];}))as Record<ElementalNoiseKind,AudioBuffer>;
  return{master,compressor,limiter,noise};
}
function schedule(context:BaseAudioContext,bus:Bus,voice:ElementalVoice,start:number,attenuation:number):ActiveVoice{
  const end=start+voice.duration;let source:AudioBufferSourceNode|OscillatorNode;let filter:BiquadFilterNode|undefined;
  if(voice.wave==='noise'){
    const noise=context.createBufferSource();noise.buffer=bus.noise[voice.texture??'air'];noise.loop=true;source=noise;
    filter=context.createBiquadFilter();filter.type=voice.filter??'lowpass';filter.Q.value=voice.q??.72;
    filter.frequency.setValueAtTime(Math.min(context.sampleRate*.44,voice.frequency),start);
    if(voice.endFilter)filter.frequency.exponentialRampToValueAtTime(Math.max(30,voice.endFilter),end);
  }else{
    const oscillator=context.createOscillator();oscillator.type=voice.wave;
    const frequencies=new Float32Array(96);
    for(let i=0;i<frequencies.length;i++){const t=i/(frequencies.length-1),base=voice.frequency*(voice.endFrequency/voice.frequency)**t;frequencies[i]=Math.max(20,Math.min(context.sampleRate*.44,base*(1+(voice.warbleDepth??0)*Math.sin(t*voice.duration*(voice.warble??0)*Math.PI*2))));}
    oscillator.frequency.setValueCurveAtTime(frequencies,start,voice.duration);source=oscillator;
    if(voice.filter){filter=context.createBiquadFilter();filter.type=voice.filter;filter.Q.value=.68;filter.frequency.value=Math.min(5200,context.sampleRate*.44);}
  }
  const gain=context.createGain(),envelope=new Float32Array(192);
  for(let i=0;i<envelope.length;i++)envelope[i]=elementalEnvelope(i/(envelope.length-1)*voice.duration,voice)*voice.gain*attenuation;
  gain.gain.setValueCurveAtTime(envelope,start,voice.duration);
  if(filter)source.connect(filter).connect(gain);else source.connect(gain);gain.connect(bus.master);
  if(voice.wave==='noise')(source as AudioBufferSourceNode).start(start,((voice.seed??17)*.037)%1);else source.start(start);
  source.stop(end);return{source,filter,gain,end};
}
function cadence(element:ElementType,event:'equipment'|'status',serial:number):number{
  const rates:Record<ElementType,number>={kinetic:1,fire:.34,ice:.46,corrosive:.48,gravity:.45,adhesive:.57,radiation:.38,shock:.25};
  return event==='equipment'?1.1+rates[element]*1.7:rates[element]*(1+((serial*7)%5)*.027);
}
export interface ElementalAudioPreviewEvent {at:number;event:ElementalAudioEvent;element:ElementType;options?:ElementalAudioOptions}
/** Offline export uses the identical recipes, textures, automation and output graph as runtime. */
export async function renderElementalAudioPreview(events:readonly ElementalAudioPreviewEvent[],duration=12,recipe=elementalAudioRecipe):Promise<AudioBuffer>{
  const seconds=Math.min(60,Math.max(1,Number.isFinite(duration)?duration:12));
  const context=new OfflineAudioContext(1,Math.ceil(seconds*48000),48000),bus=createBus(context);
  let active:ActiveVoice[]=[];
  for(const entry of [...events.slice(0,256)].sort((a,b)=>a.at-b.at)){
    if(!Number.isFinite(entry.at)||entry.at<0||entry.at>=seconds)continue;
    active=active.filter(voice=>voice.end>entry.at);
    for(const voice of recipe(entry.element,entry.event,entry.options)){
      while(active.length>=ELEMENTAL_AUDIO_MAX_VOICES){const oldest=active.shift()!;oldest.source.stop(entry.at+.002);}
      active.push(schedule(context,bus,voice,entry.at+.002+voice.delay,elementalAttenuation(entry.options)));
    }
  }
  return context.startRendering();
}

/** Bounded original elemental Foley; has no effect on combat state or browser audio before a gesture. */
export class ElementalAudio{
  constructor(private recipe=elementalAudioRecipe){}
  /** Compose element recipes in the existing bus; does not allocate another context or reset live voices. */
  setRecipe(recipe:typeof elementalAudioRecipe):void{this.recipe=recipe;}
  /** Explicit authoritative lifecycle cue, sharing the same attenuation and finite voice budget. */
  cue(element:ElementType,event:ElementalAudioEvent,options:ElementalAudioOptions={}):void{this.play(element,event,options);}
  private context:AudioContext|null=null;private bus:Bus|null=null;
  private recordingTap:MediaStreamAudioDestinationNode|null=null;
  captureStream():MediaStream|undefined{if(!this.context||!this.bus)return;if(!this.recordingTap){this.recordingTap=this.context.createMediaStreamDestination();this.bus.limiter.connect(this.recordingTap);}return this.recordingTap.stream;}
  private voices=new Set<ActiveVoice>();private loops=new Map<string,Loop>();
  private on=true;private disposed=false;private time=0;private suspended=false;
  get enabled():boolean{return this.on;}
  get unlocked():boolean{return this.context?.state==='running';}
  get activeVoiceCount():number{return this.voices.size;}
  get activeLoopCount():number{return this.loops.size;}
  async unlock():Promise<void>{
    if(this.disposed)return;
    if(!this.context){this.context=new AudioContext({latencyHint:'interactive'});this.bus=createBus(this.context);}
    if(this.context.state!=='running')await this.context.resume();
  }
  setEnabled(enabled:boolean):void{this.on=Boolean(enabled);if(!this.on)this.pause();}
  shot(element:ElementType,options:ElementalAudioOptions={}):void{this.play(element,'shot',options);}
  flight(element:ElementType,options:ElementalAudioOptions={}):void{this.play(element,'flight',options);}
  impact(element:ElementType,options:ElementalAudioOptions={}):void{this.play(element,'impact',options);}
  equipment(element:ElementType,active:boolean,options:ElementalAudioOptions={}):void{this.setLoop(element,'equipment',active,options);}
  status(element:ElementType,active:boolean,options:ElementalAudioOptions={}):void{this.setLoop(element,'status',active,options);}
  update(dt:number):void{
    if(this.disposed||!Number.isFinite(dt)||dt<=0)return;
    this.suspended=false;this.time+=Math.min(.25,dt);this.reclaim();
    if(!this.on||!this.unlocked)return;
    for(const loop of this.loops.values()){
      if(loop.next>this.time)continue;
      this.play(loop.element,loop.event,{...loop.options,strength:(loop.options.strength??1)*(loop.event==='status'?.75:1)});
      loop.next=this.time+cadence(loop.element,loop.event,loop.serial++);
    }
  }
  pause():void{this.suspended=true;for(const voice of[...this.voices])this.stop(voice);}
  dispose():void{
    if(this.disposed)return;this.pause();this.disposed=true;this.loops.clear();
    this.bus?.master.disconnect();this.bus?.compressor.disconnect();this.bus?.limiter.disconnect();
    this.recordingTap?.disconnect();this.recordingTap=null;void this.context?.close();this.context=null;this.bus=null;
  }
  private setLoop(element:ElementType,event:'equipment'|'status',active:boolean,options:ElementalAudioOptions):void{
    if(this.disposed||element==='kinetic')return;const key=`${event}:${element}`,old=this.loops.get(key);
    if(active){if(old)old.options={...options};else if(this.loops.size<ELEMENTAL_AUDIO_MAX_LOOPS)this.loops.set(key,{element,event,options:{...options},next:this.time,serial:0});}
    else if(old){this.loops.delete(key);if(event==='status'&&!this.suspended)this.play(element,'release',options);}
  }
  private play(element:ElementType,event:ElementalAudioEvent,options:ElementalAudioOptions):void{
    const context=this.context,bus=this.bus;if(this.disposed||!this.on||!context||context.state!=='running'||!bus||this.suspended)return;
    const attenuation=elementalAttenuation(options);if(attenuation<.005)return;this.reclaim();
    for(const recipe of this.recipe(element,event,options)){
      while(this.voices.size>=ELEMENTAL_AUDIO_MAX_VOICES)this.stop(this.voices.values().next().value!);
      const voice=schedule(context,bus,recipe,context.currentTime+.002+recipe.delay,attenuation);this.voices.add(voice);voice.source.onended=()=>this.release(voice);
    }
  }
  private reclaim():void{if(!this.context)return;for(const voice of this.voices)if(voice.end<=this.context.currentTime)this.release(voice);}
  private stop(voice:ActiveVoice):void{
    if(this.context){voice.gain.gain.cancelScheduledValues(this.context.currentTime);voice.gain.gain.setValueAtTime(0,this.context.currentTime);}
    try{voice.source.stop();}catch{/* May have ended naturally. */}this.release(voice);
  }
  private release(voice:ActiveVoice):void{voice.source.onended=null;voice.source.disconnect();voice.filter?.disconnect();voice.gain.disconnect();this.voices.delete(voice);}
}
