import '../style.css';
import { Game } from '../game';
import { createProgression } from '../core/index';

if (import.meta.env.DEV) {
  const game = new Game(document.querySelector<HTMLElement>('#app')!, {
    initialProgression: createProgression(), saveKey: 'dust-steel.fixed-dummy-lab.v1', autoEncounters: false,
  });
  game.run();
} else document.body.replaceChildren(document.createTextNode('This development fixture is unavailable in production.'));
