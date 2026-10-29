import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import type { Mode } from '../src/core/index.ts';
import { getWeaponSpec, type ProjectileType, type WeaponSpec } from '../src/core/arsenal.ts';
import { createWorkbenchWeapon, normalizeWorkbenchConfig, workbenchCode } from '../src/core/workbench.ts';
import { DEFAULT_WEAPON_BALANCE, effectiveProjectileDamage } from '../src/core/weaponBalance.ts';
import { createEncounterEnemy, type EncounterEnemyVisual } from '../src/rendering/encounterEnemy.ts';
import { PlayerBallistics, type BallisticHit, type BallisticPresentation, type BallisticTarget } from '../src/rendering/PlayerBallistics.ts';
import { createProjectileVisual, createProjectileTrail, createBeamVisual } from '../src/rendering/weaponVisuals.ts';

export const CLUSTER_GEOMETRY_PROTOCOL = 'cluster-geometry-v1';
export const GEOMETRY_DELIVERIES = ['cluster', 'rocket', 'scatter'] as const;
export const GEOMETRY_RANGES = [19, 30, 40] as const;
export const GEOMETRY_LAYOUTS = ['compact', 'spread', 'covered'] as const;
export type GeometryDelivery = typeof GEOMETRY_DELIVERIES[number];
export type GeometryLayout = typeof GEOMETRY_LAYOUTS[number];
const TRIGGERS = 12, STEP = 1 / 60;
const root = resolve(import.meta.dirname, '..');

interface HitObservation {
  trigger: number;
  at: number;
  targetId: number;
  damage: number;
  critical: boolean;
  point: number[];
}
export interface GeometryOptions { projectile: GeometryDelivery; mode: Mode; distance: number; layout: GeometryLayout }

/** Canvas paint is cosmetic. The ordinary authored meshes remain the collision source. */
function enemy(id: number): EncounterEnemyVisual {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  if (typeof document === 'undefined') Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {} }) }),
  } });
  try { return createEncounterEnemy(id, 'flanker'); }
  finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
  }
}

