import assert from 'node:assert/strict';
import test from 'node:test';
import { createProgression, deserializeProgression, serializeProgression, type Item } from '../src/core/index.ts';
import { createWeaponSpec, type ElementType } from '../src/core/arsenal.ts';
import { buildItemCard, type CardMetric, type ItemCardModel } from '../src/core/itemCard.ts';

function weapon(overrides: Partial<Item> = {}): Item {
  const item = createProgression().inventory.find(candidate => candidate.slot === 'weapon' && candidate.target === 'pilot')!;
  return { ...item, stats: { damage: 20, fireRate: 5, magazine: 10, reload: 2 }, weapon: createWeaponSpec('bullet', 'kinetic'), ...overrides };
}

function metric(card: ItemCardModel, key: CardMetric['key']): CardMetric {
  const row = card.stats.find(candidate => candidate.key === key);
  assert.ok(row, `Missing ${key} row`);
  return row;
}

test('scatter compares damage per trigger and calculates direct DPS using its actual per-pellet damage', () => {
  const equipped = weapon({ stats: { damage: 40, fireRate: 5, magazine: 10, reload: 2 } });
  const scatter = weapon({ weapon: createWeaponSpec('scatter', 'fire'), stats: { damage: 10, fireRate: 5, magazine: 10, reload: 2 } });
  const card = buildItemCard(scatter, equipped);
  assert.equal(card.weapon?.damagePerPellet, 10);
  assert.equal(card.weapon?.pellets, 6);
  assert.equal(card.weapon?.damagePerTrigger, 60);
  assert.equal(metric(card, 'damage').display, '10×6');
  assert.equal(metric(card, 'damage').delta?.amount, 20);
  assert.equal(metric(card, 'damage').delta?.better, true);
  assert.equal(card.weapon?.burstDps.value, 300);
  assert.equal(card.weapon?.burstDps.delta?.amount, 100);
  assert.equal(card.status?.dps, 2.5, 'A proc uses one pellet hit, without multiplying pellets, fire rate or chance');
});

test('cluster cards show shared direct damage, per-child chance and carrier-strength status procs', () => {
  const selected = weapon({ weapon: { ...createWeaponSpec('cluster', 'fire'), speed: 58, fuse: 0.65, blastRadius: 2.2, split: { count: 6, delay: 0.45, spread: 0.32 }, secondaryElement: 'corrosive', statusPower: 0.4, statusChance: 0.5 }, stats: { damage: 120, fireRate: 2, magazine: 4, reload: 2 } });
  const card = buildItemCard(selected, weapon({ stats: { damage: 120, fireRate: 2, magazine: 4, reload: 2 } }));
  assert.equal(card.weapon!.damagePerTrigger, 102, 'Secondary cost applies once to the shared carrier budget');
  assert.equal(card.weapon!.damagePerPellet, 17);
  assert.equal(card.weapon!.pellets, 6);
  assert.equal(metric(card, 'damage').display, '17×6');
  assert.equal(metric(card, 'damage').delta!.amount, -18);
  assert.equal(card.weapon!.burstDps.value, 204);
  assert.equal(card.weapon!.sustainedDps.value, 102);
  assert.match(metric(card, 'damage').description, /Carrier deals no damage.*shared across 6 children/);
  assert.deepEqual(card.secondary.map(spec => [spec.key, spec.label, spec.value, spec.unit]), [
    ['speed', 'Velocity', 58, 'm/s'], ['splitCount', 'Children', 6, ''], ['splitDelay', 'Split delay', 0.45, 's'],
    ['fuse', 'Child fuse', 0.65, 's'], ['blastRadius', 'Child blast radius', 2.2, 'm'],
  ]);
  assert.deepEqual(card.statuses.map(status => [status.element, Number(status.dps!.toFixed(9))]), [['fire', 40.8], ['corrosive', 24.48]]);
  for (const status of card.statuses) {
    assert.ok(Math.abs(status.chancePercent - (1 - 0.5 ** (1 / 6)) * 100) < 1e-10);
    assert.equal(status.chanceDisplay, '10.9%');
    assert.match(status.description, /per.child/i);
    assert.match(status.description, /carrier.*chance|chance.*carrier/i);
  }
  assert.ok(card.statuses.every(status => /carrier.*strength|strength.*carrier/i.test(status.description)));
  const kinetic = buildItemCard(weapon({ weapon: { ...createWeaponSpec('cluster', 'kinetic'), secondaryElement: 'shock', statusPower: 0.4, statusChance: 0.25 }, stats: { damage: 120 } }));
  assert.equal(kinetic.statuses[0].dps, null);
  assert.equal(kinetic.statuses[0].chancePercent, 0);
  assert.equal(Number(kinetic.statuses[1].dps!.toFixed(9)), 32.64);
  assert.ok(Math.abs(kinetic.statuses[1].chancePercent - (1 - 0.75 ** (1 / 6)) * 100) < 1e-10);
});

