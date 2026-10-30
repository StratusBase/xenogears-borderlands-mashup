import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {GravityResponse,GRAVITY_VFX_CAPACITY} from '../src/rendering/quality/gravity/response';
import {ElementalAudio,elementalAudioRecipe} from '../src/audio/elementalAudio';
import {gravityAudioRecipe} from '../src/audio/gravityAudio';
import {composeElementRecipes} from '../src/audio/composeElementRecipes';
import {corrosiveABAudioRecipe} from '../src/audio/corrosiveAudio';
import {ComposedElementalPresentation} from '../src/rendering/quality/shared/composedPresentation';
import {ElementalPresentation} from '../src/rendering/quality/elementalPresentation';
import {createWeaponSpec} from '../src/core/arsenal';
import type {GravityWell} from '../src/core/effects/gravity/field';
const well=(id='one'):GravityWell=>({id,ownerId:'pilot',point:{x:0,y:3.2,z:-5},center:{x:0,y:3.2,z:-3.5},normal:{x:0,y:0,z:1},radius:5,captureRadius:1,duration:4.5,age:1,power:1});
test('field art deforms along uneven inward paths, is world-anchored and never moves authoritative bodies or accepts ray hits',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),audio=new ElementalAudio(gravityAudioRecipe),visual=new GravityResponse(scene,camera,audio,{seed:104729}),state={wells:[well()],members:[]},copy=structuredClone(state);visual.sync(state);
 const group=visual.group.getObjectByName('gravity-source-one')!,fold=group.getObjectByName('gravity-pressure-folds')as THREE.Mesh;assert.equal(fold.geometry.attributes.position.count,GRAVITY_VFX_CAPACITY.lanes*25*2);const before=Array.from(fold.geometry.attributes.position.array);
 visual.sync({wells:[{...well(),age:1.2}],members:[]});assert.notDeepEqual(Array.from(fold.geometry.attributes.position.array),before);assert.deepEqual(state,copy);
 const matrix=group.matrixWorld.clone();camera.position.set(7,9,3);camera.lookAt(group.position);scene.updateMatrixWorld(true);assert.deepEqual(group.position.toArray(),[0,3.2,-3.5]);assert.ok(Array.from(fold.geometry.attributes.position.array).every(Number.isFinite));
 const ray=new THREE.Raycaster(new THREE.Vector3(0,3.2,0),new THREE.Vector3(0,0,-1));assert.deepEqual(ray.intersectObject(visual.group,true),[]);assert.ok(visual.diagnostics.grains<=GRAVITY_VFX_CAPACITY.grains);
 visual.dispose();audio.dispose();assert.equal(visual.group.parent,null);
});
test('bounded view allocation and cleanup do not retain ended field resources',()=>{
 const scene=new THREE.Scene(),audio=new ElementalAudio(),v=new GravityResponse(scene,new THREE.PerspectiveCamera(),audio);
 for(let i=0;i<40;i++)v.sync({wells:[well(String(i))],members:[]});assert.ok(v.diagnostics.wells<=3);v.clear();assert.equal(v.diagnostics.wells,0);assert.equal(v.diagnostics.grains,0);v.dispose();v.dispose();audio.dispose();
});
test('composed audio preserves unrelated recipes exactly, without another bus or profile overwrite',()=>{
 const recipe=composeElementRecipes({gravity:gravityAudioRecipe},corrosiveABAudioRecipe);
 for(const element of ['corrosive','fire','ice','shock','kinetic']as const)for(const event of ['shot','impact','status','release']as const)assert.deepEqual(recipe(element,event,{delivery:'rocket'}),corrosiveABAudioRecipe(element,event,{delivery:'rocket'}));
 assert.deepEqual(recipe('gravity','status'),gravityAudioRecipe('gravity','status'));assert.notDeepEqual(recipe('gravity','impact'),elementalAudioRecipe('gravity','impact'));
});
test('module composition preserves dual-element contact energy and secondary channel sizing exactly',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),base=new ElementalPresentation(scene,camera,{corrosiveAB:true});let calls=0,clears=0;
 const composed=new ComposedElementalPresentation(scene,camera,{gravity:{create:()=>({impact:()=>calls++,clear:()=>{clears++;},dispose:()=>{}})}});
 const spec={...createWeaponSpec('rocket','gravity'),secondaryElement:'corrosive'as const},event={point:new THREE.Vector3(),normal:new THREE.Vector3(0,1,0),phase:'detonate'as const,spec,radius:4.2,energy:50};
 base.impact(event);composed.impact(event);assert.equal(calls,1);assert.deepEqual(composed.corrosive!.events,base.corrosive!.events);assert.equal(composed.impacts.activeCount,base.impacts.activeCount);assert.equal(composed.audio.activeVoiceCount,0);
 composed.clear();assert.ok(clears>0);composed.dispose();base.dispose();
});
