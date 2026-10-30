# Icon prompts: build items and research

Same steps as the achievement sheet: paste one box into ChatGPT, send back the image. If one cell comes out wrong, ask for just that cell again.

**Run sheet 1 first.** It is the sample. If it looks right, run the rest.

Build items: 76 in 4 sheets. Research ideas: 77 in 4 sheets. Then one test of a rack as a game-world sprite.

## Sheet 1 (sample): racks

```
Make ONE image: a sprite sheet of 22 game icons for the racks a player can build in a datacentre tower, in a 6 x 4 grid, read left to right, top to bottom. Leave the last 2 cell(s) as empty plates.

Style: 1990s Japanese PC-98 pixel art, matching a set of achievement icons already made. Hard pixel edges, no anti-aliasing, no blur, no text, no letters, no numbers, no labels.
Each icon sits in one square cell. Every cell has the same frame: a dark indigo square plate (#1a1a5e) with a thin gold rim (#e8b830), on a pure black background between cells.
Inside each plate, one simple centred object, front or three-quarter view, that still reads when shrunk to 32 x 32 pixels. Big shapes, few details. Same lighting (from the top left) and same scale across all cells.
Palette only: black #07072a, indigo #1a1a5e, #2e2e8a, #4a4ac0, cyan #40d0e0, gold #e8b830, #ffd860, white #f0f0ff, flesh pink #e07a8a, leaf green #50c060, red #d04040.
Machine and computer things lean cyan and indigo. Living tissue things lean flesh pink. Clean-energy and plant things lean leaf green. Money and paperwork lean gold.

Cells:
1. AC-1 Air-Cooled Rack: Four 8-GPU servers in an air-cooled cabinet.
2. LC-2 Liquid-Cooled Rack: A 72-GPU NVLink cabinet with cold plates on every die, drawing about 120 kW.
3. Storage Array SA-1: Disk shelves holding the datasets and checkpoints that training jobs stream from.
4. AC-3 Rear-Door Rack: Eight-GPU trays behind a water-cooled rear door that scrubs the exhaust before it reaches the aisle.
5. LC-3 Cold-Plate Rack: A 160 kW cabinet with cold plates on every die and 82% of its heat carried off by the coolant loop: 230 PFLOPS per cabinet.
6. LC-4 Blade Rack: Rack-scale blades on blind-mate manifolds, 85% liquid-cooled: 240 kW and 420 PFLOPS per cabinet, the best ratio of the liquid line.
7. IA-1 Inference Accelerator: Fixed-function inference cards: 95 PFLOPS from only 36 kW, so 2.6 PFLOPS per kW, five times the AC-1.
8. Tape Library TL-8000: A robotic tape library: 8,000 TB behind glass.
9. OC-1 Organoid Cabinet: A cabinet of cultured tissue on a nutrient drip, computing 135 PFLOPS from only 24 kW: 5.6 PFLOPS per kW, three times the best air or liquid rack.
10. DNA Storage Vault: Synthesised-strand archives in a chilled cabinet: 16,000 TB from 8 kW, twice the Tape Library.
11. OC-4 Neural Vat: A whole organ in a pit: 850 PFLOPS from 110 kW, 7.7 PFLOPS per kW.
12. Unregistered Organoid Mass: Tissue growth that was not on the plans.
13. Archival Cyst: A pale sac in an empty room holding 300 TB of what is probably data.
14. Registered Lobe: A ribbed tissue bulk that has begun to hum in time with the building.
15. NM-1 Neuromorphic Rack: Boards of spiking-neuron silicon that compute only when something happens.
16. PH-1 Photonic Rack: Optical matrix multipliers on glass: 300 PFLOPS from only 40 kW of air-cooled draw, 7.5 PFLOPS per kW.
17. ML-1 Mind Lattice Rack: The whole floor behaving as one machine: 1,400 PFLOPS from 520 kW of liquid-cooled load, 2.7 PFLOPS per kW.
18. Process Backup Vault: Cold storage holding a recent copy of every hosted process, indexed by name.
19. OC-2 Organoid Vat Bank: A bank of cultured tissue in a single vat.
20. OC-3 Perfused Cortex: Vascularised tissue scaffolds on a perfusion loop: 520 PFLOPS from 70 kW, 7.4 PFLOPS per kW.
21. NM-2 Event-Driven Array: A mesh of spiking arrays that draw almost nothing for sparse work: 150 PFLOPS from 28 kW of air-cooled load, 5.4 PFLOPS per kW.
22. PH-2 Photonic Mesh: A chip-to-chip optical fabric behind glass: 600 PFLOPS from 70 kW of air-cooled load, 8.6 PFLOPS per kW, the best in the game.
```
## Sheet 2: power

