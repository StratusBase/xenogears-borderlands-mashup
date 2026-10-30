import type * as THREE from 'three';
import {ComposedElementalPresentation} from '../shared/composedPresentation';
import {createShockModule,type ShockElementResponse,type ShockPresentationOptions} from './module';
import type {ShockResponse,ShockVisualProfile,ShockChainEvent} from './response';
export type {ShockPresentationOptions} from './module';

/** Compatibility renderer: labs and production share the exact approved Shock module. */
export class ShockPresentation extends ComposedElementalPresentation {
 readonly shock:ShockResponse;
 constructor(scene:THREE.Scene,camera:THREE.Camera,profile:ShockVisualProfile='capacitor',options:ShockPresentationOptions={}){
  super(scene,camera,{shock:createShockModule(profile,options)});this.shock=(this.responses.get('shock')as ShockElementResponse).shock;
 }
 override confirmedChain(event:ShockChainEvent):boolean{return super.confirmedChain({...event,element:'shock'});}
 override get diagnostics(){return{...super.diagnostics,shock:this.shock?.diagnostics};}
}
