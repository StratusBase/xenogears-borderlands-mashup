import '../style.css';
import selfSource from './repeatabilityLab.ts?raw';
import { Game, type EvaluationInput } from '../game';
import { createEvaluationFixture, EVALUATION_BUILDS, EVALUATION_PROTOCOL, type EvaluationBuildId } from '../diagnostics/fixtures';
import { createEncounterPolicy } from '../diagnostics/encounterDriver';
import { CombatMeasurement, type JsonValue, type MeasurementEvent, type MeasurementSnapshot } from '../diagnostics/measurement';
import type { Mode } from '../core/index';
import type { WeaponSpec } from '../core/arsenal';

const PROTOCOL = 'render-clock-repeatability-v1';
const STEP = 1 / 60;
const STORAGE = 'dust-steel.render-clock.queue.v1';
const RAW_DIRECTORY = '/artifacts/render-clock/raw/';
const SCHEDULES = ['none', 'none-repeat', '30hz', '60hz', '144hz', 'jitter', 'draw-jitter'] as const;
type Schedule = typeof SCHEDULES[number];
interface Job { build: EvaluationBuildId; seed: number; schedule: Schedule }
interface SavedJob extends Job { filename: string; outcome: string; seconds: number }
interface Queue { jobs: Job[]; index: number; saved: SavedJob[]; references: Record<string, string>; running: boolean; stopAfterRun?: boolean; error?: string }
interface Launch {
  at: number; sequence: number; mode: Mode;
  origin: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
  aimPoint: { x: number; y: number; z: number };
  spec: WeaponSpec;
}
interface Evidence {
  measurement: MeasurementSnapshot; events: MeasurementEvent[]; inputs: EvaluationInput[]; launches: Launch[];
  encounter: ReturnType<Game['getEncounterSnapshot']>; authoritativeEnd: unknown; afterFinalDrawState: unknown;
  renderClock: { protocol: string; schedule: Schedule; step: number; preparationCalls: number; gpuDrawCalls: number; reference: string | null; generatedInputs: boolean };
  sourceFingerprint: string; droppedTraceEvents: number; hardwareStatus: string;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const canonical = (value: unknown): string => JSON.stringify(value, (_key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
  ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);

function loadQueue(): Queue | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE) ?? 'null') as Queue | null;
    return value && Array.isArray(value.jobs) && value.jobs.length === 30 && Number.isInteger(value.index)
      && value.index >= 0 && value.index <= value.jobs.length && value.references ? value : null;
  } catch { return null; }
}
function storeQueue(queue: Queue) { sessionStorage.setItem(STORAGE, JSON.stringify(queue)); }
function jobUrl(job: Job): string {
  return `/repeatability-lab.html?${new URLSearchParams({ build: job.build, seed: String(job.seed), schedule: job.schedule })}`;
}
function key(job: Pick<Job, 'build' | 'seed'>): string { return `${job.build}/${job.seed}`; }

/** All authoritative fields are compared. Random inventory UUIDs are identity-only
 * and do not affect the unchanged policy; normalize only those generated IDs. */
function authoritativeEnd(game: Game, fixtureIds: ReadonlySet<string>) {
  const state = game.getEncounterSnapshot();
  const inventory = state.progression.inventory.map(item => ({ ...item, id: fixtureIds.has(item.id) ? item.id : 'generated-loot' }));
  return {
    phase: state.phase, run: state.run, elapsed: state.elapsed, kills: state.kills, wave: state.wave,
    remainingEnemies: state.remainingEnemies, disabledRelays: state.disabledRelays, activeRelayIds: state.activeRelayIds,
    mode: state.mode, time: state.time, position: state.position, body: state.body, yaw: state.yaw, pitch: state.pitch,
    weaponBalance: state.weaponBalance, simulationPose: state.simulationPose, parkedMech: state.parkedMech,
    enemies: state.enemies, defenses: state.defenses,
    progression: { ...state.progression, inventory },
  };
}

