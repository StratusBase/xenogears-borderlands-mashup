import * as THREE from 'three';
import {getWeaponElements,type ElementType,type WeaponSpec} from '../../../core/arsenal';
import type {Mode} from '../../../core/index';
import type {BallisticPresentationImpact,BallisticPresentationSplash} from '../../PlayerBallistics';
import {ElementalPresentation} from '../elementalPresentation';
import type {SurfaceStatusVisual} from './surfaces';
import {ElementalAudio,type elementalAudioRecipe} from '../../../audio/elementalAudio';
import {corrosiveABAudioRecipe} from '../../../audio/corrosiveAudio';
import {composeElementRecipes} from '../../../audio/composeElementRecipes';

export interface ElementResponse {
 impact(event:BallisticPresentationImpact):void;
 splash?(event:BallisticPresentationSplash):void;
 status?(root:THREE.Group):SurfaceStatusVisual;
 update?(dt:number,time:number):void;
 release?(root:THREE.Object3D):void;
 clear():void;dispose():void;
 readonly diagnostics?:Record<string,unknown>;
}
export interface ElementModule {
 create(context:{scene:THREE.Scene;camera:THREE.Camera;audio:ElementalAudio}):ElementResponse;
 recipe?:typeof elementalAudioRecipe;
}
/** Composes long-lived element responses alongside the existing per-shot carrier presentation. */
export class ComposedElementalPresentation extends ElementalPresentation {
 readonly responses=new Map<ElementType,ElementResponse>();
 private activeMode:Mode='pilot';
 override readonly splash=(event:BallisticPresentationSplash)=>{
  const own=getWeaponElements(event.spec).filter(element=>this.responses.has(element));
  for(const element of own)this.responses.get(element)!.splash?.({...event,spec:{...event.spec,element,secondaryElement:undefined}});
  if(!event.primary&&getWeaponElements(event.spec).includes('corrosive')){const surface=this.corrosive?.splash(event);this.audio.impact('corrosive',{surface,mode:this.activeMode,delivery:event.spec.projectile,splash:true,distance:event.point.distanceTo(this.view.getWorldPosition(new THREE.Vector3())),strength:Math.min(.28,.08+event.exposure*.24)});}
 };
 constructor(scene:THREE.Scene,private view:THREE.Camera,modules:Readonly<Partial<Record<ElementType,ElementModule>>>){
  super(scene,view,{corrosiveAB:true});
  const recipes:Partial<Record<ElementType,typeof elementalAudioRecipe>>={};
  for(const [element,module]of Object.entries(modules)as [ElementType,ElementModule][]){this.responses.set(element,module.create({scene,camera:view,audio:this.audio}));if(module.recipe)recipes[element]=module.recipe;}
  this.audio.setRecipe(composeElementRecipes(recipes,corrosiveABAudioRecipe));
 }
 override impact(event:BallisticPresentationImpact):void{
  // Preserve original delivery, channel weights, contact effects and one audio cue per channel.
  super.impact(event);
  for(const element of getWeaponElements(event.spec))this.responses.get(element)?.impact(event);
 }
 override shot(spec:WeaponSpec,mode:Mode):void{this.activeMode=mode;super.shot(spec,mode);}
 override status(root:THREE.Group,element:ElementType):ReturnType<ElementalPresentation['status']>{return this.responses.get(element)?.status?.(root)??super.status(root,element);}
 override update(dt:number,time:number,paused:boolean,spec:WeaponSpec,mode:Mode):void{super.update(dt,time,paused,spec,mode);if(!paused)for(const response of this.responses.values())response.update?.(dt,time);}
 override release(root:THREE.Object3D):void{super.release(root);for(const response of this.responses.values())response.release?.(root);}
 override clear():void{super.clear();for(const response of this.responses?.values()??[])response.clear();}
 override dispose():void{super.dispose();for(const response of this.responses.values())response.dispose();this.responses.clear();}
 override get diagnostics(){return{...super.diagnostics,modules:Object.fromEntries([...this.responses].map(([e,r])=>[e,r.diagnostics??{}]))};}
}
