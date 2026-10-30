# Fire: independent Opus 5.5 review against approved mockups

30 October 2026. Requested by the user after rejecting the smooth ribbon Fire pass. This reviews the subsequent turbulent-volume prototype, not an approved final effect.

Claude Code reported canonical model `claude-opus-5-5`, first-party provider. The completed review used a bounded copy of all three mockup boards, 19 actual gameplay screenshots/frame extracts, six Fire source files, local timing results and audio-presence metrics. Claude had only read and filename-discovery tools; it made no edits. Its output and exact packet hashes are retained under `artifacts/fire-prototype/turbulent/`.

## Decision

The prototype still does not meet the mockups. Its soft volume improves on the rejected straight ribbons but misses the deliberate cel flame silhouette, direction, contact contrast, C curls, and B char/ember treatment. Passing combat/performance checks does not close those visual gaps.

Recommended next proof, in order:

1. Replace the dominant puffy shape with 2–3 deliberately forked, curling flame shapes, clear dark-red/orange/gold bands and a small bright contact core. Keep the target's face readable. Test A and C together so the latter has a distinct sweeping crescent rather than a larger A.
2. Release along a surface-safe outward direction with projected incoming tangential momentum, upward bias and unequal tip motion. Keep existing support-plane clipping and secondary falloff. World-up alone is insufficient.
3. Diagnose the faint char on the actual cream outer plate, then spread small wisps and glowing specks around the burn edge. Make the primary spark spray and smoke visible against the orange yard without scaling secondary recipients to the primary.
4. Add a convincing contact base/scorch and ceiling flow along the support. Recheck floor, wall, slope, underside, close range, mixed elements and sustained explosive load with sound.

Use a hybrid proof: art-directed flame cards/curves or authored flipbooks for the important silhouette, with the current volume reduced to a supporting core if useful. Additional noise alone will not produce the illustrated shape language. Dedicated textures may be needed; artist tooling and delivery time are not established by this review. Do not promise paintover fidelity before an in-engine proof.

## Review limits and corrections

- Claude compared stills and frame sequences; it did not watch native motion, listen to sound, run the game, or independently measure performance. Those runtime checks were performed separately by Codex. The review is visual art-direction advice, not runtime signoff.
- Its F6 reference to a +50 ms surface capture is mistaken: the supplied floor/ceiling frames are +250 ms. The absent attachment/scorch is still a visible concern; fade-in alone does not explain it at that age.
- Its suggestion to use camera-to-hit direction must not point the flame into armor or a support. Project incoming motion into the support plane, combine it with an outward component, and retain the clipping guard.
- Its suggestion to cut interior holes is not adopted literally. The user previously rejected perforated effects. Favor deliberate forked edges and broad negative space, not scattered holes.
- A near-white core should be small and brief, not an opaque pale ball. Spark counts and silhouette thresholds in the critique are proposed acceptance checks, not measured facts or mandatory art rules.
- The cause of the faint char is unproven. Inspect the material/source binding, normal gate, draw depth and authoritative intensity before changing opacity blindly.
- Equipment/projectile close views were not supplied. Their visuals currently inherit the base renderer and need their own comparison before claiming that every Fire channel matches the boards.

## Claude review, preserved verbatim

# Independent Fire VFX review: playable A+B/C compared with the mockups

I opened everything in the README manifest: all 3 mockup boards, all 19 gameplay JPGs (both 100ms/250ms pairs, both aftermaths, floor, ceiling, sustained fire, and both 5-frame video sequences), all 6 source files, `measurements.json` and `media.json`. I made no edits. Plan mode asked for a plan file and an exit step, but I didn't have the tools for either, so the whole review is in this reply.

## 1. Verdict

**The playable effect is still far from A+B, and further from C.** It no longer looks like straight ribbons. It now looks like soft, puffy orange smoke that rises straight up, and it doesn't yet match the hand-painted cel look of the mockups.

