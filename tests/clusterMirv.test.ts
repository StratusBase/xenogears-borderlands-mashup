import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createWeaponSpec, type WeaponSpec } from '../src/core/arsenal.ts';
import {
  PlayerBallistics, type BallisticCallbacks, type BallisticHit, type BallisticPresentation,
  type BallisticTarget, type BallisticWorldImpact,
} from '../src/rendering/PlayerBallistics.ts';

function fixture() {
  const scene = new THREE.Scene(), targets: BallisticTarget[] = [], covers: THREE.Object3D[] = [];
  const hits: BallisticHit[] = [], impacts: { at: number; event: Readonly<BallisticWorldImpact> }[] = [];
  let time = 0;
  const callbacks: BallisticCallbacks = {
    targets: () => targets, occluders: () => covers,
    hit: hit => { hits.push(hit); },
    worldImpact: event => { impacts.push({ at: time, event }); },
  };
  const ballistics = new PlayerBallistics(scene, callbacks);
  function box(position: [number, number, number], size: [number, number, number], id?: number) {
    const root = new THREE.Group(); root.position.set(...position);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial());
    root.add(mesh); scene.add(root);
    if (id === undefined) covers.push(root);
    else {
      mesh.userData.enemyId = id;
      targets.push({ id, root, radius: Math.max(...size) / 2 });
    }
    return mesh;
  }
  function advance(seconds: number, step = 1 / 240) {
    const frames = Math.ceil(seconds / step), dt = seconds / frames;
    for (let index = 0; index < frames; index++) { time += dt; ballistics.update(dt); }
  }
  const rounds = () => scene.children.filter(root => root.name.startsWith('player-projectile-') && root.name !== 'player-projectile-trail');
  return { scene, ballistics, callbacks, hits, impacts, box, advance, rounds,
    detonations: () => impacts.filter(impact => impact.event.phase === 'detonate'),
    dispose() {
      ballistics.clear();
      for (const root of [...scene.children]) root.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
        }
      });
      scene.clear();
    },
  };
}

function mirv(overrides: Partial<WeaponSpec> = {}): WeaponSpec {
  return { ...createWeaponSpec('cluster', 'kinetic'), spread: 0, speed: 8,
    fuse: 1.4, split: { count: 6, delay: .1, spread: .2 }, ...overrides };
}

test('MIRV carrier keeps flying past child timing fields and deploys at its own range limit', () => {
  const f = fixture(), spec = mirv({ fuse: .5, split: { count: 6, delay: .05, spread: .2 } });
  try {
    f.ballistics.fire(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, 0, -1), spec, 70, 10);
    f.advance(.6);
    assert.equal(f.ballistics.activeCount, 1, 'Child fuse and stagger metadata must not split the carrier in mid-flight');
    assert.equal(f.detonations().length, 0);
    f.advance(.7);
    assert.equal(f.detonations().length, 1, 'A carrier reaching its finite travel limit must deploy its payload');
    assert.equal(f.ballistics.activeCount, 6);
    f.advance(2);
    assert.equal(f.detonations().length, 7);
    assert.equal(f.ballistics.activeCount, 0);
  } finally { f.dispose(); }
});

test('MIRV has a damaging parent stage, a quiet child flight interval, and staggered secondary detonations', () => {
  const f = fixture(), spec = mirv();
  try {
    f.ballistics.fire(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, 0, -1), spec, 70, .8);
    assert.equal(f.ballistics.activeCount, 1, 'The trigger launches one carrier, not muzzle scatter');
    f.advance(.12);
    assert.equal(f.detonations().length, 1, 'The carrier must produce the first real detonation');
    assert.equal(f.ballistics.activeCount, 6, 'One finite payload is released by the parent');
    f.advance(.25);
    assert.equal(f.detonations().length, 1, 'Bomblets must remain physical objects before their fuses expire');
    assert.equal(f.ballistics.activeCount, 6);
    f.advance(3);
    const detonations = f.detonations();
    assert.equal(detonations.length, 7, 'One parent and six bomblets must each detonate once');
    assert.ok(detonations.slice(1).every(value => value.at > detonations[0].at + .25));
    assert.ok(detonations.at(-1)!.at - detonations[1].at > .01, 'Secondary bursts should have a readable cadence');
    assert.equal(new Set(detonations.map(value => value.event.projectileId)).size, 7);
    assert.equal(f.ballistics.activeCount, 0);
    f.advance(3);
    assert.equal(f.detonations().length, 7, 'Bomblets must not release another generation');
  } finally { f.dispose(); }
});

