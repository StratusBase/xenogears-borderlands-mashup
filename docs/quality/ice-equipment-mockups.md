# Ice equipment mockups

**Awaiting the user's pick before implementation.** [Open the static comparison](http://127.0.0.1:5330/review/). Generated boards, isolated generator, source/build fingerprints, local audits and Opus receipts are retained in `artifacts/concepts/ice-equipment-v1/`. This task changes no production rendering, equipment, combat, animation or audio source.

| Direction | Identity | Main tradeoff |
| --- | --- | --- |
| A / Cold-cell stack | Unequal plate accents on existing cold-pack faces and rear seals | Clearest first-person Ice identity; the flat-face treatment can still read as a decal |
| B / Frost-fed rails | Sparse seam frost, existing fins and small jacket slivers | Hardware-aware and restrained; close to stock at idle |
| C / Rime jacket | Broader feathery jacket frost, flush plate accents and return-seal frost | Stronger exterior read; most forward treatment is occluded at idle and the frost reads softer than the painted reference |

The pilot specimen is the existing Tackwork sticky-pressure launcher. The mech specimen is the existing heavy Cindergrid slug cannon, including the original paired first-person spacing. Original warm paint and parts remain. Baseline pale-blue transfer rings, jacket block and status lights are explicitly identified as existing hardware.

These are static code-native studies using current weapon meshes, the existing comic pipeline and approved plate/frost material language. Final plate accents use source-surface clipping and a projection/mask wrapper around the existing plate fragment math; they do not introduce extruded lips. The pilot's small elemental chamber is buried within its wide barrel, so the proposal treats the exposed outer jacket without moving the original chamber or muzzle.

Forty local static cases check original transforms, material/geometry identity, geometry-buffer hashes and muzzle coordinates before/after accents. The checks cover proposal roots only; they do **not** establish live slot isolation, collision or animated clearance. Static idle views mirror the current Game calibration (72° FOV, pilot extra z −0.30/scale 0.75, mech extra z −0.40). This is not Game execution. Side, neutral three-quarter and warm-yard views are supplied. No motion, sound or performance result is claimed.

## Opus 5.5 collaboration

Three CLI reviews reported literal `claude-opus-5-5` and successful results: aggregate design exploration, first image critique, final image critique. Tools, source access and session persistence were disabled. Prompts, visible responses, model receipts and exact image hashes are preserved. Opus assessed still images; it did not independently inspect source, audit logs, gameplay, motion, audio, LOD or performance.

The first critique drove source-clipped plates, different plate layouts per construction, removal of housing starbursts, corrected idle framing, warm-yard coverage and rear-seal accents. The final reviewer recommends **A as the most coherent single direction**, revising its provisional C-led recommendation after inspecting the calibrated first-person views. B/C remain distinct exterior options with the first-person limitations above. Optional A+C pilot or B+A mech blends are suggestions, not shown or approved options; show a specific blend mockup before treating one as selected.

The user may choose A, B, C or request a blend/revision. No equipment module or production registration should proceed from this review alone. After selection, retain the [equipment evidence requirements](ice-equipment.md) and the separate [open pacing gate](ice-pacing.md): actual pilot/mech idle/firing/reload, primary/secondary and mixed elements, live slot isolation, original muzzles/collision/combat, native sound and matched performance before adoption.
