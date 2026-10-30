# Project guidance

## Communication

- Keep answers short and easy to scan; lead with the answer or recommendation.
- Use short bullets, familiar language and essential details first.
- Keep material risks and blockers visible; end with a clear next step when needed.

## Effects architecture and ownership

Before adding or extending elemental effects, read [the effects architecture guide](docs/effects-architecture.md). For gravity, also read [the agreed gravity design](docs/quality/gravity-design.md).

- Keep gameplay, rendering and audio responsibilities separate. Gameplay owns forces, movement, collision, damage, capture and release. Presentation consumes authoritative events/state.
- Reuse existing systems. Extract genuinely shared helpers to a neutral shared module when semantics match; do not copy them or make new elements depend on another element's implementation folder.
- Keep distinctive behavior, materials, motion, sound recipes and tuning with the owning element. Prefer small composed modules and injected profiles/handlers over growing element switches or chains of element-specific subclasses.
- Extend through a small common contract and one composition root. Do not create a second event bus, audio engine, gameplay clock, resource owner or presentation lifecycle for each element.
- Follow the current folder layout. The workspace/multiplayer structure in `docs/project-structure-proposal.md` is proposed, not an instruction to move the project during an effects task.
- Preserve existing imports/renderers through coordinated extraction and compatibility exports. Do not silently replace or refactor concurrent element work.
- `src/game.ts`, `src/world.ts` and `src/ui.ts` remain combat-lead owned. Supply new modules, explicit interfaces and a handoff for integration in those files unless the user reassigns ownership.
- Preserve equipment-slot isolation, muzzle positions, projectile behavior, source-resource ownership and unrelated combat. Gravity's explicitly requested pull/hold/crush/lift mechanic is an authorized design change, not an existing behavior to claim as implemented.
- Keep generated concepts and evidence in ignored `artifacts/`; keep runtime modules/assets, canonical design and handoffs in tracked project locations. A lab-only effect is not completed main-game integration.
- Verify approved effects in normal gameplay with sound and matched same-build performance. Preserve earlier evidence and state coverage limits honestly.

There may be concurrent uncommitted changes. Edit/stage only task-owned files; never include other work merely because it is already staged. No push or deployment without explicit user authorization.
