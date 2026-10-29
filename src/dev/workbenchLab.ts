import '../style.css';
import { createProgression } from '../core/index';
import { WeaponWorkbench } from '../ui/weaponWorkbench';

// Isolated UI/layout fixture. Main-game firing checks use the physical workbench.
if (import.meta.env.DEV) {
  const host = document.querySelector<HTMLElement>('#app')!;
  const state = createProgression();
  const status = document.createElement('output');
  status.style.cssText = 'position:fixed;bottom:0;left:50%;transform:translateX(-50%);z-index:10;background:#102319;color:#c1d8b7;font:8px monospace;padding:3px 8px;pointer-events:none';
  status.textContent = 'UI FIXTURE · no player save or world callbacks';
  document.body.append(status);
  const workbench = new WeaponWorkbench(host, {
    test(item, code) {
      const existing = state.inventory.findIndex(entry => entry.id === item.id);
      if (existing === -1) state.inventory.push(item); else state.inventory[existing] = item;
      state.loadouts[item.target].weapon = item.id;
      status.value = `TEST callback: ${code}`;
      workbench.show(state, item.target);
    },
    targets() { status.value = 'TARGET callback observed · this UI fixture has no combat world'; },
    close() { status.value = 'CLOSE callback observed · fixture stays open for layout review'; },
  });
  workbench.show(state, 'pilot');
  window.addEventListener('pagehide', () => workbench.dispose(), { once: true });
} else document.body.replaceChildren(document.createTextNode('This development fixture is unavailable in production.'));
