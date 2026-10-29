import './style.css';
import { Game } from './game';

const host = document.querySelector<HTMLElement>('#app')!;
try {
  const game = new Game(host);
  game.run();
} catch (error) {
  console.error(error);
  host.replaceChildren();
  const message = document.createElement('div');
  message.className = 'fatal-error';
  message.textContent = 'The 3D renderer could not start. Open this page in a desktop browser with WebGL enabled, then reload.';
  host.append(message);
}
