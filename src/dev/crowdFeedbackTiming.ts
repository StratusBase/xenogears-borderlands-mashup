/** Diagnostic CPU scopes and asynchronous GPU samples, shared by both feedback policies. */
export class CrowdCpuScopes {
 private active:string|null=null;
 private last=0;
 private stack:string[]=[];
 private values:Record<string,number>={};
 begin(){this.values={};this.stack=[];this.active='other';this.last=performance.now();}
 private lap(now:number){if(this.active)this.values[this.active]=(this.values[this.active]??0)+now-this.last;this.last=now;}
 enter(name:string){if(!this.active)return false;this.lap(performance.now());this.stack.push(this.active);this.active=name;return true;}
 leave(){this.lap(performance.now());this.active=this.stack.pop()??'other';}
 end(){this.lap(performance.now());this.active=null;return{...this.values};}
 wrap(owner:object,name:string,scope:string):boolean{
  const record=owner as Record<string,unknown>,original=record[name];if(typeof original!=='function')return false;
  const timer=this;record[name]=function(this:unknown,...args:unknown[]){const entered=timer.enter(scope);try{return Reflect.apply(original,this,args);}finally{if(entered)timer.leave();}};
  return true;
 }
}
export interface CrowdGpuFrame {frame:number;gpuMs:number|null;gpuInvalid?:boolean}
export class CrowdGpuTimer {
 private readonly extension:{TIME_ELAPSED_EXT:number;GPU_DISJOINT_EXT:number}|null;
 private pending:{query:WebGLQuery;frame:CrowdGpuFrame}[]=[];
 private active:{query:WebGLQuery;frame:CrowdGpuFrame}|null=null;
 readonly diagnostics={started:0,resolved:0,skipped:0,disjoint:0};
 constructor(private readonly gl:WebGL2RenderingContext){this.extension=gl.getExtension('EXT_disjoint_timer_query_webgl2');}
 get supported(){return this.extension!==null;}
 get pendingCount(){return this.pending.length;}
 poll(){
  if(!this.extension)return;
  const invalid=Boolean(this.gl.getParameter(this.extension.GPU_DISJOINT_EXT));
  while(this.pending.length&&(invalid||this.gl.getQueryParameter(this.pending[0].query,this.gl.QUERY_RESULT_AVAILABLE))){
   const entry=this.pending.shift()!;
   if(invalid){entry.frame.gpuInvalid=true;this.diagnostics.disjoint++;}
   else{entry.frame.gpuMs=this.gl.getQueryParameter(entry.query,this.gl.QUERY_RESULT)/1e6;this.diagnostics.resolved++;}
   this.gl.deleteQuery(entry.query);
  }
 }
 begin(frame:CrowdGpuFrame){
  this.poll();if(!this.extension)return;
  if(this.pending.length>=8){this.diagnostics.skipped++;return;}
  const query=this.gl.createQuery();if(!query){this.diagnostics.skipped++;return;}
  this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT,query);this.active={query,frame};this.diagnostics.started++;
 }
 end(){if(!this.active||!this.extension)return;this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);this.pending.push(this.active);this.active=null;}
 dispose(){for(const entry of this.pending)this.gl.deleteQuery(entry.query);this.pending=[];}
}
