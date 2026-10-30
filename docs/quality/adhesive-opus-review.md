# Adhesive A / Claude Opus 5.5 review

30 October 2026. The user requested collaboration with Claude Opus 5.5 against the approved A mockup. The installed Claude Code 2.1.314 CLI returned a successful read-only review; its result metadata lists `claude-opus-5-5` under `modelUsage`. Only Read tools were enabled, MCP servers/hooks were disabled, and no edits or commands were delegated. Other running Claude sessions were untouched.

The ignored `artifacts/adhesive-prototype/` folder preserves `claude-review-request.md`, `claude-review.json`, `claude-review.md` and `claude-review.stderr`. The reviewer received the approved concept, actual human/armor repeated-fire frames, multi-phase motion sheets, surface screenshots and the listed adhesive modules. It did not hear sound or watch continuous video; timing comments derive from source and sampled frames. Its opinion is not the user's visual approval.

## Findings and decision

1. **Material is the biggest gap.** The approved board has dark honey depth, saturated amber mids, luminous thin edges and broad cream highlights. Gameplay still reads as mustard/paint, with a weak peach stain on cream armor. Existing tiny glints and uniform alpha flatten the effect.
2. **The longest-lived shape still repeats.** Burst profiles now vary, but the source-bound mask uses the same three-lobe footprint and skew each time. Five different geometry families can collapse into roughly two visible shapes at gameplay distance because subordinate pulls become thin threads.
3. **Aftermath lacks viscosity.** Detached flecks can read as sparks/confetti. The board calls for attached hanging drips, surface runs, and a substantial deposit. Pulls retract only partially before fading.

The reviewer also recognized localized deposits, outer-armor placement, intact humans, pinched necks/weighted tips, surface orientation and much smaller secondary response. Automated tests establish that burst geometry does vary beyond uniform scaling/rotation, but that does not prove sufficiently distinct silhouettes on screen. Its criticism of perceived repetition remains useful.

## Proposed next passes

| Priority | Proposed change | Review criterion |
|---|---|---|
| 1 | Verify color/output conversion with controlled swatches; use thickness-driven dark amber cores, lighter thin edges, varied opacity and a broad controlled highlight | Clearly reads as honey on shirt and cream armor at gameplay distance; source remains readable |
| 2 | Seed mask orientation, lobe offsets/weights and pad bias from the event profile | Repeated settled deposits no longer show the same stamp |
| 3 | Thicken subordinate ropes, vary attachment points/direction and manage directional runs | Distinct families remain visible at normal distance without broad petals or dominant repeated spikes |
| 4 | Slow loose beads, add hanging/releasing drips and restrained wall runs | Heavy, sticky aftermath with fewer confetti-like flecks |
| 5 | Retract tip substantially before fading, merging weight into the pad | Native-time stretch/return is visible instead of disappearance |

The material-only pass is the recommended next step. These are recorded proposals; they have not been silently applied to the measured prototype. Preserve cosmetic-only authority, sizes/exposure, finite budgets, slots/muzzles and the existing audio engine. Recheck human/armor at multiple distances, random and fixed seeds, mixed elements, moving targets and surfaces, then repeat matched sound-on measurements for the changed source.

## Source follow-up and uncertainties

The reviewer inferred that shader constants may be receiving linear-to-sRGB conversion, but did not inspect the composer. Follow-up source inspection confirms `src/game.ts` selects `THREE.SRGBColorSpace` and `src/rendering/ComicRenderer.ts` applies `OutputPass` before FXAA. That supports testing the color path; it does not replace pixel/swatch verification or prove a single numerical cause of the material read. The dark rim and equipment cartridge visibility also need direct A/B checks.

Audio suggestions came only from recipe inspection: subtle cosmetic pitch/timing variation, shape-specific peel/thud balance and checking whether the triangle/warble reads as a boing. Existing engine variation must be audited before adding another layer. Do not claim those suggestions are a listening result.

The current prototype remains available for review; normal Enhanced adoption awaits the user's visual approval. [Integration handoff](adhesive-integration.md) and [verification receipts](adhesive-verification.md) describe the working changes and measured boundaries.
