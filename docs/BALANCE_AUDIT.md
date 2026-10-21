# AItower Balance Audit: tech tree, research economy, Level gates, facility value

Scope: analysis only (no code or data changed). Sources: `packages/content/src/data/{tech,facilities,balance,bots,scenarios}.json`, `packages/sim/src/{compute/computeStep,progression/tier,research}`, and `npm run sim -- <scenario> <days> <seed> --auto` (starter, brownfield, sandbox x seeds 1-5, 150 days, throwaway driver in the session scratchpad). Time conversion: 1 tick = 1 game minute, 1 day = 1440 ticks = **144 s real at 1x** (`apps/web/src/loop.ts`). "L" = Level (`minTier`).

## 1. Verdict

- **Not balanced, but not broken: the tree is a research-cost treadmill that the Level gates ignore.** Every Level gate (120/400/1200/3000 installed PF) is reachable with the *free* T1-T2 catalogue (`rack_air_gpu`, `rack_dlc_gpu`, `chiller`, `cdu` need no tech). Nothing in the tree is required to progress; it only gives efficiency.
- **Research income is a pure function of delivered PF (0.1 RP per PF-hour, jobs add only +8 each, about 5%),** so RP/day is roughly 2.4 x PF. That makes cost per node 5-10 real minutes at L2-L3 (healthy) but a flat 17k-22k wall at L4 (5x the L3 cost for a 3x income step) and 30k-44k at L5.
- **Cash stops mattering after L2-L3** (auto runs end with $140M starter / $424M brownfield unspent; payback on a rack is about 1-5 days). So the tree's cash perks (payout +4..6%, upkeep -7..8%, energy -3..8%) are close to worthless late, and 8 of 63 nodes are weak perk-only leaves priced at 18k-34k RP.
- **Air-rack and several "efficiency" unlocks are dominated** by the ungated `rack_dlc_gpu`: `rack_air_gpu2/3`, `rack_infer`, `rack_neuromorphic` and the five techs that gate them (about 20k RP) are never worth building on PF/$, PF/kW-with-cooling or upkeep. The path racks (photonic, neural pit, mind lattice) are also worse in PF/$ than the T4 immersion rack they replace; they win only on PF/kW.
- **Pacing:** first 13-15 days (about 30 real minutes) at L1 is dead air because the auto policy buys the 2,200 RP Foreman at 144 RP/day (a human can skip it and reach L2 on day 1 by buying 2 racks). L3 to L4 and L4 to L5 are the real structural gaps: L4 and L5 each hold 70 days of research at expected income, while the gate itself is just "build more dlc racks".

## 2. Tree map (63 nodes)

Branches: administration 9 nodes/34.5k RP, compute 15/290k, cooling 8/54k, power 15/176k, logistics 7/27k, wetware 9/201k. Per Level: L1 9 nodes/5.0k, L2 10/10.9k, L3 19/69k, L4 11/210k, L5 14/488k (three exclusive paths). `days@L` assumes the RP/day in section 3 for that Level; `min@1x` is real minutes at normal speed.

