import '../style.css';
import { Game, type EvaluationInput, type EvaluationProc } from '../game';
import type { Mode } from '../core/index';
import { ENCOUNTER } from '../encounter/encounter';
import { createEncounterPolicy } from '../diagnostics/encounterDriver';
import { CombatMeasurement, type JsonValue, type MeasurementEvent } from '../diagnostics/measurement';
import {
  CLUSTER_LIVE_PROTOCOL, CLUSTER_LIVE_POLICY, CLUSTER_LIVE_STEP, CLUSTER_LIVE_TIMEOUT,
  CLUSTER_LIVE_DELIVERIES, CLUSTER_LIVE_PAYLOADS, CLUSTER_LIVE_SEEDS,
  clusterClone, clusterCanonical, clusterLiveContext, clusterLiveFixture, clusterLiveJobs, clusterLiveSummary,
  emptyClusterLiveForm, recordClusterLiveEvent, validateClusterLiveEvidence,
  type ClusterLiveJob, type ClusterLiveArm, type ClusterLiveEvidence, type ClusterLiveLaunch,
} from '../diagnostics/clusterLive';

const params = new URLSearchParams(location.search);
const cell = params.get('cell') === '1';
const delivery = CLUSTER_LIVE_DELIVERIES.find(value => value === params.get('delivery')) ?? 'cluster';
const payload = CLUSTER_LIVE_PAYLOADS.find(value => value === params.get('payload')) ?? 'kinetic';
const seed = CLUSTER_LIVE_SEEDS.find(value => String(value) === params.get('seed')) ?? 7;
const arm: ClusterLiveArm = params.get('arm') === 'final' ? 'final' : 'baseline';
const fixtureSource = params.get('fixtureSource') === 'loot' ? 'loot' : 'workbench';
const job: ClusterLiveJob = { arm, delivery, payload, seed, fixtureSource };
const panel = document.createElement('section'); panel.setAttribute('aria-label', 'Cluster live encounter comparison');
panel.style.cssText = 'position:fixed;z-index:500;top:8px;left:8px;right:8px;max-height:94vh;overflow:auto;padding:12px;background:#10232bf5;color:#f5ecd4;border:1px solid #79cabb;font:13px/1.4 system-ui;';
const title = document.createElement('strong'); title.textContent = 'CLUSTER / ROCKET / SCATTER — ACTUAL LIVE ENCOUNTERS';
const note = document.createElement('p'); note.textContent = '36 matched cells per arm: 27 workbench cells (3 deliveries × 3 seeds × 3 payloads) plus 9 ordinary rare weapon rolls with corrosion+fire. Both forms, real AI, cover, ammunition, heat, shields and statuses. Same launcher receiver and equipment; body-aim route and healing, offensive ability disabled. Scripted controls; physical play NOT RUN.';
const actions = document.createElement('div'); actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
const status = document.createElement('output'); status.id = 'cluster-live-status'; status.setAttribute('aria-live', 'polite'); status.style.cssText = 'display:block;white-space:pre-wrap;margin-top:8px';
const results = document.createElement('pre'); results.id = 'cluster-live-results'; results.style.cssText = 'max-height:280px;overflow:auto;white-space:pre-wrap;font-size:11px';
const download = document.createElement('a'); download.textContent = 'Download matrix summary JSON'; download.style.cssText = 'display:block;color:#a9ecd5;margin-top:8px';
panel.append(title, note, actions, status, download, results); document.body.append(panel);
function button(label: string, action: () => void) {
  const value = document.createElement('button'); value.type = 'button'; value.textContent = label;
  value.style.cssText = 'background:#28504e;color:#fff3d8;border:1px solid #9bd8c8;padding:8px;cursor:pointer';
  value.onclick = action; actions.append(value); return value;
}
function cellUrl(value: ClusterLiveJob): string {
  return `/cluster-live-lab.html?${new URLSearchParams({ cell: '1', fixtureSource: value.fixtureSource, arm: value.arm, delivery: value.delivery, payload: value.payload, seed: String(value.seed) })}`;
}
function describe(value: ClusterLiveJob) { return `${value.arm} · ${value.fixtureSource} · ${value.delivery} · ${value.payload} · seed ${value.seed}`; }
function message(value: unknown) { if (parent !== window) parent.postMessage(value, location.origin); }

async function sourceFingerprint(): Promise<string> {
  const response = await fetch('/__cluster-source', { cache: 'no-store' });
  const data = await response.json() as { sourceFingerprint?: string; error?: string };
  if (!response.ok || !data.sourceFingerprint) throw new Error(data.error ?? 'Frozen source fingerprint unavailable.');
  return data.sourceFingerprint;
}

