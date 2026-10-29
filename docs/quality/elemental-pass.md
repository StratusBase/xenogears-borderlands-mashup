# Complete elemental VFX and audio pass

Delivered as an opt-in presentation layer in the actual Game. Open `/elemental-lab.html` on the local server, click **Enable sound**, then use **Review controls → Payload** or **K** for the full weapon workbench. The normal game entry and legacy renderers remain available for the combat lead's adoption.

- [Visual and audio gallery](../../artifacts/elemental/gallery.html); served locally at `http://127.0.0.1:5197/artifacts/elemental/gallery.html`.
- Compiled gameplay: `http://127.0.0.1:5198/elemental-lab.html`.
- [Full raw gameplay/performance evidence](../../artifacts/elemental/verification.json).
- [Audio measurements](../../artifacts/elemental/audio/audio-validation.json).
- [Integration interface and lifecycle](elemental-integration.md).

## Visual and sound targets

| Element | Equipment and flight | Impact and lingering response | Audio identity |
|---|---|---|---|
| Kinetic | Physical carrier and fine brass tracer | Metal chips and compact contact mark | Dry impact/whiz; existing mechanical weapon report |
| Fire | Local heat vents, incandescent core, tapered ember wake | Ignition tongues, char, heat cracks and rising embers | Ignition crackle, hot hiss, settling burn |
| Ice | Chamber frost, faceted dart or crystalline beam | Brittle shards, frost filigree and growing surface crystals | Fracture transient, brittle chimes, cold settling |
| Corrosive | Dark pressure chamber, wet fluid capsule and droplet wake | Surface-oriented wet splat, runnels, meniscus and drips | Wet splat and restrained sizzling/bubbling |
| Shock | Conductor bands, forked narrow discharge and arc flight | Branching sparks and travelling armor charge | Sharp zap, arc crackle, charged tail |
| Radiation | Isotope chamber, ringed core and sparse decay motes | Dosimeter-like pulse, scintillation and residue | Dry decay ticks and a modulated contained hum |
| Gravity | Barrel compression hoops, dark core, distorted orbit | Inward pulse, compression bands and curved orbital arcs | Inward pressure thump and low warble |
| Adhesive | Viscous amber chamber, resin lobes and connective thread | Damp splat, attached elastic strands and stretching beads | Damp thwack, stretch/pluck and sticky release |

Physical delivery remains readable: bullet/slug/spike carriers, sticky charges, rockets, discs, orbs, beams and arcs retain their own construction. Secondary elements receive a smaller independent channel. Equipment effects bind only tagged weapon chambers/bands; unrelated receiver paint, furniture, body and equipment slots retain their owners. Status overlays conform to actual armor and preserve the red optic and overall silhouette. Ground and wall residue follows the actual collision normal; attached splats and adhesive threads follow moving targets.

The shared optional equipment factory covers equipped rigs, parked weapons, inventory previews, vending displays and dropped gear wherever the existing equipment-effects lifecycle is used. The main gameplay capture matrix exercises both equipped forms; lower-level tests also cover previews/drop-style roots, restoration and adversarial tags under unrelated slots.

## Verification

- **471 / 471 tests pass**, including **137 new elemental checks**. Normal production build and the separate compiled review build pass; Vite retains its existing large-chunk advisory.
- Exact simulation regressions compare complete hits and per-step flight transforms for **8 elements × 12 delivery families**. Critical flags, damage/specs, cover, homing, ricochet, sticky attachment/fuses, removed targets, chains and splash remain equivalent.
- Actual browser gameplay used the real Game, normal fire/status methods and public evaluation stepping. Every element produced an actual hit in pilot form; all seven non-kinetic elements applied their real status. All eight were also fired in mech form, with real muzzle transforms recorded.
- **48 captures** cover equipment, flight, hit, lingering status, ground contact and mech form for each element. A [dual corrosive/fire rocket](../../artifacts/elemental/dual-corrosive-fire.png) exercises two channels together.
- Browser timing comparisons retain exact hit count/order, target category, damage, critical flags, recipes, hit times, health, shield, ammo, reserve and heat. Existing wall-clock weapon-pose damping causes tiny position variation between runs: the configured tolerance is 0.1 mm; the largest observed coordinate delta was **0.0070 mm**. The renderer-independent simulation comparisons remain exact.
- Pause froze impact instance matrices and left zero live elemental voices. Fixed pools, expiry, repeated disposal, non-finite input handling, surface attachment and slot isolation are tested. No browser page/shader errors were reported.

