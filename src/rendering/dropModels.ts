import * as THREE from 'three';
import type { Item } from '../core/index';
import { describeItemAppearance } from '../core/appearance';
import { createEquipmentItemModel } from './equipmentModels';

/** A world pickup is the item's own equipment prefab, rather than a generic loot crate. */
export function createDroppedItemModel(item: Item, maximumSize = item.target === 'pilot' ? 0.55 : 0.75): THREE.Group {
  const appearance = describeItemAppearance(item);
  const root = new THREE.Group();
  root.name = `item-drop-${item.id}`;
  root.userData.itemId = item.id;
  root.userData.appearanceKey = appearance.key;
  root.userData.equipmentSlot = item.slot;
  root.userData.equipmentMode = item.target;
  root.userData.ownedTextures = [];
  const equipment = createEquipmentItemModel(item.target, appearance);
  root.add(equipment);
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(equipment);
  const dimensions = bounds.getSize(new THREE.Vector3());
  const maximum = Math.max(dimensions.x, dimensions.y, dimensions.z);
  if (!Number.isFinite(maximum) || maximum <= 0) throw new Error(`Equipment prefab is empty for ${item.target}/${item.slot}`);
  equipment.scale.multiplyScalar(maximumSize / maximum);
  root.updateMatrixWorld(true);
  bounds.setFromObject(equipment);
  const center = bounds.getCenter(new THREE.Vector3());
  equipment.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
  root.updateMatrixWorld(true);
  return root;
}
