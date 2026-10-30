import type * as THREE from 'three';
import {GpuFrameTimer,type GpuFrameSample} from './gpuTiming';

export interface Distribution { median: number; p95: number; min: number; max: number }
export function distribution(values: readonly number[]): Distribution {
  const sorted = values.filter(Number.isFinite).sort((a,b) => a-b);
  if (!sorted.length) return { median: 0, p95: 0, min: 0, max: 0 };
  return { median: sorted[Math.floor((sorted.length-1)*.5)], p95: sorted[Math.ceil((sorted.length-1)*.95)], min: sorted[0], max: sorted[sorted.length-1] };
}
export interface FrameCost { frameMs: number; submitMs: number; calls: number; triangles: number; geometries: number; textures: number; gpuMs?: number }
export interface PerformanceSample {
  label: string; frames: number; viewport: [number, number]; dpr: number;
  frameMs: Distribution; submitMs: Distribution; calls: Distribution; triangles: Distribution;
  geometries: number; textures: number;
  /** @deprecated Latched display values; use gpuUniqueMs and its coverage for comparisons. */
  gpuMs: Distribution | null;
  gpuUniqueMs?:Distribution|null;
  gpuTiming?:{schema:2;epoch:number;firstFrame:number;supported:boolean;requested:number;issued:number;resolved:number;pending:number;skipped:number;disjoint:number;lost:number;coverage:number;samples:{frame:number;ms:number}[]};
}

/** Counts the entire multipass frame, including shadow and postprocessing draws. */
export class QualityPerformance {
  latest: FrameCost = { frameMs: 0, submitMs: 0, calls: 0, triangles: 0, geometries: 0, textures: 0 };
  private last = 0;
  private samples: FrameCost[] | null = null;
  private resolve: ((sample: PerformanceSample) => void) | null = null;
  private label = '';
  private target = 0;
  private warmup = 0;
  private readonly timer:GpuFrameTimer;
  private frame=0;private epoch=0;private measuredGpu:(GpuFrameSample&{epoch:number;issued:boolean})[]=[];
  private gpuMs: number | undefined;
  constructor(private renderer: THREE.WebGLRenderer) {
    this.timer=new GpuFrameTimer(renderer.getContext() as WebGL2RenderingContext,frame=>{this.gpuMs=frame.gpuInvalid||frame.gpuLost?undefined:frame.gpuMs??undefined;});
  }
  begin(): number {
    const now = performance.now();
    this.latest.frameMs = this.last ? now - this.last : 0; this.last = now;
    this.renderer.info.autoReset = false; this.renderer.info.reset();
    const frame={frame:++this.frame,epoch:this.epoch,gpuMs:null,issued:false};frame.issued=this.timer.begin(frame);
    if(this.samples&&this.warmup<=0)this.measuredGpu.push(frame);
    return now;
  }
  end(start: number): void {
    this.timer.end();
    const info = this.renderer.info;
    this.latest = { frameMs: this.latest.frameMs, submitMs: performance.now() - start,
      calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries,
      textures: info.memory.textures, ...(this.gpuMs === undefined ? {} : {gpuMs:this.gpuMs}) };
    if (!this.samples) return;
    if (this.warmup-- > 0) return;
    this.samples.push({...this.latest});
    if (this.samples.length >= this.target) {
      const samples = this.samples; this.samples = null;
      const gpu = samples.flatMap(sample => sample.gpuMs === undefined ? [] : [sample.gpuMs]);
      const unique=this.measuredGpu.flatMap(sample=>sample.gpuMs===null||sample.gpuInvalid||sample.gpuLost?[]:[{frame:sample.frame,ms:sample.gpuMs}]);
      const timing={schema:2 as const,epoch:this.epoch,firstFrame:this.measuredGpu[0]?.frame??0,supported:this.timer.supported,requested:this.measuredGpu.length,issued:this.measuredGpu.filter(s=>s.issued).length,resolved:unique.length,pending:this.measuredGpu.filter(s=>s.issued&&s.gpuMs===null&&!s.gpuInvalid&&!s.gpuLost).length,skipped:this.measuredGpu.filter(s=>s.gpuSkipped).length,disjoint:this.measuredGpu.filter(s=>s.gpuInvalid).length,lost:this.measuredGpu.filter(s=>s.gpuLost).length,coverage:unique.length/this.measuredGpu.length,samples:unique};
      this.resolve?.({ label: this.label, frames: samples.length,
        viewport: [this.renderer.domElement.width, this.renderer.domElement.height], dpr: this.renderer.getPixelRatio(),
        frameMs: distribution(samples.map(x=>x.frameMs)), submitMs: distribution(samples.map(x=>x.submitMs)),
        calls: distribution(samples.map(x=>x.calls)), triangles: distribution(samples.map(x=>x.triangles)),
        geometries: samples.at(-1)!.geometries, textures: samples.at(-1)!.textures,
        gpuMs: gpu.length ? distribution(gpu) : null,gpuUniqueMs:unique.length?distribution(unique.map(s=>s.ms)):null,gpuTiming:timing });
      this.resolve = null;
    }
  }
  measure(label: string, frames = 180, warmup = 60): Promise<PerformanceSample> {
    if (this.samples) return Promise.reject(new Error('A performance sample is already running.'));
    this.label = label; this.target = Math.max(30, frames); this.warmup = Math.max(0, warmup); this.samples = [];this.epoch++;this.measuredGpu=[];
    return new Promise(resolve => { this.resolve = resolve; });
  }
  dispose(): void { this.timer.dispose();this.renderer.info.autoReset = true; }
}
