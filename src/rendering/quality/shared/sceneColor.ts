import type * as THREE from 'three';

/** Borrowed, linear ink-color and opaque depth from the existing compositor. Valid only for this draw. */
export interface SceneColorFrame {color:THREE.Texture;depth:THREE.DepthTexture;width:number;height:number;pixelRatio?:number}
type Consumer=(frame:Readonly<SceneColorFrame>)=>void;
const consumers=new WeakMap<THREE.Scene,Set<Consumer>>();
/** No target ownership or extra scene render. Disposing an effect must release its binding. */
export function bindSceneColor(scene:THREE.Scene,consumer:Consumer):()=>void {
 let set=consumers.get(scene);if(!set){set=new Set();consumers.set(scene,set);}set.add(consumer);
 let active=true;return()=>{if(!active)return;active=false;set!.delete(consumer);if(!set!.size)consumers.delete(scene);};
}
export function publishSceneColor(scene:THREE.Scene,frame:Readonly<SceneColorFrame>):void{for(const consumer of consumers.get(scene)??[])consumer(frame);}
/** Sampling surfaces draw before every ordinary overlay, including opaque overlay materials. */
export function markSceneColorSurface<T extends THREE.Object3D>(object:T):T{object.userData.sceneColorSurface=true;return object;}
export function isSceneColorSurface(object:THREE.Object3D):boolean{return object.userData.sceneColorSurface===true;}