```
Make ONE image: a sprite sheet of 22 game icons for power equipment in a datacentre tower, in a 6 x 4 grid, read left to right, top to bottom. Leave the last 2 cell(s) as empty plates.

Style: 1990s Japanese PC-98 pixel art, matching a set of achievement icons already made. Hard pixel edges, no anti-aliasing, no blur, no text, no letters, no numbers, no labels.
Each icon sits in one square cell. Every cell has the same frame: a dark indigo square plate (#1a1a5e) with a thin gold rim (#e8b830), on a pure black background between cells.
Inside each plate, one simple centred object, front or three-quarter view, that still reads when shrunk to 32 x 32 pixels. Big shapes, few details. Same lighting (from the top left) and same scale across all cells.
Palette only: black #07072a, indigo #1a1a5e, #2e2e8a, #4a4ac0, cyan #40d0e0, gold #e8b830, #ffd860, white #f0f0ff, flesh pink #e07a8a, leaf green #50c060, red #d04040.
Machine and computer things lean cyan and indigo. Living tissue things lean flesh pink. Clean-energy and plant things lean leaf green. Money and paperwork lean gold.

Cells:
1. Grid Intake 1.5 MW: A step-down transformer and switchgear on the city's high-voltage main.
2. Diesel Genset 800 kW: An 800 kW diesel set that starts itself when the grid runs short.
3. Battery Bank 250 kWh: Battery cabinets behind a double-conversion rectifier: 250 kWh that bridges outages until the generator comes up.
4. Grid Intake 3.5 MW: A transformer hall on a dedicated 11 kV feeder.
5. Grid Intake 9 MW: A private 132 kV feeder with its own switchyard.
6. Gas Turbine 3 MW: A 3 MW turbine on a pipeline tap, at speed in about 6 minutes and burning fuel at $18 per kWh (the diesel genset costs $25).
7. Flywheel UPS 60 kWh: A vacuum-sealed flywheel bank.
8. Battery Hall 2.4 MWh: Battery strings in a ventilated hall: 2,400 kWh at up to 2 MW, 92% round-trip efficient.
9. Bio-Reactor BR-500: A fermentation tank driving a generator.
10. PV Wall Panels 150 kW: Photovoltaic cells on the south wall.
11. PV Roof Canopy 420 kW: A tilted panel field on stilts.
12. Wind Mast WM-300: A vertical-axis wind mast with two rotors, mounted on an upper floor.
13. Continuity Monitor: A flywheel cabinet that keeps hosted processes running through a dip: 800 kW of charge and discharge, 400 kWh of storage at 97% efficiency.
14. Grid Intake 20 MW: A dedicated 220 kV substation with a gatehouse.
15. Combined-Cycle Block 12 MW: A gas plant behind the fence: 12,000 kW at $14 a kWh, 20 minutes to speed.
16. Small Modular Reactor 10 MW: A sealed reactor block under a warning stripe: 10,000 kW at $4 a kWh, ten hours to reach power.
17. Biogas Digester BG-2000: An anaerobic digestion plant, a domed tank with a flare stub.
18. Hydrogen Fuel-Cell FC-1000: A pale cabinet over a bank of hydrogen cylinders: 1,000 kW at $30 a kWh, in about 4 minutes.
19. Iron-Air Store IA-20: A long rust-orange container of iron-air cells: 20,000 kWh at up to 1,500 kW, about 100 hours of backup for a small hall, at 50% round-trip efficiency.
20. Geothermal Well GW-2000: An enhanced-geothermal wellhead in the basement, hot pipes and a pump: 2,000 kW of firm power at $2 a kWh.
21. Luci's Rate Card: A 9 MW grid intake at a quarter off, negotiated by Luci herself in crimson and gold.
22. Leaf-Bolt Microgrid: Bea's own block of 600 kW of photovoltaics on a cabinet with a leaf-bolt badge.
```
## Sheet 3: cooling

