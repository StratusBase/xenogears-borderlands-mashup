import * as THREE from 'three';
import type {Mode} from '../../../core/index';
import {radiationFalloutAudioRecipe} from '../../../audio/radiationAudio';
import {ComposedElementalPresentation,type ElementModule,type ElementResponse} from '../shared/composedPresentation';
import {RadiationResponse,type RadiationPulseEvent} from './response';
import {RadiationEquipment,decorateRadiationProjectile,radiationTrail,radiationBeam} from './equipment';

export interface RadiationElementResponse extends ElementResponse {readonly radiation:RadiationResponse}
/** Complete replacement capabilities; all resource/status/audio ownership stays in the shared coordinator. */
export function createRadiationModule(cosmeticSeed?:number):ElementModule{return{
 replaceImpact:true,replaceFlight:true,replaceEquipment:true,recipe:radiationFalloutAudioRecipe,
 create:({scene,camera,audio}):RadiationElementResponse=>{
  const radiation=new RadiationResponse(scene,camera,cosmeticSeed),equipment=new Map<THREE.Object3D,RadiationEquipment>();let mode:Mode='pilot',equipmentGroups=0;
  const distance=(point:THREE.Vector3)=>point.distanceTo(camera.getWorldPosition(new THREE.Vector3()));
  return{
   radiation,
   impact:event=>{const surface=radiation.impact(event);if(surface!==undefined&&!radiation.lastImpactMerged)audio.impact('radiation',{mode,delivery:event.spec.projectile,surface,distance:distance(event.point),strength:event.phase==='detonate'?1:.72});},
   splash:event=>{if(event.primary)return;const surface=radiation.splash(event);if(surface!==undefined&&radiation.lastSplashAudible)audio.impact('radiation',{mode,delivery:event.spec.projectile,surface,splash:true,distance:distance(event.point),strength:Math.min(.24,.06+event.exposure*.20)});},
   status:root=>radiation.status(root),
   shot:(spec,value,root)=>{mode=value;if(root)equipment.get(root)?.shot(spec);},
   update:(dt,_time,_spec,value)=>{if(value)mode=value;radiation.update(dt);},
   decorateProjectile:(root,spec)=>decorateRadiationProjectile(root,spec),
   trail:(start,end,spec)=>radiationTrail(start,end,spec.element!=='radiation'),
   beam:(start,end,spec)=>radiationBeam(start,end,spec.element!=='radiation'),
   equipment:(root,appearance)=>{
    const visual=new RadiationEquipment(root,appearance),count=visual.groups.length;equipmentGroups+=count;equipment.set(root,visual);let disposed=false;
    return{update:(dt,time)=>visual.update(time,dt),dispose:()=>{if(disposed)return;disposed=true;equipmentGroups-=count;if(equipment.get(root)===visual)equipment.delete(root);visual.dispose();}};
   },
   confirmedPulse:event=>{radiation.deathPulse(event);audio.impact('radiation',{mode,delivery:'orb',distance:distance(event.point),strength:.95});},
   release:root=>radiation.release(root),clear:()=>radiation.clear(),dispose:()=>{for(const v of equipment.values())v.dispose();equipment.clear();radiation.dispose();},
   get diagnostics(){return{...radiation.diagnostics,equipmentGroups};},
  };
 },
};}
export const radiationModule=createRadiationModule();

/** Compatibility entry for existing review tools; production uses the same registered module. */
export class RadiationPresentation extends ComposedElementalPresentation {
 readonly radiation:RadiationResponse;
 constructor(scene:THREE.Scene,camera:THREE.Camera,cosmeticSeed?:number){super(scene,camera,{radiation:createRadiationModule(cosmeticSeed)});this.radiation=(this.responses.get('radiation')as RadiationElementResponse).radiation;}
 deathPulse(event:RadiationPulseEvent){this.confirmedPulse({...event,element:'radiation'});}
 override get diagnostics(){const d=super.diagnostics;return{...d,radiation:this.radiation.diagnostics,radiationEquipment:(this.responses.get('radiation')as RadiationElementResponse|undefined)?.diagnostics?.equipmentGroups??0};}
}
