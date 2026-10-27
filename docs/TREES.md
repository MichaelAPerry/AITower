# AI Tower: the three catalogues (design spec, for owner approval)

Status: implemented (snapshot v13). Section 5.2 records the final numbers and the deviations from this spec. Numbers are on the scale of `facilities.json` today (cost in $, kW, PFLOPS, width in tiles). Where this spec changes an existing number it says so.

## 0. Rules this spec sets

| Rule | Meaning |
|--|--|
| **Four groups** | **Shared** (everyone, Levels 1-3), **Starter** (Green and Bio "feet wet" items, anyone), **Specialist** (the full Bio and Green lines, commit only), **Synthetic** (open from Level 2 to anyone on the Synthetic path, which is the default). |
| **Own line each** | Each tree has its own compute chain, cooling chain and power chain. A tree item can only be placed while the player is on that path (Synthetic is the default path). Committing to Bio or Green closes the *new* placement of the other lines; what is already built keeps running and keeps scoring. |
| **Upgrade down the tree** | New field `upgradesFrom`. Placing a rack or plant on top of the item it upgrades from swaps it in place and costs `new cost - 50% of old cost`. Same tile if width allows (width +1 needs a free tile beside it; otherwise demolish and rebuild at the normal 50% refund). Rack chains never skip Levels; support items may. |
| **Line weight** | Only racks score SP. Weight is per line, from `balance.soul.spWeights`: Synthetic line 2, Bio line 1.5, Green line 2.5 times green score, shared racks 1 to Synthetic (0.5 to Green once committed). Starter racks: 1 to Synthetic, and 0.5 to their own tree after commit. Non-rack items show "-". |
| **Seal** | Shown as Bio / Green. Positive scars and leaves residue, negative cleans (SOUL.md 2.1). |
| **Balance rule** | Support (power + cooling) capex is 8-25% of rack capex in every tree. Cooling costs $1.0-1.8k per kW of capacity, grid power $170/kW. No tree gets more PF per tile without paying in heat, water, weather or care. Each rack tier opens at the same Level as the cooling and power tier it needs. |
| **Reading the tables** | `Draw/Out`: kW drawn (-) or produced (+). `Heat/Cap`: for racks the heat to remove (= draw); for cooling the capacity removed. `W`: width in tiles. |

## 1. Audit

### 1.1 Facilities (58)

Verdicts: **K** kept, **R** reworked into a tree (stats or line changed), **C** cut.

| id | Verdict | Reason |
|--|--|--|
| rack_air_gpu (AC-1) | K Shared | Bootstrap rack; real H100 air racks top out near 40 kW. |
| rack_air_gpu2 (AC-3) | K Shared | Rear-door step; conversion source for the trees. |
| rack_air_gpu3 (AC-4) | C | Already retired; dominated. |
| rack_infer (IA-1) | K Shared | The air ceiling; no plumbing, for players who stay light. |
| rack_storage, rack_storage2 | K Shared | Every tree needs storage. |
| crah_unit, crah_rear_door, crah_hc | K Shared | Air handlers (AH-150/320/700). |
| grid_tie, grid_tie_2, grid_tie_3 | K Shared | Grid is the universal, dirty fallback. 9 MW moves from Synthetic to Shared. |
| genset (diesel) | K Shared | The classic seal trap (Green 20). |
| ups_battery, ups_flywheel, ups_bank_big | K Shared | Bridge power; the Battery Hall is Green's first storage. |
| parts_depot, depot_big, bot_charger, charger_fast | K Shared | Logistics, no tree. |
| chiller (CH-600), cdu | R Synthetic | Plumbing is the Synthetic cooling chain; Bio and Green do not need it. |
| rack_dlc_gpu (LC-2) | R Synthetic | Start of the Lattice chain (was shared). |
| rack_dlc_gpu2 (LC-3), rack_dlc_gpu3 (LC-4) | K Synthetic | Chain steps 2 and 3. |
| rack_imm_gpu (IM-1) | C | Overlapped LC-4 and IM-2 on PF; chain is cleaner without it. |
| rack_imm_gpu2 (IM-2), rack_imm_gpu3 (IM-3) | K Synthetic | Immersion steps; PFAS fluids give heavy seal. |
| rack_mind_lattice (ML-1) | R Synthetic | Real end of the chain (1400 PF; was 700, below IM-3). |
| chiller_tower, cdu_big | K Synthetic | Step 2 of the Synthetic cooling chain. |
| cryo_core (CC-3000) | K Synthetic | Step 3; moves from L5 to L4. |
| genset_gas | R Synthetic | Gas is how Synthetic buys power fast. |
| grid_tie_4 (20 MW) | K Synthetic | End of the grid chain. |
| continuity_monitor, backup_vault | K Synthetic | Resilience specials. |
| chiller_free (CH-5000) | R Green | Adiabatic belongs to Green; COP 11 to 14. |
| solar_skin | R Green + Starter | Start of the Green power chain. |
| wind_mast | R Green | Specialist. |
| solar_canopy | R Green | Specialist; L5 to L4, roof only. |
| heat_exchanger | R Green + Starter | Heat reuse is a core real Green idea. |
| heat_pipeline | K Green | District heating end item. |
| algae_facade, carbon_capture | K Green | Credit producers, Specialist. |
| rack_neuromorphic (NM-1) | R Starter | First Green rack, buildable by anyone. |
| rack_photonic (PH-1) | R Green | After NM-2 in the chain (300 PF, was 480). |
| organoid_incubator (OC-1) | R Bio | Specialist entry; upgrades from new Starter OC-0. |
| rack_organoid_2 (OC-2), neural_pit (OC-4) | R Bio | Chain steps; new OC-3 fills the gap. |
| nutrient_plant | R Bio | Specialist (it is open to everyone today: the Wetware complaint). |
| sterile_bay, culling_room, quarantine_lock | K Bio | Care buildings. |
| bioreactor | R Bio | Start of the Bio power chain. |
| dna_vault | K Bio | Bio storage special. |
| growth_mass, growth_cyst, growth_lobe | K Bio | Runtime outbreaks, never buildable. |

