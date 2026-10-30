# Corrosive splash on horizontal surfaces

The later [final gameplay verification](corrosive-signoff.md) closes the manual surface coverage and final-build matched performance gaps described in this original fix receipt.

The approved wall splash was being rotated flat onto horizontal faces. Its curls and gravity-driven tail could cross that face and be depth-clipped. Floor particles could also be stopped immediately by the old world-ground clamp, while residue on a raised surface was placed at world y=0.025.

The directional response now uses a contact frame selected once from the surface normal and shot approach. Horizontal sheets lift outward, then compress smoothly onto the contact plane as they settle. They remain in world space when the camera moves. Slopes blend into the horizontal treatment; underside impacts use their outward normal. The approved vertical frame and vertex animation remain byte-identical.

Residue uses the actual contact elevation and normal. Returning droplets settle against the struck mesh; they can fall past a finite top's edges. New particles retain their outward velocity at birth. Airborne detonations do not invent a floating support plane.

`BallisticPresentationImpact.hitSurface` supplies the existing struck object to the renderer and persists through the existing sticky fuse. It is optional visual metadata. Swept collision, target selection, blast cover/falloff, damage, projectile trajectories and timing are unchanged. The sizing module and audio recipes are unchanged. Main Enhanced gameplay already selects this response; no edits to game.ts, world.ts or ui.ts were required.

## Verification

- **655 tests pass**, including six new checks for floor/slope/underside clearance, view-independent contact frames, elevated residue, live particle launch, finite-edge settling, sticky support metadata and airborne behavior.
- `npm run build` passes with the existing large-bundle advisory.
- **30 exact source-before/source-after wall geometry comparisons** match checkpoint `328a175`. At every sampled floor phase the corrected sheet has zero vertices behind the surface. The complete values are in [the geometry comparison](../../artifacts/corrosive-ab/horizontal/geometry-comparison.json).
- Exact original/current engine replay still matches all hits and projectile transforms across all **13 delivery families**.
- The normal compiled `/` game was exercised through ordinary workbench, arrow-key aim and mouse fire. Floor onset and breakup, then a vertical dummy control, were captured in the same production build. The dummy control dealt **73.22** and applied **11 DMG/s** corrosion. Existing fallback controls were used after the automated browser denied mouse capture; no renderer/page errors were recorded.
- [Floor onset](../../artifacts/corrosive-ab/horizontal/floor-onset.jpg), [floor spray](../../artifacts/corrosive-ab/horizontal/floor-impact.jpg), [wall control](../../artifacts/corrosive-ab/horizontal/wall-control.jpg), [browser receipt](../../artifacts/corrosive-ab/horizontal/browser-check.json), [build/test receipt](../../artifacts/corrosive-ab/horizontal/verification.json).

Raised tops, sloped faces, undersides and finite edges have geometric/simulation regressions; they were not all traversed manually in the normal game. This bug-fix check is not a new frame-rate benchmark; the earlier performance receipts remain separate frozen builds.

Reproduce the source comparison with `node --import tsx scripts/verify-corrosive-surfaces.mjs`; it requires checkpoint `328a175` in local Git history. Run `npm test` and `npm run build` for the production checks. Refresh the normal game with Enhanced visuals selected. No push or deployment was performed.
