# DUST // STEEL

A story-free, single-player TypeScript mechanics sandbox. The title and test-area labels are placeholders. Nothing establishes characters, factions, mythology, or campaign canon.

## Play locally

Requires Node.js 20.19+ or 22.12+ and a desktop browser with WebGL 2.

```sh
npm install
npm run dev
```

Open the local address printed by Vite in an active desktop browser tab. Click **Enter proving ground** or **Resume** to capture the mouse for first-person aiming. Escape releases it and pauses. You can also click **Capture Mouse** during play. If the host browser rejects capture, hold the right mouse button and drag to look; this fallback uses cursor coordinates and works even when movement deltas are unavailable. A connected standard-mapped gamepad can also control gameplay and menus; press a controller button after opening the page so the browser detects it.

For development review, `/equipment-lab.html` starts the actual game with deterministic gear variants, injured pilot/mech bodies, and no automatic encounters. It uses a separate save key and resets its fixture on reload. This entry point is unavailable in production.

`/arsenal-lab.html` provides all twelve projectile families in both forms, using real brand/profile rolls and non-attacking targets. **N** resets its targets. It also has a separate save and is unavailable in production. See [the arsenal reference](docs/arsenal.md) for brands, delivery profiles, and effects.

`/field-services-lab.html` starts with eight real gear drops, favorite/junk samples, spending credits, and injured bodies. It uses an isolated save and no automatic encounters, and resets on reload. All three vending machines and both jump charges use the normal game implementation.

Native capture and Escape release have been verified in the active Chrome game window. The in-app preview returned a Chromium capture error, so use Chrome for mouse capture if that preview still rejects it. Browser-local saves are separate between browsers.

The sandbox starts quietly with a permanent, indestructible test dummy straight ahead in the central firing lane. Fire immediately: normal hits, critical spots at pilot/mech height, and elemental ticks use the real combat and colored-number systems. Aimed readouts show the last damage event, total damage, and damage over the trailing five seconds divided by five. The anchored dummy has no health pool, enemy AI, rewards, or effect on encounter completion. It remains available through encounters and death returns.

Press **K** for the sandbox weapon workbench, or aim at its physical table beside the service pad and press **E**. Choose a manufacturer, weapon family, projectile, primary/secondary elements, flight style, variant, assembly, rarity, and level. Twelve examples cover every supported make, type, delivery, element, and flight style. **Guaranteed status** makes proc chances 100% without increasing their damage. **Equip & Test** equips a reusable, zero-resale test weapon for the selected form and moves you to the fixed dummy without spawning enemies. **Reset Dummy** clears measurements and conditions and replenishes test ammunition. **K** returns to the retained draft. **N** or **Start Live Encounter** starts an optional encounter. Copy the build code with feedback or load a code to reproduce a build.

| Control | Action |
| --- | --- |
| WASD / Shift / Space | Move / sprint / jump; press Space again in the air to double jump |
| Captured mouse / right-drag fallback / arrow keys | Aim |
| Right mouse while captured | Aim with zoom and lower sensitivity |
| Left mouse / R | Fire / reload |
| E | Take targeted loot, use a focused nearby station/workbench, or collect nearby supplies; empty space opens no menu |
| F | Take and equip targeted loot; otherwise mount/dismount the mech |
| G while targeting gear | Take it into the backpack marked as junk |
| Q | Pilot dash or mech shockwave |
| H | Med injector / mech field repair; restores health or hull |
| I / Tab | Equipment and stat comparisons |
| K | Open the weapon workbench; return to your retained draft from the test range |
| X / V / J in inventory | Sell selected / toggle favorite / toggle junk |
| N | Start another encounter after clearing current enemies; isolated older fixtures reset their stationary targets |
| Escape | Release mouse and pause |

| Controller (Xbox labels; equivalent PlayStation positions) | Action |
| --- | --- |
| Left stick / click left stick | Analog movement / sprint |
| Right stick / LT | Look / aim with zoom and lower sensitivity |
| RT / X | Fire / reload; X takes and equips targeted loot |
| A / Y | Jump (press again in air) / take loot or interact |
| B during play | Med injector / mech field repair |
| LB / RB | Mount or dismount mech / ability |
| Back / Start | Loadout / pause |
| D-pad or left stick / A / B in menus | Navigate / select / back |
| D-pad up during play | Next encounter |
| D-pad down while targeting loot | Take as junk (the movement stick cannot trigger this) |
| X / RB / LB in inventory | Sell selected / toggle favorite / toggle junk |

