import * as THREE from 'three';
import { getWeaponElements,type ElementType,type WeaponSpec } from '../../../core/arsenal';
import type { Mode } from '../../../core/index';
import type { BallisticPresentationImpact,BallisticPresentationSplash } from '../../PlayerBallistics';
import { ElementalPresentation } from '../elementalPresentation';
import { fireABCAudioRecipe } from '../../../audio/fireAudio';
import { FireResponse } from './response';

/** Opt-in adapter. Existing projectiles, equipment, other elements and combat remain independently usable. */
export class FirePresentation extends ElementalPresentation {
 readonly fire:FireResponse;
 private fireMode:Mode='pilot';private fireDisposed=false;
 constructor(scene:THREE.Scene,private readonly fireCamera:THREE.Camera,options:{hybrid?:boolean}={}){
  super(scene,fireCamera,{corrosiveAB:true,audioRecipe:fireABCAudioRecipe});this.fire=new FireResponse(scene,fireCamera,options);
 }
 protected override splashImpact(event:BallisticPresentationSplash){super.splashImpact(event);if(event.primary||!getWeaponElements(event.spec).includes('fire'))return;const surface=this.fire.splash(event);this.audio.impact('fire',{mode:this.fireMode,delivery:event.spec.projectile,splash:true,surface,distance:event.point.distanceTo(this.fireCamera.getWorldPosition(new THREE.Vector3())),strength:Math.min(.28,.07+event.exposure*.22)});}
 override impact(event:BallisticPresentationImpact){
  const elements=getWeaponElements(event.spec);if(!elements.includes('fire')){super.impact(event);return;}
  const surface=this.fire.impact(event);
  for(const element of elements.filter(e=>e!=='fire'))super.impact({...event,spec:{...event.spec,element,secondaryElement:undefined}});
  this.audio.impact('fire',{mode:this.fireMode,delivery:event.spec.projectile,surface,distance:event.point.distanceTo(this.fireCamera.getWorldPosition(new THREE.Vector3())),strength:event.phase==='detonate'?1:.72});
 }
 protected override createStatus(root:THREE.Group,element:ElementType){return element==='fire'?this.fire.status(root):super.createStatus(root,element);}
 override shot(spec:WeaponSpec,mode:Mode){this.fireMode=mode;super.shot(spec,mode);}
 override update(dt:number,time:number,paused:boolean,spec:WeaponSpec,mode:Mode){this.fireMode=mode;if(!paused)this.fire.update(dt);super.update(dt,time,paused,spec,mode);}
 override clear(){super.clear();this.fire?.clear();}
 override get diagnostics(){return{...super.diagnostics,fire:this.fire?.diagnostics??null};}
 override dispose(){if(this.fireDisposed)return;this.fireDisposed=true;super.dispose();this.fire.dispose();}
}
