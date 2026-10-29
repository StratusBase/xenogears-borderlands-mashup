import '../style.css';
import * as THREE from 'three';
import { Game } from '../game';
import { createProgression } from '../core/index';
import { LEDGE_CLIMB_DURATION, type LedgeGrab } from '../core/ledgeClimb';
import type { JumpMotion } from '../core/jump';

/** Isolated review: actual Game movement/animation on existing world geometry.
 * Only the starting location/airborne pose is staged; every climb uses jump(). */
if (import.meta.env.DEV) {
  const style = document.createElement('style');
  style.textContent = '.mouse-capture-control{display:none!important}'; document.head.append(style);
  const game = new Game(document.querySelector<HTMLElement>('#app')!, {
    initialProgression: createProgression(), saveKey: 'dust-steel.ledge-review.v1',
    autoEncounters: false, evaluationDriver: true, manualEvaluation: true,
  });
  const g = game as unknown as {
    camera: THREE.PerspectiveCamera; yaw: number; pitch: number; time: number;
    jumpMotion: JumpMotion; ledgeClimb?: { grab: LedgeGrab }; screen: string;
    start(capture: boolean): void; resetTraversal(): void; applyWeaponPose(): void;
    updateSimulationPresentation(dt: number): void; updateHUD(): void;
  };
  g.start(false); game.driveEvaluation({}); game.run();
  const panel = document.createElement('aside');
  panel.style.cssText = 'position:fixed;right:22px;top:155px;z-index:40;width:270px;padding:14px;background:#14272bf2;color:#f4dfad;font:12px system-ui;border:1px solid #d9ad5d;border-radius:5px';
  const title = document.createElement('strong'); title.textContent = 'LEDGE CLIMB REVIEW'; panel.append(title);
  const description = document.createElement('p'); description.textContent = 'Real movement and planted hands. Choose a ledge, then play the climb or inspect a pose.'; panel.append(description);
  const scenario = document.createElement('select'); scenario.setAttribute('aria-label', 'Climb scenario');
  for (const [value, text] of [['cover', 'Low cover · 1.3 m'], ['container', 'Airborne container grab · 3.37 m']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = text; scenario.append(option);
  }
  scenario.style.cssText = 'width:100%;margin-bottom:10px;padding:7px'; panel.append(scenario);
  const output = document.createElement('output'); output.setAttribute('aria-label', 'Climb state');
  output.style.cssText = 'display:block;line-height:1.6;margin-top:10px;white-space:pre-line';
  let running = false, until = Infinity, stopWhenLanded = true;
  function read() {
    const state = game.getEncounterSnapshot();
    output.textContent = `${state.traversal.climbing ? state.traversal.phase : state.traversal.grounded ? 'Standing' : 'Airborne'} · ${Math.round(state.traversal.progress * 100)}%\nFeet ${state.traversal.feet.toFixed(2)} m · Eye ${state.position.y.toFixed(2)} m`;
    output.dataset.state = JSON.stringify({ ...state.traversal, position: state.position, screen: state.screen });
  }
  function reset() {
    running = false; g.resetTraversal(); game.driveEvaluation({});
    const high = scenario.value === 'container';
    g.camera.position.set(high ? -15 : 23, (high ? 1.35 : 0) + 1.8, high ? -7 : 18.98);
    g.jumpMotion.height = high ? 1.35 : 0; g.jumpMotion.used = high ? 2 : 0;
    g.yaw = 0; g.pitch = -.08; g.camera.rotation.set(g.pitch, g.yaw, 0);
    g.applyWeaponPose(); g.updateSimulationPresentation(0); g.updateHUD();
    game.renderEvaluation(0, true); read();
  }
  function begin() { reset(); game.driveEvaluation({ jump: true }); return !!g.ledgeClimb; }
  function button(text: string, action: () => void) {
    const control = document.createElement('button'); control.textContent = text;
    control.style.cssText = 'padding:7px 9px;margin:0 5px 6px 0;background:#eed7a2;color:#15272b;border:0;border-radius:3px;cursor:pointer';
    control.onclick = action; panel.append(control);
  }
  button('Play climb', () => { if (begin()) { running = true; until = Infinity; stopWhenLanded = true; } });
  button('Reset', reset);
  for (const [text, progress] of [['Reach pose', .15], ['Pull pose', .43], ['Transfer pose', .7], ['Standing pose', 1]] as const) {
    button(text, () => {
      if (!begin()) return;
      let remaining = LEDGE_CLIMB_DURATION * progress + (progress === 1 ? .00001 : 0);
      while (remaining > .000001) { const dt = Math.min(1 / 60, remaining); game.stepEvaluation(dt); remaining -= dt; }
      game.renderEvaluation(0, true); read();
    });
  }
  button('Walk off ledge', () => { game.driveEvaluation({ moveX: 1 }); running = true; until = g.time + 2.5; stopWhenLanded = false; });
  button('Explore · normal controls', () => { game.driveEvaluation({}); running = true; until = Infinity; stopWhenLanded = false; });
  panel.append(output); document.body.append(panel); scenario.onchange = reset; reset();
  let previous = performance.now();
  const tick = (now: number) => {
    if (running) {
      game.stepEvaluation(Math.min(.045, Math.max(.001, (now - previous) / 1000)));
      if (g.time >= until || stopWhenLanded && !g.ledgeClimb) { running = false; game.driveEvaluation({}); }
    }
    previous = now; read(); requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
} else document.body.replaceChildren(document.createTextNode('This review fixture is available only in development.'));
