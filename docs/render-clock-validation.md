# Render-clock fix and repeatability validation

## Change

Firing samples the weapon's real muzzle socket. Previously, recoil decay and the
authored weapon/barrel pose advanced only in the renderer callback, while the
evaluation driver advanced combat independently. The same input could therefore
launch a shot from different positions depending on intervening draws. Paused
renders also decayed recoil.

`SimulationWeaponPose` now owns that pose and recoil. Active simulation ticks
advance them once, after firing, preserving the existing ordinary 60 Hz ordering
and authored amplitudes/formulas. Drawing reads the published state. Presentation
and equipment animation updates also follow simulation time. Construction,
equipment changes, form changes and resets publish matrices without needing a
first GPU draw. Pause freezes the pose; death clears the dry-shot timer before
publishing the reset pose.

The optional evaluation-only `manualEvaluation`, `renderEvaluation` and
`onEvaluationShot` interfaces let the development fixture vary drawing while
recording exact launch origins/directions. Normal input handling remains intact.

## Preservation

The source byte comparison in
[`candidate5/source-byte-comparison.json`](../artifacts/render-clock/candidate5/source-byte-comparison.json)
confirms the accepted v3 encounter, current weapon balance, save implementation,
mouse/controller modules, three build fixtures and `scripted-route-v1` policy are
unchanged. The encounter still uses six mech squads and vitality scale 1.3.
Generated item IDs and persisted saves retain their existing behavior.

Other workstream files were retained, including diagnostic adaptations to the
public evaluation/reset APIs. The earlier v2 balance comparison and v3 pacing
receipts remain separate historical evidence.

## Checks

- `npm test`: 515/515 pass, including actual Game firing in legacy and quality
  presentation at 0/30/60/144 Hz, pause freezing, socket/ballistic comparisons,
  reload, recovery and reset poses, save migration and input regressions.
- `npm run build`: passes. The existing large-bundle advisory remains.
- Final browser matrix: **30/30 pass**. Every seed-7 input, shot origin/direction,
  measurement event, aggregate result and authoritative end state matches exactly
  across all draw schedules. All twelve pacing baselines pass 180–300 seconds.

| Build | Four-seed duration | Ammo | Heat blocked |
| --- | ---: | ---: | ---: |
| Mobile precision | 203.85–211.70 s | 91–94 | 0 s |
| Elemental pressure | 210.78–213.25 s | 445–463 | 82.28–96.38 s |
| Heavy control | 234.75–274.00 s | 36–42 | 0 s |

The draw-jitter arms execute 230, 238 and 310 actual GPU draws respectively.
Every final post-capture draw leaves authoritative state unchanged. Chrome reports
no warnings/errors or WebGL errors, and the completed scene visibly renders the
terrain, mech weapons, loot beams and all 24 eliminated targets.

Measured full-source fingerprint:
`sha256:5b3714ac9e4906e16a411e64b8fb87f654669baa05940c4badaba3d5f97d65e9`.
At acceptance, all 104 measured source files matched the frozen copy byte for byte.

- [Strict acceptance summary](../artifacts/render-clock/candidate5/accepted/summary.md)
- [Exact source archive](../artifacts/render-clock/candidate5/source-snapshot.tar.gz)
- [Browser receipt](../artifacts/render-clock/candidate5/browser-final-receipt.json)
- [Final rendered scene](../artifacts/render-clock/candidate5/accepted-final-scene.jpg)

The accepted folder retains complete input/event/launch records and SHA-256 trace
digests in `results.json`; the original exports are in `candidate5/raw/`.

The browser protocol uses fresh actual Game pages at fixed 1/60-second simulation
steps. Twelve pacing cells cover three unchanged builds across seeds 7, 8, 41 and
97. Eighteen additional cells cover fresh no-render policy repeats and exact input
replays at 30/60/144 Hz, jitter, and jitter with actual GPU draws. It compares
inputs, launches, measurement events, aggregate measurements and authoritative
end state exactly. Only generated loot UUIDs are normalized in the end-state
comparison. A final GPU draw is separately checked for state changes.

The additive fixture is `/repeatability-lab.html`; its **Run full matrix** control
saves raw evidence through the local workspace export endpoint. The verifier is
`scripts/verifyRepeatability.ts` and requires exactly 30 exports, the current
all-source fingerprint, unchanged v3/balance/fixtures/policy, full objectives and
loot, zero rejected/dropped events, 180–300 seconds for every run and exact
cross-schedule matches. Failed, interrupted and preliminary candidates remain
separate; reports never relabel their source fingerprints.

To repeat, use a fresh source copy with installed dependencies, start the local
export server, open `/repeatability-lab.html` on port 5189 and choose **Run full
30-cell repeatability matrix**. After all 30 exports are saved, run the verifier:

```sh
node --import tsx scripts/servePacingValidation.ts --port 5189 --out artifacts/render-clock/raw
node --import tsx scripts/verifyRepeatability.ts artifacts/render-clock/raw/*.json --outdir artifacts/render-clock/recheck
```

The server runs until stopped; run the verifier in another terminal. Use a fresh
copy so prior exports do not add duplicate cells to the filename pattern.

## Limits

This proves repeatability for scripted browser input with fixed simulation steps.
It does not establish human pacing, physical controller ergonomics, identical GPU
pixels, or performance on a midrange device. Normal live play retains its existing
frame-delta stepping behavior. Validation completed without initializing Git,
committing, pushing or deploying. A later user-authorized commit records this work.
