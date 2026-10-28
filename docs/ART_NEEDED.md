# Art needed

What the game still needs drawn. Part A is sprites the coordinator's agents draw in code. Part B is illustrations the owner produces by hand.

Facts used here were read from the code on this branch:

- Facility art is procedural. `packages/render/src/art.ts` picks a body per kind (`bodyArt`) and a rack variant per rack (`rackVariant`: air, dlc, storage, immersion, organoid, dna, neural). `packages/render/src/pixi/facilityArt.ts` draws the bodies. Colour and accent come from each facility's `color` and `accent` in `facilities.json`.
- So "own sprite" means the item is the first of its body or variant. Every later item of that body or variant is the same drawing with a different tint, width and trim tier. That is the placeholder state named in `docs/REFRAME.md` and `docs/TREES.md` section 7.
- Tree rung numbers come from `facilities.json` (`rung`). Synthetic is LC-2 to ML-1, Bio is OC-1 to OC-4, Green is NM-1 to PH-2.

## Part A: sprites to draw in code

Format: id, name, what it should look like (real-world look), current state.

### A1. Racks

Tree rungs:

- `rack_dlc_gpu`, LC-2 Liquid-Cooled Rack (Synthetic rung 1). A 2-tile liquid-cooled GPU cabinet like a modern hyperscale liquid rack: a coolant manifold down one side with blue and copper quick-disconnect hoses, a sealed front door with a status strip. Current: own sprite (the DLC cabinet). It is the reference body for LC-3, LC-4 and ML-1.
- `rack_dlc_gpu2`, LC-3 Cold-Plate Rack (Synthetic rung 2). Same liquid cabinet, with cold-plate manifolds and a second coolant tap per cabinet. Current: reuses the LC-2 body. Differs only by trim tier and the blue tint.
- `rack_dlc_gpu3`, LC-4 Blade Rack (Synthetic rung 3). A blade chassis: shallow blades stacked behind a clear door, coolant manifold at the rear. Current: reuses the LC-2 body with the top trim tier. Same blue tint.
- `rack_mind_lattice`, ML-1 Mind Lattice Rack (Synthetic rung 4). Tall lattice cabinet: a rack of dense boards behind a grid door, lit cyan, fluid coolant lines running up the side. Current: reuses the LC body with the top trim tier, tinted blue (same as LC-2). No Synthetic look of its own.
- `organoid_incubator`, OC-1 Organoid Cabinet (Bio rung 1). A steel lab cabinet with glass doors holding a row of jars with pale tissue, pink-tinted trays, a green status LED. Current: own sprite (the organoid jar variant).
- `rack_organoid_2`, OC-2 Organoid Vat Bank (Bio rung 2). A wider bank of sealed vats with a nutrient feed on the side. Current: reuses the OC-1 organoid body, tinted red.
- `rack_organoid_3`, OC-3 Perfused Cortex (Bio rung 3). Tall cabinet of red-lit tissue lobes with tubes running between them. Mel's variant glows violet (see `docs/TREES.md` section 7). Current: reuses the OC-1 organoid body, tinted red.
- `neural_pit`, OC-4 Neural Vat (Bio rung 4). A sunken or floor-level vat with a neural mass under red light and a fine cable mesh. Current: own sprite (the neural variant, picked by the id).
- `rack_neuromorphic`, NM-1 Neuromorphic Rack (Green rung 1). A leaf-green air rack, slimmer than AC-1, with small chip modules in the door. Current: reuses the AC-1 air body, tinted green.
- `rack_neuromorphic2`, NM-2 Event-Driven Array (Green rung 2). An air rack with a mesh of small blinking chips and leaf-green trim (`docs/TREES.md` section 7). Current: reuses the air body, tinted green.
- `rack_photonic`, PH-1 Photonic Rack (Green rung 3). An air rack with a fine glass front and a light module at the top. Current: reuses the air body, tinted green.
- `rack_photonic2`, PH-2 Photonic Mesh (Green rung 4). Glass-fronted rack with threaded light beams, white and cyan (`docs/TREES.md` section 7). Current: reuses the air body, tinted green.

