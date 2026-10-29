import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLUSTER_LIVE_PROTOCOL, CLUSTER_LIVE_POLICY, clusterClone, clusterLiveClockIssue, clusterLiveFixture, clusterLiveJobs,
  emptyClusterLiveForm, validateClusterLiveEvidence, type ClusterLiveEvidence,
} from '../src/diagnostics/clusterLive.ts';
import { CombatMeasurement, type JsonValue, type MeasurementEvent } from '../src/diagnostics/measurement.ts';

function evidence(): ClusterLiveEvidence {
  const job = clusterLiveJobs('baseline')[0], fixture = clusterLiveFixture(job), sourceFingerprint = `sha256:${'a'.repeat(64)}`;
  const measurement = new CombatMeasurement({ runId: `cluster-live-baseline-workbench-cluster-kinetic-7-1`, scenario: 'encounter', provenance: 'simulated', seed: 7,
    buildId: 'workbench/cluster/kinetic', buildCodes: fixture.codes, equipment: clusterClone(fixture.equipment) as unknown as JsonValue,
    sourceFingerprint, protocol: CLUSTER_LIVE_PROTOCOL, configuration: { controls: CLUSTER_LIVE_POLICY } });
  const events: MeasurementEvent[] = Array.from({ length: 120 }, (_, index) => ({ type: 'interval', at: (index + 1) / 60, dt: 1 / 60, heatBlocked: false, reloading: false }));
  events.push({ type: 'finish', at: 2, outcome: 'timeout' });
  for (const event of events) assert.ok(measurement.record(event));
  return { protocol: CLUSTER_LIVE_PROTOCOL, job, sourceFingerprint, measurement: measurement.snapshot(), events, eventModes: events.map(() => 'pilot'),
    inputs: Array.from({ length: 120 }, () => ({ ability: false })), launches: [], procs: [], forms: { pilot: emptyClusterLiveForm(), mech: emptyClusterLiveForm() },
    encounter: { time: 2, paused: false, phase: 'battle', progression: clusterClone(fixture.state) } as ClusterLiveEvidence['encounter'], encounterEvents: [],
    initialEquipment: clusterClone(fixture.equipment), droppedTraceEvents: 0, skippedDummyEvents: 0, hardwareStatus: 'NOT RUN',
    controls: CLUSTER_LIVE_POLICY, frameCount: 120, renderedFrames: 1, limitations: [] };
}

test('live comparison matrix includes both real stat-generation paths with isolated seeded equipment', () => {
  const jobs = clusterLiveJobs('baseline');
  assert.equal(jobs.length, 36);
  assert.equal(jobs.filter(job => job.fixtureSource === 'workbench').length, 27);
  assert.equal(jobs.filter(job => job.fixtureSource === 'loot').length, 9);
  for (const source of ['workbench', 'loot'] as const) {
    const candidates = jobs.filter(job => job.fixtureSource === source && job.payload === 'corrosive-fire' && job.seed === 7);
    const fixtures = candidates.map(clusterLiveFixture);
    for (const mode of ['pilot', 'mech'] as const) {
      const gear = fixtures.map(fixture => fixture.equipment[mode].filter(item => item.slot !== 'weapon'));
      assert.deepEqual(gear[0], gear[1]); assert.deepEqual(gear[1], gear[2]);
      for (const [index, fixture] of fixtures.entries()) {
        const weapon = fixture.equipment[mode].find(item => item.slot === 'weapon')!;
        assert.equal(weapon.brand, 'ironvale'); assert.equal(weapon.weapon!.weaponType, 'launcher');
        assert.equal(weapon.weapon!.projectile, candidates[index].delivery);
        assert.equal(weapon.weapon!.element, 'corrosive'); assert.equal(weapon.weapon!.secondaryElement, 'fire');
        assert.equal(weapon.rarity, 'rare'); assert.equal(weapon.level, 5);
        assert.equal(weapon.affix, source === 'loot' ? 'Rapid' : null);
      }
    }
  }
  const first = clusterLiveFixture(jobs.find(job => job.fixtureSource === 'loot')!);
  const laterJob = { ...jobs.find(job => job.fixtureSource === 'loot')!, seed: 41 };
  const later = clusterLiveFixture(laterJob);
  assert.deepEqual(first.equipment, later.equipment, 'Encounter RNG must not reroll the controlled ordinary weapon or equipment');
});

test('valid live timeouts are retained instead of being discarded as balance failures', () => {
  const sample = evidence();
  assert.equal(clusterLiveClockIssue(sample), null);
  assert.equal(validateClusterLiveEvidence(sample).measurement.outcome, 'timeout');
});

test('a paused driver clock mismatch remains inspectable but cannot pass ordinary evidence acceptance', () => {
  const sample = evidence(); sample.frameCount = 28_800; sample.inputs = Array.from({ length: sample.frameCount }, () => ({ ability: false })); sample.encounter.paused = true;
  assert.match(clusterLiveClockIssue(sample)!, /expect 480\.000000s; measurement saved 2\.000000s.*paused/);
  assert.throws(() => validateClusterLiveEvidence(sample), /clock mismatch/);
  assert.equal(validateClusterLiveEvidence(sample, { allowClockIssue: true }), sample, 'Offline disposition audit can inspect the exact retained raw attempt');
  sample.measurement.received.total = 9;
  assert.throws(() => validateClusterLiveEvidence(sample, { allowClockIssue: true }), /Event replay/, 'Clock disposition does not disable other evidence checks');
});

test('final interaction may finish one input before stepping while larger clock differences are rejected', () => {
  const sample = evidence(); sample.encounter.time += 1 / 60;
  assert.equal(clusterLiveClockIssue(sample), null);
  sample.encounter.time += 1 / 60;
  assert.match(clusterLiveClockIssue(sample)!, /Final Game time/);
});

test('live evidence rejects altered proc counts and trigger ammunition independently of outcome', () => {
  const sample = evidence(); sample.forms.pilot.successfulProcs.ice = 1;
  assert.throws(() => validateClusterLiveEvidence(sample), /Successful status counts/);
  const ammunition = evidence(); ammunition.measurement.ammo.total = 1;
  assert.throws(() => validateClusterLiveEvidence(ammunition), /Event replay/);
});
