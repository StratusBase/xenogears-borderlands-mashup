/** Offline audit only: no browser, renderer, tests, Git operations or receipt mutation. */
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';

const ARMS = ['before', 'current', 'current-repeat', 'before-repeat'];
const DEFAULT_BASELINE_MODULES = ['fire', 'radiation', 'shock'];
const BASELINE_MODULES = new Set(['fire','ice','radiation','gravity','corrosive','shock']);
const SCENES = [
  {name:'pilot-sticky', scene:'sticky', mode:'pilot', projectile:'sticky', element:'adhesive', targets:6},
  {name:'mech-sticky', scene:'sticky', mode:'mech', projectile:'sticky', element:'adhesive', targets:6},
  {name:'shock-secondary-rifle', scene:'rifle', mode:'pilot', projectile:'bullet', element:'adhesive', secondary:'shock', targets:3},
  {name:'radiation-primary-rifle', scene:'rifle', mode:'pilot', projectile:'bullet', element:'radiation', secondary:'adhesive', targets:3},
];
const COMBAT_KEYS = ['time', 'body', 'mode', 'kills', 'loot', 'shots', 'hits', 'contacts', 'targets'];
const HASH = /^[a-f0-9]{64}$/i;
const hash = value => createHash('sha256').update(value).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const array = value => Array.isArray(value) ? value : [];
const finite = value => typeof value === 'number' && Number.isFinite(value);
const count = value => Number.isInteger(value) && value >= 0;
const check = (condition, message, issues) => {if (!condition) issues.push(message); return Boolean(condition);};
const same = (a, b) => isDeepStrictEqual(a, b);
const vector = value => Array.isArray(value) && value.length === 3 && value.every(finite);
const xyz = value => object(value) && ['x','y','z'].every(key => finite(value[key]));
const sortedKeys = value => object(value) ? Object.keys(value).sort() : [];
const pickCombat = snapshot => Object.fromEntries(COMBAT_KEYS.map(key => [key, snapshot?.[key]]));

export function parseBaselineModules(value) {
  const modules = value.split(',').map(element => element.trim());
  if (modules.includes('adhesive')) throw new Error('--baseline-modules must exclude adhesive; current arms add it explicitly');
  const unknown = modules.filter(element => !BASELINE_MODULES.has(element));
  if (unknown.length) throw new Error(`Unknown/empty baseline module: ${unknown.map(element => JSON.stringify(element)).join(', ')}`);
  if (new Set(modules).size !== modules.length) throw new Error('--baseline-modules contains a duplicate module');
  return modules;
}

// Independent recomputation, using quality/performance.ts's exact index convention.
export function distribution(values) {
  const sorted = values.filter(finite).sort((a, b) => a - b);
  if (!sorted.length) return {median:0, p95:0, min:0, max:0};
  return {median:sorted[Math.floor((sorted.length - 1) * .5)], p95:sorted[Math.ceil((sorted.length - 1) * .95)], min:sorted[0], max:sorted.at(-1)};
}

function firstDifference(a, b, path = '$') {
  if (same(a, b)) return null;
  if (!object(a) && !Array.isArray(a) || !object(b) && !Array.isArray(b)) return path;
  if (Array.isArray(a) !== Array.isArray(b)) return path;
  if (Array.isArray(a) && a.length !== b.length) return `${path}.length`;
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  for (const key of keys) if (!same(a[key], b[key])) return firstDifference(a[key], b[key], `${path}${Array.isArray(a) ? `[${key}]` : `.${key}`}`);
  return path;
}

function validateDistribution(value, label, issues) {
  return check(object(value) && ['median','p95','min','max'].every(key => finite(value[key]))
    && value.min >= 0 && value.min <= value.median && value.median <= value.p95 && value.p95 <= value.max,
  `${label}: expected finite, nonnegative, ordered min/median/p95/max`, issues);
}

function validateGpu(cost, label, issues, limits) {
  const timing = cost?.gpuTiming;
  if (!object(timing)) {
    limits.push(`${label}: schema-2 GPU timing was not recorded; deprecated latched gpuMs is not substituted.`);
    return {status:'UNAVAILABLE', coverage:null, samples:0};
  }
  const start = issues.length;
  check(timing.schema === 2, `${label}: GPU timing schema must be 2`, issues);
  check(typeof timing.supported === 'boolean', `${label}: GPU support flag is missing`, issues);
  for (const key of ['epoch','firstFrame','requested','issued','resolved','pending','skipped','disjoint','lost'])
    check(count(timing[key]), `${label}: invalid GPU ${key}`, issues);
  check(timing.requested === 720, `${label}: GPU requested count must be 720`, issues);
  check(Array.isArray(timing.samples), `${label}: unique GPU samples are missing`, issues);
  const samples = array(timing.samples), frames = samples.map(sample => sample?.frame);
  check(samples.length === timing.resolved, `${label}: GPU sample count differs from resolved count`, issues);
  check(new Set(frames).size === frames.length, `${label}: duplicate GPU frame IDs`, issues);
  check(samples.every((sample, index) => object(sample) && Number.isInteger(sample.frame)
    && sample.frame >= timing.firstFrame && sample.frame < timing.firstFrame + timing.requested
    && (!index || sample.frame > samples[index - 1].frame) && finite(sample.ms) && sample.ms >= 0),
  `${label}: GPU samples must be finite, ordered and inside the measured frame interval`, issues);
  const coverage = timing.requested > 0 ? samples.length / timing.requested : 0;
  check(finite(timing.coverage) && Math.abs(timing.coverage - coverage) <= 1e-12, `${label}: GPU coverage does not equal unique samples / requested`, issues);
  if (!timing.supported) {
    check(!samples.length && timing.issued === 0, `${label}: unsupported GPU timer contains issued/resolved queries`, issues);
    limits.push(`${label}: GPU timer unavailable on this device.`);
    return {status:issues.length === start ? 'UNAVAILABLE' : 'FAIL', coverage, samples:samples.length};
  }
  check(timing.issued === timing.requested, `${label}: not all requested GPU queries were issued`, issues);
  check(timing.skipped === 0 && timing.disjoint === 0 && timing.lost === 0, `${label}: skipped, disjoint or lost GPU queries`, issues);
  check(timing.resolved + timing.pending === timing.issued, `${label}: GPU resolved + pending differs from issued`, issues);
  check(samples.length > 0, `${label}: no resolved GPU samples`, issues);
  const recomputed = distribution(samples.map(sample => sample?.ms));
  check(same(cost.gpuUniqueMs, recomputed), `${label}: gpuUniqueMs differs from independent unique-sample recomputation`, issues);
  if (timing.pending > 0) limits.push(`${label}: ${timing.pending} GPU queries were still pending at receipt completion.`);
  return {status:issues.length === start ? 'PASS' : 'FAIL', coverage, samples:samples.length, pending:timing.pending,
    epoch:timing.epoch, firstFrame:timing.firstFrame, recomputed};
}