export function runGeometryCell(options: GeometryOptions) {
  assert.ok(GEOMETRY_DELIVERIES.includes(options.projectile));
  assert.ok(GEOMETRY_LAYOUTS.includes(options.layout));
  assert.ok(Number.isFinite(options.distance) && options.distance > 0 && options.distance < 100);
  const config = normalizeWorkbenchConfig({ target: options.mode, brand: 'ironvale', weaponType: 'launcher', affix: 'heavy',
    projectile: options.projectile, element: 'kinetic', secondaryElement: 'none', level: 5, rarity: 'rare', guaranteedStatus: false });
  const item = createWorkbenchWeapon(config), spec = getWeaponSpec(item);
  const damagePerCarrier = effectiveProjectileDamage(item.stats.damage!, spec, DEFAULT_WEAPON_BALANCE);
  const triggerBudget = damagePerCarrier * spec.pellets;
  const scene = new THREE.Scene(), visuals: EncounterEnemyVisual[] = [], targets: BallisticTarget[] = [], covers: THREE.Mesh[] = [];
  const hits: HitObservation[] = [], recipeTriggers = new Map<Readonly<WeaponSpec>, number>();
  let currentTrigger = -1, now = 0, peakProjectiles = 0;
  const peerSpacing = options.layout === 'spread' ? 4 : 1.5;
  for (const [index, x] of [0, -peerSpacing, peerSpacing].entries()) {
    const visual = enemy(index + 1); visual.group.position.set(x, 0, -options.distance); scene.add(visual.group);
    visuals.push(visual); targets.push({ id: index + 1, root: visual.group, radius: .8 });
  }
  if (options.layout === 'covered') for (const x of [-.75, .75]) {
    // Continuous side partitions avoid a projectile going around a wall end.
    // Center remains visible; both side peers are physically behind thin cover.
    const wall = new THREE.Mesh(new THREE.BoxGeometry(.04, 30, 260), new THREE.MeshBasicMaterial());
    wall.position.set(x, 10, -125); scene.add(wall); covers.push(wall);
  }
  const origin = new THREE.Vector3(0, options.mode === 'pilot' ? 1.8 : 4.4, 0);
  const aimPoint = visuals[0].aimPoint.clone().add(visuals[0].group.position);
  const direction = aimPoint.clone().sub(origin).normalize();
  const presenter: BallisticPresentation = {
    projectile(recipe, brand) {
      if (!recipeTriggers.has(recipe)) recipeTriggers.set(recipe, currentTrigger);
      return createProjectileVisual(recipe, brand);
    },
    trail: createProjectileTrail, beam: createBeamVisual, impact() {},
  };
  const ballistics = new PlayerBallistics(scene, {
    targets: () => targets, occluders: () => covers,
    hit(hit: BallisticHit) {
      const trigger = recipeTriggers.get(hit.spec);
      assert.notEqual(trigger, undefined, 'Every physical hit must retain an attributed trigger recipe');
      assert.ok(Number.isFinite(hit.damage) && hit.damage > 0);
      assert.ok(hit.point.toArray().every(Number.isFinite));
      hits.push({ trigger: trigger!, at: now, targetId: hit.targetId, damage: hit.damage, critical: hit.critical, point: hit.point.toArray() });
    },
  });
  ballistics.setPresentation(presenter);
  const triggerTimes: number[] = [];
  let nextTriggerAt = 0;
  try {
    while (triggerTimes.length < TRIGGERS || ballistics.activeCount > 0) {
      assert.ok(now < 180, 'Every geometry cell must terminate with finite projectile lifetimes');
      if (triggerTimes.length < TRIGGERS && now + 1e-9 >= nextTriggerAt) {
        currentTrigger = triggerTimes.length; triggerTimes.push(now);
        ballistics.fire(origin, direction, spec, damagePerCarrier, 100, item.brand);
        nextTriggerAt = now + 1 / item.stats.fireRate!;
      }
      peakProjectiles = Math.max(peakProjectiles, ballistics.activeCount);
      if (ballistics.activeCount === 0 && triggerTimes.length < TRIGGERS) {
        // There is no AI, status, resource or motion state during an empty interval.
        // Skip that idle gap while preserving the normal trigger interval.
        now = Math.max(now, nextTriggerAt); continue;
      }
      now += STEP; ballistics.update(STEP);
      peakProjectiles = Math.max(peakProjectiles, ballistics.activeCount);
    }
    const perTrigger = triggerTimes.map((at, trigger) => {
      const events = hits.filter(hit => hit.trigger === trigger);
      const centerDamage = events.filter(hit => hit.targetId === 1).reduce((sum, hit) => sum + hit.damage, 0);
      const peerDamage = [2, 3].map(id => events.filter(hit => hit.targetId === id).reduce((sum, hit) => sum + hit.damage, 0));
      const totalDamage = centerDamage + peerDamage[0] + peerDamage[1];
      return { trigger, at, centerDamage, peerDamage, totalDamage, triggerBudget, damageBudgetRatio: totalDamage / triggerBudget,
        centerHitCount: events.filter(hit => hit.targetId === 1).length, peerHitCount: [2, 3].map(id => events.filter(hit => hit.targetId === id).length),
        criticalHitFlags: events.filter(hit => hit.critical).length };
    });
    const totalCenterDamage = perTrigger.reduce((sum, shot) => sum + shot.centerDamage, 0);
    const totalPeerDamage = perTrigger.reduce((sum, shot) => sum + shot.peerDamage[0] + shot.peerDamage[1], 0);
    const totalDamage = totalCenterDamage + totalPeerDamage;
    assert.equal(triggerTimes.length, TRIGGERS);
    assert.equal(ballistics.activeCount, 0);
    if (options.layout === 'covered') assert.equal(totalPeerDamage, 0, 'No direct or splash damage may cross actual thin cover');
    return { ...options, config, code: workbenchCode(config), item, spec: structuredClone(spec), targetGeometry: 'ordinary static flanker authored armor; center and peers identical across weapon forms',
      positions: targets.map(({ id, root }) => ({ id, position: root.position.toArray() })),
      cover: covers.map(wall => ({ position: wall.position.toArray(), dimensions: [.04, 30, 260] })),
      origin: origin.toArray(), aimPoint: aimPoint.toArray(), triggerCount: TRIGGERS, triggerBudget, totalTriggerBudget: TRIGGERS * triggerBudget,
      totalCenterDamage, totalPeerDamage, totalDamage, damageBudgetRatio: totalDamage / (TRIGGERS * triggerBudget),
      centerHitCount: hits.filter(hit => hit.targetId === 1).length, peerHitCount: [2, 3].map(id => hits.filter(hit => hit.targetId === id).length),
      centerHitsPerTrigger: hits.filter(hit => hit.targetId === 1).length / TRIGGERS,
      peersDamagedPerTrigger: perTrigger.reduce((sum, shot) => sum + shot.peerDamage.filter(value => value > 0).length, 0) / TRIGGERS,
      peerDamagePerTrigger: totalPeerDamage / TRIGGERS, centerDamagePerTrigger: totalCenterDamage / TRIGGERS,
      peakProjectiles, pendingProjectiles: ballistics.activeCount, simulationSeconds: now, perTrigger, hits };
  } finally {
    ballistics.clear(); visuals.forEach(visual => visual.dispose());
    for (const wall of covers) { wall.geometry.dispose(); (wall.material as THREE.Material).dispose(); wall.removeFromParent(); }
  }
}

