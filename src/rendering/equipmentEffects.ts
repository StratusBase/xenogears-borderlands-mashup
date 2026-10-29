import * as THREE from 'three';
import { isElementType } from '../core/arsenal';
import { ElementEffects } from './ElementEffects';
import { ElementCoating } from './ElementCoating';

/** Optional visual owner; default equipment effects remain available. */
export interface EquipmentEffectPresentation { update(dt:number,time:number):void; dispose():void }
const presentations=new WeakMap<THREE.Object3D,EquipmentEffectPresentation>();
export type EquipmentEffectFactory=(root:THREE.Object3D)=>EquipmentEffectPresentation|undefined;
let factory:EquipmentEffectFactory|undefined;
const automatic=new Map<THREE.Object3D,{key:unknown;visual?:EquipmentEffectPresentation}>();
/** Opt-in shared presentation for equipped, preview, vendor and dropped-item views. */
export function setEquipmentEffectFactory(next?:EquipmentEffectFactory):()=>void {
 const previous=factory;for(const cached of automatic.values())cached.visual?.dispose();automatic.clear();factory=next;
 return()=>{if(factory!==next)return;for(const cached of automatic.values())cached.visual?.dispose();automatic.clear();factory=previous;};
}
export function setEquipmentEffectPresentation(root:THREE.Object3D,presentation?:EquipmentEffectPresentation):void {
 disposeEquipmentEffects(root);
 if(presentation)presentations.set(root,presentation);
}

interface EquipmentEffect { particles: ElementEffects; coating: ElementCoating }
const attached = new WeakMap<THREE.Object3D, EquipmentEffect>();
const roots = new WeakMap<THREE.Object3D, { key: unknown; effects: EquipmentEffect[] }>();

/** Attach after model sizing/framing: cosmetic vapor must not enlarge item or cabinet bounds. */
export function updateEquipmentEffects(root: THREE.Object3D, dt: number, time: number): void {
  const presentation=presentations.get(root);if(presentation){presentation.update(dt,time);return;}
  const key = root.userData.appearanceKey;
  if(factory){
   let cached=automatic.get(root);
   if(!cached||cached.key!==key){disposeEquipmentEffects(root);cached={key,visual:factory(root)};automatic.set(root,cached);}
   if(cached.visual){cached.visual.update(dt,time);return;}
  }
  let cached = roots.get(root);
  if (!cached || cached.key !== key) {
    const sockets: THREE.Object3D[] = [];
    root.traverse(object => {
      const element = object.userData.equipmentElement;
      if (isElementType(element) && element !== 'kinetic') sockets.push(object);
    });
    const effects = sockets.map(socket => {
      let effect = attached.get(socket);
      if (!effect) {
        const variant = Number(socket.userData.equipmentVariant) || 0;
        const delivery = socket.userData.equipmentProjectile;
        const scale = delivery === 'orb' || delivery === 'sticky' ? .70 : delivery === 'beam' || delivery === 'arc' ? .48 : .34;
        const particles = new ElementEffects(socket, socket.userData.equipmentElement, { style: 'equipment', scale: scale + (variant % 4) * .045, intensity: .52, variant });
        particles.group.name = 'equipment-element-effect';
        particles.group.position.y = 0.015;
        let weapon: THREE.Object3D = socket;
        while (weapon.parent && weapon.userData.visualOwner !== 'weapon') weapon = weapon.parent;
        effect = { particles, coating: new ElementCoating(weapon, socket.userData.equipmentElement, { scope: 'equipment', intensity: 0.58, surfaceOnly: true, variant }) };
        attached.set(socket, effect);
      }
      return effect;
    });
    cached = { key, effects }; roots.set(root, cached);
  }
  for (const effect of cached.effects) { effect.particles.update(dt, time); effect.coating.update(dt, time); }
}

export function disposeEquipmentEffects(root: THREE.Object3D): void {
  presentations.get(root)?.dispose();presentations.delete(root);automatic.get(root)?.visual?.dispose();automatic.delete(root);
  const effects: { socket: THREE.Object3D; effect: EquipmentEffect }[] = [];
  root.traverse(socket => { const effect = attached.get(socket); if (effect) effects.push({ socket, effect }); });
  for (const { socket, effect } of effects) { effect.particles.dispose(); effect.coating.dispose(); attached.delete(socket); }
  roots.delete(root);
}