Controller sticks use a radial deadzone; button actions trigger once per press. Disconnecting the active controller pauses combat. Controllers must be reported by the browser with the standard mapping; unmapped devices show a clear notice.

## Mechanics implemented

- First-person pilot rifle and mech cannon with different scale, health, mobility, ammo, recoil, and heat behavior.
- Combat drones, telegraphed projectiles, weak points, cover occlusion, shields, reloads, abilities, defeat recovery, and repeatable encounters.
- **H** or controller **B** plays a 1.2-second pilot injector or mech repair action, restoring 35% of the active form's maximum health/hull when the injector presses or repair tools engage. The pilot offers an armored forearm and presses a moving injector plunger; the mech deploys articulated repair tools at its open breeches. Weapons lower during recovery. Pilot and mech share a 20-second recovery cooldown. Using recovery at full health does not start the cooldown. The HUD shows injecting/repairing progress, readiness, cooldown progress, and positive feedback when health is actually restored; **B** remains Back in menus.
- Normal hit numbers are pure white; critical hit numbers are red. Elemental damage ticks float above the affected enemy in the effect's color, with a matching icon and readable fractional amounts. Enemy health fills drain from the right inside fixed dark tracks. Shielded enemies have a blue shield row above health; its dark track remains visible when depleted.
- Authored weapon feedback: empty-fire kick, reload progress and empty-ammo cues; the pilot rifle moves its magazine, bolt, and support hand, while mech cannons open hinged breeches and retract their barrels during reloads.
- Random drops for both forms: weapons, shields, reactors/cooling modules, and legs/boots. Five rarity tiers and affixes change actual combat statistics.
- Dropped gear uses the exact equipped-item prefab, including its rolled appearance, miniaturized to a maximum dimension of 0.55 m for pilot gear or 0.75 m for mech parts and hovering just above the floor. Equipped gear, previews, and cabinet displays retain their own sizing. Aiming at nearby visible gear shows a compact comparison against its matching slot, with Take, Equip, and Take as junk actions. Equipment in the other form can be equipped directly without opening a menu or changing the current form.
- Two jumps per landing in either form, with a visible second-jump burst. Reloading consumes reserve ammunition; smaller weapon magazines return their excess rounds to the reserve.
- Weapons & Ammo, Health & Shields, and Mech Parts vending machines have distinct physical cabinets and products. Their menus sell exact gear with comparisons, offer appropriate ammo/restoration services, and buy all marked junk in one action. Stock refreshes with each encounter; bought stock stays sold across saves, including after resale. Transactions require the machine to be nearby and free of nearby hostiles.
- Favorite/junk marks persist. Favorites and equipped items cannot be sold; equipping a junk item clears its junk mark. X sells selected eligible backpack gear without moving the list; V and J toggle its mark. Bulk junk selling is available at vending machines.
- Every item has one of eight original brands with real statistical tendencies. Weapons also roll delivery profiles and elements. Twelve delivery families include physical rounds, gravity-affected slugs/spikes, ricochets, guided rounds, sticky charges, orbs, beams, scatter, rockets, discs, and chain arcs. Swept collision and cover checks prevent traveling shots, splash, and chains from crossing solid cover.
- The sandbox workbench combines six physical weapon families with independent manufacturer, delivery, flight style, design variant, and up to two elemental channels. Its twelve curated examples cover every category; build codes reproduce exact configurations. One reusable test weapon per form avoids backpack flooding and has no resale value. Stationary targets scale their health for the equipped build; live encounters remain available from pause. Normal drops retain their numeric stat rolls and RNG draw sequence.
- Fire, radiation, corrosion, and shock inflict timed damage every half second. Ice slows and freezes; gravity pulls and slows; shock also weakens shields and chains; adhesive coatings slow. Two elemental channels roll procs independently, including a kinetic primary with an elemental secondary. Each card strip shows its own base DMG/s, chance, duration, and matching-element comparison; the aimed-target ribbon shows current applied rates and remaining times. Flights, attachments, fuses, and status durations pause in menus.
- Elemental accents and restrained particles stay on selected barrel/chamber parts across equipped, preview, parked-mech, and ground-drop views; receiver paint, stocks, grips, and unrelated gear retain their identity. Physical projectile silhouettes combine with delivery, manufacturer details, flight style, variant, and elemental channels. Affected enemy armor still shows prominent toxic goo/vapor, flames, frost, electrical veins, radiation, gravity ribbons, or adhesive strands. These depth-tested visual effects do not affect shot collision or shared physical geometry.
- Equipped backpack entries use a visible yellow border with a separate rarity stripe; the top equipment tiles retain neutral/filter styling. Inventory defaults to rarity descending, then level descending, with deterministic name/ID ties. Compact item cards show direct DPS and icon-based damage, spread, reload, fire-rate, and magazine comparisons first. Green/up means better and red/down means worse, including lower-is-better reload/spread. Elemental damage per proc and chance appear in one colored strip; secondary projectile properties use icon chips with exact-value tooltips.
- Equipped gear changes only its own weapon, shield, reactor/cooling-module, or legs/boots appearance. The pilot uniform, mech chassis, head, and utility tools have independent fixed colors. The inventory shows the full pilot or mech through the same 3D equipment-model module used in the game. **Equipped loadout** shows applied gear; **Item preview** temporarily replaces only the selected item's slot for comparison, without equipping it. Comparing gear preserves the model's viewing angle and scale; drag to rotate it.
- Clicking an equipped slot filters inventory to matching items for that form. **All items** clears the filter. The filter survives selecting, equipping, and selling gear, and resets when changing form or reopening the inventory. Empty slots also support filtering. Reopening starts with the currently equipped weapon selected.
- Defeated enemies have independent 60% cash and 18% health-pickup chances. Gold cash collects automatically at close range or with **E**. Health pickups restore 25% of the active form's maximum health/hull, collect through **E** or proximity while hurt, and stay on the ground when that form is already at full health. They do not restore shields. Credits and independent pilot/mech equipment persist locally; unused equipment can be sold through the loadout menu.
- The service terminal sells paid repairs and pilot/mech gear caches. Repairs restore both loadouts' health, shields, and ammo and clear weapon heat; already serviced loadouts are not charged. Trading requires the starting service pad and no nearby hostiles. Prices and affordability appear in the pause menu. Gear bought in caches resells for at most 50% of its cache's purchase price.
- Shared proving ground, pilot-only service vault, and mech-only heavy range. Zone rules apply to movement and mounting/dismounting.
- Pass near any of five checkpoint stations to activate it and autosave. Death reconstructs you at the **last activated** station, retaining inventory and credits; it does not choose a closer unvisited station. A brief recovery lock ends automatically. The HUD identifies your return point and confirms whether it was saved or is available only for this session.
- An original procedural desert test environment with banded lighting, painted wear/hatching, faceted rock normals, and depth/normal-based comic ink. Roads, hazard stripes, and pads are albedo paint on one terrain surface, without shallow marking slabs. Silhouettes use a three-CSS-pixel outline; interior creases are finer. Final FXAA smooths the completed image, including ink.
- Transparent effects and enemy bars render after opaque ink with depth testing, before final color output and antialiasing. No downloaded art or external asset service is needed at runtime.
- Gate posts meet their beams at shared boundaries, with no overlapping outer faces. Small shadow offsets keep rock shadows in contact with the terrain.