| id | br | L | RP | requires | unlocks / perk | days@L | min@1x |
|--|--|--|--|--|--|--|--|
| contracts_clerk | adm | 1 | 180 | - | contractsClerk | 1.3 | 3 |
| reading_room | adm | 1 | 330 | contracts_clerk | researchRate+10% | 2.3 | 5 |
| works_foreman | adm | 1 | 2200 | contracts_clerk | foreman | 15.3 | 37 |
| batch_cards | cmp | 1 | 450 | - | payout+3% | 3.1 | 8 |
| desk_fan_standard | cool | 1 | 360 | - | coolingCapacity+5% | 2.5 | 6 |
| pit_crew | log | 1 | 340 | - | repairSpeed+15% | 2.4 | 6 |
| brass_gearing | log | 1 | 390 | pit_crew | botSpeed+10% | 2.7 | 7 |
| surge_memo | pwr | 1 | 300 | - | failureRate-5% | 2.1 | 5 |
| offpeak_petition | pwr | 1 | 420 | - | energyPrice-5% | 2.9 | 7 |
| vendor_stamp | adm | 2 | 1000 | reading_room | payout+5% | 3.6 | 9 |
| ledger_audit | adm | 2 | 1200 | contracts_clerk | upkeep-8% | 4.3 | 10 |
| tape_silo | cmp | 2 | 900 | batch_cards | rack_storage2 | 3.2 | 8 |
| rear_door_drawings | cmp | 2 | 1000 | batch_cards | rack_air_gpu2 | 3.6 | 9 |
| rear_door_exchanger | cool | 2 | 1100 | desk_fan_standard | crah_rear_door | 3.9 | 9 |
| chilled_loop | cool | 2 | 1300 | desk_fan_standard | coolingCapacity+5% | 4.6 | 11 |
| central_stores | log | 2 | 1000 | pit_crew | depot_big | 3.6 | 9 |
| logistics_drone | log | 2 | 1100 | brass_gearing | bot:drone | 3.9 | 9 |
| substation_licence | pwr | 2 | 1100 | offpeak_petition | grid_tie_2 | 3.9 | 9 |
| flywheel_patent | pwr | 2 | 1200 | surge_memo | ups_flywheel | 4.3 | 10 |
| ministry_liaison | adm | 3 | 3400 | vendor_stamp | payout+4% | 3.4 | 8 |
| procurement_committee | adm | 3 | 3600 | ledger_audit | upkeep-7% | 3.6 | 9 |
| standing_orders_binder | adm | 3 | 3600 | works_foreman | botSpeed+8% | 3.6 | 9 |
| hot_aisle | cmp | 3 | 3200 | rear_door_drawings | rack_air_gpu3 | 3.2 | 8 |
| inference_foundry | cmp | 3 | 3800 | hot_aisle | rack_infer | 3.8 | 9 |
| neuromorphic_cards | cmp | 3 | 4000 | batch_cards | rack_neuromorphic | 4.0 | 10 |
| cold_plate_gen3 | cmp | 3 | 4200 | rear_door_drawings+chilled_loop | rack_dlc_gpu2 | 4.2 | 10 |
| high_capacity_air | cool | 3 | 3300 | rear_door_exchanger | crah_hc | 3.3 | 8 |
| tower_hydraulics | cool | 3 | 3800 | chilled_loop | chiller_tower; cdu_big | 3.8 | 9 |
| dielectric_handbook | cool | 3 | 4200 | tower_hydraulics+cold_plate_gen3 | rack_imm_gpu | 4.2 | 10 |
| fast_charge | log | 3 | 3000 | logistics_drone | charger_fast | 3.0 | 7 |
| logistics_lifter | log | 3 | 3500 | brass_gearing+central_stores | bot:lifter | 3.5 | 8 |
| accumulator_charter | pwr | 3 | 3300 | flywheel_patent | ups_bank_big | 3.3 | 8 |
| solar_charter | pwr | 3 | 3400 | substation_licence | solar_skin | 3.4 | 8 |
| algae_licence | pwr | 3 | 3500 | desk_fan_standard | algae_facade | 3.5 | 8 |
| gas_concession | pwr | 3 | 3600 | substation_licence | genset_gas; energyPrice-3% | 3.6 | 9 |
| wind_permit | pwr | 3 | 3600 | substation_licence | wind_mast | 3.6 | 9 |
| district_heat_accord | pwr | 3 | 3800 | chilled_loop | heat_exchanger | 3.8 | 9 |
| wetware_annex | wet | 3 | 4200 | chilled_loop | nutrient_plant; organoid_incubator | 4.2 | 10 |
| grand_concordat | adm | 4 | 19000 | ministry_liaison+procurement_committee | payout+6%,researchRate+5% | 6.3 | 15 |
| manifold_blade | cmp | 4 | 22000 | cold_plate_gen3 | rack_dlc_gpu3 | 7.3 | 18 |
| adiabatic_cooling | cool | 4 | 19000 | tower_hydraulics | chiller_free; coolingCapacity+5% | 6.3 | 15 |
| two_phase_immersion | cool | 4 | 21000 | dielectric_handbook+adiabatic_cooling | rack_imm_gpu2; failureRate-5% | 7.0 | 17 |
| maintenance_corps | log | 4 | 18000 | fast_charge+logistics_lifter | repairSpeed+10%,botSpeed+5% | 6.0 | 14 |
| feeder_treaty | pwr | 4 | 20000 | gas_concession+accumulator_charter | grid_tie_3; energyPrice-5% | 6.7 | 16 |
| sterile_protocols | wet | 4 | 17000 | wetware_annex | sterile_bay | 5.7 | 14 |
| quarantine_doctrine | wet | 4 | 17500 | sterile_protocols | quarantine_lock | 5.8 | 14 |
| dna_archive_charter | wet | 4 | 18000 | wetware_annex | dna_vault | 6.0 | 14 |
| culling_licence | wet | 4 | 18500 | quarantine_doctrine | culling_room | 6.2 | 15 |
| bioreactor_permit | wet | 4 | 20000 | wetware_annex+accumulator_charter | bioreactor | 6.7 | 16 |
| continuity_form | cmp | 5 syn | 30000 | accumulator_charter | continuity_monitor | 4.2 | 10 |
| backup_vault_charter | cmp | 5 syn | 30000 | tape_silo | backup_vault | 4.2 | 10 |
| identity_register | cmp | 5 syn | 34000 | mind_lattice_dossier | payout+6% | 4.7 | 11 |
| continuity_doctrine | cmp | 5 syn | 34000 | continuity_form+backup_vault_charter | failureRate-8% | 4.7 | 11 |
| cryo_core_dossier | cmp | 5 syn | 36000 | adiabatic_cooling | cryo_core | 5.0 | 12 |
| photonic_bench | cmp | 5 gre | 42000 | neuromorphic_cards+canopy_array | rack_photonic | 5.8 | 14 |
| mind_lattice_dossier | cmp | 5 syn | 44000 | cryo_core_dossier+manifold_blade | rack_mind_lattice | 6.1 | 15 |
| green_ledger | pwr | 5 gre | 30000 | carbon_capture_dossier+heat_pipeline_franchise | energyPrice-8% | 4.2 | 10 |
| canopy_array | pwr | 5 gre | 32000 | solar_charter+wind_permit | solar_canopy | 4.4 | 11 |
| carbon_capture_dossier | pwr | 5 gre | 34000 | algae_licence | carbon_capture | 4.7 | 11 |
| heat_pipeline_franchise | pwr | 5 gre | 36000 | district_heat_accord | heat_pipeline | 5.0 | 12 |
| tissue_scaffolds | wet | 5 bio | 30000 | neural_pit_dossier | failureRate-7% | 4.2 | 10 |
| asset_register | wet | 5 bio | 34000 | neural_pit_dossier | payout+6% | 4.7 | 11 |
| neural_pit_dossier | wet | 5 bio | 42000 | dna_archive_charter+quarantine_doctrine | neural_pit | 5.8 | 14 |

