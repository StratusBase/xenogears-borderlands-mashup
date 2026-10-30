import * as THREE from 'three';
import {getWeaponElements,type ElementType,type WeaponSpec,type BrandId} from '../../../core/arsenal';
import type {EquipmentAppearance} from '../../../core/appearance';
import type {Mode} from '../../../core/index';
import type {BallisticPresentationImpact,BallisticPresentationSplash} from '../../PlayerBallistics';
import type {EquipmentEffectPresentation} from '../../equipmentEffects';
import {createElementalProjectile,createElementalTrail,createElementalBeam} from '../elementalFlight';
import {ElementalPresentation} from '../elementalPresentation';
import type {SurfaceStatusVisual} from './surfaces';
import type {ConfirmedElementPulse} from './confirmedPulse';
import type {ConfirmedElementChain} from './confirmedChain';
import {ElementalAudio,type elementalAudioRecipe} from '../../../audio/elementalAudio';
import {corrosiveABAudioRecipe} from '../../../audio/corrosiveAudio';
import {composeElementRecipes} from '../../../audio/composeElementRecipes';

export interface ElementResponse {
 impact(event:BallisticPresentationImpact):void;
 splash?(event:BallisticPresentationSplash):void;
 status?(root:THREE.Group):SurfaceStatusVisual;
 update?(dt:number,time:number,spec?:WeaponSpec,mode?:Mode):void;
 shot?(spec:WeaponSpec,mode:Mode,root?:THREE.Object3D,muzzleIndex?:number):void;
 decorateProjectile?(root:THREE.Group,spec:WeaponSpec,brand:BrandId):void;
 updateProjectile?(root:THREE.Group,dt:number,age:number):boolean|void;
 trail?(start:THREE.Vector3,end:THREE.Vector3,spec:WeaponSpec,brand:BrandId):THREE.Group;
 beam?(start:THREE.Vector3,end:THREE.Vector3,spec:WeaponSpec,jagged:boolean,brand:BrandId):THREE.Group;
 equipment?(root:THREE.Object3D,appearance:EquipmentAppearance):EquipmentEffectPresentation;
 confirmedPulse?(event:ConfirmedElementPulse):void;
 confirmedChain?(event:ConfirmedElementChain):void;
 release?(root:THREE.Object3D):void;
 clear():void;dispose():void;
 readonly diagnostics?:Record<string,unknown>;
}
export type ElementFlightHook='decorateProjectile'|'trail'|'beam';
export type ElementFlightReplacement=boolean|((spec:WeaponSpec)=>boolean);
export interface ElementModule {
 create(context:{scene:THREE.Scene;camera:THREE.Camera;audio:ElementalAudio}):ElementResponse;
 recipe?:typeof elementalAudioRecipe;
 /** Additive is the compatibility default. Replacements own their visual and impact audio once. */
 replaceImpact?:boolean|((spec:Readonly<WeaponSpec>)=>boolean);
 /** Boolean retains full replacement semantics; a map replaces only selected flight hooks. */
 replaceFlight?:boolean|Partial<Record<ElementFlightHook,ElementFlightReplacement>>;
 replaceEquipment?:boolean;
 /** Optional resource-independent flight hooks remain valid for already-fired shots after world presentation is disposed. */
 flight?:Pick<ElementResponse,'decorateProjectile'|'updateProjectile'|'trail'|'beam'>;
}
/** One coordinator and lifecycle for additive modules and approved complete replacements. */
export class ComposedElementalPresentation extends ElementalPresentation {
 readonly responses=new Map<ElementType,ElementResponse>();
 private ownsImpact(element:ElementType,spec:Readonly<WeaponSpec>){const rule=this.modules[element]?.replaceImpact;return typeof rule==='function'?rule(spec):!!rule;}
 private flightFor(element:ElementType){return this.responses.get(element)??this.modules[element]?.flight;}
 private ownsFlight(element:ElementType,hook:ElementFlightHook,spec:WeaponSpec){const policy=this.modules[element]?.replaceFlight,rule=typeof policy==='boolean'?policy:policy?.[hook]??false,replace=typeof rule==='function'?rule(spec):rule;return replace&&(this.responses.has(element)||!!this.modules[element]?.flight?.[hook]);}
 constructor(scene:THREE.Scene,private view:THREE.Camera,private modules:Readonly<Partial<Record<ElementType,ElementModule>>>){
  super(scene,view,{corrosiveAB:true});
  const recipes:Partial<Record<ElementType,typeof elementalAudioRecipe>>={};
  for(const [element,module]of Object.entries(modules)as [ElementType,ElementModule][]){this.responses.set(element,module.create({scene,camera:view,audio:this.audio}));if(module.recipe)recipes[element]=module.recipe;}
  this.audio.setRecipe(composeElementRecipes(recipes,corrosiveABAudioRecipe));
 }
 override impact(event:BallisticPresentationImpact):void{
  this.impacts.delivery(event);
  const elements=getWeaponElements(event.spec);
  this.impactChannels(event,elements.filter(e=>!this.ownsImpact(e,event.spec)));
  for(const element of elements)this.responses.get(element)?.impact(event);
 }
 protected override splashImpact(event:BallisticPresentationSplash):void{
  for(const element of getWeaponElements(event.spec))this.responses.get(element)?.splash?.(event);
  if(!this.ownsImpact('corrosive',event.spec))super.splashImpact(event);
 }
 protected override createStatus(root:THREE.Group,element:ElementType):ReturnType<ElementalPresentation['status']>{return this.responses.get(element)?.status?.(root)??super.createStatus(root,element);}
 override projectile(spec:WeaponSpec,brand:BrandId,role?:'carrier'|'bomblet'):THREE.Group{
  const elements=getWeaponElements(spec),omitPayloads=new Set(elements.filter(e=>this.ownsFlight(e,'decorateProjectile',spec)));
  const root=omitPayloads.size?createElementalProjectile(spec,brand,{omitPayloads,role}):super.projectile(spec,brand,role);
  for(const element of elements)this.flightFor(element)?.decorateProjectile?.(root,spec,brand);return root;
 }
 override updateProjectile(root:THREE.Group,dt:number,age:number):void{let handled=false;const flight=this.responses.size?this.responses.values():Object.values(this.modules).flatMap(m=>m?.flight?[m.flight]:[]);for(const r of flight)if(r.updateProjectile?.(root,dt,age))handled=true;if(!handled)super.updateProjectile(root,dt,age);}
 override trail(start:THREE.Vector3,end:THREE.Vector3,spec:WeaponSpec,brand:BrandId,role?:'carrier'|'bomblet'):THREE.Group{
  if(spec.projectile==='cluster'&&role==='bomblet')return super.trail(start,end,spec,brand,role);
  const elements=getWeaponElements(spec),omitPayloads=new Set(elements.filter(e=>this.ownsFlight(e,'trail',spec)));if(!omitPayloads.size)return super.trail(start,end,spec,brand,role);
  const root=createElementalTrail(start,end,spec,brand,{omitPayloads,role});
  for(const element of elements){const response=this.flightFor(element),own=response?.trail;if(own)root.add(own.call(response,start,end,spec,brand));}return root;
 }
 override beam(start:THREE.Vector3,end:THREE.Vector3,spec:WeaponSpec,jagged:boolean,brand:BrandId):THREE.Group{
  const elements=getWeaponElements(spec),omitPayloads=new Set(elements.filter(e=>this.ownsFlight(e,'beam',spec)));if(!omitPayloads.size)return super.beam(start,end,spec,jagged,brand);
  const root=createElementalBeam(start,end,spec,jagged,brand,{omitPayloads});
  for(const element of elements){const response=this.flightFor(element),own=response?.beam;if(own)root.add(own.call(response,start,end,spec,jagged,brand));}return root;
 }
 protected override createEquipment(root:THREE.Object3D,appearance:EquipmentAppearance):EquipmentEffectPresentation{
  const elements=[appearance.element,appearance.secondaryElement].filter((e):e is ElementType=>!!e),modules=this.modules??{};
  const fallback=super.createEquipment(root,{...appearance,element:appearance.element&&modules[appearance.element]?.replaceEquipment?'kinetic':appearance.element,secondaryElement:appearance.secondaryElement&&modules[appearance.secondaryElement]?.replaceEquipment?undefined:appearance.secondaryElement});
  const visuals=[fallback];for(const element of elements){const own=this.responses?.get(element)?.equipment?.(root,appearance);if(own)visuals.push(own);}
  return{update:(dt,time)=>visuals.forEach(v=>v.update(dt,time)),dispose:()=>visuals.forEach(v=>v.dispose())};
 }
 override shot(spec:WeaponSpec,mode:Mode,root?:THREE.Object3D,muzzleIndex?:number):void{super.shot(spec,mode,root,muzzleIndex);for(const e of getWeaponElements(spec))this.responses.get(e)?.shot?.(spec,mode,root,muzzleIndex);}
 override update(dt:number,time:number,paused:boolean,spec:WeaponSpec,mode:Mode):void{super.update(dt,time,paused,spec,mode);if(!paused)for(const response of this.responses.values())response.update?.(dt,time,spec,mode);}
 handlesPulse(element:ElementType):boolean{return!!this.responses.get(element)?.confirmedPulse;}
 confirmedPulse(event:ConfirmedElementPulse):boolean{const handler=this.responses.get(event.element)?.confirmedPulse;if(!handler)return false;handler.call(this.responses.get(event.element),event);return true;}
 confirmedChain(event:ConfirmedElementChain):boolean{const response=this.responses.get(event.element),handler=response?.confirmedChain;if(!handler)return false;handler.call(response,event);return true;}
 override release(root:THREE.Object3D):void{super.release(root);for(const response of this.responses.values())response.release?.(root);}
 override clear():void{super.clear();for(const response of this.responses?.values()??[])response.clear();}
 override dispose():void{super.dispose();for(const response of this.responses.values())response.dispose();this.responses.clear();}
 override get diagnostics(){return{...super.diagnostics,modules:Object.fromEntries([...this.responses].map(([e,r])=>[e,r.diagnostics??{}]))};}
}
