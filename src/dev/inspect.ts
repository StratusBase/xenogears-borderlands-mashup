/** Development-only views of the actual world/rendering modules, without combat or saves. */
import * as THREE from 'three';
import { createWorld } from '../world';
import { ComicRenderer } from '../rendering/ComicRenderer';
import { createLootEffects } from '../rendering/lootEffects';
import { createEnemyBars } from '../rendering/enemyBars';
import { createComicMaterial } from '../rendering/materials';
import { createHealthPickup } from '../rendering/healthPickup';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const world = createWorld(scene);
world.parkedMech.visible = false;
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 350);
const comic = new ComicRenderer(renderer, scene, camera);

const lootFixture = new THREE.Group();
for (const [x, z, color, height] of [[-15, -5, 0x49bcf4, 1], [-15, -14, 0xffce4b, 0.75], [-18, -5, 0xcbd1cf, 1]]) {
  const glow = createLootEffects(color); glow.position.set(x, 0, z); glow.scale.y = height;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.3, 0.4), createComicMaterial(color));
  body.position.set(x, 0.5, z); lootFixture.add(body, glow);
}
const vitalsFixture = new THREE.Group();
const medicalPickup = createHealthPickup(); medicalPickup.position.set(-12, 0, -5); lootFixture.add(medicalPickup);
const inspectionBars = [createEnemyBars(), createEnemyBars(), createEnemyBars()];
inspectionBars.forEach((bars, index) => {
  bars.group.position.set((index - 1) * 2.4, 3.0, -8);
  bars.update(index === 0 ? 100 : index === 1 ? 45 : 20, 100, index === 1 ? 30 : 0, index === 0 ? 0 : 60);
  vitalsFixture.add(bars.group);
  const target = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.8), createComicMaterial(index ? 0xb4442a : 0xe9c996));
  target.position.set((index - 1) * 2.4, 1.1, -8); vitalsFixture.add(target);
});
scene.add(lootFixture, vitalsFixture);

const views = {
  crossing: { name: 'Road junction', position: [17, 4.4, 17], target: [-2, 0, 5] },
  hazard: { name: 'Hazard paint', position: [30, 4.4, 31], target: [35, 0, -5] },
  mesa: { name: 'Rock shadows', position: [-44, 4.4, 49], target: [-43, 16, 81] },
  rockContact: { name: 'Southwest rock / ground contact', position: [-22, 1.8, 40], target: [-29, 0.7, 37] },
  rockContactNorth: { name: 'Northeast rock / ground contact', position: [21, 1.8, -34], target: [28, 0.7, -37] },
  gateJoint: { name: 'Mech gate / near post and top-beam joint', position: [28, 1.8, 18], target: [35, 9.2, 12] },
  gateJointClose: { name: 'Mech gate / close joint from yard', position: [31, 1.8, 14], target: [35, 9.4, 12] },
  gateJointReverse: { name: 'Mech gate / joint from heavy range', position: [42, 1.8, 18], target: [35, 9.2, 12] },
  loot: { name: 'Blue glow in front · gold hidden by cover · red/white health pickup', position: [-15, 1.8, 4], target: [-15, 1.8, -10] },
  vitals: { name: 'Full health · partial health + shield · depleted shield', position: [0, 1.8, -2], target: [0, 2.1, -8] },
} satisfies Record<string, {name: string; position: number[]; target: number[]}>;
type View = keyof typeof views;
let selected: View = 'crossing';
// A selected view starts at its authored camera height. Explicit height toggles
// override only that selection, so contact/joint views really begin at 1.8 m.
let eyeHeightOverride: number | null = null;
let receiveRockShadows = true;
let softShadows = true;

function updateView(): void {
  const view = views[selected];
  const eyeHeight = eyeHeightOverride ?? view.position[1];
  const mechHeight = eyeHeight >= 3;
  camera.position.set(view.position[0], eyeHeight, view.position[2]);
  camera.lookAt(new THREE.Vector3(...view.target as [number, number, number]));
  lootFixture.visible = selected === 'loot';
  vitalsFixture.visible = selected === 'vitals';
  inspectionBars.forEach(bars => bars.group.quaternion.copy(camera.quaternion));
  const heightButton = document.querySelector<HTMLButtonElement>('#height')!;
  heightButton.setAttribute('aria-pressed', String(mechHeight));
  heightButton.textContent = mechHeight ? 'Mech eye height' : 'Pilot eye height';
  document.querySelector('#view-label')!.textContent = `${view.name} · ${mechHeight ? 'mech' : 'pilot'} eye height`;
}
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => {
  button.addEventListener('click', () => {
    selected = button.dataset.view as View;
    eyeHeightOverride = null;
    document.querySelectorAll('[data-view]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    updateView();
  });
});
document.querySelector<HTMLButtonElement>('#height')!.addEventListener('click', () => {
  eyeHeightOverride = camera.position.y >= 3 ? 1.8 : 4.4;
  updateView();
});
document.querySelector<HTMLButtonElement>('#shadows')!.addEventListener('click', event => {
  receiveRockShadows = !receiveRockShadows;
  scene.traverse(object => {
    if (object instanceof THREE.Mesh && (object.name.startsWith('mesa-body-') || object.name.startsWith('mesa-cap-'))) object.receiveShadow = receiveRockShadows;
  });
  const button = event.currentTarget as HTMLButtonElement;
  button.setAttribute('aria-pressed', String(receiveRockShadows));
  button.textContent = receiveRockShadows ? 'Rock shadows on' : 'Rock shadows off';
});
document.querySelector<HTMLButtonElement>('#filter')!.addEventListener('click', event => {
  softShadows = !softShadows;
  renderer.shadowMap.type = softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.shadowMap.needsUpdate = true;
  scene.traverse(object => {
    if (object instanceof THREE.Mesh) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.needsUpdate = true;
    }
  });
  const button = event.currentTarget as HTMLButtonElement;
  button.setAttribute('aria-pressed', String(softShadows));
  button.textContent = softShadows ? 'Soft shadow filter' : 'Crisp shadow filter';
});
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  comic.resize(innerWidth, innerHeight, renderer.getPixelRatio());
});
window.addEventListener('pagehide', () => {
  renderer.setAnimationLoop(null);
  inspectionBars.forEach(bars => bars.dispose());
  comic.dispose(); world.dispose(); renderer.dispose();
});
updateView();
renderer.setAnimationLoop(() => comic.render());
