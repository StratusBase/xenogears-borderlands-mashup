import type * as THREE from 'three';
import {ComposedElementalPresentation} from './shared/composedPresentation';
import {radiationModule} from './radiation/presentation';

/** One normal Enhanced registry. Add separately approved modules without replacing another element's factory. */
export function createGameElements(scene:THREE.Scene,camera:THREE.Camera){return new ComposedElementalPresentation(scene,camera,{radiation:radiationModule});}
/** Same-build Radiation baseline; preserve the shared renderer and all fallback channels. */
export function createGameElementsBeforeRadiation(scene:THREE.Scene,camera:THREE.Camera){return new ComposedElementalPresentation(scene,camera,{});}