**What the images show:**
- **Rifle hit on the clothed human at 100ms:** a pale, round blob about half a torso wide. It has no direction, no bright starburst core and no visible sparks. The mockup's contact frame (A, panel 01) has all three.
- **Same hit at 250ms, and video frames 1.20s–1.50s:** the blob moves **up and over the head and covers the face** (clearest at 1.35s). The edges are lumpy like cauliflower, not forked like flame. In A and C the flame tears diagonally up and back, away from the body, and the face stays clear.
- **Sticky bomb on the armored human at 100ms:** a soft fireball about the size of the torso. **At 250ms:** two tall, see-through, rather photographic columns. Nothing has the curling crescent shapes, spark spray or smoke that define C.
- **Both aftermaths, and video frames 1.70s and 2.90s–3.50s:** one small campfire-icon flame on the chest. I couldn't see any char patch, glowing ember specks or smoke wisps. Those are B's whole visual identity.
- **Floor hit:** a lumpy blob at the target's feet, with no scorch ring and no bright base where it touches the ground.
- **Ceiling hit:** a small blob hanging under the overhang, with no visible scorch.
- **Splash on bystanders:** this is correct. The armored bystander on the right only shows a tiny spark in the sticky images. That's the one area that already matches the brief.

**What I inferred from the source (not seen directly):**
- The soft, blobby silhouette comes from the volume shader's wide soft edge and its blend of rounded shapes.
- The vertical rise comes from the effect being oriented to world-up only, with nothing pushing it along the shot direction.
- The sparks and smoke are probably being drawn but are too small or too faint to see at this distance.

Details are in the findings below.

## 2. Findings, in priority order

### F1. The flame is shaped and coloured like soft smoke, not cel-shaded flame
- **Compare:** A cloth/armor panels and C cloth panel, against `human-bullet-250ms.jpg`, `armored-sticky-250ms.jpg` and `surface-floor.jpg`.
- **What's wrong:** the mockups have sharp, forked flame tongues with hard edges, a near-white core, a gold middle and a dark red rim. The game shows lumpy, soft-edged blobs with a muddy gradient and no bright core. Because the edges are soft, the flame looks pasted on top of a scene that otherwise has ink outlines and flat shading.
- **Why (source):**
  - `flame.ts:50` turns density into opacity over a very wide range (0.04 to 0.31), which blurs every edge.
  - `flame.ts:47` combines the lobes by taking the maximum of rounded ellipsoids, which produces a puffy outline.
  - `flame.ts:70-71` caps the hottest colour at a dark gold (1.2, 0.68, 0.035), so nothing ever reaches white.
- **Fix:**
  - Use a much narrower edge threshold so outlines become hard.
  - Use "ridged" noise (sharp crests instead of smooth bumps) to carve the outline into tongues.
  - Cut holes into the interior based on height, so the upper part breaks up.
  - Snap the heat value into 3–4 flat colour bands, from dark red rim to orange to gold to a near-white core.
- **Cost/risk:** low cost, all in the shader. Risk: hard edges at 36 samples per ray can shimmer, so it needs a temporal check.
- **Check in game:** at 250ms, at least 3 separate tips with clear gaps between them, a visibly white core, and no soft gradient on the outer edge.

### F2. The flame rises straight up over the face instead of tearing along the shot
- **Compare:** A release frame 02 and C release frame 02, against `human-bullet-video-1.20s/1.35s/1.50s.jpg` and `human-bullet-250ms.jpg`.
- **What's wrong:** in the mockups the flame streams diagonally up and back, away from the impact, and the face stays readable. In game the plume goes straight up and covers the head by 1.35s.
- **Why (source):**
  - `response.ts:52-56` sets the volume's "rise" axis to world-up only.
  - `flame.ts:13` makes the lobes climb almost purely vertically, with only small sideways curl.
