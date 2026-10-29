import * as THREE from 'three';
import type { ElementType } from '../../core/arsenal';
import { ElementCoating } from '../ElementCoating';

/** Bind status shells to display armor without adding a single damageable surface. */
export function createQualityStatusCoating(root: THREE.Group, element: ElementType): ElementCoating {
  const display = root.getObjectByName('reference-sentry');
  if (!display) return new ElementCoating(root,element,{scope:'enemy'});
  const tagged: {mesh:THREE.Mesh;previous:unknown;had:boolean}[]=[];
  display.traverse(object=>{
    if(!(object instanceof THREE.Mesh) || object.userData.comicOverlay) return;
    const materials=Array.isArray(object.material)?object.material:[object.material];
    if(!materials.some(material=>material.name==='quality-paint'||material.name==='quality-metal'))return;
    tagged.push({mesh:object,previous:object.userData.enemyId,had:Object.hasOwn(object.userData,'enemyId')});
    object.userData.enemyId=-999;
  });
  try { return new ElementCoating(display as THREE.Group,element,{scope:'enemy'}); }
  finally { for(const {mesh,previous,had} of tagged) {if(had)mesh.userData.enemyId=previous;else delete mesh.userData.enemyId;} }
}
