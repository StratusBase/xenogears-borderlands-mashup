import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve, relative, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer, type Plugin } from 'vite';
import { validateClusterLiveEvidence } from '../src/diagnostics/clusterLive.ts';

async function sourceSnapshot(root: string) {
  const paths: string[] = [];
  async function walk(directory: string) {
    for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(ts|css|mjs)$/.test(entry.name)) paths.push(path);
    }
  }
  await walk('src'); await walk('scripts');
  for (const entry of await readdir(root)) if (/^(package(?:-lock)?\.json|tsconfig\.json|vite.*\.config\.ts|cluster-live-lab\.html)$/.test(entry)) paths.push(entry);
  paths.sort();
  const files = await Promise.all(paths.map(async path => ({ path: path.replaceAll('\\', '/'), content: await readFile(resolve(root, path), 'utf8') })));
  const fingerprint = `sha256:${createHash('sha256').update(JSON.stringify(files)).digest('hex')}`;
  return { fingerprint, files, manifest: files.map(file => ({ path: file.path, bytes: Buffer.byteLength(file.content), sha256: createHash('sha256').update(file.content).digest('hex') })) };
}
function reply(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(`${JSON.stringify(value)}\n`);
}
async function readBody(request: IncomingMessage): Promise<Buffer> {
  const max = 24 * 1024 * 1024;
  if (Number(request.headers['content-length'] ?? 0) > max) throw new Error('Evidence exceeds 24 MiB.');
  return new Promise((accept, reject) => {
    const chunks: Buffer[] = []; let size = 0, rejected = false;
    request.on('data', (chunk: Buffer) => { if (rejected) return; size += chunk.length; if (size > max) { rejected = true; reject(new Error('Evidence exceeds 24 MiB.')); } else chunks.push(chunk); });
    request.on('end', () => { if (!rejected) accept(Buffer.concat(chunks)); });
    request.on('aborted', () => reject(new Error('Evidence upload was interrupted.'))); request.on('error', reject);
  });
}
async function main() {
  const options = new Map<string, string>(), args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 2) {
    if (!['--port', '--root', '--out'].includes(args[index]) || !args[index + 1] || options.has(args[index])) throw new Error('Usage: node --import tsx scripts/serveClusterLive.ts [--port 5198] [--root directory] [--out artifacts/cluster-live]');
    options.set(args[index], args[index + 1]);
  }
  const root = resolve(options.get('--root') ?? resolve(import.meta.dirname, '..')), output = resolve(root, options.get('--out') ?? 'artifacts/cluster-live');
  const port = Number(options.get('--port') ?? 5198); if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local port.');
  const origin = `http://127.0.0.1:${port}`, frozen = await sourceSnapshot(root);
  await mkdir(resolve(output, 'sources'), { recursive: true });
  try { await writeFile(resolve(output, 'sources', `${frozen.fingerprint.slice(7)}.json`), `${JSON.stringify(frozen)}\n`, { flag: 'wx' }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  async function verifyFrozenSource() { if ((await sourceSnapshot(root)).fingerprint !== frozen.fingerprint) throw new Error('Source changed after server start. Preserve this arm and restart the server before collecting another.'); }
  const plugin: Plugin = { name: 'cluster-live-preserved-evidence', configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const pathname = request.url?.split('?')[0];
      if (pathname !== '/__cluster-source' && pathname !== '/__cluster-evidence') { next(); return; }
      void (async () => {
        if (request.headers.host !== `127.0.0.1:${port}`) { reply(response, 403, { error: 'This evidence server accepts only its local host.' }); return; }
        await verifyFrozenSource();
        if (pathname === '/__cluster-source') {
          if (request.method !== 'GET') { reply(response, 405, { error: 'Use GET.' }); return; }
          reply(response, 200, { sourceFingerprint: frozen.fingerprint, sourceManifest: frozen.manifest }); return;
        }
        if (request.method !== 'POST') { reply(response, 405, { error: 'Use POST.' }); return; }
        if (request.headers.origin !== origin || !request.headers['content-type']?.startsWith('application/json')) { reply(response, 403, { error: 'Only same-origin JSON evidence may be preserved.' }); return; }
        const body = await readBody(request), evidence = validateClusterLiveEvidence(JSON.parse(body.toString('utf8')));
        if (evidence.sourceFingerprint !== frozen.fingerprint) throw new Error('Evidence does not match this frozen source snapshot.');
        const folder = resolve(output, evidence.job.arm, 'raw'); await mkdir(folder, { recursive: true });
        const stem = `${evidence.job.fixtureSource}-${evidence.job.delivery}-${evidence.job.payload}-${evidence.job.seed}-${frozen.fingerprint.slice(7, 19)}`;
        for (let attempt = 1; attempt < 100000; attempt++) {
          const filename = `${stem}-attempt-${String(attempt).padStart(3, '0')}.json`;
          try { await writeFile(resolve(folder, filename), body, { flag: 'wx' }); reply(response, 201, { filename: relative(output, resolve(folder, filename)).replaceAll('\\', '/') }); return; }
          catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
        }
        throw new Error('Attempt limit reached; select another output directory.');
      })().catch(error => { if (!response.headersSent) reply(response, 400, { error: error instanceof Error ? error.message : String(error) }); });
    });
  } };
  const server = await createServer({ root, configFile: false, clearScreen: false, plugins: [plugin], server: { host: '127.0.0.1', port, strictPort: true, hmr: false } });
  await server.listen();
  process.stdout.write(`Cluster live comparison: ${origin}/cluster-live-lab.html\nFrozen source: ${frozen.fingerprint}\nEvidence: ${output}\n`);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void server.close().then(() => process.exit(0)); });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