- **Fix:**
  - In `present()` (`response.ts`), compute a release direction from the surface normal, pointed away from the shooter (camera-to-hit direction), with some upward bias.
  - Pass it to `fireLobes()` and lean each lobe's path along it as it ages, so it bends sideways instead of only rising.
  - Optionally stretch the volume box along that axis.
- **Cost/risk:** low. This only changes how the effect is presented, not the trajectory or any game logic. Risk: grazing hits could produce odd directions, so keep the current camera-based fallback.
- **Check in game:** in the 1.20s–1.50s frames, the plume's centre leans at least 30° off vertical, and no flame pixels cover the face.

### F3. Sparks and smoke are drawn but can't be seen
- **Compare:** A and C (dense spark spray, dark smoke) and B (scattered glowing specks), against every gameplay frame, where I couldn't find any sparks or smoke.
- **Why (source):**
  - **Sparks:** `sizing.ts:16` sets their size to 0.010–0.015 m. At review distance the torso is about 140 px wide, so a spark is roughly 3 px wide. Their colour (`flame.ts:95`) is orange-red, drawn against an orange-tan scene.
  - **Smoke:** `flame.ts:103` multiplies smoke opacity by 0.13 (times a curve that peaks at 1), so it's almost invisible.
- **Fix:**
  - Give sparks a minimum on-screen size of about 2–4 px in the vertex shader, stretch them along their direction of travel, and give them a hot yellow-white core.
  - Raise smoke opacity to about 0.35–0.5 and darken it toward the dark grey-brown in the mockups.
  - Use the existing spark budget (256) for more sparks on the primary target only.
- **Cost/risk:** low. Larger sparks cost a little more pixel shading. Risk: with too many, the effect gets noisy.
- **Check in game:** at 100ms, at least 10 distinct sparks are visible on the primary hit; splash bystanders stay at 2–4.

### F4. B aftermath looks like a campfire icon, not a burned patch
- **Compare:** B cloth/armor panels and B frame 03 (1.20s), against `human-aftermath.jpg`, `armored-aftermath.jpg` and the video frames at 1.70s and 3.50s.
- **What's wrong:** B shows a large charred patch with glowing ember cracks and thin flame licks spread along the edge where the burn is advancing, plus smoke. The game shows one teardrop flame cluster in one spot, and I couldn't see any char on either the purple shirt or the cream armor.
- **Why (source):**
  - **Teardrop shape:** `flame.ts:100` defines the shape as a centred width that narrows to a point toward the top.
  - **Same spot every time:** `response.ts:85-88` spawns the lingering flames at the same contact point, with only small sideways jitter.
  - **Char too faint:** `surface.ts:11-16` draws the char with opacity up to 0.62 and sparse embers. Why it isn't visible on the cream armor needs a debug check. It could be the intensity value it receives (`setIntensity`), the fade-in, or the normal test at `surface.ts:11`.
- **Fix:**
  - First, confirm the char mask actually renders (check `diagnostics` plus a capture with the mask forced on).
  - Darken and enlarge the char, and spread the ember specks in a slowly growing ring.
  - Spawn lingering flames on that ring instead of the centre.
  - Replace the teardrop with thin, sideways-offset wisps.
- **Cost/risk:** medium, because the cause of the invisible mask isn't known yet.
- **Check in game:** at aftermath, a dark patch about 1.5–2× the impact size is clearly visible on the cream armor, with glowing specks on its edge and flames that aren't in a single cluster.

### F5. C doesn't have its signature shape; it's just a bigger A
- **Compare:** the swirling crescents in all of C's panels, against `armored-sticky-100ms.jpg` (round fireball) and `-250ms.jpg` (two vertical columns).
- **Why (source):** the explosion path only changes numbers: `flame.ts:9-15` (spread ×1.45, size ×1.18, a different curl rate) and `sizing.ts:13`. Nothing produces an arc or ring shape.
- **Fix:**
  - **Option 1:** on detonation only, give the lobes curved paths that orbit the release direction, so they sweep out a crescent.
  - **Option 2:** add 2–4 curved "swirl arc" cards, either authored or procedural, from the existing 96 flamelet slots.
  - Also add a short flash on detonation only.
