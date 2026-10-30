import * as THREE from 'three';
import {getWeaponElements} from '../../../core/arsenal';
import type {Mode} from '../../../core/index';
import {adhesiveResinAudioRecipe} from '../../../audio/adhesiveAudio';
import type {ElementModule,ElementResponse} from '../shared/composedPresentation';
import {AdhesiveResponse} from './response';
import {AlignedResinEquipment} from './alignedEquipment';
import {decorateResinProjectile,updateResinProjectile,resinTrail} from './equipment';
import type {ResinMaterialStyle} from './material';
import type {ResinStainStyle} from './stains';
import type {ResinStainKernel} from './stainShader';

export interface AdhesiveOptions {visualSeed?:number;material?:ResinMaterialStyle;stains?:ResinStainStyle;stainKernel?:ResinStainKernel}
export interface AdhesiveElementResponse extends ElementResponse {readonly adhesive:AdhesiveResponse}
/** Production registration: existing art, authoritative events, one shared audio/status/equipment owner. */
export function createAdhesiveModule(options:AdhesiveOptions={}):ElementModule{
 const material=options.material??'honey';
 // Keep the approved generic delivery carrier/payload and beam; replace only the adhesive trail.
 const flight={
  decorateProjectile:(root:THREE.Group,spec:Parameters<typeof decorateResinProjectile>[1])=>decorateResinProjectile(root,spec,material),
  updateProjectile:(root:THREE.Group,_dt:number,age:number)=>{updateResinProjectile(root,age);},
  trail:(start:THREE.Vector3,end:THREE.Vector3)=>resinTrail(start,end,material),
 };
 return{replaceImpact:true,replaceEquipment:true,replaceFlight:{trail:true},recipe:adhesiveResinAudioRecipe,flight,
  create:({scene,camera,audio}):AdhesiveElementResponse=>{
   const adhesive=new AdhesiveResponse(scene,camera,options.visualSeed,material,options.stains,options.stainKernel),feeds=new Map<THREE.Object3D,{visual:AlignedResinEquipment;dispose():void}>();let mode:Mode='pilot',disposed=false;
   const distance=(point:THREE.Vector3)=>point.distanceTo(camera.getWorldPosition(new THREE.Vector3()));
   return{
    adhesive,...flight,
    impact:event=>{if(disposed||!getWeaponElements(event.spec).includes('adhesive'))return;const surface=adhesive.impact(event);audio.impact('adhesive',{mode,delivery:event.spec.projectile,surface,distance:distance(event.point),strength:event.stage==='bomblet'?.55:event.phase==='detonate'?1:.72});},
    splash:event=>{if(disposed||event.primary||!getWeaponElements(event.spec).includes('adhesive'))return;const surface=adhesive.splash(event);audio.impact('adhesive',{mode,delivery:event.spec.projectile,surface,splash:true,distance:distance(event.point),strength:Math.min(.24,.06+event.exposure*.20)});},
    status:root=>adhesive.status(root),
    shot:(_spec,value,root)=>{mode=value;if(!disposed&&root)feeds.get(root)?.visual.shot();},
    update:(dt,_time,_spec,value)=>{if(value)mode=value;if(!disposed)adhesive.update(dt);},
    equipment:(root,appearance)=>{
     feeds.get(root)?.dispose();const visual=new AlignedResinEquipment(root,appearance,material);let released=false;
     const dispose=()=>{if(released)return;released=true;visual.dispose();if(feeds.get(root)?.visual===visual)feeds.delete(root);};feeds.set(root,{visual,dispose});
     return{update:(dt,time)=>visual.update(dt,time),dispose};
    },
    release:root=>{adhesive.release(root);feeds.get(root)?.dispose();},
    clear:()=>{adhesive.clear();for(const f of feeds.values())f.visual.clear();},
    dispose:()=>{if(disposed)return;disposed=true;for(const f of [...feeds.values()])f.dispose();adhesive.dispose();},
    get diagnostics(){return{...adhesive.diagnostics,equipmentGroups:[...feeds.values()].reduce((n,f)=>n+f.visual.groups.length,0)};},
   };
  },
 };
}
export const adhesiveModule=createAdhesiveModule();
