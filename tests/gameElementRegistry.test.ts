import assert from 'node:assert/strict';
import test, {after, before} from 'node:test';
import * as THREE from 'three';
import * as registry from '../src/rendering/quality/gameElements.ts';
import type {ElementResponse} from '../src/rendering/quality/shared/composedPresentation.ts';

const {createGameElements, createGameElementsBeforeAdhesive,
 createGameElementsBeforeRadiation, createGameElementsBeforeShock,
 createGameElementsBeforeShockEquipment} = registry;
// Fire's full-pass registration is a separately owned delivery. Keep this
// regression valid both before and after that optional registry API lands.
const optionalFactory = (name:string): typeof createGameElements[] => {
 const value = Reflect.get(registry, name);
 return typeof value === 'function' ? [value as typeof createGameElements] : [];
};

let originalDocument: PropertyDescriptor | undefined;
before(() => {
 originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
 Object.defineProperty(globalThis, 'document', {configurable:true, value:{
  createElement:() => ({width:0, height:0, getContext:() => ({fillRect(){}, clearRect(){}, strokeRect(){}, fillText(){}})}),
 }});
});
after(() => {
 if(originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
 else Reflect.deleteProperty(globalThis, 'document');
});

test('element and equipment baselines preserve unrelated Fire and Shock options', () => {
 const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
 const options = {fire:{full:false, hybrid:false}, shock:{equipment:'legacy' as const}};
 for(const factory of [createGameElements, createGameElementsBeforeAdhesive,
  createGameElementsBeforeRadiation, createGameElementsBeforeShock,
  createGameElementsBeforeShockEquipment, ...optionalFactory('createGameElementsBeforeFire'),
  ...optionalFactory('createGameElementsBeforeFireEquipment')]) {
  const layer = factory(scene, camera, options);
  try {
   const fire = layer.responses.get('fire') as (ElementResponse & {fire:{hybrid?:unknown}}) | undefined;
   if(fire) {
    assert.ok(fire.fire, `${factory.name} did not return its registered Fire response`);
    assert.equal(Boolean(fire.fire.hybrid), false, `${factory.name} lost the Fire option`);
   }
   const shock = layer.responses.get('shock');
   if(shock) assert.equal(shock.equipment, undefined, `${factory.name} lost the Shock equipment baseline`);
  } finally {layer.dispose();}
 }
});
