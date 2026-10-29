import '../style.css';
import { createProgression, getStats } from '../core/index';
import type { DamageEffect } from '../core/feedback';
import { GameUI } from '../ui';

/** Development-only fixture; never imported by the game or its production entrypoint. */
function inspectFeedback(): void {
  const host = document.querySelector<HTMLElement>('#app')!;
  const state = createProgression();
  const stats = getStats(state, 'pilot');
  const noop = () => {};
  const ui = new GameUI(host, {
    start: noop, resume: noop, reset: noop, equip: noop, sell: noop,
    closeMenu: noop, spawnWave: noop, switchMode: noop, toggleSound: noop,
  });
  ui.setScreen('none', state, 'pilot');
  ui.update({
    mode: 'pilot', health: stats.maxHealth, maxHealth: stats.maxHealth,
    shield: stats.maxShield, maxShield: stats.maxShield, ammo: stats.magazine, magazine: stats.magazine,
    heat: 0, heatCapacity: stats.heatCapacity, zoneName: 'FEEDBACK INSPECTION', zoneRestriction: 'both',
    wave: 0, enemies: 0, kills: 0, credits: 0, weaponName: 'FIELD RIFLE', interaction: '',
    reloading: false, overheated: false, fps: 60, objective: '',
  });

  type HitKind = 'normal' | 'critical' | DamageEffect;
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('button[data-hit]')];
  const repeat = document.querySelector<HTMLInputElement>('#repeat-feedback')!;
  const selection = document.querySelector<HTMLElement>('#feedback-selection')!;
  let selected: HitKind | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  function hit(kind: HitKind): void {
    ui.hit(kind === 'critical' ? 120 : kind === 'normal' ? 42 : 18, kind === 'critical',
      kind === 'normal' || kind === 'critical' ? undefined : kind);
  }

  function refreshRepeating(): void {
    if (timer !== null) clearInterval(timer);
    timer = repeat.checked && selected ? setInterval(() => { if (selected) hit(selected); }, 450) : null;
  }

  for (const control of buttons) {
    control.addEventListener('click', () => {
      selected = control.dataset.hit as HitKind;
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button === control)));
      selection.textContent = `${control.textContent?.toUpperCase()} / ACTUAL GameUI.hit()`;
      hit(selected);
      refreshRepeating();
    });
  }
  repeat.addEventListener('change', refreshRepeating);
  window.addEventListener('pagehide', () => { if (timer !== null) clearInterval(timer); });
}

if (import.meta.env.DEV) inspectFeedback();
else document.body.replaceChildren(document.createTextNode('This development fixture is unavailable in production.'));
