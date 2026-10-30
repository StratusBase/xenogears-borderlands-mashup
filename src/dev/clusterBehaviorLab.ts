import './clusterBehaviorLab.css';
import * as THREE from 'three';
import { createWeaponSpec, type WeaponSpec } from '../core/arsenal';
import type { Mode } from '../core/index';
import { effectiveProjectileDamage } from '../core/weaponBalance';
import { PlayerBallistics, type BallisticTarget, type BallisticWorldImpact } from '../rendering/PlayerBallistics';
import { ElementalPresentation } from '../rendering/quality/elementalPresentation';

type Payload = 'kinetic' | 'fire-corrosive' | 'ice';
type Scenario = 'target' | 'ground' | 'wall' | 'air';
interface TargetState extends BallisticTarget { label: string; damage: number; color: string }
interface ReviewEvent { at: number; kind: 'contact' | 'detonate'; projectileId: number; energy: number; point: number[]; stage?: 'cluster-burst' | 'bomblet' }
const STEP = 1 / 60;

/** Uses the production projectile authority and presentation adapter. Targets are
 * static hit proxies: this fixture does not simulate AI, health or status DPS. */
function startReview(): void {
  const host = document.querySelector<HTMLElement>('#app')!;
  host.innerHTML = `<main class="mirv-shell">
    <header class="mirv-header">
      <div class="mirv-title"><h1>Cluster / MIRV behavior</h1><small>Actual projectile simulation · muted by default</small></div>
      <p class="mirv-note">Look for a parent burst, scattering physical bomblets, then delayed secondary explosions. Floor, cover and target contacts use the same collision code as the game. <a href="/cluster-play-lab.html" target="_blank" rel="noopener">Play Cluster in the actual game</a></p>
      <div class="mirv-controls">
        <label>Form<select id="mirv-mode"><option value="pilot">Pilot Cluster</option><option value="mech">Mech Cluster</option></select></label>
        <label>Payload<select id="mirv-payload"><option value="kinetic">Kinetic</option><option value="fire-corrosive">Fire + corrosive</option><option value="ice">Ice</option></select></label>
        <label>Aim<select id="mirv-scenario"><option value="target">Target contact</option><option value="ground">Ground contact</option><option value="wall">Wall / protected target</option><option value="air">Range-end airburst</option></select></label>
        <label>Speed<select id="mirv-speed"><option value="1">Native speed</option><option value="0.25">Slow motion ×0.25</option></select></label>
        <div class="mirv-actions"><button id="mirv-fire" type="button">Fire Cluster</button><button id="mirv-reset" type="button">Reset</button><button id="mirv-pause" type="button">Pause</button><button id="mirv-step" type="button">Step 0.1 s</button><button id="mirv-side" type="button">Side view</button><button id="mirv-overhead" type="button">Overhead</button></div>
        <label class="mirv-sound"><input id="mirv-sound" type="checkbox"> Sound</label>
      </div>
    </header>
    <section class="mirv-viewport" aria-label="Cluster projectile review scene"><div class="mirv-scene-note" id="mirv-scene-note"></div></section>
    <footer class="mirv-footer">
      <div class="mirv-stats" aria-live="polite">
        <div class="mirv-stat">Simulation time<strong id="mirv-clock">0.00 s</strong></div><div class="mirv-stat">Active rounds<strong id="mirv-active">0</strong></div><div class="mirv-stat">Detonations<strong id="mirv-blasts">0</strong></div>
        <p class="mirv-phase" id="mirv-phase">Ready to fire one carrier.</p><div class="mirv-targets" id="mirv-targets"></div>
      </div>
      <div><p class="mirv-log-title">Authoritative contact / detonation timeline</p><pre class="mirv-log" id="mirv-log">No events yet.</pre><p class="mirv-footnote">Static targets · fixed 100 / 160 base trigger damage · no AI or status-damage evaluation.</p></div>
    </footer>
  </main>`;
  const control = <T extends HTMLElement>(id: string) => document.getElementById(id)! as T;
  const modeSelect = control<HTMLSelectElement>('mirv-mode'), payloadSelect = control<HTMLSelectElement>('mirv-payload');
  const scenarioSelect = control<HTMLSelectElement>('mirv-scenario'), speedSelect = control<HTMLSelectElement>('mirv-speed');
  const soundInput = control<HTMLInputElement>('mirv-sound'), fireButton = control<HTMLButtonElement>('mirv-fire');
  const pauseButton = control<HTMLButtonElement>('mirv-pause'), viewport = document.querySelector<HTMLElement>('.mirv-viewport')!;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xc9d6d3); scene.fog = new THREE.Fog(0xc9d6d3, 55, 110);
  const camera = new THREE.PerspectiveCamera(43, 1, .06, 180);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  renderer.domElement.setAttribute('aria-label', 'Real Cluster carrier, bomblets and explosions over a physical floor'); viewport.prepend(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xfff2d2, 0x47606a, 2.3));
  const sun = new THREE.DirectionalLight(0xffffff, 3); sun.position.set(-7, 15, 8); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(85, 100), new THREE.MeshStandardMaterial({ color: 0xb6aa83, roughness: 1 }));
  ground.name = 'mirv-physical-floor'; ground.rotation.x = -Math.PI / 2; ground.position.z = -13; scene.add(ground);
  const grid = new THREE.GridHelper(70, 35, 0x637768, 0x9c9f87); grid.position.set(0, .004, -13); scene.add(grid);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(7.2, 4, .45), new THREE.MeshStandardMaterial({ color: 0x50656c, roughness: .9 }));
  wall.name = 'mirv-physical-cover'; wall.position.set(0, 2, -15); scene.add(wall);
  const wallEdges = new THREE.LineSegments(new THREE.EdgesGeometry(wall.geometry), new THREE.LineBasicMaterial({ color: 0xb9cfcc })); wall.add(wallEdges);
  const targets: TargetState[] = [];
  for (const [index, color] of ['#d36b3d', '#438f8a', '#85668e'].entries()) {
    const root = new THREE.Group(); root.name = `static-target-${index + 1}`;
    const material = new THREE.MeshStandardMaterial({ color, roughness: .76 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(.85, 1.6, .65), material); body.position.y = .94; body.userData.enemyId = index + 1;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(.26, 1), material); head.position.y = 1.98; head.userData.enemyId = index + 1;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.62, .72, .18, 12), new THREE.MeshStandardMaterial({ color: 0x374b4f })); base.position.y = .09;
    root.add(body, head, base); scene.add(root); targets.push({ id: index + 1, label: String.fromCharCode(65 + index), root, radius: 1.2, damage: 0, color });
  }
  const origin = new THREE.Vector3(0, 1.75, 6), aimPoint = new THREE.Vector3();
  const launcher = new THREE.Mesh(new THREE.CylinderGeometry(.12, .16, .75, 8), new THREE.MeshStandardMaterial({ color: 0x32454c }));
  scene.add(launcher);
  const aimMark = new THREE.Mesh(new THREE.OctahedronGeometry(.11), new THREE.MeshBasicMaterial({ color: 0xfff3c2, wireframe: true })); scene.add(aimMark);
  const presentation = new ElementalPresentation(scene, camera, { corrosiveAB: true }); presentation.audio.setEnabled(false);
  let time = 0, paused = false, accumulator = 0, hasShot = false, stopped = false;
  let events: ReviewEvent[] = [], impacts = 0, damageEvents = 0, droppedEvents = 0, launchedSpec: WeaponSpec | null = null;
  const mode = () => modeSelect.value as Mode, scenario = () => scenarioSelect.value as Scenario;
  const carrierRange = () => scenario() === 'air' ? 24 : 90;
  const spec = (): WeaponSpec => {
    const payload = payloadSelect.value as Payload;
    const value = createWeaponSpec('cluster', payload === 'fire-corrosive' ? 'fire' : payload, mode());
    if (payload === 'fire-corrosive') value.secondaryElement = 'corrosive';
    return value;
  };
  const ballistics = new PlayerBallistics(scene, {
    targets: () => targets,
    occluders: () => [ground, wall],
    hit(hit) { const target = targets.find(value => value.id === hit.targetId); if (target) { target.damage += hit.damage; damageEvents++; } },
    worldImpact(event: Readonly<BallisticWorldImpact>) {
      if (event.phase === 'detonate') impacts++;
      if (events.length >= 160) { droppedEvents++; return; }
      events.push({ at: time, kind: event.phase, stage: event.stage, projectileId: event.projectileId, energy: event.energy, point: [event.point.x, event.point.y, event.point.z] });
    },
  });
  ballistics.setPresentation(presentation);
  function sideView(): void { camera.up.set(0, 1, 0); camera.position.set(9, 6, -7); camera.lookAt(0, 1.2, -18); }
  function resize(): void { const width = viewport.clientWidth, height = viewport.clientHeight; renderer.setSize(width, height); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); }
  function arrange(): void {
    origin.set(0, mode() === 'mech' ? 4.4 : 1.75, 6);
    wall.visible = scenario() === 'wall';
    const positions = wall.visible ? [[-2.5, 0, -11.7], [0, 0, -17.2], [5.3, 0, -14]] : [[0, 0, -13], [-3.1, 0, -14.4], [3.1, 0, -14.4]];
    targets.forEach((target, index) => target.root.position.set(...positions[index] as [number, number, number]));
    if (scenario() === 'target') aimPoint.set(0, 1.15, -13);
    else if (scenario() === 'ground') aimPoint.set(0, 0, -12);
    else if (scenario() === 'wall') aimPoint.set(0, 1.1, -15);
    else aimPoint.set(0, 7, -32);
    if (scenario() === 'air') aimMark.position.copy(origin).addScaledVector(aimPoint.clone().sub(origin).normalize(), carrierRange());
    else aimMark.position.copy(aimPoint);
    launcher.position.copy(origin).addScaledVector(aimPoint.clone().sub(origin).normalize(), -.45);
    launcher.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), aimPoint.clone().sub(origin).normalize());
    scene.updateMatrixWorld(true);
    control('mirv-scene-note').textContent = wall.visible
      ? 'Physical wall active. A is in front; B is behind cover; C is beside it. Blast damage must respect the wall.'
      : scenario() === 'air' ? 'Carrier deploys at its explicit 24 m range endpoint. Bomblets keep their own local travel and fuses.'
      : 'Physical floor / 2 m grid. A is the central target; B and C show the surrounding blast footprint.';
  }
  function reset(): void {
    ballistics.clear(); presentation.clear(); time = 0; accumulator = 0; hasShot = false; events = []; impacts = 0; damageEvents = 0; droppedEvents = 0; launchedSpec = null;
    targets.forEach(target => { target.damage = 0; }); arrange(); refresh();
  }
  function refresh(): void {
    control('mirv-clock').textContent = `${time.toFixed(2)} s`;
    control('mirv-active').textContent = String(ballistics.activeCount);
    control('mirv-blasts').textContent = String(impacts);
    const parentBlasts = events.filter(event => event.kind === 'detonate' && event.stage === 'cluster-burst').length;
    const bombletBlasts = events.filter(event => event.kind === 'detonate' && event.stage === 'bomblet').length;
    const stageSummary = parentBlasts ? `${parentBlasts} parent burst + ${bombletBlasts} bomblet blasts` : `${impacts} detonations`;
    control('mirv-phase').textContent = paused ? hasShot ? 'Paused — projectile motion and fuses are stopped.' : 'Paused — ready to fire one carrier.' : !hasShot ? 'Ready to fire one carrier.'
      : ballistics.activeCount === 0 ? `Payload finished: ${stageSummary}.`
      : bombletBlasts > 0 ? `Secondary explosions: ${bombletBlasts} bomblet blasts recorded.`
      : parentBlasts > 0 ? 'Parent burst — bomblets scattering; their fuses are running.'
      : impacts > 0 ? 'Detonations recorded — watch the remaining rounds.' : 'Carrier in flight — no detonation recorded yet.';
    control('mirv-targets').innerHTML = targets.map(target => `<span style="--target-color:${target.color}">${target.label}: ${target.damage.toFixed(1)} damage</span>`).join('');
    const log = control('mirv-log');
    log.textContent = events.length ? events.slice(-12).map(event => {
      const label = event.kind !== 'detonate' ? 'Contact' : event.stage === 'cluster-burst' ? 'Parent burst' : event.stage === 'bomblet' ? 'Bomblet blast' : 'Blast';
      return `${event.at.toFixed(3).padStart(6)} s  ${label.padEnd(13)} #${event.projectileId} · ${event.energy.toFixed(2)} energy`;
    }).join('\n') : 'No events yet.';
    log.scrollTop = log.scrollHeight;
    fireButton.disabled = ballistics.activeCount > 0;
  }
  fireButton.addEventListener('click', () => {
    reset(); pauseButton.textContent = paused ? 'Resume' : 'Pause'; hasShot = true;
    const recipe = spec(); launchedSpec = structuredClone(recipe);
    const triggerDamage = mode() === 'mech' ? 160 : 100;
    presentation.shot(recipe, mode());
    ballistics.fire(origin, aimPoint.clone().sub(origin).normalize(), recipe, effectiveProjectileDamage(triggerDamage, recipe), carrierRange(), 'cindergrid');
    refresh();
  });
  control('mirv-reset').addEventListener('click', reset);
  pauseButton.addEventListener('click', () => { paused = !paused; pauseButton.textContent = paused ? 'Resume' : 'Pause'; if (paused) presentation.audio.pause(); refresh(); });
  control('mirv-step').addEventListener('click', () => {
    paused = true; pauseButton.textContent = 'Resume'; accumulator = 0;
    for (let tick = 0; tick < Math.round(.1 / STEP); tick++) stepSimulation();
    presentation.update(0, time, true, launchedSpec ?? spec(), mode());
    refresh(); renderer.render(scene, camera);
  });
  control('mirv-side').addEventListener('click', sideView);
  control('mirv-overhead').addEventListener('click', () => { camera.up.set(0, 0, -1); camera.position.set(0, 15, -18); camera.lookAt(0, 0, -18); });
  for (const select of [modeSelect, payloadSelect, scenarioSelect]) select.addEventListener('change', reset);
  soundInput.addEventListener('change', () => { presentation.audio.setEnabled(soundInput.checked); if (soundInput.checked) void presentation.audio.unlock(); });
  const observer = new ResizeObserver(resize); observer.observe(viewport);
  sideView(); arrange(); resize(); refresh();
  function stepSimulation(): void {
    time += STEP; ballistics.update(STEP);
    presentation.update(STEP, time, false, launchedSpec ?? spec(), mode());
  }
  let last = performance.now(), hudAt = 0;
  function frame(now: number): void {
    if (stopped) return;
    const elapsed = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now;
    if (!paused) {
      accumulator += elapsed * Number(speedSelect.value);
      while (accumulator >= STEP) {
        accumulator -= STEP; stepSimulation();
      }
    } else presentation.update(0, time, true, launchedSpec ?? spec(), mode());
    if (now - hudAt >= 50) { refresh(); hudAt = now; }
    renderer.render(scene, camera); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  Object.defineProperty(window, 'clusterBehaviorLab', { configurable: true, value: Object.freeze({
    snapshot: () => structuredClone({ time, paused, speed: Number(speedSelect.value), mode: mode(), payload: payloadSelect.value, scenario: scenario(), soundEnabled: soundInput.checked,
      carrierRange: carrierRange(), activeProjectiles: ballistics.activeCount, effects: ballistics.effectCount, detonations: impacts, damageEvents, droppedEvents,
      spec: launchedSpec, targets: targets.map(target => ({ id: target.id, label: target.label, damage: target.damage, position: target.root.position.toArray() })), events }),
  }) });
  window.addEventListener('pagehide', () => {
    stopped = true; observer.disconnect(); ballistics.clear(); presentation.dispose(); renderer.dispose();
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) { geometries.add(object.geometry); for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material); } });
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose());
  }, { once: true });
}

if (import.meta.env.DEV) startReview();
else document.body.replaceChildren(document.createTextNode('This development fixture is unavailable in production.'));