function delta(value, reference) {
  if (!finite(value) || !finite(reference)) return null;
  return {ms:value - reference, percent:reference === 0 ? null : (value - reference) / reference * 100};
}

function performanceFacts(runs, gpu) {
  const metrics = {frameMs:run => run.cost?.frameMs, stepCpuMs:run => run.simulationMs,
    submitCpuMs:run => run.cost?.submitMs, uniqueGpuMs:(_run, index) => gpu[index]?.recomputed};
  return {judgment:'MEASURED; no numeric performance pass or causal speedup is asserted',
    arms:runs.map((run, index) => ({label:run.label, frameMs:run.cost?.frameMs, stepCpuMs:run.simulationMs,
      submitCpuMs:run.cost?.submitMs, uniqueGpuMs:gpu[index]?.recomputed ?? null,
      gpuCoverage:gpu[index]?.coverage ?? null, gpuSamples:gpu[index]?.samples ?? 0,
      calls:run.cost?.calls, triangles:run.cost?.triangles, geometries:run.cost?.geometries,
      textures:run.cost?.textures, peaks:run.peaks})),
    comparisons:Object.fromEntries(Object.entries(metrics).map(([name, select]) => {
      const values = runs.map(select);
      const compare = (left, right) => Object.fromEntries(['median','p95','max'].map(key => [key, delta(values[left]?.[key], values[right]?.[key])]));
      return [name, {baselineBracketDrift:compare(3, 0), currentRepeatDrift:compare(2, 1),
        currentVersusBefore:compare(1, 0), currentVersusBeforeRepeat:compare(1, 3),
        currentRepeatVersusBefore:compare(2, 0), currentRepeatVersusBeforeRepeat:compare(2, 3),
        bothCurrentArmsAboveBothBaselines:Object.fromEntries(['median','p95','max'].map(key => [key,
          values.every(value => finite(value?.[key])) ? Math.min(values[1][key], values[2][key]) > Math.max(values[0][key], values[3][key]) : null]))}];
    }))};
}

