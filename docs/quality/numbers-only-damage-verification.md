# Numbers-only damage feedback and combined validation

30 October 2026. Floating damage shows the numeric amount alone in both classic
and crowd feedback. Element labels/icons, critical exclamation marks, count text
and edge cues are absent from the floating label. Element colors, critical size
and styling, raw amounts, aggregation and tooltip/accounting metadata remain.

## Change boundary

- `src/ui.ts`: use the existing numeric formatter for classic popups; remove the
  obsolete damage-icon map. Other status/card changes belong to their owners.
- `src/ui/damageNumbers.ts`: keep only the numeric value visible and remove
  textual-cue width from placement estimates. Damage accounting is unchanged.
- `src/ui/damageNumbers.css`: retain the mixed-element color underline on the
  numeric value rather than on a removed label.

The measured B2 source was committed base `cb50ed0` plus exactly those three
display files. Its 175 compiled-source hashes and 27 emitted files are bound in
the local evidence. All other 261 source files matched that base; the 40 checked
gameplay, pacing, save and input files were unchanged. Concurrent Gravity and
unrelated working changes were excluded. These results describe that frozen
tree, not later changes independently landed by other owners.

## Source and live checks

- **1070/1070 tests pass**, including damage feedback and simulation-clock tests.
  TypeScript, production build and the five-entry validation build pass.
- Ordinary untagged game: workbench, Equip & Test, real damage/status and R reload
  work for pilot Fire + Adhesive and mech Adhesive + Fire. Observed floating
  values include `35`, `60`, `4.43`, `320` and `40.06`, without text prefixes.
  Pilot reload restored 30/30 with 231 reserve; mech restored 2/2 with 53 reserve.
  Console errors were empty. Guaranteed procs were an explicit workbench review
  option; these dummy checks are separate from the normal-resource full run.
- Full authored route: **195.700 seconds**, 24 distinct authoritative kills, both
  relays, mini-boss, salvage pickup and completion. No forced waiting, teleports,
  resource/stat overrides or phase shortcuts were added. The legitimate level 5
  rare mobile-precision kit uses Adhesive on the combined production registry.
- The exact Salvaged Vent Reactor was equipped through normal inventory:
  cooling **33.65 -> 36**, maximum heat **124.48 -> 134**, other slots preserved.
  Run 2 reset the relays and reached an actual mech shot at Game time 219.600.
  Raw encounter errors were empty.

## Matched performance

Eleven scenes, 39 arms: six Adhesive/mixed ABBA comparisons and five Fire/full or
equipment ABA comparisons. Each arm uses 120 warmup and 720 measured displayed
frames, fixed 1/60 steps, sound on and recording off, at **1440 x 900, DPR 1**.
Direct Fire/Adhesive shots are exercised in both primary/secondary orders.
Rifles hit three actual recipients; explosives hit six.

Independent raw checks pass for combat state, resources, shots, hits, statuses,
repeated Adhesive cosmetics and module inventory. Element baselines omit only
their named element; equipment comparisons retain full Fire. Existing committed
Gravity and all sibling registrations remain unchanged in every arm.

Current frame medians are **9.9-10.0 ms**, p95 **10.9-13.1 ms**. Unique GPU-query
coverage is **718-719/720**, without skipped, duplicate, disjoint or lost samples.
Fire rifle GPU median is 1.984 -> 2.454 -> 2.083 ms before/current/before-repeat;
step CPU is 1.3 -> 1.5 -> 1.2 ms. Effects have measurable cost. Baseline GPU-median
drift reaches about 29.5% in an Adhesive case and 22.3% in Fire equipment. Shared
host activity limits attribution; no numeric budget pass or speedup is claimed.
GPU distributions are recomputed from raw queries; CPU/frame summaries lack raw
sample arrays and are validated as summaries. End visibility/capture declarations
do not establish independent continuous traces.

## Native evidence and remaining limits

Original full video/audio spans are **195.639/195.661 seconds**; replay is
**24.820/24.840 seconds**. Both are **1680 x 1245 VP9**, with 48 kHz stereo Opus;
native capture is separate from the locked benchmark resolution. Every audio
packet decodes (3261 full, 414 replay), with zero decode errors, finite nonzero
PCM and zero clipped samples. One EOF Opus parser warning per file is retained.
Both originals play unmuted in Chrome without media errors; all gallery images
load. No replacement audio, gain, reencoding or retiming was applied.

Pointer lock was denied; existing fallback input remained usable. A held native
test click needed an explicit release click before the final reload. No input
code was changed. Physical-controller, human balance, subjective listening and
complete decoded-video/dropped-frame assessments are not claimed. The full route
uses the Adhesive kit; mixed Fire/Adhesive shots are separately covered by the
matched fixtures and ordinary game checks.

## Commit-parent compatibility check

After B2 measurement, the Gravity owner independently landed `b30fe1a`. This
display-only commit inherits that parent without changing its Gravity work.
The exact resulting source tree passes **1092/1092 tests**, TypeScript and the
production build. Logs are under `artifacts/numbers-only-commit/`. This later
source check does not relabel the earlier B2 live or performance evidence.

## Local evidence

Raw media, screenshots and generated evidence remain ignored under
`artifacts/combined-fire-adhesive/2026-10-30-rerun-2-numbers-only/`:

- `verification.md`, `index.html` and `delivery-binding.json`.
- `freeze-manifest.json`, `build-binding.json`, `session-binding.json` and logs.
- `audit-adhesive-six-1.json`, `offline-fire-audit-final-1.json`,
  `audit-bound-performance-1.json` and `audit-bound-full-1.json`.
- `encounter-evidence.json`, `media-validation-corrected-1.json`, native WebMs,
  `gallery-playback-complete.json` and ordinary input/number receipts.

Earlier runs and failed assumptions remain separately labeled. The initial
media audit assumed benchmark dimensions and an older FFmpeg summary syntax;
its corrected audit uses observed native dimensions and retained decode logs.
No prior raw evidence or timing manifest was silently overwritten or relabeled.
No push or deployment is part of this delivery.
