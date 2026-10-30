# Adhesive / combat integration coordination

30 October 2026. Combat lead response to the Adhesive owner's integration handoff.

## Ownership and agreed seam

- Combat lead owns the small shared flight-contract extension and the additive
  Adhesive registration in `src/rendering/quality/gameElements.ts`.
- Adhesive owner keeps `adhesive/module.ts`, its implementation/tests, isolated
  integration fixture, actual-game sound/screenshots and matched performance.
- No edits to `game.ts`, `world.ts` or `ui.ts` are needed for this presentation-only
  integration. Existing gameplay, sticky attachment/fuses, status rules, damage,
  collision, muzzle transforms and input remain authoritative.

## Flight contract agreed

`ElementModule.replaceFlight` will accept the following backward-compatible form:

```ts
boolean | Partial<Record<'decorateProjectile' | 'trail' | 'beam', boolean>>
```

Adhesive uses `replaceFlight: { trail: true }`. Its projectile decorator adds the
approved honey neck to the unchanged generic carrier/adhesive payload. Its trail
replaces only the generic Adhesive trail; its beam stays generic. Resource-independent
static flight hooks retain already-fired projectile behavior after a Legacy toggle.
Existing `true`/`false` semantics remain unchanged, including intentional payload
omission when a full-replacement module does not supply a live hook.

## Existing hooks are sufficient

- `shot(spec, mode, weaponRoot, muzzleIndex)` and shared recipe composition handle
  shot/equipment/flight sound through the existing audio engine.
- Authoritative `impact` contact/detonation and `splash` recipient notifications
  provide real surfaces, normals, target roots, energy and exposure. Preserve
  primary/secondary weighting and avoid a second complete burst for primary splash.
- The Game owns confirmed status creation, intensity, updates and expiry/death
  disposal. A response must not also advance the same status from `response.update`.
- Shared update/pause/release/clear/dispose and equipment hooks cover lifecycle;
  no new event bus, clock, audio context or independent status map is needed.

## Registry and baseline requirements

Preserve Fire, Radiation, Shock, built-in corrosive and all existing options.
Add `adhesive?: AdhesiveOptions` and
`adhesive: createAdhesiveModule(options.adhesive)` through the one normal registry.
`createGameElementsBeforeAdhesive` omits only Adhesive. Existing other-element
baselines must retain Adhesive once registered, and equipment baselines must keep
all unrelated options. A small local module-map builder can keep those variants
consistent without replacing another element's factory.

Active conflicts: Fire equipment alignment and sibling integrations share this
composition. Preserve every registration/option and frozen benchmark; publish new
combined-source evidence rather than relabeling old runs.

## Accepted encounter and performance evidence

The user authorized completion of the full encounter, matched performance checks
and scoped integration commits, leaving Gravity and unrelated work untouched.
No push or deployment is authorized.

The isolated C build completed the real authored encounter in **195.7 seconds**:
24 distinct kills, both defense relays, mini-boss, reward pickup and complete state.
The ordinary inventory equipped the exact Salvaged Vent Reactor, increasing mech
cooling from **33.65 to 36** and maximum heat from **124.48 to 134**. Replay reset
both relays and reached an actual Adhesive mech shot in run 2. The raw receipt has
no runtime errors. A scripted route controlled movement and aiming; this is not a
claim of human playtesting or physical controller coverage.

Independent checks recompute the event/shot sequence, reward identity, inventory,
replay loadout and benchmark summaries. The strict bound audit passes; one valid
encounter and eleven deliberately invalid variants exercise its rejection paths.
Audio, capture and visibility telemetry is sampled at 122 points. Native media
review and ordinary entry results are recorded in `adhesive-main-verification.md`.

C includes four sound-on ABBA scenes: pilot/mech sticky and two mixed rifle
channels. Each arm uses 120 warmup and 720 measured displayed frames at
1440 × 900, DPR 1, recording off. GPU coverage is 719/720 unique samples in each
arm, with no lost/disjoint samples. The sticky cases affect six targets; the rifle
cases affect three of the six fixtures. Do not claim six rifle recipients.

Frame medians are 8.2–8.3 ms; current-arm p95 values are 10.0–10.5 ms, with a
24.3 ms maximum (baseline maximum 28.8 ms). Mixed rifle step-CPU medians increase
by about 0.2 ms. A 15.2% baseline GPU-median drift in the Shock scene limits causal
attribution. The report records observed costs and drift; no numeric acceptance
budget was agreed, so compatibility PASS is not a performance-pass or speedup claim.

Raw evidence and immutable earlier combined-build evidence remain under ignored
`artifacts/adhesive-integration/`. The accepted isolated evidence is in `candidate-c/`:

- `encounter-evidence.json`, `full-encounter.webm`, `replay.webm` and `captures/`.
- `session-binding.json` and the four raw `performance-*.json` receipts.
- `offline-audit-full-bound-20261030-1.json` and
  `offline-encounter-negative-checks-20261030-1.json`.

The earlier 14-second recording is retained as a smoke rehearsal: zero real hits
or kills, no relays, boss, reward or replay. Its cumulative HUD count was not new
encounter progress and it is not full-encounter evidence.

## Approved commit scopes and preservation

1. Shared retained-flight foundation and per-hook policy, together with
   `tests/composedFlightPolicy.test.ts`. The Fire owner explicitly approved this
   exact two-file shared scope. No other Fire work is included.
2. Adhesive module, additive production registry and registry/integration tests.
3. Verification entries, report/checker tools and evidence documentation.

The registry committed by this integration starts from committed Radiation/Shock
registration and generic Fire, then adds Adhesive. The live worktree's separate
full-Fire registration, options, baselines and other files remain byte-for-byte
untouched. Tests support both profiles without requiring uncommitted Fire exports.
The separately added, uncommitted `verifyGravity` main-entry branch is likewise
preserved in the worktree and excluded from the Adhesive commit candidate.

C was measured on parent `eb1f35c`. Gravity's owner independently committed
`6c51dd0` during validation. The final isolated candidate inherits that parent
without editing Gravity; all 152 imported C runtime source hashes remain identical.
All 18 emitted runtime assets match C byte-for-byte, as do all 152 imported source
hashes. Only provenance timestamp/parent metadata differs; C measurements are not
relabeled as a new run. Final test/build and asset-identity results are in
`adhesive-main-verification.md`; exact commit IDs are recorded in ignored
`artifacts/adhesive-integration/staging/commit-receipt.json` after delivery.

Final isolated candidate D production build passes. All 16 added tests pass;
the full suite is **1022/1023**. Exact clean parent `6c51dd0` is **1006/1007**,
failing the same Gravity test, “authoritative muzzle metadata survives reordered
scene children; missing sockets never become gun zero.” This is an inherited
failure, distinct from the historical wide-barrel case below. It remains outside
the Adhesive scope; no Gravity or sibling equipment source was changed to hide it.

Earlier combined-worktree checks (87 focused passes and 1061/1062 total passes)
are historical evidence. Their single Gravity equipment failure was outside this
task and later resolved by its owner. Neither that earlier failure nor the later
unrelated implementation is part of this integration's changes.
