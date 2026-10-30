import '../style.css';
import { Game, type EvaluationShot } from '../game';
import { createProgression, type Mode } from '../core/index';
import { createWorkbenchWeapon, DEFAULT_WORKBENCH_CONFIG, workbenchCode } from '../core/workbench';
import type { CombatMeasurementEvent } from '../encounter/contracts';

/** Actual Game and ordinary RAF: this fixture supplies equipment and public
 * inputs only. It does not step the simulation or mutate combat statistics. */
function startPlayLab(): void {
  const initial = createProgression();
  const fixture = (['pilot', 'mech'] as const).map(mode => {
    const config = { ...DEFAULT_WORKBENCH_CONFIG, target: mode, brand: 'cindergrid' as const,
      weaponType: 'launcher' as const, projectile: 'cluster' as const, element: 'fire' as const,
      secondaryElement: 'corrosive' as const, trail: 'comet' as const,
      rarity: 'rare' as const, level: 5, guaranteedStatus: false };
    const weapon = createWorkbenchWeapon(config, `cluster-play-${mode}`);
    initial.inventory.push(weapon); initial.loadouts[mode].weapon = weapon.id;
    return { mode, code: workbenchCode(config), weapon: structuredClone(weapon) };
  });
  let selectedMode: Mode = 'pilot', started = false, singleShotPending = false;
  let shots = 0, directDamage = 0, statusDamage = 0;
  const measurements: CombatMeasurementEvent[] = [], trajectories: EvaluationShot[] = [];
  const game = new Game(document.querySelector<HTMLElement>('#app')!, {
    initialProgression: initial, saveKey: 'dust-steel.cluster-play.mirv.v1',
    evaluationDriver: true, autoEncounters: false,
    onMeasurement(event) {
      if (event.type === 'shot') {
        shots++;
        if (singleShotPending) { singleShotPending = false; game.driveEvaluation({ fire: false }); }
      }
      if (event.type === 'damage' && event.target === 'dummy') {
        if (event.source === 'direct') directDamage += event.health + event.shield;
        if (event.source === 'status') statusDamage += event.health + event.shield;
      }
      if (event.type !== 'interval') {
        measurements.push(structuredClone(event));
        if (measurements.length > 200) measurements.shift();
      }
    },
    onEvaluationShot(shot) { trajectories.push(structuredClone(shot)); if (trajectories.length > 24) trajectories.shift(); },
  });
  game.run();
  const panel = document.createElement('aside'); panel.setAttribute('aria-label', 'Actual Game Cluster review');
  panel.style.cssText = 'position:fixed;top:10px;left:10px;z-index:220;width:min(380px,calc(100vw - 20px));padding:11px 12px;background:#10232bf2;border:1px solid #88b9af;border-radius:5px;color:#f4ecd5;font:12px/1.4 system-ui;';
  const title = document.createElement('strong'); title.textContent = 'MIRV / ACTUAL GAME';
  const note = document.createElement('p'); note.style.cssText = 'margin:5px 0 8px;';
  note.textContent = 'Cindergrid Cluster launcher · rare level 5 · fire + corrosive · normal 35% carrier chance. Starts muted. Choose a form to reset the normal dummy test setup.';
  const actions = document.createElement('div'); actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
  function button(label: string, action: () => void): HTMLButtonElement {
    const value = document.createElement('button'); value.type = 'button'; value.textContent = label;
    value.style.cssText = 'padding:7px 9px;background:#315b5a;color:#fff3d8;border:1px solid #8fc5b7;border-radius:4px;font:700 12px system-ui;cursor:pointer;';
    value.addEventListener('click', action); actions.append(value); return value;
  }
  function releaseFire(): void { singleShotPending = false; game.driveEvaluation({ fire: false }); }
  function begin(mode: Mode): void {
    releaseFire(); selectedMode = mode; shots = 0; directDamage = 0; statusDamage = 0; measurements.length = 0; trajectories.length = 0;
    game.startDummyEvaluation(mode); started = true; refresh();
  }
  button('Pilot test', () => begin('pilot'));
  button('Mech test', () => begin('mech'));
  button('Reset target', () => begin(game.getEncounterSnapshot().mode));
  const fireButton = button('Fire one shot', () => {
    if (!started || game.getEncounterSnapshot().paused) begin(selectedMode);
    singleShotPending = true; game.driveEvaluation({ fire: true }); refresh();
  });
  const status = document.createElement('output'); status.setAttribute('aria-live', 'polite'); status.style.cssText = 'display:block;white-space:pre-wrap;margin-top:8px;font-variant-numeric:tabular-nums;';
  const help = document.createElement('p'); help.style.cssText = 'margin:7px 0 0;font-size:11px;color:#c0d4ca;';
  help.textContent = 'Native controls: click the canvas to capture the mouse, hold to fire, WASD move, R reload, Esc pause, K workbench. Dummy damage, ammunition, heat and elemental effects use the actual game.';
  const back = document.createElement('a'); back.href = '/cluster-behavior-lab.html'; back.textContent = 'Return to the wider MIRV review scene'; back.style.cssText = 'display:block;margin-top:6px;color:#b5edda;font-size:11px;';
  panel.append(title, note, actions, status, help, back); document.body.append(panel);
  function refresh(): void {
    const snapshot = game.getEncounterSnapshot();
    fireButton.disabled = singleShotPending;
    fireButton.textContent = singleShotPending ? 'Waiting for shot…' : 'Fire one shot';
    status.textContent = `${started ? snapshot.mode.toUpperCase() : 'Choose Pilot or Mech'} · ${snapshot.paused ? 'menu / paused' : 'ordinary gameplay clock'}\nShots ${shots} · Ammo ${snapshot.body.ammo} / ${snapshot.body.reserve} · Heat ${snapshot.body.heat.toFixed(1)}\nDummy: ${directDamage.toFixed(1)} blast + ${statusDamage.toFixed(1)} status damage`;
  }
  const refreshTimer = window.setInterval(refresh, 200); refresh();
  window.addEventListener('blur', releaseFire);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseFire(); });
  Object.defineProperty(window, 'clusterPlayLab', { configurable: true, value: Object.freeze({
    snapshot: () => structuredClone({ protocol: 'cluster-mirv-actual-game-v1', clock: 'ordinary Game RAF', fixture,
      selectedMode, started, singleShotPending, shots, directDamage, statusDamage, measurements, trajectories,
      game: game.getEncounterSnapshot(), presentation: game.presentationDiagnostics }),
  }) });
  window.addEventListener('pagehide', () => { releaseFire(); window.clearInterval(refreshTimer); }, { once: true });
}

if (import.meta.env.DEV) startPlayLab();
else document.body.replaceChildren(document.createTextNode('This development fixture is unavailable in production.'));