Base racks:

- `rack_air_gpu`, AC-1 Air-Cooled Rack. A plain air-cooled GPU cabinet with vent slits and a dark glass door. Current: own sprite (the air body).
- `rack_air_gpu2`, AC-3 Rear-Door Rack. An air rack with a rear-door heat exchanger on the back of the cabinet. Current: reuses the air body, tinted beige.
- `rack_infer`, IA-1 Inference Accelerator. An air rack with a pink-accented accelerator panel. Current: reuses the air body, tinted beige and pink.
- `rack_storage`, SA-1 Storage Array. A storage cabinet of drive bays. Current: own sprite (the storage variant, data cells).
- `rack_storage2`, TL-8000 Tape Library. A tape library, tall, with a robot-arm window. Current: reuses the storage variant, tinted olive.
- `backup_vault`, Process Backup Vault. A storage cabinet with a lilac-tinted vault door. Current: reuses the storage variant, tinted lilac.
- `dna_vault`, DNA Storage Vault. Tubes of stained material in racks. Current: own sprite (the dna variant).

Growth states (`growth_mass`, `growth_cyst`, `growth_lobe`) are drawn by the growth body, not by a rack variant. They are not in this list.

### A2. Tree support items (cooling, power, storage)

These are the signature support items named in `docs/TREES.md` section 7 and `docs/REFRAME.md`, plus the Cass and Bea builds. Each one currently reuses its kind's body with a data tint, unless noted.

- `crah_econ`, OA-400 Outside-Air Economizer. A louvred roof box with a large fan and an air intake. Current: reuses the Air Handler (crah) body, tinted grey-green.
- `crah_adiabatic`, AD-1500 Adiabatic Unit. A louvred box with a wet pad and a mist line. Current: reuses the crah body, tinted grey-teal.
- `ice_store`, Ice Thermal Battery (Cass). An insulated white tank with frost and an ice-blue light. Current: reuses the crah body, tinted white and ice.
- `cold_room`, Cold Room (Cass). A walk-in cold box with a frosted door. Current: reuses the crah body, tinted grey and blue.
- `perfusion_bath`, Perfusion Bath PB-60. A water bath, smallest size, with a pink-red tint. Current: reuses the crah body, tinted pink.
- `perfusion_manifold`, Perfusion Manifold PM-250. A tube manifold, middle size, pink-red tint. Current: reuses the crah body, tinted pink (same as PB-60).
- `vascular_plant`, Vascular Plant VP-1000. A plant skid, largest size, pink-red tint. Current: reuses the crah body, tinted pink.
- `cdu_hall`, CDU Hall 6 MW. A big coolant skid with frost-covered pipes. Current: reuses the coolant distribution (cdu) body, tinted steel.
- `cryo_plant`, CC-8000 Cryo Plant. Larger than CC-3000 with frost on the pipes. Current: reuses the chiller body, tinted pale steel.
- `cryo_core`, Cryo Chiller CC-3000. A chiller with pale blue frost. Current: reuses the chiller body, tinted grey-blue.
- `fuel_cell`, Hydrogen Fuel-Cell FC-1000. A pale blue cabinet with a bank of hydrogen cylinders. Current: reuses the diesel genset body, tinted pale blue.
- `ups_iron_air`, Iron-Air Store IA-20. A long rust-orange container with a battery icon (storage). Current: reuses the UPS body, tinted rust.
- `geothermal`, Geothermal Well GW-2000. A basement wellhead with steam pipes and a pump. Current: reuses the genset body, tinted grey. Basement only.
- `microgrid_bea`, Leaf-Bolt Microgrid. A PV panel on a cabinet with a leaf-bolt badge. Current: reuses the solar body, tinted green.
- `genset_cc`, Combined-Cycle Block 12 MW. A gas plant with a stack. Current: reuses the genset body, tinted dark slate.
- `reactor_smr`, Small Modular Reactor 10 MW. A small domed reactor block with a warning stripe. Current: reuses the genset body, tinted grey.
- `grid_tie_lucy`, Luci's Rate Card. A grid intake in crimson and gold. Current: reuses the grid intake body, tinted crimson.