```
Make ONE image: a sprite sheet of 18 game icons for cooling equipment in a datacentre tower, in a 6 x 3 grid, read left to right, top to bottom.

Style: 1990s Japanese PC-98 pixel art, matching a set of achievement icons already made. Hard pixel edges, no anti-aliasing, no blur, no text, no letters, no numbers, no labels.
Each icon sits in one square cell. Every cell has the same frame: a dark indigo square plate (#1a1a5e) with a thin gold rim (#e8b830), on a pure black background between cells.
Inside each plate, one simple centred object, front or three-quarter view, that still reads when shrunk to 32 x 32 pixels. Big shapes, few details. Same lighting (from the top left) and same scale across all cells.
Palette only: black #07072a, indigo #1a1a5e, #2e2e8a, #4a4ac0, cyan #40d0e0, gold #e8b830, #ffd860, white #f0f0ff, flesh pink #e07a8a, leaf green #50c060, red #d04040.
Machine and computer things lean cyan and indigo. Living tissue things lean flesh pink. Clean-energy and plant things lean leaf green. Money and paperwork lean gold.

Cells:
1. Air Handler AH-150: A computer-room air handler with its own compressor.
2. Chiller CH-600: A water-cooled chiller that rejects coolant-loop heat outdoors, spending about 1 kW of electricity per 5.5 kW of heat moved.
3. Coolant Distribution Unit: A heat exchanger and pump set that feeds warm-water cold plates from the facility loop.
4. Row Air Handler AH-320: A slim air handler on a chilled-water coil, mounted at the end of the row: 320 kW of heat removal within 5 tiles.
5. High-Capacity Air Handler AH-700: A large air handler with a fan wall: 700 kW of heat removal within 12 tiles.
6. Cooling-Tower Chiller CH-2400: A cooling tower on top of a chiller set: 2,400 kW of coolant heat rejected at COP 7.0 (1 kW of electricity per 7 kW of heat).
7. Row Coolant Distribution Unit: A plate-exchanger skid sized for a whole row: 1,600 kW of liquid-rack heat on its loop.
8. Adiabatic Chiller CH-5000: A large adiabatic chiller that chills the loop with very little compressor work: 5,000 kW at COP 14.
9. Cryo Chiller CC-3000: A low-temperature refrigerant plant that drives the loop far below ambient: 3,000 kW at COP 16.
10. CDU Hall 6 MW: A facility-scale coolant distribution skid on frosted pipework.
11. CC-8000 Cryo Plant: The central refrigerant plant of a Lattice tower: 8,000 kW of heat removal at COP 18 for 50 kW of compressor work.
12. Perfusion Bath PB-60: A water bath at 37 °C along the rack row.
13. Perfusion Manifold PM-250: A bioreactor heat-exchange loop.
14. Vascular Plant VP-1000: An industrial bioprocess thermal plant.
15. OA-400 Outside-Air Economizer: A louvred roof box that brings cool outside air in.
16. AD-1500 Adiabatic Unit: An evaporative air handler with a wet pad: 1,500 kW of heat removal within 10 tiles for 20 kW of fans.
17. Ice Thermal Battery: An insulated white tank that freezes water at night and melts it at the peak.
18. Cold Room: A cold, quiet room with a heavy door.
```
## Sheet 4: support and logistics