test('reload-cycle DPS uses a complete magazine and explicitly remains separate from burst DPS', () => {
  const card = buildItemCard(weapon());
  assert.equal(card.weapon?.burstDps.value, 100);
  assert.equal(card.weapon?.sustainedDps.value, 50, '200 damage over 2 seconds firing plus 2 seconds reload');
  assert.match(card.weapon!.burstDps.description, /Excludes reload, heat/);
  assert.match(card.weapon!.sustainedDps.description, /Excludes heat/);
});

test('reload and spread reward lower values while rate and magazine reward higher values', () => {
  const equipped = weapon({ weapon: { ...createWeaponSpec('bullet', 'kinetic'), spread: 0.1 }, stats: { damage: 20, fireRate: 5, magazine: 10, reload: 3 } });
  const selected = weapon({ weapon: { ...createWeaponSpec('bullet', 'kinetic'), spread: 0.01 }, stats: { damage: 20, fireRate: 4, magazine: 12, reload: 2 } });
  const card = buildItemCard(selected, equipped);
  assert.equal(metric(card, 'reload').delta?.direction, 'down');
  assert.equal(metric(card, 'reload').delta?.better, true);
  assert.equal(metric(card, 'spread').delta?.direction, 'down');
  assert.equal(metric(card, 'spread').delta?.better, true);
  assert.ok(Math.abs(metric(card, 'spread').value - 0.01 * 180 / Math.PI) < 1e-10);
  assert.equal(metric(card, 'fireRate').delta?.direction, 'down');
  assert.equal(metric(card, 'fireRate').delta?.better, false);
  assert.equal(metric(card, 'magazine').delta?.direction, 'up');
  assert.equal(metric(card, 'magazine').delta?.better, true);
});

test('identical equipment has no comparison arrows, and foreign forms or slots have no deltas', () => {
  const item = weapon();
  const card = buildItemCard(item, structuredClone(item));
  assert.equal(card.comparison, true);
  for (const row of [...card.stats, card.weapon!.burstDps, card.weapon!.sustainedDps]) {
    assert.deepEqual(row.delta, { amount: 0, direction: 'equal', better: null, display: '' });
  }
  for (const foreign of [{ ...item, target: 'mech' as const }, { ...item, slot: 'shield' as const }]) {
    const other = buildItemCard(item, foreign);
    assert.equal(other.comparison, false);
    assert.ok(other.stats.every(row => row.delta === null));
    assert.equal(other.weapon?.burstDps.delta, null);
    assert.equal(other.weapon?.sustainedDps.delta, null);
  }
});

test('periodic elements show base damage per successful proc, with real coefficients and durations', () => {
  for (const [element, coefficient, duration] of [['fire', 1, 4], ['radiation', 0.75, 5], ['corrosive', 0.6, 4], ['shock', 0.8, 2]] as const) {
    const spec = { ...createWeaponSpec('scatter', element), statusPower: 0.4, statusChance: 0.37 };
    const card = buildItemCard(weapon({ weapon: spec, stats: { damage: 100, fireRate: 20, magazine: 100, reload: 1 } }));
    assert.equal(card.status?.dps, 100 * 0.4 * coefficient);
    assert.equal(card.status?.chancePercent, 37);
    assert.equal(card.status?.duration, duration);
    assert.equal(card.status?.dpsLabel, 'DMG/s');
    assert.match(card.status!.description, /excludes vulnerability/);
  }
  assert.match(buildItemCard(weapon({ weapon: createWeaponSpec('bullet', 'corrosive') })).status!.effect, /\+30% incoming/);
});

