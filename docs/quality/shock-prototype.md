# Shock A+B prototype

30 October 2026. The user selected **A / Arc Lash + B / Live Wire**, reserving **C / Capacitor Kick for heavy explosive hits**. The accepted concept boards and prompts are under `artifacts/concepts/shock-v1/`.

This checkpoint records the approved direction before implementation. The prototype will use the existing `GamePresentation.setElementalFactory` interface, retaining the current renderer for matched comparisons. New code belongs in Shock rendering/audio modules and an isolated review entry. The combat lead retains `src/game.ts`, `src/world.ts`, and `src/ui.ts`.

Required invariants: unchanged damage, status/proc clocks, chain recipient and damage, projectile trajectories/fuse, cover, muzzle transforms, equipment-slot ownership and secondary falloff. One read-only confirmed-chain callback will be provided for integration; the prototype may observe the existing confirmed chain through its review instrumentation. No presentation callback applies damage or selects another target.

The completion receipt will include actual human/armor/surface gameplay with live audio, a bounded secondary hierarchy, exact combat replay comparisons and same-build before/current/repeated-before sustained-fire measurements. Art approval does not imply approval of an unseen runtime result. Normal-game activation follows review of the moving prototype.
