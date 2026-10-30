import * as THREE from 'three';
import { getWeaponElements,type ElementType,type WeaponSpec } from '../../../core/arsenal';
import type { Mode } from '../../../core/index';
import type { BallisticPresentationImpact,BallisticPresentationSplash } from '../../PlayerBallistics';
import { ElementalPresentation } from '../elementalPresentation';
import { corrosiveABAudioRecipe } from '../../../audio/corrosiveAudio';
import { icePlateAudioRecipe } from '../../../audio/iceAudio';
import { IceResponse,type IceResponseOptions } from './response';
import {prepareIceRendering} from './prepare';

/** Opt-in adapter. The inherited equipment/projectile/status ownership stays intact. */
export class IcePresentation extends ElementalPresentation {
 readonly ice:IceResponse;
 private iceMode:Mode='pilot';
 constructor(scene:THREE.Scene,private iceCamera:THREE.Camera,options:IceResponseOptions={}){
  super(scene,iceCamera,{corrosiveAB:true,audioRecipe:(element,event,options)=>element==='ice'?icePlateAudioRecipe(element,event,options):corrosiveABAudioRecipe(element,event,options)});
  this.ice=new IceResponse(scene,iceCamera,options);
 }
 prepare(renderer:THREE.WebGLRenderer,scene:THREE.Scene,drawScene:()=>void){return prepareIceRendering(renderer,scene,this.iceCamera,this.ice,drawScene);}
 override impact(event:BallisticPresentationImpact){
  const elements=getWeaponElements(event.spec);if(!elements.includes('ice')){super.impact(event);return;}
  if(elements.length===1)this.impacts.delivery(event);
  const surface=this.ice.impact(event);this.audio.impact('ice',{mode:this.iceMode,delivery:event.spec.projectile,surface,distance:event.point.distanceTo(this.iceCamera.getWorldPosition(new THREE.Vector3())),strength:event.phase==='detonate'?1:.72});
  const other=elements.find(e=>e!=='ice');if(other)super.impact({...event,spec:{...event.spec,element:other,secondaryElement:undefined}});
 }
 protected override splashImpact(event:BallisticPresentationSplash){
  super.splashImpact(event);if(event.primary||!getWeaponElements(event.spec).includes('ice'))return;
  const surface=this.ice.splash(event);this.audio.impact('ice',{mode:this.iceMode,delivery:event.spec.projectile,surface,splash:true,distance:event.point.distanceTo(this.iceCamera.getWorldPosition(new THREE.Vector3())),strength:Math.min(.28,.08+event.exposure*.24)});
 }
 protected override createStatus(root:THREE.Group,element:ElementType):ReturnType<ElementalPresentation['status']>{return element==='ice'?this.ice.status(root):super.createStatus(root,element);}
 override shot(spec:WeaponSpec,mode:Mode){this.iceMode=mode;super.shot(spec,mode);}
 override update(dt:number,time:number,paused:boolean,spec:WeaponSpec,mode:Mode){this.iceMode=mode;super.update(dt,time,paused,spec,mode);if(!paused)this.ice.update(dt);}
 override release(root:THREE.Object3D){super.release(root);this.ice.release(root);}
 override get diagnostics(){return{...super.diagnostics,ice:this.ice.diagnostics};}
 override clear(){super.clear();this.ice?.clear();}
 override dispose(){super.dispose();this.ice.dispose();}
}
