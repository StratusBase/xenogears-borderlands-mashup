/** Pilot-only traversal. Legacy 2D navigation and mech collision stay independent. */
export interface TraversalCollider {
  minX: number; maxX: number; minZ: number; maxZ: number;
  minY?: number; maxY?: number; climbable?: boolean;
}
export interface TraversalPoint { x: number; y: number; z: number }
export interface LedgeGrab {
  start: TraversalPoint;
  landing: TraversalPoint;
  leftGrip: TraversalPoint;
  rightGrip: TraversalPoint;
  normal: { x: number; z: number };
  collider: TraversalCollider;
  top: number;
}
export const PILOT_TRAVERSAL = Object.freeze({ radius: .48, height: 1.8, reach: .6,
  maxGrabHeight: 2.2, minGrabHeight: .45, handSpacing: .5, landingInset: .14,
  edgeMargin: .08, faceAlignment: .65, topClearance: .1,
  minX: -90, maxX: 90, minZ: -55, maxZ: 55 });
export const LEDGE_CLIMB_DURATION = 1.22;
const EPSILON = .0001;
const finitePoint = (p: TraversalPoint) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
const bottom = (b: TraversalCollider) => b.minY ?? -Infinity;
const top = (b: TraversalCollider) => b.maxY ?? Infinity;
function validCollider(b: TraversalCollider): boolean {
  return [b.minX, b.maxX, b.minZ, b.maxZ].every(Number.isFinite)
    && b.minX <= b.maxX && b.minZ <= b.maxZ
    && !Number.isNaN(bottom(b)) && !Number.isNaN(top(b)) && bottom(b) <= top(b);
}
function footprintOverlaps(x: number, z: number, b: TraversalCollider, radius = PILOT_TRAVERSAL.radius): boolean {
  return x + radius > b.minX + EPSILON && x - radius < b.maxX - EPSILON
    && z + radius > b.minZ + EPSILON && z - radius < b.maxZ - EPSILON;
}

/** Unknown-height colliders remain walls, including above a climbable platform. */
export function pilotBodyClear(x: number, z: number, feet: number, colliders: readonly TraversalCollider[]): boolean {
  const p = PILOT_TRAVERSAL;
  if (![x, z, feet].every(Number.isFinite) || feet < -EPSILON
    || x - p.radius < p.minX || x + p.radius > p.maxX
    || z - p.radius < p.minZ || z + p.radius > p.maxZ) return false;
  return colliders.every(b => validCollider(b) && (!footprintOverlaps(x, z, b)
    || feet >= top(b) - EPSILON || feet + p.height <= bottom(b) + EPSILON));
}

/** Support lasts until the collision footprint clears the edge. This prevents
 * gravity pulling the body through a wall while it is still leaving the top. */
export function pilotSupportHeight(x: number, z: number, feet: number, colliders: readonly TraversalCollider[]): number {
  if (![x, z, feet].every(Number.isFinite)) return 0;
  let support = 0;
  for (const b of colliders) {
    if (!validCollider(b) || !Number.isFinite(top(b)) || top(b) > feet + .05 || top(b) < support) continue;
    if (footprintOverlaps(x, z, b)) support = top(b);
  }
  return support;
}

/** Nearest actual underside above these feet, or open sky. */
export function pilotCeilingHeight(x: number, z: number, feet: number, colliders: readonly TraversalCollider[]): number {
  if (![x, z, feet].every(Number.isFinite)) return Infinity;
  let ceiling = Infinity;
  for (const b of colliders) {
    if (validCollider(b) && footprintOverlaps(x, z, b) && bottom(b) >= feet + .05) ceiling = Math.min(ceiling, bottom(b));
  }
  return ceiling;
}

function smooth(value: number): number { return value * value * (3 - 2 * value); }
function lerp(a: TraversalPoint, b: TraversalPoint, t: number): TraversalPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}
function keyframes(grab: LedgeGrab): readonly TraversalPoint[] {
  const edge = { x: (grab.leftGrip.x + grab.rightGrip.x) * .5, z: (grab.leftGrip.z + grab.rightGrip.z) * .5 };
  const outside = PILOT_TRAVERSAL.radius + .07;
  return [grab.start,
    { x: edge.x + grab.normal.x * outside, y: grab.start.y, z: edge.z + grab.normal.z * outside },
    { x: edge.x + grab.normal.x * outside, y: grab.top + PILOT_TRAVERSAL.topClearance, z: edge.z + grab.normal.z * outside },
    { ...grab.landing, y: grab.top + PILOT_TRAVERSAL.topClearance }, grab.landing];
}

/** Four spatial segments keep the body outside the face until the feet clear it.
 * Each phase eases to a deliberate contact/weight-transfer beat. */