test('MIRV bomblets fall and rebound from a real mesh without contact damage or premature elemental impacts', () => {
  const f = fixture();
  // A very wide, thin damageable slab makes every floor contact observable:
  // the same mesh is an actual collision target, not an invented y=0 fallback.
  f.box([0, -.05, 0], [80, .1, 80], 1);
  const spec = mirv({ element: 'fire', secondaryElement: 'corrosive', fuse: 3,
    split: { count: 6, delay: 5, spread: .2 } });
  try {
    f.ballistics.fire(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), spec, 70);
    f.advance(.17);
    assert.equal(f.detonations().length, 1, 'Impact should detonate the carrier before its timeout');
    assert.equal(f.hits.length, 1, 'The parent blast is the only initial damage stage');
    const parent = f.detonations()[0].event.projectileId;
    const previous = new Map<string, number>(), descending = new Set<string>(), rebounded = new Set<string>();
    for (let frame = 0; frame < 312; frame++) {
      f.advance(1 / 240);
      for (const root of f.rounds()) {
        const before = previous.get(root.uuid), y = root.position.y;
        assert.ok(y >= -.03, 'A finite floor must stop bomblets rather than let them tunnel below it');
        if (before !== undefined && y < before - 1e-5) descending.add(root.uuid);
        if (before !== undefined && descending.has(root.uuid) && y > before + 1e-5) rebounded.add(root.uuid);
        previous.set(root.uuid, y);
      }
    }
    assert.ok(descending.size > 0, 'The bomblets must visibly fall under gravity');
    assert.ok(rebounded.size > 0, 'At least one descending bomblet must physically bounce');
    assert.equal(f.detonations().length, 1, 'Harmless rebounds must not become explosions');
    assert.equal(f.hits.length, 1, 'Rebounds must not emit direct-hit or blast damage');
    assert.equal(f.impacts.filter(value => value.event.projectileId !== parent).length, 0,
      'Physical bounces must not start elemental impact effects or gravity wells');
    f.advance(9);
    assert.equal(f.detonations().length, 7);
    assert.equal(f.ballistics.activeCount, 0);
  } finally { f.dispose(); }
});

test('MIRV shares exactly one trigger budget across parent plus bomblets for both forms, without critical hits', () => {
  for (const mode of ['pilot', 'mech'] as const) {
    const f = fixture(), spec = { ...createWeaponSpec('cluster', 'kinetic', mode), spread: 0,
      speed: 8, fuse: 1, split: { ...createWeaponSpec('cluster', 'kinetic', mode).split!, delay: .1 } };
    // Enclose every burst in one artificial target so falloff and missed area
    // cannot obscure accounting. Practical area coverage is tested separately.
    const mesh = f.box([0, 3, -3], [100, 100, 100], 1); mesh.userData.critical = true;
    try {
      f.ballistics.fire(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, 0, -1), spec, 126, .8);
      f.advance(3);
      const packets = spec.split!.count + 1;
      assert.equal(f.hits.length, packets);
      assert.ok(f.hits.every(hit => Math.abs(hit.damage - 126 / packets) < 1e-7));
      assert.ok(Math.abs(f.hits.reduce((sum, hit) => sum + hit.damage, 0) - 126) < 1e-7);
      assert.ok(f.hits.every(hit => !hit.critical), 'Splash packets must never receive a direct-hit headshot flag');
      assert.equal(f.ballistics.activeCount, 0);
    } finally { f.dispose(); }
  }
});

