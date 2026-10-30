# Opus 5.5 final check of the small A+C proof

Verified canonical model: `claude-opus-5-5`. Read-only check of the revised actual screenshots and native-recording frame sequences. The reviewer did not watch live video, listen to sound or measure performance.

**Verdict: OK to show the user as a small proof.** I see no blockers. A and C now look clearly different, the face stays readable in every current frame, and the A live sequence now shows changing shapes. There are two caveats, both on C, below.

**What changed visibly**
- **Rim.** The near-black ink outline is gone on both A and C. The edge is now a dark red-orange fringe, so it no longer reads as a sticker. `hybrid.ts:28` matches this (rim colour 0.50, 0.03, 0).
- **Heat.** C now has a visible gold spine along the upper arm and a white-hot root at +50/+100ms (`armored-c-50ms.jpg`, `armored-c-100ms.jpg`). By +250ms the white is gone. A shows gold streaks inside an orange body. At gameplay distance A is still mostly orange-gold and has less hot white/yellow than the A board; that's for the full pass.
- **A shape.** A is longer, steeper (about 35°) and splits into separate forks by +250ms (`human-a-250ms.jpg`). It's no longer one leaf blob. It is still small next to the board's streak, but it reads as a directional flashover. The face is clear in all three stills.
- **C shape.** The lower arm is clearly shorter and the upper arm is the main mass, so it's no longer a symmetric "<". It's still more of a hooked claw than the board's rolling backdraft. That's acceptable for this proof.
- **C fade.** Tips now fade first (`hybrid.ts:25`). At +500ms the C is a curled shape still attached at the root. The detached floating ribbons from last time are gone.
- **Secondary hits.** These are now doubly guarded: `sizing.ts:15` returns `sheetSize = 0` and `response.ts:53` checks `!secondary`. That closes the question I left open last time.

**Does the A live sequence show changing shapes?**
Yes, within what five still frames can show:
- **+30ms:** a short flared tongue with a forked tip.
- **+100ms:** longer and thinner, rising.
- **+200ms:** a shorter, sharper blade.
- **+350ms:** a short wedge.
- **+500ms:** only a small flicker at the root.

The weapon pose also changes between frames (recoil). Last time's problem of identical frames is not visible here. This only shows that the shapes change at those timestamps. I can't judge how smooth or good the motion is.

**C live sequence**
- The shape changes clearly: a claw at +30ms, a rising hook at +100ms, and a tightening curl at +200/+350/+500ms.
- At +500ms it is still nearly full brightness. In the code it only starts fading at about 0.51s and is gone by 0.66s.

**Remaining issues (not blockers for showing the proof)**
1. **C can read as a letter.** At +350 and +500ms the curl closes into something that looks like a letter "C" or "G". Mention this when showing the proof rather than hiding it.
2. **C passes close to the face.** In the live +100 and +500ms frames, the upper arm passes just below and to the right of the armored target's chin. The face is still readable in every frame. `hybridContactFrame` (`hybrid.ts:75-83`) still doesn't steer flames away from the head, so other angles or higher hits could cover it.

**Follow-ups for the full pass (not this proof)**
- Keep a hot core on A at gameplay distance, check against the board's density of white/yellow, and fade C toward smoke.
- Steer flames away from the head in general, and check other camera angles and distances, hits near the head, and many bursts at once (capacity is 12).
- Still deferred as you asked: B lingering flame and soot, equipment, projectile, weapon, and wall/floor environment.

**Two targeted recommendations**
1. **Keep C's curl open.** Make the lower arm's tip fade earlier or flick outward/down in the glyph art, so at +300–500ms it trails off instead of closing into a "C"/"G".
2. **Small face-clearance nudge for C only.** Rotate the explosive card a bit more downward (about −0.18 rad instead of −0.12 in `hybrid.ts:109`), or lower C1's upper peak a little more. Then re-check `armored-c-live-plus-100ms` and `+500ms` at the chin.

