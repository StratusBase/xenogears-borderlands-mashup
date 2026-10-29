import assert from 'node:assert/strict';
import test from 'node:test';
import { findLedgeGrab, sampleLedgeClimb, pilotBodyClear, pilotSupportHeight, pilotCeilingHeight,
  PILOT_TRAVERSAL, LEDGE_CLIMB_DURATION, type TraversalCollider, type TraversalPoint } from '../src/core/ledgeClimb.ts';

const cover = (extra: Partial<TraversalCollider> = {}): TraversalCollider =>
  ({ minX: -2, maxX: 2, minZ: -2, maxZ: 0, minY: 0, maxY: 1.3, climbable: true, ...extra });
const feet = (extra: Partial<TraversalPoint> = {}): TraversalPoint => ({ x: 0, y: 0, z: .7, ...extra });
const forward = { x: 0, z: -1 };
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('a nearby flat ledge provides a full landing and two edge grips without mutating input', () => {
  const collider = cover(), start = feet();
  const grab = findLedgeGrab(start, forward, [collider]);
  assert.ok(grab); assert.equal(grab.collider, collider); assert.deepEqual(grab.normal, { x: 0, z: 1 });
  assert.deepEqual(grab.start, start); assert.notEqual(grab.start, start);
  close(grab.landing.y, 1.3); close(grab.landing.z, -.62);
  close(grab.leftGrip.x, -.25); close(grab.rightGrip.x, .25);
  close(grab.leftGrip.z, 0); close(grab.rightGrip.z, 0); close(grab.leftGrip.y, 1.315);
  assert.equal(pilotBodyClear(grab.landing.x, grab.landing.z, grab.landing.y, [collider]), true);
  assert.deepEqual(start, feet()); assert.deepEqual(collider, cover());
});

test('all four outward normals select only the facing reachable edge', () => {
  for (const [start, aim, normal] of [
    [feet(), { x: 0, z: -4 }, { x: 0, z: 1 }],
    [feet({ x: 2.7, z: -1 }), { x: -1, z: 0 }, { x: 1, z: 0 }],
    [feet({ x: -2.7, z: -1 }), { x: 1, z: 0 }, { x: -1, z: 0 }],
    [feet({ z: -2.7 }), { x: 0, z: 1 }, { x: 0, z: -1 }],
  ] as const) {
    const grab = findLedgeGrab(start, aim, [cover()]);
    assert.ok(grab); assert.deepEqual(grab.normal, normal);
    close(Math.hypot(grab.leftGrip.x - grab.rightGrip.x, grab.leftGrip.z - grab.rightGrip.z), .5);
  }
});

test('reach, facing, hand height and flat-surface eligibility prevent accidental grabs', () => {
  assert.equal(findLedgeGrab(feet({ z: 1.081 }), forward, [cover()]), undefined);
  assert.equal(findLedgeGrab(feet(), { x: 0, z: 1 }, [cover()]), undefined);
  assert.equal(findLedgeGrab(feet(), { x: 1, z: -.2 }, [cover()]), undefined);
  assert.equal(findLedgeGrab(feet(), forward, [cover({ maxY: .44 })]), undefined);
  assert.equal(findLedgeGrab(feet(), forward, [cover({ maxY: 2.21 })]), undefined);
  assert.equal(findLedgeGrab(feet(), forward, [cover({ climbable: false })]), undefined);
  assert.equal(findLedgeGrab(feet(), forward, [cover({ maxY: undefined })]), undefined);
  assert.ok(findLedgeGrab(feet({ y: 1.2 }), forward, [cover({ maxY: 3.2 })]), 'An airborne pilot can reach a higher ledge');
});

test('corners and narrow or shallow platforms cannot fit the landing footprint', () => {
  assert.equal(findLedgeGrab(feet({ x: 1.6 }), forward, [cover()]), undefined);
  assert.equal(findLedgeGrab(feet(), forward, [cover({ minX: -.45, maxX: .45 })]), undefined);
  assert.equal(findLedgeGrab(feet(), forward, [cover({ minZ: -.8 })]), undefined);
});

