import { defineConfig } from 'vite';

/** Separate local review bundle. Never changes the normal game's entry or renderer. */
export default defineConfig({
  build: { outDir: 'dist-quality', rollupOptions: { input: ['index.html', 'quality-lab.html', 'elemental-lab.html', 'integrated-encounter-lab.html', 'integrated-stress-lab.html'] } },
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
});
