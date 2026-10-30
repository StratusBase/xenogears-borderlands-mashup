# Shock A+B prototype

30 October 2026. The user selected **A / Arc Lash + B / Live Wire**, reserving **C / Capacitor Kick for heavy explosive hits**. The accepted concept boards and prompts are under `artifacts/concepts/shock-v1/`.

Approved-direction checkpoint: `944c664`, created before implementation. The playable prototype uses `GamePresentation.setElementalFactory`, retaining the current renderer for matched comparisons. The combat lead retains `src/game.ts`, `src/world.ts`, and `src/ui.ts`.

Required invariants: unchanged damage, status/proc clocks, chain recipient and damage, projectile trajectories/fuse, cover, muzzle transforms, equipment-slot ownership and secondary falloff. One read-only confirmed-chain callback will be provided for integration; the prototype may observe the existing confirmed chain through its review instrumentation. No presentation callback applies damage or selects another target.

## Visual review follow-up

The first moving A+B result was rejected as too primitive compared with the boards. It remains a frozen baseline. The [lightning revision](shock-lightning-revision.md) replaces rods/ribbons with branching luminous filaments and larger primary material coverage; secondary sizing and combat remain unchanged. It is a new review candidate, not an assertion of visual acceptance.

## Review

- [Gameplay with live sound, before/current stills and full measurements](http://127.0.0.1:5218/review/).
- [Playable compiled prototype](http://127.0.0.1:5218/shock-lab.html).
- [Raw evidence and compiled fingerprints](../../artifacts/shock-ab/verification.json).

This is an opt-in actual-Game prototype awaiting moving-result review. Normal Enhanced gameplay retains the existing profile. Art approval did not imply approval of an unseen runtime result. Existing construction-specific equipment/projectile/beam visuals remain in use; this pass replaces Shock hit, lingering charge, secondary response and impact/status audio. Generated mockup glow is an art target; an exact painted finish is not claimed.

## Implemented response

- **A / Arc Lash:** unequal tapered three-dimensional leaders, moving kinks, displaced forks and pin sparks. Navy separation, cobalt envelope and selective pale core provide controlled outlines. Geometry moves each frame; it is not a uniformly scaled star sprite.
- **B / Live Wire:** bounded charge islands with travelling reveals and intermittent highlights, rendered on borrowed visible geometry with target-local anchors and world-unit masks. A hit on a narrow armor rib can charge adjacent visible armor of the same kind. Underlying cloth and unrelated equipment remain excluded. Characters, source meshes and source materials stay intact.
- **C / Capacitor Kick:** two unequal deforming open ribbons at confirmed heavy explosive detonations only. Sticky/rocket contact does not receive C before the real detonation. Rifle, beam, scatter, slug and arc stay smaller. Low-frequency capacitor weight is similarly restricted to the heavy impact sound.
- Fixed pools: 12 bolt slots with four reserved for primary events; 1600 segment slots; 16 world-surface owners; three charge anchors per target surface, reserving two for primary contacts. Secondary saturation cannot evict the main capacitor fan or erase its charge patch.
- Secondary contact energy/exposure come from existing blast notifications or a confirmed existing chain. They use thinner, shorter, quieter feedback, never another full capacitor event. No damage, status or chain selection occurs inside the renderer.

## Gameplay verification

The compiled review entry instantiates the real `Game`, existing weapon specs and equipment, ordinary muzzle poses, swept collision, fuse, statuses, cadence, heat and auto-reload. It uses the existing evaluation driver, stationary raised-health clothed/armored human fixtures and an isolated save. It is a controlled gameplay fixture, not a full AI encounter.

- Actual clothed torso, armored torso and exposed forearm contacts were observed. The exposed forearm resolves to `skin`; armored rifle contacts resolve to the outer armor and the active charge bindings remain armor-only.
- Actual rifle, sticky, rocket, beam, scatter, slug and arc shots hit targets. Only sticky/rocket detonation studies emit C; none of the other sampled deliveries does.
- Raised platform, wall, slope, underside and finite-ledge tests all hit their named real surfaces. At +100 ms, sampled geometry has positive minimum clearance: raised 0.0979 m; wall 0.1015 m; slope 0.0961 m; underside 0.1003 m; ledge 0.0977 m. Local charge remains attached to the actual finite geometry/elevation at +900 ms.
- Real pause freezes simulation time and charge binding ages, with zero physical/elemental voices. Unit checks separately verify exact paused path matrices and moving/non-uniform surface anchors.
- Screenshots deliberately stop the real simulation at matched phases; they are not native-timing video. The three separate live recordings use native wall-clock timing, final physical/elemental WebAudio buses and WebGL canvas capture. HTML HUD appears in stills; canvas clips omit it.
- No page or shader errors were recorded in the final gameplay checks.

## Matched performance

Before = previous `ElementalPresentation`; current = `ShockPresentation`; repeat = previous presentation again. Both versions use the same compiled Game, target construction, seed 37391, weapons, camera sequence and complete confirmed chain events. There are six stationary human targets, 120 warm-up + 720 measured displayed frames per run, one existing 1/60 Game step per displayed frame, both audio buses enabled and recording disabled. Display pacing can hide work; simulation CPU, renderer submission and GPU cost are reported separately.

Apple M5 Max via ANGLE Metal; Chrome 156; 1440 × 900; DPR 1. Each cell is **before / current / repeated before**, milliseconds.

| Scene | Frame median | Frame p95 | Simulation CPU median | Draw CPU median | GPU median |
|---|---:|---:|---:|---:|---:|
| Six humans / rifle | 8.30 / 8.30 / 8.30 | 9.90 / 9.90 / 10.00 | 1.10 / 1.20 / 1.10 | 3.10 / 3.40 / 3.00 | 2.20 / 2.14 / 2.15 |
| Six humans / sticky | 8.30 / 8.40 / 8.40 | 11.70 / 11.50 / 10.60 | 1.20 / 1.20 / 1.10 | 4.00 / 3.60 / 3.70 | 2.46 / 2.41 / 2.45 |
| Six humans + raised surface | 8.30 / 8.40 / 8.30 | 9.20 / 10.10 / 9.20 | 1.00 / 1.10 / 1.00 | 3.10 / 3.20 / 3.10 | 2.17 / 2.49 / 2.60 |

All nine runs have exact equality of complete shot, hit, confirmed-chain damage, vitals/status, ammo/reload, timing and contact snapshots. Rifle: 58 shots, 57 hits and chains on three front targets; the rear row is occluded. Sticky: eight charges, 46 hits and chains on all six targets. Mixed: eight charges, 26 hits and chains on all six targets, plus eight raised-top contact/detonation notifications.

The mixed scene adds 0.10 ms median frame time and 0.90 ms p95 in this sample. Its GPU median is above the first baseline and below the repeat; baseline drift limits causal conclusions. Raw distributions retain outliers, including baseline draw/frame spikes. This is not a zero-cost claim or a lower-end/mobile/high-DPI benchmark. Current measured peaks are ten bolt slots, 250 segments, six statuses, one world-surface owner and 32 capped elemental voices.

## Recorded sound

| Native clip | Duration | Decoded peak | RMS | Clipped PCM samples |
|---|---:|---:|---:|---:|
| Rifle sustained | 7.98 s | 0.5822 | 0.02596 | 0 |
| Heavy sustained | 10.02 s | 0.5473 | 0.01051 | 0 |
| Raised surface | 3.96 s | 0.0896 | 0.00351 | 0 |

No normalization, offline replacement or slow motion was used. The original WebM recordings remain under `artifacts/shock-ab/`. Chrome exports produced an Opus packet-header warning during decoding; the playable MP4s preserve the decoded sound. Sound descriptions in the concept review are now backed by the actual runtime recipes heard in these clips.

## Source boundaries and regression checks

- The frozen verification run passed **713 repository tests**, including 16 new Shock tests. Production and review builds pass with the existing large-bundle advisory. Exact pre-change/current ballistic replay matches all 13 delivery families.
- A subsequent check of the concurrently advanced workspace passed **721 tests**, the production build and exact ballistic compatibility across all 13 deliveries. The timing table still belongs to the frozen compiled prototype, not a rebuilt workspace.
- `game.ts`, `world.ts`, `ui.ts`, status rules, corrosive sizing and corrosive audio retain their starting hashes. Shock changed no collision or projectile simulation code.
- Optional presentation extension points were added to `ElementalPresentation`: an audio recipe, protected status factory and protected splash hook. `ElementalImpacts` accepts an optional exclusion set while preserving its default behavior and original channel indices. Existing renderers remain usable.
- The workspace concurrently gained a separate ballistics world-impact observer and neutral surface/review helpers after this frozen build. Those changes are not Shock work and are excluded from its commit. The receipt reports frozen versus current source hashes separately; the measurements and recordings belong to the preserved compiled assets, not later workspace edits.

## Combat-owner integration handoff

The module entry is `src/rendering/quality/shock/ShockPresentation.ts`. Opt in through the existing disabled-presentation factory transition:

```ts
game.setPresentationMode('legacy');
presentation.setElementalFactory((scene, camera) => new ShockPresentation(scene, camera));
game.setPresentationMode('quality');
```

After moving-result approval, the combat lead can select this factory for normal Enhanced gameplay or compose it with other approved element adapters. Do not silently replace other element factories.

`GamePresentation.confirmedShockChain(event): boolean` is the read-only handoff. Pass the already selected target, existing start/end, original immutable spec, already calculated damage and actual fraction. It returns false when the active renderer does not handle the chain, preserving the old tracer fallback. For the existing `onBallisticHit` chain branch, the intended call pattern is:

```ts
const chainDamage = shieldAdjustedDamage(next.shield, hit.damage * 0.35, 1.6);
const chained = this.hurtTarget(next, chainDamage, 'shock');
if (!this.presentation?.confirmedShockChain({
  start: hit.point, end, target: next.mesh, spec: hit.spec,
  energy: chainDamage, exposure: chainDamage / hit.damage,
})) this.tracer(hit.point, end, Number.parseInt(elementColors.shock.slice(1), 16));
// Keep the existing damage readout and every selection/proc/cover rule.
```

That owned-file change was not made here. The review entry observes the actual existing tracer and subsequent `hurtTarget` result to call this same handoff after confirmation. It suppresses only the old visual tracer in the opt-in profile. It never reselects a recipient or recalculates/applies damage, and the exact snapshot comparison verifies identical outcomes.

Reproduce with `npm test`, `npm run build`, and `npx vite build --config vite.shock.config.ts`; serve the isolated build with `npx vite preview --config vite.shock.config.ts --port 5218`. Use Enter on the review buttons if mouse capture interferes. `scripts/package-shock-review.mjs` validates and packages saved DOM results, screenshots and recordings; it does not manufacture measurements or drive the browser. Preserve the current frozen build before rebuilding if retaining this receipt.