```
Make ONE image: a sprite sheet of 14 game icons for support rooms and logistics in a datacentre tower, in a 5 x 3 grid, read left to right, top to bottom. Leave the last 1 cell(s) as empty plates.

Style: 1990s Japanese PC-98 pixel art, matching a set of achievement icons already made. Hard pixel edges, no anti-aliasing, no blur, no text, no letters, no numbers, no labels.
Each icon sits in one square cell. Every cell has the same frame: a dark indigo square plate (#1a1a5e) with a thin gold rim (#e8b830), on a pure black background between cells.
Inside each plate, one simple centred object, front or three-quarter view, that still reads when shrunk to 32 x 32 pixels. Big shapes, few details. Same lighting (from the top left) and same scale across all cells.
Palette only: black #07072a, indigo #1a1a5e, #2e2e8a, #4a4ac0, cyan #40d0e0, gold #e8b830, #ffd860, white #f0f0ff, flesh pink #e07a8a, leaf green #50c060, red #d04040.
Machine and computer things lean cyan and indigo. Living tissue things lean flesh pink. Clean-energy and plant things lean leaf green. Money and paperwork lean gold.

Cells:
1. Spare Parts Depot: Shelving for spare GPU trays, PSUs and pumps.
2. Maintenance Bot Dock: Docking bays where maintenance bots recharge at 5 kW.
3. Central Parts Warehouse: Racked storage holding 60 spare parts, enough for a bad week.
4. Fast-Charge Bay: A four-bay dock with a 25 kW charger per berth.
5. Nutrient Medium Plant: Vats of warm nutrient medium.
6. Sterile Bay: A UV and chemical wash alcove.
7. Biomass Disposal Suite: A sealed chamber for non-standard tissue load.
8. Quarantine Lock: A one-tile airlock with gasketed doors.
9. Heat Recovery Unit 400 kW: A plate exchanger with a district-heating connection, fitted into the exhaust stream.
10. District Heat Link 1.6 MW: Insulated trunking to the district heating network.
11. Algae Bioreactor Facade: Glass tubes of circulating algae down the north wall.
12. Carbon Capture Stack: An amine scrubber column.
13. Nutrient Works NW-60: Fermentation-scale media production.
14. CT-1 Consciousness Transfer Unit: A chrome pod beside the lift.
```
## Sheet 5: research, power

