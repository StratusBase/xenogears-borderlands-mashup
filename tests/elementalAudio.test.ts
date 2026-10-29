import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ElementalAudio,elementalAudioRecipe,elementalEnvelope,elementalNoiseSamples,elementalAttenuation,
  ELEMENTAL_AUDIO_ELEMENTS,ELEMENTAL_AUDIO_MAX_LOOPS,ELEMENTAL_AUDIO_MAX_VOICES,
  type ElementalAudioEvent,
} from '../src/audio/elementalAudio.ts';

const phases:ElementalAudioEvent[]=['equipment','shot','flight','impact','status','release'];
test('all elements have distinct authored lifecycle shapes and retain bounded recipes',()=>{
  const identities=new Set<string>();
  for(const element of ELEMENTAL_AUDIO_ELEMENTS){
    identities.add(JSON.stringify(phases.map(phase=>elementalAudioRecipe(element,phase))));
    for(const phase of phases)for(const mode of ['pilot','mech']as const)for(const delivery of ['bullet','beam','sticky','orb','rocket','arc']as const){
      const recipe=elementalAudioRecipe(element,phase,{mode,delivery});
      if(element!=='kinetic'||['shot','flight','impact'].includes(phase))assert.ok(recipe.length>0,`${element}/${phase}`);
      assert.ok(recipe.length<=6);
      for(const voice of recipe){
        assert.ok(voice.duration>.001&&voice.duration<=.95);
        assert.ok(voice.attack>0&&voice.attack<voice.duration*.5);
        assert.ok(voice.frequency>=20&&voice.frequency<16000);
        assert.ok(voice.endFrequency>=20&&voice.endFrequency<16000);
        assert.ok(voice.gain>0&&voice.gain<=.25);
        assert.ok(voice.delay>=0&&voice.delay<1);
      }
    }
  }
  assert.equal(identities.size,8,'Element identity must change timbre, timing, texture and envelope');
  assert.ok(elementalAudioRecipe('gravity','impact').some(v=>v.shape==='swell'&&v.attack>.1));
  assert.ok(elementalAudioRecipe('ice','impact').filter(v=>v.wave==='sine').length>=4,'Shattering ice has staggered resonant shards');
  assert.ok(elementalAudioRecipe('corrosive','impact').some(v=>v.texture==='liquid'));
  assert.ok(elementalAudioRecipe('fire','impact').some(v=>v.texture==='crackle'));
  assert.ok(elementalAudioRecipe('adhesive','impact').some(v=>v.warble&&v.frequency>v.endFrequency*4));
  assert.ok(elementalAudioRecipe('radiation','impact').filter(v=>v.duration<.02).length>=4,'Radiation has a sparse Geiger cluster');
  assert.ok(elementalAudioRecipe('shock','impact').some(v=>v.tremolo&&v.tremolo>60));
});

test('all voice automation is finite, continuous and ends at digital silence',()=>{
  for(const element of ELEMENTAL_AUDIO_ELEMENTS)for(const phase of phases)for(const voice of elementalAudioRecipe(element,phase)){
    assert.equal(elementalEnvelope(0,voice),0);assert.equal(elementalEnvelope(voice.duration,voice),0);
    assert.equal(elementalEnvelope(-1,voice),0);assert.equal(elementalEnvelope(NaN,voice),0);
    let previous=0,max=0;
    for(let i=0;i<=Math.ceil(voice.duration*48000);i++){
      const value=elementalEnvelope(i/48000,voice);
      assert.ok(Number.isFinite(value)&&value>=0&&value<=1);
      assert.ok(Math.abs(value-previous)<.08,`${element}/${phase}: no abrupt envelope edge`);
      previous=value;max=Math.max(max,value);
    }
    assert.ok(max>.02,'Authored voice must be audible, not an empty envelope');
  }
});

test('noise textures are deterministic, bounded and audibly different data',()=>{
  const textures=['air','liquid','crackle']as const;
  const signatures=new Set<string>();
  for(const kind of textures){
    const a=elementalNoiseSamples(4800,kind),b=elementalNoiseSamples(4800,kind);
    assert.deepEqual(a,b);assert.ok(a.every(sample=>Number.isFinite(sample)&&Math.abs(sample)<=1));
    signatures.add(Array.from(a.subarray(0,32)).join(','));
  }
  assert.equal(signatures.size,3);
  assert.equal(elementalAttenuation({distance:11}),.5);
  assert.equal(elementalAttenuation({strength:-1}),0);
  assert.equal(elementalAttenuation({distance:NaN,strength:Infinity}),1);
  const options={mode:'mech' as const,delivery:'rocket' as const,strength:1,distance:4};const saved=structuredClone(options);
  elementalAudioRecipe('ice','impact',options);assert.deepEqual(options,saved);
});

