import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { QualityFeedback, QUALITY_FEEDBACK_CAPACITY } from '../src/rendering/quality/feedback.ts';
import { QualityAudio, qualityAudioRecipe, qualityEnvelope, qualityNoiseSamples, QUALITY_AUDIO_MAX_VOICES, type QualityAudioEvent } from '../src/audio/qualityAudio.ts';

test('quality sound recipes are bounded, distinguish mech mass and retain physical reports with elements', () => {
  const events: QualityAudioEvent[] = ['fire', 'reload-out', 'reload-in', 'reload-bolt', 'impact-metal', 'impact-dust', 'impact-shield', 'step', 'land', 'dry', 'mount'];
  for (const event of events) for (const mode of ['pilot', 'mech'] as const) {
    const recipe = qualityAudioRecipe(event, { mode });
    assert.ok(recipe.length > 0 && recipe.length <= 6);
    for (const voice of recipe) {
      assert.ok(voice.duration > 0 && voice.duration <= .5);
      assert.ok(voice.attack > 0 && voice.attack < voice.duration);
      assert.ok(voice.gain > 0 && voice.gain < .85);
      assert.ok(voice.frequency >= 20 && voice.frequency <= 10000);
      assert.ok((voice.delay ?? 0) >= 0);
    }
  }
  const pilot = qualityAudioRecipe('fire', { mode: 'pilot' });
  const mech = qualityAudioRecipe('fire', { mode: 'mech' });
  assert.ok(Math.max(...mech.map(v => v.duration)) > Math.max(...pilot.map(v => v.duration)) * 2);
  assert.ok(mech.some(v => v.endFrequency === 32));
  const shock = qualityAudioRecipe('fire', { mode: 'pilot', element: 'shock' });
  assert.deepEqual(shock.slice(0, pilot.length), pilot, 'Element accents preserve mechanical gun report');
  assert.ok(shock.at(-1)!.gain < .05);
});

test('deterministic noise and envelopes stay finite and settle to silence', () => {
  assert.deepEqual(qualityNoiseSamples(128), qualityNoiseSamples(128));
  assert.notDeepEqual(qualityNoiseSamples(128, 1), qualityNoiseSamples(128, 2));
  assert.ok(qualityNoiseSamples(4800).every(value => Number.isFinite(value) && value >= -1 && value <= 1));
  assert.equal(qualityEnvelope(0, .1, .001), 0);
  assert.equal(qualityEnvelope(.001, .1, .001), 1);
  assert.ok(qualityEnvelope(.07, .1, .001) < .01);
  assert.equal(qualityEnvelope(.1, .1, .001), 0);
  assert.equal(qualityEnvelope(-.1, .1, .001), 0);
  assert.equal(qualityEnvelope(NaN, .1, .001), 0);
});

test('quality audio constructor and locked play never create a browser audio context', () => {
  const audio = new QualityAudio();
  assert.equal(audio.unlocked, false);
  for (let i = 0; i < 50; i++) audio.play('fire', { mode: 'mech' });
  assert.equal(audio.activeVoiceCount, 0);
  audio.setEnabled(false); assert.equal(audio.enabled, false);
  assert.doesNotThrow(() => { audio.pause(); audio.dispose(); audio.dispose(); audio.play('fire'); });
});

test('audio graph enforces a voice ceiling, releases tails on pause/mute and closes cleanly', async () => {
  class Param {
    value = 0;
    setValueAtTime(value: number, time: number) { assert.ok(Number.isFinite(value) && time >= 0); this.value = value; }
    linearRampToValueAtTime(value: number, time: number) { this.setValueAtTime(value, time); }
    exponentialRampToValueAtTime(value: number, time: number) { assert.ok(value > 0); this.setValueAtTime(value, time); }
    cancelScheduledValues() {}
  }
  class Node {
    gain = new Param(); frequency = new Param(); Q = new Param();
    threshold = new Param(); knee = new Param(); ratio = new Param(); attack = new Param(); release = new Param();
    disconnected = false;
    connect(target: Node) { return target; }
    disconnect() { this.disconnected = true; }
  }
  class Source extends Node {
    onended: (() => void) | null = null;
    stopped = false;
    start(time: number) { assert.ok(time >= 0); }
    stop() { this.stopped = true; }
  }
  let context: FakeContext;
  class FakeContext {
    state = 'suspended'; currentTime = 0; sampleRate = 48000; destination = new Node();
    sources: Source[] = [];
    constructor() { context = this; }
    createGain() { return new Node(); }
    createDynamicsCompressor() { return new Node(); }
    createBiquadFilter() { return new Node(); }
    createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
    createOscillator() { return this.createBufferSource(); }
    createBuffer() { const data = new Float32Array(48000); return { getChannelData: () => data }; }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
  }
  const original = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, writable: true, value: FakeContext });
  try {
    const audio = new QualityAudio();
    await audio.unlock(); assert.equal(audio.unlocked, true);
    for (let i = 0; i < 30; i++) audio.play('fire', { mode: 'mech' });
    assert.equal(audio.activeVoiceCount, QUALITY_AUDIO_MAX_VOICES);
    assert.ok(context!.sources.slice(0, -QUALITY_AUDIO_MAX_VOICES).every(source => source.stopped && source.disconnected));
    audio.pause(); assert.equal(audio.activeVoiceCount, 0);
    assert.ok(context!.sources.every(source => source.stopped && source.disconnected));
    audio.play('step'); assert.ok(audio.activeVoiceCount > 0);
    audio.setEnabled(false); assert.equal(audio.activeVoiceCount, 0);
    audio.play('fire'); assert.equal(audio.activeVoiceCount, 0);
    audio.setEnabled(true); audio.play('fire');
    context!.currentTime = 10; audio.play('dry');
    assert.equal(audio.activeVoiceCount, qualityAudioRecipe('dry').length, 'Stale background-tab voices are reclaimed by audio time');
    audio.dispose(); assert.equal(context!.state, 'closed'); assert.equal(audio.activeVoiceCount, 0);
    await audio.unlock(); assert.equal(audio.unlocked, false, 'Disposed instance stays inert');
  } finally {
    if (original) Object.defineProperty(globalThis, 'AudioContext', original);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
  }
});