## Deliberate limits

This is a mechanics prototype, not a complete open-world RPG. It has no story, quests, dialogue, multiplayer, procedural campaign, advanced enemy navigation, full character animation, or production art. Current enemies steer toward the player and use line-of-sight checks; complex cover can obstruct their movement. Encounter level scales with completed encounters.

The damage-feedback palette also retains the frost/corrosion/bleed aliases for existing feedback integrations. Current weapon effects use kinetic, fire, ice, radiation, gravity, corrosive, shock, and adhesive profiles. The arsenal is a procedural prototype; weapon models remain stylized procedural assemblies.

Inventory, equipped items, credits, kills, encounter progression, and the active checkpoint persist in this browser when storage is available. Reload continues at the saved station in its compatible pilot/mech form; active fights, world drops, and health reset. Existing version-one saves remain loadable and use the service pad when they contain no checkpoint record. If browser storage is unavailable, checkpoint activation still updates the current session's respawn point and the UI reports that it was not saved. Clearing browser data removes the save. The pause menu provides an explicit reset action.

## Architecture

- `src/core/index.ts`: renderer-independent equipment, loot generation, progression, validated persistence, and zone permissions.
- `src/core/combat.ts`, `economy.ts`, and `feedback.ts`: shield/health damage, cash and purchases, and damage-color rules.
- `src/core/recovery.ts`: independent supply rolls, health restoration, and the shared recovery cooldown.
- `src/core/appearance.ts`: stable equipment appearances and non-mutating preview overrides.
- `src/core/arsenal.ts` and `statusEffects.ts`: brands, rolled delivery profiles, safe metadata migration, timed effects, and effect modifiers.
- `src/core/workbench.ts` and `src/ui/weaponWorkbench.ts`: independent build controls, category-covering examples, safe feedback codes, and the live equipment preview/test flow.
- `src/core/inventoryOrder.ts`: non-mutating rarity/level sorting.
- `src/core/vending.ts`: deterministic exact stock, purchase history, prices, and guarded purchases. Item marks and protected single/bulk sales live in `core/index.ts`.
- `src/core/jump.ts` and `ammo.ts`: two-press jump motion, landing resets, and ammunition conservation.
- `src/core/itemCard.ts`, `src/ui/itemCard.css`, and `src/ui/itemIcons.ts`: tested comparison models, component-owned card styling, and bundled Material Design SVG glyphs. Icon provenance and licenses are in `src/ui/icons/`.
- `src/core/healingAction.ts`: pause-aware recovery timeline and one-time health application.
- `src/core/checkpoints.ts`: station definitions, activation ranges, legal spawn forms, and compatible save defaults.
- `src/world.ts`: procedural scene, spatial zones, static colliders, and shot occluders.
- `src/game.ts`: input, simulation orchestration, combat, movement, rendering, and effects.
- `src/ui.ts`: HUD, reload feedback, menus, inventory, comparisons, and service-terminal controls.
- `src/input/gamepad.ts`: renderer-independent controller mapping, deadzones, and button edges.
- `src/input/mouse.ts`: native capture, release, permission errors, and cursor-coordinate drag fallback.
- `src/rendering/ComicRenderer.ts`: opaque ink, depth-tested overlays, final color output, and FXAA.
- `src/rendering/materials.ts`: stepped lighting bands and deterministic painted surface maps.
- `src/rendering/ground.ts`, `enemyBars.ts`, and `weaponMotion.ts`: terrain paint, fixed health/shield tracks, and authored reload timelines.
- `src/rendering/healthPickup.ts`: medical supply models using the shared comic materials and soft pickup glow.
- `src/rendering/equipmentModels.ts` and `LoadoutPreview.ts`: shared full-body equipment geometry and the cached inventory turntable renderer.
- `src/rendering/ElementEffects.ts`, `ElementCoating.ts`, and `equipmentEffects.ts`: bounded elemental particles, borrowed-surface overlays, and slot-owned equipment effect lifecycle.
- `src/rendering/dropModels.ts` and `vendingMachines.ts`: exact standalone equipment prefabs and three physical service cabinets, with shared world collision and disposal.
- `src/rendering/healingVisual.ts`: animated injector, hands, and articulated mech repair tools.
- `src/rendering/PlayerBallistics.ts`: physical player projectiles, beams, collision sweeps, guidance, attachments, fuses, ricochets, splash, and chain arcs.
- `src/rendering/checkpointStation.ts`: physical autosave pylons with active/standby signs and beacons.
- `tests/core.test.ts`: deterministic mechanics and persistence checks.
- `tests/checkpoints.test.ts` and `checkpointWorld.test.ts`: save migration, station selection, form restrictions, and actual spawn/parking clearance.
- `tests/combat.test.ts`, `economy.test.ts`, and `feedback.test.ts`: shield damage, wallet transactions, supply purchases, feedback colors, and fixed enemy bars.
- `tests/recovery.test.ts`: independent drop outcomes, healing caps, full-health preservation, and cooldown reuse across forms.
- `tests/appearance.test.ts`, `equipmentModels.test.ts`, and `healingAction.test.ts`: stable equipment looks, actual model variants and sockets, safe model disposal, and recovery timing/cancellation.
- `tests/previewFraming.test.ts` and `healingAppearance.test.ts`: stable comparison framing for every model variant and isolation of healing tools from unrelated gear.
- `tests/ground.test.ts` and `faceted.test.ts`: actual ground heights, painted markings, and mesa face normals.
- `tests/contact.test.ts`: actual gate joints and transformed rock/terrain contact.
- `tests/world.test.ts`: actual scene clearance, gate routes, boundaries, collision, and shot occlusion.
- `tests/gamepad.test.ts`: simulated controller input, drift, triggers, held buttons, and reconnection.
- `tests/mouse.test.ts`: capture, release, movement, rejection, canceled requests, and drag fallback.

