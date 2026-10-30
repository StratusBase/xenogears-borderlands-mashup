import type * as THREE from 'three';
import type {ElementType} from '../../../core/arsenal';

/** Combat-selected, already-applied pulse. Presentation must not query recipients or apply damage. */
export interface ConfirmedElementPulse {
 element:ElementType;
 point:THREE.Vector3;
 energy:number;
 radius:number;
 recipients:readonly {
  target:THREE.Group;
  point:THREE.Vector3;
  normal:THREE.Vector3;
  exposure:number;
 }[];
}
