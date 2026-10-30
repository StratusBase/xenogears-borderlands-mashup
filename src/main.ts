import './style.css';
import { Game } from './game';

const host = document.querySelector<HTMLElement>('#app')!;
function fatal(error:unknown) {
  console.error(error);
  host.replaceChildren();
  const message = document.createElement('div');
  message.className = 'fatal-error';
  message.textContent = 'The 3D renderer could not start. Open this page in a desktop browser with WebGL enabled, then reload.';
  host.append(message);
}

// Explicit review controls run the normal entry and production renderer on an isolated save.
if(new URLSearchParams(location.search).has('verifyShock')){
  import('./dev/effects/shock/integrationVerification').then(({shockVerificationOptions,attachShockVerification})=>{const game=new Game(host,shockVerificationOptions);attachShockVerification(game);game.run();}).catch(fatal);
}else if(new URLSearchParams(location.search).has('verifyRadiation')){
  import('./dev/effects/radiation/integrationVerification').then(({radiationVerificationOptions,attachRadiationVerification})=>{const game=new Game(host,radiationVerificationOptions);attachRadiationVerification(game);game.run();}).catch(fatal);
}else{try{const game=new Game(host);game.run();}catch(error){fatal(error);}}
