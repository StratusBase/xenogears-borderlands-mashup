import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ElementalAudio} from '../src/audio/elementalAudio';
import {gravityModule,type GravityView} from '../src/rendering/quality/gravity/response';
import {GamePresentation} from '../src/rendering/quality/GamePresentation';
import {ComposedElementalPresentation} from '../src/rendering/quality/shared/composedPresentation';
import type {GravityWell} from '../src/core/effects/gravity/field';

const well=(age:number):GravityWell=>({id:'normal-field',ownerId:'pilot',point:{x:0,y:3,z:-5},center:{x:0,y:3,z:-3.2},normal:{x:0,y:0,z:1},radius:6,captureRadius:1.16,duration:4.5,age,power:1});
test('visible and audio-only Gravity consume identical state/events and emit identical field sound',()=>{
 const run=(field:'visible'|'audio-only')=>{const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),audio=new ElementalAudio(),cues:unknown[]=[];audio.cue=(...args)=>{cues.push(args);};const response=gravityModule(undefined,{seed:17,field}).create({scene,camera,audio}) as GravityView;
  for(let i=0;i<80;i++){const state={wells:[well(i/120)],members:[]},copy=structuredClone(state);response.sync(state);if(i===60)response.event({kind:'pulse',well:state.wells[0]});response.update?.(1/120,i/120);assert.deepEqual(state,copy);}response.event({kind:'end',well:well(4.5)});response.sync({wells:[],members:[]});for(let i=0;i<80;i++)response.update?.(1/120,4.5+i/120);if(field==='audio-only')assert.equal(scene.children.length,0);response.dispose();audio.dispose();return cues;};
 assert.deepEqual(run('visible'),run('audio-only'));
});
test('Enhanced rehydrates the current authoritative well without replaying events after Legacy',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),owner=new GamePresentation({scene,camera,weaponRoot:new THREE.Group(),comicRenderer:{outlineWidth:3},ballistics:{setPresentation(){}}}),cues:unknown[][]=[];
 owner.setElementalFactory((s,c)=>{const layer=new ComposedElementalPresentation(s,c,{gravity:gravityModule(undefined,{seed:17})}),log:unknown[]=[];layer.audio.cue=(...args)=>{log.push(args);};cues.push(log);return layer;});owner.setSoundEnabled(false);owner.setEnabled(true);const snapshot={wells:[well(.5)],members:[]},copy=structuredClone(snapshot);owner.gravity(snapshot,[{kind:'pulse',well:snapshot.wells[0]}]);assert.ok(scene.getObjectByName('gravity-source-normal-field'));assert.equal(cues[0].length,1);owner.setEnabled(false);assert.equal(scene.getObjectByName('gravity-source-normal-field'),undefined);owner.gravity({wells:[well(1.5)],members:[]},[{kind:'pulse',well:well(1.5)}]);owner.setEnabled(true);const source=scene.getObjectByName('gravity-source-normal-field')!;assert.deepEqual(source.position.toArray(),[0,3,-3.2]);assert.equal(cues[1].length,0);assert.deepEqual(snapshot,copy);owner.dispose();assert.equal(scene.children.length,0);
});
