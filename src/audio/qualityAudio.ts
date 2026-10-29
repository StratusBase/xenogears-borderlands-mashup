import type { Mode } from '../core/index';
import type { ElementType } from '../core/arsenal';

export type QualityAudioEvent = 'fire' | 'reload-out' | 'reload-in' | 'reload-bolt'
  | 'impact-metal' | 'impact-dust' | 'impact-shield' | 'step' | 'land' | 'dry' | 'mount';

export interface QualityAudioOptions {
  footstepVariant?:number;
  surface?:'sand'|'stone'|'metal';
  mode?: Mode;
  strength?: number;
  /** Metres from the listener. Presentation only; never changes combat ranges. */
  distance?: number;
  element?: ElementType;
}

export interface QualityVoice {
  sampleOffset?:number;
  wave: 'noise' | 'sine' | 'triangle' | 'sawtooth';
  frequency: number;
  endFrequency?: number;
  duration: number;
  attack: number;
  gain: number;
  delay?: number;
  filter?: BiquadFilterType;
  resonance?: number;
}

const noise = (frequency: number, duration: number, gain: number, filter: BiquadFilterType = 'lowpass', delay = 0): QualityVoice =>
  ({ wave: 'noise', frequency, duration, attack: .001, gain, filter, delay });
const tone = (wave: 'sine' | 'triangle' | 'sawtooth', frequency: number, endFrequency: number, duration: number, gain: number, delay = 0): QualityVoice =>
  ({ wave, frequency, endFrequency, duration, attack: .002, gain, delay });

/** Original layered foley. Pure recipes are also the audition/validation contract. */
export function qualityAudioRecipe(event: QualityAudioEvent, options: QualityAudioOptions = {}): readonly QualityVoice[] {
  const mech = options.mode === 'mech';
  switch (event) {
    case 'fire': {
      const voices = mech ? [
        noise(3800, .042, .52, 'highpass'),
        tone('sine', 89, 32, .44, .66),
        noise(560, .28, .38),
        noise(1800, .11, .14, 'bandpass', .045),
        tone('triangle', 320, 92, .17, .1, .018),
      ] : [
        noise(4200, .018, .56, 'highpass'),
        tone('triangle', 190, 69, .13, .3),
        noise(1350, .075, .26),
        noise(2900, .032, .09, 'bandpass', .045),
      ];
      // The chamber contributes a quiet accent; the physical gun retains its report.
      if (options.element && options.element !== 'kinetic') {
        const f: Record<Exclude<ElementType, 'kinetic'>, number> = {
          fire: 180, ice: 2700, radiation: 870, gravity: 100, corrosive: 460, shock: 1750, adhesive: 280,
        };
        const frequency = f[options.element];
        voices.push(tone('triangle', frequency, frequency * .54, .1, .032, .015));
      }
      return voices;
    }
    case 'reload-out': return mech ? [noise(640, .34, .18), noise(2100, .07, .14, 'bandpass'), tone('triangle', 170, 71, .09, .13)]
      : [noise(2600, .035, .22, 'bandpass'), tone('triangle', 540, 240, .05, .07), noise(780, .09, .065, 'bandpass', .026)];
    case 'reload-in': return [noise(mech ? 980 : 1800, mech ? .14 : .052, .3, 'bandpass'), tone('sine', mech ? 130 : 370, mech ? 60 : 140, .12, .16), noise(3100, .028, .09, 'highpass', .033)];
    case 'reload-bolt': return [noise(mech ? 1100 : 3500, mech ? .19 : .065, .23, 'bandpass'), tone('triangle', mech ? 240 : 780, mech ? 77 : 290, .11, .09), noise(1400, .035, .09, 'bandpass', .055)];
    case 'impact-metal': return [noise(3200, .028, .24, 'highpass'), tone('triangle', mech ? 560 : 1120, mech ? 390 : 870, .15, .09), tone('sine', 2350, 2100, .115, .037, .006)];
    case 'impact-dust': return [noise(1100, .1, .19), tone('sine', 150, 65, .07, .08)];
    case 'impact-shield': return [noise(6200, .035, .17, 'bandpass'), tone('sine', 1600, 390, .14, .11), tone('triangle', 2300, 740, .11, .032)];
    case 'step': {
      const variant=Number.isFinite(options.footstepVariant)?Math.abs(Math.floor(options.footstepVariant!))%7:0,variation=.91+variant*.024,offset=variant*.103;
      const recipes=mech?[tone('sine',72,39,.15,.13),noise(430,.115,.10),noise(960,.055,.034,'bandpass',.018)]
       :[noise(380*variation,.050,.050),noise(1050*variation,.095,.039,'bandpass',.009),noise(1900*variation,.055,.013,'lowpass',.028)];
      return recipes.map(recipe=>({...recipe,attack:recipe.wave==='noise'?.004:recipe.attack,sampleOffset:recipe.wave==='noise'?offset:undefined}));
    }
    case 'land': return mech?[tone('sine',67,29,.27,.22),noise(490,.20,.13),noise(1300,.07,.035,'bandpass',.025)]
      :[noise(330,.095,.085),noise(1000,.15,.064,'bandpass',.008),noise(1700,.07,.026,'lowpass',.028)];
    case 'dry': return [noise(2400, .022, .13, 'bandpass'), tone('triangle', mech ? 270 : 740, mech ? 170 : 410, .025, .05)];
    case 'mount': return [noise(700, .42, .15), tone('triangle', 180, 45, .35, .18, .08), noise(1500, .1, .19, 'bandpass', .25)];
  }
}