async function runCell(): Promise<void> {
  const fingerprint = await sourceFingerprint(), fixture = clusterLiveFixture(job);
  const forms = { pilot: emptyClusterLiveForm(), mech: emptyClusterLiveForm() };
  const events: MeasurementEvent[] = [], eventModes: Mode[] = [], inputs: EvaluationInput[] = [], launches: ClusterLiveLaunch[] = [];
  const encounterEvents: ClusterLiveEvidence['encounterEvents'] = [], procs: EvaluationProc[] = [];
  let technicalInterruption: ClusterLiveEvidence['technicalInterruption'];
  let currentMode: Mode = 'pilot', skippedDummyEvents = 0, dropped = 0, frameCount = 0, renderedFrames = 0;
  const collector = new CombatMeasurement({ runId: `cluster-live-${arm}-${fixtureSource}-${delivery}-${payload}-${seed}-1`, scenario: 'encounter', provenance: 'simulated',
    seed, buildId: `${fixtureSource}/${delivery}/${payload}`, buildCodes: fixture.codes, equipment: clusterClone(fixture.equipment) as unknown as JsonValue,
    sourceFingerprint: fingerprint, protocol: CLUSTER_LIVE_PROTOCOL,
    configuration: { encounterVersion: ENCOUNTER.version, controls: CLUSTER_LIVE_POLICY, arm, fixtureSource, delivery, payload, seed,
      step: CLUSTER_LIVE_STEP, timeoutSeconds: CLUSTER_LIVE_TIMEOUT, mode: 'pilot-to-mech', equipment: 'same Ironvale launcher/rare5/standard; identical real shield/reactor/legs',
      hardwareStatus: 'NOT RUN', groupedReferenceRadius: { pilot: 2.2, mech: 3.2 }, sourceScope: 'all src ts/css', offensiveAbility: false, ordinaryWeaponStatSeed: fixtureSource === 'loot' ? 2 : null } });
  const game = new Game(document.querySelector<HTMLElement>('#app')!, {
    initialProgression: fixture.state, saveKey: `dust-steel.cluster-live.${arm}.${delivery}.${payload}.${seed}.v1`,
    autoEncounters: false, encounterSeed: seed, evaluationDriver: true, manualEvaluation: true,
    onMeasurement(raw) {
      if (collector.snapshot().outcome) return;
      if (raw.type === 'damage' && raw.target !== 'enemy') { skippedDummyEvents++; return; }
      const event = clusterClone(raw) as MeasurementEvent;
      if (collector.record(event)) {
        if (events.length >= 100_000) { dropped++; return; }
        events.push(event); eventModes.push(currentMode); recordClusterLiveEvent(forms[currentMode], event);
      }
    },
    onEncounterEvent(event) {
      encounterEvents.push({ at: game.getEncounterSnapshot().time, event: clusterClone(event) });
      if (event.type === 'enemy-phase' && event.phase === 'attack') forms[currentMode].attackEvents++;
    },
    onEvaluationProc(proc) {
      procs.push(clusterClone(proc)); const counts = forms[proc.mode].successfulProcs; counts[proc.element] = (counts[proc.element] ?? 0) + 1;
    },
    onEvaluationShot(launch) {
      const snapshot = game.getEncounterSnapshot(), context = clusterLiveContext(snapshot, launch.aimPoint);
      launches.push({ ...clusterClone(launch), ...context }); forms[launch.mode].contexts[context.context].shots++;
    },
  });
  if (game.getEncounterSnapshot().time !== 0 || game.getEncounterSnapshot().run !== 0) throw new Error('Each cell requires a pristine Game.');
  function abortForInterruption(reason: string): void {
    if (collector.snapshot().outcome) return;
    const snapshot = game.getEncounterSnapshot();
    technicalInterruption = { reason, at: snapshot.time, frameCount, expectedSeconds: frameCount * CLUSTER_LIVE_STEP, actualSeconds: snapshot.time };
    const event: MeasurementEvent = { type: 'finish', at: snapshot.time, outcome: 'aborted' };
    collector.record(event); events.push(event); eventModes.push(currentMode);
  }
  const policy = createEncounterPolicy(); game.startEncounter(seed);
  status.textContent = `${describe(job)}\nStarting actual live encounter…`;
  while (frameCount < CLUSTER_LIVE_TIMEOUT * 60 && !collector.snapshot().outcome) {
    for (let step = 0; step < 120 && frameCount < CLUSTER_LIVE_TIMEOUT * 60 && !collector.snapshot().outcome; step++) {
      const before = game.getEncounterSnapshot();
      if (before.paused) { abortForInterruption(`Game paused while the manual comparison was running (${before.screen}).`); break; }
      const input = { ...policy.input(before, CLUSTER_LIVE_STEP), ability: false };
      inputs.push(clusterClone(input)); game.driveEvaluation(input);
      currentMode = input.switchMode ? game.getEncounterSnapshot().mode : before.mode;
      const form = forms[currentMode], context = clusterLiveContext(before).context;
      form.elapsedSeconds += CLUSTER_LIVE_STEP; form.contexts[context].seconds += CLUSTER_LIVE_STEP;
      if (before.enemies.length) form.combatSeconds += CLUSTER_LIVE_STEP;
      for (const enemy of before.enemies) {
        if (enemy.health <= 0) continue;
        const conditions = (enemy as typeof enemy & { conditions?: { frozen: boolean; moveSpeed: number } }).conditions;
        if (!conditions) throw new Error('Live control telemetry is unavailable; evaluation-only enemy conditions are required.');
        form.aliveEnemySeconds += CLUSTER_LIVE_STEP;
        if (conditions.frozen) form.frozenEnemySeconds += CLUSTER_LIVE_STEP;
        if (conditions.moveSpeed < 1) form.slowedEnemySeconds += CLUSTER_LIVE_STEP;
      }
      game.stepEvaluation(CLUSTER_LIVE_STEP); frameCount++;
      if (!collector.snapshot().outcome && collector.snapshot().duration <= before.time + 1e-10) {
        abortForInterruption('Game simulation did not advance under the manual comparison driver.'); break;
      }
    }
    const snapshot = game.getEncounterSnapshot(); game.renderEvaluation(0, true); renderedFrames++;
    const progress = { type: 'cluster-live-progress', job, frameCount, seconds: snapshot.time, phase: snapshot.phase, mode: snapshot.mode, kills: collector.snapshot().kills, reason: policy.reason };
    status.textContent = `${describe(job)}\n${snapshot.phase.toUpperCase()} · ${snapshot.time.toFixed(1)}s · ${snapshot.mode}\n${collector.snapshot().kills} defeated · ${collector.snapshot().ammo.total} rounds\n${policy.reason}`;
    message(progress); await new Promise(resolve => setTimeout(resolve, 0));
  }
  if (!collector.snapshot().outcome) {
    const event: MeasurementEvent = { type: 'finish', at: game.getEncounterSnapshot().time, outcome: 'timeout' };
    collector.record(event); events.push(event); eventModes.push(currentMode);
  }
  game.driveEvaluation({});
  const evidence: ClusterLiveEvidence = { protocol: CLUSTER_LIVE_PROTOCOL, job, sourceFingerprint: fingerprint,
    measurement: collector.snapshot(), events, eventModes, inputs, launches, procs, forms, encounter: game.getEncounterSnapshot(),
    encounterEvents, initialEquipment: clusterClone(fixture.equipment), droppedTraceEvents: dropped, skippedDummyEvents,
    hardwareStatus: 'NOT RUN', controls: CLUSTER_LIVE_POLICY, frameCount, renderedFrames, ...(technicalInterruption ? { technicalInterruption } : {}),
    limitations: ['Scripted body aiming and ordinary movement in actual Game; no human or physical controller result is claimed.',
      'Whole encounter outcomes include traversal, shields, AI response, ammunition, heat and status effects; no dummy-only damage estimate substitutes for these runs.',
      'Grouped/spread/covered are observed shot/routing contexts from real target positions and colliders, not forced arena layouts or a matched fixed-distance splash benchmark.',
      'Enemy freeze/slow exposure is sampled at 60 Hz and reported as enemy-seconds; attack pressure counts actual enemy attack-phase events.',
      'No frame-rate or hardware performance claim; accelerated stepping draws only between bounded chunks.'] };
  validateClusterLiveEvidence(evidence);
  const response = await fetch('/__cluster-evidence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: `${JSON.stringify(evidence)}\n` });
  const saved = await response.json() as { filename?: string; error?: string };
  if (!response.ok || !saved.filename) throw new Error(saved.error ?? `Could not preserve this attempt (${response.status}).`);
  const summary = { ...clusterLiveSummary(evidence), filename: saved.filename };
  results.textContent = JSON.stringify(summary, null, 2); status.textContent += `\nSAVED ${saved.filename}`;
  message({ type: 'cluster-live-complete', job, summary });
}

if (import.meta.env.DEV && cell) {
  panel.style.cssText = 'position:fixed;z-index:500;left:8px;bottom:8px;max-width:430px;padding:10px;background:#10232bdf;color:#f5ecd4;font:12px/1.35 system-ui;';
  note.hidden = true; download.hidden = true;
  void runCell().catch(error => { const detail = error instanceof Error ? error.stack ?? error.message : String(error); status.textContent = detail; message({ type: 'cluster-live-error', job, error: detail }); });
} else if (import.meta.env.DEV) {
  let running = false, stopAfter = false, activeJobs: ClusterLiveJob[] = [], activeIndex = 0;
  let summaries: (ReturnType<typeof clusterLiveSummary> & { filename: string })[] = [];
  let expectedFingerprint: string | null = null, downloadUrl: string | null = null;
  const frame = document.createElement('iframe'); frame.title = 'Fresh live encounter cell'; frame.style.cssText = 'width:100%;height:64vh;border:1px solid #79cabb;margin-top:10px';
  panel.append(frame); panel.style.maxHeight = '96vh';
  function refreshResults() {
    const summary = { protocol: CLUSTER_LIVE_PROTOCOL, arm: activeJobs[0]?.arm ?? null, sourceFingerprint: expectedFingerprint,
      cellsExpected: activeJobs.length, cellsSaved: summaries.length, running, summaries, hardwareStatus: 'NOT RUN' };
    results.textContent = JSON.stringify(summary, null, 2);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(new Blob([`${JSON.stringify(summary, null, 2)}\n`], { type: 'application/json' }));
    download.href = downloadUrl; download.download = `cluster-live-${summary.arm ?? 'results'}-summary.json`;
  }
  function advance() {
    if (activeIndex >= activeJobs.length || stopAfter) { running = false; status.textContent = `${activeIndex === activeJobs.length ? 'MATRIX COMPLETE' : 'MATRIX PAUSED'} · ${summaries.length}/${activeJobs.length} saved\nEvery outcome retained. Raw traces were validated and saved in the workspace.`; refreshResults(); return; }
    frame.src = cellUrl(activeJobs[activeIndex]); status.textContent = `RUNNING ${activeIndex + 1}/${activeJobs.length}\n${describe(activeJobs[activeIndex])}`;
  }
  function begin(value: ClusterLiveArm, jobs = clusterLiveJobs(value)) {
    if (running) return;
    running = true; stopAfter = false; activeJobs = jobs; activeIndex = 0; summaries = []; expectedFingerprint = null; refreshResults(); advance();
  }
  button('Run baseline matrix', () => begin('baseline'));
  button('Run final matrix', () => begin('final'));
  button('Run selected baseline cell', () => begin('baseline', [{ ...job, arm: 'baseline' }]));
  button('Run selected final cell', () => begin('final', [{ ...job, arm: 'final' }]));
  button('Stop after this cell', () => { stopAfter = true; status.textContent += '\nWill preserve this cell before stopping.'; });
  button('Resume remaining cells', () => { if (!running && activeIndex < activeJobs.length) { running = true; stopAfter = false; advance(); } });
  status.textContent = `READY · selected ${describe(job)}\nA matrix uses a fresh visible iframe and a new Game for every cell.`; refreshResults();
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow || !running) return;
    const data = event.data as { type?: string; job?: ClusterLiveJob; summary?: typeof summaries[number]; error?: string; seconds?: number; phase?: string; mode?: string; kills?: number; reason?: string };
    if (!data.job || clusterCanonical(data.job) !== clusterCanonical(activeJobs[activeIndex])) return;
    if (data.type === 'cluster-live-progress') status.textContent = `RUNNING ${activeIndex + 1}/${activeJobs.length} · ${summaries.length} saved\n${describe(data.job)}\n${data.phase} · ${data.seconds?.toFixed(1)}s · ${data.mode} · ${data.kills} defeated\n${data.reason}`;
    if (data.type === 'cluster-live-error') { running = false; status.textContent = `CELL STOPPED — prior evidence preserved\n${data.error}`; refreshResults(); }
    if (data.type === 'cluster-live-complete' && data.summary) {
      const summary = data.summary;
      if (expectedFingerprint && expectedFingerprint !== summary.sourceFingerprint) { running = false; status.textContent = 'Source changed between matrix cells; stop and preserve this attempt.'; refreshResults(); return; }
      expectedFingerprint ??= summary.sourceFingerprint; summaries.push(summary); activeIndex++; refreshResults(); advance();
    }
  });
} else document.body.replaceChildren(document.createTextNode('This development-only fixture is unavailable in production.'));
