# Effects architecture and organization

Recorded 30 October 2026 at the user's explicit request for persistent organization guidance: keep effects DRY, open/closed, extensible and composable while keeping files organized. This is the guide for new effects work and incremental shared extraction. The gravity prototype now supplies the concrete shared extraction and composition listed below; production integration remains an explicit handoff.

## Core rule

**One gameplay authority, one presentation lifecycle, one shared audio engine; distinct element modules composed through explicit contracts.** Share common mechanisms and let each element own its visual language and gameplay rules. Reuse does not require every effect to look alike or have the same sizing curve.

```text
Gameplay simulation / collision / damage
            |
     authoritative events + snapshots
            |
      GamePresentation (lifecycle)
            |
   ElementalPresentation (composition / routing)
       |             |              |
    corrosive       gravity      other elements
       +-------------+--------------+
              shared rendering helpers

   composed element recipes -> existing ElementalAudio engine
```

Simulation contracts use plain data and stable identities. Gameplay must not depend on Three.js meshes, shaders, WebAudio, DOM, cameras or the visible/legacy mode. Presentation can reference gameplay contracts, but does not apply damage or move authoritative targets. There is no second renderer-owned field simulation that independently decides membership or ticks damage.

## Current layout for incremental work

```text
src/core/effects/                    # add as gameplay modules are needed
  contracts.ts                      # renderer-independent events, IDs and state
  shared/                           # genuinely reusable simulation mechanisms
  gravity/                          # well rules, tuning, 3D capture/release

src/rendering/quality/
  GamePresentation.ts               # existing lifecycle / production entry seam
  elementalPresentation.ts          # existing coordinator; keep it thin
  shared/                           # extracted common presentation mechanisms
  corrosive/                        # corrosive-specific material and motion
  ice/                              # ice-specific material and motion
  shock/                            # shock-specific material and motion
  gravity/                          # core, inward folds, capture accents
  ...existing common modules...     # retain paths until coordinated extraction

src/audio/
  elementalAudio.ts                 # existing engine, buses, scheduling and caps
  qualityAudio.ts                   # existing physical weapon/motion engine
  <element>Audio.ts                 # thin recipes/profiles, not new engines

src/dev/effects/                    # new review fixtures / element labs
  shared/                           # reused human targets, capture and review UI
  <element>/                        # element-specific scenarios

public/assets/effects/              # if nonprocedural runtime assets are needed
  shared/                           # textures/atlases actually used by >1 element
  <element>/                        # owned sprites/textures/audio and attribution

docs/quality/<element>-design.md     # canonical mechanic / art target
docs/quality/<element>-integration.md# interface, ownership and handoff
docs/quality/<element>-*.md          # review receipts / limitations
artifacts/<element>/                # ignored generated captures and measurements
artifacts/concepts/<element>-*/     # ignored generated concepts and prompts
```

Only create modules that have a concrete role; do not scaffold empty hierarchies or a large generic engine in advance. Small element implementations need not have every possible file. Name files by responsibility (`response`, `surfaces`, `sizing`, `paths`, `field`), not numbered revisions or vague `utils`/`helpers` buckets. Each element may have one narrow public entry; avoid a project-wide re-export barrel that couples every shader to every import.

The current test command discovers `tests/*.test.ts`. Keep new tests discoverable under that convention (for example `gravityField.test.ts` and `effectSurfaceFrame.test.ts`) until test discovery is deliberately updated. Do not move tests into nested folders and silently stop running them. Existing labs and root HTML entries remain usable during gradual relocation.

The separate [project structure proposal](project-structure-proposal.md) has not moved this code into workspaces. When that migration is approved, map gameplay rules to `packages/simulation` and browser art/audio/dev code to `apps/client`; keep shared plain contracts independent of the browser. Do not start the workspace move or multiplayer as part of gravity.

## Share mechanisms, retain element identity

