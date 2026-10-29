import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CombatMeasurement, type MeasurementEvent, type MeasurementSnapshot } from '../src/diagnostics/measurement.ts';

const args = process.argv.slice(2), flag = args.indexOf('--out');
const paths = flag < 0 ? args : args.slice(0, flag);
if (!paths.length || paths.some(path => path.startsWith('--')) || flag >= 0 && (flag !== args.length - 2 || !args[flag + 1])) {
  throw new Error('Usage: node --import tsx scripts/summarizeEncounters.ts run1.json run2.json [...] [--out artifacts/evaluation/encounters]');
}
const output = resolve(flag < 0 ? 'artifacts/evaluation/encounters' : args[flag + 1]);
const runs = await Promise.all(paths.map(async path => {
  const data = JSON.parse(await readFile(path, 'utf8')) as { measurement: MeasurementSnapshot; events: MeasurementEvent[]; droppedTraceEvents: number; scriptedReason?: string; encounter: unknown; hardwareStatus: string };
  if (data.measurement?.metadata.scenario !== 'encounter' || !data.measurement.outcome || data.measurement.rejectedEvents || data.droppedTraceEvents) {
    throw new Error(`${path}: incomplete or invalid encounter evidence`);
  }
  const recorder = new CombatMeasurement(data.measurement.metadata);
  if (!Array.isArray(data.events) || data.events.some(event => !recorder.record(event))) throw new Error(`${path}: invalid event trace`);
  if (JSON.stringify(recorder.snapshot()) !== JSON.stringify(data.measurement)) throw new Error(`${path}: event replay differs from exported measurement`);
  return { input: path, ...data };
}));
const keys = runs.map(run => `${run.measurement.metadata.sourceFingerprint}/${run.measurement.metadata.runId}`);
if (new Set(keys).size !== keys.length) throw new Error('Duplicate run IDs for one source fingerprint; preserve distinct attempts explicitly');
const fingerprints = [...new Set(runs.map(run => run.measurement.metadata.sourceFingerprint))];
const protocols = [...new Set(runs.map(run => run.measurement.metadata.protocol))];
if (fingerprints.length !== 1 || protocols.length !== 1) throw new Error('Sources/protocols differ; summarize each source version separately');
const n = (value: number) => value.toFixed(2);
const lines = ['# Actual encounter measurements', '',
  `Source: \`${fingerprints[0]}\`. Every exported event trace was replayed and matched its measurement exactly.`, '',
  'Scripted controls exercise the actual Game, enemy AI, collision, damage, supplies and objectives. These are simulated inputs; physical gamepad and human performance are NOT tested. Failed and timed-out attempts remain in the dataset.', '',
  '| Build | Seed | Input | Outcome | Seconds | Applied damage | Received health / shield | Pilot / mech ammo | Heat s | Reload s | Kills | Mean TTK from first hit |',
  '| --- | --- | --- | --- | ---: | ---: | --- | --- | ---: | ---: | ---: | --- |',
];
for (const { measurement: m } of runs) {
  const killed = m.targets.filter(target => target.killedAt !== null && target.ttkFromFirstDamage !== null);
  const mean = killed.length ? n(killed.reduce((sum, target) => sum + target.ttkFromFirstDamage!, 0) / killed.length) : '—';
  lines.push(`| ${m.metadata.buildId} | ${m.metadata.seed} | ${m.metadata.provenance} | ${m.outcome} | ${n(m.duration)} | ${n(m.damage.total)} | ${n(m.received.health)} / ${n(m.received.shield)} | ${m.ammo.pilot} / ${m.ammo.mech} | ${n(m.heatBlockedSeconds)} | ${n(m.reloadSeconds)} | ${m.kills} / ${m.targets.length} | ${mean}s (${killed.length} killed) |`);
}
lines.push('', 'TTKs for surviving targets remain null and are excluded from killed-target means; see results.json for spawn-to-death and first-hit-to-death per target. Spawn TTK includes travel/objective time. Completion requires the explicit finish event, including reward collection. No omitted/zero-filled failures.', '');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'results.json'), `${JSON.stringify({ sourceFingerprint: fingerprints[0], protocol: protocols[0], hardwareStatus: 'NOT RUN', runs }, null, 2)}\n`);
await writeFile(resolve(output, 'summary.md'), lines.join('\n'));
process.stdout.write(`Validated ${runs.length} encounter event traces; wrote ${output}/summary.md\n`);
