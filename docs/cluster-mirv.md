# Cluster / classic MIRV behavior

30 October 2026. The user selected classic MIRV behavior: a parent burst, scattering physical bomblets, then delayed secondary explosions. The earlier narrow forward-cone split did not establish that identity. This revision changes Cluster's delivery lifecycle while keeping its elemental payloads independent.

The reference is the staged parent/child identity described for [Borderlands 1's MIRV grenade by Lootlemon](https://www.lootlemon.com/grenade-mod/mirv-bl1). This is a MIRV-style launcher delivery in this game's existing weapon system, not a one-to-one recreation of Borderlands' grenade slot, exact timing, damage scaling, or a legendary recursive/homing variant.

## Authoritative sequence

1. One carrier flies along the weapon's aim. It bursts on contact with a target or cover, or when its travel/lifetime ends. Cluster no longer releases a forward cone after a mid-flight split timer.
2. The parent produces one real splash explosion and throws out **six pilot bomblets** or **eight mech bomblets** with outward and upward velocities.
3. Bomblets fall under gravity and rebound from real target/terrain/cover meshes. A harmless bounce deals no damage and emits no elemental contact or detonation event. There is no invented floor plane in the simulation.
4. Each bomblet explodes at its own staggered fuse, or earlier if its finite local travel/lifetime expires. Bomblets do not create grandchildren.

`PlayerBallistics` owns this sequence, collision and damage. The existing normal-game path uses that same authority; this is not an alternate lab-only simulation. No changes to combat-owned `src/game.ts`, `src/world.ts` or `src/ui.ts` are required. Presentation consumes the authoritative role, fuse, settlement and detonation state; it cannot decide hits or create gameplay explosions.

## Damage and independent elements

Let **B** be the effective damage budget of one carrier, after the Cluster runtime multiplier and the existing secondary-element cost, and before enemy damage modifiers, and **N** its saved bomblet count. The parent and each bomblet receive the same share:

```text
Parent budget       = B / (N + 1)
Each bomblet budget = B / (N + 1)
Total budget        = B
```

For example, an effective 140-damage carrier with six bomblets has seven 20-damage explosion budgets. A contacted target does not receive a separate direct hit. Cluster blasts are noncritical splash; each explosion applies ordinary distance falloff and cover checks, so a target may receive less than the total budget. The parent and bomblets use the saved blast radius: current defaults are 3m pilot and 4m mech. This bounds the raw blast budget per target before enemy modifiers; it does not promise that every scattered explosion reaches one enemy.

Each non-kinetic elemental channel rolls independently for each actual packet hit. For saved carrier chance **p**, each of Cluster's **N + 1** packets uses `q = 1 − (1 − p)^(1 / (N + 1))`. If all packets reach one target, the chance of at least one successful roll on that channel is p; fewer connecting packets give a lower chance. Target-specific status/application rules still apply. The calculation is separate for both channels. A kinetic primary can still carry a secondary elemental status.

Successful status strength is `hit damage × saved status power × (N + 1)`. This restores carrier-level strength while retaining actual blast falloff and the one-time secondary-element cost. It does not turn a bomblet into a different projectile or merge its elements. Existing status durations, control rules and elemental effects retain their own ownership.

Cluster applies a **1.35 runtime damage multiplier**, once in the existing shared `effectiveProjectileDamage` helper. This recovers some of the concentration lost to real scatter without tightening the physical spread or removing the secondary delay. For a raw saved damage of 100, the effective budget is 135 for a single channel or **114.75** with the existing 0.85 independent-secondary cost. The same effective packet damage feeds successful status power; the multiplier is not reapplied by a collision, child, proc or tick. Cards, Game firing and diagnostics share this calculation. Numeric item saves, loot/stat RNG, proc chance and other projectile families remain unchanged. The existing diagnostic baseline rules disable secondary cost and mech-heat tuning; they do not disable this new Cluster profile.

Item cards show the per-explosion budget multiplied by the full explosion count, including the parent, and identify it as a blast budget. Their budget-per-second value is theoretical: it excludes travel/fuse delay, heat, misses, falloff, cover and target movement. It is not measured encounter DPS.

## Compatibility and bounded physics

- Weapon identity, saved numeric stats, primary/secondary elements, flight style and design variant are retained. Existing saved Cluster weapons receive the corrected runtime behavior without rewriting their numeric fields.
- For Cluster, saved `split.count` remains the bomblet count. Saved `split.delay` now controls the **bomblet stagger window**, rather than a carrier airburst timer. Fuses range from `max(0.35, saved fuse)` through that value plus the saved stagger window. The default 0.65s fuse and 0.45s window produce 0.65–1.10s bomblet fuses after deployment.
- Cluster no longer uses `split.spread` as a forward-cone angle. Its numeric value remains serialized. Ejection uses the shared physical MIRV profile and saved blast radius. Other physical weapons with optional split metadata keep their established forward cone, timer and child-only damage/proc accounting; beam/arc behavior remains unchanged.
- Bomblets have a finite local **40m** travel cap, not a new full weapon range. Parent and children share a bounded shot lifetime of at most **16 seconds**. The existing projectile/effect caps, pause behavior, immutable fired recipes and reentrant clear guards remain authoritative.
- Gravity, restitution, friction, settlement, bounce count and contact clearance are defined together in `src/core/cluster.ts`. Rendering does not tune collision. Surfaces are swept real meshes, including the actual game terrain.
- Ammunition and mech heat are charged once by the original trigger. Deployment, bounces and secondary explosions do not create another resource owner.
- Cluster retains its Ironvale/Cindergrid loot membership and weights. Loot/stat generation keeps its existing random draw sequence. Ejection and fuse ordering are deterministic and consume no combat or loot RNG; the new hit sequence can naturally change subsequent status-roll events.

## Presentation and review fixtures

Bomblets have one compact physical casing, bands and elemental caps, rather than miniature copies of the multipod carrier. Short local wisps preserve payload cues without rocket-like thrust. The quality renderer reads the authoritative remaining fuse for its light and stops casing tumble when settlement is reported. Parent and secondary bursts use the existing impact/audio lifecycle. A brief warm physical flash and casing fragments distinguish the delivery burst independently of the selected element, using the existing bounded impact pool. Both selected elemental channels remain visible and independently routed.

- `/cluster-behavior-lab.html` uses the actual `PlayerBallistics` and quality adapter with physical floor/cover meshes, static targets, pilot/mech controls, payload and aim scenarios, native/slow motion, pause/reset and an authoritative detonation timeline. It does not establish AI, status-DPS or human-controller behavior.
- `/cluster-play-lab.html` is the actual-Game review entry point for the same delivery, rather than a second projectile implementation.
- Evaluation/review loops start muted. Explicit sound controls remain available for listening checks.

Claude Opus 5.5 performed a source review of the original mismatch, follow-up review of the equal-share damage/proc algebra, implementation and clearance-fix reviews, and a focused review of the measured runtime damage correction. Exact model receipts are retained in the local evidence bundle. Its feedback exposed the contact-clearance teleport risk, canonical packet-count divergence and incorrect back-face containment inference; regressions reproduced those faults before correction. The final closed-mesh containment patch was regression-tested locally, without a further blanket model approval. The implementation uses equal parent/child shares to keep one packet-count contract across the existing gameplay callers. This source review is not visual approval, continuous-video inspection, an audio listening test or a performance measurement. Revision-specific measurements and captured evidence must state their own scope.

## Historical evidence boundary

The [29 October balance report](cluster-balance.md) and its 72 scripted runs describe the earlier forward-cone delivery. Their numbers, source fingerprints and raw evidence remain historical. They do **not** validate the new MIRV's encounter balance, native-speed readability, sound or performance. New geometry or encounter comparisons must use the current lifecycle, a real floor in the fixture, fresh source provenance and every retained outcome; they must not inherit the old cone's single-target/distance acceptance floors.


## Reproduce the review

```sh
npm run dev -- --config vite.cluster-behavior.config.ts --port 5390 --strictPort
```

Open `/cluster-behavior-lab.html` for the side/overhead physics view, or `/cluster-play-lab.html` for the actual pilot/mech game. Both start muted. Use native speed first; pause and **Step 0.1 s** expose the separate physical stages. The review server disables hot reload to keep an in-flight shot on one source version. Restart it after source changes.

The corrected cover handling sweeps even the release/contact clearance, so a spacing offset cannot jump an adjacent wall or low roof. Back faces of open planes remain valid contacts. Cancellation of an embedded muzzle requires actual containment in a closed mesh, rather than inferring a solid from triangle winding. Mesh closure is cached; containment checks are limited to the exceptional back-face/start-contact paths.

The existing oldest-first projectile cap remains unchanged. Under saturation, reset, or cleanup, cancelled packets lose their remaining budget and do not detonate later; the ordinary **1+N** sequence is not an unconditional promise under cancellation. No new self-damage system or recursive/homing grenade variant was added.


## Validation and measured tradeoffs

The isolated branch was created from committed main `0582624`, then refreshed to `4f748fc` after main advanced during the pass. One Adhesive adapter conflict was resolved by retaining both the newly committed honey material/equipment changes and MIRV role/stage handling. Fire, Ice and Shock adapter merges retain their upstream profiles. This work does not edit combat-owned Game, world or UI entry points. Both former Cluster branches were removed locally and remotely after their tips were verified merged. The shared old detached checkout remains because the app reports another active chat still uses it; its ignored evidence is preserved under the primary checkout's artifacts.

**836 tests pass**, with no failures/skips, and TypeScript plus the production build pass. The build retains its existing bundle-size warning. Regressions cover real physical bounce/fuse separation, packet budgets in both forms, actual independent status procs, one-time runtime multipliers, frozen recipes, generic non-Cluster splits, cover clearance/overhangs/narrow gaps, closed-solid containment versus open back faces, settlement, caps, reset/reentry, and previous/honey material propagation through bomblets. Real full-exposure triggers deliver exactly135 single-channel or114.75 dual-channel damage for a100 raw roll; proc power scales once. No continuous-video, human/controller or audio listening approval is claimed.

### Static real-mesh geometry

The `cluster-geometry-ground-v3` harness runs54 cells and648 actual triggers per arm, using the untouched refreshed main as baseline and identical real ground/target/partition meshes. The v3 change corrects floor-versus-partition metadata; it does not change the v2 physical layout. All **36 Rocket/Scatter control cells are exactly equal**, and all six covered Cluster cells deal **zero damage to protected peers**, with no pending projectiles. Every MIRV hit time, point and damage is unchanged by the subsequent main refresh.

The compact three-target results below use **the old trigger budget as the denominator for both arms**, so the final columns include the intentional1.35 runtime payload increase. Values are raw damage before enemy modifiers. A group fraction above1 represents separate damage to multiple targets, not duplicated budget against one enemy.

|Form|Range|Old center|MIRV center|Old three-target group|MIRV group|
|---|---:|---:|---:|---:|---:|
|pilot|19m|1.000|1.002|1.972|2.661|
|pilot|30m|0.907|0.981|1.807|2.622|
|pilot|40m|0.458|0.912|1.128|2.428|
|mech|19m|1.000|0.918|2.054|2.563|
|mech|30m|0.958|0.891|1.968|2.506|
|mech|40m|0.624|0.835|1.395|2.339|

The physical spread itself captures less of its own budget on the close center target: about74% pilot and68% mech. The runtime tune brings those examples to about100% and92% of the old raw budget, while raising group damage to about2.66×/2.56× the old budget. This is an area-delivery tradeoff, not unchanged single-target DPS or universal parity. Static targets establish neither moving-enemy capture nor complete combat balance.

### Actual-Game encounter smokes

Three paired seeds were measured before the rendering refresh, with all six outcomes retained. The controlled loot fixture starts from Ironvale rare Rapid rolls from seed2, explicitly sets Cluster delivery plus corrosive/fire, and retains normal proc rolls. It is not unrestricted natural-drop, Cindergrid, every-payload or full manufacturer-pool coverage. Exact saved equipment snapshots in each raw file are authoritative. Both forms play the complete authored route with real AI, collision, shields/health, statuses, ammo/reloads and heat. Offensive abilities are disabled by the shared policy; fixed60Hz clocks and event/proc traces reconcile. Review/evaluation loops are muted.

|Seed|Initial MIRV seconds|Tuned seconds|Pilot combat, before→after|Mech combat, before→after|Pilot ammo, before→after|Mech ammo, before→after|
|---:|---:|---:|---:|---:|---:|---:|
|7|353.28|291.70|18.55→15.55s|319.58→261.33s|72→59|320→252|
|8|386.37|301.53|18.55→15.32s|352.55→270.62s|72→58|348→261|
|41|344.40|296.40|19.18→15.28s|310.02→263.18s|72→57|307→259|

All six complete; no failed or interrupted attempt is discarded. Mean completion changes361.35→296.54s. Every tuned run takes zero health damage, while shields still take real damage. Two tuned runs are within the180–300s target; seed8 is301.53s, **1.53s above** its upper bound. The new staging adds fuse/overkill delay, so completion does not scale as a simple inverse damage multiplier. This small smoke set supports the targeted correction; it does not replace the previous72-cell balance matrix or establish every build's pacing.

The separate final `live-integrated` set, after integrating main `4f748fc`, also completes **3/3**: seed7 **291.70s**, seed8 **301.53s**, seed41 **296.40s**. All per-form metrics are exactly equal to the pre-refresh tuned runs. All nine attempts across the three evidence sets are retained and validated, with no exclusions. The final live source is `sha256:f52c8297dc68f7b5450928cc89c991fd4d2c5dc57797f1312700346ae5a9a9a9`. Source versions remain separate rather than pooled as nine independent balance samples.

### Evidence and performance scope

Ignored local evidence lives in `artifacts/cluster-mirv/`: exact Opus5.5 receipts/prompts, regression/build logs, current-main baseline source record, before/final geometry plus comparison, all initial/tuned/integrated raw attempts and full source snapshots, paused native-frame screenshots, source patch and new-file copies. The original72-run evidence remains historical and separately preserved.

An earlier same-process static CPU diagnostic includes warmup and5 repeats per form, measured before→initial MIRV→before-repeat: whole12-trigger cells have medians48.73→139.55→47.97ms (p95:58.00→147.97→50.75ms). This includes model construction/disposal and skips truly empty idle intervals; MIRV children remain physically active longer. Machine background load is uncontrolled. It is **not per-frame cost, FPS, GPU, AI/audio or a final integrated Game performance benchmark**. The final pass does not claim performance parity.

Actual verification used Node25.7.0 via `/opt/homebrew/bin/node`. Final screenshots are paused frames from the native update path: the mech case has one parent plus eight separate secondary detonations, ending with zero active projectiles at1.50s. They demonstrate individual stages, not continuous-video or sound approval. The preview remains on native speed, muted and ready to fire.


## Merge delivery checkpoint

The requested publish pass rebased the scoped Cluster commit onto main `f613d74`. New upstream honey stain options, fixed Shock sticky charges and the Ice frost-program fix are retained. The new Shock projectile override now forwards the optional carrier/bomblet role; regressions verify distinct Cluster casings and unchanged fixed/legacy sticky geometry and animation. **854 tests**, TypeScript and the production build pass on that merged committed tree. The earlier encounter, screenshot and performance receipts retain their exact source/version boundaries; this checkpoint does not relabel them as fresh audio or performance approval.

The presentation contract carries an optional `carrier | bomblet` role through projectile and trail factories. New overrides and composed factories must forward it, preserve the local child wisp, and route the physical detonation cue once independently of elemental channel replacement.
