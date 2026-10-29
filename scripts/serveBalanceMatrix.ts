import { mkdir, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer, type Plugin } from 'vite';
import { CombatMeasurement, type MeasurementEvent, type MeasurementSnapshot } from '../src/diagnostics/measurement.ts';

export const BALANCE_VARIANTS = {
  baseline: { secondaryElementCost: false, mechHeat: false },
  'secondary-only': { secondaryElementCost: true, mechHeat: false },
  'heat-only': { secondaryElementCost: false, mechHeat: true },
  combined: { secondaryElementCost: true, mechHeat: true },
} as const;
export type BalanceVariant = keyof typeof BALANCE_VARIANTS;
export interface BalanceEvidence {
  measurement: MeasurementSnapshot;
  events: MeasurementEvent[];
  droppedTraceEvents: number;
  hardwareStatus: string;
  sourceFingerprint: string;
  encounter: unknown;
}
const builds = new Set(['mobile-precision', 'elemental-pressure', 'heavy-control']);
const outcomes = new Set(['complete', 'failed', 'timeout', 'aborted']);
const MAX_BODY_BYTES = 16 * 1024 * 1024;

export function validateBalanceEvidence(value: unknown): { build: string; seed: number; hash: string; variant: BalanceVariant } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an evidence object.');
  const evidence = value as BalanceEvidence, measurement = evidence.measurement;
  if (!measurement || measurement.metadata?.scenario !== 'encounter' || !outcomes.has(measurement.outcome ?? '')
    || measurement.metadata.provenance !== 'simulated' || measurement.rejectedEvents !== 0
    || evidence.droppedTraceEvents !== 0 || evidence.hardwareStatus !== 'NOT RUN') {
    throw new Error('Expected a finished simulated encounter with no invalid/dropped events and hardware NOT RUN.');
  }
  const { buildId: build, seed, sourceFingerprint } = measurement.metadata;
  if (!builds.has(build) || ![7, 8, 41, 97].includes(seed)) throw new Error('Unknown build or matrix seed.');
  const config = measurement.metadata.configuration as Record<string, unknown> | null;
  const variant = config?.balanceVariant as BalanceVariant;
  if (!Object.hasOwn(BALANCE_VARIANTS, variant)) throw new Error('Unknown balance variant.');
  const rules = config?.balanceRules as Record<string, unknown> | undefined;
  if (!rules || Object.keys(rules).length !== 2
    || rules.secondaryElementCost !== BALANCE_VARIANTS[variant].secondaryElementCost
    || rules.mechHeat !== BALANCE_VARIANTS[variant].mechHeat) throw new Error('Variant and balance rules differ.');
  const hash = /^sha256:([a-f0-9]{64})$/.exec(sourceFingerprint)?.[1];
  if (!hash || evidence.sourceFingerprint !== sourceFingerprint) throw new Error('Invalid or mismatched source fingerprint.');
  if (!Array.isArray(evidence.events) || evidence.events.length === 0 || evidence.events.length >= 100_000) throw new Error('Missing or capped event trace.');
  const replay = new CombatMeasurement(measurement.metadata);
  if (evidence.events.some(event => !replay.record(event)) || JSON.stringify(replay.snapshot()) !== JSON.stringify(measurement)) {
    throw new Error('Event trace does not exactly reproduce the measurement.');
  }
  return { build, seed, hash, variant };
}

function reply(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(`${JSON.stringify(value)}\n`);
}
async function readBody(request: IncomingMessage): Promise<Buffer> {
  if (Number(request.headers['content-length'] ?? 0) > MAX_BODY_BYTES) throw new Error('Evidence exceeds 16 MiB.');
  return new Promise((accept, reject) => {
    const chunks: Buffer[] = []; let length = 0, rejected = false;
    request.on('data', (chunk: Buffer) => {
      if (rejected) return;
      length += chunk.length;
      if (length > MAX_BODY_BYTES) { rejected = true; reject(new Error('Evidence exceeds 16 MiB.')); }
      else chunks.push(chunk);
    });
    request.on('end', () => { if (!rejected) accept(Buffer.concat(chunks)); });
    request.on('aborted', () => reject(new Error('Evidence submission interrupted.')));
    request.on('error', reject);
  });
}

async function main() {
  const args = process.argv.slice(2), options = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    if (!['--port', '--root', '--out'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--') || options.has(args[i])) {
      throw new Error('Usage: node --import tsx scripts/serveBalanceMatrix.ts [--port 5192] [--root directory] [--out directory]');
    }
    options.set(args[i], args[i + 1]);
  }
  const port = Number(options.get('--port') ?? 5192);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local port.');
  const root = resolve(options.get('--root') ?? resolve(import.meta.dirname, '..'));
  const output = resolve(root, options.get('--out') ?? 'artifacts/balance-matrix/raw');
  const origin = `http://127.0.0.1:${port}`;
  const plugin: Plugin = { name: 'local-balance-matrix-evidence', configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (request.url?.split('?')[0] !== '/__balance-evidence') { next(); return; }
      void (async () => {
        if (request.method !== 'POST') { reply(response, 405, { error: 'Use POST.' }); return; }
        if (request.headers.host !== `127.0.0.1:${port}` || request.headers.origin !== origin) { reply(response, 403, { error: 'Only this local origin may save evidence.' }); return; }
        if (!request.headers['content-type']?.startsWith('application/json')) { reply(response, 415, { error: 'Use application/json.' }); return; }
        const body = await readBody(request), data = JSON.parse(body.toString('utf8')) as unknown;
        const { build, seed, hash, variant } = validateBalanceEvidence(data);
        await mkdir(output, { recursive: true });
        const stem = `encounter-${variant}-${build}-${seed}-${hash.slice(0, 12)}`;
        for (let attempt = 1; attempt <= 1_000_000; attempt++) {
          const filename = `${stem}-attempt-${String(attempt).padStart(3, '0')}.json`;
          try {
            await writeFile(resolve(output, filename), body, { flag: 'wx' });
            reply(response, 201, { filename }); return;
          } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
        }
        throw new Error('Attempt limit reached; use another output directory.');
      })().catch(error => { if (!response.headersSent) reply(response, 400, { error: error instanceof Error ? error.message : 'Evidence save failed.' }); });
    });
  } };
  const server = await createServer({ root, configFile: false, clearScreen: false, plugins: [plugin], server: { host: '127.0.0.1', port, strictPort: true, hmr: false } });
  await server.listen();
  process.stdout.write(`Balance matrix: ${origin}/balance-lab.html?scenario=encounter&balance=baseline&build=mobile-precision&seed=7\nEvidence directory: ${output}\n`);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void server.close().then(() => process.exit(0)); });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
