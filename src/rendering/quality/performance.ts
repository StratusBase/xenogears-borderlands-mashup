import type * as THREE from 'three';

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
  geometries: number; textures: number; gpuMs: Distribution | null;
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
  private readonly gl: WebGL2RenderingContext;
  private readonly timer: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  private pending: WebGLQuery[] = [];
  private active: WebGLQuery | null = null;
  private gpuMs: number | undefined;
  constructor(private renderer: THREE.WebGLRenderer) {
    this.gl = renderer.getContext() as WebGL2RenderingContext;
    this.timer = this.gl.getExtension('EXT_disjoint_timer_query_webgl2');
  }
  begin(): number {
    const now = performance.now();
    this.latest.frameMs = this.last ? now - this.last : 0; this.last = now;
    this.renderer.info.autoReset = false; this.renderer.info.reset();
    if (this.timer) {
      const gl = this.gl;
      while (this.pending.length && gl.getQueryParameter(this.pending[0], gl.QUERY_RESULT_AVAILABLE)) {
        const query = this.pending.shift()!;
        if (!gl.getParameter(this.timer.GPU_DISJOINT_EXT)) this.gpuMs = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
        else this.gpuMs = undefined;
        gl.deleteQuery(query);
      }
      if (this.pending.length < 8) {
        this.active = gl.createQuery();
        if (this.active) gl.beginQuery(this.timer.TIME_ELAPSED_EXT, this.active);
      }
    }
    return now;
  }
  end(start: number): void {
    if (this.active && this.timer) { this.gl.endQuery(this.timer.TIME_ELAPSED_EXT); this.pending.push(this.active); this.active = null; }
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
      this.resolve?.({ label: this.label, frames: samples.length,
        viewport: [this.renderer.domElement.width, this.renderer.domElement.height], dpr: this.renderer.getPixelRatio(),
        frameMs: distribution(samples.map(x=>x.frameMs)), submitMs: distribution(samples.map(x=>x.submitMs)),
        calls: distribution(samples.map(x=>x.calls)), triangles: distribution(samples.map(x=>x.triangles)),
        geometries: samples.at(-1)!.geometries, textures: samples.at(-1)!.textures,
        gpuMs: gpu.length ? distribution(gpu) : null });
      this.resolve = null;
    }
  }
  measure(label: string, frames = 180, warmup = 60): Promise<PerformanceSample> {
    if (this.samples) return Promise.reject(new Error('A performance sample is already running.'));
    this.label = label; this.target = Math.max(30, frames); this.warmup = Math.max(0, warmup); this.samples = [];
    return new Promise(resolve => { this.resolve = resolve; });
  }
  dispose(): void { this.pending.forEach(query=>this.gl.deleteQuery(query)); this.pending = []; this.renderer.info.autoReset = true; }
}
