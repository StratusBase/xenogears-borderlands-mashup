# Arsenal mechanics

Every item has a brand, rarity, level, and rolled combat stats. Weapon family, delivery, elemental channels, flight style, and design variant are separate saved choices. A rifle can fire corrosive spikes, icy beams, or bouncing shock rounds without making those payloads the same weapon. Inventory sorts by rarity descending, then level descending, then name and item ID.

The compact comparison card puts a damage-rate comparison and five icon stats first. Scatter shows damage per pellet with its multiplier. Cluster shows the blast budget per explosion multiplied by parent-plus-bomblet count; its comparison uses the full carrier budget, not a promise that every blast hits one target. Green/up is an improvement, red/down is worse. Reload and spread improve when their numbers fall. Direct DPS excludes reloads, heat, criticals, splash, chains, and statuses. Cluster's blast-budget rate also excludes travel/fuse delay, blast falloff, cover and target movement. Tooltips show the corresponding reload-aware comparison. The colored elemental strip prominently shows base **DMG/s**, chance, and duration separately. Control-only effects say **CONTROL**. Exact values and full property names are available in tooltips. Yellow equipped outlines appear only in the backpack.

## Brands

| Brand | Weapon identity | Equipment tendencies |
| --- | --- | --- |
| Ironvale | Heavy physical rounds, rockets, and cluster ordnance; damage over cycling speed | Heavier protection and capacity |
| Prism | Beams, orbs, and discs; precision, ice, and gravity | Efficient shields, fast cooling |
| Kestrel | Guided rounds, light bullets, and scatter; fast handling | Mobility and reload speed over protection |
| Rebound | Ricochets and bouncing discs; kinetic and shock | Larger magazines and balanced durability |
| Tackwork | Sticky charges and spikes; adhesive and corrosive payloads | Reinforcement and capacity |
| Nullward | Orbs, guided rounds, and discs; gravity and ice | Large shields and reactors |
| Cindergrid | Rockets, clusters, slugs, and scatter; fire, radiation, and corrosion | Aggressive damage and cooling |
| Voltaic | Chain arcs, beams, and spikes; shock and radiation | Fast cycling, cooling, and servos |

These tendencies modify actual rolled stats. They are not brand labels applied to otherwise identical items. Existing saved items retain their original numeric stats when receiving legacy metadata.

## Sandbox workbench

Press **K**, use **Weapon workbench** in the pause menu, or aim at the physical workbench beside the service pad and press **E**. E opens a station only when its actual mesh is focused and in range; empty space has no fallback menu action.

The workbench offers eight manufacturers; pistol, SMG, rifle, shotgun, sniper, and launcher families; all thirteen delivery profiles; primary and optional secondary elements; six flight styles (**Clean, Tracer, Helix, Pulse, Comet, Ribbon**); and four design variants. Assembly, rarity, and level are also adjustable. Thirteen curated examples cover every make, family, delivery, element, and flight style. The **Guaranteed status** toggle sets applicable proc chances to 100% for testing; it does not increase status damage strength.

The live preview uses your other equipped parts. **Equip & Test** equips one reusable, zero-resale test weapon per form and moves you to the permanent dummy with replenished ammunition and no spawned enemies. Editing a build replaces that form's test weapon rather than filling the backpack. **Reset Dummy** clears measurements and active conditions. **K** returns to the retained draft. **N** or **Start Live Encounter** starts an optional live encounter. Copy the build code with feedback, or paste it and select **Load** to reproduce a permutation.

The anchored test dummy is always present in the central firing lane. It cannot die, move, attack, drop loot, or count as a hostile. Body hits, the two red critical centers, and elemental effects use real ballistics and combat modifiers. Its aimed readout records the last damage event, total damage, and trailing-five-second damage divided by five; idle time reduces DPS without erasing totals. Menu pauses also pause the measurement clock. The dummy remains present during encounters, resets, and death returns; only explicit measurement resets or reloading the page clear its accounting.