async function fingerprintSources() {
  async function files(directory: string): Promise<string[]> {
    return (await Promise.all((await readdir(directory, { withFileTypes: true })).map(entry => entry.isDirectory()
      ? files(resolve(directory, entry.name)) : [resolve(directory, entry.name)]))).flat();
  }
  const sources = (await files(resolve(root, 'src'))).filter(path => /\.(ts|css)$/.test(path)).sort();
  const contents = await Promise.all(sources.map(async path => ({ path: relative(root, path), content: await readFile(path, 'utf8') })));
  return { fingerprint: `sha256:${createHash('sha256').update(JSON.stringify(contents)).digest('hex')}`, paths: contents.map(source => source.path) };
}

export async function evaluateClusterGeometry(args = process.argv.slice(2)) {
  assert.ok(args.length === 2 && args[0] === '--out' && args[1] && !args[1].startsWith('--'),
    'Usage: /opt/homebrew/bin/node --import tsx scripts/evaluateClusterGeometry.ts --out artifacts/cluster-balance/baseline/geometry.json');
  const destination = resolve(root, args[1]);
  const before = await fingerprintSources();
  const cells = [];
  for (const projectile of GEOMETRY_DELIVERIES) for (const mode of ['pilot', 'mech'] as const)
    for (const distance of GEOMETRY_RANGES) for (const layout of GEOMETRY_LAYOUTS) cells.push(runGeometryCell({ projectile, mode, distance, layout }));
  assert.equal(cells.length, 54);
  const after = await fingerprintSources();
  assert.equal(after.fingerprint, before.fingerprint, 'Sources changed during geometry sampling; rerun the frozen evidence');
  const report = { protocol: CLUSTER_GEOMETRY_PROTOCOL, sourceFingerprint: before.fingerprint, sources: before.paths,
    runnerFingerprint: `sha256:${createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex')}`,
    provenance: 'controlled actual PlayerBallistics with authored enemy meshes and physical cover raycasting; no live AI or status simulation',
    configuration: { fixedStep: STEP, triggersPerCell: TRIGGERS, normalWeaponSpread: true,
      sameFamilyBaseline: 'Ironvale launcher / Heavy / level5 / rare / kinetic / no secondary element; normal profile stat multipliers retained',
      target: 'three stationary ordinary flanker meshes; same meshes in pilot and mech samples',
      cadence: 'normal rolled fire rate; ammunition/reload/heat gates excluded; idle intervals without projectiles skipped',
      damage: 'raw BallisticHit contact plus splash damage before crit/armor/shields; damageBudgetRatio includes collateral across all three targets',
      coveredPeers: 'two continuous 0.04m side walls isolate side peers; center lane stays open' },
    limitations: [
      'Geometry evidence measures spatial delivery and raw contact/splash only, not live encounter completion, survival, status procs, freeze, AI, human aim, or hardware performance.',
      'Targets cannot die or move; overkill, shield/armor/critical multipliers and control utility require separate actual Game evidence.',
      'Twelve deterministic trigger directions sample normal weapon spread rather than all aim/range permutations.',
      'Profile multipliers are retained and full stats saved; normalized budget ratios isolate spatial usefulness from different raw trigger damage.',
    ], cells };
  await mkdir(resolve(destination, '..'), { recursive: true });
  await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  process.stdout.write(`Saved ${cells.length} geometry cells / ${cells.length * TRIGGERS} actual triggers: ${relative(root, destination)}\n`);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await evaluateClusterGeometry();