test('parent and bomblet explosions retain the original deeply frozen, independent elemental payload', () => {
  const f = fixture(); f.box([0, 3, -3], [100, 100, 100], 1);
  const spec = mirv({ element: 'fire', secondaryElement: 'shock', statusChance: .35 });
  try {
    f.ballistics.fire(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, 0, -1), spec, 70, .8);
    spec.element = 'ice'; spec.secondaryElement = 'corrosive';
    spec.split!.count = 12; spec.split!.delay = 5; spec.fuse = 0;
    f.advance(3);
    assert.equal(f.hits.length, 7);
    assert.ok(f.hits.every(hit => hit.spec.element === 'fire' && hit.spec.secondaryElement === 'shock'));
    assert.ok(f.hits.every(hit => Object.isFrozen(hit.spec) && Object.isFrozen(hit.spec.split)));
    assert.ok(f.hits.every(hit => hit.spec.split!.count === 6 && hit.spec.fuse === 1.4));
    assert.ok(f.hits.every(hit => Math.abs(hit.damage - 10) < 1e-7));
  } finally { f.dispose(); }
});

test('MIRV parent and delayed bomblet splash cannot pass through real thin cover', () => {
  const f = fixture();
  f.box([0, -.05, 0], [80, .1, 80]);
  f.box([0, 3, -4], [40, 10, .04]);
  f.box([1, 1, -3], [.7, 1.8, .7], 1);
  f.box([0, 1, -5], [.7, 1.8, .7], 2);
  try {
    f.ballistics.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -1),
      mirv({ speed: 10, blastRadius: 4, split: { count: 6, delay: 5, spread: .2 } }), 70, 50);
    f.advance(8);
    assert.ok(f.hits.some(hit => hit.targetId === 1), 'The exposed side must receive a genuine parent/bomblet blast');
    assert.ok(f.hits.every(hit => hit.targetId !== 2), 'No individual stage may damage the covered target');
    assert.equal(f.ballistics.activeCount, 0);
  } finally { f.dispose(); }
});

test('pausing freezes the physical MIRV stage and clear cancels all remaining delayed blasts', () => {
  const f = fixture(); f.box([0, -.05, 0], [80, .1, 80]);
  try {
    f.ballistics.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -1), mirv(), 70, .8);
    f.advance(.3);
    assert.equal(f.ballistics.activeCount, 6);
    const positions = f.rounds().map(root => root.position.toArray()), count = f.detonations().length;
    for (const dt of [0, -1, NaN, Infinity]) f.ballistics.update(dt);
    assert.deepEqual(f.rounds().map(root => root.position.toArray()), positions);
    assert.equal(f.detonations().length, count);
    f.ballistics.clear();
    assert.equal(f.ballistics.activeCount, 0); assert.equal(f.ballistics.effectCount, 0);
    f.advance(8);
    assert.equal(f.detonations().length, count);
    assert.equal(f.hits.length, 0);
  } finally { f.dispose(); }
});

test('clear from the authoritative parent detonation cannot revive its payload or deliver parent damage', () => {
  const f = fixture(); f.box([0, 3, -3], [100, 100, 100], 1);
  let notified = 0;
  f.callbacks.worldImpact = event => { if (event.phase === 'detonate') { notified++; f.ballistics.clear(); } };
  try {
    f.ballistics.fire(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, 0, -1), mirv(), 70, .8);
    f.advance(4);
    assert.equal(notified, 1);
    assert.equal(f.hits.length, 0);
    assert.equal(f.ballistics.activeCount, 0); assert.equal(f.ballistics.effectCount, 0);
  } finally { f.dispose(); }
});

test('clear from one bomblet presentation cancels its splash and every remaining sibling', () => {
  const f = fixture(); f.box([0, 3, -3], [100, 100, 100], 1);
  let detonations = 0;
  const presenter: BallisticPresentation = {
    projectile: () => new THREE.Group(), trail: () => new THREE.Group(), beam: () => new THREE.Group(),
    impact(event) { if (event.phase === 'detonate' && ++detonations === 2) f.ballistics.clear(); },
  };
  f.ballistics.setPresentation(presenter);
  try {
    f.ballistics.fire(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, 0, -1), mirv(), 70, .8);
    f.advance(4);
    assert.equal(detonations, 2);
    assert.equal(f.hits.length, 1, 'Only the completed parent blast may have applied damage');
    assert.equal(f.ballistics.activeCount, 0); assert.equal(f.ballistics.effectCount, 0);
  } finally { f.dispose(); }
});

