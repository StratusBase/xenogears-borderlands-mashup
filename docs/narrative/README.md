# Narrative workspace

The earlier **Then, machines made gods** atlas is the proposal baseline for this project. Only its hook is agreed:

> God made man. Man made machines. Then, machines made gods.

All other story material remains proposed. This folder changes no gameplay code and gives the current encounter no lore requirements. The atlas's construction, co-op, campaign, and post-campaign ideas are future proposals, not statements about implemented features.

## Start here

- [Campaign A storyboard and roster](storyboard-and-roster-proposal.md): the current working framing in six beats, with the original atlas's cast. Story details remain proposed.
- [Foundation proposals](foundation-proposals.md): concise notes reconciled with the atlas, two campaign framings, and creative decisions.
- [Editable story atlas](atlas/machines-made-gods-atlas.html): portable offline atlas; 72 cards and 51 causal arrows.
- [Atlas story data](atlas/story.json): editable source for this project's copy.
- [Original atlas instructions](atlas/START-HERE.txt): browser editing and export workflow.
- [Earlier alternate proposals](alternatives/frontier-premise-proposals.md): the disconnected frontier fork, preserved verbatim and unadopted. Its names and history have not been merged into the atlas.

## Provenance and editing

Imported on **2026-10-29** from the on-disk atlas at:

`/Users/steven/.codex/.chatgpt-projects/g-p-67c61c55a3b0819180e8828ab83e8f6d/output/story-atlas/`

The HTML, JSON, original instructions, preview, and three supporting source files were copied without story edits. [Source manifest](atlas/source-manifest.json) records their original SHA-256 hashes. The original directory remains unchanged; there is no automatic synchronization between copies.

For work in this repository, edit `atlas/story.json` and rebuild this local copy. Browser edits do not update that file: first export the latest story data and explicitly reconcile it with the local JSON. Browser-only changes are not included in this on-disk import.

From the project root:

```sh
python3 docs/narrative/atlas/_source/rebuild.py
```

The builder validates unique card IDs, references, and acyclic causal links. The copied `check-atlas.cjs` is a historical browser-check helper with machine-specific runtime paths; it is not part of the gameplay checks.

The concise foundation notes distinguish atlas material from new **extensions**. Those extensions and the second campaign framing are not yet written into `atlas/story.json`; approving or revising them remains a creative decision. Preserve the atlas's explicit proposal status when doing so.