test('occupied landing, low headroom, zone restrictions and unknown walls block climbing', () => {
  const occupied = cover({ minX: -.4, maxX: .4, minZ: -1.4, maxZ: -.1, minY: 1.3, maxY: 2.8, climbable: false });
  assert.equal(findLedgeGrab(feet(), forward, [cover(), occupied]), undefined);
  const roof = cover({ minY: 2.9, maxY: 3.1, climbable: false });
  assert.equal(findLedgeGrab(feet(), forward, [cover(), roof]), undefined);
  assert.equal(findLedgeGrab(feet(), forward, [cover()], (_x, z) => z >= 0), undefined);
  assert.equal(findLedgeGrab(feet(), forward, [cover()], (_x, z) => z < .1 || z > .3), undefined);
  const unknown = { minX: -.4, maxX: .4, minZ: -1.2, maxZ: -.1 };
  assert.equal(findLedgeGrab(feet(), forward, [cover(), unknown]), undefined);
});

test('the entire pull is swept for overhead collisions even when its endpoints are clear', () => {
  const platform = cover({ maxY: 2.2 });
  const overhead = cover({ minZ: .1, maxZ: 1.2, minY: 1.95, maxY: 2.05, climbable: false });
  assert.equal(pilotBodyClear(0, .55, 0, [platform, overhead]), true);
  assert.equal(pilotBodyClear(0, .55, 2.3, [platform, overhead]), true);
  assert.ok(findLedgeGrab(feet(), forward, [platform]));
  assert.equal(findLedgeGrab(feet(), forward, [platform, overhead]), undefined);
});

test('an overhanging container lip uses its visible top and steps outside before pulling', () => {
  const base = cover({ maxY: 3.2 });
  const lip = cover({ minX: -2.15, maxX: 2.15, minZ: -2.15, maxZ: .15, minY: 3.19, maxY: 3.37 });
  const grab = findLedgeGrab(feet({ y: 1.2, z: .52 }), forward, [base, lip]);
  assert.ok(grab); assert.equal(grab.collider, lip); close(grab.top, 3.37);
  assert.ok(sampleLedgeClimb(grab, .2).position.z > grab.start.z, 'The reach moves out from under the lip before rising');
  for (let i = 0; i <= 300; i++) {
    const position: TraversalPoint = sampleLedgeClimb(grab, i / 300).position;
    assert.equal(pilotBodyClear(position.x, position.z, position.y, [base, lip]), true);
  }
});

test('known tops support walking and jumping independently of grab eligibility', () => {
  const platform = cover({ climbable: false });
  close(pilotSupportHeight(0, -1, 1.3, [platform]), 1.3);
  close(pilotSupportHeight(0, -1, 4, [platform]), 1.3);
  close(pilotSupportHeight(0, -1, 1.1, [platform]), 0);
  close(pilotSupportHeight(0, .2, 1.3, [platform]), 1.3);
  close(pilotSupportHeight(0, PILOT_TRAVERSAL.radius - .001, 1.3, [platform]), 1.3);
  close(pilotSupportHeight(0, PILOT_TRAVERSAL.radius, 1.3, [platform]), 0);
  close(pilotSupportHeight(platform.maxX + PILOT_TRAVERSAL.radius + .001, -1, 1.3, [platform]), 0);
  assert.equal(pilotBodyClear(0, -1, 1.3, [platform]), true);
  assert.equal(pilotBodyClear(0, -1, 0, [platform]), false);
  assert.equal(pilotBodyClear(0, .7, .5, [platform]), true);
});

test('undersides bound jump height and unknown colliders remain walls at every height', () => {
  const overhang = cover({ minY: 3, maxY: 3.2, climbable: false });
  close(pilotCeilingHeight(0, -1, 0, [overhang]), 3);
  assert.equal(pilotCeilingHeight(0, 1, 0, [overhang]), Infinity);
  assert.equal(pilotBodyClear(0, -1, 1.1, [overhang]), true);
  assert.equal(pilotBodyClear(0, -1, 1.3, [overhang]), false);
  const wall = { minX: -1, maxX: 1, minZ: -2, maxZ: 0 };
  assert.equal(pilotBodyClear(0, -1, 20, [wall]), false);
  assert.equal(pilotSupportHeight(0, -1, 20, [wall]), 0);
});

