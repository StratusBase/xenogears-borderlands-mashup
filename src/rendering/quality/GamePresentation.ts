import * as THREE from 'three';
import type { Mode } from '../../core/index';
import type { EquipmentLoadoutAppearance } from '../../core/appearance';
import type { ElementType, WeaponSpec } from '../../core/arsenal';
import type { EnemyRole } from '../../encounter/contracts';
import type { WeaponRig } from '../equipmentModels';
import type { PlayerBallistics } from '../PlayerBallistics';
import { QualityPresentation } from './presentation';
import { ElementalPresentation } from './elementalPresentation';
import { applyQualityInk } from './target';

export type PresentationMode='quality'|'legacy';
export interface PresentationStatus {
 update(dt:number,time?:number):void;
 dispose():void;
 setIntensity?(value:number):void;
}
export interface GamePresentationContext {
 scene:THREE.Scene;
 camera:THREE.Camera;
 weaponRoot:THREE.Group;
 ballistics:Pick<PlayerBallistics,'setPresentation'>;
 comicRenderer:{outlineWidth:number};
}
export interface PresentationEquipment {
 pilotRig:WeaponRig;mechRig:WeaponRig;
 pilotLook:EquipmentLoadoutAppearance;mechLook:EquipmentLoadoutAppearance;
 parkedMech:THREE.Group;
}
export interface PresentationEnemy {root:THREE.Group;id:number;role:EnemyRole;heavy:boolean}
export interface GamePresentationFrame {
 dt:number;time:number;paused:boolean;mode:Mode;distance:number;grounded:boolean;landed?:boolean;turn?:number;spec:WeaponSpec;
}
export interface PresentationShot {mode:Mode;rig:WeaponRig;muzzleIndex:number;spec:WeaponSpec}

