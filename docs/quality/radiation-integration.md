# Radiation in normal gameplay

Integrated 30 October 2026 on the user's explicit approval. The normal `index.html` → `src/main.ts` → `Game` → `GamePresentation` path now uses `createGameElements` from `src/rendering/quality/gameElements.ts`. That single registry composes the approved full Fire and Radiation replacements with the existing corrosive response and fallback channels. Legacy remains reversible. Existing standalone review renderers remain usable.

## Integration contract

`ElementModule` has optional impact/audio, flight, equipment, status and confirmed-pulse replacement capabilities. The shared coordinator excludes replaced channels from generic rendering while retaining their original primary/secondary identities, physical carriers and unrelated channels. One base lifecycle owns equipment, cached statuses and audio. Production modules register at the common root rather than replacing another element's factory.

`GamePresentation.handlesPulse(element)` reports support; `confirmedPulse(event)` consumes a presentation-only `ConfirmedElementPulse`:

```ts
{ element, point, energy, radius,
  recipients: readonly {target, point, normal, exposure}[] }
```

The existing irradiated-death path in `Game.hurtEnemy` still decides irradiation, death, loot, radius (5 m), line of sight, uniform damage (18% of the dead enemy's maximum health), recipient order and recursive kills. It collects only actual positive-damage recipients, then notifies presentation. The new renderer performs no recipient search or damage/status application. Exposure is 1 because this combat rule has no distance falloff. Ordinary death feedback stays; only the old radiation-specific 14-particle burst is suppressed when the replacement is available. Legacy executes that original fallback at the original point in the combat order.

The user authorized this small `src/game.ts` integration. `src/world.ts` and `src/ui.ts` were not edited for Radiation.

## Normal-game verification controls

`/?verifyRadiation=1` adds explicit review controls to the normal main entry, with a separate save and deterministic equipment/target fixtures. The integrated arm resets to the **production default factory**, never a special radiation lab renderer. The baseline removes only the Radiation registration from the same production registry, keeping Fire/corrosive and all shared code in the same compiled build. The ordinary URL has no review controls or evaluation driver and continues to use normal saves/input.

The fixtures use actual native Game enemies, ballistic collision, firing cadence, reload, status clocks, death, drops and damage. Sustained-fire fixtures raise enemy health to keep the scene populated. The death scene has normal-sized intact targets, a 60-health source, nearby recipients, a real occluder and an out-of-range recipient. Review health/positions are explicitly fixtures; no gameplay rules are changed. The native-encounter control leaves fixture stepping and resumes ordinary encounter AI and input.

See [integration verification](radiation-main-verification.md) for measurements, sound recordings, screenshots and coverage. The earlier [radiation visual finish](radiation-verification.md) is preserved as the separate approved-art comparison, not reused as integration performance evidence.
