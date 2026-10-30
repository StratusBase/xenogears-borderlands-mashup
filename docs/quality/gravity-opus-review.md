# Gravity VFX review with Claude Opus 5.5

30 October 2026. Independent review by **Claude Opus 5.5**, followed by a technical correction round with Codex. Both calls reported `claude-opus-5-5` and had only the Read tool. This is an art recommendation, not implementation or visual signoff.

## Verdict

**The petal fix overcorrected.** The revised effect avoids the original rosette but loses the mockups' visual weight. A small purple core, thin streaks and faint grit leave the enemy movement doing most of the work of communicating gravity.

The strongest reference qualities to recover are B's unequal pressure folds, C's physical grit and the revised well board's clear shared source. Matching painted bloom or refraction is not the goal of the first iteration.

Direct findings from the reviewed images:

- The floor core becomes hidden by the captured humans. The wall core remains more visible, but the surrounding influence is hard to read.
- Pale orbit outlines can resemble a targeting reticle. Body contours and narrow wisps can resemble scratches rather than pressure.
- Fine grit is difficult to distinguish at the captured combat distance.
- The source uses the same fixed path family for every well; it has not adopted the newer shared variation helper.
- Stacked health bars and large viewmodel framing compete with the effect. Those are separate integration/fixture concerns, not reasons to change gameplay in the VFX renderer.

## Recommended next art iteration

| Priority | Visible improvement | Implementation direction |
|---|---|---|
| 1 | A clear dark source with a restrained hot rim | Improve value contrast and cel edges; replace reticle-like tori with irregular broken pressure crescents. Keep real depth. Any visual enlargement must fit the validated clearance. |
| 2 | Readable inward pressure with useful width | A few unequal broken sheet segments, with dark bodies and lit edges, mixed with fine traces. Use stable camera-facing width and finite accelerating inward motion. Avoid shared middle bulges, equal spacing and simultaneous full-radius spokes. |
| 3 | A visible connection between captured targets and the source | Broken wakes behind pulling bodies, shrinking to short pressure ticks at visible body edges during hold. Use authoritative member positions; leave heads and torsos open for rifle fire. |
| 4 | Distinct spawn, hold, crush and release | Inward onset, quieter hold, contraction on authoritative crush pulses, then a core collapse with brief dust/grit residue. These are cosmetic changes, not new combat timing or damage. |
| 5 | Weight and variety | Redistribute the existing grit budget toward readable surface-colored grains. Choose one stable cosmetic family/seed per source through the shared variation helper; vary lengths, widths, gaps, timing and handedness without consuming gameplay RNG. |

The flower guard is **unequal incoming segments with staggered timing and open gaps**. Restoring eight broad radial leaves would repeat the original problem. The full three-dimensional field should become readable over a short interval; every direction need not light up in every frame. Size the art from each authoritative `well.radius`, not a fixed six-meter sphere.

When bodies hide the core, visible stream ends, body-edge pressure cues and grit can communicate its location. Do not move the source or alter capture slots to make the art easier. An x-ray rim through cover is not the default solution.

## Technical corrections agreed in the follow-up

- The initial proposed `r = r0(1-s)^1.6` **decelerates** for linear `s`. Separate curve shape from travel timing: a cached arc-length curve with an accelerating, finite-speed timing function is the corrected direction. Exact speeds remain art hypotheses.
- `coreRadius = .32` is a radius. Before delivery scaling, the current diameter is .64 m; the reviewed sticky/rocket/orb core diameters are approximately .53/.80/.47 m. The first review's inconsistent size suggestions were withdrawn.
- The bed samples authoritative `well.age`; it does not own an independent renderer clock. Its .55 s cadence differs from the .5 s crush cadence. No perceived audio defect was established by listening.
- Current elemental voice peaks were 22 on wall and 21 on floor; 12 was the old-presentation baseline.
- Review humans retain real combat collision proxies beneath noninteractive display meshes. Preserve those moving hitboxes; effect placement should respect visible outer armor. Do not claim weapon collision against rendered armor triangles.
- Fixed visual-coverage percentages, mask tooling and an always-on occluded rim were proposals, not existing or validated requirements.

## Validation gate

Prototype the art changes without changing field placement, pull, hold, damage, release or slots. Then review new native-speed recordings with sound: clothed and armored humans, floor/elevated wall/underside, late entrants, rifle follow-up and three simultaneous wells. Check repeated-shot variety, readable silhouettes, true depth and surface support. Re-run matched before/current/before-repeat measurements with sound on and recording off, including p95 frame time, render CPU and GPU timing. Existing display-paced 8.3 ms medians do not establish spare GPU budget.

Audio suggestions remain source-based: distinguish intake, crush and release; consider a restrained capture cue and manage overlapping wells through the existing audio engine. They need actual listening. Screen-space refraction, volumetric dust, an x-ray rim and new support-shadow metadata remain separate experiments/handoffs. Normal-main integration remains with the combat lead.

## Evidence and limits

Claude inspected three concept boards, four frozen gameplay screenshots and ten timestamped video frames. Neither review played the game, watched continuous footage, listened to sound or remeasured performance. Gravity runtime source was verified to match the frozen captured version from `6f1ff2d`.

- [Original independent review](../../artifacts/gravity-prototype/opus-review-2026-10-30/claude-review.md) — retain the corrections below it; its rough fidelity percentage was subjective, not a measurement.
- [Claude's corrigendum and minimum plan](../../artifacts/gravity-prototype/opus-review-2026-10-30/claude-followup.md) — supersedes conflicting first-pass recommendations.
- [Model/tool audit](../../artifacts/gravity-prototype/opus-review-2026-10-30/review-audit.json)
- [Input provenance](../../artifacts/gravity-prototype/opus-review-2026-10-30/review-input-provenance.json)
- [Codex's independent comparison notes](../../artifacts/gravity-prototype/opus-review-2026-10-30/codex-observations.md)

Generated evidence stays in ignored `artifacts/`. This tracked summary preserves the review direction alongside the [canonical design](gravity-design.md) and [integration handoff](gravity-integration.md).
