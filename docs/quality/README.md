# Visual and audio reference

The normal **`/`** entry now uses the reference assets and complete elemental presentation. Pause → **Visuals** switches Enhanced/Legacy; **Sound** controls both audio layers. `/quality-lab.html` and `/elemental-lab.html` remain isolated comparison tools using the actual Game, combat and collision. No story or faction canon is introduced.

See [main-game integration and validation](main-integration.md) for the full combat/loot/equip loop, compatibility checks, screenshots and crowded-scene measurements.

The subsequent [crowd-feedback pass](../crowd-feedback-verification.md) adds compact target totals, protected hit-number placement and shared transform work, with separate matched before/after measurements.

## Target

- **R / 07 rifle:** tapered enamel receiver, machined bolt and barrel, rubber furniture, genuine skeletal-stock and reflex-sight openings, readable magazine and operating controls. Sparse wear and unit markings replace repeating surface noise.
- **Single-optic sentry:** tapered cream armor, one red head weak point, asymmetric gun arm, exposed actuators, split feet. This reference replaces the **flanker** display; rusher/heavy/boss visuals retain their role, shield, rear-core and warning semantics.
- **Industrial mech:** six meter load-bearing frame, armored cyan cockpit, shoulder louvers, hip and calf rams, split toes and heels. Equipment remains independently owned and swappable.
- **Materials and ink:** quiet three-band enamel, distinct pale metal/dark rubber/recessed glass, ground-contact shadows, 1.85 CSS-pixel silhouette ink. Existing depth-tested overlay and antialiasing passes remain in use.
- **Elements:** heat transfer bands and chambers stay on delivery-specific assemblies. Receiver, furniture, magazines, body and unrelated equipment retain their paint. Beam prongs, sticky injectors, projectile rails and other delivery hardware remain distinct.
- **Motion and sound:** short responsive pilot settle; longer cannon/locomotion mass transfer; existing magazine/bolt/hand and hinged breech/barrel reload joints; muzzle-local flash; surface impacts; ground dust; layered reports, reload stages, steps, landings and mount foley.

Assets are procedural, working 3D geometry and articulated hierarchies, not concept images. All source art and synthesized sound are local; there are no external asset downloads.

## Review

```sh
npm run dev -- --port 5197
```

Open `http://127.0.0.1:5197/quality-lab.html`. Use **Reference assets** to compare the original renderer, the camera selector for each reference, and **Play / capture mouse** for actual gameplay. Click **Enable sound** once. WASD moves, left mouse fires, R reloads, and F mounts nearby. P hides the review panel. The fixture uses its own save key.

**Review controls** contains freeze, elemental cartridges, and a matched original/reference/original measurement. It freezes the same field camera and game state, warms each renderer, and samples 180 frames per configuration. Audio requires a user gesture and stops on pause.

## Compiled local review

```sh
npx tsc --noEmit
npx vite build --config vite.quality.config.ts
npx vite preview --config vite.quality.config.ts --port 5198
```

This creates `dist-quality/` beside the normal build. It does not publish anything. Open `http://127.0.0.1:5198/quality-lab.html`.

The browser verification script needs Playwright and an installed Chromium. In an environment where those are already installed:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
CHROME_EXECUTABLE=/absolute/path/to/chromium \
node scripts/verify-quality.mjs
```

The default URL is the compiled review on port 5198; override with `QUALITY_REVIEW_URL`. Playwright's normal package/browser discovery works when the two optional paths are omitted. The script writes screenshots, an original sound audition, gameplay assertions, bundle SHA-256 fingerprints and matched timing JSON to `artifacts/quality/`.

See [integration](integration.md) for the combat-lead handoff and [validation](validation.md) for measured results and limits.

## Complete elemental pass

The follow-up elemental pass is available in `/elemental-lab.html`, with the [full gallery and measurements](elemental-pass.md) and [elemental integration interface](elemental-integration.md). It covers all eight elements through equipment, flight, contact, surface residue, lingering status and audio, with original/reference toggles.
