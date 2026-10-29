import * as THREE from 'three';
import type { Mode } from '../../core/index';
import type { EquipmentAppearance } from '../../core/appearance';
import type { ElementType } from '../../core/arsenal';
import type { WeaponRig } from '../equipmentModels';
import { upgradeReferenceWeapon } from './weapon';
import { decorateEnemy, upgradeReferenceMech } from './actors';
import { qualityRecoilEnvelope } from './motion';
import { QualityAudio } from '../../audio/qualityAudio';
import { QualityFeedback } from './feedback';
import { FootstepCadence } from './footsteps';

export interface QualityFrame {
  dt: number; time: number; paused: boolean; mode: Mode;
  /** Horizontal distance traveled this frame, after collision resolution. */
  distance: number; grounded: boolean; landed?: boolean;
  weaponRoot?: THREE.Group;
  turn?: number;
}
export interface QualityShot { mode: Mode; rig: WeaponRig; muzzleIndex: number; element?: ElementType }
export interface QualityImpact { point: THREE.Vector3; normal?: THREE.Vector3; mode: Mode; kind?: 'metal'|'dust'|'shield'; strength?: number }
interface ActorHandle { update(time:number,dt:number,speed?:number,fireAge?:number,hitAge?:number): void; dispose(): void }

/** Public integration surface. Owns presentation only: no damage, input, collision, or projectile writes. */
export class QualityPresentation {
  readonly audio = new QualityAudio();
  readonly feedback: QualityFeedback;
  private disposers = new Map<THREE.Object3D, () => void>();
  private actors = new Map<THREE.Object3D, {handle: ActorHandle; previous: THREE.Vector3; fireAt:number; hitAt:number}>();
  private readonly gait=new FootstepCadence();
  private readonly footfalls:{at:number;kind:'step'|'land';mode:Mode;variant:number;position:number[]}[]=[];
  get footstepDiagnostics(){return this.footfalls.map(event=>({...event,position:[...event.position]}));}
  private lastTime = 0;
  private shotAt:Record<Mode,number>={pilot:-Infinity,mech:-Infinity};
  private motion = new THREE.Vector3();
  private readonly camera: THREE.Camera;
  constructor(options: {scene: THREE.Scene; camera: THREE.Camera}) { this.camera=options.camera; this.feedback = new QualityFeedback(options); }
  weapon(rig: WeaponRig, appearance: EquipmentAppearance, mode: Mode): void {
    if (this.disposers.has(rig.group)) return;
    const quality = upgradeReferenceWeapon(rig, appearance, mode);
    this.disposers.set(rig.group, () => quality.dispose());
  }
  enemy(root: THREE.Group, id: number, heavy: boolean): void {
    if (this.disposers.has(root)) return;
    this.attachActor(root, decorateEnemy(root,id,heavy));
  }
  mech(root: THREE.Group): void {
    if (this.disposers.has(root)) return;
    this.attachActor(root, upgradeReferenceMech(root));
  }
  private attachActor(root: THREE.Group, handle: ActorHandle): void {
    this.actors.set(root,{handle, previous:root.position.clone(),fireAt:-Infinity,hitAt:-Infinity});
    this.disposers.set(root, () => {handle.dispose(); this.actors.delete(root);});
  }
  release(root: THREE.Object3D): void { this.disposers.get(root)?.(); this.disposers.delete(root); }
  actorFire(root: THREE.Group, time=this.lastTime): void { const actor = this.actors.get(root); if(actor) actor.fireAt=time; }
  actorHit(root: THREE.Group, time=this.lastTime): void { const actor = this.actors.get(root); if(actor) actor.hitAt=time; }
  fire(event: QualityShot): void {
    this.shotAt[event.mode]=this.lastTime;
    const muzzle = event.rig.muzzles[event.muzzleIndex % event.rig.muzzles.length];
    if(muzzle) this.feedback.fire({mode:event.mode,muzzle,element:event.element});
    this.audio.play('fire',{mode:event.mode,element:event.element});
  }
  impact(event: QualityImpact): void {
    this.feedback.impact(event);
    this.audio.play(event.kind === 'shield' ? 'impact-shield' : event.kind === 'dust' ? 'impact-dust' : 'impact-metal',{...event,distance:this.camera.getWorldPosition(new THREE.Vector3()).distanceTo(event.point)});
  }
  reload(mode:Mode,stage:'out'|'in'|'bolt'):void { this.audio.play(`reload-${stage}`,{mode}); }
  update(frame:QualityFrame): void {
    this.lastTime=frame.time;
    const dt=frame.paused?0:Math.min(.05,Math.max(0,frame.dt));
    this.feedback.update(dt,{paused:frame.paused});
    if (frame.paused) { this.gait.update({...frame,dt:0});this.audio.pause(); return; }
    for (const [root, actor] of this.actors) {
      if (!root.parent) { this.release(root); continue; }
      const distance=actor.previous.distanceTo(root.position);
      actor.previous.copy(root.position);
      actor.handle.update(frame.time,dt,dt>0?distance/dt:0,frame.time-actor.fireAt,frame.time-actor.hitAt);
    }
    const footfall=this.gait.update(frame);
    if(footfall){
      this.audio.play(footfall.kind,{mode:frame.mode,strength:footfall.strength,footstepVariant:footfall.variant,surface:'sand'});
      const point=this.camera.getWorldPosition(new THREE.Vector3());point.y=.025;
      point.x+=footfall.side*(frame.mode==='mech'?.5:.14);
      this.feedback.step({point,mode:frame.mode,strength:footfall.kind==='land'?1.1:frame.mode==='mech'?.65:.36});
      this.footfalls.push({at:frame.time,kind:footfall.kind,mode:frame.mode,variant:footfall.variant,position:point.toArray()});if(this.footfalls.length>128)this.footfalls.shift();
    }
    if(frame.weaponRoot){
      // Game owns the root pose and calls this AFTER its own animation each frame.
      // Responsive pilot settle; longer mech mass transfer. No camera motion or aim writes.
      const amount = Math.min(1,frame.distance/Math.max(.001,dt)/(frame.mode==='mech'?5:7));
      const phase=frame.time*(frame.mode==='mech'?5.2:10.4);
      const target=new THREE.Vector3(Math.sin(phase*.5)*amount*(frame.mode==='mech'?.018:.009),
        -Math.abs(Math.sin(phase))*amount*(frame.mode==='mech'?.024:.007),
        THREE.MathUtils.clamp((frame.turn??0)*.03,-.01,.01));
      this.motion.lerp(target,1-Math.exp(-dt*(frame.mode==='mech'?8:24)));
      frame.weaponRoot.position.add(this.motion);
      const recoil=qualityRecoilEnvelope(frame.mode,frame.time-this.shotAt[frame.mode]);
      frame.weaponRoot.position.z+=recoil*(frame.mode==='mech'?.055:.012);
      frame.weaponRoot.rotation.x+=recoil*(frame.mode==='mech'?.016:.004);
    }
  }
  dispose():void { for(const dispose of this.disposers.values()) dispose(); this.disposers.clear(); this.actors.clear(); this.feedback.dispose(); this.audio.dispose(); }
}
