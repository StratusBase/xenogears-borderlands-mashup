import * as THREE from 'three';
import type { EquipmentAppearance } from '../../core/appearance';
import { getWeaponElements, type ElementType, type WeaponSpec, type BrandId } from '../../core/arsenal';
import type { Mode } from '../../core/index';
import type { BallisticPresentation, BallisticPresentationImpact,BallisticPresentationSplash } from '../PlayerBallistics';
import { setEquipmentEffectPresentation, setEquipmentEffectFactory, type EquipmentEffectPresentation } from '../equipmentEffects';
import { ElementalEquipment, ElementalStatus } from './elementalSurfaces';
import { createElementalProjectile, createElementalTrail, createElementalBeam, updateElementalProjectile } from './elementalFlight';
import { ElementalImpacts } from './elementalImpacts';
import { ElementalAudio, elementalAudioRecipe } from '../../audio/elementalAudio';
import { corrosiveABAudioRecipe } from '../../audio/corrosiveAudio';
import { CorrosiveResponse,type CorrosiveMotion } from './corrosive/liquid';
import type { CorrosiveStatusVisual } from './corrosive/surfaces';

export interface ElementalPresentationOptions { corrosiveAB?: boolean;corrosiveMotion?:CorrosiveMotion;audioRecipe?:typeof elementalAudioRecipe }
type StatusPresentation=ElementalStatus|CorrosiveStatusVisual;