### 1.2 Tech nodes (68)

| id | Verdict | Reason |
|--|--|--|
| contracts_clerk, reading_room, works_foreman | K | Core automation, no tree. |
| vendor_stamp, ledger_audit | K | Small early cash perks, fine at Level 2. |
| ministry_liaison, procurement_committee | C | Cash-only perks, worthless after Level 3 (BALANCE_AUDIT); Authority flavour was for standing. |
| grand_concordat | R | Becomes "Open Door": +1 bond when you take advice. |
| authority_charter | R | Renamed Research Charter, keeps +20% RP. |
| standing_orders_binder | K | Foreman pace. |
| batch_cards, rear_door_drawings, tape_silo | K | Shared early compute. |
| hot_aisle | C | Only unlocked the retired AC-4; its +5% cooling folds into rear_door_exchanger. |
| cold_plate_gen3, manifold_blade | K | Synthetic LC-3, LC-4. |
| inference_foundry | K | Gates IA-1 and Starter NM-1. |
| desk_fan_standard, rear_door_exchanger, high_capacity_air | K | Shared air cooling. |
| chilled_loop | R | Gates the Synthetic start (LC-2, CH-600, CDU). |
| tower_hydraulics | K | Synthetic CH-2400 and row CDU. |
| dielectric_handbook | C | Gated IM-1, now cut. |
| adiabatic_cooling | R | Becomes Green Specialist; Synthetic no longer needs it. |
| two_phase_immersion | R | Prereqs become manifold_blade + tower_hydraulics. |
| immersion_vault | K | IM-3. |
| surge_memo, offpeak_petition, substation_licence, flywheel_patent, accumulator_charter | K | Shared power. |
| gas_concession | R | Now Synthetic power. |
| feeder_treaty | K | Grid 9 MW, shared. |
| grid_autonomy | K | Synthetic grid 20 MW. |
| pit_crew, brass_gearing, logistics_drone, central_stores, fast_charge, logistics_lifter, maintenance_corps, fleet_command | K | Logistics is orthogonal to trees. |
| culture_media | K | Gate for the Starter Bio rack. |
| wetware_annex | R | Now the first Bio Specialist node (commit only); no longer open to all. |
| sterile_protocols, quarantine_doctrine, culling_licence, dna_archive_charter, bioreactor_permit | K | Bio Specialist, commit only. |
| tissue_scaffolds | R | Now unlocks OC-3. |
| organoid_vats | R | Unlocks OC-2; L5 to L4, 36k to 18k RP (it was a wall). |
| neural_pit_dossier | K | OC-4. |
| asset_register, synaptic_mesh | K | Bio perks (RP, failure). |
| solar_charter, district_heat_accord | R | Now Starter Green. |
| wind_permit, algae_licence, canopy_array, heat_pipeline_franchise, carbon_capture_dossier | K | Green Specialist. |
| green_ledger | K | Green perk. |
| photonic_bench | R | Moves to the Green lane; PH-1. |
| cryo_core_dossier | R | Prereq becomes tower_hydraulics + manifold_blade (not adiabatic). |
| continuity_form, backup_vault_charter, mind_lattice_dossier, continuity_doctrine | K | Synthetic specials and end. |

**New nodes** (RP, Level): Starter Bio `culture_bench` (2.4k, L3). Bio Specialist `perfusion_baths` (6k, L3), `nutrient_works` (12k, L4), `perfusion_manifold` (14k, L4), `vascular_plant` (28k, L5), `biogas_digester` (30k, L5). Starter Green `economizer` (2.2k, L3). Green Specialist `event_array` (12k, L4), `hydrogen_cell` (14k, L4), `iron_air_charter` (28k, L5), `geothermal_charter` (30k, L5), `photonic_mesh` (40k, L5). Synthetic `combined_cycle` (24k, L5), `cryo_plant` (30k, L5), `reactor_licence` (40k, L5).

## 2. The lines

Upgrade cost is always `new cost - 50% old cost`. Failure rates and bio fields of existing items stay as in the data unless stated.

### 2.1 Shared (everyone; Grid 9 MW opens at Level 4)

