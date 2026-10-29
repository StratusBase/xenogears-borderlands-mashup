# Approved corrosion in the normal game

The later [horizontal-surface correction](corrosive-horizontal-surfaces.md) fixes floor clipping and elevated-surface settling while retaining the approved wall response. The integration receipt below remains its earlier build.

29 October 2026. The approved directional response is now selected by the normal Enhanced presentation. Previously it was enabled only by the corrosive review lab's custom factory, so approving and committing its assets did not enable them in the user's normal game.

`GamePresentation` now constructs its default `ElementalPresentation` with `corrosiveAB:true`. The normal `/` entry already enables Enhanced presentation; no edits to `game.ts`, `world.ts`, `ui.ts` or `main.ts` are required. Refresh an existing game page and keep **VISUALS / ENHANCED** selected. Low-level standalone presentation defaults and explicit lab factories remain available for comparisons. The existing Legacy toggle remains reversible.

Normal targets also need visible surface sources. The selector now recognizes physical armor on the permanent dummy, rushers and shielded heavies, alongside the reference flanker display. It excludes invisible proxies, hidden ancestors, equipment-slot descendants, weapon parts, optics and warning geometry. Explicit skin/cloth/armor bindings keep their precedence. The old six-source cutoff no longer drops the heavy's front shield or the dummy's outer target faces. Source geometry, materials, transforms, hit tags and raycast functions remain unchanged.

## Verification

- **649 tests pass**, including a new production-controller regression covering default activation, the real dummy and all three enemy roles, visible coating, proxy/weapon isolation, resource identity and Legacy restoration. Existing tests cover sizing, secondary splash transforms/falloff, all 13 projectile families, actual Game simulation clocks and equipment slots.
- `npm run build` passes; the existing large-bundle advisory remains.
- Actual compiled normal `/` gameplay was exercised on port 5204 using ordinary workbench/equip, arrow-key aim and mouse fire. A corrosive rocket consumed one round and hit the real dummy for **73.22**, with a live **11 DMG/s** corrosive condition. The capture shows the directional splash and localized coating, rather than a custom lab fixture.
- Enhanced → Legacy → Enhanced was verified through the ordinary pause menu. No renderer/page errors were recorded. Mouse capture was denied by the automated browser after a focus transition; the game's existing fallback controls were used.
- [Actual normal-game impact](../../artifacts/corrosive-ab/normal-main/impact.jpg), [observed HUD](../../artifacts/corrosive-ab/normal-main/observed.json), [browser checks](../../artifacts/corrosive-ab/normal-main/browser-check.json), [compiled hashes and test receipt](../../artifacts/corrosive-ab/normal-main/verification.json).

The approved sizing/motion and audio recipes are unchanged. This integration check is functional evidence; it is not a new performance benchmark. The earlier matched motion benchmarks remain frozen in [the prototype report](corrosive-prototype.md). No combat rules, saves or loadout items were migrated. Unrelated damage-number UI edits were excluded. No push or deployment was performed.
