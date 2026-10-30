import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {IceRime,IceRimeMaterials} from '../src/rendering/quality/ice/rime.ts';
import {IceResponse} from '../src/rendering/quality/ice/response.ts';
import {prepareIceRendering} from '../src/rendering/quality/ice/prepare.ts';

test('shared frost binds each source and presence at draw time without leaking across humans',()=>{
 const materials=new IceRimeMaterials(),roots=[new THREE.Group(),new THREE.Group()],visuals=roots.map((root,i)=>{const source=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());source.userData.effectSurface=i?'armor':'cloth';source.scale.set(i+1,1,1);root.add(source);return new IceRime(root,[source],materials);});
 visuals[0].contact(new THREE.Vector3(.1,.2,.5),.31,undefined,new THREE.Vector3(0,0,1));visuals[1].contact(new THREE.Vector3(.4,-.1,.5),.61,undefined,new THREE.Vector3(0,0,1));visuals[0].update(.07);visuals[1].update(.03);visuals[0].setIntensity(.23);visuals[1].setIntensity(.74);
 const [a,b]=visuals.map(v=>v.bindings[0]);assert.equal(a.material,b.material);
 for(const [binding,presence,kind]of[[a,.23,1],[b,.74,2],[a,.23,1]]as const){(binding.mesh.onBeforeRender as (...args:unknown[])=>void)(null,null,null,null,materials.material);const u=materials.material.uniforms;assert.equal(u.centers.value,binding.centers);assert.equal(u.normals.value,binding.normals);assert.equal(u.radii.value,binding.radii);assert.equal(u.ages.value,binding.ages);assert.equal(u.metric.value,binding.metric);assert.equal(u.presence.value,presence);assert.equal(u.kind.value,kind);assert.equal(materials.material.uniformsNeedUpdate,true);}
 materials.material.uniformsNeedUpdate=false;(b.mesh.onBeforeRender as (...args:unknown[])=>void)(null,null,null,null,new THREE.MeshNormalMaterial());assert.equal(materials.material.uniformsNeedUpdate,false);
 assert.notDeepEqual(a.centers,b.centers);assert.notDeepEqual(a.ages,b.ages);assert.notDeepEqual(a.metric,b.metric);
 let disposals=0;materials.material.addEventListener('dispose',()=>disposals++);visuals.forEach(v=>v.dispose());assert.equal(disposals,0);materials.dispose();assert.equal(disposals,1);
});

test('frost material survives target expiry and clear; response disposal releases it once',()=>{
 const scene=new THREE.Scene(),ice=new IceResponse(scene);let disposals=0;ice.rimeMaterials.material.addEventListener('dispose',()=>disposals++);
 for(let i=0;i<50;i++){const root=new THREE.Group(),source=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());source.userData.effectSurface='cloth';root.add(source);scene.add(root);const status=ice.status(root);assert.ok(status.bindings.every(b=>b.material===ice.rimeMaterials.material));ice.release(root);root.removeFromParent();assert.equal(ice.diagnostics.rimes,0);}
 ice.clear();assert.equal(disposals,0);ice.dispose();ice.dispose();assert.equal(disposals,1);
});

test('loading preparation preserves live particle buffers, geometry ownership and renderer state',async()=>{
 for(const fail of[false,true]){
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),ice=new IceResponse(scene),previous=new THREE.WebGLRenderTarget(4,4);let target:THREE.WebGLRenderTarget|null=previous,geometryDisposed=0,materialDisposed=0,draws=0;
  const mesh=ice.group.getObjectByName('ice-release-plates')as THREE.InstancedMesh,mat=mesh.material as THREE.Material;mesh.geometry.addEventListener('dispose',()=>geometryDisposed++);mat.addEventListener('dispose',()=>materialDisposed++);const positions=mesh.instanceMatrix.array.slice(),count=mesh.count,children=[...scene.children];
  mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(3*mesh.instanceMatrix.count),3);const colors=mesh.instanceColor;mesh.morphTexture=new THREE.DataTexture(new Float32Array(4),1,1,THREE.RGBAFormat,THREE.FloatType);const morph=mesh.morphTexture;let morphDisposed=0;morph.addEventListener('dispose',()=>morphDisposed++);
  const renderer={getRenderTarget:()=>target,setRenderTarget:(v:THREE.WebGLRenderTarget|null)=>{target=v;},shadowMap:{autoUpdate:true},autoClear:false,info:{programs:[]},compileAsync:async()=>{assert.notEqual(target,previous);await Promise.resolve();assert.equal(target,previous);return scene;},render:(warm:THREE.Scene)=>{const proxy=warm.getObjectByName('ice-release-plates')as THREE.InstancedMesh;assert.equal(proxy.instanceMatrix,mesh.instanceMatrix);assert.equal(proxy.instanceColor,colors);assert.equal(proxy.morphTexture,morph);proxy.addEventListener('dispose',()=>{assert.notEqual(proxy.instanceMatrix,mesh.instanceMatrix);assert.equal(proxy.instanceColor,null);assert.equal(proxy.morphTexture,null);});if(fail)throw new Error('draw failed');draws++;}}as unknown as THREE.WebGLRenderer;
  if(fail)await assert.rejects(prepareIceRendering(renderer,scene,camera,ice,()=>draws++),/draw failed/);else{const r=await prepareIceRendering(renderer,scene,camera,ice,()=>draws++);assert.ok(r.ms>=0);assert.equal(draws,2);}
  assert.equal(target,previous);assert.equal(renderer.shadowMap.autoUpdate,true);assert.equal(renderer.autoClear,false);assert.deepEqual(mesh.instanceMatrix.array,positions);assert.equal(mesh.count,count);assert.deepEqual(scene.children,children);assert.equal(geometryDisposed,0);assert.equal(materialDisposed,0);assert.equal(morphDisposed,0);assert.equal(mesh.instanceColor,colors);assert.equal(mesh.morphTexture,morph);ice.dispose();assert.equal(morphDisposed,1);previous.dispose();
 }
});

test('review loading can prime ordinary scene geometry without advancing or owning it',async()=>{
 for(const includeSceneGeometry of[false,true]){
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),ice=new IceResponse(scene),world=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());world.name='review-world-geometry';world.position.set(4,5,6);scene.add(world);let disposed=0,seen=false,target:THREE.WebGLRenderTarget|null=null;world.geometry.addEventListener('dispose',()=>disposed++);
  const renderer={getRenderTarget:()=>target,setRenderTarget:(v:THREE.WebGLRenderTarget|null)=>target=v,shadowMap:{autoUpdate:true},autoClear:false,info:{programs:[]},compileAsync:async()=>scene,render:(warm:THREE.Scene)=>{seen=Boolean(warm.getObjectByName(world.name));if(seen)assert.equal((warm.getObjectByName(world.name)as THREE.Mesh).geometry,world.geometry);}}as unknown as THREE.WebGLRenderer;
  const result=await prepareIceRendering(renderer,scene,camera,ice,()=>{},includeSceneGeometry);assert.equal(seen,includeSceneGeometry);assert.equal(result.includeSceneGeometry,includeSceneGeometry);assert.deepEqual(world.position.toArray(),[4,5,6]);assert.equal(disposed,0);assert.equal(world.parent,scene);ice.dispose();world.geometry.dispose();(world.material as THREE.Material).dispose();
 }
});