Future narrative content can reference zones, encounters, equipment, and progression through a separate mission layer. Core item and combat data have no story requirements.

## Verification

```sh
npm test
npm run build
```

Gameplay, UI, loot generation, and world generation are authored in TypeScript. HTML/CSS provide the browser shell and styling; Three.js provides the renderer.

Automated validation passes **254 tests** and the production build. Tests cover permanent dummy body/critical collision, bounded fractional damage recording and five-second DPS, workbench metadata/codes and preset coverage, unchanged normal RNG/stat rolls, independent dual-element card rates and comparisons, focused station interaction, marks and protected bulk sales, deterministic vending stock and purchases, legacy save migration, double jumps and ammunition conservation, exact dropped/equipped prefab equality, vendor collision/routes/disposal, direct/per-pellet DPS and status comparisons, projectile collision/guidance/fuses/cover, timed effects and shield overflow, bounded elemental pools, surface ownership and cleanup, sorting, equipment visual isolation, checkpoints, healing, and simulated mouse/controller input.

Earlier browser play-testing verified pilot/mech switching, clearing an encounter, collecting a rare drop, comparing/equipping it, cannon ammo/heat, and both restricted areas. Native mouse capture and Escape release were verified with a real click in the active Chrome window; background tabs and the embedded preview rejected capture. Browser visual checks complement the automated tests; the tests do not prove final appearance or animation quality. Controller mapping is tested with simulated devices; a physical controller still needs a hardware play-test.