| Item (id) | Grounding | Cost | Draw/Out kW | Heat/Cap kW | PF | W | Upgrades from | SP | Seal B/G |
|--|--|--|--|--|--|--|--|--|--|
| AC-1 Air Rack (rack_air_gpu) | H100-era air rack, about 40 kW | 0.40M | -40 | 40 | 20 | 2 | - | Syn 1 | 0/1 |
| AC-3 Rear-Door Rack (rack_air_gpu2) | Rear-door heat exchanger cabinet | 0.55M | -55 | 55 | 42 | 2 | AC-1 | Syn 1 | 0/1 |
| IA-1 Inference Accelerator (rack_infer) | Inference ASIC rack | 1.10M | -36 | 36 | 95 | 2 | AC-3 | Syn 1 | 0/1 |
| SA-1 Storage / TL-8000 Tape | Disk shelf, tape silo | 0.15M / 0.52M | -12 / -30 | 12 / 30 | 0 (2 / 8 PB) | 2 / 3 | SA-1 to TL-8000 | - | 0/0, 0/1 |
| AH-150 / AH-320 / AH-700 | CRAH, row cooler, high-capacity CRAH | 0.12 / 0.21 / 0.48M | -40 / -36 / -75 | 180 / 320 / 700 | - | 2 / 2 / 4 | chain | - | 0/2, 0/2, 0/3 |
| Grid 1.5 / 3.5 / 9 MW | Utility feeder, substation | 0.25 / 0.52 / 1.5M | +1,500 / 3,500 / 9,000 | - | - | 4 / 5 / 8 | chain | - | 0/8, 0/8, 0/10 |
| Diesel Genset 800 kW | Backup diesel, the standard | 0.35M | +800 | - | - | 4 | - | - | 6/20 |
| Battery Bank 250 kWh / Flywheel 60 kWh / Battery Hall 2.4 MWh | Li-ion UPS, flywheel UPS | 0.30 / 0.65 / 1.40M | +500 / +2,000 / +2,000 | - | - | 3 / 3 / 5 | chain | - | 3/5, 0/0, 2/6 |
| Parts Depot, Warehouse, Dock, Fast Bay | Spares and bots | as now | as now | - | - | as now | - | - | 0/0 |

### 2.2 Starter tier: "get your feet wet" (anyone, stays on Synthetic)

Unlock: **research only**. No commit, no bond. Starters are separate buildings marked "Starter" on their cards. They are small and low-yield on purpose: they let a Synthetic player learn the shape of Bio and Green, move a seal, and earn a first bond point. They are also the upgrade source of the Specialist lines. The full lines (2.4, 2.5) are never unlocked by research alone.

| Item (id) | Unlock | Grounding | Cost | Draw/Out kW | Heat/Cap kW | PF | W | SP | Seal B/G |
|--|--|--|--|--|--|--|--|--|--|
| **OC-0 Culture Rack** (rack_culture_s, new) | `culture_media` (L2) + `culture_bench` (L3) | Lab cell-culture incubator | 0.90M | -8 | 8 | 40 | 2 | Syn 1; Bio 0.5 after commit | 0/+1 |
| **NT-1 Nutrient Tank** (nutrient_tank_s, new) | `culture_bench` | Bench bioreactor media feed (nutrient 6, feeds 2 OC-0) | 0.25M | -2 | - | - | 1 | - | 0/+1 |
| **NM-1 Neuromorphic Rack** (rack_neuromorphic) | `inference_foundry` (L3) | Loihi-style spiking chips, very low power | 0.80M | -12 | 12 | 50 | 2 | Syn 1; Green 0.5 after commit | -1/-2 |
| **PV Wall Panels 150 kW** (solar_skin) | `solar_charter` (L3) | Facade photovoltaics | 0.45M | +150 | - | - | 4 | - | -1/-6 |
| **OA-400 Outside-Air Economizer** (crah_econ, new) | `economizer` (L3) | Free-air cooling, allowed by ASHRAE when outside air is cool | 0.35M | -6 | 400 (full at 18 C or less, 40% at 27 C) | - | 3 | - | 0/-2 |
| **Heat Recovery Unit 400 kW** (heat_exchanger) | `district_heat_accord` (L3) | Waste heat sold as hot water | 0.95M | -25 | exports 400 | - | 3 | - | 0/-3 |

What a Starter costs in seal:

| Set | Bio seal | Green seal | Bond |
|--|--|--|--|
| Bio starters (OC-0 + NT-1) | 0 (dabbling never closes the tree you are trying) | +2 | Mel +1 once |
| Green starters (NM-1, PV Wall, OA-400, HRU) | -1 (cleans) | **no scar**; cleans up to 13 residue | Bea +1 once |

Starters never scar their own tree (coordinator fix: a Bio starter that scarred Bio punished the player for trying Bio). Bio starters scar Green a little. Green starters are safe but weak (a Starter Green rack is 50 PF and the weather decides the rest).

### 2.3 Synthetic: The Lattice

Unlock: **research only** (it is the default path). Easiest and densest. Dirty: every step scars both other trees, immersion fluids and cryo plants most. Constraint: heat and power grow faster than anything else.

**Compute chain** (SP weight Synthetic 2)

| Item (id) | Level / tech | Grounding | Cost | Draw kW | Heat kW | PF | W | Upgrades from | Seal B/G |
|--|--|--|--|--|--|--|--|--|--|
| LC-2 Liquid Rack (rack_dlc_gpu) | L2 chilled_loop | GB200 NVL72, about 120 kW, cold plates | 1.40M | -120 | 120 | 130 | 2 | AC-3 (Shared) | 2/2 |
| LC-3 Cold-Plate Rack (rack_dlc_gpu2) | L3 cold_plate_gen3 | Next-gen cold plate | 2.15M | -160 | 160 | 230 | 2 | LC-2 | 6/3 |
| LC-4 Blade Rack (rack_dlc_gpu3) | L4 manifold_blade | Manifold blade | 4.00M | -240 | 240 | 420 | 2 | LC-3 | 8/4 |
| IM-2 Two-Phase Tank (rack_imm_gpu2) | L4 two_phase_immersion | Sealed boiling-fluorocarbon tanks (PFAS fluids) | 4.80M | -300 | 300 | 560 | 3 | LC-4 | 16/14 |
| IM-3 Vault Immersion Tank (rack_imm_gpu3) | L5 immersion_vault | Densest tank | 6.50M | -380 | 380 | 800 | 3 | IM-2 | 18/16 |
| ML-1 Mind Lattice (rack_mind_lattice) | L5 mind_lattice_dossier | The whole floor as one machine | 12.0M | -520 | 520 | 1,400 | 3 | IM-3 | 24/8 |

