import '../style.css';
import { Game } from '../game';
import { createProgression, deserializeProgression, rollItem, serializeProgression, type Item, type Mode, type Progression, type Slot } from '../core/index';

/** Deterministic actual equipment rolls. No private game access or alternate rendering. */
function labItem(mode: Mode, slot: Slot, variant: number): Item {
  const affixes: Record<Slot, readonly string[]> = {
    weapon: ['Heavy', 'Rapid', 'Quickdraw'], shield: ['Fortified', 'Lightweight'],
    reactor: ['Ventilated', 'High-capacity'], legs: ['Sprinter', 'Armored'],
  };
  const affix = affixes[slot][variant]!;
  const affixIndex = slot === 'shield' && variant === 1 ? 2 : variant;
  const rarityRoll = variant === 0 ? 0.84 : variant === 1 ? 0.94 : 0.99;
  const rolls = slot === 'weapon'
    ? [rarityRoll, 0.5, 0.5, 0.5, 0.5, (affixIndex + 0.1) / 3]
    : [rarityRoll, 0.5, (affixIndex + 0.1) / 3];
  let cursor = 0;
  const item = rollItem(mode, 2, () => rolls[cursor++] ?? 0.5, slot);
  const bases: Record<Mode, Record<Slot, string>> = {
    pilot: { weapon: 'Test Rifle', shield: 'Test Shield', reactor: 'Cooling Pack', legs: 'Test Boots' },
    mech: { weapon: 'Test Cannon', shield: 'Test Plating', reactor: 'Test Reactor', legs: 'Servo Legs' },
  };
  item.id = `equipment-lab-${mode}-${slot}-${affix.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  item.affix = affix;
  item.name = `${affix} ${bases[mode][slot]}`;
  return item;
}

function createLabProgression(): Progression {
  const state = createProgression();
  state.credits = 500;
  state.checkpoint = { id: 'yard-service', mode: 'pilot' };
  for (const mode of ['pilot', 'mech'] as const) {
    for (const slot of ['weapon', 'shield', 'reactor', 'legs'] as const) {
      const count = slot === 'weapon' ? 3 : 2;
      for (let variant = 0; variant < count; variant++) {
        const item = labItem(mode, slot, variant);
        state.inventory.push(item);
        // The pilot starter normally has no cooling pack or boots. Start this
        // fixture with all four slots filled so every module can be compared.
        if (!state.loadouts[mode][slot]) state.loadouts[mode][slot] = item.id;
      }
    }
  }
  const validated = deserializeProgression(serializeProgression(state));
  if (!validated) throw new Error('Equipment lab fixture failed normal progression validation.');
  return validated;
}

if (import.meta.env.DEV) {
  const host = document.querySelector<HTMLElement>('#app')!;
  try {
    const game = new Game(host, {
      initialProgression: createLabProgression(),
      saveKey: 'dust-steel.equipment-lab.v1',
      startingHealthFraction: 0.45,
      autoEncounters: false,
    });
    game.run();
  } catch (error) {
    console.error(error);
    const message = document.createElement('p');
    message.className = 'fatal-error';
    message.textContent = 'The development equipment lab could not start. Check WebGL support and the fixture configuration.';
    host.replaceChildren(message);
  }
} else document.body.replaceChildren(document.createTextNode('This development fixture is unavailable in production.'));
