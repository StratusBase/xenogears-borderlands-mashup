import './evaluationLab';
import { CombatMeasurement, type MeasurementEvent, type MeasurementSnapshot } from '../diagnostics/measurement';
import type { Game } from '../game';

interface PublicEvaluation {
  game: Pick<Game, 'getEncounterSnapshot'>;
  snapshot(): MeasurementSnapshot | null;
  events(): MeasurementEvent[];
  sourceFingerprint: string;
}
type Variant = 'baseline' | 'secondary-only' | 'heat-only' | 'combined';
interface Job { variant: Variant; build: string; seed: number }
interface SavedJob extends Job { filename: string; outcome: string; seconds: number }
interface Queue { jobs: Job[]; index: number; saved: SavedJob[]; running: boolean; stopAfterRun?: boolean; error?: string }
const STORAGE = 'dust-steel.balance-matrix.queue.v1';
const variants: Variant[] = ['baseline', 'secondary-only', 'heat-only', 'combined'];
const builds = ['mobile-precision', 'elemental-pressure', 'heavy-control'];
const seeds = [7, 8, 41, 97];
const evaluationWindow = window as Window & { arsenalEvaluation?: PublicEvaluation };

function loadQueue(): Queue | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE) ?? 'null') as Queue | null;
    return value && Array.isArray(value.jobs) && value.jobs.length === 48 && Number.isInteger(value.index) && value.index >= 0 && value.index <= 48 ? value : null;
  } catch { return null; }
}
function storeQueue(queue: Queue) { sessionStorage.setItem(STORAGE, JSON.stringify(queue)); }
function jobUrl(job: Job) {
  return `/balance-lab.html?${new URLSearchParams({ scenario: 'encounter', balance: job.variant, build: job.build, seed: String(job.seed) })}`;
}

