import type * as THREE from 'three';
import {ComposedElementalPresentation,type ElementModule} from './shared/composedPresentation';
import type {ElementType} from '../../core/arsenal';
import {radiationModule} from './radiation/presentation';
import {shockModule,createShockModule,type ShockPresentationOptions} from './shock/module';
import {createAdhesiveModule,type AdhesiveOptions} from './adhesive/module';

export interface GameElementOptions {shock?:ShockPresentationOptions;adhesive?:AdhesiveOptions}

function productionModules(options:GameElementOptions):Partial<Record<ElementType,ElementModule>>{
 return{radiation:radiationModule,shock:options.shock?createShockModule('capacitor',options.shock):shockModule,adhesive:createAdhesiveModule(options.adhesive)};
}
function beforeElement(scene:THREE.Scene,camera:THREE.Camera,element:ElementType,options:GameElementOptions){
 const modules=productionModules(options);delete modules[element];return new ComposedElementalPresentation(scene,camera,modules);
}

/** One normal Enhanced registry. Unregistered channels retain their existing renderer. */
export function createGameElements(scene:THREE.Scene,camera:THREE.Camera,options:GameElementOptions={}){return new ComposedElementalPresentation(scene,camera,productionModules(options));}
/** Same-build Radiation baseline retains every other production registration and option. */
export function createGameElementsBeforeRadiation(scene:THREE.Scene,camera:THREE.Camera,options:GameElementOptions={}){return beforeElement(scene,camera,'radiation',options);}
/** Same-build Shock baseline retains every other production registration and option. */
export function createGameElementsBeforeShock(scene:THREE.Scene,camera:THREE.Camera,options:GameElementOptions={}){return beforeElement(scene,camera,'shock',options);}
/** Equipment-only baseline retains approved Shock impacts and every other production registration. */
export function createGameElementsBeforeShockEquipment(scene:THREE.Scene,camera:THREE.Camera,options:GameElementOptions={}){return createGameElements(scene,camera,{...options,shock:{...options.shock,equipment:'legacy'}});}
/** Same-build Adhesive baseline omits only Adhesive, retaining all sibling registrations and options. */
export function createGameElementsBeforeAdhesive(scene:THREE.Scene,camera:THREE.Camera,options:GameElementOptions={}){return beforeElement(scene,camera,'adhesive',options);}