export function sampleLedgeClimb(grab: LedgeGrab, progress: number): {
  position: TraversalPoint; eyeHeight: number; pitch: number; roll: number; phase: 'reach' | 'pull' | 'transfer' | 'settle';
} {
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const points = keyframes(grab);
  const index = p < .2 ? 0 : p < .58 ? 1 : p < .85 ? 2 : 3;
  const boundaries = [0, .2, .58, .85, 1];
  const t = smooth((p - boundaries[index]) / (boundaries[index + 1] - boundaries[index]));
  const phase = (['reach', 'pull', 'transfer', 'settle'] as const)[index];
  // Squat to reach low shelves, tuck while palms carry weight, then stand.
  const contactEye = Math.max(.9, Math.min(PILOT_TRAVERSAL.height, grab.top - grab.start.y + .75));
  const eyeHeight = p < .2 ? PILOT_TRAVERSAL.height + (contactEye - PILOT_TRAVERSAL.height) * smooth(p / .2)
    : p < .58 ? contactEye + (.8 - contactEye) * smooth((p - .2) / .38)
    : p < .85 ? .8 : .8 + smooth((p - .85) / .15);
  const position = lerp(points[index], points[index + 1], t);
  const grip = { x: (grab.leftGrip.x + grab.rightGrip.x) * .5, y: (grab.leftGrip.y + grab.rightGrip.y) * .5,
    z: (grab.leftGrip.z + grab.rightGrip.z) * .5 };
  // Follow the hands while loading them, then look ahead as the torso crosses.
  // The outside-distance floor prevents a backwards glance after passing the edge.
  const outside = Math.max(.25, (position.x - grip.x) * grab.normal.x + (position.z - grip.z) * grab.normal.z);
  const lookPitch = Math.max(-.7, Math.min(.45, .75 * Math.atan2(grip.y - (position.y + eyeHeight), outside)));
  const lookIn = smooth(Math.min(1, p / .16)), lookOut = 1 - smooth(Math.max(0, (p - .68) / .32));
  return { position,
    eyeHeight, pitch: p === 0 || p === 1 ? 0 : lookPitch * lookIn * lookOut,
    roll: p === 0 || p === 1 ? 0 : .022 * Math.sin(2 * Math.PI * p), phase };
}

/** Swept square-footprint capsule proxy, expanded in all three dimensions.
 * Spatial segments are straight even though their timing is eased. */
function bodySegmentClear(a: TraversalPoint, b: TraversalPoint, colliders: readonly TraversalCollider[]): boolean {
  if (!pilotBodyClear(a.x, a.z, a.y, colliders) || !pilotBodyClear(b.x, b.z, b.y, colliders)) return false;
  for (const collider of colliders) {
    let near = 0, far = 1, intersects = true;
    const axes = [
      [a.x, b.x - a.x, collider.minX - PILOT_TRAVERSAL.radius + EPSILON, collider.maxX + PILOT_TRAVERSAL.radius - EPSILON],
      [a.z, b.z - a.z, collider.minZ - PILOT_TRAVERSAL.radius + EPSILON, collider.maxZ + PILOT_TRAVERSAL.radius - EPSILON],
      [a.y, b.y - a.y, bottom(collider) - PILOT_TRAVERSAL.height + EPSILON, top(collider) - EPSILON],
    ];
    for (const [start, delta, min, max] of axes) {
      if (Math.abs(delta) < 1e-10) { if (start < min || start > max) { intersects = false; break; } }
      else {
        const first = (min - start) / delta, last = (max - start) / delta;
        near = Math.max(near, Math.min(first, last)); far = Math.min(far, Math.max(first, last));
        if (near > far) { intersects = false; break; }
      }
    }
    if (intersects) return false;
  }
  return true;
}

/** Only deliberately authored, finite flat surfaces provide graspable edges. */
export function findLedgeGrab(feet: TraversalPoint, forward: { x: number; z: number },
  colliders: readonly TraversalCollider[], allowed: (x: number, z: number) => boolean = () => true): LedgeGrab | undefined {
  if (!finitePoint(feet) || !pilotBodyClear(feet.x, feet.z, feet.y, colliders)
    || !Number.isFinite(forward.x) || !Number.isFinite(forward.z)) return undefined;
  const length = Math.hypot(forward.x, forward.z);
  if (length < .001) return undefined;
  const aim = { x: forward.x / length, z: forward.z / length }, p = PILOT_TRAVERSAL;
  let chosen: LedgeGrab | undefined, best = Infinity;
  for (const collider of colliders) {
    if (!collider.climbable || !validCollider(collider) || !Number.isFinite(top(collider))) continue;
    const rise = top(collider) - feet.y;
    if (rise < p.minGrabHeight || rise > p.maxGrabHeight) continue;
    for (const normal of [{ x: -1, z: 0 }, { x: 1, z: 0 }, { x: 0, z: -1 }, { x: 0, z: 1 }]) {
      if (-(normal.x * aim.x + normal.z * aim.z) < p.faceAlignment) continue;
      const edge = { x: normal.x ? normal.x < 0 ? collider.minX : collider.maxX : feet.x,
        z: normal.z ? normal.z < 0 ? collider.minZ : collider.maxZ : feet.z };
      const distance = (feet.x - edge.x) * normal.x + (feet.z - edge.z) * normal.z;
      if (distance < 0 || distance > p.radius + p.reach) continue;
      const inset = p.radius + p.landingInset;
      const landing = { x: edge.x - normal.x * inset, y: top(collider), z: edge.z - normal.z * inset };
      const margin = p.radius + p.edgeMargin;
      if (landing.x - margin < collider.minX || landing.x + margin > collider.maxX
        || landing.z - margin < collider.minZ || landing.z + margin > collider.maxZ) continue;
      if (!allowed(landing.x, landing.z) || !pilotBodyClear(landing.x, landing.z, landing.y, colliders)) continue;
      const right = { x: normal.z, z: -normal.x }, half = p.handSpacing * .5;
      const grab: LedgeGrab = { start: { ...feet }, landing, collider, normal, top: top(collider),
        leftGrip: { x: edge.x - right.x * half, y: top(collider) + .015, z: edge.z - right.z * half },
        rightGrip: { x: edge.x + right.x * half, y: top(collider) + .015, z: edge.z + right.z * half } };
      const path = keyframes(grab);
      if (path.some(point => !allowed(point.x, point.z))) continue;
      if (!path.slice(1).every((point, index) => bodySegmentClear(path[index], point, colliders))) continue;
      if (!Array.from({ length: 65 }, (_, index) => sampleLedgeClimb(grab, index / 64).position)
        .every(point => allowed(point.x, point.z))) continue;
      const score = distance + rise * .05;
      if (score < best) { chosen = grab; best = score; }
    }
  }
  return chosen;
}
