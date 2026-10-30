# Gravity: dark singularity, contracting distortion and ethereal inflow

30 October 2026. User requested a large distortion orb that shrinks rapidly, faster wispy purple inflow instead of solid ribbons, and explicitly retained the dark singularity in the center. The target comes from that written description; no exact Borderlands clip was verified.

## Implemented look

- The original `.32 × delivery scale` dark core remains throughout pull/hold/crush. A separate cosmetic distortion envelope starts at `2.7 × scale`, contracts to `.54 × scale` in .34 seconds, and fades out by .38 seconds. It does not enlarge collision, move the source or replace the core.
- The envelope samples real inked background color and opaque depth. It clips against the contact plane, uses its front-surface depth instead of the core's depth, protects both original/shifted samples near affected bodies, and limits displacement in CSS pixels and projected-radius terms. The thin ring-like rim was reduced substantially.
- Wisps use soft procedural filaments and low-density haze, with no black fill, ink edge or hard lit band. Short cached-path windows rush inward with fixed-time entry/exit fades. Minimum visible wisp/grit speed exceeds 10 m/s even at the actual smallest source scale, versus the 7 m/s target cap.
- Profiles remain varied once per source through shared cosmetic entropy. Geometry, material density, widths, timings and grit are presentation only. Body-edge wakes use the same soft material. The closest 12 affected bodies are protected regardless of which overlapping well owns them.
- The .28-second authoritative deployment, 4.5-second active duration, pull/hold/crush/release, collision, fired recipes, muzzles, equipment slots and audio recipes are unchanged. Nine gameplay/audio source hashes match the preceding frozen review host exactly.

## Composition and ownership

`gravity/lens.ts` owns the sphere, its shader and its release. `shared/sceneColor.ts` provides a small per-scene borrowed-input binding, fed by the existing `ComicRenderer` overlay pass. No opaque-scene capture, extra render target, gameplay clock or audio engine is created. Marked sampling surfaces get one conditional underlay draw before all other overlays, including opaque overlay materials. This prevents background sampling from painting over another effect. When the envelope is invisible, that extra draw is skipped. Borrowed textures remain renderer-owned; bindings and owned meshes/materials are released on source end, replacement, clear and disposal.

The lab plumbing now lives in one composed `dev/effects/gravity/review.ts` runner. Existing `lab.ts` still works. The dedicated wisp entry builds the **exact e05b31b pressure renderer and flow** through a Vite virtual module, rewriting only imports and transpiling TypeScript. It does not copy a historical implementation into tracked runtime files or add a legacy-art switch to production. Baseline hashes/source receipts are in `reference-provenance.json` and ignored reference files.

```sh
npx vite build --config vite.gravity-wisps.config.ts
npx vite preview --config vite.gravity-wisps.config.ts --port 5263 --strictPort
```

Open `/gravity-wisp-lab.html` or `/review/` in the prepared build. The virtual comparison requires this config; `npm run dev` alone does not supply it. Current evidence is under ignored `artifacts/gravity-wisps/`, with an immutable source archive and both looks in one compiled build. Earlier pressure/deployment builds remain untouched.

## Actual-gameplay evidence

Wall, floor, underside, raised support and slope retain six captured humans; cover excludes three; late entry changes five to six; rocket captures six and the smaller orb two. Rifle follow-up still hits the held armored combat proxy. Pause freezes state, and release returns actors to support. Cosmetic seed swaps retain complete combat and cue histories. Native wall/floor videos include deployment, contraction, pull, held rifle hits, periodic crush and landing with actual game buses. Recordings are not retimed and have scene/style/build/SHA-256 manifests.

The dark core is present in every held-target screenshot and after the envelope disappears in recorded frames. Same-frozen-frame on/off checks isolate distortion from all simulation and wisp motion: 1,994 near-floor pixels and 4,514 raised-support-edge pixels change above the JPEG-aware threshold of 8. The sampled human torso and visible green weapon-sight regions have zero change. This proves those sampled regions, not universal silhouette coverage. Raw unedited screenshots, coordinates and results are retained in `distortion-pixel-check.json`.