export function validateReceipt(data, config, baselineModules = DEFAULT_BASELINE_MODULES) {
  const issues = [], compatibilityIssues = [], limits = [];
  const expectedBaseline = [...baselineModules].sort(), expectedCurrent = [...baselineModules, 'adhesive'].sort();
  check(object(data), 'Receipt must be an object', issues);
  check(Array.isArray(data?.errors) && data.errors.length === 0, 'Receipt errors must be an empty array', issues);
  check(Array.isArray(data?.performance) && data.performance.length === 1, 'Expected exactly one performance comparison', issues);
  const scene = data?.performance?.[0] ?? {}, protocol = scene.protocol ?? {}, runs = array(scene.runs);
  check(scene.scene === config.scene, `Expected ${config.scene} scene`, issues);
  check(same(runs.map(run => run?.label), ARMS), `Arm order must be ${ARMS.join(', ')}`, issues);
  for (const [key, expected] of Object.entries({warmup:120, frames:720, sound:true, recording:false, visibility:'visible'}))
    check(protocol[key] === expected, `Protocol ${key} must equal ${JSON.stringify(expected)}`, issues);
  check(protocol.step === 1 / 60, 'Protocol simulation step must be 1/60', issues);
  check(typeof protocol.comparison === 'string' && /production registry/i.test(protocol.comparison)
    && /without adhesive/i.test(protocol.comparison) && /ABBA/.test(protocol.comparison), 'Comparison must identify the production-registry Adhesive ABBA comparator', issues);
  const gpu = [], hitCounts = [], moduleNames = [];
  for (const [index, run] of runs.entries()) {
    const label = ARMS[index] ?? `arm-${index}`, cost = run?.cost ?? {}, snapshot = run?.snapshot ?? {};
    check(cost.label === run.label, `${label}: cost label differs from arm label`, issues);
    check(cost.frames === 720 && same(cost.viewport, [1440,900]) && cost.dpr === 1, `${label}: expected 720 samples at 1440x900 DPR1`, issues);
    for (const [name, value] of Object.entries({frameMs:cost.frameMs, submitMs:cost.submitMs, calls:cost.calls, triangles:cost.triangles, stepCpuMs:run.simulationMs}))
      validateDistribution(value, `${label}/${name}`, issues);
    check(count(cost.geometries) && count(cost.textures), `${label}: invalid resource counts`, issues);
    gpu.push(validateGpu(cost, label, issues, limits));
    check(snapshot.screen === 'none' && snapshot.mode === config.mode, `${label}: expected active ${config.mode} gameplay`, compatibilityIssues);
    for (const key of COMBAT_KEYS) check(Object.hasOwn(snapshot, key), `${label}: missing combat field ${key}`, compatibilityIssues);
    check(finite(snapshot.time) && count(snapshot.kills) && object(snapshot.loot) && object(snapshot.body), `${label}: invalid combat state`, compatibilityIssues);
    check(Array.isArray(snapshot.targets) && snapshot.targets.length === 6, `${label}: expected six targets`, compatibilityIssues);
    for (const key of ['shots','hits','contacts']) check(Array.isArray(snapshot[key]) && snapshot[key].length > 0, `${label}: ${key} evidence is missing/empty`, compatibilityIssues);
    check(array(snapshot.shots).every((shot, at) => shot?.mode === config.mode && shot.sequence === at + 1
      && finite(shot.at) && xyz(shot.origin) && xyz(shot.direction) && xyz(shot.aimPoint)
      && shot.spec?.projectile === config.projectile && shot.spec?.element === config.element && shot.spec?.secondaryElement === config.secondary),
    `${label}: shot sequence, trajectory or primary/secondary configuration differs from ${config.name}`, compatibilityIssues);
    check(array(snapshot.hits).every(hit => Number.isInteger(hit?.target) && hit.target >= 0 && hit.target < 6
      && finite(hit.at) && finite(hit.damage) && hit.damage > 0 && vector(hit.point) && vector(hit.direction)),
    `${label}: invalid raw hit evidence`, compatibilityIssues);
    check(array(snapshot.contacts).every(contact => ['contact','detonate'].includes(contact?.phase)
      && finite(contact.at) && vector(contact.point) && vector(contact.normal) && Number.isInteger(contact.target) && contact.target >= -1 && contact.target < 6),
    `${label}: invalid raw contact evidence`, compatibilityIssues);
    const recipients = new Set(array(snapshot.hits).map(hit => hit?.target).filter(target => Number.isInteger(target) && target >= 0));
    hitCounts.push(recipients.size);
    check(recipients.size >= config.targets, `${label}: expected at least ${config.targets} distinct recipients`, compatibilityIssues);
    const presentation = snapshot.presentation ?? {}, diagnostics = snapshot.diagnostics ?? {};
    check(presentation.mode === 'quality' && presentation.soundEnabled === true && presentation.qualityAudioUnlocked === true
      && presentation.elementalAudioUnlocked === true && presentation.audioError === null, `${label}: expected enabled/unlocked real sound buses and quality mode`, issues);
    check(object(diagnostics.corrosive), `${label}: built-in corrosive renderer missing`, compatibilityIssues);
    const names = sortedKeys(diagnostics.modules); moduleNames.push(names);
    check(same(names, label.startsWith('current') ? expectedCurrent : expectedBaseline), `${label}: module inventory differs from the explicit baseline profile`, compatibilityIssues);
    check(names.includes('adhesive') === label.startsWith('current'), `${label}: Adhesive registration does not match comparator arm`, compatibilityIssues);
    check(same(names, sortedKeys(presentation.modules)), `${label}: presentation module diagnostics disagree`, compatibilityIssues);
    check(object(run.peaks) && Object.values(run.peaks).every(value => count(value)), `${label}: invalid peak counters`, issues);
    check(run.peaks?.physicalVoices > 0 && run.peaks?.elementalVoices > 0, `${label}: no physical/elemental voice activity was observed`, issues);
    if (index && count(gpu[index]?.epoch) && count(gpu[index - 1]?.epoch))
      check(gpu[index].epoch > gpu[index - 1].epoch && gpu[index].firstFrame >= gpu[index - 1].firstFrame + 720, `${label}: GPU intervals overlap or epochs did not advance`, issues);
  }
  if (runs.length === 4) {
    check(same(moduleNames[0], moduleNames[3]) && same(moduleNames[1], moduleNames[2])
      && same(moduleNames[1].filter(element => element !== 'adhesive'), moduleNames[0]), 'Comparator changed a sibling registration', compatibilityIssues);
    const baseline = pickCombat(runs[0].snapshot);
    for (let index = 1; index < runs.length; index++) {
      const candidate = pickCombat(runs[index].snapshot);
      check(same(candidate, baseline), `${ARMS[index]}: raw combat differs at ${firstDifference(baseline, candidate)}`, compatibilityIssues);
    }
    check(scene.combatEqual === true, 'Stored combatEqual must report true', compatibilityIssues);
    for (const [key, flag] of [['events','cosmeticEqual'], ['stainEvents','stainsEqual']]) {
      const left = runs[1].snapshot?.[key], right = runs[2].snapshot?.[key];
      check(Array.isArray(left) && left.length > 0 && Array.isArray(right) && right.length > 0, `Current ${key} evidence is missing/empty`, compatibilityIssues);
      check(same(left, right), `Current/current-repeat ${key} differ at ${firstDifference(left, right)}`, compatibilityIssues);
      check(scene[flag] === true, `Stored ${flag} must report true`, compatibilityIssues);
    }
    check(scene.targetsHit === hitCounts[1], 'Stored targetsHit differs from unique current-arm hit recipients', compatibilityIssues);
  }
  limits.push('Warmup count is declared by the protocol; separate warmup/step-CPU raw sample counts are not retained.',
    'Visibility is captured only at comparison completion; this receipt alone cannot establish continuous visibility.',
    'Sound preference, unlocked buses and peak voices are observed; recording:false is a protocol declaration without a recorder-state trace.',
    'Step CPU measures scripted aiming plus Game.stepEvaluation; it excludes other outer-frame UI and render work.',
    'These fixed-step, raised-health fixture timings are not a native full-AI encounter or a hardware/controller playtest.',
    'CPU submission, simulation and GPU costs overlap and must not be summed; shared-host timing changes do not establish causal speedup.');
  return {scene:config.name, compatibility:compatibilityIssues.length ? 'FAIL' : 'PASS',
    receiptValidation:issues.length || compatibilityIssues.length ? 'FAIL' : 'PASS',
    issues:[...issues, ...compatibilityIssues], observed:{armLabels:runs.map(run => run?.label), protocol,
      targetsHitByArm:hitCounts, modulesByArm:moduleNames,
      shotCounts:runs.map(run => array(run?.snapshot?.shots).length), hitCounts:runs.map(run => array(run?.snapshot?.hits).length),
      contactCounts:runs.map(run => array(run?.snapshot?.contacts).length),
      cosmeticCounts:runs.map(run => array(run?.snapshot?.events).length), stainCounts:runs.map(run => array(run?.snapshot?.stainEvents).length)},
    gpu, performance:runs.length === 4 ? performanceFacts(runs, gpu) : null, telemetryLimits:limits};
}

