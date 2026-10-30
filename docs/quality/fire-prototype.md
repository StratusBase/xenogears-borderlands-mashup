# Fire A+B, with C for explosive hits

30 October 2026. The user selected Flashover ignition (A), Cinderbrand aftermath (B), and Backdraft for existing explosive hits (C). This document checkpoints that approved direction before implementation. The mockups remain art targets; playable approval is pending.

## Authorized prototype

- Build actual moving Fire effects on clothed and armored human review targets, with runtime sound and matched before/current/repeated-before sustained-fire measurements.
- A: directional, unequal flame ribbons. B: localized flame tongues, ember clusters and cooling cosmetic soot. C: broader rolling release only from an existing explosive detonation. Secondary recipients remain smaller and quieter.
- Characters, clothing and plates stay intact. No gore, flesh melting, body deformation, environmental fire spread, new hazards or extra damage.
- Preserve authoritative trajectories, fuse, muzzle positions, collisions, damage/status timing and equipment-slot ownership. Source body geometry and materials are borrowed without modification.
- Own new Fire rendering/audio/review modules. Leave combat-owned game.ts, world.ts and ui.ts unchanged. Existing renderers remain usable through the presentation factory.

## Integration boundary

Use an independent Fire presentation adapter through `GamePresentation.setElementalFactory` while presentation is disabled. The shared elemental adapter currently has concurrent audio-recipe and status-construction extension work; do not stage or overwrite those edits. The Fire adapter will consume those seams and document its dependencies. A normal-game default change follows playable review and coordination with the other element adapters.

## Validation receipt

Implementation and measurements pending. Do not interpret this checkpoint or the concept paintovers as gameplay or performance proof. No push or deployment is authorized.
