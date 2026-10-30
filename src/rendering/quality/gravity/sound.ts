import * as THREE from 'three';
import type {ElementalAudio} from '../../../audio/elementalAudio';
import {gravityActive,type GravityEvent,type GravityFields,type GravityWell} from '../../../core/effects/gravity/field';

/** Authoritative field cues on the existing audio engine, shared by visible and audio-only reviews. */
export class GravitySound {
 private wells:readonly GravityWell[]=[];
 private beats=new Map<string,number>();
 private listener=new THREE.Vector3();
 constructor(private audio:ElementalAudio,private camera:THREE.Camera){}
 private distance(well:GravityWell){this.camera.getWorldPosition(this.listener);return Math.hypot(well.center.x-this.listener.x,well.center.y-this.listener.y,well.center.z-this.listener.z);}
 sync(state:ReturnType<GravityFields['snapshot']>):void{this.wells=state.wells;const ids=new Set(this.wells.map(w=>w.id));for(const id of this.beats.keys())if(!ids.has(id))this.beats.delete(id);}
 event(event:GravityEvent):void{if(event.kind==='pulse')this.audio.cue('gravity','impact',{splash:true,strength:.6,distance:this.distance(event.well)});else if(event.kind==='end')this.audio.cue('gravity','release',{distance:this.distance(event.well)});}
 update(dt:number):void{if(!Number.isFinite(dt)||dt<=0)return;for(const well of this.wells){const beat=Math.floor(well.age/.55);if(gravityActive(well)&&this.beats.get(well.id)!==beat){this.beats.set(well.id,beat);this.audio.cue('gravity','status',{strength:.55,distance:this.distance(well)});}}}
 clear():void{this.wells=[];this.beats.clear();}
}