/** Production owner of optional art/audio. All movement, hits, statuses and gear remain game-owned. */
export class GamePresentation {
 private quality:QualityPresentation|null=null;
 private elements:ElementalPresentation|null=null;
 private restoreInk:(()=>void)|null=null;
 private equipmentBinding:PresentationEquipment|null=null;
 private readonly enemies=new Map<THREE.Group,PresentationEnemy>();
 private sound=true;
 private disposed=false;
 private audioWasUnlocked=false;
 private frameTime=0;
 private audioError:string|null=null;
 private elementalFactory=(scene:THREE.Scene,camera:THREE.Camera)=>new ElementalPresentation(scene,camera);
 constructor(private readonly context:GamePresentationContext){}
 /** Optional review/integration seam. Change only while disabled; Game owns the lifecycle transition. */
 setElementalFactory(factory:(scene:THREE.Scene,camera:THREE.Camera)=>ElementalPresentation):void{
  if(this.enabled)throw new Error('Disable presentation before replacing its elemental factory.');
  this.elementalFactory=factory;
 }
 /** Local review capture taps the identical final buses heard in gameplay. */
 recordingStreams():MediaStream[]{return[this.quality?.audio.captureStream(),this.elements?.audio.captureStream()].filter((stream):stream is MediaStream=>!!stream);}
 get enabled():boolean{return this.quality!==null;}
 get mode():PresentationMode{return this.enabled?'quality':'legacy';}
 get diagnostics(){return{
  mode:this.mode,soundEnabled:this.sound,audioUnlocked:this.audioWasUnlocked,audioError:this.audioError,
  qualityAudioUnlocked:this.quality?.audio.unlocked??false,elementalAudioUnlocked:this.elements?.audio.unlocked??false,
  physicalVoices:this.quality?.audio.activeVoiceCount??0,elementalVoices:this.elements?.audio.activeVoiceCount??0,
  physicalParticles:this.quality?.feedback.activeParticleCount??0,
  ...(this.elements?.diagnostics??{impacts:0,equipment:0,statuses:0,voices:0}),
  trackedEnemies:this.enemies.size,
 };}
 setEnabled(enabled:boolean):void{
  if(this.disposed||enabled===this.enabled)return;
  if(!enabled){
   this.context.ballistics.setPresentation(undefined);
   this.elements?.dispose();this.elements=null;
   this.quality?.dispose();this.quality=null;
   this.restoreInk?.();this.restoreInk=null;
   return;
  }
  this.quality=new QualityPresentation({scene:this.context.scene,camera:this.context.camera});
  this.elements=this.elementalFactory(this.context.scene,this.context.camera);
  this.context.ballistics.setPresentation(this.elements);
  this.restoreInk=applyQualityInk(this.context.comicRenderer);
  this.setSoundEnabled(this.sound);
  if(this.equipmentBinding)this.bindEquipment(this.equipmentBinding);
  for(const enemy of this.enemies.values())this.bindEnemy(enemy);
  // A previous user gesture authorized audio for this Game instance.
  if(this.audioWasUnlocked&&this.sound)void this.unlockAudio();
 }
 setSoundEnabled(enabled:boolean):void{
  this.sound=Boolean(enabled);this.quality?.audio.setEnabled(this.sound);this.elements?.audio.setEnabled(this.sound);
 }
 async unlockAudio():Promise<void>{
  if(this.disposed||!this.sound||!this.enabled)return;
  this.audioWasUnlocked=true;
  try{await Promise.all([this.quality!.audio.unlock(),this.elements!.audio.unlock()]);this.audioError=null;}
  catch(error){this.audioError=error instanceof Error?error.message:String(error);}
 }
 equipment(binding:PresentationEquipment):void{
  this.equipmentBinding=binding;
  if(this.enabled)this.bindEquipment(binding);
 }
 private bindEquipment(binding:PresentationEquipment):void{
  this.quality!.weapon(binding.pilotRig,binding.pilotLook.weapon,'pilot');
  this.quality!.weapon(binding.mechRig,binding.mechLook.weapon,'mech');
  this.quality!.mech(binding.parkedMech);
  this.elements!.weapon(binding.pilotRig.group,binding.pilotLook.weapon);
  this.elements!.weapon(binding.mechRig.group,binding.mechLook.weapon);
  this.elements!.weapon(binding.parkedMech,binding.mechLook.weapon);
 }
 enemy(enemy:PresentationEnemy):void{this.enemies.set(enemy.root,enemy);if(this.enabled)this.bindEnemy(enemy);}
 private bindEnemy(enemy:PresentationEnemy):void{
  // Heavy shields/rear cores and rusher melee cues retain their authored role renderer.
  if(enemy.role==='flanker'&&!enemy.heavy)this.quality!.enemy(enemy.root,enemy.id,false);
 }
 status(root:THREE.Group,element:ElementType):PresentationStatus|undefined{
  return this.elements?.status(root,element);
 }
 release(root:THREE.Object3D):void{
  this.elements?.release(root);this.quality?.release(root);this.enemies.delete(root as THREE.Group);
  const binding=this.equipmentBinding;
  if(binding&&(root===binding.pilotRig.group||root===binding.mechRig.group||root===binding.parkedMech)){
   // Game supplies the next complete binding after its existing refresh/disposal.
   this.equipmentBinding=null;
  }
 }
 shot(event:PresentationShot):void{
  this.quality?.fire({mode:event.mode,rig:event.rig,muzzleIndex:event.muzzleIndex,element:event.spec.element});
  this.elements?.shot(event.spec,event.mode);
 }
 reload(mode:Mode,stage:'out'|'in'|'bolt'):void{this.quality?.reload(mode,stage);}
 dry(mode:Mode):void{this.quality?.audio.play('dry',{mode});}
 mount(mode:Mode):void{this.quality?.audio.play('mount',{mode});}
 enemyAttack(root:THREE.Group,mode:Mode):void{
  this.quality?.actorFire(root,this.frameTime);
  const enemy=this.enemies.get(root);if(enemy?.role==='rusher')return;
  const point=root.getWorldPosition(new THREE.Vector3()),listener=this.context.camera.getWorldPosition(new THREE.Vector3());
  this.quality?.audio.play('fire',{mode,distance:point.distanceTo(listener),strength:.65});
 }
 enemyHit(root:THREE.Group):void{this.quality?.actorHit(root,this.frameTime);}
 update(frame:GamePresentationFrame):void{
  if(this.disposed)return;this.frameTime=frame.time;
  // Game alone owns first-person transforms: cosmetic offsets must never shift ballistic sockets.
  this.quality?.update(frame);
  this.elements?.update(frame.dt,frame.time,frame.paused,frame.spec,frame.mode);
 }
 dispose():void{
  if(this.disposed)return;this.setEnabled(false);this.disposed=true;this.equipmentBinding=null;this.enemies.clear();
 }
}
