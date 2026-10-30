import type * as THREE from 'three';
import {ComposedElementalPresentation} from './shared/composedPresentation';
import {radiationModule} from './radiation/presentation';
import {shockModule,createShockModule,type ShockPresentationOptions} from './shock/module';

export interface GameElementOptions {shock?:ShockPresentationOptions}

/** One normal Enhanced registry. Add separately approved modules without replacing another element's factory. */
export function createGameElements(scene:THREE.Scene,camera:THREE.Camera,options:GameElementOptions={}){return new ComposedElementalPresentation(scene,camera,{radiation:radiationModule,shock:options.shock?createShockModule('capacitor',options.shock):shockModule});}
/** Same-build Radiation baseline retains approved Shock and every fallback channel. */
export function createGameElementsBeforeRadiation(scene:THREE.Scene,camera:THREE.Camera,options:GameElementOptions={}){return new ComposedElementalPresentation(scene,camera,{shock:options.shock?createShockModule('capacitor',options.shock):shockModule});}
/** Same-build Shock baseline retains every other production registration. */
export function createGameElementsBeforeShock(scene:THREE.Scene,camera:THREE.Camera){return new ComposedElementalPresentation(scene,camera,{radiation:radiationModule});}
/** Equipment-only baseline retains approved Shock impacts, C, sticky and every other module. */
export function createGameElementsBeforeShockEquipment(scene:THREE.Scene,camera:THREE.Camera,options:GameElementOptions={}){return createGameElements(scene,camera,{...options,shock:{...options.shock,equipment:'legacy'}});}