**What I didn't verify**
- I only looked at still images: the board PNGs, the 50/100/250ms freeze screenshots, and five frames from each live sequence. I didn't watch any video, so I can't speak to native motion, smoothness or timing between frames.
- I didn't hear any audio and make no claim about sound.
- I can't confirm the 0.24s/0.40s shader-compile frame gaps are fixed, or that no gaps exceed 90ms. The README says so, and the frames I looked at fit that, but I didn't measure timestamps. I read `prepare()` in `response.ts:118-126` and it looks right, but I didn't run it.
- I didn't check performance, frame times, combat or rollout readiness.
- I didn't make any edits, run commands or use agents. No Write tool was available for the plan file, so the review is here instead.

---

## Previous candidate review, before focused corrections

# Opus 5.5 review of the small A+C hybrid proof

Verified model: `claude-opus-5-5`. Read-only review of actual screenshots, event-aligned native recording frames, the selected A/C boards, and current source. The reviewer did not watch video or listen to sound.

# Fire A+C hybrid proof review

## 1. Verdict

**It's a viable direction, but it doesn't have the A/C identity yet.** The shapes now tell A from C. The heat and value hierarchy and the C silhouette still look more like a cel-outlined decal than the boards. I'd fix items 1–2 and re-capture A live before any full pass.

**What I saw in the images:**
- **A** (`human-a-50/100/250ms.jpg`) is a small flame that rises toward screen-right from the chest. The face is clear and the contact star is visible at +50ms. At this distance the three tongues merge into one leaf shape about 130×60 px. It reads like a sideways flame emoji or comet, not the board's long thin streak at about 35–40°.
- **A colour:** the inside is orange with scattered gold flecks, like leopard print. There's no hot spine running from the root, and a near-black outline goes all the way round. That outline is the main thing that makes it look like a sticker.
- **A over time:** 50, 100 and 250ms have almost the same silhouette; 250ms is just slightly shorter.
- **C** (`armored-c-*.jpg`, `human-c-250ms.jpg`) is clearly hooked and nothing like A, so the C/A split works. But two arms of about the same length spread out from one point and form a "<" or crab-claw shape. The arms are the same width from root to tip, with a sawtooth fringe along their whole length. That's the macaroni / decorative-C risk, and it's still partly there. It's mostly flat orange-red, with very little gold or white.
- **C upper arm** rises to about head height. In `armored-c-50ms.jpg` and `human-c-250ms.jpg` it passes right next to the target's right cheek (around x 850–880, y 555–580). It doesn't clearly cover the face, but it's too close.
- **C live** (`armored-c-live-plus-30…350`): it's full size by +30ms, then curls and rotates only a little. At +500ms the roots are gone and two wavy streamers float to the right, cut off from the body.

**What the source code explains:**
- `hybrid.ts:31` blends the gold band (and the near-white band beyond x 0.32) into orange using noise alone. That's why there's no continuous hot spine.
- `hybrid.ts:32` removes the white by about 110ms and only for x < 0.32. The board still shows a white-hot core at 0.12–0.14 s.
- `hybrid.ts:28` sets the rim to (0.16, 0, 0), which is almost black.
- `hybrid.ts:25` erodes from the root outward. That's why the C detaches at +500ms, and it's the opposite of the tip-first fade I recommended.
- `hybridContactFrame` (`hybrid.ts:75-83`) always points +x at camera-right and +y up. Nothing steers the glyph away from the head.
- My own C1 artwork (`hybridGlyphs.json:172-192`) gives both arms about the same reach (x about 1.4) and nearly the same thickness all the way along. The symmetric "<" comes from my art, not from Codex's code.

## 2. Prioritised improvements (this proof only)

1. **Heat hierarchy and rim, for A and C.**
   - Evidence: `human-a-100ms.jpg` and `armored-c-100ms.jpg` against the release panels on both boards.
   - Fix in `hybrid.ts:28-32`:
     - Make gold depend on distance along the flame, for example `g = 1 - smoothstep(.35, 1.1, p.x)`. Let noise only shift it (±0.3) instead of replacing it, so the root third stays continuously gold and breaks up only toward the tips.
     - Keep the band-3 white until about 0.16 s and out to x < 0.45.
     - Lift the rim to a deep red-orange around (0.5, 0.03, 0) so the outside edge looks like a hot fringe, not an ink line.