Other support items that reuse a kind body with a tint (same work, lower priority, not in the owner list):

- Cooling: `chiller_tower`, `chiller_free`, `cdu_big`, `crah_rear_door`, `crah_hc`, `heat_pipeline`, `carbon_capture`.
- Power: `grid_tie_2`, `grid_tie_3`, `grid_tie_4`, `genset_gas`, `solar_canopy`, `ups_flywheel`, `ups_bank_big`, `continuity_monitor`.
- Bio support: `nutrient_works` (reuses the nutrient plant body, tinted green) and `biogas_digester` (reuses the bioreactor body, tinted rust).

Each kind's first item keeps its own body: `crah_unit`, `chiller`, `cdu`, `grid_tie`, `genset`, `ups_battery`, `solar_skin`, `wind_mast`, `heat_exchanger`, `algae_facade`, `nutrient_plant`, `bioreactor`.

## Part B: illustrations for the owner

Delivery for every background:

- File: `packages/ui/src/art/<name>.webp`. The file names below are the ones to use.
- Size: 640 × 420 (aspect 32:21), the same as `bg-bio`, `bg-green` and `bg-synth`. Draw at 2× (1280 × 840) and reduce with nearest-neighbour if needed.
- Colours: quantise to 48, as the other backdrops (`docs/STYLE_PC98.md`). Store lossless WebP.
- Keep the upper-left third calm. The VN caption box sits there (`docs/STYLE_PC98.md`), and the standing portrait is drawn over the frame.

Shared style prefix, paste before each description:

> Authentic 16-bit pixel art screenshot from a 1993 Japanese MS-DOS game. A macro photograph of a CRT monitor showing visible scanlines and RGB subpixels. 1990s retro anime game background, Falcom-style detail, extreme limited 16-colour palette, heavy pixel dithering, no people, no text, no UI.

Not wired yet. `packages/ui/src/vn/StoryScene.tsx` takes the backdrop from the scene's `backdrop` field, which is a tree id on the rung scenes and absent on the opening and objection scenes. The 12 location files below need a location-to-file mapping added before they appear in game.

### B1. Story locations

1. `bg-loc-f1-lot.webp`. F1 · THE LOT. Scenes: `st_intro`. Description: an outdoor gravel construction lot at dusk, in steady rain. A single rack lies in a split wooden crate under a tarp, with pallets, a chain-link site fence, and a lit portacabin in the distance. Wet gravel reflects a grey-violet sky with an orange seam at the horizon. A steel-frame skeleton of the future tower rises at the back.

2. `bg-loc-site-install.webp`. SITE · NEW INSTALLATION. Scenes: `obj_greentech`, `obj_biotech`. Description: the bare concrete floor of a half-built datacenter hall. Cable trays run overhead and yellow floor markings lead to one freshly installed cabinet under a work light. A clipboard hangs on a hook by the door. Unlit racks along the wall glow faint cyan.

3. `bg-loc-control-room.webp`. F1 · CONTROL ROOM. Scenes: `rung_syn_1`. Description: a tower control room with a wall of monitors and status lamps, a long desk with a telephone and a kettle, and a large wall display of the hall plan. The palette is dim indigo with green phosphor glow and a cold cyan edge light.

4. `bg-loc-finance-office.webp`. F1 · FINANCE OFFICE. Scenes: `rung_syn_2`. Description: a small office with a steel desk, filing cabinets, a ledger on a wooden stand and a wall calendar. Through a window the datacenter floor shows below. A brass desk lamp and gold accents suggest money, and the room is lit warm against the cool hall outside.