PF per kW rises 1.08, 1.44, 1.75, 1.87, 2.1, 2.7. PF per $M rises 93, 107, 105, 117, 123, 117: Synthetic is the cheapest PF in the game.

**Cooling chain**

| Item (id) | Level / tech | Grounding | Cost | Draw kW | Capacity kW | W | Upgrades from | Seal B/G |
|--|--|--|--|--|--|--|--|--|
| CDU 400 (cdu) | L2 chilled_loop | In-rack/row coolant distribution unit | 0.40M | -4 | 400 | 2 | - | 4/2 |
| Row CDU 1.6 MW (cdu_big) | L3 tower_hydraulics | Row CDU (real ones reach 1.35 MW) | 1.30M | -14 | 1,600 | 3 | CDU 400 | 4/3 |
| CDU Hall 6 MW (cdu_hall, new) | L5 immersion_vault | Facility-scale CDU skid | 4.50M | -40 | 6,000 | 5 | Row CDU | 5/4 |
| CH-600 Chiller (chiller) | L2 chilled_loop | Water-cooled chiller, COP 5.5 | 1.10M | -6 | 600 | 4 | - | 3/10 |
| CH-2400 Tower Chiller (chiller_tower) | L3 tower_hydraulics | Cooling-tower plant, COP 7 | 3.50M | -22 | 2,400 | 6 | CH-600 | 0/6 |
| CC-3000 Cryo Chiller (cryo_core) | L4 cryo_core_dossier | Low-temperature refrigerant plant, COP 16 | 5.20M | -25 | 3,000 | 6 | CH-2400 | 25/15 |
| CC-8000 Cryo Plant (cryo_plant, new) | L5 cryo_plant | Central refrigerant plant, COP 18 | 11.0M | -50 | 8,000 | 8 | CC-3000 | 30/18 |

**Power chain**

| Item (id) | Level / tech | Grounding | Cost | Out kW | W | Upgrades from | Seal B/G |
|--|--|--|--|--|--|--|--|
| Gas Turbine 3 MW (genset_gas) | L3 gas_concession | Aeroderivative turbines, used at real AI sites | 1.60M | +3,000, $18/kWh | 6 | Diesel (Shared) | 3/12 |
| Grid Autonomy 20 MW (grid_tie_4) | L5 grid_autonomy | Dedicated HV feeder and substation | 3.40M | +20,000 | 10 | Grid 9 MW | 0/14 |
| Combined-Cycle Block 12 MW (genset_cc, new) | L5 combined_cycle | Gas plant behind the fence | 9.00M | +12,000, $14/kWh, start 20 ticks | 8 | Gas Turbine | 3/25 |
| Small Modular Reactor 10 MW (reactor_smr, new) | L5 reactor_licence | SMRs and restarted plants for AI | 24.0M | +10,000, $4/kWh, start 600 ticks | 8 | - | 4/8 |
| Continuity Monitor (continuity_monitor) | L5 continuity_form | UPS with process watch | 1.80M | +800, 400 kWh | 3 | Flywheel (Shared) | 10/4 |
| Process Backup Vault (backup_vault) | L5 backup_vault_charter | Checkpoint store, 20 PB | 1.60M | -30 | 3 | TL-8000 | 8/2 |

### 2.4 Bio: The Flesh (Specialist)

