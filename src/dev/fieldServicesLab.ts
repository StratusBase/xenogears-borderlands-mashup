import '../style.css';
import { Game } from '../game';
import { createProgression, rollItem, seededRandom, type Item, type Mode, type Slot } from '../core/index';
import { createWeaponSpec } from '../core/arsenal';

if (import.meta.env.DEV) {
  const state = createProgression();
  state.credits = 8000;
  const drops: { item: Item; x: number; z: number }[] = [];
  const slots: Slot[] = ['weapon', 'shield', 'reactor', 'legs'];
  for (const [modeIndex, mode] of (['pilot', 'mech'] as Mode[]).entries()) {
    for (const [index, slot] of slots.entries()) {
      const item = rollItem(mode, 3, seededRandom(23 + index + modeIndex * 31), slot,
        slot === 'weapon' ? { brand: 'cindergrid', weapon: createWeaponSpec('slug', 'fire', mode) } : undefined);
      item.id = `field-lab-drop-${mode}-${slot}`;
      drops.push({ item, x: index === 0 ? 0 : index % 2 ? -2.3 : 2.3, z: 13.2 - index * 2.1 - modeIndex * 8.4 });
    }
    for (let index = 0; index < 4; index++) {
      const item = rollItem(mode, 2, seededRandom(80 + index + modeIndex * 14), slots[index]);
      item.id = `field-lab-bag-${mode}-${index}`;
      if (index === 0) item.mark = 'favorite';
      if (index === 1 || index === 2) item.mark = 'junk';
      state.inventory.push(item);
    }
  }
  const game = new Game(document.querySelector<HTMLElement>('#app')!, {
    initialProgression: state, saveKey: 'dust-steel.field-services-lab.v1',
    startingHealthFraction: 0.45, autoEncounters: false, startingDrops: drops,
  });
  game.run();
} else document.body.replaceChildren(document.createTextNode('This development fixture is unavailable in production.'));