```
Make ONE image: a sprite sheet of 22 game icons for research ideas about power, in a 6 x 4 grid, read left to right, top to bottom. Leave the last 2 cell(s) as empty plates.

Style: 1990s Japanese PC-98 pixel art, matching a set of achievement icons already made. Hard pixel edges, no anti-aliasing, no blur, no text, no letters, no numbers, no labels.
Each icon sits in one square cell. Every cell has the same frame: a dark indigo square plate (#1a1a5e) with a thin gold rim (#e8b830), on a pure black background between cells.
Inside each plate, one simple centred object, front or three-quarter view, that still reads when shrunk to 32 x 32 pixels. Big shapes, few details. Same lighting (from the top left) and same scale across all cells.
Palette only: black #07072a, indigo #1a1a5e, #2e2e8a, #4a4ac0, cyan #40d0e0, gold #e8b830, #ffd860, white #f0f0ff, flesh pink #e07a8a, leaf green #50c060, red #d04040.
Machine and computer things lean cyan and indigo. Living tissue things lean flesh pink. Clean-energy and plant things lean leaf green. Money and paperwork lean gold.

Cells:
1. Surge Protection Standard: a symbol for this research idea. Fuses on every circuit, in writing.
2. Off-Peak Tariff Agreement: a symbol for this research idea. A negotiated night rate with the utility.
3. Substation Licence: a symbol for this research idea. Permission to connect a dedicated 11 kV feeder.
4. Flywheel Licence: a symbol for this research idea. Rotor storage that bridges a minute of load in a second.
5. Gas Turbine Concession: a symbol for this research idea. A pipeline tap and a turbine to go with it.
6. Battery Hall Permit: a symbol for this research idea. Fire-code sign-off for a thousand cells in one room.
7. Transmission Feeder Agreement: a symbol for this research idea. A private line to the transmission grid.
8. Wind Mast Permit: a symbol for this research idea. Planning consent for a mast on an upper floor.
9. District Heat Agreement: a symbol for this research idea. Your waste heat is formally recognised as saleable.
10. Algae Cultivation Licence: a symbol for this research idea. Permission to grow algae on the building envelope.
11. Canopy Array Study: a symbol for this research idea. Load calculations for a roof-mounted panel field.
12. Heat Link Franchise: a symbol for this research idea. An exclusive right to supply the district network.
13. Carbon Capture Study: a symbol for this research idea. Proof that the carbon removed was carbon that was there.
14. Green Tariff: a symbol for this research idea. Every kilowatt-hour tracked by source and priced accordingly.
15. Grid Autonomy Charter: a symbol for this research idea. Permission to disagree with the utility in writing.
16. Hydrogen Fuel Cells: a symbol for this research idea. Hydrogen in place of diesel.
17. Iron-Air Charter: a symbol for this research idea. Slow, cheap, long-lived batteries.
18. Geothermal Charter: a symbol for this research idea. A drilling licence and a very deep hole.
19. Combined-Cycle Permit: a symbol for this research idea. A gas plant behind the fence.
20. Reactor Licence: a symbol for this research idea. A licence to run a small modular reactor on site.
21. Rate Card Negotiation: a symbol for this research idea. Luci reads the tariff schedule aloud, and then reads the footnotes.
22. Leaf-Bolt Microgrid: a symbol for this research idea. Panels and a controller in one cabinet, drawn on a napkin.
```
## Sheet 6: research, compute and administration

```
Make ONE image: a sprite sheet of 24 game icons for research ideas about computing hardware and company administration, in a 6 x 4 grid, read left to right, top to bottom.

Style: 1990s Japanese PC-98 pixel art, matching a set of achievement icons already made. Hard pixel edges, no anti-aliasing, no blur, no text, no letters, no numbers, no labels.
Each icon sits in one square cell. Every cell has the same frame: a dark indigo square plate (#1a1a5e) with a thin gold rim (#e8b830), on a pure black background between cells.
Inside each plate, one simple centred object, front or three-quarter view, that still reads when shrunk to 32 x 32 pixels. Big shapes, few details. Same lighting (from the top left) and same scale across all cells.
Palette only: black #07072a, indigo #1a1a5e, #2e2e8a, #4a4ac0, cyan #40d0e0, gold #e8b830, #ffd860, white #f0f0ff, flesh pink #e07a8a, leaf green #50c060, red #d04040.
Machine and computer things lean cyan and indigo. Living tissue things lean flesh pink. Clean-energy and plant things lean leaf green. Money and paperwork lean gold.

Cells:
1. Contract Automation: a symbol for this research idea. An automated bid desk that never sleeps.
2. Research Library Access: a symbol for this research idea. Licensed journal access for the research team.
3. Preferred Vendor Status: a symbol for this research idea. Your invoices are paid ahead of the queue.
4. Cost Accounting Reform: a symbol for this research idea. Costs are now allocated per rack.
5. Open Door: a symbol for this research idea. An open-door policy for your advisors.
6. Batch Scheduler Upgrade: a symbol for this research idea. Better packing for the job queue.
7. Rear-Door Cabinet Design: a symbol for this research idea. A reference design for a heat exchanger on the cabinet door.
8. Tape Library Engineering: a symbol for this research idea. Robotic retrieval for bulk datasets.
9. Cold-Plate Generation 3: a symbol for this research idea. Machined cold plates rated for 160 kW per cabinet.
10. Specialist Cards Programme: a symbol for this research idea. Fixed-function cards from a contract foundry, and event-driven silicon that idles when there is nothing to say.
11. Blade Manifold Architecture: a symbol for this research idea. Rack-scale blades that blind-mate to the coolant manifold.
12. Works Foreman: a symbol for this research idea. An automated build planner.
13. Fleet Policy Update: a symbol for this research idea. A policy document the bots have, against expectations, begun to read.
14. Photonic Bench Study: a symbol for this research idea. An optical bench and a long qualification run.
15. Cryo Chiller Study: a symbol for this research idea. A refrigeration schematic with a margin note reading "colder".
16. Continuity of Service Spec: a symbol for this research idea. Certifies that the process which began is the process which ends.
17. Backup Vault Charter: a symbol for this research idea. Cold storage for everything that should not be lost, and some things that should.
18. Mind Lattice Dossier: a symbol for this research idea. A specification for a rack that would prefer to be called a resident.
19. Continuity Policy: a symbol for this research idea. No process is ever finished, only archived.
20. Research Charter: a symbol for this research idea. A standing charter for the research office.
21. Event-Driven Arrays: a symbol for this research idea. Spiking arrays for sparse work.
22. Photonic Mesh: a symbol for this research idea. Chip-to-chip light.
23. Neuromorphic Bench: a symbol for this research idea. Spiking-neuron boards on a test bench, a roof permit and a louvre.
24. Transfer Protocol: a symbol for this research idea. A consent form, a pod and a door.
```
## Sheet 7: research, cooling and logistics

