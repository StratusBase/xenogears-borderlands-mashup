import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {bodySurfaceSources,nearestVisibleSurface,surfaceKindOf,targetSurfaceSpan} from '../src/rendering/quality/shared/surfaces';
import {surfaceContactFrame,settleSurfaceParticle} from '../src/rendering/quality/shared/contactFrame';
import {corrosiveSources,nearestCorrosiveSurface,corrosiveSurfaceOf,corrosiveTargetSpan} from '../src/rendering/quality/corrosive/surfaces';
import {corrosiveSurfaceFrame,settleCorrosiveDrop} from '../src/rendering/quality/corrosive/surfaceFrame';

test('legacy imports resolve to the same shared implementation, without sibling copies',()=>{
 assert.equal(bodySurfaceSources,corrosiveSources);assert.equal(nearestVisibleSurface,nearestCorrosiveSurface);
 assert.equal(surfaceKindOf,corrosiveSurfaceOf);assert.equal(targetSurfaceSpan,corrosiveTargetSpan);
 assert.equal(surfaceContactFrame,corrosiveSurfaceFrame);assert.equal(settleSurfaceParticle,settleCorrosiveDrop);
});
test('neutral surface selection keeps outer armor and excludes equipment/proxy overlays',()=>{
 const root=new THREE.Group(),material=new THREE.MeshBasicMaterial(),armor=new THREE.Mesh(new THREE.BoxGeometry(1,1,.15),material);
 armor.userData.corrosiveSurface='armor';root.add(armor);const equipment=new THREE.Group();equipment.userData.equipmentSlot='weapon';root.add(equipment);
 const gun=new THREE.Mesh(armor.geometry,material);gun.userData.corrosiveSurface='armor';equipment.add(gun);
 const overlay=new THREE.Mesh(armor.geometry,material);overlay.userData.comicOverlay=true;root.add(overlay);
 const proxy=new THREE.Mesh(armor.geometry,new THREE.MeshBasicMaterial({colorWrite:false,transparent:true,opacity:0}));proxy.userData.enemyId=1;root.add(proxy);
 assert.deepEqual(bodySurfaceSources(root),[armor]);assert.equal(surfaceKindOf(gun),undefined);
 const contact=nearestVisibleSurface(root,new THREE.Vector3(0,0,.04),new THREE.Vector3(0,0,1));assert.equal(contact.source,armor);assert.equal(contact.surface,'armor');
 assert.ok(Math.abs(contact.point.z-.075)<1e-6);assert.equal(armor.material,material);
 armor.geometry.dispose();material.dispose();(proxy.material as THREE.Material).dispose();
});
