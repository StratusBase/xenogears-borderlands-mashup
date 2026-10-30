Work in /Users/steven/Projects/xenogears-borderlands. Give [ELEMENT] the same iterative visual and audio quality treatment we used for corrosive.

Start with mockups only. Read the corrosive implementation and quality reports, inspect how [ELEMENT] currently works, and present three distinct, engine-feasible visual directions for me to choose or combine. Give [ELEMENT] its own identity and motion language.

Show each direction on a clothed non-robot human, an armored human, and environmental surfaces. Include weapon details, projectile/trail, direct-hit onset, larger detonation, smaller secondary splash, and lingering reaction. Use a short onset → peak → aftermath sequence. Explain the proposed sound layers and how the design varies with delivery and weapon construction. Keep characters intact and stylized: no gore, melting flesh or body deformation.

Make the concepts achievable in this renderer. Explain which geometry, particles, materials and animation would produce each feature, its likely cost, and any uncertainty. Clearly label concept art versus actual gameplay. Aim for a generous, satisfying impact with controlled outlines, readable targets, grounded contact and clear material response. Keep equipment effects localized.

STOP after presenting the mockups and recommendation. Wait for my choice before implementation.

After I approve a direction:

- Checkpoint approved work in a scoped commit first; leave unrelated changes untouched. Do not push or deploy.
- Build a playable prototype with real runtime audio. Preserve authoritative damage, status timing, collision, trajectories, fuse, muzzle positions, equipment-slot isolation and size/falloff hierarchy. Scale primary and secondary effects purposefully; nearby recipients must not repeat the full primary burst.
- Own new rendering/audio modules and assets. Keep src/game.ts, src/world.ts and src/ui.ts with the combat lead; provide an integration interface and handoff if those need changes. Keep the existing renderer usable.
- Iterate from actual gameplay with sound. After approval, enable it in normal Enhanced gameplay; a lab-only implementation is incomplete.
- Verify humans, armor, moving attachments, relevant delivery types, pilot/mech, secondary elements, pause/cleanup, floors, walls, slopes, raised tops, undersides and finite edges. Show screenshots and real gameplay recordings; state coverage gaps honestly.
- Run matched before/current/repeated-before sustained-fire measurements on multiple targets with sound enabled, using the same scene, seed, resolution and compiled build. Keep recording off during timing; report frame median/p95, CPU/GPU costs and complete combat equivalence. Preserve raw evidence and identify hardware limits.
- Run relevant regressions and the production build. Finish with results, source/artifact links, a scoped checkpoint, and any remaining limitations.
