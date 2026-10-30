/** Nonblocking GPU timing; each result stays attached to the frame that issued it. */
export interface GpuFrameSample {frame:number;gpuMs:number|null;gpuInvalid?:boolean;gpuLost?:boolean;gpuSkipped?:boolean}
export class GpuFrameTimer {
 private readonly extension:{TIME_ELAPSED_EXT:number;GPU_DISJOINT_EXT:number}|null;
 private pending:{query:WebGLQuery;frame:GpuFrameSample}[]=[];
 private active:{query:WebGLQuery;frame:GpuFrameSample}|null=null;
 readonly diagnostics={started:0,resolved:0,skipped:0,disjoint:0,lost:0};
 constructor(private readonly gl:WebGL2RenderingContext,private readonly resolved?:(frame:GpuFrameSample)=>void){this.extension=gl.getExtension('EXT_disjoint_timer_query_webgl2');}
 get supported(){return this.extension!==null;}
 get pendingCount(){return this.pending.length;}
 poll(){
  if(!this.extension||!this.pending.length)return;
  if(this.gl.isContextLost()){for(const entry of this.pending){entry.frame.gpuLost=true;this.diagnostics.lost++;this.gl.deleteQuery(entry.query);this.resolved?.(entry.frame);}this.pending=[];return;}
  const ready:{query:WebGLQuery;frame:GpuFrameSample;ms:number}[]=[];
  while(this.pending.length&&this.gl.getQueryParameter(this.pending[0].query,this.gl.QUERY_RESULT_AVAILABLE)){
   const entry=this.pending.shift()!;ready.push({...entry,ms:this.gl.getQueryParameter(entry.query,this.gl.QUERY_RESULT)/1e6});
  }
  // Check after reading results: a disjoint interval invalidates ready and pending queries.
  if(this.gl.getParameter(this.extension.GPU_DISJOINT_EXT)){
   for(const entry of [...ready,...this.pending]){entry.frame.gpuInvalid=true;this.diagnostics.disjoint++;this.gl.deleteQuery(entry.query);this.resolved?.(entry.frame);}this.pending=[];
  }else for(const entry of ready){entry.frame.gpuMs=entry.ms;this.diagnostics.resolved++;this.gl.deleteQuery(entry.query);this.resolved?.(entry.frame);}
 }
 begin(frame:GpuFrameSample):boolean{
  this.poll();if(!this.extension)return false;
  if(this.gl.isContextLost()){frame.gpuLost=true;this.diagnostics.lost++;return false;}
  if(this.active||this.pending.length>=8||this.gl.getQuery(this.extension.TIME_ELAPSED_EXT,this.gl.CURRENT_QUERY)) {frame.gpuSkipped=true;this.diagnostics.skipped++;return false;}
  const query=this.gl.createQuery();if(!query){frame.gpuSkipped=true;this.diagnostics.skipped++;return false;}
  this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT,query);this.active={query,frame};this.diagnostics.started++;return true;
 }
 end(){if(!this.active||!this.extension)return;if(this.gl.isContextLost()){this.active.frame.gpuLost=true;this.diagnostics.lost++;this.gl.deleteQuery(this.active.query);}else{this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);this.pending.push(this.active);}this.active=null;}
 dispose(){if(this.active&&this.extension){if(!this.gl.isContextLost())this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);this.gl.deleteQuery(this.active.query);this.active=null;}for(const entry of this.pending)this.gl.deleteQuery(entry.query);this.pending=[];}
}
