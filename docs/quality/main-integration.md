# Enhanced presentation in the normal game

This receipt records the earlier integration build. The later [crowd-feedback pass](../crowd-feedback-verification.md) addresses its damage-number clutter and repeated CPU work; its measurements remain separate from the results below.

Enhanced reference assets, elemental VFX and both sound layers are now the normal `/` presentation. The pause menu retains Enhanced/Legacy and Sound controls. The old comparison labs remain usable with isolated saves.

The combat lead integrated `game.ts`, `world.ts` and `ui.ts`. New asset/audio modules are owned through `GamePresentation`; the [interface and lifecycle](integration.md) remain independently reusable. Validation stayed local; nothing was pushed or deployed.

## Gameplay and compatibility

The compiled real-Game check used unchanged `relay-break-v3`, the current combined balance defaults, `mobile-precision`, seed 7 and `scripted-route-v1`. Its public evaluation controls supply movement, aim and actions; they do not teleport, edit damage/stats/enemies, or force stages.

- Enhanced and fresh-page Legacy both completed in **195.75 simulation seconds**, with 24 kills and both relays disabled.
- **All 87 fired trajectories match exactly**: world origin, direction, aim point and complete weapon specification. Every measurement event also matches exactly, including applied damage, kills, ammunition, heat/reload intervals and received damage.
- The actual reward was picked up, selected in the normal inventory and equipped with its real button. Only the mech reactor slot changed; the other seven slots retained their exact item IDs. Derived cooling/heat improved. The upgraded loadout fired its mech weapon in the next encounter.
- Both physical and elemental audio engines unlocked through the trusted start gesture. No runtime errors were reported.

These are accelerated scripted gameplay results, not a human clear-time measurement or frame-rate benchmark. They validate one unchanged fixture/seed; they do not replace the separately frozen pacing/balance matrix.

An initial paired run failed: Enhanced took 210.57 seconds versus Legacy 199.03, with divergent target hits. That failure is retained in `artifacts/integrated/encounter-initial-cadence/`. The cause was authoritative weapon pose and world-matrix state depending on drawing. `SimulationWeaponPose` now owns authored recoil/reload/recovery pose on simulation ticks; drawing does not advance it. Extra quality motion is not applied to the ballistic root. Actual-Game regression tests compare Enhanced/Legacy at 0/30/60/144 Hz and verify paused draws preserve state. Authored socket hierarchy, muzzle count, recoil amplitudes and reload homes remain intact.

## Every element through the normal entry

Fresh normal `/` pages used the ordinary workbench, equip and mouse-fire controls. No Game access, private state reads/writes, custom presentation controller or combat override was injected. The normal workbench's Guaranteed Status option supplied deterministic procs.

| Element | Construction / delivery |
|---|---|
| Kinetic | Ironvale rifle / bullet |
| Fire | Cindergrid shotgun / slug |
| Ice | Prism sniper / beam |
| Corrosive | Tackwork SMG / spike |
| Shock | Voltaic SMG / arc |
| Radiation | Cindergrid shotgun / scatter |
| Gravity | Nullward launcher / orb |
| Adhesive | Tackwork launcher / sticky |

Every case consumed exactly one real round and produced actual dummy damage. All seven elemental conditions appeared and lingered; the four damaging conditions increased the dummy total on later ticks. The sticky charge remained armed at the 552 ms observation and had detonated by 1,474 ms, increasing total damage from 34.65 to 173.26. These are observed browser times, not revised fuse parameters.

Read-only browser audio diagnostics recorded two running production audio contexts and actual physical/elemental sound-source creation after firing in every case. Forty-two screenshots cover equipment/workbench, delivery, impact and lingering stages, including sticky armed/detonated states. All cases reported zero page/console errors. These functional checks complement the earlier all-delivery/ground-impact tests; they do not constitute subjective listening-room or device-speaker validation.

## Matched capacity measurements

Apple M5 Max, ANGLE Metal, Chrome 149, 1440×900 CSS viewport. Every row used fresh **Legacy → Enhanced → Legacy** pages from the same compiled bundle and identical initial scene. Each arm drove 150 real Game ticks at 60 Hz, warmed 30 frames and recorded 120. Audio was enabled. CPU submission and disjoint-safe GPU query timing cover the complete multipass renderer; frame intervals include simulation/presentation and scheduling.

This deliberately synthetic fixture uses 3 or 12 high-health enemies with actual AI. All seven real statuses are re-procced at 1 and 2 seconds. Normal player firing/heat/reload/heal runs alongside 18 extra actual-ballistic sticky shots that consume no player ammunition. Combat rules and status durations are unchanged. It is a capacity test, not an ordinary encounter.

**Frame interval median / p95, milliseconds:**

