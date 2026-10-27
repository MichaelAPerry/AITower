# Reframe: racks retrofit down three trees (spec, for owner approval)

Replaces the commit/bond/starter model in `docs/TREES.md` sections 0, 2.2 and 2.6. Numbers for each item stay as in TREES.md unless stated.

## Why the old model failed (playtest)
- Green scored almost nothing: Green SP was multiplied by the green score (0.7 × green energy share + 0.3 × heat export). On grid power that is near 0, and nothing told the player.
- Non-racks (algae facades) don't score at all; the player filled a tower with them.
- Bio and Green needed research, bond 50 and a commit at Level 3 before scoring. None of it was visible.
- The Lattice scored from every rack, so it always won.
- Bio "starter" racks put wetware in everyone's build menu.

## The rules
1. **Base racks are neutral.** AC-1, AC-3 and IA-1 score for no tree. Storage and tape score nothing (they feed jobs).
2. **Retrofit in place.** Select any rack and choose a branch: Synthetic, Bio or Green. It becomes that tree's next rung rack, on the same tiles, with that tree's sprite. Cost = new rack cost − 50% of the old rack's cost. A tree rack can only be retrofitted further down its own tree; switching trees means retrofitting back from base cost (no refund trick).
3. **Each tree rack scores only its own tree.** No passive Lattice.
4. **Four rungs per tree**, one per Level 2-5. A rung opens with one research node plus the Level gate. Synthetic research is cheapest; Bio and Green cost about 2× the RP.

| Rung (Level) | Synthetic | Bio | Green |
|--|--|--|--|
| R1 (L2) | LC-2 Liquid Rack | OC-1 Organoid Cabinet | NM-1 Neuromorphic Rack |
| R2 (L3) | LC-3 Cold-Plate Rack | OC-2 Organoid Vat Bank | NM-2 Event-Driven Array |
| R3 (L4) | LC-4 Blade Rack | OC-3 Perfused Cortex | PH-1 Photonic Rack |
| R4 (L5) | ML-1 Mind Lattice | OC-4 Neural Vat | PH-2 Photonic Mesh |

   Each rung also unlocks its tree's matching cooling and power from TREES.md (Synthetic: CDU, chillers, gas; Bio: perfusion baths, nutrient plant, bioreactor; Green: economizer, adiabatic, PV, wind, iron-air, geothermal). Bio racks need perfusion cooling; Synthetic liquid racks need a CDU; Green racks run on air.
   Cut from the catalogue: OC-0 Culture Rack, NT-1 Nutrient Tank, IM-2, IM-3, Mel's Cortex, the "early" signature unlocks. The signature support builds (Luci's Rate Card, Bea's microgrid, Cass's ice store and cold room) stay as normal research items.
5. **Scoring.** SP/day = Σ tree-rack PF × 0.0408 × weight × factor.
   - Synthetic: weight 2.5, factor 1.
   - Bio: weight 1.5, factor (1 − bio seal).
   - Green: weight 3.4, factor (0.5 + 0.5 × green score) × (1 − green seal). Green racks earn half speed on any power, full speed on clean power, so it is never stuck at zero.
   First tree to 1000 SP wins.
6. **No commit, no bond gates.** You may build any mix. Bonds only change scenes and the ending epilogue.
7. **Seal stays hidden per item but visible in total.** Each tree's meter shows its seal and a "hurting it" list (top 3 sources). At seal 100 the tree closes: no new retrofits to it, and its racks stop scoring.

## The Trees panel (replaces the gauges' info click, which still shows reputation)
One panel, three columns. Each shows: SP and days-to-win at the current rate, the rung ladder with the next step spelled out ("Next: research Event Array (40 RP), then retrofit racks to NM-2"), the factor ("Clean power 12% → Garden speed ×0.56: add PV or wind"), and the seal meter with its top sources.

## Story
Keep: the intro, one scene when a tree first reaches each rung (12 scenes, the tree's champion speaking, with a clear setup line), objections, endings. Remove: after-hours, texts, gifts, rivalry, confession, milestone scenes, the tree-commit scene and FORM A-5. The ending epilogue goes to the highest bond at 60+.

## Balance targets (competent player, verify with soulRun scripted per tree, seeds 1-3, within 20%)
| Tree | PF-days needed | Target days | Why |
|--|--|--|--|
| Synthetic | ~9,800 | 25 | Cheapest racks and research, no factor |
| Green | ~11,000 at factor ~0.65 | 38 | Low PF per rack, needs clean power for full speed |
| Bio | ~22,000 at seal 0.25 | 40 | High PF per rack but low weight; needs perfusion and nutrient |

Coordinator check: SP/PF-day = 0.0017 × 24 = 0.0408. Synthetic 25 days ≈ 390 PF average of Synthetic racks; Level 3 is 400 PF total, so a player who retrofits most racks by day 8-10 hits it. Green at factor 0.5 (no clean power at all) is about 55 days: slow but never stuck. Tune weights and research costs, not the targets.

## Migration
Snapshot bump: placed OC-0/NT-1/IM-2/IM-3/Mel's Cortex map to the nearest rung (OC-1, removed with refund, LC-4, ML-1, OC-3). `path`/commit state and after-hours/texts/gift/confession state are dropped. Placeholder sprites: each tree's racks are tinted by tree (green, red, blue) until the new sprites are drawn.
