import type { Object3D } from 'three';
import type { VendingType } from '../core/vending';

export type StationInteraction = { kind: 'workbench' | 'service' } | { kind: 'vending'; vendor: VendingType };

/** Only the first physical surface under the crosshair can offer an interaction. */
export function focusedStation(hits: readonly { object: Object3D; distance: number }[], range: number): StationInteraction | null {
  if (!Number.isFinite(range) || range <= 0) return null;
  for (const hit of hits) {
    let overlay = false;
    for (let node: Object3D | null = hit.object; node; node = node.parent) overlay ||= node.userData.comicOverlay === true || !node.visible;
    if (overlay) continue;
    if (!Number.isFinite(hit.distance) || hit.distance > range || hit.distance < 0) return null;
    for (let node: Object3D | null = hit.object; node; node = node.parent) {
      if (node.userData.sandboxWorkbench === true) return { kind: 'workbench' };
      if (node.userData.serviceTerminal === true) return { kind: 'service' };
      const vendor = node.userData.vendorType;
      if (vendor === 'weapons' || vendor === 'medical' || vendor === 'mech') return { kind: 'vending', vendor };
    }
    return null;
  }
  return null;
}
