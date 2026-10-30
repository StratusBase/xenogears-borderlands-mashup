import type {ElementType} from '../core/arsenal';
import {elementalAudioRecipe} from './elementalAudio';
/** One explicit recipe per element, with fallback for all unrelated elements. No last-plugin-wins chain. */
export function composeElementRecipes(recipes:Readonly<Partial<Record<ElementType,typeof elementalAudioRecipe>>>,fallback=elementalAudioRecipe):typeof elementalAudioRecipe{
 return(element,event,options={})=>(recipes[element]??fallback)(element,event,options);
}
