import type * as THREE from 'three';
import type {EquipmentAppearance} from '../../../core/appearance';
import type {ElementModule} from '../shared/composedPresentation';
import {GravityEquipment} from './equipment';

/** Composable equipment capability. No field state, impact replacement or second audio owner. */
export class GravityEquipmentResponse {
 readonly equipmentOwners=new Map<THREE.Object3D,GravityEquipment>();
 equipment(root:THREE.Object3D,appearance:EquipmentAppearance){this.equipmentOwners.get(root)?.dispose();const v=new GravityEquipment(root,appearance,()=>{if(this.equipmentOwners.get(root)===v)this.equipmentOwners.delete(root);});this.equipmentOwners.set(root,v);return v;}
 shot(root?:THREE.Object3D,index?:number){if(root)this.equipmentOwners.get(root)?.shot(index);}
 release(root:THREE.Object3D){this.equipmentOwners.get(root)?.dispose();}
 clear(){for(const v of this.equipmentOwners.values())v.reset();}
 dispose(){for(const v of [...this.equipmentOwners.values()])v.dispose();}
 get diagnostics(){return{equipment:[...this.equipmentOwners.values()].map(v=>v.diagnostics)};}
}
/** Register this equipment-only module when authoritative field wiring is not yet available. */
export function gravityEquipmentModule():ElementModule{return{replaceEquipment:true,create:()=>{const equipment=new GravityEquipmentResponse();return{impact(){},equipment:(root,appearance)=>equipment.equipment(root,appearance),shot:(_spec,_mode,root,index)=>equipment.shot(root,index),release:root=>equipment.release(root),clear:()=>equipment.clear(),dispose:()=>equipment.dispose(),get diagnostics(){return equipment.diagnostics;}};}};}
