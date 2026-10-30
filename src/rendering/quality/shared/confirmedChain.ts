import type * as THREE from 'three';
import type {ElementType,WeaponSpec} from '../../../core/arsenal';
/** Already selected and damaged by combat. Presentation never chooses a recipient. */
export interface ConfirmedElementChain {
 element:ElementType;
 start:THREE.Vector3;end:THREE.Vector3;target:THREE.Group;
 spec:Readonly<WeaponSpec>;energy:number;exposure:number;
}