Checkpoint browser checks verified pass-by activation, automatic death return with restored vitals and retained credits, reload at Yard Junction, and pilot-vault/mech-range activation and reload behavior. Failed encounters clear on death; world drops remain available during the session.

Equipment browser checks verified applied pilot and mech models, inventory drag rotation, actual cannon firing/reload handles, injector and repair-tool animations, timed health application, cooldown reuse, and capped recovery. The normal entry point also loaded its existing browser save successfully.

Slot-filter browser checks verified matching pilot/mech inventory lists, filter persistence through equip and sale, valid selection after selling, **All items** reset, reopening reset, and unchanged pilot body paint/size/angle across weapon comparisons.

Compact-card browser checks verified weapon and reactor comparisons, green/red value and arrow semantics, elemental DPS/proc chance, backpack-only equipped borders, and visibility of the main stats, effect strip, and actions at 1280×720 without scrolling.

Backpack browser checks verified exact scroll retention through pilot/mech comparisons and equipping, natural clamping after a sale shortens the list, and intentional resets when changing the form or slot filter. Card and backpack symbols use the same filled SVG glyph set.

Field-service browser checks verified X/V/J, favorite sale protection, both forms' favorites/equipped gear surviving a four-item bulk sale, exact purchases at all three machines, medical/mech restoration, actual reserve consumption and refill, no charge at full supplies, both airborne jump presses and landing, all three world-loot actions, and runtime logs without errors. These checks used the isolated field-services lab; physical controller hardware was not exercised in this pass.

Elemental browser checks use `/element-effects-lab.html`, whose diagnostic weapons explicitly show 10 damage and 100% proc chance. All seven elemental styles were exercised through actual firing, target statuses, cards, coatings, and the live shader compiler. Corrosion, fire, shock, and radiation produced colored per-enemy tick numbers; control effects showed duration without fake DPS. Shader/runtime errors were resolved before final capture. Normal rolls and player saves are unchanged.

Workbench browser checks used isolated UI/field fixtures. All twelve examples were equipped and fired, covering every manufacturer, weapon family, delivery, element, and trail style. Dual-element pilot and mech weapons applied independent real effects. Empty-space E did nothing; looking at the physical bench enabled E, and looking away disabled it. Build-code validation, retained drafts, return to live encounters, and reachable controls/preview/stats at 1280×720 and 390×844 were checked with no rendering errors. The permanent dummy supersedes the normal workbench's spawned targets; older isolated fixtures retain stationary enemies. This is representative coverage, not an exhaustive runtime check of every permutation or physical controller hardware.

Permanent-dummy browser checks use `/test-dummy-lab.html` with an independent save key. All twelve deliveries registered damage without spawning enemies or increasing kills. Pilot body damage, red mech-height criticals, independent corrosion/shock ticks, damage recording without a target-health cap, measurement reset, hiding when looking away, and the 390×844/1280×720 readouts were verified. The same dummy remained usable when a live encounter was started and returned to the quiet range when reset. The dummy cannot move under weapon impulses or gravity; its damage records never run the enemy death/reward path.
