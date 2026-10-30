import { defineConfig } from 'vite';

/** Isolated MIRV review pages; unrelated sign-off fixtures have their own virtual modules. */
export default defineConfig({
  server: { host: '127.0.0.1', hmr: false },
  optimizeDeps: { entries: ['cluster-behavior-lab.html', 'cluster-play-lab.html'] },
});