/** Validate the serialized fullEncounter.ts contract without trusting its summary counters. */
export function validateEncounter(data, baselineModules = DEFAULT_BASELINE_MODULES) {
  const issues = [], limits = [], relays = ['vault-relay-a','vault-relay-b'];
  const phases = ['infiltration','defenses','boarding','battle','boss','loot','complete'];
  const initial = data?.initial ?? {}, first = data?.first ?? {}, final = first.final ?? {};
  const replay = data?.replay ?? {}, replayFinal = replay.final ?? {}, audit = data?.rewardAudit ?? {};
  const events = array(data?.events), shots = array(data?.shots), measurements = array(data?.measurements), samples = array(data?.samples);
  check(data?.protocol === 'adhesive-full-encounter-v1' && data?.policy === 'scripted-route-v1'
    && data?.step === 1 / 60 && data?.seed === 37391, 'Encounter protocol, policy, step or seed differs from the current full-route contract', issues);
  check(typeof data?.clock === 'string' && /no Game.run double-step/.test(data.clock), 'Encounter clock declaration is missing', issues);
  check(Array.isArray(data?.errors) && data.errors.length === 0, 'Encounter errors must be an empty array', issues);
  for (const key of ['events','measurements','shots','inputs']) check(Array.isArray(data?.[key]) && data[key].length > 0, `Encounter ${key} evidence is missing/empty`, issues);
  check(initial.time === 0 && initial.run === 0 && initial.phase === 'idle' && initial.mode === 'pilot'
    && initial.kills === 0 && initial.remainingEnemies === 0 && same(initial.disabledRelays, []), 'Initial Game is not fresh time0/run0 with clear transient encounter state', issues);
  check(initial.progression?.kills === 0, 'Initial progression contains prior kills', issues);

  const kit = data?.kit ?? {}, modes = ['pilot','mech'], slots = ['weapon','shield','reactor','legs'];
  for (const mode of modes) {
    const config = kit.configs?.[mode] ?? {}, expected = {target:mode,brand:'kestrel',weaponType:'sniper',
      projectile:mode === 'pilot' ? 'bullet' : 'slug',element:'adhesive',secondaryElement:'none',
      trail:'tracer',visualVariant:0,affix:'compact',level:5,rarity:'rare',guaranteedStatus:false};
    check(same(config, expected), `${mode}: kit differs from the configured level5 rare mobile-precision Adhesive build`, issues);
    const code = ['WS1',mode,'kestrel','sniper',expected.projectile,'adhesive','none','tracer',0,'compact',5,'rare','rolled'].join(':');
    check(kit.codes?.[mode] === code, `${mode}: workbench code disagrees with configured kit`, issues);
    const equipment = array(kit.equipment?.[mode]), inventory = array(initial.progression?.inventory);
    check(equipment.length === 4 && same(equipment.map(item => item?.slot).sort(), [...slots].sort()), `${mode}: expected four real equipment slots`, issues);
    for (const item of equipment) {
      check(item?.target === mode && item.level === 5 && initial.progression?.loadouts?.[mode]?.[item.slot] === item.id
        && same(inventory.find(entry => entry.id === item.id), item), `${mode}: initial equipped item disagrees with serialized kit`, issues);
      if (item?.slot === 'weapon') check(item.rarity === 'rare' && item.brand === 'kestrel' && item.weapon?.element === 'adhesive'
        && item.weapon?.projectile === expected.projectile && item.weapon?.statusChance === .35 && item.weapon?.secondaryElement === undefined,
      `${mode}: weapon/proc settings differ from the normal configured item`, issues);
    }
    check(object(kit.stats?.[mode]) && Object.values(kit.stats[mode]).every(finite), `${mode}: invalid configured derived stats`, issues);
  }
  const pilotStats = kit.stats?.pilot ?? {}, body = initial.body ?? {};
  check(body.health === pilotStats.maxHealth && body.shield === pilotStats.maxShield && body.ammo === pilotStats.magazine
    && body.reserve === Math.max(240, Math.max(1, Math.floor(pilotStats.magazine)) * 8)
    && body.heat === 0 && body.overheated === false, 'Initial body does not have normal full health/shield/magazine/reserve/heat', issues);

  check(events.every((event, index) => object(event) && finite(event.observedTime) && event.observedTime >= 0
    && (!index || event.observedTime >= events[index - 1].observedTime)), 'Raw encounter events lack ordered simulation timestamps', issues);
  const run = final.run;
  check(run === initial.run + 1 && first.stage === 'first', 'First run number/stage is invalid', issues);
  const start = events.findIndex(event => event?.type === 'encounter-phase' && event.run === run && event.phase === 'infiltration');
  let end = start < 0 ? 0 : events.findIndex((event, index) => index > start && event?.type === 'encounter-phase' && event.run !== run);
  if (end < 0) end = events.length;
  const firstEvents = start < 0 ? [] : events.slice(start, end), phaseEvents = firstEvents.filter(event => event.type === 'encounter-phase');
  const kills = firstEvents.filter(event => event.type === 'enemy-killed'), killIds = kills.map(event => event.id);
  const relayEvents = firstEvents.filter(event => event.type === 'defense-disabled'), relayIds = relayEvents.map(event => event.id);
  const rewards = firstEvents.filter(event => event.type === 'reward-collected');
  check(start >= 0 && same(phaseEvents.map(event => event.phase), phases) && phaseEvents.every(event => event.run === run), 'Raw first-run phase flow is incomplete/out of order', issues);
  check(final.phase === 'complete' && final.kills === 24 && final.remainingEnemies === 0 && same(final.enemies, [])
    && same([...array(final.disabledRelays)].sort(), relays), 'First final snapshot lacks complete/24 kills/0 enemies/both actual relays', issues);
  check(kills.length === 24 && new Set(killIds).size === 24 && kills.every(event => Number.isInteger(event.id)
    && event.id > 0 && ['rusher','flanker','heavy'].includes(event.role) && typeof event.boss === 'boolean'), 'Raw first-run kill events do not contain exactly24 distinct valid enemy IDs', issues);
  check(kills.filter(event => event.boss === true && event.role === 'heavy').length === 1, 'Raw first-run events do not prove one defeated heavy mini-boss', issues);
  check(same(first.distinctKillIds, [...new Set(killIds)]) && first.bossKilled === true, 'First summary kill/boss counters disagree with raw events', issues);
  check(relayIds.length === 2 && same([...relayIds].sort(), relays) && same(first.relayIds, relayIds), 'Raw first-run relay receipts are missing/duplicated or disagree with summary', issues);
  check(same(first.phases, phaseEvents), 'First phase summary disagrees with raw phase events', issues);
  const firstShots = shots.filter(shot => finite(shot?.at) && shot.at >= (phaseEvents[0]?.observedTime ?? Infinity) && shot.at <= final.time);
  check(firstShots.some(shot => shot.mode === 'pilot') && firstShots.some(shot => shot.mode === 'mech'), 'First run lacks actual pilot and mech shots', issues);
  check(first.shotCount === firstShots.length && same(first.shotModes, [...new Set(firstShots.map(shot => shot.mode))]), 'First shot summary disagrees with actual shot log', issues);
  check(firstShots.every(shot => xyz(shot.origin) && xyz(shot.direction) && xyz(shot.aimPoint) && shot.spec?.element === 'adhesive'
    && shot.spec?.projectile === (shot.mode === 'pilot' ? 'bullet' : 'slug')), 'First run shot origins/specifications do not match the normal configured weapons', issues);
  const firstMeasurements = measurements.filter(event => finite(event?.at) && event.at >= (phaseEvents[0]?.observedTime ?? Infinity) && event.at <= final.time);
  const measuredKills = firstMeasurements.filter(event => event.type === 'target-killed').map(event => event.targetId).sort();
  check(same(measuredKills, killIds.map(String).sort()), 'Applied kill measurement IDs disagree with raw first-run enemy-killed events', issues);
  check(firstMeasurements.filter(event => event.type === 'finish' && event.outcome === 'complete').length === 1
    && !firstMeasurements.some(event => event.type === 'finish' && ['failed','aborted','timeout'].includes(event.outcome)), 'First-run measurements do not prove a successful un-aborted completion', issues);

  const item = audit.item, rewardId = rewards[0]?.itemId;
  check(rewards.length === 1 && typeof rewardId === 'string' && rewardId.length > 0 && same(first.reward, rewards[0]), 'Actual first-run reward-collected receipt is missing/ambiguous', issues);
  check(object(item) && item.id === rewardId && item.target === 'mech' && item.slot === 'reactor'
    && same(array(final.progression?.inventory).find(entry => entry.id === rewardId), item), 'Reward audit item does not match the actually collected first-run inventory item', issues);
  check(audit.inventoryContains === true && audit.equipped === true, 'Reward audit does not report collected and equipped salvage', issues);
  const prior = audit.priorItem, expectedPriorId = initial.progression?.loadouts?.mech?.reactor;
  check(prior?.id === expectedPriorId && same(prior, array(initial.progression?.inventory).find(entry => entry.id === expectedPriorId)), 'Reward priorItem does not match the initial reactor', issues);
  check(same(audit.beforeStats, kit.stats), 'Reward beforeStats differs from the configured initial derived stats', issues);
  const practicalDeltas = {};
  for (const mode of modes) {
    const before = audit.beforeStats?.[mode], after = audit.afterStats?.[mode];
    check(object(before) && object(after) && same(sortedKeys(before), sortedKeys(after))
      && Object.values(before ?? {}).every(finite) && Object.values(after ?? {}).every(finite), `${mode}: invalid before/after reward stats`, issues);
    for (const key of Object.keys(before ?? {})) {
      const expected = before[key] + (mode === item?.target ? (item?.stats?.[key] ?? 0) - (prior?.stats?.[key] ?? 0) : 0);
      check(finite(after?.[key]) && Math.abs(after[key] - expected) <= 1e-8, `${mode}/${key}: reward stat delta disagrees with the real module swap`, issues);
    }
  }
  for (const key of ['cooling','heatCapacity']) practicalDeltas[key] = finite(audit.afterStats?.mech?.[key]) && finite(audit.beforeStats?.mech?.[key]) ? audit.afterStats.mech[key] - audit.beforeStats.mech[key] : null;
  check(Object.values(practicalDeltas).some(value => finite(value) && value > 1e-8), 'Reward does not improve practical cooling or heat capacity', issues);
  const replayProgression = replayFinal.progression;
  check(replayFinal.run === run + 1 && replay.stage === 'replay' && replayFinal.mode === 'mech'
    && ['battle','boss'].includes(replayFinal.phase) && same([...array(replayFinal.disabledRelays)].sort(), relays), 'Replay final snapshot lacks next run/mech combat/two newly cleared defenses', issues);
  check(replayProgression?.loadouts?.mech?.reactor === rewardId
    && same(array(replayProgression?.inventory).find(entry => entry.id === rewardId), item), 'Replay final inventory/loadout does not prove the collected reward is equipped', issues);
  for (const mode of modes) for (const slot of slots) if (!(mode === 'mech' && slot === 'reactor'))
    check(replayProgression?.loadouts?.[mode]?.[slot] === initial.progression?.loadouts?.[mode]?.[slot], `${mode}/${slot}: replay changed an unrelated equipment slot`, issues);
  const auditLoadouts = audit.loadouts ?? audit.progression?.loadouts;
  if (auditLoadouts) check(auditLoadouts.mech?.reactor === rewardId, 'Recorded audit-time loadout does not equip the reward', issues);
  else limits.push('Reward audit exports no audit-time loadout snapshot; equipped:true is corroborated later by replay.final.progression, not by a contemporaneous equip snapshot or DOM-action trace.');
  const replayStart = events.findIndex(event => event?.type === 'encounter-phase' && event.run === replayFinal.run && event.phase === 'infiltration');
  const replayEvents = replayStart < 0 ? [] : events.slice(replayStart).filter(event => event.observedTime <= replayFinal.time);
  const replayRelays = replayEvents.filter(event => event.type === 'defense-disabled').map(event => event.id);
  check(replayStart >= 0 && same(replayRelays.sort(), relays), 'Replay does not contain two new authoritative relay-disable events', issues);
  const mechShot = replay.mechShot;
  check(object(mechShot) && mechShot.mode === 'mech' && finite(mechShot.at) && mechShot.at > final.time
    && mechShot.at <= replayFinal.time && xyz(mechShot.origin) && xyz(mechShot.direction) && xyz(mechShot.aimPoint)
    && shots.some(shot => same(shot, mechShot)), 'Replay mechShot is not a real later mech shot in the raw log', issues);
  const phasesBeforeShot = replayEvents.filter(event => event.type === 'encounter-phase' && event.observedTime <= (mechShot?.at ?? -Infinity));
  check(['battle','boss'].includes(phasesBeforeShot.at(-1)?.phase), 'Replay mech shot did not occur in an authored mech combat phase', issues);
  const replayStartSamples = samples.filter(sample => sample?.stage === 'replay' && sample.run === replayFinal.run && sample.phase === 'infiltration');
  if (replayStartSamples.length) check(replayStartSamples.every(sample => same(sample.disabledRelays, [])), 'Sampled replay-start defenses were not reset', issues);
  else limits.push('No replay-start defense snapshot was sampled; two new relay-disable events are present only if the replay event checks pass.');
  const audioSamples = samples.filter(sample => object(sample?.audio)), visible = samples.filter(sample => sample?.visibility === 'visible');
  const completeAudioSamples = audioSamples.filter(sample => sample.audio.soundEnabled === true && sample.audio.qualityAudioUnlocked === true
    && sample.audio.elementalAudioUnlocked === true && sample.audio.audioError === null);
  const unhealthyAudio = audioSamples.filter(sample => sample.audio.soundEnabled === false || sample.audio.qualityAudioUnlocked === false
    || sample.audio.elementalAudioUnlocked === false || sample.audio.audioError != null);
  check(unhealthyAudio.length === 0, 'Recorded encounter samples contain muted/locked/failed audio buses', issues);
  const production = data?.production ?? {};
  check(production.mode === 'quality' && same(sortedKeys(production.modules), [...baselineModules,'adhesive'].sort()), 'Encounter production module inventory differs from the explicit registry profile', issues);
  limits.push('Audio/visibility/capturing are periodic and phase-change samples, not continuous instrumentation or decoded audio/video proof.',
    'Clock and no-private-override statements remain harness declarations; the JSON alone cannot prove unmodified AI/stats/source or hardware/controller input.',
    'The encounter file has its own hash; the benchmark session manifest is not assumed to bind this separate encounter/runtime build.',
    'Elapsed simulation time is reported as observed; no frame-performance or 3–5-minute pacing pass is implied.');
  if (!audioSamples.length) limits.push('No per-sample audio diagnostics were retained.');
  if (!samples.length) limits.push('No periodic encounter samples were retained.');
  return {status:issues.length ? 'FAIL' : 'PASS', issues, observed:{protocol:data?.protocol, policy:data?.policy, seed:data?.seed, step:data?.step,
    first:{run, phase:final.phase, elapsed:final.elapsed, time:final.time, kills:killIds.length, distinctKillIds:[...new Set(killIds)],
      bossKills:kills.filter(event => event.boss).length, relays:relayIds, phases:phaseEvents.map(event => event.phase),
      pilotShots:firstShots.filter(shot => shot.mode === 'pilot').length, mechShots:firstShots.filter(shot => shot.mode === 'mech').length},
    reward:{itemId:rewardId, inventoryContains:audit.inventoryContains, equipped:audit.equipped, practicalDeltas,
      auditLoadoutRecorded:Boolean(auditLoadouts), replayLoadoutItemId:replayProgression?.loadouts?.mech?.reactor},
    replay:{run:replayFinal.run, phase:replayFinal.phase, relays:replayRelays, mechShotAt:mechShot?.at, mode:mechShot?.mode},
    telemetry:{samples:samples.length, audioSamples:audioSamples.length, unhealthyAudioSamples:unhealthyAudio.length,
      completeHealthyAudioSamples:completeAudioSamples.length,
      visibleSamples:visible.length, visibilityStates:[...new Set(samples.map(sample => sample?.visibility).filter(value => value !== undefined))],
      capturingSamples:samples.filter(sample => sample?.capturing === true).length, recordVideo:data?.recordVideo,
      visibilityAtPublication:data?.visibilityAtPublication}}, telemetryLimits:limits};
}