| Share when the semantics match | Keep with each element |
|---|---|
| World/local contact transforms, outward normals and surface pose sampling | Corrosive liquid curls, ice release motion, shock branches, gravity pressure folds |
| Visible outer-surface selection, equipment exclusion and borrowed overlay ownership | Wet/pitted corrosion, frost/rime, live-wire charge and pressure/lens materials |
| Bounded pooling, lifecycle cleanup, deterministic cosmetic RNG and budgets | Element-specific particle shapes, count limits, timing curves and LOD choices |
| Common shot energy/exposure/channel inputs and numerical validation | Actual size curves, primary/secondary balance and material response |
| Existing audio buses, voice scheduling, attenuation, pause/unlock and recording taps | Per-element sound recipes and phase timing |
| Real-Game human fixtures, screenshot/capture plumbing and performance statistics | Scenes and assertions proving the selected element's particular behavior |

Reuse existing `surfacePoseCache.ts`, `primitives.ts`, `performance.ts`, `elementalAudio.ts` and established presentation seams before creating alternatives. Do not create per-element copies of those services.

Implemented extraction: `quality/shared/surfaces.ts` owns visible-surface selection and `quality/shared/contactFrame.ts` owns the common contact/support transform. Existing corrosive paths are compatibility exports; existing ice/shock imports remain usable while their owners migrate. Corrosive shaders, masks, liquid motion and status tuning remain local. The shared review human fixture lives in `src/dev/effects/shared/reviewTargets.ts`; its old review import is also retained. Neutral `effectSurface` tags are preferred, with legacy `corrosiveSurface` tags accepted.

No new cross-element deep imports after that extraction. An element imports its own internals, neutral shared mechanisms and plain common contracts. Composition code may import the element's public entry. Do not hide cross-element coupling through aliases such as importing a corrosion implementation as `genericSurface`.

`quality/shared/sceneColor.ts` now supplies borrowed linear ink-color, opaque depth, physical size and pixel ratio from the existing comic compositor. Register/release a per-scene binding and mark scene-sampling surfaces explicitly. The compositor draws marked surfaces before other overlays, including opaque overlay materials, using the existing target/depth. This adds a conditional sampling-only overlay draw, not another opaque-scene capture or per-element render target. Without a visible marked surface, ordinary overlay ordering remains unchanged. Element modules own their distortion shaders, limits and fallback; they must never sample the target currently being written, dispose borrowed textures or advance simulation in a render callback.

Every new or revised effect must vary between events. Choose a stable cosmetic profile once per event: silhouette, direction, particle distribution and timing should change within the element's art direction and size envelope. Avoid a signature spike or a fixed shape merely rotated each time. Use `shared/variation.ts` for independent cosmetic seeds, reproducible review seeds and nonrepeating shape families; never consume gameplay randomness or reroll the shape every frame. Keep collision, damage, exposure and primary/secondary hierarchy authoritative. Verify repeated real shots at native speed with sound. Existing element owners should adopt this rule when revising their effects; adding the helper alone does not retrofit them.

## Required equipment alignment and Opus review

The user requires equipment alignment and **Claude Opus 5.5** review for each element when its equipment phase is reached. Include this step in each element's design, verification and integration handoff. Track it as pending until its equipment evidence and review are complete.

- Align equipment with the approved elemental mockup and the implemented projectile, impact and lingering materials. Preserve the weapon's construction and silhouette; localize the elemental treatment to purposeful reservoirs, feeds, coils, vents, applicators or other appropriate parts. Vary the treatment with construction and delivery.
- Verify pilot and mech equipment in actual gameplay at idle, firing and reload. Include primary/secondary and mixed-element cases; preserve slot isolation, original parts, muzzles, collision, projectile behavior and combat. Assess the complete equipment-to-projectile-to-impact sequence with native sound and matched performance measurements, accounting for concurrent work.
- Once the equipment visuals are ready, have Opus 5.5 compare the approved mockup with actual equipment views and gameplay captures, with relevant source available. Record the model, findings, changes and remaining differences in the element's verification receipt. Explicitly retain gaps in the reviewed evidence, including whether video or audio was assessed.
- Opus review is peer critique; user visual approval remains the adoption gate. Impact-only captures do not establish that equipment is aligned.

## Composition and open/closed extension

