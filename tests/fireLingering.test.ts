import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FireResponse} from '../src/rendering/quality/fire/response.ts';
import {createWeaponSpec} from '../src/core/arsenal.ts';

for(const kind of ['cloth','armor'] as const)test(`Lingering ${kind} flames use different real surface heights and staggered births`,()=>{
 const scene=new THREE.Scene(),root=new THREE.Group(),source=new THREE.Mesh(new THREE.BoxGeometry(1,1,.12),new THREE.MeshBasicMaterial());source.position.y=1.2;source.userData.effectSurface=kind;root.add(source);scene.add(root);
 const slot=new THREE.Group();slot.userData.equipmentSlot='weapon';const fake=new THREE.Mesh(new THREE.BoxGeometry(1,1,.1),new THREE.MeshBasicMaterial());fake.position.set(0,1.2,.7);slot.add(fake);root.add(slot);
 const originalGeometry=source.geometry,originalMaterial=source.material,originalRaycast=source.raycast;
 const layer=new FireResponse(scene,new THREE.PerspectiveCamera(),{hybrid:true});layer.impact({target:root,point:new THREE.Vector3(0,1.2,.06),normal:new THREE.Vector3(0,0,1),spec:createWeaponSpec('bullet','fire','pilot'),radius:.3,energy:28,phase:'contact'});const status=layer.status(root),pool=layer.group.getObjectByName('fire-tongues-pool') as THREE.InstancedMesh;
 status.update(.001);layer.update(.001);assert.equal(pool.count,1,'second lick starts later, not on the same tick');
 for(let i=0;i<30;i++){status.update(1/60);layer.update(1/60);}
 assert.ok(pool.count>=3);const matrix=new THREE.Matrix4(),points:THREE.Vector3[]=[];for(let i=0;i<pool.count;i++){pool.getMatrixAt(i,matrix);points.push(new THREE.Vector3().setFromMatrixPosition(matrix));}
 assert.ok(Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))>.04,'roots must not sit on one horizontal baseline');
 assert.ok(points.every(p=>p.z>.08&&p.z<.2),'roots must remain on the visible body face, excluding weapon-slot geometry');
 assert.ok(points.every(p=>Math.abs(p.x)<.5&&Math.abs(p.y-1.2)<.5));assert.equal(source.geometry,originalGeometry);assert.equal(source.material,originalMaterial);assert.equal(source.raycast,originalRaycast);assert.equal(fake.children.length,0);
 layer.dispose();
});