async function jsonFile(path) {const bytes = await readFile(path); return {path, sha256:hash(bytes), value:JSON.parse(bytes.toString('utf8'))};}

async function sourceBinding(input, manifestPath, receipts, baselineModules) {
  const issues = [], limits = []; let manifest, provenance, hardware;
  if (manifestPath) {
    try {manifest = await jsonFile(manifestPath);} catch (error) {issues.push(`Cannot read session manifest: ${error.message}`);}
  }
  const declaration = manifest?.value;
  const provenanceFile = declaration?.provenance?.file ?? 'build/provenance.json';
  try {provenance = await jsonFile(resolve(input, provenanceFile));}
  catch (error) {limits.push(`Frozen provenance unavailable: ${error.message}`);}
  try {
    hardware = await jsonFile(resolve(input, 'hardware.json'));
    check(typeof hardware.value.renderer === 'string' && typeof hardware.value.userAgent === 'string', 'Hardware receipt is missing renderer/browser identity', issues);
    check(same(hardware.value.viewport, [1440,900]) && hardware.value.dpr === 1, 'Hardware receipt dimensions differ from measured protocol', issues);
    check(hardware.value.usesProductionRegistry === true
      && same([...array(hardware.value.initialModuleNames)].sort(), [...baselineModules, 'adhesive'].sort()), 'Hardware receipt module inventory differs from the explicit baseline profile', issues);
  } catch (error) {limits.push(`Hardware receipt unavailable: ${error.message}`);}
  let productionSubset;
  if (provenance) {
    const sources = provenance.value?.sources;
    check(object(sources) && Object.keys(sources).length > 0 && Object.values(sources).every(value => typeof value === 'string' && HASH.test(value)), 'Invalid provenance source hashes', issues);
    if (object(sources)) {
      for (const file of ['src/game.ts','src/world.ts','src/ui.ts','src/core/arsenal.ts','src/core/statusEffects.ts',
        'src/core/workbench.ts','src/encounter/encounter.ts','src/rendering/PlayerBallistics.ts',
        'src/rendering/quality/gameElements.ts','src/rendering/quality/shared/composedPresentation.ts',
        'src/rendering/quality/adhesive/module.ts','src/audio/elementalAudio.ts','src/audio/adhesiveAudio.ts'])
        check(Object.hasOwn(sources, file), `Provenance omits production source: ${file}`, issues);
      const entries = Object.entries(sources).filter(([file]) => !file.startsWith('src/dev/') && file !== 'src/main.ts').sort(([a], [b]) => a.localeCompare(b));
      productionSubset = {files:entries.length, sha256:hash(JSON.stringify(entries)),
        rule:'Sorted [path,hash] entries excluding src/dev/** and src/main.ts; compare main-entry changes separately.'};
    }
  }
  const bindings = [];
  if (declaration) {
    check(declaration.schema === 1, 'Session manifest schema must be 1', issues);
    try {const url = new URL(declaration.pageUrl); check(['http:','https:'].includes(url.protocol), 'Manifest pageUrl must be HTTP(S)', issues);}
    catch {issues.push('Manifest pageUrl is missing/invalid');}
    check(object(declaration.receipts), 'Manifest receipts must map filenames to SHA256 hashes', issues);
    for (const receipt of receipts) {
      const expected = declaration.receipts?.[receipt.file];
      const match = typeof expected === 'string' && HASH.test(expected) && expected.toLowerCase() === receipt.sha256;
      check(match, `Missing/mismatched manifest receipt hash: ${receipt.file}`, issues);
      bindings.push({file:receipt.file, sha256:receipt.sha256, matchesManifest:match});
    }
    check(provenance && typeof declaration.provenance?.sha256 === 'string'
      && declaration.provenance.sha256.toLowerCase() === provenance.sha256, 'Manifest provenance hash is missing/mismatched', issues);
    check(Array.isArray(declaration.assets) && declaration.assets.length > 0, 'Manifest needs emitted assets [{file,sha256}]', issues);
    for (const entry of array(declaration.assets)) {
      try {
        const bytes = await readFile(resolve(input, entry.file)), actual = hash(bytes);
        check(typeof entry.sha256 === 'string' && HASH.test(entry.sha256) && entry.sha256.toLowerCase() === actual, `Asset hash mismatch: ${entry.file}`, issues);
        bindings.push({file:entry.file, sha256:actual, matchesManifest:entry.sha256?.toLowerCase() === actual});
      } catch (error) {issues.push(`Cannot verify manifest asset: ${error.message}`);}
    }
    limits.push('The manifest binds recorded files by hash; it is an operator-provided session receipt, not independent proof of page execution.',
      'Optional session telemetry is retained as supplied; this checker does not infer continuous monitoring from an unknown telemetry schema.');
  } else limits.push('No session manifest supplied: results are not directly bound to a visited URL, frozen provenance or emitted asset set.');
  return {status:issues.length ? 'FAIL' : declaration ? 'HASHES MATCH' : 'NOT PROVIDED', issues, limits,
    sessionManifest:manifest ? {path:manifest.path, sha256:manifest.sha256, pageUrl:declaration?.pageUrl, telemetry:declaration?.telemetry ?? null} : null,
    provenance:provenance ? {path:provenance.path, sha256:provenance.sha256, builtAt:provenance.value.builtAt,
      head:provenance.value.head, sourceCount:Object.keys(provenance.value.sources ?? {}).length, productionSubset} : null,
    hardware:hardware ? {path:hardware.path, sha256:hardware.sha256, ...hardware.value} : null, bindings};
}