## Matched sustained-firing performance

Hardware: **ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version)**. Same compiled page, 1440 × 900, DPR 1, identical fixed target/camera, exact item recipe and initial state. Each element uses **original → quality → original**. Each sample warms for 60 displayed frames and records 180. The driver advances the existing simulation by 1/60 second per displayed frame, with normal fire cadence, recoil, heat and reload rules. This gives a reproducible four-second simulation window per sample, including warmup. Sounds were enabled.

GPU timings are hardware queries; draw counts include normal, shadow, beauty, overlay, output and antialiasing passes. CPU submission and p95 distributions are retained in the raw JSON. Original baselines drifted in GPU time; no speedup is claimed from the GPU median alone.

| Element | Frame ms original / quality | Original GPU ms first / repeat | Quality GPU ms | Median whole-frame draws |
|---|---:|---:|---:|---:|
| Kinetic | 8.30 / 8.30 | 0.92 / 3.47 | 3.02 | 993 → 987 |
| Fire | 8.30 / 8.30 | 3.37 / 3.22 | 3.27 | 1,032 → 1,013 |
| Ice | 8.30 / 8.30 | 3.69 / 3.50 | 3.44 | 1,028 → 1,013 |
| Corrosive | 8.30 / 8.30 | 3.30 / 3.73 | 3.70 | 1,022 → 1,007 |
| Shock | 8.30 / 8.30 | 3.61 / 0.87 | 3.28 | 1,018 → 1,000 |
| Radiation | 8.30 / 8.30 | 1.03 / 0.93 | 0.92 | 1,044 → 1,014 |
| Gravity | 8.30 / 8.30 | 0.87 / 0.99 | 0.79 | 1,008 → 993 |
| Adhesive | 8.30 / 8.30 | 1.30 / 0.93 | 0.89 | 1,041 → 1,002 |

Median frame intervals held near 8.3 ms. Quality reduced median whole-frame draws by **6–39** in these fixtures. These are single-target, high-end Mac measurements at DPR 1. Full encounter density, long sessions, high DPI, mobile and lower-end devices require their own runs. The measurements do not establish universal performance.

## Audio verification

Eight original eight-second auditions use the exact runtime recipes, filters, automation, noise buffers, compressor and soft ceiling. They isolate the elemental layer; the existing physical rifle/cannon report remains underneath during gameplay. Each audition covers equipment → shot → flight → impact → lingering → release. No external audio files or services are required at runtime.

| Element | Peak amplitude | RMS including silence | Original sound |
|---|---:|---:|---|
| Kinetic | 0.063 | 0.0008 | [Audition](../../artifacts/elemental/audio/kinetic.wav) |
| Fire | 0.093 | 0.0030 | [Audition](../../artifacts/elemental/audio/fire.wav) |
| Ice | 0.286 | 0.0027 | [Audition](../../artifacts/elemental/audio/ice.wav) |
| Corrosive | 0.125 | 0.0043 | [Audition](../../artifacts/elemental/audio/corrosive.wav) |
| Gravity | 0.117 | 0.0095 | [Audition](../../artifacts/elemental/audio/gravity.wav) |
| Adhesive | 0.125 | 0.0040 | [Audition](../../artifacts/elemental/audio/adhesive.wav) |
| Radiation | 0.286 | 0.0022 | [Audition](../../artifacts/elemental/audio/radiation.wav) |
| Shock | 0.121 | 0.0012 | [Audition](../../artifacts/elemental/audio/shock.wav) |

All files are non-silent, unique, 48 kHz mono PCM and contain no clipped samples. Live browser tests verified gesture unlock, mute/pause/resume, bounded scheduling and disposal. The elemental bus is capped at 32 voices and 14 equipment/status loops; each status element uses the nearest active target for attenuation. Physical reports keep their existing separate voice cap. Speaker/headphone listening preference remains subjective; the auditions make that review concrete.

## Gameplay captures