/** Complete opt-in presentation adapter. It consumes authoritative combat events only. */
export class ElementalPresentation implements BallisticPresentation{
 readonly splash?: (event:BallisticPresentationSplash)=>void;
 readonly impacts:ElementalImpacts;readonly audio:ElementalAudio;readonly corrosive:CorrosiveResponse|null;
 private equipment=new Map<THREE.Object3D,{key:string;visual:EquipmentEffectPresentation}>();
 private statuses=new Map<THREE.Group,Map<ElementType,StatusPresentation>>();
 private restoreFactory:()=>void;
 private activeEquipment=new Set<ElementType>();private mode:Mode='pilot';
 constructor(private scene:THREE.Scene,private camera:THREE.Camera,options:ElementalPresentationOptions={}){this.impacts=new ElementalImpacts(scene);
  this.corrosive=options.corrosiveAB?new CorrosiveResponse(scene,camera,options.corrosiveMotion):null;this.audio=new ElementalAudio(options.audioRecipe??(options.corrosiveAB?corrosiveABAudioRecipe:elementalAudioRecipe));
  if(this.corrosive)this.splash=event=>this.splashImpact(event);
  this.restoreFactory=setEquipmentEffectFactory(root=>{
   const owners=new Map<THREE.Object3D,ElementType[]>();
   root.traverse(object=>{
    const element=object.userData.equipmentElement as ElementType|undefined;if(!element||element==='kinetic')return;
    let owner:THREE.Object3D|null=object;
    while(owner&&owner!==root&&!(owner.userData.visualOwner==='weapon'||owner.userData.equipmentSlot==='weapon'))owner=owner.parent;
    if(!owner||!(owner.userData.visualOwner==='weapon'||owner.userData.equipmentSlot==='weapon'))return;
    const elements=owners.get(owner)??[];if(!elements.includes(element))elements.push(element);owners.set(owner,elements);
   });
   if(!owners.size)return;
   const visuals=[...owners].map(([owner,elements])=>{
    let delivery:unknown='bullet',variant=0;owner.traverse(object=>{if(object.userData.equipmentProjectile){delivery=object.userData.equipmentProjectile;variant=Number(object.userData.equipmentVariant)||0;}});
    return this.createEquipment(owner,{key:`bound:${owner.uuid}`,equipped:true,target:'pilot',slot:'weapon',form:'standard',variant,primary:0,secondary:0,accent:0,metal:0,element:elements[0],secondaryElement:elements[1],projectile:delivery as EquipmentAppearance['projectile']});
   });
   return{update:(dt,time)=>visuals.forEach(v=>v.update(dt,time)),dispose:()=>visuals.forEach(v=>v.dispose())};
  });
 }
 projectile(spec:WeaponSpec,brand:BrandId,role?:'carrier'|'bomblet'):THREE.Group{return createElementalProjectile(spec,brand,role);}
 trail(start:THREE.Vector3,end:THREE.Vector3,spec:WeaponSpec,brand:BrandId,role?:'carrier'|'bomblet'):THREE.Group{return createElementalTrail(start,end,spec,brand,role);}
 beam(start:THREE.Vector3,end:THREE.Vector3,spec:WeaponSpec,jagged:boolean,brand:BrandId):THREE.Group{return createElementalBeam(start,end,spec,jagged,brand);}
 updateProjectile(root:THREE.Group,dt:number,age:number):void{updateElementalProjectile(root,dt,age);}
 impact(event:BallisticPresentationImpact):void{this.impacts.delivery(event);this.impactChannels(event,getWeaponElements(event.spec));}
 /** Route selected channels while retaining original energy, delivery and secondary-channel identity. */
 protected impactChannels(event:BallisticPresentationImpact,elements:readonly ElementType[]):void{
  if(!elements.length)return;const special=this.corrosive&&elements.includes('corrosive');
  const surface=special?this.corrosive!.impact(event):undefined;
  const excluded=new Set(getWeaponElements(event.spec).filter(e=>!elements.includes(e)||!!special&&e==='corrosive'));
  this.impacts.impact(event,excluded);
  for(const element of elements)this.audio.impact(element,{mode:this.mode,delivery:event.spec.projectile,surface,distance:event.point.distanceTo(this.camera.getWorldPosition(new THREE.Vector3())),strength:event.stage==='bomblet'?.55:event.phase==='detonate'?1:.72});
 }
 protected splashImpact(event:BallisticPresentationSplash):void{
  if(!this.corrosive||event.primary||!getWeaponElements(event.spec).includes('corrosive'))return;
  const surface=this.corrosive.splash(event);
  this.audio.impact('corrosive',{mode:this.mode,delivery:event.spec.projectile,surface,splash:true,distance:event.point.distanceTo(this.camera.getWorldPosition(new THREE.Vector3())),strength:Math.min(.28,.08+event.exposure*.24)});
 }
 weapon(root:THREE.Object3D,appearance:EquipmentAppearance):void{
  const existing=this.equipment.get(root);if(existing?.key===appearance.key)return;
  if(existing)this.release(root);
  setEquipmentEffectPresentation(root,undefined);
  const visual=this.createEquipment(root,appearance);setEquipmentEffectPresentation(root,visual);this.equipment.set(root,{key:appearance.key,visual});
 }
 /** One lifecycle for equipped, parked, dropped and preview equipment; elements may specialize their own surfaces. */
 protected createEquipment(root:THREE.Object3D,appearance:EquipmentAppearance):EquipmentEffectPresentation{return new ElementalEquipment(root,appearance);}
 status(root:THREE.Group,element:ElementType):StatusPresentation{
  let map=this.statuses.get(root);if(!map){map=new Map();this.statuses.set(root,map);}
  const existing=map.get(element);if(existing)return existing;
  const visual=this.createStatus(root,element),dispose=visual.dispose.bind(visual);
  visual.dispose=()=>{dispose();map!.delete(element);if(!map!.size)this.statuses.delete(root);};map.set(element,visual);return visual;
 }
 /** Presentation extension point; status ownership and authoritative expiry remain with the existing lifecycle. */
 protected createStatus(root:THREE.Group,element:ElementType):StatusPresentation{
  return element==='corrosive'&&this.corrosive?this.corrosive.status(root):new ElementalStatus(root,element as Exclude<ElementType,'kinetic'>);
 }
 shot(spec:WeaponSpec,mode:Mode,_weaponRoot?:THREE.Object3D,_muzzleIndex?:number):void{
  this.mode=mode;
  for(const element of getWeaponElements(spec)){this.audio.shot(element,{mode,delivery:spec.projectile});this.audio.flight(element,{mode,delivery:spec.projectile,strength:.45});}
 }
 update(dt:number,time:number,paused:boolean,spec:WeaponSpec,mode:Mode):void{
  this.mode=mode;if(paused){this.audio.pause();return;}
  this.impacts.update(dt);
  this.corrosive?.update(dt);
  const next=new Set(getWeaponElements(spec));
  for(const element of this.activeEquipment)if(!next.has(element))this.audio.equipment(element,false);
  for(const element of next)this.audio.equipment(element,true,{mode,delivery:spec.projectile,strength:.25});this.activeEquipment=next;
  const nearest=new Map<ElementType,number>();const listener=this.camera.getWorldPosition(new THREE.Vector3());
  for(const[root,map]of this.statuses){
   if(!root.parent){for(const visual of[...map.values()])visual.dispose();continue;}
   const distance=root.getWorldPosition(new THREE.Vector3()).distanceTo(listener);
   for(const[element]of map)nearest.set(element,Math.min(nearest.get(element)??Infinity,distance));
  }
  for(const element of ['fire','ice','corrosive','shock','radiation','gravity','adhesive']as const){
   const distance=nearest.get(element);this.audio.status(element,distance!==undefined,{distance:distance??0,strength:.5});
  }
  this.audio.update(dt);
 }
 release(root:THREE.Object3D):void{
  if(this.equipment.has(root)){setEquipmentEffectPresentation(root,undefined);this.equipment.delete(root);}
  const map=this.statuses.get(root as THREE.Group);if(map)for(const visual of[...map.values()])visual.dispose();
 }
 get diagnostics(){return{impacts:this.impacts.activeCount,equipment:this.equipment.size,statuses:[...this.statuses.values()].reduce((sum,map)=>sum+map.size,0),voices:this.audio.activeVoiceCount,corrosive:this.corrosive?.diagnostics??null};}
 clear():void{this.impacts.clear();this.audio.pause();for(const map of[...this.statuses.values()])for(const visual of[...map.values()])visual.dispose();this.corrosive?.clear();}
 dispose():void{this.restoreFactory();this.clear();for(const root of[...this.equipment.keys()])this.release(root);this.impacts.dispose();this.corrosive?.dispose();this.audio.dispose();}
}