/** Attack and exponential decay, exactly zero outside the scheduled voice. */
export function qualityEnvelope(time: number, duration: number, attack: number): number {
  if (!Number.isFinite(time) || time <= 0 || time >= duration || duration <= 0) return 0;
  const rise = Math.min(Math.max(attack, .0001), duration * .5);
  return time < rise ? time / rise : Math.exp(-7 * (time - rise) / (duration - rise));
}

/** Stable noise avoids allocations and random state changes during firing. */
export function qualityNoiseSamples(length: number, seed = 0x5eed): Float32Array {
  const samples = new Float32Array(Math.max(0, Math.min(480000, Math.floor(length))));
  let state = seed >>> 0;
  for (let i = 0; i < samples.length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    samples[i] = (state / 4294967296) * 2 - 1;
  }
  return samples;
}

export const QUALITY_AUDIO_MAX_VOICES = 32;
interface ActiveVoice { source: AudioScheduledSourceNode; gain: GainNode; filter?: BiquadFilterNode; end: number }

function qualityBus(context: BaseAudioContext): { master: GainNode; compressor: DynamicsCompressorNode } {
  const master = context.createGain();
  master.gain.value = .42;
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -12; compressor.knee.value = 8; compressor.ratio.value = 6;
  compressor.attack.value = .002; compressor.release.value = .14;
  master.connect(compressor).connect(context.destination);
  return { master, compressor };
}

function scheduleVoice(context: BaseAudioContext, target: AudioNode, noiseBuffer: AudioBuffer, recipe: QualityVoice, start: number, attenuation: number): ActiveVoice {
  const end = start + recipe.duration;
  let source: AudioBufferSourceNode | OscillatorNode;
  let filter: BiquadFilterNode | undefined;
  if (recipe.wave === 'noise') {
    const bufferSource = context.createBufferSource();
    bufferSource.buffer = noiseBuffer; source = bufferSource;
    filter = context.createBiquadFilter(); filter.type = recipe.filter ?? 'lowpass';
    filter.frequency.setValueAtTime(Math.min(recipe.frequency, context.sampleRate * .45), start);
    filter.Q.value = recipe.resonance ?? .7;
  } else {
    const oscillator = context.createOscillator(); oscillator.type = recipe.wave;
    oscillator.frequency.setValueAtTime(recipe.frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, recipe.endFrequency ?? recipe.frequency), end);
    source = oscillator;
  }
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(Math.min(.85, recipe.gain * attenuation), start + recipe.attack);
  gain.gain.exponentialRampToValueAtTime(.0001, end - .001);
  gain.gain.linearRampToValueAtTime(0, end);
  if (filter) source.connect(filter).connect(gain); else source.connect(gain);
  gain.connect(target);if(recipe.wave==='noise')(source as AudioBufferSourceNode).start(start,recipe.sampleOffset??0);else source.start(start);source.stop(end);
  return { source, gain, filter, end };
}

export interface QualityAudioPreviewEvent { at: number; event: QualityAudioEvent; options?: QualityAudioOptions }

