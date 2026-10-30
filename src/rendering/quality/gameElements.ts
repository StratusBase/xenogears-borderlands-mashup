import type * as THREE from 'three';
import {ComposedElementalPresentation,type ElementModule} from './shared/composedPresentation';
import type {ElementType} from '../../core/arsenal';
import {radiationModule} from './radiation/presentation';
import {fireModule,createFireModule,type FireOptions} from './fire/presentation';
import {shockModule,createShockModule,type ShockPresentationOptions} from './shock/module';
import {createAdhesiveModule,type AdhesiveOptions} from './adhesive/module';
import {gravityModule,type GravityVisualOptions} from './gravity/response';

export interface GameElementOptions {shock?:ShockPresentationOptions;fire?:FireOptions;adhesive?:AdhesiveOptions;gravity?:GravityVisualOptions}

function productionModules(options:GameElementOptions):Partial<Record<ElementType,ElementModule>>{
 return{fire:options.fire?createFireModule({full:true,hybrid:true,...options.fire}):fireModule,radiation:radiationModule,shock:options.shock?createShockModule('capacitor',options.shock):shockModule,adhesive:createAdhesiveModule(options.adhesive),gravity:gravityModule(undefined,options.gravity)};
}
function beforeElement(scene:THREE.Scene,camera:THREE.Camera,element:ElementType,options:GameElementOptions){
 const modules=productionModules(options);delete modules[element];return new ComposedElementalPresentation(scene,camera,modules);
}

/** One normal Enhanced registry. Add approved modules here instead of replacing another element's factory. */
export function createGameElements(scene:THREE.Scene,camera:THREE.Camera,options:GameElementOptions={}){return new ComposedElementalPresentation(scene,camera,productionModules(options));}
/** Same-build integration baseline: retain every other production module while comparing radiation alone. */
export function createGameElementsBeforeRadiation(scene:THREE.Scene,camera:THREE.Camera,options:GameElementOptions={}){return beforeElement(scene,camera,'radiation',options);}

/** Same-build Fire baseline: preserve every other production element. */
export function createGameElementsBeforeFire(scene:THREE.Scene,camera:THREE.Camera,options:GameElementOptions={}){return beforeElement(scene,camera,'fire',options);}

/** Equipment-only baseline: retain the approved Fire impact, flight, sound and all other modules. */
export function createGameElementsBeforeFireEquipment(scene:THREE.Scene,camera:THREE.Camera,options:GameElementOptions={}){return createGameElements(scene,camera,{...options,fire:{...options.fire,equipment:'subtle'}});}

/** Same-build Shock baseline; preserve every other production registration. */
export function createGameElementsBeforeShock(scene:THREE.Scene,camera:THREE.Camera,options:GameElementOptions={}){return beforeElement(scene,camera,'shock',options);}

/** Equipment-only baseline: retain approved Shock impacts, C, sticky and every other element. */
export function createGameElementsBeforeShockEquipment(scene:THREE.Scene,camera:THREE.Camera,options:GameElementOptions={}){return createGameElements(scene,camera,{...options,shock:{...options.shock,equipment:'legacy'}});}

/** Same-build Adhesive baseline: omit only Adhesive, keeping all sibling options and registrations. */
export function createGameElementsBeforeAdhesive(scene:THREE.Scene,camera:THREE.Camera,options:GameElementOptions={}){return beforeElement(scene,camera,'adhesive',options);}

/** Equipment-only Gravity baseline: preserve every sibling registration, recipe and option. */
export function createGameElementsBeforeGravityEquipment(scene:THREE.Scene,camera:THREE.Camera,options:GameElementOptions={}){return createGameElements(scene,camera,{...options,gravity:{...options.gravity,equipment:'legacy'}});}

/** Same authoritative fields, equipment and sound, with world Gravity art omitted for matched rendering cost. */
export function createGameElementsBeforeGravityField(scene:THREE.Scene,camera:THREE.Camera,options:GameElementOptions={}){return createGameElements(scene,camera,{...options,gravity:{...options.gravity,field:'audio-only'}});}
