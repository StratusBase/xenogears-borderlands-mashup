import type * as THREE from 'three';
import type { ElementalPresentation } from '../rendering/quality/elementalPresentation';
export interface IceLabOptions {
 beforeFactory?:(scene:THREE.Scene,camera:THREE.Camera)=>ElementalPresentation;
 beforeLabel?:string;afterLabel?:string;profile?:boolean;
 prepareAfter?:boolean;
 measuredFrames?:number;
 saveRecording?:(blob:Blob,name:string)=>Promise<void>;
 saveRun?:(scene:string,label:string,run:unknown)=>Promise<void>;
}
export const iceLabOptions:IceLabOptions={};
/** Development-only bootstrap: configure before importing the existing Game review entry. */
export function configureIceLab(options:IceLabOptions){Object.assign(iceLabOptions,options);}