5. `bg-loc-plant-room.webp`. B1 · PLANT ROOM. Scenes: `rung_syn_3`, `rung_green_2`. Description: a basement mechanical plant room with chillers, pumps and a gauge board. Copper and green pipes run along the walls with valve wheels, and a faint steam plume rises near the ceiling. Warm orange light falls from caged lamps over the machines.

6. `bg-loc-floor-f2.webp`. F2 · THE FLOOR. Scenes: `rung_syn_4`. Description: the main computer floor on level 2, seen down a long perspective aisle between rows of racks with blinking lights. The aisle is lit cyan, and the racks fade into indigo at the far end. This is a working floor, not the tree-floor painting, so keep it distinct from `bg-synth`.

7. `bg-loc-wetware-annex.webp`. B1 · WETWARE ANNEX. Scenes: `rung_bio_1`, `rung_bio_2`. Description: a laboratory annex with rows of glass vats holding pale pink-lit organoids on stainless benches. Sterile lamps hang overhead and a violet light fills the room. The mood is clinical and quietly eerie.

8. `bg-loc-nutrient-line.webp`. B1 · NUTRIENT LINE. Scenes: `rung_bio_3`. Description: a pipeline gallery with fermenter tanks and broth pipes running along the wall. Amber gauges and a valve wheel sit beside pale green tank glass, and condensation beads on the pipes. The colours are muted greens and ambers.

9. `bg-loc-neural-pit.webp`. B2 · THE PIT. Scenes: `rung_bio_4`. Description: a deep basement pit with a large sunken vat in the floor. Red-lit tissue lobes hang from the walls, and tubes run down into darkness. A single spotlight falls on the vat from above, and the rest of the frame is near-black with red.

10. `bg-loc-panel-deck.webp`. ROOF · PANEL DECK. Scenes: `rung_green_1`. Description: a rooftop at midday, with solar panels in rows on a steel deck under a blue sky. A small cabinet with a leaf badge stands by a low parapet, and a distant city skyline sits in dithered haze.

11. `bg-loc-stairwell.webp`. ROOF · STAIRWELL. Scenes: `rung_green_3`. Description: a concrete roof-access stairwell climbing toward a door open to the sky. Light shafts fall across the steps, dust catches the light, and the walls carry green plant growth. A stub of a wind mast shows through the doorway.

12. `bg-loc-sunrise.webp`. ROOF · SUNRISE. Scenes: `rung_green_4`. Description: the roof at dawn, with an orange-to-violet sky and a long horizon. Panels and a wind mast stand as silhouettes against the light, and one cyan light glows on a cabinet at the edge of the frame. This is the calmest of the roof scenes.

### B2. Existing ending screens

These already exist. They are listed so nothing is redrawn by mistake.

- `bg-synth.webp` (640 × 420). Ending `singularity`, "The Lattice". Synthetic floor.
- `bg-bio.webp` (640 × 420). Ending `flesh`, "The Flesh Remembers". Biotech floor.
- `bg-green.webp` (640 × 420). Ending `garden`, "The Garden". Greentech floor.
- `absorbed`, "Absorbed". Has no backdrop and no epilogues in `endings.json`, so the screen is text only. Optional: a new `bg-absorbed.webp` in the ART_BRIEFS failure-ending style, if the owner wants one.

The title screen `bg-title.webp` (640 × 480) also exists.

### B3. Advisor expressions

Checked against `packages/content/src/data/story.json` and `packages/ui/src/art/index.ts`. Nothing is missing. Each advisor has the four expressions `neutral`, `pleased`, `displeased` and `unsettling`, and a `full` figure. All are present in `packages/ui/src/art/`.

The expressions the story uses: Luci pleased (12 lines), Bea displeased (3) and pleased (6), Mel pleased (6), displeased (1) and unsettling (1), and Cass pleased (2). No new expression is required by current content.

The "tender" expressions in `docs/VN_WRITING.md` belonged to the dating system, which the reframe removed. They are not needed.
