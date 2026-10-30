import * as THREE from 'three';
import { getStats, seededRandom, type Mode, type Progression } from '../core/index';
import { ammoReserveCapacity, reloadAmmo } from '../core/ammo';
import { getWeaponElements, getWeaponSpec, getHitStatusChance, getHitStatusPower } from '../core/arsenal';
import { shieldAdjustedDamage } from '../core/combat';
import { createStatusState, applyStatus, advanceStatuses, activeStatusElements, getStatusModifiers } from '../core/statusEffects';
import { TestDummyMeter } from '../core/testDummy';
import { createTestDummy } from '../rendering/testDummy';
import { PlayerBallistics } from '../rendering/PlayerBallistics';
import { DEFAULT_WEAPON_BALANCE, effectiveProjectileDamage, heatPerShot, heatRecoveryFraction, type WeaponBalanceRules } from '../core/weaponBalance';

export interface DummySimulationOptions {
  state: Progression;
  mode: Mode;
  seed: number;
  /** Trigger-held time. The clock starts from reset, including projectile travel. */
  duration?: number;
  /** Trigger released; late projectiles and statuses still deal damage. */
  drainSeconds?: number;
  /** Eye to dummy root distance, in metres. The normal workbench range is 19 m. */
  distance?: number;
  criticalAim?: boolean;
  balanceRules?: Readonly<WeaponBalanceRules>;
}

export type DummySimulationEvent =
  | { at: number; type: 'damage'; targetId: string; target: 'dummy'; health: number; shield: number; source: 'direct' | 'status'; critical?: boolean }
  | { at: number; type: 'shot'; mode: Mode; ammo: number }
  | { at: number; type: 'interval'; dt: number; heatBlocked: boolean; reloading: boolean }
  | { at: number; type: 'finish'; outcome: 'complete' };

export interface DummySimulationResult {
  scenario: 'dummy';
  provenance: 'simulated';
  protocol: 'fixed-dummy-ground-v2';
  seed: number;
  mode: Mode;
  distance: number;
  criticalAim: boolean;
  durationSeconds: number;
  firingSeconds: number;
  drainSeconds: number;
  directDamage: number;
  statusDamage: number;
  totalDamage: number;
  /** Includes the entire firing and drain interval. */
  practicalDps: number;
  /** Only damage applied by trigger release divided by the firing interval. */
  firingWindowDps: number;
  shots: number;
  ammoUsed: number;
  magazineRemaining: number;
  reserveRemaining: number;
  heatBlockedSeconds: number;
  reloadSeconds: number;
  criticalDamage: number;
  targetTtk: null;
  damageReceived: 0;
  pendingProjectiles: number;
  activeStatusesAtEnd: string[];
  events: DummySimulationEvent[];
  limitations: readonly string[];
}

/** createTestDummy's sign uses a canvas even though its pixels do not affect raycasts.
 * In Node only, stub those paint calls while constructing the unmodified fixture.
 * Never leave a DOM stub installed, including if construction throws.
 */
function physicalDummy() {
  if (typeof document !== 'undefined') return createTestDummy(-1);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }),
  } });
  try { return createTestDummy(-1); }
  finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
  }
}

function boundedOption(value: number | undefined, fallback: number, min: number, max: number, name: string): number {
  const result = value ?? fallback;
  if (!Number.isFinite(result) || result < min || result > max) throw new RangeError(`Invalid ${name}`);
  return result;
}

/** A controlled geometry/collision baseline, not a live combat or human input result.
 * PlayerBallistics and the permanent dummy geometry are shared with gameplay.
 * Its tiny orchestration adapter mirrors the fire/cooling gates in Game; changes
 * to those gates require reviewing this protocol. No balance values are patched.
 */
