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
export {GpuFrameTimer as CrowdGpuTimer} from '../rendering/quality/gpuTiming';
export type {GpuFrameSample as CrowdGpuFrame} from '../rendering/quality/gpuTiming';
