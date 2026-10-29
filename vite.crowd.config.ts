import { defineConfig } from 'vite';
/** Isolated crowd review bundle. Existing quality/corrosive outputs remain available. */
export default defineConfig({build:{outDir:'dist-crowd',rollupOptions:{input:['index.html','crowd-feedback-lab.html']}},server:{host:'127.0.0.1'},preview:{host:'127.0.0.1'}});