test('the world bounds contain the full pilot footprint and malformed input fails closed', () => {
  const p = PILOT_TRAVERSAL;
  assert.equal(pilotBodyClear(p.maxX - p.radius, 0, 0, []), true);
  assert.equal(pilotBodyClear(p.maxX - p.radius + .001, 0, 0, []), false);
  assert.equal(pilotBodyClear(0, p.minZ + p.radius - .001, 0, []), false);
  assert.equal(pilotBodyClear(NaN, 0, 0, []), false);
  assert.equal(pilotBodyClear(0, 0, -.1, []), false);
  assert.equal(pilotBodyClear(0, 0, 0, [cover({ maxY: NaN })]), false);
  assert.equal(findLedgeGrab(feet(), { x: NaN, z: -1 }, [cover()]), undefined);
  assert.equal(findLedgeGrab(feet(), { x: 0, z: 0 }, [cover()]), undefined);
});

test('climb curve is continuous, deterministic, collision-clear and has exact grounded endpoints', () => {
  const collider = cover(), grab = findLedgeGrab(feet(), forward, [collider]); assert.ok(grab);
  assert.ok(LEDGE_CLIMB_DURATION >= 1.1 && LEDGE_CLIMB_DURATION <= 1.3);
  assert.deepEqual(sampleLedgeClimb(grab, 0).position, grab.start);
  assert.deepEqual(sampleLedgeClimb(grab, 1).position, grab.landing);
  close(sampleLedgeClimb(grab, 0).eyeHeight, 1.8); close(sampleLedgeClimb(grab, 1).eyeHeight, 1.8);
  close(sampleLedgeClimb(grab, .58).eyeHeight, .8); close(sampleLedgeClimb(grab, .85).eyeHeight, .8);
  assert.deepEqual([0, .2, .58, .85].map(p => sampleLedgeClimb(grab, p).phase), ['reach', 'pull', 'transfer', 'settle']);
  let previous = grab.start;
  for (let i = 0; i <= 1000; i++) {
    const p = i / 1000, sample = sampleLedgeClimb(grab, p), point = sample.position;
    assert.deepEqual(sampleLedgeClimb(grab, p), sample);
    assert.equal(pilotBodyClear(point.x, point.z, point.y, [collider]), true);
    assert.ok(Math.hypot(point.x - previous.x, point.y - previous.y, point.z - previous.z) < .025);
    assert.ok(sample.eyeHeight >= .8 && sample.eyeHeight <= 1.8);
    assert.ok(sample.pitch >= -.7 && sample.pitch <= .45 && Math.abs(sample.roll) < .025);
    if (point.z - PILOT_TRAVERSAL.radius < collider.maxZ) assert.ok(point.y >= collider.maxY! - .0001);
    previous = point;
  }
  assert.deepEqual(sampleLedgeClimb(grab, -1), sampleLedgeClimb(grab, 0));
  assert.deepEqual(sampleLedgeClimb(grab, 2), sampleLedgeClimb(grab, 1));
  assert.deepEqual(sampleLedgeClimb(grab, NaN), sampleLedgeClimb(grab, 0));
});

test('a low shelf uses a squat to bring the shoulders within human arm reach', () => {
  const grab = findLedgeGrab(feet(), forward, [cover({ maxY: .45 })]); assert.ok(grab);
  close(sampleLedgeClimb(grab, 0).eyeHeight, 1.8);
  close(sampleLedgeClimb(grab, .2).eyeHeight, 1.2);
  close(sampleLedgeClimb(grab, .58).eyeHeight, .8);
  close(sampleLedgeClimb(grab, 1).eyeHeight, 1.8);
});
