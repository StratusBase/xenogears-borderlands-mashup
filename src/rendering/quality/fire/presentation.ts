import * as THREE from 'three';
import type {Mode} from '../../../core/index';
import {fireABCAudioRecipe} from '../../../audio/fireAudio';
import {ComposedElementalPresentation,type ElementModule,type ElementResponse} from '../shared/composedPresentation';
import {FireResponse} from './response';
import {FireEquipment,type FireEquipmentStyle} from './equipment';
import {decorateFireProjectile,animateFirePayload,createFireTrail} from './flight';

export interface FireOptions {hybrid?:boolean;full?:boolean;seed?:number;equipment?:FireEquipmentStyle}
export interface FireElementResponse extends ElementResponse {readonly fire:FireResponse}
/** One replaceable Fire channel in the common lifecycle, audio engine and production registry. */
export function createFireModule(options:FireOptions={}):ElementModule{
 const flight:ElementModule['flight']=options.full?{decorateProjectile:(root,spec)=>{decorateFireProjectile(root,spec);},updateProjectile:animateFirePayload,trail:(start,end,spec,brand)=>createFireTrail(start,end,spec,brand,false,false,true),beam:(start,end,spec,jagged,brand)=>createFireTrail(start,end,spec,brand,true,jagged,true)}:undefined;
 return{
 replaceImpact:true,replaceFlight:!!options.full,replaceEquipment:!!options.full,recipe:fireABCAudioRecipe,flight,
 create:({scene,camera,audio}):FireElementResponse=>{
  const fire=new FireResponse(scene,camera,{...options,hybrid:options.full||options.hybrid}),equipment=new Map<THREE.Object3D,FireEquipment>();let mode:Mode='pilot';
  const distance=(p:THREE.Vector3)=>p.distanceTo(camera.getWorldPosition(new THREE.Vector3()));
  return{
   fire,
   impact:event=>{const surface=fire.impact(event);audio.impact('fire',{mode,delivery:event.spec.projectile,surface,distance:distance(event.point),strength:event.stage==='bomblet'?.55:event.phase==='detonate'?1:.72});},
   splash:event=>{if(event.primary)return;const surface=fire.splash(event);audio.impact('fire',{mode,delivery:event.spec.projectile,surface,splash:true,distance:distance(event.point),strength:Math.min(.28,.07+event.exposure*.22)});},
   status:root=>fire.status(root),
   shot:(spec,value,root,muzzleIndex)=>{mode=value;if(root)equipment.get(root)?.shot(muzzleIndex);},
   update:(dt,_time,_spec,value)=>{if(value)mode=value;fire.update(dt);},
   ...flight,
   equipment:options.full?(root,appearance)=>{const v=new FireEquipment(root,appearance,()=>{if(equipment.get(root)===v)equipment.delete(root);},options.equipment);equipment.set(root,v);return v;}:undefined,
   release:root=>{equipment.get(root)?.dispose();},
   clear:()=>fire.clear(),dispose:()=>{for(const e of [...equipment.values()])e.dispose();equipment.clear();fire.dispose();},
   get diagnostics(){return{...fire.diagnostics,equipment:equipment.size,equipmentViews:[...equipment.values()].map(e=>e.diagnostics)};},
  };
 },
};}
/** Compatibility renderer for the earlier volume/proof labs. Production registers the identical module beside other elements. */
export class FirePresentation extends ComposedElementalPresentation {
 readonly fire:FireResponse;
 constructor(scene:THREE.Scene,camera:THREE.Camera,options:FireOptions={}){super(scene,camera,{fire:createFireModule(options)});this.fire=(this.responses.get('fire')as FireElementResponse).fire;}
 override get diagnostics(){return{...super.diagnostics,fire:this.fire?.diagnostics??null};}
}


export const fireModule=createFireModule({hybrid:true,full:true});