test('optional split metadata on a noncluster projectile retains its forward-only, damage-free carrier', () => {
  const f = fixture(); f.box([0, 2, -4], [6, 6, 1], 1);
  const spec: WeaponSpec = { ...createWeaponSpec('bullet', 'kinetic'), speed: 20, spread: 0, fuse: .6,
    split: { count: 4, delay: .1, spread: 0 } };
  try {
    f.ballistics.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -1), spec, 80);
    f.advance(.12);
    assert.equal(f.detonations().length, 0);
    assert.equal(f.hits.length, 0);
    assert.equal(f.ballistics.activeCount, 4);
    assert.ok(f.rounds().every(root => root.position.z < -2 && Math.abs(root.position.x) < 1e-8 && Math.abs(root.position.y - 2) < 1e-8));
    f.advance(1);
    assert.equal(f.hits.length, 4);
    assert.ok(f.hits.every(hit => hit.damage === 20));
    assert.equal(f.ballistics.activeCount, 0);
  } finally { f.dispose(); }
});


test('MIRV trajectory and detonation cadence stay independent from either elemental channel', () => {
  function observe(element: WeaponSpec['element'], secondaryElement?: WeaponSpec['secondaryElement']) {
    const f = fixture(); f.box([0, -.05, 0], [80, .1, 80]);
    try {
      const spec = mirv({ element, secondaryElement, speed: 20 });
      f.ballistics.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -1), spec, 70, 2);
      const positions: number[][][] = [];
      for (let index = 0; index < 60; index++) { f.advance(.05); positions.push(f.rounds().map(root => root.position.toArray())); }
      return { positions, events: f.detonations().map(({at,event}) => ({ at, id:event.projectileId, point:event.point, radius:event.radius, energy:event.energy, stage:event.stage })) };
    } finally { f.dispose(); }
  }
  const baseline = observe('kinetic');
  for (const element of ['fire','ice','corrosive','shock','radiation','gravity','adhesive'] as const) assert.deepEqual(observe(element), baseline, element);
  assert.deepEqual(observe('fire','corrosive'), baseline);
  assert.deepEqual(observe('kinetic','shock'), baseline);
});

test('clear from a bomblet trail factory cannot revive effects or emit a stale detonation', () => {
  const f = fixture(); let cleared = false, disposed = 0;
  try {
    f.ballistics.setPresentation({
      projectile: () => new THREE.Group(), beam: () => new THREE.Group(), impact() {},
      trail(_a,_b,_spec,_brand,role) {
        const root = new THREE.Group();
        const geometry = new THREE.BoxGeometry(.1,.1,.1); geometry.addEventListener('dispose',()=>disposed++);
        root.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial()));
        if (role === 'bomblet' && !cleared) { cleared = true; f.ballistics.clear(); }
        return root;
      },
    });
    f.ballistics.fire(new THREE.Vector3(0, 3, 0),new THREE.Vector3(0,0,-1),mirv(),70,.8);
    f.advance(3);
    assert.ok(cleared); assert.ok(disposed > 0);
    assert.equal(f.detonations().length,1,'Only the already-completed parent detonation is allowed');
    assert.equal(f.ballistics.activeCount,0); assert.equal(f.ballistics.effectCount,0);
  } finally { f.dispose(); }
});

test('MIRV launch and rebound clearance cannot teleport bomblets through a low overhang', () => {
  const f = fixture();
  f.box([0,-.05,0],[30,.1,30]);
  f.box([0,.15,0],[30,.02,30]);
  f.box([0,.6,0],[30,.1,30],1);
  try {
    f.ballistics.fire(new THREE.Vector3(0,.08,0),new THREE.Vector3(0,-1,0),mirv(),70);
    f.advance(3);
    assert.equal(f.hits.length,0,'Neither the burst nor any bomblet may cross the actual ceiling');
    assert.equal(f.ballistics.activeCount,0);
  } finally { f.dispose(); }
});