Structure facts (from the graph): 0 nodes unlock nothing and have no effect; 8 are perk-only leaves (`grand_concordat`, `maintenance_corps`, `standing_orders_binder`, `green_ledger`, `tissue_scaffolds`, `asset_register`, `identity_register`, `continuity_doctrine`); 12 edges skip a Level (e.g. `brass_gearing` L1 to `logistics_lifter` L3, `solar_charter` L3 to `canopy_array` L5) which is harmless but means cooling, logistics, administration have **no L5 content**: all 488k RP at L5 is path-exclusive. Facility tier and tech `minTier` agree for every facility (no mismatches); `rack_dlc_gpu`, `chiller`, `cdu` (L2) carry no tech at all.

## 3. Research economy: cost vs income

Income model: `RP/day = delivered PF x 24 x 0.1 x researchRate perk + 8 per completed job` (jobs are about 30 RP/day at L1, under 10% later). Checked against auto runs: starter d3-d4 +188 RP at 54-78 PF; brownfield L4 about 3,000-3,300 RP/day at 1,000-1,500 PF.

| Level | Gate (installed PF / uptime / reward) | Assumed delivered PF | RP/day | Nodes | Sum RP | Node cost min-max | Avg days/node | Whole-Level days (real min) |
|--|--|--|--|--|--|--|--|--|
| 1 | 0 | 60 | 144 | 9 | 4,970 | 180-2,200 | 3.8 | 35 (83) |
| 2 | 120 / 93% / $1.25M | 110 | 280 | 10 | 10,900 | 900-1,300 | 3.9 | 39 (93) |
| 3 | 400 / 95% / $3.75M | 420 | 1,000 | 19 | 69,000 | 3,000-4,200 | 3.6 | 69 (166) |
| 4 | 1,200 / 96% / $10M | 1,200 | 3,000 | 11 | 210,000 | 17,000-22,000 | 6.4 | 70 (168) |
| 5 | 3,000 / 97% / $25M | 3,000 | 7,200 | 14 (1 path: 3-6) | 488,000 (path: 106k-208k) | 30,000-44,000 | 4.8 | 68 all / 15-29 one path |