| Element | Actual Game captures |
|---|---|
| Kinetic | [Equipment](../../artifacts/elemental/kinetic-equipment.png) · [Flight](../../artifacts/elemental/kinetic-flight.png) · [Impact](../../artifacts/elemental/kinetic-impact.png) · [Lingering](../../artifacts/elemental/kinetic-lingering.png) · [Ground](../../artifacts/elemental/kinetic-ground.png) · [Mech](../../artifacts/elemental/kinetic-mech.png) |
| Fire | [Equipment](../../artifacts/elemental/fire-equipment.png) · [Flight](../../artifacts/elemental/fire-flight.png) · [Impact](../../artifacts/elemental/fire-impact.png) · [Lingering](../../artifacts/elemental/fire-lingering.png) · [Ground](../../artifacts/elemental/fire-ground.png) · [Mech](../../artifacts/elemental/fire-mech.png) |
| Ice | [Equipment](../../artifacts/elemental/ice-equipment.png) · [Flight](../../artifacts/elemental/ice-flight.png) · [Impact](../../artifacts/elemental/ice-impact.png) · [Lingering](../../artifacts/elemental/ice-lingering.png) · [Ground](../../artifacts/elemental/ice-ground.png) · [Mech](../../artifacts/elemental/ice-mech.png) |
| Corrosive | [Equipment](../../artifacts/elemental/corrosive-equipment.png) · [Flight](../../artifacts/elemental/corrosive-flight.png) · [Impact](../../artifacts/elemental/corrosive-impact.png) · [Lingering](../../artifacts/elemental/corrosive-lingering.png) · [Ground](../../artifacts/elemental/corrosive-ground.png) · [Mech](../../artifacts/elemental/corrosive-mech.png) |
| Shock | [Equipment](../../artifacts/elemental/shock-equipment.png) · [Flight](../../artifacts/elemental/shock-flight.png) · [Impact](../../artifacts/elemental/shock-impact.png) · [Lingering](../../artifacts/elemental/shock-lingering.png) · [Ground](../../artifacts/elemental/shock-ground.png) · [Mech](../../artifacts/elemental/shock-mech.png) |
| Radiation | [Equipment](../../artifacts/elemental/radiation-equipment.png) · [Flight](../../artifacts/elemental/radiation-flight.png) · [Impact](../../artifacts/elemental/radiation-impact.png) · [Lingering](../../artifacts/elemental/radiation-lingering.png) · [Ground](../../artifacts/elemental/radiation-ground.png) · [Mech](../../artifacts/elemental/radiation-mech.png) |
| Gravity | [Equipment](../../artifacts/elemental/gravity-equipment.png) · [Flight](../../artifacts/elemental/gravity-flight.png) · [Impact](../../artifacts/elemental/gravity-impact.png) · [Lingering](../../artifacts/elemental/gravity-lingering.png) · [Ground](../../artifacts/elemental/gravity-ground.png) · [Mech](../../artifacts/elemental/gravity-mech.png) |
| Adhesive | [Equipment](../../artifacts/elemental/adhesive-equipment.png) · [Flight](../../artifacts/elemental/adhesive-flight.png) · [Impact](../../artifacts/elemental/adhesive-impact.png) · [Lingering](../../artifacts/elemental/adhesive-lingering.png) · [Ground](../../artifacts/elemental/adhesive-ground.png) · [Mech](../../artifacts/elemental/adhesive-mech.png) |

## Build fingerprints and reproduction

The following compiled assets are common to both renderer configurations and every final gameplay capture:

- `game-BFT1ydNw.js` — SHA-256 `97166563ac3b7f48e1c28c3e0714562a3e97b7e1ae03d7ab90454826a6ce56ed`
- `index-CKv9k9-t.js` — SHA-256 `50a46f3b65f0cc9f58eaaa971bb9b4fcf1d2a3e43f2fbc4cb0e37e6a415ea012`
- `qualityLab-C1iz04cJ.js` — SHA-256 `eef22d61eae2b3ede22acfd558f767d97c8a6272088c42e7718f86a31245164c`

```sh
npm run build
npm test
npx vite build --config vite.quality.config.ts
npx vite preview --config vite.quality.config.ts --port 5198
```

With Playwright/Chromium installed, run `scripts/verify-elemental.mjs`. Optional `PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE` paths point to an existing installation. `ELEMENTAL_REVIEW_URL` overrides the compiled lab URL. For audio verification, run a development server on port 5197 and `scripts/verify-elemental-audio.mjs`; `ELEMENTAL_AUDIO_REVIEW_URL` overrides that origin.

Only optional rendering interfaces were added to `PlayerBallistics.ts` and `equipmentEffects.ts`; all effect modules are separate. Combat-owned files were not edited by this workstream. The ownership snapshots record a concurrent combat-lead change to `game.ts` during development rather than presenting that file's hash as unchanged. World/UI and the sampled combat/status definitions retain their starting hashes. No Git initialization, commits, pushes or deployment were performed.
