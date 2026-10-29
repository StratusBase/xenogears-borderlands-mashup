import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { clusterLiveClockIssue, clusterLiveJobs, clusterLiveSummary, validateClusterLiveEvidence, type ClusterLiveArm, type ClusterLiveEvidence } from '../src/diagnostics/clusterLive.ts';

const args = process.argv.slice(2), directory = resolve(args[0] && !args[0].startsWith('--') ? args.shift()! : 'artifacts/cluster-live');
let selectionPath: string | null = null, allowPartial = false;
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--allow-partial') { allowPartial = true; continue; }
  if (args[index] === '--selection' && args[index + 1]) { selectionPath = resolve(args[++index]); continue; }
  throw new Error('Usage: summarizeClusterLive.ts [directory] [--allow-partial] [--selection manifest.json]');
}
let selection: Set<string> | null = null;
if (selectionPath) {
  const manifest = JSON.parse(await readFile(selectionPath, 'utf8')) as { include?: unknown };
  if (!Array.isArray(manifest.include) || !manifest.include.every(path => typeof path === 'string')) throw new Error('Selection manifest must contain an include array of exact arm/raw/filename.json paths.');
  selection = new Set(manifest.include);
}
interface AttemptDisposition {
  filename: string; job: ClusterLiveEvidence['job']; outcome: string | null; sourceFingerprint: string;
  disposition: 'included' | 'excluded-technical-interruption' | 'excluded-by-explicit-selection' | 'ambiguous-valid-duplicate';
  reason: string; measuredSeconds: number; frameCount: number; expectedSeconds: number; paused: boolean;
}
const attempts: AttemptDisposition[] = [], selectedPaths = new Set<string>(), errors: string[] = [];
const arms = ['baseline', 'final'] as const;
const reports: { arm: ClusterLiveArm; runs: ReturnType<typeof clusterLiveSummary>[]; sourceFingerprint: string; complete: number; outcomes: Record<string, number>; completeMatrix: boolean; missingCells: string[] }[] = [];
for (const arm of arms) {
  const raw = resolve(directory, arm, 'raw'); let files: string[];
  try { files = (await readdir(raw)).filter(path => path.endsWith('.json')).sort(); } catch { continue; }
  const runs: ClusterLiveEvidence[] = [], keys = new Set<string>();
  for (const filename of files) {
    // Disposition audit may inspect a clock-invalid attempt while preserving all other strict replay checks.
    const evidence = validateClusterLiveEvidence(JSON.parse(await readFile(join(raw, filename), 'utf8')), { allowClockIssue: true });
    if (evidence.job.arm !== arm) throw new Error(`Arm differs from output path: ${filename}`);
    const path = `${arm}/raw/${filename}`, key = `${evidence.job.fixtureSource}/${evidence.job.delivery}/${evidence.job.payload}/${evidence.job.seed}`;
    const clockIssue = clusterLiveClockIssue(evidence);
    const technicalReason = clockIssue ?? (evidence.measurement.outcome === 'aborted' ? evidence.technicalInterruption?.reason : undefined);
    const disposition: AttemptDisposition = { filename: path, job: evidence.job, outcome: evidence.measurement.outcome, sourceFingerprint: evidence.sourceFingerprint,
      disposition: 'included', reason: 'Valid fixed60Hz attempt retained, including complete, failed and timeout outcomes.', measuredSeconds: evidence.measurement.duration,
      frameCount: evidence.frameCount, expectedSeconds: evidence.frameCount / 60, paused: evidence.encounter.paused };
    if (technicalReason) {
      disposition.disposition = 'excluded-technical-interruption'; disposition.reason = technicalReason; attempts.push(disposition);
      if (selection?.has(path)) errors.push(`Explicit selection cannot include technically interrupted attempt: ${path}`);
      continue;
    }
    if (selection && !selection.has(path)) {
      disposition.disposition = 'excluded-by-explicit-selection'; disposition.reason = `Exact attempt was not included by ${selectionPath}.`; attempts.push(disposition); continue;
    }
    selectedPaths.add(path);
    if (keys.has(key)) {
      disposition.disposition = 'ambiguous-valid-duplicate'; disposition.reason = 'More than one valid attempt exists for this cell. Provide an explicit selection manifest; no latest-attempt guessing.';
      attempts.push(disposition); errors.push(`${arm}/${key}: multiple valid attempts require --selection.`); continue;
    }
    attempts.push(disposition); keys.add(key); runs.push(evidence);
  }
  const expectedKeys = clusterLiveJobs(arm).map(job => `${job.fixtureSource}/${job.delivery}/${job.payload}/${job.seed}`);
  const missingCells = expectedKeys.filter(key => !keys.has(key));
  if (missingCells.length && !allowPartial) errors.push(`${arm}: expected all36 cells, found ${runs.length}; missing ${missingCells.join(', ')}.`);
  const fingerprints = new Set(runs.map(run => run.sourceFingerprint));
  if (fingerprints.size > 1) errors.push(`${arm}: source differs between included cells.`);
  const outcomes: Record<string, number> = {};
  for (const run of runs) outcomes[run.measurement.outcome!] = (outcomes[run.measurement.outcome!] ?? 0) + 1;
  if (runs.length) reports.push({ arm, runs: runs.map(clusterLiveSummary), sourceFingerprint: runs[0].sourceFingerprint, complete: outcomes.complete ?? 0, outcomes, completeMatrix: missingCells.length === 0, missingCells });
}
if (selection) for (const path of selection) if (!selectedPaths.has(path)) errors.push(`Selection path did not identify an included valid attempt: ${path}`);
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, 'attempt-dispositions.json'), `${JSON.stringify({ selectionPath, allowPartial, attempts, errors, rawFilesPreserved: true }, null, 2)}\n`);
if (errors.length) throw new Error(`Evidence selection is incomplete or ambiguous. See attempt-dispositions.json.\n${errors.join('\n')}`);
if (!reports.length) throw new Error('No preserved matrix found.');
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const groups = reports.flatMap(report => ['workbench', 'loot'].flatMap(fixtureSource => ['kinetic', 'corrosive-fire', 'ice'].flatMap(payload => ['cluster', 'rocket', 'scatter'].flatMap(delivery => {
  const runs = report.runs.filter(run => run.job.fixtureSource === fixtureSource && run.job.payload === payload && run.job.delivery === delivery);
  if (!runs.length) return [];
  return (['pilot', 'mech'] as const).map(mode => ({ arm: report.arm, fixtureSource, payload, delivery, mode, cells: runs.length, complete: runs.filter(run => run.outcome === 'complete').length,
    totalSeconds: mean(runs.map(run => run.seconds)), combatSeconds: mean(runs.map(run => run.forms[mode].combatSeconds)),
    ammo: mean(runs.map(run => run.forms[mode].ammo)), directDamage: mean(runs.map(run => run.forms[mode].directDamage)), statusDamage: mean(runs.map(run => run.forms[mode].statusDamage)),
    received: mean(runs.map(run => run.forms[mode].receivedHealth + run.forms[mode].receivedShield)), attackEvents: mean(runs.map(run => run.forms[mode].attackEvents)),
    frozenEnemySeconds: mean(runs.map(run => run.forms[mode].frozenEnemySeconds)), slowedEnemySeconds: mean(runs.map(run => run.forms[mode].slowedEnemySeconds)), aliveEnemySeconds: mean(runs.map(run => run.forms[mode].aliveEnemySeconds)),
    heatBlockedSeconds: mean(runs.map(run => run.forms[mode].heatBlockedSeconds)), reloadSeconds: mean(runs.map(run => run.forms[mode].reloadSeconds)),
    successfulProcs: runs.map(run => run.forms[mode].successfulProcs), contexts: runs.map(run => run.forms[mode].contexts) }));
}))));
const summary = { attempts, selectionPath, rawFilesPreserved: true, protocol: 'cluster-live-encounter-v1', reports, groups, hardwareStatus: 'NOT RUN', validation: 'All included raw event traces and fixed60Hz clocks reconcile; per-form events/procs, independent payloads, unchanged starting equipment and complete-outcome vitality reconcile. Every excluded technical interruption remains present in attempts with its filename, clock mismatch and reason.',
  limitations: ['Scripted body aim and actual Game AI; no human or controller play is claimed.', 'Whole encounters include traversal and changing AI response. Grouped/spread/cover are observed contexts, not fixed arena layouts.', 'Frozen/slowed exposure is sampled at60Hz. Only successful hit-channel procs are counted.', 'Failed/timeout outcomes remain visible; subgroup means are diagnostics rather than a universal balance score.'] };