test('status deltas compare base per-proc DPS across elements and proc chance independently', () => {
  const fire = weapon({ weapon: { ...createWeaponSpec('bullet', 'fire'), statusPower: 0.4, statusChance: 0.2 }, stats: { damage: 100 } });
  const radiation = weapon({ weapon: { ...createWeaponSpec('bullet', 'radiation'), statusPower: 0.4, statusChance: 0.4 }, stats: { damage: 100 } });
  const status = buildItemCard(radiation, fire).status!;
  assert.equal(status.dps, 30);
  assert.equal(status.dpsDelta?.amount, -10);
  assert.equal(status.dpsDelta?.direction, 'down');
  assert.equal(status.dpsDelta?.better, false);
  assert.equal(status.chanceDelta?.amount, 20);
  assert.equal(status.chanceDelta?.direction, 'up');
  assert.equal(status.chanceDelta?.better, true);
  const same = buildItemCard(radiation, structuredClone(radiation)).status!;
  for (const difference of [same.dpsDelta, same.chanceDelta]) {
    assert.deepEqual(difference, { amount: 0, direction: 'equal', better: null, display: '' });
  }
});

test('new periodic damage compares against zero while control effects never gain fake DPS arrows', () => {
  const fire = weapon({ weapon: createWeaponSpec('bullet', 'fire') });
  const kinetic = weapon();
  const added = buildItemCard(fire, kinetic).status!;
  assert.equal(added.dpsDelta?.amount, 5);
  assert.equal(added.dpsDelta?.better, true);
  assert.equal(added.chanceDelta?.amount, 35);
  const control = buildItemCard(weapon({ weapon: createWeaponSpec('bullet', 'ice') }), fire).status!;
  assert.equal(control.dpsDelta, null);
  assert.equal(control.chanceDelta?.direction, 'equal');
  assert.equal(buildItemCard(kinetic, fire).status?.chanceDelta, null);
  assert.equal(buildItemCard(fire).status?.dpsDelta, null);
  assert.equal(buildItemCard(fire, { ...kinetic, target: 'mech' }).status?.chanceDelta, null);
});

test('control elements never invent damage over time and retain their actual compact values', () => {
  const expected: Partial<Record<ElementType, { duration: number; values: string[] }>> = {
    ice: { duration: 3, values: ['55% move', 'freeze 0.8 s'] },
    gravity: { duration: 3, values: ['Pull', '65% move'] },
    adhesive: { duration: 3, values: ['60% move'] },
  };
  for (const [element, values] of Object.entries(expected)) {
    const card = buildItemCard(weapon({ weapon: createWeaponSpec('bullet', element as ElementType) }));
    assert.equal(card.status?.dps, null);
    assert.equal(card.status?.dpsDisplay, '');
    assert.equal(card.status?.duration, values.duration);
    for (const value of values.values) assert.ok(card.status!.effect.includes(value));
  }
});

test('shock cards show per-second damage rather than one half-second tick, plus existing shield and chain benefits', () => {
  const selected = weapon({ weapon: { ...createWeaponSpec('bullet', 'shock'), statusPower: 0.4, statusChance: 0.37 }, stats: { damage: 100 } });
  const fire = weapon({ weapon: { ...createWeaponSpec('bullet', 'fire'), statusPower: 0.4 }, stats: { damage: 100 } });
  const status = buildItemCard(selected, fire).status!;
  assert.equal(status.dps, 32);
  assert.equal(status.dpsDelta?.amount, -8);
  assert.equal(status.dpsDelta?.better, false);
  assert.equal(status.dpsDisplay, '32/s');
  assert.equal(status.dpsLabel, 'DMG/s');
  assert.equal(status.duration, 2);
  assert.equal(status.chancePercent, 37);
  assert.match(status.effect, /\+60% shield damage/);
  assert.match(status.effect, /chain/);
});

test('kinetic stagger is described only for the heavy projectile types that actually displace enemies', () => {
  assert.equal(buildItemCard(weapon()).status?.effect, 'Direct impact');
  for (const projectile of ['slug', 'spike', 'rocket'] as const) {
    const status = buildItemCard(weapon({ weapon: createWeaponSpec(projectile, 'kinetic') })).status!;
    assert.equal(status.effect, 'Impact stagger');
    assert.equal(status.chancePercent, 0);
    assert.equal(status.duration, 0);
    assert.equal(status.dps, null);
  }
});