test('MIRV spawn clearance cannot jump the opposite wall of a narrow physical gap', () => {
  const f = fixture();
  f.box([0,2,-.2],[30,30,.01]);
  f.box([0,2,-.07],[30,30,.01]);
  f.box([0,2,.5],[20,20,.1],1);
  try {
    f.ballistics.fire(new THREE.Vector3(0,2,-.13),new THREE.Vector3(0,0,-1),mirv(),70);
    f.advance(3);
    assert.equal(f.hits.length,0,'The opposite wall must block every release and subsequent blast');
    assert.equal(f.ballistics.activeCount,0);
  } finally { f.dispose(); }
});

test('MIRV settles on real static cover and detonates at that stationary support', () => {
  const f = fixture(); f.box([0,-.05,0],[80,.1,80]);
  try {
    f.ballistics.fire(new THREE.Vector3(0,.6,0),new THREE.Vector3(0,-1,0),mirv({fuse:3,split:{count:6,delay:1,spread:.2}}),70);
    f.advance(1.7);
    const settled = f.rounds().filter(root=>root.userData.clusterSettled);
    assert.ok(settled.length>0,'Static floor contacts must enter the real settled state');
    const positions = settled.map(root=>root.position.toArray());
    f.advance(.2);
    assert.deepEqual(settled.map(root=>root.position.toArray()),positions,'Settled bomblets cannot drift during their fuse');
    f.advance(5);
    for (const point of positions) assert.ok(f.detonations().some(({event})=>new THREE.Vector3(event.point.x,event.point.y,event.point.z).distanceTo(new THREE.Vector3(...point))<1e-8));
    assert.equal(f.ballistics.activeCount,0);
  } finally { f.dispose(); }
});

test('malformed saved Cluster counts normalize once without overrunning the damage budget', () => {
  for (const count of [1,2.5,13,NaN,Infinity]) {
    const f=fixture(); f.box([0,3,-3],[100,100,100],1);
    try {
      const spec=mirv({split:{count,delay:.1,spread:.2}}), before=structuredClone(spec);
      f.ballistics.fire(new THREE.Vector3(0,3,0),new THREE.Vector3(0,0,-1),spec,70,.8);
      f.advance(3);
      assert.ok(f.hits.length>1,'A normalized Cluster item must not become a silent dud');
      assert.ok(Math.abs(f.hits.reduce((sum,hit)=>sum+hit.damage,0)-70)<1e-7);
      assert.equal(f.hits.length,f.hits[0].spec.split!.count+1);
      assert.deepEqual(spec,before,'Normalization cannot mutate caller metadata');
    } finally {f.dispose();}
  }
});

test('a Cluster muzzle inside solid cover cannot deploy from its far face',()=>{
  const f=fixture(); f.box([0,2,-4],[30,30,.04]); f.box([0,2,-5],[1,1,1],1);
  try {
    f.ballistics.fire(new THREE.Vector3(0,2,-4),new THREE.Vector3(0,0,-1),mirv(),70);
    f.advance(3);
    assert.equal(f.hits.length,0);assert.equal(f.ballistics.activeCount,0);
  } finally {f.dispose();}
});

test('double-sided planar cover still deploys MIRV when struck from its back side',()=>{
  const f=fixture();
  const wall=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshBasicMaterial());wall.position.z=-1;f.scene.add(wall);
  f.callbacks.occluders=()=>[wall];
  try {
    f.ballistics.fire(new THREE.Vector3(0,2,-2),new THREE.Vector3(0,0,1),mirv(),70,3);
    f.advance(3);
    assert.equal(f.detonations().length,7,'An open plane back face is a real contact, not proof of an embedded muzzle');
    assert.ok(f.detonations().every(({event})=>event.point.z < -1),'All blasts must stay on the incoming side');
    assert.equal(f.ballistics.activeCount,0);
  } finally {f.dispose();}
});