Reading it: mean node cost steps per Level are x2.0, x3.5, x5.4, x1.7 versus income steps of x1.9, x3.6, x3.0, x2.4. L4 is the outlier (cost jumps 5.4x for 3x income), so the mean node takes 6.4 days (about 15 real minutes) versus 3.6-4.8 elsewhere. Per-node days/real minutes are in the tree table above. Total RP for the whole tree is 783k.

Measured in `--auto` runs (150 days, seeds 1-5; the auto policy buys Foreman first, then cheapest-first):

| Scenario | L2 | L3 | L4 | L5 | Techs by day (10 / 20 / 30 / 40) | End state |
|--|--|--|--|--|--|--|
| starter | d13-15 (31-36 min) | d18-21 | never | never | d19-22 / d31-34 / d60-71 / never | 38 techs max (every L<=3 node bought), 47k-66k RP unspent, $26-155M cash; seed 4 bankrupt d51 |
| brownfield (starts L2) | start | d23-28 | d34-42 | never | d18-20 / d32-38 / d46-62 / d73-95 | seeds 2, 4, 5 bankrupt d49-55; seed 1 $424M |
| sandbox (starts L5, about 740 PF) | start | start | start | start | d5-6 / d14-17 / d33-45 / d69-81 | 46-48 of 63 nodes; L5 nodes take 17-24 days each at 740 PF |

Caveats: the auto player is a weak, fixed strategy (builds about 37-63 facilities, delivered PF 300-580 at L3, never builds the 1,200 PF needed for L4 in the starter), so these are lower bounds on pace. Cadence in real time: about one unlock per 5-10 min through L3 (10 techs by about 45-55 min), which fits the 10-20 min convention; L4 nodes are 15+ min each.

Dead air and "nothing to choose":
- **L1 dead air (about 30 min).** Foreman 2,200 RP at 144 RP/day = 15 days = 36 min with nothing else worth buying (clerk 180 and library 330 are done by day 4). A human can instead buy 2 racks and be L2 on day 1, so the real problem is that the first node that matters costs 15 days of income.
- **L4 wall.** 11 nodes, only 4-5 meaningful (manifold_blade, two_phase_immersion, adiabatic_cooling, feeder_treaty, the wetware spine), each 15 min.
- **Choice count.** L1 opens 6 roots at once (clerk, batch_cards, desk_fan, surge_memo, offpeak, pit_crew): fine. L3 has up to about 14 open nodes of 19, far more than 2-4 meaningful choices, and about 40% of them unlock only dominated hardware (section 5). At L4 entry only about 5-6 are open.
- **Cash is not a constraint after about L3.** Racks pay back in 1-5 days (revenue about $4k per PF-day against $25-75 upkeep and $140-510 energy per PF-day). So payout/upkeep perks lose value and tier rewards ($10M, $25M) are noise next to $100M+ piles.

## 4. Level gates vs what the tree allows

Tier n needs *installed* PF >= `tiers.pflops[n-1]` and rolling uptime >= target, checked at midnight (`progression/tier.ts`).