- **Cost/risk:** medium. Do this after F1 and F2, because C should share A's outline and colour bands.
- **Check in game:** at 250ms, a detonation shows at least one clear curved arc, while a rifle hit never shows one.

### F6. Hits on floors and ceilings aren't visibly attached to the surface
- **Compare:** A and C wall+floor panels (scorch ring plus bright base), against `surface-floor.jpg` and `surface-ceiling.jpg`.
- **What's wrong:** the floor flame hovers as a blob with no ground mark. The ceiling flame hangs as a compact blob. Real fire under a ceiling would spread flat along it.
- **Why (source):**
  - `response.ts:52` points the plume downward under ceilings. That's a guess from the code; one still frame can't confirm the direction.
  - `response.ts:72-73` caps the scorch radius at 0.5 m and fades it in over 0.12 s (`surface.ts:12`). That may explain why there's no scorch in the +50ms frame.
- **Fix:**
  - Add a brief bright contact glow at the base.
  - Start the scorch partly visible at contact instead of fading in.
  - Under ceilings, spread the plume flat along the surface instead of downward.
- **Cost/risk:** low.
- **Check in game:** the same floor and ceiling captures show a dark scorch and a bright base where the flame touches the surface.

## 3. Recommended next pass, in order of impact

1. **F1 + F2 together:** hard, banded flame shapes plus the directional tear. This is the biggest step toward A, and it's shader-only.
2. **F3:** make sparks and smoke visible. It's cheap and restores much of the energy of A and C.
3. **F4:** first find out why the char mask isn't showing, then fix B's spread and flame placement.
4. **F5:** C's arcs, built on the new shape from step 1.
5. **F6:** surface attachment polish.

**Procedural volume vs. authored flipbooks:** the mockups are painted, anime-style cel fire. The shapes are designed, not simulated. A raymarched noise volume naturally drifts toward soft, realistic plumes, so after F1 it will look better but probably still not like the paintovers. The more dependable route to that fidelity is a hybrid:
- Keep a small procedural volume for the hot core and glow, or drop it.
- Commission about 5 authored flipbook sheets: a contact starburst, a directional tongue tear (A), swirl arcs (C), smoke wisps, and a char/ember mask texture (B).
- Drive their dissolve with an "erosion" threshold so they keep hard cel edges.

That needs a VFX artist, or an EmberGen bake followed by a stylisation paintover, roughly several days of asset work. It also fits the existing instanced pools. I wouldn't promise paintover fidelity from either route without that art.

**Performance note:** these numbers come from `measurements.json` and are not my own measurements. Rifle GPU median went from 2.25 to 2.99 ms (p95 from 3.29 to 4.36) with at most 3 volumes active, and the sticky test peaked at 9.5 ms. Cost scales with how much of the screen each volume covers, so making flames bigger (F2/F5) or meeting them up close needs re-measuring. That's another argument for flipbook cards.

## 4. What this packet can't verify

- **Motion quality:** frame-to-frame flicker, curl speed, and whether hard edges would shimmer. I only have still frames and inferences from the code.
- **The armored detonation in video:** the 2.90s–3.50s frames show only the lingering flames afterwards. The burst itself was likely outside that window, so C's motion is unseen.
- **The cause of the diamond-shaped flash at 1.10s:** I couldn't find it in the files provided. It might come from the base `ElementalPresentation` impact. The same goes for the thin, straight projectile trail in `sustained-fire.jpg`; the trail code isn't in the packet.
- **Audio:** I didn't hear anything. `media.json` only shows that audio is present and doesn't clip (peak about 0.47–0.48, no clipped samples).
- **Close-range and many-explosion GPU cost:** not measured. I'm also relying on the README's statement that combat behaviour is unchanged (`combatEqual: true`); I couldn't check it independently.