Claude Opus 5.5 reviewed the initial design, then source/tests and actual stills. Its floor masking, ring-like rim, DPI-strength and opaque-overlay-ordering concerns were corrected. A subsequent overlap-mask check protects actors owned by neighboring wells. Claude did not play continuous video or listen to sound, and did not review every later correction. Its possible missing-reference-plugin issue is resolved by the explicit dedicated config above. Model/tool receipts are Read-only and preserved alongside the critique.

## Validation and performance

42 focused gravity/main-presentation tests pass; the final live workspace checkpoint has 954 passing tests and a successful application build. The frozen application typecheck/build also pass. The frozen host retains the exact pre-change 13-delivery ballistic replay. A live replay against that older baseline differs for Cluster because concurrent commit `32caa1e` intentionally implemented classic MIRV; that unrelated change is not included in the review host or this rendering commit. Its original failed replay log is retained rather than presented as a gravity regression.

Apple M5 Max / ANGLE Metal, 1280×720, DPR 1; six targets, three active wells; 120 warm-up + 720 measured frames per run; fixed 1/60 simulation step per rendered frame. Sound on, recording off. Before/current/before-repeat are in one compiled build with full normalized combat and cue-history equality. Values are median / p95 milliseconds.

| Scene | Variant | Frame interval | Simulation CPU | Render submit CPU | Full render GPU |
|---|---|---|---|---|---|
| wall | before | 8.30 / 9.40 | 1.50 / 2.10 | 3.70 / 4.60 | 1.93 / 3.54 |
| wall | current | 8.30 / 9.70 | 1.50 / 2.00 | 3.90 / 4.90 | 2.02 / 3.41 |
| wall | before-repeat | 8.30 / 9.70 | 1.40 / 1.80 | 3.10 / 3.60 | 2.20 / 4.29 |
| floor | before | 8.30 / 9.30 | 1.30 / 1.80 | 3.40 / 4.00 | 2.53 / 3.52 |
| floor | current | 8.30 / 9.80 | 1.40 / 1.80 | 3.40 / 4.10 | 1.83 / 3.00 |
| floor | before-repeat | 8.30 / 9.40 | 1.50 / 1.90 | 3.80 / 4.40 | 1.65 / 2.73 |

Frame medians stayed display-paced at 8.3 ms. Wall GPU medians were 1.93 → 2.02 → 2.20 ms; floor 2.53 → 1.83 → 1.65 ms. Repeat-baseline drift prevents a causal speedup claim. Current frame p95 was 9.70 ms wall / 9.80 ms floor. These are local warm-run comparisons, not a device-wide FPS guarantee or cold-start/close-camera signoff. Raw timing distributions, draw counts, peaks and repeated baselines are in the packet. The earlier pre-overlap-mask timing is retained separately and is not reported as final.

The four native-speed H264/AAC exports include actual game-bus audio; after clips pass nonzero/unclipped PCM checks. Recording hashes, scene/style labels, source positions and dark-core/envelope frame samples are verified. Browser shader/error logs are empty. Exact source/build hashes and immutable review-host source accompany the gallery.


## Remaining integration and coverage

This is the controlled actual-Game prototype, with intact stationary high-health clothed/armored humans and preserved combat proxies. It is not normal-main integration or moving-AI signoff; combat-lead ownership and the [handoff](gravity-integration.md) still apply. Floor cores can be occluded by bodies under real depth. Slopes use conservative AABBs. The lens is front-faced; entering its volume/very close cameras and non-1× GPU cost need production coverage. Overlapping lens deformations do not stack as a physical optical simulation. Preserve the current MIRV behavior when the combat lead integrates gravity delivery policy. No push or deployment is part of this pass.
