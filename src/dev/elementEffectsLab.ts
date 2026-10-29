import '../style.css';
import { Game } from '../game';
import { createProgression, rollItem, seededRandom } from '../core/index';
import { createWeaponSpec, elementLabels, type ElementType } from '../core/arsenal';

if (import.meta.env.DEV) {
  const state = createProgression();
  const elements: ElementType[] = ['corrosive', 'fire', 'shock', 'radiation', 'ice', 'gravity', 'adhesive'];
  for (const [modeIndex, mode] of (['pilot', 'mech'] as const).entries()) {
    elements.forEach((element, index) => {
      const spec = createWeaponSpec('bullet', element, mode);
      spec.statusChance = 1; spec.statusPower = 1; spec.spread = 0;
      const item = rollItem(mode, 1, seededRandom(200 + index + modeIndex * 100), 'weapon', { brand: element === 'corrosive' ? 'tackwork' : element === 'shock' ? 'voltaic' : 'cindergrid', weapon: spec });
      item.id = `effects-lab-${mode}-${element}`; item.name = `${elementLabels[element]} FX ${mode === 'pilot' ? 'Rifle' : 'Cannon'}`;
      item.rarity = 'rare'; item.affix = null;
      item.stats = { damage: 10, fireRate: 1, magazine: 30, reload: 1 };
      state.inventory.push(item);
      if (index === 0) state.loadouts[mode].weapon = item.id;
    });
  }
  const game = new Game(document.querySelector<HTMLElement>('#app')!, {
    initialProgression: state, saveKey: 'dust-steel.element-effects-lab.v1',
    autoEncounters: false, trainingTargets: true,
  });
  const notice = document.createElement('div');
  notice.textContent = 'ELEMENT FX LAB · diagnostic weapons: 10 damage / 100% proc · I: element · N: fresh targets';
  notice.style.cssText = 'position:fixed;top:6px;left:50%;transform:translateX(-50%);padding:7px 10px;background:#172b22d9;color:#c4dfc3;font:700 8px system-ui;z-index:5;pointer-events:none';
  document.body.append(notice);
  game.run();
} else document.body.replaceChildren(document.createTextNode('This development fixture is unavailable in production.'));
