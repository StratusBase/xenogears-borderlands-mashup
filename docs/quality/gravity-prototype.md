# Gravity playable prototype review

30 October 2026. This is a controlled **actual-Game prototype**, not completed normal-main integration. Use [the integration handoff](gravity-integration.md) and [canonical design](gravity-design.md). Combat-owned `game.ts`, `world.ts` and `ui.ts` were left unchanged.

## What runs

The lab fires ordinary immutable sticky/rocket/orb recipes through `PlayerBallistics`, consumes authoritative world impacts, moves real human target roots/hitboxes through injected swept collision, calls normal gravity/status damage, and renders/records the existing physical and elemental sound buses. Targets are clothed and armored humans, intact with no gore. They have stationary AI and raised health for reproducible review; this is not an AI encounter signoff.

The first visual review rejected six evenly spaced ribbons as flower petals. The revision removes their radial spacing and leaf-shaped width profile. Eight unequal solid-angle paths now carry short narrow inward streaks around a small dark core, with skewed broken pressure arcs and sparse grit. Gameplay force, size, ownership and damage are independent of that art revision. True background lens refraction is not implemented.

## Evidence

Ignored evidence is under `artifacts/gravity-prototype/`. Build/source hashes are in `build-provenance.json`; assertions and copied raw results are in `verification.json`. The static review gallery is `artifacts/gravity-prototype/build/review/index.html`.

| Actual gameplay check | Result |
|---|---|
| Sticky, elevated world-only wall impact | Six humans captured; feet about 0.85–0.89 m above ground; recurring crush |
| Kinetic rifle against suspended armored target | Real ballistic hit through the preserved collision body; independent weapon damage while crush continues |
| Pause / release | Field clock, movement and damage freeze; expiry leaves no field/member and all feet land at floor clearance |
| Floor / underside | Six captured; shared art/gameplay center above floor or below ceiling; underside lifts targets |
| Raised platform / slope | Six captured; bodies stop above support, rather than aiming inside it |
| Solid cover | Three visible targets captured; three blocked targets remain on ground |
| Late entrant | Five initially held; sixth enters the live radius and is captured |
| Rocket / orb | Ordinary flight/fuse retained; delivery-scaled radius captures six / two eligible targets in this layout |
| Native sound recording | Wall and floor footage includes intake, pressure, crush, rifle reports and release through actual buses |

Sloped-cover collision uses the probe's conservative AABB, so some feet hover above its rendered slope. It proves no penetration/tunneling, not exact standing on an arbitrary inclined triangle. Production must provide the authoritative collision adapter. Ring/layer capture slots are not a crowd-body contact solver.

Automated checks additionally exercise all compass directions, 3D range, late entry, source overlap/ownership and damage deduplication, capacity/replacement, invalid inputs, thin walls/ceilings, death/removal, source clear and landing, and upward release into a ceiling without falsely treating that as landing. Presentation tests cover deformation, immutable snapshots, noninteractive art, bounded disposal and mixed-element recipe/contact compatibility. Main-presentation regressions cover slot material identity, live renderer switches and an asynchronous audio-unlock rejection from an already disposed renderer.

Final validation: 27 focused gravity/shared/main-presentation checks pass; the full concurrent working-tree suite passes 757/757. Typecheck and the main build pass. The exact pre-change ballistic replay matches all 13 delivery families. Both 10 s H.264/AAC review clips contain native game-bus audio (48 kHz), with decoded peaks about 0.56 and no PCM clipping; original WebM recordings are retained. Browser error receipt is empty. Full-suite counts include concurrent element work and are not all new gravity tests.

## Matched performance protocol

Both wall and floor run **before / current / before-repeat in one frozen compiled build**, at 1280×720, DPR 1, Apple M5 Max through ANGLE Metal in the in-app Chromium browser. Six real targets, sustained trigger, ordinary ammo/reload, fixed 1/60 s simulation step per rendered frame; 120 warm-up then 720 measured frames each. Sound is unlocked/on; recording is off. Three active wells are reached.

“Before” means previous gravity **visual/audio presentation with the same new field simulation**. This isolates presentation and verifies exact normalized full combat equality across each trio. It does not measure the new physics cost against the old planar gravity proc. Simulation CPU includes Game step, field update and presentation sync; render-submit CPU and GPU cover the whole multipass scene. Frame intervals include display pacing, JIT/driver variance and unrelated machine activity.

The gallery and raw `performance-wall.json` / `performance-floor.json` report median/p95 frame, simulation CPU, render-submit CPU, GPU timing, calls/triangles and bounded resource/voice peaks. Do not infer an FPS guarantee on other devices, boss crowds, normal AI encounters or a source-migrated build from these results.

Final measured frame intervals, median / p95 milliseconds:

| Scene | Before | Revised | Before repeat |
|---|---:|---:|---:|
| Elevated wall | 8.30 / 10.30 | 8.30 / 9.60 | 8.30 / 9.40 |
| Floor | 8.30 / 9.30 | 8.30 / 9.60 | 8.30 / 9.50 |

Both comparisons have exact normalized combat equality. The revised renderer reaches the configured 144 grit instances across three active fields and six affected humans. These small differences are within local frame/driver variation; no speedup is claimed.

## Reproduce

```sh
npx tsc --noEmit
node --import tsx --test tests/gravity*.test.ts tests/effectSharedSurfaces.test.ts tests/mainPresentation.test.ts
npx vite build --config vite.gravity.config.ts
npx vite preview --config vite.gravity.config.ts --port 5215 --strictPort
```

Open `/gravity-lab.html`. Choose a surface and delivery; run capture, rifle follow-up, pause and release. Use **Record live gameplay with sound** to start a fresh native-timing shot/hold/rifle/release sequence; stop recording to export the actual canvas and audio. Use **Run matched sustained-fire comparison** separately, with recording off. The DOM verification panel exports raw proof and timing JSON. `node scripts/package-gravity-review.mjs --freeze` fingerprints a new build; after exporting receipts/recordings, the same script without the flag validates and packages the review. Do not overwrite a previously published receipt with a new build.

## Next gate

Review the actual revised motion/sound, then tune art and provisional balance if needed. The combat lead integrates the explicit ports into normal gameplay after that review, verifies AI/attack and body movement policy, pilot/mech loadouts, encounter/save teardown, and the ordinary Enhanced entry. Existing standalone element renderers and Legacy remain usable during development. No push or deployment is part of this work.