test('nonweapon comparisons show only real rolled bonuses, including a lost equipped bonus', () => {
  const selected = weapon({ slot: 'shield', stats: { maxShield: 100, maxHealth: 10 }, weapon: undefined });
  const equipped = { ...selected, stats: { maxShield: 80, moveSpeed: 0.5 } };
  const card = buildItemCard(selected, equipped);
  assert.equal(card.weapon, null);
  assert.equal(card.status, null);
  assert.deepEqual(card.secondary, []);
  assert.deepEqual(card.stats.map(row => row.key), ['maxShield', 'maxHealth', 'moveSpeed']);
  assert.equal(metric(card, 'maxShield').display, '+100');
  assert.equal(metric(card, 'maxShield').delta?.amount, 20);
  assert.equal(metric(card, 'maxHealth').delta?.amount, 10);
  assert.equal(metric(card, 'moveSpeed').value, 0);
  assert.equal(metric(card, 'moveSpeed').delta?.amount, -0.5);
  assert.equal(metric(card, 'moveSpeed').delta?.better, false);
});

test('secondary data exposes only mechanics that its actual projectile path uses, with physical units', () => {
  const sticky = buildItemCard(weapon({ weapon: { ...createWeaponSpec('sticky', 'adhesive'), tracking: 2, bounces: 2 } }));
  assert.deepEqual(sticky.secondary.map(row => [row.key, row.unit]), [
    ['speed', 'm/s'], ['fuse', 's'], ['blastRadius', 'm'],
  ]);
  assert.equal(sticky.secondary.find(row => row.key === 'fuse')?.value, 1.15);
  const homing = buildItemCard(weapon({ weapon: createWeaponSpec('homing', 'ice') }));
  assert.equal(homing.secondary.find(row => row.key === 'tracking')?.unit, 'rad/s');
  const disc = buildItemCard(weapon({ weapon: createWeaponSpec('disc', 'kinetic') }));
  assert.equal(disc.secondary.find(row => row.key === 'bounces')?.value, 2);
  for (const projectile of ['beam', 'arc'] as const) {
    const instant = buildItemCard(weapon({ weapon: createWeaponSpec(projectile, 'shock') }));
    assert.ok(!instant.secondary.some(row => row.key === 'speed' || row.key === 'tracking'));
  }
});

test('legacy metadata and zero or invalid stats stay finite without mutating either item', () => {
  const selected = weapon({ weapon: undefined, stats: { damage: NaN, fireRate: Infinity, magazine: 0, reload: -1 } });
  const equipped = weapon();
  const before = structuredClone({ selected, equipped });
  const card = buildItemCard(selected, equipped);
  assert.equal(card.weapon?.burstDps.value, 0);
  assert.equal(card.weapon?.sustainedDps.value, 0);
  assert.equal(card.weapon?.pellets, 1);
  assert.equal(card.status?.element, 'kinetic');
  for (const row of [...card.stats, card.weapon!.burstDps, card.weapon!.sustainedDps]) {
    assert.ok(Number.isFinite(row.value));
    assert.ok(row.delta === null || Number.isFinite(row.delta.amount));
    assert.ok(!/NaN|Infinity/.test(row.display));
  }
  assert.deepEqual({ selected, equipped }, before);
  const emptyPower = buildItemCard(weapon({ weapon: { ...createWeaponSpec('bullet', 'fire'), statusPower: 0 } }));
  assert.equal(emptyPower.status?.dps, null);
  assert.equal(emptyPower.status?.effect, 'No status effect');
  assert.equal(emptyPower.status?.duration, 0);
});

test('small meaningful deltas never display a misleading signed zero', () => {
  const equipped = weapon({ stats: { damage: 20, fireRate: 5, magazine: 10, reload: 1.5 } });
  const selected = weapon({ stats: { damage: 20, fireRate: 5, magazine: 10, reload: 1.50001 } });
  const difference = metric(buildItemCard(selected, equipped), 'reload').delta!;
  assert.equal(difference.direction, 'up');
  assert.equal(difference.better, false);
  assert.notEqual(difference.display, '+0 s');
});

test('dual-element cards show independent per-proc rates and durations after the 15% effective damage cost', () => {
  const selected = weapon({
    weapon: { ...createWeaponSpec('scatter', 'corrosive'), secondaryElement: 'shock', statusChance: 0.4, statusPower: 0.5 },
    stats: { damage: 100, fireRate: 5, magazine: 10, reload: 2 },
  });
  const card = buildItemCard(selected);
  assert.deepEqual(card.statuses.map(status => [status.element, status.dps, status.chancePercent, status.duration]), [
    ['corrosive', 25.5, 40, 4], ['shock', 34, 40, 2],
  ]);
  assert.equal(card.status, card.statuses[0], 'Legacy primary status access remains compatible');
  assert.notEqual(card.statuses[0].color, card.statuses[1].color);
  assert.equal(card.weapon!.burstDps.value, 2550, 'Direct pellet/rate damage includes the secondary cost once and never adds status DPS');
  assert.equal(card.weapon!.damagePerPellet, 85);
  assert.ok(card.statuses.every(status => status.dpsDelta === null && status.chanceDelta === null));
});

