import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEnemyBrain, killEnemyBrain, staggerEnemy, updateEnemyBrain, type EnemyBrain } from '../src/encounter/enemyBehavior.ts';
import type { Point2 } from '../src/encounter/contracts.ts';

function tick(brain: EnemyBrain, options: { position?: Point2; player?: Point2; los?: boolean; dt?: number } = {}) {
  return updateEnemyBrain(brain, { dt: options.dt ?? 0.05, position: options.position ?? { x: 0, z: 0 },
    player: options.player ?? { x: 0, z: 4 }, hasLineOfSight: options.los ?? true });
}

test('rusher telegraphs, locks its lunge, strikes once, and recovers', () => {
  const brain = createEnemyBrain('rusher'); brain.cooldown = 0;
  let result = tick(brain);
  assert.equal(result.presentation.phase, 'windup');
  assert.equal(result.presentation.moving, false);
  for (let i = 0; i < 13; i++) { result = tick(brain, { player: { x: 5, z: 4 } }); assert.equal(result.attack, null); }
  assert.equal(brain.phase, 'windup');
  for (let i = 0; i < 3; i++) result = tick(brain, { player: { x: 5, z: 4 } });
  assert.equal(brain.phase, 'attack');
  assert.deepEqual(result.destination, { x: 0, z: 4 }, 'lunge never tracks the dodge');
  assert.ok(Math.hypot(result.move.x, result.move.z) > 10);
  let strikes = 0;
  for (let i = 0; i < 20; i++) { result = tick(brain, { player: { x: 5, z: 4 } }); if (result.attack) strikes++; }
  assert.equal(strikes, 1);
  assert.equal(brain.phase, 'recover');
});

test('flanker seeks a lateral lane behind cover and relocates during recovery', () => {
  const brain = createEnemyBrain('flanker', false, 1); brain.cooldown = 0;
  const moving = tick(brain, { player: { x: 0, z: 20 }, los: false });
  assert.equal(brain.phase, 'advance');
  assert.ok(Math.abs(moving.destination.x) >= 8);
  assert.ok(Math.hypot(moving.move.x, moving.move.z) > 3);
  tick(brain, { player: { x: 0, z: 20 } });
  assert.equal(brain.phase, 'windup');
  let shots = 0;
  for (let i = 0; i < 24; i++) { const d = tick(brain, { player: { x: 8, z: 20 } }); if (d.attack) { shots++; assert.deepEqual(d.attack.target, { x: 0, z: 20 }); } }
  assert.equal(shots, 1);
  const recovery = tick(brain, { player: { x: 8, z: 20 } });
  assert.equal(recovery.presentation.phase, 'recover');
  assert.ok(recovery.presentation.moving);
});

test('heavy has long readable windup, burst, exposed recovery, and interruptible weak point', () => {
  const brain = createEnemyBrain('heavy', true); brain.cooldown = 0;
  tick(brain, { player: { x: 0, z: 25 } });
  assert.equal(brain.phaseDuration, 1.25);
  assert.equal(tick(brain).presentation.weakPointOpen, false);
  let attack;
  for (let i = 0; i < 30; i++) { const d = tick(brain); if (d.attack) attack = d.attack; }
  assert.equal(attack?.shots, 3);
  assert.equal(brain.phase, 'recover');
  assert.ok(tick(brain).presentation.weakPointOpen);
  staggerEnemy(brain, true);
  assert.equal(brain.phase, 'stagger');
  assert.equal(brain.hitReaction, 1);
  for (let i = 0; i < 12; i++) tick(brain);
  assert.equal(brain.phase, 'advance');
  staggerEnemy(brain, true);
  assert.equal(brain.phase, 'advance', 'weak hits cannot permanently stun lock the boss');
});

test('cover cancels committed shots and forces a fresh windup', () => {
  const brain = createEnemyBrain('heavy'); brain.cooldown = 0;
  tick(brain);
  let shots = 0;
  for (let i = 0; i < 25; i++) if (tick(brain, { los: false }).attack) shots++;
  assert.equal(shots, 0);
  assert.equal(brain.phase, 'recover');
});

test('body hits react without cancelling every attack, and dead enemies cannot act', () => {
  const brain = createEnemyBrain('flanker'); brain.cooldown = 0;
  tick(brain); staggerEnemy(brain, false);
  assert.equal(brain.phase, 'windup');
  assert.ok(tick(brain).presentation.hitReaction > 0);
  killEnemyBrain(brain);
  for (let i = 0; i < 80; i++) { const d = tick(brain); assert.equal(d.attack, null); assert.equal(d.presentation.moving, false); }
});