| Scene | Legacy first | Enhanced | Legacy repeat |
|---|---:|---:|---:|
| 3 targets, DPR 1 | 8.5 / 12.8 | 8.3 / 14.7 | 8.6 / 13.2 |
| 12 targets, DPR 1 | 19.6 / 29.2 | 13.2 / 22.9 | 17.9 / 26.5 |
| 3 targets, DPR 1.75 | 9.0 / 13.1 | 9.0 / 17.1 | 9.1 / 13.5 |
| 12 targets, DPR 1.75 | 19.4 / 28.7 | 13.8 / 23.2 | 18.0 / 27.8 |
| 12 targets, DPR 1, CPU 4× proxy | 83.1 / 130.3 | 63.9 / 120.1 | 97.0 / 157.3 |

Enhanced reduced complete-frame draw calls from 1,952 to 1,408 at three targets and 4,526 to 2,684 at twelve targets. Twelve-target CPU submission median fell from 11.2–12.1 ms to 7.0 ms. GPU medians in that profile were 2.93 / 3.08 / 3.28 ms, so the measured benefit is principally CPU work/draw submission. Twelve-target triangle count increased from 144,125 to 170,847. Geometry resources changed from 1,350 to 1,198 and texture resources from 18 to 51; these are counts, not byte-memory measurements.

All 15 arms passed with identical final target positions/health/statuses, player body and simulation weapon pose within each profile. All statuses remained active, particle/audio limits held, and no runtime/network errors occurred. The browser retained two expected pregesture audio warnings and a favicon request separately.

**Limits:** Twelve-target p95 exceeds 16.7 ms; this does not establish stable 60 fps in the extreme fixture. Three-target Enhanced frame tails were slightly worse despite equal/better medians. DPR 1.75 means a 2520×1575 drawing buffer on the same GPU. CPU throttling is only a main-thread pressure proxy; **physical midrange hardware has not been tested**. Repeated Legacy arms expose scheduling/thermal drift.

## Visual inspection

Gameplay captures show distinct flanker, rusher and shielded-heavy roles, ground contact and the upgraded mech cannon in combat. The twelve-target Enhanced captures at both resolutions retain localized splats/rings and readable silhouettes. At this deliberately excessive overlap, damage/status numbers obscure some distant heads and seven simultaneous coatings make nearby armor busy. A future crowd-readability pass should prioritize number aggregation and coating priority; no damage or status rules should change.

The normal entry is also checked through real start/move/fire/pause, Enhanced→Legacy→Enhanced, mute persistence and resume. The every-element normal workbench verification and its captures are recorded alongside this report.

## Evidence and reproduction

Open `artifacts/integrated/gallery.html` for the screenshots and linked JSON receipts.

- `encounter-summary.json`, `encounter-quality-first.json`, `encounter-legacy-first.json`: full measurement/trajectory parity and build fingerprints.
- `encounter-quality-loop.json`: real reward, slot isolation, derived stats and next-encounter shot.
- `stress.json`: all 15 matched arms, GPU/browser details, distributions, counters, screenshots and errors.
- `main-entry.json`, `main-elements.json`: normal-entry controls and every-element workbench gameplay.
- `review-labs.json`: both older comparison labs, both forms and 12 Legacy/Enhanced/Legacy arms preserve exact socket matrices, hit events and combat state.
- `verified-5e102dd/`: exact source and compiled archive used by the encounter/capacity comparisons (`game-DsicxL5T.js`).
- `source-manifest.json`, `source-final.tar.gz`: final deliverable source. A concurrent defeat/reset correction subsequently moved the dry-fire reset before pose publication. The review lab was also aligned to omit ballistic-root presentation offsets, and a separate repeatability diagnostic clears its navigation timer. No asset/audio, physics, balance, fixture or policy file changed. None of the measured encounter/capacity arms entered defeat/reset. Final normal-entry/element checks use `game-C9aGLM7L.js`; its main entry and Game JavaScript remain byte-identical after the later diagnostic-only build.

The complete test suite passes **515 tests**; TypeScript and both the normal/review build checks pass. The review bundle includes the ordinary main entry plus diagnostic pages. Normal production still builds from its main entry.

```sh
npm test
npm run build
npx vite build --config vite.quality.config.ts
npx vite preview --config vite.quality.config.ts --port 5198
# Playwright and Chromium must already be installed; optional environment overrides:
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
CHROME_EXECUTABLE=/absolute/path/to/chromium \
node scripts/verify-integrated-encounter.mjs
# Run verify-integrated-stress.mjs, verify-main-entry.mjs and verify-main-elements.mjs
# sequentially, with no concurrent GPU/browser workload or source/build changes.
node scripts/build-integrated-gallery.mjs
```
