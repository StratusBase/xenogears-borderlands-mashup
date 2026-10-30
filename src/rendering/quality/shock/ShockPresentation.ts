import * as THREE from 'three';
import { getWeaponElements,type ElementType,type BrandId } from '../../../core/arsenal';
import type { Mode } from '../../../core/index';
import type { WeaponSpec } from '../../../core/arsenal';
import type { BallisticPresentationImpact,BallisticPresentationSplash } from '../../PlayerBallistics';
import { ElementalPresentation } from '../elementalPresentation';
import { ShockResponse,type ShockChainEvent,type ShockVisualProfile,type ShockResponseOptions } from './response';
import { shockABAudioRecipe } from '../../../audio/shockAudio';
import {EffectVariationSequence} from '../shared/variation';
import {installShockStickyCharge,animateShockStickyCharge} from './sticky';

export interface ShockPresentationOptions extends ShockResponseOptions {stickyCharge?:'fixed'|'legacy'}

/** Opt-in A+B adapter. Existing presentation remains the default until moving-prototype approval. */
export class ShockPresentation extends ElementalPresentation{
 readonly shock:ShockResponse;
 private shockMode:Mode='pilot';
 private flightVariation:EffectVariationSequence;
 constructor(scene:THREE.Scene,private listener:THREE.Camera,profile:ShockVisualProfile='capacitor',private options:ShockPresentationOptions={}){super(scene,listener,{corrosiveAB:true,audioRecipe:shockABAudioRecipe});this.shock=new ShockResponse(scene,listener,profile,options);this.flightVariation=new EffectVariationSequence(options.cosmeticSeed);}
 override projectile(spec:WeaponSpec,brand:BrandId,role?:'carrier'|'bomblet'):THREE.Group{
  const root=super.projectile(spec,brand,role);
  if(spec.projectile==='sticky'&&getWeaponElements(spec).includes('shock')&&this.options.stickyCharge!=='legacy')installShockStickyCharge(root,this.flightVariation.next(4,'sticky-charge'));
  return root;
 }
 override updateProjectile(root:THREE.Group,dt:number,age:number):void{super.updateProjectile(root,dt,age);animateShockStickyCharge(root,dt,age);}
 override impact(event:BallisticPresentationImpact):void{
  const elements=getWeaponElements(event.spec);if(!elements.includes('shock')){super.impact(event);return;}
  this.impacts.delivery(event);
  const surface=this.shock.impact(event),corrosive=elements.includes('corrosive')&&this.corrosive;
  if(corrosive)corrosive.impact(event);
  this.impacts.impact(event,new Set<ElementType>(corrosive?['shock','corrosive']:['shock']));
  const heavy=this.shock.events.at(-1)?.size.heavy;
  for(const element of elements)this.audio.impact(element,{mode:this.shockMode,surface,distance:event.point.distanceTo(this.listener.getWorldPosition(new THREE.Vector3())),delivery:event.spec.projectile,strength:element==='shock'&&heavy?1.05:event.phase==='detonate'?1:.72});
 }
 protected override splashImpact(event:BallisticPresentationSplash):void{
  super.splashImpact(event);if(event.primary||!getWeaponElements(event.spec).includes('shock'))return;
  const surface=this.shock.splash(event);this.audio.impact('shock',{mode:this.shockMode,surface,delivery:event.spec.projectile,splash:true,strength:Math.min(.28,.08+event.exposure*.24),distance:event.point.distanceTo(this.listener.getWorldPosition(new THREE.Vector3()))});
 }
 protected override createStatus(root:THREE.Group,element:ElementType):ReturnType<ElementalPresentation['status']>{return element==='shock'?this.shock.status(root):super.createStatus(root,element);}
 /** Handoff seam: invoke after the combat owner confirms its existing chain recipient/damage. */
 confirmedChain(event:ShockChainEvent):void{
  this.shock.chain(event);this.audio.impact('shock',{mode:this.shockMode,delivery:event.spec.projectile,splash:true,strength:.20,distance:event.end.distanceTo(this.listener.getWorldPosition(new THREE.Vector3()))});
 }
 override update(dt:number,time:number,paused:boolean,spec:WeaponSpec,mode:Mode):void{this.shockMode=mode;super.update(dt,time,paused,spec,mode);if(!paused)this.shock.update(dt);}
 override get diagnostics(){return{...super.diagnostics,shock:this.shock.diagnostics};}
 override clear():void{super.clear();this.shock?.clear();this.flightVariation?.reset();}
 override dispose():void{super.dispose();this.shock.dispose();}
}