Unlock: **commit to Bio** (Level 3, Mel's bond at least 50, bio seal under 100) **and** research. Nodes show "Commit to The Flesh to research" until then (so RP is never wasted). Bio items clean bio seal while running, but the cost is care: tissue at 37 C (+/-1), fed, and clean.

**Compute chain** (SP weight Bio 1.5, times 1 - bio seal)

| Item (id) | Level / tech | Grounding | Cost | Draw kW | Heat kW | PF | W | Upgrades from | Seal B/G |
|--|--|--|--|--|--|--|--|--|--|
| OC-1 Organoid Cabinet (organoid_incubator) | L3 wetware_annex | Brain organoids, FinalSpark-style bioprocessors | 2.40M | -24 | 24 | 135 | 2 | OC-0 (Starter) | -8/0 |
| OC-2 Vat Bank (rack_organoid_2) | L4 organoid_vats | Perfused culture banks | 4.50M | -45 | 45 | 300 | 3 | OC-1 | -10/0 |
| OC-3 Perfused Cortex (rack_organoid_3, new) | L5 tissue_scaffolds | Vascularised tissue scaffolds | 7.50M | -70 | 70 | 520 | 3 | OC-2 | -11/2 |
| OC-4 Neural Vat (neural_pit) | L5 neural_pit_dossier | Whole-organ culture | 12.0M | -110 | 110 | 850 | 4 | OC-3 | -12/2 |

PF per kW: 5.6, 6.7, 7.4, 7.7. PF per $M: 56, 67, 69, 71. Cheap to power, dear to keep alive.

**Care line (the cooling line)**: bio racks hold 37 C by perfusion, not air. New units hold a target temperature in a radius instead of removing heat to a setpoint.

| Item (id) | Level / tech | Grounding | Cost | Draw kW | Capacity | W | Upgrades from | Seal B/G |
|--|--|--|--|--|--|--|--|--|
| Perfusion Bath PB-60 (perfusion_bath, new) | L3 perfusion_baths | Water bath at 37 C | 0.50M | -4 | 60 kW, holds 37 C, r5 | 2 | - | -2/0 |
| Perfusion Manifold PM-250 (perfusion_manifold, new) | L4 perfusion_manifold | Bioreactor heat-exchange loop | 1.60M | -12 | 250 kW, r8 | 3 | PB-60 | -3/0 |
| Vascular Plant VP-1000 (vascular_plant, new) | L5 vascular_plant | Industrial bioprocess thermal plant | 5.50M | -35 | 1,000 kW, r12 | 5 | PM-250 | -4/0 |
| Nutrient Plant (nutrient_plant) | L3 wetware_annex | Culture media plant | 1.10M | -25 | nutrient 20 | 3 | NT-1 (Starter) | -6/2 |
| Nutrient Works NW-60 (nutrient_works, new) | L4 nutrient_works | Fermentation-scale media | 3.20M | -60 | nutrient 60 | 4 | Nutrient Plant | -8/3 |
| Sterile Bay / Biomass Disposal / Quarantine Lock | L4 (as now) | Cleanroom, incinerator, airlock | 0.9 / 2.2 / 0.35M | -30 / -70 / -3 | as now | 2 / 3 / 1 | - | 3/0, 6/0, 0/0 |

**Power chain**

| Item (id) | Level / tech | Grounding | Cost | Out kW | W | Upgrades from | Seal B/G |
|--|--|--|--|--|--|--|--|
| Bio-Reactor BR-500 (bioreactor) | L4 bioreactor_permit | Biogas from culture waste | 2.80M | +500 (nutrient use 14) | 4 | - | -10/-4 |
| Biogas Digester BG-2000 (biogas_digester, new) | L5 biogas_digester | Anaerobic digestion plant | 9.00M | +2,000 (nutrient use 50) | 6 | BR-500 | -12/-6 |
| DNA Storage Vault (dna_vault) | L4 dna_archive_charter | DNA data storage, 16 PB | 1.60M | -8 | 2 | TL-8000 (Shared) | -5/0 |

### 2.5 Green: The Garden (Specialist)

Unlock: **commit to Green** (Level 3, Bea's bond at least 50, green seal under 100) **and** research. Green racks are light and cheap to run but need weather power, storage and siting; SP is also multiplied by the green score. New placement flags: PV Walls on exterior wall tiles, Canopy and Wind Masts on the roof floor only, Geothermal Well in a basement only.

**Compute chain** (SP weight Green 2.5, times green score, times 1 - green seal)

| Item (id) | Level / tech | Grounding | Cost | Draw kW | Heat kW | PF | W | Upgrades from | Seal B/G |
|--|--|--|--|--|--|--|--|--|--|
| NM-1 Neuromorphic (Starter, above) | L3 | Loihi-style | 0.80M | -12 | 12 | 50 | 2 | - | -1/-2 |
| NM-2 Event-Driven Array (rack_neuromorphic2, new) | L4 event_array | Spiking arrays, far lower power for sparse work | 2.10M | -28 | 28 | 150 | 2 | NM-1 | -1/-3 |
| PH-1 Photonic Rack (rack_photonic) | L5 photonic_bench | Optical matrix multipliers (Lightmatter-style) | 4.50M | -40 | 40 | 300 | 2 | NM-2 | 0/-4 |
| PH-2 Photonic Mesh (rack_photonic2, new) | L5 photonic_mesh | Chip-to-chip optical fabric | 8.00M | -70 | 70 | 600 | 3 | PH-1 | 0/-5 |

PF per kW: 4.2, 5.4, 7.5, 8.6 (best of the trees). PF per $M: 62, 71, 67, 75. Air only, no plumbing. PF per tile is the lowest of the trees.

**Cooling chain (free and recovered)**

| Item (id) | Level / tech | Grounding | Cost | Draw kW | Capacity kW | W | Upgrades from | Seal B/G |
|--|--|--|--|--|--|--|--|--|
| OA-400 Economizer (Starter, above) | L3 | Free-air cooling | 0.35M | -6 | 400 (ambient-derated) | 3 | - | 0/-2 |
| AD-1500 Adiabatic Unit (crah_adiabatic, new) | L4 adiabatic_cooling | Evaporative assist; uses water | 2.60M | -20 | 1,500, COP 12 | 4 | OA-400 | 0/-3 |
| CH-5000 Adiabatic Chiller (chiller_free) | L5 adiabatic_cooling | Large adiabatic plant, COP 14 (was 11) | 7.20M | -40 | 5,000 | 8 | AD-1500 | 0/-4 |
| Heat Recovery Unit 400 kW (Starter, above) | L3 | Heat sold | 0.95M | -25 | exports 400 | 3 | - | 0/-3 |
| District Heat Link 1.6 MW (heat_pipeline) | L5 heat_pipeline_franchise | Heat network, as in Nordic cities | 3.40M | -70 | exports 1,600 | 6 | HRU-400 | 0/-12 |

**Power chain (weather, storage, firm)**

| Item (id) | Level / tech | Grounding | Cost | Out kW | W | Upgrades from | Seal B/G |
|--|--|--|--|--|--|--|--|
| PV Wall Panels 150 kW (Starter) | L3 | Facade PV, about 25% capacity factor | 0.45M | +150 | 4 | - | -1/-6 |
| Wind Mast WM-300 (wind_mast) | L4 wind_permit | Small turbine, about 35% capacity factor | 1.25M | +300 | 2 | - | 0/-8 |
| PV Roof Canopy 420 kW (solar_canopy) | L4 canopy_array | Roof array (was L5) | 1.10M | +420 | 8 | PV Wall | -1/-10 |
| Hydrogen Fuel-Cell FC-1000 (fuel_cell, new) | L4 hydrogen_cell | Hydrogen backup in place of diesel | 1.80M | +1,000, $30/kWh | 3 | Diesel (Shared) | 0/-2 |
| Iron-Air Store IA-20 (ups_iron_air, new) | L5 iron_air_charter | Iron-air batteries, about 100 h, low efficiency | 5.00M | +1,500, 20 MWh, eff 0.5 | 6 | Battery Hall | 0/-6 |
| Geothermal Well GW-2000 (geothermal, new) | L5 geothermal_charter | Enhanced geothermal, firm power, basement only | 6.50M | +2,000, $2/kWh | 4 | - | 0/-14 |
| Algae Facade / Carbon Capture Stack | L3-5 | Credits, 160 / 1,100 a day | 0.48 / 2.60M | -8 / -60 | 4 / 6 | Algae to Stack | -2/-8, 0/-14 |

**Honest cost of weather power**: solar and wind cost 10 to 60 times the capex per average kW of grid power. That is the price of the green score, repaid by credits (a Carbon Capture Stack at $40 earns about $44k a day) and sold heat. Rule of thumb for a 10-rack PH-2 hall (700 kW): 7 canopies, one Iron-Air Store and a Fuel Cell or Geothermal Well for drought weeks, about $17M beside $80M of racks.

### 2.6 Advisor signature builds (ties to the dating side)

Each advisor's bond unlocks builds only she cares about. They are rewards, not requirements, and raise her bond +1 the first time placed. A bond-40 build is open to anyone (a taste); a bond-60/70 build needs her tree to be committed (Luci and Cass: just the bond).

| Advisor | Bond | Build (id) | What it is | Cost | Stats | Seal B/G |
|--|--|--|--|--|--|--|
| Luci | 40 | Luci's Rate Card (grid_tie_lucy, new) | Grid 9 MW at 25% off, negotiated | 1.10M | +9,000 kW | 0/16 (the catch) |
| Luci | 60 | Early Lattice | ML-1 buildable at Level 4 | 12.0M | as ML-1 | 24/8 |
| Mel | 40 | OC-1 preview | Up to 2 OC-1 before committing | 2.40M | as OC-1 | -8/0 |
| Mel | 70 | Mel's Cortex (rack_organoid_3m, new) | OC-3 with +15% PF and double contamination | 7.50M | 600 PF, -70 kW | -11/2 |
| Bea | 40 | Leaf-Bolt Microgrid (microgrid_bea, new) | 600 kW PV with 1 MWh storage in one block | 1.90M | +600, 1 MWh | -1/-12 |
| Bea | 60 | Early Garden | PH-1 buildable at Level 4 | 4.50M | as PH-1 | 0/-4 |
| Cass | 40 | Ice Thermal Battery (ice_store, new) | Chills water at night, releases it at the peak (real thermal storage) | 1.20M | 800 kW for 2 h | 0/0 |
| Cass | 70 | Cold Room | Cuts failure rate of all racks in radius 8 by 20% | 2.00M | - | 0/0 |

## 3. The shared early game (Levels 1-2) and the branch

Level 1 (0 to 120 PF) and Level 2 (120 to 400 PF) are Shared, plus the Synthetic cooling start (the default path). The player builds AC-1, AC-3, storage, air handlers, grid intakes, a battery and usually a diesel genset (the trap). At Level 2 LC-2, CDU 400 and CH-600 open.

| Step | Level | Player does | Opens |
|--|--|--|--|
| 1 | L1 | AC-1 racks, AH-150, Grid 1.5 MW, Foreman | Contracts |
| 2 | L2 (120 PF) | AC-3, Grid 3.5 MW, tape; LC-2 line begins | Synthetic chain; `culture_media`; first Bea and Mel scenes |
| 3 | L2-3 | May build Starter items (research only) | OC-0, NM-1, PV Walls, OA-400, HRU-400 |
| 4 | L3 (400 PF) | **Commit sheet (FORM A-5)**: Synthetic (nothing needed), Bio or Green (bond 50, seal under 100) | Specialist lines; other lines close to new placement |

| From | To Synthetic | To Bio | To Green |
|--|--|--|--|
| AC-1 / AC-3 | LC-2 (L2, no commit) | OC-0 then OC-1 (upgrade) | NM-1 then NM-2 (upgrade) |
| Grid, Genset | Gas Turbine, Grid 20 MW, SMR | BR-500, Biogas | Fuel Cell, Wind, Canopy, Geothermal |
| Air handlers | CDU, chillers, cryo | Perfusion baths | Economizer, Adiabatic |
| Battery Bank | Continuity Monitor | - | Iron-Air Store |

A careless Level 1-3 tower (diesel, CH-600, immersion early) is already near 70-100 green seal. That is the design (SOUL.md 2.1).

## 4. How each tree plays

| | Synthetic: The Lattice | Bio: The Flesh | Green: The Garden |
|--|--|--|--|
| Mood | Easy, dense, dirty | Wetware, fragile, needs care | Low-carbon, intermittent, needs storage and siting |
| Advantage | Most PF per $ and per tile; scores from day one; no commit, no bond | Low power per PF; cleans bio seal; SP weight 1.5 | Highest SP weight (2.5); no plumbing; free power on a good day; credits and heat income |
| Constraint | Heat and power grow fastest; every item scars Bio and Green; two-phase fluids are PFAS | Tissue at 37 C +/-1; nutrient supply; contamination climbs with output; corruption 99% ends the run | Sun and wind vary; drought weeks (6% a day); storage and a firm source are mandatory; siting rules; green score multiplies SP |
| Real basis | Hyperscaler gas turbines, 120+ kW liquid racks, two-phase fluorocarbons, SMR deals | Organoid computing, perfusion, biosafety | Neuromorphic and photonic chips, free cooling, district heat, iron-air storage, geothermal |
| Player thinks about | Cooling plant and grid upgrades | Feeding and cleaning schedule | Weather forecast and battery state |

## 5. Balance targets

Competent player: Level 2 by day 2, Level 3 by day 8, commit about day 9 to 10. Model: BALANCE_AUDIT revenue and PF figures, `spPerPflopHour` 0.0014 (1 PF is 0.0336 SP a day at weight 1). Days are game days (1 day = 144 s at 1x). Estimates only; verify with `soulRun.ts` after implementation.

| Tree | Weighted PF-days needed | Days to 1000 SP (competent) | Casual | Notes |
|--|--|--|--|--|
| Synthetic | about 18,600 at mean weight 1.6 | **about 25** | 40 | Shared racks score at 1; chain racks at 2 |
| Bio | about 26,500 Bio PF-days at weight 1.5, seal 0.25 | **about 38** | 55 | Commit at day 10 means near-zero Bio SP until OC-1; care takes attention |
| Green | about 25,000 Green PF-days at 2.5, green score 0.6, seal 0.2 | **about 44** | 65 | Weather power ramps slowly; storage comes first |

Why Synthetic is easiest:
1. It scores from day 1 and from every shared rack, so the player never starts from zero.
2. It needs no commit, no bond and no seal.
3. It has the cheapest PF per $M and the most PF per tile.
4. Its cost is deferred: the seals are only felt if the player turns to another tree.
5. It keeps ticking while the player builds Bio or Green, since shared racks still feed it (about 75 days to 1000 SP at 400 PF of shared racks). That clock is the pull: a slow Bio or Green player loses to the Lattice by default.

Tuning knobs: `spPerPflopHour`, `spWeights`, rack costs, seal numbers. Set tree difficulty with Green weight times green score (target mean effective 1.5) and Bio contamination rates.

### 5.1 Coordinator balance check (fixes applied to this spec)

Checked against `balance.json` (spTarget 1000, spPerPflopHour 0.0014, bondStart 20 (Luci 30), bondFollow +3, bondCommit 50, Level PF gates 120 / 400 / 1200 / 3000).

| Check | Result |
|--|--|
| SP arithmetic | 1000 SP = 29,760 weighted PF-days. Synthetic 25 days = 744 PF average: consistent with Level 4 (1200 PF) late. Bio 38 days and Green 44 days are consistent with their weights and seal assumptions. OK. |
| **Bond pace (was broken)** | Commit needs bond 50 from 20 = 10 followed decisions for ONE advisor by day 9. Not reachable: commit would slip to about day 20+, so Bio about 50+ days and Green about 60+. **Fix:** the After-hours visit (VN_WRITING.md dating proposal 1) gives +3 bond to the advisor visited, once a day. Focusing one advisor reaches 50 by about day 7-9 with normal follows. Target: an attentive player can commit by day 10-12. |
| **Starter scar (was backwards)** | OC-0 / NT-1 scarred Bio, so trying Bio made Bio harder. Fixed above: starters never scar their own tree. |
| Lattice pull | A Bio or Green player keeping 400 PF of shared racks still feeds the Lattice at about 13 SP a day (about 75 days to 1000). Bio and Green targets (38-44, worst case about 55) stay ahead of it, so the pull is pressure, not a trap. OK. |
| SP per $ | Synthetic about 220 weighted SP-PF per $M, Bio about 71, Green about 84. Synthetic about 3x cheaper per point: intended (easy), but the largest gap to watch in playtest. |
| Support capex | 8-25% rule holds in each tree (Green near the top because of weather power; repaid by credits and heat). OK. |

**Acceptance (after implementation):** `soulRun.ts` scripted runs per tree on seeds 1-3 must land within 20% of the day targets (Synthetic 25, Bio 38, Green 44), with no bankruptcy. If not, tune `spWeights`, rack costs and seal numbers, not the targets.

## 6. Migration note

| Change | Detail |
|--|--|
| Removed | `rack_air_gpu3` (already retired); `rack_imm_gpu` (IM-1; map to `rack_imm_gpu2`, no cost); tech `hot_aisle`, `dielectric_handbook`, `ministry_liaison`, `procurement_committee` (refund RP if researched). |
| Retagged line | `rack_dlc_gpu`, `chiller`, `cdu`, `genset_gas` to synthetic; `grid_tie_3` to shared; `rack_neuromorphic`, `solar_skin`, `heat_exchanger` get `tier: starter`. |
| Stats changed | `rack_mind_lattice` (1400 PF, 520 kW, $12M), `rack_photonic` (300 PF, $4.5M), `neural_pit` (850 PF, 110 kW, $12M), `chiller_free` (COP 14), `solar_canopy` (L4), `rack_organoid_2` (L4), `cryo_core` (L4). |
| New facility ids | `rack_culture_s`, `nutrient_tank_s`, `crah_econ`, `cdu_hall`, `cryo_plant`, `genset_cc`, `reactor_smr`, `rack_organoid_3`, `perfusion_bath`, `perfusion_manifold`, `vascular_plant`, `nutrient_works`, `biogas_digester`, `rack_neuromorphic2`, `rack_photonic2`, `crah_adiabatic`, `fuel_cell`, `ups_iron_air`, `geothermal`, `grid_tie_lucy`, `rack_organoid_3m`, `microgrid_bea`, `ice_store`, `cold_room`. |
| New tech ids | `culture_bench`, `perfusion_baths`, `perfusion_manifold`, `vascular_plant`, `biogas_digester`, `nutrient_works`, `economizer`, `event_array`, `photonic_mesh`, `hydrogen_cell`, `geothermal_charter`, `iron_air_charter`, `cryo_plant`, `combined_cycle`, `reactor_licence`. Renamed (display only): `authority_charter`, `grand_concordat`. |
| New schema | `FacilityDef.upgradesFrom?`; `FacilityDef.tier?: "starter" \| "specialist"`; `FacilityDef.unlock?: { bond?: {who, min}; commit?: path }`; `TechNode.requiresCommit?: path` (replaces the `path` tag that today gates only Level 5 nodes); placement flags `roofOnly`, `exteriorOnly`, `basementOnly`; cooling `holdC` for perfusion units. New command `upgradeFacility`. |
| Snapshot | Bump to v13. Migration maps removed ids and leaves scars and residue untouched. Saves that already own Bio or Green items keep them running (new Bio or Green placement needs the commit). Tests to update: `tier.test.ts` (path tier now from the new fields), `biotech.test.ts` (OC-1 needs a commit), `tech.test.ts` (new prereqs), `m4.test.ts`, `content.test.ts` counts, determinism hashes. |

## 7. New sprites requested from the owner

| Sprite | Description |
|--|--|
| OC-0 Culture Rack | Small steel lab cabinet, glass doors, pink-tinted trays, a green status LED. |
| NT-1 Nutrient Tank | Waist-high steel tank with an amber tube and a level window. |
| OC-3 Perfused Cortex (and Mel's Cortex) | Tall cabinet of red-lit tissue lobes with tubes; Mel's variant glows violet. |
| Perfusion Bath, Manifold, Vascular Plant | Three sizes of water bath, tube manifold and plant skid, pink-red tint. |
| Nutrient Works NW-60 | Fermenter tanks with a broth pipe rack. |
| Biogas Digester BG-2000 | Domed digester tank with a gas flare stub. |
| NM-2 Event-Driven Array | Air rack with a mesh of small blinking chips, leaf-green trim. |
| PH-2 Photonic Mesh | Glass-fronted rack with threaded light beams, white and cyan. |
| OA-400 Economizer, AD-1500 Adiabatic Unit | Louvred roof box with a fan; the adiabatic one has a wet pad and mist. |
| Fuel Cell FC-1000 | Pale blue cabinet with a hydrogen cylinder bank. |
| Iron-Air Store IA-20 | Long rust-orange container with a battery icon. |
| Geothermal Well GW-2000 | Basement wellhead with steam pipes and a pump. |
| Leaf-Bolt Microgrid (Bea) | PV panel on a cabinet with a leaf-bolt badge. |
| CDU Hall, CC-8000 Cryo Plant | Big skids with frost-covered pipes (the Cryo Plant is larger). |
| Combined-Cycle Block, SMR | Gas plant with a stack; a small domed reactor block with a warning stripe. |
| Luci's Rate Card | Grid intake in crimson and gold. |
| Ice Thermal Battery (Cass) | Insulated white tank with frost and an ice-blue light. |

## 5.2 As implemented: final balance and deviations

Scripted per-tree policy (`npx tsx tools/sim-cli/src/soulRun.ts starter 75 1,2,3 all`), days to 1000 SP:

| tree | seed 1 | seed 2 | seed 3 | mean | target |
|--|--|--|--|--|--|
| Synthetic | 24.6 | 29.6 | 28.3 | 27.5 | 25 |
| Bio-commit | 38.6 | 38.4 | 34.0 | 37.0 | 38 |
| Green-commit | 52.7 | 45.0 | 46.6 | 48.1 | 44 |

All nine runs are within 20% of target. The After-hours visit is now real (`visitAdvisor`, +3 bond a day, VN_WRITING.md "Dating systems as built"); the player script uses it and the numbers above are the runs with it (no balance change was needed). Quiet relationship scenes must not spend the day's decision slot: when they did, one Green seed lost the race to the Lattice.

Tuned knobs: `spPerPflopHour` 0.0017; `spWeights.synthetic.synthetic` 2.5; `spWeights.synthetic.greentech` 0; `spWeights.greentech.greentech` 3.4; `starterWeight` 0.5; several RP costs (wind_permit 9500, cryo_core_dossier 28000, event_array 8000, photonic_bench 30000, photonic_mesh 32000).

Deviations: microgrid_bea is solar only (no storage); ice_store is a plain 800 kW air handler (no time shift); cold_room is a 60 kW handler with failureFactor 0.8; fuel_cell is width 4 and nutrient_tank_s width 2 (art width minimums); perfusion units are bioOnly handlers with holdC 37 (cool only cells under organoid racks); OC-1 preview waives the tech gate; early tiers use `unlock.early` / `TechNode.earlyTier`; tech `path` no longer gates anything (`requiresCommit` does); `upgradeFacility` takes an optional `defId` where several targets exist. Flavor quotes were checked against sources in docs/QUOTES_CHECK.md.
