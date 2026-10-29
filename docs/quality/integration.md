# Combat-lead integration handoff

This work adds new files only. `src/game.ts`, `src/world.ts` and `src/ui.ts` remain owned by the combat lead. The review entry point contains a **development-only structural bridge** to their internals; that bridge is not a proposed production dependency.

## Owned interfaces

| Module | Contract |
|---|---|
| `src/rendering/quality/presentation.ts` | `QualityPresentation`: attach/release equipment and actors, consume shots/impacts/reload stages, update using the simulation clock, dispose |
| `weapon.ts` | `upgradeReferenceWeapon(rig, appearance, mode) → {dispose()}`; `createReferenceWeapon(...)` returns an existing-compatible `WeaponRig` plus `quality.dispose()` |
| `actors.ts` | `decorateEnemy(root,id,heavy)` and `upgradeReferenceMech(root)` return `{group,update(time,dt,speed,fireAge,hitAge),dispose()}` |
| `statusCoating.ts` | `createQualityStatusCoating(root,element) → ElementCoating` binds to display armor without adding gameplay tags |
| `feedback.ts` | `QualityFeedback`: actual world-muzzle flash, surface-normal impacts, ground dust; fixed instanced pools |
| `src/audio/qualityAudio.ts` | `QualityAudio`: gesture unlock, mute, events, pause and disposal; `renderQualityAudioPreview()` auditions the identical graph offline |
| `target.ts` | `QUALITY_TARGET`, `applyQualityInk(comicRenderer) → restore()` uses its existing public outline setter |
| `performance.ts` | Whole multipass draw counts, submission/RAF timing and optional disjoint-safe GPU queries |

## Suggested insertion points

1. Construct `QualityPresentation({scene,camera})` once. Attach the current pilot/mech `WeaponRig` using its resolved appearance. Attach the parked mech body. Apply the optional ink preset.
2. For the delivered enemy reference, attach only to a **non-heavy flanker**. Current heavy/boss shields and rear weak points, rusher blades and combat warning meshes remain on the existing renderer. The generic `heavy` adapter parameter supports the older root-scaled fixture, not the current heavy role layout.
3. After a successful existing shot, call `quality.fire({mode,rig,muzzleIndex,element})`. Retain the existing ballistic fire call and use the same muzzle index. Suppress the old spherical muzzle flash and old synthesized shot beep when reference feedback is active.
4. Send one `quality.impact({point,normal,kind,mode,strength})` per physical impact. The review bridge coalesces target-hit plus ballistic-flash callbacks within 0.035 simulation seconds and 0.08 meters. Production should ideally expose one authoritative impact event, including cover and terrain, and avoid duplicate callbacks. Impact sounds attenuate by listener distance.
5. Start reload foley at release, insertion and bolt/breech-lock stages. The review uses start, 64% and 82% of the existing reload timeline. Geometry continues to use existing magazine, bolt, hand, breech and barrel joints/homes.
6. Call `quality.update(frame)` **after existing weapon animation and before rendering**. Provide simulation `dt/time`, pause state, mode, actual horizontal travel after collision resolution, grounded/landing state, weapon root and optional turn delta. It never writes camera aim, player position, damage or projectile state. It adds presentation motion to the weapon root that the game resets each frame.
7. Forward actual attack/hit events to `actorFire/actorHit`. The current encounter `enemy-phase:'attack'` event drives this in the review. Ranged enemy reports use distance attenuation; melee rushers retain their existing cues.
8. Create enemy coatings with `createQualityStatusCoating` while the reference display is attached. Temporary selection tags are removed synchronously before any simulation/raycast resumes. Status source/duration/tick calculations remain untouched. When toggling renderers, dispose and clear both status-effect and coating caches so normal status rendering can rebuild on the next frame.
9. Call `release(root)` **before** the existing actor/rig disposal and before rebuilding a loadout. Call `dispose()` at shutdown; restore the optional ink setting. Default factories remain available throughout.

```ts
const quality = new QualityPresentation({scene, camera});
quality.weapon(pilotRig, pilotLook.weapon, 'pilot');
quality.weapon(mechRig, mechLook.weapon, 'mech');
quality.mech(world.parkedMech);
if (enemy.role === 'flanker' && !enemy.heavy) {
  quality.enemy(enemy.mesh, enemy.id, false);
}
// After normal animateWeapon(), before comicRenderer.render():
quality.update({dt, time, paused, mode, distance, grounded, weaponRoot: weapon});
// Immediately before existing disposeEquipmentModel():
quality.release(pilotRig.group);
```

## Boundaries

- Weapon upgrades preserve exact socket parents/world matrices, muzzle count, reload-home vectors and unrelated slot/body resources. Authored decorative actor meshes cannot intercept combat raycasts. Original enemy geometry/IDs/critical flags remain authoritative.
- Full-character mech changes belong to `visualOwner:'body'`. Weapon/shield/reactor/leg slot geometry, materials and transforms remain intact, including empty-slot behavior.
- The review sets the parked root to y=0 for real foot contact. The normal world currently sometimes parks it at y=0.15: the world owner should ground that root, or pass a separate visual ground correction, during adoption. Do not offset all equipment or a collision root inside the asset factory.
- Existing weapon delivery geometry and elemental-surface tags remain in use. Element color does not recolor an entire gun or actor. No projectile speed, fuse, sweep, splash, chain, ammo, collision or stat code is changed here.
- Route the game's single sound preference to `QualityAudio.setEnabled`. Unlock from the actual sound/start gesture and disable legacy beeps while quality audio is active. The review implements this locally without editing `GameUI`.
- Pools: 64 sparks, 40 chips, 32 dust particles, eight flashes; 32 simultaneous audio voices. All effects are depth-tested and excluded from collision.
