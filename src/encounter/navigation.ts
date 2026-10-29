import type { Point2 } from './contracts';

export interface NavigationBounds { minX: number; maxX: number; minZ: number; maxZ: number }
export interface NavigationState { route: Point2[]; destination: Point2 | null; repathIn: number }
interface Graph { nodes: Point2[]; edges: { node: number; distance: number }[][] }
const graphCache = new WeakMap<readonly NavigationBounds[], Map<string, Graph>>();
const PADDING = 0.07;

export function createNavigationState(): NavigationState { return { route: [], destination: null, repathIn: 0 }; }

function valid(p: Point2, radius: number, colliders: readonly NavigationBounds[], bounds: NavigationBounds): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.z) && p.x - radius >= bounds.minX && p.x + radius <= bounds.maxX
    && p.z - radius >= bounds.minZ && p.z + radius <= bounds.maxZ
    && !colliders.some(b => p.x + radius > b.minX && p.x - radius < b.maxX && p.z + radius > b.minZ && p.z - radius < b.maxZ);
}

/** Exact swept circle-as-square clearance, matching the sandbox's conservative actor footprint. */
export function segmentClear(from: Point2, to: Point2, radius: number, colliders: readonly NavigationBounds[], bounds: NavigationBounds): boolean {
  if (!valid(from, radius, colliders, bounds) || !valid(to, radius, colliders, bounds)) return false;
  const dx = to.x - from.x, dz = to.z - from.z;
  for (const b of colliders) {
    let near = 0, far = 1;
    let intersects = true;
    for (const [start, delta, min, max] of [[from.x, dx, b.minX - radius + 1e-7, b.maxX + radius - 1e-7],
      [from.z, dz, b.minZ - radius + 1e-7, b.maxZ + radius - 1e-7]]) {
      if (Math.abs(delta) < 1e-9) { if (start < min || start > max) { intersects = false; break; } }
      else {
        const a = (min - start) / delta, c = (max - start) / delta;
        near = Math.max(near, Math.min(a, c)); far = Math.min(far, Math.max(a, c));
        if (near > far) { intersects = false; break; }
      }
    }
    if (intersects) return false;
  }
  return true;
}

function graphFor(radius: number, colliders: readonly NavigationBounds[], bounds: NavigationBounds): Graph {
  let cache = graphCache.get(colliders);
  if (!cache) { cache = new Map(); graphCache.set(colliders, cache); }
  const key = `${colliders.length}:${radius}:${bounds.minX}:${bounds.maxX}:${bounds.minZ}:${bounds.maxZ}`;
  const old = cache.get(key); if (old) return old;
  const nodes: Point2[] = [];
  for (const b of colliders) {
    for (const x of [b.minX - radius - PADDING, b.maxX + radius + PADDING]) {
      for (const z of [b.minZ - radius - PADDING, b.maxZ + radius + PADDING]) {
        const p = { x, z }; if (valid(p, radius, colliders, bounds)) nodes.push(p);
      }
    }
  }
  const edges: Graph['edges'] = nodes.map(() => []);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    if (!segmentClear(nodes[i], nodes[j], radius, colliders, bounds)) continue;
    const distance = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].z - nodes[j].z);
    edges[i].push({ node: j, distance }); edges[j].push({ node: i, distance });
  }
  const graph = { nodes, edges }; cache.set(key, graph); return graph;
}

