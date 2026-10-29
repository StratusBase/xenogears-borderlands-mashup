# Pacing and balance integration status

## Render-clock validation complete (2026-10-29)

The render-clock fix passes all 30 actual-Game browser runs and 515 unit tests;
the production build passes. Recoil/socket poses advance on simulation ticks.
All three builds match exact input, shot, event and authoritative end-state traces
across no draw, 30/60/144 Hz preparation, jitter and actual GPU drawing.

Current receipt: `artifacts/render-clock/candidate5/accepted/summary.md`.
Measured source: `artifacts/render-clock/candidate5/source-snapshot.tar.gz`.
Full-source fingerprint:
`sha256:5b3714ac9e4906e16a411e64b8fb87f654669baa05940c4badaba3d5f97d65e9`.
All 104 current source files match that frozen source byte for byte at acceptance.

Twelve pacing baselines across seeds 7, 8, 41 and 97 pass: precision
203.85–211.70s, elemental pressure 210.78–213.25s, heavy control 234.75–274.00s.
Encounter v3, balance, save implementation, mouse/controller modules, fixtures and
input policy remain byte-identical to the earlier accepted v3 source. Other
workstream files and diagnostic API adaptations were preserved. Earlier clock
candidates remain separate preliminary evidence; none were relabeled.

Detailed report: `docs/render-clock-validation.md`. Root has no further source
edits planned. Physical controller/human pacing and GPU pixel determinism are not
asserted by these scripted fixed-step tests.

The status below records the earlier pacing acceptance; it is historical evidence
and its whole-source fingerprint is not the current source fingerprint.

## Earlier v3 pacing acceptance

The pacing task is complete on the user's selected v3 encounter and current combined
balance defaults. All 12 fresh-page actual-Game scripted runs passed 180–300 seconds,
with identical existing fixtures/input policy, all 24 targets/objectives/loot complete,
exact trace replay and zero rejected/dropped events.

Strict acceptance: artifacts/pacing-v2/final/summary.md.
Measured source: artifacts/pacing-v2/candidate5-current-balance/source-snapshot.tar.gz.
At that acceptance, the entire src tree matched the frozen source byte for byte,
including the explicitly fingerprinted evaluation entrypoint.

The earlier v2 48-cell balance comparison remains intact at its own frozen source.
Its paired-arm analysis is a different source/version and must not be pooled with the
v3 current-default pacing acceptance. The user confirmed "Keep v3; retain the v2 comparison."
This task did not overwrite balance implementation, fixtures, input policy or its data.

The final pacing receipt and earlier failed candidates are all retained. Root's detailed
report is docs/pacing-v2-validation.md. No Git initialization, commits, pushes or deployment
were performed. Temporary validation servers were stopped without touching existing ones.
