import * as THREE from 'three';
import type {Mode} from '../../../core/index';
import {shockABAudioRecipe} from '../../../audio/shockAudio';
import {createShockFlightAudioRecipe} from '../../../audio/shockFlightAudio';
import type {ElementModule,ElementResponse} from '../shared/composedPresentation';
import {EffectVariationSequence} from '../shared/variation';
import {ShockResponse,type ShockVisualProfile,type ShockResponseOptions} from './response';
import {installShockStickyCharge} from './sticky';
import {ShockEquipment} from './equipment';
import {createShockFlight} from './flight';

export interface ShockPresentationOptions extends ShockResponseOptions {stickyCharge?:'fixed'|'legacy';equipment?:'live-terminals'|'legacy';flight?:'aligned'|'legacy'}
export interface ShockElementResponse extends ElementResponse {readonly shock:ShockResponse;readonly equipmentOwners:ReadonlyMap<THREE.Object3D,ShockEquipment>}
/** Approved A+B, heavy C and fixed sticky charge in the common lifecycle/audio owner. */
export function createShockModule(profile:ShockVisualProfile='capacitor',options:ShockPresentationOptions={}):ElementModule{
 const aligned=options.flight!=='legacy',flight=createShockFlight(options.cosmeticSeed),sticky=new EffectVariationSequence(options.cosmeticSeed);
 const hooks={decorateProjectile:(root:THREE.Group,spec:Parameters<typeof flight.decorateProjectile>[1],brand:Parameters<typeof flight.decorateProjectile>[2])=>{if(spec.projectile==='sticky'){if(options.stickyCharge!=='legacy')installShockStickyCharge(root,sticky.next(4,'sticky-charge'));}else if(aligned)flight.decorateProjectile(root,spec,brand);},updateProjectile:flight.updateProjectile,...(aligned?{trail:flight.trail,beam:flight.beam}:{})};
 return{
 replaceImpact:true,replaceEquipment:options.equipment!=='legacy',replaceFlight:aligned?{decorateProjectile:spec=>spec.projectile!=='sticky',trail:true,beam:true}:false,bombletTrails:aligned,flight:hooks,recipe:aligned?createShockFlightAudioRecipe(options.cosmeticSeed):shockABAudioRecipe,
 create:({scene,camera,audio}):ShockElementResponse=>{
  const shock=new ShockResponse(scene,camera,profile,options),equipment=new Map<THREE.Object3D,ShockEquipment>();let mode:Mode='pilot';
  const distance=(point:THREE.Vector3)=>point.distanceTo(camera.getWorldPosition(new THREE.Vector3()));
  return{
   shock,
   equipmentOwners:equipment,
   impact:event=>{const previous=shock.events.at(-1),surface=shock.impact(event),strike=shock.events.at(-1);if(strike===previous)return;audio.impact('shock',{mode,surface,distance:distance(event.point),delivery:event.spec.projectile,strength:strike?.size.heavy?1.05:event.phase==='detonate'?1:.72});},
   splash:event=>{if(event.primary)return;const previous=shock.events.at(-1),surface=shock.splash(event);if(shock.events.at(-1)===previous)return;audio.impact('shock',{mode,surface,delivery:event.spec.projectile,splash:true,strength:Math.min(.28,.08+event.exposure*.24),distance:distance(event.point)});},
   status:root=>shock.status(root),
   shot:(_spec,value,root,muzzleIndex)=>{mode=value;if(root)equipment.get(root)?.shot(muzzleIndex);},
   update:(dt,_time,_spec,value)=>{if(value)mode=value;shock.update(dt);},
   ...hooks,
   equipment:options.equipment==='legacy'?undefined:(root,appearance)=>{const visual=new ShockEquipment(root,appearance,()=>{if(equipment.get(root)===visual)equipment.delete(root);});equipment.set(root,visual);return visual;},
   release:root=>{equipment.get(root)?.dispose();},
   confirmedChain:event=>{shock.chain(event);audio.impact('shock',{mode,delivery:event.spec.projectile,splash:true,strength:.20,distance:distance(event.end)});},
   clear:()=>{shock.clear();flight.reset();sticky.reset();},dispose:()=>{for(const visual of [...equipment.values()])visual.dispose();equipment.clear();shock.dispose();},
   get diagnostics(){return{...shock.diagnostics,equipmentOwners:equipment.size,equipmentTerminals:[...equipment.values()].reduce((n,v)=>n+v.terminals.length,0)};},
  };
 },
};}
export const shockModule=createShockModule();