| Level | Gate | Cheapest route using only free (untechnologied) catalogue | Tech needed? | Observed (auto) |
|--|--|--|--|--|
| 2 | 120 PF (starter has 80) | +2 `rack_air_gpu` ($0.8M) | no | d13-15, but only because Foreman research was first; trivially day 1 for a human |
| 3 | 400 PF | 3x `rack_dlc_gpu` (390 PF, $4.2M) + chiller + cdu ($1.5M) | no | d18-28 |
| 4 | 1,200 PF | 10x `rack_dlc_gpu` ($14M, 1.2 MW + cooling; stack `grid_tie` at $167/kW) | no | d34-42 brownfield; never in starter (150 d) |
| 5 | 3,000 PF | 6x `rack_dlc_gpu3` or `rack_imm_gpu2` ($24-29M) with L4 tech, or 24 dlc ($34M, 2.9 MW) without | no | not reached in any auto run |

Conclusion: every Level is reachable without a single tech node beyond the clerk; the tree is entirely optional. Reward scaling (x3 per Level, gate PF x3) is consistent. Uptime targets (93-97%) held in all runs (97-99%), so uptime is not binding. The binding constraint in practice is how fast the player builds, not research. L4 risk from runs: at L4 the penalty line spikes ($1.5-4.4M/day with 10-19 component failures/day on a permissive clerk) and 4 of 10 starter/brownfield runs went bankrupt around d49-55 (cash $10.6M on d38 to -$3.2M on d48 in brownfield seed 2). That is auto-policy behaviour (`PERMISSIVE_CLERK`, `slaPenaltyFactor` 1.5) but shows a cash cliff at the L3 to L4 transition worth a separate look.

## 5. Facility value

Energy cost per PF-day is about 255 x kW/PF (price 7.5, PUE about 1.35, hourly mean about 1.05); revenue is about $4k per PF-day.

Racks (cost incl. no cooling; PF/M$ = capex only; PF/M$ in parentheses includes 30 days of upkeep):

| Rack | L | Tech | Cost | PF | kW | PF/M$ | kW/PF | Energy $/PF-day | Verdict |
|--|--|--|--|--|--|--|--|--|--|
| rack_air_gpu | 1 | - | 0.40M | 20 | 40 | 50 (45) | 2.0 | 510 | Bootstrap only |
| rack_air_gpu2 | 2 | rear_door_drawings 1,000 | 0.60M | 32 | 55 | 53 (49) | 1.72 | 438 | **Dominated** by free dlc |
| rack_dlc_gpu | 2 | none | 1.40M | 130 | 120 | 93 (86) | 0.92 | 235 | **Must-build, ungated** |
| rack_air_gpu3 | 3 | hot_aisle 3,200 | 0.88M | 52 | 70 | 59 (54) | 1.35 | 344 | **Dominated** |
| rack_infer | 3 | inference_foundry 3,800 | 1.30M | 54 | 36 | 42 (38) | 1.5 PF/kW | 171 | **Dominated** (no special mechanic) |
| rack_neuromorphic | 3 | neuromorphic_cards 4,000 | 0.75M | 22 | 12 | 29 (26) | 1.83 | 139 | **Dominated**; also forced prereq of photonic |
| rack_dlc_gpu2 | 3 | cold_plate_gen3 4,200 | 2.15M | 230 | 160 | 107 (99) | 0.70 | 177 | Must-build |
| rack_imm_gpu | 3 | dielectric_handbook 4,200 | 3.10M | 300 | 180 | 97 (90) | 0.60 | 153 | Competitive (failure 0.15) |
| rack_dlc_gpu3 | 4 | manifold_blade 22,000 | 4.00M | 420 | 240 | 105 (97) | 0.57 | 146 | Must-build |
| rack_imm_gpu2 | 4 | two_phase_immersion 21,000 | 4.80M | 560 | 300 | 117 (109) | 0.54 | 137 | Best L4, small edge |
| organoid_incubator (bio) | 3 | wetware_annex 4,200 | 2.40M | 135 | 24 | 56 (53) | 0.18 | 45 | Niche (needsBio jobs, contamination) |
| neural_pit (biotech) | 5 | 42k + 30k/34k perks | 7.5M | 460 | 80 | 61 (58) | 0.17 | 44 | Below imm2 on $, wins on kW |
| rack_photonic (green) | 5 | photonic_bench 42,000 | 6.5M | 330 | 40 | 51 (49) | 0.12 | 31 | Below imm2 on $, no plumbing |
| rack_mind_lattice (synth) | 5 | mind_lattice_dossier 44,000 | 8.5M | 640 | 220 | 75 (72) | 0.34 | 88 | Worst PF/$ in game; gate for Refinement |

