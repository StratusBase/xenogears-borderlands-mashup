// Frozen pre-finish A+B comparison only. Shared services remain shared.
import * as THREE from 'three';
import type {EquipmentAppearance} from '../../../../core/appearance';
import {getWeaponElements,type ElementType,type WeaponSpec,type BrandId} from '../../../../core/arsenal';
import type {Mode} from '../../../../core/index';
import type {BallisticPresentationImpact,BallisticPresentationSplash} from '../../../../rendering/PlayerBallistics';
import {ElementalPresentation} from '../../../../rendering/quality/elementalPresentation';
import type {ElementModule} from '../../../../rendering/quality/shared/composedPresentation';
import {composeElementRecipes} from '../../../../audio/composeElementRecipes';
import {corrosiveABAudioRecipe} from '../../../../audio/corrosiveAudio';
import {radiationFalloutAudioRecipe} from './radiationAudio';
import {RadiationResponse,type RadiationPulseEvent} from './response';
import {RadiationEquipment,decorateRadiationProjectile,radiationTrail,radiationBeam} from './equipment';

/** Public persistent-response module for the shared compositor; factory below also owns carrier/equipment accents. */
export const radiationModule:ElementModule={create:({scene,camera})=>new RadiationResponse(scene,camera),recipe:radiationFalloutAudioRecipe};

/** Isolated opt-in prototype adapter. No chaining other elements' adapters or extra audio engine. */
export class RadiationPresentation extends ElementalPresentation {
 readonly radiation:RadiationResponse;private radiationMode:Mode='pilot';private feeds=new Map<THREE.Object3D,{key:string;visual:RadiationEquipment}>();private radiationDisposed=false;
 constructor(scene:THREE.Scene,private radiationCamera:THREE.Camera,cosmeticSeed?:number){super(scene,radiationCamera,{corrosiveAB:true,audioRecipe:composeElementRecipes({radiation:radiationFalloutAudioRecipe},corrosiveABAudioRecipe)});this.radiation=new RadiationResponse(scene,radiationCamera,cosmeticSeed);}
 override impact(event:BallisticPresentationImpact){
  const elements=getWeaponElements(event.spec);if(!elements.includes('radiation')){super.impact(event);return;}
  const surface=this.radiation.impact(event);this.audio.impact('radiation',{mode:this.radiationMode,delivery:event.spec.projectile,surface,distance:event.point.distanceTo(this.radiationCamera.getWorldPosition(new THREE.Vector3())),strength:event.phase==='detonate'?1:.72});
  for(const other of elements.filter(e=>e!=='radiation'))super.impact({...event,spec:{...event.spec,element:other,secondaryElement:undefined}});
 }
 protected override splashImpact(event:BallisticPresentationSplash){super.splashImpact(event);if(event.primary||!getWeaponElements(event.spec).includes('radiation'))return;const surface=this.radiation.splash(event);this.audio.impact('radiation',{mode:this.radiationMode,delivery:event.spec.projectile,surface,splash:true,distance:event.point.distanceTo(this.radiationCamera.getWorldPosition(new THREE.Vector3())),strength:Math.min(.24,.06+event.exposure*.20)});}
 protected override createStatus(root:THREE.Group,element:ElementType):ReturnType<ElementalPresentation['status']>{return element==='radiation'?this.radiation.status(root):super.createStatus(root,element);}
 override projectile(spec:WeaponSpec,brand:BrandId){const includes=getWeaponElements(spec).includes('radiation'),root=super.projectile(includes?{...spec,element:spec.element==='radiation'?'kinetic':spec.element,secondaryElement:spec.secondaryElement==='radiation'?undefined:spec.secondaryElement}:spec,brand);root.userData.element=spec.element;root.userData.secondaryElement=spec.secondaryElement;decorateRadiationProjectile(root,spec);return root;}
 override trail(start:THREE.Vector3,end:THREE.Vector3,spec:WeaponSpec,brand:BrandId){
  if(!getWeaponElements(spec).includes('radiation'))return super.trail(start,end,spec,brand);const root=radiationTrail(start,end,spec.element!=='radiation');
  for(const other of getWeaponElements(spec).filter(e=>e!=='radiation'))root.add(super.trail(start,end,{...spec,element:other,secondaryElement:undefined},brand));return root;
 }
 override beam(start:THREE.Vector3,end:THREE.Vector3,spec:WeaponSpec,jagged:boolean,brand:BrandId){if(!getWeaponElements(spec).includes('radiation'))return super.beam(start,end,spec,jagged,brand);const root=radiationBeam(start,end,spec.element!=='radiation');for(const other of getWeaponElements(spec).filter(e=>e!=='radiation'))root.add(super.beam(start,end,{...spec,element:other,secondaryElement:undefined},jagged,brand));return root;}
 override weapon(root:THREE.Object3D,appearance:EquipmentAppearance){super.weapon(root,{...appearance,element:appearance.element==='radiation'?'kinetic':appearance.element,secondaryElement:appearance.secondaryElement==='radiation'?undefined:appearance.secondaryElement});if(this.feeds.get(root)?.key===appearance.key)return;this.feeds.get(root)?.visual.dispose();this.feeds.set(root,{key:appearance.key,visual:new RadiationEquipment(root,appearance)});}
 override shot(spec:WeaponSpec,mode:Mode){this.radiationMode=mode;super.shot(spec,mode);}
 override update(dt:number,time:number,paused:boolean,spec:WeaponSpec,mode:Mode){this.radiationMode=mode;super.update(dt,time,paused,spec,mode);if(!paused&&Number.isFinite(dt)&&dt>0){this.radiation.update(dt);for(const f of this.feeds.values())f.visual.update(time);}}
 deathPulse(event:RadiationPulseEvent){this.radiation.deathPulse(event);this.audio.impact('radiation',{mode:this.radiationMode,delivery:'orb',distance:event.point.distanceTo(this.radiationCamera.getWorldPosition(new THREE.Vector3())),strength:.95});}
 override release(root:THREE.Object3D){super.release(root);this.radiation?.release(root);this.feeds.get(root)?.visual.dispose();this.feeds.delete(root);}
 override clear(){super.clear();this.radiation?.clear();}
 override get diagnostics(){return{...super.diagnostics,radiation:this.radiation?.diagnostics??null};}
 override dispose(){if(this.radiationDisposed)return;this.radiationDisposed=true;super.dispose();this.radiation.dispose();for(const f of this.feeds.values())f.visual.dispose();this.feeds.clear();}
}