2. **C silhouette: one mass that curls, not a claw.**
   - Evidence: `armored-c-250ms.jpg`, `human-c-250ms.jpg`, `armored-c-live-plus-200ms.jpg`.
   - Fix in my glyph file:
     - In C1, cut the lower arm's reach from about 1.42 to about 1.0 so the arms are clearly unequal.
     - Taper both arms: thick from about 0.2 to 0.6, thin at the tip.
     - Merge the two roots into one wider body up to x of about 0.35.
     - Add one or two short trailing flicks on each arm's outer curve.
   - Optionally, on the shader side, reduce erosion away from the tips so the sawtooth stays at the ends.
3. **C face clearance and attached fade-out.**
   - Evidence: `armored-c-50ms.jpg` for the face; `armored-c-live-plus-500ms.jpg` for the detached ribbons.
   - Fix:
     - For explosive cards, give C1 a slight downward angle (about −0.12 rad in `emit`, `hybrid.ts:108`), or lower C1's upper peak from about 1.08 to about 0.85 in the glyph file.
     - Change the retreat in `hybrid.ts:25` to erode from the tip back toward the root, so the fading flame stays attached to the body.
4. **A length and visible motion.**
   - Evidence: `human-a-50/100/250ms.jpg` look nearly the same, and the forks blur together.
   - Fix:
     - Stretch the A cards along x by about 1.25 so the tongues separate at gameplay distance.
     - Raise the main card's angle from 0.015 to about 0.15–0.2. Re-check the face afterwards.
     - Raise the A bend amplitude from about 0.075 to 0.12 and the turn rate in `animateHybridGlyph` (`hybrid.ts:63-66`) so the tongues visibly whip between 50 and 250ms.

**Deferred (not this proof):** B lingering flame and soot, smoke on the board, wall/floor scorch, embers for the weapon and projectile, and the equipment / B pass.

## 3. Checklist

| Check | Result |
|---|---|
| Crisp forked shapes | **Partly.** The edges are crisp, but A's forks merge at gameplay size and C's fringe is uniform along the arm. |
| Heat/value hierarchy | **Missing.** It's mostly flat orange with noisy flecks and white only at the contact point. This is the biggest gap from the boards. |
| Face clearance | **A: clear. C: marginal.** The upper arm sits beside the cheek and nothing in the code guards the face. |
| Distinct C hooked silhouette | **Yes, distinct from A.** It still reads as a claw / "<" / letter shape rather than a rolling backdraft. |
| Plausible apparent movement | **C: plausible but small,** and it detaches at +500ms. **A: can't tell** (see section 4). |
| Secondary sizing small | **Seen as small:** tiny flecks on the neighbour in `armored-c-250ms.jpg` (about 1115, 620) and `armored-c-live-plus-350/500ms.jpg`. In the code, `response.ts:53` still calls `hybrid.emit` for secondary hits. Whether they get no primary cards depends on `fireSizing` returning `sheetSize = 0`, and `sizing.ts` isn't in this folder. An explicit `!secondary` guard would make that certain. |

## 4. What isn't verified

- **The A live sequence doesn't show motion.** Frames +30, +100, +200 and +350ms look identical, weapon pose included. At +500ms the A is still fully visible, but the code gives it 0.46 s (main) and about 0.40 s (second card). So either the recorder duplicated frames, or the game stalled at the first A contact. One possible cause is a first-use shader compile or atlas load; I haven't confirmed that. A needs a fresh live capture before anyone judges its motion.
- I can't see native motion or hear audio, and I'm not claiming to.
- No combat, performance, frame-time or audio certification.
- Not checked: other camera angles, distances, hits on the side or back, hits near the head, many bursts at once (capacity is 12 per glyph set), and `sizing.ts` / `surface.ts` / `flame.ts`.
- I didn't make any edits or run any commands. There was no Write or ExitPlanMode tool available, so this review is here rather than in the plan file.
