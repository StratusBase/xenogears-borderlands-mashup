import * as THREE from 'three';
import type {EquipmentAppearance} from '../../../core/appearance';
import {getWeaponElements,type ElementType,type WeaponSpec,type BrandId} from '../../../core/arsenal';
import type {Mode} from '../../../core/index';
import type {BallisticPresentationImpact,BallisticPresentationSplash} from '../../PlayerBallistics';
import {ElementalPresentation} from '../elementalPresentation';
import {adhesiveResinAudioRecipe} from '../../../audio/adhesiveAudio';
import {AdhesiveResponse} from './response';
import type {ResinStainStyle} from './stains';
import type {ResinMaterialStyle} from './material';
import {ResinEquipment,decorateResinProjectile,updateResinProjectile,resinTrail} from './equipment';

/** Opt-in public adapter. Existing GamePresentation factory/lifecycle remains the integration seam. */
export class AdhesivePresentation extends ElementalPresentation {
 readonly adhesive:AdhesiveResponse;private resinMode:Mode='pilot';private feeds=new Map<THREE.Object3D,{key:string;visual:ResinEquipment}>();private resinDisposed=false;
 private materialStyle:ResinMaterialStyle;
 constructor(scene:THREE.Scene,private resinCamera:THREE.Camera,options:{visualSeed?:number;material?:ResinMaterialStyle;stains?:ResinStainStyle}={}){super(scene,resinCamera,{corrosiveAB:true,audioRecipe:adhesiveResinAudioRecipe});this.materialStyle=options.material??'honey';this.adhesive=new AdhesiveResponse(scene,resinCamera,options.visualSeed,this.materialStyle,options.stains);}
 override impact(event:BallisticPresentationImpact){const elements=getWeaponElements(event.spec);if(!elements.includes('adhesive')){super.impact(event);return;}const surface=this.adhesive.impact(event);for(const other of elements.filter(e=>e!=='adhesive'))super.impact({...event,spec:{...event.spec,element:other,secondaryElement:undefined}});this.audio.impact('adhesive',{mode:this.resinMode,delivery:event.spec.projectile,surface,distance:event.point.distanceTo(this.resinCamera.getWorldPosition(new THREE.Vector3())),strength:event.phase==='detonate'?1:.72});}
 protected override splashImpact(event:BallisticPresentationSplash){super.splashImpact(event);if(event.primary||!getWeaponElements(event.spec).includes('adhesive'))return;const surface=this.adhesive.splash(event);this.audio.impact('adhesive',{mode:this.resinMode,delivery:event.spec.projectile,surface,splash:true,distance:event.point.distanceTo(this.resinCamera.getWorldPosition(new THREE.Vector3())),strength:Math.min(.24,.06+event.exposure*.20)});}
 protected override createStatus(root:THREE.Group,element:ElementType):ReturnType<ElementalPresentation['status']>{return element==='adhesive'?this.adhesive.status(root):super.createStatus(root,element);}
 override projectile(spec:WeaponSpec,brand:BrandId){const root=super.projectile(spec,brand);decorateResinProjectile(root,spec,this.materialStyle);return root;}
 override trail(start:THREE.Vector3,end:THREE.Vector3,spec:WeaponSpec,brand:BrandId){if(!getWeaponElements(spec).includes('adhesive'))return super.trail(start,end,spec,brand);const root=resinTrail(start,end,this.materialStyle),other=getWeaponElements(spec).find(e=>e!=='adhesive');if(other)root.add(super.trail(start,end,{...spec,element:other,secondaryElement:undefined},brand));return root;}
 override updateProjectile(root:THREE.Group,dt:number,age:number){super.updateProjectile(root,dt,age);updateResinProjectile(root,age);}
 override weapon(root:THREE.Object3D,appearance:EquipmentAppearance){super.weapon(root,appearance);if(this.feeds.get(root)?.key===appearance.key)return;this.feeds.get(root)?.visual.dispose();this.feeds.set(root,{key:appearance.key,visual:new ResinEquipment(root,appearance,this.materialStyle)});}
 override shot(spec:WeaponSpec,mode:Mode){this.resinMode=mode;super.shot(spec,mode);}
 override update(dt:number,time:number,paused:boolean,spec:WeaponSpec,mode:Mode){this.resinMode=mode;super.update(dt,time,paused,spec,mode);if(!paused)this.adhesive.update(dt);}
 override release(root:THREE.Object3D){super.release(root);this.adhesive?.release(root);this.feeds.get(root)?.visual.dispose();this.feeds.delete(root);}
 override clear(){super.clear();this.adhesive?.clear();}
 override get diagnostics(){return{...super.diagnostics,adhesive:this.adhesive?.diagnostics??null};}
 override dispose(){if(this.resinDisposed)return;this.resinDisposed=true;super.dispose();this.adhesive.dispose();for(const feed of this.feeds.values())feed.visual.dispose();this.feeds.clear();}
}