export function simulateDummy(options: DummySimulationOptions): DummySimulationResult {
  if (!Number.isInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff) throw new RangeError('Invalid seed');
  if (options.mode !== 'pilot' && options.mode !== 'mech') throw new RangeError('Invalid mode');
  const duration = boundedOption(options.duration, 30, 1 / 60, 300, 'duration');
  const drainSeconds = boundedOption(options.drainSeconds, 5, 0, 30, 'drainSeconds');
  const distance = boundedOption(options.distance, 19, 1, 120, 'distance');
  const end = duration + drainSeconds;
  const stats = getStats(options.state, options.mode);
  if (Object.values(stats).some(value => !Number.isFinite(value) || value < 0)
    || stats.fireRate <= 0 || stats.magazine < 1 || stats.damage <= 0 || stats.reload <= 0 || stats.heatCapacity <= 0) throw new RangeError('Invalid loadout stats');
  const item = options.state.inventory.find(entry => entry.id === options.state.loadouts[options.mode].weapon);
  const spec = getWeaponSpec(item), random = seededRandom(options.seed);
  const rules = options.balanceRules ?? DEFAULT_WEAPON_BALANCE;
  const projectileDamage = effectiveProjectileDamage(stats.damage, spec, rules);
  const scene = new THREE.Scene(), dummy = physicalDummy();
  dummy.group.position.set(0, 0, -distance); scene.add(dummy.group);
  // The permanent dummy stands on real terrain in Game. Physical bomblets
  // need the same support here; a world without a floor is a different test.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(450, 360), new THREE.MeshBasicMaterial());
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const origin = new THREE.Vector3(0, options.mode === 'pilot' ? 1.8 : 4.4, 0);
  const target = options.criticalAim
    ? new THREE.Vector3(0, options.mode === 'pilot' ? 2.3 : 4.35, -distance + 0.335)
    : new THREE.Vector3(options.mode === 'pilot' ? 0.45 : 0.40, options.mode === 'pilot' ? 2.3 : 4.35, -distance + 0.335);
  const direction = target.sub(origin).normalize();
  const meter = new TestDummyMeter(), statuses = createStatusState();
  const events: DummySimulationEvent[] = [];
  let now = 0, heat = 0, overheated = false, reloadUntil = 0, nextShot = 0;
  let ammo = Math.floor(stats.magazine), reserve = ammoReserveCapacity(options.mode, stats.magazine);
  let heatBlockedSeconds = 0, reloadSeconds = 0, shots = 0, firingDamage = 0;
  const ballistics = new PlayerBallistics(scene, {
    targets: () => [{ id: -1, root: dummy.group, radius: dummy.radius }],
    // The actual stand/nameplate block shots but cannot report damage.
    occluders: () => {
      const meshes: THREE.Object3D[] = [floor];
      dummy.group.traverse(object => { if (object instanceof THREE.Mesh && object.userData.enemyId !== -1) meshes.push(object); });
      return meshes;
    },
    hit(hit) {
      for (const element of getWeaponElements(hit.spec)) {
        if (element !== 'kinetic' && random() < getHitStatusChance(hit.spec)) applyStatus(statuses, element, now, getHitStatusPower(hit.damage, hit.spec));
      }
      const modifiers = getStatusModifiers(statuses, now);
      const damage = shieldAdjustedDamage(0, hit.damage * (hit.critical ? 1.7 : 1) * modifiers.incomingDamage, modifiers.shieldDamage);
      meter.record(damage, now, hit.critical);
      events.push({ type: 'damage', at: now, targetId: '-1', target: 'dummy', health: damage, shield: 0, source: 'direct', critical: hit.critical });
    },
  });
  try {
    const frames = Math.ceil(end * 60);
    for (let frame = 1; frame <= frames; frame++) {
      const previous = now;
      now = Math.min(frame / 60, end);
      const dt = now - previous;
      heat = Math.max(0, heat - stats.cooling * dt);
      if (overheated && heat < stats.heatCapacity * heatRecoveryFraction(options.mode, rules)) overheated = false;
      if (reloadUntil > 0 && now >= reloadUntil) {
        ({ ammo, reserve } = reloadAmmo(ammo, reserve, stats.magazine)); reloadUntil = 0;
      }
      for (const tick of advanceStatuses(statuses, now)) {
        const modifiers = getStatusModifiers(statuses, now);
        const damage = shieldAdjustedDamage(0, tick.damage * modifiers.incomingDamage, modifiers.shieldDamage);
        meter.record(damage, now, false, tick.effect);
        events.push({ type: 'damage', at: now, targetId: '-1', target: 'dummy', health: damage, shield: 0, source: 'status' });
      }
      ballistics.update(dt);
      const triggering = now <= duration;
      const heatBlocked = triggering && overheated;
      const reloading = triggering && reloadUntil > 0;
      if (heatBlocked) heatBlockedSeconds += dt;
      if (reloading) reloadSeconds += dt;
      events.push({ type: 'interval', at: now, dt, heatBlocked, reloading });
      if (triggering && !overheated && reloadUntil === 0 && now >= nextShot) {
        if (ammo === 0) { if (reserve > 0) reloadUntil = now + stats.reload; }
        else {
          ammo--; shots++; nextShot = now + 1 / stats.fireRate;
          heat += heatPerShot(options.mode, stats.fireRate, rules);
          if (heat >= stats.heatCapacity) overheated = true;
          events.push({ type: 'shot', at: now, mode: options.mode, ammo: 1 });
          ballistics.fire(origin, direction, spec, projectileDamage, undefined, item?.brand);
        }
      }
      if (now <= duration) firingDamage = meter.snapshot(now).total;
    }
    const result = meter.snapshot(now);
    events.push({ type: 'finish', at: end, outcome: 'complete' });
    return {
      scenario: 'dummy', provenance: 'simulated', protocol: 'fixed-dummy-ground-v2', seed: options.seed,
      mode: options.mode, distance, criticalAim: options.criticalAim ?? false,
      durationSeconds: end, firingSeconds: duration, drainSeconds,
      directDamage: result.directTotal, statusDamage: result.statusTotal, totalDamage: result.total,
      practicalDps: result.total / end, firingWindowDps: firingDamage / duration,
      shots, ammoUsed: shots, magazineRemaining: ammo, reserveRemaining: reserve,
      heatBlockedSeconds, reloadSeconds, criticalDamage: result.criticalTotal, targetTtk: null, damageReceived: 0,
      pendingProjectiles: ballistics.activeCount, activeStatusesAtEnd: activeStatusElements(statuses, end), events,
      limitations: [
        'Simulated stationary aiming uses real dummy collision and projectile spread; no human recoil correction or gamepad hardware is measured.',
        'The small fire/cooling/status adapter mirrors Game rather than executing the complete Game loop; review protocol on gameplay gate changes.',
        'One immortal target cannot measure target defeat time, received damage, cover, crowd control, chain/splash value across enemies, or encounter completion.',
        'Pending projectiles and active statuses at the configured stop are reported; unobserved future damage is excluded.',
      ],
    };
  } finally { ballistics.clear(); dummy.dispose(); floor.geometry.dispose(); floor.material.dispose(); }
}
