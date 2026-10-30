# Gravity spike visual coverage

30 October 2026. The user reported missing Gravity improvements at `http://localhost:5186/`. Their actual Enhanced loadout was an Ironvale Gravity Spike Rifle. The integrated well/equipment work did not replace generic spike flight, contact or control-status art. The user explicitly chose **match the approved visuals and preserve spike combat**, rather than adding full wells to spikes.

## Production integration

- The existing `gravityModule()` now composes small `spikeFlight`, `spikeImpacts` and `spikeStatus` modules. Normal Enhanced uses them by default; no review query or save migration is required. Legacy and `gravity.spikes: 'legacy'` retain the previous spike art.
- Preserve the physical accelerator needle, root pose, flight parameters, swept collisions, damage, immutable shot recipes, proc RNG, 35% control proc and original control duration. Spike hits create **no new pull/hold/crush source**. The sticky/rocket/orb well policy is unchanged. `game.ts`, `world.ts` and `ui.ts` were not edited.
- A small dark pressure core and diffuse camera-facing vapor replace hard orbital projectile parts. The short wake stays localized to the carrier path. Contact makes an uneven inward puncture, rather than a full well or a radial flower. Primary/secondary sizes remain distinct. Vapor is depth-tested, excluded from comic outlines and raycasts, and follows the existing Ballistics fade/resource contract.
- Contact projects onto the shared visible armor/cloth surface and borrows only its pose. The transient burst follows that source, fits its billboard clearance and expires within 0.62 s; capacity is 24. Removing a target releases its burst. The original borrowed buffers/materials are untouched.
- The control-status wrapper consumes the existing status lifecycle/intensity. Its private last-Gravity-contact marker selects wispy spike art or the exact old non-spike status. It does not create/refresh a proc, read equipment, infer expiry, change target motion or add damage. Non-Gravity hits do not erase an active Gravity status. Later non-spike Gravity contacts restore the old status art.
- Gravity's original sound recipes and dispatch strength are retained, including secondary sound level. Replacing contact art dispatches the Gravity impact cue exactly once per original phase through the existing audio engine. Shared composed routing accepts a per-spec replacement predicate, preserving other Gravity deliveries and sibling elements.
- Shared payload-anchor metadata and the existing family scale are exposed instead of duplicating delivery offsets. The concurrent Shock flight/bomblet work is excluded from the Gravity commit. Existing standalone renderers remain available.

## Verification and evidence

The explicit normal entry `/?verifyGravity&gravitySpikes` reuses the existing integration harness and default production registry on an isolated save. It adds a spike selection, actual contact freeze, cloth/armor/floor/wall/underside aims and a same-build baseline that changes only spike presentation. Real Game ballistics, target collisions, statuses, damage, equipment and both sound buses remain active. Human display fixtures have high health and stand still for reproducibility; this is not a moving-AI encounter benchmark.

Evidence is ignored under `artifacts/gravity-spikes/`; earlier iterations and previous Gravity receipts remain preserved. `source-addendum.json` records one trailing blank-line cleanup after measurement; runtime tokens are unchanged and the frozen files were not rewritten. `source/`, `build/`, `source-provenance.json` and `build/provenance.json` identify the one compiled benchmark build. `results.json` contains full before/current/before-repeat traces; `summary.json` contains the table, GPU coverage and native recording audio checks. The gallery includes native-speed pilot/mech firing and reload, previous spike visuals, and contact screenshots. `scripts/package-gravity-spikes.mjs` checks hashes, exact combat/audio equivalence, exact muzzle/home transforms, parked-slot isolation, unlocked buses, absence of new wells, real reloads and both mech muzzle indices before packaging.

Measurements: six targets, fixed scene/inputs/seed, 120 warm-up + 720 measured frames per variant, sound on and recording/encoding off. Apple M5 Max, Chrome 156/Metal, 1680 × 1301 at DPR 1. Pilot primary Gravity and mech Fire + secondary Gravity:

| Loadout | Before frame median/p95 | Current | Before repeat |
|---|---:|---:|---:|
| Pilot | 8.2 / 10.2 ms | 8.2 / 10.8 ms | 8.3 / 11.5 ms |
| Mech | 8.3 / 9.5 ms | 8.3 / 9.5 ms | 8.3 / 9.4 ms |

Pilot median simulation/presentation update: 1.7 → 1.6 → 1.7 ms; CPU submission: 4.5 → 4.6 → 4.9 ms; unique GPU samples: 1.75 → 1.59 → 1.56 ms. Mech update: 1.5 ms throughout; submission: 3.9 → 4.4 → 4.4 ms; GPU: 1.79 → 1.77 → 1.77 ms. GPU query coverage exceeds 99%. Baseline drift prevents attributing these small CPU/GPU differences entirely to the effect. These results establish stable median frame time on this desktop, not a low-end performance guarantee. Heat/reload throttle the mech as usual.

Combat, status/RNG, hit/shot, target position and audio-dispatch traces match exactly in all runs. Muzzle/home transforms match exactly and parked effects remain inactive. The focused tests additionally replay actual spike ballistics/collisions and verify source ownership, non-spike compatibility, mixed channels, status restoration, target removal, finite capacity, per-event variation, secondary scale, material fade and retained flight hooks after presentation disposal.

The frozen workspace passes all 1,157 tests. A separate clean snapshot of HEAD plus only the Gravity commit's files/shared prerequisites passes all 1,103 tests, TypeScript and the normal production build, without the concurrent Shock/tooling changes. Vite's existing large-bundle warning remains. Actual surface-contact records confirm armor/cloth sources and floor `[0,1,0]`, wall `[0,0,1]`, underside `[0,-1,0]` normals; screenshots retain each case. Pilot/mech recordings include reload and ammo use; the mech uses both muzzle indices. Native audio RMS is 0.041 / 0.070 with peak 0.822 / 0.873, below clipping.

## Opus 5.5 review

Two read-only Claude CLI reviews used exactly `claude-opus-5-5` under the user's prior authorization. Transcripts are retained in `artifacts/gravity-spikes/claude/` (approximately $0.74 combined). Opus reviewed source and an actual armored gameplay still; it did **not** assess motion or listen to sound.

Adopted: replace old lingering orbital status art for spike contacts; fit billboard clearance; use 3–4 unequal wisps directed toward the core on screen; keep the dark core readable longer; slow shared spike timing; reset cosmetic seeds; preserve original contact-phase sound; strengthen subtle mist at rifle distance. A final local revision replaces crossed flight planes with camera-facing haze so head-on shooting remains visible, and increases the quiet status haze. Target/root identity is confirmed by the actual Ballistics contract and gameplay traces. Existing audio level and original phase counts are intentionally preserved. Concave armor corners can still naturally occlude depth-tested mist; no through-wall rendering or collision changes were added.

Native recordings contain the existing physical and elemental buses; packaging verifies nonzero audio energy and no clipped samples. This is capture/scheduling evidence, not a human listening review.