```
Make ONE image: a sprite sheet of 18 game icons for research ideas about cooling and maintenance logistics, in a 6 x 3 grid, read left to right, top to bottom.

Style: 1990s Japanese PC-98 pixel art, matching a set of achievement icons already made. Hard pixel edges, no anti-aliasing, no blur, no text, no letters, no numbers, no labels.
Each icon sits in one square cell. Every cell has the same frame: a dark indigo square plate (#1a1a5e) with a thin gold rim (#e8b830), on a pure black background between cells.
Inside each plate, one simple centred object, front or three-quarter view, that still reads when shrunk to 32 x 32 pixels. Big shapes, few details. Same lighting (from the top left) and same scale across all cells.
Palette only: black #07072a, indigo #1a1a5e, #2e2e8a, #4a4ac0, cyan #40d0e0, gold #e8b830, #ffd860, white #f0f0ff, flesh pink #e07a8a, leaf green #50c060, red #d04040.
Machine and computer things lean cyan and indigo. Living tissue things lean flesh pink. Clean-energy and plant things lean leaf green. Money and paperwork lean gold.

Cells:
1. Airflow Standardisation: a symbol for this research idea. One fan model, one mounting spec, fewer surprises.
2. Rear-Door Exchanger Licence: a symbol for this research idea. A heat exchanger on the cabinet door.
3. Chilled-Water Loop Design: a symbol for this research idea. Pump curves and loop balancing, done properly.
4. High-Capacity Air Handling: a symbol for this research idea. A fan wall sized for a whole hall.
5. Cooling Tower Hydraulics: a symbol for this research idea. A tower, a basin and a water-use permit.
6. Adiabatic Free Cooling: a symbol for this research idea. Evaporate the loop in open air and let the sky take the heat.
7. Rapid Swap Procedures: a symbol for this research idea. GPU tray swaps timed to the minute.
8. Bot Drivetrain Upgrade: a symbol for this research idea. Faster actuators and louder fans.
9. Aerial Survey Drones: a symbol for this research idea. Rotors that skip the lift entirely.
10. Central Warehousing: a symbol for this research idea. Bin locations, barcodes and a stock count.
11. Fast Charging: a symbol for this research idea. Twenty-five kilowatts per berth.
12. Heavy Lifter Chassis: a symbol for this research idea. A reinforced bot with room for three spare parts.
13. Autonomous Maintenance Corps: a symbol for this research idea. A coordinated fleet instead of a loose group.
14. Fleet Command Desk: a symbol for this research idea. A rota, a radio and a whiteboard for the bots.
15. Facility CDU Skid: a symbol for this research idea. A skid-mounted coolant distribution hall for a whole floor.
16. Cryo Plant Design: a symbol for this research idea. A central refrigerant plant.
17. Ice Thermal Storage: a symbol for this research idea. Chill water when power is cheap, spend it when it is not.
18. Cold Room Specification: a symbol for this research idea. A room kept cold on purpose.
```
## Sheet 8: research, wetware

