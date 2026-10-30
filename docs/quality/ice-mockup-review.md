# Ice mockup fidelity review: Claude Opus 5.5 + Codex

30 October 2026. Review only; this task changed no runtime VFX, audio, gameplay or UI. The reviewed direction is **B Platefrost release + A Rimebite frost aftermath**. This is a proposal for another art pass, not an approval to replace the current effect.

## Review provenance

Claude Code 2.1.314 completed two image-only requests. Both assistant responses identify the model as `claude-opus-5-5`; both requests returned success. The reviewer received the two approved boards, eight actual gameplay stills and two contact sheets extracted from the delivered native gameplay recordings. The sheets sample nominal 0.4-second intervals. Tools and session persistence were disabled. No source code was sent.

Automatic approval rejected an initial packet containing source code before execution. The completed review used a reduced images-only packet. Codex checked implementation feasibility locally, then asked Opus to refine its recommendations around preserving sizing, particle counts and the distinction between evidence and inference.

- [Opus initial review](../../artifacts/ice-opus-review/opus-review.md).
- [Opus revised recommendation](../../artifacts/ice-opus-review/opus-followup.md).
- [Verified response metadata](../../artifacts/ice-opus-review/review-receipt.json).
- [B concept](../../artifacts/concepts/ice-v1/b-platefrost.png) and [A concept](../../artifacts/concepts/ice-v1/a-rimebite.png).
- Actual [cloth release](../../artifacts/ice-prototype/cloth-after-peak.jpg), [armor release](../../artifacts/ice-prototype/armor-after-peak.jpg), [cloth frost](../../artifacts/ice-prototype/cloth-after-aftermath.jpg), [armor frost](../../artifacts/ice-prototype/armor-after-aftermath.jpg).

## Verdict

The prototype retains the localized, intact-human treatment, but its dominant release shape falls short of B. Opus sees two opposed cyan lobes rather than an overlapping cluster of thin, distinct ice plates. That read also occurs in the HUD-free video contact sheets. The aftermath is bright and centered; it needs a more convincing feathery frost pattern to reach A's target.

Opus did not play the game, inspect full-rate video, hear sound or inspect source. Its first claim that the aftermath was a radial starburst was qualified after considering the white reticle over the impact center. The revised assessment is a bright, centered, streak-textured patch; its exact radial structure needs a separate diagnostic. A still that cannot establish slope alignment is not evidence of broken alignment.

## Prioritized proposed work

| Priority | Improvement | Local feasibility check and bounded approach | Acceptance |
| --- | --- | --- | --- |
| 1 | Break the bow-tie silhouette into readable layered plates. | `response.ts` already emits five independent plates for the sampled primary detonation. Start with their arrangement, unequal proportions and rotations; no additional particle count is needed to test the recommendation. Retain the current reach, radius and secondary falloff. | At ordinary gameplay distance, cloth and armor show an asymmetric cluster with a visible overlap outside the reticle. Forming roots stay attached; released plates can travel beyond the torso. The existing envelope is preserved. |
| 2 | Make the plates read as thin ice rather than cyan plastic. | The plate shader's existing bright edge approximates an ellipse. Follow the actual irregular polygon boundary with a thin pale rim, lighten/desaturate the fill, and use sparse fracture detail instead of repeated stripes. Keep the existing instanced pass first. | Bright rim and darker fill separate in grayscale on both cloth and tan armor. Individual plates remain distinct at normal distance without thick outlines, bloom or scene refraction. |
| 3 | Make A's aftermath irregular and feathery. | Rework the existing source-bound rime mask inside the unchanged footprint. Bias branches toward the dominant plate, break up the boundary and soften its brightness. Try the current overlay before introducing a separate decal system. | The ordinary view reads as frost with clothing/armor still visible. Supplementary HUD-free diagnostics distinguish shader structure from the reticle. Status duration/intensity and secondary radius remain unchanged. |
| 4 | Clarify form → fracture → release. | Current plates grow over 45 ms and begin releasing at 25 ms, with later plates staggered. Test a clearer short attached formation beat and restrained peeling motion. Broad-event and compact-contact timing should remain distinct. | Frame-step a new 60 fps gameplay capture: formation and separate release are readable, with no target hit-stop, extra damage, delayed fuse or invented frozen state. All timing numbers remain provisional. |
| 5 | Improve small chips' screen silhouette. | The existing flakes are octahedra, not spheres. Their blue, small projected shape can nevertheless read as drops. Test paler, sharper shading and aspect variation within the existing pool. | Ceiling and floor debris reads as angular ice at gameplay distance; no liquid-drip impression. Existing finite-support and no-clipping checks still pass. |

Any aspect-ratio or geometry change must update the presentation support-extents calculation and rerun the all-vertex floor/slope/underside regression. The existing surface frame, visible outer-armor projection and equipment exclusion are working infrastructure to preserve, not systems to replace based on a screenshot impression.

## Recommended next pass

Implement **priorities 1 and 2 together**, on both clothed and armored humans, keeping the current sizing and particle budget. Compare the existing and candidate versions in the ordinary view at the same 183 ms release checkpoint, plus full-rate motion and the 883 ms aftermath. Use the mockups to judge plate shape and material, not to justify changing the camera, lighting or target art. Then address the rime mask separately so its improvement can be judged clearly.

Opus proposed a dominant plate with smaller supporting plates and modest in-plane rotation variation. Those are tuning ideas, not new sizing rules. Do not adopt its initial recommendation to shrink the aftermath or constrain every released fragment inside the torso. It withdrew both after clarification. Small settled world-surface plate remnants are optional: the approved combination selects B's release and A's aftermath, not every part of B's settle illustration.

The audio was not reviewed by Opus. A future motion pass should audition the existing weapon report with brittle clicks aligned to the actual release, rather than claim audio quality from images or recipe inspection. Audio changes require a separate listening check.

Preserve collision, muzzle/flight/fuse behavior, combat and status rules, equipment isolation, the stable damage-number fix and existing renderer availability. Re-run relevant regressions and matched before/current/repeated-before timing with sound on and recording off. The earlier Ice timing receipt includes baseline drift and long stalls; this review does not resolve them or establish a zero-cost visual improvement.
