# Dense heavy Shock C

30 October 2026. Follow-up to `c997dfb`: the user asked to close the remaining C density gap against the approved capacitor-kick board. This adds an actual runtime heavy burst, retaining the existing Game, ordinary A+B, secondary sizing and combat authority.

- [Gameplay with live sound, before/after and full results](http://127.0.0.1:5277/review/).
- [Playable dense C / previous C comparison](http://127.0.0.1:5277/shock-lab.html).
- [Raw verification](../../artifacts/shock-capacitor/verification.json).
- The previous [lightning review](http://127.0.0.1:5226/review/) and its frozen build remain intact.

## What changed

`shock/capacitor.ts` owns a hot ragged nucleus, three dominant white blades, three fine branches, two shorter counter-branches and 56 pointed sparks. Stable per-event choices vary angles, lengths, widths, coarse bends, edge serration, origins and particle distribution. The burst grows quickly along its blades, then recedes outward and fades. It is an asymmetric cone, not a repeated circular stamp.

The broad blades have real three-dimensional geometry, controlled navy/cobalt edges and white interiors. Their widths face the view selected at the contact while staying outside the support plane. The nucleus is a depth-tested camera-facing glow. Four reserved primary pool slots bound C to at most 32 blades, 224 shards and 4800 dynamic vertices. Each active C instance has 1200 vertices plus its nucleus quad. Blade geometry is built once per event; the existing renderer upload callback tracks the cached shape, and subsequent updates upload only spark position ranges. The module samples its owning bolt's age and has no clock, damage, recipient queries or audio engine.

The previous radial strand/spark heavy response is reduced when dense C is active, giving the broad blades room to read. A+B and all secondary responses keep their existing geometry, materials, sizing and sound. The same primary `shockSizing` reach/energy/exposure envelope drives C; its values are not enlarged. Source geometry, equipment attachments, muzzle transforms, physical projectiles/fuse, cover, damage/status/chain logic and existing sound recipes are untouched.

## Interfaces and ownership

- `new ShockPresentation(scene,camera,'capacitor')` selects dense C; it is now the default for this opt-in adapter.
- `'lightning'` preserves `c997dfb` for comparisons. `'prototype'` retains the first A+B profile. The same adapter/lifecycle, audio routing and sizing serve all three.
- `CapacitorBurst.start(seed,reach,view)`, `update(boltAge)`, `hide()` and `dispose()` remain internal presentation operations. `ShockResponse` owns their four pool slots and lifetime.
- C is emitted only for the existing confirmed heavy primary detonation gate. Contact, ordinary deliveries, splash recipients and confirmed chains do not acquire C. `confirmedShockChain` and the existing combat-owner handoff are unchanged.
- No edits to combat-owned `src/game.ts`, `src/world.ts` or `src/ui.ts`. All nine protected source hashes, including B's surface shader, Shock sizing/audio and ballistics, match the start of this task.

Normal Enhanced activation remains the combat-owner integration handoff after moving-result review. This entry uses the actual Game evaluation driver; it does not silently enable a new production factory or displace other element work.

## Gameplay and regression evidence

- 816 repository tests pass, including 22 Shock checks. Production/review builds pass; all 13 ballistic delivery families retain exact pre-change compatibility.
- New checks prove C is primary/heavy-only, ordinary geometry matrices and secondary size records stay exact, successive heavy shapes vary, every generated vertex stays finite/outside five support planes, pools stay bounded, pause freezes geometry, and clear/expiry/disposal release presentation resources.
- Actual Game shots hit intact clothed/armored humans and exposed skin. Sticky and rocket detonations use C; bullet, beam, scatter, slug and arc control hits retain A+B. Matched old/new heavy study snapshots and size events are exact on both human types.
- Raised top, wall, slope, underside and finite ledge all receive actual sticky contacts and detonations. Minimum sampled blade/shard clearance at +100 ms is 0.0840 m for each case. The nucleus glow is excluded from the geometric audit because its billboard orientation is resolved in the shader. B remains on the finite source geometry at +900 ms.
- No final page/shader errors. Stills stop real simulation +100 ms after the authoritative detonation; aftermath is +700/+900 ms. They are not painted effects or native-speed motion evidence.
- Four separate native wall-clock recordings cover repeated hits on armor, repeated hits on cloth, sustained fire across six humans and a raised surface. They capture the final physical and elemental WebAudio streams. Source WebM and playable MP4 are retained; no normalization, replacement, slow motion or audio retiming. Canvas video omits the HTML HUD.

## Matched performance

Previous lightning C / dense C / repeated previous C, milliseconds. Same compiled Game/build, six stationary raised-health humans, seed37391, weapons and input sequence. Each run: 120 warm-up +720 measured displayed frames, one existing 1/60 Game step per displayed frame. Both sound buses active; recording off. M5 Max / Chromium156 / 1440×900 DPR1.

| Scene | Frame median | Frame p95 | Simulation CPU median | Draw CPU median | GPU median |
|---|---:|---:|---:|---:|---:|
| Rifle control | 16.20 / 15.90 / 17.10 | 19.20 / 18.40 / 20.70 | 1.70 / 1.70 / 1.90 | 8.50 / 7.80 / 9.10 | 3.07 / 3.33 / 3.17 |
| Heavy crowd | 16.30 / 16.20 / 16.50 | 19.30 / 19.60 / 19.70 | 1.80 / 1.70 / 1.60 | 9.60 / 9.20 / 9.00 | 3.24 / 3.31 / 3.50 |
| Crowd + raised surface | 16.10 / 16.10 / 16.10 | 18.00 / 18.60 / 18.60 | 1.70 / 1.60 / 1.60 | 8.80 / 8.60 / 8.50 | 2.73 / 2.87 / 2.82 |

All nine runs have identical complete shots, hits, confirmed-chain damage, status, vitals, ammo/reload, timing and contact snapshots. The rifle control emits no C in either version. Peak observed C use in both heavy scenes is one instance: eight blades, 56 shards, 1200 vertices. Total thin-stroke peak falls from 457 to 255 in the heavy crowd and 474 to 272 in the mixed scene.

Heavy-crowd GPU median changes from 3.24 to 3.31 ms; the repeated baseline is 3.50 ms. Mixed GPU changes 2.73 to 2.87 ms, with a 2.82 ms repeat. Frame p95 increases by 0.30/0.60 ms respectively, within or near the repeated-baseline range. The ordinary rifle control itself shows timing drift despite identical geometry, so these are reported samples, not an isolated universal cost or speedup. Controlled fixtures are not full AI encounters; lower-end/mobile/high-DPI remain unmeasured.

## Recorded audio

| Clip | Seconds | Peak | RMS | Clipped PCM samples |
|---|---:|---:|---:|---:|
| repeat-heavy | 8.00 | 0.5593 | 0.00970 | 0 |
| cloth-heavy | 8.00 | 0.6069 | 0.01012 | 0 |
| heavy-crowd | 10.01 | 0.5542 | 0.01072 | 0 |
| surface-live | 4.50 | 0.0859 | 0.00322 | 0 |

This pass retains the existing heavy Shock sound rather than adding another engine or more voices. The clips prove the visual timing against the real contact/fuse, capacitor bass, crackle and smaller secondary responses.

## Review limit

The new C recovers the board's broad white energy, hot center and directional density in actual gameplay. An exact painted-pixel match is not claimed. Previous Opus critiques informed the target; this new module and captures have not received a new external-model review. Existing charge still does not route a conductor around an edge onto another face; that unchanged B behavior is outside this C density task. No push or deployment.
