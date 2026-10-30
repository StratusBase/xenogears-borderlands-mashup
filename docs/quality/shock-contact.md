# Fixed Shock sticky charge

30 October 2026. Follow-up to `4f748fc`. The circular object visible between first contact and heavy detonation was the generic Shock projectile payload's tilted conductor coil. Its group rotated at4.7 radians/second during the sticky fuse. The physical sticky carrier also had a circular retaining ring.

- [Actual gameplay with live sound and matched before/after](http://127.0.0.1:5298/review/).
- [Playable contact comparison](http://127.0.0.1:5298/shock-lab.html).
- Raw receipts, original recordings and frozen build: ignored `artifacts/shock-contact/`. Earlier C/direction reviews remain frozen.

## Runtime and handoff

`shock/sticky.ts` replaces only the sticky Shock projectile's circular housing and Shock payload with a compact rectangular insulator, two fixed electrodes and small flickering charge lights. The shared projectile factory still owns the original root metadata, family scale and physical projectile transform. The other elemental payload is retained exactly. Non-sticky Shock deliveries and non-Shock sticky visuals are unchanged.

The fixed indicator has three draw calls, with geometry inside the preceding sticky carrier's size envelope. Shape spacing/height vary once per projectile through the neutral cosmetic variation helper. Animation samples the existing projectile age and changes only light opacity. It does not rotate, set the physical root pose, read target recipients, alter collisions, own the fuse or use gameplay randomness. Replaced mesh geometry/materials are owned and disposed immediately; the existing ballistic lifecycle disposes the replacement at detonation/removal. The shared flight updater may temporarily retain the detached empty old group in its projectile-keyed WeakMap; it has no visible geometry or GPU resources and expires with the projectile.

`ShockPresentationOptions.stickyCharge` accepts `'fixed'` (default) or `'legacy'` for review. Existing constructor options and old renderers remain usable. Flight variation uses a separate cosmetic sequence and resets with the existing adapter lifecycle. Balanced C directions, C geometry, charge surfaces, recipes and audio are unchanged. No edits to combat-owned `src/game.ts`, `src/world.ts` or `src/ui.ts`, the shared flight module, ballistics or other owners' work. Normal Enhanced activation remains the existing combat-owner handoff.

The contact review uses the same Game evaluation driver and balanced C in both versions. “Show attached charge before detonation” freezes18 simulation frames (+300ms) after the actual contact, before the existing detonation. It does not alter the fuse. Human receipts expose actual active projectile mesh names to distinguish old coil from fixed electrodes. Native recordings use the existing real-time driver, not paused-study timing.

## Verification

- All876 repository tests pass, including27 Shock checks. Production and review builds pass; all13 ballistic delivery families retain exact compatibility.
- New checks prove fixed world transforms throughout90 age samples, unchanged root pose/scale and metadata, finite bounded size, no transform animation while opacity flickers, pause stability, exact other-channel geometry, and exact unaffected-delivery geometry.
- Actual shots hit both intact clothed and armored humans. Matched contact-stage combat snapshots are identical; neither has detonated at capture. Current projectile receipts contain fixed electrodes and no coil; baseline receipts contain the original coil.
- Three matched heavy-crowd runs use one frozen compiled Game, six stationary raised-health human targets, seed37391, identical weapons/inputs, sound on, recording off,120 warm-up +720 measured display frames, existing1/60 simulation step per frame,1440×900 DPR1 on M5 Max /Chromium156. Complete combat snapshots match across all three runs. Detailed timings are in the review and raw receipt; concurrent machine load limits timing conclusions.
- Native video captures final physical/elemental audio buses, with no sound replacement, normalization or retiming. The original WebM is retained beside the MP4. The later heavy burst and secondary hierarchy remain visible in the same recording.

Package receipts with `node scripts/package-shock-contact-review.mjs`. Controlled fixtures do not establish full AI encounter or lower-end performance. No push or deployment.

| Matched heavy crowd | Previous coil | Fixed charge | Previous repeat |
|---|---:|---:|---:|
| Frame median, ms | 16.90 | 16.40 | 16.50 |
| Frame p95, ms | 21.80 | 19.40 | 21.40 |
| GPU median, ms | 2.83 | 2.91 | 2.99 |
| Draw calls median | 2027 | 2027 | 2027 |
| Triangles median | 155719 | 155409 | 155719 |

GPU median rises0.07ms against the first baseline and remains below the repeated baseline. These measurements do not establish a speedup or an isolated universal cost.