if (import.meta.env.DEV) {
  let navigating = false;
  let interval: ReturnType<typeof setInterval> | undefined;
  function navigate(url: string): void {
    if (navigating) return;
    // The old page may survive location.replace until navigation commits. Stop
    // its observer before publishing a URL for the next fresh-page attempt.
    navigating = true;
    if (interval !== undefined) clearInterval(interval);
    location.replace(url);
  }
  const panel = document.createElement('section'); panel.setAttribute('aria-label', 'Balance matrix');
  panel.style.cssText = 'position:fixed;z-index:102;right:8px;top:8px;width:min(355px,calc(100vw - 16px));max-height:85vh;overflow:auto;padding:12px;background:#13212af5;color:#f2e5cc;border:1px solid #72c4b8;font:13px/1.4 system-ui;';
  const title = document.createElement('strong'); title.textContent = 'SEPARATE + COMBINED BALANCE MATRIX';
  const note = document.createElement('p'); note.textContent = '48 actual-game runs, simulated controls. Each attempt uses a fresh page. Every outcome is saved; acceptance failures never trigger automatic tuning. Physical gamepad: NOT RUN.';
  const status = document.createElement('output'); status.setAttribute('aria-live', 'polite'); status.style.cssText = 'display:block;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:10px';
  const buttons = document.createElement('div'); buttons.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
  function button(text: string, action: () => void) {
    const value = document.createElement('button'); value.type = 'button'; value.textContent = text;
    value.style.cssText = 'background:#284144;color:#fff1d0;border:1px solid #76b8ad;padding:6px;cursor:pointer';
    value.onclick = action; buttons.append(value); return value;
  }
  button('Run full 48-cell matrix', () => {
    const jobs = variants.flatMap(variant => builds.flatMap(build => seeds.map(seed => ({ variant, build, seed }))));
    const queue: Queue = { jobs, index: 0, saved: [], running: true };
    storeQueue(queue); navigate(jobUrl(jobs[0]));
  });
  button('Stop after this run', () => {
    const queue = loadQueue(); if (!queue) return;
    queue.stopAfterRun = true; storeQueue(queue); status.textContent = 'Will save the current attempt and stop before the next run.';
  });
  button('Resume matrix', () => {
    const queue = loadQueue(); if (!queue || queue.index >= queue.jobs.length) { status.textContent = 'No unfinished matrix to resume.'; return; }
    queue.running = true; queue.stopAfterRun = false; delete queue.error; storeQueue(queue); navigate(jobUrl(queue.jobs[queue.index]));
  });
  button('Save current result', () => { void saveCurrent().then(filename => { status.textContent = `SAVED TO WORKSPACE\n${filename}`; }).catch(error => { status.textContent = String(error); }); });
  panel.append(title, note, buttons, status); document.body.append(panel);

  async function saveCurrent(): Promise<string> {
    const evaluation = evaluationWindow.arsenalEvaluation, measurement = evaluation?.snapshot();
    if (!evaluation || !measurement?.outcome) throw new Error('Finish a scripted encounter before saving.');
    const events = evaluation.events();
    if (!events.length || events.length >= 100_000) throw new Error('Event trace is missing or capped.');
    const replay = new CombatMeasurement(measurement.metadata);
    if (events.some(event => !replay.record(event)) || JSON.stringify(replay.snapshot()) !== JSON.stringify(measurement)) throw new Error('Event trace differs from the measurement.');
    const response = await fetch('/__balance-evidence', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: `${JSON.stringify({ measurement, events, encounter: evaluation.game.getEncounterSnapshot(), sourceFingerprint: evaluation.sourceFingerprint,
        droppedTraceEvents: 0, hardwareStatus: 'NOT RUN', inputAttestation: 'scripted-route-v1 in actual Game; simulated controls, no physical controller testing', exportTransport: 'local same-origin exact-replay workspace export' }, null, 2)}\n`,
    });
    const result = await response.json() as { filename?: string; error?: string };
    if (!response.ok || !result.filename) throw new Error(result.error ?? `Save failed (${response.status}).`);
    return result.filename;
  }

  let started = false, busy = false;
  interval = setInterval(() => { void poll(); }, 100);
  async function poll() {
    if (busy || navigating) return;
    const queue = loadQueue();
    if (!queue?.running) {
      if (queue?.index === 48) status.textContent = `MATRIX COMPLETE · 48 / 48 saved\n${queue.saved.filter(run => run.outcome === 'complete').length} complete encounters. Full acceptance and paired differences are in the summary command.\nNo balance was tuned by this runner.`;
      else if (queue) status.textContent = `MATRIX PAUSED · ${queue.index} / 48 saved\n${queue.error ?? 'Resume to continue from a fresh page.'}`;
      return;
    }
    const job = queue.jobs[queue.index], params = new URLSearchParams(location.search);
    if (!job) return;
    if (params.get('balance') !== job.variant || params.get('build') !== job.build || Number(params.get('seed')) !== job.seed) {
      queue.running = false; queue.error = 'Matrix URL differs from the scheduled cell; resume to restore its pristine page.'; storeQueue(queue); return;
    }
    const evaluation = evaluationWindow.arsenalEvaluation;
    if (!evaluation) { status.textContent = `MATRIX ${queue.index + 1} / 48 · Loading ${job.variant} / ${job.build} / seed ${job.seed}`; return; }
    if (!started) {
      const start = [...document.querySelectorAll<HTMLButtonElement>('section[aria-label="Evaluation controls"] button')].find(button => button.textContent === 'Run scripted encounter');
      if (!start || start.disabled) return;
      started = true; start.click();
    }
    const measurement = evaluation.snapshot();
    status.textContent = `MATRIX ${queue.index + 1} / 48 · ${job.variant}\n${job.build} / seed ${job.seed}\n${measurement?.duration.toFixed(1) ?? '0'} active seconds · ${measurement?.outcome ?? 'running'}\n${queue.index} previous attempts saved`;
    if (!measurement?.outcome) return;
    busy = true;
    try {
      const filename = await saveCurrent();
      const latest = loadQueue() ?? queue;
      latest.saved.push({ ...job, filename, outcome: measurement.outcome, seconds: measurement.duration }); latest.index++;
      latest.running = latest.index < latest.jobs.length && !latest.stopAfterRun; storeQueue(latest);
      if (latest.running) navigate(jobUrl(latest.jobs[latest.index]));
    } catch (error) {
      queue.running = false; queue.error = error instanceof Error ? error.message : String(error); storeQueue(queue);
    } finally { busy = false; }
  }
  window.addEventListener('pagehide', () => { if (interval !== undefined) clearInterval(interval); }, { once: true });
}