async function startLab() {
  const params = new URLSearchParams(location.search);
  const build = EVALUATION_BUILDS.find(entry => entry.id === params.get('build'))?.id ?? 'mobile-precision';
  const parsedSeed = Number(params.get('seed') ?? 7);
  const seed = Number.isInteger(parsedSeed) && parsedSeed >= 0 && parsedSeed <= 0xffffffff ? parsedSeed : 7;
  const schedule: Schedule = SCHEDULES.find(value => value === params.get('schedule')) ?? 'none';
  const current: Job = { build, seed, schedule };
  const fixture = createEvaluationFixture(build);
  const fixtureIds = new Set([...fixture.equipment.pilot, ...fixture.equipment.mech].map(item => item.id));
  const rawSources = import.meta.glob('/src/**/*.{ts,css}', { query: '?raw', import: 'default' });
  const contents = await Promise.all(Object.keys(rawSources).sort().map(async path => ({ path: path.slice(1), content: await rawSources[path]() as string })));
  if (!contents.some(entry => entry.path === 'src/dev/repeatabilityLab.ts')) contents.push({ path: 'src/dev/repeatabilityLab.ts', content: selfSource });
  contents.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(contents)));
  const fingerprint = `sha256:${[...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
  let collector: CombatMeasurement | null = null;
  let origin = 0, running = false, finished: Evidence | null = null;
  const events: MeasurementEvent[] = [], launches: Launch[] = [];
  let dropped = 0, skippedDummy = 0;
  const game = new Game(document.querySelector<HTMLElement>('#app')!, {
    initialProgression: fixture.state, saveKey: `dust-steel.repeatability.${build}.v1`, encounterSeed: seed,
    evaluationDriver: true, manualEvaluation: true,
    onMeasurement(raw) {
      if (!collector || collector.snapshot().outcome) return;
      if (raw.type === 'damage' && raw.target !== 'enemy') { skippedDummy++; return; }
      const event = { ...raw, at: Math.max(0, raw.at - origin) } as MeasurementEvent;
      if (collector.record(event)) {
        if (events.length < 100_000) events.push(clone(event)); else dropped++;
      }
    },
    onEvaluationShot(launch) { launches.push(clone(launch)); },
  });
  // Deliberately no Game.run() or initial draw: schedules below own every render
  // before and during simulation. The constructor must initialize shot matrices.

  const panel = document.createElement('section'); panel.setAttribute('aria-label', 'Render clock validation');
  panel.style.cssText = 'position:fixed;z-index:200;left:8px;top:8px;width:min(490px,calc(100vw - 16px));max-height:92vh;overflow:auto;padding:12px;background:#12222bf2;color:#f7efd6;border:1px solid #7bd4c3;font:13px/1.45 system-ui;';
  const title = document.createElement('strong'); title.textContent = 'RENDER CLOCK / ACTUAL GAME REPEATABILITY';
  const note = document.createElement('p');
  note.textContent = 'Same fixtures, v3 encounter, current balance and 60 Hz controls. Twelve pacing baselines plus repeated/generated and exact-input replay runs under varied render schedules. Presentation is quality mode. Physical controller: NOT RUN.';
  const state = document.createElement('output'); state.setAttribute('aria-live', 'polite'); state.style.cssText = 'display:block;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:10px';
  const actions = document.createElement('div'); actions.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
  function button(label: string, action: () => void) {
    const value = document.createElement('button'); value.type = 'button'; value.textContent = label;
    value.style.cssText = 'padding:6px;background:#29494d;color:#fff4d8;border:1px solid #7bd4c3;cursor:pointer';
    value.onclick = action; actions.append(value); return value;
  }
  button('Run full 30-cell repeatability matrix', () => {
    const jobs: Job[] = [];
    for (const entry of EVALUATION_BUILDS) for (const value of [7, 8, 41, 97]) jobs.push({ build: entry.id, seed: value, schedule: 'none' });
    for (const entry of EVALUATION_BUILDS) for (const value of SCHEDULES.filter(value => value !== 'none')) jobs.push({ build: entry.id, seed: 7, schedule: value });
    const queue: Queue = { jobs, index: 0, saved: [], references: {}, running: true };
    storeQueue(queue); location.replace(jobUrl(jobs[0]));
  });
  const single = button('Run this cell', () => { void runCell(null).catch(showError); });
  button('Save current result', () => { void saveResult().then(filename => { state.textContent += `\nSAVED ${filename}`; }).catch(showError); });
  button('Stop after current cell', () => {
    const queue = loadQueue(); if (!queue) return;
    queue.stopAfterRun = true; storeQueue(queue); state.textContent += '\nWill stop after saving this attempt.';
  });
  button('Resume matrix', () => {
    const queue = loadQueue(); if (!queue || queue.index >= queue.jobs.length) { state.textContent = 'No unfinished matrix.'; return; }
    queue.running = true; queue.stopAfterRun = false; delete queue.error; storeQueue(queue); location.replace(jobUrl(queue.jobs[queue.index]));
  });
  panel.append(title, note, actions, state); document.body.append(panel);
  function showError(error: unknown) { state.textContent = error instanceof Error ? error.message : String(error); }
  function showMeasurement(prefix = '') {
    const m = collector?.snapshot();
    state.textContent = `${prefix}${build} / seed ${seed} / ${schedule}\n${m?.duration.toFixed(2) ?? '0'} active seconds · ${m?.outcome ?? 'ready'}\n${m?.kills ?? 0} kills · ${m?.ammo.total ?? 0} rounds · ${launches.length} launch snapshots\nRejected ${m?.rejectedEvents ?? 0} · Dropped ${dropped}`;
  }
  showMeasurement();

  async function runCell(reference: string | null): Promise<Evidence> {
    if (running || collector) throw new Error('Each cell requires a fresh page.');
    if (game.getEncounterSnapshot().time !== 0 || game.getEncounterSnapshot().run !== 0) throw new Error('The fixture already advanced. Reload it.');
    let prior: Evidence | null = null;
    if (reference) {
      const response = await fetch(`${RAW_DIRECTORY}${encodeURIComponent(reference)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not fetch baseline input trace (${response.status}).`);
      prior = await response.json() as Evidence;
      if (prior.measurement.metadata.sourceFingerprint !== fingerprint || prior.measurement.metadata.buildId !== build || prior.measurement.metadata.seed !== seed) throw new Error('Replay reference differs in source/build/seed.');
    }
    const replayInputs = schedule !== 'none' && schedule !== 'none-repeat';
    if (replayInputs && !prior) throw new Error('This render schedule needs its baseline input trace; use the matrix queue.');
    running = true; single.disabled = true;
    const inputs: EvaluationInput[] = [];
    collector = new CombatMeasurement({
      runId: `encounter-${build}-${seed}-1`, scenario: 'encounter', provenance: 'simulated', seed, buildId: build,
      buildCodes: fixture.codes, equipment: clone(fixture.equipment) as unknown as JsonValue,
      sourceFingerprint: fingerprint, protocol: EVALUATION_PROTOCOL,
      configuration: { protocol: EVALUATION_PROTOCOL, mode: 'pilot-to-mech', seed,
        balanceVariant: 'combined', balanceRules: { secondaryElementCost: true, mechHeat: true },
        controls: 'scripted-route-v1: actual Game, fixed 1/60s, body aim, no teleport or stat modifications',
        startingRun: 1, timeoutSeconds: 480, sourceScope: 'all src ts/css', hardwareStatus: 'NOT RUN',
        repeatabilityProtocol: PROTOCOL, renderSchedule: schedule, replayReference: reference },
    });
    origin = game.getEncounterSnapshot().time; game.startEncounter(seed);
    const policy = createEncounterPolicy();
    let preparationCalls = 0, gpuDrawCalls = 0;
    const jitter = [0, 4, 1, 0, 2, 7, 0, 1, 3, 0, 0, 5] as const;
    for (let frame = 0; frame < 480 * 60 && !collector.snapshot().outcome; frame++) {
      const input = replayInputs ? prior!.inputs[frame] : policy.input(game.getEncounterSnapshot(), STEP);
      if (!input) break;
      const recordedInput = clone(input);
      inputs.push(recordedInput);
      let count = 0, delta = STEP;
      if (schedule === '30hz' || schedule === '60hz' || schedule === '144hz') {
        const rate = Number.parseInt(schedule, 10);
        count = Math.floor((frame + 1) * rate / 60) - Math.floor(frame * rate / 60); delta = 1 / rate;
      } else if (schedule === 'jitter' || schedule === 'draw-jitter') {
        count = jitter[frame % jitter.length]; delta = [0, 1 / 240, 0.25, 1 / 24][frame % 4];
      }
      game.driveEvaluation(recordedInput);
      const before = Math.floor(count / 2);
      for (let render = 0; render < before; render++) { game.renderEvaluation(delta, false); preparationCalls++; }
      game.stepEvaluation(STEP);
      for (let render = before; render < count; render++) {
        const draw = schedule === 'draw-jitter' && frame % 31 === 0 && render === count - 1;
        game.renderEvaluation(delta, draw); preparationCalls++; if (draw) gpuDrawCalls++;
      }
      if (frame % 120 === 119) { showMeasurement(); await new Promise(resolve => setTimeout(resolve, 0)); }
    }
    if (!collector.snapshot().outcome) {
      const event: MeasurementEvent = { type: 'finish', at: game.getEncounterSnapshot().time - origin, outcome: 'timeout' };
      collector.record(event); events.push(event);
    }
    finished = {
      measurement: collector.snapshot(), events: clone(events), inputs, launches: clone(launches), encounter: game.getEncounterSnapshot(),
      authoritativeEnd: authoritativeEnd(game, fixtureIds), afterFinalDrawState: null,
      renderClock: { protocol: PROTOCOL, schedule, step: STEP, preparationCalls, gpuDrawCalls, reference, generatedInputs: !replayInputs },
      sourceFingerprint: fingerprint, droppedTraceEvents: dropped, hardwareStatus: 'NOT RUN',
    };
    running = false; game.driveEvaluation({}); game.renderEvaluation(0, true);
    finished.afterFinalDrawState = authoritativeEnd(game, fixtureIds); showMeasurement();
    state.textContent += `\nFinal GPU draw left authoritative state: ${canonical(finished.afterFinalDrawState) === canonical(finished.authoritativeEnd) ? 'UNCHANGED' : 'CHANGED — preserve this attempt'}`;
    if (prior) {
      const withoutMetadata = ({ metadata: _metadata, ...measurement }: MeasurementSnapshot) => measurement;
      const matches = canonical(prior.inputs) === canonical(inputs) && canonical(prior.events) === canonical(events)
        && canonical(prior.launches) === canonical(launches) && canonical(prior.authoritativeEnd) === canonical(finished.authoritativeEnd)
        && canonical(withoutMetadata(prior.measurement)) === canonical(withoutMetadata(finished.measurement));
      state.textContent += `\nExact reference comparison: ${matches ? 'MATCH' : 'DIFFERENT — preserve this attempt'}`;
    }
    return finished;
  }

  async function saveResult(): Promise<string> {
    if (!finished) throw new Error('Finish a run before saving.');
    const replay = new CombatMeasurement(finished.measurement.metadata);
    if (events.some(event => !replay.record(event)) || canonical(replay.snapshot()) !== canonical(finished.measurement)) throw new Error('Measurement trace replay differs.');
    const response = await fetch('/__pacing-evidence', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: `${JSON.stringify({ ...finished, skippedCrossScenarioEvents: skippedDummy,
        inputAttestation: 'Original scripted-route-v1 controls at 60 Hz; simulated input, no physical controller test.',
        exportTransport: 'Same-origin exact-replay workspace export' }, null, 2)}\n` });
    const result = await response.json() as { filename?: string; error?: string };
    if (!response.ok || !result.filename) throw new Error(result.error ?? `Save failed (${response.status}).`);
    return result.filename;
  }

  let busy = false;
  const timer = setInterval(() => { void poll(); }, 100);
  async function poll(): Promise<void> {
    if (busy || running) return;
    const queue = loadQueue();
    if (!queue?.running) {
      if (queue && queue.index === queue.jobs.length) state.textContent = `MATRIX COMPLETE · ${queue.index}/${queue.jobs.length} attempts saved.\nRun verifyRepeatability.ts for pacing, trace and cross-schedule acceptance.\nPhysical controller: NOT RUN.`;
      return;
    }
    const job = queue.jobs[queue.index];
    if (job.build !== build || job.seed !== seed || job.schedule !== schedule) {
      queue.running = false; queue.error = 'URL differs from scheduled fresh cell.'; storeQueue(queue); showError(queue.error); return;
    }
    busy = true;
    try {
      const reference = schedule === 'none' ? null : queue.references[key(job)] ?? null;
      const result = await runCell(reference), filename = await saveResult();
      const latest = loadQueue() ?? queue;
      latest.saved.push({ ...job, filename, outcome: result.measurement.outcome ?? 'unknown', seconds: result.measurement.duration });
      if (schedule === 'none') latest.references[key(job)] = filename;
      latest.index++; latest.running = latest.index < latest.jobs.length && !latest.stopAfterRun;
      storeQueue(latest); state.textContent += `\nSAVED ${filename}\n${latest.index}/${latest.jobs.length} cells`;
      if (latest.running) location.replace(jobUrl(latest.jobs[latest.index]));
    } catch (error) {
      queue.running = false; queue.error = error instanceof Error ? error.message : String(error); storeQueue(queue); showError(error);
    } finally { busy = false; }
  }
  Object.assign(window, { renderClockEvaluation: { sourceFingerprint: fingerprint, snapshot: () => collector?.snapshot() ?? null,
    result: () => finished ? clone(finished) : null, queue: loadQueue } });
  window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
}

if (import.meta.env.DEV) void startLab();
else document.body.replaceChildren(document.createTextNode('This development fixture is unavailable in production.'));