function usage() {
  return `Usage: node scripts/verify-adhesive-integration.mjs INPUT_DIR --out NEW_REPORT.json [--session-manifest MANIFEST.json] [--baseline-modules fire,radiation,shock] [--encounter FULL_ENCOUNTER.json]

Reads four performance-*.json receipts and optional build/provenance.json. Never overwrites --out.
Default baseline: fire,radiation,shock. For the scoped HEAD registry use --baseline-modules radiation,shock.
Unknown/empty/duplicate modules and adhesive in the baseline are rejected; expected modules are never inferred from receipts.
Exit 0: receipt checks passed (missing binding/telemetry remains explicit); 1: failed checks; 2: invocation/output error.
No numeric performance pass or browser execution is implied.
Optional --encounter checks the fullEncounter.ts evidence export independently: fresh configured kit,
raw24 kills/relays/phases/shots, actual reward/equip/stat gain and later replay mech firing.
Audit-time loadouts and continuous telemetry are not invented when absent; replay-final loadouts must prove equip.
The encounter path is relative to the command's working directory, and gets its own SHA256.

Optional manifest, all file paths relative to INPUT_DIR:
{"schema":1,"pageUrl":"http://127.0.0.1:5291/?verifyAdhesive=1",
 "provenance":{"file":"build/provenance.json","sha256":"..."},
 "receipts":{"performance-pilot-sticky.json":"...","performance-mech-sticky.json":"...",
             "performance-shock-secondary-rifle.json":"...","performance-radiation-primary-rifle.json":"..."},
 "assets":[{"file":"build/assets/index-EXAMPLE.js","sha256":"..."}],"telemetry":{}}
`;
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {console.log(usage()); return 0;}
  let input, out, manifestPath, encounterPath, baselineModules = [...DEFAULT_BASELINE_MODULES];
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--out' || argument === '--session-manifest' || argument === '--baseline-modules' || argument === '--encounter') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a path`);
      if (argument === '--out') out = resolve(value);
      else if (argument === '--session-manifest') manifestPath = resolve(value);
      else if (argument === '--encounter') encounterPath = resolve(value);
      else baselineModules = parseBaselineModules(value);
    } else if (!argument.startsWith('-') && !input) input = resolve(argument);
    else throw new Error(`Unknown/duplicate argument: ${argument}`);
  }
  if (!input || !out) throw new Error(usage());
  const receipts = [], scenes = [];
  for (const config of SCENES) {
    const file = `performance-${config.name}.json`;
    try {
      const receipt = await jsonFile(resolve(input, file)); receipts.push({file, sha256:receipt.sha256});
      scenes.push({...validateReceipt(receipt.value, config, baselineModules), file, sha256:receipt.sha256});
    } catch (error) {scenes.push({scene:config.name, file, compatibility:'FAIL', receiptValidation:'FAIL', issues:[error.message]});}
  }
  const binding = await sourceBinding(input, manifestPath, receipts, baselineModules);
  let encounter;
  if (encounterPath) {
    try {
      const receipt = await jsonFile(encounterPath);
      encounter = {...validateEncounter(receipt.value, baselineModules), path:encounterPath, sha256:receipt.sha256};
    } catch (error) {encounter = {status:'FAIL', path:encounterPath, issues:[error.message]};}
  }
  const receiptValidation = scenes.every(scene => scene.receiptValidation === 'PASS') && binding.status !== 'FAIL'
    && encounter?.status !== 'FAIL' ? 'PASS' : 'FAIL';
  const report = {schema:1, checkedAt:new Date().toISOString(), inputDirectory:input, receiptValidation,
    expectedProfile:{baselineModules, currentModules:[...baselineModules, 'adhesive']},
    compatibility:scenes.every(scene => scene.compatibility === 'PASS') ? 'PASS' : 'FAIL',
    performanceJudgment:'FACTS ONLY; no numeric performance acceptance threshold or causal attribution is invented',
    sourceBinding:binding, scenes, encounterValidation:encounter?.status ?? 'NOT REQUESTED', encounter:encounter ?? null};
  await mkdir(dirname(out), {recursive:true});
  await writeFile(out, JSON.stringify(report, null, 2) + '\n', {flag:'wx'});
  const number = value => finite(value) ? value.toFixed(3) : 'n/a';
  console.log(`Receipt checks ${receiptValidation}; compatibility ${report.compatibility}; source binding ${binding.status}`);
  for (const scene of scenes) {
    console.log(`${scene.scene}: ${scene.receiptValidation}; ${scene.issues.length} issue(s)`);
    for (const arm of scene.performance?.arms ?? []) console.log(`  ${arm.label}: frame ${number(arm.frameMs?.median)}/${number(arm.frameMs?.p95)}/${number(arm.frameMs?.max)} ms; step ${number(arm.stepCpuMs?.median)}/${number(arm.stepCpuMs?.p95)}/${number(arm.stepCpuMs?.max)}; submit ${number(arm.submitCpuMs?.median)}/${number(arm.submitCpuMs?.p95)}/${number(arm.submitCpuMs?.max)}; GPU ${number(arm.uniqueGpuMs?.median)}/${number(arm.uniqueGpuMs?.p95)}/${number(arm.uniqueGpuMs?.max)}; coverage ${number(arm.gpuCoverage === null ? null : arm.gpuCoverage * 100)}%`);
    for (const issue of scene.issues) console.log(`  FAIL: ${issue}`);
  }
  for (const issue of binding.issues) console.log(`Binding FAIL: ${issue}`);
  if (encounter) {
    console.log(`Encounter ${encounter.status}; ${encounter.issues.length} issue(s)`);
    for (const issue of encounter.issues) console.log(`Encounter FAIL: ${issue}`);
  }
  console.log(`Report: ${out}`);
  return receiptValidation === 'PASS' ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {process.exitCode = await main();}
  catch (error) {console.error(error.message); process.exitCode = 2;}
}
