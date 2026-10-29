import type { EnemyPhase, EnemyPresentation, EnemyRole, Point2 } from './contracts';

export interface EnemyBrain {
  readonly role: EnemyRole;
  readonly boss: boolean;
  phase: EnemyPhase;
  phaseTime: number;
  phaseDuration: number;
  aim: Point2;
  facing: number;
  hitReaction: number;
  cooldown: number;
  staggerGuard: number;
  readonly side: number;
}
export interface EnemyAttack {
  kind: 'melee' | 'shot';
  target: Point2;
  damage: number;
  speed: number;
  shots: number;
  range: number;
}
export interface EnemyBrainInput {
  dt: number;
  position: Point2;
  player: Point2;
  hasLineOfSight: boolean;
  moveSpeedScale?: number;
}
export interface EnemyDecision {
  move: Point2;
  destination: Point2;
  facing: number;
  attack: EnemyAttack | null;
  presentation: EnemyPresentation;
}

export function createEnemyBrain(role: EnemyRole, boss = false, seed = 0): EnemyBrain {
  return { role, boss, phase: 'advance', phaseTime: 0, phaseDuration: 1, aim: { x: 0, z: 0 }, facing: 0,
    hitReaction: 0, cooldown: 0.4 + (Math.abs(seed) % 5) * 0.15, staggerGuard: 0, side: seed % 2 ? -1 : 1 };
}

function enter(brain: EnemyBrain, phase: EnemyPhase, duration: number): void {
  brain.phase = phase; brain.phaseTime = 0; brain.phaseDuration = duration;
}

/** Body hits react visibly; precise weak-point hits can interrupt with a short guard against stun locking. */
export function staggerEnemy(brain: EnemyBrain, weakPoint = false): void {
  if (brain.phase === 'dead') return;
  brain.hitReaction = 1;
  if (weakPoint && brain.staggerGuard <= 0) {
    enter(brain, 'stagger', brain.boss ? 0.55 : 0.65);
    brain.staggerGuard = brain.boss ? 2.5 : 1.3;
  }
}

export function killEnemyBrain(brain: EnemyBrain): void { enter(brain, 'dead', 1); }

/** Decisions have no rendering, damage application, or collision side effects. A shot always uses a previously locked aim. */
export function updateEnemyBrain(brain: EnemyBrain, input: EnemyBrainInput): EnemyDecision {
  const dt = Number.isFinite(input.dt) ? Math.max(0, Math.min(0.25, input.dt)) : 0;
  const { position, player } = input;
  const dx = player.x - position.x, dz = player.z - position.z;
  const distance = Math.hypot(dx, dz);
  const direction = distance > 0.001 ? { x: dx / distance, z: dz / distance } : { x: 0, z: 1 };
  const scale = Math.max(0, Math.min(2, input.moveSpeedScale ?? 1));
  brain.hitReaction = Math.max(0, brain.hitReaction - dt * 4.5);
  brain.staggerGuard = Math.max(0, brain.staggerGuard - dt);
  brain.cooldown = Math.max(0, brain.cooldown - dt);
  brain.phaseTime += dt;
  let attack: EnemyAttack | null = null;
  let destination: Point2 = { ...position };
  let speed = 0;
  const flankGoal = (standOff: number, lateral: number): Point2 => ({ x: player.x - direction.x * standOff - direction.z * lateral * brain.side,
    z: player.z - direction.z * standOff + direction.x * lateral * brain.side });
  const shot = (): EnemyAttack => ({ kind: 'shot', target: { ...brain.aim }, damage: brain.role === 'heavy' ? brain.boss ? 28 : 21 : 9,
    speed: brain.role === 'heavy' ? 17 : 24, shots: brain.role === 'heavy' ? brain.boss ? 3 : 2 : 1, range: 46 });

  if (brain.phase === 'recover' && brain.phaseTime >= brain.phaseDuration || brain.phase === 'stagger' && brain.phaseTime >= brain.phaseDuration) {
    enter(brain, 'advance', 1); brain.cooldown = 0.25;
  }
  if (brain.phase === 'windup' && brain.phaseTime >= brain.phaseDuration) {
    // Cover can interrupt the shot; the enemy must seek a new lane and telegraph again.
    if (!input.hasLineOfSight) enter(brain, 'recover', 0.8);
    else {
      enter(brain, 'attack', brain.role === 'rusher' ? 0.28 : 0.15);
      if (brain.role !== 'rusher') attack = shot();
    }
  } else if (brain.phase === 'attack' && brain.phaseTime >= brain.phaseDuration) {
    if (brain.role === 'rusher' && input.hasLineOfSight) attack = { kind: 'melee', target: { ...brain.aim }, damage: 17, speed: 0, shots: 1, range: 2.8 };
    enter(brain, 'recover', brain.role === 'heavy' ? brain.boss ? 2.8 : 2.3 : brain.role === 'rusher' ? 1.3 : 1.1);
  }

  if (brain.phase === 'advance') {
    brain.facing = Math.atan2(dx, dz);
    const ready = brain.cooldown <= 0 && input.hasLineOfSight && distance <= (brain.role === 'rusher' ? 4.8 : brain.role === 'heavy' ? 35 : 32);
    if (ready) {
      brain.aim = { ...player };
      enter(brain, 'windup', brain.role === 'heavy' ? brain.boss ? 1.25 : 1.1 : brain.role === 'rusher' ? 0.72 : 0.85);
    } else if (brain.role === 'rusher') {
      destination = { ...player }; speed = 5.4;
    } else if (brain.role === 'flanker') {
      // Move laterally around a blocked firing lane. A consistent side avoids wall oscillation.
      const lateral = input.hasLineOfSight ? 5 : 9;
      const standOff = input.hasLineOfSight ? 13 : Math.min(6, distance * 0.3);
      destination = flankGoal(standOff, lateral);
      speed = 3.6;
    } else if (!input.hasLineOfSight || distance > 20 || distance < 9) {
      destination = input.hasLineOfSight ? flankGoal(16, 0) : flankGoal(6, 8); speed = 2.1;
    }
  } else if (brain.phase === 'attack' && brain.role === 'rusher') {
    destination = { ...brain.aim }; speed = 13;
  } else if (brain.phase === 'recover' && brain.role === 'flanker' && brain.phaseTime > 0.15) {
    destination = flankGoal(13, 8); speed = 3.6;
  }
  speed *= scale;
  const travelX = destination.x - position.x, travelZ = destination.z - position.z;
  const travel = Math.hypot(travelX, travelZ);
  const move = travel > 0.05 ? { x: travelX / travel * speed, z: travelZ / travel * speed } : { x: 0, z: 0 };
  return { move, destination, facing: brain.facing, attack, presentation: {
    phase: brain.phase, phaseProgress: Math.min(1, brain.phaseTime / brain.phaseDuration),
    moving: Math.hypot(move.x, move.z) > 0.01, shieldFraction: 1,
    weakPointOpen: brain.role !== 'heavy' || brain.phase === 'recover' || brain.phase === 'stagger', hitReaction: brain.hitReaction,
  } };
}