function findRoute(from: Point2, to: Point2, radius: number, colliders: readonly NavigationBounds[], bounds: NavigationBounds): Point2[] {
  const graph = graphFor(radius, colliders, bounds);
  const count = graph.nodes.length, end = count + 1;
  const nodes = [...graph.nodes, from, to];
  const edges = graph.edges.map(list => [...list]); edges.push([], []);
  for (const dynamic of [count, end]) for (let i = 0; i < count; i++) {
    if (!segmentClear(nodes[dynamic], nodes[i], radius, colliders, bounds)) continue;
    const distance = Math.hypot(nodes[dynamic].x - nodes[i].x, nodes[dynamic].z - nodes[i].z);
    edges[dynamic].push({ node: i, distance }); edges[i].push({ node: dynamic, distance });
  }
  const distances = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set<number>();
  distances[count] = 0;
  for (let iteration = 0; iteration < nodes.length; iteration++) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (current < 0 || distances[i] < distances[current])) current = i;
    if (current < 0 || distances[current] === Infinity) return [];
    if (current === end) break;
    visited.add(current);
    for (const edge of edges[current]) {
      const candidate = distances[current] + edge.distance;
      if (candidate < distances[edge.node]) { distances[edge.node] = candidate; previous[edge.node] = current; }
    }
  }
  if (!Number.isFinite(distances[end])) return [];
  const route: Point2[] = [];
  for (let node = end; node !== count && node >= 0; node = previous[node]) route.unshift({ ...nodes[node] });
  return route;
}

function clearDestination(target: Point2, from: Point2, radius: number, colliders: readonly NavigationBounds[], bounds: NavigationBounds): Point2 | null {
  if (!Number.isFinite(target.x) || !Number.isFinite(target.z)) return null;
  const point = { x: Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, target.x)),
    z: Math.max(bounds.minZ + radius, Math.min(bounds.maxZ - radius, target.z)) };
  if (valid(point, radius, colliders, bounds)) return point;
  const candidates: Point2[] = [];
  // Player destinations can lie beside cover that only the smaller pilot fits.
  for (let ring = 1; ring <= 4; ring++) for (let side = 0; side < 12; side++) {
    const angle = side * Math.PI / 6;
    const p = { x: point.x + Math.sin(angle) * ring * (radius + 0.4), z: point.z + Math.cos(angle) * ring * (radius + 0.4) };
    if (valid(p, radius, colliders, bounds)) candidates.push(p);
  }
  return candidates.sort((a, b) => Math.hypot(a.x - target.x, a.z - target.z) - Math.hypot(b.x - target.x, b.z - target.z)
    || Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z))[0] ?? null;
}

/** Cached visibility routing, then swept movement: never teleports through corners or tunnel walls. */
export function navigateEnemy(position: Point2, destination: Point2, speed: number, dt: number, radius: number,
  colliders: readonly NavigationBounds[], bounds: NavigationBounds, state: NavigationState): Point2 {
  if (!valid(position, radius, colliders, bounds) || !Number.isFinite(speed) || !Number.isFinite(dt) || dt <= 0 || speed <= 0) return { ...position };
  const target = clearDestination(destination, position, radius, colliders, bounds);
  if (!target) return { ...position };
  state.repathIn -= dt;
  if (segmentClear(position, target, radius, colliders, bounds)) { state.route = [target]; state.destination = target; }
  else if (!state.route.length && state.destination && state.repathIn > 0
    && Math.hypot(target.x - state.destination.x, target.z - state.destination.z) <= 2) return { ...position };
  else if (!state.route.length || !state.destination || state.repathIn <= 0 && Math.hypot(target.x - state.destination.x, target.z - state.destination.z) > 2
    || state.route[0] && !segmentClear(position, state.route[0], radius, colliders, bounds)) {
    state.route = findRoute(position, target, radius, colliders, bounds); state.destination = target; state.repathIn = 0.65;
  }
  let remaining = speed * Math.min(dt, 0.25);
  let result = { ...position };
  while (remaining > 1e-6 && state.route.length) {
    const next = state.route[0];
    const distance = Math.hypot(next.x - result.x, next.z - result.z);
    if (distance < 0.001) { state.route.shift(); continue; }
    const fraction = Math.min(1, remaining / distance);
    const step = { x: result.x + (next.x - result.x) * fraction, z: result.z + (next.z - result.z) * fraction };
    if (!segmentClear(result, step, radius, colliders, bounds)) { state.route = []; break; }
    result = step; remaining -= distance * fraction;
    if (fraction === 1) state.route.shift();
  }
  return result;
}
