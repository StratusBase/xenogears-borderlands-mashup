# Arsenal mechanics

Every item has a brand, rarity, level, and rolled combat stats. Weapon family, delivery, elemental channels, flight style, and design variant are separate saved choices. A rifle can fire corrosive spikes, icy beams, or bouncing shock rounds without making those payloads the same weapon. Inventory sorts by rarity descending, then level descending, then name and item ID.

The compact comparison card puts direct DPS and five icon stats first. Damage is shown per pellet with a multiplier for scatter, or per child with a multiplier for cluster; its comparison uses total damage per trigger. Green/up is an improvement, red/down is worse. Reload and spread improve when their numbers fall. Direct DPS excludes reloads, heat, criticals, splash, chains, and statuses; the tooltip also shows reload-aware DPS. The colored elemental strip prominently shows base **DMG/s**, chance, and duration separately. Control-only effects say **CONTROL**. Exact values and full property names are available in tooltips. Yellow equipped outlines appear only in the backpack.

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
| Cluster | One carrier releases smaller explosive rounds after a delay or on contact; its damage budget is shared among the children |

Moving rounds use swept mesh collision. Explosions and chain hops check cover. Sticky charges follow the target's local attachment point and fall away if the target disappears. Simulation time controls flight, fuses, effects, and statuses, so opening a menu pauses them.

Cluster fires one carrier, which deals no damage itself. It splits after **0.45 seconds**, or earlier on contact, into **six pilot children** or **eight mech children**. Children spread from the carrier's direction, travel at 65% of its speed, and detonate on collision or after their own **0.65-second fuse**. Their blast radius is **3m** for pilot weapons and **4m** for mech weapons. Pilot children use a **0.12-radian** cone; mech children use a tighter **0.08-radian** cone to retain more of the payload at distance. Children do not split again. Unlike scatter, these rounds separate after the carrier has traveled rather than at the muzzle.

Cluster preserves the selected manufacturer, primary/secondary elements, flight style, and variant. Direct impact damage is divided among the children before contacts and splash. Elemental chance is shared across children independently for each channel: `child chance = 1 − (1 − carrier chance)^(1 / child count)`. When all children connect to one target in one impact stage, the chance of at least one proc matches the carrier chance. At a 35% carrier chance, pilot children each have about 6.9% and mech children about 5.2%. Successful procs use the carrier's status strength, with actual splash falloff and the one-time secondary-element cost retained. This reduces excessive control reliability without dividing nonstacking periodic effects twice. Item cards show child direct damage, child proc chance, and carrier-strength damage per proc.

Cluster appears in **Ironvale** and **Cindergrid** ordinary weapon loot for both forms, alongside the workbench and arsenal fixture. It takes half the existing rocket weight: **12.5% of Ironvale weapon profiles** and **16.7% of Cindergrid weapon profiles**. All other profile-selection intervals, element pools, and RNG draw counts remain unchanged. Other manufacturers retain their established pools. Existing saved items keep their numeric stats and explicit split settings; revised cone/radius defaults apply to newly generated weapons. Optional saved split metadata also supports other physical carrier profiles without adding fields to legacy weapons.

The [Cluster balance pass](cluster-balance.md) records the actual-game comparison, controlled range/cover evidence, loot compatibility, and limitations.

## Damage and status effects

A valid secondary elemental channel costs **15% effective projectile damage**, including a kinetic primary carrying a secondary status. The cost is applied once before collision, splash, chains, critical modifiers and status-power calculation. Item cards show the effective values and identify the cost in their tooltips. Proc chances, status durations and control strengths retain their existing values. Saved damage rolls and build configurations are not rewritten. Abilities and fixed target-health-based radiation death pulses keep their own damage rules.

Mech shots generate `min(31, 120 / fireRate)` heat per consumed round, regardless of pellet count or subsequent hits. Overheating begins at capacity and unlocks strictly below **45%** capacity. Slower mech weapons retain 31 heat per shot. Pilot shots retain 8 heat and the 30% unlock threshold. Cooling, equipment capacity, and the mech's normal 40-heat vent on a nine-second cooldown retain their existing values.

An elemental impact rolls independently for each non-kinetic channel. Unsplit deliveries use the saved chance; split deliveries derive the per-child chance described above. A kinetic primary can carry a secondary status payload. Direct normal-hit numbers remain white and critical hits red; status damage uses the effect's color and floats above the affected enemy, including fractional damage. Fire, corrosion, radiation, and shock tick every half second. Tick amounts are half of their per-second rate. Aimed targets show an active-effect ribbon with the current damage rate (including their active vulnerability/shield modifiers) and remaining time. Item cards show each channel's independent base rate per successful proc, chance, and duration before target modifiers; comparisons match the same element even when its channel order changes. A newly added secondary compares against zero.

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