/** Browser QA/export uses the same graph and gain staging as live gameplay. */
export async function renderQualityAudioPreview(events: readonly QualityAudioPreviewEvent[], duration = 8): Promise<AudioBuffer> {
  const seconds = Math.max(1, Math.min(30, Number.isFinite(duration) ? duration : 8));
  const context = new OfflineAudioContext(1, Math.ceil(seconds * 48000), 48000);
  const { master } = qualityBus(context);
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  buffer.getChannelData(0).set(qualityNoiseSamples(context.sampleRate));
  for (const entry of events.slice(0, 128)) {
    if (!Number.isFinite(entry.at) || entry.at < 0 || entry.at >= seconds) continue;
    const options = entry.options ?? {};
    const strength = Number.isFinite(options.strength) ? Math.max(0, Math.min(2, options.strength!)) : 1;
    const distance = Number.isFinite(options.distance) ? Math.max(0, options.distance!) : 0;
    const attenuation = strength / (1 + (distance / 12) ** 2);
    for (const recipe of qualityAudioRecipe(entry.event, options)) {
      scheduleVoice(context, master, buffer, recipe, entry.at + .002 + (recipe.delay ?? 0), attenuation);
    }
  }
  return context.startRendering();
}

/** No context, timers or sound until unlock() is called from a user gesture. */
export class QualityAudio {
  private recordingTap:MediaStreamAudioDestinationNode|null=null;
  captureStream():MediaStream|undefined{if(!this.context||!this.compressor)return;if(!this.recordingTap){this.recordingTap=this.context.createMediaStreamDestination();this.compressor.connect(this.recordingTap);}return this.recordingTap.stream;}
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private readonly voices = new Set<ActiveVoice>();
  private disposed = false;
  private on = true;

  get enabled(): boolean { return this.on; }
  get unlocked(): boolean { return this.context?.state === 'running'; }
  get activeVoiceCount(): number { return this.voices.size; }

  async unlock(): Promise<void> {
    if (this.disposed) return;
    if (!this.context) {
      const context = new AudioContext({ latencyHint: 'interactive' });
      this.context = context;
      const bus = qualityBus(context);
      this.master = bus.master; this.compressor = bus.compressor;
      this.noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
      this.noiseBuffer.getChannelData(0).set(qualityNoiseSamples(context.sampleRate));
    }
    if (this.context.state !== 'running') await this.context.resume();
  }

  setEnabled(enabled: boolean): void {
    this.on = enabled;
    if (!enabled) this.pause();
  }

  play(event: QualityAudioEvent, options: QualityAudioOptions = {}): void {
    const context = this.context;
    if (!context || context.state !== 'running' || !this.master || !this.noiseBuffer || !this.on || this.disposed) return;
    const strength = Number.isFinite(options.strength) ? Math.max(0, Math.min(2, options.strength!)) : 1;
    const distance = Number.isFinite(options.distance) ? Math.max(0, options.distance!) : 0;
    const attenuation = strength / (1 + (distance / 12) ** 2);
    if (attenuation < .005) return;
    // Ended callbacks can be delayed in a background tab; reclaim by audio time too.
    for (const voice of this.voices) if (voice.end <= context.currentTime) this.release(voice);
    const recipes = qualityAudioRecipe(event, options);
    for (const recipe of recipes) {
      while (this.voices.size >= QUALITY_AUDIO_MAX_VOICES) {
        const oldest = this.voices.values().next().value as ActiveVoice;
        try { oldest.source.stop(); } catch { /* Already ended. */ }
        this.release(oldest);
      }
      const start = context.currentTime + .002 + (recipe.delay ?? 0);
      const voice = scheduleVoice(context, this.master, this.noiseBuffer, recipe, start, attenuation);
      this.voices.add(voice);
      voice.source.onended = () => this.release(voice);
    }
  }

  /** Cancels tails as the game pauses; does not advance a separate sound clock. */
  pause(): void {
    const context = this.context;
    for (const voice of this.voices) {
      if (context) {
        voice.gain.gain.cancelScheduledValues(context.currentTime);
        voice.gain.gain.setValueAtTime(0, context.currentTime);
      }
      try { voice.source.stop(); } catch { /* Already ended. */ }
      this.release(voice);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.pause();
    this.master?.disconnect();
    this.compressor?.disconnect();
    void this.context?.close();
    this.recordingTap?.disconnect();this.recordingTap=null;this.context = null; this.noiseBuffer = null; this.master = null; this.compressor = null;
  }

  private release(voice: ActiveVoice): void {
    voice.source.onended = null;
    voice.source.disconnect(); voice.filter?.disconnect(); voice.gain.disconnect();
    this.voices.delete(voice);
  }
}