test('feedback pools are bounded, pause-aware, raycast-inert and dispose once', () => {
  const scene = new THREE.Scene(), feedback = new QualityFeedback({ scene });
  const point = new THREE.Vector3(2, 1, -3);
  for (let i = 0; i < 100; i++) {
    feedback.fire({ mode: 'mech', muzzle: point, element: 'shock' });
    feedback.impact({ point, kind: 'metal', mode: 'mech' });
    feedback.step({ mode: 'mech', point: new THREE.Vector3(2, 0, -3) });
  }
  const capacity = Object.values(QUALITY_FEEDBACK_CAPACITY).reduce((a, b) => a + b, 0);
  assert.ok(feedback.activeParticleCount <= capacity);
  assert.equal(feedback.group.children.length, 4, 'All events share four instanced draw pools');
  const count = feedback.activeParticleCount;
  feedback.update(.1, { paused: true });
  assert.equal(feedback.activeParticleCount, count);
  feedback.update(.016);
  const ray = new THREE.Raycaster(new THREE.Vector3(2, 1, 0), new THREE.Vector3(0, 0, -1));
  assert.deepEqual(ray.intersectObject(feedback.group, true), [], 'Presentation cannot intercept combat shots');
  for (const object of feedback.group.children) {
    const mesh = object as THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
    assert.ok(mesh.count <= QUALITY_FEEDBACK_CAPACITY[mesh.name.split('-')[1] as keyof typeof QUALITY_FEEDBACK_CAPACITY]);
    assert.equal(mesh.material.depthTest, true);
    assert.equal(mesh.material.depthWrite, false);
  }
  for (let i = 0; i < 12; i++) feedback.update(.1);
  assert.equal(feedback.activeParticleCount, 0);
  assert.ok(feedback.group.children.every(mesh => !mesh.visible));
  const resources = feedback.group.children as THREE.InstancedMesh[];
  let geometryDisposals = 0;
  resources.forEach(mesh => mesh.geometry.addEventListener('dispose', () => geometryDisposals++));
  feedback.dispose(); feedback.dispose();
  assert.equal(geometryDisposals, 4);
  assert.equal(scene.children.length, 0);
});

test('muzzle flash uses the actual animated world socket without mutating it', () => {
  const scene = new THREE.Scene(), feedback = new QualityFeedback({ scene });
  const weapon = new THREE.Group(), barrel = new THREE.Group(), muzzle = new THREE.Object3D();
  weapon.position.set(3, 2, 1); weapon.rotation.set(.1, .5, -.2);
  barrel.position.set(.3, 0, -.5); muzzle.position.set(0, 0, -.7);
  scene.add(weapon); weapon.add(barrel); barrel.add(muzzle);
  const position = muzzle.getWorldPosition(new THREE.Vector3());
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(muzzle.getWorldQuaternion(new THREE.Quaternion()));
  const saved = muzzle.matrixWorld.toArray();
  feedback.fire({ mode: 'pilot', muzzle }); feedback.update(.001);
  const flash = feedback.group.getObjectByName('quality-flash-pool') as THREE.InstancedMesh;
  const matrix = new THREE.Matrix4(); flash.getMatrixAt(0, matrix);
  const center = new THREE.Vector3().setFromMatrixPosition(matrix);
  assert.ok(center.distanceTo(position.clone().addScaledVector(direction, .09)) < .0001);
  assert.deepEqual(muzzle.matrixWorld.toArray(), saved);
  barrel.position.z += .2;
  assert.ok(muzzle.getWorldPosition(new THREE.Vector3()).distanceTo(position) > .19);
  feedback.dispose();
});
