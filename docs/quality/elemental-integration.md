# Elemental presentation integration

The combat lead has integrated the pass into the normal Game through `GamePresentation`; Enhanced is the default and Legacy remains selectable. `game.ts`, `world.ts`, and `ui.ts` remain combat-lead owned. See [production ownership and lifecycle](integration.md) and [current main-game validation](main-integration.md). The older `qualityLab.ts` bridge remains a development-only comparison tool.

## Public interface

```ts
const elements = new ElementalPresentation(scene, camera);
ballistics.setPresentation(elements);
elements.weapon(pilotRig.group, pilotLook.weapon);
elements.weapon(mechRig.group, mechLook.weapon);
elements.weapon(world.parkedMech, mechLook.weapon);
```

`ElementalPresentation` implements `BallisticPresentation`: projectile/trail/beam factories, child-only projectile animation and a physical impact callback. The existing `PlayerBallistics` owns every trajectory, velocity, sweep, reflection, fuse, target, damage call, chain and splash calculation. Its default factories are retained. `setPresentation(undefined)` restores the default for new shots and rays; active projectiles keep their captured presenter until expiry. This never clears live shots.

`BallisticPresentationImpact` includes a copied world point/normal, immutable recipe, radius, optional target root and `contact`/`detonate` phase. It is emitted from the authoritative collision branch, including terrain/cover and sticky contact. Generic legacy flash output is suppressed for shots with the adapter, preventing duplicate elemental impacts. Contact and delayed detonation remain separate authored cues. Cosmetic callbacks do not write to the recipe, target or simulation state.

After a successful existing fire call, keep the physical weapon report and call:

```ts
elements.shot(actualWeaponSpec, mode);
```

During normal simulation/render updates:

```ts
elements.update(dt, time, paused, actualWeaponSpec, mode);
```

Use simulation delta/time. Zero delta and pause freeze effects; pause cancels audio tails. Existing weapon pose and muzzle handling remain authoritative. Audio unlock must occur within the user's start/sound gesture; use `elements.audio.unlock()` and route the sound preference to `setEnabled()`.

## Equipment and lingering effects

`ElementalPresentation` installs a reversible shared `setEquipmentEffectFactory` callback. Existing `updateEquipmentEffects` calls in equipped rigs, parked mechs, previews, dropped gear and vending displays acquire new effects automatically. Explicit root bindings take priority. No UI edits are required. Only declared weapon-owned elemental bands/chambers can acquire substrate material changes; disposal restores their exact original instances. Shared texture/resource ownership remains with its original owner.

When an authoritative status begins, replace the legacy particle/coating pair with **one** `ElementalStatus`:

```ts
const visual = elements.status(target.mesh, element);
// Store this visual in the existing statusEffects map; it has update/dispose.
// Dispose/remove the old ElementEffects and ElementCoating instances.
visual.update(dt, time);
```

The game can continue to call the existing effect's `update` and `dispose` methods. The presentation never applies, extends, stacks, ticks or expires a combat status. Optional `setIntensity(Math.min(1, remaining / .2))` fades the final 0.2 seconds from authoritative remaining duration. Do not create a second new status instance in `statusCoatings`; one contains the surface response and restrained accents. Nearest target distance is aggregated once per element for lingering audio.

Release equipment and status presentations **before** rebuilding or disposing their original roots. Shutdown order:

```ts
ballistics.setPresentation(undefined);
elements.dispose();
```

The shared equipment factory restores the previous registration. `ElementalEquipment`, `ElementalStatus`, `ElementalImpacts` and `ElementalAudio` are also independently reusable. Cosmetic instance pools and borrowed armor overlays do not raycast, cast shadows, enlarge collision targets or acquire enemy IDs.

## Ownership and caps

- `elementalFlight.ts`: physical projectile silhouette plus localized payload, delivery-specific trails/beams, child-only animation.
- `elementalSurfaces.ts`: tagged equipment material response and sparse armor lingering effects; borrowed source geometry is never disposed.
- `elementalImpacts.ts`: seven fixed instanced pools: 48 patches, 80 shards, 64 droplets, 96 sparks, 32 rings, 32 strands and 64 flame pieces. Surface patches/adhesive threads can follow the actual target transform.
- `elementalAudio.ts`: seven elemental signatures plus kinetic control, six lifecycle phases, cached deterministic textures, 32 voices and 14 bounded loops. Physical reports remain separate.
- `PlayerBallistics.ts` and `equipmentEffects.ts`: optional presentation seams, with legacy behavior retained and covered by regressions.

See [verification and captures](elemental-pass.md) for the complete evidence and hardware limits.