test('kinetic primary may carry a secondary periodic or control payload without inventing kinetic status damage', () => {
  const kineticFire = weapon({ weapon: { ...createWeaponSpec('bullet', 'kinetic'), secondaryElement: 'fire', statusPower: 0.4, statusChance: 0.25 } });
  const card = buildItemCard(kineticFire);
  assert.deepEqual(card.statuses.map(status => [status.element, status.dps === null ? null : Number(status.dps.toFixed(9)), status.chancePercent, status.duration]), [
    ['kinetic', null, 0, 0], ['fire', 6.8, 25, 4],
  ]);
  const control = buildItemCard(weapon({ weapon: { ...kineticFire.weapon!, secondaryElement: 'gravity' } }));
  assert.equal(control.statuses[1].dps, null);
  assert.equal(control.statuses[1].dpsDelta, null);
  assert.equal(control.statuses[1].duration, 3);
  assert.match(control.statuses[1].effect, /Pull/);
});

test('dual comparisons follow matching elements across channel order and show a new secondary against zero', () => {
  const equipped = weapon({ weapon: { ...createWeaponSpec('bullet', 'fire'), secondaryElement: 'shock', statusPower: 0.5, statusChance: 0.2 }, stats: { damage: 100 } });
  const selected = weapon({ weapon: { ...createWeaponSpec('bullet', 'shock'), secondaryElement: 'fire', statusPower: 0.5, statusChance: 0.4 }, stats: { damage: 50 } });
  const card = buildItemCard(selected, equipped);
  assert.deepEqual(card.statuses.map(status => [status.element, status.dps, status.dpsDelta!.amount, status.chanceDelta!.amount]), [
    ['shock', 17, -17, 20], ['fire', 21.25, -21.25, 20],
  ]);
  const added = buildItemCard(weapon({ weapon: { ...createWeaponSpec('bullet', 'fire'), secondaryElement: 'corrosive' } }), weapon({ weapon: createWeaponSpec('bullet', 'fire') }));
  const secondary = added.statuses[1];
  assert.equal(secondary.dpsDelta!.amount, 2.55);
  assert.equal(secondary.dpsDelta!.better, true);
  assert.equal(secondary.chanceDelta!.amount, 35);
  assert.equal(secondary.chanceDelta!.better, true);
  const same = buildItemCard(selected, structuredClone(selected));
  assert.ok(same.statuses.every(status => status.dpsDelta?.direction === 'equal' && status.chanceDelta?.direction === 'equal'));
});

test('duplicate and invalid saved secondary elements are removed independently while stats and card inputs remain intact', () => {
  for (const secondaryElement of ['fire', 'kinetic', '__proto__', 'not-an-element', 17] as const) {
    const state = createProgression();
    const selected = weapon({ weapon: { ...createWeaponSpec('bullet', 'fire'), secondaryElement: secondaryElement as ElementType } });
    state.inventory[0] = selected;
    const restored = deserializeProgression(serializeProgression(state))!;
    assert.ok(restored);
    const item = restored.inventory[0];
    assert.deepEqual(item.stats, selected.stats);
    assert.equal(item.weapon!.secondaryElement, undefined);
    assert.deepEqual(buildItemCard(item).statuses.map(status => status.element), ['fire']);
  }
  const selected = weapon({ weapon: { ...createWeaponSpec('bullet', 'corrosive'), secondaryElement: 'ice', statusPower: 0.3 } });
  const equipped = weapon({ weapon: { ...createWeaponSpec('bullet', 'ice'), secondaryElement: 'shock' } });
  const before = structuredClone({ selected, equipped });
  Object.freeze(selected.stats); Object.freeze(selected.weapon); Object.freeze(selected);
  Object.freeze(equipped.stats); Object.freeze(equipped.weapon); Object.freeze(equipped);
  const card = buildItemCard(selected, equipped);
  assert.deepEqual(card.statuses.map(status => status.element), ['corrosive', 'ice']);
  assert.deepEqual({ selected, equipped }, before);
});