Receiver design and paint stay stable when changing only elements or flight style. Manufacturer, weapon family, assembly, and variant supply the physical identity. Elemental accents stay on selected operating parts, such as the barrel and chamber; the stock, grip, support hand, and unrelated armor retain their own materials. Projectile geometry leads its appearance, with flight style, variant, manufacturer details, and elemental channels layered onto it. Normal drop generation retains its numeric combat rolls and RNG draw sequence.

## Delivery profiles

| Profile | Combat behavior |
| --- | --- |
| Bullet | Fast physical round with an accuracy cone and a short tracer |
| Slug | Larger round with gravity drop; kinetic impacts stagger |
| Spike | Narrow, pointed projectile with lighter gravity drop |
| Ricochet | Reflects from surfaces, losing speed and damage at each bounce |
| Homing round | Steers toward visible targets within its steering rate |
| Sticky charge | Delivers a small contact hit, attaches to a target or surface, then detonates after its fuse |
| Orb | Slow, luminous splash projectile; tracking works when the profile includes it |
| Beam | Instant straight ray with a visible core and halo; cover stops it |
| Scatter | Multiple projectiles in a cone; displayed damage is per pellet |
| Rocket | Physical flight and an explosion with distance falloff |
| Disc | Spinning projectile with surface bounces |
| Arc | Short-range instant electrical path, with up to three weaker, cover-tested chain hops |
| Cluster | One parent splash burst scatters gravity-driven, bouncing bomblets with staggered secondary explosions; every explosion shares one carrier budget |

Moving rounds use swept mesh collision. Explosions and chain hops check cover. Sticky charges follow the target's local attachment point and fall away if the target disappears. Simulation time controls flight, fuses, effects, and statuses, so opening a menu pauses them.

Cluster uses the user-selected **classic MIRV** pattern: one carrier flies to contact or its travel/lifetime limit, produces a parent splash burst, and scatters **six pilot bomblets** or **eight mech bomblets**. Bomblets move outward under gravity, bounce on actual target/terrain/cover meshes without contact damage or elemental impact events, then explode at staggered fuses. They do not split again. Default fuses span **0.65–1.10 seconds after deployment**; the shared helper enforces a 0.35s minimum for shorter saved values. Parent and bomblets use the saved blast radius, currently **3m pilot** and **4m mech**. Children have a finite local 40m travel cap, with the complete shot lifecycle bounded to 16 seconds.

For **N** bomblets and effective carrier budget **B**, the parent and each bomblet receive **B / (N + 1)**. These are noncritical splash packets: no extra direct hit is applied on contact, and ordinary falloff/cover can reduce actual damage. Item cards include the parent in the explosion multiplier and label the theoretical rate as a blast budget. This replaces the earlier carrier-with-no-damage/forward-cone behavior.

Cluster preserves manufacturer, independent primary/secondary elements, flight style and variant. Each elemental channel independently shares its saved chance across **N + 1** packets: `packet chance = 1 − (1 − carrier chance)^(1 / (N + 1))`. If all packets reach one target, the chance of at least one proc equals the saved carrier chance. Successful procs use carrier-strength status power, retaining actual blast falloff and the one-time secondary-element cost. The channels are not merged, and the bomblets retain the frozen fired recipe.

Cluster’s shared runtime shot budget is **1.35 × the raw damage roll**, followed by the existing 0.85 independent-secondary cost where applicable. This applies once before the parent/child shares and status power, without rewriting saved numbers or increasing proc chance.

Cluster remains in **Ironvale** and **Cindergrid** ordinary weapon loot for both forms, alongside the workbench and arsenal fixtures. Its weights remain **12.5% of Ironvale weapon profiles** and **16.7% of Cindergrid weapon profiles**. This behavior revision does not change other profile intervals, element pools or loot/stat RNG draws. Existing saved numeric fields are retained. For Cluster only, `split.delay` now means the bomblet stagger window, and `split.spread` is no longer used as a forward-cone angle. Other physical weapons with optional split metadata retain their established cone/timer and child-only accounting.

