# Main-game presentation integration

The normal `/` entry now selects Enhanced visuals and sound. Pause → **Visuals** switches between Enhanced and Legacy without changing saves, equipped gear or active shots. Pause → **Sound** controls both audio layers. The combat lead integrated `game.ts`, `world.ts` and `ui.ts`; asset modules remain independently owned.

## Production interface

`src/rendering/quality/GamePresentation.ts` owns reversible visual/audio bindings. It consumes authoritative game events; it does not drive combat. Its constructor starts disabled, then `Game` selects the requested mode (`GameOptions.presentation`, default `quality`).

```ts
const presentation = new GamePresentation({
  scene, camera, weaponRoot: weapon, ballistics, comicRenderer,
});
presentation.setEnabled(options.presentation !== 'legacy');
presentation.equipment({pilotRig, mechRig, pilotLook, mechLook, parkedMech});
presentation.enemy({root: enemy.mesh, id: enemy.id, role: enemy.role, heavy: enemy.heavy});
// After an authoritative successful shot, using the same rig/socket:
presentation.shot({mode, rig, muzzleIndex, spec});
// Once per simulation tick, with actual resolved horizontal travel:
presentation.update({dt, time, paused, mode, distance, grounded, landed, turn, spec});
```

Other event methods: `reload(mode, 'out'|'in'|'bolt')`, `dry(mode)`, `mount(mode)`, `enemyAttack(root,mode)`, `enemyHit(root)`, and `status(root,element)`. A returned status has `update`, `dispose`, and optional `setIntensity`; it replaces the legacy particle/coating pair with one presentation object. Combat still owns status creation, expiry, damage and stacking.

`Game.presentationMode`, `setPresentationMode(mode)` and `presentationDiagnostics` expose the reversible integration without a private-field bridge. The older review labs explicitly request Legacy and install their own review controller. Only their diagnostic fixtures use structural access.

## Lifecycle and ownership

- Release visual bindings **before** original actor/rig disposal or rebuilding gear. Clear status presentation caches when switching modes; retain authoritative status state.
- On disable, detach the ballistic adapter, dispose elemental bindings and quality assets, then restore ink. Active shots retain their captured presenter through expiry.
- Use one game sound preference for physical and elemental audio. Call `unlockAudio()` from the real start/resume/sound gesture. Pause stops loops/tails. Initialization failure is recorded in diagnostics.
- Only non-heavy flankers receive the single-optic reference model. Rushers, heavy shields/rear cores and boss warning cues retain their role renderer. Melee rushers do not acquire firearm reports.
- Park the mech at y=0. Its articulated soles contact the ground without changing collider layout. Body upgrades leave weapon/shield/reactor/legs independent.
- Socket parents, muzzle counts, reload homes, authoritative hit geometry and enemy tags remain game-owned. Decorative geometry does not intercept combat raycasts.

## Simulation clock

`SimulationWeaponPose` owns recoil decay and authored weapon/reload/recovery articulation. Drawing does not advance these states. The production presentation deliberately does **not** apply its optional extra offsets to the authoritative weapon root. This prevents presentation cost and draw cadence from changing muzzle positions or hits.

Equipment effects, actor feedback and status animations also receive simulation time. The full encounter diagnostic captures every fired origin, direction, aim point and specification and compares Enhanced against Legacy. See [main-game validation](main-integration.md) for the current results and retained initial failure.

## Reusable modules

| Module | Responsibility |
|---|---|
| `presentation.ts` | Reference equipment/actor bindings, physical feedback and audio |
| `weapon.ts`, `actors.ts` | Reversible meshes/materials and articulated hierarchy |
| `feedback.ts` | Fixed pools for flashes, sparks, chips and dust |
| `target.ts` | Reversible 1.85 CSS-pixel outline preset |
| `elementalPresentation.ts` | Equipment, flight, contact, lingering status and elemental audio |
| `performance.ts` | Full multipass draws, CPU submission, frame intervals and disjoint-safe GPU queries |

Physical pools hold 64 sparks, 40 chips, 32 dust particles and eight flashes. Elemental impact pools and audio limits are described in [elemental integration](elemental-integration.md). Legacy factories remain available.
