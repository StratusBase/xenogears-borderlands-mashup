import { defineConfig, transformWithEsbuild } from 'vite';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Compile the actual pre-floor-fix source beside the current response. No runtime approximation.
const baseline = '328a175';
const prefix = '\0corrosive-before:';
const presentation = 'src/rendering/quality/elementalPresentation.ts';
const changed = new Set([presentation, 'src/rendering/quality/corrosive/liquid.ts', 'src/rendering/quality/corrosive/rupture.ts']);
const digest = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
const before = (path: string) => execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' });
const provenance: Record<string, unknown> = {};
for (const path of [...changed, 'src/rendering/quality/corrosive/sizing.ts', 'src/rendering/quality/corrosive/surfaces.ts', 'src/audio/corrosiveAudio.ts']) {
  const old = before(path), current = readFileSync(path, 'utf8');
  provenance[path] = { before: digest(old), current: digest(current), identical: old === current };
  if (!changed.has(path) && old !== current) throw new Error(`Comparison dependency changed: ${path}`);
}
export default defineConfig({
  plugins: [{
    name: 'isolated-corrosive-source-baseline',
    resolveId(id) { if (id === 'virtual:corrosive-before') return prefix + presentation; if (id.startsWith(prefix)) return id; },
    async load(id) {
      if (!id.startsWith(prefix)) return;
      const path = id.slice(prefix.length);
      const source = before(path).replace(/(from\s+|import\s*)(['"])(\.[^'"]+)\2/g, (_all, lead, quote, specifier) => {
        const absolute = resolve(dirname(path), specifier), relative = absolute.slice(process.cwd().length + 1) + '.ts';
        return `${lead}${quote}${changed.has(relative) ? prefix + relative : absolute}${quote}`;
      });
      return transformWithEsbuild(source, path, { loader: 'ts' });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'provenance.json', source: JSON.stringify({
        baseline, current: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sources: provenance,
        boundary: 'Same current Game, physics, targets, weapons, audio, sizing and surface coatings. Only baseline presentation/liquid/rupture modules are substituted.',
      }, null, 2) });
    },
  }],
  build: { outDir: 'artifacts/corrosive-ab/signoff/build', rollupOptions: { input: ['index.html', 'corrosive-signoff.html'] } },
  server: { host: '127.0.0.1' }, preview: { host: '127.0.0.1' },
});
