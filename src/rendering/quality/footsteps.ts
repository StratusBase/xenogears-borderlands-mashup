import type { Mode } from '../../core/index';

export interface FootstepFrame {dt:number;time:number;distance:number;grounded:boolean;paused:boolean;landed?:boolean;mode:Mode}
export interface Footfall {kind:'step'|'land';side:number;variant:number;strength:number}
/** Ground displacement gates contacts; time prevents fast gear or dashes becoming a machine gun. */
export class FootstepCadence {
 private distance=0;private moving=false;private lastTime=-Infinity;private lastContact=-Infinity;private mode:Mode='pilot';private side=1;private serial=0;
 update(frame:FootstepFrame):Footfall|undefined{
  const {dt,time,mode}=frame;
  const reset=()=>{this.distance=0;this.moving=false;this.lastContact=-Infinity;};
  if(!Number.isFinite(time)){reset();return;}
  if(mode!==this.mode||time<this.lastTime){reset();this.mode=mode;}
  this.lastTime=time;
  if(frame.paused||!frame.grounded||!Number.isFinite(dt)||dt<=0||!Number.isFinite(frame.distance)||frame.distance<0){reset();return;}
  const speed=frame.distance/dt;
  // Spawn/fixture teleports and ability dashes are not alternating walking contacts.
  if(speed>(mode==='mech'?14:18)||frame.distance>1){reset();return;}
  if(frame.landed){reset();this.lastContact=time;return{kind:'land',side:this.side,variant:this.serial++%7,strength:mode==='mech'?.85:.48};}
  if(speed<.20){this.distance=0;this.moving=false;return;}
  const stride=mode==='mech'?3.05:2.05+Math.min(1,speed/11)*1.15;
  if(!this.moving){this.distance=stride*.45;this.moving=true;}
  this.distance+=frame.distance;
  const interval=mode==='mech'?.48:.29;
  if(this.distance<stride||time-this.lastContact<interval)return;
  this.distance%=stride;this.lastContact=time;this.side*=-1;
  return{kind:'step',side:this.side,variant:this.serial++%7,strength:mode==='mech'?.70:.68};
 }
}