test('locked and disposed instances do not allocate browser audio or schedule effects',()=>{
  const audio=new ElementalAudio();
  for(const element of ELEMENTAL_AUDIO_ELEMENTS){audio.shot(element);audio.impact(element);audio.flight(element);audio.equipment(element,true);audio.status(element,true);}
  assert.equal(audio.unlocked,false);assert.equal(audio.activeVoiceCount,0);
  assert.equal(audio.activeLoopCount,ELEMENTAL_AUDIO_MAX_LOOPS);
  audio.update(.05);audio.pause();audio.setEnabled(false);audio.dispose();audio.dispose();
  assert.equal(audio.activeLoopCount,0);assert.equal(audio.activeVoiceCount,0);
  assert.doesNotThrow(()=>{audio.shot('gravity');audio.status('fire',true);audio.update(.1);});
});

test('live graph bounds polyphony and one loop per element, freezes clocks and cleans every source',async()=>{
  class Param{
    value=0;
    setValueAtTime(value:number,time:number){assert.ok(Number.isFinite(value)&&time>=0);this.value=value;}
    setValueCurveAtTime(values:Float32Array,time:number,duration:number){assert.ok(time>=0&&duration>0);assert.ok(values.every(Number.isFinite));this.value=values.at(-1)!;}
    exponentialRampToValueAtTime(value:number,time:number){assert.ok(value>0);this.setValueAtTime(value,time);}
    cancelScheduledValues(){}
  }
  class Node{
    gain=new Param();frequency=new Param();Q=new Param();threshold=new Param();knee=new Param();ratio=new Param();attack=new Param();release=new Param();
    disconnected=false;connect(target:Node){return target;}disconnect(){this.disconnected=true;}
  }
  class Source extends Node{
    onended:(()=>void)|null=null;stopped=false;start(time:number){assert.ok(time>=0);}stop(){this.stopped=true;}
  }
  let context:FakeContext;
  class FakeContext{
    state='suspended';currentTime=0;sampleRate=48000;destination=new Node();sources:Source[]=[];nodes:Node[]=[];
    constructor(){context=this;}
    node(){const node=new Node();this.nodes.push(node);return node;}
    createGain(){return this.node();}createDynamicsCompressor(){return this.node();}createWaveShaper(){return this.node();}createBiquadFilter(){return this.node();}
    createBufferSource(){const source=new Source();this.sources.push(source);return source;}createOscillator(){return this.createBufferSource();}
    createBuffer(){const samples=new Float32Array(48000);return{getChannelData:()=>samples};}
    async resume(){this.state='running';}async close(){this.state='closed';}
  }
  const original=Object.getOwnPropertyDescriptor(globalThis,'AudioContext');Object.defineProperty(globalThis,'AudioContext',{configurable:true,value:FakeContext});
  try{
    const audio=new ElementalAudio();await audio.unlock();assert.equal(audio.unlocked,true);
    for(let i=0;i<50;i++)audio.impact(ELEMENTAL_AUDIO_ELEMENTS[i%8],{mode:'mech'});
    assert.equal(audio.activeVoiceCount,ELEMENTAL_AUDIO_MAX_VOICES);
    assert.ok(context!.sources.slice(0,-ELEMENTAL_AUDIO_MAX_VOICES).every(source=>source.stopped&&source.disconnected));
    audio.pause();assert.equal(audio.activeVoiceCount,0);assert.ok(context!.sources.every(source=>source.stopped&&source.disconnected));
    for(let i=0;i<20;i++)for(const element of ELEMENTAL_AUDIO_ELEMENTS){audio.status(element,true,{distance:2});audio.equipment(element,true);}
    assert.equal(audio.activeLoopCount,ELEMENTAL_AUDIO_MAX_LOOPS);
    const sources=context!.sources.length;audio.update(0);audio.update(NaN);audio.update(-1);assert.equal(context!.sources.length,sources);
    audio.update(.016);assert.ok(audio.activeVoiceCount>0&&audio.activeVoiceCount<=32);
    const afterFirst=context!.sources.length;audio.update(.016);assert.equal(context!.sources.length,afterFirst,'Loops do not recreate each frame');
    audio.setEnabled(false);assert.equal(audio.activeVoiceCount,0);audio.update(.5);assert.equal(audio.activeVoiceCount,0);
    audio.setEnabled(true);audio.update(.5);assert.ok(audio.activeVoiceCount>0);
    audio.pause();audio.update(.01);context!.currentTime=10;audio.shot('kinetic');assert.equal(audio.activeVoiceCount,2,'Expired voices reclaimed by audio time');
    audio.pause();audio.update(.01);audio.impact('fire',{distance:10000});assert.equal(audio.activeVoiceCount,0,'Distant ambience culls below audible threshold');
    audio.pause();for(const element of ELEMENTAL_AUDIO_ELEMENTS){audio.status(element,false);audio.equipment(element,false);}assert.equal(audio.activeLoopCount,0);assert.equal(audio.activeVoiceCount,0);
    audio.dispose();assert.equal(context!.state,'closed');assert.ok(context!.nodes.every(node=>node.disconnected),'All private nodes disconnected');
    await audio.unlock();assert.equal(audio.unlocked,false);
  }finally{if(original)Object.defineProperty(globalThis,'AudioContext',original);else Reflect.deleteProperty(globalThis,'AudioContext');}
});