```
Make ONE image: a sprite sheet of 13 game icons for research ideas about living tissue computing, in a 5 x 3 grid, read left to right, top to bottom. Leave the last 2 cell(s) as empty plates.

Style: 1990s Japanese PC-98 pixel art, matching a set of achievement icons already made. Hard pixel edges, no anti-aliasing, no blur, no text, no letters, no numbers, no labels.
Each icon sits in one square cell. Every cell has the same frame: a dark indigo square plate (#1a1a5e) with a thin gold rim (#e8b830), on a pure black background between cells.
Inside each plate, one simple centred object, front or three-quarter view, that still reads when shrunk to 32 x 32 pixels. Big shapes, few details. Same lighting (from the top left) and same scale across all cells.
Palette only: black #07072a, indigo #1a1a5e, #2e2e8a, #4a4ac0, cyan #40d0e0, gold #e8b830, #ffd860, white #f0f0ff, flesh pink #e07a8a, leaf green #50c060, red #d04040.
Machine and computer things lean cyan and indigo. Living tissue things lean flesh pink. Clean-energy and plant things lean leaf green. Money and paperwork lean gold.

Cells:
1. Wetware Annex Programme: a symbol for this research idea. A new annex off the plant room, with a floor drain and a risk assessment.
2. Sterile Protocols: a symbol for this research idea. Gowning, wash-down and a laminated chart.
3. Quarantine Procedure: a symbol for this research idea. Doors that interlock before you finish the sentence.
4. Disposal Licence: a symbol for this research idea. A permit with a very short distribution list.
5. DNA Archive Licence: a symbol for this research idea. Storage that grows its own shelves.
6. Bio-Reactor Permit: a symbol for this research idea. Power from fermentation, under licence 41-C.
7. Neural Vat Dossier: a symbol for this research idea. Forty pages, none of them dated.
8. Tissue Scaffolds: a symbol for this research idea. Lattices that keep the tissue where it was put.
9. Asset Register: a symbol for this research idea. Everything the Authority now considers yours, indexed.
10. Culture Media Procurement: a symbol for this research idea. Sterile media, in a standing order.
11. Organoid Vat Programme: a symbol for this research idea. Cabinets scaled up to vats, with the same drain.
12. Synaptic Mesh: a symbol for this research idea. A grid of fine wire through the tissue, so that failures are noticed earlier than they happen.
13. Biogas Digester: a symbol for this research idea. An anaerobic digestion plant.
```
## Sheet 9 (test only): one rack as a game-world sprite

This is a test, to compare with the rack drawn in code. Do not run the other world sprites yet.

```
Make ONE image: a pixel-art sprite strip of one server rack cabinet, shown 4 times side by side, same size, front view, on a flat magenta background (#ff00ff) so it can be cut out.

Style: 1990s Japanese PC-98 pixel art, side-on cutaway building game. Hard pixel edges, no anti-aliasing, no blur, no shadows on the background, no text.
The rack: a tall narrow dark steel cabinet with a perforated front door, four stacked GPU servers visible through it, small status LEDs on each server. Proportions about 1 wide to 2.2 tall.
Palette only: black #07072a, indigo #1a1a5e, #2e2e8a, #4a4ac0, cyan #40d0e0, gold #e8b830, white #f0f0ff, red #d04040.

The 4 copies, left to right:
1. Off: dark, no lights.
2. Running: cyan status lights on every server.
3. Hot: running, with a red-orange glow at the top and red lights.
4. Broken: dark, one server pulled half out, a red warning light.
```
