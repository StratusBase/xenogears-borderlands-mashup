import { mkdir, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { createServer, type Plugin } from 'vite';
import { CombatMeasurement, type MeasurementEvent, type MeasurementSnapshot } from '../src/diagnostics/measurement.ts';

const args = process.argv.slice(2);
const options = new Map<string, string>();
for (let i = 0; i < args.length; i += 2) {
  if (!['--port', '--root', '--out'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--') || options.has(args[i])) {
    throw new Error('Usage: node --import tsx scripts/servePacingValidation.ts [--port 5189] [--root directory] [--out directory]');
  }
  options.set(args[i], args[i + 1]);
}
const port = Number(options.get('--port') ?? 5189);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Port must be an integer from 1024 to 65535.');
const validationRoot = resolve(options.get('--root') ?? resolve(import.meta.dirname, '..'));
const outputDirectory = resolve(validationRoot, options.get('--out') ?? 'artifacts/pacing-v2');
const MAX_BODY_BYTES = 16 * 1024 * 1024;
const builds = new Set(['mobile-precision', 'elemental-pressure', 'heavy-control']);
const outcomes = new Set(['complete', 'failed', 'timeout', 'aborted']);
const origin = `http://127.0.0.1:${port}`;

class EvidenceError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
function reply(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(`${JSON.stringify(value)}\n`);
}
async function readBody(request: IncomingMessage): Promise<Buffer> {
  const declared = Number(request.headers['content-length'] ?? 0);
  if (declared > MAX_BODY_BYTES) throw new EvidenceError(413, 'Evidence exceeds the 16 MiB limit.');
  return new Promise((accept, reject) => {
    const chunks: Buffer[] = []; let bytes = 0; let rejected = false;
    request.on('data', (chunk: Buffer) => {
      if (rejected) return;
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) { rejected = true; reject(new EvidenceError(413, 'Evidence exceeds the 16 MiB limit.')); }
      else chunks.push(chunk);
    });
    request.on('end', () => { if (!rejected) accept(Buffer.concat(chunks)); });
    request.on('aborted', () => reject(new EvidenceError(400, 'Evidence upload was interrupted.')));
    request.on('error', reject);
  });
}
function validateEvidence(value: unknown): { build: string; seed: number; hash: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new EvidenceError(400, 'Expected an evidence object.');
  const evidence = value as { measurement?: MeasurementSnapshot; events?: MeasurementEvent[]; droppedTraceEvents?: number; hardwareStatus?: string; sourceFingerprint?: string };
  const measurement = evidence.measurement;
  if (!measurement || measurement.metadata?.scenario !== 'encounter' || !outcomes.has(measurement.outcome ?? '')
    || measurement.rejectedEvents !== 0 || evidence.droppedTraceEvents !== 0 || evidence.hardwareStatus !== 'NOT RUN') {
    throw new EvidenceError(400, 'Evidence must contain a finished encounter with no rejected or dropped trace events and hardware NOT RUN.');
  }
  const { buildId: build, seed, sourceFingerprint } = measurement.metadata;
  if (!builds.has(build) || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new EvidenceError(400, 'Unknown build or invalid seed.');
  const hash = /^sha256:([a-f0-9]{64})$/.exec(sourceFingerprint)?.[1];
  if (!hash || evidence.sourceFingerprint !== sourceFingerprint) throw new EvidenceError(400, 'Invalid or mismatched source fingerprint.');
  if (!Array.isArray(evidence.events) || evidence.events.length === 0 || evidence.events.length >= 100_000) {
    throw new EvidenceError(400, 'Missing trace or trace cap reached.');
  }
  let replay: CombatMeasurement;
  try { replay = new CombatMeasurement(measurement.metadata); }
  catch { throw new EvidenceError(400, 'Invalid measurement metadata.'); }
  if (evidence.events.some(event => !replay.record(event)) || JSON.stringify(replay.snapshot()) !== JSON.stringify(measurement)) {
    throw new EvidenceError(400, 'Event trace does not exactly reproduce the measurement.');
  }
  return { build, seed, hash };
}
async function saveEvidence(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); throw new EvidenceError(405, 'Use POST.'); }
  if (request.headers.host !== `127.0.0.1:${port}` || request.headers.origin !== origin) throw new EvidenceError(403, 'Only this local validation origin may save evidence.');
  if (!request.headers['content-type']?.startsWith('application/json')) throw new EvidenceError(415, 'Use application/json.');
  const body = await readBody(request);
  let data: unknown;
  try { data = JSON.parse(body.toString('utf8')); } catch { throw new EvidenceError(400, 'Malformed JSON.'); }
  const { build, seed, hash } = validateEvidence(data);
  const stem = `encounter-${build}-${seed}-${hash.slice(0, 12)}`;
  await mkdir(outputDirectory, { recursive: true });
  for (let attempt = 1; attempt <= 1_000_000; attempt++) {
    const filename = `${stem}-attempt-${String(attempt).padStart(3, '0')}.json`;
    try {
      // Exclusive creation is atomic: concurrent exports and repeated attempts
      // never overwrite prior evidence. Preserve the submitted JSON bytes.
      await writeFile(resolve(outputDirectory, filename), body, { flag: 'wx' });
      reply(response, 201, { filename }); return;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  }
  throw new EvidenceError(409, 'Attempt-number limit reached; select another output directory.');
}
const evidencePlugin: Plugin = {
  name: 'local-pacing-evidence',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (request.url?.split('?')[0] !== '/__pacing-evidence') { next(); return; }
      void saveEvidence(request, response).catch(error => {
        if (response.headersSent) { response.end(); return; }
        reply(response, error instanceof EvidenceError ? error.status : 500,
          { error: error instanceof EvidenceError ? error.message : 'Could not save evidence to the configured output directory.' });
      });
    });
  },
};
const server = await createServer({
  root: validationRoot, configFile: false, clearScreen: false, plugins: [evidencePlugin],
  server: { host: '127.0.0.1', port, strictPort: true, hmr: false },
});
await server.listen();
process.stdout.write(`Pacing validation: ${origin}/pacing-lab.html?scenario=encounter&build=mobile-precision&seed=7\nEvidence directory: ${outputDirectory}\n`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void server.close().then(() => process.exit(0)); });