- Prefer injected element definitions/factories and a typed handler map at one composition root. A new element registers its own response and recipes; existing element internals should not need edits.
- Use small contracts for actual needs: equipment, projectile/trail/beam, contact/detonation/secondary recipient, authoritative status/field state, update/pause, release/clear/dispose, and bounded diagnostics. Optional capabilities are preferable to one enormous required implementation or inheritance hierarchy.
- The implemented `shared/composedPresentation.ts` supplies a small optional response contract and one typed element factory map, while `audio/composeElementRecipes.ts` routes recipes with an explicit fallback into the existing engine. Existing standalone renderers remain available. These contracts are not a reason to add a plugin framework, global service locator, network protocol or runtime package loader. Start with the existing `BallisticPresentation`, `GamePresentation.setElementalFactory`, status lifecycle and audio recipe injection. Evolve them once with compatibility coverage where real consumers require it.
- Existing single-element subclasses/adapters may remain during development. Do not chain `GravityPresentation extends ShockPresentation extends IcePresentation` or let each adapter replace the whole audio profile, suppress unrelated channels or own competing status maps. Production composition must support several approved elements together.
- Compose recipes by element/event with an explicit fallback into the existing audio engine. Preserve unrelated elements when selecting a new sound recipe; avoid a last-registered recipe overriding earlier ones.
- Keep tuning in typed profiles/definitions. Do not scatter duplicate durations, radii, colors, voice limits or exposure formulas across simulation, shaders, sound and UI. Simulation publishes authoritative remaining lifetime and pulse events; audio and art consume them.
- Handle primary/secondary and dual-element contributions deliberately, once per channel/event. Do not duplicate full bursts or audio by passing one event through several overlapping generic and specialized handlers.
- Update gameplay and world-space effect lifecycles once per simulation tick, not once per camera or viewport. View-dependent rendering may sample state; it must not advance damage, lifetime, RNG or sound twice. Stable source/target/event IDs make later multiplayer extraction possible without implementing networking now.

## Ownership, lifecycle and compatibility

Combat lead owns `src/game.ts`, `src/world.ts` and `src/ui.ts`. Supply isolated modules and an explicit integration handoff; ownership still applies when the requested effect includes new gameplay. Do not put hold/damage logic in a renderer merely to avoid editing a protected file. The gravity contract is described in [its canonical design](quality/gravity-design.md).

Gameplay owns collision, source placement, target movement/hitboxes, hold membership, crush ticks, expiry and release. Presentation owns only its resources and visual/audio state. Borrowed source geometry/materials are not disposed; temporary changes restore exact original instances. Every owned pool, overlay, sound loop and attachment has clear release/reset/dispose behavior, finite budgets and removal/death cleanup. Preserve slot boundaries, muzzle sockets, immutable recipes, projectile/fuse behavior and other elements.

Coordinate changes to shared seams and files being edited by other element workstreams. Keep extracts, folder moves and gameplay changes reviewable as separate steps. Retain old exports/renderers until all consumers are moved and checked. Frozen benchmark builds and receipts remain frozen; publish new results for the new source rather than silently rewriting historical hashes. A source-moving refactor needs compatibility evidence, not a claim of unchanged source bytes.

## Definition of done for an approved effect

1. Canonical design and ownership boundaries are recorded in tracked docs; generated concepts are labeled accurately.
2. Required shared mechanisms are reused/extracted with clear consumers; the element owns its distinctive behavior.
3. Relevant meaningful regressions cover simulation/presentation separation, slot isolation, collisions, lifecycle and mixed elements. Existing renderers still work.
4. Verify real moving targets, surfaces and actual runtime sound. For gravity include elevated/underside placement, lift/hold, airborne hitboxes, crush plus other-gun damage, release/landing, late entrants and overlap policy.
5. Measure matched before/current/repeated-before sustained fire on multiple targets in the same scene and compiled build, with sound on and recording off. Report median/p95 and CPU/GPU costs with hardware/coverage limits.
6. Complete the required equipment alignment and Opus 5.5 review above, retaining actual equipment/gameplay evidence and unresolved findings in the element's handoff.
7. After visual approval, integrate in normal Enhanced gameplay; a review-lab-only feature is not complete. Preserve Legacy for comparison.

The gravity implementation and ownership handoff are documented in [gravity-integration.md](quality/gravity-integration.md). It establishes plain gameplay modules, neutral shared helpers, a generic composition layer and an actual-Game review fixture. It does not perform the proposed workspace migration or claim normal-main gravity integration.
