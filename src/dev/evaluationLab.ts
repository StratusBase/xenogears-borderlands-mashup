import '../style.css';
import { Game } from '../game';
import { createEvaluationFixture, EVALUATION_BUILDS, EVALUATION_PROTOCOL, type EvaluationBuildId } from '../diagnostics/fixtures';
import { CombatMeasurement, type JsonValue, type MeasurementEvent, type MeasurementScenario, type MeasurementSnapshot } from '../diagnostics/measurement';
import { createEncounterPolicy } from '../diagnostics/encounterDriver';
import { balanceVariant, BALANCE_VARIANTS } from '../diagnostics/balanceVariants';
import evaluationLabSource from './evaluationLab.ts?raw';

/** This page owns diagnostics UI only; gameplay and hooks belong to the combat lead. */
async function startLab() {
  const params = new URLSearchParams(location.search);
  const build = EVALUATION_BUILDS.find(build => build.id === params.get('build'))?.id ?? 'mobile-precision';
  const scenario: MeasurementScenario = params.get('scenario') === 'encounter' ? 'encounter' : 'dummy';
  const mode = params.get('mode') === 'mech' ? 'mech' : 'pilot';
  const parsedSeed = Number(params.get('seed') ?? 7);
  const seed = Number.isInteger(parsedSeed) && parsedSeed >= 0 && parsedSeed <= 0xffffffff ? parsedSeed : 7;
  const fixture = createEvaluationFixture(build);
  const variant = balanceVariant(params.get('balance'));
  const rules = BALANCE_VARIANTS[variant];
  const host = document.querySelector<HTMLElement>('#app')!;
  let collector: CombatMeasurement | null = null;
  let origin = 0;
  let lastSnapshot: MeasurementSnapshot | null = null;
  let sequence = 0;
  let hasRun = false;
  let finishedWorld: ReturnType<Game['getEncounterSnapshot']> | null = null;
  let scriptedReason: string | null = null;
  const events: MeasurementEvent[] = [];
  let skippedDummyEvents = 0;
  let droppedTraceEvents = 0;
  const MAX_TRACE_EVENTS = 100_000;
  const rawSources = import.meta.glob('/src/**/*.{ts,css}', { query: '?raw', import: 'default' });
  const sourceContents = await Promise.all(Object.keys(rawSources).sort().map(async path => ({ path: path.slice(1), content: await rawSources[path]() as string })));
  // Vite omits the importing module from a glob. Include it explicitly so this
  // measurement/driver entrypoint has the same complete fingerprint as the CLI.
  if (!sourceContents.some(source => source.path === 'src/dev/evaluationLab.ts')) {
    sourceContents.push({ path: 'src/dev/evaluationLab.ts', content: evaluationLabSource });
    sourceContents.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  }
  // This fingerprints loaded development source; CLI reports also include the lockfile and tsconfig.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(sourceContents)));
  const fingerprint = `sha256:${[...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`;

  const game = new Game(host, {
    initialProgression: fixture.state, saveKey: `dust-steel.evaluation.${build}.v1`, autoEncounters: false, encounterSeed: seed, evaluationDriver: true,
    evaluationBalanceRules: rules,
    onMeasurement(raw) {
      if (!collector || collector.snapshot().outcome) return;
      // Chains and radiation may touch the permanent dummy during a live encounter.
      if (raw.type === 'damage' && raw.target !== (scenario === 'dummy' ? 'dummy' : 'enemy')) { skippedDummyEvents++; return; }
      const event = { ...raw, at: Math.max(0, raw.at - origin) } as MeasurementEvent;
      if (collector.record(event)) {
        if (events.length < MAX_TRACE_EVENTS) events.push(event); else droppedTraceEvents++;
      }
      lastSnapshot = collector.snapshot();
      if (event.type === 'finish') finishedWorld = game.getEncounterSnapshot();
    },
  });
  game.run();
  const panel = document.createElement('section');
  panel.setAttribute('aria-label', 'Evaluation controls');
  panel.style.cssText = 'position:fixed;z-index:100;left:8px;top:8px;width:min(420px,calc(100vw - 16px));max-height:90vh;overflow:auto;background:#13212aed;color:#f2e5cc;border:1px solid #72c4b8;padding:12px;font:13px/1.4 system-ui;';
  const title = document.createElement('strong'); title.textContent = 'ARSENAL EVALUATION · browser run'; panel.append(title);
  const help = document.createElement('p');
  help.textContent = 'Begin directly from this fresh page. Playing first changes the random/shot sequence and requires a reload. Export each run before reloading. Scripted controls are simulated; physical gamepad testing stays NOT RUN.'; panel.append(help);
  const form = document.createElement('form'); form.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
  function select(name: string, label: string, options: { value: string; label: string }[], value: string) {
    const wrapper = document.createElement('label'); wrapper.textContent = `${label} `;
    const control = document.createElement('select'); control.name = name;
    for (const option of options) { const item = document.createElement('option'); item.value = option.value; item.textContent = option.label; control.append(item); }
    control.value = value; wrapper.append(control); form.append(wrapper); return control;
  }
  select('build', 'Build', EVALUATION_BUILDS.map(build => ({ value: build.id, label: build.label })), build);
  select('scenario', 'Test', [{ value: 'dummy', label: 'Permanent dummy' }, { value: 'encounter', label: 'Live encounter' }], scenario);
  select('balance', 'Balance', Object.keys(BALANCE_VARIANTS).map(value => ({ value, label: value })), variant);
  select('mode', 'Dummy form', [{ value: 'pilot', label: 'Pilot' }, { value: 'mech', label: 'Mech' }], mode);
  const seedLabel = document.createElement('label'); seedLabel.textContent = 'Seed ';
  const seedInput = document.createElement('input'); seedInput.name = 'seed'; seedInput.type = 'number'; seedInput.min = '0'; seedInput.max = '4294967295'; seedInput.value = String(seed); seedInput.style.width = '90px'; seedLabel.append(seedInput); form.append(seedLabel);
  const reload = document.createElement('button'); reload.textContent = 'Load fresh configuration'; form.append(reload);
  form.addEventListener('submit', event => {
    event.preventDefault(); const query = new URLSearchParams([...new FormData(form).entries()].map(([key, value]) => [key, String(value)]));
    location.search = query.toString();
  });
  panel.append(form);
  const actions = document.createElement('div'); actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin:10px 0'; panel.append(actions);
  const status = document.createElement('output'); status.style.cssText = 'display:block;white-space:pre-wrap'; panel.append(status);
  function button(label: string, action: () => void) { const button = document.createElement('button'); button.textContent = label; button.type = 'button'; button.onclick = action; actions.append(button); return button; }
  function beginMeasurement(scripted = false): boolean {
    if (hasRun) { location.reload(); return false; }
    if (collector && !collector.snapshot().outcome) { status.textContent = 'Finish or abort the current measurement first.'; return false; }
    const initial = game.getEncounterSnapshot();
    if (initial.time > 0 || initial.run !== 0) { status.textContent = 'This page already advanced gameplay. Load fresh configuration before measuring.'; return false; }
    const current = initial.progression;
    const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
    const equipped = (['pilot', 'mech'] as const).flatMap(form => Object.values(current.loadouts[form]).map(id => current.inventory.find(item => item.id === id)));
    if (canonical(equipped) !== canonical([...fixture.equipment.pilot, ...fixture.equipment.mech])) {
      status.textContent = 'Equipment changed before measurement. Load fresh configuration to restore the documented fixture.'; return false;
    }
    game.resetEvaluation();
    origin = game.getEncounterSnapshot().time;
    events.length = 0; skippedDummyEvents = 0; droppedTraceEvents = 0;
    collector = new CombatMeasurement({ runId: `${scenario}-${build}-${seed}-${++sequence}`, scenario, provenance: scripted ? 'simulated' : 'browser', seed,
      buildId: build, buildCodes: fixture.codes, configuration: { protocol: EVALUATION_PROTOCOL, mode: scenario === 'dummy' ? mode : 'pilot-to-mech', seed,
        balanceVariant: variant, balanceRules: { ...rules },
        controls: scripted ? 'scripted-route-v1: actual Game, fixed 1/60s, body aim, no teleport or stat modifications' : 'manual browser input',
        startingRun: 1, timeoutSeconds: scripted ? 480 : null,
        encounter: 'combat-lead staged encounter configuration in source fingerprint', sourceScope: 'all src ts/css',
        dummyProtocol: 'manual trigger window; finish button releases observation; actual duration recorded', hardwareStatus: 'NOT RUN' },
      equipment: JSON.parse(JSON.stringify(fixture.equipment)) as JsonValue, sourceFingerprint: fingerprint, protocol: EVALUATION_PROTOCOL });
    lastSnapshot = collector.snapshot(); hasRun = true;
    if (scenario === 'dummy') game.startDummyEvaluation(mode); else game.startEncounter(seed);
    begin.disabled = true;
    scriptedButton.disabled = true;
    status.textContent = 'Recording. Gameplay clocks pause in menus. Use Finish dummy / Abort / Export when ready.';
    return true;
  }
  const begin = button('Begin measurement', () => { beginMeasurement(); });
  const scriptedButton = button('Run scripted encounter', () => { void runScripted(); });
  scriptedButton.disabled = scenario !== 'encounter';
  async function runScripted() {
    if (scenario !== 'encounter' || !beginMeasurement(true)) return;
    const policy = createEncounterPolicy();
    for (let frame = 0; frame < 480 * 60 && collector && !collector.snapshot().outcome; frame++) {
      game.driveEvaluation(policy.input(game.getEncounterSnapshot(), 1 / 60));
      game.stepEvaluation(1 / 60);
      if (frame % 120 === 119) await new Promise(resolve => setTimeout(resolve, 0));
    }
    scriptedReason = policy.reason;
    if (collector && !collector.snapshot().outcome) {
      const event = { type: 'finish', at: game.getEncounterSnapshot().time - origin, outcome: 'timeout' } as const;
      collector.record(event); events.push(event); finishedWorld = game.getEncounterSnapshot();
      lastSnapshot = collector.snapshot(); game.resetEvaluation();
    }
    game.driveEvaluation({});
  }
  button('Finish dummy', () => {
    if (!collector || scenario !== 'dummy' || collector.snapshot().outcome) return;
    const finish = { type: 'finish', at: game.getEncounterSnapshot().time - origin, outcome: 'complete' } as const;
    collector.record(finish); events.push(finish);
    finishedWorld = game.getEncounterSnapshot(); lastSnapshot = collector.snapshot(); game.resetEvaluation(); begin.disabled = false;
  });
  button('Abort', () => {
    if (!collector || collector.snapshot().outcome) return;
    game.resetEvaluation(); lastSnapshot = collector.snapshot(); begin.disabled = false;
  });
  button('Export JSON', () => {
    if (!collector) { status.textContent = 'Begin a measurement before exporting.'; return; }
    const evidence = { measurement: collector.snapshot(), events, skippedCrossScenarioEvents: skippedDummyEvents, droppedTraceEvents,
      encounter: finishedWorld ?? game.getEncounterSnapshot(), scriptedReason, hardwareStatus: 'NOT RUN', inputAttestation: 'Browser telemetry only; no physical controller test is asserted.' };
    const blob = new Blob([`${JSON.stringify(evidence, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `${collector.snapshot().metadata.runId}.json`; link.click(); URL.revokeObjectURL(url);
  });
  const codes = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Exact weapon codes'; codes.append(summary);
  const codeText = document.createElement('pre'); codeText.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere'; codeText.textContent = `PILOT\n${fixture.codes.pilot}\nMECH\n${fixture.codes.mech}`; codes.append(codeText); panel.append(codes);
  document.body.append(panel);
  const refresh = setInterval(() => {
    if (!lastSnapshot) return;
    const m = lastSnapshot;
    status.textContent = `${scenario.toUpperCase()} / ${build} / seed ${seed} / ${variant}\n${m.duration.toFixed(1)}s · ${m.damage.total.toFixed(1)} applied damage · ${m.practicalDps.toFixed(1)} DPS\nReceived ${m.received.total.toFixed(1)} · Ammo ${m.ammo.total} · Kills ${m.kills}\nHeat blocked ${m.heatBlockedSeconds.toFixed(1)}s · Reload ${m.reloadSeconds.toFixed(1)}s\nOutcome ${m.outcome ?? 'recording'} · Invalid events ${m.rejectedEvents}`;
    if (m.outcome) { begin.disabled = false; begin.textContent = 'Reload for next run'; }
  }, 250);
  // Browser automation can inspect/export data without reaching through private Game fields.
  Object.assign(window, { arsenalEvaluation: { game, build: build as EvaluationBuildId, scenario, seed,
    snapshot: () => collector?.snapshot() ?? null, events: () => events.map(event => ({ ...event })),
    sourceFingerprint: fingerprint, hardwareStatus: 'NOT RUN' } });
  window.addEventListener('pagehide', () => clearInterval(refresh), { once: true });
}

if (import.meta.env.DEV) void startLab();
else document.body.replaceChildren(document.createTextNode('This development fixture is unavailable in production.'));
