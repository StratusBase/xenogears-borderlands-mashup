import '../style.css';
import { Game } from '../game';
import { createProgression, deserializeProgression, rollItem, seededRandom, serializeProgression, type Progression } from '../core/index';
import { createWeaponSpec, elementLabels, projectileLabels, type BrandId, type ElementType, type ProjectileType } from '../core/arsenal';

/** Every row uses real brand/profile stat baking and the same game simulation. */
const examples: readonly { projectile: ProjectileType; element: ElementType; brand: BrandId }[] = [
  { projectile: 'bullet', element: 'kinetic', brand: 'ironvale' },
  { projectile: 'slug', element: 'fire', brand: 'cindergrid' },
  { projectile: 'spike', element: 'adhesive', brand: 'tackwork' },
  { projectile: 'ricochet', element: 'shock', brand: 'rebound' },
  { projectile: 'homing', element: 'ice', brand: 'kestrel' },
  { projectile: 'sticky', element: 'corrosive', brand: 'tackwork' },
  { projectile: 'orb', element: 'gravity', brand: 'nullward' },
  { projectile: 'beam', element: 'ice', brand: 'prism' },
  { projectile: 'scatter', element: 'radiation', brand: 'cindergrid' },
  { projectile: 'rocket', element: 'corrosive', brand: 'ironvale' },
  { projectile: 'disc', element: 'kinetic', brand: 'rebound' },
  { projectile: 'arc', element: 'shock', brand: 'voltaic' },
];

function createArsenalProgression(): Progression {
  const state = createProgression();
  state.credits = 500;
  state.checkpoint = { id: 'yard-service', mode: 'pilot' };
  for (const [modeIndex, mode] of (['pilot', 'mech'] as const).entries()) {
    examples.forEach(({ projectile, element, brand }, index) => {
      const item = rollItem(mode, 3, seededRandom(18000 + modeIndex * 100 + index), 'weapon', {
        brand, weapon: createWeaponSpec(projectile, element, mode),
      });
      item.id = `arsenal-lab-${mode}-${projectile}`;
      item.name = `${projectileLabels[projectile]} / ${elementLabels[element]}`;
      state.inventory.push(item);
    });
  }
  const validated = deserializeProgression(serializeProgression(state));
  if (!validated) throw new Error('Arsenal lab failed normal progression validation.');
  return validated;
}

if (import.meta.env.DEV) {
  const host = document.querySelector<HTMLElement>('#app')!;
  try {
    const game = new Game(host, {
      initialProgression: createArsenalProgression(),
      saveKey: 'dust-steel.arsenal-lab.v1',
      startingHealthFraction: 0.45,
      autoEncounters: false,
      trainingTargets: true,
    });
    game.run();
  } catch (error) {
    console.error(error);
    const message = document.createElement('p');
    message.className = 'fatal-error';
    message.textContent = 'The development arsenal lab could not start. Check WebGL support and fixture configuration.';
    host.replaceChildren(message);
  }
} else document.body.replaceChildren(document.createTextNode('This development fixture is unavailable in production.'));