Findings: after L2 the dlc/immersion line (93-117 PF/M$) beats every air rack (29-59) on PF/$ and kW, and the plumbing overhead (chiller $1,833/kW, cdu $1,000/kW, adding about $0.3M per dlc rack) does not change the ranking (about 77 vs 47 PF/M$). So **rack_air_gpu2, rack_air_gpu3, rack_infer, rack_neuromorphic are never worth building**, and the techs that exist only to unlock them (`rear_door_drawings` partly, `hot_aisle` 3,200, `inference_foundry` 3,800, `neuromorphic_cards` 4,000) waste about 11k RP. The three L5 path racks cost more per PF than the free-for-all L4 rack, so the path rewards are not competitive on throughput; they are justified only through ending conditions (`greenExemplar`/`millionMinds` need 3,000-3,600 PF) and PF/kW.

Cooling ($/kW of capacity; self-draw as kW): `crah_unit` $667 (draws 40 kW), `crah_rear_door` $656 (36 kW, radius 5), `crah_hc` $686 (700 kW, 75 kW): rear_door and hc are marginal upgrades over crah_unit and the whole air-handler chain (`desk_fan_standard`, `rear_door_exchanger`, `high_capacity_air` = 4.8k RP) only serves dominated air racks. Liquid: `cdu` $1,000 then `cdu_big` $813 (dominates cdu at scale); `chiller` $1,833 then `chiller_tower` $1,458 (dominates) then `chiller_free` $1,440 (COP 11) then `cryo_core` $1,733 (COP 16, synthetic). `chiller_free` and `cdu_big`/`chiller_tower` are must-builds; `crah_rear_door`, `cdu`, `chiller` become dominated once the L3 versions exist.
Power: `grid_tie` $167/kW (L1), `grid_tie_2` $149/kW, `grid_tie_3` $167/kW: the tiers add little over stacking `grid_tie`, so `substation_licence` is a gateway node (to gas/solar/wind) rather than a value unlock. `ups_flywheel` ($325/kW, 60 kWh) dominates `ups_battery` ($600/kW) on power but not on energy. `genset_gas` ($533/kW, $18/kWh) vs `genset` ($438/kW, $25/kWh) is a fair trade. Green generation is not economic: solar $3,000/kW, wind $4,167/kW, algae about 75-day payback, carbon capture about 60-day, vs rack payback 1-5 days; it is worth building only for Green Score and the ending, which is fine only if the player is told.

## 6. Problems ranked by impact