The [MIRV contract and review fixtures](cluster-mirv.md) describe the current behavior and verification boundaries. The [29 October Cluster balance pass](cluster-balance.md) retains measurements of the earlier forward-cone implementation; its 72 scripted runs are not evidence for the new MIRV lifecycle.

## Damage and status effects

A valid secondary elemental channel costs **15% effective projectile damage**, including a kinetic primary carrying a secondary status. The cost is applied once before collision, splash, chains, critical modifiers and status-power calculation. Item cards show the effective values and identify the cost in their tooltips. Proc chances, status durations and control strengths retain their existing values. Saved damage rolls and build configurations are not rewritten. Abilities and fixed target-health-based radiation death pulses keep their own damage rules.

Mech shots generate `min(31, 120 / fireRate)` heat per consumed round, regardless of pellet count or subsequent hits. Overheating begins at capacity and unlocks strictly below **45%** capacity. Slower mech weapons retain 31 heat per shot. Pilot shots retain 8 heat and the 30% unlock threshold. Cooling, equipment capacity, and the mech's normal 40-heat vent on a nine-second cooldown retain their existing values.

An elemental impact rolls independently for each non-kinetic channel. Unsplit deliveries use the saved chance; Cluster shares it across the parent-plus-bomblet packets described above, while other physical split deliveries share it across their children. A kinetic primary can carry a secondary status payload. Direct normal-hit numbers remain white and critical hits red; status damage uses the effect's color and floats above the affected enemy, including fractional damage. Fire, corrosion, radiation, and shock tick every half second. Tick amounts are half of their per-second rate. Aimed targets show an active-effect ribbon with the current damage rate (including their active vulnerability/shield modifiers) and remaining time. Item cards show each channel's independent base rate per successful proc, chance, and duration before target modifiers; comparisons match the same element even when its channel order changes. A newly added secondary compares against zero.

| Type | Effect when applied |
| --- | --- |
| Kinetic | Physical damage; slugs, spikes, and rockets stagger targets |
| Fire | Four seconds of burning damage, applied every half second |
| Ice | Movement falls to 55%; repeated procs briefly freeze movement and attacks |
| Radiation | Five seconds of ticking damage; irradiated deaths create a nearby damaging pulse |
| Gravity | Pulls nearby visible enemies toward the impact and slows affected enemies |
| Corrosive | Four seconds of corrosion ticks and 30% increased incoming damage |
| Shock | Two seconds of electric damage; amplifies shield damage without amplifying health overflow; successful procs can arc to a nearby visible target |
| Adhesive | Sticky coating slows movement to 60% for three seconds; sticky delivery separately controls attachment and detonation |

Effects refresh duration without postponing the next damage tick. Stronger ticking effects are not overwritten by weaker procs. Ice, gravity, and adhesive use the strongest active slow; they do not multiply into an excessive stacked slowdown.

Each element has pooled particle shapes, impact bursts, and animated surface treatment. Corrosion uses toxic vapor, wet green patches, drips, and splatter; fire uses hot seams, flames, embers, and smoke; shock uses electrical veins, arcs, and sparks. Active conditions coat the affected enemy's armor. Weapons carry restrained, localized accents and muzzle effects in first person, on the parked mech, in previews, and as drops. Physical rounds retain their distinct silhouettes rather than all becoming elemental orbs; the same element can accompany different deliveries and flight styles. Non-elemental armor does not inherit the weapon's trait. Cosmetic effects cannot intercept shots, enlarge physical collision bounds, or dispose borrowed armor geometry.

`/element-effects-lab.html` is an isolated development fixture with explicitly labeled 10-damage, guaranteed-proc weapons for repeatable visual/tick checks. It uses normal combat/status/rendering paths and does not change normal weapon rolls, saved gear, or proc chances.

## Try the arsenal

The normal sandbox includes the workbench and live encounter controls above. For an isolated development fixture, open `/arsenal-lab.html`: thirteen example deliveries in both forms, a separate save, and non-attacking targets. Press **I** to equip a weapon, **N** to reset targets, and **F** to switch forms near the parked frame. Reloading resets this fixture.