await mkdir(directory, { recursive: true }); await writeFile(resolve(directory, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
const rows = groups.map(group => `|${group.arm}|${group.fixtureSource}|${group.payload}|${group.delivery}|${group.mode}|${group.complete}/${group.cells}|${group.combatSeconds.toFixed(2)}|${group.ammo.toFixed(1)}|${group.received.toFixed(1)}|${group.frozenEnemySeconds.toFixed(2)}|${group.attackEvents.toFixed(1)}|`);
await writeFile(resolve(directory, 'summary.md'), `# Cluster actual-game comparison\n\n${reports.map(report => `${report.arm}: ${report.complete}/${report.runs.length} complete; ${report.completeMatrix ? 'full36-cell matrix' : 'PARTIAL matrix'}; ${report.sourceFingerprint}`).join('\n\n')}\n\n|Arm|Fixture|Payload|Delivery|Form|Complete|Combat seconds|Ammo|Received|Frozen enemy-seconds|Attacks|\n|---|---|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n\n${summary.limitations.map(line => `- ${line}`).join('\n')}\n\nRetained excluded attempts:\n\n${attempts.filter(attempt => attempt.disposition !== 'included').map(attempt => `- ${attempt.filename}: ${attempt.disposition}; ${attempt.reason}`).join('\n') || 'None.'}\n`);
process.stdout.write(`${JSON.stringify({ reports: reports.map(({ runs: _runs, ...report }) => report), groups, output: directory }, null, 2)}\n`);
