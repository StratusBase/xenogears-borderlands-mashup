# Normal-game Radiation integration verification

30 October 2026. Radiation now registers at the ordinary Enhanced presentation root with Fire and corrosive. The existing irradiated-death rule supplies a confirmed pulse notification. No damage, status probability, collision, muzzle, fuse, range or slot rule was changed. Legacy remains available.

## Reproducible evidence

The compiled main entry is served at `http://127.0.0.1:5258/`; explicit review controls use `/?verifyRadiation=1`. `artifacts/radiation-integration/build/provenance.json` fingerprints every transformed source in the measured build. [Open the playable evidence page](http://127.0.0.1:5258/review/) for the two sound clips and screenshots. Screenshots and WebM recordings come from that build, not mockups. The ordinary URL retains the normal save/input flow; the query uses a separate save and controlled fixtures but the identical production renderer. It does not install the old standalone Radiation prototype.

Matched protocol: Apple M5 Max / ANGLE Metal, 1280 × 720, DPR 1, 120 warm-up + 720 measured display frames per arm, 1/60 simulation steps, sound on/unlocked, recording off. Order is before → integrated → before-repeat in one compiled build. The baseline removes only Radiation registration; concurrent Fire and corrosive stay present in both. The before arm uses the original generic Radiation effect and old death burst, rather than the earlier A+B art baseline. Every frame checks the canvas size/DPR. The shared performance meter counts the full multipass frame and queries GPU time.

The rifle and rocket fixtures use six native Game enemies with raised health, real occlusion, normal cadence and reload, aimed in a repeated six-target sequence. Rifle hits four distinct targets (front targets occlude two); rockets affect all six. The death fixture has one 60-health source, two eligible nearby recipients, a real line-of-sight blocker and an out-of-range target. It measures one actual irradiated death and aftermath, not a continuous kill storm. Each arm clears prior fixture drops/pickups (the ordinary Game reset deliberately retains world loot). Loot item stats and pickup counts are included in the equality check. Review-only drop identities are fixed to keep procedural loot geometry identical across comparison arms; native item stats, eligibility and random draws are preserved.

<!-- FINAL_RESULTS -->
Frame time, median / p95 (ms), lower is better:

| Scene | Before | Integrated | Before repeat |
|---|---:|---:|---:|
| death-pulse | 8.3 / 9.4 | 8.3 / 9.4 | 8.3 / 9.3 |
| rifle | 8.3 / 10.0 | 8.3 / 10.7 | 8.3 / 10.1 |
| rocket | 8.3 / 10.3 | 8.4 / 10.5 | 8.2 / 10.3 |

All three arms in every scene have identical combat, loot stats and pickup counts. Both baseline repeats also have identical median draws and geometry counts.

| Scene / arm | Update ms | Submission ms | GPU ms | Median draws | Geometries |
|---|---:|---:|---:|---:|---:|
| death-pulse / before | 1.1 / 1.3 | 2.5 / 2.9 | 2.1 / 3.1 | 1292 | 609 |
| death-pulse / integrated | 1.0 / 1.2 | 2.5 / 2.9 | 2.1 / 3.2 | 1324 | 648 |
| death-pulse / before-repeat | 1.0 / 1.2 | 2.2 / 2.5 | 2.1 / 3.2 | 1292 | 609 |
| rifle / before | 1.6 / 3.5 | 3.3 / 5.2 | 2.1 / 3.2 | 1486 | 669 |
| rifle / integrated | 1.4 / 2.6 | 3.0 / 3.7 | 2.0 / 3.1 | 1512 | 704 |
| rifle / before-repeat | 1.5 / 3.0 | 3.0 / 3.8 | 1.9 / 2.9 | 1486 | 669 |
| rocket / before | 1.7 / 3.5 | 3.2 / 3.9 | 2.2 / 3.0 | 1511 | 680 |
| rocket / integrated | 1.6 / 3.6 | 3.4 / 5.6 | 2.1 / 3.1 | 1530 | 716 |
| rocket / before-repeat | 1.7 / 3.7 | 3.2 / 4.2 | 2.1 / 3.0 | 1511 | 680 |

Raw traces: `artifacts/radiation-integration/performance-results.json`; compact receipt: `performance-summary.json`.
<!-- END_RESULTS -->

Frame cadence is near the browser's 120 Hz limit; these results do not demonstrate a speedup. GPU, submission, draws and allocation counts are recorded alongside frame distributions. Measurements are from a shared development machine, not hardware certification.

## Gameplay and sound

Actual death: source maximum health 60 gives 10.8 damage to each of the two eligible recipients; blocked and out-of-range targets remain untouched. One confirmed source release is presented, with small recipient deposits rather than another full bloom. No extra propagation or renderer-owned damage/status application occurs. Intact models and materials remain; no gore.

The **ordinary main URL with no query or evaluation driver** was also exercised: open the regular workbench, select Radiation rockets with guaranteed status, Equip & Test, then fire through native mouse input. Five rounds were spent; the normal dummy screenshot shows 292.16 damage and a live Radiation status ribbon. The weapon preview was captured separately. Native encounter movement, enemy attacks, player damage and firing were also exercised. The embedded browser blocks pointer lock; its existing click/arrow fallback works and was used. This is an input-host limitation, not a VFX/shader error.

The recordings tap the actual final physical and elemental audio buses, with no microphone, replacement soundtrack, normalization or retiming. Final extracts are stream copies; full originals and media/signal receipts are preserved. Benchmarks run separately with capture disabled. Captures demonstrate native firing, impacts, lingering feedback and a real status-driven irradiated kill. The ordinary encounter path is checked separately with native AI/input rather than treating stationary fixtures as AI coverage.

## Regression checks

878 tests pass. Both TypeScript projects and the compiled Vite build pass (existing large-bundle advisory remains). The new tests execute the actual original and current `Game.hurtEnemy` methods and compare complete damage, vitals, statuses, loot stats, kills, line checks and combat RNG calls, including nested irradiated kills, the exact 5 m boundary, blocked/outside targets, nonirradiated deaths and the Legacy fallback. Production tests check exclusive routing, one cached status lifecycle, cleanup/toggling, mixed Fire/Radiation/corrosive carrier identities, and unchanged pilot/mech muzzle transforms, source geometry, material and raycast through release/rebind. Existing replay coverage retains all 13 deliveries and status outcomes.

No VFX or shader errors were logged; the only browser warnings were the pointer-lock denials described above. Playback verification reached the end of the 12-second death clip unmuted and without a media error.

Only the necessary death notification was changed in `src/game.ts`; `src/world.ts` and `src/ui.ts` were not edited for Radiation. Current concurrent element work is preserved at the shared registry. No push or deployment occurred.

## Concurrent-work boundary

The immutable measured build was compiled at **2026-10-30T13:32:08Z** with Fire, Radiation and corrosive. During evidence packaging, the concurrent Shock owner added its production module and confirmed-chain hook in the live checkout, preserving Radiation and the death notification; Fire tuning also continued. `source-drift.json` records those exact paths. The measurements and recordings above refer to the frozen build, not performance certification of the later combined Shock integration. Radiation source, visual behavior and notification wiring remain the same; current-source regression checks are recorded separately.

Final live-checkout recheck after concurrent Shock integration: **897 tests passed**, both TypeScript projects and the standard production build pass. A missing parameter type in the concurrent Fire renderer mock was annotated; this changes no runtime behavior. Logs: `current-source-tests.log`, `current-source-typecheck.log`, `current-source-build.log`.