1. **The tree does not gate anything that matters (high).** All Level gates are reachable with free T1/T2 gear; `rack_dlc_gpu`, `chiller`, `cdu` need no tech; Level never asks for research. Evidence: section 4. Effect: players can ignore the tree; research is a second-order optimiser.
2. **Dominated hardware and dead-end nodes (high).** 4 racks and about 11k RP of L2-L3 compute/cooling nodes unlock options no rational player picks (section 5), padding the L3 menu to 19 nodes while the meaningful choices are about 6. `hot_aisle` only gates `inference_foundry`; `neuromorphic_cards` is a forced prereq of the green path's `photonic_bench`.
3. **L4 research wall and uneven pace (high).** Node cost steps x5.4 at L4 against income x3 (6.4 d/node vs 3.6-4.8); whole-L4 is 70 days (168 real min) for 11 nodes, and the L4 menu has only about 5-6 open nodes at entry. Combined with problem 1, L4 is when the tree should hurt least and hurts most.
4. **Cash perks are obsolete when they unlock (medium-high).** 8 perk-only leaves cost 18k-34k RP each for +4-8% payout/upkeep/energy or -5-8% failures; auto runs hold $100M+ unspent from about d40. Payout perks (`vendor_stamp`, `ministry_liaison`, `grand_concordat`, `asset_register`, `identity_register`: total x1.30) are worth the least exactly where they cost the most.
5. **L1 dead air (medium).** Foreman 2,200 RP at 144 RP/day is 15 days / 36 real minutes; whole L1 is 35 days. `pointsPerJob` 8 (about 30 RP/day) barely helps and `researchRate` perks are only +10% and +5%.
6. **Path asymmetry (medium).** One-path cost incl. mandatory prereqs: biotech about 163k (3 L5 nodes, 1 facility), greentech about 190k (5 nodes, 4 facilities), synthetic about 270k (6 nodes, 4 facilities + adiabatic/manifold prereqs). Biotech has the shortest and thinnest path but the heaviest L4 gate (wetware spine 57k of 91k) and no L1-L2 entry. Path racks are the weakest PF/$ in the game; biotech's `neural_pit` has failure 0.35/day (highest) and the other two path racks are also worse than `rack_imm_gpu2`.
7. **Branch shape (medium).** Wetware: no L1/L2 nodes, single L3 gateway (4.2k) hanging off cooling (`chilled_loop`) and `accumulator_charter` (power) cross-links, then five L4 nodes (91k) of which `culling_licence` and `bioreactor_permit` are optional leaves. Compute: 7 of 15 nodes are L5 path nodes. Cooling, logistics, administration end at L4 with a perk-only or single leaf; power has 6 L3 nodes (4 green-only). Branch RP sizes: compute 290k, wetware 201k, power 176k, cooling 54k, admin 35k, logistics 27k.
8. **Level-4 cash cliff in auto runs (medium, outside tree).** 4/10 starter+brownfield runs bankrupt d49-55 from SLA penalties of $1.5-4.4M/day; needs separate investigation (clerk policy, penalty factor).

## 7. Proposed rebalance

### 7a. Safe tuning pass (data-only, no new nodes; keeps saves valid)

| File / key | Now | Proposed | Reason |
|--|--|--|--|
| `balance.research.pointsPerJob` | 8 | 25 | more RP at L1-L2 where PF is low (about +70 RP/day at 3-4 jobs/day) |
| `tech works_foreman` cost | 2,200 | 1,200 | L1 dead air 15 d to about 5 d |
| `tech` L4 costs (x0.7, rounded) | 17,000-22,000 | sterile 12k, quarantine 12.5k, culling 13k, dna_archive 13k, bioreactor 14k, adiabatic 13k, manifold_blade 15k, two_phase 15k, feeder_treaty 14k, maintenance_corps 10k, grand_concordat 12k | removes L4 wall (avg node 6.4 d to about 4.4 d) |
| `tech` perk-only L5 leaves | 30-34k | tissue_scaffolds 20k, asset_register 22k, green_ledger 22k, identity_register 22k, continuity_doctrine 24k | perk value is low |
| `asset_register`, `identity_register` effect | payout x1.06 | researchRate x1.10 | cash is surplus; RP is the scarce currency |
| `grand_concordat` effect | payout 1.06 + research 1.05 | payout 1.04 + research 1.15 | same reason |
| `rack_air_gpu2` | 32 PF, $0.60M | 42 PF, $0.55M (76 PF/M$) | stay a no-plumbing alternative |
| `rack_air_gpu3` | 52 PF, $0.88M | 80 PF, $0.90M (89 PF/M$) | same |
| `rack_infer` | 54 PF, $1.30M | 95 PF, $1.10M (86 PF/M$, 0.38 kW/PF) | make the kW-efficiency niche real |
| `rack_neuromorphic` | 22 PF, $0.75M | 50 PF, $0.80M (62 PF/M$, 0.24 kW/PF) | same |
| `tech inference_foundry` | 3,800 | 3,200 | now a real choice |
| `tech` L3 cheap fillers (`hot_aisle`, `neuromorphic_cards`) | 3,200 / 4,000 | 2,600 / 3,200 | keep alive as side options |
| Path racks | photonic 330 PF/$6.5M; neural_pit 460/$7.5M; lattice 640/$8.5M | photonic 480 PF/$6.5M (74 PF/M$), neural_pit 560 PF/$7.0M (80), lattice 700 PF/$8.0M (88) | bring path racks to about 75-90 PF/M$ so they are a reward, not a tax |
| `balance.tiers.reward` | 1.25 / 3.75 / 10 / 25M | keep | consistent |

Expected effect: L1 node pace unchanged for cheap nodes but Foreman at about 5 days; L4 average 4.4 days (about 10.5 real min); air racks restored to 75-90 PF/M$ at a differentiated kW/PF/plumbing trade-off.

### 7b. Tree restructure pass (needs new/edited nodes; one code change)

1. **Make the tree gate progression.** Re-parent `rack_dlc_gpu`, `cdu`, `chiller` to `chilled_loop` (L2, 1,300 RP; now only +5% cooling). Add `tiers.techs = [0, 2, 6, 14, 26]` (minimum researched nodes per Level) checked in `progression/tier.ts` alongside PF and uptime, so Level and tree rise together.
2. **Prune the dead end.** Delete `rack_air_gpu3` and `hot_aisle` as a rack-unlock (turn `hot_aisle` into a perk node: `coolingCapacity` x1.05, 2,600 RP, keep the id so existing saves resolve). Merge `neuromorphic_cards` into `inference_foundry` (one L3 "specialist cards" node unlocking both `rack_infer` and `rack_neuromorphic`); re-parent `photonic_bench` to `canopy_array + inference_foundry`.
3. **Add L5 shared (non-path) nodes so L5 has choices before commitment:** `grid_autonomy` (power, L5, 28k, `grid_tie_4` 20 MW), `immersion_vault` (cooling, L5, 30k, `rack_imm_gpu3` about 800 PF/$6.5M), `authority_charter` (administration, L5, 26k, researchRate x1.2). Three new nodes spread across cooling/power/admin which currently stop at L4.
4. **Balance the paths at about 5 nodes, 150-180k each:** biotech add `organoid_vats` (L5, 36k, `rack_organoid_2` about 300 PF/45 kW) and `synaptic_mesh` (L5, 32k, perk failureRate x0.9); synthetic drop `identity_register` into `mind_lattice_dossier` (merge payout perk away) and cut `continuity_doctrine` to 24k; keep greentech at 5. Result: 5/5/5 nodes, about 165k/175k/195k excluding shared prereqs.
5. **Fix wetware shape:** add L2 `culture_media` (cooling-adjacent, 900 RP, requires `desk_fan_standard`) and make `wetware_annex` require it instead of `chilled_loop`; move `bioreactor_permit`'s prereq from `accumulator_charter` (power) to `nutrient`/`sterile_protocols` so wetware is self-contained.
6. **Logistics/admin L4-L5 content:** convert `standing_orders_binder` from L3 perk-only leaf into a bridge: require `works_foreman`, grant the second Foreman standing order (e.g. cooling auto-build), so it has automation value; add `fleet_command` (logistics, L4, 12k) unlocking a tier-3 bot.
7. **Post-restructure target cadence** (at the section 3 income): L1 about 4 d/node, L2 about 4 d, L3 about 3.5 d, L4 about 4.4 d, L5 about 4.5 d, with 5-8 meaningful open nodes at every Level and a unlock roughly every 8-12 real minutes.

Validation to run after either pass: `npm run sim -- starter|brownfield|sandbox 150 1..5 --auto` (compare section 3 table: L3/L4 day, techs-by-day, bankruptcies), plus the existing `research.test.ts`, `determinism.test.ts`, `snapshot.test.ts` (content changes alter hashes). A manual run is needed to verify L5 pacing since the auto player never reaches 3,000 PF.
